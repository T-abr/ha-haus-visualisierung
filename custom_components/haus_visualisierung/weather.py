"""Wetterwarnungen: Unwetter vom DWD, „Regen kommt, Fenster offen“ und „Sturm, Markise ausgefahren“.

Quellen:
- DWD-Wetterwarnungen (Integration „Deutscher Wetterdienst (DWD) Weather Warnings“): Sensoren mit den Attributen
  ``warning_count`` und ``warning_<n>_…``; aktuelle Warnungen und Vorabinformationen.
- Stündliche Vorhersage der Wetter-Entität (Dienst ``weather.get_forecasts``, alle 15 Minuten): Niederschlag,
  Regenwahrscheinlichkeit, Wind und Böen der nächsten Stunde(n).
- Optional ein Regensensor (``binary_sensor``) für „es regnet gerade“.

Die Meldungen laufen über den Alarmmanager (feste Regel „weather“) und stehen fürs Panel in ``sensor.haus_wetter``.
Geschaltet wird nichts: Fenster und Markisen bleiben, wie sie sind.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant, State, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .erkennung import labelled

_LOGGER = logging.getLogger(__name__)

REFRESH_S = 15 * 60
RAINY = {"rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"}
RAIN_PROB = 60            # % Regenwahrscheinlichkeit, ab der eine Stunde als „Regen“ zählt (mit Regenlage)
DWD_RAIN_TYPES = {0, 2}   # Gewitter, Starkregen
DWD_WIND_TYPES = {0, 1}   # Gewitter, Wind/Sturm/Orkan
DWD_ICON = {0: "mdi:weather-lightning", 1: "mdi:weather-windy", 2: "mdi:weather-pouring", 3: "mdi:weather-snowy-heavy", 4: "mdi:weather-fog",
            5: "mdi:snowflake-alert", 6: "mdi:snowflake-alert", 7: "mdi:snowflake-melt", 8: "mdi:weather-sunny-alert", 9: "mdi:weather-sunny-alert"}
RAIN_SENSOR_RE = re.compile(r"(regen|rain)", re.I)
RAIN_SENSOR_SKIP = re.compile(r"(wasser|water|leak|keller|regenwasser|zisterne|tank|menge|amount|rate|total|heute|today)", re.I)
AWNING_RE = re.compile(r"(markise|awning|sonnensegel)", re.I)
ADVANCE_RE = re.compile(r"(advance|vorab|vorwarn)", re.I)
WINDOW_DC = {"window", "door", "opening"}
WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def _de(v: float, digits: int = 1) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def kmh(value: Any, unit: Any) -> float | None:
    """Windgeschwindigkeit in km/h (Einheit der Wetter-Entität)."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    u = str(unit or "km/h").lower().replace(" ", "")
    f = {"m/s": 3.6, "mph": 1.609344, "kn": 1.852, "kt": 1.852, "ft/s": 1.09728}.get(u, 1.0)
    return float(value) * f


def _when(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return dt_util.as_local(value)
    if isinstance(value, str) and value:
        d = dt_util.parse_datetime(value)
        return dt_util.as_local(d) if d else None
    return None


def clock(d: datetime, now: datetime | None = None) -> str:
    """„15:00“, „morgen 6:00“ bzw. „Do 6:00“."""
    now = now or dt_util.now()
    t = f"{d.hour}:{d.minute:02d}"
    days = (d.date() - now.date()).days
    if days == 0:
        return t
    if days == 1:
        return f"morgen {t}"
    if days == -1:
        return f"gestern {t}"
    return f"{WD[d.weekday()]} {t}"


def dwd_list(st: State | None) -> list[dict]:
    """Warnungen aus einem DWD-Sensor (Attribute warning_<n>_…)."""
    if st is None:
        return []
    a = st.attributes
    try:
        n = int(a.get("warning_count") or 0)
    except (TypeError, ValueError):
        n = 0
    out = []
    for i in range(1, min(n, 10) + 1):
        p = f"warning_{i}_"
        head = str(a.get(p + "headline") or a.get(p + "name") or "").strip()
        if not head:
            continue
        try:
            level = int(a.get(p + "level") or 0)
        except (TypeError, ValueError):
            level = 0
        try:
            typ = int(a.get(p + "type"))
        except (TypeError, ValueError):
            typ = -1
        out.append({
            "headline": head, "name": str(a.get(p + "name") or ""), "level": level, "type": typ,
            "start": _when(a.get(p + "start")), "end": _when(a.get(p + "end")),
            "description": str(a.get(p + "description") or "").strip(), "instruction": str(a.get(p + "instruction") or "").strip(),
            "color": str(a.get(p + "color") or ""),
        })
    return out


class WeatherWatch:
    """Wertet Warnungen, Vorhersage und Kontakte aus; liefert Meldungen für den Alarmmanager."""

    def __init__(self, hass: HomeAssistant, monitor) -> None:
        self.hass = hass
        self.monitor = monitor
        self._fc: dict[str, Any] = {"eid": None, "at": 0.0, "hours": [], "busy": False}
        self._listeners: set[Callable[[], None]] = set()
        self._sig = ""
        self.info: dict[str, Any] = {"warnungen": [], "regen": None, "wind": None, "meldungen": []}

    # ---------- Einstellungen und Entitäten ----------
    @property
    def cfg(self) -> dict:
        return self.monitor.layout.get("weather_alerts") or {}

    @property
    def enabled(self) -> bool:
        b = (self.monitor.layout.get("alerts") or {}).get("builtin") or {}
        return bool(self.cfg.get("enabled", True)) and b.get("weather", True) is not False

    def weather_eid(self) -> str | None:
        return self.monitor._outdoor.get("weather")

    def dwd_sensors(self) -> list[tuple[str, bool]]:
        """(Entität, Vorabinformation?) – eingestellt oder automatisch (Attribute des DWD-Sensors)."""
        hass = self.hass
        picked = [e for e in self.cfg.get("dwd") or [] if hass.states.get(e)]
        cand = picked or [st.entity_id for st in hass.states.async_all("sensor")
                          if "warning_count" in st.attributes and ("region_name" in st.attributes or "region_id" in st.attributes)]
        reg = er.async_get(hass)
        out = []
        for e in cand:
            entry = reg.async_get(e)
            key = " ".join(str(x or "") for x in (entry.unique_id if entry else "", entry.translation_key if entry else "", e,
                                                   (hass.states.get(e).attributes.get("friendly_name") if hass.states.get(e) else "")))
            out.append((e, bool(ADVANCE_RE.search(key))))
        return out

    def rain_sensor(self) -> str | None:
        e = self.cfg.get("rain_sensor") or ""
        if e and self.hass.states.get(e):
            return e
        if lab := labelled(self.hass, "haus_regensensor", ("binary_sensor",)):
            return lab[0]
        for st in self.hass.states.async_all("binary_sensor"):
            label = f"{st.entity_id} {st.attributes.get('friendly_name') or ''}"
            if RAIN_SENSOR_RE.search(label) and not RAIN_SENSOR_SKIP.search(label):
                return st.entity_id
        return None

    def awnings(self) -> list[str]:
        picked = [e for e in self.cfg.get("awnings") or [] if self.hass.states.get(e)]
        if picked:
            return picked
        lab = labelled(self.hass, "haus_markise", ("cover",))
        if lab:
            return lab
        out = []
        for r in self.monitor._rooms:
            for e in r.groups.get("cover", []):
                st = self.hass.states.get(e)
                if st and (st.attributes.get("device_class") == "awning" or AWNING_RE.search(f"{e} {st.attributes.get('friendly_name') or ''}")):
                    out.append(e)
        return out

    def openings(self) -> list[str]:
        """Offene Fenster und Türen in Innenräumen (ohne Garagentore)."""
        get = self.hass.states.get
        out = []
        for r in self.monitor._rooms:
            if not r.indoor:
                continue
            for e in r.groups.get("contact", []):
                st = get(e)
                if st and st.state == "on" and st.attributes.get("device_class") in WINDOW_DC:
                    out.append(e)
        return out

    def watch(self) -> set[str]:
        if not self.enabled:
            return set()
        w = {e for e, _a in self.dwd_sensors()} | set(self.awnings())
        if rs := self.rain_sensor():
            w.add(rs)
        if we := self.weather_eid():
            w.add(we)
        return w

    # ---------- Vorhersage ----------
    @callback
    def refresh(self, force: bool = False) -> None:
        """Stündliche Vorhersage holen (höchstens alle 15 Minuten)."""
        eid = self.weather_eid()
        if not self.enabled or not eid or self._fc["busy"]:
            return
        if not force and self._fc["eid"] == eid and time.time() - self._fc["at"] < REFRESH_S:
            return
        st = self.hass.states.get(eid)
        if st is None or not int(st.attributes.get("supported_features") or 0) & 2:  # 2 = stündlich
            self._fc.update(eid=eid, at=time.time(), hours=[])
            return
        self._fc["busy"] = True
        self.hass.async_create_task(self._load(eid))

    async def _load(self, eid: str) -> None:
        hours: list[dict] = []
        try:
            res = await self.hass.services.async_call("weather", "get_forecasts", {"entity_id": eid, "type": "hourly"},
                                                      blocking=True, return_response=True)
            hours = list(((res or {}).get(eid) or {}).get("forecast") or [])
        except Exception as err:  # noqa: BLE001 – ohne Vorhersage gibt es eben keine Regen-/Sturmhinweise
            _LOGGER.debug("Stündliche Vorhersage von %s nicht verfügbar: %s", eid, err)
        self._fc.update(eid=eid, at=time.time(), hours=hours, busy=False)
        self.monitor._schedule()

    def _hours(self, minutes: int) -> list[tuple[datetime, dict]]:
        now = dt_util.now()
        out = []
        for f in self._fc["hours"] if self._fc["eid"] == self.weather_eid() else []:
            t = _when(f.get("datetime"))
            if t and now - timedelta(minutes=59) <= t <= now + timedelta(minutes=minutes):
                out.append((t, f))
        return out

    # ---------- Auswertung ----------
    def _rain(self, cfg: dict, dwd: list[dict]) -> dict | None:
        """Wann es regnet: jetzt (Sensor, Wetterlage, DWD) oder laut Vorhersage in den nächsten Minuten."""
        get = self.hass.states.get
        now = dt_util.now()
        if (rs := self.rain_sensor()) and (st := get(rs)) and st.state == "on":
            return {"jetzt": True, "ab": now, "mm": None, "quelle": "Regensensor"}
        if (we := self.weather_eid()) and (st := get(we)) and st.state in RAINY:
            return {"jetzt": True, "ab": now, "mm": None, "quelle": "Wetter"}
        for w in dwd:
            if w["type"] in DWD_RAIN_TYPES and w["level"] >= 1 and (w["start"] is None or w["start"] <= now + timedelta(minutes=cfg.get("rain_min", 60))):
                return {"jetzt": w["start"] is None or w["start"] <= now, "ab": w["start"] or now, "mm": None, "quelle": w["headline"]}
        limit = cfg.get("rain_mm", 0.3)
        for t, f in self._hours(cfg.get("rain_min", 60)):
            mm = f.get("precipitation")
            prob = f.get("precipitation_probability")
            wet = isinstance(mm, (int, float)) and mm >= limit
            likely = isinstance(prob, (int, float)) and prob >= RAIN_PROB and f.get("condition") in RAINY
            if wet or likely:
                return {"jetzt": t <= now, "ab": max(t, now), "mm": float(mm) if isinstance(mm, (int, float)) else None, "quelle": "Vorhersage"}
        return None

    def _wind(self, cfg: dict, dwd: list[dict]) -> dict | None:
        """Sturm: DWD-Warnung (Wind, Gewitter) oder Böen über der Grenze – jetzt oder laut Vorhersage."""
        get = self.hass.states.get
        now = dt_util.now()
        limit = cfg.get("wind_kmh", 50)
        for w in dwd:
            if w["type"] in DWD_WIND_TYPES and w["level"] >= 2 and (w["start"] is None or w["start"] <= now + timedelta(minutes=cfg.get("rain_min", 60))):
                return {"ab": w["start"] or now, "kmh": None, "quelle": w["headline"]}
        if (we := self.weather_eid()) and (st := get(we)):
            unit = st.attributes.get("wind_speed_unit")
            v = max((x for x in (kmh(st.attributes.get("wind_gust_speed"), unit), kmh(st.attributes.get("wind_speed"), unit)) if x is not None), default=None)
            if v is not None and v >= limit:
                return {"ab": now, "kmh": v, "quelle": "Wetter"}
            for t, f in self._hours(cfg.get("rain_min", 60)):
                v = max((x for x in (kmh(f.get("wind_gust_speed"), unit), kmh(f.get("wind_speed"), unit)) if x is not None), default=None)
                if v is not None and v >= limit:
                    return {"ab": max(t, now), "kmh": v, "quelle": "Vorhersage"}
        return None

    def evaluate_off(self) -> None:
        self.info = {"warnungen": [], "regen": None, "wind": None, "meldungen": []}
        self._publish()

    def evaluate(self) -> list[tuple[str, str, str, str, str, str]]:
        """Meldungen als (key, Stufe, Titel, Detail, Pfad, Symbol)."""
        if not self.enabled:
            self.evaluate_off()
            return []
        cfg = self.cfg
        get = self.hass.states.get
        now = dt_util.now()
        out: list[tuple[str, str, str, str, str, str]] = []
        current: list[dict] = []
        warn_rows: list[dict] = []
        seen: set[str] = set()
        min_level = cfg.get("dwd_min", 2)
        sensors = self.dwd_sensors()
        for advance in (False, True):
            for e, adv in sensors:
                if adv != advance:
                    continue
                for w in dwd_list(get(e)):
                    if w["end"] and w["end"] < now:
                        continue
                    if not advance:
                        current.append(w)
                    k = re.sub(r"[^a-z0-9]+", "_", w["headline"].lower()).strip("_")[:40]
                    if k in seen or w["level"] < min_level:
                        continue
                    seen.add(k)
                    upcoming = advance or (w["start"] is not None and w["start"] > now)
                    title = f"{'Unwetter' if w['level'] >= 3 else 'Wetterwarnung'}: {w['headline'][:1].upper()}{w['headline'][1:]}"
                    when = (f"ab {clock(w['start'], now)}" if upcoming and w["start"] else "") + (
                        f"{' ' if upcoming and w['start'] else ''}bis {clock(w['end'], now)}" if w["end"] else "")
                    first = re.split(r"(?<=[.!])\s", w["description"], maxsplit=1)[0] if w["description"] else ""
                    detail = " · ".join(x for x in (when, first[:140]) if x)
                    level = "info" if upcoming or w["level"] <= 1 else "warn"
                    ic = DWD_ICON.get(w["type"], "mdi:alert")
                    out.append((f"wx:dwd:{k}", level, title, detail, "beschattung", ic))
                    warn_rows.append({"t": title, "d": detail, "l": level, "stufe": w["level"], "i": ic, "farbe": w["color"],
                                      "ab": w["start"].isoformat() if w["start"] else None, "bis": w["end"].isoformat() if w["end"] else None,
                                      "text": w["description"][:600], "tipp": w["instruction"][:400], "vorab": upcoming})

        rain = self._rain(cfg, current) if cfg.get("rain", True) else None
        opened = self.openings() if rain else []
        if rain and opened:
            names = [self.monitor._name(e) for e in opened]
            what = f"{len(opened)} Fenster/Türen offen" if len(opened) > 1 else f"{names[0]} offen"
            title = f"{'Es regnet' if rain['jetzt'] else 'Regen kommt'} · {what}"
            when = "" if rain["jetzt"] else f"ab {clock(rain['ab'], now)}" + (f", etwa {_de(rain['mm'])} mm" if rain["mm"] else "")
            detail = " – ".join(x for x in (when, ", ".join(names[:4]) + (f" und {len(names) - 4} weitere" if len(names) > 4 else "")) if x)
            out.append(("wx:rain", "warn", title, detail, "sicherheit", "mdi:weather-pouring"))

        wind = self._wind(cfg, current) if cfg.get("wind", True) else None
        rolled = [e for e in self.awnings() if (st := get(e)) and st.state not in ("closed", "unavailable", "unknown")] if wind else []
        if wind and rolled:
            names = [self.monitor._name(e) for e in rolled]
            title = f"Sturm{' kommt' if wind['ab'] > now + timedelta(minutes=5) else ''} · {'Markise' if len(rolled) == 1 else f'{len(rolled)} Markisen'} ausgefahren"
            detail = " – ".join(x for x in (
                (f"Böen bis {round(wind['kmh'])} km/h" if wind["kmh"] else wind["quelle"]) + (f" ab {clock(wind['ab'], now)}" if wind["ab"] > now + timedelta(minutes=5) else ""),
                ", ".join(names[:4])) if x)
            out.append(("wx:wind", "warn", title, detail, "beschattung", "mdi:weather-windy"))

        self.info = {
            "warnungen": warn_rows,
            "regen": {"ab": None if rain["jetzt"] else rain["ab"].isoformat(), "jetzt": rain["jetzt"], "mm": rain["mm"], "quelle": rain["quelle"]} if rain else None,
            "wind": {"ab": wind["ab"].isoformat() if wind["ab"] > now + timedelta(minutes=5) else None, "kmh": round(wind["kmh"]) if wind["kmh"] else None, "quelle": wind["quelle"]} if wind else None,
            "meldungen": [{"key": k, "level": lv, "title": t, "detail": d, "path": p, "icon": i} for k, lv, t, d, p, i in out],
        }
        self._publish()
        return out

    # ---------- Sensor ----------
    @callback
    def async_add_listener(self, cb: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(cb)

        @callback
        def _remove() -> None:
            self._listeners.discard(cb)

        return _remove

    def _publish(self) -> None:
        sig = repr(self.info)
        if sig == self._sig:
            return
        self._sig = sig
        for cb in list(self._listeners):
            cb()
