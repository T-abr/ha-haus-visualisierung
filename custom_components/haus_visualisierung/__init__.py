"""Haus Visualisierung – eigenes Panel, das sich aus Etagen, Bereichen und Geräten aufbaut."""

from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .alerts import AlertMonitor
from .const import (
    CARDS_URL,
    CONF_ICON,
    CONF_NAME,
    CONF_REQUIRE_ADMIN,
    CONF_THEME,
    DEFAULT_ICON,
    DEFAULT_NAME,
    DEFAULT_REQUIRE_ADMIN,
    DEFAULT_THEME,
    DOMAIN,
    FRONTEND_URL,
    MODULE_URL,
    PANEL_COMPONENT,
    PANEL_URL_PATH,
    VERSION,
)
from .display import SERVICE_TAP, DisplayHub
from .display_setup import FIRMWARE_DIR, FIRMWARE_URL, firmware_md5, firmware_version
from .backup import BackupBook
from .klingel import KlingelBildView, RingBook
from .maintenance import MaintenanceBook
from .store import LayoutStore
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
TAP_SCHEMA = vol.Schema({vol.Required("display"): vol.All(str, vol.Length(max=40)), vol.Required("ziel"): vol.All(str, vol.Length(max=200))})
PLATFORMS = ["scene", "select", "sensor", "update"]


def _drop_stale_gz(frontend_dir: Path) -> None:
    """Vorgepackte .js.gz (aus dem Release-ZIP) entfernen, wenn die .js daneben neuer ist.

    aiohttp liefert die .gz bevorzugt aus; nach einer Installation ohne ZIP (z. B. Dateien von Hand kopiert)
    bekäme der Browser sonst den alten Stand.
    """
    for gz in frontend_dir.rglob("*.js.gz"):
        js = gz.with_suffix("")
        try:
            if not js.is_file() or js.stat().st_mtime > gz.stat().st_mtime:
                gz.unlink()
        except OSError:
            pass


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Statische Dateien, Karten und Websocket-Befehle einmalig registrieren."""
    data = hass.data.setdefault(DOMAIN, {})

    store = LayoutStore(hass)
    await store.async_load()
    data["store"] = store
    data["options"] = {}
    # Wartungsplaner: wann welche Aufgabe erledigt wurde; gelöschte Aufgaben fallen beim Speichern heraus
    book = MaintenanceBook(hass)
    await book.async_load()
    data["maintenance"] = book
    store.async_add_listener(lambda layout: book.prune({t["id"] for t in layout["maintenance"]["tasks"]}))
    # Sicherungen der Einstellungen (vor Updates, täglich vor dem Speichern, von Hand)
    backups = BackupBook(hass, store, book)
    await backups.async_load()
    data["backups"] = backups

    frontend_dir = Path(__file__).parent / "frontend"
    await hass.async_add_executor_job(_drop_stale_gz, frontend_dir)
    # Die Adresse enthält die Version (FRONTEND_URL), also darf der Browser die Dateien lange zwischenspeichern:
    # Nach einem Update ändert sich die Adresse, alte Stände werden nie ausgeliefert.
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(frontend_dir), True)]
    )
    # Auf jeder Seite nur der kleine Lader der Karten (haus-raum-card, haus-hausschnitt-card); deren Code und
    # das Panel (module_url) lädt der Browser erst, wenn er sie braucht.
    frontend.add_extra_js_url(hass, CARDS_URL)

    # Wanddisplays: mitgelieferte Firmware zum Flashen aus dem Browser (ESP Web Tools lädt Manifest und Bin von hier)
    data["firmware"] = await hass.async_add_executor_job(firmware_version)
    data["firmware_md5"] = await hass.async_add_executor_job(firmware_md5) if data["firmware"] else None
    if data["firmware"]:
        await hass.http.async_register_static_paths([StaticPathConfig(FIRMWARE_URL, str(FIRMWARE_DIR), True)])

    # Klingel-Standbilder für die Zeitleiste (nur angemeldet bzw. per signierter Adresse)
    hass.http.register_view(KlingelBildView())

    async_register_websocket(hass)
    _LOGGER.info("Haus Visualisierung v%s geladen", VERSION)
    return True


def _options(entry: ConfigEntry) -> dict:
    merged = {**entry.data, **entry.options}
    return {
        CONF_NAME: merged.get(CONF_NAME, DEFAULT_NAME),
        CONF_ICON: merged.get(CONF_ICON, DEFAULT_ICON),
        CONF_THEME: merged.get(CONF_THEME, DEFAULT_THEME) or "",
        CONF_REQUIRE_ADMIN: merged.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN),
    }


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Panel in der Seitenleiste anlegen."""
    opts = _options(entry)
    hass.data[DOMAIN]["options"] = opts

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title=opts[CONF_NAME],
        sidebar_icon=opts[CONF_ICON],
        module_url=MODULE_URL,
        embed_iframe=False,
        require_admin=opts[CONF_REQUIRE_ADMIN],
        config={"theme": opts[CONF_THEME], "version": VERSION},
    )
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    # Warnungen im Hintergrund auswerten und per Push melden
    monitor = AlertMonitor(hass, hass.data[DOMAIN]["store"])
    await monitor.async_start()
    hass.data[DOMAIN]["monitor"] = monitor
    entry.async_on_unload(monitor.async_stop)
    # Wanddisplays (ESPHome): Inhalte je Display als sensor.haus_display_<id> und per Push ans Gerät, Tippen über den Dienst
    hub = DisplayHub(hass, monitor)
    await hub.async_start()
    hass.data[DOMAIN]["displays"] = hub
    entry.async_on_unload(hub.async_stop)
    hass.services.async_register(DOMAIN, SERVICE_TAP, hub.async_tap, schema=TAP_SCHEMA)
    entry.async_on_unload(lambda: hass.services.async_remove(DOMAIN, SERVICE_TAP))
    # Zeitleiste: jedes Klingeln mit Standbild merken
    rings = RingBook(hass, lambda: hass.data[DOMAIN]["store"].data)
    await rings.async_load()
    rings.async_start()
    hass.data[DOMAIN]["rings"] = rings
    entry.async_on_unload(rings.async_stop)
    # Hausmodus (select.hausmodus) und Anzahl aktiver Meldungen (sensor.haus_alarme_aktiv)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Panel entfernen."""
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    hass.data[DOMAIN].pop("monitor", None)
    hass.data[DOMAIN].pop("displays", None)
    hass.data[DOMAIN].pop("rings", None)
    return ok
