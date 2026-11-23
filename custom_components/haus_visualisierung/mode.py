"""Hausmodus: Zuhause, Nacht, Abwesend, Urlaub.

- Automatik nach Personen (alle weg → Abwesend, jemand kommt → Zuhause) und Uhrzeit (Nacht).
- Kopplung mit einer Alarmanlage (z. B. Alarmo) in beide Richtungen.
- Regeln im Alarmmanager können auf einzelne Modi beschränkt werden (alerts.py).
Der Zustand liegt im Speicher des Alarmmanagers (alarms.py) und übersteht einen Neustart.
"""

from __future__ import annotations

import contextlib
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_change

from .const import DOMAIN, HOUSE_MODE_NAMES, HOUSE_MODES

if TYPE_CHECKING:
    from .alerts import AlertMonitor

_LOGGER = logging.getLogger(__name__)

EVENT_MODE = f"{DOMAIN}_modus"
AUTO = "Automatik"
# Zustand der Alarmanlage → Hausmodus
FROM_PANEL = {"armed_away": "abwesend", "armed_night": "nacht", "armed_vacation": "urlaub", "armed_home": "zuhause"}
# Aktion → erwarteter Zustand der Alarmanlage und Dienst
ARM_STATE = {"disarm": "disarmed", "arm_home": "armed_home", "arm_night": "armed_night", "arm_away": "armed_away", "arm_vacation": "armed_vacation"}
ARM_SERVICE = {"disarm": "alarm_disarm", "arm_home": "alarm_arm_home", "arm_night": "alarm_arm_night",
               "arm_away": "alarm_arm_away", "arm_vacation": "alarm_arm_vacation"}


class HouseMode:
    """Verwaltet den Hausmodus."""

    def __init__(self, hass: HomeAssistant, monitor: AlertMonitor) -> None:
        self.hass = hass
        self.monitor = monitor
        self.book = monitor.book
        self._unsubs: list[Callable[[], None]] = []
        self._time_unsubs: list[Callable[[], None]] = []
        self._away_timer: Callable[[], None] | None = None
        self._time_key = ""

    # ---------- Einstellungen ----------
    @property
    def cfg(self) -> dict:
        return self.monitor.layout.get("house_mode", {})

    @property
    def mode(self) -> str:
        m = (self.book.mode or {}).get("mode")
        return m if m in HOUSE_MODES and self.cfg.get("enabled", True) else "zuhause"

    def panel(self) -> str | None:
        """Gekoppelte Alarmanlage: eingestellt oder automatisch die von Alarmo."""
        eid = self.cfg.get("alarmo") or ""
        if eid and self.hass.states.get(eid):
            return eid
        ids = self.hass.states.async_entity_ids("alarm_control_panel")
        for e in ids:
            if "alarmo" in e:
                return e
        return ids[0] if len(ids) == 1 else None

    # ---------- Lebenszyklus ----------
    @callback
    def async_start(self) -> None:
        if not self.book.mode:
            self.book.mode = {"mode": "zuhause", "since": 0, "by": AUTO}
        self._unsubs.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state))
        self._unsubs.append(self.monitor.store.async_add_listener(lambda _l: self._setup_times()))
        self._setup_times()

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs + self._time_unsubs:
            with contextlib.suppress(Exception):
                u()
        self._unsubs.clear()
        self._time_unsubs.clear()
        self._cancel_away()

    @callback
    def _setup_times(self) -> None:
        cfg = self.cfg
        key = f"{cfg.get('auto_night')}|{cfg.get('night_start')}|{cfg.get('night_end')}"
        if key == self._time_key:
            return
        self._time_key = key
        for u in self._time_unsubs:
            u()
        self._time_unsubs.clear()
        if not cfg.get("auto_night"):
            return
        for t, fn in ((cfg.get("night_start", "23:00"), self._night_start), (cfg.get("night_end", "06:30"), self._night_end)):
            h, m = (int(x) for x in t.split(":"))
            self._time_unsubs.append(async_track_time_change(self.hass, fn, hour=h, minute=m, second=0))

    # ---------- Modus setzen ----------
    @callback
    def set_mode(self, mode: str, by: str | None = None, source: str = "manual") -> bool:
        if mode not in HOUSE_MODES:
            return False
        old = self.mode
        if mode == old and self.book.mode.get("mode") == mode:
            return False
        self.book.set_mode(mode, by or AUTO, old)
        self.hass.bus.async_fire(EVENT_MODE, {"mode": mode, "previous": old, "by": by or AUTO, "source": source})
        if source != "panel":
            self._sync_panel(mode)
        if mode not in ("abwesend", "urlaub"):
            self._cancel_away()
        # Regeln je Modus: neu auswerten
        self.monitor._rebuild()
        self.monitor._schedule(0)
        return True

    # ---------- Alarmanlage ----------
    @callback
    def _sync_panel(self, mode: str) -> None:
        cfg = self.cfg
        if not cfg.get("alarmo_sync"):
            return
        eid = self.panel()
        action = (cfg.get("arm") or {}).get(mode, "none")
        if not eid or action not in ARM_SERVICE:
            return
        st = self.hass.states.get(eid)
        if st and st.state == ARM_STATE[action]:
            return
        data: dict[str, Any] = {"entity_id": eid}
        code = self.book.code
        if code:
            data["code"] = code
        self.hass.async_create_task(self._call_panel(ARM_SERVICE[action], data, mode))

    async def _call_panel(self, service: str, data: dict, mode: str) -> None:
        try:
            await self.hass.services.async_call("alarm_control_panel", service, data, blocking=True)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Alarmanlage konnte nicht geschaltet werden (%s): %s", service, err)
            self.book.note(f"Alarmanlage nicht geschaltet ({HOUSE_MODE_NAMES[mode]})", str(err)[:120])

    @callback
    def _on_panel(self, state: str) -> None:
        if not self.cfg.get("alarmo_sync"):
            return
        target = FROM_PANEL.get(state)
        if state == "disarmed":
            # Unscharf geschaltet, obwohl der Modus scharf sein sollte → Zuhause
            expected = (self.cfg.get("arm") or {}).get(self.mode, "none")
            if expected not in ("none", "disarm"):
                target = "zuhause"
        if target and target != self.mode:
            self.set_mode(target, "Alarmanlage", source="panel")

    # ---------- Automatik ----------
    def _persons(self) -> list[str]:
        return [s.state for s in self.hass.states.async_all("person")]

    @callback
    def _on_state(self, event: Event) -> None:
        eid = event.data.get("entity_id", "")
        new = event.data.get("new_state")
        if new is None:
            return
        if eid.startswith("person."):
            self._check_persons()
        elif eid.startswith("alarm_control_panel.") and eid == self.panel():
            old = event.data.get("old_state")
            if not old or old.state != new.state:
                self._on_panel(new.state)

    @callback
    def _check_persons(self) -> None:
        cfg = self.cfg
        if not cfg.get("enabled", True) or not cfg.get("auto_away", True):
            return
        states = self._persons()
        if not states:
            return
        home = any(s == "home" for s in states)
        mode = self.mode
        if home:
            self._cancel_away()
            if mode in ("abwesend", "urlaub"):
                self.set_mode("zuhause", AUTO, "auto")
            return
        if mode in ("zuhause", "nacht") and self._away_timer is None:
            delay = max(0, int(cfg.get("away_delay", 10))) * 60

            @callback
            def _go(_now: Any) -> None:
                self._away_timer = None
                if not any(s == "home" for s in self._persons()) and self.mode in ("zuhause", "nacht"):
                    self.set_mode("abwesend", AUTO, "auto")

            if delay:
                self._away_timer = async_call_later(self.hass, delay, _go)
            else:
                _go(None)

    @callback
    def _cancel_away(self) -> None:
        if self._away_timer:
            self._away_timer()
            self._away_timer = None

    @callback
    def _night_start(self, _now: Any) -> None:
        if self.cfg.get("enabled", True) and self.mode == "zuhause":
            self.set_mode("nacht", AUTO, "auto")

    @callback
    def _night_end(self, _now: Any) -> None:
        if self.cfg.get("enabled", True) and self.mode == "nacht":
            self.set_mode("zuhause", AUTO, "auto")

    def status(self) -> dict:
        cfg = self.cfg
        eid = self.panel()
        st = self.hass.states.get(eid) if eid else None
        return {
            "mode": self.mode, "since": self.book.mode.get("since", 0), "by": self.book.mode.get("by"),
            "enabled": cfg.get("enabled", True), "panel": eid, "panel_state": st.state if st else None,
            "sync": bool(cfg.get("alarmo_sync")), "code": bool(self.book.code), "pin": bool(self.book.pin.get("hash")),
            "away_pending": self._away_timer is not None,
        }
