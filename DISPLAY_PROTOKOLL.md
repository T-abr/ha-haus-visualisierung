# Wanddisplay-Protokoll (Version 1)

Schnittstelle zwischen der Integration **Haus Visualisierung** (dieses Repository) und kleinen Wanddisplays, z. B.
einem 4-Zoll-ESP32-S3 mit ESPHome. Die Firmware dafür liegt im Repository
[ha-haus-display](https://github.com/T-abr/ha-haus-display).

Grundidee: Das Display ist ein **Client**. Alles Rechnen (Gute-Nacht-Check, Müll, Energie, Raumklima, Meldungen) und
alle Einstellungen bleiben in der Integration. Das Display zeigt nur fertig formatierte Texte, Farben und Icons an und
meldet Tipps zurück.

## Einrichten

1. Visualisierung → Einstellungen → **Displays** → „Display hinzufügen“, Name vergeben, Seiten und Kacheln wählen,
   speichern. Die Kennung (z. B. `flur`) steht unter dem Namen.
2. Die Integration legt `sensor.haus_display_<kennung>` an.
3. Firmware aus ha-haus-display flashen und dort `display_id: <kennung>` eintragen.
4. In Home Assistant beim ESPHome-Gerät „Darf Home-Assistant-Aktionen ausführen“ einschalten (sonst kommen Tipps nicht an).

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

Eine Zeile unter den Kacheln oder `null`:

```json
{"i": "weather-night", "f": "#ffc457", "n": "Gute Nacht", "s": "3 Punkte offen", "knopf": "Prüfen", "ziel": "seite:gute_nacht"}
```

Vorrang: Alarm, abends (ab 20 Uhr bis zum Nachtende) Gute-Nacht-Check mit offenen Punkten, sonst die wichtigste
Meldung, sonst ein fertiges Haushaltsgerät. `ziel` beginnt mit `seite:` → Seite auf dem Display öffnen, sonst an den
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
data: {display: flur, ziel: "gn:light.kueche"}
```

| `ziel` | Wirkung |
|---|---|
| `gn:<entity_id>` | diesen Gute-Nacht-Punkt schließen bzw. ausschalten (nur wenn er gerade offen ist) |
| `gn_alle` | alle offenen Punkte mit Aktion schließen |
| `modus:<zuhause\|nacht\|abwesend\|urlaub>` | Hausmodus setzen (die Firmware zeigt vorher den Gute-Nacht-Check, wenn `gute_nacht.n > 0`) |
| `kachel:<0–3>` | Kachel angetippt (schaltet bei `entity:`-Kacheln) |
| `geraet_ok` | fertige Haushaltsgeräte quittieren |

Unbekannte Ziele und Displays werden ignoriert (Warnung im Log).

## Versionen und Kompatibilität

- Neue Felder, Kachelarten oder Ziele kommen **ohne** neue Protokollversion; die Firmware ignoriert Unbekanntes.
- Umbenennen, Entfernen oder geänderte Bedeutung erhöht die Version. Die Integration liefert dann nur noch die neue.

| Protokoll | Haus Visualisierung | ha-haus-display |
|---|---|---|
| 1 | ab 1.12.0 | ab 0.1.0 |
