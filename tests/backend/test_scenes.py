"""Szenen je Raum: Bereinigen, Entitäten scene.haus_<id>, Schalten und Ausprobieren (pytest tests/backend)."""
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.scenes import sanitize_scenes

from test_integration import _setup

KINO = {
    "name": "Kino",
    "icon": "mdi:movie-open",
    "area": "wohnzimmer",
    "ents": {
        "light.decke": {"on": False},
        "light.stehlampe": {"on": True, "bri": 30, "color": "#FFA050"},
        "light.spots": {"on": True, "bri": 10, "ct": 2700},
        "cover.rollo": {"pos": 0},
        "cover.einfach": {"pos": 80},
        "switch.tv": {"on": True},
    },
}


def test_sanitize_scenes() -> None:
    out = sanitize_scenes({
        "wohnzimmer_kino": KINO,
        "Böse ID": KINO,                                          # ungültige ID
        "leer": {"name": "Leer", "ents": {"sensor.x": {"on": True}}},  # keine schaltbare Entität
        "ohne_name": {"name": " ", "ents": {"light.a": {"on": True}}},
        "x": {"name": "X", "icon": "javascript:alert(1)", "ents": {"light.a": {"on": True, "bri": 500, "color": "rot"}, "cover.b": {"pos": "auf"}}},
    })
    assert list(out) == ["wohnzimmer_kino", "x"]
    k = out["wohnzimmer_kino"]["ents"]
    assert k["light.stehlampe"] == {"on": True, "bri": 30, "color": "#ffa050"}
    assert k["light.spots"] == {"on": True, "bri": 10, "ct": 2700}
    assert k["light.decke"] == {"on": False}
    assert out["x"] == {"name": "X", "icon": "mdi:palette", "area": "", "ents": {"light.a": {"on": True, "bri": 100}}}


async def test_scene_entities(hass: HomeAssistant, hass_ws_client) -> None:
    area = ar.async_get(hass).async_create("Wohnzimmer")
    await _setup(hass)
    hass.states.async_set("light.decke", "on")
    hass.states.async_set("light.stehlampe", "off")
    hass.states.async_set("light.spots", "off")
    hass.states.async_set("cover.rollo", "open", {"supported_features": 15})
    hass.states.async_set("cover.einfach", "closed", {"supported_features": 3})
    hass.states.async_set("switch.tv", "off")
    light_on = async_mock_service(hass, "light", "turn_on")
    light_off = async_mock_service(hass, "light", "turn_off")
    pos = async_mock_service(hass, "cover", "set_cover_position")
    cover_open = async_mock_service(hass, "cover", "open_cover")
    sw_on = async_mock_service(hass, "switch", "turn_on")

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/save",
                            "changes": [{"path": ["scenes", "wohnzimmer_kino"], "value": {**KINO, "area": area.id}}]})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()

    st = hass.states.get("scene.haus_wohnzimmer_kino")
    assert st is not None and st.name == "Kino" and st.attributes["icon"] == "mdi:movie-open"
    assert st.attributes["haus_szene"] == "wohnzimmer_kino"
    assert er.async_get(hass).async_get("scene.haus_wohnzimmer_kino").area_id == area.id

    await hass.services.async_call("scene", "turn_on", {"entity_id": "scene.haus_wohnzimmer_kino"}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in light_off] == ["light.decke"]
    on = {c.data["entity_id"]: dict(c.data) for c in light_on}
    assert on["light.stehlampe"]["brightness_pct"] == 30 and list(on["light.stehlampe"]["rgb_color"]) == [255, 160, 80]
    assert on["light.spots"]["color_temp_kelvin"] == 2700
    assert [(c.data["entity_id"], c.data["position"]) for c in pos] == [("cover.rollo", 0)]
    assert [c.data["entity_id"] for c in cover_open] == ["cover.einfach"]  # ohne Positionsfunktion: auf ab 50 %
    assert [c.data["entity_id"] for c in sw_on] == ["switch.tv"]

    # Umbenennen ändert die Entität, Löschen entfernt sie
    await client.send_json({"id": 2, "type": f"{DOMAIN}/save",
                            "changes": [{"path": ["scenes", "wohnzimmer_kino", "name"], "value": "Filmabend"}]})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert hass.states.get("scene.haus_wohnzimmer_kino").name == "Filmabend"

    # Ausprobieren ohne Speichern
    n = len(light_off)
    await client.send_json({"id": 3, "type": f"{DOMAIN}/scene_test", "ents": {"light.decke": {"on": False}, "sensor.x": {"on": True}}})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"]["calls"] == 1
    await hass.async_block_till_done()
    assert len(light_off) == n + 1

    await client.send_json({"id": 4, "type": f"{DOMAIN}/save", "changes": [{"path": ["scenes", "wohnzimmer_kino"], "delete": True}]})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert hass.states.get("scene.haus_wohnzimmer_kino") is None
    assert er.async_get(hass).async_get("scene.haus_wohnzimmer_kino") is None
