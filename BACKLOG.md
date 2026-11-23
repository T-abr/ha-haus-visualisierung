# Backlog

Ideen für spätere Versionen, sortiert nach Priorität und dann Aufwand. Nichts davon ist umgesetzt.
Aufwand grob: **S** bis ein Abend, **M** ein bis zwei Abende, **L** mehr.

Wenn ein Punkt umgesetzt wird: hier streichen und im `CHANGELOG.md` beschreiben.

## Übersicht

| # | Idee | Priorität | Aufwand | Status |
|---|------|-----------|---------|--------|
| 1 | ~~Gute-Nacht- und Verlassen-Check~~ | hoch | S | umgesetzt |
| 2 | ~~Müll und Termine im Kopf und im Schoner~~ | hoch | S | umgesetzt |
| 3 | ~~„Fertig“-Meldungen für Haushaltsgeräte~~ | hoch | M | umgesetzt |
| 4 | Wasser und Gas mit Leck-Erkennung | hoch | M | neu |
| 5 | Heizung je Raum: Sollwert und Wochenplan | mittel | M | neu |
| 6 | Garten und Bewässerung mit Regenvorhersage | mittel | M | neu |
| 7 | ~~Wartungsplaner fürs Haus~~ | mittel | M | umgesetzt |
| 8 | ~~Rückblick und Vorjahresvergleich~~ | mittel | M | umgesetzt (Rest offen) |
| 9 | Grundriss-Ansicht je Etage | niedrig | L | neu |
| 10 | ~~Anwesenheits-Simulation im Urlaub~~ | niedrig | M | umgesetzt |
| 11 | Nachtmodus fürs Wandpanel | später | S | vorgemerkt |
| 12 | Geräte-Warnungen (offline, Updates) | später | S | vorgemerkt |
| 13 | Kamera-Raster auf Sicherheit | später | M | vorgemerkt |
| 14 | Täglicher bzw. wöchentlicher Push-Bericht | später | M | vorgemerkt |
| 15 | Intelligentes Laden der Wallbox | später | L | vorgemerkt |
| 16 | Musik- und Medienseite | später | L | vorgemerkt |
| 17 | Display-Firmware aus GitHub-Releases statt mitgeliefert | mittel | M | neu |
| 18 | ~~Unwetter und „Regen kommt, Fenster offen“~~ | hoch | M | umgesetzt |
| 19 | ~~Einstellungen sichern und wiederherstellen~~ | hoch | S | umgesetzt |
| 20 | ~~Einrichtungs-Check~~ | hoch | S–M | umgesetzt |
| 21 | ~~PIN für heikle Aktionen (Wandpanel, Display)~~ | hoch | M | umgesetzt (Rest offen) |
| 22 | Zeitleiste „Was war los?“ | mittel | M | neu |
| 23 | Szenen je Raum (auch als Display-Kachel) | mittel | M | neu |
| 24 | Display: Alarm-Vollbild mit Quittieren | mittel | M | neu |
| 25 | Display: Relais als Lichtschalter | niedrig | M | neu |
| 26 | Display: Wecken über Bewegungsmelder im Raum | mittel | S | neu |
| 27 | Display: kurze Meldungen als Popup | mittel | S–M | neu |
| 28 | Display: Raumbezug je Display | mittel | M | neu |
| 29 | Display: Wetter-/PV-Seite mit Stundenverlauf | niedrig | M | neu |

„Umgesetzt“: seit Version 1.11.0 (1–10) bzw. 1.17.0 (18–21) enthalten. „Neu“: im Backlog, noch nicht
ausgewählt. „Vorgemerkt“: gute Idee, aber im Moment nicht spannend (Tobias, 2026-11-23).

## Neue Ideen

### 1. ~~Gute-Nacht- und Verlassen-Check~~ (umgesetzt, siehe CHANGELOG)
Ein Knopf „Gute Nacht“ bzw. „Ich gehe“ (Übersicht, Wandpanel, Handy) zeigt vor dem Moduswechsel, was noch offen
ist: Fenster und Türen offen, Licht an, Tür nicht verriegelt, Garage offen, Herd/Bügeleisen an. Jede Zeile mit
„Schließen/Ausschalten“, unten „Trotzdem Nacht/Abwesend“. Baut auf Hausmodus, Fenster- und Lichtgruppen auf, die
es schon gibt; geschaltet wird nur auf Tippen.

### 2. ~~Müll und Termine im Kopf und im Schoner~~ (umgesetzt, siehe CHANGELOG)
Abfuhrtermine aus `calendar.*` oder Abfall-Integrationen (z. B. Waste Collection Schedule) und die nächsten
Familientermine: „Morgen: Gelbe Tonne“ in der Kopfzeile und im Bildschirmschoner, am Vorabend hervorgehoben,
optional Erinnerung über die vorhandenen Meldungen. Einstellbar, welche Kalender zählen.

### 3. ~~„Fertig“-Meldungen für Haushaltsgeräte~~ (umgesetzt, siehe CHANGELOG)
Waschmaschine, Trockner, Spülmaschine über ihre Leistung (Steckdose mit Messung) oder ihren Programmstatus:
läuft seit, Restzeit, „fertig seit 12 min“, Energie und Kosten je Durchgang (mit dem vorhandenen Strompreis).
Kleine Karte auf der Übersicht, Hinweis im Schoner, Meldung bei „fertig“, Quittieren durch Tippen oder Tür auf.
Dazu Tipp „jetzt starten, PV-Überschuss“ bzw. günstiges Zeitfenster.

### 4. Wasser und Gas mit Leck-Erkennung
Verbrauch je Tag/Woche/Monat für Wasser und Gas (gleiche Zeitraum-Umschalter wie Energie), Kosten, Vergleich zum
Schnitt. Warnregel „Dauerfluss“: läuft nachts über längere Zeit Wasser, gibt es eine Warnung im Alarmmanager,
optional mit Hauptventil schließen (nur mit Rückfrage). Wassermelder fließen mit ein.

### 5. Heizung je Raum: Sollwert und Wochenplan
Auf Raum- und Klimaseite die Solltemperatur der Thermostate (`climate.*`) direkt ändern, Abweichung Ist/Soll
anzeigen und einen einfachen Wochenplan je Raum (Komfort/Absenkung nach Uhrzeit) pflegen. Kopplung an den
Hausmodus: Abwesend/Urlaub senkt ab, Fenster offen pausiert. Der Plan läuft im Backend, nicht im Browser.

### 6. Garten und Bewässerung mit Regenvorhersage
Bodenfeuchte, Ventile und Regen der letzten Tage auf einer Karte (Raum „Garten“), dazu ein Hinweis aus der
vorhandenen Vorhersage: „Heute nicht gießen, morgen 8 mm Regen“ bzw. „3 Tage trocken über 28 °C: abends gießen“.
Ventil mit Laufzeit starten, nur auf Tippen. Gleiche Logik wie die Beschattungshinweise.

### 7. ~~Wartungsplaner fürs Haus~~ (umgesetzt, siehe CHANGELOG)
Offen geblieben: Batteriewechsel direkt aus der Batterieseite übernehmen, Aufgaben nach Betriebsstunden.

Liste wiederkehrender Aufgaben mit Fälligkeit: Lüftungsfilter, Heizungswartung, Rauchmelder testen, Kaminkehrer,
Batteriewechsel (aus der Batterieseite übernommen), Wasserfilter, Auto/Wallbox. Fällige Punkte in den Meldungen,
„Erledigt“ setzt das nächste Datum. Optional nach Betriebsstunden (z. B. Pumpe, Filter nach Laufzeit).

### 8. ~~Rückblick und Vorjahresvergleich~~
Umgesetzt als Karte „Rückblick“ auf der Energie-Seite (siehe `CHANGELOG.md`): Monat gegen Vormonat und Vorjahresmonat
für PV, Verbrauch, Bezug, Einspeisung, Autarkie, Kosten, Temperaturen und Heizgradtage, dazu Rekorde des Jahres.
Offen: Heizenergie mit Heizgradtagen bereinigt (braucht einen Wärme- bzw. Gaszähler) und Wasser (kommt mit Idee 4).

### 9. Grundriss-Ansicht je Etage
Eigenes Bild oder SVG des Grundrisses je Etage hochladen, Räume als Flächen markieren. Darauf Temperatur als
Farbe, offene Fenster, Licht an, Bewegung; Tipp auf einen Raum öffnet die Raumseite. Als fünfte Variante der
Übersicht oder eigene Seite. Größter Aufwand ist der Editor zum Markieren der Räume.

### 10. ~~Anwesenheits-Simulation im Urlaub~~ (umgesetzt, siehe CHANGELOG)
Im Hausmodus „Urlaub“ schalten ausgewählte Lichter und Rollos nach dem Muster der letzten Wochen aus dem Verlauf,
leicht zufällig verschoben. Läuft im Backend, Protokoll im Panel, endet automatisch bei Rückkehr.

### 17. Display-Firmware aus GitHub-Releases statt mitgeliefert
Bisher liegt die Firmware der Wanddisplays der Integration bei (`firmware/`), jede neue Firmware braucht also
ein neues Release der Visualisierung. Stattdessen schaut die Visualisierung selbst in den Releases von
[ha-haus-display](https://github.com/T-abr/ha-haus-display) nach einer neuen Version: regelmäßig (z. B. alle
6–12 Stunden) und per Knopf „Nach Firmware suchen“ in Einstellungen → Displays. Eine neue Firmware wird
heruntergeladen, zwischengespeichert und über die vorhandene Update-Entität je Display per OTA aufgespielt
(Aufspielen weiter nur auf Tippen bzw. über die Update-Entität). Auch das Flashen im Browser nutzt dann die
heruntergeladene Datei. Prüfen: Version und Protokoll passen zusammen, Prüfsumme, Fallback auf die zuletzt
geladene Firmware ohne Internet.

**Offene Entscheidung:** ha-haus-display ist privat. Entweder ein GitHub-Token mit Lesezugriff in den
Einstellungen hinterlegen oder das Firmware-Repo öffentlich machen (dann ohne Token).

### 18.–21. ~~Wetterwarnungen, Sicherungen, Einrichtungs-Check, PIN~~ (umgesetzt, siehe CHANGELOG 1.17.0)
Offen bei 21: Tastenfeld für die PIN am Wanddisplay (braucht neue Firmware); bis dahin sind geschützte Aktionen dort
gesperrt.

### 22. Zeitleiste „Was war los?“
Tür, Klingel mit Standbild, Bewegung, Moduswechsel und Alarme als Verlauf auf der Seite Sicherheit, nach Tag
gruppiert und filterbar. Praktisch nach dem Urlaub oder wenn man unterwegs war. Quelle: Recorder bzw. Logbuch und
das Protokoll des Alarmmanagers; Standbilder der Klingel bei jedem Klingeln merken.

### 23. Szenen je Raum
Stimmungen wie Kino, Essen oder Putzen im Panel anlegen (Lichter mit Helligkeit/Farbe, Rollos mit Position) und mit
einem Tipp schalten: auf der Raumseite, im Schnellzugriff und als Kachel am Wanddisplay. Vorhandene `scene.*`
weiter nutzbar.

### 24. Display: Alarm-Vollbild mit Quittieren
Wie das Klingel-Overlay: bei einem Alarm füllt die Meldung den Bildschirm des Wanddisplays (rot, mit Raum und
Zeit), dazu „Quittieren“ und „1 h stumm“ direkt am Gerät. Braucht neue Firmware.

### 25. Display: Relais als Lichtschalter
Die Guition-Variante mit Relais macht das Display zum echten Wandschalter: Relais je Kanal einer Kachel zuordnen,
schaltet auch ohne WLAN bzw. ohne Home Assistant. Braucht neue Firmware und die Relais-Hardware.

### 26. Display: Wecken über Bewegungsmelder im Raum
Je Display einen Bewegungsmelder wählen: erkennt er Bewegung, wird das Display hell bzw. verlässt den
Bildschirmschoner, wie das Wandpanel. Läuft fast ganz über die Integration (Wecken wie bei neuem Alarm).

### 27. Display: kurze Meldungen als Popup
Ereignisse wie „Waschmaschine fertig“ oder „Fenster Bad offen, es regnet“ erscheinen als kleines Popup mit „OK“
statt nur in der Hinweiszeile. Braucht neue Firmware.

### 28. Display: Raumbezug je Display
Ein Display bekommt einen Bereich (Raum): eine Seite zeigt Temperatur, Feuchte, Licht und Rollos dieses Raums
automatisch, ohne Kacheln von Hand einzurichten. Firmware nur, wenn die Seite eigene Darstellung braucht.

### 29. Display: Wetter-/PV-Seite mit Stundenverlauf
Temperatur, Regen und erwartete PV-Leistung der nächsten Stunden als kleine Kurven. Braucht neue Firmware.

## Vorgemerkt (früher vorgeschlagen)

- **Nachtmodus fürs Wandpanel:** nachts gedimmter, roter bzw. sehr dunkler Schoner, Helligkeit des Tablets nach
  Uhrzeit oder Hausmodus „Nacht“.
- **Geräte-Warnungen:** Geräte offline/unavailable, verfügbare Updates, leere Batterien gesammelt als Meldung.
- **Kamera-Raster:** alle Kameras als Kacheln auf der Seite Sicherheit, Tipp für Vollbild und Live.
- **Push-Bericht:** täglich oder wöchentlich eine Zusammenfassung (Energie, Kosten, Alarme, Klima) aufs Handy.
- **Intelligentes Wallbox-Laden:** Laden nach PV-Überschuss, günstigstem Strompreis und Abfahrtszeit planen.
- **Musik und Medien:** Seite für Sonos/Media-Player mit Gruppen, Lautstärke, Favoriten.
