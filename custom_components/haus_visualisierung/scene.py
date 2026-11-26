"""Szenen-Entitäten (scene.haus_<id>) für die im Panel angelegten Szenen je Raum (Daten und Schalten: scenes.py).

Neue Szenen kommen beim Speichern hinzu, gelöschte verschwinden; Name, Symbol und Raum (Bereich der Entität)
folgen den Einstellungen im Panel. So lassen sie sich wie jede andere Szene nutzen: Raumseite, Schnellzugriff,
Kachel am Wanddisplay, Automationen.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.scene import Scene
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .scenes import async_apply


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    store = hass.data[DOMAIN]["store"]
    known: dict[str, HausSzene] = {}

    @callback
    def _sync(layout: dict) -> None:
        scenes = layout.get("scenes") or {}
        new = []
        for sid, sc in scenes.items():
            ent = known.get(sid)
            if ent is None:
                ent = known[sid] = HausSzene(entry, sid, sc)
                new.append(ent)
            else:
                ent.update_config(sc)
        if new:
            async_add_entities(new)
        reg = er.async_get(hass)
        for sid in [k for k in known if k not in scenes]:
            ent = known.pop(sid)
            if ent.entity_id and reg.async_get(ent.entity_id):
                reg.async_remove(ent.entity_id)
            elif ent.hass:
                hass.async_create_task(ent.async_remove())

    _sync(store.data)
    entry.async_on_unload(store.async_add_listener(_sync))


class HausSzene(Scene):
    _attr_has_entity_name = False
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, sid: str, conf: dict) -> None:
        self.scene_id = sid
        self._conf = conf
        self._attr_unique_id = f"{entry.entry_id}_szene_{sid}"
        self.entity_id = f"scene.haus_{sid}"

    @property
    def name(self) -> str:
        return self._conf["name"]

    @property
    def icon(self) -> str:
        return self._conf.get("icon") or "mdi:palette"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        # Das Panel erkennt eigene Szenen an „haus_szene“ und öffnet zum Bearbeiten diese ID
        return {"haus_szene": self.scene_id, "entity_id": list(self._conf["ents"])}

    @callback
    def update_config(self, conf: dict) -> None:
        if conf == self._conf:
            return
        self._conf = conf
        if self.hass:
            self._sync_area()
            self.async_write_ha_state()

    @callback
    def _sync_area(self) -> None:
        """Bereich der Entität = Raum der Szene (nur bekannte Bereiche)."""
        reg = er.async_get(self.hass)
        ent = self.entity_id and reg.async_get(self.entity_id)
        if not ent:
            return
        area = self._conf.get("area") or None
        if area and ar.async_get(self.hass).async_get_area(area) is None:
            return
        if ent.area_id != area:
            reg.async_update_entity(self.entity_id, area_id=area)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self._sync_area()

    async def async_activate(self, **kwargs: Any) -> None:
        await async_apply(self.hass, self._conf["ents"])
