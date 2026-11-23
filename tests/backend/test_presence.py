"""Anwesenheits-Simulation: Planen nach Verlauf, Schalten, Start und Ende (pytest tests/backend)."""
import random
from datetime import date, datetime, timedelta

from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service
from test_push import _setup, _tick

from custom_components.haus_visualisierung.presence import build_plan, day_events, pick_day
from custom_components.haus_visualisierung.store import sanitize

DOMAIN = "haus_visualisierung"


def _st(eid, state, at, **attrs):
    return State(eid, state, attrs, last_changed=dt_util.as_utc(at), last_updated=dt_util.as_utc(at))


def _at(day: date, h: int, m: int = 0) -> datetime:
    return dt_util.start_of_local_day(day) + timedelta(hours=h, minutes=m)


def test_sanitize_presence_sim() -> None:
    out = sanitize({"presence_sim": {"enabled": True, "modes": ["abwesend", "quatsch"], "switch": "light.x",
                                     "entities": ["light.a", "light.a", "sensor.t", "cover.r", "bad id"], "weeks": 9, "jitter": -3}})
    ps = out["presence_sim"]
    assert ps["enabled"] and ps["modes"] == ["abwesend"] and ps["switch"] == ""
    assert ps["entities"] == ["light.a", "cover.r"] and ps["weeks"] == 4 and ps["jitter"] == 0
    assert sanitize({})["presence_sim"] == {"enabled": False, "modes": ["urlaub"], "switch": "", "entities": [], "weeks": 2, "jitter": 15}


def test_day_events_and_plan() -> None:
    src, today = date(2026, 11, 16), date(2026, 11, 23)
    hist = {"light.flur": [
        _st("light.flur", "off", _at(src, 0) - timedelta(hours=2)),
        _st("light.flur", "on", _at(src, 18, 30), brightness=120),
        _st("light.flur", "on", _at(src, 18, 31), brightness=120),  # doppelt → weg
        _st("light.flur", "unavailable", _at(src, 20)),             # nicht verwertbar → weg
        _st("light.flur", "off", _at(src, 22, 45)),
        _st("light.flur", "on", _at(src + timedelta(days=1), 7)),  # anderer Tag
    ], "cover.wohn": [
        _st("cover.wohn", "closed", _at(src, 0) - timedelta(hours=1), current_position=0),
        _st("cover.wohn", "open", _at(src, 7, 15), current_position=100),
    ]}
    evs = day_events(hist["light.flur"], src)
    assert [(e[1], e[2]) for e in evs] == [("off", None), ("on", 120), ("off", None)]
    assert evs[1][0] == 18.5 * 3600
    # Jetzt 12 Uhr: Rollo-Öffnen liegt schon zurück → Sollzustand, Licht an/aus kommt noch
    now = _at(today, 12)
    plan, initial = build_plan(hist, src, today, now, 20, random.Random(1))
    assert [(p["entity"], p["target"]) for p in plan] == [("light.flur", "on"), ("light.flur", "off")]
    assert initial["cover.wohn"]["target"] == "open" and initial["cover.wohn"]["value"] == 100
    assert initial["light.flur"]["target"] == "off"
    for p, (h, m) in zip(plan, ((18, 30), (22, 45))):
        assert abs(p["ts"] - _at(today, h, m).timestamp()) <= 20 * 60
    # Ohne Versatz exakt die Zeiten der Vorlage
    plan0, _ = build_plan(hist, src, today, now, 0, random.Random(1))
    assert plan0[0]["ts"] == _at(today, 18, 30).timestamp()


def test_pick_day() -> None:
    today = date(2026, 11, 23)  # Montag
    rng = random.Random(3)
    days = {today - timedelta(days=i): (5 if i != 7 else 0) for i in range(1, 15)}
    assert pick_day(days, today, rng) == today - timedelta(days=14)  # Montag vor einer Woche ohne Schaltvorgänge
    days[today - timedelta(days=14)] = 0
    assert pick_day(days, today, rng).weekday() != today.weekday()
    assert pick_day({d: 0 for d in days}, today, rng) is None


async def test_simulation_runs_in_vacation(hass: HomeAssistant, freezer) -> None:
    await hass.config.async_set_time_zone("Europe/Berlin")
    freezer.move_to(datetime(2026, 11, 23, 17, 0, tzinfo=dt_util.get_time_zone("Europe/Berlin")))
    on = async_mock_service(hass, "light", "turn_on")
    off = async_mock_service(hass, "light", "turn_off")
    pos = async_mock_service(hass, "cover", "set_cover_position")
    hass.states.async_set("light.flur", "off", {"friendly_name": "Flur"})
    hass.states.async_set("cover.wohn", "open", {"friendly_name": "Wohn Rollo", "current_position": 100})
    hass.states.async_set("input_boolean.urlaub_sim", "off")
    monitor = await _setup(hass)
    sim = monitor.sim
    today = dt_util.now().date()
    src = today - timedelta(days=7)
    hist = {"light.flur": [_st("light.flur", "on", _at(src, 16)), _st("light.flur", "off", _at(src, 22))],
            "cover.wohn": [_st("cover.wohn", "open", _at(src, 8), current_position=100),
                           _st("cover.wohn", "closed", _at(src, 17, 30), current_position=0)]}
    asked = []

    async def fake_fetch(ids, start, end):
        asked.append((sorted(ids), start, end))
        return hist

    sim.async_fetch = fake_fetch
    store = hass.data[DOMAIN]["store"]
    lay = dict(store.data)
    lay["presence_sim"] = {"enabled": True, "entities": ["light.flur", "cover.wohn"], "jitter": 0, "switch": "input_boolean.urlaub_sim"}
    await store.async_save(lay)
    await _tick(hass)
    assert not sim.active and not asked  # Zuhause → läuft nicht

    monitor.house.set_mode("urlaub", "Test")
    await _tick(hass)
    assert sim.active and sim.source == src
    assert asked[-1][0] == ["cover.wohn", "light.flur"] and asked[-1][1] == dt_util.start_of_local_day(today - timedelta(days=14))
    # Licht war um 17 Uhr an → sofort an; Rollo schließt um 17:30, Licht aus um 22 Uhr
    assert len(on) == 1 and on[0].data["entity_id"] == "light.flur"
    assert [p["entity"] for p in sim.plan] == ["cover.wohn", "light.flur"]
    async_fire_time_changed(hass, _at(today, 17, 31))
    await hass.async_block_till_done()
    assert pos and pos[-1].data == {"entity_id": "cover.wohn", "position": 0}

    # Websocket-Status
    st = sim.status()
    assert st["active"] and st["source"] == src.isoformat() and st["planned"] == 1 and st["next"][0]["action"] == "aus"
    assert any("Wohn Rollo auf 0 %" in e["text"] for e in st["log"])

    # Rückkehr → Zuhause: Simulation endet, geplanter Schaltvorgang entfällt
    monitor.house.set_mode("zuhause", "Test")
    await _tick(hass)
    assert not sim.active and not sim.plan and sim.log[-1]["type"] == "stop"
    async_fire_time_changed(hass, _at(today, 22, 1))
    await hass.async_block_till_done()
    assert not off

    # Schalter an → läuft auch im Modus Zuhause
    hass.states.async_set("input_boolean.urlaub_sim", "on")
    await _tick(hass)
    assert sim.active and "Schalter" in [e for e in sim.log if e["type"] == "start"][-1]["text"]
    hass.states.async_set("input_boolean.urlaub_sim", "off")
    await _tick(hass)
    assert not sim.active


async def test_ws_presence_sim(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/presence_sim"})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["active"] is False and res["result"]["next"] == []

