"""PIN für heikle Aktionen: setzen, prüfen mit Sperre, Hausmodus-Status und Sperre am Wanddisplay."""
import json

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung import pin as pn
from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.store import sanitize


def test_regeln() -> None:
    h = pn.make_hash("1234")
    assert "1234" not in json.dumps(h) and pn.verify(h, "1234") and not pn.verify(h, "1235") and not pn.verify({}, "1234")
    assert pn.mode_kind("abwesend", "zuhause") == "disarm" and pn.mode_kind("nacht", "zuhause") == "disarm"
    assert pn.mode_kind("zuhause", "nacht") is None and pn.mode_kind("zuhause", "abwesend") == "arm" and pn.mode_kind("urlaub", "urlaub") is None
    cfg = sanitize({})["pin"]
    assert cfg == {"door": True, "disarm": True, "arm": False, "scope": "wall"}
    assert pn.needs(cfg, "door", True) and not pn.needs(cfg, "door", False) and not pn.needs(cfg, "arm", True)
    assert pn.needs({**cfg, "scope": "all"}, "disarm", False)
    assert sanitize({"pin": {"door": "ja", "arm": True, "scope": "überall"}})["pin"] == {**cfg, "arm": True}


async def test_pin_setzen_und_pruefen(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    monitor = await _setup(hass)
    client = await hass_ws_client(hass)
    # ohne PIN ist alles erlaubt
    await client.send_json({"id": 1, "type": f"{DOMAIN}/pin_check", "pin": ""})
    assert (await client.receive_json())["result"] == {"ok": True, "pin": False}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/pin_set", "pin": "12a"})
    assert (await client.receive_json())["error"]["code"] == "invalid"
    await client.send_json({"id": 3, "type": f"{DOMAIN}/pin_set", "pin": "2468"})
    assert (await client.receive_json())["result"] == {"pin": True}
    assert monitor.house.status()["pin"] is True and "2468" not in json.dumps(monitor.book._data())
    await client.send_json({"id": 4, "type": f"{DOMAIN}/pin_check", "pin": "2468"})
    assert (await client.receive_json())["result"] == {"ok": True}
    # fünf Fehlversuche → gesperrt, auch die richtige PIN
    for i in range(5):
        await client.send_json({"id": 10 + i, "type": f"{DOMAIN}/pin_check", "pin": "0000"})
        res = (await client.receive_json())["result"]
        assert res["ok"] is False
    assert res["wait"] > 0
    await client.send_json({"id": 20, "type": f"{DOMAIN}/pin_check", "pin": "2468"})
    assert (await client.receive_json())["result"]["ok"] is False
    pn_throttle = __import__("custom_components.haus_visualisierung.websocket", fromlist=["_THROTTLE"])._THROTTLE
    pn_throttle._fails.clear()
    # löschen
    await client.send_json({"id": 21, "type": f"{DOMAIN}/pin_set", "pin": ""})
    assert (await client.receive_json())["result"] == {"pin": False}
    assert monitor.house.status()["pin"] is False


async def test_pin_nur_admin_setzt(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/pin_set", "pin": "1234"})
    assert (await client.receive_json())["error"]["code"] == "unauthorized"


async def test_display_gesperrt(hass: HomeAssistant) -> None:
    async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    unlock = async_mock_service(hass, "lock", "unlock")
    reg = er.async_get(hass)
    flur = ar.async_get(hass).async_create("Flur").id
    _ent(hass, reg, flur, "lock", "haustuer", "locked", {"friendly_name": "Haustür"})
    monitor = await _setup(hass)
    hub = hass.data[DOMAIN]["displays"]
    await hass.data[DOMAIN]["store"].async_save({"displays": [{"name": "Flur", "device": "haus-display-a1b2c3", "tiles": ["entity:lock.haustuer"]}]})
    monitor.house.set_mode("abwesend", "Test", "manual")
    await _tick(hass)

    async def tap(ziel: str) -> None:
        await hass.services.async_call(DOMAIN, "display_tap", {"display": "flur", "ziel": ziel}, blocking=True)
        await hass.async_block_till_done()

    # ohne PIN: geht
    await tap("kachel:0")
    assert len(unlock) == 1
    # mit PIN: Entriegeln und „Zuhause“ gesperrt, Hinweis am Display
    monitor.book.pin = pn.make_hash("1234")
    await tap("kachel:0")
    assert len(unlock) == 1
    note = json.loads(hub.payloads["flur"]["hinweis"])
    assert note["i"] == "lock" and "PIN" in note["n"]
    await tap("modus:zuhause")
    assert monitor.house.mode == "abwesend"
    # Nacht braucht keine PIN; Schutz „Alarm aus“ abgeschaltet → Zuhause geht
    await tap("modus:nacht")
    assert monitor.house.mode == "nacht"
    await hass.data[DOMAIN]["store"].async_save({**hass.data[DOMAIN]["store"].data, "pin": {"disarm": False}})
    await tap("modus:zuhause")
    assert monitor.house.mode == "zuhause"
