# Firmware für die Wanddisplays

Fertig gebaute Firmware aus dem Repository [ha-haus-display](https://github.com/T-abr/ha-haus-display) (CI, Zweig
`firmware`), damit das Flashen aus dem Browser (Einstellungen → Displays) ohne Zugriff auf das private Repository
geht. Nicht von Hand ändern: bei einer neuen Firmware-Version die vier Dateien vom Zweig `firmware` hierher kopieren.

| Datei | Inhalt |
|---|---|
| `manifest.json` | Manifest für ESP Web Tools |
| `haus-display.factory.bin` | komplettes Abbild zum ersten Flashen (Bootloader, Partitionen, Firmware) |
| `haus-display.ota.bin` | nur die Firmware, für Updates über ESPHome |
| `version.txt` | Firmware-Version |
