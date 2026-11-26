"""Websocket-Befehle für Panel und Karten."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from homeassistant.util import dt as dt_util

from . import display_setup
from .backup import export_doc, parse_doc
from .pin import PIN_RE, Throttle, make_hash, verify
from .const import DOMAIN, HOUSE_MODES, VERSION
from .maintenance import parse_date
from .klingel import IMG_URL
from .zeitleiste import MAX_DAYS, async_timeline


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
    websocket_api.async_register_command(hass, ws_appliance_ack)
    websocket_api.async_register_command(hass, ws_maintenance_done)
    websocket_api.async_register_command(hass, ws_pin_set)
    websocket_api.async_register_command(hass, ws_pin_check)
    websocket_api.async_register_command(hass, ws_backup_list)
    websocket_api.async_register_command(hass, ws_backup_create)
    websocket_api.async_register_command(hass, ws_backup_get)
    websocket_api.async_register_command(hass, ws_backup_delete)
    websocket_api.async_register_command(hass, ws_backup_restore)
    websocket_api.async_register_command(hass, ws_export)
    websocket_api.async_register_command(hass, ws_zeitleiste)
    display_setup.async_register(hass)


def _payload(hass: HomeAssistant) -> dict[str, Any]:
    data = hass.data[DOMAIN]
    return {
        "version": VERSION,
        "options": data.get("options", {}),
        "layout": data["store"].data,
        "maintenance": data["maintenance"].snapshot() if "maintenance" in data else {},
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/info"})
@callback
def ws_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Version, Panel-Optionen und Layout liefern."""
    connection.send_result(msg["id"], _payload(hass))


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save",
        vol.Exclusive("layout", "save"): dict,
        vol.Exclusive("changes", "save"): [dict],
    }
)
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Layout speichern (nur Administratoren). Vor dem ersten Speichern eines Tages wird der alte Stand gesichert.

    ``changes`` (Panel): nur die geänderten Einstellungen, der Rest bleibt wie gespeichert.
    ``layout``: ganzer Stand (Import, ältere Panels, Tests).
    """
    if "layout" not in msg and "changes" not in msg:
        connection.send_error(msg["id"], "invalid_format", "layout oder changes fehlt")
        return
    if backups := hass.data[DOMAIN].get("backups"):
        backups.before_save()
    store = hass.data[DOMAIN]["store"]
    layout = await (store.async_patch(msg["changes"]) if "changes" in msg else store.async_save(msg["layout"]))
    connection.send_result(msg["id"], {"layout": layout})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Änderungen am Layout an offene Panels schicken."""
    msg_id = msg["id"]

    @callback
    def _forward(layout: dict) -> None:
        connection.send_message(websocket_api.event_message(msg_id, {"layout": layout}))

    @callback
    def _forward_maint(state: dict) -> None:
        connection.send_message(websocket_api.event_message(msg_id, {"maintenance": state}))

    unsubs = [hass.data[DOMAIN]["store"].async_add_listener(_forward)]
    if "maintenance" in hass.data[DOMAIN]:
        unsubs.append(hass.data[DOMAIN]["maintenance"].async_add_listener(_forward_maint))

    @callback
    def _unsub() -> None:
        for u in unsubs:
            u()

    connection.subscriptions[msg_id] = _unsub
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


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/appliance_ack", vol.Required("appliance"): str})
@callback
def ws_appliance_ack(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Haushaltsgerät quittieren („fertig“ → „aus“), z. B. nach dem Ausräumen."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg["id"], "not_ready", "Alarmmanager nicht geladen")
        return
    key = f"appliance:{msg['appliance']}"
    if key in monitor.book.alarms:
        monitor.async_action(key, "ack", connection.user.name if connection.user else None)
    elif not monitor.appliances.ack(msg["appliance"]):
        connection.send_error(msg["id"], "not_found", "Gerät ist nicht fertig")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/maintenance_done",
        vol.Required("task"): str,
        vol.Optional("date"): str,
        vol.Optional("undo", default=False): bool,
    }
)
@callback
def ws_maintenance_done(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Wartungsaufgabe als erledigt markieren (heute oder an einem Datum) bzw. das letzte „Erledigt“ zurücknehmen.
    Darf jeder Benutzer, nicht nur Administratoren."""
    data = hass.data[DOMAIN]
    book = data.get("maintenance")
    task = msg["task"]
    tasks = {t["id"] for t in data["store"].data.get("maintenance", {}).get("tasks", [])}
    if book is None or task not in tasks:
        connection.send_error(msg["id"], "not_found", "Aufgabe nicht gefunden")
        return
    if msg["undo"]:
        if not book.undo(task):
            connection.send_error(msg["id"], "not_found", "Nichts zum Zurücknehmen")
            return
    else:
        today = dt_util.now().date()
        day = parse_date(msg["date"]) if msg.get("date") else today
        if day is None or day > today:
            connection.send_error(msg["id"], "invalid", "Ungültiges Datum")
            return
        book.done(task, day, connection.user.name if connection.user else None)
    connection.send_result(msg["id"], {"maintenance": book.snapshot()})


# ---------- Sicherungen (backup.py) ----------
def _backups(hass: HomeAssistant):
    return hass.data.get(DOMAIN, {}).get("backups")


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_list"})
@callback
def ws_backup_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Gespeicherte Sicherungen (jüngste zuerst) ohne Inhalt."""
    b = _backups(hass)
    connection.send_result(msg["id"], {"items": b.listing() if b else []})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_create"})
@callback
def ws_backup_create(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Jetzt sichern."""
    b = _backups(hass)
    if b is None:
        connection.send_error(msg["id"], "not_ready", "Sicherungen nicht geladen")
        return
    item = b.create("manuell", connection.user.name if connection.user else "")
    connection.send_result(msg["id"], {"id": item["id"], "items": b.listing()})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_get", vol.Required("backup"): str})
@callback
def ws_backup_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Inhalt einer Sicherung als Datei (zum Herunterladen)."""
    b = _backups(hass)
    item = b.get(msg["backup"]) if b else None
    if item is None:
        connection.send_error(msg["id"], "not_found", "Sicherung nicht gefunden")
        return
    connection.send_result(msg["id"], b.doc(item))


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_delete", vol.Required("backup"): str})
@callback
def ws_backup_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    b = _backups(hass)
    if b is None or not b.delete(msg["backup"]):
        connection.send_error(msg["id"], "not_found", "Sicherung nicht gefunden")
        return
    connection.send_result(msg["id"], {"items": b.listing()})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/export"})
@callback
def ws_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Aktueller Stand als Datei: Layout und Wartungsstand, ohne Alarmcode und PIN."""
    data = hass.data[DOMAIN]
    connection.send_result(msg["id"], export_doc(data["store"].data, data["maintenance"].snapshot() if "maintenance" in data else {}))


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/backup_restore",
        vol.Exclusive("backup", "quelle"): str,
        vol.Exclusive("data", "quelle"): dict,
        vol.Optional("maintenance", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_backup_restore(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Sicherung oder hochgeladene Datei übernehmen; der bisherige Stand wird vorher gesichert."""
    b = _backups(hass)
    if b is None:
        connection.send_error(msg["id"], "not_ready", "Sicherungen nicht geladen")
        return
    if "backup" in msg:
        item = b.get(msg["backup"])
        if item is None:
            connection.send_error(msg["id"], "not_found", "Sicherung nicht gefunden")
            return
        layout, maint, reason = item["layout"], item.get("maintenance"), "wiederherstellen"
    elif "data" in msg:
        parsed = parse_doc(msg["data"])
        if parsed is None:
            connection.send_error(msg["id"], "invalid", "Keine Sicherung der Haus Visualisierung")
            return
        (layout, maint), reason = parsed, "import"
    else:
        connection.send_error(msg["id"], "invalid", "Sicherung oder Datei fehlt")
        return
    saved = await b.async_restore(layout, maint if msg["maintenance"] else None, reason)
    connection.send_result(msg["id"], {"layout": saved, "items": b.listing()})


# ---------- PIN für heikle Aktionen (pin.py) ----------
_THROTTLE = Throttle()


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/pin_set", vol.Required("pin"): vol.All(str, vol.Length(max=8))}
)
@callback
def ws_pin_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """PIN setzen (4–8 Ziffern) oder mit leerem Wert löschen; gespeichert wird nur ein Hash."""
    monitor = _monitor(hass)
    if monitor is None:
        connection.send_error(msg["id"], "not_ready", "Alarmmanager nicht geladen")
        return
    pin = msg["pin"].strip()
    if pin and not PIN_RE.match(pin):
        connection.send_error(msg["id"], "invalid", "Die PIN braucht 4 bis 8 Ziffern")
        return
    monitor.book.pin = make_hash(pin) if pin else {}
    monitor.book._changed()
    connection.send_result(msg["id"], {"pin": bool(pin)})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/pin_check", vol.Required("pin"): vol.All(str, vol.Length(max=16))}
)
@callback
def ws_pin_check(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """PIN prüfen (jeder Benutzer). Nach 5 Fehlversuchen eine Minute gesperrt."""
    monitor = _monitor(hass)
    if monitor is None or not monitor.book.pin.get("hash"):
        connection.send_result(msg["id"], {"ok": True, "pin": False})
        return
    src = f"user:{connection.user.id}" if connection.user else "anon"
    wait = _THROTTLE.locked_for(src)
    if wait:
        connection.send_result(msg["id"], {"ok": False, "wait": wait})
        return
    if verify(monitor.book.pin, msg["pin"]):
        _THROTTLE.ok(src)
        connection.send_result(msg["id"], {"ok": True})
        return
    _THROTTLE.fail(src)
    connection.send_result(msg["id"], {"ok": False, "wait": _THROTTLE.locked_for(src)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/zeitleiste",
        vol.Optional("days", default=3): vol.All(int, vol.Range(min=1, max=MAX_DAYS)),
    }
)
@websocket_api.async_response
async def ws_zeitleiste(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Zeitleiste „Was war los?“: Türen, Klingel (Standbild als signierte Adresse), Bewegung, Modus, Alarme."""
    from homeassistant.components.http.auth import async_sign_path

    data = hass.data.get(DOMAIN, {})
    monitor, rings = data.get("monitor"), data.get("rings")
    since = dt_util.start_of_local_day(dt_util.now() - timedelta(days=msg["days"] - 1)).timestamp()
    res = await async_timeline(hass, data["store"].data, rings.query(since) if rings else [],
                               monitor.book.query(MAX_DAYS) if monitor else [], msg["days"])
    for e in res["events"]:
        if e.get("bild"):
            e["bild"] = async_sign_path(hass, f"{IMG_URL}/{e['bild']}", timedelta(hours=2),
                                        refresh_token_id=connection.refresh_token_id)
    connection.send_result(msg["id"], res)
