"""Wartungsplaner: Intervalle, Einstellungen, Erledigt/Rückgängig und Hinweis in den Meldungen (pytest tests/backend)."""
from datetime import date, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _setup, _tick

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.maintenance import add_interval, due_info, due_text
from custom_components.haus_visualisierung.store import sanitize


def test_intervalle() -> None:
    assert add_interval(date(2026, 1, 31), 1, "monate") == date(2026, 2, 28)
    assert add_interval(date(2024, 2, 29), 1, "jahre") == date(2025, 2, 28)
    assert add_interval(date(2026, 11, 23), 6, "monate") == date(2027, 5, 23)
    assert add_interval(date(2026, 11, 23), 2, "wochen") == date(2026, 12, 7)
    assert add_interval(date(2026, 12, 30), 3, "tage") == date(2027, 1, 2)
    t = {"id": "f", "interval": 6, "unit": "monate", "since": "2026-01-10"}
    today = date(2026, 7, 15)
    assert due_info(t, {}, today) == (date(2026, 7, 10), -5)
    # Erledigt später als das Startdatum zählt, früher nicht
    assert due_info(t, {"f": {"last": "2026-07-14"}}, today) == (date(2027, 1, 14), 183)
    assert due_info(t, {"f": {"last": "2025-01-01"}}, today)[1] == -5
    assert due_info({**t, "since": ""}, {}, today) == (None, None)
    assert [due_text(d) for d in (None, 0, -1, -5)] == ["noch nie erledigt", "heute fällig", "seit 1 Tag fällig", "seit 5 Tagen fällig"]


def test_einstellungen_pruefen() -> None:
    lay = sanitize({"maintenance": {"enabled": False, "lead_days": 500, "tasks": [
        {"id": "filter", "title": "Filter" * 20, "icon": "evil", "interval": 0, "unit": "jahrhunderte", "since": "gestern", "note": "x"},
        {"id": "filter", "title": "Doppelt", "interval": 3, "unit": "wochen", "since": "2026-11-01"},
        {"id": "Böse ID!", "title": "Rauch"}, "kaputt"]}})
    m = lay["maintenance"]
    assert m["enabled"] is False and m["lead_days"] == 90
    assert [t["id"] for t in m["tasks"]] == ["filter", "w1", "w2"]
    a, b = m["tasks"][0], m["tasks"][1]
    assert len(a["title"]) == 60 and a["icon"] == "mdi:wrench-clock" and a["interval"] == 1 and a["unit"] == "monate" and a["since"] == ""
    assert b["unit"] == "wochen" and b["interval"] == 3 and b["since"] == "2026-11-01"
    assert sanitize({})["maintenance"] == {"enabled": True, "lead_days": 14, "tasks": []}
    assert sanitize({})["alerts"]["builtin"]["maintenance"] is True


async def test_erledigt_und_meldung(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    monitor = await _setup(hass)
    client = await hass_ws_client(hass)
    today = dt_util.now().date()
    old = (today - timedelta(days=200)).isoformat()
    await client.send_json({"id": 1, "type": f"{DOMAIN}/subscribe"})
    assert (await client.receive_json())["success"]
    first = await client.receive_json()
    assert first["event"]["maintenance"] == {}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/save", "layout": {"maintenance": {"tasks": [
        {"id": "filter", "title": "Lüftungsfilter", "interval": 6, "unit": "monate", "since": old},
        {"id": "rauch", "title": "Rauchmelder", "interval": 12, "unit": "monate", "since": today.isoformat()}]}}})
    got = [await client.receive_json(), await client.receive_json()]
    assert any(m["id"] == 2 and m["success"] for m in got)
    await _tick(hass)
    assert "maint:filter" in monitor._active and "maint:rauch" not in monitor._active
    al = monitor._active["maint:filter"]
    assert al.level == "info" and al.title == "Wartung fällig · Lüftungsfilter" and al.path == "wartung" and "fällig" in al.detail
    assert any("Lüftungsfilter" in c.data.get("title", "") + c.data.get("message", "") for c in calls)

    # Erledigt: Abo bekommt den neuen Stand, Meldung ist behoben
    await client.send_json({"id": 3, "type": f"{DOMAIN}/maintenance_done", "task": "filter"})
    got = [await client.receive_json(), await client.receive_json()]
    res = next(m for m in got if m["id"] == 3 and m["type"] == "result")
    ev = next(m for m in got if m["id"] == 1 and m["type"] == "event")
    st = res["result"]["maintenance"]["filter"]
    assert st["last"] == today.isoformat() and len(st["history"]) == 1 and ev["event"]["maintenance"] == res["result"]["maintenance"]
    await _tick(hass)
    assert "maint:filter" not in monitor._active

    # Rückgängig → wieder fällig; nichts mehr zum Zurücknehmen → Fehler
    await client.send_json({"id": 4, "type": f"{DOMAIN}/maintenance_done", "task": "filter", "undo": True})
    got = [await client.receive_json(), await client.receive_json()]
    assert next(m for m in got if m["id"] == 4)["result"]["maintenance"] == {}
    await _tick(hass)
    assert "maint:filter" in monitor._active
    await client.send_json({"id": 5, "type": f"{DOMAIN}/maintenance_done", "task": "filter", "undo": True})
    assert (await client.receive_json())["error"]["code"] == "not_found"

    # Datum in der Zukunft, unbekannte Aufgabe
    await client.send_json({"id": 6, "type": f"{DOMAIN}/maintenance_done", "task": "filter", "date": (today + timedelta(days=3)).isoformat()})
    assert (await client.receive_json())["error"]["code"] == "invalid"
    await client.send_json({"id": 7, "type": f"{DOMAIN}/maintenance_done", "task": "gibtsnicht"})
    assert (await client.receive_json())["error"]["code"] == "not_found"

    # an einem Datum erledigt; wird gespeichert
    day = (today - timedelta(days=2)).isoformat()
    await client.send_json({"id": 8, "type": f"{DOMAIN}/maintenance_done", "task": "rauch", "date": day})
    got = [await client.receive_json(), await client.receive_json()]
    assert next(m for m in got if m["id"] == 8)["result"]["maintenance"]["rauch"]["last"] == day
    await _tick(hass, 5)
    assert hass_storage[f"{DOMAIN}.wartung"]["data"]["tasks"]["rauch"]["last"] == day

    # Regel abgeschaltet → keine Meldung; Aufgabe gelöscht → Stand verworfen
    await client.send_json({"id": 9, "type": f"{DOMAIN}/save", "layout": {"alerts": {"builtin": {"maintenance": False}}, "maintenance": {"tasks": [
        {"id": "filter", "title": "Lüftungsfilter", "interval": 6, "unit": "monate", "since": old}]}}})
    got = [await client.receive_json() for _ in range(3)]  # Ergebnis, Layout-Ereignis, Wartungs-Ereignis (rauch verworfen)
    assert any(m.get("event", {}).get("maintenance") == {} for m in got)
    await _tick(hass)
    assert "maint:filter" not in monitor._active
    assert "rauch" not in hass.data[DOMAIN]["maintenance"].data


async def test_erledigt_ohne_admin(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    await hass.data[DOMAIN]["store"].async_save({"maintenance": {"tasks": [{"id": "kamin", "title": "Kaminkehrer", "interval": 1, "unit": "jahre"}]}})
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/maintenance_done", "task": "kamin"})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"]["maintenance"]["kamin"]["last"] == dt_util.now().date().isoformat()
