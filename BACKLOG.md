# Backlog

Ideen für spätere Versionen, sortiert nach Priorität und dann Aufwand. Nichts davon ist umgesetzt.
Aufwand grob: **S** bis ein Abend, **M** ein bis zwei Abende, **L** mehr.

Wenn ein Punkt umgesetzt wird: hier streichen und im `CHANGELOG.md` beschreiben.

## Übersicht

| # | Idee | Priorität | Aufwand | Status |
|---|------|-----------|---------|--------|
| 1 | ~~Gute-Nacht- und Verlassen-Check~~ | hoch | S | umgesetzt |
| 2 | Müll und Termine im Kopf und im Schoner | hoch | S | neu |
| 3 | „Fertig“-Meldungen für Haushaltsgeräte | hoch | M | neu |
| 4 | Wasser und Gas mit Leck-Erkennung | hoch | M | neu |
| 5 | Heizung je Raum: Sollwert und Wochenplan | mittel | M | neu |
| 6 | Garten und Bewässerung mit Regenvorhersage | mittel | M | neu |
| 7 | Wartungsplaner fürs Haus | mittel | M | in Umsetzung |
| 8 | Rückblick und Vorjahresvergleich | mittel | M | in Umsetzung |
| 9 | Grundriss-Ansicht je Etage | niedrig | L | neu |
| 10 | Anwesenheits-Simulation im Urlaub | niedrig | M | in Umsetzung |
| 11 | Nachtmodus fürs Wandpanel | später | S | vorgemerkt |
| 12 | Geräte-Warnungen (offline, Updates) | später | S | vorgemerkt |
| 13 | Kamera-Raster auf Sicherheit | später | M | vorgemerkt |
| 14 | Täglicher bzw. wöchentlicher Push-Bericht | später | M | vorgemerkt |
| 15 | Intelligentes Laden der Wallbox | später | L | vorgemerkt |
| 16 | Musik- und Medienseite | später | L | vorgemerkt |

„In Umsetzung“: von Tobias am 2026-11-23 ausgewählt, wird gerade umgesetzt. „Neu“: im Backlog, noch nicht
ausgewählt. „Vorgemerkt“: gute Idee, aber im Moment nicht spannend (Tobias, 2026-11-23).

## Neue Ideen

### 1. ~~Gute-Nacht- und Verlassen-Check~~ (umgesetzt, siehe CHANGELOG)
Ein Knopf „Gute Nacht“ bzw. „Ich gehe“ (Übersicht, Wandpanel, Handy) zeigt vor dem Moduswechsel, was noch offen
ist: Fenster und Türen offen, Licht an, Tür nicht verriegelt, Garage offen, Herd/Bügeleisen an. Jede Zeile mit
„Schließen/Ausschalten“, unten „Trotzdem Nacht/Abwesend“. Baut auf Hausmodus, Fenster- und Lichtgruppen auf, die
es schon gibt; geschaltet wird nur auf Tippen.

### 2. Müll und Termine im Kopf und im Schoner
Abfuhrtermine aus `calendar.*` oder Abfall-Integrationen (z. B. Waste Collection Schedule) und die nächsten
Familientermine: „Morgen: Gelbe Tonne“ in der Kopfzeile und im Bildschirmschoner, am Vorabend hervorgehoben,
optional Erinnerung über die vorhandenen Meldungen. Einstellbar, welche Kalender zählen.

### 3. „Fertig“-Meldungen für Haushaltsgeräte
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

### 7. Wartungsplaner fürs Haus
Liste wiederkehrender Aufgaben mit Fälligkeit: Lüftungsfilter, Heizungswartung, Rauchmelder testen, Kaminkehrer,
Batteriewechsel (aus der Batterieseite übernommen), Wasserfilter, Auto/Wallbox. Fällige Punkte in den Meldungen,
„Erledigt“ setzt das nächste Datum. Optional nach Betriebsstunden (z. B. Pumpe, Filter nach Laufzeit).

### 8. Rückblick und Vorjahresvergleich
Seite oder Karte „Rückblick“: dieser Monat gegen Vormonat und Vorjahresmonat für PV, Verbrauch, Autarkie,
Kosten, Heizung (mit Heizgradtagen bereinigt) und Wasser. Rekorde („bester PV-Tag des Jahres“). Daten aus der
Langzeitstatistik, die schon für Woche/Monat/Jahr genutzt wird.

### 9. Grundriss-Ansicht je Etage
Eigenes Bild oder SVG des Grundrisses je Etage hochladen, Räume als Flächen markieren. Darauf Temperatur als
Farbe, offene Fenster, Licht an, Bewegung; Tipp auf einen Raum öffnet die Raumseite. Als fünfte Variante der
Übersicht oder eigene Seite. Größter Aufwand ist der Editor zum Markieren der Räume.

### 10. Anwesenheits-Simulation im Urlaub
Im Hausmodus „Urlaub“ schalten ausgewählte Lichter und Rollos nach dem Muster der letzten Wochen aus dem Verlauf,
leicht zufällig verschoben. Läuft im Backend, Protokoll im Panel, endet automatisch bei Rückkehr.

## Vorgemerkt (früher vorgeschlagen)

- **Nachtmodus fürs Wandpanel:** nachts gedimmter, roter bzw. sehr dunkler Schoner, Helligkeit des Tablets nach
  Uhrzeit oder Hausmodus „Nacht“.
- **Geräte-Warnungen:** Geräte offline/unavailable, verfügbare Updates, leere Batterien gesammelt als Meldung.
- **Kamera-Raster:** alle Kameras als Kacheln auf der Seite Sicherheit, Tipp für Vollbild und Live.
- **Push-Bericht:** täglich oder wöchentlich eine Zusammenfassung (Energie, Kosten, Alarme, Klima) aufs Handy.
- **Intelligentes Wallbox-Laden:** Laden nach PV-Überschuss, günstigstem Strompreis und Abfahrtszeit planen.
- **Musik und Medien:** Seite für Sonos/Media-Player mit Gruppen, Lautstärke, Favoriten.
