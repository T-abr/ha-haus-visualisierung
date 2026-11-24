"""Hausmodus: Automatik, Alarmo-Kopplung, Regeln je Modus, Entitäten (pytest tests/backend)."""
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    async_fire_time_changed,
    async_mock_service,
)
from test_push import _house, _setup, _tick

from custom_components.haus_visualisierung.const import HOUSE_MODE_NAMES

DOMAIN = "haus_visualisierung"


async def _layout(hass, **house_mode):
    store = hass.data[DOMAIN]["store"]
    lay = dict(store.data)
    lay["house_mode"] = {**lay["house_mode"], **house_mode}
    await store.async_save(lay)
    await hass.async_block_till_done()


async def test_mode_entities_ws_and_rules(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _house(hass)
    reg = er.async_get(hass)
    from homeassistant.helpers import area_registry as ar
    flur = ar.async_get(hass).async_create("Flur").id
    e = reg.async_get_or_create("binary_sensor", "test", "flur_bewegung", suggested_object_id="flur_bewegung")
    reg.async_update_entity(e.entity_id, area_id=flur)
    motion = e.entity_id
    hass.states.async_set(motion, "off", {"device_class": "motion", "friendly_name": "Flur Bewegung"})
    monitor = await _setup(hass)
    await hass.async_block_till_done()

    # Entitäten
    sel = hass.states.get("select.hausmodus")
    assert sel and sel.state == "zuhause" and sel.attributes["options"] == ["zuhause", "nacht", "abwesend", "urlaub"]
    sens = hass.states.get("sensor.haus_alarme_aktiv")
    assert sens and sens.state == "0"

    # Bewegung bei „Zuhause“ → keine Meldung
    hass.states.async_set(motion, "on", {"device_class": "motion", "friendly_name": "Flur Bewegung"})
    await _tick(hass)
    assert not any(k.startswith("presence:") for k in monitor.book.alarms)

    # Websocket: Abwesend → Bewegung wird Alarm, Protokoll, Ereignis, select aktualisiert
    events = []
    hass.bus.async_listen("haus_visualisierung_modus", lambda ev: events.append(ev.data))
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/set_mode", "mode": "abwesend"})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["mode"] == "abwesend" and res["result"]["by"] == hass_admin_user.name
    await _tick(hass)
    assert hass.states.get("select.hausmodus").state == "abwesend"
    assert f"presence:{motion}" in monitor.book.alarms and monitor.book.alarms[f"presence:{motion}"]["level"] == "alarm"
    assert monitor.book.log[-2]["type"] == "modus" or any(x["type"] == "modus" for x in monitor.book.log)
    assert events[-1]["mode"] == "abwesend" and events[-1]["previous"] == "zuhause"
    s = hass.states.get("sensor.haus_alarme_aktiv")
    assert s.state == "1" and s.attributes["alarme"] == 1 and s.attributes["neu"] == 1

    # Eigene Regel nur bei „Nacht“
    store = hass.data[DOMAIN]["store"]
    lay = dict(store.data)
    lay["alerts"] = {**lay["alerts"], "rules": [{"entity": ids["kamin"], "op": "gt", "value": "50", "level": "warn", "modes": ["nacht"]}]}
    await store.async_save(lay)
    await _tick(hass)
    assert not any(k.startswith("rule:") for k in monitor.book.alarms)
    # select-Entität bedienen
    await hass.services.async_call("select", "select_option", {"entity_id": "select.hausmodus", "option": "nacht"}, blocking=True)
    await _tick(hass)
    assert monitor.house.mode == "nacht"
    assert any(k.startswith("rule:") for k in monitor.book.alarms)
    assert f"presence:{motion}" not in monitor.book.alarms  # Bewegung zählt nachts nicht (Standard: Abwesend, Urlaub)

    # Feste Regel auf Modi einschränken: Fenster nur Abwesend
    lay = dict(store.data)
    lay["alerts"] = {**lay["alerts"], "modes": {"contacts": ["abwesend"]}}
    await store.async_save(lay)
    hass.states.async_set(ids["fenster"], "on", {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"})
    await _tick(hass)
    assert f"contact:{ids['fenster']}" not in monitor.book.alarms
    assert store.data["alerts"]["modes"] == {"contacts": ["abwesend"]}

    # Code nur für Administratoren, nie im Layout/Abo
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/alarm_code", "code": "1234"})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["code"] is True
    assert monitor.book.code == "1234" and "1234" not in str(monitor.book.snapshot())
    assert monitor.house.status()["code"] is True


async def test_auto_persons_night_and_alarmo(hass: HomeAssistant) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    arm_away = async_mock_service(hass, "alarm_control_panel", "alarm_arm_away")
    disarm = async_mock_service(hass, "alarm_control_panel", "alarm_disarm")
    arm_night = async_mock_service(hass, "alarm_control_panel", "alarm_arm_night")
    await _house(hass)
    hass.states.async_set("person.tobias", "home", {})
    hass.states.async_set("person.anna", "home", {})
    hass.states.async_set("alarm_control_panel.alarmo", "disarmed", {"friendly_name": "Alarmo"})
    monitor = await _setup(hass)
    house = monitor.house
    await _layout(hass, alarmo_sync=True, away_delay=10)
    assert house.panel() == "alarm_control_panel.alarmo"
    await monitor.book._store.async_save(monitor.book._data())  # Speicher anlegen

    # Alle weg → nach 10 Min. Abwesend → Alarmo scharf (abwesend)
    hass.states.async_set("person.tobias", "not_home", {})
    hass.states.async_set("person.anna", "not_home", {})
    await hass.async_block_till_done()
    assert house.mode == "zuhause" and house.status()["away_pending"]
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(minutes=11))
    await hass.async_block_till_done()
    assert house.mode == "abwesend" and house.book.mode["by"] == "Automatik"
    assert arm_away and arm_away[-1].data["entity_id"] == "alarm_control_panel.alarmo"
    hass.states.async_set("alarm_control_panel.alarmo", "armed_away", {})  # Alarmo hat geschaltet
    await hass.async_block_till_done()
    assert house.mode == "abwesend"

    # Kurz weg und gleich zurück → kein Abwesend
    hass.states.async_set("person.anna", "home", {})
    await hass.async_block_till_done()
    assert house.mode == "zuhause"
    assert disarm, "Zuhause → Alarmo unscharf"
    hass.states.async_set("alarm_control_panel.alarmo", "disarmed", {})
    hass.states.async_set("person.anna", "not_home", {})
    await hass.async_block_till_done()
    hass.states.async_set("person.anna", "home", {})
    await hass.async_block_till_done()
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(minutes=30))
    await hass.async_block_till_done()
    assert house.mode == "zuhause" and not house.status()["away_pending"]

    # Alarmo extern auf „Nacht“ geschaltet → Hausmodus folgt, ohne zurückzuschalten
    n = len(arm_night)
    hass.states.async_set("alarm_control_panel.alarmo", "armed_night", {})
    await hass.async_block_till_done()
    assert house.mode == "nacht" and house.book.mode["by"] == "Alarmanlage" and len(arm_night) == n
    # Alarmo unscharf, obwohl Nacht scharf sein soll → Zuhause
    hass.states.async_set("alarm_control_panel.alarmo", "disarmed", {})
    await hass.async_block_till_done()
    assert house.mode == "zuhause"

    # Nacht nach Uhrzeit
    await _layout(hass, auto_night=True, night_start="23:00", night_end="06:30")
    house._night_start(None)
    assert house.mode == "nacht"
    house._night_end(None)
    assert house.mode == "zuhause"
    # Urlaub bleibt bei Nacht-Start unverändert
    house.set_mode("urlaub", "Tobias")
    house._night_start(None)
    assert house.mode == "urlaub"

    # Hausmodus aus → immer Zuhause
    await _layout(hass, enabled=False)
    assert house.mode == "zuhause"


@pytest.mark.parametrize("mode", ["abwesend", "urlaub"])
async def test_manual_away_survives_person_updates(hass: HomeAssistant, mode: str) -> None:
    """Abwesend/Urlaub von Hand, während eine Person noch als „home“ gilt: Standort-Updates
    der Companion-App (gleicher Zustand, neue Attribute) dürfen den Modus nicht auf Zuhause
    zurücksetzen – sonst kommt bei Bewegung kein Alarm. Erst eine echte Ankunft schaltet zurück."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    await _house(hass)
    reg = er.async_get(hass)
    from homeassistant.helpers import area_registry as ar
    flur = ar.async_get(hass).async_create("Flur").id
    e = reg.async_get_or_create("binary_sensor", "test", "flur_bewegung", suggested_object_id="flur_bewegung")
    reg.async_update_entity(e.entity_id, area_id=flur)
    motion = e.entity_id
    attrs = {"device_class": "motion", "friendly_name": "Flur Bewegung"}
    hass.states.async_set(motion, "off", attrs)
    hass.states.async_set("person.tobias", "home", {"latitude": 50.0})
    hass.states.async_set("person.anna", "not_home", {"latitude": 48.0})
    monitor = await _setup(hass)
    await hass.async_block_till_done()

    monitor.house.set_mode(mode, "Tobias")
    await _tick(hass)
    hass.states.async_set("person.tobias", "home", {"latitude": 50.001})  # nur neuer Standort
    hass.states.async_set("person.anna", "not_home", {"latitude": 48.1})
    await _tick(hass)
    assert monitor.house.mode == mode

    # Bewegung → Alarm im Alarmmanager und Push
    hass.states.async_set(motion, "on", attrs)
    await _tick(hass)
    key = f"presence:{motion}"
    assert key in monitor.book.alarms and monitor.book.alarms[key]["level"] == "alarm"
    pushed = [c for c in calls if c.data.get("title") == "🏠 Flur: Bewegung erkannt"]
    assert len(pushed) == 1 and pushed[0].data["data"]["push"]["interruption-level"] == "critical"
    assert HOUSE_MODE_NAMES[mode] in pushed[0].data["message"]

    # Echte Ankunft (Wechsel auf „home“) → Zuhause
    hass.states.async_set("person.anna", "home", {"latitude": 50.0})
    await _tick(hass)
    assert monitor.house.mode == "zuhause"


async def test_alarm_panel_triggered(hass: HomeAssistant) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    await _house(hass)
    hass.states.async_set("alarm_control_panel.alarmo", "armed_away", {"friendly_name": "Alarmo"})
    monitor = await _setup(hass)
    hass.states.async_set("alarm_control_panel.alarmo", "triggered", {"friendly_name": "Alarmo"})
    await _tick(hass)
    a = monitor.book.alarms.get("alarmpanel:alarm_control_panel.alarmo")
    assert a and a["level"] == "alarm" and a["title"] == "Alarmo ausgelöst"


def test_check_settings_sanitized() -> None:
    """Gute-Nacht-Check: Schalter und eigene Geräte werden geprüft, Standard ist an."""
    from custom_components.haus_visualisierung.store import sanitize

    hm = sanitize({})["house_mode"]
    assert hm["check"] is True and hm["check_devices"] == []
    hm = sanitize({"house_mode": {"check": False, "check_devices": ["switch.buegeleisen", "kein_punkt", 3, ""]}})["house_mode"]
    assert hm["check"] is False and hm["check_devices"] == ["switch.buegeleisen"]
    assert sanitize({"house_mode": {"check": "ja"}})["house_mode"]["check"] is True
