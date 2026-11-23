"""Wanddisplays einrichten: mitgelieferte Firmware, Geräte finden, übernehmen (Assistent im Reiter „Displays“).

Ablauf im Panel: Firmware aus dem Browser flashen (ESP Web Tools, Dateien aus ``firmware/`` dieser Integration),
WLAN per Improv, dann findet Home Assistant das Gerät per mDNS (ESPHome-Erkennung). „Übernehmen“ bestätigt die
Erkennung, erlaubt dem Gerät Aktionen (nötig für ``display_tap``) und das Panel ordnet es einem Display zu.
Die Firmware kommt aus dem Repository ha-haus-display (CI, Zweig ``firmware``).
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.network import NoURLAvailableError, get_url

from .const import DOMAIN, STATIC_URL, VERSION
from .display import SERVICE_DATA, device_service

_LOGGER = logging.getLogger(__name__)

FIRMWARE_DIR = Path(__file__).parent / "firmware"
FIRMWARE_URL = f"{STATIC_URL}/firmware/{VERSION}"
ESPHOME = "esphome"
ALLOW = "allow_service_calls"  # Option der ESPHome-Integration: Gerät darf Aktionen ausführen
PREFIX = "haus-display"


def firmware_version() -> str | None:
    """Version der mitgelieferten Firmware (None, wenn keine dabei ist). Blockierend: im Executor aufrufen."""
    f = FIRMWARE_DIR / "version.txt"
    try:
        if (FIRMWARE_DIR / "manifest.json").is_file() and (FIRMWARE_DIR / "haus-display.factory.bin").is_file():
            return f.read_text(encoding="utf-8").strip() or "?"
    except OSError:
        pass
    return None


def firmware_md5() -> str | None:
    """MD5 der OTA-Datei (das Gerät prüft damit den Download). Blockierend: im Executor aufrufen."""
    try:
        return hashlib.md5((FIRMWARE_DIR / "haus-display.ota.bin").read_bytes()).hexdigest()  # noqa: S324 – Prüfsumme, keine Sicherheit
    except OSError:
        return None


def vtuple(v: str) -> tuple[int, ...]:
    """'0.3.0' → (0, 3, 0); Unlesbares → ()"""
    m = re.match(r"\s*(\d+)\.(\d+)\.(\d+)", v or "")
    return tuple(int(x) for x in m.groups()) if m else ()


UPDATE_ACTION = "haus_update"  # API-Aktion der Firmware ab 0.3.0
OTA_MIN = (0, 3, 0)


def update_service(device: str) -> str:
    return f"{device.replace('-', '_')}_{UPDATE_ACTION}"


async def async_install(hass: HomeAssistant, device: str) -> str:
    """Mitgelieferte Firmware über das Netz auf das Gerät bringen. Liefert die Version, wirft HomeAssistantError."""
    fw, md5 = hass.data[DOMAIN].get("firmware"), hass.data[DOMAIN].get("firmware_md5")
    if not fw or not md5:
        raise HomeAssistantError("In dieser Version der Integration ist keine Firmware enthalten")
    if not hass.services.has_service(ESPHOME, update_service(device)):
        raise HomeAssistantError(f"{device} kann noch kein Update über das Netz (Firmware vor {'.'.join(map(str, OTA_MIN))} "
                                 "oder offline) – einmal per USB unter Einstellungen → Displays installieren")
    try:
        base = get_url(hass, allow_external=False, allow_cloud=False, prefer_external=False)
    except NoURLAvailableError as err:
        raise HomeAssistantError("Keine interne Adresse von Home Assistant bekannt (Einstellungen → System → Netzwerk)") from err
    await hass.services.async_call(ESPHOME, update_service(device),
                                   {"adresse": f"{base}{FIRMWARE_URL}/haus-display.ota.bin", "pruefsumme": md5}, blocking=True)
    _LOGGER.info("Firmware %s an %s geschickt", fw, device)
    return fw


def _norm(name: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")


def _version(hass: HomeAssistant, entry: ConfigEntry) -> str:
    for dev in dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id):
        m = re.match(r"\s*(\d+\.\d+\.\d+)", dev.sw_version or "")
        if m:
            return m.group(1)
    return ""


@callback
def list_devices(hass: HomeAssistant) -> list[dict]:
    """Haus-Displays in ESPHome (übernommen) und im Netz gefunden (Erkennung wartet auf Bestätigung)."""
    hub = hass.data[DOMAIN].get("displays")
    displays = hub.displays if hub else hass.data[DOMAIN]["store"].data.get("displays", [])
    assigned = {d.get("device"): d["id"] for d in displays if d.get("device")}
    hello = hub.hello if hub else {}
    out, seen = [], set()
    for entry in hass.config_entries.async_entries(ESPHOME):
        name = entry.data.get("device_name") or _norm(entry.title)
        has_service = bool(name) and hass.services.has_service(ESPHOME, device_service(name))
        if not name or not (name.startswith(PREFIX) or has_service):
            continue
        seen.add(name)
        rd = getattr(entry, "runtime_data", None) if entry.state is ConfigEntryState.LOADED else None
        online = bool(getattr(rd, "available", has_service)) if entry.state is ConfigEntryState.LOADED else False
        ver = _version(hass, entry)
        fw = hass.data[DOMAIN].get("firmware")
        out.append({
            "name": name, "title": entry.title, "entry_id": entry.entry_id, "flow_id": None,
            "host": entry.data.get("host", ""), "online": online, "allowed": bool(entry.options.get(ALLOW)),
            "ready": has_service, "version": ver, "display": assigned.get(name), "hello": name in hello,
            "disabled": entry.disabled_by is not None,
            # Update: neuere Firmware dabei; über das Netz nur ab 0.3.0 (sonst einmal per USB)
            "update": bool(fw and ver and vtuple(fw) > vtuple(ver)),
            "ota": hass.services.has_service(ESPHOME, update_service(name)),
        })
    for flow in hass.config_entries.flow.async_progress_by_handler(ESPHOME):
        ctx = flow.get("context") or {}
        name = _norm((ctx.get("title_placeholders") or {}).get("name"))
        if not name.startswith(PREFIX) or name in seen or ctx.get("source") == "user":
            continue
        seen.add(name)
        out.append({"name": name, "title": (ctx.get("title_placeholders") or {}).get("name", name), "entry_id": None,
                    "flow_id": flow["flow_id"], "host": "", "online": True, "allowed": False, "ready": False, "version": "",
                    "display": assigned.get(name), "hello": False, "disabled": False,
                    "update": False, "ota": False})
    out.sort(key=lambda d: (d["display"] is None, d["name"]))
    return out


async def _allow(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Dem Gerät Aktionen erlauben (sonst kommen Tipps und „hallo“ nicht an); ESPHome lädt das Gerät dann neu."""
    if not entry.options.get(ALLOW):
        hass.config_entries.async_update_entry(entry, options={**entry.options, ALLOW: True})


async def adopt(hass: HomeAssistant, flow_id: str | None = None, entry_id: str | None = None, host: str | None = None) -> dict:
    """Gerät übernehmen: Erkennung bestätigen bzw. per IP hinzufügen, dann Aktionen erlauben."""
    entry: ConfigEntry | None = None
    if entry_id:
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != ESPHOME:
            return {"ok": False, "error": "Gerät nicht gefunden"}
    else:
        try:
            if flow_id:
                res = await hass.config_entries.flow.async_configure(flow_id, {})
            elif host:
                res = await hass.config_entries.flow.async_init(ESPHOME, context={"source": "user"}, data={"host": host, "port": 6053})
            else:
                return {"ok": False, "error": "Kein Gerät angegeben"}
        except Exception as err:  # noqa: BLE001 – Fehler im Panel anzeigen
            _LOGGER.warning("Display übernehmen fehlgeschlagen: %s", err)
            return {"ok": False, "error": str(err) or type(err).__name__}
        kind = str(res.get("type", ""))
        if kind.endswith("create_entry"):
            entry = res.get("result")
        elif kind.endswith("abort"):
            entry = next((e for e in hass.config_entries.async_entries(ESPHOME) if host and e.data.get("host") == host), None)
            if entry is None:
                reason = res.get("reason", "")
                return {"ok": False, "error": "Das Gerät ist schon in ESPHome eingerichtet" if reason == "already_configured"
                        else f"Abgebrochen: {reason}"}
        else:
            # Formular (Schlüssel, Passwort) oder Verbindungsfehler: Erkennung bleibt in Home Assistant offen,
            # ein per IP begonnener Ablauf wird verworfen
            if host and res.get("flow_id"):
                hass.config_entries.flow.async_abort(res["flow_id"])
            step, errors = str(res.get("step_id", "")), res.get("errors") or {}
            if "encryption" in step or "authenticate" in step:
                msg = "Das Gerät verlangt einen Schlüssel – bitte unter Einstellungen → Geräte & Dienste → ESPHome hinzufügen"
            else:
                msg = f"Gerät nicht erreichbar ({', '.join(map(str, errors.values())) or step})"
            return {"ok": False, "error": msg}
    if not isinstance(entry, ConfigEntry):
        return {"ok": False, "error": "Gerät nicht übernommen"}
    await _allow(hass, entry)
    return {"ok": True, "entry_id": entry.entry_id, "name": entry.data.get("device_name") or _norm(entry.title)}


# ---------- Websocket ----------
@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_devices)
    websocket_api.async_register_command(hass, ws_adopt)
    websocket_api.async_register_command(hass, ws_update)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/display_devices"})
@callback
def ws_devices(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Gefundene Geräte und mitgelieferte Firmware für den Assistenten."""
    fw = hass.data[DOMAIN].get("firmware")
    connection.send_result(msg["id"], {
        "devices": list_devices(hass),
        "firmware": {"version": fw, "manifest": f"{FIRMWARE_URL}/manifest.json", "bin": f"{FIRMWARE_URL}/haus-display.factory.bin"} if fw else None,
        "service": SERVICE_DATA,
    })


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/display_adopt",
    vol.Exclusive("flow_id", "geraet"): str,
    vol.Exclusive("entry_id", "geraet"): str,
    vol.Exclusive("host", "geraet"): vol.All(str, vol.Length(min=3, max=100), vol.Match(r"^[A-Za-z0-9.:\-\[\]]+$")),
})
@websocket_api.async_response
async def ws_adopt(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Gerät übernehmen (Erkennung bestätigen oder per IP) und ihm Aktionen erlauben."""
    res = await adopt(hass, msg.get("flow_id"), msg.get("entry_id"), msg.get("host"))
    connection.send_result(msg["id"], res)



@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/display_update", vol.Required("device"): vol.All(str, vol.Match(r"^[a-z0-9][a-z0-9-]{0,39}$"))})
@websocket_api.async_response
async def ws_update(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """„Update installieren“ im Reiter Displays."""
    try:
        ver = await async_install(hass, msg["device"])
    except HomeAssistantError as err:
        connection.send_result(msg["id"], {"ok": False, "error": str(err)})
        return
    connection.send_result(msg["id"], {"ok": True, "version": ver})
