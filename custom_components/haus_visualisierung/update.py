"""Firmware-Update je Wanddisplay (ESPHome-Gerät mit Haus-Display-Firmware) als Update-Entität.

Neueste Version = die Firmware, die der Integration beiliegt (``firmware/``); installiert wird über das Netz:
Die Integration ruft die API-Aktion ``haus_update`` des Geräts (ab Firmware 0.3.0) mit Adresse und MD5 der OTA-Datei
auf, das Gerät lädt sie von Home Assistant und startet neu (``display_setup.async_install``).
"""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN
from .display_setup import async_install, list_devices, vtuple

FIRMWARE_REPO = "https://github.com/T-abr/ha-haus-display"
BUSY_MAX = 10 * 60  # so lange gilt ein Update als laufend, wenn sich die Version nicht ändert


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    known: dict[str, HausDisplayFirmware] = {}

    @callback
    def _sync(_now: Any = None) -> None:
        devs = {d["name"]: d for d in list_devices(hass) if d["entry_id"]}
        new = [HausDisplayFirmware(hass, d["name"], d["entry_id"]) for n, d in devs.items() if n not in known]
        for ent in new:
            known[ent.device] = ent
        if new:
            async_add_entities(new)
        reg = er.async_get(hass)
        for name in [k for k in known if k not in devs]:
            ent = known.pop(name)
            if ent.entity_id and reg.async_get(ent.entity_id):
                reg.async_remove(ent.entity_id)
        for name, ent in known.items():
            ent.refresh(devs[name])

    _sync()
    entry.async_on_unload(async_track_time_interval(hass, _sync, timedelta(seconds=30)))


class HausDisplayFirmware(UpdateEntity):
    """Firmware eines Wanddisplays; „Installieren“ schickt die mitgelieferte Version übers Netz."""

    _attr_has_entity_name = True
    _attr_name = "Firmware Haus Display"
    _attr_should_poll = False
    _attr_supported_features = UpdateEntityFeature.INSTALL | UpdateEntityFeature.PROGRESS  # läuft, bis die neue Version da ist
    _attr_title = "Haus Display"
    _attr_release_url = FIRMWARE_REPO

    def __init__(self, hass: HomeAssistant, device: str, esphome_entry_id: str) -> None:
        self.device = device
        self._attr_unique_id = f"haus_display_firmware_{device}"
        self._installed: str | None = None
        self._busy: float = 0.0
        self._busy_from: str | None = None
        # an das vorhandene ESPHome-Gerät hängen (gleiche Kennungen), kein eigenes Gerät
        for dev in dr.async_entries_for_config_entry(dr.async_get(hass), esphome_entry_id):
            self._attr_device_info = DeviceInfo(identifiers=dev.identifiers, connections=dev.connections)
            break
        else:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, f"display_{device}")}, name=device)

    @callback
    def refresh(self, info: dict) -> None:
        installed = info.get("version") or None
        if self._busy and (installed != self._busy_from or time.time() - self._busy > BUSY_MAX):
            self._busy = 0.0
        self._installed = installed
        if self.hass and self.entity_id:
            self.async_write_ha_state()

    @property
    def installed_version(self) -> str | None:
        return self._installed

    @property
    def latest_version(self) -> str | None:
        fw = self.hass.data[DOMAIN].get("firmware") if self.hass else None
        # nie eine ältere Version als „neueste“ anbieten
        if fw and self._installed and vtuple(self._installed) > vtuple(fw):
            return self._installed
        return fw or self._installed

    @property
    def in_progress(self) -> bool:
        return bool(self._busy)

    @property
    def release_summary(self) -> str | None:
        if self._installed and vtuple(self._installed) < (0, 3, 0) and self.latest_version != self._installed:
            return "Diese Firmware kann noch kein Update über das Netz: einmal per USB unter Einstellungen → Displays installieren."
        return None

    async def async_added_to_hass(self) -> None:
        for d in list_devices(self.hass):
            if d["name"] == self.device:
                self._installed = d.get("version") or None

    async def async_install(self, version: str | None, backup: bool, **kwargs: Any) -> None:
        await async_install(self.hass, self.device)
        self._busy, self._busy_from = time.time(), self._installed
        self.async_write_ha_state()

