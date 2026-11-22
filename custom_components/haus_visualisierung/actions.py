"""Aktionen und Eskalation des Alarmmanagers.

Aktion = was beim Auftreten einer Meldung (oder bei ihrer Eskalation) passiert:
- knx:    Telegramm auf eine Gruppenadresse (Dienst knx.send), Rücksetzwert beim Quittieren
- switch: Schalter/Licht/Helfer einschalten (z. B. KNX-Schaltaktor, Blitzleuchte), beim Quittieren aus
- siren:  Sirene einschalten, beim Quittieren aus
- tts:    Durchsage über einen Lautsprecher (z. B. Sonos) mit Lautstärke
- script: Skript starten, mit Variablen titel, stufe, detail, key, modus

Eskalation = eine Meldung der gewählten Stufen ist nach X Minuten noch „neu“
(nicht quittiert, nicht stumm): erneute kritische Push-Meldung an alle Empfänger
und Aktionen mit Auslöser „Eskalation“.

Rücksetzen: Eine Aktion mit „reset“ bleibt aktiv, solange mindestens eine auslösende
Meldung neu ist. Sind alle quittiert, stumm oder behoben, wird sie zurückgesetzt.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from homeassistant.core import HomeAssistant, callback

from .const import HOUSE_MODE_NAMES

if TYPE_CHECKING:
    from .alerts import Alert, AlertMonitor

_LOGGER = logging.getLogger(__name__)

# Feste Regel → Präfix des Meldungsschlüssels
BUILTIN_PREFIX = {
    "contacts": "contact:", "window_heating": "heat:", "safety": "safety:", "alarm_panel": "alarmpanel:",
    "presence_away": "presence:", "locks": "lock:", "garage": "garage:", "battery": "battery", "offline": "offline", "mold": "mold:",
}
LEVEL_NAME = {"alarm": "Alarm", "warn": "Warnung", "info": "Hinweis"}
TYPE_NAME = {"knx": "KNX-Telegramm", "switch": "Schalter", "siren": "Sirene", "tts": "Durchsage", "script": "Skript"}


def matches(action: dict, key: str, level: str) -> bool:
    scope = action.get("scope", "alarm")
    if scope == "alarm":
        return level == "alarm"
    if scope == "warn":
        return level in ("alarm", "warn")
    if scope == "all":
        return True
    if scope.startswith("b:"):
        prefix = BUILTIN_PREFIX.get(scope[2:])
        return bool(prefix) and (key == prefix or key.startswith(prefix))
    if scope.startswith("r:"):
        return key.startswith(f"rule:{scope[2:]}:")
    return False


class ActionRunner:
    """Führt Aktionen aus, setzt sie zurück und eskaliert unquittierte Meldungen."""

    def __init__(self, hass: HomeAssistant, monitor: AlertMonitor) -> None:
        self.hass = hass
        self.monitor = monitor
        self.book = monitor.book
        self._active: dict[str, set[str]] = {}   # Aktion-ID → auslösende Meldungen (für Rücksetzen)
        self.calls: list[dict] = []              # zuletzt ausgeführte Dienste (Status/Tests)

    @property
    def actions(self) -> list[dict]:
        return [a for a in self.monitor.layout.get("alarm_actions", []) if a.get("enabled", True)]

    @property
    def esc(self) -> dict:
        return self.monitor.layout.get("escalation", {})

    def _mode_ok(self, action: dict) -> bool:
        modes = action.get("modes") or []
        return not modes or self.monitor.house.mode in modes

    # ---------- Auslöser ----------
    @callback
    def on_new(self, alert: Alert) -> None:
        if self.book.acked_or_muted(alert.key):
            return
        for a in self.actions:
            if a.get("when", "neu") == "neu" and matches(a, alert.key, alert.level) and self._mode_ok(a):
                self._fire(a, alert)

    @callback
    def check_escalation(self) -> list[str]:
        """Im 30-s-Takt: unquittierte Meldungen eskalieren. Liefert die eskalierten Schlüssel."""
        cfg = self.esc
        if not cfg.get("enabled", True):
            return []
        limit = time.time() - max(1, int(cfg.get("minutes", 5))) * 60
        levels = cfg.get("levels") or ["alarm"]
        out = []
        for key, b in list(self.book.alarms.items()):
            if b.get("status") != "neu" or b.get("escalated") or b.get("level") not in levels or b.get("since", time.time()) > limit:
                continue
            alert = self.monitor._active.get(key)
            if alert is None:
                continue
            self.book.mark_escalated(key, int(cfg.get("minutes", 5)))
            out.append(key)
            if cfg.get("push_critical", True):
                self.monitor._send_escalation(alert)
            for a in self.actions:
                if a.get("when") == "eskalation" and matches(a, key, alert.level) and self._mode_ok(a):
                    self._fire(a, alert)
        return out

    @callback
    def on_inactive(self, key: str) -> None:
        """Meldung quittiert, stumm oder behoben → zurücksetzbare Aktionen ggf. ausschalten."""
        for aid, keys in list(self._active.items()):
            if key in keys:
                keys.discard(key)
                if not keys:
                    del self._active[aid]
                    a = next((x for x in self.monitor.layout.get("alarm_actions", []) if x.get("id") == aid), None)
                    if a:
                        self._reset(a)

    # ---------- Ausführen ----------
    def _vars(self, alert: Alert) -> dict[str, Any]:
        return {"titel": alert.title, "stufe": LEVEL_NAME.get(alert.level, alert.level), "detail": alert.detail or "",
                "key": alert.key, "modus": HOUSE_MODE_NAMES.get(self.monitor.house.mode, "")}

    def _text(self, action: dict, alert: Alert) -> str:
        txt = action.get("message") or "{titel}"
        for k, v in self._vars(alert).items():
            txt = txt.replace("{" + k + "}", str(v))
        return txt

    def services(self, a: dict, alert: Alert, reset: bool = False) -> list[tuple[str, str, dict]]:
        """Die Dienstaufrufe einer Aktion (auch für die Vorschau in Tests)."""
        t, ent = a.get("type"), a.get("entity", "")
        if t == "knx":
            if not a.get("address"):
                return []
            return [("knx", "send", {"address": a["address"], "payload": a.get("reset_payload", 0) if reset else a.get("payload", 1)})]
        if t in ("switch", "siren"):
            if not ent:
                return []
            domain = ent.split(".", 1)[0]
            dom = domain if domain in ("light", "switch", "siren", "input_boolean", "fan") else "homeassistant"
            return [(dom, "turn_off" if reset else "turn_on", {"entity_id": ent})]
        if reset:
            return []
        if t == "tts":
            if not ent or not a.get("tts"):
                return []
            msg = quote(self._text(a, alert))
            out = []
            if a.get("volume") is not None:
                out.append(("media_player", "volume_set", {"entity_id": ent, "volume_level": round(int(a["volume"]) / 100, 2)}))
            out.append(("media_player", "play_media", {
                "entity_id": ent, "announce": True, "media_content_type": "music",
                "media_content_id": f"media-source://tts/{a['tts']}?message={msg}",
            }))
            return out
        if t == "script":
            if not ent.startswith("script."):
                return []
            return [("script", "turn_on", {"entity_id": ent, "variables": self._vars(alert)})]
        return []

    @callback
    def _fire(self, a: dict, alert: Alert, test: bool = False) -> None:
        calls = self.services(a, alert)
        if not calls:
            return
        if a.get("reset", True) and a.get("type") in ("knx", "switch", "siren") and not test:
            self._active.setdefault(a["id"], set()).add(alert.key)
        name = a.get("name") or TYPE_NAME.get(a.get("type"), "Aktion")
        self.book.action_log(alert.key, f"{name} ausgeführt", alert.title if not test else "Test", test)
        for dom, svc, data in calls:
            self.hass.async_create_task(self._call(dom, svc, data, name))

    @callback
    def _reset(self, a: dict) -> None:
        dummy = type("A", (), {"key": "", "title": "", "level": "", "detail": ""})()
        for dom, svc, data in self.services(a, dummy, reset=True):
            self.hass.async_create_task(self._call(dom, svc, data, a.get("name") or TYPE_NAME.get(a.get("type"), "Aktion")))

    async def _call(self, domain: str, service: str, data: dict, name: str) -> None:
        self.calls.append({"domain": domain, "service": service, "data": data})
        del self.calls[:-50]
        try:
            await self.hass.services.async_call(domain, service, data, blocking=True)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Aktion „%s“ (%s.%s) fehlgeschlagen: %s", name, domain, service, err)
            self.book.note(f"Aktion „{name}“ fehlgeschlagen", f"{domain}.{service}: {str(err)[:100]}")

    async def async_test(self, action: dict) -> list[dict]:
        """Aktion probehalber ausführen; schaltende Aktionen nach 3 s zurücksetzen."""
        from .alerts import Alert
        alert = Alert("test", "alarm", "Test des Alarmmanagers", "Probealarm", "")
        before = len(self.calls)
        self._fire(action, alert, test=True)
        if action.get("type") in ("knx", "switch", "siren") and action.get("reset", True):
            from homeassistant.helpers.event import async_call_later

            @callback
            def _later(_now: Any) -> None:
                self._reset(action)

            async_call_later(self.hass, 3, _later)
        return [{"domain": d, "service": s, "data": x} for d, s, x in self.services(action, alert)] or self.calls[before:]
