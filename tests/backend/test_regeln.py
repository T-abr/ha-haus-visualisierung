"""Alle festen Warnregeln und eigenen Regeln einmal durchspielen: Meldung entsteht, Push geht raus,
Abschalten und Hausmodus-Einschränkung wirken, Behoben räumt auf (pytest tests/backend).
Schimmel, Haushaltsgeräte, Wartung und Wetter haben eigene Testdateien."""
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

DOMAIN = "haus_visualisierung"


async def _haus(hass: HomeAssistant) -> dict:
    areas = ar.async_get(hass)
    flur, wohn, garage = (areas.async_create(n).id for n in ("Flur", "Wohnzimmer", "Garage"))
    reg = er.async_get(hass)
    return {
        "tuer": _ent(hass, reg, flur, "binary_sensor", "flur_haustuer", "off", {"device_class": "door", "friendly_name": "Flur Haustür"}),
        "fenster": _ent(hass, reg, wohn, "binary_sensor", "wohn_fenster", "off", {"device_class": "window", "friendly_name": "Wohnzimmer Fenster"}),
        "heizung": _ent(hass, reg, wohn, "climate", "wohn_heizung", "heat", {"hvac_action": "idle", "friendly_name": "Wohnzimmer Heizung"}),
        "wasser": _ent(hass, reg, flur, "binary_sensor", "flur_wasser", "off", {"device_class": "moisture", "friendly_name": "Flur Wassermelder"}),
        "rauch": _ent(hass, reg, wohn, "binary_sensor", "wohn_rauch", "off", {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"}),
        "sirene": _ent(hass, reg, flur, "siren", "flur_sirene", "off", {"friendly_name": "Flur Sirene"}),
        "schloss": _ent(hass, reg, flur, "lock", "flur_schloss", "locked", {"friendly_name": "Flur Schloss"}),
        "tor": _ent(hass, reg, garage, "cover", "garagentor", "closed", {"device_class": "garage", "friendly_name": "Garage Tor"}),
        "rollo": _ent(hass, reg, wohn, "cover", "wohn_rollo", "open", {"device_class": "shutter", "friendly_name": "Wohnzimmer Rollo"}),
        "lampe": _ent(hass, reg, wohn, "light", "wohn_lampe", "off", {"friendly_name": "Wohnzimmer Lampe"}),
        "batt1": _ent(hass, reg, flur, "sensor", "tuer_batt", "80", {"device_class": "battery", "unit_of_measurement": "%"}, er.EntityCategory.DIAGNOSTIC),
        "batt2": _ent(hass, reg, wohn, "binary_sensor", "fenster_batt", "off", {"device_class": "battery"}, er.EntityCategory.DIAGNOSTIC),
        "temp": _ent(hass, reg, wohn, "sensor", "wohn_temp", "21", {"device_class": "temperature", "unit_of_measurement": "°C", "friendly_name": "Wohnzimmer Temperatur"}),
    }


def _set(hass, eid, state, **attrs):
    old = hass.states.get(eid)
    hass.states.async_set(eid, state, {**(old.attributes if old else {}), **attrs})


async def _alerts(hass, store, **alerts):
    lay = dict(store.data)
    lay["alerts"] = {**lay["alerts"], **alerts}
    await store.async_save(lay)
    await _tick(hass)


def _titles(calls, n0=0):
    return [c.data.get("title") for c in calls[n0:]]


async def test_feste_regeln(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _haus(hass)
    hass.states.async_set("alarm_control_panel.alarmo", "disarmed", {"friendly_name": "Alarmo"})
    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    await _tick(hass)
    assert not monitor.book.alarms, monitor.book.alarms
    keys = lambda: set(monitor.book.alarms)  # noqa: E731

    # Fenster/Tür offen (Warnung) – Push, Behoben räumt Meldung auf dem Handy weg
    _set(hass, ids["tuer"], "on")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" in keys() and monitor.book.alarms[f"contact:{ids['tuer']}"]["level"] == "warn"
    assert "🏠 Flur · Haustür offen" in _titles(calls)
    _set(hass, ids["tuer"], "off")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" not in keys() and calls[-1].data["message"] == "clear_notification"

    # „Erst melden nach … Minuten“
    await _alerts(hass, store, contacts_min=5)
    _set(hass, ids["tuer"], "on")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" not in keys()
    freezer.tick(timedelta(minutes=6))
    await _tick(hass, 31)  # 30-s-Takt plant die Auswertung …
    await _tick(hass, 31)  # … die hier läuft
    assert f"contact:{ids['tuer']}" in keys()
    _set(hass, ids["tuer"], "off")
    await _alerts(hass, store, contacts_min=0)

    # Fenster offen beim Heizen ersetzt „Fenster offen“
    _set(hass, ids["heizung"], "heat", hvac_action="heating")
    _set(hass, ids["fenster"], "on")
    await _tick(hass)
    assert any(k.startswith("heat:") for k in keys()) and f"contact:{ids['fenster']}" not in keys()
    _set(hass, ids["heizung"], "heat", hvac_action="idle")
    await _tick(hass)
    assert not any(k.startswith("heat:") for k in keys()) and f"contact:{ids['fenster']}" in keys()
    _set(hass, ids["fenster"], "off")
    await _tick(hass)

    # Sicherheit: Wasser, Rauch, Sirene → Alarm mit kritischer Push-Meldung
    for e in ("wasser", "rauch", "sirene"):
        n = len(calls)
        _set(hass, ids[e], "on")
        await _tick(hass)
        key = f"safety:{ids[e]}"
        assert key in keys() and monitor.book.alarms[key]["level"] == "alarm", e
        sent = calls[n:]
        assert sent and sent[0].data["data"]["push"]["interruption-level"] == "critical", e
        _set(hass, ids[e], "off")
        await _tick(hass)
        assert key not in keys()

    # Alarmanlage ausgelöst
    hass.states.async_set("alarm_control_panel.alarmo", "triggered", {"friendly_name": "Alarmo"})
    await _tick(hass)
    assert "alarmpanel:alarm_control_panel.alarmo" in keys()
    assert "🏠 Alarmo ausgelöst" in _titles(calls)
    hass.states.async_set("alarm_control_panel.alarmo", "disarmed", {"friendly_name": "Alarmo"})
    await _tick(hass)

    # Schloss entriegelt / offen
    for st in ("unlocked", "open"):
        _set(hass, ids["schloss"], st)
        await _tick(hass)
        assert f"lock:{ids['schloss']}" in keys(), st
        _set(hass, ids["schloss"], "locked")
        await _tick(hass)
        assert f"lock:{ids['schloss']}" not in keys()

    # Garagentor offen – normale Rollos nicht
    _set(hass, ids["tor"], "open")
    await _tick(hass)
    assert f"garage:{ids['tor']}" in keys() and not any(ids["rollo"] in k for k in keys())
    _set(hass, ids["tor"], "closed")
    await _tick(hass)

    # Batterien (standardmäßig aus): einzeln und mehrere
    _set(hass, ids["batt1"], "10")
    await _tick(hass)
    assert "battery" not in keys()
    await _alerts(hass, store, builtin={**store.data["alerts"]["builtin"], "battery": True})
    assert monitor.book.alarms["battery"]["title"].endswith("fast leer") and "10 %" in monitor.book.alarms["battery"]["detail"]
    _set(hass, ids["batt2"], "on")
    await _tick(hass)
    assert monitor.book.alarms["battery"]["title"] == "2 Batterien fast leer"
    _set(hass, ids["batt1"], "80")
    _set(hass, ids["batt2"], "off")
    await _tick(hass)
    assert "battery" not in keys()

    # Geräte nicht erreichbar (standardmäßig aus)
    _set(hass, ids["lampe"], "unavailable")
    await _tick(hass)
    assert "offline" not in keys()
    await _alerts(hass, store, builtin={**store.data["alerts"]["builtin"], "offline": True})
    assert monitor.book.alarms["offline"]["title"] == "1 Gerät nicht erreichbar"
    _set(hass, ids["lampe"], "off")
    await _tick(hass)
    assert "offline" not in keys()

    # Regel abschalten wirkt
    await _alerts(hass, store, builtin={**store.data["alerts"]["builtin"], "contacts": False})
    _set(hass, ids["tuer"], "on")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" not in keys()
    await _alerts(hass, store, builtin={**store.data["alerts"]["builtin"], "contacts": True})
    assert f"contact:{ids['tuer']}" in keys()

    # Hausmodus-Einschränkung: Fenster nur bei Abwesend
    await _alerts(hass, store, modes={"contacts": ["abwesend"]})
    assert f"contact:{ids['tuer']}" not in keys()
    monitor.house.set_mode("abwesend", "Test")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" in keys()
    monitor.house.set_mode("zuhause", "Test")
    await _tick(hass)
    assert f"contact:{ids['tuer']}" not in keys()


@pytest.mark.parametrize(
    ("op", "value", "state", "hit"),
    [
        ("gt", "25", "26", True), ("gt", "25", "25", False), ("gt", "25,5", "25.6", True),
        ("lt", "15", "14", True), ("lt", "15", "16", False),
        ("eq", "26", "26", True), ("eq", "26", "21", False),
        ("ne", "21", "22", True), ("ne", "21", "unavailable", False),
        ("unavailable", "", "unavailable", True), ("unavailable", "", "21", False),
    ],
)
async def test_eigene_regeln(hass: HomeAssistant, op, value, state, hit) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _haus(hass)
    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    await _alerts(hass, store, rules=[{"title": "Wohnzimmer prüfen", "entity": ids["temp"], "op": op, "value": value, "level": "alarm"}])
    _set(hass, ids["temp"], state)
    await _tick(hass)
    key = f"rule:0:{ids['temp']}"
    assert (key in monitor.book.alarms) is hit
    assert ("🏠 Wohnzimmer prüfen" in _titles(calls)) is hit


async def test_eigene_regeln_an_aus_dauer_modus(hass: HomeAssistant, freezer) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _haus(hass)
    monitor = await _setup(hass)
    store = hass.data[DOMAIN]["store"]
    tuer, lampe = ids["tuer"], ids["lampe"]
    await _alerts(hass, store, rules=[
        {"entity": tuer, "op": "on", "level": "warn"},
        {"entity": lampe, "op": "off", "level": "info", "modes": ["abwesend"]},
        {"entity": ids["temp"], "op": "gt", "value": "25", "minutes": 10, "level": "warn"},
        {"entity": ids["rauch"], "op": "on", "level": "alarm", "enabled": False},
    ])
    keys = lambda: set(monitor.book.alarms)  # noqa: E731
    _set(hass, tuer, "on")
    _set(hass, ids["temp"], "30")
    _set(hass, ids["rauch"], "on")
    await _tick(hass)
    assert f"rule:0:{tuer}" in keys()
    assert f"rule:1:{lampe}" not in keys()          # nur bei Abwesend
    assert f"rule:2:{ids['temp']}" not in keys()    # erst nach 10 Minuten
    assert f"rule:3:{ids['rauch']}" not in keys()   # ausgeschaltet
    monitor.house.set_mode("abwesend", "Test")
    await _tick(hass)
    assert f"rule:1:{lampe}" in keys()
    freezer.tick(timedelta(minutes=11))
    await _tick(hass, 31)
    await _tick(hass, 31)
    assert f"rule:2:{ids['temp']}" in keys()


@pytest.mark.parametrize("vorher", ["fehlt", "unavailable"])
async def test_spaet_gemeldeter_bewegungsmelder(hass: HomeAssistant, vorher: str) -> None:
    """Melder, deren Zustand erst nach dem Start der Integration kommt (z. B. Zigbee2MQTT/MQTT nach dem
    Hochfahren) oder die anfangs keine Geräteklasse haben, müssen trotzdem Alarm auslösen."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    reg = er.async_get(hass)
    flur = ar.async_get(hass).async_create("Flur").id
    e = reg.async_get_or_create("binary_sensor", "mqtt", "flur_bewegung", suggested_object_id="flur_bewegung")
    reg.async_update_entity(e.entity_id, area_id=flur)
    if vorher == "unavailable":
        hass.states.async_set(e.entity_id, "unavailable", {})
    monitor = await _setup(hass)
    await _tick(hass)
    monitor.house.set_mode("abwesend", "Test")
    await _tick(hass)
    attrs = {"device_class": "motion", "friendly_name": "Flur Bewegung"}
    hass.states.async_set(e.entity_id, "off", attrs)
    await _tick(hass)
    hass.states.async_set(e.entity_id, "on", attrs)
    await _tick(hass)
    assert f"presence:{e.entity_id}" in monitor.book.alarms
    assert "🏠 Flur: Bewegung erkannt" in _titles(calls)
