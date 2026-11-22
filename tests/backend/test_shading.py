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
