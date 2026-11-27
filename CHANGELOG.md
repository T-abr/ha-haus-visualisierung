# Changelog – Haus Visualisierung

Versionen nach Semantic Versioning. Einzige Quelle der Versionsnummer ist `manifest.json`.

## Unveröffentlicht

## 1.23.1 – 2026-11-27

### Geändert
- **Seite „Kalender“ ist jetzt eine Monatsansicht.** Wochenansicht, Handy-Liste und Umschalter Woche/Monat entfallen. Das Raster zeigt nur die Wochen des Monats (4–6 statt immer 6) und füllt die Bildschirmhöhe. Mehrtägige Termine laufen als durchgehender Balken über ihre Tage (bis zu drei Zeilen je Woche), dazu je Tag bis zu drei weitere Termine mit Uhrzeit, sonst „+2 weitere“. Ein Tag antippen (Start: heute) zeigt alle seine Termine mit Uhrzeit, Kalender und Ort in einer Liste neben dem Raster, auf schmalen Bildschirmen darunter; am Handy bleibt das Raster mit farbigen Punkten. ‹ › blättern monatsweise, „Heute“ springt zurück, ein Tag aus dem Vor- oder Folgemonat wechselt den Monat.

### Tests
- Abschnitt `kalender` auf die Monatsansicht umgestellt: Wochenzahl je Monat, Balken für mehrtägige Termine, „+1 weitere“, Tagesliste (neben dem Raster, am Handy darunter), Tag wählen, Monatswechsel, Handy ohne Überstand.

## 1.23.0 – 2026-11-27

### Neu
- **Seite „Kalender“ (Familienkalender):** Termine aller als „Termine“ gewählten Kalender als Woche (sieben Spalten, am Handy als Liste der Tage mit Terminen) oder als Monat (sechs Wochen, bis zu drei Termine je Tag, sonst „+2 weitere“; am Handy farbige Punkte). Blättern mit ‹ ›, „Heute“; ein Tag im Monat öffnet seine Woche, die gewählte Ansicht bleibt je Gerät gemerkt. Mehrtägige Termine stehen an jedem Tag, ganztägige farbig hinterlegt, Ort und Kalender im Tooltip; Müllabfuhr mit Tonnenfarbe und -symbol. Je Kalender lassen sich in den Einstellungen (Darstellung → Müllabfuhr und Termine) Farbe und Anzeigename wählen, etwa ein iCloud-Kalender je Familienmitglied; die Seite ist dort abschaltbar. Sie erscheint im Menü, sobald ein Kalender gezeigt wird, und frischt sich alle 5 Minuten auf (z. B. am Wandpanel). Neue Layout-Schlüssel `termine.page`, `termine.colors`, `termine.names`.
- **Apple-Kalender:** Anleitung in der README (CalDAV-Integration von Home Assistant mit `https://caldav.icloud.com` und app-spezifischem Passwort), Kurzhinweis in den Einstellungen.

### Behoben
- **Kopfzeile „Kompakt“: Symbol in Badges ohne Zahl mittig.** Stand keine Zahl daneben (z. B. alle Fenster zu), saß das Symbol 3 px zu weit links, weil das leere Zahlenfeld trotzdem Abstand bekam. Das leere Feld wird jetzt ausgeblendet.

### Verbessert
- **Lange Listen nutzen auf breiten Monitoren die Breite.** Ab 1200 px Fensterbreite läuft eine Liste mit 8 oder mehr Einträgen über die ganze Seitenbreite und verteilt sich je nach Platz auf 2 oder 3 Spalten (3 ab etwa 1200 px Listenbreite): Batterien („In Ordnung“ usw., Kompakt- und Normalansicht), Automationen, Sicherheit („Fenster & Türen“, Melder, Bewegung) und Wartung. Kurze Abschnitte bleiben nebeneinander wie bisher, Handy und Tablet unverändert.

### Tests
- Neuer Abschnitt `kalender` (Gruppe kalender): Menüpunkt, Woche mit Uhrzeit, Ort, mehrtägigen Terminen, Farben und Legende, Blättern, Monat mit „+1 weitere“, Tag öffnet Woche, Handy-Liste, nicht lesbarer Kalender, Einstellungen (Name, Farbe, Seite aus).
- Backend `test_termine.py`: Farben und Namen je Kalender werden geprüft.
- Kopfzeile: Prüfung, dass das Symbol in einem Badge ohne Zahl waagrecht und senkrecht mittig sitzt.
- Neuer Abschnitt `lange_listen_mehrspaltig` (Gruppe basis): 2 Spalten bei 1280 px, 3 bei 1440 px, einspaltig unter 1200 px, Handy ohne Überstand, Batterie-Liste über die ganze Breite.

### Performance
- Gemessen mit `tests/perf/measure.py`: Aufbau Übersicht 15–20 ms, Raumseite 13 ms, Licht 30 ms, Klima 35 ms, Energie 23 ms, Alarme 6 ms; hass-Setter Übersicht 27–38 µs, Unterseiten 0,4–20 µs; Aktualisierer auf der Übersicht 480 pro Minute, keine Neuaufbauten. Im Rahmen der Messschwankung wie 1.22.0.

## 1.22.0 – 2026-11-26

### Neu
- **Seite „Automationen“ (nur Administratoren):** listet alle Automationen von Home Assistant mit Bereich, Beschreibung und „zuletzt ausgelöst“, mit Suche und Schalter zum Aktivieren/Deaktivieren (live, auch bei Änderungen in Home Assistant). „Neue Automation“ öffnet ein Kurzformular für einfache Fälle: Name, ein Auslöser (Uhrzeit, Sonnenauf-/-untergang mit Versatz, Gerät ändert Zustand) und eine Aktion (ein-/aus-/umschalten, Szene, Benachrichtigung); gespeichert wird über die Konfigurations-API von Home Assistant, wie im Editor. „Im HA-Editor“ und „Bearbeiten“ springen in den Automationseditor von Home Assistant. Nicht-Administratoren sehen die Seite nicht, die neuen Websocket-Befehle `automations` und `automation_set` lehnen sie ab.
- **Alarm-Vollbild am Wanddisplay** (Backlog 24, braucht Firmware 0.8.0): Ein neuer Alarm (Stufe „Alarm“, weder quittiert noch stumm) füllt den Bildschirm rot mit Meldung, Raum bzw. Details und Uhrzeit („seit 14:32“), bei mehreren Alarmen „+ 2 weitere Alarme“. Am Gerät „Quittieren“ und „1 h stumm“ wie im Panel; im Protokoll steht „Display Flur“ als Benutzer. Das Display wird hell, auch nachts und aus dem Bildschirmschoner. Je Display unter Displays → „Alarm-Vollbild“ abschaltbar. Neuer Bereich `alarm` und Ziele `alarm:ok:<schlüssel>`/`alarm:stumm:<schlüssel>` im Display-Protokoll (Version bleibt 1, ältere Firmware ignoriert sie).
- **Szenen je Raum:** Auf der Raumseite stehen die Szenen des Raums als Knöpfe im Kopf, ein Tipp schaltet (ohne Rückfrage). Admins legen dort über „Szene anlegen“ bzw. „Szenen“ eigene Stimmungen wie Kino, Essen oder Putzen an: Lichter an/aus mit Helligkeit und Farbe oder Weißton, Rollos mit Position, Schalter an/aus. Der Editor übernimmt den aktuellen Zustand des Raums als Vorlage („Aktuellen Zustand übernehmen“), einzelne Geräte lassen sich abwählen, „Ausprobieren“ schaltet ohne zu speichern, ein Schalter legt die Szene in den Schnellzugriff (Favorit). Die Integration stellt jede Szene als `scene.haus_<raum>_<name>` bereit, im Bereich des Raums, mit gewähltem Symbol – damit auch als Kachel am Wanddisplay (ohne neue Firmware) und in Automationen. Vorhandene `scene.*` erscheinen wie bisher, jetzt ebenfalls als Knöpfe im Raumkopf und im Schnellzugriff mit ihrem eigenen Symbol.
- **Zeitleiste „Was war los?“ auf der Seite Sicherheit** (Backlog 22): Türen (geöffnet, mit Dauer) und Schlösser, Klingeln mit Standbild, Bewegung, Hausmodus-Wechsel und Alarme (neu, quittiert, eskaliert) als Verlauf, nach Tag gruppiert. Zeitraum Heute, 3, 7 oder 14 Tage, Filter je Art mit Anzahl; Standbilder per Tipp groß. Bewegung desselben Melders wird zu Abschnitten zusammengefasst („3× bis 15:10“), ausgeblendete Bereiche und Entitäten fehlen. Praktisch nach dem Urlaub. Türen und Bewegung kommen aus dem Recorder, Modus und Alarme aus dem Protokoll des Alarmmanagers; abgefragt wird nur beim Öffnen der Seite (neuer Befehl `haus_visualisierung/zeitleiste`).
- **Klingel-Standbilder:** Bei jedem Klingeln legt die Integration ein Bild der Klingelkamera unter `/config/haus_visualisierung/klingel` ab (mehrfaches Drücken innerhalb von 15 s = ein Bild). Bilder bleiben 7 Tage, höchstens 300; abrufbar nur angemeldet bzw. über eine signierte Adresse. Abschaltbar unter Einstellungen → Klingel → „Standbild bei jedem Klingeln merken“.

### Geändert
- **Firmware 0.8.0 liegt bei** (Alarm-Vollbild, gemeinsame Schriftstile): Flashen aus dem Browser und Update über das Netz bieten sie an.
- Erkennung von Klingel und Klingelkamera liegt jetzt in `klingel.py` und wird von Wanddisplay und Zeitleiste gemeinsam genutzt (Verhalten unverändert).

### Verbessert
- **Auf großen Monitoren nichts mehr aufklappen.** Ab 1200 px Fensterbreite (wie das Raster auf Licht und Beschattung) sind die klappbaren Bereiche immer offen und ohne Pfeil: „Weitere“ und „Batterien“ auf den Raumseiten, „Fenster & Türen“ auf der Sicherheitsseite, „In Ordnung“ auf der Batterieseite (alle im Kompakt-Modus) sowie Text und Empfehlung der Wetterwarnungen. Beim Ändern der Fenstergröße über die Schwelle baut sich die Seite passend neu auf. Handy und Tablet bleiben wie bisher; die Einstellungen bleiben auch am großen Monitor klappbar.
- **Wanddisplay schlanker** (Display-Firmware, kommt mit der nächsten Firmware-Version): Labels holen Schrift und Grau aus gemeinsamen Stilen statt je Widget, und drei Roboto-Größen entfallen (12 → 13, 14 → 15, 17 → 16 px). Texte wirken fast unverändert, die Firmware wird kleiner und das Update übers Netz schneller (Backlog 30; der Zeichenpuffer bleibt bewusst im PSRAM).

### Tests
- Neuer Abschnitt `automationen` (Gruppe automationen): Liste, Schalten, Live-Zustand, Suche, Kurzformular mit Prüfungen, HA-Editor, Nicht-Admin.
- Backend: `test_automations.py` (Liste mit Bereich und Beschreibung, Schalten, nur Automationen, nur Administratoren).
- Neuer Abschnitt `grosse_monitore_ausgeklappt` (Gruppe basis): Batterie- und Sicherheitsseite ab 1200 px ohne Aufklappen, darunter klappbar, Wechsel beim Verkleinern/Vergrößern; Wetterwarnungen ab 1200 px offen, darunter zugeklappt.
- `test_display_alarm_vollbild`: Bereich `alarm` nur für Alarme (nicht Warnungen), nur für eingeschaltete Displays, Quittieren und 1 h stumm am Display, falsche Schlüssel ändern nichts.
- Neuer Abschnitt `szenen_je_raum` (Gruppe szenen): Knöpfe im Raumkopf (Kompakt und Komfort), Editor mit Ist-Zustand, Ausprobieren, Speichern mit Favorit, Bearbeiten, Löschen, ohne Admin nur schalten.
- Backend `test_scenes.py`: Bereinigen der Szenen, Entität mit Bereich und Symbol, Dienstaufrufe je Gerät (Farbe, Weißton, Rollo mit und ohne Positionsfunktion), Umbenennen, Ausprobieren, Löschen.
- `test_display.py` lädt die Kern-Integration „homeassistant“ vor dem Ersetzen von `homeassistant.turn_off` (die neue Szenen-Plattform lädt sie sonst nach und überschreibt den Ersatz).
- Neu `tests/backend/test_zeitleiste.py`: Ereignisse aus Verlauf, Klingeln und Protokoll (Türdauer, Bewegung zusammengefasst, nur passende Protokolleinträge), Standbild ablegen, wiederverwenden, nach 7 Tagen löschen, abschaltbar, Websocket mit echtem Recorder und signierter Bildadresse.
- Neuer Abschnitt `zeitleiste` (Gruppe zeitleiste): Gruppierung nach Tag, Filter mit Anzahl, Standbild groß, Zeitraum, kein Neuaufbau bei Messwerten, ohne Recorder, Fehler, Komfort-Ansicht, Handy, Einstellung.

### Performance
- Gemessen mit `tests/perf/measure.py`: Aufbau Übersicht 18–21 ms, Raumseite 15 ms, Licht 41 ms, Klima 27 ms, Energie 22 ms (1.21.0: 37–49 ms), Alarme 11 ms; hass-Setter Übersicht 35–49 µs, Unterseiten 0,3–28 µs; Aktualisierer auf der Übersicht 480 pro Minute. Sonst im Rahmen der Messschwankung wie 1.21.0.

## 1.21.0 – 2026-11-25

### Neu
- **Mit der Solar-Visualisierung verzahnt** (falls installiert): Leere Energie-Felder (PV-Leistung, Akku-Ladestand, Hausverbrauch) füllt sie automatisch, der Hausverbrauch kommt dann aus ihrem AC-seitig berechneten Sensor (über die Entitäts-Registry, auch nach Umbenennen). Eingetragene Sensoren gehen weiter vor; der Netz-Sensor bleibt von Hand (Growatt meldet Bezug und Einspeisung getrennt). Gilt für Dach, Energie-Seite, Rückblick, Cockpit und Bildschirmschoner; die Einstellungen zeigen den automatischen Sensor als Platzhalter.
- **Energie-Seite springt direkt in die Solar-Visualisierung:** statt eines Knopfs „Solar“ gibt es Knöpfe für Übersicht, Technik, Auswertung und Steuerung, die die Ansicht eingebettet öffnen (braucht Solar Visualisierung mit Ansicht-Adressen, PR im Solar-Repo; ältere Versionen öffnen den zuletzt gewählten Reiter). Verknüpfungen mit Unterseite (z. B. `/solar-visualisierung/technik`) reichen diese generell ans eingebettete Panel weiter.

### Verbessert
- **Gewerke-Seiten nutzen breite Monitore aus.** Auf Licht und Beschattung standen die Räume einer Etage im Kompakt-Modus nur in zwei Spalten übereinander, rechts blieb Platz frei. Ab 1200 px Fensterbreite stehen die Räume jetzt im Raster nebeneinander, so viele wie passen. Räume mit mehr als vier Geräten werden zwei Spalten breit und zeigen ihre Leuchten bzw. Rollläden zweispaltig (im Komfort-Modus ebenso doppelt breit). Handy und Tablet bleiben unverändert.

### Tests
- Neuer Abschnitt `solar_verzahnt` (Gruppe energie): automatische Sensoren, Live-Wert, Sprung auf „Technik“; Energie- und Einbettungsprüfungen auf die neuen Sprungknöpfe angepasst.
- Neuer Abschnitt `breite_monitore` (Räume nebeneinander, großer Raum doppelt breit in Kompakt und Komfort, unter 1200 px unverändert).

### Performance
- Gemessen mit `tests/perf/measure.py`: Aufbau Übersicht 17–19 ms, Klima 27–29 ms, Licht 37–50 ms, Energie 37–49 ms (main zum Vergleich 27 ms, die neuen Solar-Sprungknöpfe kosten etwas), übrige 10–18 ms; hass-Setter Übersicht 21–36 µs, Unterseiten 0,5–32 µs; Aktualisierer auf der Übersicht 480 pro Minute. Sonst im Rahmen der Messschwankung wie 1.20.0.

## 1.20.1 – 2026-11-25

### Neu
- **Release-Workflow erzeugt die Versionsnummer selbst.** Beim Start über „Run workflow“ wählt man patch, minor oder major; der Workflow erhöht die Version (manifest.json, const.py, Frontend, README, CHANGELOG), committet sie auf `main`, taggt und veröffentlicht. Der Workflow läuft immer durch: Fehlt „### Performance“ oder „## Unveröffentlicht“ im CHANGELOG, gibt es nur eine Warnung. „keiner“ übernimmt wie bisher die Version aus manifest.json. Der Firmware-Build im Display-Repo zählt seine Version ebenso selbst hoch.
- **Einstellungen übersichtlicher: Abschnitte zum Auf- und Zuklappen.** Jeder Abschnitt (z. B. Strompreis, Hausmodus, Klingel) klappt mit einem Tipp auf die Überschrift auf und zu; beim ersten Öffnen sind alle zu. Welche offen sind, merkt sich jedes Gerät. Daneben „Alle aufklappen“/„Alle zuklappen“, die Sprungleiste klappt ihr Ziel automatisch auf.
- **Kurzinfo in jeder Überschrift**, damit man ohne Aufklappen sieht, was eingerichtet ist, z. B. „Preissensor automatisch“, „4 von 4 Sensoren“, „Eskalation nach 5 min · 3 Aktionen“, „aus“.
- **Markierungen am Abschnitt:** ein Punkt bei ungespeicherten Änderungen (genau am geänderten Abschnitt, auch die Reiter-Punkte folgen jetzt sofort) und ein Warnzeichen, wenn der Einrichtungs-Check dort etwas meldet (z. B. eine gelöschte Entität), mit dem Grund als Tooltip.
- **Suche über alle Einstellungen** oben auf der Seite: findet Einstellungen nach Name, Überschrift oder Erklärung (z. B. „Batterie“, „Sperrzeit“), wechselt in den richtigen Reiter, klappt den Abschnitt (und ggf. „Erweitert“) auf und hebt die Zeile hervor.

### Geändert
- **Lange Erklärtexte gekürzt:** sichtbar bleibt der erste Satz, der Rest steht hinter „Mehr …“.
- **„Darstellung“ aufgeteilt** in „Aussehen“, „Startseite und Inhalte“ sowie „Kameras und Batterien“.
- **„Erweitert“ je Abschnitt:** selten gebrauchte Zeilen sind eingeklappt, z. B. Vorzeichen umkehren und Speicher-Leistung (Energie), eigene PV-Prognose-Sensoren, Einspeisevergütung und Zeitfenster (Strompreis), Wallbox-Entitäten (nur wenn eine Wallbox erkannt wurde), Heizkurve selbst berechnen (nur mit Heizkurven-Sensor), Wetter-Entität des Wandpanels, Impuls und Schließzeit der Klingel, Sperrzeit von Push, Verzögerung bis Abwesend, Schwellen der Warnungen, Termine-Vorausschau und Ausblende-Labels.

### Tests
- Neuer Abschnitt `einstellungen_uebersicht` (Zuklappen und Merken, Alle auf/zu, Sprungleiste, Erweitert, Punkte, Warnzeichen, gekürzte Hinweise, Aufteilung, Suche). Die übrigen Prüfungen klappen in den Einstellungen vorher alles auf (`auf(pg)`, steckt auch in `stab()`).

## 1.20.0 – 2026-11-25

Mitgelieferte Firmware **0.7.0** (PIN-Tastenfeld; Update über Einstellungen → Displays bzw. die Update-Entität je Display).

### Neu
- **Bildschirmschoner einstellbar** (Einstellungen → Wandpanel & Displays → Wandpanel → „Bildschirmschoner“): Datum, Wetter mit Außentemperatur, Vorhersage morgen, PV-Leistung, Hausmodus, Müll und Termine, fertige Geräte, Beschattungshinweis und Meldungen einzeln ein- und ausschaltbar; neu wählbar ist die Innentemperatur (Haus Ø oder ein Raum). Uhrgröße groß/mittel/klein. Die Auswahl gilt auch für die Wanddisplays (dort ohne Datum und Uhrgröße, keine neue Firmware nötig).
- **Nachtzeit für „Nachts dunkler“** einstellbar (bisher fest 23–6 Uhr), auch über Mitternacht.
- **PIN am Wanddisplay eingeben.** Geschützte Aktionen (Tür öffnen im Klingel-Overlay, verriegeltes Schloss, Zuhause aus Nacht/Abwesend/Urlaub, Abwesend/Urlaub einschalten) öffnen am 4"-Display ein Tastenfeld wie im Panel, statt nur gesperrt zu sein. Bei richtiger PIN läuft die Aktion und das Display bleibt 30 s entsperrt; nach 5 Fehlversuchen ist es eine Minute gesperrt. Die Eingabe geht mit einem Einmalschlüssel verschleiert an Home Assistant, damit die PIN nicht lesbar in der Datenbank landet. Braucht Firmware 0.7.0; ältere Firmware zeigt weiter den Hinweis „mit PIN geschützt“. Neuer Bereich `pin` und Ziel `pin:<code>` im Display-Protokoll (Version bleibt 1).

### Behoben
- **Alarmmanager nach einem Neustart komplett stumm.** Nach jedem Neustart von Home Assistant reagierte der Alarmmanager auf keine Regel mehr: keine Meldung im Panel, kein Push, auch nicht bei eigenen Regeln. Der Abgleich beim Start lief in einem Hintergrund-Thread und brach dort ab (Wetter-Sensor durfte von dort nicht schreiben), danach wurde nichts mehr ausgewertet. Nur direkt nach dem Einrichten der Integration funktionierte alles, deshalb fiel es in den Tests nicht auf. Der Abgleich läuft jetzt in der Event-Loop von Home Assistant. Geprüft mit einem echten Home Assistant (Neustart, eigene Regel „Licht an“, Bewegung bei Abwesend und Urlaub).
- **Außentemperatur überall aus derselben Quelle.** Kopfzeile, Vorhersage-Karte und Wanddisplay zeigten immer den Wert der Wetter-Entität (Wetterdienst), der Bildschirmschoner den Außenfühler nur, wenn die Heizungskarte erkannt war. Jetzt gilt überall wie auf Klimaseite, im Rückblick und bei den Warnungen: Einstellung Heizung → Außentemperatur, sonst der erste Fühler mit „außen/Garten …“ im Namen, erst ohne Fühler die Wetter-Entität. Fühler im Wintergarten, Gartenhaus oder in der Gartenhütte zählen bei der automatischen Suche nicht mehr als Außenfühler.
- Wanddisplay: Der Schalter „Müll und Termine im Bildschirmschoner“ galt bisher nur am Wandpanel.

### Performance
- Gemessen mit `tests/perf/measure.py`: Aufbau Übersicht 17–23 ms, Klima 41 ms, Licht 39 ms, übrige 6–19 ms; hass-Setter Übersicht 20–37 µs, Unterseiten 0,3–22 µs; Aktualisierer auf der Übersicht 480 pro Minute. Im Rahmen der Messschwankung wie 1.19.1.
- Alarmmanager (Backend-Test): Auswertung 0,09 ms, Neuaufbau des Modells 0,96 ms bei 312 beobachteten Entitäten.

### Tests
- Bildschirmschoner: Elemente abschaltbar, Innentemperatur, Uhrgröße, Nachtzeit (auch über Mitternacht), Speichern der Auswahl; Außentemperatur vom Außenfühler statt Wetter-Entität (Panel und Wanddisplay), Wintergarten-Fühler wird übergangen.
- Integration lädt vor dem Ende des Starts (wie bei einem echten Neustart): Start-Abgleich läuft, eine eigene Regel löst danach Alarm und Push aus.
- Tastenfeld am Display: Öffnen, Abbrechen, falsche PIN mit neuem Schlüssel, Klartext wird abgelehnt, richtige PIN führt die Aktion aus und entsperrt, Sperre nach 5 Fehlversuchen.

## 1.19.1 – 2026-11-24

Mitgelieferte Firmware unverändert **0.6.1**.

### Behoben
- **Bewegungsalarm (und andere Warnungen) blieben nach einem Neustart stumm.** Der Alarmmanager baut beim Start auf, welche Melder er beobachtet. Entitäten, deren Zustand erst danach kam (z. B. Geräte über MQTT/Zigbee2MQTT, die sich nach dem Hochfahren melden) oder die anfangs keine Geräteklasse hatten, fehlten in dieser Liste, bis zufällig etwas in den Einstellungen oder im Entitäten-Register gespeichert wurde. Das Panel zeigte sie trotzdem an. Taucht eine Entität neu auf oder ändert sich ihre Geräteklasse, baut der Alarmmanager die Liste jetzt neu auf.
- **Kein Bewegungsalarm in Abwesend/Urlaub.** Wurde Abwesend oder Urlaub von Hand gesetzt, während eine Person noch als „zu Hause“ galt, setzte die Automatik den Hausmodus beim nächsten Standort-Update der Companion-App (gleicher Zustand, neue Koordinaten) sofort zurück auf Zuhause. Danach meldete der Alarmmanager Bewegung nicht mehr. Die Automatik reagiert jetzt nur noch auf echte Zustandswechsel der Personen: Zurück auf Zuhause geht es erst, wenn jemand ankommt; „alle weg → Abwesend“ bleibt wie bisher.
- **Energiefluss: „Speicher entlädt“ fehlte.** Die automatische Erkennung der Speicher-Leistung konnte einen reinen Lade- oder Entladesensor erwischen (z. B. Growatt „Battery Charge Power“, immer ≥ 0) statt des vorzeichenbehafteten Sensors. Dann zeigte der Fluss nur eine Richtung, und Gesamtverbrauch, Autarkie und Bilanz rechneten falsch. Solche Sensoren (Namen mit „charge“/„discharge“, „Laden“/„Entladen“) werden jetzt übersprungen, im Panel wie fürs Wanddisplay. Eine fest eingestellte Speicher-Leistung (Einstellungen → Energie) hat weiterhin Vorrang.

### Performance
- Gemessen mit `tests/perf/measure.py`: Aufbau Übersicht 15–18 ms, Klima 36 ms, übrige 7–29 ms; hass-Setter Übersicht rund 25 µs, Unterseiten 0,3–18 µs; Aktualisierer auf der Übersicht 480 pro Minute. Im Rahmen der Messschwankung wie 1.19.0.
- Alarmmanager (Backend-Test): Auswertung 0,09 ms, Neuaufbau des Modells 1,2 ms bei 312 beobachteten Entitäten. Der zusätzliche Neuaufbau beim Auftauchen neuer Entitäten läuft gesammelt mit der nächsten Auswertung.

### Tests
- Bewegungsmelder, die erst nach dem Start (ohne Zustand oder „nicht verfügbar“ ohne Geräteklasse) auftauchen, lösen bei Abwesend Alarm und Push aus.
- Neue Gesamtprüfung aller Warnregeln (`test_regeln.py`): Fenster/Tür (auch mit Verzögerung), Fenster offen beim Heizen, Wasser/Rauch/Sirene, Alarmanlage, Schloss, Garagentor, Batterien, nicht erreichbare Geräte, Abschalten und Hausmodus-Einschränkung sowie eigene Regeln mit allen Vergleichen, Dauer, Modus und „aus“. Jeweils Meldung, Push und Aufräumen beim Beheben.
- Hausmodus: Abwesend und Urlaub von Hand bleiben bei Standort-Updates bestehen, Bewegung löst Alarm und kritische Push-Meldung aus, eine Ankunft schaltet zurück auf Zuhause.
- Energie: Lade- und Entladesensoren vor dem eigentlichen Speicher-Sensor, Entladen muss als Fluss zum Haus erscheinen.

## 1.19.0 – 2026-11-24

Mitgelieferte Firmware unverändert **0.6.1**.

### Verbessert – Home Assistant lädt schneller
- **Panel-Code nur noch bei Bedarf**: Bisher lud jeder Browser auf jeder Seite von Home Assistant das ganze Panel (rund 680 KB in 38 Dateien), nur damit die Dashboard-Karten bekannt sind. Jetzt läuft dort nur ein kleiner Lader (`karten-loader.js`, knapp 3 KB mit Versionsdatei). Das Panel lädt Home Assistant erst beim Öffnen, den Code der Karten (`haus-raum-card`, `haus-hausschnitt-card`) erst, wenn eine davon auf einem Dashboard steht. Für bestehende Dashboards ändert sich nichts.
- **Vorgepackte Dateien im Release-ZIP**: Neben jeder JavaScript-Datei liegt eine `.js.gz`, die Home Assistant an Browser ausliefert, die gzip annehmen (rund 215 KB statt 680 KB für das Panel). Ist eine `.js` neuer als ihre `.gz` (z. B. Dateien von Hand kopiert), räumt die Integration die alte `.gz` beim Start weg.

### Verbessert – Speichern, Beschriftung, Caching
- **Nur Geändertes speichern:** Das Panel schickt beim Speichern nur noch die geänderten Einstellungen (`changes`), nicht mehr den ganzen Stand. Ein zweites Gerät mit älterem Stand überschreibt damit nichts mehr, was es selbst nicht angefasst hat. `layout` (ganzer Stand) geht weiterhin, z. B. für Import und ältere Panels.
- **Speichern klar gekennzeichnet:** Hinweis unter den Reitern; alles, was ohne die Speichern-Leiste wirkt, trägt ein gelbes Kennzeichen „wirkt sofort“ (Wandpanel-Gerät, Standard-Dashboard, Display zuordnen) bzw. „eigener Knopf“ (Code der Alarmanlage, PIN, Knöpfe heißen jetzt „Code setzen“ und „PIN setzen“). Die Leiste nennt die Reiter mit offenen Änderungen, „Verwerfen“ ist ohne Änderungen gesperrt.
- **Hausmodus-Symbole beschriftet:** Über festen Regeln, eigenen Regeln und Aktionen steht eine Legende mit den Namen der Hausmodi (am Handy gibt es keine Tooltips); die Schaltflächen tragen ihren Namen auch für Screenreader. In der Anwesenheits-Simulation stehen die Namen direkt in den Schaltflächen.
- **Frontend-Dateien werden zwischengespeichert:** Die Adresse enthält die Version, deshalb darf der Browser die Dateien jetzt lange behalten; nach einem Update lädt er automatisch die neuen.
- **Karten:** Beim Ansichtswechsel im Dashboard kamen Zeiger- und Kontextmenü-Handler bei jedem erneuten Einhängen doppelt dazu; jetzt bleibt es bei einem.

### Verbessert – Einstellungen übersichtlicher
- **Neuer Reiter „Energie“**: Energie-Sensoren, Vorhersage und PV-Prognose, Strompreis und Wallbox (bisher verteilt auf Darstellung und Technik).
- **Reiter „Wandpanel & Displays“**: Wandpanel (Tablet) und Wanddisplays stehen zusammen; „Darstellung“ enthält nur noch Aussehen, Standard-Dashboard, Müll und Termine sowie Verknüpfungen.
- **Sprungleiste** oben in jedem Reiter mit mindestens drei Abschnitten; am Handy als Auswahl „Zum Abschnitt springen …“.
- Adressen wie `einstellungen/technik` wählen den Reiter auch dann, wenn dieselbe Adresse vorher schon offen war (z. B. „Aufgaben bearbeiten“ auf der Seite Wartung).
- Einrichtungs-Check führt zu den neuen Reitern.

### Intern – Warnregeln nur noch im Backend
- Jede Warnregel stand bisher doppelt: in `alerts.py` (Push) und in `warnungen.js` (Panel). Jetzt wertet nur noch das Backend aus; Panel, Wandpanel, Kopfzeile, Aktiv-Fokus und Alarmmanager zeigen die Meldungen aus dem Alarmmanager-Abo an. Neue oder geänderte Regeln wirken damit überall gleich, und das Panel rechnet bei Zustandsänderungen weniger.
- Der Schnappschuss des Alarmmanagers bringt dafür je Meldung Symbol, Entität, Ziel im Panel und die Art des Untertitels mit (Zustand bzw. „seit …“ bildet das Panel weiterhin live) sowie die Reihenfolge der Auswertung (`active`). Ändert sich nur der Text einer Meldung, bekommen die Panels den neuen Stand, ohne dass gespeichert oder protokolliert wird.
- Kleine Unterschiede zur alten Panel-Auswertung: Meldungen erscheinen nach rund 1 s (Sammelzeit des Backends) statt sofort; fertige Geräte zeigen „seit … · Dauer · kWh · €“ wie in der Push-Nachricht.

### Performance
- Gemessen mit `tests/perf/measure.py` gegen 1.18.1 im selben Container: Weil das Panel die Warnregeln nicht mehr selbst auswertet, beobachten Unterseiten nur noch ihre eigenen Entitäten (Raum 14 statt 339, Licht 144, Alarme/Energie 0–5). Der hass-Setter dort sinkt von rund 60–90 µs auf 0,5–22 µs; Übersicht 59–62 µs (vorher 62–82 µs), Aktualisierer auf der Übersicht 480 statt 840 pro Minute.
- Aufbauzeiten unverändert im Rahmen der Messschwankung (Übersicht 23–31 ms, Klima 56–91 ms, übrige 9–66 ms; 1.18.1 im selben Lauf 10–65 ms).
- Auf jeder HA-Seite: 2 statt 38 Frontend-Dateien, rund 3 KB statt 680 KB. Panel und Karten unverändert schnell, sobald geladen.
- Bündeln und Verkleinern im Release geprüft und bewusst weggelassen: Mit gzip bleibt fast derselbe Gewinn ohne Build-Schritt, und die Module bleiben im Browser lesbar.

### Tests
- Bedienprüfung `karten`: ohne Karte lädt nur der Lader, mit Karte kommt `karten.js`, aber nicht das Panel; Karten zeigen Raum bzw. Hausschnitt und bekommen Zustandsänderungen.
- `test_frontend.py`: Lader statt Panel als zusätzliches Modul auf jeder Seite, Lader bleibt klein, veraltete `.gz` werden entfernt.

## 1.18.1 – 2026-11-24

Mitgelieferte Firmware **0.6.1** – Update im Reiter Displays über „Update auf 0.6.1“.

### Verbessert – Firmware 0.6.1
- **Diagnose-Sensoren** je Display in Home Assistant (Kategorie Diagnose, jede Minute): Speicher frei, größter freier Block, PSRAM frei, Loop-Zeit. Grundlage, um weitere Optimierungen (Schriften, Puffer) nach echten Messwerten zu entscheiden.
- Log auf INFO statt DEBUG, Touch-Rohwerte nicht mehr im normalen Build (rund 5 KB kleiner, weniger Arbeit pro Touch).
- Farben, Rahmen und Ein-/Ausblenden werden nur noch gesetzt, wenn sie sich ändern; bisher zeichnete das Display bei jedem Push alle Kacheln neu.

### Verbessert – Wanddisplay entlasten
- **Messwerte gebündelt**: Ändert sich ein Sensor (Leistung, Temperatur, Feuchte …), schickt die Integration die neuen Werte frühestens nach 10 s ans Display statt nach 1 s. Schaltzustände (Licht, Rollo, Fenster …) gehen weiterhin nach 1 s raus und nehmen dabei alle inzwischen geänderten Messwerte mit. Bei schwankenden PV- und Hausleistungen sinkt die Zahl der Pushes damit deutlich, das Display muss seltener neu zeichnen.
- Die Liste der beobachteten Entitäten wird nur noch bei jedem Neuaufbau berechnet statt bei jeder Zustandsänderung im Haus.

### Performance
- Panel unverändert (kein Frontend-Code geändert). Im Backend entfällt pro Zustandsänderung das Zusammenstellen der beobachteten Entitäten (vorher Menge aus allen Kacheln, Energie-Sensoren und Monitor-Entitäten, jetzt ein Nachschlagen); bis zu 10-mal weniger Pushes je Display bei sich ständig ändernden Messwerten.

### Tests
- `test_display.py`: Messwert wartet bis 10 s, Schaltzustand zieht den Push vor und nimmt den Messwert mit, kein doppelter Push danach.

## 1.18.0 – 2026-11-23

Mitgelieferte Firmware **0.6.0** – Update im Reiter Displays über „Update auf 0.6.0“.

### Neu – Wanddisplay: Bedienung
- **Dimmen und Rollo-Position per langem Tippen**: Ein langer Druck auf eine Kachel mit dimmbarem Licht oder einem Rollo mit Position öffnet einen Regler; beim Loslassen stellt die Integration Helligkeit (0 = aus) bzw. Position. Gilt für die Kacheln auf Start und auf eigenen Seiten.
- **Sofortige Rückmeldung**: Nach einem Tipp auf eine schaltbare Kachel zeigt sie gleich „…“, bis der neue Zustand da ist (höchstens 4 s).
- **Wischen** nach links bzw. rechts wechselt zur nächsten bzw. vorigen Seite im Dock; ausgeblendete Seiten werden übersprungen.
- **Verbindungsanzeige**: Ist Home Assistant nicht erreichbar, steht oben „Offline“, statt still veraltete Werte zu zeigen.
- Backlog: Wecken über Bewegungsmelder, Popups, Raumbezug und Wetter-/PV-Seite fürs Display (Nr. 26–29).

### Performance
- Panel unverändert gegenüber 1.17.0 (kein Frontend-Code geändert). Im Backend bekommen Entitäts-Kacheln drei kleine Felder; gerechnet wird nur, wenn sich Kacheln ohnehin ändern. Auf dem Display schickt der Regler nur beim Loslassen, nicht bei jedem Zwischenwert.

### Tests
- `test_display.py`: Felder `a`/`w`/`wa` (dimmbares Licht, Licht nur an/aus, Rollo mit Position, Sensor, eigene Seite), `wert:`-Tipps (Helligkeit, aus, Position begrenzt auf 100, ungültige Ziele).

## 1.17.0 – 2026-11-23

### Neu – Wetterwarnungen
- **Unwetter vom Deutschen Wetterdienst**: Warnungen der Integration „DWD Weather Warnings“ (automatisch erkannt) als Meldung im Alarmmanager, in der Kopfzeile, im Bildschirmschoner, am Wanddisplay und per Push – ab einstellbarer Warnstufe (Standard: markant), Vorabinformationen und spätere Warnungen als Hinweis. Auf der Seite Beschattung stehen sie über der Vorhersage, aufklappbar mit Text und Empfehlung des DWD.
- **„Regen kommt“ bzw. „Es regnet“ bei offenen Fenstern und Türen** (Innenräume, ohne Garagentore): aus Regensensor, Wetterlage, DWD-Gewitter/Starkregen oder der stündlichen Vorhersage (Niederschlag, Regenwahrscheinlichkeit) der nächsten Stunde.
- **„Sturm · Markise ausgefahren“**: bei DWD-Warnung vor Wind oder Gewitter bzw. Böen über der Grenze (Standard 50 km/h), jetzt oder laut Vorhersage. Markisen automatisch (device_class `awning` oder Name).
- Neue feste Regel „Wetter“ (Hausmodi wählbar), Einstellungen unter Technik → Wetterwarnungen, neuer Sensor `sensor.haus_wetter` (Anzahl, Warnungen, Regen, Wind als Attribute). Geschaltet wird nichts.

### Neu – Einstellungen sichern und wiederherstellen
- Neuer Reiter **„Prüfen & Sichern“** in den Einstellungen. Sicherungen entstehen **automatisch beim ersten Start einer neuen Version**, vor dem ersten Speichern eines Tages und vor jedem Wiederherstellen, dazu „Jetzt sichern“; behalten werden die letzten 12.
- Jede Sicherung lässt sich wiederherstellen (mit Rückfrage; der jetzige Stand wird vorher gesichert) und als JSON-Datei herunterladen; „Datei einspielen …“ übernimmt eine Sicherung, z. B. von einer anderen Installation. Enthalten: alle Einstellungen und der Stand des Wartungsplaners, nicht der Code der Alarmanlage, nicht die PIN, keine Protokolle.

### Neu – Einrichtungs-Check
- Im selben Reiter: was fehlt oder nicht mehr passt, mit Knopf zum passenden Reiter – gelöschte oder nicht erreichbare Entitäten in den Einstellungen (mit Fundstelle), Räume ohne Temperaturfühler, Bereiche ohne Etage, Rollos ohne Ausrichtung, fehlender Standort, keine Wetter-Entität bzw. keine stündliche Vorhersage, keine DWD-Warnungen, kein Kalender gewählt, kein Handy für Push oder verschwundene Empfänger, Kopplung ohne Alarmanlage, Abwesend-Automatik ohne Personen, Displays ohne Gerät, keine PIN trotz Wanddisplays. Wichtige Punkte zählt eine Zahl am Reiter.

### Neu – PIN für heikle Aktionen
- Unter Alarme → „PIN für heikle Aktionen“: 4–8 Ziffern, gespeichert nur als Prüfsumme in Home Assistant. Abfragen lassen sich für **Tür öffnen** (Klingelfenster, Schlösser entriegeln), **Alarm aus** (aus Nacht/Abwesend/Urlaub zurück auf Zuhause) und **Abwesend/Urlaub einschalten** wählen; Nacht fragt nie nach.
- Gilt für Wandpanels und Wanddisplays oder für alle Geräte. Am Wandpanel erscheint ein Tastenfeld (auch per Tastatur), danach bleibt es 30 s entsperrt; nach fünf Fehlversuchen ist die Eingabe eine Minute gesperrt. **Wanddisplays** haben kein Tastenfeld: geschützte Aktionen sind dort gesperrt, das Display zeigt kurz „mit PIN geschützt“ (keine neue Firmware nötig).

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 6–21,7 ms je Seite (Übersicht 12,4–14 ms), 0 Neuaufbauten, hass-Setter Ø 23–29 µs – im Rahmen von 1.16.0. Die Wettermeldungen liest das Panel fertig aus `sensor.haus_wetter`; der Einrichtungs-Check läuft nur in den Einstellungen. Im Backend holt die Wetterauswertung die stündliche Vorhersage höchstens alle 15 Minuten.

### Backlog
- Neue Ideen 22–25: Zeitleiste „Was war los?“, Szenen je Raum, Alarm-Vollbild am Display, Relais als Lichtschalter.

### Tests
- Neu: `test_backup.py`, `test_pin.py`, `test_weather.py` (DWD, Regen, Sturm, Regensensor, Vorabinformation).
- Neue Bedienprüfungen „system“ (Check, Sicherungen, Export/Import), „pin“ (Tastenfeld, Abbrechen, Türöffner) und „wetterwarnung“ (Wetterkarte, Meldungen, Einstellungen).

## 1.16.1 – 2026-11-23

### Behoben – Wanddisplay: Klingel
- Das Wanddisplay reagierte nicht auf echtes Klingeln, nur auf „Klingel testen“: Nach einem Neustart von Home Assistant steht die Klingel-Entität (z. B. UniFi Protect) auf „unbekannt“, bis zum ersten Klingeln, und dieser Wechsel wurde verworfen. Jetzt zählt jedes frische Klingel-Ereignis (höchstens 60 s alt); eine Entität, die nach einem Verbindungsabbruch mit altem Zeitstempel zurückkommt, löst weiterhin nichts aus.

### Performance
- Unverändert gegenüber 1.16.0: nur die Prüfung im Backend bei Zustandsänderungen der Klingel-Entität, das Panel ist nicht betroffen.

### Tests
- `test_display.py`: erstes Klingeln nach dem Neustart (unbekannt → Ereignis), Entität nach Verbindungsabbruch wieder da (kein Klingeln).

## 1.16.0 – 2026-11-23

Mitgelieferte Firmware **0.5.0** – Update im Reiter Displays über „Update auf 0.5.0“.

### Neu – Wanddisplay: Klingel
- Klingelt es, zeigt das Wanddisplay das **Klingel-Overlay wie das Wandpanel**: Kamerabild (Standbild, alle paar Sekunden neu), Kamera und Uhrzeit, „Es klingelt erneut“, optional **„Tür öffnen“** (zweimal tippen; Türöffner aus Einstellungen → Klingel, Schalter mit Impuls) und automatisches Schließen. Das Display wacht dabei auf, auch aus dem Bildschirmschoner.
- Je Display unter Einstellungen → Displays → „Klingel“ abschaltbar; Knopf **„Klingel testen“** schickt das Overlay an die Displays.
- Braucht Firmware 0.5.0 (Bereich `klingel`, Ziel `klingel:tuer`, kein neues Protokoll); ältere Firmware ignoriert es.

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 8,5–41,6 ms je Seite (Übersicht 15,5–23 ms), 0 Neuaufbauten, hass-Setter Ø 18–40 µs – Panel-Code bis auf den Reiter „Displays“ unverändert, Schwankung im Container. Im Backend wird die Klingel-Entität einmal je Aktualisierung gesucht, nicht bei jeder Zustandsänderung; das Kamerabild verkleinert Home Assistant, das Display lädt es nur, solange das Overlay offen ist.

### Tests
- `test_display.py`: Klingel (Erkennung, Kamera am selben Gerät, Overlay, „erneut“, Tür öffnen mit Impuls, Schließen, Test).
- Bedienprüfung „displays“: Klingel je Display abschaltbar, „Klingel testen“.
- Testdaten: Bad-Feuchte mit festem Duschpeak im Verlauf, damit „Rot über der Grenze“ nicht von der Tageszeit abhängt (scheiterte nachmittags auch auf main).

## 1.15.0 – 2026-11-23

Mitgelieferte Firmware **0.4.0** – Update im Reiter Displays über „Update auf 0.4.0“ (ab 0.3.0 über das Netz).
Enthält auch alle Änderungen aus 1.14.0 (Standard-Dashboard, Firmware-Updates über das Netz), die nicht einzeln veröffentlicht wurden.

### Neu – Wanddisplay: Bildschirmschoner und farbige Werte
- **Bildschirmschoner** wie am Wandpanel, je Display unter Einstellungen → Displays einschaltbar (Wartezeit, Helligkeit): große Uhr, Datum, Wetter, PV, morgen, Hausmodus, Müll und Termine, fertige Geräte, Meldungen. Tippen weckt, ein Alarm auch; das Display springt dabei auf Start.
- **Farbige Werte** in den Kacheln wie im Panel: „Haus **612 W** · Netz **−2,4 kW**“ (blau/violett), Autarkie hervorgehoben, Luftfeuchte gedimmt, „lüften“ blau.

### Neu – Wanddisplay: eigene Seiten
- **Einstellungen → Displays → „Eigene Seiten“**: je Display bis zu drei Seiten mit Name und Symbol, auf jeder bis zu sechs Entitäten (Licht, Schalter, Szenen, Skripte, Sensoren …) mit eigenem Namen, Symbol und Reihenfolge. Die Seiten erscheinen im Dock nach den festen Seiten; ein Tipp auf eine Kachel schaltet bzw. löst aus, Sensoren zeigen ihren Wert. Wirkt nach dem Speichern sofort.
- Symbole nur aus dem Vorrat der Firmware (jetzt 120, u. a. Lampen, Rollos, Steckdosen, Klima, Medien); Entitäts-Symbole, die das Display nicht kennt, ersetzt die Integration durch eines passend zur Domäne statt „?“.
- Braucht Firmware 0.4.0 (Bereich `eigene`, Ziel `eigen:<seite>:<kachel>`, kein neues Protokoll); ältere Firmware ignoriert die Seiten.

### Behoben – Wanddisplay
- Wetter zeigt bei leichtem Frost „0°“ statt „-0°“.
- Hintergrund mit dem Verlauf der Visualisierung (vorher einfarbig), auf 16 Bit gerastert gegen Streifen.
- Hintergrundlicht dimmt mit 25 kHz statt 150 Hz: kein Surren oder Fiepen mehr.
- **Kacheln lassen sich bedienen**: Ein Tipp auf eine Entitäts-Kachel schaltet jetzt (Licht, Schalter, Lüfter, Abdeckung, Schloss, Klima, Mediaplayer umschalten; Szene, Skript, Taster auslösen). Die Firmware meldete den Tipp bisher nicht. Energie-, Klima-, Meldungs- und Geräte-Kacheln öffnen dann ihre Seite.

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 6,6–26,3 ms je Seite (Übersicht 16,6–21,4 ms), 0 Neuaufbauten, hass-Setter Ø 22–33 µs – unverändert; eigene Seiten und Schoner werden nur im Reiter „Displays“ gebaut. Im Backend gehen an die Geräte weiter nur geänderte Bereiche; der Schoner-Inhalt wird nur gerechnet, wenn er eingeschaltet ist. Auf dem Display liegt der Hintergrund als fertiges Bild im Flash (≈ 460 kB), LVGL zeichnet nur geänderte Flächen neu.

### Tests
- `test_display.py`: Tipp auf Kacheln (`kachel:N`), `tap_service`, eigene Seiten (Prüfen, Push, Tipp).
- Bedienprüfung „displays“: eigene Seite anlegen, Entitäten, Symbol, Reihenfolge, Bildschirmschoner, Speichern.
- `test_display.py`: Bildschirmschoner (Einstellungen, Inhalt), farbige Werte (`sr`/`vr`).
- Testumgebung: Preis-Statistik im Harness folgt dem festen Stundengang (nie negativ); die Prüfung „Kosten mit dem Stundenpreis“ im Rückblick hing sonst von der Uhrzeit des Testlaufs ab (PR #37).

## 1.14.0 – 2026-11-23

### Neu – Als Standard-Dashboard von Home Assistant
- **Einstellungen → Darstellung → „Beim Öffnen von Home Assistant“**: Home Assistant öffnet statt der Übersicht die Haus Visualisierung (Browser, Companion-App, Wandpanel). Wahlweise **für mich** (am Server je Benutzer, wie Profil → Dashboard), **für alle Benutzer** (nur Administratoren, wie Einstellungen → Dashboards → „Als Standard“) oder **nur dieses Gerät** (Browser-Speicher). Wirkt sofort, ohne Speichern; derselbe Knopf nimmt es zurück, eine andere Wahl wird dabei nicht überschrieben, sondern genannt. Der Abschnitt zeigt, was dieses Gerät gerade öffnet.
- Nötig, weil Profil und Dashboard-Liste von Home Assistant nur Lovelace-Dashboards und eingebaute Seiten anbieten, keine eigenen Panels. Gesetzt wird `default_panel` unter dem Schlüssel `core` (`frontend/set_user_data` bzw. `frontend/set_system_data`).
- **Grenzen**: Reihenfolge in Home Assistant ist Benutzer → alle → Gerät; „Nur dieses Gerät“ greift also nur, wenn darüber nichts festgelegt ist (für ein Wandpanel mit eigenem Benutzer besser „Für mich“ unter diesem Benutzer). Ältere Home-Assistant-Versionen ohne Speicherung am Server kennen nur „Nur dieses Gerät“. Ist die Visualisierung auf Administratoren beschränkt, sehen andere Benutzer weiter die Übersicht.

### Neu – Wanddisplays: Updates über das Netz
- Mitgelieferte Firmware **0.3.0**. Je Display gibt es eine **Update-Entität** („Firmware Haus Display“, am ESPHome-Gerät) und im Reiter Displays den Knopf **„Update auf …“**: Die Integration schickt dem Gerät Adresse und MD5 der mitgelieferten Firmware (`/haus_visualisierung_static/firmware/…`, interne Adresse von Home Assistant), das Gerät lädt sie selbst, zeigt den Fortschritt und startet neu (API-Aktion `haus_update`, Websocket `haus_visualisierung/display_update`).
- Von 0.2.x auf 0.3.0 einmalig per USB (Assistent „Firmware installieren“); die Entität und der Reiter sagen das.
- **Absicherung**: Firmware 0.3.0 verschlüsselt die API ohne eingebauten Schlüssel – Home Assistant erzeugt beim Übernehmen einen eigenen Schlüssel je Gerät. Danach kann nur Home Assistant das Display steuern und Updates anstoßen; das ESPHome-OTA ohne Passwort entfällt.

### Behoben – Wanddisplay am echten Gerät
- **Touch**: feste Kalibrierung 480 × 480 statt der Grenzen, die der GT911 meldet (manche Geräte melden z. B. 224 × 383, dann war nur ein Teil des Bildschirms bedienbar), und Spiegelung passend zum 180° gedrehten Bild. Rohwerte der Berührungen stehen im ESPHome-Log.
- Keine Scrollbalken mehr in Kacheln und Seiten, Kachelinhalt passt in die Kachel, Wetter- und Modus-Chip wie im Entwurf, einfarbiger Hintergrund ohne Streifen, aktive Seite im Dock hervorgehoben. Update: im Assistenten erneut „Firmware installieren“ oder über ESPHome.
- Hinweiszeile: ohne Meldungen und offene Punkte steht „Alles in Ordnung“ statt einer leeren Fläche unter den Kacheln.

### Performance
- Wanddisplay: unverändert gegenüber 1.13.0 (nur Backend-Text und Firmware-Dateien); das Panel baut nichts zusätzlich.

### Tests
- Wanddisplay: Hinweiszeile „Alles in Ordnung“ und Update-Entität/`display_update` in `test_display.py`; Bedienprüfung „displays_einrichten“ mit Update-Knopf und USB-Hinweis.
- Bedienprüfung „standard“ (Für mich, Für alle mit fremder Benutzerwahl, Nur dieses Gerät, alte HA-Version).

## 1.13.0 – 2026-11-23

### Neu – Wanddisplays einrichten ohne Handarbeit
- **Einstellungen → Displays → „Neues Gerät einrichten“**: Assistent in drei Schritten. **Firmware aus dem Browser flashen** (ESP Web Tools 10.4.0, mitgeliefert unter `frontend/vendor/`), **WLAN per Improv** direkt im Flash-Dialog, dann **„Übernehmen“** und **einem Display zuordnen** (oder daraus ein neues anlegen) – Zuordnen speichert sofort, die Inhalte erscheinen gleich auf dem Gerät. Nichts mehr in YAML, `secrets.yaml` oder den ESPHome-Optionen.
- Die fertige Firmware 0.2.0 (Guition ESP32-S3-4848S040) liegt der Integration bei (`firmware/`, ausgeliefert unter `/haus_visualisierung_static/firmware/<version>/`), damit das private Firmware-Repository nicht erreichbar sein muss. Sie ist für alle Displays gleich (Name mit MAC-Endung).
- **Grenzen**: Flashen aus dem Browser geht nur in **Chrome oder Edge am Computer** und nur, wenn Home Assistant über **HTTPS** geöffnet ist (Web Serial). Sonst zeigt der Assistent den Grund und bietet die Firmware zum Herunterladen an (flashen z. B. mit ESPHome Web). Steht das Gerät in einem anderen Netz (mDNS kommt nicht an), lässt es sich **per IP** hinzufügen.
- „Übernehmen“ bestätigt die ESPHome-Erkennung und setzt beim Gerät „Darf Home-Assistant-Aktionen ausführen“ (Websocket `haus_visualisierung/display_adopt`); gefundene und übernommene Geräte mit Status und Firmware-Version liefert `haus_visualisierung/display_devices`.
- **Push statt Abo**: Ein Display hat jetzt ein Gerät (`device`); die Integration schickt geänderte Bereiche über die ESPHome-Aktion `esphome.<gerät>_haus_daten` und nach `hallo` vom Gerät alles. `display_tap` nimmt auch den Gerätenamen. Firmware 0.1.x (feste Kennung) läuft unverändert weiter; Protokoll bleibt 1.

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 5,5–34,1 ms je Seite (Übersicht 13,9–19,4 ms), 0 Neuaufbauten, hass-Setter Ø 22–28 µs – unverändert, der Assistent wird nur im Reiter „Displays“ gebaut. Er fragt die Geräte nur alle 5 s ab, solange der Reiter offen ist, und ersetzt dann nur seine Geräteliste (kein Neuaufbau). ESP Web Tools (536 KB) lädt erst, wenn der Browser flashen kann. Im Backend gehen an die Geräte nur geänderte Bereiche.

### Tests
- `test_display.py`: Feld `device`, Firmware-Auslieferung (Manifest und Abbild), Geräte finden und übernehmen (Erkennung und vorhandener Eintrag), Push nur bei Änderungen, `hallo`, Tipp mit Gerätenamen, Zuordnung aufheben. Bedienprüfung „displays_einrichten“ (Assistent, ESP Web Tools geladen, Übernehmen, Zuordnen mit neuem Display, Fehler per IP, Handy).

## 1.12.0 – 2026-11-23

### Neu – Wanddisplays (ESP32-S3 mit ESPHome)
- **Einstellungen → Displays** (neuer Reiter, `displays`): bis zu sechs Wanddisplays mit Name, Seiten (Start, Energie, Klima, Haus), bis zu vier **Kacheln** auf der Startseite (PV jetzt, Energie heute, Raumklima Ø, Müll und Termine, Wetter, Meldungen, Haushaltsgeräte, Strompreis oder eine Entität), Hinweiszeile, Helligkeit Tag/Nacht und Aufwecken bei Alarm. Änderungen wirken nach dem Speichern sofort, ohne neu zu flashen.
- Je Display die Entität **`sensor.haus_display_<kennung>`**: Zustand = Protokollversion, Attribute mit fertig formatierten Inhalten (Kopf mit Wetter und Hausmodus, Kacheln, Hinweis, Energiefluss, Räume, **Gute-Nacht-Check**, Hausmodus und Meldungen). Gute-Nacht-Check, Müll/Termine (Kalender-API), Wetter (Vorhersage) und Energie heute (selbst aufsummiert, übersteht Neustarts) rechnet dafür jetzt auch das Backend.
- Dienst **`haus_visualisierung.display_tap`**: Gute-Nacht-Punkt oder alle schließen, Hausmodus setzen, Entitäts-Kachel schalten, fertige Geräte quittieren.
- Schnittstelle versioniert in `DISPLAY_PROTOKOLL.md` (Protokoll 1); Firmware im Repository **ha-haus-display**.

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 6,4–37 ms je Seite (Übersicht 16–21,7 ms), 0 Neuaufbauten, hass-Setter Ø 18–42 µs. Der Reiter „Displays“ wird nur in den Einstellungen gebaut. Im Backend rechnet der Display-Hub nur, wenn ein Display eingerichtet ist (gebündelt, höchstens einmal je Sekunde bzw. alle 30 s); Kalender alle 15 min, Wetter alle 30 min.

### Tests
- `tests/backend/test_display.py` (Einstellungen, Inhalte, Tippen, Energie heute, Entfernen) und Bedienprüfung „displays“.

## 1.11.0 – 2026-11-23

### Neu – Gute-Nacht- und Verlassen-Check
- Neue Knöpfe **„Gute Nacht“** und **„Ich gehe“** im Schnellzugriff der Übersicht (Cockpit-Spalte, Energieleiste in Aktiv-Fokus und Etagen-Spalten, damit auch auf Handy und Wandpanel). Sie öffnen ein Fenster mit allem, was vor „Nacht“ bzw. „Abwesend“ noch offen ist: **Garage und Tore**, **Fenster und Türen**, **nicht verriegelte Schlösser**, **Geräte** wie Herd, Bügeleisen oder Kaffeemaschine (Schalter mit passendem Namen) und **Licht**; beim Gehen zusätzlich **laufende Medien**.
- Jede Zeile hat ihren Knopf (Schließen, Verriegeln, Ausschalten, Aus, Pause), **„Alles schließen“** erledigt alle auf einmal; Sensoren (Fenster) öffnen per Tippen die Details. Die Liste aktualisiert sich live.
- Umgeschaltet wird **erst nach Bestätigung**: „Nacht einschalten“ bzw. „Trotzdem Nacht/abwesend“, solange noch etwas offen ist. Wird die Alarmanlage dabei scharf geschaltet, steht das im Fenster.
- Auf der **Hausmodus-Karte** im Alarmmanager erscheint der Check ebenfalls, wenn vor Nacht/Abwesend noch etwas offen ist; ist alles zu, schaltet die Karte wie bisher.
- **Einstellungen → Alarme → Gute-Nacht- und Verlassen-Check:** an/aus (`house_mode.check`, Standard an) und **weitere Geräte** (`house_mode.check_devices`, z. B. die Steckdose des Bügeleisens).

### Neu – Anwesenheits-Simulation im Urlaub
- **Einstellungen → Alarme → Anwesenheits-Simulation** (`presence_sim`, Standard aus): ausgewählte Lichter und Rollos (auch Schalter) schalten im Hausmodus **Urlaub** (wählbar, z. B. auch Abwesend) oder solange ein eigener Schalter (`input_boolean`/`switch`) an ist.
- Vorlage ist ein echter Tag aus dem **Verlauf der letzten 1–4 Wochen** (Recorder), bevorzugt derselbe Wochentag; jede Schaltzeit wird zufällig um bis zu ± 15 Minuten (einstellbar) verschoben. Helligkeit und Rollo-Position werden übernommen; beim Start wird der Zustand wie zur selben Uhrzeit am Vorlagetag hergestellt. Um Mitternacht wird der nächste Tag geplant.
- Läuft im Backend, auch ohne offenes Panel, und **endet sofort**, wenn der Modus wechselt (z. B. Rückkehr → Zuhause). Status, nächste Schaltvorgänge und Protokoll in den Einstellungen (Websocket `haus_visualisierung/presence_sim`).

### Neu – Müllabfuhr und Termine
- **„Morgen: Gelbe Tonne, Papier“** in der Kopfzeile (alle Varianten) und im **Bildschirmschoner**, am Vorabend der Abfuhr (Standard ab 17 Uhr) und am Morgen bis 10 Uhr farbig hervorgehoben, mit Farbe und Symbol der Tonne (gelb, Papier, Bio, Grünschnitt, Glas, Rest, Sperrmüll, Schadstoffe). Dazu Termine von heute und morgen („Heute 20:00 Elternabend“); der Tooltip zeigt die nächsten Tage, ein Tipp öffnet den Kalender. Am Handy erscheint nur die hervorgehobene Abfuhr als Symbol.
- Quelle sind **Kalender aus Home Assistant** (Waste Collection Schedule, Abfall-Integrationen, ICS, Google/CalDAV …) über die Kalender-API; ohne sie der nächste Termin aus der Entität. Kalender mit „Abfall“, „Müll“, „Tonne“ … im Namen zählen automatisch als Müllabfuhr.
- **Einstellungen → Darstellung → Müllabfuhr und Termine:** an/aus, Kopfzeile, Bildschirmschoner, Hervorheben ab (Uhr), Vorausschau (Tage) und je Kalender „Müllabfuhr“, „Termine“ oder „Nicht anzeigen“ (`termine`).

### Neu – Rückblick mit Vormonat und Vorjahr
- **Karte „Rückblick“** auf der Energie-Seite (unter dem Verlauf): dieser Monat gegen Vormonat und Vorjahresmonat für **PV erzeugt, Verbrauch, Netzbezug, Einspeisung, Autarkie, Stromkosten und Bilanz** sowie **Ø Außen- und Innentemperatur und Heizgradtage** (20/15). Unter den Vergleichswerten steht die Veränderung (Prozent, Prozentpunkte, € bzw. K), grün wenn besser, orange wenn schlechter.
- Im laufenden Monat werden **gleich lange Abschnitte** verglichen (1. bis heute, letzte volle Stunde); mit den Pfeilen lassen sich frühere Monate ganz vergleichen (bis drei Jahre zurück).
- **Kosten** je Stunde: Netzbezug × Stundenmittel des Preissensors (mit Aufschlag), ohne Preissensor mit dem festen Preis; Bilanz = Kosten minus Einspeisevergütung.
- **Rekorde des Jahres:** bester PV-Tag und -Monat, höchster Tagesverbrauch, wärmster und kältester Tag.
- Daten aus der Langzeitstatistik des Recorders (drei Abfragen der Stundenmittel, eine der Tagesmittel), nur beim Öffnen und Blättern; Zeiträume mit Lücken werden grau markiert.

### Neu – „Fertig“-Meldungen für Haushaltsgeräte
- **Karte „Geräte“** auf der Übersicht (Cockpit rechte Spalte, Aktiv-Fokus, Etagen-Spalten, Hausschnitt): je Gerät „läuft seit 42 min · noch ca. 58 min · 1,9 kW“, „fertig seit 12 min · Dauer 2:28 h · 1,05 kWh · 0,21 € (35 % eigener Strom)“ bzw. der letzte Durchgang mit Schnitt. „Erledigt“ quittiert.
- **Erkennung im Backend** (`appliances.py`), auch ohne offenes Panel: über die Leistung (Steckdose mit Messung; läuft ab 10 W für 1 min, fertig unter 5 W für 5 min, je Gerät einstellbar) oder einen Programmstatus (z. B. Home Connect, Miele). Durchgänge unter 5 min zählen nicht. Restzeit aus einer Entität oder geschätzt aus den letzten zehn Durchgängen.
- **Energie und Kosten je Durchgang:** Energiezähler oder aufsummierte Leistung, Preis aus den Strompreis-Einstellungen (Preissensor bzw. fester Preis); was gerade aus eigenem PV-Strom kommt, kostet nichts (Netz-Sensor der Kopfzeile).
- **Meldung „Waschmaschine fertig“** als Hinweis im Alarmmanager und per Push (mit „Quittieren“). Sie verschwindet beim Quittieren, wenn die Tür aufgeht (optional) oder das Gerät neu startet, spätestens nach 12 Stunden. Feste Regel „Haushaltsgerät fertig“ unter Alarme abschaltbar.
- **Tipp zum Starten:** „Jetzt starten: 2,9 kW PV-Überschuss“, sonst das günstige Zeitfenster eines dynamischen Tarifs oder die Solarprognose („Heute kommen noch 6,2 kWh PV: bis Mittag starten“).
- **Bildschirmschoner:** „Trockner fertig seit 10 min“ bzw. „Spülmaschine noch ca. 20 min“.
- **Einstellungen → Technik → Haushaltsgeräte:** ohne Einträge automatisch erkannt (Leistungssensoren mit Waschmaschine, Trockner, Spülmaschine im Namen); eigene Geräte mit Leistung, Status, Energiezähler, Tür, Restzeit und Grenzen.
- Neuer Sensor **`sensor.haus_geraete`** (Anzahl fertiger Geräte, Einzelheiten im Attribut `geraete`, nicht im Recorder) für eigene Automationen; Websocket-Befehl `haus_visualisierung/appliance_ack`.

### Neu – Wartungsplaner fürs Haus
- **Seite „Wartung“** (Navigation, sobald es Aufgaben gibt; Zahl = fällige): wiederkehrende Aufgaben wie Lüftungsfilter, Rauchmelder testen, Kaminkehrer, Heizungswartung, sortiert nach **Fällig**, **Demnächst** und **Später**, mit Intervall, Fälligkeit („seit 6 Tagen fällig“, „fällig in 8 Tagen · 01.12.2026“), zuletzt erledigt (mit Namen), Notiz und Fortschrittsbalken.
- **„Erledigt“** setzt das nächste Datum und darf jeder Benutzer drücken (nicht nur Administratoren); am selben Tag lässt es sich **rückgängig** machen. Der Stand liegt getrennt vom Layout in `.storage/haus_visualisierung.wartung` und geht live an alle offenen Panels; ein offener Einstellungs-Entwurf überschreibt ihn nicht.
- **Einstellungen → Technik → Wartungsplaner:** Aufgaben frei anlegen (Titel, alle n Tage/Wochen/Monate/Jahre, zuletzt erledigt, Symbol, Notiz), Vorlagen für Filter, Rauchmelder, Kaminkehrer, Heizung, Wasserfilter, Batterien und Auto/Wallbox, Vorlauf für „Demnächst“ (Standard 14 Tage). Monate und Jahre bleiben am selben Tag (31. → Monatsende).
- **Meldungen:** neue feste Regel „Wartung fällig“ (Hinweis, Standard an): fällige Aufgaben erscheinen in der Warnkarte und im Alarmmanager und kommen – wie andere Hinweise – per Push, auch ohne offenes Panel. Neuer Websocket-Befehl `haus_visualisierung/maintenance_done`.

### Geändert – Bildschirmschoner bleibt mittig
- Uhr und Infos im Bildschirmschoner stehen jetzt **standardmäßig fest in der Mitte** statt jede Minute zu wandern.
- Neue Einstellung **Einstellungen → Wandpanel → „Bildschirmschoner wandern lassen“** (`wallpanel.wander`, Standard aus) für alle, die den Einbrenn-Schutz wollen (z. B. OLED). LCDs wie im iPad brennen praktisch nicht ein.

### Tests
- Neue Gruppe `geraete` (Bedienprüfungen): Karte, Texte, PV-Tipp, Meldung, Quittieren, Handybreite, Einstellungen, Schoner. Backend `test_appliances.py`: Erkennung über Leistung mit Pausen und Netzanteil, Status und Tür, Quittieren über Alarmmanager und Websocket, Einstellungen.
- Neue Gruppe `wartung` (23 Prüfungen): Intervalle, Anlegen per Vorlage und eigener Aufgabe, Seite mit Fällig/Demnächst/Später, Zahl an der Navigation, Hinweis in den Meldungen, Erledigt und Rückgängig, Handybreite, Regel aus, Löschen. Backend `test_maintenance.py`: Intervalle, Prüfung der Einstellungen, Erledigt/Rückgängig/Datum, Meldung und Push, Stand gespeichert und bei gelöschten Aufgaben verworfen, Erledigt ohne Administratorrechte.
- Neue Gruppe `gutenacht` (Bedienprüfungen): Knöpfe, offene Punkte je Modus, einzeln und alles schließen, Bestätigen/Abbrechen/Esc, Hausmodus-Karte mit und ohne offene Punkte, eigene Geräte, Abschalten, Handybreite. Die Prüfung „Hausmodus“ geht jetzt durch den Check. Backend: `check` und `check_devices` werden geprüft.
- Anwesenheits-Simulation: Backend (Verlauf auswerten, Plan mit Versatz, Start/Ende nach Modus und Schalter, Rollo-Position, echter Recorder) und neue Gruppe `anwesenheit` der Bedienprüfungen.
- Neue Gruppe `termine` (18 Prüfungen, feste Uhrzeit): automatische Erkennung, Vorabend, Vorrang Termin/Abfuhr, Tooltip, Schoner mit Tonnenfarbe, Rückfall auf Attribute, Handy, Einstellungen speichern. Backend: Einstellungen `termine` werden geprüft.
- Neue Gruppe `rueckblick` (19 Prüfungen): Abfragen, Spalten und Zeilen, Vergleich und Farbe, Kosten mit Stundenpreis bzw. festem Preis, Rekorde, Blättern mit Speicher, keine Abfrage bei neuen Messwerten, ohne Recorder, Handybreite.
- Bedienprüfungen: Schoner standardmäßig mittig, Wandern ein-/ausschaltbar, Schalter in den Einstellungen. Die Prüfung „Schoner passt in die Breite“ hing bisher von der Minute ab (Versatz bis 6 vw) und ist jetzt stabil. Backend: `wander` wird geprüft.

### Performance
- Großes Testhaus (`tests/perf/measure.py`, alle sechs Neuerungen zusammen): Aufbau 8,2–38 ms je Seite (Übersicht 15,2–20,8 ms, Energie 23 ms), 0 Neuaufbauten, hass-Setter Ø 24–34 µs.
- Rückblick: Kennzahlen und Rekorde werden je geladenem Zeitraum gemerkt. Vorher rechnete jeder Neuaufbau der Energie-Seite die Stundenwerte von drei Monaten neu durch (Aufbau rund 90 ms statt 23 ms).

## 1.10.0 – 2026-11-23

### Neu – Vorhersage auf der Übersicht
- **Karte „Vorhersage“** auf der Startseite (Cockpit rechte Spalte, Aktiv-Fokus und Etagen-Spalten unter der Energieleiste, Hausschnitt): jetzt (Temperatur, Lage; Tipp öffnet das Wetter), fünf Tage mit Höchst-/Tiefstwert und Regen, dazu die **Solarprognose** („PV heute 18,5 kWh · noch 4,3 · morgen 24,5 kWh“) und der erwartete Ertrag je Tag, der ertragreichste Tag hervorgehoben. Liegt ein Beschattungshinweis vor, steht er unten in der Karte; ein Tipp öffnet die Seite Beschattung. Gleiches Vorhersage-Abo wie Kopfzeile und Beschattung.
- Solarprognose automatisch aus **Forecast.Solar** (mehrere Dachflächen werden addiert) oder **Solcast** (bis Tag 7); Wh/kWh/MWh werden umgerechnet.
- **Einstellungen → Darstellung → Vorhersage auf der Übersicht:** Karte an/aus, Solarprognose an/aus, eigene Sensoren für „PV-Prognose heute/morgen“.

### Tests
- Neue Gruppe `prognose` (20 Prüfungen): Karte in allen Übersichten, Forecast.Solar mit zwei Dachflächen und Wh, eingestellter Sensor, Hinweis → Beschattung, Handybreite, Abschalten. Backend: Einstellungen `forecast` werden geprüft.

### Performance
- Großes Testhaus (`tests/perf/measure.py`): Aufbau 6,2–36 ms je Seite (Übersicht 15,7–17,9 ms), 0 Neuaufbauten, hass-Setter Ø 22–34 µs. Die Karte „Vorhersage“ nutzt das vorhandene Vorhersage-Abo; die Suche nach Solarsensoren läuft nur, wenn sich die Zustände ändern, und wird gemerkt.

## 1.9.0 – 2026-11-22

### Neu – Wettervorhersage und Beschattung nach Sonne
- **Karte „Sonne & Wetter“** oben auf der Seite Beschattung: Vorhersage für fünf Tage (Lage, Höchst- und Tiefstwert, Regen), heiße Tage hervorgehoben, dazu der aktuelle Sonnenstand. Die Vorhersage kommt über das Abo `weather/subscribe_forecast` von Home Assistant (täglich, sonst stündlich zusammengefasst; ältere Wetter-Integrationen über das Attribut `forecast`).
- **Beschattungshinweise** aus Vorhersage, Sonnenstand am Standort von Home Assistant und Ausrichtung der Fenster:
  - heute, solange die Sonne auf einer Seite steht: „Sonne auf der Südseite bis 15:00 · 2 von 2 Rollos offen“, mit Knopf „Schließen“ für genau die offenen Rollos dieser Seite;
  - heute vor der Sonne: „Westrollos bis 13:00 schließen“ (eine halbe Stunde vorher);
  - für morgen: „Morgen 31 °C: Südrollos bis 08:45 schließen“ mit den Sonnenzeiten je Seite.
  Ein heißer Tag beginnt bei 26 °C (einstellbar) und gilt nur bei Sonne oder leichter Bewölkung. Ohne Ausrichtung gibt es einen allgemeinen Hinweis. Geschaltet wird nie automatisch: „Schließen“ fragt vorher nach.
- **Kopfzeile:** Das Wetter zeigt zusätzlich „morgen 31°“; liegt ein Hinweis vor, ist es dezent umrandet, und der Tooltip nennt die Vorhersage für drei Tage und die Kurzform, z. B. „Morgen 31 °C, Südrollos und Westrollos rechtzeitig schließen“. Die Kopfzeile nutzt jetzt dieselbe Wetter-Entität wie das Wandpanel.
- **Bildschirmschoner:** zusätzlich „Morgen 31° / 17°“ und die Kurzform des Hinweises.
- **Einstellungen → Technik → Beschattung:** Hinweise an/aus, Grenze für heiße Tage und die Himmelsrichtung je Rollo (acht Richtungen oder „Nicht beschatten“). „Automatisch“ liest die Richtung aus dem Namen, z. B. „Rollo Südwest“. Garagentore bleiben außen vor.

### Tests
- Neue Gruppe `wetter` der Bedienprüfungen (23 Prüfungen): Abo der Vorhersage, Karte mit fünf Tagen, Aktualisierung bei neuer Vorhersage, allgemeiner Hinweis ohne Ausrichtung, Hinweise je Seite und Reihenfolge, Kopfzeile, Hinweise zu festen Uhrzeiten (vor der Sonne, mittags, abends), „Schließen“ nur mit Rückfrage und nur für die offenen Rollos der Seite (eigene Seite mit fester Uhrzeit), Bildschirmschoner, Ausrichtung aus dem Namen und Speichern.
- Backend: `tests/backend/test_shading.py` prüft die Einstellungen (Grenze 18–40 °C, nur `cover.*` mit gültiger Richtung).
- Das Harness liefert Standort und eine Tagesvorhersage (`__api.fcSet(...)`).

### Performance
- Großes Testhaus (`tests/perf/measure.py`, alle drei Neuerungen zusammen): Aufbau 7,6–25,4 ms je Seite, 0 Neuaufbauten, hass-Setter Ø 20–39 µs. Die Vorhersage kommt per Abo (eins je Wetter-Entität, nur solange ein Panel offen ist); die Sonnenzeiten werden je Tag und Seite einmal berechnet (144 Schritte) und gemerkt, die Karte „Sonne & Wetter“ frischt sich bei Rollo-Änderungen, neuer Vorhersage und alle 30 s auf.

### Neu – Woche, Monat und Jahr in den Verläufen
- **Zeitraum umschalten:** Die Kopfkarten der Klimaseite (Temperaturen, Luftfeuchte) und der Verlauf auf der Energie-Seite haben einen Umschalter „24 h · Woche · Monat · Jahr“. Die Wahl gilt je Karte und wird im Browser gemerkt; beim Umschalten wird nur die Karte neu gezeichnet.
- **Langzeitstatistik des Recorders:** Woche und Monat kommen als Stundenmittel, das Jahr als Tagesmittel. Diese Statistik bleibt in Home Assistant dauerhaft erhalten, auch wenn der Verlauf nach 10 Tagen gelöscht wird. Sensoren ohne `state_class` haben keine Langzeitstatistik; die Karte sagt das dann.
- **Klima:** Haus Ø und Außen über 7 bzw. 30 Tage oder 12 Monate; Achse mit Wochentagen, Datum der Montage bzw. Monaten; der Zeiger zeigt Tag und Stunde bzw. das Datum; die Spanne außen gilt für den gewählten Zeitraum.
- **Energie:** Statt der Leistungskurve Balken mit Erzeugung und Verbrauch in kWh je Tag (Woche, Monat) bzw. je Monat (Jahr), darüber die Summen (erzeugt, verbraucht, bezogen, eingespeist, Autarkie, Eigenverbrauch), der beste Tag bzw. Monat der PV und der Verbrauch im Schnitt pro Tag. Der Zeiger zeigt je Balken Erzeugung, Verbrauch, Bezug und Einspeisung. Beim Jahr bleibt das Netz bei Stundenmitteln, damit Bezug und Einspeisung eines Tages nicht gegeneinander aufgehen.

### Performance
- 24 h unverändert. Woche, Monat und Jahr laden je eine Abfrage pro Karte (Energie-Jahr zwei), danach 30 Minuten aus dem Speicher; die Balken werden höchstens jede Minute neu gezeichnet.

### Neu – Strompreis und Stromkosten
- **Karte „Strompreis“ auf der Seite „Energie“:** Preis jetzt mit Einordnung (günstig, mittel, teuer), Ø heute und das günstigste Zeitfenster der nächsten Stunden (Länge einstellbar, Standard 3 h). Liefert der Preissensor Preise für später, zeigen Balken die Stundenpreise bis morgen; die laufende Stunde und das günstigste Fenster sind hervorgehoben.
- **Kosten heute:** Netzbezug in € (je 5 Minuten mit dem Preis dieser Zeit), Einspeisevergütung, was eigener Strom (PV und Speicher) gespart hat, und die Bilanz – aus demselben Verlauf wie „Heute“, ohne zusätzliche Abfrage.
- **Wallbox:** Preis jetzt, „Günstig laden“ mit dem besten Zeitfenster und was das Laden gerade kostet (nur der Anteil aus dem Netz, z. B. „75 % aus dem Netz“; bei Überschuss „Lädt gerade mit eigenem Strom“). Gilt auf der Energie-Seite und im Raum der Wallbox.
- **Preissensor automatisch erkannt:** Sensor mit Einheit „…/kWh“ oder „…/MWh“ (z. B. Tibber, Nordpool, EPEX Spot, Energi Data Service, evcc); Preise für später aus den üblichen Attributen (`raw_today`/`raw_tomorrow`, `today`/`tomorrow`, `data`, `prices`). Werte in ct oder € werden am Zustand des Sensors abgeglichen.
- **Einstellungen → Darstellung → Strompreis:** Preissensor wählen oder abschalten, Aufschlag auf den Sensorpreis (für reine Börsenpreise), fester Preis ohne Sensor (Standard 30 ct/kWh), Einspeisevergütung (Standard 8 ct/kWh) und Länge des Zeitfensters.

### Tests
- Neuer Abschnitt `strompreis` (Gruppe `energie`): erkannter Sensor, Preis und Einordnung, Balken, Kosten, Wallbox-Hinweis, Aufschlag, fester Preis, ohne Recorder, Einstellungen und Handy. Das Harness hat dafür einen Nordpool-ähnlichen Preissensor. Backend: Speichern der Einstellungen `price`.

## 1.8.1 – 2026-11-22

### Behoben
- **Zeitachse der Verläufe auf dem Handy:** Je nach Uhrzeit lag die letzte Stundenbeschriftung (z. B. „18 Uhr“) über „jetzt“. Der Platz für „jetzt“ richtet sich jetzt nach der Breite des Verlaufs in Pixeln statt nach festen 10 %; betrifft die Kopfkarten der Klimaseite, den Verlauf 24 h auf Raumseiten und die Energie-Seite. Bei geänderter Breite wird die Achse neu beschriftet.

### Tests
- Die vier Prüfungen „lange Namen – nichts überlappt“ (Klima- und Raumseite, kompakt und Komfort) schlugen nur zu bestimmten Uhrzeiten fehl (jeweils etwa 25 Minuten ab 2:25, 8:25, 14:25 und 20:25 Uhr); jetzt grün.

### Performance
- Unverändert gegenüber 1.8.0: eine zusätzliche Breitenabfrage je Verlauf und Aktualisierung (höchstens alle 15 s).

### Tests
- Bedienprüfungen in 14 Gruppen mit 30 Abschnitten aufgeteilt, die jeweils auch einzeln laufen: `python3 tests/interact.py klima energie` (Übersicht mit `--liste`). Ohne Angabe läuft wie bisher alles, so auch in der CI.
- Neu `tests/changed.py`: wählt anhand der Änderungen gegenüber `main` (auch nicht committete und neue Dateien) die passenden Gruppen aus, z. B. bei einer Änderung an `klima.js` nur Klima, Energie, Warnungen und die Handy-Prüfungen (≈ 1 min statt ≈ 3 min). Gemeinsam genutzte Module und das Harness lösen weiterhin alle Prüfungen aus.

## 1.8.0 – 2026-11-22

### Verbessert – Raum-Verläufe auf der Klimaseite besser lesbar
- **Gleiche Skalenhöhe für alle Räume:** Jede Temperaturkurve zeigt jetzt mindestens 6 °C um den eigenen Verlauf statt einer eigenen, eng gezogenen Achse. Gleiche Schwankungen sehen in jedem Raum gleich groß aus; ein Raum, der nur um 0,5° schwankt, wirkt nicht mehr wie einer mit 3°. Die Feuchte hat eine feste Skala von 30–80 % (bei Werten außerhalb erweitert).
- **Größer:** Die Kurven in der Tabelle nutzen den freien Platz (bis ca. 440 statt 190 px breit, 38 statt 28 px hoch).
- **Zeitbezug:** Die Nacht (22–6 Uhr) ist dezent schattiert, feine Striche markieren 0, 6, 12 und 18 Uhr. Ein Punkt am Linienende zeigt „jetzt“, daneben der aktuelle Wert fett und darunter die Spanne der letzten 24 h.
- **Feuchte:** Wohlfühlband 40–60 % wie in der Kopfkarte; Abschnitte über der Grenze für Schimmelrisiko werden rot gezeichnet, Punkt und Wert ebenfalls, solange der Raum darüber liegt.
- Der Zeiger beim Überfahren rechnet jetzt nur über die Kurve (vorher zählte die Beschriftung daneben mit).

### Tests
- Bedienung: 414 Prüfungen grün (3 neu): gleiche Skalenhöhe aller Raum-Verläufe (mind. 6°), Nacht, 6-Stunden-Striche, Punkt und Wert bei „jetzt“ und Breite der Kurve; bei der Feuchte feste Skala 30–80 %, Wohlfühlband und roter Abschnitt nur im Raum über der Grenze.

### Performance
- Großes Testhaus: Klimaseite Aufbau 19–35 ms (Vergleich auf demselben Rechner mit 1.7.1: 22–27 ms, Messrauschen), 0 Neuaufbauten, hass-Setter Ø 24–26 µs, Aktualisierer und DOM-Änderungen je Minute unverändert. Nacht und Zeitstriche werden höchstens alle 5 Minuten neu gezeichnet.

## 1.7.1 – 2026-11-22

### Umbau – Frontend in Module aufgeteilt
- Die bisher über 6.000 Zeilen lange `frontend/haus-visualisierung.js` ist jetzt ein kleiner Einstiegspunkt, der 23 ES-Module aus `frontend/modules/` lädt: Grundlagen, Hausmodell, HTML-Bausteine, Aktualisierer, Warnungen, Verlauf, Technik, Klima, Energie, Stile, Basisklasse, Karten und das Panel. Das Panel ist in Teile gegliedert (Klingel, Wandpanel, Alarmseite, Ansichten, Kompakt-Seiten, Einstellungen, Aktionen), die zu einer Klasse zusammengesetzt werden.
- Reiner Umbau ohne neue Funktion und ohne Build-Schritt: Home Assistant lädt die Module direkt. Der Code ist unverändert verschoben; angepasst sind nur die Zusammensetzung des Panels aus seinen Teilen, die Tabelle der Aktualisierer (wird in `bindungen.js` gefüllt, damit die Module nicht im Kreis voneinander abhängen) und relative `module_url` eingebetteter Panels, die wie bisher gegen den Einstiegspunkt aufgelöst werden.
- **Pfad mit Version:** Das Frontend liegt jetzt unter `/haus_visualisierung_static/<Version>/`. So lädt der Browser nach einem Update auch alle Module neu und mischt keine alten mit neuen Dateien.
- Die Versionsnummer des Frontends steht in `frontend/modules/version.js`; `scripts/bump_version.py` und `scripts/check_version.py` sind angepasst. Das Installations-ZIP und das Release enthalten die Module automatisch.

### Tests
- Bedienung: alle 411 Prüfungen unverändert grün. Der Test-Server liefert Einstiegspunkt und Module direkt aus der Integration.
- Backend: neu `test_frontend.py` (21 Backend-Tests): jeder Import zeigt auf eine vorhandene Datei, kein Modul ist verwaist, und Home Assistant liefert Einstiegspunkt und Module unter dem Pfad mit Version aus.

### Performance
- Großes Testhaus wie bei 1.7.0: 0 Neuaufbauten, hass-Setter Ø 23–41 µs, Aufbau der Seiten 6–25 ms (vorher 9–33 ms, Messrauschen). Aktualisierer und DOM-Änderungen je Minute gleich.
- Erstes Laden im Test ohne Browser-Cache: Panel nach ≈ 180 ms statt ≈ 140 ms sichtbar, weil 24 statt einer Datei geladen werden. Danach kein Unterschied.

## 1.7.0 – 2026-11-22

### Neu – Energie-Seite
- **Neue Seite „Energie“** in der Navigation (nach Klima), sobald PV, Netz, Hausverbrauch oder ein Speicher bekannt sind. Kompakt, Komfort und Handy.
- **Energiefluss:** PV oben, Netz links, Speicher rechts, Wallbox unten, das Haus in der Mitte. Punkte laufen in Flussrichtung, schneller bei mehr Leistung. Netz zeigt „Bezug“ oder „Einspeisung“, der Speicher Ladestand und „lädt“ oder „entlädt“. Ein Tipp öffnet die Details der Entität. Bei „Bewegung reduzieren“ ohne Animation.
- **Jetzt:** Autarkie, Eigenverbrauch, Gesamtverbrauch (mit Anteil der Wallbox), Speicher. Im Seitenkopf „Speist … ein“ bzw. „Bezieht … aus dem Netz“.
- **Heute** (seit Mitternacht, aus dem Verlauf berechnet): erzeugt, verbraucht, bezogen, eingespeist, Autarkie, Eigenverbrauch und ein Balken „eigene Energie / aus dem Netz“. Keine zusätzlichen Zähler nötig.
- **Leistung 24 h:** PV als Fläche, Verbrauch und Netz (unter null = Einspeisung) mit einer kW-Achse; Zeiger zeigt Uhrzeit und alle Werte.
- Die **Wallbox-Karte** mit Lademodus und Ziel steht auch auf der Energie-Seite, ein Knopf führt zur Solar-Verknüpfung.
- **Ein Tipp auf die Energie-Karte bzw. das Dach** öffnet jetzt die Energie-Seite (ohne Energiedaten wie bisher die erste Verknüpfung).
- **Einstellungen → Darstellung → Energie:** neu „Speicher-Leistung“ (leer = automatisch erkannt), „Vorzeichen umkehren“ für Netz und Speicher, Seite abschaltbar. Neue Einstellung `energy`.

### Tests
- Bedienung: 23 neue Prüfungen (411 Prüfungen): Navigation, Tipp auf die Energie-Karte, eine gesammelte Abfrage, Fluss mit allen Knoten und Flussrichtungen, Kennzahlen jetzt und heute, Verlauf mit Zeiger, Wallbox, Live-Werte ohne Neuaufbau und ohne Abfrage, Vorzeichen umkehren, Details per Tipp, abschaltbar, ohne Recorder, Komfort, Einstellungen, Handy 390 px ohne Überlappung. Die Prüfung „Energie-Karte öffnet Solar“ geht jetzt über die Energie-Seite.
- Backend: Einstellung `energy` wird geprüft (18 Backend-Tests).
- Testhaus: Speicher-Leistung ergänzt, Netz passend zur Bilanz (5,5 kW Bezug), Energie-Sensoren mit Statistik und Tagesgang.

### Performance
- Genau eine Recorder-Abfrage für alle Leistungen der Seite (5-Minuten-Statistik), danach fortgeschrieben; beim Blättern innerhalb von 10 Minuten keine weitere Abfrage.
- Großes Testhaus: Energie-Seite 10 ms Aufbau, 0 Neuaufbauten, hass-Setter Ø 17 µs. Ein neuer Leistungswert kostet ≈ 0,12 ms (Fluss und Kennzahlen sofort). Verlauf und Tagesbilanz werden höchstens alle 15 s neu gerechnet (≈ 0,9 ms). Fremde Sensoren lösen nichts aus.
- Übrige Seiten unverändert: 0 Neuaufbauten, hass-Setter Ø 17–32 µs.

## 1.6.0 – 2026-11-22

### Neu – Luftfeuchte und Taupunkt auf der Klimaseite
- **Kopfkarte „Luftfeuchte 24 h“** neben „Temperaturen 24 h“ (Kompakt und Komfort; am Handy untereinander): Haus-Durchschnitt der relativen Feuchte und Außenfeuchte in einem Diagramm mit %-Achse, Wohlfühlbereich 40–60 % als Band und die Grenze für Schimmelrisiko als gestrichelte Linie. Innen orange, außen blau wie bei den Temperaturen. Werte am Linienende, Zeiger mit Uhrzeit und beiden Werten.
- **Kennzahlen:** Innen Ø, feuchtester Raum (gelb ab der Schimmel-Grenze) und trockenster Raum mit Namen, Taupunkt innen (Ø der Räume), außen mit Taupunkt.
- **Lüftungshinweis** nach absoluter Feuchte (g/m³) innen und außen: „Lüften lohnt sich“ (draußen mindestens 2 g/m³ trockener), „Lüften bringt wenig“ oder „Draußen feuchter“. Außenwerte vom Außenfühler (am Namen erkannt: Außen, Garten …), sonst von der Wetter-Entität.
- **Taupunkt je Raum** in der Kompakt-Tabelle unter der Feuchte und in den Komfort-Raumkacheln.
- **Verlauf je Raum umschaltbar** zwischen Temperatur und Feuchte („Verlauf je Raum“ oben rechts, je Gerät gemerkt). Der Feuchte-Verlauf zeigt die Grenze für Schimmelrisiko statt der Soll-Temperatur.

### Neu – Warnregel „Schimmelrisiko – jetzt lüften“
- Feste Regel im Alarmmanager (Panel und Backend, also auch als Push): Raumfeuchte ab **65 %** für mindestens **30 Minuten** meldet „Schimmelrisiko · Raum“ mit Feuchte, Temperatur und Taupunkt. Kurzes Duschen oder Kochen meldet nicht.
- Entwarnung erst 3 Prozentpunkte unter der Grenze, damit die Meldung nicht flattert. Steht im Raum ein Fenster offen, wird schon gelüftet: keine Meldung.
- Ist es draußen feuchter als drinnen (Sommer, Gewitter), steht statt „jetzt lüften“ der Hinweis „draußen feuchter, besser heizen oder entfeuchten“.
- Gilt standardmäßig nur im Hausmodus Zuhause. Grenze (50–90 %) und Wartezeit (0–240 min) unter Einstellungen → Alarme; die Regel ist für Aktionen wählbar.
- Taupunkt und absolute Feuchte nach der Magnus-Formel, in Panel und Backend gleich gerechnet. Außenbereiche zählen nicht.

### Neu – Installation über HACS
- Das Repository lässt sich in HACS als benutzerdefiniertes Repository (Typ Integration) hinzufügen; Updates kommen danach per Klick.
- Workflow „Release“: Ein Tag `vX.Y.Z` baut das ZIP mit `scripts/build_zip.py` und veröffentlicht ein GitHub-Release mit dem CHANGELOG-Abschnitt. Passt der Tag nicht zu `manifest.json`, bricht er ab.
- Workflow „HACS-Prüfung“ (HACS-Action und hassfest) bei jedem PR.
- `manifest.json`: Dokumentation, Fehlermeldungen (Issues) und Codeowner zeigen auf dieses Repository.

### Tests
- Tests laufen automatisch bei jedem Pull Request und Push auf `main` (GitHub Actions): Versionsprüfung, Backend-Tests und Bedienprüfungen im Browser.
- Die Browser-Prüfungen laden die echte Frontend-Datei statt einer Kopie im Harness; `tests/harness/panel.js` ist entfernt. `tests/interact.py` meldet Fehler jetzt auch über den Rückgabewert.
- Bedienung: 31 neue Prüfungen (389 Prüfungen): Feuchte-Karte (Kurven, Kennzahlen, Taupunkt, Lüftungshinweis in beide Richtungen, Band, Grenze, Achse, Zeiger), weiterhin eine Statistik- und eine Verlaufsabfrage für die ganze Seite, Taupunkt je Raum, Umschalter Temperatur/Feuchte in Kompakt und Komfort und je Gerät gemerkt, Live-Werte ohne Neuaufbau und ohne Abfrage, Schimmelrisiko (Wartezeit, offenes Fenster, Rückfall, draußen feuchter, Übernahme vom Backend nach Neuladen), Einstellungen, Handy 390 px. Die Klimaseite steht jetzt auch in `tests/perf/measure.py`.
- Backend: 3 neue Tests (18 Backend-Tests): Formeln gegen Tabellenwerte, Wartezeit und Rückfall mit vorgerückter Uhr, offenes Fenster, draußen feuchter, Hausmodus, Grenzen der Einstellungen.
- Test-Harness: Außenfeuchte im Garten und Feuchte an der Wetter-Entität.

### Performance
- Weiterhin eine Statistik-Abfrage für die ganze Klimaseite. Feuchtefühler ohne `state_class` kommen in einer gesammelten Verlaufsabfrage dazu (vorher wurden sie dort nicht geladen). Beide Karten und alle Raum-Verläufe teilen sich die Daten, auch beim Umschalten keine weitere Abfrage.
- Großes Testhaus (24 Räume): Klimaseite 27 ms Aufbau (Kompakt, vorher 16,7 ms), 42 ms (Komfort, vorher 25 ms) durch die zweite Karte und die Taupunkte. Eine geänderte Raumfeuchte kostet ≈ 0,38 ms (Kennzahlen, Taupunkt, Warnregel), vorher ≈ 0,09 ms. Die Feuchte-Kurve wird wie die Temperatur höchstens alle 15 s neu gerechnet.
- Warnregeln im Panel: 0,09 ms je Auswertung statt 0,06 ms. Der Alarmmanager beobachtet nur die Raumfeuchte, nicht Temperatur und Außenfühler: auf der Seite Alarme 0 DOM-Änderungen bei Temperaturänderungen.
- Übrige Seiten unverändert: 0 Neuaufbauten, hass-Setter Ø 24–31 µs (1.4.0 am selben Rechner: 24–35 µs). Backend: Auswertung weiter 0,04 ms je Durchlauf.

## 1.4.0 – 2026-11-22

### Neu – Temperaturverläufe auf der Klimaseite
- **Kopfkarte „Temperaturen 24 h“** (Kompakt und Komfort): Haus-Durchschnitt aller Innenräume und Außentemperatur der letzten 24 Stunden in einem Diagramm mit einer gemeinsamen °C-Achse. Werte direkt am Linienende, Legende mit aktuellen Werten. Maus oder Finger zeigen Uhrzeit und beide Werte.
- **Kennzahlen:** Innen Ø, kühlster und wärmster Raum (mit Namen), Außen mit der Spanne der letzten 24 Stunden, Anzahl heizender Räume.
- **Verlauf je Raum:** in der Kompakt-Tabelle als neue Spalte „24 h“, in Komfort in der Raumkachel. Darin die Temperaturkurve, die Soll-Temperatur des Thermostats als gestrichelte Linie und die Tagesspanne (min–max); Zeiger zeigt den Wert zu jeder Uhrzeit.
- Farben für innen und außen auf der dunklen Fläche geprüft: Helligkeit, Kontrast und Unterscheidbarkeit bei Farbsehschwäche.
- Die Einstellung heißt jetzt „Verläufe (Raumseiten und Klima)“ und schaltet beides ab.

### Tests
- Bedienung: 14 neue Prüfungen (358 Prüfungen): eine gesammelte Abfrage, Kurven, Kennzahlen, Achse, Beschriftung am Linienende, Zeiger, Raum-Verlauf mit Soll-Linie und Spanne, Live-Werte ohne Neuaufbau und ohne Abfrage, Komfort-Kacheln, ohne Recorder, abschaltbar.
- Backend unverändert (15 Backend-Tests).

### Performance
- Genau eine Recorder-Abfrage für alle Fühler der Seite, auch Außenbereiche (5-Minuten-Statistik). Vorher wäre jeder Außenbereich einzeln geladen worden; beim Messen gefunden und behoben. Beim Blättern innerhalb von 10 Minuten keine weitere Abfrage.
- Großes Testhaus (24 Räume): Klimaseite 19,5 ms Aufbau (Kompakt), 27,4 ms (Komfort). Eine geänderte Raumtemperatur kostet ≈ 0,35 ms. Der Haus-Durchschnitt wird höchstens alle 15 s neu berechnet, die Kennzahlen sofort. Fremde Sensoren lösen nichts aus.
- Übrige Seiten unverändert: 0 Neuaufbauten, hass-Setter Ø 18–33 µs.

## 1.3.1 – 2026-11-20

### Behoben
- **„Fenster und Türen erst melden nach … Minuten“ wurde in heizenden Räumen nicht beachtet.** Heizt ein Raum gerade (z. B. Fußbodenheizung mit `hvac_action: heating`), ersetzt „Fenster offen beim Heizen“ die normale Fenstermeldung. Diese Meldung kam sofort, ohne Verzögerung, als Push und im Panel. Jetzt gilt die eingestellte Zeit für beide Meldungen. Kurzes Lüften unter der eingestellten Zeit löst keine Meldung mehr aus.

### Tests
- Backend: neuer Test „Verzögerung auch beim Heizen“ mit vorgerückter Uhr: keine Meldung nach 9 Minuten, beide Meldungen nach 11 Minuten, keine Meldung bei 5 Minuten Lüften. Er schlägt mit dem alten Code fehl (15 Backend-Tests).
- Bedienung: 2 neue Prüfungen für die Anzeige im Panel (344 Prüfungen).

### Performance
- Unverändert: Auswertung der Warnregeln 0,04 ms je Durchlauf (Backend); im Panel eine Prüfung mehr je offenem Kontakt. Verzögerte Meldungen erscheinen über den vorhandenen 30-Sekunden-Takt, ohne neuen Timer.

## 1.3.0 – 2026-11-20

### Neu – Wandpanel-Modus
- **Je Gerät einschaltbar:** Einstellungen → Darstellung → Wandpanel → „Als Wandpanel nutzen“ oder die Adresse mit `?wandpanel=1` öffnen (z. B. im Kiosk-Browser; `?wandpanel=0` schaltet aus). Gilt nur für diesen Browser und sofort, ohne Speichern. Andere Geräte bleiben normal.
- **Vollbild:** Die Seitenleiste von Home Assistant wird auf dem Wandpanel ausgeblendet und beim Ausschalten auf die vorherige Einstellung zurückgesetzt. Beim ersten Tippen geht der Browser in den Vollbildmodus. Beides ist abschaltbar.
- **Bildschirmschoner** nach 5 Minuten ohne Berührung (einstellbar, 0 = nie): große Uhr, Datum, Wetter mit Außentemperatur, PV-Leistung, Hausmodus und der Zustand der Meldungen („Alles in Ordnung“ oder die wichtigste Meldung, Alarme pulsierend).
  - Der Inhalt rückt jede Minute ein Stück weiter, damit nichts einbrennt.
  - Nachts (Hausmodus Nacht oder 23–6 Uhr) ist er dunkler. Optional wird er nach weiteren Minuten ganz schwarz (für OLED-Bildschirme).
- **Aufwecken:** Ein Tipp beendet den Schoner und löst nichts darunter aus. Die Klingel weckt immer und zeigt das Klingel-Overlay, ein neuer Alarm weckt (abschaltbar). Optional weckt ein Bewegungsmelder am Panel wie eine Berührung.
- **Rückkehr zur Startseite** nach 2 Minuten ohne Berührung (einstellbar, 0 = nie). Nicht bei ungespeicherten Einstellungen und nicht während die Klingel offen ist.
- Knopf **„Ruhe“** in der Navigation (nur auf Wandpanels) startet den Schoner sofort; „Bildschirmschoner zeigen“ in den Einstellungen zum Ausprobieren.
- Neue Einstellung `wallpanel` (Zeiten, Schalter, Wetter-Entität, Bewegungsmelder).

### Tests
- Bedienung: 26 neue Prüfungen (342 Prüfungen). Einschalten per Adresse und je Gerät gemerkt, Seitenleiste, Rückkehr nach 2 Minuten, Schoner nach 5 Minuten mit allen Inhalten, Tipp weckt ohne Auslösen und der nächste Tipp wirkt wieder, schwarz, Nacht, Wecken durch Alarm, Klingel und Bewegungsmelder, keine Rückkehr bei ungespeicherten Einstellungen, Zeiten speichern, Ruhe-Knopf, Ausschalten, Handy 390 px.
- Backend: Einstellung `wallpanel` wird geprüft (14 Backend-Tests).

### Performance
- Ohne Wandpanel kein zusätzlicher Takt und keine Listener.
- Auf dem Wandpanel ein Takt alle 5 s, nur bei sichtbarem Tab: 0,8 µs wach, 3 µs mit Schoner. Der Inhalt des Schoners wird nur einmal je Minute bzw. bei neuen Meldungen neu gefüllt (≈ 0,4 ms).
- Panel: Übersicht 13–21 ms Aufbau, 0 Neuaufbauten, hass-Setter Ø 23–33 µs. 1.2.0 direkt davor auf demselben Rechner: 26–34 µs.

## 1.2.0 – 2026-11-20

### Neu – Heizung im Heizungsraum
- **Karte „Heizung“** auf der Raumseite des Heizungsraums (Kompakt und Komfort) mit drei Feldern:
  - **Speicher:** Schichtung als Farbverlauf von oben nach unten mit den Temperaturen der Fühler, dazu Ladung in % und Durchschnitt. Die Grenzen „kalt“ und „heiß“ sind einstellbar (Standard 30 und 65 °C).
  - **Kamin:** Temperatur mit Zustand (heizt, kühlt ab, aus; ab 50 °C einstellbar), Pumpe mit Drehzahl oder an/aus und dem Hinweis „lädt den Speicher“, solange die Pumpe läuft.
  - **Heizkurve:** Kurve über −20 bis +20 °C mit Minimum, Maximum, Heizgrenze und Betriebspunkt. Dazu Außentemperatur, Soll-Vorlauf, Ist-Vorlauf als Ring und Abweichung in Farbe (grün bis 1 K, gelb unter 3 K, rot darüber), Status „Heizbetrieb“ oder „über Heizgrenze“, Kurvenparameter und Mischer mit Stellgröße und Reglerstatus. Mit Maus oder Finger liest man den Vorlauf für jede Außentemperatur ab.
- Passt zur Integration **„Heizkurve Fußbodenheizung“**: Sollwert, Kurvenpunkte (Attribut `curve`), Parameter und Mischer-Stellgröße werden automatisch erkannt. Ohne Integration rechnet das Panel die Kurve selbst, mit derselben Formel und eigenen Werten für Steilheit, Niveau, Raum, Minimum, Maximum und Heizgrenze.
- Kopfzeile der Karte: Speicherladung, Kamin (wenn er heizt) und Soll-Vorlauf. Werte und Fühler öffnen die Details.

### Neu – Wallbox in der Einfahrt
- **Karte „Wallbox“** auf der Raumseite der Einfahrt mit Ladeleistung und Zustand (lädt, angesteckt, kein Fahrzeug), Ladestand des Autos mit Ziel-Markierung und Reichweite sowie der in der Sitzung geladenen Energie.
- **Lademodus** per Knopf: Aus, Sofort, Min + PV, PV, bzw. die Optionen der Auswahl-Entität. **Ziel-Ladestand** mit − / +.
- Erkennt die Entitäten von **EVCC** und vielen Wallboxen (go-e, easee, Wattpilot, openWB, KEBA …) am Namen.

### Neu – Einstellungen → Technik
- Neuer Reiter **Technik** mit den Abschnitten Heizung und Wallbox. Er zeigt, was erkannt wurde (z. B. „Raum Heizungsraum · 3 Speicherfühler · Kamin · Heizkurve …“); jedes leere Feld nennt die automatische Zuordnung. Jede Zuordnung lässt sich von Hand setzen, auch der Raum, in dem die Karte erscheint.
- Speicherfühler per Ziehen von oben nach unten sortieren, hinzufügen, entfernen oder auf „Automatisch“ zurücksetzen. Beide Karten sind einzeln abschaltbar.

### Geändert
- Entitäten, die die Heizungs- oder Wallbox-Karte zeigt, stehen nicht noch einmal in den Blöcken bzw. Pins des Raums. Ist die Karte aus, erscheinen sie wie bisher.

### Tests
- Bedienung: 35 neue Prüfungen (316 Prüfungen). Speicher (Reihenfolge, Ladung), Kamin live ohne Neuaufbau, Heizkurve (Werte, Abweichung, Mischer, Zeiger), Formel gegen die Beispielwerte der Integration (−10 → 29,3 · 0 → 26,7 · 10 → 23,7 °C), Kurve ohne Kurvenpunkte, über Heizgrenze. Wallbox (Werte, Lademodus, Ziel +, angesteckt, kein Fahrzeug, keine Doppelung). Technik-Reiter (Erkanntes, Platzhalter, Ziehen der Fühler, Raum wählen, eigene Kurve, Automatisch, abschalten). Handy 390 px ohne Überbreite und Überlappung.
- Backend: Einstellungen `heating` und `wallbox` werden geprüft (Entitäts-IDs, Grenzen, Minimum/Maximum, unbekannte Schlüssel) (14 Backend-Tests).
- Test-Harness: Integration „Heizkurve Fußbodenheizung“ (Sollwert mit Kurvenpunkten, Mischer) und EVCC-Ladepunkt nachgebaut.

### Performance
- Panel: Übersicht 14–22 ms Aufbau, 0 Neuaufbauten; hass-Setter Ø 26–32 µs. Zum Vergleich 1.1.0 am selben Tag und Rechner: 22–32 µs. Der Unterschied zu den Zahlen von 1.1.0 liegt am Messrechner, der Setter ist unverändert.
- Heizungsraum: Aufbau 9,6 ms, Wertänderung ≈ 0,5 ms; Einfahrt: 6,6 ms, ≈ 0,26 ms (inklusive Test-Harness). Beide Karten schreiben nur neu, wenn sich einer ihrer Werte ändert. Fremde Sensoren lösen nichts aus.
- Erkennung von Heizung und Wallbox: 0,22 ms je Neuaufbau des Modells (großes Testhaus, ≈ 700 Entitäten; Modell 0,68 statt 0,56 ms). Sie läuft nur bei Änderungen an Bereichen, Geräten oder Entitäten, nicht bei Zustandsänderungen.

## 1.1.0 – 2026-11-19

### Neu – Verlauf auf Raumseiten
- **Temperatur und Luftfeuchte der letzten 24 Stunden** als Verlaufskarte auf jeder Raumseite (Kompakt und Komfort), direkt unter dem Raumkopf. Beide Linien in einer Fläche, eigene Skalen links (°C) und rechts (%), Zeitachse mit 0, 6, 12 und 18 Uhr bis „jetzt“.
- Legende mit aktuellem Wert und Tages-Spanne (min – max); Tipp auf die Legende öffnet die Details des Sensors.
- Maus über dem Verlauf bzw. Antippen am Handy zeigt Uhrzeit, Temperatur und Feuchte an dieser Stelle (am Handy verschwindet die Anzeige nach 2,5 s).
- Ausfälle (Sensor nicht erreichbar, Lücken über 1 Stunde) erscheinen als Lücke statt als gerade Linie. Ohne Recorder-Daten steht ein Hinweis statt einer leeren Fläche.
- Daten aus dem Recorder: zuerst die 5-Minuten-Statistik (Sensoren mit `state_class`), sonst der Verlauf, auf 5 Minuten verdichtet. Neue Werte schreibt die Seite selbst fort.
- Abschaltbar: Einstellungen → Darstellung → „Verlauf auf Raumseiten“ (neue Option `show_trends`, Standard an).

### Neu – Einstellungen mit Reitern und Sortieren per Ziehen
- **Reiter** Räume (Etagen & Bereiche, Favoriten) · Alarme (Hausmodus, Warnungen, Eskalation und Aktionen) · Meldungen (Push, Klingel) · Darstellung (Darstellung, Energie auf dem Dach, Verknüpfungen). Der zuletzt gewählte Reiter bleibt je Gerät; die Adresse `…/einstellungen/alarme` öffnet einen Reiter direkt.
- Ein Punkt am Reiter zeigt ungespeicherte Änderungen. Der Entwurf gilt über alle Reiter, gespeichert wird weiter gemeinsam.
- **Sortieren per Ziehen** am Griff: Etagen, Räume innerhalb ihrer Etage, Raum-Pins, Favoriten, Verknüpfungen (Reihenfolge in der Navigation) und Aktionen. Funktioniert mit Maus und Finger, die Seite scrollt am Rand mit. Pins und Favoriten zieht man am Chip selbst.
- Etagen lassen sich innerhalb ihrer Gruppe ziehen: Geschosse, Keller, Außen. Der Hausschnitt zeigt Keller und Außen immer unten. Vorher sprang ein Keller, den man über das Erdgeschoss schob, beim Neuaufbau zurück.
- Tastatur: Griff fokussieren, Pfeiltasten verschieben um eine Stelle.

### Geändert
- Die Pfeil-Knöpfe zum Verschieben von Etagen und Räumen entfallen (ersetzt durch Ziehen und Pfeiltasten).
- Auswahllisten für Entitäten werden nur im Reiter gebaut, der sie braucht (weniger DOM auf der Einstellungsseite).

### Tests
- Bedienung: 41 neue Prüfungen (281 Prüfungen). Verlauf: Statistik vs. Verlauf, Fortschreiben ohne Abfrage und ohne Neuaufbau, Speicher beim Zurückblättern, Lücke bei „nicht erreichbar“, ohne Recorder, Zeiger mit Maus und Finger, abschaltbar. Einstellungen: Reiter per Adresse und gemerkt, Ziehen von Etagen, Pins, Favoriten, Verknüpfungen und Aktionen, Pfeiltasten mit Fokus, Räume nur innerhalb ihrer Etage, Entwurf über Reiter hinweg, Markierung ungespeicherter Reiter, alle Reiter bei 390 px ohne Überbreite.
- Backend: Option `show_trends` wird geprüft und gespeichert (14 Backend-Tests).
- Test-Harness: nachgebauter Recorder (`recorder/statistics_during_period`, `history/history_during_period`).

### Performance
- Panel unverändert: Übersicht 13–14 ms Aufbau, 0 Neuaufbauten, hass-Setter Ø 18–21 µs; Raumseite mit Verlauf 7,9 ms Aufbau, Ø 22 µs; Licht 34,5 ms, Ø 33 µs; Alarme 4,6 ms (großes Testhaus).
- Verlauf: genau eine Recorder-Abfrage beim Öffnen einer Raumseite, ≈ 290 Punkte je Linie aus der 5-Minuten-Statistik. Danach keine Abfragen, auch nicht beim Blättern zwischen Räumen (Speicher 10 Min.). Eine Wertänderung samt Neuzeichnen kostet ≈ 0,5 ms (gemessen inklusive Test-Harness); fremde Sensoren lösen nichts aus.
- Einstellungen: Aufbau 7–16 ms je Reiter statt 29,5 ms für die ganze Seite; 270–1290 statt 2550 Elemente (großes Testhaus).

## 1.0.0 – 2026-11-19

**Erste stabile Version.** Keine Änderungen an Einstellungen oder Karten nötig – ein Update von 0.13.0 übernimmt alles.

### Umfang von 1.0
- Panel mit automatischem Aufbau aus Etagen, Bereichen und Geräten; Übersicht Hausschnitt, Cockpit, Etagen-Spalten, Aktiv-Fokus (automatisch nach Bildschirmgröße); Kompakt und Komfort; vier Kopfzeilen; Raum- und Sammelseiten; Einstellungen im Panel.
- Eingebettete Panels und Dashboards mit fester Navigation und Haus-Farben.
- Klingel-Overlay mit Kamera, Live-Bild und Türöffner.
- Alarmmanager mit festen und eigenen Regeln, Leitstelle, Quittieren, Stummschalten, Protokoll, Fehlalarm-Auswertung, Push-Meldungen mit Aktionsknöpfen.
- Hausmodus mit Automatik und Alarmo-Kopplung, Regeln je Modus.
- Eskalation und Aktionen (KNX, Schalter, Sirene, Durchsage, Skript).
- Entitäten `select.hausmodus`, `sensor.haus_alarme_aktiv`; Ereignisse für Automationen; Dashboard-Karten.

### Abschlussprüfung
- Rundgang über 138 Seitenaufrufe (alle Seiten in Kompakt und Komfort, alle Übersicht-Varianten mit allen Kopfzeilen, großes Testhaus) bei 1440, 1000 und 390 px: keine JavaScript-Fehler; am Handy keine Überlappungen und nichts breiter als der Bildschirm.
- Code-Prüfung des Backends (ruff: Fehler, Bugbear, Vereinfachungen, Async) ohne Befund; kleine Aufräumarbeiten (contextlib.suppress, ungenutzte Variablen und Importe, Import-Reihenfolge).
- 14 Backend-Tests, 240 Bedienprüfungen.

### Geändert
- Kennzahlen-Leiste in der Kopfzeile: am Handy läuft der rechte Rand weich aus, damit sichtbar ist, dass man wischen kann.
- README mit Funktionsübersicht.

### Performance
- Übersicht 15–21 ms Aufbau, Raumseite 10 ms, Licht 26 ms, Alarme 7 ms; 0 Neuaufbauten bei Zustandsänderungen; hass-Setter Ø 20–31 µs (großes Testhaus: 24 Räume, ≈ 700 Entitäten, alle 250 ms eine Änderung).
- Backend: Auswertung der Warnregeln 0,04 ms je Durchlauf, Neuaufbau des Modells 0,35 ms (Entwicklungsrechner; auf dem Pi etwa das 10- bis 20-Fache, also unter 10 ms).

## 0.13.0 – 2026-11-19

### Neu – Eskalation und Aktionen
- **Eskalation:** Eine Meldung der gewählten Stufen (Standard: nur Alarme) ist nach X Minuten (Standard 5) noch nicht quittiert und nicht stumm → erneute **kritische Push-Meldung** „Nicht quittiert: …“ an alle Empfänger (auch bei „Nicht stören“) und Aktionen mit Auslöser „Eskalation“. Je Meldung einmal; im Alarmmanager als „eskaliert“ gekennzeichnet, im Protokoll mit Uhrzeit; Ereignis `haus_visualisierung_alarm` mit `type: eskaliert`.
- **Aktionen** (Einstellungen → Eskalation und Aktionen), je Aktion: Auslöser „sofort bei neuer Meldung“ oder „bei Eskalation“, gilt für alle Alarme / Alarme und Warnungen / alle Meldungen / eine bestimmte feste oder eigene Regel, optional nur in bestimmten Hausmodi:
  - **KNX-Telegramm** auf eine Gruppenadresse (Dienst `knx.send`, Wert und Rücksetzwert wählbar) – z. B. Sammelalarm an die KNX-Visualisierung oder einen Binäreingang.
  - **Schalter / Licht** (z. B. KNX-Schaltaktor, Blitzleuchte, Außenbeleuchtung).
  - **Sirene**.
  - **Durchsage** über einen Lautsprecher (z. B. Sonos) mit Sprachausgabe, Lautstärke und Text mit Platzhaltern `{titel}`, `{stufe}`, `{detail}`, `{modus}` (als Ansage über laufende Musik, `announce`).
  - **Skript** mit den Variablen titel, stufe, detail, key, modus – für alles Weitere.
- **Zurücksetzen:** KNX, Schalter und Sirene werden zurückgesetzt (Rücksetzwert bzw. aus), sobald alle auslösenden Meldungen quittiert, stumm oder behoben sind (abschaltbar je Aktion).
- **Test-Knopf** je Aktion: führt sie sofort aus – auch ungespeichert – und setzt schaltende Aktionen nach 3 s zurück.
- Vorlagen: KNX-Sammelalarm, Sirene bei Eskalation, Sonos-Durchsage, Blitzleuchte bei Abwesenheit, Skript.
- Ausgeführte und fehlgeschlagene Aktionen stehen im Protokoll und im Verlauf der Meldung.

### Neu – Fehlalarm-Auswertung
- „Häufigste Meldungen“ im Protokoll zeigt je Meldung durchschnittliche Dauer, wie oft sie nach weniger als 1 Minute wieder weg war und wie oft sie quittiert wurde. „prüfen“ (möglicher Fehlalarm) bei: häufig (ab 5×), mehrfach kurz (ab 3× unter 1 Min.) oder nie quittiert (ab 4×). Verdächtige Meldungen stehen oben.

### Behoben
- (während der Entwicklung) Test-Rücksetzen lief außerhalb der Ereignisschleife – vor der Auslieferung durch die Backend-Tests gefunden.

### Tests
- Backend: KNX 1/0, Durchsage mit Lautstärke und Text, Skript mit Variablen, Bereich je Regel, Aktion nur in Hausmodus, Eskalation einmalig mit kritischer Meldung und Sirene, Zurücksetzen bei Quittieren und Stumm, Fehlalarm-Statistik, Test über Websocket mit Rücksetzen nach 3 s, ungültige Gruppenadressen (14 Backend-Tests).
- Bedienung: 12 neue Prüfungen (240 Prüfungen).

### Performance
- Panel unverändert: Übersicht 15–20 ms Aufbau, 0 Neuaufbauten, hass-Setter typisch 20–33 µs; Alarme-Seite 5,1 ms.
- Backend: Aktionen laufen nur bei neuen/beendeten Meldungen; Eskalation wird im vorhandenen 30-s-Takt über die aktiven Meldungen geprüft (wenige Einträge). Dienstaufrufe laufen als eigene Aufgaben und blockieren die Auswertung nicht.

## 0.12.0 – 2026-11-19

### Neu – Hausmodus
- **Hausmodus Zuhause, Nacht, Abwesend, Urlaub.** Umschalten im Alarmmanager (Karte „Hausmodus“ oben rechts), über die neue Entität `select.hausmodus` (Automationen, KNX-Logik, Sprachassistent) oder automatisch. Anzeige in der Kopfzeile (Tipp öffnet den Alarmmanager); am Handy nur als Symbol.
- **Automatik:** Abwesend, wenn alle Personen weg sind (mit Verzögerung, Standard 10 Min., damit kurze Wege nicht umschalten); zurück auf Zuhause, sobald jemand heimkommt (auch aus Urlaub). Optional Nacht nach Uhrzeit (Standard 23:00–06:30, nur aus Zuhause).
- **Kopplung mit der Alarmanlage (Alarmo)** in beide Richtungen, abschaltbar: je Modus wählbar, was die Anlage tut (unscharf, scharf zuhause/Nacht/abwesend/Urlaub, nicht ändern). Wird die Anlage direkt geschaltet (Alarmo-Panel, Keypad), folgt der Hausmodus. Optionaler Code wird nur im Backend gespeichert und nie an Browser geschickt. Schlägt das Schalten fehl, steht ein Hinweis im Protokoll. Umschalten auf einen Modus, der die Anlage scharf schaltet, fragt vorher nach.
- **Regeln je Modus:** jede feste und eigene Regel lässt sich auf Modi beschränken (Symbole in Einstellungen → Warnungen).
- **Neue feste Regeln:** „Bewegung erkannt, während niemand zu Hause ist“ (Alarm, Standard nur Abwesend und Urlaub) und „Alarmanlage ausgelöst“ (Alarm, z. B. Alarmo im Zustand „triggered“).
- **Neue Entität `sensor.haus_alarme_aktiv`:** Anzahl aktiver (nicht stummer) Meldungen, Attribute alarme, warnungen, hinweise, neu, stumm, meldungen – z. B. für eine KNX-Statusanzeige.
- Moduswechsel stehen im Protokoll (vorher/nachher, wer bzw. „Automatik“/„Alarmanlage“); Ereignis `haus_visualisierung_modus` (mode, previous, by, source).
- Einstellungen → neuer Abschnitt „Hausmodus“.

### Tests
- Backend: Entitäten, Websocket, Bewegung nur bei Abwesend, eigene Regel nur Nacht, feste Regel eingeschränkt, Code nur im Backend; Automatik mit Verzögerung und „kurz weg“, Alarmo scharf/unscharf, Alarmo extern → Modus folgt ohne Rückkopplung, Nacht nach Uhrzeit, Urlaub bleibt, Hausmodus aus; Alarmanlage ausgelöst (12 Backend-Tests).
- Bedienung: 18 neue Prüfungen (228 Prüfungen).

### Performance
- Hausmodus und Regeln je Modus kosten im Panel nichts Messbares: Übersicht 14–17 ms Aufbau, 0 Neuaufbauten; hass-Setter typisch 21–24 µs (einzelne Messläufe bis ~50 µs durch Schwankungen des Messrechners, je Seite unterschiedlich). Alarme-Seite 5,6 ms Aufbau.
- Backend: Personen und Alarmanlage werden über den ohnehin vorhandenen Zustands-Listener beobachtet; Nacht-Zeiten nur mit zwei Zeit-Triggern, wenn eingeschaltet.

## 0.11.0 – 2026-11-19

### Neu – Alarmmanager
- **Neue Seite „Alarme“** (Navigation, Glocke in der Kopfzeile, Kopf der Warnkarte). Layout „Leitstelle“: links die aktiven Meldungen (Alarme zuerst), in der Mitte die gewählte Meldung mit allen Aktionen, rechts „Heute“ (Zähler je Stufe), der Zustand der Alarmanlage (z. B. Alarmo) und der Verlauf des Tages. Tablet zweispaltig, Handy untereinander.
- **Ablauf je Meldung: neu → quittiert → behoben.** Quittieren heißt „gesehen“: Die Meldung bleibt sichtbar, pulsiert nicht mehr, zählt nicht mehr im Navigationszähler und wird von allen Handys entfernt.
- **Stummschalten:** 1 h, bis morgen 7 Uhr oder bis behoben. Stumme Meldungen verschwinden aus Warnkarte, Kopfzeile und Aktiv-Fokus und stehen im Alarmmanager unter „Stumm“; die Warnkarte zeigt „N stumm geschaltet“. Läuft die Zeit ab und besteht die Meldung noch, ist sie wieder offen und wird erneut gemeldet.
- **Alle quittieren** mit einem Knopf.
- **Handy:** nach rechts wischen = quittieren, nach links = 1 h stumm; Antippen öffnet die Details.
- **Protokoll** (Reiter): alle Ereignisse der letzten 1, 7 oder 30 Tage nach Tagen gruppiert (aufgetreten, quittiert von …, stumm bis …, behoben nach …), Filter nach Stufe, dazu „Häufigste Meldungen“ mit Hinweis „prüfen“ ab 5 Meldungen (möglicher Fehlalarm).
- **Push-Meldungen mit Aktionsknöpfen:** „Quittieren“ und „1 h stumm“, bei Schlössern zusätzlich „Verriegeln“. Wer quittiert, steht im Protokoll.
- Zustände und Protokoll werden gespeichert (`.storage/haus_visualisierung_alarme`, 30 Tage) und überstehen einen Neustart.
- Für Automationen: Ereignis `haus_visualisierung_alarm` bei jeder Änderung (`type`: neu, quittiert, stumm, stumm_aus, stumm_ende, behoben; dazu `key`, `level`, `title`, `status`, `user`).
- Websocket: `haus_visualisierung/alarms_subscribe`, `/alarm_action` (ack, ack_all, mute, unmute), `/alarm_log`.

### Geändert
- Kopf der Warnkarte und Einträge darin öffnen den Alarmmanager (mit der Meldung ausgewählt) statt direkt den Raum; „Raum öffnen“ bzw. „Details“ gibt es dort.
- Kopfzeilen-Glocke führt zu „Alarme“ statt „Sicherheit“.

### Tests
- Backend: Quittieren mit Benutzer, Entfernen vom Handy, Stummschaltung mit Ablauf und erneuter Meldung, stumm bis behoben, Aufheben, alle quittieren, Protokoll und Statistik, Push-Knöpfe Quittieren/Stumm/Verriegeln, Speichern, nächster Morgen (9 Backend-Tests).
- Bedienung: 28 neue Prüfungen inkl. Wischen am Handy (210 Prüfungen).

### Performance
- Seite „Alarme“: Aufbau 7,3 ms, 0 Neuaufbauten, 57 DOM-Änderungen/min (nur Zeilen, deren Inhalt sich ändert; Seite wird über eine Signatur nur bei echten Änderungen neu geschrieben), hass-Setter Ø 41 µs.
- Der Zähler an „Alarme“ beobachtet auf jeder Seite die Warnquellen (wie die Kopfzeilen-Glocke): Raumseite jetzt 336 statt 14 beobachtete Entitäten, hass-Setter Ø 21 µs (vorher 1 µs), Licht Ø 34 µs – unter der Grenze von 50 µs. Übersicht unverändert 20–21 µs, 0 Neuaufbauten.
- Backend: Zustände nur bei Änderungen gespeichert (verzögert, 2 s), Protokoll auf 1000 Einträge / 30 Tage begrenzt; Live-Abo schickt nur die letzten 60 Einträge.

## 0.10.3 – 2026-11-19

### Behoben
- **Sicherheit (und alle Kompakt-Seiten) auf dem Handy:** Bei langen Namen, z. B. von UniFi Protect, wurden die Felder breiter als der Bildschirm. Zustand und Knöpfe („Entriegelt“, „Verriegeln“, „Keine Bewegung“) waren rechts abgeschnitten. Ursache: Die Rasterspalte richtete sich nach dem längsten ungekürzten Namen. Jetzt passt jede Karte in die Breite, und Namen werden gekürzt.
- Lange Zustände („Keine Bewegung · vor 7 Min.“) stehen auf dem Handy zweizeilig und nehmen höchstens knapp die Hälfte der Zeile ein.
- Schlösser zeigen auf dem Handy den Zustand nicht doppelt: Symbol und Knopf zeigen ihn bereits, der Name hat mehr Platz.
- Erdlinie im Hausschnitt ragt auf dem Handy nicht mehr über den Rand.

### Tests
- Neue Prüfungen bei 390 px mit langen Namen für Sicherheit, Licht, Beschattung, Klima, Batterien und Raumseiten (Kompakt und Komfort): nichts breiter als der Bildschirm, nichts überlappt; Schloss-Zeile und lange Zustände (182 Prüfungen).

### Performance
- Nur CSS; Übersicht 20–33 µs hass-Setter, Raumseite 1 µs, Licht 13 µs, 0 Neuaufbauten – unverändert.

## 0.10.2 – 2026-11-19

### Behoben
- **Aktiv-Fokus auf dem Handy (iPhone):** Symbole lagen teilweise übereinander oder waren verschoben.
  - Energieleiste: Ein dehnbarer Abstandshalter schob beim Umbrechen Szenen und Schnellzugriff nach rechts. Auf dem Handy jetzt ein festes Raster mit zwei Spalten: Energiewerte 2 × 2, darunter Szenen und Schnellzugriff gleich breit; zu lange Namen werden gekürzt.
  - Untere Navigation passt immer in die Breite: Bei mehr als sechs Einträgen nur Symbole, der aktive Eintrag mit Beschriftung. Vorher liefen Einträge rechts aus dem Bild („Batt…“).
  - Personen stehen auf dem Handy nebeneinander statt überlappend.
  - Symbole haben eine feste Größe und schrumpfen nicht mehr; Raumnamen werden gekürzt, statt Hinweis-Symbole wegzuschieben; Safari vergrößert die Schrift nicht mehr automatisch.

### Tests
- Neue Handy-Prüfungen für den Aktiv-Fokus bei 390, 375 und 320 px (normales und großes Testhaus): keine überlappenden Symbole und Texte, Navigation vollständig sichtbar, Energieleiste ohne Verschiebung, Personen ohne Überlappung (166 Prüfungen).

### Performance
- Nur CSS; Aktiv-Fokus Aufbau 36,9 ms (großes Testhaus), hass-Setter Ø 26,9 µs, 0 Neuaufbauten – unverändert.

## 0.10.1 – 2026-11-18

### Geändert
- **Verknüpfte Seiten in den Farben der Haus Visualisierung statt nachgebaut.** Die Nachbildung von Dashboards aus 0.10.0 entfällt. Verknüpfte Seiten bleiben in Layout und Inhalt wie im Original und übernehmen nur das Design der Haus Visualisierung:
  - Hintergrund (Farbverlauf der Haus Visualisierung), Karten im Glas-Look (dunkles, halbdurchsichtiges Glas, 20 px Rundung, feine Linie, Weichzeichner je nach Einstellung „Glas-Effekt“), Text-, Linien-, Status- und Energiefarben, durchsichtige Kopfzeile.
  - Umgesetzt über die Designvariablen von Home Assistant (`--ha-card-background`, `--primary-text-color` …). Wirkt bei direkt eingebetteten Dashboards, bei Dashboards im Rahmen (dort mit Vorrang vor dem eigenen Design von Home Assistant) und bei eigenen Panels, soweit sie diese Variablen nutzen; der Hintergrund eigener Panels wird durchsichtig.
- Einstellungen → Verknüpfungen → Darstellung: **Haus-Farben** (Standard), **Original-Farben**, **Eigene Seite**. Werte aus 0.10.0 werden übernommen („Haus-Design“ → Haus-Farben, „Original eingebettet“ → Original-Farben).

### Performance
- Die Farben sind reine CSS-Variablen; kein zusätzlicher Abruf, kein Neuaufbau. Der Websocket-Abruf der Dashboard-Konfiguration aus 0.10.0 entfällt.
- Messung unverändert: Übersicht 26–32 µs hass-Setter, Raumseite 1 µs, Licht 7 µs, 0 Neuaufbauten.

## 0.10.0 – 2026-11-18

### Neu
- **Verknüpfte Dashboards im Haus-Design.** Verknüpfungen auf Lovelace-Dashboards (z. B. „Kamera“ → `/dashboard-import`) werden nicht mehr im Original-Look gezeigt, sondern aus der Dashboard-Konfiguration mit den Bausteinen der Haus Visualisierung neu aufgebaut:
  - Ansichten des Dashboards → Reiter (Adresse `/haus-visualisierung/dash/<dashboard>/<ansicht>`).
  - Karten mit Titel, Überschriften (Abschnitts-Ansichten), Stapel mit Titel und Abschnitte der Entitäten-Karte → eigene Gruppen; Karten ohne Titel werden zusammengefasst.
  - Geräte → Zeilen (Kompakt) bzw. Kacheln (Komfort), bedienbar wie überall; eigene Namen aus dem Dashboard bleiben.
  - Kameras (Picture-Glance, Picture-Entity, Advanced Camera Card u. ä.) → Kamerabild; Bereichskarten → Raumkachel; Badges → Wertechips; Markdown → Text (Vorlagen mit `{{ }}` werden ausgelassen).
  - Custom-Karten werden übernommen, wenn sie `entity`, `entities` oder Kameras angeben (z. B. Mushroom).
  - Was sich nicht nachbauen lässt (Karte, Verlauf, Bild, Energie …), nennt ein Hinweis unten; Knopf „Original“ zeigt das Dashboard eingebettet im Original.
  - Automatisch erzeugte Dashboards (Strategie, Standard-Übersicht ohne eigene Konfiguration) → Hinweis mit Knopf „Im Original anzeigen“.
- Einstellungen → Verknüpfungen: Statt „einbetten“ gibt es die Auswahl **Darstellung**: Haus-Design (Standard), Original eingebettet, Eigene Seite. Bisherige Einstellungen werden übernommen („einbetten“ aus → Eigene Seite). Eigene Panels wie Solar und Protect bleiben bei „Haus-Design“ eingebettet, sie haben ihr Design bereits.

### Performance
- Dashboard-Seite (Testdashboard, 10 Entitäten): Aufbau 4,3–4,8 ms, 0 Neuaufbauten bei Zustandsänderungen, hass-Setter Ø 5 µs; nur angezeigte Entitäten werden beobachtet.
- Die Dashboard-Konfiguration wird beim Öffnen einmal per Websocket geholt und zwischengespeichert; beim erneuten Öffnen wird sie im Hintergrund geprüft und nur bei Änderungen neu aufgebaut.
- Übrige Seiten unverändert (Übersicht 27–28 µs Setter, 0 Neuaufbauten).

## 0.9.1 – 2026-11-18

### Behoben
- **Navigation fehlte bei Verknüpfungen auf Dashboards** (z. B. „Kamera“ → `/dashboard-import`). Bisher ließen sich nur eigene Panels einbetten; Dashboards öffneten sich als eigene Seite. Jetzt werden auch Dashboards und andere Seiten von Home Assistant eingebettet:
  - Hat Home Assistant das Dashboard-Element schon geladen, wird es direkt eingebettet (wie ein eigenes Panel).
  - Sonst wird die Seite in einem Rahmen geladen und die Seitenleiste von Home Assistant darin ausgeblendet; die Haus-Navigation bleibt.
- **„Tür öffnen“ im Klingel-Overlay** funktionierte nur mit Schlössern (`lock.unlock`). Jetzt:
  - Schloss mit Öffnen-Funktion → `lock.open` (Falle ziehen), sonst `lock.unlock`.
  - Schalter, z. B. KNX-Türöffner → einschalten und nach einem einstellbaren Impuls (Standard 2 s, 0 = nur einschalten) wieder aus.
  - Taste → drücken; Skript/Szene → ausführen.
  - Rückmeldung „Türöffner ausgelöst“ bzw. Fehlermeldung.
- „Overlay testen“ nutzt jetzt auch noch nicht gespeicherte Angaben der Klingel-Einstellungen.
- Einstellungen → Verknüpfungen: Der Text „einbetten“ lag unter dem Löschen-Knopf.

### Performance
- Unverändert gegenüber 0.9.0 (0 Neuaufbauten, hass-Setter 24–34 µs). Ein im Rahmen eingebettetes Dashboard lädt Home Assistant ein zweites Mal im Browser (eigene Verbindung zum Pi), solange es offen ist; beim Verlassen wird der Rahmen entfernt. Direkt eingebettete Dashboards teilen sich die Verbindung.

## 0.9.0 – 2026-11-18

### Neu
- **Warnungen im Aktiv-Fokus:**
  - Die Warnkarte steht ganz oben (vor der Energieleiste) und bleibt auch mit „Alles in Ordnung“ sichtbar (dann einzeilig).
  - Räume mit einer Warnung oder einem Alarm gelten als aktiv und erscheinen unter „Jetzt aktiv“ – z. B. der Eingang bei entriegelter Haustür. Die Warnung steht im Klartext in der Aktivitätszeile; die Kachel ist orange (Warnung) bzw. rot (Alarm) umrandet.
  - Reihenfolge unter „Jetzt aktiv“: Alarm, dann Warnung, dann die übrigen aktiven Räume.
- Warnkarte zählt Stufen getrennt, z. B. „1 Alarm · 2 Warnungen“.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 17,4 ms | 340 | 720 | 600 | 0 | 33,2 µs |
| Übersicht Cockpit | 13,7 ms | 336 | 720 | 603 | 0 | 26,7 µs |
| Übersicht Aktiv-Fokus | 14,2 ms | 340 | 720 | 600 | 0 | 26,5 µs |
| Raumseite | 11,3 ms | 14 | 0 | 0 | 0 | 1,0 µs |
| Licht | 23,1 ms | 144 | 360 | 840 | 0 | 11,3 µs |

- Warnkarte, Glocke und Fokus-Kacheln teilen sich eine Auswertung je Zustandsänderung (Zwischenspeicher), statt sie mehrfach zu rechnen.

## 0.8.0 – 2026-11-18

### Neu
- **Klingel-Overlay:** Klingelt es, legt sich das Kamerabild über die gerade offene Seite der Haus Visualisierung – auch über eingebettete Panels wie Solar.
  - Klingel automatisch erkannt (Ereignis-Entität mit Klasse „doorbell“, z. B. `event.g6_entry_doorbell` von UniFi Protect); Binär-Sensoren gehen ebenfalls.
  - Kamera automatisch vom selben Gerät, die Paketkamera wird übergangen.
  - Standbild jede Sekunde; „Live“ zeigt den Stream von Home Assistant im Overlay (sonst Detaildialog).
  - „Kameras öffnen“ öffnet die Protect Visualisierung eingebettet; optional „Tür öffnen“ mit zweitem Tipp zur Bestätigung.
  - Schließt nach einstellbarer Zeit (Standard 60 s); nach „Live“ oder „Tür öffnen“ bleibt es offen. Erneutes Klingeln setzt die Zeit zurück. Esc oder ein Tipp daneben schließt.
  - Einstellungen → Klingel: an/aus, Klingel, Kamera, Schloss, Zeit, „Overlay testen“.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 13,2 ms | 340 | 720 | 600 | 0 | 29,6 µs |
| Übersicht Cockpit | 26,1 ms | 336 | 720 | 600 | 0 | 32,4 µs |
| Übersicht Aktiv-Fokus | 13,0 ms | 340 | 720 | 600 | 0 | 37,0 µs |
| Raumseite | 6,9 ms | 14 | 0 | 0 | 0 | 1,1 µs |
| Licht | 40,9 ms | 144 | 360 | 840 | 0 | 7,7 µs |

- Die Klingel-Erkennung kostet je Zustandsänderung einen Vergleich; die Klingel-Entität wird nur bei Registeränderungen neu gesucht.
- Standbilder und Live-Stream laufen nur, solange das Overlay offen ist (Standbild pausiert bei verstecktem Tab). Die Aufbauzeiten schwanken zwischen Messläufen (Cockpit 13–26 ms, Licht 23–41 ms); 0 Neuaufbauten und alle Setter-Werte unter 50 µs.

## 0.7.0 – 2026-11-18

### Neu
- **Push-Benachrichtigungen für Warnungen, Alarme und Hinweise.** Home Assistant wertet die Warnregeln jetzt auch im Hintergrund aus (`alerts.py`, gleiche Regeln wie im Panel) und schickt neue Meldungen über die Companion-App – auch wenn kein Panel offen ist.
  - Empfänger: alle Handys mit der Companion-App (`notify.mobile_app_*`) oder eine Auswahl.
  - Stufen einzeln an/aus; Alarme als kritische Meldung (iOS `interruption-level: critical` mit Ton, Android Kanal `alarm_stream`), Warnungen „time-sensitive“, Hinweise leise.
  - Behobene Warnungen: Meldung vom Handy entfernen (Standard), Entwarnung senden oder nichts tun.
  - Sperrzeit gegen Dauermeldungen (Standard 10 min, Alarme immer), Meldungen werden 1 s gesammelt.
  - Nach einem Neustart werden bestehende Warnungen still übernommen; Alarme kommen trotzdem.
  - Tipp auf die Meldung öffnet die passende Seite der Haus Visualisierung.
  - Optional zusätzlich als Benachrichtigung in Home Assistant (Glocke in der Seitenleiste).
  - Testmeldung aus den Einstellungen; Anzeige der im Hintergrund aktiven Warnungen.
- **Abfrage im Schnellzugriff:** „Alle Lichter aus“, „Rollos auf/zu“ und Szenen im Schnellzugriff (Cockpit, Energieleiste) fragen vorher nach („Alle Lichter ausschalten? 6 Lichter sind gerade an.“). Esc bricht ab, Enter bestätigt. Sind alle Lichter schon aus, kommt nur ein Hinweis. Abschaltbar unter Einstellungen → Darstellung → „Schnellzugriff bestätigen“.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`, `tests/backend/test_push_perf.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 12,7 ms | 340 | 720 | 600 | 0 | 27,2 µs |
| Übersicht Cockpit | 13,1 ms | 336 | 720 | 603 | 0 | 30,9 µs |
| Übersicht Aktiv-Fokus | 13,3 ms | 340 | 720 | 600 | 0 | 27,4 µs |
| Raumseite | 7,5 ms | 14 | 0 | 0 | 0 | 1,0 µs |
| Licht | 22,9 ms | 144 | 360 | 840 | 0 | 7,0 µs |

**Hintergrund-Auswertung auf dem Pi (Python):** eine Auswertung aller Regeln 0,05 ms, Neuaufbau des Modells 0,31 ms (auf dem Entwicklungsrechner; auf dem Raspberry Pi etwa das 5–10-Fache, also deutlich unter 5 ms).
- Zustandsänderungen werden nur für die 312 beteiligten Entitäten beachtet (Mengen-Abfrage), alle anderen kosten nichts.
- Mehrere Änderungen innerhalb einer Sekunde lösen eine einzige Auswertung aus; zusätzlich alle 30 s für Regeln mit Mindestdauer.
- Das Modell wird nur bei Änderungen an Bereichen, Geräten, Entitäten oder den Einstellungen neu aufgebaut.

## 0.6.0 – 2026-11-18

### Neu
- **Warnungen individuell konfigurierbar** (Einstellungen → Warnungen):
  - **Feste Regeln** einzeln an/aus: Fenster/Tür offen, Fenster offen beim Heizen, Melder ausgelöst (Alarm), Schloss entriegelt, Garagentor/Tor offen, Batterien kritisch, Geräte nicht erreichbar (Hinweis). Fenster und Türen optional erst nach einer Mindestdauer.
  - **Eigene Regeln** für beliebige Entitäten: Bedingung (an/offen, aus/zu, größer als, kleiner als, ist gleich, ist nicht, nicht erreichbar), Wert, „ab … Minuten“, Stufe (Hinweis, Warnung, Alarm), einzeln abschaltbar.
  - **Vorlagen:** Akku fast leer (mit dem Akku-Sensor vom Dach), Speicher kalt, Kamin sehr heiß, Hoher Netzbezug (mit dem Netz-Sensor), Gerät läuft lange, Gerät offline.
- **Warnkarte** statt „Alles zu“: zeigt „Alles in Ordnung“ oder die aktiven Warnungen, sortiert nach Stufe (Alarm rot und pulsierend, Warnung orange, Hinweis blau); Tipp öffnet den Raum, die Batterieseite oder den Detaildialog. Im Cockpit, auf der Seite Sicherheit und – nur wenn etwas aktiv ist – über den anderen Übersichten.
- **Glocke in der Kopfzeile** mit der Anzahl aktiver Warnungen und Alarme (ersetzt den bisherigen Melder-Chip).
- „Fenster offen beim Heizen“ fasst Fenster und Heizung eines Raums zusammen; das Fenster erscheint dann nicht zusätzlich einzeln.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 17,5 ms | 340 | 720 | 600 | 0 | 27,5 µs |
| Übersicht Cockpit | 12,6 ms | 336 | 720 | 603 | 0 | 28,0 µs |
| Übersicht Aktiv-Fokus | 20,4 ms | 340 | 720 | 600 | 0 | 26,3 µs |
| Raumseite | 6,9 ms | 14 | 0 | 0 | 0 | 1,4 µs |
| Licht | 24,8 ms | 144 | 360 | 840 | 0 | 8,3 µs |

- Warnkarte und Glocke werten die Regeln nur aus, wenn sich eine beteiligte Entität ändert, plus alle 30 s für Regeln mit Mindestdauer (nur bei sichtbarem Tab). Mehr Aktualisierer (+240/min), weiterhin 0 Neuaufbauten und unter 50 µs pro Zustandsänderung.
- Die Liste der Warnkarte wird nur neu geschrieben, wenn sich ihr Inhalt ändert.

## 0.5.0 – 2026-11-18

### Neu
- **Neue Kopfzeile „Kompakt“ (Standard):** Status als Symbol + Zahl (z. B. Licht 6, Heizen 1, Batterien 2), voller Text als Tooltip, Tipp öffnet die passende Seite; Warnungen rot hinterlegt. Am Desktop immer eine Zeile (46 px), auf dem Handy zwei kurze Zeilen.
- **Kopfzeile wählbar** (Einstellungen → Darstellung → Kopfzeile, nur Kompakt-Modus): Kompakt, Chips mit Text (bisher), Satz + Hinweise (Zustand als Satz, nur Warnungen als Chips), Kennzahlen-Leiste (Glasleiste mit Wert und Beschriftung je Kennzahl).

### Behoben
- Kopfzeile: Wetter und Personen bleiben am Desktop immer in der ersten Zeile rechts; die Chips brechen nur noch innerhalb ihres Bereichs um. Personen-Bilder überlappen platzsparend.
- Batterien von Geräten wurden nicht gezählt, wenn Home Assistant sie als Diagnose-Entität führt (der Normalfall). Chip „Batterien schwach“ und die Batterieseite zeigen jetzt alle Batterien.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus, Kopfzeile Kompakt (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 14,9 ms | 340 | 480 | 480 | 0 | 26,9 µs |
| Übersicht Cockpit | 14,7 ms | 336 | 480 | 480 | 0 | 29,9 µs |
| Übersicht Aktiv-Fokus | 14,9 ms | 340 | 480 | 480 | 0 | 38,5 µs |
| Raumseite | 8,3 ms | 14 | 0 | 0 | 0 | 1,0 µs |
| Licht | 34,3 ms | 144 | 360 | 840 | 0 | 10,9 µs |

- Mehr beobachtete Entitäten (+24), weil jetzt auch Diagnose-Batterien zählen; der hass-Setter bleibt unter der Grenze von 50 µs, weiterhin 0 Neuaufbauten.
- Die Kompakt-Kopfzeile ändert Klasse und Tooltip nur, wenn sich der Wert wirklich ändert.

## 0.4.1 – 2026-11-18

### Behoben
- **Navigation fehlte in der eingebetteten Protect-Ansicht.** Zwei Ursachen werden jetzt abgefangen, für alle eingebetteten Panels:
  - Springt ein eingebettetes Panel auf seine eigene Adresse (z. B. `/protect-visualisierung/live` beim Start oder beim Umschalten zwischen Live/Ereignisse/Einstellungen), wird die Adresse auf die eingebettete umgeschrieben (`/haus-visualisierung/extern/protect-visualisierung/live`). Home Assistant bleibt in der Haus Visualisierung, die Unterseite kommt im Panel an.
  - Feste Vollbild-Ebenen eines eingebetteten Panels (`position: fixed`) werden auf den Inhaltsbereich begrenzt und können die Navigation nicht mehr überdecken.

### Performance
- Unverändert gegenüber 0.4.0. Die Adress-Prüfung läuft nur bei einem Seitenwechsel und nur, solange ein Panel eingebettet ist.

## 0.4.0 – 2026-11-18

### Neu
- **Panels einbetten:** Verknüpfungen zu eigenen Panels (z. B. Solar Visualisierung, Protect Visualisierung, Solarthermie) öffnen sich innerhalb der Haus Visualisierung, die Navigation links bzw. unten bleibt. Das Panel wird so geladen, wie Home Assistant es selbst tut (gleiches Element, `hass`, `narrow`, `route`, `panel`), also ohne iFrame und ohne zweite HA-Seitenleiste.
  - Öffnen über die Navigation, die Energie-Karte bzw. Energieleiste (erste Verknüpfung) und den Kamera-Knopf auf der Sicherheitsseite.
  - Adresse z. B. `/haus-visualisierung/extern/solar-visualisierung`; Unterseiten werden über `route` weitergereicht.
  - Beim Verlassen wird das eingebettete Panel getrennt (es pausiert, z. B. stoppt Protect den Live-Stream) und beim Zurückkehren dieselbe Instanz wieder eingesetzt – ohne neues Laden.
  - Je Verknüpfung abschaltbar („einbetten“ in den Einstellungen). Dashboards und Panels, die sich nicht einbetten lassen, öffnen sich wie bisher; bei direktem Aufruf erscheint ein Hinweis mit Knopf.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 17,5 ms | 316 | 480 | 360 | 0 | 19,8 µs |
| Übersicht Cockpit | 12,0 ms | 312 | 480 | 363 | 0 | 17,6 µs |
| Übersicht Aktiv-Fokus | 11,5 ms | 316 | 480 | 360 | 0 | 28,1 µs |
| Raumseite | 8,0 ms | 13 | 0 | 0 | 0 | 0,8 µs |
| Licht | 24,8 ms | 144 | 360 | 840 | 0 | 8,1 µs |

- Eingebettete Panels werden erst beim ersten Öffnen geladen und danach im Speicher gehalten; im Hintergrund sind sie getrennt und arbeiten nicht.
- Die Haus Visualisierung gibt `hass` nur an das gerade sichtbare eingebettete Panel weiter.

## 0.3.2 – 2026-11-18

### Geändert
- **Seitenfüllend:** Das Panel füllt immer den ganzen sichtbaren Bereich – in der Höhe auch bei wenig Inhalt und in der Breite ohne Begrenzung (bisher max. 1440 px). Auf breiten Bildschirmen verteilen sich Raumseiten, Licht und Beschattung auf entsprechend mehr Spalten.
- **Navigation links fest:** Gescrollt wird nur noch der Inhalt; die Navigationsleiste links bleibt stehen. Das gilt auch, wenn Home Assistant dem Panel keine feste Höhe gibt.

### Performance
- Unverändert gegenüber 0.3.1 (0 Neuaufbauten bei Zustandsänderungen). Oberkante und Höhe werden nur bei Größenänderungen des Fensters neu gesetzt.

## 0.3.1 – 2026-11-18

### Behoben
- Schmale Ansicht (Handy): Die Navigationsleiste bleibt beim Scrollen dauerhaft unten sichtbar, auch wenn Home Assistant die ganze Seite statt des Panels scrollt. Sie richtet sich nach Lage und Breite des Panels und hat einen leicht durchscheinenden Hintergrund. Inhalte, Speicherleiste und Meldungen rücken so weit nach oben, dass die Leiste nichts verdeckt.

### Performance
- Unverändert gegenüber 0.3.0 (Messung `tests/perf/measure.py`: 0 Neuaufbauten, hass-Setter Übersicht ≈ 20 µs). Lage und Breite der Leiste werden nur bei Größenänderungen neu gesetzt, nicht beim Scrollen.

## 0.3.0 – 2026-11-18

### Neu
- **Automatische Übersicht** (neuer Standard): Cockpit auf Desktop und Tablet, Aktiv-Fokus auf dem Handy (Grenze 760 px Breite). Wechselt beim Drehen oder Verkleinern des Fensters sofort.
- **Übersicht in vier Varianten** zum festen Einstellen (Einstellungen → Darstellung → Übersicht, nur im Kompakt-Modus):
  - **Hausschnitt** (bisher): Dach, Etagen, Erdlinie, Außenband.
  - **Cockpit**: Etagen als Karten links, rechts eine Seitenleiste mit Sicherheitsstatus, Energie, Schnellzugriff (Alle Lichter aus, Rollos auf/zu, Szenen) und Favoriten.
  - **Etagen-Spalten**: jede Etage eine Spalte mit Raum-Zeilen (Temperaturpunkt farbig, Hinweise, Licht-Knopf); Energieleiste mit Szenen und Schnellzugriff darüber.
  - **Aktiv-Fokus**: oben nur Räume, in denen gerade etwas los ist (Licht, offenes Fenster, Heizen, Bewegung, Musik) mit Klartext, z. B. „Decke, Stehlampe an · ♪ Nachtflug“; alle übrigen Räume als Chips nach Etagen.

### Performance
Messaufbau wie 0.1.0, Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht Hausschnitt | 12,1 ms | 316 | 480 | 360 | 0 | 21,2 µs |
| Übersicht Cockpit | 11,8 ms | 312 | 480 | 363 | 0 | 21,1 µs |
| Übersicht Aktiv-Fokus | 13,3 ms | 316 | 480 | 360 | 0 | 19,2 µs |
| Raumseite | 5,6 ms | 13 | 0 | 0 | 0 | 0,8 µs |
| Licht | 30,5 ms | 144 | 360 | 840 | 0 | 6,1 µs |

- Aktiv-Fokus baut die Seite nur dann neu auf, wenn ein Raum von „ruhig“ zu „aktiv“ wechselt oder umgekehrt (ein Neuaufbau ≈ 13 ms); alle anderen Änderungen aktualisieren nur die betroffenen Kacheln. Im Messaufbau sind alle Räume dauerhaft aktiv, daher 0.
- Der automatische Wechsel Cockpit ↔ Aktiv-Fokus löst nur beim Überschreiten der 760-px-Grenze einen Neuaufbau aus.

## 0.2.0 – 2026-11-18

### Neu
- **Kompakt-Modus** (Standard, umschaltbar unter Einstellungen → Darstellung; „Komfort“ entspricht 0.1.0):
  - Übersicht: einzeilige Kopfzeile mit Chips, flache Energieleiste statt hohem Dach, kleine Raum-Chips für Räume ohne Klimawerte, Außenbereiche als Chip-Leiste, schmale Etagenspalte, nur Abweichungen werden angezeigt.
  - Handy: Etagen als Reiter.
  - Raumseite: einzeiliger Kopf mit Szenen als Chips, Werte-Leiste für Sensoren, Kontakte und Melder, Geräte als Zeilen; Lichter per Wischen dimmen; „Weitere“ und Batterien eingeklappt.
  - Licht und Beschattung als Listen pro Etage in Spalten, Filter „Nur eingeschaltete“.
  - Klima als Tabelle (Raum · Ist · Feuchte · Thermostat).
  - Sicherheit mit Zusammenfassung oben, Fenster & Türen eingeklappt; Batterien als Liste, „In Ordnung“ eingeklappt.
  - Navigation am Desktop nur mit Symbolen.

### Performance
Messaufbau wie 0.1.0, gemessen im Kompakt-Modus (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht | 11,5 ms | 316 | 480 | 363 | 0 | 23,3 µs |
| Raumseite | 5,1 ms | 13 | 0 | 0 | 0 | 1,3 µs |
| Licht | 26,1 ms | 144 | 360 | 840 | 0 | 6,8 µs |

- Zeilen nutzen dieselben Bindungen wie Kacheln; kein zusätzlicher Aufwand pro Zustandsänderung.
- Wischen zum Dimmen schickt erst beim Loslassen einen Befehl (kein Dienstaufruf pro Bewegung).
- Filter „Nur eingeschaltete“ und eingeklappte Bereiche arbeiten rein per CSS, ohne Neuaufbau.
- Auf dem Handy wird nur die gewählte Etage aufgebaut.

## 0.1.0 – 2026-11-18

Erste Version.

### Neu
- Eigenes Panel „Haus“ in der Seitenleiste, das sich wie eine Dashboard-Strategy selbst aus **Etagen → Bereichen → Geräten** aufbaut. Neue Geräte erscheinen ohne Bearbeitung.
- **Übersicht als Hausschnitt**: Dach mit PV-Feld und Energiewerten (PV, Akku, Haus, Netz), Etagen von oben nach unten, Erdlinie, Keller darunter, Außenbereiche als grünes Band.
- **Raumkacheln** mit Temperatur, Luftfeuchte, warmem Leuchten bei eingeschaltetem Licht, Hinweisen für offene Fenster, Heizen und Präsenz, Licht-Knopf und Rollo-Status.
- **Status-Chips**: Lichter an, offene Fenster und Türen, offene Rollos, Ø Innentemperatur, heizende Räume, Melder, schwache Batterien, nicht erreichbare Geräte.
- **Raumseiten** mit automatisch gebildeten Blöcken (Licht, Beschattung, Klima, Medien, Schalter, Schlösser, Kameras, Fenster & Türen, Präsenz, Sicherheit, Sensoren, Szenen, Weitere), Raum-Pins, Blättern zum nächsten Raum.
- **Sammelseiten** Licht, Beschattung, Klima, Sicherheit, Batterien – nach Etagen und Räumen gruppiert, mit „Alle aus“, „Etage aus“, „Auf/Zu“.
- **Kacheln**: Tippen schaltet, langes Drücken (oder Rechtsklick) öffnet den Detaildialog. Helligkeits-Schieber, Rollo-Tasten, Soll-Temperatur ±, Medien, Schloss mit Bestätigung.
- **Einstellungen im Panel** (nur Administratoren): Reihenfolge von Etagen und Bereichen, Bereiche ausblenden, Etage als Außenbereich, Raum-Pins, Favoriten, Energie-Entitäten fürs Dach, Verknüpfungen zu anderen Panels, Glas-Effekt, Startseite, Kamera-Intervall, Batterie-Schwellen, Ausblende-Labels. Gespeichert in `.storage/haus_visualisierung`, ohne Neustart, auf allen Geräten.
- Filter wie bei der Simon42-Strategy: Label `no-dboard`, versteckte Entitäten und Konfigurations-/Diagnose-Entitäten werden ausgeblendet.
- **Karten** `custom:haus-raum-card` und `custom:haus-hausschnitt-card` für eigene Dashboards (passen sich dem Design an).
- Design aus den Panel-Optionen (z. B. „Frosted Glass Dark Lite“ samt Hintergrundbild), Versionsanzeige und Hinweis bei veraltetem Browser-Cache, Logo unter `brand/`.

### Performance
Messaufbau: 24 Räume auf 4 Etagen mit ≈ 400 Entitäten plus 300 fremde Sensoren, alle 250 ms eine Zustandsänderung (abwechselnd fremd / aus den Räumen), hochgerechnet auf eine Minute (`tests/perf/measure.py`).

| Seite | Aufbau | beobachtete Entitäten | Aktualisierer/min | DOM-Änderungen/min | Neuaufbauten/min | hass-Setter Ø |
| --- | --- | --- | --- | --- | --- | --- |
| Übersicht | 12,8 ms | 316 | 480 | 360 | 0 | 18,8 µs |
| Raumseite | 6,6 ms | 13 | 0 | 0 | 0 | 0,8 µs |
| Licht | 23,3 ms | 144 | 360 | 960 | 0 | 5,8 µs |

- Das Panel wird nur einmal aufgebaut; danach werden ausschließlich die Kacheln aktualisiert, deren Entität sich geändert hat (Bindungen pro Entität, gesammelt in einem Animationsframe).
- Fremde Zustandsänderungen kosten nur einen Vergleich je beobachteter Entität, keine DOM-Arbeit.
- Kein Polling auf dem Pi: Das Panel nutzt die Zustände, die Home Assistant ohnehin schickt. Kamera-Standbilder nur für sichtbare Kameras, nur bei sichtbarem Tab, im eingestellten Intervall.
- Bei verstecktem Tab pausieren Uhr, Kameras und Aktualisierungen.
