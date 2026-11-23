"""Anwesenheits-Simulation: Lichter und Rollos schalten wie an einem echten Tag der letzten Wochen.

- Läuft in den eingestellten Hausmodi (Standard: Urlaub) oder solange ein Schalter (input_boolean/switch) an ist.
- Vorlage ist ein Tag aus dem Verlauf (Recorder) der letzten Wochen, bevorzugt derselbe Wochentag.
  Jeder Schaltzeitpunkt wird zufällig um bis zu ± „jitter“ Minuten verschoben.
- Geplant wird bis Mitternacht, danach der nächste Tag. Endet der Modus (z. B. Rückkehr → Zuhause),
  stoppt die Simulation sofort; geschaltete Geräte bleiben, wie sie sind.
"""

from __future__ import annotations

import contextlib
import logging
import random
import time
from collections.abc import Callable
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, State, callback
from homeassistant.helpers.event import async_call_later, async_track_point_in_time, async_track_time_change
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from .alerts import AlertMonitor

_LOGGER = logging.getLogger(__name__)

DOMAINS = ("light", "cover", "switch", "input_boolean")
LOG_MAX = 60
ACTION_TXT = {"on": "an", "off": "aus", "open": "auf", "closed": "zu"}


def _norm(st: State | Any) -> tuple[str, int | None] | None:
    """Zustand aus dem Verlauf → (Ziel, Position bzw. Helligkeit) oder None (nicht verwertbar)."""
    s = getattr(st, "state", None)
    eid = getattr(st, "entity_id", "")
    attrs = getattr(st, "attributes", {}) or {}
    if eid.startswith("cover."):
        pos = attrs.get("current_position")
        if s in ("open", "opening", "closed", "closing"):
            target = "closed" if s in ("closed", "closing") else "open"
            if isinstance(pos, (int, float)):
                return target, int(pos)
            return target, None
        return None
    if s in ("on", "off"):
        bri = attrs.get("brightness") if s == "on" else None
        return s, int(bri) if isinstance(bri, (int, float)) else None
    return None


def day_events(states: list, day: date) -> list[tuple[float, str, int | None]]:
    """Schaltvorgänge eines Geräts an einem Tag: (Sekunden ab Mitternacht, Ziel, Wert); Ausgangszustand bei 0."""
    start = dt_util.start_of_local_day(day)
    end = start + timedelta(days=1)
    out: list[tuple[float, str, int | None]] = []
    before: tuple[str, int | None] | None = None
    for st in sorted(states, key=lambda s: s.last_changed):
        n = _norm(st)
        if n is None:
            continue
        t = dt_util.as_local(st.last_changed)
        if t < start:
            before = n
            continue
        if t >= end:
            break
        if out and out[-1][1:] == n or (not out and before == n):
            continue
        out.append(((t - start).total_seconds(), n[0], n[1]))
    if before is not None:
        out.insert(0, (0.0, before[0], before[1]))
    return out


def build_plan(history: dict[str, list], source: date, today: date, now: datetime, jitter_min: int,
               rng: random.Random) -> tuple[list[dict], dict[str, dict]]:
    """Plan für den Rest von „today“ nach dem Muster von „source“.

    Rückgabe: (geplante Schaltvorgänge ab jetzt, Sollzustand je Gerät jetzt).
    """
    start = dt_util.start_of_local_day(today)
    plan: list[dict] = []
    initial: dict[str, dict] = {}
    for eid, states in history.items():
        evs = day_events(states, source)
        last = start
        for i, (sec, target, val) in enumerate(evs):
            when = start + timedelta(seconds=sec)
            if i:  # Ausgangszustand bleibt bei Mitternacht, alles andere wird verschoben
                when += timedelta(seconds=rng.uniform(-jitter_min, jitter_min) * 60)
                when = max(when, last + timedelta(seconds=60))
                when = min(when, start + timedelta(days=1) - timedelta(seconds=1))
            last = when
            item = {"ts": when.timestamp(), "entity": eid, "target": target, "value": val}
            if when <= now:
                initial[eid] = item
            else:
                plan.append(item)
    plan.sort(key=lambda x: x["ts"])
    return plan, initial


def pick_day(days: dict[date, int], today: date, rng: random.Random) -> date | None:
    """Vorlage wählen: derselbe Wochentag mit Schaltvorgängen, sonst irgendein Tag mit Schaltvorgängen."""
    cands = [d for d, n in days.items() if n and d < today]
    same = [d for d in cands if d.weekday() == today.weekday()]
    pool = same or cands
    return rng.choice(sorted(pool)) if pool else None


class PresenceSimulator:
    """Plant und schaltet die Simulation."""

    def __init__(self, hass: HomeAssistant, monitor: AlertMonitor) -> None:
        self.hass = hass
        self.monitor = monitor
        self.rng = random.Random()
        self._unsubs: list[Callable[[], None]] = []
        self._timers: list[Callable[[], None]] = []
        self._check_pending: Callable[[], None] | None = None
        self.active = False
        self.source: date | None = None
        self.plan: list[dict] = []
        self.log: list[dict] = []
        self.note = ""
        self._key = ""
        self._gen = 0

    # ---------- Einstellungen ----------
    @property
    def cfg(self) -> dict:
        return self.monitor.layout.get("presence_sim", {})

    def entities(self) -> list[str]:
        return [e for e in self.cfg.get("entities", []) if e.split(".", 1)[0] in DOMAINS]

    def should_run(self) -> bool:
        cfg = self.cfg
        if not cfg.get("enabled") or not self.entities():
            return False
        sw = cfg.get("switch") or ""
        st = self.hass.states.get(sw) if sw else None
        if st is not None and st.state == "on":
            return True
        return self.monitor.house.mode in (cfg.get("modes") or ["urlaub"])

    # ---------- Lebenszyklus ----------
    @callback
    def async_start(self) -> None:
        self._unsubs.append(self.monitor.store.async_add_listener(lambda _l: self.async_check()))
        self._unsubs.append(self.monitor.book.async_add_listener(lambda _s: self.async_check()))
        self._unsubs.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state))
        self._unsubs.append(async_track_time_change(self.hass, self._midnight, hour=0, minute=0, second=5))
        self.async_check()

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs:
            with contextlib.suppress(Exception):
                u()
        self._unsubs.clear()
        self._cancel()
        if self._check_pending:
            self._check_pending()
            self._check_pending = None

    @callback
    def _on_state(self, event: Event) -> None:
        sw = self.cfg.get("switch") or ""
        if sw and event.data.get("entity_id") == sw:
            self.async_check()

    @callback
    def async_check(self) -> None:
        """Nach Änderungen (Modus, Einstellungen, Schalter) kurz gesammelt prüfen."""
        if self._check_pending:
            return

        @callback
        def _run(_now: Any) -> None:
            self._check_pending = None
            self._evaluate()

        self._check_pending = async_call_later(self.hass, 0.5, _run)

    @callback
    def _evaluate(self) -> None:
        run = self.should_run()
        cfg = self.cfg
        key = f"{sorted(self.entities())}|{cfg.get('weeks')}|{cfg.get('jitter')}"
        if run and (not self.active or key != self._key):
            why = "Einstellungen geändert" if self.active else self._reason()
            self.active = True
            self._key = key
            self._log("start", f"Simulation gestartet ({why})")
            self.hass.async_create_task(self.async_replan())
        elif not run and self.active:
            self.active = False
            self._cancel()
            self.plan = []
            self.source = None
            self._log("stop", f"Simulation beendet ({self._reason(stop=True)})")

    def _reason(self, stop: bool = False) -> str:
        sw = self.cfg.get("switch") or ""
        st = self.hass.states.get(sw) if sw else None
        if not self.cfg.get("enabled"):
            return "ausgeschaltet"
        if st is not None and st.state == "on" and not stop:
            return f"Schalter {self._name(sw)}"
        from .const import HOUSE_MODE_NAMES
        return f"Hausmodus {HOUSE_MODE_NAMES.get(self.monitor.house.mode, self.monitor.house.mode)}"

    @callback
    def _midnight(self, _now: Any) -> None:
        if self.active:
            self.hass.async_create_task(self.async_replan())

    @callback
    def _cancel(self) -> None:
        self._gen += 1
        for u in self._timers:
            with contextlib.suppress(Exception):
                u()
        self._timers.clear()

    # ---------- Planen ----------
    async def async_fetch(self, entity_ids: list[str], start: datetime, end: datetime) -> dict[str, list]:
        """Verlauf aus dem Recorder (in Tests ersetzbar)."""
        if "recorder" not in self.hass.config.components:
            return {}
        from homeassistant.components.recorder import get_instance, history

        def _query() -> dict[str, list]:
            return history.get_significant_states(
                self.hass, start, end, entity_ids,
                include_start_time_state=True, significant_changes_only=False, no_attributes=False,
            )

        return await get_instance(self.hass).async_add_executor_job(_query)

    async def async_replan(self) -> None:
        self._cancel()
        gen = self._gen
        cfg = self.cfg
        ents = self.entities()
        weeks = int(cfg.get("weeks", 2))
        now = dt_util.now()
        today = now.date()
        first = today - timedelta(days=weeks * 7)
        try:
            hist = await self.async_fetch(ents, dt_util.start_of_local_day(first), dt_util.start_of_local_day(today))
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Anwesenheits-Simulation: Verlauf nicht lesbar: %s", err)
            hist = {}
        if gen != self._gen or not self.active:
            return
        counts: dict[date, int] = {}
        for i in range(weeks * 7):
            d = first + timedelta(days=i)
            counts[d] = sum(max(0, len(day_events(s, d)) - 1) for s in hist.values())
        self.source = pick_day(counts, today, self.rng)
        if self.source is None:
            self.plan = []
            self.note = "Kein Verlauf der ausgewählten Geräte gefunden (Recorder aktiv?)."
            self._log("hinweis", self.note)
            return
        self.note = ""
        plan, initial = build_plan(hist, self.source, today, now, int(cfg.get("jitter", 15)), self.rng)
        self.plan = plan
        self._log("plan", f"Vorlage: {self.source.strftime('%d.%m.%Y')}, {len(plan)} Schaltvorgänge bis Mitternacht")
        # Zustand wie zur selben Uhrzeit am Vorlagetag herstellen
        for eid, item in initial.items():
            if self._differs(eid, item):
                await self._apply(item)
        for item in plan:
            self._timers.append(async_track_point_in_time(
                self.hass, self._make_fire(item, gen), dt_util.utc_from_timestamp(item["ts"])))

    def _make_fire(self, item: dict, gen: int) -> Callable[[datetime], None]:
        @callback
        def _fire(_now: datetime) -> None:
            if gen != self._gen or not self.active:
                return
            with contextlib.suppress(ValueError):
                self.plan.remove(item)
            self.hass.async_create_task(self._apply(item))
        return _fire

    def _differs(self, eid: str, item: dict) -> bool:
        st = self.hass.states.get(eid)
        if st is None or st.state in ("unavailable", "unknown"):
            return False
        n = _norm(st)
        return n is None or n[0] != item["target"]

    # ---------- Schalten ----------
    async def _apply(self, item: dict) -> None:
        eid, target, val = item["entity"], item["target"], item["value"]
        domain = eid.split(".", 1)[0]
        data: dict[str, Any] = {"entity_id": eid}
        st = self.hass.states.get(eid)
        if domain == "cover":
            if val is not None and st is not None and "current_position" in st.attributes:
                service, data["position"] = "set_cover_position", val
            else:
                service = "close_cover" if target == "closed" else "open_cover"
        else:
            service = "turn_on" if target == "on" else "turn_off"
            if domain == "light" and target == "on" and val:
                data["brightness"] = val
        try:
            await self.hass.services.async_call(domain, service, data, blocking=True)
        except Exception as err:  # noqa: BLE001
            self._log("fehler", f"{self._name(eid)}: {err}"[:160], eid)
            return
        txt = ACTION_TXT.get(target, target)
        if domain == "cover" and "position" in data:
            txt = f"auf {val} %"
        self._log("schalten", f"{self._name(eid)} {txt}", eid)

    # ---------- Ausgabe ----------
    def _name(self, eid: str) -> str:
        st = self.hass.states.get(eid)
        return (st.attributes.get("friendly_name") if st else None) or eid

    @callback
    def _log(self, typ: str, text: str, eid: str | None = None) -> None:
        self.log.append({"ts": round(time.time(), 1), "type": typ, "text": text, **({"entity": eid} if eid else {})})
        del self.log[:-LOG_MAX]
        _LOGGER.debug("Anwesenheits-Simulation: %s", text)

    def status(self) -> dict:
        return {
            "active": self.active,
            "source": self.source.isoformat() if self.source else None,
            "note": self.note,
            "next": [{"ts": p["ts"], "entity": p["entity"], "name": self._name(p["entity"]),
                      "action": ACTION_TXT.get(p["target"], p["target"])} for p in self.plan[:8]],
            "planned": len(self.plan),
            "log": self.log[-20:],
        }
