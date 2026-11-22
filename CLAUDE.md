# Hinweise für Claude-Sitzungen

Entwicklung, Tests, Versionen und Releases: siehe Abschnitt „Entwicklung“ in `README.md`. Antworten auf Deutsch.

## Tests während der Entwicklung
- Zwischendurch nur die betroffenen Prüfungen laufen lassen: `python3 tests/changed.py`
  (wählt anhand von `git diff` gegen `main` die Gruppen der Bedienprüfungen; `--zeigen` zeigt nur die Auswahl).
- Vor dem Pull Request bzw. wenn gemeinsam genutzte Module betroffen sind: alles, also `pytest` und
  `python3 tests/interact.py` ohne Angabe. Die CI am Pull Request führt ohnehin immer alles aus.
- Neue Bedienprüfungen gehören in einen Abschnitt in `tests/interact.py` (Funktion mit `@gruppe("…")`,
  beginnt mit `pg.goto(…)`, darf sich nicht auf Variablen anderer Abschnitte verlassen). Neue Gruppe oder neues
  Frontend-Modul mit eigener Gruppe: in `GRUPPEN_FUER` in `tests/changed.py` eintragen.
