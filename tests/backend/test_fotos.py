"""Fotos aus dem geteilten iCloud-Album für den Bildschirmschoner (pytest tests/backend)."""
import pytest
from homeassistant.core import HomeAssistant
from test_push import _setup

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.fotos import album_host, album_token, asset_urls, parse_stream, pick_derivative
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
