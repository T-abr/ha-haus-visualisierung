"""Szenen je Raum: im Panel angelegte Stimmungen (Lichter mit Helligkeit/Farbe, Rollos mit Position, Schalter).

Gespeichert unter ``scenes`` im Layout als ``{id: {name, icon, area, ents: {entity_id: Zustand}}}``; die Plattform
``scene.py`` macht daraus je Szene eine Entität ``scene.haus_<id>``. Zustand je Entität:
- ``light``: ``on`` (bool), ``bri`` (1–100 %), ``color`` (``#rrggbb``) oder ``ct`` (Kelvin) – fehlt = unverändert
- ``cover``: ``pos`` (0 = zu … 100 = auf)
- ``switch``/``fan``/``input_boolean``: ``on`` (bool)
"""

from __future__ import annotations

import logging
import re
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

SCENE_DOMAINS = ("light", "cover", "switch", "fan", "input_boolean")
MAX_SCENES = 60
MAX_ENTS = 40
_ID_RE = re.compile(r"^[a-z0-9_]{1,40}$")
_COLOR_RE = re.compile(r"^#[0-9a-f]{6}$")
_ICON_RE = re.compile(r"^mdi:[a-z0-9-]{1,60}$")
# Rollo kann Position anfahren (CoverEntityFeature.SET_POSITION)
_COVER_SET_POSITION = 4


def _int(val: Any, lo: int, hi: int) -> int | None:
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        return None
    return int(min(max(round(val), lo), hi))


def _ent_state(eid: str, raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    d = eid.split(".", 1)[0]
    if d == "cover":
        pos = _int(raw.get("pos"), 0, 100)
        return {"pos": pos} if pos is not None else None
    if not isinstance(raw.get("on"), bool):
        return None
    out: dict = {"on": raw["on"]}
    if d == "light" and raw["on"]:
        bri = _int(raw.get("bri"), 1, 100)
        if bri is not None:
            out["bri"] = bri
        color = raw.get("color")
        if isinstance(color, str) and _COLOR_RE.match(color.lower()):
            out["color"] = color.lower()
        else:
            ct = _int(raw.get("ct"), 1500, 9000)
            if ct is not None:
                out["ct"] = ct
    return out


def sanitize_scenes(raw: Any) -> dict:
    """Unbekanntes verwerfen; Szenen ohne Namen oder ohne gültige Entität fallen heraus."""
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    for sid, sc in list(raw.items())[:MAX_SCENES]:
        if not isinstance(sid, str) or not _ID_RE.match(sid) or not isinstance(sc, dict):
            continue
        name = sc.get("name").strip()[:40] if isinstance(sc.get("name"), str) else ""
        ents_raw = sc.get("ents") if isinstance(sc.get("ents"), dict) else {}
        ents: dict = {}
        for eid, st in list(ents_raw.items())[: MAX_ENTS * 2]:
            if not isinstance(eid, str) or "." not in eid or eid.split(".", 1)[0] not in SCENE_DOMAINS or len(eid) > 120:
                continue
            val = _ent_state(eid, st)
            if val is not None and len(ents) < MAX_ENTS:
                ents[eid] = val
        if not name or not ents:
            continue
        ic = sc.get("icon") if isinstance(sc.get("icon"), str) and _ICON_RE.match(sc["icon"]) else "mdi:palette"
        area = sc.get("area")[:80] if isinstance(sc.get("area"), str) else ""
        out[sid] = {"name": name, "icon": ic, "area": area, "ents": ents}
    return out


def _hex_rgb(color: str) -> list[int]:
    return [int(color[i : i + 2], 16) for i in (1, 3, 5)]


def scene_calls(hass: HomeAssistant, ents: dict) -> list[tuple[str, str, dict]]:
    """Dienstaufrufe (Domäne, Dienst, Daten) für eine Szene; nicht vorhandene Entitäten werden übersprungen."""
    calls: list[tuple[str, str, dict]] = []
    for eid, st in ents.items():
        state = hass.states.get(eid)
        if state is None:
            continue
        d = eid.split(".", 1)[0]
        if d == "cover":
            pos = st["pos"]
            if int(state.attributes.get("supported_features") or 0) & _COVER_SET_POSITION:
                calls.append(("cover", "set_cover_position", {"entity_id": eid, "position": pos}))
            else:
                calls.append(("cover", "open_cover" if pos >= 50 else "close_cover", {"entity_id": eid}))
        elif d == "light":
            if not st["on"]:
                calls.append(("light", "turn_off", {"entity_id": eid}))
                continue
            data: dict = {"entity_id": eid}
            if "bri" in st:
                data["brightness_pct"] = st["bri"]
            if "color" in st:
                data["rgb_color"] = _hex_rgb(st["color"])
            elif "ct" in st:
                data["color_temp_kelvin"] = st["ct"]
            calls.append(("light", "turn_on", data))
        else:
            calls.append((d, "turn_on" if st["on"] else "turn_off", {"entity_id": eid}))
    return calls


async def async_apply(hass: HomeAssistant, ents: dict) -> int:
    """Szene schalten; liefert die Zahl der Aufrufe. Fehler einzelner Geräte halten die übrigen nicht auf."""
    calls = scene_calls(hass, ents)
    for domain, service, data in calls:
        try:
            await hass.services.async_call(domain, service, data, blocking=False)
        except (HomeAssistantError, vol.Invalid) as err:
            _LOGGER.warning("Szene: %s.%s für %s fehlgeschlagen: %s", domain, service, data.get("entity_id"), err)
    return len(calls)
