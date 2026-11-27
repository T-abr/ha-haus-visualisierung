"""Zeitleiste „Was war los?“ (Seite Sicherheit): Türen, Klingel, Bewegung, Hausmodus und Alarme der letzten Tage.

Quellen: Türen, Schlösser und Bewegung aus dem Recorder (nur Zustandswechsel, keine Attribute), Klingeln mit
Standbild aus RingBook (klingel.py), Moduswechsel und Alarme aus dem Protokoll des Alarmmanagers (alarms.py).
Bewegung desselben Melders wird zu Abschnitten zusammengefasst (Lücke unter MOTION_GAP), damit ein belebter Flur
nicht hunderte Zeilen erzeugt. Ausgeblendete Bereiche und Entitäten (Einstellungen) fehlen auch hier.
Das Panel fragt beim Öffnen der Seite und beim Wechsel des Zeitraums ab; hier wird nichts dauerhaft berechnet.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

MAX_DAYS = 14
MOTION_GAP = 15 * 60       # Sekunden ohne Bewegung, bis ein neuer Abschnitt beginnt
MAX_EVENTS = 2000
DOOR_CLASSES = ("door", "garage_door")
MOTION_CLASSES = ("motion", "occupancy", "presence")
# Einträge des Alarmprotokolls, die in die Zeitleiste gehören (behoben/stumm/Aktionen bleiben auf der Alarmseite)
ALARM_TYPES = ("neu", "quittiert", "eskaliert", "hinweis")


def _area_of(entry: er.RegistryEntry | None, devs: dr.DeviceRegistry) -> str | None:
    if entry is None:
        return None
    if entry.area_id:
        return entry.area_id
    dev = devs.async_get(entry.device_id) if entry.device_id else None
    return dev.area_id if dev else None


def timeline_entities(hass: HomeAssistant, layout: dict) -> dict[str, dict[str, Any]]:
    """Türen, Schlösser und Bewegungsmelder mit Art, Name und Bereich (ohne ausgeblendete)."""
    ents, devs, areas = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
    hidden_areas = set(layout.get("hidden_areas") or [])
    hidden = set(layout.get("hidden_entities") or [])
    out: dict[str, dict[str, Any]] = {}
    for st in hass.states.async_all(("binary_sensor", "lock")):
        eid = st.entity_id
        if eid in hidden:
            continue
        if st.domain == "lock":
            kind = "schloss"
        else:
            dc = st.attributes.get("device_class")
            kind = "tuer" if dc in DOOR_CLASSES else "bewegung" if dc in MOTION_CLASSES else None
        if kind is None:
            continue
        entry = ents.async_get(eid)
        if entry is not None and (entry.hidden_by or entry.disabled_by):
            continue
        area_id = _area_of(entry, devs)
        if area_id in hidden_areas:
            continue
        area = areas.async_get_area(area_id) if area_id else None
        out[eid] = {"kind": kind, "name": st.name or eid, "area": area.name if area else ""}
    return out


def _ts(st: State) -> float:
    return st.last_changed.timestamp()


def build_events(info: dict[str, dict], hist: dict[str, list[State]], rings: list[dict], log: list[dict],
                 start: float, end: float) -> list[dict]:
    """Ereignisse der Zeitleiste, neueste zuerst. Reine Funktion (Tests ohne Recorder)."""
    ev: list[dict] = []
    for eid, states in hist.items():
        meta = info.get(eid)
        if not meta:
            continue
        states = [s for s in states if s.state not in ("unknown", "unavailable")]
        base = {"eid": eid, "name": meta["name"], "area": meta["area"]}
        if meta["kind"] == "tuer":
            for i, s in enumerate(states):
                if s.state != "on" or _ts(s) < start or (i and states[i - 1].state == "on"):
                    continue
                close = next((t for t in states[i + 1:] if t.state == "off"), None)
                e = {**base, "ts": round(_ts(s), 1), "typ": "tuer", "text": "geöffnet"}
                if close:
                    e["dur"] = round(_ts(close) - _ts(s))
                ev.append(e)
        elif meta["kind"] == "schloss":
            for i, s in enumerate(states):
                if _ts(s) < start or s.state not in ("locked", "unlocked", "open") or (i and states[i - 1].state == s.state):
                    continue
                txt = {"locked": "abgeschlossen", "unlocked": "aufgeschlossen", "open": "geöffnet"}[s.state]
                ev.append({**base, "ts": round(_ts(s), 1), "typ": "tuer", "text": txt, "lock": True})
        else:
            cur: dict | None = None
            for i, s in enumerate(states):
                if s.state != "on" or (i and states[i - 1].state == "on"):
                    continue
                t = _ts(s)
                if t < start:
                    continue
                if cur and t - cur["bis"] < MOTION_GAP:
                    cur["n"] += 1
                    cur["bis"] = round(t, 1)
                    continue
                cur = {**base, "ts": round(t, 1), "typ": "bewegung", "n": 1, "bis": round(t, 1)}
                ev.append(cur)
    for r in rings:
        if start <= r["ts"] <= end:
            e = {"ts": r["ts"], "typ": "klingel", "text": "Es hat geklingelt"}
            if r.get("bild"):
                e["bild"] = r["bild"]
            if r.get("cam"):
                e["cam"] = r["cam"]
            ev.append(e)
    for x in log:
        ts, typ = x.get("ts", 0), x.get("type")
        if not start <= ts <= end:
            continue
        if typ == "modus":
            ev.append({"ts": ts, "typ": "modus", "text": x.get("title", ""), "mode": x.get("mode"), "user": x.get("user")})
        elif typ in ALARM_TYPES:
            e = {"ts": ts, "typ": "alarm", "art": typ, "text": x.get("title", ""), "level": x.get("level", "warn")}
            if x.get("user"):
                e["user"] = x["user"]
            ev.append(e)
    ev.sort(key=lambda e: -e["ts"])
    return ev[:MAX_EVENTS]


async def async_fetch(hass: HomeAssistant, entity_ids: list[str], start: datetime, end: datetime) -> dict[str, list[State]] | None:
    """Zustandswechsel aus dem Recorder; None ohne Recorder."""
    if "recorder" not in hass.config.components:
        return None
    if not entity_ids:
        return {}
    from homeassistant.components.recorder import get_instance, history

    def _query() -> dict[str, list[State]]:
        return history.get_significant_states(
            hass, start, end, entity_ids,
            include_start_time_state=True, significant_changes_only=False, no_attributes=True,
        )

    return await get_instance(hass).async_add_executor_job(_query)


async def async_timeline(hass: HomeAssistant, layout: dict, rings: list[dict], log: list[dict], days: int) -> dict:
    """Ergebnis für den Websocket-Befehl haus_visualisierung/zeitleiste."""
    days = max(1, min(days, MAX_DAYS))
    now = dt_util.now()
    start_dt = dt_util.start_of_local_day(now - timedelta(days=days - 1))
    start, end = start_dt.timestamp(), time.time()
    info = timeline_entities(hass, layout)
    try:
        hist = await async_fetch(hass, list(info), start_dt, now)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Zeitleiste: Verlauf nicht lesbar: %s", err)
        hist = None
    # Klingel und Protokoll speichern ts auf 0,1 s gerundet, also bis zu 50 ms in der Zukunft:
    # ein gerade erst erfasstes Ereignis fiele sonst heraus.
    events = build_events(info, hist or {}, rings, log, start, end + 0.1)
    return {"from": start, "to": end, "days": days, "recorder": hist is not None, "events": events}
