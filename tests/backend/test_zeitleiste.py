"""Zeitleiste „Was war los?“ und Klingel-Standbilder (pytest tests/backend)."""
import time
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util
from test_push import _setup

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.klingel import KEEP_DAYS, RingBook
from custom_components.haus_visualisierung.zeitleiste import MOTION_GAP, build_events


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(recorder_mock, enable_custom_integrations):
    """Recorder vor hass einrichten (sonst Reihenfolge-Fehler der Fixtures)."""
    yield


def _st(eid, state, ts):
    when = dt_util.utc_from_timestamp(ts)
    return State(eid, state, last_changed=when, last_updated=when)


def test_build_events() -> None:
    """Tür mit Dauer, Bewegung zusammengefasst, Schloss, Klingel, Modus und Alarme; neueste zuerst."""
    t0 = 1_800_000_000.0
    info = {"binary_sensor.haustuer": {"kind": "tuer", "name": "Haustür", "area": "Flur"},
            "binary_sensor.bewegung_flur": {"kind": "bewegung", "name": "Bewegung Flur", "area": "Flur"},
            "lock.haustuer": {"kind": "schloss", "name": "Schloss", "area": "Flur"}}
    hist = {
        # Zustand vor dem Zeitraum (offen) zählt nicht; danach zu → auf (120 s) → zu → auf (noch offen)
        "binary_sensor.haustuer": [_st("binary_sensor.haustuer", "on", t0 - 50), _st("binary_sensor.haustuer", "off", t0 + 10),
                                   _st("binary_sensor.haustuer", "on", t0 + 100), _st("binary_sensor.haustuer", "unavailable", t0 + 150),
                                   _st("binary_sensor.haustuer", "off", t0 + 220), _st("binary_sensor.haustuer", "on", t0 + 900)],
        # drei Bewegungen kurz hintereinander = ein Abschnitt, nach langer Pause ein neuer
        "binary_sensor.bewegung_flur": [_st("binary_sensor.bewegung_flur", "on", t0 + 60), _st("binary_sensor.bewegung_flur", "off", t0 + 90),
                                        _st("binary_sensor.bewegung_flur", "on", t0 + 300), _st("binary_sensor.bewegung_flur", "off", t0 + 330),
                                        _st("binary_sensor.bewegung_flur", "on", t0 + 600), _st("binary_sensor.bewegung_flur", "off", t0 + 630),
                                        _st("binary_sensor.bewegung_flur", "on", t0 + 600 + MOTION_GAP + 10)],
        "lock.haustuer": [_st("lock.haustuer", "locked", t0 + 1), _st("lock.haustuer", "unlocked", t0 + 95), _st("lock.haustuer", "unlocked", t0 + 96)],
        "binary_sensor.fremd": [_st("binary_sensor.fremd", "on", t0 + 5)],
    }
    rings = [{"ts": t0 + 98, "cam": "camera.haustuer", "bild": "1800000098.jpg"}, {"ts": t0 - 999}]
    log = [{"ts": t0 + 2, "type": "modus", "key": "modus", "title": "Hausmodus: Weg", "mode": "weg", "user": "Tobias"},
           {"ts": t0 + 3, "type": "neu", "key": "x", "title": "Fenster offen", "level": "warn"},
           {"ts": t0 + 4, "type": "behoben", "key": "x", "title": "Fenster offen", "level": "warn"},
           {"ts": t0 + 5, "type": "quittiert", "key": "x", "title": "Fenster offen", "level": "warn", "user": "Tobias"}]
    ev = build_events(info, hist, rings, log, t0, t0 + 5000)
    assert [e["ts"] for e in ev] == sorted((e["ts"] for e in ev), reverse=True)
    doors = [e for e in ev if e["typ"] == "tuer" and not e.get("lock")]
    assert [(e["ts"], e.get("dur")) for e in doors] == [(t0 + 900, None), (t0 + 100, 120)]
    assert doors[1]["name"] == "Haustür" and doors[1]["area"] == "Flur" and doors[1]["text"] == "geöffnet"
    locks = [e["text"] for e in ev if e.get("lock")]
    assert locks == ["aufgeschlossen", "abgeschlossen"]
    mot = [e for e in ev if e["typ"] == "bewegung"]
    assert [(e["ts"], e["n"]) for e in mot] == [(t0 + 600 + MOTION_GAP + 10, 1), (t0 + 60, 3)] and mot[1]["bis"] == t0 + 600
    bell = [e for e in ev if e["typ"] == "klingel"]
    assert len(bell) == 1 and bell[0]["bild"] == "1800000098.jpg" and bell[0]["cam"] == "camera.haustuer"
    assert [e for e in ev if e["typ"] == "modus"][0]["user"] == "Tobias"
    assert [e["art"] for e in ev if e["typ"] == "alarm"] == ["quittiert", "neu"]   # „behoben“ bleibt auf der Alarmseite
    assert not [e for e in ev if e.get("eid") == "binary_sensor.fremd"]


async def test_ring_snapshot_and_prune(hass: HomeAssistant) -> None:
    """Klingeln legt ein Standbild ab; kurz danach dasselbe Bild; alte Bilder werden gelöscht; abschaltbar."""
    hass.states.async_set("camera.haustuer", "idle", {"friendly_name": "Haustür"})
    hass.states.async_set("event.g4_doorbell", "unknown", {"device_class": "doorbell"})
    await _setup(hass)
    rings = hass.data[DOMAIN]["rings"]
    img = AsyncMock(return_value=b"\xff\xd8bild")
    with patch.object(RingBook, "async_image", img):
        hass.states.async_set("event.g4_doorbell", dt_util.utcnow().isoformat(), {"device_class": "doorbell", "event_type": "ring"})
        await hass.async_block_till_done()
        assert len(rings.rings) == 1 and rings.rings[0]["cam"] == "camera.haustuer"
        name = rings.rings[0]["bild"]
        assert (rings.dir / name).read_bytes() == b"\xff\xd8bild" and img.await_args.args == ("camera.haustuer",)
        await rings.async_ring("event.g4_doorbell")          # gleich noch einmal gedrückt
        assert rings.rings[1]["bild"] == name and img.await_count == 1
        # alter Eintrag samt Bild fällt nach KEEP_DAYS heraus, verwaiste Dateien auch
        old = int(time.time() - (KEEP_DAYS + 1) * 86400)
        (rings.dir / f"{old}.jpg").write_bytes(b"alt")
        (rings.dir / "1234567890.jpg").write_bytes(b"verwaist")
        rings.rings.insert(0, {"ts": float(old), "bild": f"{old}.jpg"})
        await rings.async_prune()
        assert [r["ts"] for r in rings.rings if r["ts"] < time.time() - 86400] == []
        assert not (rings.dir / f"{old}.jpg").exists() and not (rings.dir / "1234567890.jpg").exists() and (rings.dir / name).exists()
        # Standbilder aus → nur der Eintrag
        await hass.data[DOMAIN]["store"].async_save({"doorbell": {"snapshots": False}})
        e = await rings.async_ring("event.g4_doorbell")
        assert "bild" not in e and img.await_count == 1
    for f in rings.dir.iterdir():
        f.unlink()


async def test_ws_zeitleiste_and_image(hass: HomeAssistant, hass_ws_client, hass_client) -> None:
    """Websocket liefert Tür, Klingel (signierte Bildadresse) und Modus; das Bild ist nur angemeldet abrufbar."""
    from homeassistant.components.recorder.util import get_instance

    hass.states.async_set("binary_sensor.haustuer", "off", {"device_class": "door", "friendly_name": "Haustür"})
    hass.states.async_set("binary_sensor.versteckt", "off", {"device_class": "door"})
    hass.states.async_set("camera.haustuer", "idle", {})
    hass.states.async_set("event.g4_doorbell", "unknown", {"device_class": "doorbell"})
    monitor = await _setup(hass)
    await hass.data[DOMAIN]["store"].async_save({"hidden_entities": ["binary_sensor.versteckt"]})
    hass.states.async_set("binary_sensor.haustuer", "on", {"device_class": "door", "friendly_name": "Haustür"})
    hass.states.async_set("binary_sensor.versteckt", "on", {"device_class": "door"})
    await hass.async_block_till_done()
    hass.states.async_set("binary_sensor.haustuer", "off", {"device_class": "door", "friendly_name": "Haustür"})
    monitor.book.set_mode("weg", "Tobias", "zuhause")
    rings = hass.data[DOMAIN]["rings"]
    with patch.object(RingBook, "async_image", AsyncMock(return_value=b"jpg")):
        entry = await rings.async_ring("event.g4_doorbell")
    await hass.async_block_till_done()
    await get_instance(hass).async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/zeitleiste", "days": 1})
    res = (await client.receive_json())["result"]
    assert res["recorder"] is True and res["days"] == 1
    typ = [e["typ"] for e in res["events"]]
    assert "klingel" in typ and "modus" in typ
    door = [e for e in res["events"] if e["typ"] == "tuer"]
    assert len(door) == 1 and door[0]["eid"] == "binary_sensor.haustuer" and door[0]["name"] == "Haustür" and "dur" in door[0]
    bild = [e for e in res["events"] if e["typ"] == "klingel"][0]["bild"]
    assert bild.startswith(f"/api/{DOMAIN}/klingel/{entry['bild']}?authSig=")

    http = await hass_client()
    assert (await http.get(bild)).status == 200
    assert await (await http.get(f"/api/{DOMAIN}/klingel/{entry['bild']}")).read() == b"jpg"
    assert (await http.get(f"/api/{DOMAIN}/klingel/..%2Fsecrets.yaml")).status in (400, 404)
    assert (await http.get(f"/api/{DOMAIN}/klingel/1111111111.jpg")).status == 404
    for f in rings.dir.iterdir():
        f.unlink()
