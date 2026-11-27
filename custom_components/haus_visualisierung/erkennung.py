"""Erkennung ohne Namen im Backend: Rollen-Labels von Home Assistant (wie frontend/modules/erkennung.js).

Ein Label wirkt an der Entität oder an ihrem Gerät. Die Label-ID entsteht in Home Assistant aus dem Namen,
z. B. „Haus Regensensor“ → ``haus_regensensor``.
"""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er


# Integrationen, deren Kalender Abfuhrtermine sind (wie WASTE_PLATFORMS in erkennung.js)
WASTE_PLATFORMS = {"waste_collection_schedule", "abfallplus", "awido", "awb_koeln", "abfall_io", "ics_calendar_waste"}


def platform_of(hass: HomeAssistant, entity_id: str) -> str:
    """Integration (Plattform) einer Entität laut Registrierung, sonst leer."""
    entry = er.async_get(hass).async_get(entity_id)
    return entry.platform if entry else ""


def labelled(hass: HomeAssistant, label_id: str, domains: tuple[str, ...] | None = None) -> list[str]:
    """Vorhandene Entitäten mit diesem Label (an der Entität oder am Gerät), sortiert."""
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    out = {e.entity_id for e in er.async_entries_for_label(ent_reg, label_id)}
    for dev in dr.async_entries_for_label(dev_reg, label_id):
        out |= {e.entity_id for e in er.async_entries_for_device(ent_reg, dev.id)}
    return sorted(e for e in out if hass.states.get(e) and (not domains or e.split(".", 1)[0] in domains))
