"""Wanddisplays: Einstellungen, Entität je Display (Protokoll v1), Inhalte und Tippen (pytest tests/backend)."""
import json
from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant, SupportsResponse
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.display import PROTOCOL, bin_of, de, kw
from custom_components.haus_visualisierung.store import sanitize

PWR = {"device_class": "power", "unit_of_measurement": "W"}


def test_sanitize() -> None:
    assert sanitize({})["displays"] == []
    out = sanitize({"displays": [
        {"name": "Flur Oben", "pages": ["klima", "haus", "unsinn", "klima"], "tiles": ["pv_jetzt", "x", "entity:light.flur", "entity:<b>"],
         "bright_day": 500, "bright_night": -3, "hint": False},
        {"name": "Flur Oben"}, "kaputt", {"id": "!!"},
    ] + [{"name": f"d{i}"} for i in range(9)]})["displays"]
    a, b, c = out[:3]
    assert a == {"id": "flur_oben", "name": "Flur Oben", "pages": ["start", "klima", "haus"], "tiles": ["pv_jetzt", "entity:light.flur"],
                 "hint": False, "bright_day": 100, "bright_night": 0, "wake": True}
    assert b["id"] == "flur_oben_2" and b["tiles"] == ["pv_jetzt", "energie_heute", "klima_mittel", "morgen"] and b["pages"] == ["start"]
    assert c["id"] == "display"
    assert len(out) == 6


def test_format() -> None:
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
        "displays": [{"name": "Flur", "pages": ["energie", "klima", "haus"]}],
    })
    await _tick(hass)
    await _tick(hass)
    eid = "sensor.haus_display_flur"
    st = hass.states.get(eid)
    assert st is not None and st.state == str(PROTOCOL) and st.attributes["protokoll"] == PROTOCOL

    cfg = _attr(hass, eid, "einstellungen")
    assert cfg["seiten"] == ["start", "energie", "klima", "haus"] and cfg["hell_nacht"] == 10 and cfg["nacht"] is False

    kopf = _attr(hass, eid, "kopf")
    assert kopf["wetter"] == {"i": "weather-partly-cloudy", "t": "7°", "txt": "Teils bewölkt", "morgen": "morgen 15°"}
    assert kopf["modus"]["k"] == "zuhause" and kopf["modus"]["n"] == "Zuhause"

    pv, heute, klima, morgen = _attr(hass, eid, "kacheln")
    assert pv["v"] == "3,2 kW" and pv["s"] == "Haus 612 W · Netz −2,4 kW" and pv["b"] == 78 and pv["u"] == "Akku 78 %"
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
