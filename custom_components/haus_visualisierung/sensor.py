"""Anzahl aktiver Meldungen (sensor.haus_alarme_aktiv) – z. B. für eine KNX-Statusanzeige –
und Haushaltsgeräte (sensor.haus_geraete): Anzahl fertiger Geräte, Einzelheiten im Attribut „geraete“."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .display import PROTOCOL


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HausAlarmeSensor(entry), HausGeraeteSensor(entry)])
    hub = hass.data[DOMAIN].get("displays")
    if hub is None:
        return
    # Wanddisplays: je eingerichtetem Display eine Entität; neue kommen hinzu, gelöschte verschwinden
    known: dict[str, HausDisplaySensor] = {}

    @callback
    def _sync() -> None:
        ids = {d["id"] for d in hub.displays}
        new = [HausDisplaySensor(entry, hub, did) for did in ids if did not in known]
        for ent in new:
            known[ent.display_id] = ent
        if new:
            async_add_entities(new)
        reg = er.async_get(hass)
        for did in [k for k in known if k not in ids]:
            ent = known.pop(did)
            if ent.entity_id and reg.async_get(ent.entity_id):
                reg.async_remove(ent.entity_id)
            elif ent.hass:
                hass.async_create_task(ent.async_remove())

    _sync()
    entry.async_on_unload(hub.async_add_listener(_sync))


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


class HausDisplaySensor(SensorEntity):
    """Inhalte eines Wanddisplays (Protokoll siehe DISPLAY_PROTOKOLL.md): Zustand = Protokollversion,
    Attribute = fertig formatierte JSON-Texte je Bereich."""

    _attr_has_entity_name = False
    _attr_should_poll = False
    _attr_icon = "mdi:tablet-dashboard"
    # Ändert sich laufend und ist nur für das Display gedacht: nicht in den Recorder
    _unrecorded_attributes = frozenset({"einstellungen", "kopf", "kacheln", "hinweis", "energie", "klima", "gute_nacht", "haus"})

    def __init__(self, entry: ConfigEntry, hub, display_id: str) -> None:
        self._hub = hub
        self.display_id = display_id
        self._attr_unique_id = f"{entry.entry_id}_display_{display_id}"
        self.entity_id = f"sensor.haus_display_{display_id}"
        d = next((x for x in hub.displays if x["id"] == display_id), {})
        self._attr_name = f"Haus Display {d.get('name') or display_id}"

    @property
    def native_value(self) -> int:
        return PROTOCOL

    @property
    def available(self) -> bool:
        return self.display_id in self._hub.payloads

    @property
    def extra_state_attributes(self) -> dict:
        return dict(self._hub.payloads.get(self.display_id, {}))

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._hub.async_add_listener(self._changed))

    @callback
    def _changed(self) -> None:
        if self.hass and self.entity_id:
            self.async_write_ha_state()
