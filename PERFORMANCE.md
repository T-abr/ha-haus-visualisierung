# Performance-Prüfliste

Jede Version bekommt eine Performance-Runde. Ergebnis gehört ins CHANGELOG unter „### Performance“ –
ohne diesen Abschnitt setzt `scripts/bump_version.py` keine neue Version (`--immer` macht daraus nur eine Warnung).

## Messen

```bash
# einmalig: Symbole für das Test-Harness
npm i @mdi/js && cp node_modules/@mdi/js/mdi.js tests/harness/
pip install playwright && playwright install chromium

python3 tests/perf/measure.py     # Tabelle für das CHANGELOG
python3 tests/interact.py         # Bedientest
python3 tests/screens.py /tmp/hv  # Screenshots aller Seiten
pytest                            # Backend mit echtem Home Assistant (pytest-homeassistant-custom-component)
```

## Prüfliste

- [ ] Kein Neuaufbau bei Zustandsänderungen (Spalte „Neuaufbauten/min“ = 0)
- [ ] hass-Setter auf der Übersicht unter 50 µs
- [ ] DOM-Änderungen nur für geänderte Entitäten (keine Änderung bei fremden Sensoren)
- [ ] Keine Timer, die bei verstecktem Tab weiterlaufen und Arbeit machen
- [ ] Kamera-Standbilder nur für sichtbare Kameras, kein Flackern (Bild wird erst nach dem Laden getauscht)
- [ ] Keine zusätzlichen Websocket-Abfragen pro Zustandsänderung
- [ ] Glas-Effekt abschaltbar (schwache Tablets)
