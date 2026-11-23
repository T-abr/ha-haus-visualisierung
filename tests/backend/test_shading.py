"""Beschattung: Einstellungen werden geprüft (Schalter, Grenze, Ausrichtung je Rollo)."""
from custom_components.haus_visualisierung.const import DEFAULT_LAYOUT
from custom_components.haus_visualisierung.store import sanitize


def test_standard() -> None:
    assert sanitize({})["shading"] == {"enabled": True, "hot": 26, "facing": {}}
    assert DEFAULT_LAYOUT["shading"]["facing"] == {}


def test_werte_geprueft() -> None:
    sh = sanitize({"shading": {
        "enabled": "nein", "hot": 99, "evil": 1,
        "facing": {"cover.wohnzimmer": "S", "cover.buero": "SW", "cover.garage": "-", "cover.falsch": "Süd",
                   "light.flur": "N", "<script>": "O", "cover.zahl": 3},
    }})["shading"]
    assert sh["enabled"] is True and sh["hot"] == 40 and "evil" not in sh
    assert sh["facing"] == {"cover.wohnzimmer": "S", "cover.buero": "SW", "cover.garage": "-"}
    assert sanitize({"shading": {"enabled": False, "hot": 10, "facing": "x"}})["shading"] == {"enabled": False, "hot": 18, "facing": {}}


def test_vorhersage() -> None:
    assert sanitize({})["forecast"] == {"enabled": True, "solar": True, "solar_today": "", "solar_tomorrow": ""}
    fc = sanitize({"forecast": {"enabled": False, "solar": "ja", "solar_today": "sensor.pv_heute", "solar_tomorrow": "light.x", "evil": 1}})["forecast"]
    assert fc == {"enabled": False, "solar": True, "solar_today": "sensor.pv_heute", "solar_tomorrow": ""}
