"""Haushaltsgeräte: „läuft“ und „fertig“ für Waschmaschine, Trockner, Spülmaschine & Co.

Erkannt wird über die Leistung (Steckdose mit Messung) oder einen Programmstatus. Je Durchgang zählt die
Energie (Zählerstand oder aufsummierte Leistung) und die Kosten mit dem Strompreis aus den Einstellungen
(Preissensor oder fester Preis); was gerade aus eigenem PV-Strom kommt, kostet nichts. Ist ein Gerät fertig,
gibt es eine Meldung (Alarmmanager, Push), bis jemand quittiert, die Tür öffnet oder das Gerät neu startet.

Für Panel und Automationen steht alles im Sensor ``sensor.haus_geraete`` (Zustand: Anzahl fertiger Geräte,
Attribut ``geraete``: Liste mit Zustand, Beginn, Ende, kWh, Kosten und den Mittelwerten früherer Durchgänge).
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, State, callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

KINDS: dict[str, tuple[str, str]] = {
    "wash": ("Waschmaschine", "mdi:washing-machine"),
    "dry": ("Trockner", "mdi:tumble-dryer"),
    "dish": ("Spülmaschine", "mdi:dishwasher"),
    "other": ("Gerät", "mdi:power-plug-outline"),
}
# Reihenfolge wichtig: „Waschtrockner“ ist ein Trockner, „Wäschetrockner“ auch
KIND_RE: list[tuple[str, re.Pattern]] = [
    ("dry", re.compile(r"(trockner|dryer)", re.I)),
    ("dish", re.compile(r"(sp(ü|ue)l|geschirr|dish)", re.I)),
    ("wash", re.compile(r"(waschmasch|wasch(en)?\b|washer|washing)", re.I)),
]
SKIP_AUTO_RE = re.compile(r"(energie|energy|verbrauch_gesamt|total|strom_heute|kosten|cost)", re.I)
DONE_RE = re.compile(r"(finish|end|done|complete|fertig|beendet|ready_to_unload)", re.I)
RUN_RE = re.compile(
    r"^(on|an|run|running|l(ä|ae)uft|in_?progress|active|aktiv|busy|wash|washing|waschen|pre_?wash|main_?wash|rinse|rinsing|"
    r"sp(ü|ue)len|spin|spinning|schleudern|dry|drying|trocknen|clean|cleaning|reinig|program|programm|heating|heizen)", re.I)
UNAV = {"unavailable", "unknown", ""}

START_S = 60          # so lange über der Startgrenze, bis „läuft“
MIN_RUN_S = 5 * 60    # kürzere Durchgänge (Tür auf/zu, Pumpe) melden nicht „fertig“
DONE_RESET_S = 12 * 3600  # „fertig“ ohne Quittung verschwindet nach 12 h still
HIST = 10             # gemerkte Durchgänge je Gerät

AUS, LAEUFT, FERTIG = "aus", "laeuft", "fertig"

# Strompreis wie im Panel (strompreis.js): Einheit …/kWh bzw. …/MWh, Name für die automatische Wahl
PRICE_NAME_RE = re.compile(r"(tibber|nordpool|epex|awattar|energi|strompreis|electricity.?price|energy.?price|current.?price|spot|tarif|tariff|price|preis)", re.I)
PRICE_SKIP_RE = re.compile(r"(feed.?in|einspeis|export|sell|verkauf|min|max|average|avg|durchschnitt|mittel|median|cheap|günstig|expensive|teuer|cost|kosten|monthly|monat|daily|tages)", re.I)
PRICE_LIST_KEYS = ("raw_today", "raw_tomorrow", "data", "prices", "forecast", "prices_today", "prices_tomorrow", "today", "tomorrow")


def unit_factor(unit: Any) -> float | None:
    """Faktor von der Einheit eines Preissensors auf €/kWh; None = kein Preis."""
    s = re.sub(r"\s+", "", str(unit or "")).lower()
    if not re.search(r"/(k|m)wh$", s):
        return None
    f = 0.01 if re.match(r"^(ct|cent|c|¢|öre|ore|øre|p)/", s) else 1.0
    return f / (1000 if s.endswith("/mwh") else 1)


def _num(st: State | None) -> float | None:
    if st is None:
        return None
    try:
        return float(st.state)
    except (TypeError, ValueError):
        return None


def power_w(st: State | None) -> float | None:
    """Leistung in W (Einheit W, kW oder MW)."""
    v = _num(st)
    if v is None:
        return None
    u = str(st.attributes.get("unit_of_measurement") or "").lower()
    return v * 1000 if u == "kw" else v * 1e6 if u == "mw" else v


def energy_kwh(st: State | None) -> float | None:
    v = _num(st)
    if v is None:
        return None
    u = str(st.attributes.get("unit_of_measurement") or "").lower()
    return v / 1000 if u == "wh" else v * 1000 if u == "mwh" else v


def kind_of(text: str) -> str:
    for kind, rx in KIND_RE:
        if rx.search(text):
            return kind
    return "other"


def _de(v: float, digits: int) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def dur_txt(sec: float) -> str:
    m = max(0, round(sec / 60))
    return f"{m} min" if m < 60 else f"{m // 60}:{m % 60:02d} h"


class ApplianceTracker:
    """Zustandsautomat je Gerät; ``changed`` ruft der Monitor, wenn sich Meldungen ändern können."""

    def __init__(self, hass: HomeAssistant, layout: Callable[[], dict], changed: Callable[[], None]) -> None:
        self.hass = hass
        self._layout = layout
        self._changed = changed
        self._store: Store = Store(hass, 1, f"{DOMAIN}.appliances")
        self.items: list[dict] = []
        self.data: dict[str, dict] = {}  # id → gespeicherter Zustand
        self._rt: dict[str, dict] = {}   # id → flüchtig (Grenze überschritten seit …, letzte Messung)
        self._listeners: list[Callable[[], None]] = []
        self._price_sensor: str = ""
        self._watch: set[str] = set()
        self._last_notify = 0.0

    # ---------- Laden, Speichern, Abo ----------
    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            self.data = {k: v for k, v in stored.items() if isinstance(v, dict)}
        now = time.time()
        for d in self.data.values():
            if d.get("state") == LAEUFT:
                d["last_t"] = now  # Ausfallzeit nicht aufsummieren

    def _save(self) -> None:
        self._store.async_delay_save(lambda: self.data, 10)

    @callback
    def async_add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)

        def _remove() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return _remove

    def _notify(self) -> None:
        for fn in list(self._listeners):
            fn()

    # ---------- Geräte ----------
    @property
    def cfg(self) -> dict:
        return self._layout().get("appliances") or {}

    @callback
    def rebuild(self) -> None:
        """Geräte aus den Einstellungen; ohne Einträge automatisch über den Namen der Leistungssensoren."""
        hass, cfg = self.hass, self.cfg
        items: list[dict] = []
        if cfg.get("enabled", True):
            items = [dict(i) for i in cfg.get("items", []) if i.get("power") or i.get("status")]
            if not items and cfg.get("auto", True):
                items = self._auto()
        for it in items:
            kind = it.get("kind") or kind_of(f"{it.get('name', '')} {it.get('power', '')}")
            it["kind"] = kind if kind in KINDS else "other"
            if not it.get("name"):
                st = hass.states.get(it.get("power") or it.get("status") or "")
                it["name"] = KINDS[it["kind"]][0] if it["kind"] != "other" else str((st and st.attributes.get("friendly_name")) or it.get("id"))
        self.items = items
        ids = {i["id"] for i in items}
        for k in [k for k in self._rt if k not in ids]:
            del self._rt[k]
        self._price_sensor = self._find_price()
        layout = self._layout()
        grid = (layout.get("header") or {}).get("grid") or ""
        self._watch = {e for it in items for e in (it.get("power"), it.get("status"), it.get("door"), it.get("energy")) if e} | ({grid} if grid else set())

    def _auto(self) -> list[dict]:
        out, seen = [], set()
        for st in sorted(self.hass.states.async_all("sensor"), key=lambda s: s.entity_id):
            if st.attributes.get("device_class") != "power":
                continue
            label = f"{st.entity_id} {st.attributes.get('friendly_name') or ''}"
            kind = kind_of(label)
            if kind == "other" or kind in seen or SKIP_AUTO_RE.search(st.entity_id):
                continue
            seen.add(kind)
            out.append({"id": kind, "name": KINDS[kind][0], "kind": kind, "power": st.entity_id, "auto": True})
        return out

    @property
    def watch(self) -> set[str]:
        return self._watch

    # ---------- Strompreis und Netzanteil ----------
    def _find_price(self) -> str:
        P = self._layout().get("price") or {}
        if P.get("use_sensor") is False:
            return ""
        get = self.hass.states.get
        if P.get("sensor") and get(P["sensor"]) is not None:
            return P["sensor"]
        cand = []
        for st in self.hass.states.async_all("sensor"):
            label = f"{st.entity_id} {st.attributes.get('friendly_name') or ''}"
            if unit_factor(st.attributes.get("unit_of_measurement")) is None or PRICE_SKIP_RE.search(label):
                continue
            score = (2 if any(isinstance(st.attributes.get(k), list) and st.attributes.get(k) for k in PRICE_LIST_KEYS) else 0) + (1 if PRICE_NAME_RE.search(label) else 0)
            cand.append((-score, st.entity_id))
        return min(cand)[1] if cand else ""

    def price_now(self) -> float:
        """Strompreis jetzt in €/kWh (mit Aufschlag) bzw. der feste Preis."""
        P = self._layout().get("price") or {}
        st = self.hass.states.get(self._price_sensor) if self._price_sensor else None
        v, f = _num(st), unit_factor(st.attributes.get("unit_of_measurement")) if st else None
        if v is not None and f is not None:
            return v * f + float(P.get("surcharge_ct", 0) or 0) / 100
        return float(P.get("fixed_ct", 30)) / 100

    def _grid_frac(self, watts: float) -> float:
        """Anteil aus dem Netz: eigener PV-Strom geht zuerst ans Gerät (wie an der Wallbox)."""
        layout = self._layout()
        g = power_w(self.hass.states.get((layout.get("header") or {}).get("grid") or ""))
        if g is None or watts <= 0:
            return 1.0
        if (layout.get("energy") or {}).get("grid_invert"):
            g = -g
        return max(0.0, min(1.0, max(0.0, g) / watts))

    # ---------- Zustandsautomat ----------
    def _status_of(self, it: dict) -> str | None:
        """Programmstatus: „laeuft“, „fertig“, „aus“ oder None (kein Status bzw. nicht erreichbar)."""
        st = self.hass.states.get(it.get("status") or "")
        if st is None or st.state in UNAV:
            return None
        s = st.state.strip().lower()
        if st.domain in ("binary_sensor", "switch", "input_boolean"):
            return LAEUFT if s == "on" else AUS
        if DONE_RE.search(s):
            return FERTIG
        return LAEUFT if RUN_RE.search(s) else AUS

    @callback
    def update(self, now: float | None = None) -> bool:
        """Alle Geräte auswerten; True, wenn sich ein Zustand geändert hat."""
        now = time.time() if now is None else now
        changed = False
        for it in self.items:
            changed |= self._step(it, now)
        if changed:
            self._save()
        # laufende Geräte: Energie und Kosten höchstens jede Minute an den Sensor
        running = any((self.data.get(i["id"]) or {}).get("state") == LAEUFT for i in self.items)
        if changed or (running and now - self._last_notify >= 60):
            self._last_notify = now
            self._notify()
        return changed

    def _step(self, it: dict, now: float) -> bool:
        get = self.hass.states.get
        aid = it["id"]
        d = self.data.setdefault(aid, {"state": AUS, "since": now, "hist": []})
        rt = self._rt.setdefault(aid, {})
        watts = power_w(get(it.get("power") or ""))
        prev = d.get("state", AUS)
        # Energie des laufenden Durchgangs aufsummieren (Leistung gilt bis zur nächsten Messung)
        if prev == LAEUFT:
            lt, lw = d.get("last_t"), d.get("last_w")
            if lt is not None and lw is not None and now > lt:
                e = lw * (now - lt) / 3600000
                d["kwh"] = d.get("kwh", 0.0) + e
                d["grid_kwh"] = d.get("grid_kwh", 0.0) + e * d.get("last_frac", 1.0)
                d["cost"] = d.get("cost", 0.0) + e * d.get("last_frac", 1.0) * d.get("last_price", self.price_now())
            if watts is not None:
                d["last_t"], d["last_w"] = now, watts
                d["last_frac"], d["last_price"] = self._grid_frac(watts), self.price_now()
            else:
                d["last_t"] = now
        status = self._status_of(it)
        start_w = float(it.get("start_w", 10))
        stop_w = float(it.get("stop_w", 5))
        stop_s = float(it.get("stop_min", 5)) * 60
        new = prev
        if status is not None:
            # Programmstatus geht vor; die Leistung zählt nur für die Energie
            if status == LAEUFT and prev != LAEUFT:
                new = LAEUFT
                rt["start_at"] = now
            elif status != LAEUFT and prev == LAEUFT:
                new = FERTIG
                rt["end_at"] = now
        elif watts is not None:
            if prev != LAEUFT:
                if watts >= start_w:
                    if rt.get("above") is None:
                        rt["above"], rt["above_w"] = now, watts
                    if now - rt["above"] >= START_S:
                        new = LAEUFT
                        rt["start_at"] = rt["above"]
                else:
                    rt["above"] = None
            elif watts < stop_w:
                if rt.get("below") is None:
                    rt["below"] = now
                if now - rt["below"] >= stop_s:
                    new = FERTIG
                    rt["end_at"] = rt["below"]
            else:
                rt["below"] = None
        if new == LAEUFT and prev != LAEUFT:
            t0 = rt.pop("start_at", now)
            d.update(state=LAEUFT, since=t0, start=t0, end=None, kwh=0.0, grid_kwh=0.0, cost=0.0,
                     last_t=t0, last_w=rt.get("above_w", watts or 0.0) if status is None else (watts or 0.0),
                     last_frac=self._grid_frac(watts or 0.0), last_price=self.price_now(),
                     e0=energy_kwh(get(it.get("energy") or "")))
            rt["above"] = rt["below"] = None
            if status is None and watts is not None:
                # Energie seit Überschreiten der Grenze bis jetzt nachtragen
                self._step_energy_only(d, now, watts)
            return True
        if new == FERTIG and prev == LAEUFT:
            end = rt.pop("end_at", now)
            self._finish(it, d, end)
            rt["above"] = rt["below"] = None
            return True
        if prev == FERTIG:
            door = get(it.get("door") or "")
            opened = door is not None and door.state in ("on", "open") and door.last_changed.timestamp() > (d.get("end") or 0)
            if opened or now - (d.get("end") or now) > DONE_RESET_S:
                d.update(state=AUS, since=now)
                return True
        return False

    def _step_energy_only(self, d: dict, now: float, watts: float) -> None:
        lt = d.get("last_t")
        if lt is not None and now > lt:
            e = d.get("last_w", watts) * (now - lt) / 3600000
            d["kwh"] += e
            d["grid_kwh"] += e * d["last_frac"]
            d["cost"] += e * d["last_frac"] * d["last_price"]
        d["last_t"], d["last_w"] = now, watts

    def _finish(self, it: dict, d: dict, end: float) -> None:
        start = d.get("start") or end
        kwh, cost = d.get("kwh", 0.0), d.get("cost", 0.0)
        e1 = energy_kwh(self.hass.states.get(it.get("energy") or ""))
        if e1 is not None and d.get("e0") is not None and 0 <= e1 - d["e0"] < 50:
            meter = e1 - d["e0"]
            frac = d.get("grid_kwh", 0.0) / kwh if kwh > 0 else 1.0
            cost = cost * meter / kwh if kwh > 0 else meter * frac * self.price_now()
            d["grid_kwh"] = meter * frac
            kwh = meter
        d.update(kwh=kwh, cost=cost, end=end)
        for k in ("last_t", "last_w", "last_frac", "last_price", "e0"):
            d.pop(k, None)
        if end - start < MIN_RUN_S:
            d.update(state=AUS, since=end)
            return
        d.update(state=FERTIG, since=end)
        own = 1 - d.get("grid_kwh", kwh) / kwh if kwh > 0.01 else None
        d["hist"] = ([*d.get("hist", []), {"start": round(start), "end": round(end), "kwh": round(kwh, 3), "cost": round(cost, 3),
                                           "own": None if own is None else round(own, 2)}])[-HIST:]

    @callback
    def ack(self, aid: str) -> bool:
        d = self.data.get(aid)
        if not d or d.get("state") != FERTIG:
            return False
        d.update(state=AUS, since=time.time())
        self._save()
        self._notify()
        self._changed()
        return True

    # ---------- Ausgabe ----------
    def alerts(self) -> list[tuple[str, str, str, str, str, float]]:
        """Fertige Geräte als (Schlüssel, Titel, Detail, Symbol, Leistungs-Entität, fertig seit)."""
        out = []
        for it in self.items:
            d = self.data.get(it["id"]) or {}
            if d.get("state") != FERTIG:
                continue
            out.append((f"appliance:{it['id']}", f"{it['name']} fertig", self.detail(d), KINDS[it["kind"]][1],
                        it.get("power") or "", d.get("end") or d.get("since") or 0))
        return out

    @staticmethod
    def detail(d: dict) -> str:
        parts = []
        if d.get("start") and d.get("end"):
            parts.append(f"Dauer {dur_txt(d['end'] - d['start'])}")
        kwh = d.get("kwh") or 0
        if kwh >= 0.005:
            parts.append(f"{_de(kwh, 2 if kwh < 10 else 1)} kWh")
            parts.append(f"{_de(d.get('cost') or 0, 2)} €")
            own = 1 - (d.get("grid_kwh", kwh) / kwh)
            if own >= 0.05:
                parts[-1] += f" ({round(own * 100)} % eigener Strom)"
        return " · ".join(parts)

    def snapshot(self) -> list[dict]:
        out = []
        for it in self.items:
            d = self.data.get(it["id"]) or {}
            hist = d.get("hist", [])
            n = len(hist)
            avg = (lambda k: round(sum((x.get(k) or 0) for x in hist) / n, 3)) if n else (lambda _k: None)
            row = {
                "id": it["id"], "name": it["name"], "kind": it["kind"], "icon": KINDS[it["kind"]][1],
                "state": d.get("state", AUS), "since": d.get("since"), "start": d.get("start"), "end": d.get("end"),
                "kwh": round(d.get("kwh", 0.0), 3), "cost": round(d.get("cost", 0.0), 3),
                "own": round(1 - d.get("grid_kwh", 0.0) / d["kwh"], 2) if d.get("kwh", 0) > 0.01 else None,
                "power": it.get("power", ""), "status": it.get("status", ""), "door": it.get("door", ""),
                "remaining": it.get("remaining", ""), "auto": bool(it.get("auto")),
                "n": n, "avg_min": round(sum(x["end"] - x["start"] for x in hist) / n / 60) if n else None,
                "avg_kwh": avg("kwh"), "avg_cost": avg("cost"),
                "last": hist[-1] if hist else None,
            }
            out.append(row)
        return out
