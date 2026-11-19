"""Anzahl aktiver Meldungen (sensor.haus_alarme_aktiv) – z. B. für eine KNX-Statusanzeige."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HausAlarmeSensor(entry)])


class HausAlarmeSensor(SensorEntity):
    _attr_has_entity_name = False
    _attr_name = "Haus Alarme aktiv"
    _attr_should_poll = False
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = None

    def __init__(self, entry: ConfigEntry) -> None:
        self._attr_unique_id = f"{entry.entry_id}_alarme_aktiv"
        self.entity_id = "sensor.haus_alarme_aktiv"

    def _alarms(self) -> list[dict]:
        m = self.hass.data[DOMAIN].get("monitor")
        return [a for a in (m.book.alarms.values() if m else []) if a.get("status") != "stumm"]

    @property
    def native_value(self) -> int:
        return len(self._alarms())

    @property
    def icon(self) -> str:
        al = self._alarms()
        if any(a.get("level") == "alarm" for a in al):
            return "mdi:alarm-light"
        return "mdi:bell-alert" if al else "mdi:shield-check"

    @property
    def extra_state_attributes(self) -> dict:
        al = self._alarms()
        m = self.hass.data[DOMAIN].get("monitor")
        return {
            "alarme": sum(1 for a in al if a.get("level") == "alarm"),
            "warnungen": sum(1 for a in al if a.get("level") == "warn"),
            "hinweise": sum(1 for a in al if a.get("level") == "info"),
            "neu": sum(1 for a in al if a.get("status") == "neu"),
            "stumm": sum(1 for a in (m.book.alarms.values() if m else []) if a.get("status") == "stumm"),
            "meldungen": [a.get("title", "") for a in al][:20],
        }

    async def async_added_to_hass(self) -> None:
        m = self.hass.data[DOMAIN].get("monitor")
        if m:
            self.async_on_remove(m.book.async_add_listener(self._changed))

    @callback
    def _changed(self, _snap: dict) -> None:
        self.async_write_ha_state()
