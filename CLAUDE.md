# Hinweise für Claude-Sitzungen

Home-Assistant-Integration „Haus Visualisierung“: Backend (Python) plus eigenes Panel (ES-Module ohne Build-Schritt).
Antworten auf Deutsch, auch Kommentare, Commit-Texte und CHANGELOG. Funktionsumfang: `README.md`; Befehle für
Tests, Version und ZIP: Abschnitt „Entwicklung“ in `README.md`. Hier steht nur, was dort fehlt.

## Arbeitsweise
- Entscheidungen (auch kleine) bei Tobias erfragen, nicht selbst treffen. Firmware nie ungefragt bauen.
- Keine Screenshots oder Mockups, außer sie sind ausdrücklich gewünscht.
- Kein Release aus einem Thread: keine Tags pushen. Release macht Tobias über Actions → „Release“ → „Run workflow“;
  der Workflow setzt dabei die Version (Eingabe patch/minor/major), Threads ändern die Versionsnummer nicht.
- Änderungen ins CHANGELOG unter `## Unveröffentlicht`, gegliedert mit `### Neu`, `### Behoben`, `### Geändert`/`### Verbessert`, `### Tests`.
  Vor einem Release braucht der Abschnitt `### Performance` (`bump_version.py` im Workflow bricht sonst ab)
  (Ergebnis von `python3 tests/perf/measure.py`, siehe `PERFORMANCE.md`).
- Sparsam arbeiten: ein Thread pro Anforderung, danach schließen. Nach dem Öffnen eines PRs nicht auf die CI warten
  und nicht selbst mergen; gemergt wird gesammelt im Release-Thread. Keine Zwischenstände melden, nur Ergebnis oder
  Frage (Fortschritt nur in der Checkliste). Große Dateien nicht komplett lesen, sondern gezielt suchen (`grep`, Ausschnitte).
- Ideen und Prioritäten: `BACKLOG.md` (umgesetzte Punkte dort streichen).
- Wanddisplay-Firmware liegt im Repo `T-abr/ha-haus-display`. Schnittstelle: `DISPLAY_PROTOKOLL.md`; wer das
  Protokoll ändert, passt beide Repos an (`PROTOCOL` in `display.py`, `hd::PROTOKOLL` in der Firmware).
  Fertige Firmware (Zweig `firmware` im Display-Repo) wird nach `custom_components/haus_visualisierung/firmware/` kopiert.

## Aufbau (`custom_components/haus_visualisierung/`)
Backend, je Datei ein Thema (der Docstring am Dateianfang erklärt es):
- `__init__.py` Einrichtung, Panel/Lader registrieren, Dienste; `const.py`; `config_flow.py`
- `store.py` Layout-Einstellungen (`.storage/haus_visualisierung`); `websocket.py` alle Befehle `haus_visualisierung/*`
  (`save` nimmt `changes` = Liste geänderter Pfade, gespeichert per `store.async_patch`)
- `alerts.py` alle Warnregeln (nur hier, das Frontend zeigt nur an), `alarms.py` Zustand/Protokoll, `actions.py` Eskalation
- `mode.py` + `select.py` Hausmodus; `presence.py` Anwesenheits-Simulation; `appliances.py` + `sensor.py` Haushaltsgeräte
- `weather.py` Wetterwarnungen; `maintenance.py` Wartung; `pin.py` PIN; `backup.py` Sicherungen
- `display.py` Inhalte fürs Wanddisplay, `display_setup.py` Einrichten/Flashen, `update.py` Firmware-Update je Display

Frontend (`frontend/`):
- `karten-loader.js` läuft auf jeder HA-Seite (klein halten!), meldet `haus-raum-card`/`haus-hausschnitt-card` an
  und lädt `modules/karten.js` erst bei Bedarf. Neue Dashboard-Karten dort anmelden, nicht im Panel.
- Einstellungsseite: `panel-einstellungen.js` (Reiter, Formulare) plus `einstellungen.js` (Abschnitte klappbar mit Kurzinfo
  je Schlüssel aus der Überschrift, Punkte ungespeichert, Warnzeichen aus `sec` des Einrichtungs-Checks, „Erweitert“ per
  `advanced()`, gekürzte Hinweise, Suche). Neue Abschnitte: Kurzinfo in `secSummary`, Daten in `SEC_DATA` eintragen.
  Bedienprüfungen klappen mit `auf(pg)` (steckt in `stab()`) alles auf.
- `haus-visualisierung.js` Einstieg des Panels (nur beim Öffnen geladen). Panel = `modules/panel.js` plus Mixins
  `panel-*.js` (Ansichten, Einstellungen, Alarmseite, Wandpanel, Klingel, Aktionen, Kompakt).
- Fachmodule je Thema: `energie`, `klima`, `verlauf`, `rueckblick`, `strompreis`, `prognose`, `wetter`,
  `wetterwarnung`, `termine`, `wartung`, `geraete`, `gutenacht`, `anwesenheit`, `pin`, `system`, `standard`,
  `technik`, `wanddisplay`, `warnungen`. Gemeinsam genutzt: `basis`, `grundlagen`, `bausteine`, `modell`,
  `bindungen`, `aktualisierer`, `stile` (Änderungen daran lösen alle Bedienprüfungen aus).
- Frontend-Version: `modules/version.js` (setzt `bump_version.py` mit). Das Release-ZIP legt `.js.gz` daneben.

Tests: `tests/backend/` (pytest mit echter HA-Instanz), `tests/interact.py` (Playwright gegen `tests/harness/`
mit `mock-hass.js`/`mock-alerts.js`), `tests/perf/`. CI: `.github/workflows/tests.yml` prüft immer alles.

## Tests
- Während der Entwicklung nur die betroffenen Prüfungen: `python3 tests/changed.py` (Auswahl per `git diff`
  gegen `main`; `--zeigen` zeigt nur die Auswahl). Die komplette Suite (`pytest` und `python3 tests/interact.py`)
  lokal nur bei einem Versionssprung; am Pull Request läuft sie ohnehin in der CI.
- Im Cloud-Container: System-pip scheitert, daher venv:
  `python3 -m venv /tmp/venv && /tmp/venv/bin/pip install -r tests/requirements.txt`, dann
  `PATH=/tmp/venv/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tests/changed.py`.
  Vorher `git fetch origin main && git branch -f main origin/main`, sonst wählt `changed.py` alle Gruppen.
  `BrokenPipeError` im Log ist Rauschen des Testservers.
- Neue Bedienprüfungen gehören in einen Abschnitt in `tests/interact.py` (Funktion mit `@gruppe("…")`,
  beginnt mit `pg.goto(…)`, darf sich nicht auf Variablen anderer Abschnitte verlassen). Neue Gruppe oder neues
  Frontend-Modul mit eigener Gruppe: in `GRUPPEN_FUER` in `tests/changed.py` eintragen.
