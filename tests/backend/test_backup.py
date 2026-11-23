"""Sicherungen der Einstellungen: automatisch vor Update und vor dem Speichern, von Hand, Export/Import, Wiederherstellen."""
import time

from homeassistant.core import HomeAssistant
from test_push import _setup, _tick

from custom_components.haus_visualisierung import backup as bk
from custom_components.haus_visualisierung.const import DOMAIN, VERSION


def test_datei_pruefen() -> None:
    doc = bk.export_doc({"area_order": ["kueche"]}, {"filter": {"last": "2026-01-01"}}, 0)
    assert doc["format"] == "haus_visualisierung" and doc["version"] == VERSION and doc["layout"]["area_order"] == ["kueche"]
    assert bk.parse_doc(doc) == ({"area_order": ["kueche"]}, {"filter": {"last": "2026-01-01"}})
    # nacktes Layout geht auch, aber ohne Wartungsstand; Fremdes nicht
    assert bk.parse_doc({"alerts": {}}) == ({"alerts": {}}, None)
    assert bk.parse_doc({"foo": 1}) is None and bk.parse_doc([1]) is None and bk.parse_doc({"format": "anders", "layout": {}}) is None
    m = bk.clean_maintenance({"a": {"history": [{"date": "2026-02-01", "by": "Tobias"}, {"date": "2026-01-01"}, "x"]}, "b": {"history": []}, 3: {}})
    assert m == {"a": {"history": [{"date": "2026-01-01", "by": None}, {"date": "2026-02-01", "by": "Tobias"}], "last": "2026-02-01", "by": "Tobias"}}


async def test_sicherungen(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    # Gespeicherter Stand einer älteren Version → beim Start „vor dem Update“ gesichert
    hass_storage[DOMAIN] = {"version": 1, "key": DOMAIN, "data": {"area_order": ["wohnen", "kueche"], "favorites": ["light.a"]}}
    hass_storage[f"{DOMAIN}.sicherungen"] = {"version": 1, "key": f"{DOMAIN}.sicherungen", "data": {"version": "1.0.0", "items": []}}
    await _setup(hass)
    b = hass.data[DOMAIN]["backups"]
    assert [i["reason"] for i in b.items] == ["update"] and b.items[0]["note"] == "von 1.0.0"
    assert b.items[0]["layout"]["area_order"] == ["wohnen", "kueche"]
    client = await hass_ws_client(hass)

    await client.send_json({"id": 1, "type": f"{DOMAIN}/backup_list"})
    res = (await client.receive_json())["result"]["items"]
    assert len(res) == 1 and res[0]["summary"]["raeume"] == 2 and "layout" not in res[0]

    # Speichern: die Sicherung beim Update ist jünger als ein Tag → keine neue
    await client.send_json({"id": 2, "type": f"{DOMAIN}/save", "layout": {"area_order": ["kueche"]}})
    assert (await client.receive_json())["success"]
    assert len(b.items) == 1
    # einen Tag später → Stand vor dem Speichern wird gesichert
    b.items[0]["ts"] = time.time() - 25 * 3600
    await client.send_json({"id": 3, "type": f"{DOMAIN}/save", "layout": {"area_order": ["bad"]}})
    assert (await client.receive_json())["success"]
    assert b.items[-1]["reason"] == "taeglich" and b.items[-1]["layout"]["area_order"] == ["kueche"]

    # von Hand, Export und Herunterladen
    await client.send_json({"id": 4, "type": f"{DOMAIN}/backup_create"})
    res = (await client.receive_json())["result"]
    sid = res["id"]
    assert res["items"][0]["id"] == sid and res["items"][0]["reason"] == "manuell"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/backup_get", "backup": sid})
    doc = (await client.receive_json())["result"]
    assert doc["format"] == "haus_visualisierung" and doc["layout"]["area_order"] == ["bad"]
    await client.send_json({"id": 6, "type": f"{DOMAIN}/export"})
    exp = (await client.receive_json())["result"]
    assert exp["layout"]["area_order"] == ["bad"] and "code" not in exp

    # Import einer Datei: vorher wird gesichert, Wartungsstand kommt mit
    await hass.data[DOMAIN]["store"].async_save({"maintenance": {"tasks": [{"id": "filter", "title": "Filter"}]}})
    imp = {**exp, "layout": {**exp["layout"], "area_order": ["garten"], "maintenance": {"tasks": [{"id": "filter", "title": "Filter"}]}},
           "maintenance": {"filter": {"history": [{"date": "2026-03-01", "by": "Tobias"}]}}}
    await client.send_json({"id": 7, "type": f"{DOMAIN}/backup_restore", "data": imp})
    res = (await client.receive_json())["result"]
    assert res["layout"]["area_order"] == ["garten"] and res["items"][0]["reason"] == "import"
    assert hass.data[DOMAIN]["maintenance"].data["filter"]["last"] == "2026-03-01"

    # Wiederherstellen der manuellen Sicherung (ohne Wartung)
    await client.send_json({"id": 8, "type": f"{DOMAIN}/backup_restore", "backup": sid, "maintenance": False})
    res = (await client.receive_json())["result"]
    assert res["layout"]["area_order"] == ["bad"] and res["items"][0]["reason"] == "wiederherstellen"

    # Fehler: Unbekanntes, Fremdes, Löschen
    await client.send_json({"id": 9, "type": f"{DOMAIN}/backup_restore", "data": {"foo": 1}})
    assert (await client.receive_json())["error"]["code"] == "invalid"
    await client.send_json({"id": 10, "type": f"{DOMAIN}/backup_get", "backup": "gibtsnicht"})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    n = len(b.items)
    await client.send_json({"id": 11, "type": f"{DOMAIN}/backup_delete", "backup": sid})
    assert len((await client.receive_json())["result"]["items"]) == n - 1

    # höchstens KEEP Sicherungen, Datei wird geschrieben
    for _ in range(bk.KEEP + 3):
        b.create("manuell")
    assert len(b.items) == bk.KEEP
    await _tick(hass, 5)
    assert b.last_version == VERSION


async def test_frische_installation_ohne_sicherung(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    assert hass.data[DOMAIN]["backups"].items == []
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/backup_list"})
    assert (await client.receive_json())["error"]["code"] == "unauthorized"
