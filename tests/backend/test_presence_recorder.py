"""Anwesenheits-Simulation: Verlauf aus dem echten Recorder (pytest tests/backend)."""
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from test_push import _setup


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(recorder_mock, enable_custom_integrations):
    """Recorder vor hass einrichten (sonst Reihenfolge-Fehler der Fixtures)."""
    yield


async def test_fetch_from_recorder(hass: HomeAssistant) -> None:
    """Der Verlauf kommt wirklich aus dem Recorder (Zustände mit Helligkeit und Position)."""
    from homeassistant.components.recorder.util import get_instance

    monitor = await _setup(hass)
    start = dt_util.utcnow() - timedelta(minutes=1)
    hass.states.async_set("light.flur", "on", {"brightness": 80})
    hass.states.async_set("light.flur", "off", {})
    await hass.async_block_till_done()
    await get_instance(hass).async_block_till_done()
    hist = await monitor.sim.async_fetch(["light.flur"], start, dt_util.utcnow() + timedelta(minutes=1))
    states = hist["light.flur"]
    assert [s.state for s in states] == ["on", "off"] and states[0].attributes["brightness"] == 80
