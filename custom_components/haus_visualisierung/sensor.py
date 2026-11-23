"""Anzahl aktiver Meldungen (sensor.haus_alarme_aktiv) – z. B. für eine KNX-Statusanzeige –
und Haushaltsgeräte (sensor.haus_geraete): Anzahl fertiger Geräte, Einzelheiten im Attribut „geraete“."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HausAlarmeSensor(entry), HausGeraeteSensor(entry)])


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


class HausGeraeteSensor(SensorEntity):
    """Fertige Haushaltsgeräte; das Panel liest Zustand, Energie und Kosten aus dem Attribut „geraete“."""

    _attr_has_entity_name = False
    _attr_name = "Haus Geräte fertig"
    _attr_should_poll = False
    _attr_native_unit_of_measurement = None
    # Die Liste ändert sich bei laufenden Geräten alle 30 s: nicht in den Recorder
    _unrecorded_attributes = frozenset({"geraete"})

    def __init__(self, entry: ConfigEntry) -> None:
        self._attr_unique_id = f"{entry.entry_id}_geraete"
        self.entity_id = "sensor.haus_geraete"

    def _rows(self) -> list[dict]:
        m = self.hass.data[DOMAIN].get("monitor")
        return m.appliances.snapshot() if m else []

    @property
    def native_value(self) -> int:
        return sum(1 for r in self._rows() if r["state"] == "fertig")

    @property
    def icon(self) -> str:
        rows = self._rows()
        if any(r["state"] == "fertig" for r in rows):
            return "mdi:check-circle-outline"
        return "mdi:washing-machine" if any(r["state"] == "laeuft" for r in rows) else "mdi:washing-machine-off"

    @property
    def extra_state_attributes(self) -> dict:
        rows = self._rows()
        return {
            "laufen": sum(1 for r in rows if r["state"] == "laeuft"),
            "fertig_geraete": [r["name"] for r in rows if r["state"] == "fertig"],
            "geraete": rows,
        }

    async def async_added_to_hass(self) -> None:
        m = self.hass.data[DOMAIN].get("monitor")
        if m:
            self.async_on_remove(m.appliances.async_add_listener(self._changed))

    @callback
    def _changed(self) -> None:
        self.async_write_ha_state()
