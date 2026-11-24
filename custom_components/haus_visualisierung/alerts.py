"""Warnungen im Hintergrund auswerten und als Push-Benachrichtigung verschicken.

Die Regeln stehen nur hier: feste Regeln (Fenster, Fenster beim Heizen, Melder, Schloss, Garagentor,
Batterien, offline, Schimmelrisiko, Geräte, Wartung, Wetter) und eigene Regeln. Das Panel, das Wandpanel
und die Displays zeigen die aktiven Meldungen nur an (Alarmmanager-Abo, alarms.py). So kommen Meldungen
auch an, wenn kein Panel offen ist.
"""

from __future__ import annotations

import contextlib
import logging
import math
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from homeassistant.components.persistent_notification import (
    async_create as pn_create,
)
from homeassistant.components.persistent_notification import (
    async_dismiss as pn_dismiss,
)
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, State, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr
from homeassistant.helpers.event import async_call_later, async_track_time_interval

from .actions import ActionRunner
from .appliances import ApplianceTracker
from .alarms import ACKED, MUTED, AlarmBook
from homeassistant.util import dt as dt_util

from .const import BUILTIN_MODES, DOMAIN, HOUSE_MODE_NAMES, HOUSE_MODES, PANEL_URL_PATH
from .maintenance import due_info, due_text
from .mode import HouseMode
from .presence import PresenceSimulator
from .weather import WeatherWatch

EVENT_NOTIFY_ACTION = "mobile_app_notification_action"
ACT_ACK, ACT_MUTE, ACT_LOCK = "HV_ACK_", "HV_MUTE_", "HV_LOCK_"

_LOGGER = logging.getLogger(__name__)

CONTACT_DC = {"door", "window", "garage_door", "opening"}
PRESENCE_DC = {"motion", "occupancy", "presence"}
SAFETY_DC = {"smoke", "gas", "moisture", "carbon_monoxide", "safety", "tamper", "problem", "heat"}
ROOM_SENSOR_DC = {
    "temperature", "humidity", "illuminance", "carbon_dioxide", "pm25", "pm10",
    "volatile_organic_compounds", "volatile_organic_compounds_parts", "pressure",
    "atmospheric_pressure", "moisture",
}
ENERGY_DC = {"power", "energy", "current", "voltage", "power_factor", "apparent_power", "reactive_power"}
UNAV = {"unavailable", "unknown"}
STATELESS = {"scene", "button", "input_button", "event"}
OUTDOOR_RE = re.compile(r"(au(ß|ss)en|garten|drau(ß|ss)en|outdoor|grundst(ü|ue)ck)", re.IGNORECASE)
TECH_RE = re.compile(r"(vorlauf|r(ü|ue)cklauf|speicher|puffer|kessel|kamin|solar|kollektor|boiler|warmwasser|abgas|cpu)", re.IGNORECASE)
LEVEL_ORDER = {"alarm": 3, "warn": 2, "info": 1}
LEVEL_NAME = {"alarm": "Alarm", "warn": "Warnung", "info": "Hinweis"}
BATT_ICON = "mdi:battery-alert-variant-outline"


def _mdi(icon: str | None) -> str:
    """Symbolname fürs Panel: „mdi:“ ergänzen, falls es fehlt."""
    if not icon:
        return ""
    return icon if ":" in icon else f"mdi:{icon}"


def is_on(st: State | None) -> bool:
    if st is None:
        return False
    d, s = st.domain, st.state
    if d == "cover":
        return s not in ("closed", *UNAV)
    if d == "media_player":
        return s == "playing"
    if d == "lock":
        return s in ("unlocked", "open")
    if d in ("climate", "water_heater"):
        return s not in ("off", *UNAV)
    if d == "alarm_control_panel":
        return s == "triggered"
    if d in ("vacuum", "lawn_mower"):
        return s in ("cleaning", "mowing", "returning")
    if d == "valve":
        return s == "open"
    return s == "on"


def is_unav(st: State | None) -> bool:
    if st is None:
        return True
    return st.state == "unavailable" or (st.state == "unknown" and st.domain not in STATELESS)


def num(st: State | None) -> float | None:
    if st is None:
        return None
    try:
        return float(st.state)
    except (TypeError, ValueError):
        return None


def fmt(st: State) -> str:
    unit = st.attributes.get("unit_of_measurement")
    v = num(st)
    if v is not None:
        txt = f"{v:.1f}".rstrip("0").rstrip(".").replace(".", ",")
        return f"{txt} {unit}" if unit else txt
    return {"on": "an", "off": "aus", "unavailable": "nicht erreichbar", "unknown": "unbekannt"}.get(st.state, st.state)


def classify(eid: str, st: State, layout: dict, pinned: bool) -> str | None:
    """Wie classify() im Panel."""
    d = eid.split(".", 1)[0]
    dc = st.attributes.get("device_class") or ""
    if d == "light":
        return "light"
    if d == "cover":
        return "cover"
    if d in ("climate", "water_heater", "humidifier"):
        return "climate"
    if d in ("fan", "switch", "input_boolean"):
        return "switch"
    if d == "media_player":
        return "media"
    if d == "lock":
        return "lock"
    if d == "camera":
        return "camera"
    if d in ("scene", "script"):
        return "scene"
    if d in ("alarm_control_panel", "siren"):
        return "safety"
    if d in ("vacuum", "lawn_mower"):
        return "device"
    if d == "binary_sensor":
        if dc == "battery":
            return "battery"
        if dc in CONTACT_DC:
            return "contact"
        if dc in PRESENCE_DC:
            return "presence"
        if dc in SAFETY_DC:
            return "safety"
        return "sensor" if pinned else None
    if d == "sensor":
        if dc == "battery":
            return "battery"
        if dc in ROOM_SENSOR_DC:
            return "sensor"
        if dc in ENERGY_DC:
            return "energy" if layout.get("show_energy_sensors") else ("sensor" if pinned else None)
        return "sensor" if pinned else None
    if d in ("select", "input_select", "number", "input_number", "button", "input_button", "valve"):
        return "other" if (layout.get("show_other") or pinned) else None
    return "other" if pinned else None


# Feuchte: Magnus-Formel über Wasser (Sonntag 1990) – dieselben Formeln wie im Panel
MAG_A, MAG_B, MOLD_HYST = 17.62, 243.12, 3


def dew_point(t: float | None, rh: float | None) -> float | None:
    if t is None or rh is None or rh <= 0:
        return None
    g = math.log(min(rh, 100) / 100) + MAG_A * t / (MAG_B + t)
    return MAG_B * g / (MAG_A - g)


def abs_hum(t: float | None, rh: float | None) -> float | None:
    """Absolute Feuchte in g/m³."""
    if t is None or rh is None or rh < 0:
        return None
    return 216.7 * (min(rh, 100) / 100) * 6.112 * math.exp(MAG_A * t / (MAG_B + t)) / (273.15 + t)


def vent_advice(t_in: float | None, rh_in: float | None, t_out: float | None, rh_out: float | None) -> str | None:
    """gut (lohnt sich), wenig oder nicht (draußen feuchter) – nach absoluter Feuchte."""
    a, b = abs_hum(t_in, rh_in), abs_hum(t_out, rh_out)
    if a is None or b is None:
        return None
    d = a - b
    return "gut" if d >= 2 else "wenig" if d >= 0.5 else "nicht"


def _de(v: float, digits: int) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


@dataclass
class Alert:
    key: str
    level: str
    title: str
    detail: str = ""
    path: str = "sicherheit"   # Ziel der Push-Nachricht
    # Nur fürs Panel: Symbol (leer = Symbol der Entität), Entität, Ziel im Panel (leer = Details der Entität)
    # und wie das Panel den Untertitel live bildet: "state" Zustand, "since" „seit …“, "ago" „vor …“ (leer = detail)
    icon: str = ""
    eid: str = ""
    to: str = ""
    fmt: str = ""
    ts: float = 0              # Zeitpunkt für "since"/"ago" (0 = letzte Änderung der Entität)


@dataclass
class _Room:
    area_id: str
    name: str
    groups: dict[str, list[str]]
    temp_id: str | None = None
    hum_id: str | None = None
    indoor: bool = True


class AlertMonitor:
    """Beobachtet die beteiligten Entitäten und meldet neue bzw. behobene Warnungen."""

    def __init__(self, hass: HomeAssistant, store) -> None:
        self.hass = hass
        self.store = store
        self._unsubs: list[Callable[[], None]] = []
        self._watch: set[str] = set()
        self._rooms: list[_Room] = []
        self._area_of: dict[str, _Room] = {}
        self._batteries: list[str] = []
        self._panels: list[str] = []
        self._all: set[str] = set()
        self._active: dict[str, Alert] = {}
        self._mold: dict[str, dict] = {}  # area_id → {"since": Zeitpunkt über der Grenze, "on": gemeldet}
        self._outdoor: dict[str, str] = {}
        self._last_sent: dict[str, float] = {}
        self._baseline_done = False
        self._eval_pending: Callable[[], None] | None = None
        self.sent: list[dict] = []  # zuletzt verschickte Meldungen (für Status/Tests)
        self.book = AlarmBook(hass)
        self.house = HouseMode(hass, self)
        self.runner = ActionRunner(hass, self)
        self.sim = PresenceSimulator(hass, self)
        self.appliances = ApplianceTracker(hass, lambda: self.layout, self._schedule)
        self.weather = WeatherWatch(hass, self)

    # ---------- Lebenszyklus ----------
    async def async_start(self) -> None:
        hass = self.hass
        await self.book.async_load()
        await self.appliances.async_load()
        self.book.mode_info = self.house.status
        self.house.async_start()
        self.sim.async_start()
        self._rebuild()
        self._unsubs.append(hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state))
        self._unsubs.append(hass.bus.async_listen(EVENT_NOTIFY_ACTION, self._on_notify_action))
        for evt in (er.EVENT_ENTITY_REGISTRY_UPDATED, dr.EVENT_DEVICE_REGISTRY_UPDATED, ar.EVENT_AREA_REGISTRY_UPDATED):
            self._unsubs.append(hass.bus.async_listen(evt, self._on_registry))
        self._unsubs.append(self.store.async_add_listener(lambda _l: self._on_registry(None)))
        if self.maintenance:
            self._unsubs.append(self.maintenance.async_add_listener(lambda _s: self._schedule()))
        self._unsubs.append(async_track_time_interval(hass, self._on_tick, timedelta(seconds=30)))
        if hass.is_running:
            self._start_baseline()
        else:
            self._unsubs.append(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, lambda _e: self._start_baseline()))

    @callback
    def async_stop(self) -> None:
        self.house.async_stop()
        self.sim.async_stop()
        for unsub in self._unsubs:
            with contextlib.suppress(Exception):
                unsub()
        self._unsubs.clear()
        if self._eval_pending:
            self._eval_pending()
            self._eval_pending = None

    @callback
    def _start_baseline(self) -> None:
        # Nach dem Start: bestehende Warnungen still übernehmen (keine Push-Flut nach Neustart),
        # Alarme aber trotzdem melden.
        self._rebuild()
        self.appliances.update()
        self.weather.refresh(force=True)
        current = {a.key: a for a in self.evaluate()}
        self.book.sync(current, silent_new=True)
        for alert in current.values():
            if alert.level == "alarm":
                self._notify_new(alert)
        self._active = current
        self._baseline_done = True

    # ---------- Modell ----------
    @property
    def layout(self) -> dict:
        return self.store.data

    @callback
    def _rebuild(self) -> None:
        hass, layout = self.hass, self.layout
        ent_reg, dev_reg, area_reg = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
        hidden_areas = set(layout.get("hidden_areas", []))
        hide_labels = set(layout.get("hide_labels", []))
        hidden_ents = set(layout.get("hidden_entities", []))
        pinned_all = {e for lst in layout.get("pins", {}).values() for e in lst} | set(layout.get("favorites", []))
        rooms: dict[str, _Room] = {}
        batteries: list[str] = []
        for st in hass.states.async_all():
            eid = st.entity_id
            entry = ent_reg.async_get(eid)
            if entry is None:
                continue
            dc = st.attributes.get("device_class")
            is_batt = dc == "battery" and st.domain in ("sensor", "binary_sensor")
            pinned = eid in pinned_all
            if not pinned:
                if entry.hidden_by or (entry.entity_category and not is_batt) or eid in hidden_ents:
                    continue
                if entry.labels and set(entry.labels) & hide_labels:
                    continue
            area_id = entry.area_id
            if not area_id and entry.device_id and (dev := dev_reg.async_get(entry.device_id)):
                area_id = dev.area_id
            cat = classify(eid, st, layout, pinned)
            if cat is None:
                continue
            if cat == "battery":
                if not area_id or area_id not in hidden_areas:
                    batteries.append(eid)
                continue
            if not area_id or area_id in hidden_areas:
                continue
            area = area_reg.async_get_area(area_id)
            if area is None:
                continue
            room = rooms.setdefault(area_id, _Room(area_id, area.name, {}))
            room.groups.setdefault(cat, []).append(eid)
        floor_reg = fr.async_get(hass)
        outdoor_floors = set(layout.get("outdoor_floors", []))
        for room in rooms.values():
            area = area_reg.async_get_area(room.area_id)
            room.temp_id, room.hum_id = self._room_climate(room, area)
            floor = floor_reg.async_get_floor(area.floor_id) if area and area.floor_id else None
            room.indoor = not OUTDOOR_RE.search(room.name) and not (
                floor and (floor.floor_id in outdoor_floors or OUTDOOR_RE.search(floor.name))
            )
        self._rooms = list(rooms.values())
        self._outdoor = self._find_outdoor()
        self._batteries = batteries
        self._area_of = {e: r for r in self._rooms for lst in r.groups.values() for e in lst}
        for b in batteries:
            entry = ent_reg.async_get(b)
            aid = entry.area_id if entry else None
            if not aid and entry and entry.device_id and (dev := dev_reg.async_get(entry.device_id)):
                aid = dev.area_id
            if aid in rooms:
                self._area_of[b] = rooms[aid]
        self._all = {e for r in self._rooms for lst in r.groups.values() for e in lst}
        rules = layout.get("alerts", {}).get("rules", [])
        self._panels = hass.states.async_entity_ids("alarm_control_panel")
        self.appliances.rebuild()
        self._watch = (self._all | set(batteries) | set(self._panels) | set(self._outdoor.values())
                       | {r.get("entity") for r in rules if r.get("entity")} | self.appliances.watch | self.weather.watch())

    def _room_climate(self, room: _Room, area: Any) -> tuple[str | None, str | None]:
        """Temperatur- und Feuchtefühler des Raums – wie im Panel: Vorgabe des Bereichs, sonst der erste passende."""
        get = self.hass.states.get
        sensors = sorted(room.groups.get("sensor", []), key=lambda e: str((get(e).attributes.get("friendly_name") if get(e) else e) or e).lower())
        t_id = getattr(area, "temperature_entity_id", None) if area else None
        h_id = getattr(area, "humidity_entity_id", None) if area else None
        if not t_id or get(t_id) is None:
            t_id = next((e for e in sensors if (s := get(e)) and s.attributes.get("device_class") == "temperature"
                         and not TECH_RE.search(str(s.attributes.get("friendly_name") or e))
                         and ((v := num(s)) is None or v <= 35)), None)
        if not h_id or get(h_id) is None:
            h_id = next((e for e in sensors if (s := get(e)) and s.attributes.get("device_class") == "humidity"), None)
        return t_id, h_id

    def _find_outdoor(self) -> dict[str, str]:
        """Außen: Temperatur (Heizung → Außenfühler oder nach Namen), Feuchte nach Namen, sonst Wetter-Entität."""
        hass, layout = self.hass, self.layout
        out: dict[str, str] = {}
        pick = (layout.get("heating") or {}).get("outdoor")
        for st in hass.states.async_all("sensor"):
            dc = st.attributes.get("device_class")
            if dc in ("temperature", "humidity") and dc not in out and OUTDOOR_RE.search(f"{st.entity_id} {st.attributes.get('friendly_name') or ''}"):
                out[dc] = st.entity_id
        if pick and hass.states.get(pick):
            out["temperature"] = pick
        weather = (layout.get("wallpanel") or {}).get("weather")
        if not weather or hass.states.get(weather) is None:
            weather = next(iter(hass.states.async_entity_ids("weather")), None)
        if weather:
            out["weather"] = weather
        return out

    def _outdoor_now(self) -> tuple[float | None, float | None]:
        get = self.hass.states.get
        t = num(get(self._outdoor.get("temperature", "")))
        rh = num(get(self._outdoor.get("humidity", "")))
        if (w := get(self._outdoor.get("weather", ""))) is not None:
            if t is None and isinstance(w.attributes.get("temperature"), (int, float)):
                t = float(w.attributes["temperature"])
            if rh is None and isinstance(w.attributes.get("humidity"), (int, float)):
                rh = float(w.attributes["humidity"])
        return t, rh

    def _mold_alerts(self, cfg: dict, now: float) -> list[Alert]:
        """Schimmelrisiko: Raumfeuchte ab der Grenze für mindestens … Minuten, Entwarnung 3 Punkte darunter.
        Bei offenem Fenster im Raum wird schon gelüftet: keine Meldung."""
        get = self.hass.states.get
        limit = cfg.get("mold_hum") or 65
        wait = cfg.get("mold_min", 30) * 60
        t_out, rh_out = self._outdoor_now()
        out: list[Alert] = []
        seen: set[str] = set()
        for r in self._rooms:
            if not r.hum_id or not r.indoor:
                continue
            rh, t = num(get(r.hum_id)), num(get(r.temp_id)) if r.temp_id else None
            prev = self._mold.get(r.area_id)
            active = bool(prev and prev["on"])
            if rh is None or not (rh >= limit or (active and rh > limit - MOLD_HYST)):
                continue
            since = prev["since"] if prev else now
            on = active or now - since >= wait
            self._mold[r.area_id] = {"since": since, "on": on}
            seen.add(r.area_id)
            if not on or any(is_on(get(e)) for e in r.groups.get("contact", [])):
                continue
            dp = dew_point(t, rh)
            advice = vent_advice(t, rh, t_out, rh_out) if t is not None else None
            detail = f"{rh:.0f} %" + (f" bei {_de(t, 1)}°" if t is not None else "") + (f" · Taupunkt {_de(dp, 1)}°" if dp is not None else "")
            detail += " – draußen feuchter, besser heizen oder entfeuchten" if advice == "nicht" else " – jetzt lüften"
            out.append(Alert(f"mold:{r.area_id}", "warn", f"Schimmelrisiko · {r.name}", detail, f"raum/{r.area_id}",
                             icon="mdi:water-alert", eid=r.hum_id, to=f"raum/{r.area_id}"))
        for area_id in [k for k in self._mold if k not in seen]:
            del self._mold[area_id]
        return out

    @property
    def maintenance(self):
        return self.hass.data.get(DOMAIN, {}).get("maintenance")

    def _maint_alerts(self) -> list[Alert]:
        """Wartungsplaner: fällige Aufgaben als Hinweis (Seite Wartung)."""
        cfg = self.layout.get("maintenance", {})
        if not cfg.get("enabled", True) or not self.maintenance:
            return []
        state, today, out = self.maintenance.data, dt_util.now().date(), []
        for t in cfg.get("tasks", []):
            _due, days = due_info(t, state, today)
            if days is None or days <= 0:
                out.append(Alert(f"maint:{t['id']}", "info", f"Wartung fällig · {t.get('title') or 'Aufgabe'}", due_text(days), "wartung",
                                 icon=_mdi(t.get("icon")) or "mdi:wrench-clock", to="wartung"))
        return out

    # ---------- Auswertung (wie evalAlerts im Panel) ----------
    def _name(self, eid: str) -> str:
        st = self.hass.states.get(eid)
        room = self._area_of.get(eid)
        name = (st.attributes.get("friendly_name") if st else None) or eid
        if room and name.lower().startswith(room.name.lower() + " ") and len(name) > len(room.name) + 1:
            name = name[len(room.name) + 1:]
        name = name[:1].upper() + name[1:]
        return f"{room.name} · {name}" if room else name

    def evaluate(self) -> list[Alert]:
        hass, layout = self.hass, self.layout
        cfg = layout.get("alerts", {})
        b = cfg.get("builtin", {})
        out: list[Alert] = []
        get = hass.states.get
        now = time.time()

        mode = self.house.mode

        def mode_ok(key: str) -> bool:
            modes = cfg.get("modes", {}).get(key) or BUILTIN_MODES.get(key) or HOUSE_MODES
            return mode in modes

        def minutes_since(st: State) -> float:
            return (now - st.last_changed.timestamp()) / 60

        def heating(room: _Room | None) -> bool:
            return bool(room) and any(
                (s := get(e)) is not None and s.attributes.get("hvac_action") == "heating"
                for e in room.groups.get("climate", [])
            )

        # „Erst melden nach … Minuten“ gilt für alle Meldungen über offene Fenster und Türen,
        # auch für „Fenster offen beim Heizen“, die in heizenden Räumen an ihre Stelle tritt.
        contacts_min = cfg.get("contacts_min", 0)

        def open_long(e: str) -> bool:
            st = get(e)
            return is_on(st) and minutes_since(st) >= contacts_min

        contacts = [e for r in self._rooms for e in r.groups.get("contact", [])]
        if b.get("contacts", True) and mode_ok("contacts"):
            for e in contacts:
                if b.get("window_heating", True) and heating(self._area_of.get(e)):
                    continue
                if open_long(e):
                    out.append(Alert(f"contact:{e}", "warn", f"{self._name(e)} offen", eid=e, fmt="since"))
        if b.get("window_heating", True) and mode_ok("window_heating"):
            for r in self._rooms:
                opened = [e for e in r.groups.get("contact", []) if open_long(e)]
                if opened and heating(r):
                    names = ", ".join(self._name(e).split(" · ", 1)[-1] for e in opened)
                    out.append(Alert(f"heat:{r.area_id}", "warn", f"Fenster offen beim Heizen · {r.name}",
                                     f"{names} offen – Heizung läuft dagegen", f"raum/{r.area_id}",
                                     icon="mdi:radiator-disabled", to=f"raum/{r.area_id}"))
        if b.get("safety", True) and mode_ok("safety"):
            for r in self._rooms:
                for e in r.groups.get("safety", []):
                    st = get(e)
                    if e.startswith("alarm_control_panel."):
                        continue  # eigene Regel „Alarmanlage ausgelöst“
                    if is_on(st):
                        out.append(Alert(f"safety:{e}", "alarm", self._name(e), "ausgelöst", eid=e, fmt="state"))
        if b.get("alarm_panel", True) and mode_ok("alarm_panel"):
            for e in self._panels:
                st = get(e)
                if st and st.state == "triggered":
                    name = st.attributes.get("friendly_name") or e
                    out.append(Alert(f"alarmpanel:{e}", "alarm", f"{name} ausgelöst", "Alarmanlage", "alarme",
                                     icon="mdi:alarm-light", eid=e))
        if b.get("presence_away", True) and mode_ok("presence_away"):
            for r in self._rooms:
                for e in r.groups.get("presence", []):
                    if is_on(get(e)):
                        nm = self._name(e)
                        short = nm.split(" · ", 1)[-1].lower()
                        if any(w in short for w in ("beweg", "präsenz", "praesenz", "motion", "presence", "anwesen")):
                            nm = r.name
                        out.append(Alert(f"presence:{e}", "alarm", f"{nm}: Bewegung erkannt",
                                         f"während Hausmodus {HOUSE_MODE_NAMES.get(mode, mode.capitalize())}", f"raum/{r.area_id}",
                                         icon="mdi:motion-sensor", eid=e, to=f"raum/{r.area_id}"))
        if b.get("locks", True) and mode_ok("locks"):
            for r in self._rooms:
                for e in r.groups.get("lock", []):
                    if is_on(get(e)):
                        out.append(Alert(f"lock:{e}", "warn", f"{self._name(e)} entriegelt", icon="mdi:lock-open-variant", eid=e, fmt="ago"))
        if b.get("garage", True) and mode_ok("garage"):
            for r in self._rooms:
                for e in r.groups.get("cover", []):
                    st = get(e)
                    if st and st.attributes.get("device_class") in ("garage", "gate") and is_on(st):
                        out.append(Alert(f"garage:{e}", "warn", f"{self._name(e)} offen", eid=e, fmt="ago"))
        if b.get("battery", False) and mode_ok("battery"):
            limit = layout.get("battery_critical", 15)
            crit = []
            for e in self._batteries:
                st = get(e)
                if st is None:
                    continue
                if st.domain == "binary_sensor":
                    if is_on(st):
                        crit.append(e)
                elif (v := num(st)) is not None and v < limit:
                    crit.append(e)
            if len(crit) == 1:
                out.append(Alert("battery", "warn", f"{self._name(crit[0])} fast leer", fmt(get(crit[0])), "batterien",
                                 icon=BATT_ICON, to="batterien"))
            elif crit:
                out.append(Alert("battery", "warn", f"{len(crit)} Batterien fast leer", f"unter {limit} %", "batterien",
                                 icon=BATT_ICON, to="batterien"))
        if b.get("offline", False) and mode_ok("offline"):
            n = sum(1 for e in self._all if is_unav(get(e)))
            if n:
                out.append(Alert("offline", "info", f"{n} {'Gerät' if n == 1 else 'Geräte'} nicht erreichbar", path="", icon="mdi:lan-disconnect"))
        if b.get("mold", True) and mode_ok("mold"):
            out.extend(self._mold_alerts(cfg, now))
        else:
            self._mold.clear()
        if b.get("appliances", True) and mode_ok("appliances"):
            out.extend(Alert(key, "info", title, detail, "", icon=_mdi(icon) or "mdi:check-circle-outline", eid=eid,
                             fmt="since" if since else "", ts=since)
                       for key, title, detail, icon, eid, since in self.appliances.alerts())
        if b.get("maintenance", True) and mode_ok("maintenance"):
            out.extend(self._maint_alerts())
        if mode_ok("weather"):
            out.extend(Alert(key, level, title, detail, path, icon=_mdi(icon) or "mdi:weather-lightning", to=path)
                       for key, level, title, detail, path, icon in self.weather.evaluate())
        else:
            self.weather.evaluate_off()
        for i, rule in enumerate(cfg.get("rules", [])):
            ent = rule.get("entity")
            if rule.get("enabled") is False or not ent:
                continue
            if rule.get("modes") and mode not in rule["modes"]:
                continue
            st = get(ent)
            if st is None or not _rule_match(st, rule):
                continue
            if rule.get("minutes") and minutes_since(st) < rule["minutes"]:
                continue
            out.append(Alert(f"rule:{i}:{ent}", rule.get("level", "warn"), rule.get("title") or self._name(ent), fmt(st), "",
                             eid=ent, fmt="state"))
        out.sort(key=lambda a: -LEVEL_ORDER.get(a.level, 0))
        return out

    # ---------- Ereignisse ----------
    @callback
    def _on_state(self, event: Event) -> None:
        eid = event.data.get("entity_id")
        if eid in self._watch:
            if eid in self.appliances.watch and self._baseline_done:
                self.appliances.update()
            self._schedule()

    @callback
    def _on_registry(self, _event: Event | None) -> None:
        self._rebuild()
        self._schedule()

    @callback
    def _on_tick(self, _now: Any) -> None:
        # Abgelaufene Stummschaltung: Meldung ist wieder offen → erneut melden
        for key in self.book.expire_mutes():
            if key in self._active:
                self._last_sent.pop(key, None)
                self._notify_new(self._active[key])
                self.runner.on_new(self._active[key])
        self.runner.check_escalation()
        if self._baseline_done:
            self.appliances.update()
            self.weather.refresh()
        self._schedule(0)

    @callback
    def _schedule(self, delay: float = 1.0) -> None:
        """Kurz sammeln, damit z. B. „Alle Rollos zu“ nicht zehn Auswertungen auslöst."""
        if not self._baseline_done or self._eval_pending:
            return

        @callback
        def _run(_now: Any) -> None:
            self._eval_pending = None
            self._process()

        self._eval_pending = async_call_later(self.hass, delay, _run)

    @callback
    def _process(self) -> None:
        current = {a.key: a for a in self.evaluate()}
        self.book.sync(current)
        for key, alert in current.items():
            if key not in self._active:
                self._notify_new(alert)
                self.runner.on_new(alert)
        for key, alert in self._active.items():
            if key not in current:
                self._notify_resolved(alert)
                self.runner.on_inactive(key)
        self._active = current

    # ---------- Benachrichtigen ----------
    @property
    def push(self) -> dict:
        return self.layout.get("push", {})

    def targets(self) -> list[str]:
        cfg = self.push.get("targets") or []
        services = self.hass.services.async_services().get("notify", {})
        if cfg:
            return [t for t in cfg if t in services]
        return sorted(s for s in services if s.startswith("mobile_app_"))

    @callback
    def _notify_new(self, alert: Alert) -> None:
        push = self.push
        if not push.get("enabled", True) or not push.get("levels", {}).get(alert.level, True):
            return
        if self.book.acked_or_muted(alert.key):
            return
        now = time.time()
        cooldown = push.get("cooldown", 10) * 60
        if alert.level != "alarm" and now - self._last_sent.get(alert.key, 0) < cooldown:
            return
        self._last_sent[alert.key] = now
        self._send(alert, resolved=False)

    @callback
    def _notify_resolved(self, alert: Alert) -> None:
        push = self.push
        if not push.get("enabled", True) or not push.get("levels", {}).get(alert.level, True):
            return
        if alert.key not in self._last_sent:
            return  # nie gemeldet (z. B. still übernommen) → nichts zu entwarnen
        mode = push.get("resolved", "clear")
        if mode == "none":
            return
        self._send(alert, resolved=True, clear=(mode == "clear"))

    def payload(self, alert: Alert, resolved: bool = False, clear: bool = False) -> dict:
        tag = "hv_" + "".join(c if c.isalnum() else "_" for c in alert.key)[:60]
        if clear:
            return {"message": "clear_notification", "data": {"tag": tag}}
        url = f"/{PANEL_URL_PATH}/{alert.path}" if alert.path else f"/{PANEL_URL_PATH}"
        title = f"Erledigt: {alert.title}" if resolved else alert.title
        level = "info" if resolved else alert.level
        data: dict[str, Any] = {
            "tag": tag,
            "group": "haus_visualisierung",
            "url": url,            # iOS
            "clickAction": url,    # Android
            "channel": {"alarm": "Haus Alarm", "warn": "Haus Warnung", "info": "Haus Hinweis"}[level],
            "importance": {"alarm": "high", "warn": "high", "info": "default"}[level],
            "push": {"interruption-level": {"alarm": "critical", "warn": "time-sensitive", "info": "passive"}[level]},
        }
        if level == "alarm":
            data["priority"] = "high"
            data["ttl"] = 0
            if self.push.get("critical", True):
                data["push"]["sound"] = {"name": "default", "critical": 1, "volume": 1.0}
                data["channel"] = "alarm_stream"
        if not resolved and alert.key != "test":
            actions = [{"action": ACT_ACK + alert.key, "title": "Quittieren"},
                       {"action": ACT_MUTE + alert.key, "title": "1 h stumm"}]
            if alert.key.startswith("lock:"):
                actions.append({"action": ACT_LOCK + alert.key[5:], "title": "Verriegeln"})
            data["actions"] = actions
        message = alert.detail or ("behoben" if resolved else LEVEL_NAME.get(alert.level, ""))
        return {"title": f"🏠 {title}", "message": message, "data": data}

    @callback
    def _send(self, alert: Alert, resolved: bool, clear: bool = False) -> None:
        payload = self.payload(alert, resolved, clear)
        for target in self.targets():
            self.hass.async_create_task(self._call(target, payload))
        if self.push.get("persistent", False):
            nid = f"haus_visualisierung_{alert.key}"
            if resolved:
                pn_dismiss(self.hass, nid)
            else:
                pn_create(self.hass, f"{alert.detail or LEVEL_NAME.get(alert.level, '')}", f"{LEVEL_NAME.get(alert.level, '')}: {alert.title}", nid)
        self.sent.append({"key": alert.key, "resolved": resolved, "clear": clear, "payload": payload})
        del self.sent[:-50]

    async def _call(self, target: str, payload: dict) -> None:
        try:
            await self.hass.services.async_call("notify", target, payload, blocking=False)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Push an notify.%s fehlgeschlagen: %s", target, err)

    # ---------- Alarmmanager: Quittieren, Stummschalten ----------
    @callback
    def async_action(self, key: str, action: str, user: str | None = None,
                     minutes: int | None = None, until: str | None = None) -> dict | None:
        if action == "ack_all":
            done = None
            for k in [k for k, a in self.book.alarms.items() if a["status"] not in (ACKED, MUTED)]:
                done = self.async_action(k, "ack", user)
            return done or {}
        if action == "ack" and key.startswith("appliance:"):
            # Gerät quittiert: zurück auf „aus“, die Meldung verschwindet mit der nächsten Auswertung
            self.appliances.ack(key.split(":", 1)[1])
        a = self.book.action(key, action, user, minutes, until)
        if a is None:
            return None
        if action in ("ack", "mute"):
            self.runner.on_inactive(key)
        elif action == "unmute" and a.get("status") == "neu" and key in self._active:
            self.runner.on_new(self._active[key])
        alert = self._active.get(key)
        if alert and action in ("ack", "mute") and key in self._last_sent:
            # gesehen bzw. stumm: Meldung von allen Handys nehmen
            self._send(alert, resolved=True, clear=True)
        return a

    @callback
    def _send_escalation(self, alert: Alert) -> None:
        """Erneute, kritische Meldung an alle Empfänger (auch wenn Stufen-Filter oder Sperrzeit greifen)."""
        if not self.push.get("enabled", True):
            return
        esc = Alert(alert.key, "alarm", f"Nicht quittiert: {alert.title}", alert.detail or LEVEL_NAME.get(alert.level, ""), alert.path)
        payload = self.payload(esc)
        payload["data"]["push"]["sound"] = {"name": "default", "critical": 1, "volume": 1.0}
        payload["data"]["channel"] = "alarm_stream"
        for target in self.targets():
            self.hass.async_create_task(self._call(target, payload))
        self.sent.append({"key": alert.key, "resolved": False, "clear": False, "payload": payload, "escalation": True})
        del self.sent[:-50]

    async def _user_name(self, user_id: str | None) -> str | None:
        if not user_id:
            return None
        user = await self.hass.auth.async_get_user(user_id)
        return user.name if user else None

    async def _on_notify_action(self, event: Event) -> None:
        act = str(event.data.get("action") or "")
        if not act.startswith("HV_"):
            return
        user = await self._user_name(event.context.user_id)
        if act.startswith(ACT_ACK):
            self.async_action(act[len(ACT_ACK):], "ack", user or "Push")
        elif act.startswith(ACT_MUTE):
            self.async_action(act[len(ACT_MUTE):], "mute", user or "Push", minutes=60)
        elif act.startswith(ACT_LOCK):
            eid = act[len(ACT_LOCK):]
            if eid.startswith("lock.") and self.hass.states.get(eid):
                await self.hass.services.async_call("lock", "lock", {"entity_id": eid}, blocking=False)
                if f"lock:{eid}" in self.book.alarms:
                    self.async_action(f"lock:{eid}", "ack", user or "Push")

    async def async_test(self) -> list[str]:
        targets = self.targets()
        alert = Alert("test", "warn", "Testmeldung der Haus Visualisierung", "Push-Benachrichtigungen funktionieren", "")
        payload = self.payload(alert)
        for target in targets:
            await self._call(target, payload)
        return targets

    def status(self) -> dict:
        return {
            "targets": self.targets(),
            "active": [{"key": a.key, "level": a.level, "title": a.title} for a in self._active.values()],
        }


def _rule_match(st: State, rule: dict) -> bool:
    op = rule.get("op", "on")
    v = num(st)
    try:
        w = float(str(rule.get("value", "")).replace(",", "."))
    except ValueError:
        w = None
    if op == "gt":
        return v is not None and w is not None and v > w
    if op == "lt":
        return v is not None and w is not None and v < w
    if op == "eq":
        return st.state == str(rule.get("value", ""))
    if op == "ne":
        return st.state != str(rule.get("value", "")) and st.state not in UNAV
    if op == "off":
        return not is_on(st) and st.state not in UNAV
    if op == "unavailable":
        return st.state in UNAV
    return is_on(st)
