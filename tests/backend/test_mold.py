"""Warnregel „Schimmelrisiko – jetzt lüften“ (pytest tests/backend)."""
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung.alerts import abs_hum, dew_point, vent_advice
from custom_components.haus_visualisierung.const import DOMAIN

HUM = {"device_class": "humidity", "unit_of_measurement": "%", "state_class": "measurement"}
TEMP = {"device_class": "temperature", "unit_of_measurement": "°C", "state_class": "measurement"}


def test_formeln() -> None:
    """Magnus-Formel: Werte aus der Taupunkttabelle (±0,1 K) und absolute Feuchte (±0,1 g/m³)."""
    assert dew_point(20, 50) == pytest.approx(9.3, abs=0.1)
    assert dew_point(22, 70) == pytest.approx(16.3, abs=0.1)
    assert dew_point(0, 100) == pytest.approx(0, abs=0.01)
    assert abs_hum(20, 50) == pytest.approx(8.6, abs=0.1)
    assert abs_hum(0, 90) == pytest.approx(4.4, abs=0.1)
    assert vent_advice(20, 60, 0, 90) == "gut"          # Winter: draußen viel trockener
    assert vent_advice(24, 60, 28, 60) == "nicht"       # Sommer: draußen feuchter
    assert vent_advice(20, 60, 20, 55) == "wenig"
    assert dew_point(None, 50) is None and vent_advice(20, 60, None, 80) is None


async def _house(hass: HomeAssistant):
    areas = ar.async_get(hass)
    bad = areas.async_create("Bad").id
    garten = areas.async_create("Garten").id
    reg = er.async_get(hass)
    return {
        "bad_h": _ent(hass, reg, bad, "sensor", "bad_feuchte", "55", {**HUM, "friendly_name": "Bad Feuchte"}),
        "bad_t": _ent(hass, reg, bad, "sensor", "bad_temperatur", "22", {**TEMP, "friendly_name": "Bad Temperatur"}),
        "bad_f": _ent(hass, reg, bad, "binary_sensor", "bad_fenster", "off", {"device_class": "window", "friendly_name": "Bad Fenster"}),
        "out_h": _ent(hass, reg, garten, "sensor", "aussen_feuchte", "85", {**HUM, "friendly_name": "Außenfeuchte"}),
        "out_t": _ent(hass, reg, garten, "sensor", "aussen_temperatur", "2", {**TEMP, "friendly_name": "Außentemperatur"}),
    }


def _sent(calls):
    return [c.data for c in calls if c.data.get("message") != "clear_notification"]


async def test_mold_delay_hysteresis(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _house(hass)
    monitor = await _setup(hass)
    await _tick(hass)
    assert monitor._outdoor["humidity"] == ids["out_h"] and monitor._outdoor["temperature"] == ids["out_t"]
    # Außen ist feucht (85 %), aber kein Innenraum: keine Meldung für den Garten
    hass.states.async_set(ids["out_h"], "99", {**HUM, "friendly_name": "Außenfeuchte"})
    hass.states.async_set(ids["bad_h"], "72", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    assert _sent(calls) == []  # nicht sofort (Duschen)
    freezer.tick(timedelta(minutes=29))
    await _tick(hass, 31)
    assert _sent(calls) == []
    freezer.tick(timedelta(minutes=2))
    await _tick(hass, 31)
    sent = _sent(calls)
    assert [d["title"] for d in sent] == ["🏠 Schimmelrisiko · Bad"]
    assert sent[0]["message"] == "72 % bei 22,0° · Taupunkt 16,7° – jetzt lüften"
    # Rückfall erst 3 Punkte unter der Grenze: 63 % bleibt, 62 % ist behoben
    hass.states.async_set(ids["bad_h"], "63", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    assert "mold:bad" in monitor._active
    hass.states.async_set(ids["bad_h"], "62", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    assert "mold:bad" not in monitor._active
    assert calls[-1].data["message"] == "clear_notification"
    # zu kurz über der Grenze → keine Meldung
    hass.states.async_set(ids["bad_h"], "70", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    freezer.tick(timedelta(minutes=10))
    await _tick(hass, 31)
    hass.states.async_set(ids["bad_h"], "60", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    assert len(_sent(calls)) == 1


async def test_mold_window_outdoor_modes(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    ids = await _house(hass)
    monitor = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/save", "layout": {"alerts": {"mold_hum": 70, "mold_min": 5}, "push": {"cooldown": 0}}})
    assert (await client.receive_json())["success"]
    await _tick(hass)
    # Fenster offen: es wird schon gelüftet
    hass.states.async_set(ids["bad_f"], "on", {"device_class": "window", "friendly_name": "Bad Fenster"})
    hass.states.async_set(ids["bad_h"], "71", {**HUM, "friendly_name": "Bad Feuchte"})
    await _tick(hass)
    freezer.tick(timedelta(minutes=6))
    await _tick(hass, 31)
    assert "mold:bad" not in monitor._active
    # Fenster zu, noch feucht → sofort melden (Zeit lief schon)
    hass.states.async_set(ids["bad_f"], "off", {"device_class": "window", "friendly_name": "Bad Fenster"})
    await _tick(hass)
    assert "mold:bad" in monitor._active
    # draußen feuchter (Sommer, Gewitter): Hinweis statt „jetzt lüften“
    hass.states.async_set(ids["out_t"], "26", {**TEMP, "friendly_name": "Außentemperatur"})
    hass.states.async_set(ids["out_h"], "95", {**HUM, "friendly_name": "Außenfeuchte"})
    await _tick(hass)
    assert monitor._active["mold:bad"].detail.endswith("draußen feuchter, besser heizen oder entfeuchten")
    # Standard: nur im Hausmodus Zuhause
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_mode", "mode": "abwesend"})
    assert (await client.receive_json())["success"]
    await _tick(hass)
    assert "mold:bad" not in monitor._active
    # Einstellungen: Grenzen werden begrenzt und gespeichert
    await client.send_json({"id": 3, "type": f"{DOMAIN}/save", "layout": {"alerts": {"mold_hum": 120, "mold_min": -5, "builtin": {"mold": False}}}})
    assert (await client.receive_json())["success"]
    a = hass.data[DOMAIN]["store"].data["alerts"]
    assert a["mold_hum"] == 90 and a["mold_min"] == 0 and a["builtin"]["mold"] is False
