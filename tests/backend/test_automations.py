"""Seite „Automationen“: Liste, Ein-/Ausschalten und Schutz für Nicht-Administratoren (pytest tests/backend)."""
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from test_push import _setup

from custom_components.haus_visualisierung.const import DOMAIN

AUTOS = {"automation": [
    {"id": "1001", "alias": "Flurlicht abends", "description": "Licht bei Sonnenuntergang",
     "trigger": {"platform": "event", "event_type": "test_flur"}, "action": []},
    {"alias": "Alte Regel", "trigger": {"platform": "event", "event_type": "test_alt"}, "action": []},
]}


async def _autos(hass: HomeAssistant) -> None:
    await _setup(hass)
    assert await async_setup_component(hass, "automation", AUTOS)
    await hass.async_block_till_done()


async def test_liste_und_schalten(hass: HomeAssistant, hass_ws_client) -> None:
    await _autos(hass)
    area = ar.async_get(hass).async_create("Flur")
    er.async_get(hass).async_update_entity("automation.flurlicht_abends", area_id=area.id)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/automations"})
    msg = await client.receive_json()
    assert msg["success"]
    items = msg["result"]["automations"]
    assert [a["name"] for a in items] == ["Alte Regel", "Flurlicht abends"]
    fl = items[1]
    assert fl["entity_id"] == "automation.flurlicht_abends" and fl["state"] == "on" and fl["id"] == "1001"
    assert fl["area"] == "Flur" and fl["description"] == "Licht bei Sonnenuntergang"
    assert items[0]["id"] is None  # YAML ohne id: nicht im Editor bearbeitbar

    await client.send_json({"id": 2, "type": f"{DOMAIN}/automation_set", "entity_id": "automation.flurlicht_abends", "enabled": False})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"]["state"] == "off"
    assert hass.states.get("automation.flurlicht_abends").state == "off"
    await client.send_json({"id": 3, "type": f"{DOMAIN}/automation_set", "entity_id": "automation.flurlicht_abends", "enabled": True})
    assert (await client.receive_json())["result"]["state"] == "on"

    # Nur Automationen, nur vorhandene
    await client.send_json({"id": 4, "type": f"{DOMAIN}/automation_set", "entity_id": "light.flur", "enabled": True})
    assert not (await client.receive_json())["success"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/automation_set", "entity_id": "automation.gibts_nicht", "enabled": True})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "not_found"


async def test_nur_admin(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _autos(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/automations"})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    await client.send_json({"id": 2, "type": f"{DOMAIN}/automation_set", "entity_id": "automation.flurlicht_abends", "enabled": False})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    assert hass.states.get("automation.flurlicht_abends").state == "on"
