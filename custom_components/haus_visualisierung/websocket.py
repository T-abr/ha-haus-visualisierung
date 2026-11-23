"""Websocket-Befehle für Panel und Karten."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, HOUSE_MODES, VERSION


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_push_info)
    websocket_api.async_register_command(hass, ws_push_test)
    websocket_api.async_register_command(hass, ws_alarms_subscribe)
    websocket_api.async_register_command(hass, ws_alarm_action)
    websocket_api.async_register_command(hass, ws_alarm_log)
    websocket_api.async_register_command(hass, ws_set_mode)
    websocket_api.async_register_command(hass, ws_alarm_code)
    websocket_api.async_register_command(hass, ws_action_test)
    websocket_api.async_register_command(hass, ws_presence_sim)


def _payload(hass: HomeAssistant) -> dict[str, Any]:
    data = hass.data[DOMAIN]
    return {
        "version": VERSION,
        "options": data.get("options", {}),
        "layout": data["store"].data,
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/info"})
@callback
def ws_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Version, Panel-Optionen und Layout liefern."""
    connection.send_result(msg["id"], _payload(hass))


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save", vol.Required("layout"): dict}
)
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Layout speichern (nur Administratoren)."""
    layout = await hass.data[DOMAIN]["store"].async_save(msg["layout"])
    connection.send_result(msg["id"], {"layout": layout})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Änderungen am Layout an offene Panels schicken."""
    msg_id = msg["id"]

    @callback
    def _forward(layout: dict) -> None:
        connection.send_message(websocket_api.event_message(msg_id, {"layout": layout}))

    connection.subscriptions[msg_id] = hass.data[DOMAIN]["store"].async_add_listener(_forward)
    connection.send_result(msg_id)
    connection.send_message(websocket_api.event_message(msg_id, _payload(hass)))


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/push_info"})
@callback
def ws_push_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Verfügbare notify-Dienste, aktuell genutzte Ziele und aktive Warnungen."""
    services = sorted(hass.services.async_services().get("notify", {}))
    monitor = hass.data[DOMAIN].get("monitor")
    connection.send_result(
        msg["id"],
        {"services": services, **(monitor.status() if monitor else {"targets": [], "active": []})},
    )


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/push_test"})
@websocket_api.async_response
async def ws_push_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Testmeldung an alle Ziele schicken."""
    monitor = hass.data[DOMAIN].get("monitor")
    targets = await monitor.async_test() if monitor else []
    connection.send_result(msg["id"], {"targets": targets})


def _monitor(hass: HomeAssistant):
    return hass.data.get(DOMAIN, {}).get("monitor")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/alarms_subscribe"})
@callback
def ws_alarms_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Zustände der Meldungen (neu, quittiert, stumm) und das jüngste Protokoll live schicken."""
    msg_id = msg["id"]
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg_id, "not_ready", "Alarmmanager nicht geladen")
        return

    @callback
    def _forward(snap: dict) -> None:
        connection.send_message(websocket_api.event_message(msg_id, snap))

    connection.subscriptions[msg_id] = monitor.book.async_add_listener(_forward)
    connection.send_result(msg_id)
    connection.send_message(websocket_api.event_message(msg_id, monitor.book.snapshot()))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/alarm_action",
        vol.Required("key"): str,
        vol.Required("action"): vol.In(["ack", "ack_all", "mute", "unmute"]),
        vol.Optional("minutes"): vol.All(int, vol.Range(min=1, max=10080)),
        vol.Optional("until"): vol.In(["resolved", "morning"]),
    }
)
@websocket_api.async_response
async def ws_alarm_action(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Meldung quittieren, stummschalten oder Stummschaltung aufheben."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg["id"], "not_ready", "Alarmmanager nicht geladen")
        return
    user = connection.user.name if connection.user else None
    res = monitor.async_action(msg["key"], msg["action"], user, msg.get("minutes"), msg.get("until"))
    if res is None:
        connection.send_error(msg["id"], "not_found", "Meldung ist nicht mehr aktiv")
        return
    connection.send_result(msg["id"], {"alarm": res})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/alarm_log",
        vol.Optional("days", default=7): vol.All(int, vol.Range(min=1, max=30)),
        vol.Optional("level"): vol.In(["alarm", "warn", "info"]),
        vol.Optional("key"): str,
    }
)
@callback
def ws_alarm_log(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Protokoll der letzten Tage und häufigste Meldungen."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_result(msg["id"], {"log": [], "stats": []})
        return
    connection.send_result(msg["id"], {
        "log": monitor.book.query(msg["days"], msg.get("level"), msg.get("key")),
        "stats": monitor.book.stats(msg["days"]),
    })


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/set_mode", vol.Required("mode"): vol.In(HOUSE_MODES)}
)
@callback
def ws_set_mode(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Hausmodus setzen (Zuhause, Nacht, Abwesend, Urlaub)."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg["id"], "not_ready", "Alarmmanager nicht geladen")
        return
    user = connection.user.name if connection.user else None
    monitor.house.set_mode(msg["mode"], user, "manual")
    connection.send_result(msg["id"], monitor.house.status())


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/alarm_code", vol.Required("code"): vol.All(str, vol.Length(max=32))}
)
@callback
def ws_alarm_code(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Code der Alarmanlage speichern (bleibt im Backend, wird nie ans Panel geschickt)."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg["id"], "not_ready", "Alarmmanager nicht geladen")
        return
    monitor.book.set_code(msg["code"])
    monitor.book._changed()
    connection.send_result(msg["id"], {"code": bool(msg["code"])})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/action_test", vol.Required("action"): dict}
)
@websocket_api.async_response
async def ws_action_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Aktion probehalber ausführen (auch noch nicht gespeicherte); schaltende Aktionen nach 3 s zurück."""
    from .store import _actions
    monitor = _monitor(hass)
    acts = _actions([{**msg["action"], "enabled": True}])
    if monitor is None or not acts:
        connection.send_error(msg["id"], "invalid", "Aktion unvollständig")
        return
    calls = await monitor.runner.async_test(acts[0])
    if not calls:
        connection.send_error(msg["id"], "invalid", "Aktion unvollständig (Entität, Gruppenadresse oder TTS-Dienst fehlt)")
        return
    connection.send_result(msg["id"], {"calls": calls})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/presence_sim"})
@callback
def ws_presence_sim(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Anwesenheits-Simulation: läuft sie, Vorlagetag, nächste Schaltvorgänge und Protokoll."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_result(msg["id"], {"active": False, "source": None, "note": "", "next": [], "planned": 0, "log": []})
        return
    connection.send_result(msg["id"], monitor.sim.status())
