"""Hausmodus als Auswahl-Entität (select.hausmodus) – für Automationen, KNX-Logik und Sprachassistenten."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, HOUSE_MODES

ICONS = {"zuhause": "mdi:home-account", "nacht": "mdi:weather-night", "abwesend": "mdi:home-export-outline", "urlaub": "mdi:airplane"}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HausmodusSelect(hass, entry)])


class HausmodusSelect(SelectEntity):
    _attr_has_entity_name = False
    _attr_name = "Hausmodus"
    _attr_options = HOUSE_MODES
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._attr_unique_id = f"{entry.entry_id}_hausmodus"
        self.entity_id = "select.hausmodus"

    @property
    def _monitor(self):
        return self.hass.data[DOMAIN].get("monitor")

    @property
    def current_option(self) -> str | None:
        m = self._monitor
        return m.house.mode if m else None

    @property
    def icon(self) -> str:
        return ICONS.get(self.current_option or "", "mdi:home")

    @property
    def extra_state_attributes(self) -> dict:
        m = self._monitor
        if not m:
            return {}
        st = m.house.status()
        return {"seit": st["since"], "von": st["by"], "alarmanlage": st["panel"], "gekoppelt": st["sync"]}

    async def async_select_option(self, option: str) -> None:
        m = self._monitor
        if m:
            user = None
            if self._context and self._context.user_id:
                u = await self.hass.auth.async_get_user(self._context.user_id)
                user = u.name if u else None
            m.house.set_mode(option, user or "Automation", "manual")

    async def async_added_to_hass(self) -> None:
        m = self._monitor
        if m:
            self.async_on_remove(m.book.async_add_listener(self._changed))

    @callback
    def _changed(self, _snap: dict) -> None:
        self.async_write_ha_state()
