"""Speicher für die Layout-Einstellungen (.storage/haus_visualisierung)."""

from __future__ import annotations

import copy
import re
from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    ACTION_TYPES,
    ACTION_WHEN,
    ARM_ACTIONS,
    DEFAULT_LAYOUT,
    HOUSE_MODES,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LIST_OF_STR = (
    "area_order",
    "hidden_areas",
    "floor_order",
    "outdoor_floors",
    "favorites",
    "hidden_entities",
    "hide_labels",
)


def _str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if isinstance(v, str) and v][:500]


_OPS = ("on", "off", "eq", "ne", "gt", "lt", "unavailable")
_LEVELS = ("info", "warn", "alarm")


def _int(val: Any, lo: int, hi: int, default: int) -> int:
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return int(min(max(val, lo), hi))
    return default


def _alerts(raw: dict) -> dict:
    """Warnungen prüfen: feste Regeln (an/aus) und eigene Regeln."""
    out = copy.deepcopy(DEFAULT_LAYOUT["alerts"])
    if isinstance(raw.get("builtin"), dict):
        for key in out["builtin"]:
            if isinstance(raw["builtin"].get(key), bool):
                out["builtin"][key] = raw["builtin"][key]
    out["contacts_min"] = _int(raw.get("contacts_min"), 0, 240, 0)
    out["mold_hum"] = _int(raw.get("mold_hum"), 50, 90, 65)
    out["mold_min"] = _int(raw.get("mold_min"), 0, 240, 30)
    if isinstance(raw.get("modes"), dict):
        out["modes"] = {k: _modes(v) for k, v in raw["modes"].items() if k in out["builtin"] and isinstance(v, list)}
    rules = []
    for rule in raw.get("rules", [])[:30] if isinstance(raw.get("rules"), list) else []:
        if not isinstance(rule, dict):
            continue
        rules.append(
            {
                "title": str(rule.get("title", ""))[:60],
                "entity": str(rule.get("entity", ""))[:120],
                "op": rule.get("op") if rule.get("op") in _OPS else "on",
                "value": str(rule.get("value", ""))[:40],
                "minutes": _int(rule.get("minutes"), 0, 1440, 0),
                "level": rule.get("level") if rule.get("level") in _LEVELS else "warn",
                "enabled": rule.get("enabled", True) is not False,
                "modes": _modes(rule.get("modes")),
            }
        )
    out["rules"] = rules
    return out


def _modes(raw) -> list[str]:
    return [m for m in HOUSE_MODES if isinstance(raw, list) and m in raw]


def _time(raw, default: str) -> str:
    try:
        hh, mm = str(raw).split(":")[:2]
        h, m = int(hh), int(mm)
        if 0 <= h < 24 and 0 <= m < 60:
            return f"{h:02d}:{m:02d}"
    except (ValueError, AttributeError):
        pass
    return default


def _house_mode(raw: dict) -> dict:
    out = copy.deepcopy(DEFAULT_LAYOUT["house_mode"])
    for key in ("enabled", "auto_away", "auto_night", "alarmo_sync", "check"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    if "check_devices" in raw:
        out["check_devices"] = [e for e in _str_list(raw["check_devices"]) if "." in e][:30]
    out["away_delay"] = _int(raw.get("away_delay"), 0, 240, out["away_delay"])
    out["night_start"] = _time(raw.get("night_start"), out["night_start"])
    out["night_end"] = _time(raw.get("night_end"), out["night_end"])
    al = str(raw.get("alarmo", ""))[:120]
    out["alarmo"] = al if al == "" or al.startswith("alarm_control_panel.") else ""
    if isinstance(raw.get("arm"), dict):
        for m in HOUSE_MODES:
            if raw["arm"].get(m) in ARM_ACTIONS:
                out["arm"][m] = raw["arm"][m]
    return out


_LEVEL_LIST = ("alarm", "warn", "info")
_GA = re.compile(r"^\d{1,2}/\d{1,2}/\d{1,3}$|^\d{1,2}/\d{1,4}$|^\d{1,5}$")


_SIM_DOMAINS = ("light.", "cover.", "switch.", "input_boolean.")


def _presence_sim(raw: dict) -> dict:
    """Anwesenheits-Simulation: Schalter, Modi, Geräte, Zeitraum und Zufallsversatz."""
    out = copy.deepcopy(DEFAULT_LAYOUT["presence_sim"])
    if isinstance(raw.get("enabled"), bool):
        out["enabled"] = raw["enabled"]
    if isinstance(raw.get("modes"), list):
        out["modes"] = _modes(raw["modes"]) or out["modes"]
    sw = _entity(raw.get("switch"))
    out["switch"] = sw if sw.startswith(("input_boolean.", "switch.")) else ""
    ents = [_entity(e) for e in raw.get("entities", [])] if isinstance(raw.get("entities"), list) else []
    out["entities"] = list(dict.fromkeys(e for e in ents if e.startswith(_SIM_DOMAINS)))[:60]
    out["weeks"] = _int(raw.get("weeks"), 1, 4, out["weeks"])
    out["jitter"] = _int(raw.get("jitter"), 0, 60, out["jitter"])
    return out


def _escalation(raw: dict) -> dict:
    out = copy.deepcopy(DEFAULT_LAYOUT["escalation"])
    for key in ("enabled", "push_critical"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    out["minutes"] = _int(raw.get("minutes"), 1, 240, out["minutes"])
    if isinstance(raw.get("levels"), list):
        out["levels"] = [lv for lv in _LEVEL_LIST if lv in raw["levels"]]
    return out


def _actions(raw: list) -> list[dict]:
    out = []
    for i, a in enumerate(raw[:20]):
        if not isinstance(a, dict) or a.get("type") not in ACTION_TYPES:
            continue
        scope = str(a.get("scope", "alarm"))
        if scope not in ("alarm", "warn", "all") and not re.match(r"^(b:[a-z_]+|r:\d{1,2})$", scope):
            scope = "alarm"
        ga = str(a.get("address", "")).strip()[:20]
        out.append({
            "id": str(a.get("id") or f"a{i}")[:16],
            "name": str(a.get("name", ""))[:40],
            "type": a["type"],
            "enabled": a.get("enabled", True) is not False,
            "when": a.get("when") if a.get("when") in ACTION_WHEN else "neu",
            "scope": scope,
            "modes": _modes(a.get("modes")),
            "entity": str(a.get("entity", ""))[:120],
            "address": ga if _GA.match(ga) else "",
            "payload": _int(a.get("payload"), 0, 255, 1),
            "reset_payload": _int(a.get("reset_payload"), 0, 255, 0),
            "reset": a.get("reset", True) is not False,
            "tts": str(a.get("tts", ""))[:120],
            "message": str(a.get("message", "{titel}"))[:200],
            "volume": _int(a.get("volume"), 0, 100, 40),
        })
    return out


def _push(raw: dict) -> dict:
    out = copy.deepcopy(DEFAULT_LAYOUT["push"])
    for key in ("enabled", "critical", "persistent"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    if isinstance(raw.get("levels"), dict):
        for lvl in out["levels"]:
            if isinstance(raw["levels"].get(lvl), bool):
                out["levels"][lvl] = raw["levels"][lvl]
    out["targets"] = [t.removeprefix("notify.") for t in _str_list(raw.get("targets"))][:20]
    if raw.get("resolved") in ("clear", "notify", "none"):
        out["resolved"] = raw["resolved"]
    out["cooldown"] = _int(raw.get("cooldown"), 0, 1440, out["cooldown"])
    return out


_ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_MANUAL = {"slope": (0.1, 3.0), "level": (-15.0, 15.0), "room": (15.0, 28.0), "min": (15.0, 45.0), "max": (25.0, 70.0), "limit": (5.0, 25.0)}


def _entity(val: Any) -> str:
    v = str(val).strip()[:120] if isinstance(val, str) else ""
    return v if _ENTITY.match(v) else ""


def _num(val: Any, lo: float, hi: float, default: float) -> float:
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return round(float(min(max(val, lo), hi)), 2)
    return default


def _heating(raw: dict) -> dict:
    """Technik: Heizung – Entitäten, Speicher-Grenzen, eigene Heizkurve."""
    out = copy.deepcopy(DEFAULT_LAYOUT["heating"])
    for key in ("enabled", "manual_curve"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    out["area"] = str(raw.get("area", ""))[:60] if isinstance(raw.get("area"), str) else ""
    for key in ("stove", "stove_pump", "curve", "mixer", "flow", "outdoor"):
        out[key] = _entity(raw.get(key))
    out["tank"] = [e for e in (_entity(x) for x in raw.get("tank", []) if isinstance(raw.get("tank"), list)) if e][:8]
    out["tank_min"] = _int(raw.get("tank_min"), 0, 90, out["tank_min"])
    out["tank_max"] = _int(raw.get("tank_max"), 10, 99, out["tank_max"])
    if out["tank_max"] <= out["tank_min"]:
        out["tank_max"] = min(99, out["tank_min"] + 10)
    out["stove_hot"] = _int(raw.get("stove_hot"), 20, 120, out["stove_hot"])
    man = raw.get("manual") if isinstance(raw.get("manual"), dict) else {}
    out["manual"] = {k: _num(man.get(k), lo, hi, out["manual"][k]) for k, (lo, hi) in _MANUAL.items()}
    if out["manual"]["max"] <= out["manual"]["min"]:
        out["manual"]["max"] = min(70.0, out["manual"]["min"] + 5)
    return out


def _wallbox(raw: dict) -> dict:
    out = copy.deepcopy(DEFAULT_LAYOUT["wallbox"])
    if isinstance(raw.get("enabled"), bool):
        out["enabled"] = raw["enabled"]
    out["area"] = str(raw.get("area", ""))[:60] if isinstance(raw.get("area"), str) else ""
    for key in ("power", "mode", "soc", "limit", "energy", "connected", "charging", "range"):
        out[key] = _entity(raw.get(key))
    return out


def _energy(raw: dict) -> dict:
    """Seite „Energie“: Schalter, Speicher-Leistung (Sensor) und Vorzeichen."""
    out = copy.deepcopy(DEFAULT_LAYOUT["energy"])
    for key in ("enabled", "grid_invert", "battery_invert"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    bp = _entity(raw.get("battery_power"))
    out["battery_power"] = bp if bp.startswith("sensor.") else ""
    return out


_FACES = ("N", "NO", "O", "SO", "S", "SW", "W", "NW", "-")


def _shading(raw: dict) -> dict:
    """Beschattung: Schalter, Grenze für heiße Tage und Ausrichtung je Rollo."""
    out = copy.deepcopy(DEFAULT_LAYOUT["shading"])
    if isinstance(raw.get("enabled"), bool):
        out["enabled"] = raw["enabled"]
    out["hot"] = _int(raw.get("hot"), 18, 40, out["hot"])
    facing = raw.get("facing") if isinstance(raw.get("facing"), dict) else {}
    for eid, face in list(facing.items())[:300]:
        e = _entity(eid)
        if e.startswith("cover.") and face in _FACES:
            out["facing"][e] = face
    return out


def _forecast(raw: dict) -> dict:
    """Karte „Vorhersage“: Schalter und Sensoren der Solarprognose (Energie)."""
    out = copy.deepcopy(DEFAULT_LAYOUT["forecast"])
    for key in ("enabled", "solar"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    for key in ("solar_today", "solar_tomorrow"):
        e = _entity(raw.get(key))
        out[key] = e if e.startswith("sensor.") else ""
    return out


def _price(raw: dict) -> dict:
    """Strompreis: Sensor, Schalter und Preise in ct/kWh."""
    out = copy.deepcopy(DEFAULT_LAYOUT["price"])
    sensor = _entity(raw.get("sensor"))
    out["sensor"] = sensor if sensor.startswith("sensor.") else ""
    if isinstance(raw.get("use_sensor"), bool):
        out["use_sensor"] = raw["use_sensor"]
    out["fixed_ct"] = _num(raw.get("fixed_ct"), 0, 200, out["fixed_ct"])
    out["feed_in_ct"] = _num(raw.get("feed_in_ct"), 0, 100, out["feed_in_ct"])
    out["surcharge_ct"] = _num(raw.get("surcharge_ct"), -50, 100, out["surcharge_ct"])
    out["window_h"] = _int(raw.get("window_h"), 1, 12, out["window_h"])
    return out


def _wallpanel(raw: dict) -> dict:
    """Wandpanel: Zeiten in Minuten (0 = nie), Schalter, Wetter und Bewegungsmelder."""
    out = copy.deepcopy(DEFAULT_LAYOUT["wallpanel"])
    out["saver_min"] = _int(raw.get("saver_min"), 0, 240, out["saver_min"])
    out["black_min"] = _int(raw.get("black_min"), 0, 600, out["black_min"])
    out["return_min"] = _int(raw.get("return_min"), 0, 240, out["return_min"])
    for key in ("fullscreen", "hide_sidebar", "wake_alarm", "night_dim", "wander"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    w = _entity(raw.get("weather"))
    out["weather"] = w if w.startswith("weather.") else ""
    out["wake_entity"] = _entity(raw.get("wake_entity"))
    return out


def _link_mode(link: dict) -> str:
    """theme = Original mit Haus-Farben, embed = Original-Farben, open = eigene Seite."""
    mode = link.get("mode")
    if mode == "haus":  # 0.10.0
        return "theme"
    if mode in ("theme", "embed", "open"):
        return mode
    return "open" if link.get("embed", True) is False else "theme"


def sanitize(raw: Any) -> dict:
    """Unbekannte Schlüssel verwerfen, Typen prüfen, Standardwerte ergänzen."""
    result = copy.deepcopy(DEFAULT_LAYOUT)
    if not isinstance(raw, dict):
        return result

    for key in _LIST_OF_STR:
        if key in raw:
            result[key] = _str_list(raw[key])

    if isinstance(raw.get("pins"), dict):
        result["pins"] = {
            str(area): _str_list(ents)
            for area, ents in raw["pins"].items()
            if isinstance(area, str)
        }

    if isinstance(raw.get("header"), dict):
        for key in result["header"]:
            val = raw["header"].get(key, "")
            result["header"][key] = val if isinstance(val, str) else ""

    if isinstance(raw.get("links"), list):
        links = []
        for link in raw["links"][:12]:
            if not isinstance(link, dict) or not isinstance(link.get("path"), str):
                continue
            links.append(
                {
                    "title": str(link.get("title", ""))[:40],
                    "icon": str(link.get("icon", "mdi:link")) or "mdi:link",
                    "path": link["path"][:200],
                    "embed": _link_mode(link) != "open",
                    "mode": _link_mode(link),
                }
            )
        result["links"] = links

    for key in ("show_energy_sensors", "show_other", "show_trends", "glass"):
        if isinstance(raw.get(key), bool):
            result[key] = raw[key]

    interval = raw.get("camera_interval")
    if isinstance(interval, (int, float)) and not isinstance(interval, bool):
        result["camera_interval"] = int(min(max(interval, 3), 120))

    for key in ("battery_critical", "battery_low"):
        val = raw.get(key)
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            result[key] = int(min(max(val, 1), 99))
    if result["battery_low"] < result["battery_critical"]:
        result["battery_low"] = result["battery_critical"]

    if isinstance(raw.get("alerts"), dict):
        result["alerts"] = _alerts(raw["alerts"])

    if isinstance(raw.get("push"), dict):
        result["push"] = _push(raw["push"])
    if isinstance(raw.get("escalation"), dict):
        result["escalation"] = _escalation(raw["escalation"])
    if isinstance(raw.get("alarm_actions"), list):
        result["alarm_actions"] = _actions(raw["alarm_actions"])
    if isinstance(raw.get("house_mode"), dict):
        result["house_mode"] = _house_mode(raw["house_mode"])
    if isinstance(raw.get("presence_sim"), dict):
        result["presence_sim"] = _presence_sim(raw["presence_sim"])
    if isinstance(raw.get("doorbell"), dict):
        db = raw["doorbell"]
        out = copy.deepcopy(DEFAULT_LAYOUT["doorbell"])
        if isinstance(db.get("enabled"), bool):
            out["enabled"] = db["enabled"]
        for key in ("entity", "camera", "lock"):
            if isinstance(db.get(key), str):
                out[key] = db[key].strip()[:120]
        out["timeout"] = _int(db.get("timeout"), 10, 600, out["timeout"])
        out["pulse"] = _int(db.get("pulse"), 0, 30, out["pulse"])
        result["doorbell"] = out
    if isinstance(raw.get("heating"), dict):
        result["heating"] = _heating(raw["heating"])
    if isinstance(raw.get("wallpanel"), dict):
        result["wallpanel"] = _wallpanel(raw["wallpanel"])
    if isinstance(raw.get("wallbox"), dict):
        result["wallbox"] = _wallbox(raw["wallbox"])
    if isinstance(raw.get("shading"), dict):
        result["shading"] = _shading(raw["shading"])
    if isinstance(raw.get("energy"), dict):
        result["energy"] = _energy(raw["energy"])
    if isinstance(raw.get("forecast"), dict):
        result["forecast"] = _forecast(raw["forecast"])
    if isinstance(raw.get("price"), dict):
        result["price"] = _price(raw["price"])
    if isinstance(raw.get("confirm_quick"), bool):
        result["confirm_quick"] = raw["confirm_quick"]

    if raw.get("header_style") in ("chips", "kompakt", "satz", "leiste"):
        result["header_style"] = raw["header_style"]
    if raw.get("overview_style") in ("auto", "haus", "cockpit", "spalten", "fokus"):
        result["overview_style"] = raw["overview_style"]
    if raw.get("density") in ("kompakt", "komfort"):
        result["density"] = raw["density"]

    if isinstance(raw.get("start_view"), str):
        result["start_view"] = raw["start_view"][:60]

    return result


class LayoutStore:
    """Hält die Layout-Einstellungen und benachrichtigt offene Panels."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict = copy.deepcopy(DEFAULT_LAYOUT)
        self._listeners: set[Callable[[dict], None]] = set()

    async def async_load(self) -> None:
        self._data = sanitize(await self._store.async_load())

    @property
    def data(self) -> dict:
        return self._data

    async def async_save(self, raw: Any) -> dict:
        self._data = sanitize(raw)
        await self._store.async_save(self._data)
        for listener in list(self._listeners):
            listener(self._data)
        return self._data

    @callback
    def async_add_listener(self, listener: Callable[[dict], None]) -> Callable[[], None]:
        self._listeners.add(listener)

        @callback
        def _remove() -> None:
            self._listeners.discard(listener)

        return _remove
