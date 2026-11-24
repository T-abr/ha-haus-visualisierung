# Haus Visualisierung 1.19.0

Eigenes Home-Assistant-Panel, das sich wie eine Dashboard-Strategy aus Etagen, Bereichen und Geräten
selbst aufbaut – mit eigenem Design, Alarmmanager und Hausmodus. Läuft auf einem Raspberry Pi ohne Last:
das Panel nutzt nur die Zustände, die Home Assistant ohnehin an den Browser schickt.

## Funktionen

- **Übersicht** in vier Varianten (Hausschnitt, Cockpit, Etagen-Spalten, Aktiv-Fokus), automatisch Cockpit am
  Desktop und Aktiv-Fokus am Handy; Darstellung Kompakt oder Komfort; vier Kopfzeilen.
- **Raumseiten und Sammelseiten** (Licht, Beschattung, Klima, Sicherheit, Batterien) – Wischen zum Dimmen,
  langes Drücken für Details; auf Raumseiten Temperatur- und Feuchteverlauf der letzten 24 Stunden, auf der
  Klimaseite Haus-Durchschnitt und Außentemperatur über 24 Stunden, eine Woche, einen Monat oder ein Jahr
  sowie ein Verlauf je Raum.
- **Energie**: Energiefluss mit PV, Netz, Speicher, Wallbox und Haus, Autarkie und Eigenverbrauch jetzt und heute,
  Leistung der letzten 24 Stunden, Energie je Tag für Woche und Monat bzw. je Monat fürs Jahr; ein Tipp aufs Dach
  öffnet die Seite.
- **Heizung** im Heizungsraum: Speicher mit Schichtung und Ladung, Kamin mit Pumpe, Heizkurve mit Betriebspunkt
  und Mischer (passt zur Integration „Heizkurve Fußbodenheizung“).
- **Wallbox** in der Einfahrt: Ladeleistung, Ladestand, Reichweite, Lademodus und Ziel (EVCC und andere).
- **Wetter und Beschattung**: Vorhersage für fünf Tage auf der Seite Beschattung, „morgen“ im Kopf und im
  Bildschirmschoner; Hinweise wie „Morgen 30 °C: Südrollos bis 10:30 schließen“ aus Vorhersage, Sonnenstand am
  Standort und Ausrichtung der Fenster. Geschaltet wird nur auf Tippen, mit Rückfrage.
- **Wetterwarnungen**: Unwetter vom Deutschen Wetterdienst (Integration „DWD Weather Warnings“), „Regen kommt“ bei
  offenen Fenstern und Türen (Regensensor, Wetterlage oder stündliche Vorhersage) und „Sturm“ bei ausgefahrener Markise –
  im Alarmmanager, in Kopfzeile, Schoner, am Wanddisplay und per Push; `sensor.haus_wetter`.
- **Müllabfuhr und Termine**: „Morgen: Gelbe Tonne“ in der Kopfzeile und im Bildschirmschoner, am Vorabend
  hervorgehoben, dazu Termine von heute und morgen; aus Kalendern in Home Assistant (z. B. Waste Collection Schedule).
- **Wartungsplaner**: wiederkehrende Aufgaben (Filter, Rauchmelder, Kaminkehrer, Heizungswartung …) mit Intervall und
  Fälligkeit auf der Seite „Wartung“, „Erledigt“ für alle Benutzer, fällige Aufgaben als Hinweis in den Meldungen.
- **Wanddisplays** (z. B. 4-Zoll-ESP32-S3 mit ESPHome): das Display ist ein Client der Visualisierung, Seiten und
  Kacheln stehen in Einstellungen → Wandpanel & Displays. **Einrichten ohne Handarbeit** im selben Reiter: Firmware aus dem
  Browser flashen (Chrome/Edge über HTTPS, Firmware liegt der Integration bei), WLAN per Improv, Gerät übernehmen
  und zuordnen, **Firmware-Updates über das Netz** (Update-Entität je Display). Die Inhalte kommen fertig gerechnet per Push ans Gerät (und als `sensor.haus_display_<kennung>`),
  Tipps über den Dienst `haus_visualisierung.display_tap`. Firmware: [ha-haus-display](https://github.com/T-abr/ha-haus-display),
  Schnittstelle: [DISPLAY_PROTOKOLL.md](DISPLAY_PROTOKOLL.md) (Protokoll 1; Push und Einrichten ab 1.13.0 mit Firmware 0.2.0).
- **Wandpanel-Modus** je Gerät (auch per `?wandpanel=1`): Vollbild ohne Seitenleiste, Bildschirmschoner mit Uhr,
  Wetter, Hausmodus und Meldungen, automatische Rückkehr zur Startseite; Klingel, Alarme und Bewegung wecken auf.
- **Als Standard-Dashboard** (Einstellungen → Darstellung → „Beim Öffnen von Home Assistant“): Home Assistant öffnet
  statt der Übersicht die Visualisierung, für den eigenen Benutzer, für alle oder nur auf diesem Gerät.
- **Einstellungen im Panel** mit Reitern (Räume, Alarme, Meldungen, Energie, Technik, Wandpanel & Displays, Darstellung, Prüfen & Sichern) mit Sprungleiste und Sortieren per Ziehen.
- **Prüfen & Sichern**: Einrichtungs-Check (gelöschte Entitäten, Räume ohne Fühler, Rollos ohne Ausrichtung …) und
  Sicherungen der Einstellungen – automatisch vor Updates und täglich vor dem Speichern, wiederherstellen, als Datei
  herunterladen und einspielen.
- **PIN für heikle Aktionen**: Tür öffnen, Alarm aus, Abwesend/Urlaub nur mit PIN – an Wandpanels und Wanddisplays oder
  überall; die PIN bleibt in Home Assistant.
- **Eingebettete Panels** (Solar, Protect, Dashboards) mit fester Navigation und Haus-Farben.
- **Klingel-Overlay** mit Kamera, Live-Bild und Türöffner (Schalter, Taste, Schloss).
- **Alarmmanager**: Warnregeln (fest und eigene), Leitstelle, Quittieren, Stummschalten, Protokoll,
  Fehlalarm-Auswertung, Push-Meldungen mit Aktionsknöpfen.
- **Hausmodus** Zuhause, Nacht, Abwesend, Urlaub – Automatik nach Personen und Uhrzeit, Kopplung mit Alarmo,
  Regeln je Modus.
- **Anwesenheits-Simulation** im Urlaub: Lichter und Rollos nach dem Muster eines echten Tages der letzten Wochen,
  leicht zufällig verschoben; endet automatisch bei der Rückkehr.
- **Eskalation und Aktionen**: KNX-Telegramm, Schalter, Sirene, Durchsage (Sonos), Skript – mit Zurücksetzen.
- **Entitäten** `select.hausmodus`, `sensor.haus_alarme_aktiv`; Ereignisse `haus_visualisierung_alarm`,
  `haus_visualisierung_modus`.
- Karten `custom:haus-raum-card` und `custom:haus-hausschnitt-card` für eigene Dashboards.

## Installation

1. ZIP `haus_visualisierung_vX.Y.Z.zip` aus den [Releases](https://github.com/T-abr/ha-haus-visualisierung/releases)
   laden und entpacken (oder das Repository klonen).
2. `custom_components/haus_visualisierung` nach `/config/custom_components/` kopieren.
3. Home Assistant neu starten.
4. Einstellungen → Geräte & Dienste → Integration hinzufügen → „Haus Visualisierung“.

**HACS:** Das Repository ist für HACS vorbereitet (`hacs.json`). HACS installiert aber nur aus öffentlichen
Repositories. Solange dieses privat ist, geht die Installation nur wie oben beschrieben. Wird es öffentlich:
HACS → ⋮ → Benutzerdefinierte Repositories → `https://github.com/T-abr/ha-haus-visualisierung`, Typ Integration,
dann „Haus Visualisierung“ herunterladen und Home Assistant neu starten. Updates kommen danach per Klick.

Voraussetzung: Home Assistant ab 2025.1, Bereiche und Etagen angelegt.

## Entwicklung

- Handbuch: Projekt-Dokument „Haus Visualisierung – Benutzerhandbuch“; Änderungen: `CHANGELOG.md`;
  Performance: `PERFORMANCE.md`.
- Tests: `pytest` (Backend in echter HA-Instanz), `python3 tests/interact.py` (Bedienung im Browser),
  `python3 tests/perf/measure.py` (Performance). Abhängigkeiten: `pip install -r tests/requirements.txt`.
  Die Browser-Prüfungen laden direkt `custom_components/haus_visualisierung/frontend/haus-visualisierung.js`
  und die Module daneben (über `tests/harness_server.py`), eine Kopie im Harness gibt es nicht.
- Nur geänderte Teile prüfen (während der Entwicklung): `python3 tests/changed.py` vergleicht mit `main`
  (inkl. nicht committeter und neuer Dateien) und führt nur die passenden Gruppen der Bedienprüfungen aus,
  dazu `pytest`, wenn Python-Code oder Frontend betroffen ist. `--zeigen` zeigt nur die Auswahl.
  Gruppen gezielt: `python3 tests/interact.py klima energie`, Übersicht: `python3 tests/interact.py --liste`.
  Welche Datei welche Gruppen auslöst, steht in `GRUPPEN_FUER` in `tests/changed.py`; gemeinsam genutzte Module,
  das Harness und neue, dort nicht eingetragene Frontend-Dateien lösen alle Gruppen aus. Die CI prüft immer alles.
- Frontend: `frontend/haus-visualisierung.js` ist nur der Einstiegspunkt; der Code steckt in ES-Modulen unter
  `frontend/modules/` (ohne Build-Schritt). Das Panel setzt sich aus `panel.js` und den Teilen `panel-*.js` zusammen.
  Die Versionsnummer des Frontends steht in `frontend/modules/version.js`.
- CI: GitHub Actions (`.github/workflows/tests.yml`) prüft bei jedem Pull Request und Push auf `main`
  die Versionen, die Backend-Tests und die Bedienprüfungen.
- Version setzen: `python3 scripts/bump_version.py patch|minor|major`, ZIP bauen: `python3 scripts/build_zip.py`.
- Release: nach dem Merge auf GitHub → Actions → „Release“ → „Run workflow“ (legt den Tag `v<Version>` an) oder
  `git tag vX.Y.Z && git push origin vX.Y.Z`. Der Workflow „Release“ prüft, dass der Tag
  zu `manifest.json` passt, baut das ZIP und veröffentlicht das Release mit dem CHANGELOG-Abschnitt.
