"""Klingel: Entität und Kamera finden, Klingeln erkennen und Standbilder für die Zeitleiste merken.

Panel (panel-klingel.js), Wanddisplay (display.py) und Zeitleiste (zeitleiste.py) nutzen dieselbe Erkennung.
Bei jedem Klingeln legt RingBook ein Standbild der Klingelkamera unter /config/haus_visualisierung/klingel ab
(Einstellungen → Klingel → „Standbild bei jedem Klingeln merken“). Bilder und Einträge bleiben KEEP_DAYS Tage,
höchstens KEEP_MAX Stück; das Panel holt sie über eine signierte Adresse (KlingelBildView).
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, HomeAssistant, State, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.http import KEY_HASS
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .alerts import UNAV
from .const import DOMAIN
from .erkennung import labelled

_LOGGER = logging.getLogger(__name__)

BELL_RE = re.compile(r"doorbell|klingel", re.I)
BELL_EVENT_RE = re.compile(r"ring|press|doorbell|klingel", re.I)
BELL_CAM_RE = re.compile(r"entry|doorbell|klingel|haust", re.I)

STORAGE_KEY = f"{DOMAIN}_klingel"
KEEP_DAYS = 7          # Standbilder eine Woche aufheben
KEEP_MAX = 300         # Obergrenze, falls es sehr oft klingelt
SNAP_GAP = 15          # Sekunden: mehrfaches Drücken kurz hintereinander = ein Bild
SNAP_WIDTH = 640
IMG_URL = f"/api/{DOMAIN}/klingel"
NAME_RE = re.compile(r"^\d{10}\.jpg$")


def is_ring(old: State | None, new: State | None) -> bool:
    """Klingelt es? Wie im Panel (aktualisierer.js isRing): neues Ereignis bzw. Binärsensor wird „an“.

    Nach einem Neustart steht eine Ereignis-Entität auf „unknown“, bis zum ersten Klingeln – das muss zählen.
    Damit eine wieder erreichbare Entität nicht als Klingeln gilt, zählt ein Ereignis nur, wenn es frisch ist.
    """
    if old is None or new is None or new.state in UNAV:
        return False
    if new.domain == "event":
        if new.state == old.state:
            return False
        when = dt_util.parse_datetime(new.state)
        if when is not None and abs((dt_util.utcnow() - when).total_seconds()) > 60:
            return False
        et = new.attributes.get("event_type")
        return not et or bool(BELL_EVENT_RE.search(str(et)))
    return new.state == "on" and old.state not in ("on", "unavailable")


def find_bell(hass: HomeAssistant, cfg: dict) -> str | None:
    """Klingel-Entität: aus den Einstellungen, sonst Label „Haus Klingel“, Ereignis mit device_class doorbell (jede Integration) bzw. passender Name."""
    if cfg.get("entity"):
        return cfg["entity"] if hass.states.get(cfg["entity"]) else None
    if lab := labelled(hass, "haus_klingel", ("event", "binary_sensor")):
        return lab[0]
    states = hass.states.async_all(("event", "binary_sensor"))
    pick = next((st for st in states if st.domain == "event" and st.attributes.get("device_class") == "doorbell"), None) \
        or next((st for st in states if BELL_RE.search(st.entity_id)), None)
    return pick.entity_id if pick else None


def find_bell_camera(hass: HomeAssistant, cfg: dict, bell: str | None) -> str | None:
    """Kamera der Klingel: aus den Einstellungen, sonst am selben Gerät, sonst nach Namen."""
    if cfg.get("camera") and hass.states.get(cfg["camera"]):
        return cfg["camera"]
    cams = hass.states.async_entity_ids("camera")
    pref = lambda lst: next((e for e in lst if not re.search(r"paket|package", e, re.I)), lst[0] if lst else None)  # noqa: E731
    reg = er.async_get(hass)
    dev = (ent := reg.async_get(bell)) and ent.device_id if bell else None
    if dev:
        same = [e for e in cams if (c := reg.async_get(e)) and c.device_id == dev]
        if same:
            return pref(same)
    return pref([e for e in cams if BELL_CAM_RE.search(e)]) or (cams[0] if cams else None)


class RingBook:
    """Merkt sich jedes Klingeln (Zeit, Kamera, Standbild) für die Zeitleiste."""

    def __init__(self, hass: HomeAssistant, layout: Callable[[], dict]) -> None:
        self.hass = hass
        self._layout = layout
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.rings: list[dict[str, Any]] = []
        self.dir = Path(hass.config.path(DOMAIN, "klingel"))
        self._unsub: Callable[[], None] | None = None
        self._bell: tuple[Any, float, str | None] = (None, 0.0, None)   # (Einstellungen, Zeit, Entität)

    @property
    def cfg(self) -> dict:
        return self._layout().get("doorbell") or {}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.rings = [r for r in data.get("rings") or [] if isinstance(r, dict) and isinstance(r.get("ts"), (int, float))]
        await self.async_prune()

    @callback
    def async_start(self) -> None:
        self._unsub = self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state)

    @callback
    def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    def bell(self) -> str | None:
        """Klingel-Entität; gesucht wird nur nach geänderten Einstellungen bzw. alle fünf Minuten neu."""
        cfg, now = self.cfg, time.monotonic()
        key = cfg.get("entity")
        if self._bell[0] != key or now - self._bell[1] > 300:
            self._bell = (key, now, find_bell(self.hass, cfg))
        return self._bell[2]

    @callback
    def _on_state(self, event: Event) -> None:
        eid = event.data.get("entity_id", "")
        if not eid.startswith(("event.", "binary_sensor.")) or eid != self.bell():
            return
        if is_ring(event.data.get("old_state"), event.data.get("new_state")):
            self.hass.async_create_task(self.async_ring(eid))

    async def async_ring(self, eid: str | None = None) -> dict:
        """Klingeln eintragen und (falls eingeschaltet) ein Standbild der Kamera ablegen."""
        cfg = self.cfg
        now = time.time()
        cam = find_bell_camera(self.hass, cfg, eid or self.bell())
        entry: dict[str, Any] = {"ts": round(now, 1)}
        if cam:
            entry["cam"] = cam
        last = next((r for r in reversed(self.rings) if r.get("bild")), None)
        if cam and cfg.get("snapshots", True) is not False:
            if last and now - last["ts"] < SNAP_GAP:
                entry["bild"] = last["bild"]       # gleiches Bild wie eben
            else:
                name = await self._async_snapshot(cam, now)
                if name:
                    entry["bild"] = name
        self.rings.append(entry)
        await self.async_prune(save=False)
        self._store.async_delay_save(lambda: {"rings": self.rings}, 2)
        return entry

    async def async_image(self, cam: str) -> bytes:
        """Aktuelles Kamerabild als JPEG (in Tests ersetzbar)."""
        from homeassistant.components.camera import async_get_image
        return (await async_get_image(self.hass, cam, timeout=10, width=SNAP_WIDTH)).content

    async def _async_snapshot(self, cam: str, now: float) -> str | None:
        try:
            img = await self.async_image(cam)
        except Exception as err:  # noqa: BLE001 – Kamera aus, nicht erreichbar, nicht eingerichtet
            _LOGGER.info("Klingel: kein Standbild von %s (%s)", cam, err)
            return None
        name = f"{int(now)}.jpg"

        def _write() -> None:
            self.dir.mkdir(parents=True, exist_ok=True)
            (self.dir / name).write_bytes(img)

        try:
            await self.hass.async_add_executor_job(_write)
        except OSError as err:
            _LOGGER.warning("Klingel: Standbild nicht speicherbar: %s", err)
            return None
        return name

    async def async_prune(self, save: bool = True) -> None:
        """Alte Einträge und Bilder löschen (älter als KEEP_DAYS, mehr als KEEP_MAX, verwaiste Dateien)."""
        limit = time.time() - KEEP_DAYS * 86400
        before = len(self.rings)
        self.rings = [r for r in self.rings if r["ts"] >= limit][-KEEP_MAX:]
        keep = {r["bild"] for r in self.rings if r.get("bild")}

        def _clean() -> None:
            if not self.dir.is_dir():
                return
            for f in self.dir.iterdir():
                if f.is_file() and NAME_RE.match(f.name) and f.name not in keep:
                    f.unlink(missing_ok=True)

        try:
            await self.hass.async_add_executor_job(_clean)
        except OSError as err:
            _LOGGER.warning("Klingel: alte Standbilder nicht löschbar: %s", err)
        if save and len(self.rings) != before:
            self._store.async_delay_save(lambda: {"rings": self.rings}, 2)

    def query(self, since: float) -> list[dict]:
        return [r for r in self.rings if r["ts"] >= since]

    def image_path(self, name: str) -> Path | None:
        if not NAME_RE.match(name):
            return None
        p = self.dir / name
        return p if p.is_file() else None


class KlingelBildView(HomeAssistantView):
    """Standbild der Klingel ausliefern (nur angemeldet bzw. mit signierter Adresse aus der Zeitleiste)."""

    url = IMG_URL + "/{name}"
    name = f"api:{DOMAIN}:klingel"
    requires_auth = True

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        book: RingBook | None = hass.data.get(DOMAIN, {}).get("rings")
        path = await hass.async_add_executor_job(book.image_path, name) if book else None
        if path is None:
            return web.Response(status=HTTPStatus.NOT_FOUND)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=86400"})
