"""Seite „Automationen“: alle Automationen von Home Assistant auflisten und ein- bzw. ausschalten (nur Administratoren).

Die Liste kommt aus den Zuständen (`automation.*`), ergänzt um Bereich (Entitäts- bzw. Geräteregister) und
Beschreibung (aus der Konfiguration der Automation, soweit Home Assistant sie bereitstellt). Neue Automationen
legt der Editor von Home Assistant an; das Panel springt nur dorthin.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN

AUTOMATION = "automation"


def _description(hass: HomeAssistant, entity_id: str) -> str:
    """Beschreibung aus der Konfiguration; fehlt sie oder ändert Home Assistant das Innenleben, bleibt sie leer."""
    try:
        comp = hass.data.get(AUTOMATION)
        ent = comp.get_entity(entity_id) if comp is not None else None
        raw = getattr(ent, "raw_config", None) or {}
        desc = raw.get("description") if isinstance(raw, dict) else None
        return str(desc).strip()[:300] if desc else ""
    except Exception:  # noqa: BLE001 – nur Zusatzinfo
        return ""


def list_automations(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Alle Automationen, sortiert nach Name."""
    ent_reg, dev_reg, area_reg = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
    out = []
    for st in hass.states.async_all(AUTOMATION):
        entry = ent_reg.async_get(st.entity_id)
        area_id = entry.area_id if entry else None
        if entry and not area_id and entry.device_id and (dev := dev_reg.async_get(entry.device_id)):
            area_id = dev.area_id
        area = area_reg.async_get_area(area_id) if area_id else None
        attrs = st.attributes
        out.append({
            "entity_id": st.entity_id,
            "name": attrs.get("friendly_name") or st.object_id,
            "state": st.state,
            "id": attrs.get("id"),  # fehlt bei Automationen aus YAML ohne id: dann nicht im Editor bearbeitbar
            "last_triggered": attrs.get("last_triggered"),
            "mode": attrs.get("mode"),
            "area": area.name if area else "",
            "description": _description(hass, st.entity_id),
        })
    return sorted(out, key=lambda a: str(a["name"]).casefold())


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_automations)
    websocket_api.async_register_command(hass, ws_automation_set)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/automations"})
@callback
def ws_automations(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Liste für die Seite „Automationen“."""
    connection.send_result(msg["id"], {"automations": list_automations(hass)})


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/automation_set",
    vol.Required("entity_id"): vol.All(str, vol.Match(r"^automation\.[a-z0-9_]+$")),
    vol.Required("enabled"): bool,
})
@websocket_api.async_response
async def ws_automation_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Automation aktivieren bzw. deaktivieren (wie der Schalter in Home Assistant)."""
    eid = msg["entity_id"]
    if hass.states.get(eid) is None:
        connection.send_error(msg["id"], "not_found", "Automation nicht gefunden")
        return
    await hass.services.async_call(
        AUTOMATION, "turn_on" if msg["enabled"] else "turn_off", {"entity_id": eid},
        blocking=True, context=connection.context(msg),
    )
    st = hass.states.get(eid)
    connection.send_result(msg["id"], {"entity_id": eid, "state": st.state if st else None})
