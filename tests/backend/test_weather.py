"""Wetterwarnungen: DWD, „Regen kommt, Fenster offen“, „Sturm, Markise ausgefahren“ und sensor.haus_wetter."""
from datetime import timedelta

from homeassistant.core import HomeAssistant, SupportsResponse
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_mock_service
from test_push import _ent, _setup, _tick

from custom_components.haus_visualisierung.const import DOMAIN
from custom_components.haus_visualisierung.store import sanitize
from custom_components.haus_visualisierung.weather import clock, dwd_list, kmh


def test_hilfen() -> None:
    assert kmh(10, "m/s") == 36 and round(kmh(10, "kn"), 1) == 18.5 and kmh(40, None) == 40 and kmh("x", "km/h") is None
    now = dt_util.now().replace(hour=10, minute=0)
    assert clock(now.replace(hour=15, minute=5), now) == "15:05" and clock(now + timedelta(days=1), now).startswith("morgen")
    w = sanitize({"weather_alerts": {"dwd_min": 9, "rain_mm": 50, "wind_kmh": 5, "dwd": ["sensor.a", "light.x"], "awnings": ["cover.m", "x"]}})["weather_alerts"]
    assert w["dwd_min"] == 4 and w["rain_mm"] == 10 and w["wind_kmh"] == 20 and w["dwd"] == ["sensor.a"] and w["awnings"] == ["cover.m"]
    assert sanitize({})["alerts"]["builtin"]["weather"] is True


def _dwd(hass, eid: str, warnings: list[dict], advance: bool = False) -> None:
    attrs = {"region_name": "Musterstadt", "warning_count": len(warnings), "friendly_name": "DWD Vorabinformation" if advance else "DWD aktuelle Warnstufe"}
    for i, w in enumerate(warnings, 1):
        for k, v in w.items():
            attrs[f"warning_{i}_{k}"] = v
    hass.states.async_set(eid, max([w.get("level", 0) for w in warnings], default=0), attrs)


async def test_wetterwarnungen(hass: HomeAssistant) -> None:
    calls = async_mock_service(hass, "notify", "mobile_app_handy")
    reg = er.async_get(hass)
    areas = ar.async_get(hass)
    bad, terrasse = areas.async_create("Bad").id, areas.async_create("Wohnzimmer").id
    fenster = _ent(hass, reg, bad, "binary_sensor", "bad_fenster", "off", {"device_class": "window", "friendly_name": "Bad Fenster"})
    markise = _ent(hass, reg, terrasse, "cover", "markise", "closed", {"device_class": "awning", "friendly_name": "Wohnzimmer Markise"})
    now = dt_util.now()
    hours = [{"datetime": (now + timedelta(minutes=m)).isoformat(), "condition": "cloudy", "precipitation": 0, "wind_speed": 10, "wind_gust_speed": 20}
             for m in (0, 60, 120)]
    resp = {"weather.home": {"forecast": hours}}
    async_mock_service(hass, "weather", "get_forecasts", supports_response=SupportsResponse.ONLY, response=resp)
    hass.states.async_set("weather.home", "cloudy", {"supported_features": 3, "wind_speed_unit": "km/h", "temperature": 12})
    _dwd(hass, "sensor.dwd_aktuell", [])
    monitor = await _setup(hass)
    await _tick(hass)
    assert not [a for a in monitor._active if a.startswith("wx:")]
    assert hass.states.get("sensor.haus_wetter").state == "0"

    # DWD-Warnung Stufe 1 (unter der Grenze 2) → nichts; Stufe 3 (Unwetter, Gewitter) → Warnung mit Zeit
    end = now + timedelta(hours=3)
    _dwd(hass, "sensor.dwd_aktuell", [{"headline": "Leichter Frost", "level": 1, "type": 5, "end": end.isoformat()},
                                      {"headline": "Amtliche Unwetterwarnung vor schwerem Gewitter", "level": 3, "type": 0,
                                       "start": (now - timedelta(minutes=5)).isoformat(), "end": end.isoformat(),
                                       "description": "Es treten schwere Gewitter auf. Dabei Starkregen."}])
    await _tick(hass)
    dwd = [a for k, a in monitor._active.items() if k.startswith("wx:dwd:")]
    assert len(dwd) == 1 and dwd[0].level == "warn" and dwd[0].title.startswith("Unwetter: Amtliche")
    assert dwd[0].detail.startswith("bis ") and "schwere Gewitter" in dwd[0].detail and dwd[0].path == "beschattung"
    info = hass.states.get("sensor.haus_wetter").attributes
    assert info["warnungen"][0]["stufe"] == 3 and info["regen"]["quelle"].startswith("Amtliche")
    # Gewitter zählt als Regen; Fenster öffnen → „Es regnet · Bad · Fenster offen“
    hass.states.async_set(fenster, "on", {"device_class": "window", "friendly_name": "Bad Fenster"})
    await _tick(hass)
    rain = monitor._active["wx:rain"]
    assert rain.title == "Es regnet · Bad · Fenster offen" and rain.level == "warn"
    # Gewitter (DWD Stufe ≥ 2) = Sturm; Markise ausfahren → Meldung
    hass.states.async_set(markise, "open", {"device_class": "awning", "friendly_name": "Wohnzimmer Markise"})
    await _tick(hass)
    assert monitor._active["wx:wind"].title == "Sturm · Markise ausgefahren"
    assert any("Markise" in c.data.get("title", "") for c in calls)

    # Warnung vorbei → Regen nur noch aus der Vorhersage: in 30 min 1,2 mm
    _dwd(hass, "sensor.dwd_aktuell", [])
    hours[1] = {**hours[1], "datetime": (now + timedelta(minutes=30)).isoformat(), "precipitation": 1.2}
    hass.states.async_set("weather.home", "cloudy", {"supported_features": 3, "wind_speed_unit": "km/h", "temperature": 12, "x": 1})
    monitor.weather.refresh(force=True)
    await _tick(hass)
    rain = monitor._active["wx:rain"]
    assert rain.title == "Regen kommt · Bad · Fenster offen" and "etwa 1,2 mm" in rain.detail and rain.detail.startswith("ab ")
    assert "wx:wind" not in monitor._active
    # Böen 60 km/h laut Vorhersage → Sturm kommt
    hours[2] = {**hours[2], "datetime": (now + timedelta(minutes=50)).isoformat(), "wind_gust_speed": 60}
    monitor.weather.refresh(force=True)
    await _tick(hass)
    assert monitor._active["wx:wind"].title == "Sturm kommt · Markise ausgefahren" and "Böen bis 60 km/h" in monitor._active["wx:wind"].detail
    # Fenster zu → keine Regenmeldung mehr; Regel abgeschaltet → gar nichts
    hass.states.async_set(fenster, "off", {"device_class": "window", "friendly_name": "Bad Fenster"})
    await _tick(hass)
    assert "wx:rain" not in monitor._active
    await hass.data[DOMAIN]["store"].async_save({"alerts": {"builtin": {"weather": False}}})
    await _tick(hass)
    assert not [a for a in monitor._active if a.startswith("wx:")] and hass.states.get("sensor.haus_wetter").state == "0"


async def test_regensensor_und_vorab(hass: HomeAssistant) -> None:
    reg = er.async_get(hass)
    kueche = ar.async_get(hass).async_create("Küche").id
    tuer = _ent(hass, reg, kueche, "binary_sensor", "kueche_tuer", "on", {"device_class": "door", "friendly_name": "Küche Terrassentür"})
    _ent(hass, reg, kueche, "binary_sensor", "garage_tor", "on", {"device_class": "garage_door", "friendly_name": "Küche Tor"})
    hass.states.async_set("binary_sensor.regensensor", "off", {"friendly_name": "Regensensor"})
    start = dt_util.now() + timedelta(hours=20)
    _dwd(hass, "sensor.dwd_vorab", [{"headline": "Vorabinformation Unwetter vor Orkanböen", "level": 3, "type": 1, "start": start.isoformat()}], advance=True)
    monitor = await _setup(hass)
    await _tick(hass)
    al = monitor._active["wx:dwd:vorabinformation_unwetter_vor_orkanb_en"]
    assert al.level == "info" and al.detail.startswith("ab ")
    assert monitor.weather.rain_sensor() == "binary_sensor.regensensor" and "wx:rain" not in monitor._active
    hass.states.async_set("binary_sensor.regensensor", "on", {"friendly_name": "Regensensor"})
    await _tick(hass)
    assert monitor._active["wx:rain"].title == "Es regnet · Küche · Terrassentür offen"
    assert dwd_list(hass.states.get("sensor.dwd_vorab"))[0]["type"] == 1
    assert tuer in monitor.weather.openings() and len(monitor.weather.openings()) == 1
