"""Haus Visualisierung – eigenes Panel, das sich aus Etagen, Bereichen und Geräten aufbaut."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .alerts import AlertMonitor
from .const import (
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
from .store import LayoutStore
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = ["select", "sensor"]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Statische Dateien, Karten und Websocket-Befehle einmalig registrieren."""
    data = hass.data.setdefault(DOMAIN, {})

    store = LayoutStore(hass)
    await store.async_load()
    data["store"] = store
    data["options"] = {}

    frontend_dir = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(frontend_dir), False)]
    )
    # Die Karten (haus-raum-card, haus-hausschnitt-card) lädt derselbe Einstiegspunkt.
    frontend.add_extra_js_url(hass, MODULE_URL)

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
    return ok
