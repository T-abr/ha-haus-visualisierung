"""Alarmmanager: Zustand je Meldung (neu, quittiert, stumm) und Protokoll.

Die Auswertung der Regeln übernimmt AlertMonitor (alerts.py). Dieses Modul merkt sich,
was mit jeder aktiven Meldung passiert ist, schreibt das Protokoll und speichert beides,
damit Quittierungen und Stummschaltungen einen Neustart überstehen.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}_alarme"
STORAGE_VERSION = 1
EVENT_ALARM = f"{DOMAIN}_alarm"
LOG_MAX = 1000
LOG_DAYS = 30
SNAPSHOT_LOG = 60
MORNING_HOUR = 7

NEW, ACKED, MUTED = "neu", "quittiert", "stumm"
# Felder der Meldung, die das Panel anzeigt (Alert in alerts.py); leere werden nicht gespeichert
SHOW_FIELDS = ("icon", "eid", "to", "fmt", "ts")


def next_morning(now: datetime | None = None) -> float:
    """Nächster Morgen 7:00 Uhr (Ortszeit) als Zeitstempel."""
    now = now or dt_util.now()
    target = now.replace(hour=MORNING_HOUR, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target.timestamp()


class AlarmBook:
    """Zustände der aktiven Meldungen und Protokoll."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.alarms: dict[str, dict[str, Any]] = {}
        self.log: list[dict[str, Any]] = []
        self._listeners: list[Callable[[dict], None]] = []
        self.rev = 0
        self.order: list[str] = []           # aktive Meldungen in der Reihenfolge der Auswertung
        self.mode: dict[str, Any] = {}       # Hausmodus {mode, since, by}
        self.code: str = ""                  # Code der Alarmanlage (nur im Backend, nie im Panel)
        self.pin: dict = {}                  # PIN für heikle Aktionen als {salt, hash} (pin.py), nie im Panel
        self.mode_info: Callable[[], dict] | None = None

    # ---------- Speichern ----------
    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.alarms = {k: v for k, v in (data.get("alarms") or {}).items() if isinstance(v, dict)}
        self.log = [e for e in (data.get("log") or []) if isinstance(e, dict)]
        self.mode = data.get("mode") if isinstance(data.get("mode"), dict) else {}
        self.code = str(data.get("code") or "")
        self.pin = data.get("pin") if isinstance(data.get("pin"), dict) else {}
        self._trim()

    def _data(self) -> dict:
        return {"alarms": self.alarms, "log": self.log, "mode": self.mode, "code": self.code, "pin": self.pin}

    @callback
    def _changed(self) -> None:
        self.rev += 1
        self._store.async_delay_save(self._data, 2)
        snap = self.snapshot()
        for cb in list(self._listeners):
            cb(snap)

    @callback
    def _notify(self) -> None:
        """Nur die Anzeige hat sich geändert (Titel, Text, Reihenfolge): Panels informieren, nicht speichern."""
        self.rev += 1
        snap = self.snapshot()
        for cb in list(self._listeners):
            cb(snap)

    @callback
    def async_add_listener(self, cb: Callable[[dict], None]) -> Callable[[], None]:
        self._listeners.append(cb)

        def _remove() -> None:
            if cb in self._listeners:
                self._listeners.remove(cb)

        return _remove

    def _trim(self) -> None:
        limit = time.time() - LOG_DAYS * 86400
        self.log = [e for e in self.log if e.get("ts", 0) >= limit][-LOG_MAX:]

    def _entry(self, typ: str, a: dict, user: str | None = None, fire: bool = True, **extra: Any) -> None:
        e = {"ts": round(time.time(), 1), "type": typ, "key": a["key"], "title": a.get("title", ""),
             "level": a.get("level", "warn"), **extra}
        if user:
            e["user"] = user
        self.log.append(e)
        self._trim()
        if not fire:
            return
        self.hass.bus.async_fire(EVENT_ALARM, {
            "type": typ, "key": a["key"], "level": a.get("level"), "title": a.get("title"),
            "status": a.get("status"), "user": user,
        })

    # ---------- Ablauf ----------
    def status(self, key: str) -> str:
        a = self.alarms.get(key)
        return a["status"] if a else NEW

    def muted(self, key: str) -> bool:
        return self.status(key) == MUTED

    def acked_or_muted(self, key: str) -> bool:
        return self.status(key) in (ACKED, MUTED)

    @callback
    def sync(self, current: dict[str, Any], silent_new: bool = False) -> tuple[list[str], list[str]]:
        """Aktive Meldungen abgleichen. Liefert (neu aufgetreten, behoben)."""
        new, gone = [], []
        now = time.time()
        shown_changed = list(current) != self.order
        self.order = list(current)
        for key, alert in current.items():
            a = self.alarms.get(key)
            if a is None:
                a = {"key": key, "since": now, "status": NEW}
                self.alarms[key] = a
                new.append(key)
            before = _shown(a)
            a.update(level=alert.level, title=alert.title, detail=alert.detail, path=alert.path)
            for f in SHOW_FIELDS:
                if v := getattr(alert, f, None):
                    a[f] = v
                else:
                    a.pop(f, None)
            shown_changed = shown_changed or before != _shown(a)
            if key in new and not silent_new:
                self._entry("neu", a)
        for key in [k for k in self.alarms if k not in current]:
            a = self.alarms.pop(key)
            gone.append(key)
            self._entry("behoben", a, dur=round(now - a.get("since", now)))
        if new or gone:
            self._changed()
        elif shown_changed:
            self._notify()
        return new, gone

    @callback
    def expire_mutes(self) -> list[str]:
        """Abgelaufene Stummschaltungen beenden. Liefert die betroffenen Schlüssel."""
        now, out = time.time(), []
        for a in self.alarms.values():
            until = a.get("mute_until")
            if a["status"] == MUTED and until and until <= now:
                a["status"] = NEW
                a.pop("mute_until", None)
                out.append(a["key"])
                self._entry("stumm_ende", a)
        if out:
            self._changed()
        return out

    @callback
    def action(self, key: str, action: str, user: str | None = None,
               minutes: int | None = None, until: str | None = None) -> dict | None:
        """quittieren (ack), stumm (mute), aufheben (unmute)."""
        a = self.alarms.get(key)
        if a is None:
            return None
        now = time.time()
        if action == "ack":
            if a["status"] == ACKED:
                return a
            a.update(status=ACKED, ack_by=user, ack_at=now)
            a.pop("mute_until", None)
            self._entry("quittiert", a, user)
        elif action == "mute":
            if until == "resolved":
                mu = 0
            elif until == "morning":
                mu = next_morning()
            else:
                mu = now + max(1, int(minutes or 60)) * 60
            a.update(status=MUTED, mute_until=mu, mute_by=user)
            self._entry("stumm", a, user, until=mu)
        elif action == "unmute":
            if a["status"] != MUTED:
                return a
            a["status"] = ACKED if a.get("ack_at") else NEW
            a.pop("mute_until", None)
            self._entry("stumm_aus", a, user)
        else:
            return None
        self._changed()
        return a

    # ---------- Eskalation und Aktionen ----------
    @callback
    def mark_escalated(self, key: str, minutes: int) -> None:
        a = self.alarms.get(key)
        if a is None:
            return
        a["escalated"] = round(time.time(), 1)
        self._entry("eskaliert", a, None, minutes=minutes)
        self._changed()

    @callback
    def action_log(self, key: str, text: str, detail: str = "", test: bool = False) -> None:
        a = self.alarms.get(key) or {"key": key or "test", "title": text, "level": "info"}
        self._entry("aktion", {**a, "key": key or "test"}, None, fire=False, text=text, detail=detail, test=test)
        self._changed()

    # ---------- Hausmodus ----------
    @callback
    def set_mode(self, mode: str, by: str, old: str) -> None:
        from .const import HOUSE_MODE_NAMES
        self.mode = {"mode": mode, "since": round(time.time(), 1), "by": by}
        self._entry("modus", {"key": "modus", "title": f"Hausmodus: {HOUSE_MODE_NAMES.get(mode, mode)}", "level": "info"},
                    by, fire=False, mode=mode, previous=old)
        self._changed()

    @callback
    def set_code(self, code: str) -> None:
        self.code = code[:32]
        self._store.async_delay_save(self._data, 1)

    @callback
    def note(self, title: str, detail: str = "") -> None:
        """Hinweis ins Protokoll (z. B. Alarmanlage nicht geschaltet)."""
        self._entry("hinweis", {"key": "hinweis", "title": title, "level": "warn"}, None, fire=False, detail=detail)
        self._changed()

    # ---------- Ausgabe ----------
    def snapshot(self) -> dict:
        start = dt_util.start_of_local_day().timestamp()
        today = [e for e in self.log if e.get("ts", 0) >= start and e.get("type") == "neu"]
        return {
            "rev": self.rev,
            "alarms": self.alarms,
            "active": [k for k in self.order if k in self.alarms] or list(self.alarms),
            "log": self.log[-SNAPSHOT_LOG:],
            "today": {lvl: sum(1 for e in today if e.get("level") == lvl) for lvl in ("alarm", "warn", "info")},
            "mode": self.mode_info() if self.mode_info else {"mode": self.mode.get("mode", "zuhause")},
        }

    def query(self, days: int = 7, level: str | None = None, key: str | None = None) -> list[dict]:
        limit = time.time() - max(1, min(days, LOG_DAYS)) * 86400
        return [e for e in self.log if e.get("ts", 0) >= limit
                and (not level or e.get("level") == level) and (not key or e.get("key") == key)]

    def stats(self, days: int = 7) -> list[dict]:
        """Häufigste Meldungen der letzten Tage mit Dauer – Hinweise auf Fehlalarme.

        kurz = behoben nach weniger als 60 s; verdacht = häufig (≥ 5) oder mehrfach kurz (≥ 3)
        oder fast immer ohne Reaktion behoben (≥ 4 Meldungen, nie quittiert)."""
        limit = time.time() - days * 86400
        count: dict[str, dict] = {}
        for e in self.log:
            if e.get("ts", 0) < limit or e.get("key") in ("modus", "hinweis", "test"):
                continue
            c = count.setdefault(e["key"], {"key": e["key"], "title": e.get("title", ""), "level": e.get("level"),
                                            "n": 0, "short": 0, "acked": 0, "durs": []})
            typ = e.get("type")
            if typ == "neu":
                c["n"] += 1
                c["title"] = e.get("title", c["title"])
            elif typ == "behoben" and e.get("dur") is not None:
                c["durs"].append(e["dur"])
                if e["dur"] < 60:
                    c["short"] += 1
            elif typ == "quittiert":
                c["acked"] += 1
        out = []
        for c in count.values():
            if not c["n"]:
                continue
            durs = c.pop("durs")
            c["avg"] = round(sum(durs) / len(durs)) if durs else None
            reasons = []
            if c["short"] >= 3:
                reasons.append("kurz")
            if c["n"] >= 5:
                reasons.append("häufig")
            if c["n"] >= 4 and not c["acked"]:
                reasons.append("ohne Reaktion")
            c["verdacht"] = reasons
            out.append(c)
        return sorted(out, key=lambda c: (-len(c["verdacht"]), -c["n"]))[:10]


def _shown(a: dict) -> tuple:
    """Was das Panel von einer Meldung zeigt. Bei fmt "state" zeigt es den Zustand live, dann zählt der Text nicht."""
    return (a.get("level"), a.get("title"), None if a.get("fmt") == "state" else a.get("detail"), *(a.get(f) for f in SHOW_FIELDS))
