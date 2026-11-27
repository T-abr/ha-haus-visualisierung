"""Sicherungen der Einstellungen (.storage/haus_visualisierung.sicherungen).

Gesichert werden das Layout (alles aus Einstellungen) und der Stand des Wartungsplaners. Nicht dabei:
der Code der Alarmanlage und die PIN (bleiben in Home Assistant) sowie Protokolle.

Automatisch entsteht eine Sicherung
- beim ersten Start einer neuen Version (Stand vor dem Update),
- vor dem ersten Speichern eines Tages (Stand vor den Änderungen),
- vor jedem Wiederherstellen (damit es sich rückgängig machen lässt).
Dazu kommen Sicherungen von Hand. Behalten werden die jüngsten ``KEEP``.
"""

from __future__ import annotations

import copy
import time
from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DEFAULT_LAYOUT, DOMAIN, VERSION

STORAGE_KEY = f"{DOMAIN}.sicherungen"
STORAGE_VERSION = 1
KEEP = 12
DAILY_S = 20 * 3600
FORMAT = "haus_visualisierung"
SCHEMA = 1
REASONS = {"update": "vor dem Update", "taeglich": "automatisch", "wiederherstellen": "vor dem Wiederherstellen",
           "manuell": "von Hand", "import": "vor dem Import"}


def summary(layout: dict) -> dict:
    """Kurzbeschreibung für die Liste: was steckt drin."""
    lay = layout if isinstance(layout, dict) else {}

    def n(key: str, sub: str | None = None) -> int:
        v = lay.get(key)
        if sub and isinstance(v, dict):
            v = v.get(sub)
        return len(v) if isinstance(v, (list, dict)) else 0

    return {
        "raeume": n("area_order"), "pins": sum(len(v) for v in (lay.get("pins") or {}).values() if isinstance(v, list)),
        "regeln": n("alerts", "rules"), "aktionen": n("alarm_actions"), "displays": n("displays"),
        "wartung": n("maintenance", "tasks"), "geraete": n("appliances", "items"),
    }


def is_default(layout: dict) -> bool:
    return not isinstance(layout, dict) or layout == DEFAULT_LAYOUT


def export_doc(layout: dict, maintenance: dict, created: float | None = None, version: str = VERSION) -> dict:
    """Datei zum Herunterladen bzw. Inhalt einer Sicherung."""
    ts = created or time.time()
    return {
        "format": FORMAT, "schema": SCHEMA, "version": version,
        "created": dt_util.as_local(dt_util.utc_from_timestamp(ts)).isoformat(timespec="seconds"),
        "layout": copy.deepcopy(layout), "maintenance": copy.deepcopy(maintenance or {}),
    }


def parse_doc(raw: Any) -> tuple[dict, dict | None] | None:
    """Datei aus dem Import prüfen. Liefert (Layout, Wartung) oder None. Ein nacktes Layout geht auch."""
    if not isinstance(raw, dict):
        return None
    if raw.get("format") == FORMAT and isinstance(raw.get("layout"), dict):
        maint = raw.get("maintenance") if isinstance(raw.get("maintenance"), dict) else None
        return raw["layout"], maint
    if "format" not in raw and any(k in raw for k in ("area_order", "alerts", "house_mode", "displays")):
        return raw, None
    return None


def clean_maintenance(raw: dict) -> dict:
    """Wartungsstand aus einer Datei: nur {id: {last, by, history: [{date, by}]}}."""
    out: dict[str, dict] = {}
    for k, v in list(raw.items())[:100] if isinstance(raw, dict) else []:
        if not isinstance(k, str) or not isinstance(v, dict):
            continue
        hist = [{"date": str(h.get("date"))[:10], "by": (str(h["by"])[:60] if h.get("by") else None)}
                for h in (v.get("history") or [])[-20:] if isinstance(h, dict) and h.get("date")]
        if not hist:
            continue
        hist.sort(key=lambda h: h["date"])
        out[k[:24]] = {"history": hist, "last": hist[-1]["date"], "by": hist[-1]["by"]}
    return out


class BackupBook:
    """Hält die Sicherungen und legt automatisch neue an."""

    def __init__(self, hass: HomeAssistant, store, maintenance) -> None:
        self.hass = hass
        self.layout_store = store
        self.maintenance = maintenance
        self._store: Store[dict] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.items: list[dict] = []
        self.last_version = ""
        self._listeners: set[Callable[[], None]] = set()

    async def async_load(self) -> None:
        raw = await self._store.async_load() or {}
        self.items = [i for i in (raw.get("items") or []) if isinstance(i, dict) and isinstance(i.get("layout"), dict)]
        self.last_version = str(raw.get("version") or "")
        # Neue Version: Stand vor dem Update sichern (nicht bei einer frischen Installation)
        if self.last_version != VERSION:
            if not is_default(self.layout_store.data):
                self.create("update", note=f"von {self.last_version}" if self.last_version else "")
            self.last_version = VERSION
            self._save()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"version": self.last_version, "items": self.items}, 1)

    @callback
    def async_add_listener(self, cb: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(cb)

        @callback
        def _remove() -> None:
            self._listeners.discard(cb)

        return _remove

    def _changed(self) -> None:
        self._save()
        for cb in list(self._listeners):
            cb()

    @callback
    def create(self, reason: str, note: str = "") -> dict:
        now = time.time()
        item = {
            "id": f"s{int(now * 1000):x}",
            "ts": round(now, 1),
            "reason": reason if reason in REASONS else "manuell",
            "note": str(note)[:60],
            "version": VERSION,
            "layout": copy.deepcopy(self.layout_store.data),
            "maintenance": self.maintenance.snapshot() if self.maintenance else {},
        }
        while any(i["id"] == item["id"] for i in self.items):
            item["id"] += "x"
        self.items.append(item)
        self.items = self.items[-KEEP:]
        self._changed()
        return item

    @callback
    def before_save(self) -> None:
        """Vor dem ersten Speichern eines Tages den bisherigen Stand sichern."""
        if is_default(self.layout_store.data):
            return
        last = max((i["ts"] for i in self.items), default=0)
        if time.time() - last >= DAILY_S:
            self.create("taeglich")

    def get(self, sid: str) -> dict | None:
        return next((i for i in self.items if i["id"] == sid), None)

    @callback
    def delete(self, sid: str) -> bool:
        n = len(self.items)
        self.items = [i for i in self.items if i["id"] != sid]
        if len(self.items) != n:
            self._changed()
            return True
        return False

    def listing(self) -> list[dict]:
        return [{"id": i["id"], "ts": i["ts"], "reason": i["reason"], "note": i.get("note", ""), "version": i.get("version", ""),
                 "summary": summary(i["layout"])} for i in reversed(self.items)]

    def doc(self, item: dict) -> dict:
        return export_doc(item["layout"], item.get("maintenance") or {}, item["ts"], item.get("version") or VERSION)

    async def async_restore(self, layout: dict, maintenance: dict | None, reason: str = "wiederherstellen") -> dict:
        """Stand übernehmen: vorher den aktuellen sichern, dann Layout speichern und Wartungsstand setzen."""
        self.create(reason)
        if isinstance(layout, dict) and "setup" not in layout:
            layout = {**layout, "setup": {"done": True}}  # Sicherung von vor dem Einrichtungsassistenten
        saved = await self.layout_store.async_save(layout)
        if maintenance is not None and self.maintenance is not None:
            self.maintenance.replace(clean_maintenance(maintenance))
        return saved
