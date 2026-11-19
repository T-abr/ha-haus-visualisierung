"""Push-Benachrichtigungen für Warnungen (pytest tests/backend)."""
from datetime import timedelta

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    async_fire_time_changed,
    async_mock_service,
)

from custom_components.haus_visualisierung.const import DOMAIN


def _ent(hass, reg, area_id, domain, obj, state, attrs, category=None):
    entry = reg.async_get_or_create(domain, "test", obj, suggested_object_id=obj, entity_category=category)
    reg.async_update_entity(entry.entity_id, area_id=area_id)
    hass.states.async_set(entry.entity_id, state, attrs)
    return entry.entity_id


async def _house(hass: HomeAssistant):
    areas = ar.async_get(hass)
    schlaf = areas.async_create("Schlafzimmer").id
    bad = areas.async_create("Bad").id
    wohn = areas.async_create("Wohnzimmer").id
    reg = er.async_get(hass)
    ids = {
        "fenster": _ent(hass, reg, schlaf, "binary_sensor", "schlafzimmer_fenster", "off", {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"}),
        "badfenster": _ent(hass, reg, bad, "binary_sensor", "bad_fenster", "off", {"device_class": "window", "friendly_name": "Bad Fenster"}),
        "badheiz": _ent(hass, reg, bad, "climate", "bad_heizung", "heat", {"hvac_action": "idle", "friendly_name": "Bad Heizung"}),
        "rauch": _ent(hass, reg, wohn, "binary_sensor", "wohnzimmer_rauch", "off", {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"}),
        "kamin": _ent(hass, reg, wohn, "sensor", "kamin", "60", {"device_class": "temperature", "unit_of_measurement": "°C", "friendly_name": "Kamin"}),
        "batt": _ent(hass, reg, schlaf, "sensor", "fenster_batt", "80", {"device_class": "battery", "unit_of_measurement": "%"}, er.EntityCategory.DIAGNOSTIC),
    }
    return ids


async def _setup(hass: HomeAssistant):
    assert await async_setup_component(hass, "http", {})
    res = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    await hass.config_entries.flow.async_configure(res["flow_id"], {"name": "Haus", "icon": "mdi:home", "require_admin": False})
    await hass.async_block_till_done()
    return hass.data[DOMAIN]["monitor"]


async def _tick(hass, seconds=2):
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=seconds))
    await hass.async_block_till_done()


async def test_push_flow(hass: HomeAssistant, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    async_mock_service(hass, "notify", "persistent_notification")
    ids = await _house(hass)
    monitor = await _setup(hass)
    assert monitor.targets() == ["mobile_app_handy"]

    # Fenster öffnen → Warnung
    hass.states.async_set(ids["fenster"], "on", {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"})
    await _tick(hass)
    assert len(calls) == 1
    d = calls[0].data
    assert d["title"] == "🏠 Schlafzimmer · Fenster offen"
    assert d["data"]["push"]["interruption-level"] == "time-sensitive"
    assert d["data"]["url"] == "/haus-visualisierung/sicherheit" and d["data"]["tag"].startswith("hv_contact")

    # Fenster schließen → Meldung wird entfernt
    hass.states.async_set(ids["fenster"], "off", {"device_class": "window"})
    await _tick(hass)
    assert calls[-1].data == {"message": "clear_notification", "data": {"tag": d["data"]["tag"]}}

    # erneut öffnen innerhalb der Sperrzeit → keine zweite Meldung
    n = len(calls)
    hass.states.async_set(ids["fenster"], "on", {"device_class": "window"})
    await _tick(hass)
    assert len(calls) == n

    # Rauchmelder → kritischer Alarm
    hass.states.async_set(ids["rauch"], "on", {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"})
    await _tick(hass)
    alarm = calls[-1].data
    assert alarm["title"] == "🏠 Wohnzimmer · Rauchmelder"
    assert alarm["data"]["push"]["interruption-level"] == "critical" and alarm["data"]["push"]["sound"]["critical"] == 1
    assert alarm["data"]["channel"] == "alarm_stream"

    # Fenster im Bad offen, während geheizt wird → zusammengefasst
    hass.states.async_set(ids["badheiz"], "heat", {"hvac_action": "heating"})
    hass.states.async_set(ids["badfenster"], "on", {"device_class": "window", "friendly_name": "Bad Fenster"})
    await _tick(hass)
    titles = [c.data.get("title") for c in calls]
    assert "🏠 Fenster offen beim Heizen · Bad" in titles and "🏠 Bad · Fenster offen" not in titles

    # eigene Regel (Hinweis) und Stufen-Filter, Diagnose-Batterie über feste Regel
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/save", "layout": {
        "alerts": {"builtin": {"battery": True}, "rules": [{"title": "Kamin sehr heiß", "entity": ids["kamin"], "op": "gt", "value": "85", "level": "info"}]},
        "push": {"levels": {"info": False}, "resolved": "notify"}}})
    await client.receive_json()
    await _tick(hass)
    n = len(calls)
    hass.states.async_set(ids["kamin"], "90", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass)
    assert len(calls) == n  # Hinweise abgeschaltet
    assert any(a["title"] == "Kamin sehr heiß" for a in monitor.status()["active"])
    hass.states.async_set(ids["batt"], "5", {"device_class": "battery", "unit_of_measurement": "%", "friendly_name": "Schlafzimmer Fensterkontakt Batterie"})
    await _tick(hass)
    assert calls[-1].data["title"] == "🏠 Schlafzimmer · Fensterkontakt Batterie fast leer" and calls[-1].data["message"] == "5 %"
    # Entwarnung statt Entfernen
    hass.states.async_set(ids["rauch"], "off", {"device_class": "smoke"})
    await _tick(hass)
    assert calls[-1].data["title"] == "🏠 Erledigt: Wohnzimmer · Rauchmelder"

    # Info und Test über den Websocket
    await client.send_json({"id": 2, "type": f"{DOMAIN}/push_info"})
    info = (await client.receive_json())["result"]
    assert "mobile_app_handy" in info["services"] and info["targets"] == ["mobile_app_handy"]
    n = len(calls)
    await client.send_json({"id": 3, "type": f"{DOMAIN}/push_test"})
    assert (await client.receive_json())["result"]["targets"] == ["mobile_app_handy"]
    await hass.async_block_till_done()
    assert len(calls) == n + 1 and calls[-1].data["title"] == "🏠 Testmeldung der Haus Visualisierung"

    # Push aus → keine Meldungen mehr
    await client.send_json({"id": 4, "type": f"{DOMAIN}/save", "layout": {"push": {"enabled": False}}})
    await client.receive_json()
    n = len(calls)
    hass.states.async_set(ids["rauch"], "on", {"device_class": "smoke"})
    await _tick(hass)
    assert len(calls) == n


async def test_restart_baseline(hass: HomeAssistant) -> None:
    """Nach dem Start: offene Fenster still übernehmen, Alarme trotzdem melden."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _house(hass)
    hass.states.async_set(ids["fenster"], "on", {"device_class": "window"})
    hass.states.async_set(ids["rauch"], "on", {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"})
    await _setup(hass)
    await _tick(hass)
    titles = [c.data["title"] for c in calls]
    assert titles == ["🏠 Wohnzimmer · Rauchmelder"]
