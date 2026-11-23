"""Haushaltsgeräte: läuft/fertig über Leistung oder Status, Energie, Kosten, Meldung und Quittieren (pytest tests/backend)."""
import time
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung.appliances import kind_of, unit_factor
from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.store import sanitize

PWR = {"device_class": "power", "unit_of_measurement": "W", "state_class": "measurement"}


def test_helpers() -> None:
    assert kind_of("sensor.waschmaschine_leistung Waschmaschine") == "wash"
    assert kind_of("Wäschetrockner Leistung") == "dry"
    assert kind_of("Waschtrockner") == "dry"
    assert kind_of("sensor.spuelmaschine_power") == "dish"
    assert kind_of("Geschirrspüler") == "dish"
    assert kind_of("Kühlschrank") == "other"
    assert unit_factor("ct/kWh") == 0.01 and unit_factor("EUR/kWh") == 1 and unit_factor("€/MWh") == 0.001
    assert unit_factor("W") is None


def test_sanitize() -> None:
    out = sanitize({"appliances": {"auto": False, "items": [
        {"name": "Waschmaschine", "kind": "wash", "power": "sensor.wm_power", "stop_min": 500, "start_w": 3, "stop_w": 8},
        {"name": "Waschmaschine", "power": "sensor.wm2", "door": "kaputt!"},
        "unsinn",
    ]}})["appliances"]
    assert out["auto"] is False and out["enabled"] is True
    a, b = out["items"]
    assert a["id"] == "waschmaschine" and b["id"] == "waschmaschine_2"
    assert a["stop_min"] == 60 and a["start_w"] == 3 and a["stop_w"] == 3  # Stopp nie über Start
    assert b["door"] == "" and b["kind"] == ""


def _sent(calls):
    return [c.data for c in calls if c.data.get("message") != "clear_notification"]


async def _power(hass, eid, w, minutes=0, freezer=None):
    hass.states.async_set(eid, str(w), {**PWR, "friendly_name": "Waschmaschine Leistung"})
    await _tick(hass)
    if minutes:
        for _ in range(minutes * 2):
            freezer.tick(timedelta(seconds=30))
            await _tick(hass, 31)


async def test_power_cycle(hass: HomeAssistant, freezer) -> None:
    """Automatisch erkannt: 2 kW für 60 min (halb aus PV), dann aus → fertig mit Energie, Kosten, Meldung."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    areas = ar.async_get(hass)
    keller = areas.async_create("Keller").id
    reg = er.async_get(hass)
    wm = _ent(hass, reg, keller, "sensor", "waschmaschine_leistung", "0", {**PWR, "friendly_name": "Waschmaschine Leistung"})
    hass.states.async_set("sensor.netz", "1000", PWR)
    monitor = await _setup(hass)
    await monitor.store.async_save({**monitor.store.data, "header": {"grid": "sensor.netz"}, "price": {"use_sensor": False, "fixed_ct": 30}})
    await _tick(hass)
    tr = monitor.appliances
    assert [i["power"] for i in tr.items] == [wm] and tr.items[0]["name"] == "Waschmaschine"
    st = hass.states.get("sensor.haus_geraete")
    assert st.state == "0" and st.attributes["geraete"][0]["state"] == "aus"
    # kurzer Ausschlag (unter 1 min) startet nichts
    await _power(hass, wm, 2000)
    freezer.tick(timedelta(seconds=20))
    await _power(hass, wm, 0)
    assert tr.data["wash"]["state"] == "aus"
    # Waschgang: 2 kW, Netz liefert 1 kW → die Hälfte kostet
    await _power(hass, wm, 2000, 60, freezer)
    assert tr.data["wash"]["state"] == "laeuft"
    row = hass.states.get("sensor.haus_geraete").attributes["geraete"][0]
    assert row["state"] == "laeuft" and 1.8 < row["kwh"] < 2.1
    # Pausen unter 5 min beenden ihn nicht
    await _power(hass, wm, 1, 3, freezer)
    assert tr.data["wash"]["state"] == "laeuft"
    await _power(hass, wm, 2000)
    await _power(hass, wm, 1, 6, freezer)
    d = tr.data["wash"]
    assert d["state"] == "fertig"
    assert 1.9 < d["kwh"] < 2.2 and abs(d["cost"] - d["kwh"] * 0.5 * 0.3) < 0.01
    sent = _sent(calls)
    assert [x["title"] for x in sent] == ["🏠 Waschmaschine fertig"]
    assert "kWh" in sent[0]["message"] and "€" in sent[0]["message"] and "% eigener Strom" in sent[0]["message"]
    st = hass.states.get("sensor.haus_geraete")
    assert st.state == "1" and st.attributes["fertig_geraete"] == ["Waschmaschine"]
    assert st.attributes["geraete"][0]["n"] == 1 and st.attributes["geraete"][0]["avg_min"] >= 60



async def test_ws_ack(hass: HomeAssistant, hass_ws_client) -> None:
    """Quittieren über das Panel: zurück auf „aus“, Meldung wird vom Handy genommen."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    hass.states.async_set("sensor.trockner_leistung", "0", {**PWR, "friendly_name": "Trockner"})
    monitor = await _setup(hass)
    ws = await hass_ws_client(hass)
    tr = monitor.appliances
    assert [i["id"] for i in tr.items] == ["dry"]
    now = time.time()
    tr.data["dry"] = {"state": "fertig", "since": now, "start": now - 3600, "end": now, "kwh": 2.5, "grid_kwh": 2.5, "cost": 0.75, "hist": []}
    tr._notify()
    await _tick(hass)
    assert "appliance:dry" in monitor._active
    assert _sent(calls)[-1]["message"] == "Dauer 1:00 h · 2,50 kWh · 0,75 €"
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/appliance_ack", "appliance": "dry"})
    assert (await ws.receive_json())["success"]
    await _tick(hass)
    assert tr.data["dry"]["state"] == "aus" and "appliance:dry" not in monitor._active
    assert calls[-1].data["message"] == "clear_notification"
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/appliance_ack", "appliance": "dry"})
    assert not (await ws.receive_json())["success"]  # schon quittiert

async def test_ack_and_door(hass: HomeAssistant, freezer) -> None:
    """Eingestelltes Gerät mit Status und Tür: Status steuert, Tür auf quittiert."""
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    hass.states.async_set("sensor.spueler_status", "standby", {"friendly_name": "Spülmaschine Status"})
    hass.states.async_set("binary_sensor.spueler_tuer", "off", {"device_class": "door"})
    hass.states.async_set("sensor.spueler_power", "0", PWR)
    monitor = await _setup(hass)
    await monitor.store.async_save({**monitor.store.data, "appliances": {"items": [
        {"name": "Spüler", "kind": "dish", "status": "sensor.spueler_status", "door": "binary_sensor.spueler_tuer", "power": "sensor.spueler_power"}]}})
    await _tick(hass)
    tr = monitor.appliances
    assert [i["id"] for i in tr.items] == ["spueler"]
    hass.states.async_set("sensor.spueler_status", "run")
    hass.states.async_set("sensor.spueler_power", "1500", PWR)
    await _tick(hass)
    assert tr.data["spueler"]["state"] == "laeuft"
    freezer.tick(timedelta(minutes=90))
    await _tick(hass, 31)
    hass.states.async_set("sensor.spueler_status", "finished")
    await _tick(hass)
    assert tr.data["spueler"]["state"] == "fertig"
    assert [x["title"] for x in _sent(calls)] == ["🏠 Spüler fertig"]
    # Tür auf → aus, Meldung wird vom Handy genommen
    freezer.tick(timedelta(minutes=5))
    hass.states.async_set("binary_sensor.spueler_tuer", "on", {"device_class": "door"})
    await _tick(hass)
    await _tick(hass)
    assert tr.data["spueler"]["state"] == "aus"
    assert "appliance:spueler" not in monitor._active
    assert calls[-1].data["message"] == "clear_notification"
    # nächster Durchgang, diesmal per Quittieren im Alarmmanager
    hass.states.async_set("sensor.spueler_status", "run")
    await _tick(hass)
    freezer.tick(timedelta(minutes=30))
    await _tick(hass, 31)
    hass.states.async_set("sensor.spueler_status", "end")
    await _tick(hass)
    await _tick(hass)
    assert "appliance:spueler" in monitor._active
    monitor.async_action("appliance:spueler", "ack", "Tobias")
    await _tick(hass)
    assert tr.data["spueler"]["state"] == "aus" and "appliance:spueler" not in monitor._active
    assert len(tr.data["spueler"]["hist"]) == 2
