"""Wanddisplays: Einstellungen, Entität je Display (Protokoll v1), Inhalte und Tippen (pytest tests/backend)."""
import json
from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant, SupportsResponse
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.display import PROTOCOL, bin_of, de, device_service, kw, sanitize_displays
from custom_components.haus_visualisierung.store import sanitize

PWR = {"device_class": "power", "unit_of_measurement": "W"}


def test_sanitize() -> None:
    assert sanitize({})["displays"] == []
    out = sanitize({"displays": [
        {"name": "Flur Oben", "pages": ["klima", "haus", "unsinn", "klima"], "tiles": ["pv_jetzt", "x", "entity:light.flur", "entity:<b>"],
         "bright_day": 500, "bright_night": -3, "hint": False},
        {"name": "Flur Oben", "custom": [
            {"name": "Wohnzimmer mit sehr langem Namen", "icon": "mdi:sofa", "tiles": [
                {"entity": "light.decke", "name": "Decke", "icon": "mdi:ceiling-light"}, {"entity": "<b>"}, "x",
                {"entity": "scene.abend", "icon": "mdi:gibtsnicht"}] + [{"entity": f"light.l{i}"} for i in range(8)]},
            {}, "kaputt", {"name": "B"}, {"name": "C"}, {"name": "D"}]}, "kaputt", {"id": "!!"},
    ] + [{"name": f"d{i}"} for i in range(9)]})["displays"]
    a, b, c = out[:3]
    assert a == {"id": "flur_oben", "name": "Flur Oben", "pages": ["start", "klima", "haus"], "tiles": ["pv_jetzt", "entity:light.flur"],
                 "hint": False, "bright_day": 100, "bright_night": 0, "wake": True, "device": "", "custom": [],
                 "saver": False, "saver_min": 5, "saver_bright": 20, "bell": True}
    assert b["id"] == "flur_oben_2" and b["tiles"] == ["pv_jetzt", "energie_heute", "klima_mittel", "morgen"] and b["pages"] == ["start"]
    wz, leer, b3 = b["custom"]
    assert wz["name"] == "Wohnzimmer mit sehr" and wz["icon"] == "sofa" and len(wz["tiles"]) == 6
    assert wz["tiles"][:2] == [{"entity": "light.decke", "name": "Decke", "icon": "ceiling-light"}, {"entity": "scene.abend", "name": "", "icon": ""}]
    assert leer == {"name": "Seite 2", "icon": "view-dashboard", "tiles": []} and b3["name"] == "B"
    assert c["id"] == "display"
    assert len(out) == 6


def test_format() -> None:
    assert de(-0.2, 0) == "0" and de(-0.04, 1) == "0,0" and de(-1.4, 0) == "-1" and de(-1234.5, 1) == "-1.234,5"
    assert de(1234.56, 1) == "1.234,6" and kw(612) == "612 W" and kw(3240) == "3,2 kW" and kw(None) == "–"
    assert bin_of("Gelbe Tonne")[1] == "recycle" and bin_of("Restmüll")[1] == "trash-can-outline"


async def _house(hass: HomeAssistant) -> dict:
    areas = ar.async_get(hass)
    kueche, schlaf, garage = (areas.async_create(n).id for n in ("Küche", "Schlafzimmer", "Garage"))
    reg = er.async_get(hass)
    return {
        "licht": _ent(hass, reg, kueche, "light", "kueche_licht", "on", {"friendly_name": "Küche Licht"}),
        "kaffee": _ent(hass, reg, kueche, "switch", "kaffeemaschine", "on", {"friendly_name": "Kaffeemaschine"}),
        "temp_k": _ent(hass, reg, kueche, "sensor", "kueche_temp", "21.0", {"device_class": "temperature", "unit_of_measurement": "°C"}),
        "temp_s": _ent(hass, reg, schlaf, "sensor", "schlaf_temp", "19.0", {"device_class": "temperature", "unit_of_measurement": "°C"}),
        "hum_s": _ent(hass, reg, schlaf, "sensor", "schlaf_feuchte", "50", {"device_class": "humidity", "unit_of_measurement": "%"}),
        "fenster": _ent(hass, reg, schlaf, "binary_sensor", "schlafzimmer_fenster", "on", {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"}),
        "tor": _ent(hass, reg, garage, "cover", "garagentor", "open", {"device_class": "garage", "friendly_name": "Garagentor"}),
    }


def _attr(hass: HomeAssistant, eid: str, key: str):
    return json.loads(hass.states.get(eid).attributes[key])


async def test_display_flow(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    freezer.move_to(dt_util.start_of_local_day() + timedelta(hours=21, minutes=30))
    ids = await _house(hass)
    hass.states.async_set("sensor.pv", "3240", {**PWR, "friendly_name": "PV Leistung"})
    hass.states.async_set("sensor.netz", "-2400", {**PWR, "friendly_name": "Netz"})
    hass.states.async_set("sensor.haus", "612", {**PWR, "friendly_name": "Hausverbrauch"})
    hass.states.async_set("sensor.akku_soc", "78", {"device_class": "battery", "unit_of_measurement": "%"})
    hass.states.async_set("weather.home", "partlycloudy", {"temperature": 7.2, "friendly_name": "Zuhause"})
    hass.states.async_set("calendar.abfall", "off", {"friendly_name": "Abfallkalender"})
    tomorrow = (dt_util.now().date() + timedelta(days=1)).isoformat()
    async_mock_service(hass, "weather", "get_forecasts", supports_response=SupportsResponse.ONLY,
                       response={"weather.home": {"forecast": [{"temperature": 9}, {"temperature": 15.4}]}})
    async_mock_service(hass, "calendar", "get_events", supports_response=SupportsResponse.ONLY,
                       response={"calendar.abfall": {"events": [{"summary": "Gelbe Tonne", "start": tomorrow, "end": tomorrow}]}})
    lights = async_mock_service(hass, "light", "turn_off")
    covers = async_mock_service(hass, "cover", "close_cover")
    offs = async_mock_service(hass, "homeassistant", "turn_off")

    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    assert hass.states.get("sensor.haus_display_flur") is None
    await store.async_save({
        "header": {"pv": "sensor.pv", "grid": "sensor.netz", "power": "sensor.haus", "battery": "sensor.akku_soc"},
        "displays": [{"name": "Flur", "pages": ["energie", "klima", "haus"], "saver": True, "saver_min": 300}],
    })
    await _tick(hass)
    await _tick(hass)
    eid = "sensor.haus_display_flur"
    st = hass.states.get(eid)
    assert st is not None and st.state == str(PROTOCOL) and st.attributes["protokoll"] == PROTOCOL

    cfg = _attr(hass, eid, "einstellungen")
    assert cfg["seiten"] == ["start", "energie", "klima", "haus"] and cfg["hell_nacht"] == 10 and cfg["nacht"] is False
    assert cfg["schoner"] == 120 and cfg["schoner_hell"] == 20

    sv = _attr(hass, eid, "schoner")
    assert sv["zeile"] == [{"i": "weather-partly-cloudy", "t": "7°"}, {"i": "solar-power-variant", "t": "3,2 kW"},
                           {"i": "calendar", "t": "Morgen 15°"}, {"i": "home-account", "t": "Zuhause"}]
    assert sv["termine"] == [{"i": "recycle", "f": "#f2c230", "t": "Morgen: Gelbe Tonne", "hot": True}]
    assert sv["hinweis"] is None and sv["status"]["i"] in ("bell-alert", "alarm-light")

    kopf = _attr(hass, eid, "kopf")
    assert kopf["wetter"] == {"i": "weather-partly-cloudy", "t": "7°", "txt": "Teils bewölkt", "morgen": "morgen 15°"}
    assert kopf["modus"]["k"] == "zuhause" and kopf["modus"]["n"] == "Zuhause"

    pv, heute, klima, morgen = _attr(hass, eid, "kacheln")
    assert pv["v"] == "3,2 kW" and pv["s"] == "Haus 612 W · Netz −2,4 kW" and pv["b"] == 78 and pv["u"] == "Akku 78 %"
    assert pv["sr"] == "Haus #63c7ff 612 W# · Netz #b39cff −2,4 kW#"
    assert klima["vr"] == "20,0°  #9aa3b2 50 %#"
    assert heute["n"] == "Heute" and heute["v"].endswith("kWh")
    assert klima["v"] == "20,0°  50 %" and klima["u"] == "Außen 7,2°"
    assert morgen["n"] == "Morgen" and morgen["v"] == "Gelbe Tonne" and morgen["i"] == "recycle" and morgen["hot"] is True

    en = _attr(hass, eid, "energie")
    assert en["pv"] == "3,2 kW" and en["netz"] == "2,4 kW" and en["netz_n"] == "Einspeisung" and en["akku"] == "78 %"
    assert en["fluss"]["netz"] == -1

    rooms = _attr(hass, eid, "klima")
    assert [r["n"] for r in rooms] == ["Küche", "Schlafzimmer"] and rooms[1] == {"n": "Schlafzimmer", "t": "19,0°", "h": "50 %", "w": False}

    gn = _attr(hass, eid, "gute_nacht")
    assert gn["n"] == 4 and gn["txt"] == "4 Punkte sind noch offen."
    groups = [p["g"] for p in gn["p"]]
    assert groups == ["Garage & Tore", "Fenster & Türen", "Geräte", "Licht"]
    assert gn["p"][0] == {"g": "Garage & Tore", "i": "garage-open-variant", "n": "Garagentor", "s": "Garage · offen", "knopf": "Schließen", "ziel": f"gn:{ids['tor']}"}
    assert gn["p"][3]["n"] == "Licht" and gn["p"][3]["s"] == "Küche · an"

    hint = _attr(hass, eid, "hinweis")
    assert hint["n"] == "Gute Nacht" and hint["s"] == "4 Punkte offen" and hint["ziel"] == "seite:gute_nacht"

    haus = _attr(hass, eid, "haus")
    assert haus["modus"] == "zuhause" and [m[0] for m in haus["modi"]] == ["zuhause", "nacht", "abwesend", "urlaub"]
    assert any("Fenster" in m["t"] for m in haus["meldungen"])

    # Tippen: ein Punkt, unbekannter Punkt, unbekanntes Display, dann Hausmodus
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "flur", "ziel": f"gn:{ids['licht']}"}, blocking=True)
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "flur", "ziel": "gn:light.gibtsnicht"}, blocking=True)
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "keins", "ziel": "gn_alle"}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in lights] == [ids["licht"]] and not covers
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "flur", "ziel": "gn_alle"}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in covers] == [ids["tor"]] and [c.data["entity_id"] for c in offs] == [ids["kaffee"]]
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "flur", "ziel": "modus:nacht"}, blocking=True)
    await _tick(hass)
    assert monitor.house.mode == "nacht"
    assert _attr(hass, eid, "einstellungen")["nacht"] is True
    assert _attr(hass, eid, "kopf")["modus"]["k"] == "nacht"

    # Energie heute: 3,2 kW PV über 10 Minuten ≈ 0,5 kWh
    for _ in range(20):
        freezer.tick(timedelta(seconds=30))
        await _tick(hass, 31)
    heute = _attr(hass, eid, "kacheln")[1]
    assert heute["v"] in ("0,5 kWh", "0,6 kWh")

    # Display entfernen → Entität weg
    await store.async_save({**store.data, "displays": []})
    await _tick(hass)
    assert hass.states.get(eid) is None


def test_tap_service() -> None:
    from homeassistant.core import State
    from custom_components.haus_visualisierung.display import tap_service
    assert tap_service("light.flur", State("light.flur", "on")) == ("homeassistant", "toggle")
    assert tap_service("lock.tuer", State("lock.tuer", "locked")) == ("lock", "unlock")
    assert tap_service("lock.tuer", State("lock.tuer", "unlocked")) == ("lock", "lock")
    assert tap_service("scene.abend", None) == ("scene", "turn_on")
    assert tap_service("button.klingel", None) == ("button", "press")
    assert tap_service("sensor.temp", State("sensor.temp", "20")) is None


def test_device_field() -> None:
    out = sanitize_displays([{"name": "A", "device": "haus-display-a1b2c3"}, {"name": "B", "device": "haus-display-a1b2c3"},
                             {"name": "C", "device": "Böse Name!"}, {"name": "D"}])
    assert [d["device"] for d in out] == ["haus-display-a1b2c3", "", "", ""]
    assert device_service("haus-display-a1b2c3") == "haus_display_a1b2c3_haus_daten"


async def test_firmware_served(hass: HomeAssistant, hass_client) -> None:
    """Mitgelieferte Firmware: Version im Assistenten, Manifest und Bin über den statischen Pfad (ESP Web Tools)."""
    from custom_components.haus_visualisierung.display_setup import FIRMWARE_URL, firmware_version

    await _setup(hass)
    ver = hass.data[DOMAIN]["firmware"]
    assert ver and ver == await hass.async_add_executor_job(firmware_version)
    client = await hass_client()
    r = await client.get(f"{FIRMWARE_URL}/manifest.json")
    assert r.status == 200
    man = json.loads(await r.text())
    assert man["version"] == ver and man["builds"][0]["chipFamily"] == "ESP32-S3"
    part = man["builds"][0]["parts"][0]["path"]
    r = await client.get(f"{FIRMWARE_URL}/{part}")
    assert r.status == 200 and (await r.read())[:1] == b"\xe9"  # ESP-Abbild beginnt mit 0xE9


async def test_display_push_and_setup(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """Firmware 0.2: Gerät finden, übernehmen, zuordnen; Inhalte per Push, „hallo“, Tipp mit Gerätenamen."""
    calls = async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    fremd = async_mock_service(hass, "esphome", "haus_display_ffffff_haus_daten")
    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    entry = MockConfigEntry(domain="esphome", title="Haus Display a1b2c3", data={"device_name": "haus-display-a1b2c3", "host": "10.0.0.5"})
    entry.add_to_hass(hass)
    MockConfigEntry(domain="esphome", title="Steckdose", data={"device_name": "steckdose", "host": "10.0.0.6"}).add_to_hass(hass)
    neu = MockConfigEntry(domain="esphome", title="Haus Display b2c3d4", data={"device_name": "haus-display-b2c3d4", "host": "10.0.0.7"})
    monkeypatch.setattr(hass.config_entries.flow, "async_progress_by_handler", lambda handler, **kw: [
        {"flow_id": "f1", "handler": "esphome", "context": {"source": "zeroconf", "title_placeholders": {"name": "Haus Display b2c3d4"}}},
        {"flow_id": "f2", "handler": "esphome", "context": {"source": "zeroconf", "title_placeholders": {"name": "wohnzimmer-licht"}}}])

    async def _configure(flow_id, user_input=None):
        assert flow_id == "f1" and user_input == {}
        neu.add_to_hass(hass)
        return {"type": "create_entry", "result": neu}

    monkeypatch.setattr(hass.config_entries.flow, "async_configure", _configure)

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/display_devices"})
    res = (await ws.receive_json())["result"]
    assert res["firmware"]["manifest"].endswith("/manifest.json")
    devs = {d["name"]: d for d in res["devices"]}
    assert set(devs) == {"haus-display-a1b2c3", "haus-display-b2c3d4"}
    assert devs["haus-display-a1b2c3"]["ready"] is True and devs["haus-display-a1b2c3"]["allowed"] is False
    assert devs["haus-display-b2c3d4"]["flow_id"] == "f1" and devs["haus-display-b2c3d4"]["entry_id"] is None

    # Übernehmen: vorhandenes Gerät (nur Aktionen erlauben) und gefundenes (Erkennung bestätigen)
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/display_adopt", "entry_id": entry.entry_id})
    assert (await ws.receive_json())["result"] == {"ok": True, "entry_id": entry.entry_id, "name": "haus-display-a1b2c3"}
    assert entry.options["allow_service_calls"] is True
    await ws.send_json({"id": 3, "type": f"{DOMAIN}/display_adopt", "flow_id": "f1"})
    assert (await ws.receive_json())["result"]["name"] == "haus-display-b2c3d4"
    assert neu.options["allow_service_calls"] is True
    await ws.send_json({"id": 4, "type": f"{DOMAIN}/display_adopt", "entry_id": "gibtsnicht"})
    assert (await ws.receive_json())["result"]["ok"] is False

    # Zuordnen → alle Bereiche gehen ans Gerät, danach nur Änderungen
    await store.async_save({"displays": [{"name": "Flur", "device": "haus-display-a1b2c3"}]})
    await _tick(hass)
    await _tick(hass)
    sent = {c.data["bereich"]: c.data["daten"] for c in calls}
    assert sent["protokoll"] == str(PROTOCOL) and json.loads(sent["einstellungen"])["name"] == "Flur"
    # leeres Haus ohne Meldungen: ruhige Hinweiszeile statt leerer Fläche
    assert json.loads(sent["hinweis"]) == {"i": "shield-check", "f": "#4fd18b", "n": "Alles in Ordnung", "s": "Keine offenen Meldungen", "knopf": "", "ziel": ""}
    assert set(sent) == {"protokoll", "einstellungen", "kopf", "kacheln", "hinweis", "energie", "klima", "gute_nacht", "schoner", "klingel", "eigene", "haus"}
    assert json.loads(sent["schoner"]) is None
    assert json.loads(sent["eigene"]) == []
    assert json.loads(sent["klingel"]) is None
    n = len(calls)
    await _tick(hass, 31)
    assert len(calls) == n

    await ws.send_json({"id": 5, "type": f"{DOMAIN}/display_devices"})
    assert {d["name"]: d["display"] for d in (await ws.receive_json())["result"]["devices"]}["haus-display-a1b2c3"] == "flur"

    # „hallo“ nach dem Verbinden → alles neu; Tipp mit Gerätenamen wirkt auf das zugeordnete Display
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": "hallo"}, blocking=True)
    await hass.async_block_till_done()
    assert len(calls) == n + 12
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": "modus:abwesend"}, blocking=True)
    await _tick(hass)
    assert monitor.house.mode == "abwesend"
    assert json.loads([c.data["daten"] for c in calls if c.data["bereich"] == "kopf"][-1])["modus"]["k"] == "abwesend"

    # Kachel antippen: entity:-Kachel schaltet, Szene löst aus, Anzeige-Kachel und falsche Nummer tun nichts
    toggles = async_mock_service(hass, "homeassistant", "toggle")
    scenes = async_mock_service(hass, "scene", "turn_on")
    hass.states.async_set("light.flur", "off")
    await store.async_save({**store.data, "displays": [{"name": "Flur", "device": "haus-display-a1b2c3",
                                                         "tiles": ["pv_jetzt", "entity:light.flur", "entity:scene.abend"]}]})
    await _tick(hass)
    for ziel in ("kachel:0", "kachel:1", "kachel:2", "kachel:7", "kachel:x"):
        await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": ziel}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in toggles] == ["light.flur"] and [c.data["entity_id"] for c in scenes] == ["scene.abend"]

    # Eigene Seite: Kacheln mit eigenem Namen/Symbol, Zustand der Entität, Tipp schaltet
    hass.states.async_set("light.decke", "on", {"friendly_name": "Decke Wohnzimmer", "icon": "mdi:unbekannt"})
    await store.async_save({**store.data, "displays": [{"name": "Flur", "device": "haus-display-a1b2c3", "custom": [
        {"name": "Wohnzimmer", "icon": "sofa", "tiles": [{"entity": "light.decke"}, {"entity": "light.flur", "name": "Gang", "icon": "lamp"}]}]}]})
    await _tick(hass)
    eigene = json.loads([c.data["daten"] for c in calls if c.data["bereich"] == "eigene"][-1])
    assert eigene[0]["n"] == "Wohnzimmer" and eigene[0]["i"] == "sofa"
    assert eigene[0]["k"][0]["i"] == "lightbulb-on" and eigene[0]["k"][0]["n"] == "Decke Wohnzimmer" and eigene[0]["k"][0]["v"] == "an"
    assert eigene[0]["k"][1]["n"] == "Gang" and eigene[0]["k"][1]["i"] == "lamp" and eigene[0]["k"][1]["v"] == "aus"
    for ziel in ("eigen:0:1", "eigen:0:5", "eigen:2:0", "eigen:x"):
        await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": ziel}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in toggles] == ["light.flur", "light.flur"]
    # Zustand ändert sich → nur der Bereich „eigene“ (und was davon abhängt) geht neu ans Gerät
    m = len(calls)
    hass.states.async_set("light.decke", "off", {"friendly_name": "Decke Wohnzimmer"})
    await _tick(hass)
    assert "eigene" in [c.data["bereich"] for c in calls[m:]]

    # Fremdes Gerät meldet sich → „nicht zugeordnet“; Zuordnung entfernen → Gerät zeigt das wieder
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-ffffff", "ziel": "hallo"}, blocking=True)
    await hass.async_block_till_done()
    assert [(c.data["bereich"], c.data["daten"]) for c in fremd] == [("protokoll", "")]
    await store.async_save({**store.data, "displays": [{"name": "Flur"}]})
    await _tick(hass)
    assert (calls[-1].data["bereich"], calls[-1].data["daten"]) == ("protokoll", "")


async def test_display_firmware_update(hass: HomeAssistant, hass_ws_client) -> None:
    """Update über das Netz: Update-Entität je Gerät, „Installieren“ und Websocket schicken Adresse und MD5 ans Gerät."""
    from homeassistant.exceptions import HomeAssistantError
    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er

    hass.config.internal_url = "http://10.0.0.2:8123"
    entry = MockConfigEntry(domain="esphome", title="Haus Display a1b2c3", data={"device_name": "haus-display-a1b2c3", "host": "10.0.0.5"})
    entry.add_to_hass(hass)
    dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, connections={(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:a1:b2:c3")},
                                           name="Haus Display a1b2c3", sw_version="0.3.0 (ESPHome 2026.11.0)")
    await _setup(hass)
    hass.data[DOMAIN]["firmware"] = "0.4.0"  # unabhängig von der mitgelieferten Version
    await _tick(hass, 31)
    eid = er.async_get(hass).async_get_entity_id("update", DOMAIN, "haus_display_firmware_haus-display-a1b2c3")
    assert eid
    st = hass.states.get(eid)
    assert st.state == "on" and st.attributes["installed_version"] == "0.3.0" and st.attributes["latest_version"] == "0.4.0"

    # Gerät ohne Aktion (Firmware vor 0.3.0 bzw. offline) → verständlicher Fehler
    try:
        await hass.services.async_call("update", "install", {"entity_id": eid}, blocking=True)
        raise AssertionError("Fehler erwartet")
    except HomeAssistantError as err:
        assert "per USB" in str(err)

    calls = async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_update")
    await hass.services.async_call("update", "install", {"entity_id": eid}, blocking=True)
    assert len(calls) == 1
    assert calls[0].data["adresse"].startswith("http://10.0.0.2:8123/haus_visualisierung_static/firmware/")
    assert calls[0].data["adresse"].endswith("/haus-display.ota.bin")
    assert calls[0].data["pruefsumme"] == hass.data[DOMAIN]["firmware_md5"] and len(calls[0].data["pruefsumme"]) == 32
    assert hass.states.get(eid).attributes["in_progress"] is True

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/display_devices"})
    dev = (await ws.receive_json())["result"]["devices"][0]
    assert dev["update"] is True and dev["ota"] is True and dev["version"] == "0.3.0"
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/display_update", "device": "haus-display-a1b2c3"})
    assert (await ws.receive_json())["result"] == {"ok": True, "version": "0.4.0"}
    await ws.send_json({"id": 3, "type": f"{DOMAIN}/display_update", "device": "haus-display-ffffff"})
    assert (await ws.receive_json())["result"]["ok"] is False
    assert len(calls) == 2


async def test_display_doorbell(hass: HomeAssistant, hass_ws_client, freezer: FrozenDateTimeFactory) -> None:
    """Klingel wie im Panel: Overlay mit Kamerabild, „Tür öffnen“ mit Impuls, Schließen nach der Zeit, Test aus dem Reiter."""
    calls = async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    hass.config.internal_url = "http://10.0.0.2:8123"
    reg = er.async_get(hass)
    from homeassistant.helpers import device_registry as dr
    cfg_entry = MockConfigEntry(domain="unifiprotect")
    cfg_entry.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=cfg_entry.entry_id, identifiers={("unifiprotect", "g4")})
    reg.async_get_or_create("event", "unifiprotect", "g4_ring", suggested_object_id="g4_doorbell", device_id=dev.id)
    reg.async_get_or_create("camera", "unifiprotect", "g4_cam", suggested_object_id="g4_hoch", device_id=dev.id)
    hass.states.async_set("camera.einfahrt", "idle", {"access_token": "falsch"})
    hass.states.async_set("camera.g4_hoch", "idle", {"access_token": "abc", "friendly_name": "Haustür"})
    # nach einem Neustart: Ereignis-Entität „unknown“ bis zum ersten Klingeln
    hass.states.async_set("event.g4_doorbell", "unknown", {"device_class": "doorbell"})
    hass.states.async_set("switch.tueroeffner", "off")
    await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    await store.async_save({"doorbell": {"lock": "switch.tueroeffner", "timeout": 30, "pulse": 2},
                            "displays": [{"name": "Flur", "device": "haus-display-a1b2c3"}, {"name": "Küche", "bell": False}]})
    await _tick(hass)
    last = lambda: json.loads([c.data["daten"] for c in calls if c.data["bereich"] == "klingel"][-1])  # noqa: E731
    assert last() is None
    hub = hass.data[DOMAIN]["displays"]
    assert hub.bell_entity() == "event.g4_doorbell" and hub.bell_camera() == "camera.g4_hoch"

    # Erstes Klingeln nach dem Neustart (unknown → Zeitstempel) → Overlay
    now = lambda: dt_util.utcnow().isoformat()  # noqa: E731
    hass.states.async_set("event.g4_doorbell", now(), {"device_class": "doorbell", "event_type": "ring"})
    await hass.async_block_till_done()
    k = last()
    assert k["t"] == "Es klingelt" and k["s"].startswith("Haustür · ") and k["tuer"] is True and k["offen"] is False
    assert k["bild"] == "http://10.0.0.2:8123/api/camera_proxy/camera.g4_hoch?token=abc&width=432&height=243"
    assert json.loads(hub.payloads["kueche"]["klingel"]) is None
    freezer.tick(timedelta(seconds=10))
    hass.states.async_set("event.g4_doorbell", now(), {"device_class": "doorbell", "event_type": "ring"})
    await hass.async_block_till_done()
    assert last()["t"] == "Es klingelt erneut" and last()["n"] == k["n"] + 1
    n2 = last()["n"]
    # nur Attribute geändert, oder Entität nach Verbindungsabbruch wieder da (alter Zeitstempel) → kein Klingeln
    st = hass.states.get("event.g4_doorbell").state
    hass.states.async_set("event.g4_doorbell", st, {"device_class": "doorbell", "event_type": "ring", "x": 1})
    hass.states.async_set("event.g4_doorbell", "unavailable", {"device_class": "doorbell"})
    hass.states.async_set("event.g4_doorbell", "2026-01-01T00:00:00+00:00", {"device_class": "doorbell", "event_type": "ring"})
    await hass.async_block_till_done()
    assert last()["n"] == n2

    # „Tür öffnen“ vom Display: Schalter ein, nach dem Impuls aus; Overlay bleibt noch kurz offen
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": "klingel:tuer"}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in on] == ["switch.tueroeffner"] and not off and last()["offen"] is True
    freezer.tick(timedelta(seconds=3))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in off] == ["switch.tueroeffner"]
    freezer.tick(timedelta(seconds=13))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert last() is None
    # ohne Klingeln tut „Tür öffnen“ nichts
    await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": "klingel:tuer"}, blocking=True)
    await hass.async_block_till_done()
    assert len(on) == 1

    # Test aus dem Reiter Displays; schließt nach der eingestellten Zeit
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/display_bell_test"})
    assert (await ws.receive_json())["result"] == {"ok": True}
    await hass.async_block_till_done()
    assert last()["t"] == "Test: Es klingelt"
    freezer.tick(timedelta(seconds=31))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert last() is None
    await store.async_save({**store.data, "displays": [{"name": "Flur", "device": "haus-display-a1b2c3", "bell": False}]})
    await _tick(hass)
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/display_bell_test"})
    assert (await ws.receive_json())["result"]["ok"] is False


async def test_display_stellen_und_rueckmeldung(hass: HomeAssistant) -> None:
    """Kacheln melden, ob ein Tipp schaltet (a) und ob sie per langem Tippen stellbar sind (w/wa); wert:-Tipps stellen."""
    calls = async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    on = async_mock_service(hass, "light", "turn_on")
    off = async_mock_service(hass, "light", "turn_off")
    pos = async_mock_service(hass, "cover", "set_cover_position")
    hass.states.async_set("light.decke", "on", {"supported_color_modes": ["brightness"], "brightness": 128})
    hass.states.async_set("light.flur", "off", {"supported_color_modes": ["onoff"]})
    hass.states.async_set("cover.rollo", "open", {"supported_features": 15, "current_position": 40})
    hass.states.async_set("sensor.temp", "21.5", {"unit_of_measurement": "°C"})
    await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    await store.async_save({"displays": [{"name": "Flur", "device": "haus-display-a1b2c3",
                                          "tiles": ["entity:light.decke", "entity:light.flur", "entity:cover.rollo", "entity:sensor.temp"],
                                          "custom": [{"name": "WZ", "tiles": [{"entity": "cover.rollo"}]}]}]})
    await _tick(hass)
    sent = {c.data["bereich"]: c.data["daten"] for c in calls}
    k = json.loads(sent["kacheln"])
    assert (k[0]["a"], k[0]["w"], k[0]["wa"]) == (True, 50, "hell")
    assert k[1]["a"] is True and "w" not in k[1]
    assert (k[2]["w"], k[2]["wa"]) == (40, "pos")
    assert "a" not in k[3] and "w" not in k[3]
    e = json.loads(sent["eigene"])[0]["k"][0]
    assert (e["a"], e["w"], e["wa"]) == (True, 40, "pos")

    for ziel in ("wert:kachel:0:70", "wert:kachel:0:0", "wert:eigen:0:0:120", "wert:kachel:1:50", "wert:kachel:3:10", "wert:kachel:9:5", "wert:x"):
        await hass.services.async_call(DOMAIN, "display_tap", {"display": "haus-display-a1b2c3", "ziel": ziel}, blocking=True)
    await hass.async_block_till_done()
    assert [c.data for c in on] == [{"entity_id": "light.decke", "brightness_pct": 70}]
    assert [c.data for c in off] == [{"entity_id": "light.decke"}]
    assert [c.data for c in pos] == [{"entity_id": "cover.rollo", "position": 100}]


async def test_display_push_gedrosselt(hass: HomeAssistant) -> None:
    """Messwerte gehen gebündelt (SENSOR_DELAY) ans Display, Schaltzustände sofort; ein Schalter zieht den Push vor."""
    calls = async_mock_service(hass, "esphome", "haus_display_a1b2c3_haus_daten")
    hass.states.async_set("light.decke", "on", {"supported_color_modes": ["onoff"]})
    hass.states.async_set("sensor.temp", "21.5", {"unit_of_measurement": "°C"})
    await _setup(hass)
    await hass.data[DOMAIN]["store"].async_save({"displays": [{"name": "Flur", "device": "haus-display-a1b2c3",
                                                               "tiles": ["entity:light.decke", "entity:sensor.temp"]}]})
    await _tick(hass)
    hub = hass.data[DOMAIN]["displays"]
    assert "sensor.temp" in hub._watched and "light.decke" in hub._watched

    def kacheln():
        return [json.loads(c.data["daten"]) for c in calls if c.data["bereich"] == "kacheln"]

    n = len(kacheln())
    hass.states.async_set("sensor.temp", "22.5", {"unit_of_measurement": "°C"})
    await _tick(hass, 2)
    assert len(kacheln()) == n                      # Messwert wartet noch
    await _tick(hass, 11)
    assert len(kacheln()) == n + 1 and "22,5" in json.dumps(kacheln()[-1], ensure_ascii=False)

    hass.states.async_set("sensor.temp", "23.5", {"unit_of_measurement": "°C"})
    hass.states.async_set("light.decke", "off", {"supported_color_modes": ["onoff"]})
    await _tick(hass, 2)                            # Licht zieht den Push vor und nimmt den Messwert mit
    assert len(kacheln()) == n + 2 and "23,5" in json.dumps(kacheln()[-1], ensure_ascii=False)
    await _tick(hass, 11)
    assert len(kacheln()) == n + 2                  # kein zweiter Push hinterher


def test_sanitize_wallpanel_saver() -> None:
    wp = sanitize({"wallpanel": {"night_from": "22:30", "night_to": "7:05", "clock_size": "xl", "sv_indoor": "<b>",
                                 "sv_date": False, "sv_status": "nein"}})["wallpanel"]
    assert wp["night_from"] == "22:30" and wp["night_to"] == "07:05" and wp["clock_size"] == "l" and wp["sv_indoor"] == ""
    assert wp["sv_date"] is False and wp["sv_status"] is True and wp["sv_weather"] is True
    wp = sanitize({"wallpanel": {"night_from": "25:00", "clock_size": "s", "sv_indoor": "avg"}})["wallpanel"]
    assert wp["night_from"] == "23:00" and wp["clock_size"] == "s" and wp["sv_indoor"] == "avg"


async def test_schoner_einstellungen_und_aussentemperatur(hass: HomeAssistant) -> None:
    """Außentemperatur vom Außenfühler (nicht Wintergarten), Elemente des Schoners abschaltbar, Innentemperatur."""
    await _house(hass)
    hass.states.async_set("sensor.wintergarten_temperatur", "24.0", {"device_class": "temperature", "unit_of_measurement": "°C"})
    hass.states.async_set("sensor.aussen_temperatur", "3.6", {"device_class": "temperature", "unit_of_measurement": "°C"})
    hass.states.async_set("sensor.pv", "3240", {**PWR, "friendly_name": "PV Leistung"})
    hass.states.async_set("weather.home", "partlycloudy", {"temperature": 7.2, "friendly_name": "Zuhause"})
    async_mock_service(hass, "weather", "get_forecasts", supports_response=SupportsResponse.ONLY,
                       response={"weather.home": {"forecast": [{"temperature": 9}, {"temperature": 15.4}]}})
    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    await store.async_save({"header": {"pv": "sensor.pv"}, "displays": [{"name": "Flur", "saver": True}]})
    await _tick(hass)
    await _tick(hass)
    eid = "sensor.haus_display_flur"
    assert monitor._outdoor["temperature"] == "sensor.aussen_temperatur"
    assert _attr(hass, eid, "kopf")["wetter"]["t"] == "4°"
    assert _attr(hass, eid, "schoner")["zeile"][0] == {"i": "weather-partly-cloudy", "t": "4°"}

    await store.async_save({"header": {"pv": "sensor.pv"}, "displays": [{"name": "Flur", "saver": True}],
                            "wallpanel": {"sv_weather": False, "sv_pv": False, "sv_status": False, "sv_indoor": "avg"}})
    await _tick(hass)
    await _tick(hass)
    sv = _attr(hass, eid, "schoner")
    assert sv["zeile"] == [{"i": "home-thermometer", "t": "20,0°"}, {"i": "calendar", "t": "Morgen 15°"}, {"i": "home-account", "t": "Zuhause"}]
    assert sv["status"] is None
