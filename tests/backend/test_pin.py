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


def _code(pin: str, key: str) -> str:
    """So verschleiert die Firmware die Eingabe: (Ziffer + Schlüsselziffer) mod 10."""
    return "".join(str((int(c) + int(key[i])) % 10) for i, c in enumerate(pin))


async def test_display_tastenfeld(hass: HomeAssistant) -> None:
    async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    unlock = async_mock_service(hass, "lock", "unlock")
    reg = er.async_get(hass)
    flur = ar.async_get(hass).async_create("Flur").id
    _ent(hass, reg, flur, "lock", "haustuer", "locked", {"friendly_name": "Haustür"})
    monitor = await _setup(hass)
    hub = hass.data[DOMAIN]["displays"]
    await hass.data[DOMAIN]["store"].async_save({"displays": [{"name": "Flur", "device": "haus-display-a1b2c3", "tiles": ["entity:lock.haustuer"]}]})
    monitor.book.pin = pn.make_hash("2580")
    monitor.house.set_mode("abwesend", "Test", "manual")
    await _tick(hass)

    async def tap(ziel: str) -> None:
        await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": ziel}, blocking=True)
        await hass.async_block_till_done()

    def ask() -> dict | None:
        return json.loads(hub.payloads["flur"]["pin"])

    assert ask() is None
    # geschützter Tipp öffnet das Tastenfeld
    await tap("kachel:0")
    req = ask()
    assert req["t"] == "Tür öffnen" and req["f"] == "" and len(req["k"]) == 8 and not unlock
    # Abbrechen schließt es
    await tap("pin:")
    assert ask() is None and not unlock
    # falsche PIN: Fehler, neuer Schlüssel, nichts ausgeführt
    await tap("kachel:0")
    n, key = ask()["n"], ask()["k"]
    await tap("pin:" + _code("1111", key))
    req = ask()
    assert req["f"] == "Falsche PIN" and req["n"] == n and req["k"] != key and not unlock
    # Klartext-PIN gilt nicht (verschleiert mit dem Schlüssel)
    if _code("2580", req["k"]) != "2580":
        await tap("pin:2580")
        assert ask() is not None and not unlock
    # richtige PIN: Aktion läuft, Tastenfeld zu, 30 s entsperrt
    await tap("pin:" + _code("2580", ask()["k"]))
    assert ask() is None and len(unlock) == 1
    await tap("modus:zuhause")
    assert monitor.house.mode == "zuhause" and ask() is None
    # nach Ablauf wieder gesperrt
    hub._unlocked.clear()
    monitor.house.set_mode("nacht", "Test", "manual")
    await tap("modus:zuhause")
    assert monitor.house.mode == "nacht" and ask()["t"] == "Alarm aus"
    # 5 Fehlversuche sperren das Display
    for _ in range(5):
        await tap("pin:" + _code("0000", ask()["k"]))
    assert "gesperrt" in ask()["f"]
    await tap("pin:" + _code("2580", ask()["k"]))
    assert monitor.house.mode == "nacht"
