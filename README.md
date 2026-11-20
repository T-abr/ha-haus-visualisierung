# Haus Visualisierung 1.3

Eigenes Home-Assistant-Panel, das sich wie eine Dashboard-Strategy aus Etagen, Bereichen und Geräten
selbst aufbaut – mit eigenem Design, Alarmmanager und Hausmodus. Läuft auf einem Raspberry Pi ohne Last:
das Panel nutzt nur die Zustände, die Home Assistant ohnehin an den Browser schickt.

## Funktionen

- **Übersicht** in vier Varianten (Hausschnitt, Cockpit, Etagen-Spalten, Aktiv-Fokus), automatisch Cockpit am
  Desktop und Aktiv-Fokus am Handy; Darstellung Kompakt oder Komfort; vier Kopfzeilen.
- **Raumseiten und Sammelseiten** (Licht, Beschattung, Klima, Sicherheit, Batterien) – Wischen zum Dimmen,
  langes Drücken für Details; auf Raumseiten Temperatur- und Feuchteverlauf der letzten 24 Stunden.
- **Heizung** im Heizungsraum: Speicher mit Schichtung und Ladung, Kamin mit Pumpe, Heizkurve mit Betriebspunkt
  und Mischer (passt zur Integration „Heizkurve Fußbodenheizung“).
- **Wallbox** in der Einfahrt: Ladeleistung, Ladestand, Reichweite, Lademodus und Ziel (EVCC und andere).
- **Wandpanel-Modus** je Gerät (auch per `?wandpanel=1`): Vollbild ohne Seitenleiste, Bildschirmschoner mit Uhr,
  Wetter, Hausmodus und Meldungen, automatische Rückkehr zur Startseite; Klingel, Alarme und Bewegung wecken auf.
- **Einstellungen im Panel** mit Reitern (Räume, Alarme, Meldungen, Technik, Darstellung) und Sortieren per Ziehen.
- **Eingebettete Panels** (Solar, Protect, Dashboards) mit fester Navigation und Haus-Farben.
- **Klingel-Overlay** mit Kamera, Live-Bild und Türöffner (Schalter, Taste, Schloss).
- **Alarmmanager**: Warnregeln (fest und eigene), Leitstelle, Quittieren, Stummschalten, Protokoll,
  Fehlalarm-Auswertung, Push-Meldungen mit Aktionsknöpfen.
- **Hausmodus** Zuhause, Nacht, Abwesend, Urlaub – Automatik nach Personen und Uhrzeit, Kopplung mit Alarmo,
  Regeln je Modus.
- **Eskalation und Aktionen**: KNX-Telegramm, Schalter, Sirene, Durchsage (Sonos), Skript – mit Zurücksetzen.
- **Entitäten** `select.hausmodus`, `sensor.haus_alarme_aktiv`; Ereignisse `haus_visualisierung_alarm`,
  `haus_visualisierung_modus`.
- Karten `custom:haus-raum-card` und `custom:haus-hausschnitt-card` für eigene Dashboards.

## Installation

1. `custom_components/haus_visualisierung` nach `/config/custom_components/` kopieren.
2. Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → „Haus Visualisierung“.

Voraussetzung: Home Assistant ab 2025.1, Bereiche und Etagen angelegt.

## Entwicklung

- Handbuch: Projekt-Dokument „Haus Visualisierung – Benutzerhandbuch“; Änderungen: `CHANGELOG.md`;
  Performance: `PERFORMANCE.md`.
- Tests: `pytest` (Backend in echter HA-Instanz), `python3 tests/interact.py` (Bedienung im Browser),
  `python3 tests/perf/measure.py` (Performance).
- Version setzen: `python3 scripts/bump_version.py patch|minor|major`, ZIP bauen: `python3 scripts/build_zip.py`.
