"""Wartungsplaner: wiederkehrende Aufgaben (Filter, Rauchmelder, Kaminkehrer …) und wann sie erledigt wurden.

Die Aufgaben selbst (Titel, Intervall, Startdatum) stehen im Layout und werden in den Einstellungen gepflegt.
Wann eine Aufgabe zuletzt erledigt wurde, liegt getrennt davon in `.storage/haus_visualisierung.wartung`:
„Erledigt“ darf jeder Benutzer drücken, und ein offener Entwurf in den Einstellungen überschreibt es nicht.
"""

from __future__ import annotations

import calendar
import copy
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}.wartung"
STORAGE_VERSION = 1
UNITS = ("tage", "wochen", "monate", "jahre")
HISTORY = 10  # so viele Erledigt-Einträge je Aufgabe aufheben


def parse_date(raw: Any) -> date | None:
    try:
        return date.fromisoformat(str(raw)[:10]) if raw else None
    except ValueError:
        return None


def add_interval(d: date, n: int, unit: str) -> date:
    """Datum plus Intervall; Monate und Jahre bleiben am selben Tag (31. → Monatsende)."""
    if unit == "tage":
        return d + timedelta(days=n)
    if unit == "wochen":
        return d + timedelta(weeks=n)
    months = d.month - 1 + n * (12 if unit == "jahre" else 1)
    y, m = d.year + months // 12, months % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def last_done(task: dict, state: dict) -> date | None:
    """Zuletzt erledigt: das spätere von „Erledigt“ und dem Datum aus den Einstellungen."""
    dates = [d for d in (parse_date((state.get(task.get("id")) or {}).get("last")), parse_date(task.get("since"))) if d]
    return max(dates) if dates else None


def due_info(task: dict, state: dict, today: date) -> tuple[date | None, int | None]:
    """(fällig am, Tage bis dahin). Noch nie erledigt und ohne Startdatum: (None, None) – gilt als fällig."""
    last = last_done(task, state)
    if last is None:
        return None, None
    due = add_interval(last, int(task.get("interval") or 1), task.get("unit") or "monate")
    return due, (due - today).days


def due_text(days: int | None) -> str:
    if days is None:
        return "noch nie erledigt"
    if days == 0:
        return "heute fällig"
    n = -days
    return f"seit {n} {'Tag' if n == 1 else 'Tagen'} fällig"


class MaintenanceBook:
    """Hält {Aufgaben-ID: {last, by, history}} und benachrichtigt Panels und Alarmmanager."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, dict] = {}
        self._listeners: set[Callable[[dict], None]] = set()

    async def async_load(self) -> None:
        raw = await self._store.async_load() or {}
        self.data = {k: v for k, v in (raw.get("tasks") or {}).items() if isinstance(k, str) and isinstance(v, dict)}

    def snapshot(self) -> dict:
        return copy.deepcopy(self.data)

    @callback
    def _changed(self) -> None:
        self._store.async_delay_save(lambda: {"tasks": self.data}, 1)
        snap = self.snapshot()
        for cb in list(self._listeners):
            cb(snap)

    @callback
    def async_add_listener(self, cb: Callable[[dict], None]) -> Callable[[], None]:
        self._listeners.add(cb)

        @callback
        def _remove() -> None:
            self._listeners.discard(cb)

        return _remove

    @callback
    def done(self, task_id: str, day: date, user: str | None) -> None:
        entry = self.data.setdefault(task_id, {"history": []})
        hist = [h for h in entry.get("history", []) if isinstance(h, dict)]
        hist.append({"date": day.isoformat(), "by": user})
        hist.sort(key=lambda h: str(h.get("date")))
        entry["history"] = hist[-HISTORY:]
        entry["last"], entry["by"] = hist[-1]["date"], hist[-1].get("by")
        self._changed()

    @callback
    def undo(self, task_id: str) -> bool:
        """Letztes „Erledigt“ zurücknehmen (z. B. versehentlich getippt)."""
        entry = self.data.get(task_id)
        if not entry or not entry.get("history"):
            return False
        entry["history"] = entry["history"][:-1]
        if entry["history"]:
            entry["last"], entry["by"] = entry["history"][-1]["date"], entry["history"][-1].get("by")
        else:
            del self.data[task_id]
        self._changed()
        return True

    @callback
    def replace(self, data: dict) -> None:
        """Ganzen Stand ersetzen (Wiederherstellen einer Sicherung)."""
        self.data = copy.deepcopy(data)
        self._changed()

    @callback
    def prune(self, ids: set[str]) -> None:
        """Einträge gelöschter Aufgaben verwerfen."""
        gone = [k for k in self.data if k not in ids]
        for k in gone:
            del self.data[k]
        if gone:
            self._changed()
