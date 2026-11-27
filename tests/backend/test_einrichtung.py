"""Allgemeingültige Einrichtung: Assistent-Status, Bausteine der Heizungskarte, Lademodi, Rollen-Labels."""
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus_visualisierung.const import DOMAIN, STORAGE_KEY
from custom_components.haus_visualisierung.erkennung import labelled
from custom_components.haus_visualisierung.store import LayoutStore, sanitize


def test_assistent_status() -> None:
    assert sanitize(None)["setup"] == {"done": False}
    assert sanitize({"setup": {"done": True}})["setup"] == {"done": True}
    assert sanitize({"setup": {"done": "ja", "evil": 1}})["setup"] == {"done": False}


async def test_bestehende_installation_ohne_assistent(hass: HomeAssistant, hass_storage) -> None:
    hass_storage[STORAGE_KEY] = {"version": 1, "key": STORAGE_KEY, "data": {"glass": False}}
    st = LayoutStore(hass)
    await st.async_load()
    assert st.data["setup"]["done"] is True and st.data["glass"] is False


async def test_neue_installation_mit_assistent(hass: HomeAssistant) -> None:
    st = LayoutStore(hass)
    await st.async_load()
    assert st.data["setup"]["done"] is False
    await st.async_patch([{"path": ["setup", "done"], "value": True}])
    assert st.data["setup"]["done"] is True


def test_bausteine_und_lademodi() -> None:
    d = sanitize({})
    assert d["heating"]["parts"] == {"tank": True, "stove": True, "curve": True} and d["heating"]["extra"] == []
    assert d["wallbox"]["mode_names"] == {}
    h = sanitize({"heating": {"parts": {"stove": False, "tank": "nein", "evil": True}, "extra": ["sensor.wp_leistung", "kein", 3]}})["heating"]
    assert h["parts"] == {"tank": True, "stove": False, "curve": True} and h["extra"] == ["sensor.wp_leistung"]
    w = sanitize({"wallbox": {"mode_names": {"pv": " Sonne ", "now": "-", "leer": "  ", "zahl": 3}}})["wallbox"]
    assert w["mode_names"] == {"pv": "Sonne", "now": "-"}


async def test_rollen_labels(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN)
    entry.add_to_hass(hass)
    ent_reg, dev_reg = er.async_get(hass), dr.async_get(hass)
    regen = ent_reg.async_get_or_create("binary_sensor", "test", "regen1", suggested_object_id="gartenmelder")
    ent_reg.async_update_entity(regen.entity_id, labels={"haus_regensensor"})
    dev = dev_reg.async_get_or_create(config_entry_id=entry.entry_id, identifiers={("test", "markise")})
    dev_reg.async_update_device(dev.id, labels={"haus_markise"})
    mk = ent_reg.async_get_or_create("cover", "test", "markise1", suggested_object_id="terrasse", device_id=dev.id)
    hass.states.async_set(regen.entity_id, "off")
    hass.states.async_set(mk.entity_id, "closed")
    assert labelled(hass, "haus_regensensor") == [regen.entity_id]
    assert labelled(hass, "haus_markise", ("cover",)) == [mk.entity_id]  # Label am Gerät
    assert labelled(hass, "haus_markise", ("light",)) == []
    hass.states.async_remove(regen.entity_id)
    assert labelled(hass, "haus_regensensor") == []  # nur vorhandene Entitäten
