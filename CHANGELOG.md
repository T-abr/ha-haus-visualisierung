# Changelog – Haus Visualisierung

Versionen nach Semantic Versioning. Einzige Quelle der Versionsnummer ist `manifest.json`.

## Unveröffentlicht

### Neu – Müllabfuhr und Termine
- **„Morgen: Gelbe Tonne, Papier“** in der Kopfzeile (alle Varianten) und im **Bildschirmschoner**, am Vorabend der Abfuhr (Standard ab 17 Uhr) und am Morgen bis 10 Uhr farbig hervorgehoben, mit Farbe und Symbol der Tonne (gelb, Papier, Bio, Grünschnitt, Glas, Rest, Sperrmüll, Schadstoffe). Dazu Termine von heute und morgen („Heute 20:00 Elternabend“); der Tooltip zeigt die nächsten Tage, ein Tipp öffnet den Kalender. Am Handy erscheint nur die hervorgehobene Abfuhr als Symbol.
- Quelle sind **Kalender aus Home Assistant** (Waste Collection Schedule, Abfall-Integrationen, ICS, Google/CalDAV …) über die Kalender-API; ohne sie der nächste Termin aus der Entität. Kalender mit „Abfall“, „Müll“, „Tonne“ … im Namen zählen automatisch als Müllabfuhr.
- **Einstellungen → Darstellung → Müllabfuhr und Termine:** an/aus, Kopfzeile, Bildschirmschoner, Hervorheben ab (Uhr), Vorausschau (Tage) und je Kalender „Müllabfuhr“, „Termine“ oder „Nicht anzeigen“ (`termine`).

### Geändert – Bildschirmschoner bleibt mittig
- Uhr und Infos im Bildschirmschoner stehen jetzt **standardmäßig fest in der Mitte** statt jede Minute zu wandern.
- Neue Einstellung **Einstellungen → Wandpanel → „Bildschirmschoner wandern lassen“** (`wallpanel.wander`, Standard aus) für alle, die den Einbrenn-Schutz wollen (z. B. OLED). LCDs wie im iPad brennen praktisch nicht ein.

### Tests
- Neue Gruppe `termine` (18 Prüfungen, feste Uhrzeit): automatische Erkennung, Vorabend, Vorrang Termin/Abfuhr, Tooltip, Schoner mit Tonnenfarbe, Rückfall auf Attribute, Handy, Einstellungen speichern. Backend: Einstellungen `termine` werden geprüft.
- Bedienprüfungen: Schoner standardmäßig mittig, Wandern ein-/ausschaltbar, Schalter in den Einstellungen. Die Prüfung „Schoner passt in die Breite“ hing bisher von der Minute ab (Versatz bis 6 vw) und ist jetzt stabil. Backend: `wander` wird geprüft.

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
