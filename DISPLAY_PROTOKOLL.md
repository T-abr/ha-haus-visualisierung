# Wanddisplay-Protokoll (Version 1)

Schnittstelle zwischen der Integration **Haus Visualisierung** (dieses Repository) und kleinen Wanddisplays, z. B.
einem 4-Zoll-ESP32-S3 mit ESPHome. Die Firmware dafür liegt im Repository
[ha-haus-display](https://github.com/T-abr/ha-haus-display).

Grundidee: Das Display ist ein **Client**. Alles Rechnen (Gute-Nacht-Check, Müll, Energie, Raumklima, Meldungen) und
alle Einstellungen bleiben in der Integration. Das Display zeigt nur fertig formatierte Texte, Farben und Icons an und
meldet Tipps zurück.

## Einrichten

Alles im Panel unter Einstellungen → **Displays** → „Neues Gerät einrichten“ (ab 1.13.0):

1. Firmware aus dem Browser flashen (ESP Web Tools; die Firmware liegt der Integration unter
   `custom_components/haus_visualisierung/firmware/` bei und wird unter
   `/haus_visualisierung_static/firmware/<version>/` ausgeliefert). Braucht Chrome oder Edge am Computer und HTTPS;
   sonst Firmware herunterladen und z. B. mit ESPHome Web flashen.
2. WLAN per Improv im Flash-Dialog (oder über den Hotspot des Geräts).
3. „Übernehmen“: bestätigt die ESPHome-Erkennung (bzw. fügt per IP hinzu) und setzt beim ESPHome-Eintrag die Option
   „Darf Home-Assistant-Aktionen ausführen“ (`allow_service_calls`).
4. Gerät einem Display zuordnen (Feld `device` im Layout) – die Integration schickt sofort alle Inhalte.

Firmware 0.1.x (Kennung fest eingebaut, `display_id`) läuft weiter: Sie abonniert `sensor.haus_display_<kennung>`.

## Übertragung

- **Firmware ab 0.2.0 (Push)**: Die Firmware stellt die ESPHome-API-Aktion `haus_daten(bereich: string, daten: string)`
  bereit, in Home Assistant `esphome.<gerätename mit _>_haus_daten`. Die Integration ruft sie je Bereich auf
  (`bereich` = Name eines Attributs unten, `daten` = derselbe JSON-Text; `protokoll` als Zahl im Text). Nur geänderte
  Bereiche werden geschickt; alles neu nach `hallo` (siehe Dienst) und wenn ESPHome den Dienst neu anmeldet.
  Verliert ein Gerät seine Zuordnung, bekommt es `protokoll` = `""` und zeigt „Noch nicht zugeordnet“.
- **Update (Firmware ab 0.3.0)**: API-Aktion `haus_update(adresse: string, pruefsumme: string)`, in Home Assistant
  `esphome.<gerät>_haus_update`. `adresse` = interne URL von Home Assistant + `/haus_visualisierung_static/firmware/<version>/haus-display.ota.bin`,
  `pruefsumme` = MD5 der Datei. Das Gerät lädt, prüft, schreibt und startet neu. Auslöser: Update-Entität je Gerät
  oder Websocket `haus_visualisierung/display_update`.
- **Firmware 0.1.x (Abo)**: Attribute der Entität unten über `homeassistant`-Textsensoren.

## Entität `sensor.haus_display_<kennung>`

- **Zustand**: Protokollversion (`1`). Die Firmware vergleicht sie mit ihrer eigenen und zeigt bei Abweichung einen
  Hinweis („Firmware aktualisieren“ bzw. „Integration aktualisieren“).
- **Nicht verfügbar**, solange das Display in den Einstellungen fehlt.
- **Attribute**: `protokoll` (Zahl) und je Bereich ein **JSON-Text** (UTF-8, kompakt). Die Attribute stehen nicht im
  Recorder.

Felder, die leer sind, kommen als `""`, fehlende Zahlen als `-1`. Icons sind Namen der Material Design Icons **ohne**
`mdi:` (z. B. `weather-night`); unbekannte Namen zeigt die Firmware als Ersatzsymbol. Farben sind `#rrggbb` aus der
Palette der Visualisierung.

### `einstellungen`

```json
{"name": "Flur", "seiten": ["start", "energie", "klima", "haus"], "hinweis": true,
 "hell_tag": 80, "hell_nacht": 10, "wecken": true, "nacht": false, "schoner": 5, "schoner_hell": 20}
```

`schoner`: Minuten ohne Berührung bis zum Bildschirmschoner (0 = aus), `schoner_hell`: Helligkeit dabei in %
(gilt die geringere aus Schoner und Tag/Nacht). Ab Firmware 0.4.0.

`seiten`: Reihenfolge im Dock, `start` immer zuerst. `hell_*` in %, `hell_nacht` gilt, solange `nacht` (Hausmodus
„Nacht“) wahr ist; 0 = dunkel bis zur Berührung. `wecken`: bei neuer Alarm-Meldung hell schalten.

### `kopf`

```json
{"wetter": {"i": "weather-partly-cloudy", "t": "7°", "txt": "Teils bewölkt", "morgen": "morgen 15°"},
 "modus": {"k": "zuhause", "n": "Zuhause", "i": "home-account", "f": "#4fd18b"}}
```

`wetter` fehlt ohne Wetter-Entität; `t` ist die Außentemperatur vom Außenfühler (Einstellungen → Heizung → Außentemperatur, sonst nach Namen), ohne Fühler die der Wetter-Entität. Die Uhrzeit nimmt die Firmware von Home Assistant (Zeitquelle).

### `schoner`

Inhalt des Bildschirmschoners (nur wenn eingeschaltet, sonst `null`), wie am Wandpanel:

```json
{"zeile": [{"i": "weather-partly-cloudy", "t": "7°"}, {"i": "solar-power-variant", "t": "3,2 kW"},
           {"i": "calendar", "t": "Morgen 15°"}, {"i": "home-account", "t": "Zuhause"}],
 "termine": [{"i": "recycle", "f": "#f2c230", "t": "Morgen: Gelbe Tonne", "hot": true}],
 "hinweis": {"i": "check-circle-outline", "t": "Waschmaschine fertig"},
 "status": {"i": "shield-check", "f": "#4fd18b", "t": "Alles in Ordnung"}}
```

Welche Elemente kommen, stellt man unter Einstellungen → Wandpanel → Bildschirmschoner ein (gilt für Panel und
Displays): abgeschaltete Teile fehlen in `zeile`, `hinweis` bzw. `status` ist dann `null`. Optional steht in `zeile`
die Innentemperatur (`home-thermometer`). Die Temperatur bei `weather-*` ist die des Außenfühlers, sonst der
Wetter-Entität (wie `kopf.wetter.t`).

### `klingel`

Klingel-Overlay wie im Panel (Einstellungen → Klingel; je Display unter Displays → „Klingel“ abschaltbar). `null`,
solange es nicht klingelt; die Integration schickt `null` nach der Zeit aus „Automatisch schließen nach“ bzw. 15 s nach
„Tür öffnen“.

```json
{"n": 3, "t": "Es klingelt", "s": "Haustür · 14:32", "tuer": true, "offen": false, "bis": 1795449180,
 "bild": "http://192.168.1.2:8123/api/camera_proxy/camera.g4_hoch?token=…&width=432&height=243"}
```

`n` zählt jedes Klingeln: Ein neues `n` zeigt das Overlay (auch wenn es vorher am Display geschlossen wurde) und weckt
das Display. `t` ist „Es klingelt“, „Es klingelt erneut“ oder „Test: Es klingelt“. `bild` ist ein von Home Assistant
verkleinertes JPEG-Standbild der Kamera (leer ohne Kamera oder ohne interne Adresse); die Firmware lädt es, solange das
Overlay offen ist, alle paar Sekunden neu. `tuer`: Türöffner eingerichtet, Knopf „Tür öffnen“ zeigen (muss zweimal
getippt werden, dann Ziel `klingel:tuer`); `offen`: Türöffner wurde ausgelöst. `bis`: Unix-Zeit, zu der das Overlay
schließt (für die Anzeige „schließt in … s“ und als Sicherung ohne Verbindung).

### `pin`

PIN-Tastenfeld (Firmware ab 0.7.0), `null`, solange nichts abgefragt wird. Tippt man am Display eine Aktion, die laut
Einstellungen → PIN geschützt ist (Tür öffnen, Alarm aus, Abwesend/Urlaub), führt die Integration sie nicht aus,
sondern schickt:

```json
{"n": 7, "t": "Tür öffnen", "k": "38201957", "f": ""}
```

`n` zählt jede Abfrage: Ein neues `n` öffnet das Tastenfeld als Overlay (über allem, auch über der Klingel) und weckt
das Display. `t` ist die geschützte Aktion, `f` ein Fehlertext („Falsche PIN“, „Zu viele Versuche – noch 45 s gesperrt“),
sonst leer. `k` ist ein Einmalschlüssel aus 8 Ziffern: Die Firmware schickt die Eingabe nicht im Klartext, sondern je
Stelle `(PIN-Ziffer + k[Stelle]) mod 10` als Ziel `pin:<ziffern>` (4–8 Stellen); leeres `pin:` = abgebrochen. So steht
die PIN nicht lesbar in der Datenbank von Home Assistant (Dienstaufrufe werden aufgezeichnet). Nach jedem Versuch kommt
ein neues `k` (gleiches `n`): Die Firmware leert dann die Eingabe und zeigt `f`. Bei richtiger PIN führt die Integration
die gemerkte Aktion aus, schickt `null` und lässt das Display 30 s entsperrt. Nach 5 Fehlversuchen ist es 60 s
gesperrt; nach 60 s ohne Eingabe schließt die Integration die Abfrage. Ältere Firmware ignoriert den Bereich und zeigt
den Hinweis „mit PIN geschützt“ (`hinweis`).

### `eigene`

Bis zu drei eigene Seiten (Einstellungen → Displays → „Eigene Seiten“), je bis zu sechs Entitäten. Die Firmware zeigt
jede Seite im Dock nach den festen Seiten; `[]` blendet alle aus.

```json
[{"n": "Wohnzimmer", "i": "sofa",
  "k": [{"i": "lightbulb-on", "f": "#ffc457", "n": "Decke", "v": "an", "vf": "", "s": "Wohnzimmer"}]}]
```

Kacheln eigener Seiten haben auch `a`, `w` und `wa` wie bei `kacheln`.
`i` ist immer ein Symbol, das die Firmware kennt (`tools/icons.txt` im Firmware-Repository, `DISPLAY_ICONS` in
`display.py`); sonst nimmt die Integration eines passend zur Domäne. Felder der Kacheln wie bei `kacheln`.

### `kacheln`

Liste mit 1–4 Kacheln für die Startseite, in der eingestellten Reihenfolge:

```json
[{"k": "pv_jetzt", "i": "solar-power-variant", "f": "#ffc457", "n": "PV jetzt", "v": "3,2 kW", "vf": "#ffc457",
  "s": "Haus 612 W · Netz −2,4 kW", "b": 78, "bf": "#4fd18b", "u": "Akku 78 %", "hot": false}]
```

| Feld | Bedeutung |
|---|---|
| `k` | Kachelart (siehe unten) |
| `i`, `f` | Icon und Icon-Farbe |
| `n` | Überschrift (klein) |
| `v`, `vf` | Hauptwert und seine Farbe (`""` = Textfarbe) |
| `s` | Zeile darunter |
| `vr`, `sr` | wie `v`/`s`, aber mit farbigen Abschnitten im LVGL-Recolor-Format `#rrggbb Text#` (z. B. „Haus #63c7ff 612 W#“); Firmware ab 0.4.0 nimmt diese, ältere `v`/`s` |
| `b`, `bf` | Balken 0–100 und Farbe; `-1` = kein Balken |
| `u` | unterste Zeile (klein) |
| `hot` | hervorheben (gelber Rahmen, z. B. Mülltonne am Vorabend) |
| `a` | `true`: ein Tipp schaltet bzw. löst aus (`entity:`-Kacheln); die Firmware zeigt sofort „…“, bis der neue Zustand kommt (höchstens 4 s) |
| `w`, `wa` | per langem Tippen stellbar: aktueller Wert 0–100 und Art (`hell` = Helligkeit eines dimmbaren Lichts, `pos` = Position eines Rollos); fehlt `w`, ist die Kachel nicht stellbar. Der Regler schickt beim Loslassen `wert:<ziel>:<0–100>` |

Kachelarten: `pv_jetzt`, `energie_heute`, `klima_mittel`, `morgen` (Müll und Termine), `wetter`, `meldungen`,
`geraete`, `strompreis`, `entity:<entity_id>` (Zustand einer Entität; Tippen schaltet Licht, Schalter, Rollo, Schloss).

### `hinweis`

Eine Zeile unter den Kacheln oder `null` (Hinweiszeile in den Einstellungen aus):

```json
{"i": "weather-night", "f": "#ffc457", "n": "Gute Nacht", "s": "3 Punkte offen", "knopf": "Prüfen", "ziel": "seite:gute_nacht"}
```

Vorrang: Alarm, abends (ab 20 Uhr bis zum Nachtende) Gute-Nacht-Check mit offenen Punkten, sonst die wichtigste
Meldung, sonst ein fertiges Haushaltsgerät, sonst „Alles in Ordnung“ (ab 1.13.1). `ziel` beginnt mit `seite:` → Seite auf dem Display öffnen, sonst an den
Dienst schicken (siehe unten); leer = kein Knopf.

### `energie`

```json
{"pv": "3,2 kW", "haus": "612 W", "netz": "2,4 kW", "netz_n": "Einspeisung", "akku": "78 %", "akku_n": "lädt 200 W",
 "fluss": {"pv": 1, "netz": -1, "akku": 1, "haus": 1},
 "kpi": [["Autarkie heute", "72 %"], ["Eigenverbrauch", "41 %"], ["Preis jetzt", "28,4 ct"]]}
```

`fluss`: Richtung der Linien zur Mitte (1 = zur Mitte, −1 = von der Mitte weg, 0 = ruht). `{}` ohne Energiedaten.

### `klima`

Bis zu 8 Räume: `[{"n": "Bad", "t": "21,3°", "h": "62 %", "w": true}]` (`w` = Schimmelrisiko, lüften).

### `gute_nacht`

```json
{"n": 3, "txt": "3 Punkte sind noch offen.", "mehr": 0,
 "p": [{"g": "Garage & Tore", "i": "garage-open-variant", "n": "Garagentor", "s": "Einfahrt · offen",
        "knopf": "Schließen", "ziel": "gn:cover.garagentor"}]}
```

Höchstens 8 Punkte in `p`, `mehr` = weitere. Gruppen und Reihenfolge wie im Panel. `knopf` leer = nur Anzeige
(z. B. Fenstersensor).

### `haus`

```json
{"modus": "zuhause", "modi": [["zuhause", "Zuhause", "home-account"], ["nacht", "Nacht", "weather-night"], …],
 "meldungen": [{"l": "warn", "t": "Schlafzimmer · Fenster offen"}], "geraete": ["Waschmaschine fertig"]}
```

## Dienst `haus_visualisierung.display_tap`

```yaml
action: haus_visualisierung.display_tap
data: {display: haus-display-a1b2c3, ziel: "gn:light.kueche"}
```

`display` ist der Gerätename (Firmware ab 0.2.0) oder die Kennung (0.1.x).

| `ziel` | Wirkung |
|---|---|
| `gn:<entity_id>` | diesen Gute-Nacht-Punkt schließen bzw. ausschalten (nur wenn er gerade offen ist) |
| `gn_alle` | alle offenen Punkte mit Aktion schließen |
| `modus:<zuhause\|nacht\|abwesend\|urlaub>` | Hausmodus setzen (die Firmware zeigt vorher den Gute-Nacht-Check, wenn `gute_nacht.n > 0`) |
| `kachel:<0–3>` | Kachel angetippt: `entity:`-Kacheln schalten (Licht, Schalter, Lüfter, Abdeckung, Schloss, Helfer umschalten; Szene, Skript, Taster auslösen). Ab Firmware 0.4.0 öffnen Energie-, Klima-, Meldungs- und Geräte-Kacheln stattdessen ihre Seite, wenn sie eingeschaltet ist, und melden nichts. |
| `eigen:<seite>:<kachel>` | Kachel einer eigenen Seite angetippt (Seite 0–2, Kachel 0–5): schaltet wie eine `entity:`-Kachel |
| `wert:<kachel:N\|eigen:p:k>:<0–100>` | Regler nach langem Druck auf eine stellbare Kachel: Licht auf diese Helligkeit (0 = aus), Rollo auf diese Position |
| `klingel:tuer` | „Tür öffnen“ im Klingel-Overlay (nur während es klingelt): Türöffner aus Einstellungen → Klingel auslösen wie im Panel (Schloss öffnen, Schalter mit Impuls, Taste, Skript) |
| `pin:<ziffern>` | Eingabe im PIN-Tastenfeld, verschleiert mit `k` aus dem Bereich `pin`; `pin:` = abgebrochen |
| `geraet_ok` | fertige Haushaltsgeräte quittieren |
| `hallo` | Gerät ist (neu) verbunden: alle Bereiche neu schicken; nicht zugeordnetes Gerät bekommt `protokoll` = `""` |

Unbekannte Ziele und Displays werden ignoriert (Warnung im Log).

## Versionen und Kompatibilität

- Neue Felder, Kachelarten oder Ziele kommen **ohne** neue Protokollversion; die Firmware ignoriert Unbekanntes.
- Umbenennen, Entfernen oder geänderte Bedeutung erhöht die Version. Die Integration liefert dann nur noch die neue.

| Protokoll | Haus Visualisierung | ha-haus-display |
|---|---|---|
| 1 (PIN-Tastenfeld) | ab 1.20.0 | ab 0.7.0 |
| 1 (Stellen per langem Tippen, Rückmeldung beim Tippen, Wischen, Verbindungsanzeige) | ab 1.18.0 | ab 0.6.0 |
| 1 (Klingel-Overlay) | ab 1.16.0 | ab 0.5.0 |
| 1 (eigene Seiten, Bildschirmschoner, farbige Werte, Kacheln antippbar) | ab 1.15.0 | ab 0.4.0 |
| 1 (Push, Update über das Netz, API-Schlüssel je Gerät) | ab 1.14.0 | ab 0.3.0 |
| 1 (Push, Einrichten im Panel) | ab 1.13.0 | ab 0.2.0 |
| 1 (Abo der Entität) | ab 1.12.0 | 0.1.x |
