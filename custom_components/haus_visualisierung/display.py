"""Wanddisplays (z. B. 4-Zoll-ESP32-S3 mit ESPHome): Inhalte fertig gerechnet als Entität je Display.

Das Display ist ein Client der Visualisierung: Seiten, Kacheln und Helligkeit stehen in den Einstellungen
(Reiter „Displays“, Schlüssel ``displays`` im Layout). Für jedes Display gibt es ``sensor.haus_display_<id>``;
die Attribute sind kurze JSON-Texte, die die Firmware nur noch anzeigt (Texte, Farben, Icons schon formatiert).
Tippen meldet das Display über den Dienst ``haus_visualisierung.display_tap``.

Ab Firmware 0.2 kennt das Gerät seine Kennung nicht mehr: Ein Display hat in den Einstellungen ein Gerät (``device``,
ESPHome-Name wie ``haus-display-a1b2c3``), und die Inhalte gehen per API-Aktion ``esphome.<gerät>_haus_daten``
ans Gerät (nur geänderte Bereiche; nach „hallo“ vom Gerät oder neuer Verbindung alles). Einrichten und Übernehmen
der Geräte: ``display_setup.py``.

Die Schnittstelle ist versioniert (``PROTOCOL``) und in ``DISPLAY_PROTOKOLL.md`` beschrieben; die Firmware liegt im
Repository ha-haus-display. Neue Felder dürfen hinzukommen, ohne die Version zu erhöhen; Umbenennen oder Entfernen
erhöht sie.
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_SERVICE_REGISTERED, EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, ServiceCall, State, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.network import NoURLAvailableError, get_url
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .alerts import UNAV, is_on, num
from .pin import KIND_TXT as PIN_TXT
from .pin import mode_kind
from .pin import needs as pin_needs

_LOGGER = logging.getLogger(__name__)

PROTOCOL = 1
SERVICE_TAP = "display_tap"
SERVICE_DATA = "haus_daten"  # API-Aktion der Firmware (ab 0.2.0)
LOCKED_NOTE_S = 8            # so lange zeigt ein Display „Mit PIN geschützt“ nach einem gesperrten Tipp
DEVICE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

# Kacheln der Startseite (Schlüssel im Layout → Name in den Einstellungen)
TILES = {
    "pv_jetzt": "PV jetzt",
    "energie_heute": "Energie heute",
    "klima_mittel": "Raumklima Ø",
    "morgen": "Müll und Termine",
    "wetter": "Wetter",
    "meldungen": "Meldungen",
    "geraete": "Haushaltsgeräte",
    "strompreis": "Strompreis",
}
PAGES = ("start", "energie", "klima", "haus")
DEFAULT_TILES = ["pv_jetzt", "energie_heute", "klima_mittel", "morgen"]

# Farben wie im Panel (stile.js)
C_WARM, C_COOL, C_OK, C_ALERT, C_HEAT, C_ACCENT, C_GRID, C_DIM = (
    "#ffc457", "#63c7ff", "#4fd18b", "#ff6b5b", "#ff8a3d", "#5aa0ff", "#b39cff", "#9aa3b2")
C_TEXT = "#eef2f8"
MODES = [("zuhause", "Zuhause", "home-account", C_OK), ("nacht", "Nacht", "weather-night", C_ACCENT),
         ("abwesend", "Abwesend", "home-export-outline", C_WARM), ("urlaub", "Urlaub", "airplane", C_GRID)]
MODE_INFO = {k: (n, i, f) for k, n, i, f in MODES}

W_COND = {
    "clear-night": ("Klar", "weather-night"), "cloudy": ("Bewölkt", "weather-cloudy"), "fog": ("Nebel", "weather-fog"),
    "hail": ("Hagel", "weather-hail"), "lightning": ("Gewitter", "weather-lightning"),
    "lightning-rainy": ("Gewitter", "weather-lightning-rainy"), "partlycloudy": ("Teils bewölkt", "weather-partly-cloudy"),
    "pouring": ("Starkregen", "weather-pouring"), "rainy": ("Regen", "weather-rainy"), "snowy": ("Schnee", "weather-snowy"),
    "snowy-rainy": ("Schneeregen", "weather-snowy-rainy"), "sunny": ("Sonnig", "weather-sunny"),
    "windy": ("Windig", "weather-windy"), "windy-variant": ("Windig", "weather-windy-variant"), "exceptional": ("Unwetter", "alert"),
}

# Müllabfuhr: wie termine.js
WASTE_RE = re.compile(r"abfall|m(ü|ue|u)ll|waste|tonne|abfuhr|wertstoff|entsorg|recycl|garbage|trash", re.I)
BINS = [
    (re.compile(r"gelb|wertstoff|verpackung|plastik|lvp|recycl", re.I), "#f2c230", "recycle"),
    (re.compile(r"papier|pappe|karton|blau|paper", re.I), "#4b8df8", "newspaper-variant-outline"),
    (re.compile(r"bio|braun|kompost|organic", re.I), "#a8703f", "leaf"),
    (re.compile(r"grün|gruen|garten|baum|laub", re.I), "#4cbf6b", "tree-outline"),
    (re.compile(r"glas|glass", re.I), "#3fae8f", "bottle-wine-outline"),
    (re.compile(r"sperr", re.I), "#e8893a", "sofa-outline"),
    (re.compile(r"schadstoff|problem|sonder", re.I), "#e5534b", "biohazard"),
    (re.compile(r"rest|grau|schwarz|haus|general", re.I), C_DIM, "trash-can-outline"),
]
WEEKDAY = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

# Gute Nacht: wie gutenacht.js
HOT_RE = re.compile(r"herd|kochfeld|backofen|\bofen\b|bügeleisen|buegeleisen|glätteisen|wasserkocher|kaffeemaschine|"
                    r"heizlüfter|stove|oven|\biron\b|kettle", re.I)
GN_TITLE = {"garage": "Garage & Tore", "contact": "Fenster & Türen", "lock": "Schlösser", "device": "Geräte",
            "light": "Licht", "media": "Medien"}
GN_MAX = 8
BAT_RE = re.compile(r"(akku|batter|battery|hausspeicher|stromspeicher)", re.I)
BAT_NOT = re.compile(r"(pv|solar|grid|netz|soc|wallbox|evcc|lade)", re.I)

WEATHER_TTL = 30 * 60
CAL_TTL = 15 * 60
BELL_RE = re.compile(r"doorbell|klingel", re.I)
BELL_EVENT_RE = re.compile(r"ring|press|doorbell|klingel", re.I)
BELL_CAM_RE = re.compile(r"entry|doorbell|klingel|haust", re.I)
BELL_IMG = (432, 243)  # Kamerabild im Overlay (16:9); die Firmware passt es mit gleichem Seitenverhältnis ein
BELL_AFTER_DOOR = 15   # Sekunden, die das Overlay nach „Tür öffnen“ noch offen bleibt
SENSOR_DELAY = 10     # Sekunden: Messwert-Änderungen gebündelt schicken (Display-Last, siehe CHANGELOG 1.18.1)


# ---------- Formatierung (deutsch) ----------
def de(v: float, digits: int = 1) -> str:
    txt = f"{v:,.{digits}f}"
    if txt.startswith("-") and not txt.strip("-0.,"):  # -0,2 auf 0 Stellen ist „0“, nicht „-0“
        txt = txt[1:]
    return txt.replace(",", " ").replace(".", ",").replace(" ", ".")


def kw(w: float | None) -> str:
    if w is None:
        return "–"
    return f"{de(w / 1000, 1)} kW" if abs(w) >= 1000 else f"{de(w, 0)} W"


def pct(v: float | None) -> str:
    return "–" if v is None else f"{round(v * 100)} %"


def power_w(st: State | None) -> float | None:
    v = num(st)
    if v is None or st is None:
        return None
    unit = st.attributes.get("unit_of_measurement") or "W"
    return v * 1000 if unit == "kW" else v * 1_000_000 if unit == "MW" else v


def bin_of(title: str) -> tuple[str, str]:
    for rx, color, ic in BINS:
        if rx.search(title):
            return color, ic
    return C_DIM, "trash-can-outline"


def slug(value: Any) -> str:
    s = str(value or "").lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:20]


def device_service(device: str) -> str:
    """Name des ESPHome-Dienstes, über den das Gerät seine Inhalte bekommt (wie ESPHome ihn bildet)."""
    return f"{device.replace('-', '_')}_{SERVICE_DATA}"


TOGGLE_DOMAINS = ("light", "switch", "fan", "input_boolean", "cover", "siren", "humidifier", "media_player", "climate")
PRESS = {"button": ("button", "press"), "input_button": ("input_button", "press"),
         "scene": ("scene", "turn_on"), "script": ("script", "turn_on")}


def rc(text: Any, color: str) -> str:
    """Farbiger Abschnitt für Texte mit LVGL-Recolor („#rrggbb Text#“, Felder sr/vr ab Firmware 0.4.0)."""
    return f"#{color[1:]} {str(text).replace('#', '')}#"


def tap_service(eid: str, st: State | None) -> tuple[str, str] | None:
    """Dienst für einen Tipp auf eine entity:-Kachel (None = nur anzeigen)."""
    domain = eid.split(".", 1)[0]
    if domain == "lock":
        return ("lock", "lock" if st and st.state != "locked" else "unlock")
    if domain in PRESS:
        return PRESS[domain]
    if domain in TOGGLE_DOMAINS:
        return ("homeassistant", "toggle")
    return None


# Symbole, die die Firmware kennt (tools/icons.txt im Repository ha-haus-display); andere zeigt sie als „?“
def stell_info(st: State | None) -> tuple[int, str] | None:
    """Stellbar per langem Tippen am Display? (Wert 0–100, "hell" für dimmbares Licht bzw. "pos" für Rollos mit Position)."""
    if st is None or st.state in UNAV:
        return None
    if st.domain == "light":
        modes = st.attributes.get("supported_color_modes") or []
        if not any(m != "onoff" for m in modes) and st.attributes.get("brightness") is None:
            return None
        b = st.attributes.get("brightness")
        return (round(b / 255 * 100) if st.state == "on" and isinstance(b, (int, float)) else 0), "hell"
    if st.domain == "cover" and int(st.attributes.get("supported_features") or 0) & 4:  # SET_POSITION
        pos = st.attributes.get("current_position")
        return (int(pos) if isinstance(pos, (int, float)) else (0 if st.state == "closed" else 100)), "pos"
    return None


DISPLAY_ICONS = frozenset({
    "air-conditioner", "airplane", "alarm-light", "alert", "alert-circle", "arrow-left", "battery", "battery-70",
    "bed", "bell", "bell-alert", "biohazard", "blinds", "bottle-wine-outline", "calendar", "calendar-clock", "car",
    "cctv", "ceiling-light", "chart-donut", "check", "check-circle-outline", "circle-outline", "close", "coffee",
    "currency-eur", "desk-lamp", "door", "door-closed", "door-open", "doorbell-video", "eye", "fan", "fan-off", "fire",
    "flash", "floor-lamp", "flower", "garage", "garage-open-variant", "gate", "gauge", "gesture-tap-button", "heat-pump",
    "help-circle-outline", "home", "home-account", "home-export-outline", "home-lightning-bolt", "home-thermometer",
    "home-variant", "lamp", "lan-disconnect", "leaf", "led-strip-variant", "lightbulb", "lightbulb-group", "lightbulb-on",
    "lightbulb-outline", "lightning-bolt", "lock", "lock-alert", "lock-open", "lock-open-variant", "motion-sensor",
    "music", "newspaper-variant-outline", "palette", "pool", "power", "power-plug", "power-plug-outline",
    "power-socket-eu", "radiator", "recycle", "robot-vacuum", "script-text", "shield-check", "shield-home",
    "shield-lock", "shower", "silverware-fork-knife", "snowflake", "sofa", "sofa-outline", "solar-power-variant",
    "speaker", "speaker-play", "sprinkler", "star", "string-lights", "television", "thermometer", "thermostat",
    "toggle-switch", "toggle-switch-off-outline", "transmission-tower", "trash-can-outline", "tree-outline",
    "update", "view-dashboard", "washing-machine", "water", "water-percent", "weather-cloudy", "weather-fog",
    "weather-hail", "weather-lightning", "weather-lightning-rainy", "weather-night", "weather-partly-cloudy",
    "weather-pouring", "weather-rainy", "weather-snowy", "weather-snowy-rainy", "weather-sunny", "weather-windy",
    "weather-windy-variant", "window-closed", "window-open-variant", "window-shutter", "window-shutter-open",
})
DOMAIN_ICON = {"light": "lightbulb", "switch": "toggle-switch", "fan": "fan", "cover": "window-shutter", "lock": "lock",
               "climate": "thermostat", "media_player": "television", "scene": "palette", "script": "script-text",
               "button": "gesture-tap-button", "input_button": "gesture-tap-button", "input_boolean": "toggle-switch",
               "binary_sensor": "eye", "sensor": "gauge", "siren": "bell", "humidifier": "water-percent"}
CUSTOM_PAGES, CUSTOM_TILES = 3, 6
ENTITY_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


def display_icon(want: Any, eid: str, st: State | None) -> str:
    """Symbol für das Display: gewünschtes bzw. das der Entität, sonst passend zur Domäne (nur DISPLAY_ICONS)."""
    for cand in (want, st.attributes.get("icon") if st else None):
        name = str(cand or "").removeprefix("mdi:")
        if name in DISPLAY_ICONS:
            return name
    domain = eid.split(".", 1)[0]
    if domain == "light" and st is not None and is_on(st):
        return "lightbulb-on"
    if domain == "lock" and st is not None and st.state == "unlocked":
        return "lock-open"
    return DOMAIN_ICON.get(domain, "circle-outline")


def sanitize_custom(raw: Any) -> list[dict]:
    """Eigene Seiten eines Displays: bis zu drei, je bis zu sechs Entitäten mit eigenem Namen und Symbol."""
    out = []
    for pg in raw[:20] if isinstance(raw, list) else []:
        if not isinstance(pg, dict) or len(out) >= CUSTOM_PAGES:
            continue
        tiles = []
        for t in pg.get("tiles", [])[:30] if isinstance(pg.get("tiles"), list) else []:
            if len(tiles) < CUSTOM_TILES and isinstance(t, dict) and isinstance(t.get("entity"), str) and ENTITY_RE.match(t["entity"]):
                ic = str(t.get("icon") or "").removeprefix("mdi:")
                tiles.append({"entity": t["entity"], "name": str(t.get("name") or "")[:30],
                              "icon": ic if ic in DISPLAY_ICONS else ""})
        ic = str(pg.get("icon") or "").removeprefix("mdi:")
        out.append({"name": str(pg.get("name") or f"Seite {len(out) + 1}")[:20].strip(),
                    "icon": ic if ic in DISPLAY_ICONS else "view-dashboard", "tiles": tiles})
    return out


def sanitize_displays(raw: Any) -> list[dict]:
    """Einstellungen je Display prüfen (für store.sanitize)."""
    out, ids, devices = [], set(), set()
    for d in raw[:20] if isinstance(raw, list) else []:
        if not isinstance(d, dict) or len(out) >= 6:
            continue
        did = slug(d.get("id") or d.get("name")) or "display"
        base, n = did, 2
        while did in ids:
            did, n = f"{base}_{n}", n + 1
        ids.add(did)
        pages = [p for p in d.get("pages", []) if p in PAGES] if isinstance(d.get("pages"), list) else []
        pages = list(dict.fromkeys(["start", *pages]))
        tiles = []
        for t in d.get("tiles", []) if isinstance(d.get("tiles"), list) else []:
            if t in TILES or (isinstance(t, str) and re.match(r"^entity:[a-z_]+\.[a-z0-9_]+$", t)):
                tiles.append(t)
        tiles = (tiles or list(DEFAULT_TILES))[:4]

        dev = d.get("device") if isinstance(d.get("device"), str) and DEVICE_RE.match(d.get("device")) else ""
        if dev in devices:
            dev = ""
        if dev:
            devices.add(dev)

        def _int(key: str, lo: int, hi: int, default: int) -> int:
            v = d.get(key)
            return int(min(max(v, lo), hi)) if isinstance(v, (int, float)) and not isinstance(v, bool) else default

        out.append({
            "id": did,
            "name": str(d.get("name") or did)[:40],
            "pages": pages,
            "tiles": tiles,
            "hint": d.get("hint", True) is not False,
            "bright_day": _int("bright_day", 10, 100, 80),
            "bright_night": _int("bright_night", 0, 100, 10),
            "wake": d.get("wake", True) is not False,
            "device": dev,
            "custom": sanitize_custom(d.get("custom")),
            "saver": d.get("saver") is True,
            "saver_min": _int("saver_min", 1, 120, 5),
            "saver_bright": _int("saver_bright", 0, 100, 20),
            "bell": d.get("bell", True) is not False,
        })
    return out


def is_ring(old: State | None, new: State | None) -> bool:
    """Klingelt es? Wie im Panel (aktualisierer.js isRing): neues Ereignis bzw. Binärsensor wird „an“.

    Nach einem Neustart steht eine Ereignis-Entität auf „unknown“, bis zum ersten Klingeln – das muss zählen.
    Damit eine wieder erreichbare Entität nicht als Klingeln gilt, zählt ein Ereignis nur, wenn es frisch ist.
    """
    if old is None or new is None or new.state in UNAV:
        return False
    if new.domain == "event":
        if new.state == old.state:
            return False
        when = dt_util.parse_datetime(new.state)
        if when is not None and abs((dt_util.utcnow() - when).total_seconds()) > 60:
            return False
        et = new.attributes.get("event_type")
        return not et or bool(BELL_EVENT_RE.search(str(et)))
    return new.state == "on" and old.state not in ("on", "unavailable")


def _dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


class DisplayHub:
    """Rechnet die Inhalte aller Displays und führt Tipps aus."""

    def __init__(self, hass: HomeAssistant, monitor) -> None:
        self.hass = hass
        self.monitor = monitor
        self._listeners: set[Callable[[], None]] = set()
        self._unsubs: list[Callable[[], None]] = []
        self._pending: Callable[[], None] | None = None
        self._pending_at = 0.0
        self._watched: set[str] = set()
        self.payloads: dict[str, dict[str, Any]] = {}
        self._weather: dict[str, Any] = {"at": 0.0, "eid": None, "days": []}
        self._cal: dict[str, Any] = {"at": 0.0, "events": []}
        self._fetching: set[str] = set()
        # Energie heute: selbst integriert (Wh seit Mitternacht), überlebt Neustarts
        self._day: dict[str, Any] = {"date": "", "pv": 0.0, "imp": 0.0, "exp": 0.0, "use": 0.0, "last": None}
        self._store: Store[dict] = Store(hass, 1, "haus_visualisierung.display")
        # Push an die Geräte: zuletzt geschickter Stand je Gerät und Bereich; „hallo“ je Gerät (für den Assistenten)
        self._sent: dict[str, dict[str, str]] = {}
        self.hello: dict[str, float] = {}
        # Klingel: läuft gerade (n zählt jedes Klingeln, bis = Zeitpunkt des Schließens)
        self.ring: dict[str, Any] | None = None
        self._ring_n = 0
        self._ring_timer: Callable[[], None] | None = None
        self._bell_eid: str | None = None
        # gesperrte Tipps (PIN): Display → (bis, Aktion) für den Hinweis
        self._locked: dict[str, tuple[float, str]] = {}

    # ---------- Lebenszyklus ----------
    async def async_start(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict) and data.get("date") == dt_util.now().date().isoformat():
            self._day.update({k: float(data.get(k) or 0) for k in ("pv", "imp", "exp", "use")}, date=data["date"])
        self._unsubs.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state))
        self._unsubs.append(async_track_time_interval(self.hass, self._on_tick, timedelta(seconds=30)))
        self._unsubs.append(self.monitor.store.async_add_listener(lambda _l: self.schedule(0)))
        self._unsubs.append(self.monitor.book.async_add_listener(lambda _s: self.schedule()))
        self._unsubs.append(self.monitor.appliances.async_add_listener(lambda: self.schedule()))
        self._unsubs.append(self.hass.bus.async_listen(EVENT_SERVICE_REGISTERED, self._on_service))
        self.update()

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()
        if self._pending:
            self._pending()
            self._pending = None
        if self._ring_timer:
            self._ring_timer()
            self._ring_timer = None
        self._store.async_delay_save(self._day_data, 0)

    @callback
    def async_add_listener(self, cb: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(cb)
        return lambda: self._listeners.discard(cb)

    @property
    def layout(self) -> dict:
        return self.monitor.layout

    @property
    def displays(self) -> list[dict]:
        return self.layout.get("displays", [])

    def _day_data(self) -> dict:
        return {k: self._day[k] for k in ("date", "pv", "imp", "exp", "use")}

    # ---------- Auslöser ----------
    @callback
    def _on_state(self, event: Event) -> None:
        if not self.displays:
            return
        eid = event.data.get("entity_id", "")
        if eid.startswith("sensor.haus_display_"):
            return
        if eid == self._bell_eid and is_ring(event.data.get("old_state"), event.data.get("new_state")):
            self.start_ring()
            return
        if eid in self._watched or eid.startswith(("weather.", "calendar.")):
            # Messwerte (Leistung, Temperatur …) ändern sich ständig: höchstens alle SENSOR_DELAY s schicken,
            # Schaltzustände (Licht, Rollo …) sofort, damit die Rückmeldung am Display flott bleibt
            self.schedule(SENSOR_DELAY if eid.startswith("sensor.") else 1.0)

    @callback
    def _on_service(self, event: Event) -> None:
        """Gerät neu verbunden bzw. übernommen: ESPHome meldet seinen Dienst an → alles neu schicken."""
        if event.data.get("domain") != "esphome" or not str(event.data.get("service", "")).endswith(f"_{SERVICE_DATA}"):
            return
        for d in self.displays:
            if d.get("device") and device_service(d["device"]) == event.data["service"]:
                self._sent.pop(d["device"], None)
                self.schedule(0.5)

    def _watch(self) -> set[str]:
        c = self.energy_cfg()
        ents = {v for v in (c or {}).values() if isinstance(v, str) and "." in v}
        ents |= set(self.monitor._all)
        ents |= {e for d in self.displays for t in d["tiles"] if t.startswith("entity:") for e in [t[7:]]}
        ents |= {t["entity"] for d in self.displays for pg in d.get("custom", []) for t in pg["tiles"]}
        return ents

    @callback
    def _on_tick(self, _now: Any) -> None:
        self._integrate()
        self.update()

    # ---------- Klingel (Einstellungen → Klingel, wie das Overlay im Panel) ----------
    def bell_entity(self) -> str | None:
        cfg = self.layout.get("doorbell") or {}
        if not any(d.get("bell", True) and d.get("device") for d in self.displays):
            return None
        if cfg.get("entity"):
            return cfg["entity"] if self.hass.states.get(cfg["entity"]) else None
        states = self.hass.states.async_all(("event", "binary_sensor"))
        pick = next((st for st in states if st.domain == "event" and st.attributes.get("device_class") == "doorbell"), None) \
            or next((st for st in states if BELL_RE.search(st.entity_id)), None)
        return pick.entity_id if pick else None

    def bell_camera(self) -> str | None:
        cfg = self.layout.get("doorbell") or {}
        if cfg.get("camera") and self.hass.states.get(cfg["camera"]):
            return cfg["camera"]
        cams = self.hass.states.async_entity_ids("camera")
        pref = lambda lst: next((e for e in lst if not re.search(r"paket|package", e, re.I)), lst[0] if lst else None)  # noqa: E731
        bell = self.bell_entity()
        reg = er.async_get(self.hass)
        dev = (ent := reg.async_get(bell)) and ent.device_id if bell else None
        if dev:
            same = [e for e in cams if (c := reg.async_get(e)) and c.device_id == dev]
            if same:
                return pref(same)
        return pref([e for e in cams if BELL_CAM_RE.search(e)]) or (cams[0] if cams else None)

    @callback
    def start_ring(self, test: bool = False) -> None:
        cfg = self.layout.get("doorbell") or {}
        again = self.ring is not None
        self._ring_n += 1
        self.ring = {"n": self._ring_n, "again": again, "test": test, "at": dt_util.now().strftime("%H:%M"),
                     "cam": self.bell_camera(), "offen": False}
        self._ring_until(int(cfg.get("timeout") or 60))
        self.update()

    def _ring_until(self, secs: int) -> None:
        if self._ring_timer:
            self._ring_timer()

        @callback
        def _end(_now: Any) -> None:
            self._ring_timer = None
            self.ring = None
            self.update()

        self.ring["bis"] = int(time.time()) + secs
        self._ring_timer = async_call_later(self.hass, secs, _end)

    def klingel(self) -> dict | None:
        """Klingel-Overlay: Titel, Kamera und Zeit, Adresse eines verkleinerten Kamerabilds, Türöffner ja/nein."""
        r = self.ring
        if not r:
            return None
        cfg = self.layout.get("doorbell") or {}
        cam = r["cam"]
        st = self.hass.states.get(cam) if cam else None
        bild = ""
        if st and st.attributes.get("access_token"):
            try:
                base = get_url(self.hass, allow_external=False, allow_cloud=False, prefer_external=False)
                bild = f"{base}/api/camera_proxy/{cam}?token={st.attributes['access_token']}&width={BELL_IMG[0]}&height={BELL_IMG[1]}"
            except NoURLAvailableError:
                pass
        name = (st.name if st else "") or "Haustür"
        titel = "Test: Es klingelt" if r["test"] else "Es klingelt erneut" if r["again"] else "Es klingelt"
        lock = cfg.get("lock") or ""
        return {"n": r["n"], "t": titel, "s": f"{name} · {r['at']}", "bild": bild,
                "tuer": bool(lock and self.hass.states.get(lock)), "offen": r["offen"], "bis": r["bis"]}

    async def _open_door(self) -> None:
        """Türöffner wie „Tür öffnen“ im Panel (panel-klingel.js _openDoor)."""
        cfg = self.layout.get("doorbell") or {}
        eid = cfg.get("lock") or ""
        st = self.hass.states.get(eid)
        if not st:
            return
        d = st.domain
        if d == "lock":
            await self.hass.services.async_call("lock", "open" if int(st.attributes.get("supported_features") or 0) & 1 else "unlock",
                                                {"entity_id": eid}, blocking=True)
        elif d in ("button", "input_button"):
            await self.hass.services.async_call(d, "press", {"entity_id": eid}, blocking=True)
        elif d in ("script", "scene"):
            await self.hass.services.async_call(d, "turn_on", {"entity_id": eid}, blocking=True)
        else:
            svc = d if d in ("switch", "input_boolean", "light") else "homeassistant"
            await self.hass.services.async_call(svc, "turn_on", {"entity_id": eid}, blocking=True)
            pulse = cfg.get("pulse", 2)
            if isinstance(pulse, (int, float)) and pulse > 0:
                async def _off(_now: Any) -> None:
                    await self.hass.services.async_call(svc, "turn_off", {"entity_id": eid}, blocking=False)
                async_call_later(self.hass, pulse, _off)

    @callback
    def schedule(self, delay: float = 1.0) -> None:
        """Ein Update vormerken; ein schon vorgemerktes späteres wird vorgezogen, ein früheres bleibt."""
        at = time.monotonic() + delay
        if self._pending:
            if at >= self._pending_at:
                return
            self._pending()

        @callback
        def _run(_now: Any) -> None:
            self._pending = None
            self.update()

        self._pending_at = at
        self._pending = async_call_later(self.hass, delay, _run)

    # ---------- Energie ----------
    def energy_cfg(self) -> dict | None:
        """Wie energyCfg im Panel: Kopfzeilen-Sensoren, Speicher-Leistung (eingestellt oder nach Namen)."""
        get, L = self.hass.states.get, self.layout
        H, E = L.get("header") or {}, L.get("energy") or {}
        if E.get("enabled") is False:
            return None
        S = lambda e: e if e and get(e) else ""  # noqa: E731
        pv, grid, house, soc = S(H.get("pv")), S(H.get("grid")), S(H.get("power")), S(H.get("battery"))
        bat = S(E.get("battery_power"))
        if not bat:
            for st in self.hass.states.async_all("sensor"):
                lbl = f"{st.entity_id} {st.attributes.get('friendly_name') or ''}"
                if (st.attributes.get("device_class") == "power" and st.entity_id not in (pv, grid, house)
                        and BAT_RE.search(lbl) and not BAT_NOT.search(lbl)):
                    bat = st.entity_id
                    break
        if not (pv or grid or house or bat):
            return None
        return {"pv": pv, "grid": grid, "house": house, "soc": soc, "bat": bat,
                "grid_inv": bool(E.get("grid_invert")), "bat_inv": bool(E.get("battery_invert"))}

    def energy_now(self) -> dict | None:
        c = self.energy_cfg()
        if c is None:
            return None
        get = self.hass.states.get
        W = lambda e: power_w(get(e)) if e else None  # noqa: E731
        pv, grid, bat, house = W(c["pv"]), W(c["grid"]), W(c["bat"]), W(c["house"])
        if grid is not None and c["grid_inv"]:
            grid = -grid
        if bat is not None and c["bat_inv"]:
            bat = -bat
        p = None if pv is None else max(0.0, pv)
        total = max(0.0, (p or 0) + grid - (bat or 0)) if grid is not None else house
        home = max(0.0, house) if house is not None else total
        imp = None if grid is None else max(0.0, grid)
        exp = None if grid is None else max(0.0, -grid)
        autark = (min(1.0, max(0.0, 1 - imp / total)) if total else 1.0 if total == 0 and imp is not None else None) if imp is not None else None
        own = min(1.0, max(0.0, 1 - exp / p)) if p is not None and p > 50 and exp is not None else None
        soc = num(get(c["soc"])) if c["soc"] else None
        return {"pv": p, "grid": grid, "bat": bat, "home": home, "total": total, "imp": imp, "exp": exp,
                "autark": autark, "own": own, "soc": soc}

    @callback
    def _integrate(self) -> None:
        """Wh seit Mitternacht aufsummieren (alle 30 s, höchstens 5 min Lücke)."""
        now, today = time.time(), dt_util.now().date().isoformat()
        if self._day["date"] != today:
            self._day.update(date=today, pv=0.0, imp=0.0, exp=0.0, use=0.0)
        F = self.energy_now()
        last, self._day["last"] = self._day["last"], now
        if F is None or last is None or now - last > 300:
            return
        h = (now - last) / 3600
        for key, val in (("pv", F["pv"]), ("imp", F["imp"]), ("exp", F["exp"]), ("use", F["total"])):
            if val is not None:
                self._day[key] += val * h
        self._store.async_delay_save(self._day_data, 300)

    def energy_day(self) -> dict:
        d = self._day
        autark = min(1.0, max(0.0, 1 - d["imp"] / d["use"])) if d["use"] > 0 else None
        own = min(1.0, max(0.0, 1 - d["exp"] / d["pv"])) if d["pv"] > 50 else None
        return {"pv": d["pv"], "use": d["use"], "autark": autark, "own": own}

    def price_ct(self) -> float | None:
        P = self.layout.get("price") or {}
        st = self.hass.states.get(P.get("sensor") or "")
        if P.get("use_sensor", True) and st is not None and (v := num(st)) is not None:
            unit = str(st.attributes.get("unit_of_measurement") or "").lower()
            f = 100 if unit.startswith(("eur", "€")) and "mwh" not in unit else 0.1 if "mwh" in unit else 1
            return v * f + float(P.get("surcharge_ct") or 0)
        return float(P.get("fixed_ct") or 0) or None

    # ---------- Wetter und Kalender (asynchron, zwischengespeichert) ----------
    def weather_eid(self) -> str | None:
        w = (self.layout.get("wallpanel") or {}).get("weather")
        if w and self.hass.states.get(w):
            return w
        return next(iter(sorted(self.hass.states.async_entity_ids("weather"))), None)

    def _fetch(self, key: str, coro_fn: Callable[[], Any]) -> None:
        if key in self._fetching:
            return
        self._fetching.add(key)

        async def _run() -> None:
            try:
                await coro_fn()
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Display: %s nicht lesbar: %s", key, err)
            finally:
                self._fetching.discard(key)
                self.schedule(0)

        self.hass.async_create_task(_run())

    async def _load_weather(self, eid: str) -> None:
        res = await self.hass.services.async_call("weather", "get_forecasts", {"entity_id": eid, "type": "daily"},
                                                  blocking=True, return_response=True)
        days = ((res or {}).get(eid) or {}).get("forecast") or []
        self._weather = {"at": time.time(), "eid": eid, "days": days}

    def calendars(self) -> list[tuple[str, str]]:
        T = self.layout.get("termine") or {}
        if T.get("enabled") is False:
            return []
        out = []
        for eid in sorted(self.hass.states.async_entity_ids("calendar")):
            kind = (T.get("cals") or {}).get(eid)
            if kind == "-":
                continue
            if kind not in ("waste", "event"):
                st = self.hass.states.get(eid)
                kind = "waste" if WASTE_RE.search(f"{eid} {(st.attributes.get('friendly_name') if st else '') or ''}") else ""
            if kind:
                out.append((eid, kind))
        return out

    async def _load_calendars(self, cals: list[tuple[str, str]]) -> None:
        start = dt_util.start_of_local_day()
        end = start + timedelta(days=3)
        res = await self.hass.services.async_call(
            "calendar", "get_events", {"entity_id": [e for e, _k in cals], "start_date_time": start.isoformat(),
                                       "end_date_time": end.isoformat()}, blocking=True, return_response=True)
        kinds = dict(cals)
        events = []
        for eid, val in (res or {}).items():
            for ev in (val or {}).get("events", []):
                s = str(ev.get("start") or "")
                all_day = len(s) == 10
                when = dt_util.parse_datetime(s) if not all_day else None
                day = dt_util.parse_date(s[:10]) if all_day else (dt_util.as_local(when).date() if when else None)
                if day is None:
                    continue
                events.append({"kind": kinds.get(eid, "event"), "title": str(ev.get("summary") or "Termin").strip(),
                               "day": day.isoformat(), "time": "" if all_day or not when else dt_util.as_local(when).strftime("%H:%M")})
        self._cal = {"at": time.time(), "events": events}

    def _ensure_async(self) -> None:
        eid = self.weather_eid()
        if eid and (self._weather["eid"] != eid or time.time() - self._weather["at"] > WEATHER_TTL):
            self._weather["at"] = time.time()  # nicht in jeder Runde neu versuchen
            self._fetch("weather", lambda: self._load_weather(eid))
        cals = self.calendars()
        if cals and time.time() - self._cal["at"] > CAL_TTL:
            self._cal["at"] = time.time()
            self._fetch("calendar", lambda: self._load_calendars(cals))

    def termine(self) -> dict | None:
        """Nächste Abfuhr (heute bis 12 Uhr oder morgen) und Termine heute/morgen – wie termSummary im Panel."""
        now = dt_util.now()
        today = now.date()
        eve = int((self.layout.get("termine") or {}).get("evening", 17))

        def rel(ev: dict) -> int:
            return (datetime.fromisoformat(ev["day"]).date() - today).days

        evs = [e for e in self._cal["events"] if 0 <= rel(e) <= 1]
        waste_day = next((rel(e) for e in sorted(evs, key=rel) if e["kind"] == "waste"
                          and ((rel(e) == 0 and now.hour < 12) or rel(e) == 1)), None)
        waste = [e["title"] for e in evs if e["kind"] == "waste" and rel(e) == waste_day] if waste_day is not None else []
        events = sorted((e for e in evs if e["kind"] == "event" and not (rel(e) == 0 and e["time"] and e["time"] < now.strftime("%H:%M"))),
                        key=lambda e: (rel(e), e["time"] or "00:00"))
        if not waste and not events:
            return None
        hot = bool(waste) and (now.hour >= eve if waste_day == 1 else now.hour < 10)
        word = {0: "Heute", 1: "Morgen"}
        return {"waste": list(dict.fromkeys(waste)), "waste_word": word.get(waste_day, ""), "hot": hot,
                "events": [f"{'' if rel(e) == 0 else 'morgen '}{e['time'] + ' ' if e['time'] else ''}{e['title']}" for e in events[:3]]}

    # ---------- Raumklima ----------
    def climate(self) -> dict:
        get = self.hass.states.get
        rooms = []
        for r in self.monitor._rooms:
            if not r.indoor or not r.temp_id:
                continue
            t, h = num(get(r.temp_id)), num(get(r.hum_id)) if r.hum_id else None
            if t is None:
                continue
            mold = bool(self.monitor._mold.get(r.area_id, {}).get("on"))
            rooms.append({"n": r.name, "t": t, "h": h, "w": mold})
        rooms.sort(key=lambda x: x["n"].lower())
        ts = [x["t"] for x in rooms]
        hs = [x["h"] for x in rooms if x["h"] is not None]
        t_out, _rh = self.monitor._outdoor_now()
        return {"rooms": rooms, "t": sum(ts) / len(ts) if ts else None, "h": sum(hs) / len(hs) if hs else None,
                "vent": [x["n"] for x in rooms if x["w"]], "out": t_out}

    # ---------- Gute Nacht (wie checkItems im Panel) ----------
    def _short(self, eid: str) -> tuple[str, str]:
        st = self.hass.states.get(eid)
        room = self.monitor._area_of.get(eid)
        name = str((st.attributes.get("friendly_name") if st else None) or eid)
        if room and name.lower().startswith(room.name.lower() + " ") and len(name) > len(room.name) + 1:
            name = name[len(room.name) + 1:]
        return name[:1].upper() + name[1:], room.name if room else ""

    def check_items(self, mode: str = "nacht") -> list[dict]:
        hm = self.layout.get("house_mode") or {}
        if hm.get("enabled") is False or hm.get("check") is False:
            return []
        get, out, seen = self.hass.states.get, [], set()
        rooms = self.monitor._rooms

        def all_(k: str) -> list[str]:
            return [e for r in rooms for e in r.groups.get(k, [])]

        def add(eid: str, kind: str, ic: str, state: str, act: tuple[str, str, str] | None) -> None:
            if eid in seen:
                return
            seen.add(eid)
            name, room = self._short(eid)
            out.append({"eid": eid, "kind": kind, "i": ic, "n": name, "r": room, "z": state, "act": act})

        garages = [e for e in all_("cover") if (get(e) and get(e).attributes.get("device_class")) in ("garage", "gate")]
        for e in garages:
            st = get(e)
            if is_on(st):
                add(e, "garage", "garage-open-variant", "öffnet" if st.state == "opening" else "offen",
                    ("cover", "close_cover", "Schließen"))
        garage_rooms = {self._short(e)[1] for e in garages}
        for e in all_("contact"):
            st = get(e)
            if not st or st.state != "on":
                continue
            c = st.attributes.get("device_class")
            if c == "garage_door" and self._short(e)[1] in garage_rooms:
                continue
            ic = {"garage_door": "garage-open-variant", "door": "door-open"}.get(c, "window-open-variant")
            add(e, "contact", ic, "offen", None)
        for e in all_("lock"):
            st = get(e)
            if not st or st.state in UNAV or st.state in ("locked", "locking"):
                continue
            jam = st.state == "jammed"
            add(e, "lock", "lock-alert" if jam else "lock-open-variant",
                "klemmt" if jam else "offen" if st.state == "open" else "nicht verriegelt", ("lock", "lock", "Verriegeln"))
        extra = hm.get("check_devices") or []
        for e in [*(x for x in all_("switch") if HOT_RE.search(self._short(x)[0])), *extra]:
            st = get(e)
            if not st or not is_on(st):
                continue
            d = e.split(".", 1)[0]
            act = (("homeassistant", "turn_off", "Ausschalten") if d in ("light", "switch", "fan", "input_boolean", "climate", "media_player", "water_heater", "humidifier")
                   else ("cover", "close_cover", "Schließen") if d == "cover" else ("lock", "lock", "Verriegeln") if d == "lock" else None)
            add(e, "device", "power-plug-outline", "an", act)
        for e in all_("light"):
            if is_on(get(e)):
                add(e, "light", "lightbulb-on", "an", ("light", "turn_off", "Aus"))
        if mode == "abwesend":
            for e in all_("media"):
                st = get(e)
                if st and st.state == "playing":
                    add(e, "media", "speaker-play", "spielt", ("media_player", "media_pause", "Pause"))
        return out

    # ---------- Inhalte ----------
    def _mode(self) -> str:
        return self.monitor.house.mode

    def _alerts(self) -> list[dict]:
        order = {"alarm": 0, "warn": 1, "info": 2}
        al = [a for a in self.monitor.book.alarms.values() if a.get("status") != "stumm"]
        return sorted(al, key=lambda a: (order.get(a.get("level"), 3), -float(a.get("since") or 0)))

    def _done_appliances(self) -> list[str]:
        return [r["name"] for r in self.monitor.appliances.snapshot() if r.get("state") == "fertig"]

    def kopf(self) -> dict:
        get = self.hass.states.get
        out: dict[str, Any] = {}
        eid = self.weather_eid()
        if eid and (st := get(eid)) is not None:
            txt, ic = W_COND.get(st.state, (st.state, "weather-partly-cloudy"))
            t = st.attributes.get("temperature")
            days = self._weather["days"] if self._weather["eid"] == eid else []
            tomorrow = days[1] if len(days) > 1 else None
            out["wetter"] = {"i": ic, "t": f"{de(float(t), 0)}°" if isinstance(t, (int, float)) else "–", "txt": txt,
                             "morgen": f"morgen {de(float(tomorrow['temperature']), 0)}°" if tomorrow and isinstance(tomorrow.get("temperature"), (int, float)) else ""}
        m = self._mode()
        n, i, f = MODE_INFO.get(m, (m, "home", C_DIM))
        out["modus"] = {"k": m, "n": n, "i": i, "f": f}
        return out

    def tile(self, key: str) -> dict:
        get = self.hass.states.get
        base = {"k": key, "i": "help-circle-outline", "f": C_DIM, "n": TILES.get(key, key), "v": "–", "vf": "", "s": "", "b": -1, "bf": "", "u": "", "hot": False}
        if key == "pv_jetzt":
            F = self.energy_now()
            if F:
                net = F["grid"]
                netz = f"{'−' if net is not None and net < 0 else ''}{kw(abs(net))}" if net is not None else ""
                base.update(i="solar-power-variant", f=C_WARM, v=kw(F["pv"]), vf=C_WARM,
                            s=f"Haus {kw(F['home'])}" + (f" · Netz {netz}" if net is not None else ""),
                            sr=f"Haus {rc(kw(F['home']), C_COOL)}" + (f" · Netz {rc(netz, C_GRID)}" if net is not None else ""))
                if F["soc"] is not None:
                    base.update(b=round(F["soc"]), bf=C_OK, u=f"Akku {round(F['soc'])} %")
        elif key == "energie_heute":
            D = self.energy_day()
            base.update(n="Heute", i="chart-donut", f=C_OK, v=f"{de(D['pv'] / 1000, 1)} kWh", s="PV seit Mitternacht")
            if D["autark"] is not None:
                base.update(s=f"Autarkie {pct(D['autark'])}", sr=f"Autarkie {rc(pct(D['autark']), C_TEXT)}", b=round(D["autark"] * 100), bf=C_WARM)
            fc = (self.layout.get("forecast") or {}).get("solar_tomorrow")
            if fc and (v := num(get(fc))) is not None:
                base["u"] = f"morgen {de(v, 1)} kWh"
        elif key == "klima_mittel":
            K = self.climate()
            base.update(n="Haus Ø", i="thermometer", f=C_HEAT)
            if K["t"] is not None:
                base["v"] = f"{de(K['t'], 1)}°" + (f"  {round(K['h'])} %" if K["h"] is not None else "")
                base["vr"] = f"{de(K['t'], 1)}°" + ("  " + rc(f"{round(K['h'])} %", C_DIM) if K["h"] is not None else "")
            if K["vent"]:
                base.update(s=f"{K['vent'][0]} lüften", sr=rc(f"{K['vent'][0]} lüften", C_COOL), vf="")
            if K["out"] is not None:
                base["u"] = f"Außen {de(K['out'], 1)}°"
        elif key == "morgen":
            T = self.termine()
            base.update(n="Termine", i="calendar", f=C_COOL, v="Nichts geplant")
            if T and T["waste"]:
                color, ic = bin_of(T["waste"][0])
                base.update(n=T["waste_word"], i=ic, f=color, v=", ".join(T["waste"]), hot=T["hot"])
                if T["events"]:
                    base["s"] = T["events"][0]
            elif T and T["events"]:
                base.update(n="Nächster Termin", i="calendar-clock", v=T["events"][0], s=" · ".join(T["events"][1:2]))
        elif key == "wetter":
            K = self.kopf().get("wetter")
            if K:
                base.update(i=K["i"], f=C_WARM, v=K["t"], s=K["txt"], u=K["morgen"])
        elif key == "meldungen":
            al = self._alerts()
            lvl = al[0].get("level") if al else None
            base.update(i="bell-alert" if al else "shield-check", f=C_ALERT if lvl == "alarm" else C_WARM if al else C_OK,
                        v=str(len(al)) if al else "Alles ruhig", s=str(al[0].get("title", "")) if al else "")
        elif key == "geraete":
            done = self._done_appliances()
            run = sum(1 for r in self.monitor.appliances.snapshot() if r.get("state") == "laeuft")
            base.update(n="Geräte", i="washing-machine", f=C_OK if done else C_COOL,
                        v=f"{len(done)} fertig" if done else f"{run} läuft" if run else "Aus", s=", ".join(done[:2]))
        elif key == "strompreis":
            ct = self.price_ct()
            base.update(n="Strompreis", i="currency-eur", f=C_WARM, v=f"{de(ct, 1)} ct" if ct is not None else "–", s="pro kWh jetzt")
        elif key.startswith("entity:"):
            eid = key[7:]
            st = get(eid)
            name, room = self._short(eid)
            base.update(n=name, s=room, i=display_icon(None, eid, st))
            if st is not None:
                v = num(st)
                unit = st.attributes.get("unit_of_measurement")
                base["v"] = (de(v, 1).removesuffix(",0") + (f" {unit}" if unit else "")) if v is not None else \
                    {"on": "an", "off": "aus", "open": "offen", "closed": "zu", "unavailable": "nicht erreichbar"}.get(st.state, st.state)
                base["f"] = C_WARM if is_on(st) else C_DIM
            # Bedienung am Display: a = Tipp schaltet (sofort „…“ als Rückmeldung), w/wa = per langem Tippen stellbar
            if tap_service(eid, st):
                base["a"] = True
            if info := stell_info(st):
                base["w"], base["wa"] = info
        return base

    def schoner(self) -> dict:
        """Bildschirmschoner wie am Wandpanel: Wetter, PV, morgen, Hausmodus; Müll und Termine; fertige Geräte; Meldungen."""
        K = self.kopf()
        zeile = []
        if w := K.get("wetter"):
            zeile.append({"i": w["i"], "t": w["t"]})
        F = self.energy_now()
        if F and F["pv"] is not None and F["pv"] > 50:
            zeile.append({"i": "solar-power-variant", "t": kw(F["pv"])})
        if w and w["morgen"]:
            zeile.append({"i": "calendar", "t": w["morgen"][:1].upper() + w["morgen"][1:]})
        zeile.append({"i": K["modus"]["i"], "t": K["modus"]["n"]})
        termine = []
        if T := self.termine():
            if T["waste"]:
                color, ic = bin_of(T["waste"][0])
                termine.append({"i": ic, "f": color, "t": f"{T['waste_word']}: {', '.join(T['waste'])}", "hot": T["hot"]})
            termine += [{"i": "calendar-clock", "f": C_DIM, "t": e, "hot": False} for e in T["events"][:3 - len(termine)]]
        done = self._done_appliances()
        al = self._alerts()
        lvl = al[0].get("level") if al else None
        status = ({"i": "alarm-light" if lvl == "alarm" else "bell-alert", "f": C_ALERT if lvl == "alarm" else C_WARM,
                   "t": str(al[0].get("title", "")) if len(al) == 1 else f"{len(al)} Meldungen · {al[0].get('title', '')}"}
                  if al else {"i": "shield-check", "f": C_OK, "t": "Alles in Ordnung"})
        return {"zeile": zeile[:4], "termine": termine,
                "hinweis": {"i": "check-circle-outline", "t": " · ".join(f"{x} fertig" for x in done[:2])} if done else None,
                "status": status}

    def custom_tile(self, t: dict) -> dict:
        """Kachel einer eigenen Seite: wie eine entity:-Kachel, mit eigenem Namen und Symbol."""
        x = self.tile(f"entity:{t['entity']}")
        out = {"i": display_icon(t["icon"], t["entity"], self.hass.states.get(t["entity"])), "f": x["f"],
               "n": t["name"] or x["n"], "v": x["v"], "vf": x["vf"], "s": x["s"]}
        out.update({k: x[k] for k in ("a", "w", "wa") if k in x})
        return out

    def hinweis(self, items: list[dict]) -> dict | None:
        al = self._alerts()
        if al and al[0].get("level") == "alarm":
            return {"i": "alarm-light", "f": C_ALERT, "n": str(al[0].get("title", "")), "s": str(al[0].get("detail", "")), "knopf": "", "ziel": ""}
        hm = self.layout.get("house_mode") or {}
        hour = dt_util.now().hour
        end = int(str(hm.get("night_end", "06:30")).split(":")[0])
        if items and self._mode() not in ("nacht", "abwesend", "urlaub") and (hour >= 20 or hour < end):
            n = len(items)
            return {"i": "weather-night", "f": C_WARM, "n": "Gute Nacht", "s": f"{n} {'Punkt' if n == 1 else 'Punkte'} offen",
                    "knopf": "Prüfen", "ziel": "seite:gute_nacht"}
        if al:
            return {"i": "bell-alert", "f": C_WARM, "n": str(al[0].get("title", "")), "s": str(al[0].get("detail", "")), "knopf": "", "ziel": ""}
        done = self._done_appliances()
        if done:
            return {"i": "check-circle-outline", "f": C_OK, "n": f"{done[0]} fertig", "s": "", "knopf": "OK", "ziel": "geraet_ok"}
        # Sonst eine ruhige Zeile, damit die Startseite wie im Entwurf aussieht (keine leere Fläche unter den Kacheln)
        return {"i": "shield-check", "f": C_OK, "n": "Alles in Ordnung", "s": "Keine offenen Meldungen", "knopf": "", "ziel": ""}

    def energie(self) -> dict:
        F, D = self.energy_now(), self.energy_day()
        if F is None:
            return {}
        net, bat = F["grid"], F["bat"]
        ct = self.price_ct()
        return {
            "pv": kw(F["pv"]), "haus": kw(F["home"]),
            "netz": kw(abs(net)) if net is not None else "", "netz_n": "Bezug" if (net or 0) > 0 else "Einspeisung" if net else "Netz",
            "akku": f"{round(F['soc'])} %" if F["soc"] is not None else (kw(abs(bat)) if bat is not None else ""),
            "akku_n": ("lädt " if (bat or 0) > 0 else "entlädt " if bat else "") + (kw(abs(bat)) if bat else "Akku"),
            "fluss": {"pv": 1 if (F["pv"] or 0) > 20 else 0, "netz": (1 if net > 20 else -1 if net < -20 else 0) if net is not None else 0,
                      "akku": (1 if bat > 20 else -1 if bat < -20 else 0) if bat is not None else 0, "haus": 1},
            "kpi": [["Autarkie heute", pct(D["autark"])], ["Eigenverbrauch", pct(D["own"])],
                    ["Preis jetzt", f"{de(ct, 1)} ct" if ct is not None else "–"]],
        }

    def build(self, d: dict) -> dict[str, Any]:
        items = self.check_items("nacht")
        K = self.climate()
        mode = self._mode()
        gn_rows = [{"g": GN_TITLE[x["kind"]], "i": x["i"], "n": x["n"], "s": " · ".join(p for p in (x["r"], x["z"]) if p),
                    "knopf": x["act"][2] if x["act"] else "", "ziel": f"gn:{x['eid']}"} for x in items[:GN_MAX]]
        n = len(items)
        return {
            "protokoll": PROTOCOL,
            "einstellungen": _dumps({"name": d["name"], "seiten": d["pages"], "hinweis": d["hint"], "hell_tag": d["bright_day"],
                                     "hell_nacht": d["bright_night"], "wecken": d["wake"], "nacht": mode == "nacht",
                                     "schoner": d["saver_min"] if d["saver"] else 0, "schoner_hell": d["saver_bright"]}),
            "kopf": _dumps(self.kopf()),
            "kacheln": _dumps([self.tile(t) for t in d["tiles"]]),
            "hinweis": _dumps(self.locked_note(d["id"]) or (self.hinweis(items) if d["hint"] else None)),
            "energie": _dumps(self.energie()),
            "klima": _dumps([{"n": r["n"], "t": f"{de(r['t'], 1)}°", "h": f"{round(r['h'])} %" if r["h"] is not None else "", "w": r["w"]} for r in K["rooms"][:8]]),
            "gute_nacht": _dumps({"n": n, "txt": "Alles zu." if not n else f"{n} {'Punkt ist' if n == 1 else 'Punkte sind'} noch offen.",
                                  "p": gn_rows, "mehr": max(0, n - GN_MAX)}),
            "schoner": _dumps(self.schoner() if d["saver"] else None),
            "klingel": _dumps(self.klingel() if d["bell"] else None),
            "eigene": _dumps([{"n": pg["name"], "i": pg["icon"], "k": [self.custom_tile(t) for t in pg["tiles"]]} for pg in d["custom"]]),
            "haus": _dumps({"modus": mode, "modi": [[k, nm, ic] for k, nm, ic, _f in MODES],
                            "meldungen": [{"l": a.get("level"), "t": a.get("title", "")} for a in self._alerts()[:4]],
                            "geraete": [f"{x} fertig" for x in self._done_appliances()[:3]]}),
        }

    @callback
    def update(self) -> None:
        if not self.displays:
            if self.payloads:
                self.payloads = {}
                self._notify()
            self._push()
            return
        self._ensure_async()
        self._bell_eid = self.bell_entity()
        self._watched = self._watch()
        new = {}
        for d in self.displays:
            try:
                new[d["id"]] = self.build(d)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Display %s: Inhalte nicht berechenbar", d["id"])
        if new != self.payloads:
            self.payloads = new
            self._notify()
        self._push()

    # ---------- Push an die Geräte (Firmware ab 0.2.0) ----------
    @callback
    def _push(self) -> None:
        """Geänderte Bereiche an die zugeordneten Geräte schicken; abgemeldete Geräte zeigen wieder „nicht zugeordnet“."""
        assigned = {d["device"]: d["id"] for d in self.displays if d.get("device")}
        for dev in [x for x in self._sent if x not in assigned]:
            del self._sent[dev]
            self._send(dev, {"protokoll": ""})
        for dev, did in assigned.items():
            payload = self.payloads.get(did)
            if not payload or not self.hass.services.has_service("esphome", device_service(dev)):
                continue
            sent = self._sent.setdefault(dev, {})
            out = {k: str(v) for k, v in payload.items() if sent.get(k) != str(v)}
            if out:
                sent.update(out)
                self._send(dev, out)

    @callback
    def _send(self, dev: str, items: dict[str, str]) -> None:
        if self.hass.services.has_service("esphome", device_service(dev)):
            self.hass.async_create_background_task(self._async_send(dev, items), f"haus_display_{dev}")

    async def _async_send(self, dev: str, items: dict[str, str]) -> None:
        for k, v in items.items():
            try:
                await self.hass.services.async_call("esphome", device_service(dev), {"bereich": k, "daten": v}, blocking=True)
            except Exception as err:  # noqa: BLE001 – Gerät offline: beim nächsten Verbinden kommt alles neu
                _LOGGER.debug("Display-Gerät %s nicht erreichbar: %s", dev, err)
                self._sent.pop(dev, None)
                return

    def _notify(self) -> None:
        for cb in list(self._listeners):
            cb()

    # ---------- PIN ----------
    def _pin_kind(self, d: dict, ziel: str) -> str | None:
        """Schutzart eines Tipps: Tür öffnen, Alarm aus, Abwesend/Urlaub (pin.py)."""
        if ziel == "klingel:tuer":
            return "door"
        if ziel.startswith("wert:"):
            return self._pin_kind(d, ziel[5:].rsplit(":", 1)[0])
        if ziel.startswith("modus:"):
            return mode_kind(self._mode(), ziel[6:])
        eid = ""
        try:
            if ziel.startswith("kachel:"):
                key = d["tiles"][int(ziel[7:])]
                eid = key[7:] if key.startswith("entity:") else ""
            elif ziel.startswith("eigen:"):
                _p, pi, ki = ziel.split(":")
                eid = d["custom"][int(pi)]["tiles"][int(ki)]["entity"]
        except (ValueError, IndexError, KeyError):
            return None
        if eid.startswith("lock.") and (st := self.hass.states.get(eid)) is not None and st.state == "locked":
            return "door"
        return None

    def locked_note(self, did: str) -> dict | None:
        until, what = self._locked.get(did, (0.0, ""))
        if until <= time.time():
            self._locked.pop(did, None)
            return None
        return {"i": "lock", "f": C_WARM, "n": f"{what}: mit PIN geschützt", "s": "Am Wandpanel oder Handy mit PIN freigeben",
                "knopf": "", "ziel": ""}

    # ---------- Tippen ----------
    async def async_tap(self, call: ServiceCall) -> None:
        did, ziel = str(call.data.get("display", "")), str(call.data.get("ziel", ""))
        # Firmware ab 0.2 meldet ihren Gerätenamen, 0.1 die Kennung
        d = next((x for x in self.displays if x["id"] == did), None) or next((x for x in self.displays if did and x.get("device") == did), None)
        if ziel == "hallo":
            self.hello[did] = time.time()
            if d is not None and d.get("device") == did:
                self._sent.pop(did, None)
                self._push()
            elif d is None and DEVICE_RE.match(did):
                self._send(did, {"protokoll": ""})
            return
        if d is None:
            _LOGGER.warning("Display %s ist nicht eingerichtet", did)
            return
        if (kind := self._pin_kind(d, ziel)) and pin_needs(self.layout.get("pin") or {}, kind, True) and self.monitor.book.pin.get("hash"):
            # Mit PIN geschützt: am Display gibt es (noch) kein Tastenfeld → nicht ausführen, kurz Hinweis zeigen
            self._locked[d["id"]] = (time.time() + LOCKED_NOTE_S, PIN_TXT.get(kind, "Aktion"))
            _LOGGER.info("Display %s: %s ist mit PIN geschützt", did, ziel)
            self.update()
            async_call_later(self.hass, LOCKED_NOTE_S + 0.5, callback(lambda _now: self.update()))
            return
        if ziel.startswith("gn:") or ziel == "gn_alle":
            items = self.check_items("nacht")
            pick = items if ziel == "gn_alle" else [x for x in items if x["eid"] == ziel[3:]]
            for x in pick:
                if x["act"]:
                    domain, service, _lbl = x["act"]
                    try:
                        await self.hass.services.async_call(domain, service, {"entity_id": x["eid"]}, blocking=False)
                    except Exception as err:  # noqa: BLE001 – die übrigen Punkte trotzdem schließen
                        _LOGGER.warning("Display %s: %s nicht ausgeführt: %s", did, x["eid"], err)
        elif ziel.startswith("modus:") and ziel[6:] in MODE_INFO:
            self.monitor.house.set_mode(ziel[6:], f"Display {d['name']}", "display")
        elif ziel.startswith("kachel:"):
            try:
                key = d["tiles"][int(ziel[7:])]
            except (ValueError, IndexError):
                return
            if key.startswith("entity:") and (svc := tap_service(key[7:], self.hass.states.get(key[7:]))):
                try:
                    await self.hass.services.async_call(*svc, {"entity_id": key[7:]}, blocking=False)
                except Exception as err:  # noqa: BLE001 – ein falscher Tipp soll die Integration nicht stören
                    _LOGGER.warning("Display %s: %s nicht geschaltet: %s", did, key[7:], err)
        elif ziel.startswith("eigen:"):
            try:
                _p, pi, ki = ziel.split(":")
                eid = d["custom"][int(pi)]["tiles"][int(ki)]["entity"]
            except (ValueError, IndexError, KeyError):
                return
            if svc := tap_service(eid, self.hass.states.get(eid)):
                try:
                    await self.hass.services.async_call(*svc, {"entity_id": eid}, blocking=False)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Display %s: %s nicht geschaltet: %s", did, eid, err)
        elif ziel.startswith("wert:"):
            # Helligkeit bzw. Rollo-Position vom Regler (langer Druck auf eine Kachel): wert:<kachel:N|eigen:p:k>:<0–100>
            try:
                inner, raw = ziel[5:].rsplit(":", 1)
                v = max(0, min(100, int(raw)))
                if inner.startswith("kachel:"):
                    key = d["tiles"][int(inner[7:])]
                    eid = key[7:] if key.startswith("entity:") else ""
                else:
                    _p, pi, ki = inner.split(":")
                    eid = d["custom"][int(pi)]["tiles"][int(ki)]["entity"]
            except (ValueError, IndexError, KeyError):
                return
            info = stell_info(self.hass.states.get(eid))
            if info is None:
                return
            if info[1] == "hell":
                call = ("light", "turn_on", {"entity_id": eid, "brightness_pct": v}) if v > 0 else ("light", "turn_off", {"entity_id": eid})
            else:
                call = ("cover", "set_cover_position", {"entity_id": eid, "position": v})
            try:
                await self.hass.services.async_call(*call, blocking=False)
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("Display %s: %s nicht gestellt: %s", did, eid, err)
        elif ziel == "klingel:tuer" and self.ring:
            try:
                await self._open_door()
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("Display %s: Tür öffnen fehlgeschlagen: %s", did, err)
                return
            self.ring["offen"] = True
            self._ring_until(BELL_AFTER_DOOR)
            self.update()
            return
        elif ziel == "geraet_ok":
            for r in self.monitor.appliances.snapshot():
                if r.get("state") == "fertig":
                    self.monitor.appliances.ack(r["id"])
        self.schedule(0.5)
