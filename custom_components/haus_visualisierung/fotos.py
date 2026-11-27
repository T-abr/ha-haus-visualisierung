"""Fotos für den Bildschirmschoner aus einem geteilten iCloud-Album („Öffentliche Website“).

Apple Fotos ist aus dem Browser nicht erreichbar. Ein geteiltes Album mit öffentlichem Link schon: Die Integration
liest es regelmäßig über dieselbe Schnittstelle wie die Album-Webseite (sharedstreams: ``webstream`` liefert die
Fotos, ``webasseturls`` die Download-Adressen), legt die Bilder unter /config/haus_visualisierung/fotos ab und
gibt sie über eine signierte Adresse ans Panel (FotoView). Videos werden übersprungen.

Link: Einstellungen → Wandpanel & Displays → Bildschirmschoner → „Fotos aus iCloud-Album“ (``wallpanel.photos``).
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import Callable
from datetime import timedelta
from http import HTTPStatus
from pathlib import Path
from typing import Any

import aiohttp
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.http import KEY_HASS
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}_fotos"
IMG_URL = f"/api/{DOMAIN}/foto"
NAME_RE = re.compile(r"^[A-Za-z0-9-]{1,80}\.jpg$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9]{6,40}$")
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

REFRESH = timedelta(hours=6)   # Album so oft neu lesen
MAX_PHOTOS = 300               # neueste Fotos behalten
MAX_EDGE = 2600                # größte Variante bis zu dieser Kantenlänge (iPad Pro: 2732)
MAX_BYTES = 25_000_000
URL_BATCH = 25                 # Fotos je webasseturls-Anfrage
TIMEOUT = aiohttp.ClientTimeout(total=60)


def album_token(link: str) -> str | None:
    """Token aus dem Album-Link (https://www.icloud.com/sharedalbum/#B0…) oder der Token selbst."""
    s = (link or "").strip()
    if "#" in s:
        s = s.split("#", 1)[1]
    s = s.split(";", 1)[0].strip("/ ")
    return s if TOKEN_RE.match(s) else None


def album_host(token: str) -> str:
    """Server des Albums: Partition steckt im Token (A + 1 Zeichen, sonst 2 Zeichen Base62)."""
    if token[0] == "A":
        part = BASE62.index(token[1])
    else:
        part = BASE62.index(token[1]) * 62 + BASE62.index(token[2])
    return f"p{part:02d}-sharedstreams.icloud.com"


def pick_derivative(derivs: dict) -> dict | None:
    """Größte Bildvariante bis MAX_EDGE, sonst die kleinste (Originale können riesig sein)."""
    opts = []
    for d in (derivs or {}).values():
        try:
            w, h = int(d.get("width") or 0), int(d.get("height") or 0)
        except (TypeError, ValueError):
            continue
        if w > 0 and h > 0 and d.get("checksum"):
            opts.append((w, h, d))
    if not opts:
        return None
    fit = [o for o in opts if max(o[0], o[1]) <= MAX_EDGE]
    w, h, d = max(fit, key=lambda o: o[0] * o[1]) if fit else min(opts, key=lambda o: o[0] * o[1])
    return {"w": w, "h": h, "checksum": str(d["checksum"])}


def parse_stream(data: dict) -> list[dict]:
    """Fotos aus der webstream-Antwort, neueste zuerst, Videos weggelassen."""
    out = []
    for p in data.get("photos") or []:
        if not isinstance(p, dict) or p.get("mediaAssetType") == "video":
            continue
        guid = re.sub(r"[^A-Za-z0-9-]", "", str(p.get("photoGuid") or ""))[:80]
        der = pick_derivative(p.get("derivatives") or {})
        if not guid or not der:
            continue
        out.append({"id": guid, **der, "caption": str(p.get("caption") or "")[:200],
                    "date": str(p.get("dateCreated") or p.get("batchDateCreated") or "")[:40]})
    out.sort(key=lambda p: p["date"], reverse=True)
    return out[:MAX_PHOTOS]


def asset_urls(data: dict) -> dict[str, str]:
    """checksum → Download-Adresse aus der webasseturls-Antwort."""
    locs = data.get("locations") or {}
    res = {}
    for chk, it in (data.get("items") or {}).items():
        loc, path = it.get("url_location"), it.get("url_path")
        if not loc or not path:
            continue
        info = locs.get(loc) or {}
        host = (info.get("hosts") or [loc])[0]
        res[chk] = f"{info.get('scheme') or 'https'}://{host}{path}"
    return res


class PhotoAlbum:
    """Hält die Fotos des geteilten Albums lokal vor."""

    def __init__(self, hass: HomeAssistant, layout: Callable[[], dict]) -> None:
        self.hass = hass
        self._layout = layout
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.dir = Path(hass.config.path(DOMAIN, "fotos"))
        self.token: str | None = None
        self.photos: list[dict[str, Any]] = []
        self.updated: float = 0
        self.error: str = ""
        self._unsubs: list[Callable[[], None]] = []
        self._task: asyncio.Task | None = None

    def link_token(self) -> str | None:
        return album_token((self._layout().get("wallpanel") or {}).get("photos") or "")

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.token = data.get("token")
        self.photos = [p for p in data.get("photos") or [] if isinstance(p, dict) and p.get("file")]
        self.updated = float(data.get("updated") or 0)
        self.error = str(data.get("error") or "")

    @callback
    def async_start(self, store) -> None:
        self._unsubs.append(async_track_time_interval(self.hass, lambda _now: self.async_refresh(), REFRESH))
        self._unsubs.append(store.async_add_listener(self._on_layout))
        # Nach dem Start nicht sofort ins Netz, sondern kurz warten; nur wenn der Stand alt ist oder der Link neu
        stale = time.time() - self.updated > REFRESH.total_seconds()
        if self.link_token() != self.token or (self.token and stale):
            self._unsubs.append(async_call_later(self.hass, 30, lambda _now: self.async_refresh()))

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()
        if self._task and not self._task.done():
            self._task.cancel()

    @callback
    def _on_layout(self, _data: dict) -> None:
        if self.link_token() != self.token:
            self.async_refresh()

    @callback
    def async_refresh(self) -> asyncio.Task:
        """Album neu lesen (läuft höchstens einmal gleichzeitig)."""
        if not self._task or self._task.done():
            self._task = self.hass.async_create_background_task(self._refresh(), f"{DOMAIN} fotos")
        return self._task

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"token": self.token, "photos": self.photos,
                                              "updated": self.updated, "error": self.error}, 1)

    async def _refresh(self) -> None:
        token = self.link_token()
        if not token:
            if self.token or self.photos:
                self.token, self.photos, self.error = None, [], ""
                await self.hass.async_add_executor_job(self._clean, set())
                self._save()
            return
        try:
            await self._sync(token)
            self.error = ""
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError, KeyError) as err:
            self.error = f"Album nicht lesbar: {err}"[:200]
            _LOGGER.warning("Fotos: %s", self.error)
        self.updated = time.time()
        self._save()

    async def _post(self, session: aiohttp.ClientSession, host: str, token: str, path: str, body: dict) -> tuple[str, dict]:
        """POST an den Album-Server; folgt einmal der Umleitung auf die richtige Partition (Status 330)."""
        for _ in range(2):
            async with session.post(f"https://{host}/{token}/sharedstreams/{path}", json=body, timeout=TIMEOUT) as r:
                data = await r.json(content_type=None)
                if r.status == 330 and isinstance(data, dict) and data.get("X-Apple-MMe-Host"):
                    host = str(data["X-Apple-MMe-Host"])
                    continue
                if r.status == 404:
                    raise ValueError("Album nicht gefunden – ist „Öffentliche Website“ eingeschaltet?")
                r.raise_for_status()
                return host, data if isinstance(data, dict) else {}
        raise ValueError("zu viele Umleitungen")

    async def _sync(self, token: str) -> None:
        session = async_get_clientsession(self.hass)
        host, stream = await self._post(session, album_host(token), token, "webstream", {"streamCtag": None})
        wanted = parse_stream(stream)
        have = {p["id"]: p for p in self.photos} if token == self.token else {}
        new = [p for p in wanted if p["id"] not in have or have[p["id"]].get("checksum") != p["checksum"]]
        urls: dict[str, str] = {}
        for i in range(0, len(new), URL_BATCH):
            _host, data = await self._post(session, host, token, "webasseturls",
                                           {"photoGuids": [p["id"] for p in new[i:i + URL_BATCH]]})
            urls.update(asset_urls(data))
        await self.hass.async_add_executor_job(self.dir.mkdir, 0o755, True, True)
        got: dict[str, dict] = {}
        for p in new:
            url = urls.get(p["checksum"])
            if not url:
                continue
            try:
                async with session.get(url, timeout=TIMEOUT) as r:
                    r.raise_for_status()
                    body = await r.content.read(MAX_BYTES + 1)
            except (aiohttp.ClientError, asyncio.TimeoutError) as err:
                _LOGGER.debug("Fotos: %s nicht geladen: %s", p["id"], err)
                continue
            if len(body) > MAX_BYTES:
                continue
            name = f"{p['id']}.jpg"
            await self.hass.async_add_executor_job((self.dir / name).write_bytes, body)
            got[p["id"]] = {**p, "file": name}
        self.token = token
        self.photos = [got.get(p["id"]) or {**have[p["id"]], "caption": p["caption"]}
                       for p in wanted if p["id"] in got or p["id"] in have]
        await self.hass.async_add_executor_job(self._clean, {p["file"] for p in self.photos})
        _LOGGER.debug("Fotos: %d im Album, %d neu geladen", len(self.photos), len(got))

    def _clean(self, keep: set[str]) -> None:
        if not self.dir.is_dir():
            return
        for f in self.dir.iterdir():
            if f.is_file() and f.name not in keep:
                try:
                    f.unlink()
                except OSError as err:
                    _LOGGER.debug("Fotos: %s nicht löschbar: %s", f.name, err)

    def status(self) -> dict:
        return {"count": len(self.photos), "updated": self.updated, "error": self.error,
                "busy": bool(self._task and not self._task.done())}

    def image_path(self, name: str) -> Path | None:
        if not NAME_RE.match(name):
            return None
        p = self.dir / name
        return p if p.is_file() else None


class FotoView(HomeAssistantView):
    """Foto aus dem Album ausliefern (nur angemeldet bzw. mit signierter Adresse)."""

    url = IMG_URL + "/{name}"
    name = f"api:{DOMAIN}:foto"
    requires_auth = True

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        album: PhotoAlbum | None = hass.data.get(DOMAIN, {}).get("fotos")
        path = await hass.async_add_executor_job(album.image_path, name) if album else None
        if path is None:
            return web.Response(status=HTTPStatus.NOT_FOUND)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=604800"})
