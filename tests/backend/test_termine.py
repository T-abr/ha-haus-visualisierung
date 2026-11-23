"""Müllabfuhr und Termine: Einstellungen werden geprüft (Schalter, Stunden, Art je Kalender)."""
from custom_components.haus_visualisierung.store import sanitize


def test_standard() -> None:
    assert sanitize({})["termine"] == {"enabled": True, "header": True, "saver": True, "days": 7, "evening": 17, "cals": {}}


def test_werte_geprueft() -> None:
    t = sanitize({"termine": {
        "enabled": False, "header": "ja", "saver": False, "days": 99, "evening": 3, "evil": 1,
        "cals": {"calendar.abfall": "waste", "calendar.familie": "event", "calendar.feiertage": "-",
                 "calendar.falsch": "müll", "sensor.x": "waste", "<script>": "event"},
    }})["termine"]
    assert t["enabled"] is False and t["header"] is True and t["saver"] is False and "evil" not in t
    assert t["days"] == 14 and t["evening"] == 12
    assert t["cals"] == {"calendar.abfall": "waste", "calendar.familie": "event", "calendar.feiertage": "-"}
    assert sanitize({"termine": {"cals": "x"}})["termine"]["cals"] == {}
