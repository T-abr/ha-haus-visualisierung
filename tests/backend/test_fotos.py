"""Fotos aus dem geteilten iCloud-Album für den Bildschirmschoner (pytest tests/backend)."""
import pytest
from homeassistant.core import HomeAssistant
from test_push import _setup

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.fotos import (
    album_host, album_token, asset_urls, parse_ck, parse_stream, pick_derivative,
)
from custom_components.haus_visualisierung.store import sanitize

LINK = "https://www.icloud.com/sharedalbum/#B0aTEST1234"
STREAM = {
    "streamName": "Familie",
    "photos": [
        {"photoGuid": "AAA-1", "caption": "Urlaub", "dateCreated": "2026-10-12T10:00:00Z",
         "derivatives": {"342": {"checksum": "c-small", "width": "342", "height": "228"},
                         "2048": {"checksum": "c-big", "width": "2048", "height": "1365"},
                         "4032": {"checksum": "c-orig", "width": "4032", "height": "2688"}}},
        {"photoGuid": "BBB-2", "dateCreated": "2026-11-01T10:00:00Z",
         "derivatives": {"1536": {"checksum": "c-hoch", "width": "1024", "height": "1536"}}},
        {"photoGuid": "VID-3", "mediaAssetType": "video", "dateCreated": "2026-11-02T10:00:00Z",
         "derivatives": {"PosterFrame": {"checksum": "c-vid", "width": "640", "height": "360"}}},
    ],
}
CK_LINK = "https://photos.icloud.com/shared/album/012TEST-abcdEFG-hij_k12-A"
CK_KEY = "012TEST-abcdEFG-hij_k12-A"
CK_BASE = "https://ckdatabasews.icloud.com/database/1/com.apple.photos.cloud/production"
CK_PART = "https://p111-ckdatabasews.icloud.com/database/1/com.apple.photos.cloud/production"
CK_ZONE = {"zoneName": "SharedCollection-TEST", "ownerRecordName": "_test", "zoneType": "REGULAR_CUSTOM_ZONE"}
CK_RESOLVE = {"results": [{"zoneID": CK_ZONE, "anonymousPublicAccess": {
    "token": "TOKEN123", "tokenTTL": 1200000, "databasePartition": "https://p111-ckdatabasews.icloud.com:443"}}]}


def _res(chk: str, w: int, h: int, prefix: str = "resJPEGMed", ftype: str = "public.jpeg") -> dict:
    return {f"{prefix}Res": {"type": "ASSETID", "value": {"fileChecksum": chk,
                                                            "downloadURL": f"https://cvws.icloud-content.com/B/{chk}/${{f}}?o=x"}},
            f"{prefix}Width": {"value": w}, f"{prefix}Height": {"value": h}, f"{prefix}FileType": {"value": ftype}}


# Aufbau wie die echte Antwort von records/query (Album mit HEIC-Originalen, 27.11.2026), gekürzt
CK_RECORDS = {"records": [
    {"recordName": "M1", "recordType": "CPLMaster", "fields": {
        "itemType": {"value": "public.heic"}, **_res("med1", 1330, 2364), **_res("thumb1", 310, 552, "resJPEGThumb"),
        **_res("orig1", 2268, 4032, "resOriginal", "public.heic")}},
    {"recordName": "M2", "recordType": "CPLMaster", "fields": {
        "itemType": {"value": "public.jpeg"}, **_res("med2", 1536, 2048), **_res("orig2", 4032, 3024, "resOriginal")}},
    {"recordName": "M3", "recordType": "CPLMaster", "fields": {
        "itemType": {"value": "com.apple.quicktime-movie"}, **_res("vid3", 1920, 1080)}},
    {"recordName": "A1", "recordType": "CPLAsset", "fields": {
        "masterRef": {"value": {"recordName": "M1"}}, "assetDate": {"value": 1795672871891}, "isHidden": {"value": 0},
        "captionEnc": {"value": "U29tbWVyZmVzdA=="}}},
    {"recordName": "A2", "recordType": "CPLAsset", "fields": {
        "masterRef": {"value": {"recordName": "M2"}}, "assetDate": {"value": 1795672856353},
        **_res("edit2", 2000, 1500, "resJPEGFull")}},
    {"recordName": "A3", "recordType": "CPLAsset", "fields": {
        "masterRef": {"value": {"recordName": "M3"}}, "assetDate": {"value": 1795672900000}}},
]}

URLS = {
    "items": {"c-big": {"url_location": "cvws.icloud-content.com", "url_path": "/a/big.jpg"},
              "c-hoch": {"url_location": "cvws.icloud-content.com", "url_path": "/a/hoch.jpg"}},
    "locations": {"cvws.icloud-content.com": {"scheme": "https", "hosts": ["cvws.icloud-content.com"]}},
}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(recorder_mock, enable_custom_integrations):
    """Recorder vor hass einrichten (sonst Reihenfolge-Fehler der Fixtures)."""
    yield


def test_link_and_host() -> None:
    """Token aus Link oder direkt, Server-Partition aus dem Token."""
    assert album_token(LINK) == "B0aTEST1234"
    assert album_token("https://www.icloud.com/sharedalbum/de-de/#B0aTEST1234;CAEA") == "B0aTEST1234"
    assert album_token("B0aTEST1234") == "B0aTEST1234"
    assert album_token("") is None and album_token("https://example.com/") is None
    assert album_host("B0aTEST1234") == "p36-sharedstreams.icloud.com"
    assert album_host("A5xyz123") == "p05-sharedstreams.icloud.com"
    # neues Format (geteilte Sammlung)
    assert album_token(CK_LINK) == "ck:" + CK_KEY
    assert album_token(CK_LINK + "/") == "ck:" + CK_KEY
    assert album_token("https://photos.icloud.com/shared/album/kurz") is None


def test_parse_ck() -> None:
    """CloudKit: Master-Varianten, bearbeitete Fassung am Asset, kein HEIC, keine Videos, Text aus captionEnc."""
    photos = parse_ck(CK_RECORDS["records"])
    assert len(photos) == 2
    a1, a2 = photos
    assert (a1["checksum"], a1["w"], a1["h"]) == ("med1", 1330, 2364)
    assert a1["url"] == "https://cvws.icloud-content.com/B/med1/foto.jpg?o=x" and a1["caption"] == "Sommerfest"
    assert a1["date"].startswith("2026-11-26") and a1["date"] > a2["date"]
    assert a2["checksum"] == "edit2" and a2["caption"] == ""
    assert len({a1["id"], a2["id"]}) == 2 and all(len(p["id"]) == 24 for p in photos)


def test_parse_stream() -> None:
    """Größte Variante bis 2600 px, Videos weg, neueste zuerst; Download-Adressen aus webasseturls."""
    photos = parse_stream(STREAM)
    assert [p["id"] for p in photos] == ["BBB-2", "AAA-1"]
    assert photos[1]["checksum"] == "c-big" and (photos[1]["w"], photos[1]["h"]) == (2048, 1365)
    assert photos[1]["caption"] == "Urlaub" and photos[0]["caption"] == ""
    assert pick_derivative({"x": {"checksum": "o", "width": "5000", "height": "4000"}})["checksum"] == "o"
    assert asset_urls(URLS)["c-hoch"] == "https://cvws.icloud-content.com/a/hoch.jpg"


def test_store_sanitize() -> None:
    """Link, Wechsel und Beschriftung werden geprüft."""
    w = sanitize({"wallpanel": {"photos": LINK, "photo_sec": 2, "photo_caption": False}})["wallpanel"]
    assert w["photos"] == LINK and w["photo_sec"] == 5 and w["photo_caption"] is False
    assert sanitize({"wallpanel": {"photos": CK_LINK}})["wallpanel"]["photos"] == CK_LINK
    assert sanitize({"wallpanel": {"photos": "<script>"}})["wallpanel"]["photos"] == ""
    assert sanitize({})["wallpanel"]["photos"] == "" and sanitize({})["wallpanel"]["photo_sec"] == 30


async def test_sync_and_serve(hass: HomeAssistant, aioclient_mock, hass_ws_client, hass_client) -> None:
    """Album lesen (mit Umleitung auf die richtige Partition), Bilder ablegen, signiert ausliefern, Link leeren räumt auf."""
    await _setup(hass)
    album = hass.data[DOMAIN]["fotos"]
    aioclient_mock.post("https://p36-sharedstreams.icloud.com/B0aTEST1234/sharedstreams/webstream",
                        status=330, json={"X-Apple-MMe-Host": "p99-sharedstreams.icloud.com"})
    aioclient_mock.post("https://p99-sharedstreams.icloud.com/B0aTEST1234/sharedstreams/webstream", json=STREAM)
    aioclient_mock.post("https://p99-sharedstreams.icloud.com/B0aTEST1234/sharedstreams/webasseturls", json=URLS)
    aioclient_mock.get("https://cvws.icloud-content.com/a/big.jpg", content=b"big")
    aioclient_mock.get("https://cvws.icloud-content.com/a/hoch.jpg", content=b"hoch")

    store = hass.data[DOMAIN]["store"]
    await store.async_patch([{"path": ["wallpanel", "photos"], "value": LINK}])
    await album.async_refresh()
    assert album.error == "" and [p["file"] for p in album.photos] == ["BBB-2.jpg", "AAA-1.jpg"]
    assert (album.dir / "AAA-1.jpg").read_bytes() == b"big"

    # zweiter Abruf lädt nichts erneut herunter
    n = aioclient_mock.call_count
    await album.async_refresh()
    assert aioclient_mock.call_count == n + 2   # Umleitung + webstream, keine Bilder

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/fotos"})
    res = (await ws.receive_json())["result"]
    assert res["count"] == 2 and res["photos"][1]["caption"] == "Urlaub" and "authSig=" in res["photos"][0]["url"]
    client = await hass_client()
    resp = await client.get(res["photos"][1]["url"])
    assert resp.status == 200 and await resp.read() == b"big"
    assert (await client.get(f"/api/{DOMAIN}/foto/..%2Fsecret.jpg")).status in (400, 404)
    assert (await client.get(f"/api/{DOMAIN}/foto/fehlt.jpg")).status == 404

    await store.async_patch([{"path": ["wallpanel", "photos"], "value": ""}])
    await album.async_refresh()
    await hass.async_block_till_done()
    assert album.photos == [] and not any(album.dir.iterdir())


async def test_album_error(hass: HomeAssistant, aioclient_mock) -> None:
    """Album ohne öffentliche Website: Fehler wird gemerkt, nichts stürzt ab."""
    await _setup(hass)
    album = hass.data[DOMAIN]["fotos"]
    aioclient_mock.post("https://p36-sharedstreams.icloud.com/B0aTEST1234/sharedstreams/webstream", status=404, json={})
    await hass.data[DOMAIN]["store"].async_patch([{"path": ["wallpanel", "photos"], "value": LINK}])
    await album.async_refresh()
    assert "Öffentliche Website" in album.error and album.photos == []


async def test_sync_ck(hass: HomeAssistant, aioclient_mock) -> None:
    """Neues Link-Format: resolve → Partition + Token, query → Fotos, Bilder ablegen."""
    await _setup(hass)
    album = hass.data[DOMAIN]["fotos"]
    aioclient_mock.post(f"{CK_BASE}/public/records/resolve", json=CK_RESOLVE)
    aioclient_mock.post(f"{CK_PART}/shared/records/query", json=CK_RECORDS)
    aioclient_mock.get("https://cvws.icloud-content.com/B/med1/foto.jpg", content=b"eins")
    aioclient_mock.get("https://cvws.icloud-content.com/B/edit2/foto.jpg", content=b"zwei")
    await hass.data[DOMAIN]["store"].async_patch([{"path": ["wallpanel", "photos"], "value": CK_LINK}])
    await album.async_refresh()
    assert album.error == "" and len(album.photos) == 2
    assert (album.dir / album.photos[0]["file"]).read_bytes() == b"eins"
    query = [c for c in aioclient_mock.mock_calls if "records/query" in str(c[1])][0]
    assert "publicAccessAuthToken=TOKEN123" in str(query[1]) and '"SharedCollection-TEST"' in query[2]


async def test_ck_errors(hass: HomeAssistant, aioclient_mock) -> None:
    """Album ohne Freigabe und unbekannter Link: verständliche Meldung statt Stille."""
    await _setup(hass)
    album = hass.data[DOMAIN]["fotos"]
    store = hass.data[DOMAIN]["store"]
    aioclient_mock.post(f"{CK_BASE}/public/records/resolve", status=404, json={"serverErrorCode": "NOT_FOUND"})
    await store.async_patch([{"path": ["wallpanel", "photos"], "value": CK_LINK}])
    await album.async_refresh()
    assert "Öffentliche Website" in album.error and album.photos == []
    await store.async_patch([{"path": ["wallpanel", "photos"], "value": "https://example.com/album"}])
    await album.async_refresh()
    assert album.error.startswith("Link nicht erkannt") and album.updated > 0
