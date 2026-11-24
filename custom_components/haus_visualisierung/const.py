"""Konstanten der Haus Visualisierung."""

from __future__ import annotations

DOMAIN = "haus_visualisierung"
VERSION = "1.19.0"

PANEL_URL_PATH = "haus-visualisierung"
PANEL_COMPONENT = "haus-visualisierung-panel"
STATIC_URL = "/haus_visualisierung_static"
# Die Version steckt im Pfad, damit auch die nachgeladenen Module (frontend/modules/) nach einem
# Update neu geladen werden: relative Importe übernehmen den Pfad, aber keine ?v=-Angabe.
FRONTEND_URL = f"{STATIC_URL}/{VERSION}"
MODULE_URL = f"{FRONTEND_URL}/haus-visualisierung.js"
# Kleiner Lader für die Dashboard-Karten: läuft auf jeder Seite, der Rest kommt erst bei Bedarf
CARDS_URL = f"{FRONTEND_URL}/karten-loader.js"

STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

CONF_NAME = "name"
CONF_ICON = "icon"
CONF_THEME = "theme"
CONF_REQUIRE_ADMIN = "require_admin"

DEFAULT_NAME = "Haus"
DEFAULT_ICON = "mdi:home-variant"
DEFAULT_THEME = ""
DEFAULT_REQUIRE_ADMIN = False

# Layout-Einstellungen, die im Panel unter „Einstellungen“ gepflegt werden.
DEFAULT_LAYOUT: dict = {
    "area_order": [],          # Bereichs-IDs in Wunschreihenfolge (innerhalb der Etage)
    "hidden_areas": [],        # ausgeblendete Bereiche
    "floor_order": [],         # Etagen-IDs von oben nach unten (leer = nach Ebene)
    "outdoor_floors": [],      # Etagen, die als „Außen“ dargestellt werden (leer = nach Namen)
    "pins": {},                # {area_id: [entity_id, ...]} – Raum-Pins
    "favorites": [],           # Favoriten auf der Übersicht
    "hidden_entities": [],     # einzeln ausgeblendete Entitäten
    "hide_labels": ["no_dboard", "no-dboard"],
    "header": {                # Kopfzeile: Energie
        "power": "",
        "pv": "",
        "battery": "",
        "grid": "",
    },
    "energy": {                # Seite „Energie“: Speicher-Leistung und Vorzeichen
        "enabled": True,
        "battery_power": "",           # positiv = Laden; leer = automatisch
        "grid_invert": False,          # Netz meldet Einspeisung positiv
        "battery_invert": False,       # Speicher meldet Entladen positiv
    },
    "price": {                 # Strompreis: Sensor (dynamisch) oder fester Preis, alles in ct/kWh
        "sensor": "",                  # leer = automatisch erkennen (Einheit …/kWh)
        "use_sensor": True,            # False = immer fester Preis
        "fixed_ct": 30,                # Arbeitspreis ohne Preissensor
        "feed_in_ct": 8,               # Einspeisevergütung
        "surcharge_ct": 0,             # Aufschlag auf den Sensorpreis (z. B. Netzentgelt, Steuern zum Börsenpreis)
        "window_h": 3,                 # Länge des günstigsten Zeitfensters in Stunden
    },
    "links": [                 # Verknüpfungen zu anderen Panels
        {"title": "Solar", "icon": "mdi:solar-power-variant", "path": "/solar-visualisierung", "embed": True, "mode": "theme"},
        {"title": "Kameras", "icon": "mdi:cctv", "path": "/protect-visualisierung", "embed": True, "mode": "theme"},
    ],
    "show_energy_sensors": False,  # Leistungs-/Energiesensoren in Räumen
    "show_other": True,            # Bereich „Weitere“ (select, number, button …)
    "show_trends": True,           # Raumseiten: Verlauf 24 h (Temperatur, Luftfeuchte)
    "camera_interval": 10,         # Sekunden zwischen Standbildern
    "glass": True,                 # Glas-Effekt (backdrop-filter)
    "start_view": "overview",
    "battery_critical": 15,        # Batterie kritisch unter … %
    "battery_low": 35,             # Batterie schwach unter … %
    "density": "kompakt",          # kompakt | komfort
    "alerts": {                    # Warnungen (Karte, Kopfzeile)
        "builtin": {
            "contacts": True,          # Fenster/Türen offen
            "window_heating": True,    # Fenster offen, während der Raum heizt
            "safety": True,            # Rauch, Wasser, Gas … ausgelöst
            "locks": True,             # Schloss entriegelt
            "garage": True,            # Garagentor/Tor offen
            "battery": False,          # Batterien kritisch
            "offline": False,          # Geräte nicht erreichbar
            "presence_away": True,     # Bewegung/Präsenz, während niemand zu Hause ist
            "alarm_panel": True,       # Alarmanlage (z. B. Alarmo) ausgelöst
            "mold": True,              # Schimmelrisiko: Raumfeuchte zu hoch – jetzt lüften
            "appliances": True,        # Haushaltsgerät fertig (Waschmaschine, Trockner, Spülmaschine)
            "maintenance": True,       # Wartungsplaner: Aufgabe fällig
            "weather": True,           # Unwetter (DWD), Regen bei offenem Fenster, Sturm bei ausgefahrener Markise
        },
        "modes": {},                   # {feste Regel: [Hausmodi]} – fehlt = Standard (BUILTIN_MODES)
        "contacts_min": 0,             # Fenster erst nach … Minuten melden
        "mold_hum": 65,                # Schimmelrisiko ab … % relativer Feuchte (Entwarnung 3 Punkte darunter)
        "mold_min": 30,                # … erst nach … Minuten über der Grenze melden
        "rules": [],                   # eigene Regeln
    },
    "push": {                      # Push-Benachrichtigungen über die Companion-App
        "enabled": True,
        "targets": [],                 # notify-Dienste ohne „notify.“; leer = alle mobile_app_*
        "levels": {"alarm": True, "warn": True, "info": True},
        "resolved": "clear",           # clear = Meldung entfernen | notify = Entwarnung | none
        "cooldown": 10,                # Minuten, bevor dieselbe Warnung erneut gemeldet wird
        "critical": True,              # Alarme als kritische Meldung (laut, auch bei „Nicht stören“)
        "persistent": False,           # zusätzlich als Benachrichtigung in Home Assistant
    },
    "displays": [],                # Wanddisplays (display.py): [{id, name, pages, tiles, hint, bright_day, bright_night, wake}]
    "house_mode": {                # Hausmodus (Zuhause, Nacht, Abwesend, Urlaub)
        "enabled": True,
        "auto_away": True,             # alle Personen weg → Abwesend, jemand kommt → Zuhause
        "away_delay": 10,              # Minuten, bevor auf Abwesend geschaltet wird
        "auto_night": False,           # Nacht nach Uhrzeit
        "night_start": "23:00",
        "night_end": "06:30",
        "alarmo": "",                  # alarm_control_panel; leer = automatisch (Alarmo)
        "alarmo_sync": False,          # Hausmodus und Alarmanlage koppeln
        "check": True,                 # Gute-Nacht-/Verlassen-Check vor Nacht und Abwesend
        "check_devices": [],           # weitere Geräte, die der Check prüft (z. B. Bügeleisen-Steckdose)
        "arm": {"zuhause": "disarm", "nacht": "arm_night", "abwesend": "arm_away", "urlaub": "arm_vacation"},
    },
    "pin": {                       # PIN für heikle Aktionen (pin.py); die PIN selbst liegt nur im Backend
        "door": True,                  # Tür öffnen (Klingel-Türöffner, Schloss entriegeln)
        "disarm": True,                # Alarm aus: aus Nacht/Abwesend/Urlaub zurück auf Zuhause
        "arm": False,                  # Abwesend bzw. Urlaub einschalten
        "scope": "wall",               # wall = nur Wandpanels und Wanddisplays | all = alle Geräte
    },
    "presence_sim": {              # Anwesenheits-Simulation (presence.py)
        "enabled": False,
        "modes": ["urlaub"],           # läuft in diesen Hausmodi …
        "switch": "",                  # … oder solange dieser Schalter an ist (input_boolean/switch)
        "entities": [],                # Lichter und Rollos
        "weeks": 2,                    # Vorlage aus den letzten … Wochen (Verlauf)
        "jitter": 15,                  # Schaltzeiten zufällig um bis zu ± … Minuten verschieben
    },
    "escalation": {                # Eskalation: Meldung nach … Minuten nicht quittiert
        "enabled": True,
        "minutes": 5,
        "levels": ["alarm"],
        "push_critical": True,         # erneut als kritische Push-Meldung an alle Empfänger
    },
    "alarm_actions": [],           # Aktionen (KNX, Schalter, Sirene, Durchsage, Skript) – siehe actions.py
    "confirm_quick": True,         # Schnellzugriff vor dem Ausführen bestätigen
    "heating": {                   # Technik: Karte „Heizung“ (leere Felder = automatisch erkannt)
        "enabled": True, "area": "", "tank": [], "tank_min": 30, "tank_max": 65,
        "stove": "", "stove_pump": "", "stove_hot": 50, "curve": "", "mixer": "", "flow": "", "outdoor": "",
        "manual_curve": False,
        "manual": {"slope": 0.3, "level": 0, "room": 20, "min": 22, "max": 40, "limit": 16},
    },
    "wallpanel": {                 # Wandpanel (welches Gerät eins ist, merkt sich der Browser)
        "saver_min": 5, "black_min": 0, "return_min": 2, "fullscreen": True, "hide_sidebar": True,
        "wake_alarm": True, "night_dim": True, "wander": False, "weather": "", "wake_entity": "",
        "night_from": "23:00", "night_to": "06:00",  # „Nachts dunkler“
        "clock_size": "l",                           # Bildschirmschoner: Uhr l/m/s
        "sv_indoor": "",                             # Innentemperatur im Schoner: "" | "avg" | Bereichs-ID
        # Elemente des Bildschirmschoners (Wandpanel und Wanddisplays)
        "sv_date": True, "sv_weather": True, "sv_forecast": True, "sv_pv": True, "sv_mode": True,
        "sv_appl": True, "sv_shade": True, "sv_status": True,
    },
    "shading": {                   # Beschattung: Hinweise nach Vorhersage, Sonnenstand und Ausrichtung
        "enabled": True, "hot": 26,    # heißer Tag ab °C (Vorhersage)
        "facing": {},                  # {cover_id: "N"|"NO"|"O"|"SO"|"S"|"SW"|"W"|"NW"|"-"}, fehlt = aus dem Namen
    },
    "weather_alerts": {            # Wetterwarnungen (weather.py): DWD, Regen + offene Fenster, Sturm + Markise
        "enabled": True,
        "dwd": [],                     # DWD-Warnsensoren; leer = automatisch
        "dwd_min": 2,                  # ab Warnstufe (1 Wetterwarnung, 2 markant, 3 Unwetter, 4 extrem)
        "rain": True,                  # Regen kommt bzw. regnet und Fenster/Türen sind offen
        "rain_min": 60,                # so weit vorausschauen (Minuten)
        "rain_mm": 0.3,                # ab … mm Niederschlag je Stunde
        "rain_sensor": "",             # Regensensor (binary_sensor); leer = automatisch nach Namen
        "wind": True,                  # Sturm und Markise ausgefahren
        "wind_kmh": 50,                # ab … km/h (Böen)
        "awnings": [],                 # Markisen; leer = automatisch (device_class awning oder Name)
    },
    "forecast": {                  # Karte „Vorhersage“ auf der Übersicht: Wetter und Solarprognose
        "enabled": True, "solar": True,
        "solar_today": "", "solar_tomorrow": "",   # leer = automatisch (Forecast.Solar, Solcast)
    },
    "termine": {                   # Müllabfuhr und Termine in Kopfzeile und Bildschirmschoner (Kalender-Entitäten)
        "enabled": True, "header": True, "saver": True,
        "days": 7,                     # so viele Tage im Voraus lesen
        "evening": 17,                 # Abfuhr morgen ab dieser Stunde hervorheben
        "cals": {},                    # {calendar_id: "waste"|"event"|"-"}, fehlt = Müllabfuhr, wenn der Name passt
    },
    "appliances": {                # Haushaltsgeräte: „läuft“/„fertig“, Energie und Kosten je Durchgang (appliances.py)
        "enabled": True,
        "auto": True,                  # ohne Einträge: Leistungssensoren nach Namen (Waschmaschine, Trockner, Spülmaschine)
        "items": [],                   # [{id, name, kind, power, energy, status, door, remaining, start_w, stop_w, stop_min}]
    },
    "maintenance": {               # Wartungsplaner: wiederkehrende Aufgaben (erledigt-Daten: maintenance.py)
        "enabled": True,
        "lead_days": 14,               # „demnächst“ ab … Tagen vor der Fälligkeit
        "tasks": [],                   # [{id, title, icon, interval, unit (tage|wochen|monate|jahre), since, note}]
    },
    "wallbox": {                   # Technik: Karte „Wallbox“ (EVCC u. a.)
        "enabled": True, "area": "", "power": "", "mode": "", "soc": "", "limit": "",
        "energy": "", "connected": "", "charging": "", "range": "",
    },
    "doorbell": {                  # Klingel-Overlay im Panel
        "enabled": True,
        "entity": "",                  # leer = automatisch (Ereignis „Klingel“ von UniFi Protect)
        "camera": "",                  # leer = Kamera am selben Gerät
        "lock": "",                    # optional: Türöffner (Schloss, Schalter, Taste, Skript)
        "timeout": 60,                 # Sekunden bis zum automatischen Schließen
        "pulse": 2,                    # Schalter nach … s wieder aus (0 = nur ein)
    },
    "header_style": "kompakt",     # kompakt | chips | satz | leiste
    "overview_style": "auto",      # auto | haus | cockpit | spalten | fokus (nur Kompakt)
}


HOUSE_MODES = ["zuhause", "nacht", "abwesend", "urlaub"]
HOUSE_MODE_NAMES = {"zuhause": "Zuhause", "nacht": "Nacht", "abwesend": "Abwesend", "urlaub": "Urlaub"}
ARM_ACTIONS = ["none", "disarm", "arm_home", "arm_night", "arm_away", "arm_vacation"]
# In welchen Hausmodi die festen Regeln gelten, wenn nichts eingestellt ist
BUILTIN_MODES: dict[str, list[str]] = {"presence_away": ["abwesend", "urlaub"], "mold": ["zuhause"]}
ACTION_TYPES = ["knx", "switch", "siren", "tts", "script"]
ACTION_WHEN = ["neu", "eskalation"]
