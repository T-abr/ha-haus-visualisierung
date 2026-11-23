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
 "hell_tag": 80, "hell_nacht": 10, "wecken": true, "nacht": false}
```

`seiten`: Reihenfolge im Dock, `start` immer zuerst. `hell_*` in %, `hell_nacht` gilt, solange `nacht` (Hausmodus
„Nacht“) wahr ist; 0 = dunkel bis zur Berührung. `wecken`: bei neuer Alarm-Meldung hell schalten.

### `kopf`

```json
{"wetter": {"i": "weather-partly-cloudy", "t": "7°", "txt": "Teils bewölkt", "morgen": "morgen 15°"},
 "modus": {"k": "zuhause", "n": "Zuhause", "i": "home-account", "f": "#4fd18b"}}
```

`wetter` fehlt ohne Wetter-Entität. Die Uhrzeit nimmt die Firmware von Home Assistant (Zeitquelle).

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
| `b`, `bf` | Balken 0–100 und Farbe; `-1` = kein Balken |
| `u` | unterste Zeile (klein) |
| `hot` | hervorheben (gelber Rahmen, z. B. Mülltonne am Vorabend) |

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
| `kachel:<0–3>` | Kachel angetippt (schaltet bei `entity:`-Kacheln) |
| `geraet_ok` | fertige Haushaltsgeräte quittieren |
| `hallo` | Gerät ist (neu) verbunden: alle Bereiche neu schicken; nicht zugeordnetes Gerät bekommt `protokoll` = `""` |

Unbekannte Ziele und Displays werden ignoriert (Warnung im Log).

## Versionen und Kompatibilität

- Neue Felder, Kachelarten oder Ziele kommen **ohne** neue Protokollversion; die Firmware ignoriert Unbekanntes.
- Umbenennen, Entfernen oder geänderte Bedeutung erhöht die Version. Die Integration liefert dann nur noch die neue.

| Protokoll | Haus Visualisierung | ha-haus-display |
|---|---|---|
| 1 (Push, Update über das Netz, API-Schlüssel je Gerät) | ab 1.14.0 | ab 0.3.0 |
| 1 (Push, Einrichten im Panel) | ab 1.13.0 | ab 0.2.0 |
| 1 (Abo der Entität) | ab 1.12.0 | 0.1.x |
