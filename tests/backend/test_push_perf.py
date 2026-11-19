"""Laufzeit der Hintergrund-Auswertung (Messaufbau wie tests/perf: 24 Räume, ≈ 400 Entitäten + 300 fremde)."""
import time

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from test_push import _setup


async def test_eval_speed(hass: HomeAssistant, capsys) -> None:
    areas, reg = ar.async_get(hass), er.async_get(hass)
    for f in range(4):
        for r in range(6):
            aid = areas.async_create(f"Raum {f}-{r}").id
            def add(domain, obj, state, attrs, cat=None):
                e = reg.async_get_or_create(domain, "t", obj, suggested_object_id=obj, entity_category=cat)
                reg.async_update_entity(e.entity_id, area_id=aid)
                hass.states.async_set(e.entity_id, state, attrs)
            for i in range(6):
                add("light", f"l{f}{r}{i}", "on" if i % 3 == 0 else "off", {})
            for i in range(2):
                add("cover", f"c{f}{r}{i}", "open", {"current_position": 50})
            add("climate", f"k{f}{r}", "heat", {"hvac_action": "idle"})
            add("sensor", f"t{f}{r}", "21", {"device_class": "temperature"})
            add("binary_sensor", f"w{f}{r}", "off", {"device_class": "window"})
            add("binary_sensor", f"m{f}{r}", "off", {"device_class": "motion"})
            add("sensor", f"b{f}{r}", "80", {"device_class": "battery"}, er.EntityCategory.DIAGNOSTIC)
    for i in range(300):
        hass.states.async_set(f"sensor.fremd_{i}", str(i), {})
    monitor = await _setup(hass)
    t = time.perf_counter(); n = 200
    for _ in range(n):
        monitor.evaluate()
    ev = (time.perf_counter() - t) / n * 1000
    t = time.perf_counter()
    for _ in range(20):
        monitor._rebuild()
    rb = (time.perf_counter() - t) / 20 * 1000
    with capsys.disabled():
        print(f"\nAuswertung: {ev:.2f} ms · Neuaufbau Modell: {rb:.2f} ms · beobachtete Entitäten: {len(monitor._watch)}")
    assert ev < 20
