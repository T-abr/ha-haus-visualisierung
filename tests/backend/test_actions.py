"""Aktionen und Eskalation des Alarmmanagers (pytest tests/backend)."""
import time
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _house, _setup, _tick

DOMAIN = "haus_visualisierung"
S = {"device_class": "smoke", "friendly_name": "Wohnzimmer Rauchmelder"}
W = {"device_class": "window", "friendly_name": "Schlafzimmer Fenster"}

ACTIONS = [
    {"id": "knx", "name": "KNX Sammelalarm", "type": "knx", "scope": "alarm", "when": "neu", "address": "1/7/0", "payload": 1, "reset_payload": 0, "reset": True},
    {"id": "sir", "name": "Sirene", "type": "siren", "scope": "b:safety", "when": "eskalation", "entity": "siren.garten", "reset": True},
    {"id": "sonos", "name": "Durchsage", "type": "tts", "scope": "alarm", "when": "neu", "entity": "media_player.kueche", "tts": "tts.google_translate_de_de",
     "message": "Achtung: {titel}", "volume": 50},
    {"id": "skript", "name": "Skript", "type": "script", "scope": "b:contacts", "when": "neu", "entity": "script.fenster_hinweis"},
    {"id": "nacht", "name": "Nur Abwesend", "type": "switch", "scope": "all", "when": "neu", "entity": "switch.blitzleuchte", "modes": ["abwesend"]},
]


async def _save(hass, **kw):
    store = hass.data[DOMAIN]["store"]
    await store.async_save({**store.data, **kw})
    await hass.async_block_till_done()


async def test_actions_reset_escalation(hass: HomeAssistant, hass_ws_client) -> None:
    push = async_mock_service(hass, "notify", "mobile_app_handy")
    knx = async_mock_service(hass, "knx", "send")
    siren_on = async_mock_service(hass, "siren", "turn_on")
    siren_off = async_mock_service(hass, "siren", "turn_off")
    vol = async_mock_service(hass, "media_player", "volume_set")
    play = async_mock_service(hass, "media_player", "play_media")
    script = async_mock_service(hass, "script", "turn_on")
    sw = async_mock_service(hass, "switch", "turn_on")
    ids = await _house(hass)
    monitor = await _setup(hass)
    await _save(hass, alarm_actions=ACTIONS, escalation={"enabled": True, "minutes": 5, "levels": ["alarm"], "push_critical": True})
    lay = hass.data[DOMAIN]["store"].data
    assert [a["id"] for a in lay["alarm_actions"]] == ["knx", "sir", "sonos", "skript", "nacht"]

    # Rauchalarm → KNX 1, Durchsage mit Lautstärke und Text; Sirene erst bei Eskalation
    hass.states.async_set(ids["rauch"], "on", S)
    await _tick(hass)
    key = f"safety:{ids['rauch']}"
    assert knx and knx[-1].data == {"address": "1/7/0", "payload": 1}
    assert vol[-1].data == {"entity_id": "media_player.kueche", "volume_level": 0.5}
    pm = play[-1].data
    assert pm["announce"] is True and pm["media_content_id"].startswith("media-source://tts/tts.google_translate_de_de?message=Achtung%3A%20Wohnzimmer")
    assert not siren_on and not sw  # Blitzleuchte nur bei Abwesend
    assert any(e["type"] == "aktion" and e["text"] == "KNX Sammelalarm ausgeführt" for e in monitor.book.log)

    # Fenster → nur das Skript (Bereich „Fenster oder Tür offen“) mit Variablen
    hass.states.async_set(ids["fenster"], "on", W)
    await _tick(hass)
    assert script[-1].data["entity_id"] == "script.fenster_hinweis" and script[-1].data["variables"]["titel"] == "Schlafzimmer · Fenster offen"
    assert len(knx) == 1  # Warnung löst den KNX-Sammelalarm (nur Alarme) nicht aus

    # Eskalation nach 5 Min. ohne Quittung: kritische Push-Meldung + Sirene, nur einmal
    n_push = len(push)
    future = time.time() + 6 * 60
    with patch("custom_components.haus_visualisierung.actions.time.time", return_value=future):
        monitor._on_tick(None)
        await hass.async_block_till_done()
        monitor._on_tick(None)
        await hass.async_block_till_done()
    esc = [c for c in push[n_push:] if c.data.get("title", "").startswith("🏠 Nicht quittiert")]
    assert len(esc) == 1 and esc[0].data["data"]["push"]["sound"]["critical"] == 1
    assert len(siren_on) == 1 and siren_on[0].data == {"entity_id": "siren.garten"}
    assert monitor.book.alarms[key]["escalated"] and any(e["type"] == "eskaliert" for e in monitor.book.log)
    assert f"contact:{ids['fenster']}" not in [k for k, a in monitor.book.alarms.items() if a.get("escalated")]  # Warnungen eskalieren nicht

    # Quittieren → KNX 0 und Sirene aus
    monitor.async_action(key, "ack", "Tobias")
    await hass.async_block_till_done()
    assert knx[-1].data == {"address": "1/7/0", "payload": 0}
    assert siren_off and siren_off[-1].data == {"entity_id": "siren.garten"}

    # Statistik mit Dauer und Fehlalarm-Verdacht
    for _ in range(3):
        hass.states.async_set(ids["fenster"], "off", W)
        await _tick(hass)
        hass.states.async_set(ids["fenster"], "on", W)
        await _tick(hass)
    hass.states.async_set(ids["fenster"], "off", W)
    await _tick(hass)
    st = next(x for x in monitor.book.stats(7) if x["key"] == f"contact:{ids['fenster']}")
    assert st["n"] == 4 and st["short"] == 4 and "kurz" in st["verdacht"] and "ohne Reaktion" in st["verdacht"] and st["avg"] is not None

    # Test über Websocket (auch ungespeichert) – schaltende Aktion wird nach 3 s zurückgesetzt
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/action_test", "action": {"type": "knx", "address": "2/1/5", "payload": 1, "reset_payload": 0}})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["calls"][0]["data"] == {"address": "2/1/5", "payload": 1}
    await hass.async_block_till_done()
    assert knx[-1].data == {"address": "2/1/5", "payload": 1}
    await _tick(hass, 4)
    assert knx[-1].data == {"address": "2/1/5", "payload": 0}
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/action_test", "action": {"type": "knx", "address": "falsch"}})
    res = await ws.receive_json()
    assert not res["success"]


async def test_action_modes_and_store(hass: HomeAssistant) -> None:
    async_mock_service(hass, "notify", "mobile_app_handy")
    sw = async_mock_service(hass, "switch", "turn_on")
    sw_off = async_mock_service(hass, "switch", "turn_off")
    ids = await _house(hass)
    monitor = await _setup(hass)
    await _save(hass, alarm_actions=ACTIONS + [{"type": "unbekannt"}, {"type": "knx", "address": "1/2/3/4"}])
    acts = hass.data[DOMAIN]["store"].data["alarm_actions"]
    assert len(acts) == 6 and acts[-1]["address"] == ""  # ungültige Gruppenadresse geleert, unbekannter Typ verworfen
    monitor.house.set_mode("abwesend", "Tobias")
    hass.states.async_set(ids["fenster"], "on", W)
    await _tick(hass)
    assert sw and sw[-1].data == {"entity_id": "switch.blitzleuchte"}
    # stumm schalten setzt zurück
    monitor.async_action(f"contact:{ids['fenster']}", "mute", "Tobias", minutes=60)
    await hass.async_block_till_done()
    assert sw_off and sw_off[-1].data == {"entity_id": "switch.blitzleuchte"}
