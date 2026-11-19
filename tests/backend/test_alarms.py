"""Alarmmanager: Quittieren, Stummschalten, Protokoll, Push-Aktionen (pytest tests/backend)."""
import time
from unittest.mock import patch

from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _house, _setup, _tick

from custom_components.haus_visualisierung.alarms import next_morning

W = {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"}
S = {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"}


async def test_ack_mute_log(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _house(hass)
    monitor = await _setup(hass)
    events = []
    hass.bus.async_listen("haus_visualisierung_alarm", lambda e: events.append(e.data))
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "haus_visualisierung/alarms_subscribe"})
    assert (await ws.receive_json())["success"]
    snap = (await ws.receive_json())["event"]
    assert snap["alarms"] == {}

    # Fenster offen → neu, Push mit Aktionsknöpfen, Ereignis, Protokoll
    hass.states.async_set(ids["fenster"], "on", W)
    await _tick(hass)
    key = f"contact:{ids['fenster']}"
    snap = (await ws.receive_json())["event"]
    assert snap["alarms"][key]["status"] == "neu" and snap["today"]["warn"] == 1
    assert snap["log"][-1]["type"] == "neu"
    acts = calls[-1].data["data"]["actions"]
    assert [a["title"] for a in acts] == ["Quittieren", "1 h stumm"] and acts[0]["action"] == "HV_ACK_" + key
    assert events[-1]["type"] == "neu" and events[-1]["key"] == key

    # Quittieren über Websocket → Benutzername, Meldung vom Handy entfernt
    await ws.send_json({"id": 2, "type": "haus_visualisierung/alarm_action", "key": key, "action": "ack"})
    msgs = [await ws.receive_json(), await ws.receive_json()]
    res = next(m for m in msgs if m.get("id") == 2 and m.get("type") == "result")
    assert res["success"] and res["result"]["alarm"]["status"] == "quittiert"
    assert res["result"]["alarm"]["ack_by"] == hass_admin_user.name
    await hass.async_block_till_done()
    assert calls[-1].data["message"] == "clear_notification"
    assert monitor.book.log[-1]["type"] == "quittiert" and monitor.book.log[-1]["user"] == hass_admin_user.name

    # Unbekannte Meldung → Fehler
    await ws.send_json({"id": 3, "type": "haus_visualisierung/alarm_action", "key": "gibts:nicht", "action": "ack"})
    res = await ws.receive_json()
    assert not res["success"] and res["error"]["code"] == "not_found"

    # Behoben → Protokoll mit Dauer, aus der Liste
    hass.states.async_set(ids["fenster"], "off", W)
    await _tick(hass)
    assert key not in monitor.book.alarms
    last = monitor.book.log[-1]
    assert last["type"] == "behoben" and last["dur"] >= 0

    # Rauchalarm stumm 1 h → keine erneute Meldung, nach Ablauf wieder offen und erneut gemeldet
    hass.states.async_set(ids["rauch"], "on", S)
    await _tick(hass)
    skey = f"safety:{ids['rauch']}"
    n_alarm = sum(1 for c in calls if c.data.get("title", "").endswith("Rauchmelder") and "Nicht quittiert" not in c.data.get("title", ""))
    assert n_alarm == 1
    monitor.async_action(skey, "mute", "Tobias", minutes=60)
    assert monitor.book.alarms[skey]["status"] == "stumm"
    assert calls[-1].data["message"] == "clear_notification"
    future = time.time() + 3700
    with patch("custom_components.haus_visualisierung.alarms.time.time", return_value=future):
        monitor._on_tick(None)  # 30-s-Takt
        await hass.async_block_till_done()
    assert monitor.book.alarms[skey]["status"] == "neu"
    assert sum(1 for c in calls if c.data.get("title", "").endswith("Rauchmelder") and "Nicht quittiert" not in c.data.get("title", "")) == 2
    assert any(e["type"] == "stumm_ende" for e in monitor.book.log)

    # Stumm bis behoben, dann aufheben
    monitor.async_action(skey, "mute", "Tobias", until="resolved")
    assert monitor.book.alarms[skey]["mute_until"] == 0
    monitor.async_action(skey, "unmute", "Tobias")
    assert monitor.book.alarms[skey]["status"] == "neu"

    # Alle quittieren
    hass.states.async_set(ids["fenster"], "on", W)
    await _tick(hass)
    monitor.async_action("", "ack_all", "Tobias")
    assert {a["status"] for a in monitor.book.alarms.values()} == {"quittiert"}

    # Protokoll und Statistik
    await ws.send_json({"id": 4, "type": "haus_visualisierung/alarm_log", "days": 7})
    while True:
        res = await ws.receive_json()
        if res.get("id") == 4 and res.get("type") == "result":
            break
    log = res["result"]["log"]
    assert {e["type"] for e in log} >= {"neu", "quittiert", "behoben", "stumm", "stumm_ende", "stumm_aus"}
    top = res["result"]["stats"][0]
    assert top["key"] == key and top["n"] == 2


async def test_push_actions_and_persistence(hass: HomeAssistant, hass_admin_user) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    lock_calls = async_mock_service(hass, "lock", "lock")
    ids = await _house(hass)
    from homeassistant.helpers import area_registry as ar
    from homeassistant.helpers import entity_registry as er
    flur = ar.async_get(hass).async_create("Flur").id
    reg = er.async_get(hass)
    e = reg.async_get_or_create("lock", "test", "haustur", suggested_object_id="haustur")
    reg.async_update_entity(e.entity_id, area_id=flur)
    hass.states.async_set(e.entity_id, "locked", {"friendly_name": "Flur Haustür"})
    monitor = await _setup(hass)

    # Schloss offen → Push mit „Verriegeln“
    hass.states.async_set(e.entity_id, "unlocked", {"friendly_name": "Flur Haustür"})
    await _tick(hass)
    acts = calls[-1].data["data"]["actions"]
    assert acts[-1] == {"action": "HV_LOCK_" + e.entity_id, "title": "Verriegeln"}

    # Knopf „Verriegeln“ in der Push-Meldung → lock.lock + quittiert mit Benutzer
    hass.bus.async_fire("mobile_app_notification_action", {"action": "HV_LOCK_" + e.entity_id}, context=Context(user_id=hass_admin_user.id))
    await hass.async_block_till_done()
    assert lock_calls and lock_calls[-1].data["entity_id"] == e.entity_id
    a = monitor.book.alarms[f"lock:{e.entity_id}"]
    assert a["status"] == "quittiert" and a["ack_by"] == hass_admin_user.name

    # Knopf „1 h stumm“ für das Fenster
    hass.states.async_set(ids["fenster"], "on", W)
    await _tick(hass)
    key = f"contact:{ids['fenster']}"
    hass.bus.async_fire("mobile_app_notification_action", {"action": "HV_MUTE_" + key})
    await hass.async_block_till_done()
    a = monitor.book.alarms[key]
    assert a["status"] == "stumm" and 3500 < a["mute_until"] - time.time() <= 3600 and a["mute_by"] == "Push"

    # fremde Aktionen werden ignoriert
    hass.bus.async_fire("mobile_app_notification_action", {"action": "ANDERE_APP"})
    await hass.async_block_till_done()

    # Zustände überstehen einen Neustart (Speicher)
    data = monitor.book._data()
    assert data["alarms"][key]["status"] == "stumm" and data["log"]


def test_next_morning() -> None:
    tz = dt_util.get_default_time_zone()
    from datetime import datetime
    evening = datetime(2026, 11, 19, 22, 0, tzinfo=tz)
    morning = datetime(2026, 11, 19, 6, 30, tzinfo=tz)
    assert datetime.fromtimestamp(next_morning(evening), tz) == datetime(2026, 11, 20, 7, 0, tzinfo=tz)
    assert datetime.fromtimestamp(next_morning(morning), tz) == datetime(2026, 11, 19, 7, 0, tzinfo=tz)
