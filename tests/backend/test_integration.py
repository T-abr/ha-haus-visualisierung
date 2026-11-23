"""Backend-Test mit echtem Home Assistant (pytest tests/backend)."""
from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.setup import async_setup_component

from custom_components.haus_visualisierung.const import DOMAIN, PANEL_URL_PATH, VERSION


async def _setup(hass: HomeAssistant):
    assert await async_setup_component(hass, "http", {})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Haus", "icon": "mdi:home-variant", "require_admin": False}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    return hass.config_entries.async_entries(DOMAIN)[0]


async def test_setup_panel_and_ws(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    panels = hass.data[frontend.DATA_PANELS]
    assert PANEL_URL_PATH in panels
    assert panels[PANEL_URL_PATH].config["_panel_custom"]["name"] == "haus-visualisierung-panel"

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/info"})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"]["version"] == VERSION
    assert msg["result"]["layout"]["camera_interval"] == 10

    await client.send_json({"id": 2, "type": f"{DOMAIN}/subscribe"})
    msg = await client.receive_json()
    assert msg["success"]
    msg = await client.receive_json()
    assert msg["type"] == "event" and msg["event"]["version"] == VERSION

    await client.send_json({"id": 3, "type": f"{DOMAIN}/save", "layout": {
        "hidden_areas": ["bad"], "camera_interval": 1, "evil": "x", "battery_critical": 40, "battery_low": 20,
        "links": [{"title": "Solar", "path": "/solar-visualisierung"}, {"title": "kaputt"},
                  {"title": "Alt", "path": "/dashboard-import", "embed": False}, {"title": "K", "path": "/x", "mode": "embed"}, {"title": "B", "path": "/y", "mode": "quatsch"}, {"title": "H", "path": "/z", "mode": "haus"}]}})
    # Ereignis aus dem Abo und Ergebnis kommen in beliebiger Reihenfolge
    got = [await client.receive_json(), await client.receive_json()]
    res = next(m for m in got if m["id"] == 3 and m["type"] == "result")
    ev = next(m for m in got if m["id"] == 2 and m["type"] == "event")
    lay = res["result"]["layout"]
    assert lay["hidden_areas"] == ["bad"] and lay["camera_interval"] == 3 and "evil" not in lay
    assert lay["battery_low"] == 40 and len(lay["links"]) == 5 and lay["links"][0]["embed"] is True
    assert [l["mode"] for l in lay["links"]] == ["theme", "open", "embed", "theme", "theme"]
    assert lay["links"][1]["embed"] is False
    assert ev["event"]["layout"] == lay
    assert lay["alerts"]["builtin"]["contacts"] is True and lay["alerts"]["rules"] == []
    assert lay["show_trends"] is True  # 1.1.0: Verlauf auf Raumseiten, Standard an

    await client.send_json({"id": 4, "type": f"{DOMAIN}/save", "layout": {"alerts": {
        "builtin": {"battery": True, "contacts": "ja"}, "contacts_min": 999,
        "rules": [{"title": "Kamin", "entity": "sensor.kamin", "op": "gt", "value": "85", "minutes": -5, "level": "alarm"},
                  {"entity": "switch.x", "op": "quatsch", "level": "panik"}, "kaputt"]}}})
    got = [await client.receive_json(), await client.receive_json()]
    al = next(m for m in got if m["id"] == 4 and m["type"] == "result")["result"]["layout"]["alerts"]
    assert al["builtin"]["battery"] is True and al["builtin"]["contacts"] is True and al["contacts_min"] == 240
    assert len(al["rules"]) == 2 and al["rules"][0]["minutes"] == 0 and al["rules"][0]["level"] == "alarm"
    assert al["rules"][1]["op"] == "on" and al["rules"][1]["level"] == "warn" and al["rules"][1]["enabled"] is True

    await client.send_json({"id": 5, "type": f"{DOMAIN}/save", "layout": {"show_trends": False, "floor_order": ["kg", "eg", 3]}})
    got = [await client.receive_json(), await client.receive_json()]
    lay5 = next(m for m in got if m["id"] == 5 and m["type"] == "result")["result"]["layout"]
    assert lay5["show_trends"] is False and lay5["floor_order"] == ["kg", "eg"]
    await client.send_json({"id": 6, "type": f"{DOMAIN}/save", "layout": {"show_trends": "nein"}})
    got = [await client.receive_json(), await client.receive_json()]
    assert next(m for m in got if m["id"] == 6 and m["type"] == "result")["result"]["layout"]["show_trends"] is True

    # 1.2.0: Technik – Heizung und Wallbox werden geprüft
    await client.send_json({"id": 7, "type": f"{DOMAIN}/save", "layout": {
        "heating": {"enabled": False, "tank": ["sensor.speicher_oben", "kaputt", 5, "sensor.speicher_unten"], "tank_min": 70, "tank_max": 40,
                    "stove": "sensor.kamin", "curve": "<script>", "stove_hot": 999, "manual_curve": True,
                    "manual": {"slope": 9, "level": -3, "min": 30, "max": 25, "evil": 1}, "evil": "x"},
        "wallbox": {"mode": "select.evcc_lp1_mode", "power": "falsch", "enabled": "nein"}}})
    got = [await client.receive_json(), await client.receive_json()]
    lay7 = next(m for m in got if m["id"] == 7 and m["type"] == "result")["result"]["layout"]
    he, wb = lay7["heating"], lay7["wallbox"]
    assert he["enabled"] is False and he["tank"] == ["sensor.speicher_oben", "sensor.speicher_unten"]
    assert he["tank_min"] == 70 and he["tank_max"] == 80 and he["stove"] == "sensor.kamin" and he["curve"] == ""
    assert he["stove_hot"] == 120 and he["manual_curve"] is True and "evil" not in he
    assert he["manual"]["slope"] == 3.0 and he["manual"]["level"] == -3 and he["manual"]["max"] == 35 and "evil" not in he["manual"]
    assert wb["mode"] == "select.evcc_lp1_mode" and wb["power"] == "" and wb["enabled"] is True

    # 1.3.0: Wandpanel
    await client.send_json({"id": 8, "type": f"{DOMAIN}/save", "layout": {"wallpanel": {
        "saver_min": 0, "black_min": 9999, "return_min": -3, "fullscreen": False, "night_dim": "ja", "wander": True,
        "weather": "sensor.kein_wetter", "wake_entity": "binary_sensor.flur_bewegung", "evil": 1}}})
    got = [await client.receive_json(), await client.receive_json()]
    wp = next(m for m in got if m["id"] == 8 and m["type"] == "result")["result"]["layout"]["wallpanel"]
    assert wp["saver_min"] == 0 and wp["black_min"] == 600 and wp["return_min"] == 0 and wp["fullscreen"] is False
    assert wp["night_dim"] is True and wp["wander"] is True and wp["weather"] == "" and wp["wake_entity"] == "binary_sensor.flur_bewegung" and "evil" not in wp

    # 1.5.0: Energie-Seite
    await client.send_json({"id": 9, "type": f"{DOMAIN}/save", "layout": {"energy": {
        "enabled": "ja", "battery_power": "switch.falsch", "grid_invert": True, "battery_invert": 1, "evil": 1}}})
    got = [await client.receive_json(), await client.receive_json()]
    en = next(m for m in got if m["id"] == 9 and m["type"] == "result")["result"]["layout"]["energy"]
    assert en == {"enabled": True, "battery_power": "", "grid_invert": True, "battery_invert": False}
    await client.send_json({"id": 10, "type": f"{DOMAIN}/save", "layout": {"energy": {"enabled": False, "battery_power": "sensor.akku_leistung"}}})
    got = [await client.receive_json(), await client.receive_json()]
    en = next(m for m in got if m["id"] == 10 and m["type"] == "result")["result"]["layout"]["energy"]
    assert en["enabled"] is False and en["battery_power"] == "sensor.akku_leistung" and en["grid_invert"] is False

    # Strompreis: Sensor, Schalter, Preise in ct/kWh (begrenzt), Fensterlänge
    await client.send_json({"id": 11, "type": f"{DOMAIN}/save", "layout": {"price": {
        "sensor": "sensor.nordpool_kwh_de_eur", "use_sensor": False, "fixed_ct": 999, "feed_in_ct": 8.25, "surcharge_ct": "x", "window_h": 0, "evil": 1}}})
    got = [await client.receive_json(), await client.receive_json()]
    pr = next(m for m in got if m["id"] == 11 and m["type"] == "result")["result"]["layout"]["price"]
    assert pr == {"sensor": "sensor.nordpool_kwh_de_eur", "use_sensor": False, "fixed_ct": 200.0, "feed_in_ct": 8.25, "surcharge_ct": 0, "window_h": 1}
    await client.send_json({"id": 12, "type": f"{DOMAIN}/save", "layout": {"price": {"sensor": "switch.falsch"}}})
    got = [await client.receive_json(), await client.receive_json()]
    pr = next(m for m in got if m["id"] == 12 and m["type"] == "result")["result"]["layout"]["price"]
    assert pr["sensor"] == "" and pr["use_sensor"] is True and pr["fixed_ct"] == 30 and pr["window_h"] == 3

    # Optionen ändern → Panel neu registriert
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"name": "Zuhause", "icon": "mdi:home", "require_admin": True})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    p = hass.data[frontend.DATA_PANELS][PANEL_URL_PATH]
    assert p.sidebar_title == "Zuhause" and p.require_admin

    # Entladen entfernt das Panel
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert PANEL_URL_PATH not in hass.data[frontend.DATA_PANELS]


async def test_single_instance(hass: HomeAssistant) -> None:
    await _setup(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT


async def test_layout_persists(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    hass_storage[DOMAIN] = {"version": 1, "key": DOMAIN, "data": {"favorites": ["light.x"], "header": {"pv": "sensor.pv"}}}
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/info"})
    msg = await client.receive_json()
    assert msg["result"]["layout"]["favorites"] == ["light.x"]
    assert msg["result"]["layout"]["header"]["pv"] == "sensor.pv"
