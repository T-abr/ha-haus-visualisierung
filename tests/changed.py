"""Nur die Prüfungen ausführen, die zu geänderten oder neuen Dateien gehören (für die Entwicklung).

    python3 tests/changed.py            Änderungen gegenüber main prüfen (auch nicht committete und neue Dateien)
    python3 tests/changed.py --zeigen   nur anzeigen, was laufen würde
    python3 tests/changed.py --basis REF  gegen einen anderen Stand vergleichen (Standard: origin/main, sonst main)

Die Bedienprüfungen (tests/interact.py) sind in Gruppen aufgeteilt; aus den geänderten Dateien wird die
Auswahl bestimmt. Gemeinsam genutzte Module (Grundlagen, Modell, Panel, Stile …), das Harness und alles
Unbekannte im Frontend lösen alle Gruppen aus. Geänderte Abschnitte in tests/interact.py laufen selbst mit.
Die Backend-Tests (pytest) dauern nur Sekunden und laufen deshalb komplett, sobald Python-Code betroffen ist.

Die CI am Pull Request führt weiterhin immer alles aus.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = "custom_components/haus_visualisierung/frontend/"
ALLE = "*"

# Frontend-Datei (Pfad ab frontend/) → Gruppen der Bedienprüfungen (siehe python3 tests/interact.py --liste).
# Nicht aufgeführte Dateien im Frontend lösen alle Gruppen aus.
GRUPPEN_FUER = {
    # handy: prüft auf Raum- und Klimaseiten, dass nichts überlappt (Raum-Verläufe, Verlauf 24 h)
    "modules/klima.js": {"klima", "energie", "warnungen", "handy"},
    "modules/verlauf.js": {"verlauf", "klima", "energie", "handy"},
    "modules/energie.js": {"energie", "panels"},
    "modules/technik.js": {"technik"},
    "modules/strompreis.js": {"energie", "technik"},
    "modules/panel-alarmseite.js": {"alarme"},
    "modules/panel-klingel.js": {"klingel"},
    "modules/panel-wandpanel.js": {"wandpanel", "wetter"},
    "modules/wetter.js": {"wetter", "wandpanel", "kopfzeile", "prognose"},
    "modules/prognose.js": {"prognose"},
    "modules/gutenacht.js": {"gutenacht"},
    "modules/anwesenheit.js": {"anwesenheit"},
    "modules/termine.js": {"termine", "wandpanel", "kopfzeile"},
    "modules/rueckblick.js": {"rueckblick"},
    "modules/geraete.js": {"geraete"},
    "modules/wartung.js": {"wartung"},
    "modules/karten.js": set(),  # Karten für eigene Dashboards: keine Bedienprüfung, nur pytest (Importe)
    # alle Gruppen: grundlagen, modell, basis, bausteine, aktualisierer, bindungen, hausschnitt, stile,
    # warnungen, version, panel.js, panel-ansichten, panel-aktionen, panel-einstellungen, panel-kompakt
}

# Dateien, die alle Bedienprüfungen betreffen (außer dem Frontend selbst)
HARNESS = ("tests/harness/", "tests/harness_server.py", "tests/overlap.js", "tests/requirements.txt")


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def basis_ref(wunsch):
    for ref in ([wunsch] if wunsch else ["origin/main", "main"]):
        try:
            return git("merge-base", "HEAD", ref).strip()
        except subprocess.CalledProcessError:
            continue
    sys.exit(f"Vergleichsstand nicht gefunden ({wunsch or 'origin/main, main'}). Mit --basis REF angeben.")


def geaendert(base):
    """Geänderte Dateien seit base: Commits, Arbeitsverzeichnis und neue, noch nicht erfasste Dateien."""
    files = set(git("diff", "--name-only", base).split())
    files |= set(git("ls-files", "--others", "--exclude-standard").split())
    return sorted(files)


def interact_abschnitte(base):
    """Abschnitte (Funktionsnamen) in tests/interact.py, deren Zeilen sich geändert haben; ALLE bei Änderungen außerhalb."""
    path = "tests/interact.py"
    if path in git("ls-files", "--others", "--exclude-standard").split():
        return ALLE
    lines = (ROOT / path).read_text(encoding="utf-8").split("\n")
    # Bereiche: von @gruppe bis vor das nächste @gruppe bzw. die erste Funktion danach (def auswahl)
    starts = [(i + 1, re.match(r"def (\w+)\(", lines[i + 1]).group(1))
              for i, s in enumerate(lines) if s.startswith("@gruppe(")]
    ends = [i for i, s in enumerate(lines) if s.startswith("def ") and i > (starts[-1][0] if starts else 0)]
    stop = ends[0] if ends else len(lines)
    ranges = [(a, (starts[k + 1][0] - 1 if k + 1 < len(starts) else stop), name) for k, (a, name) in enumerate(starts)]
    found = set()
    for m in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", git("diff", "-U0", base, "--", path), re.M):
        # neue Zeilen first … last (0-basiert); bei reiner Löschung (count 0) die Zeile davor
        first = int(m.group(1)) - 1
        last = first + max(int(m.group(2) or 1), 1) - 1
        hit = [name for a, e, name in ranges if a - 1 <= last and first < e]
        if not hit or not all(any(a - 1 <= i < e for a, e, _ in ranges) for i in (first, last)):
            return ALLE
        found.update(hit)
    return found


def plan(base):
    files = geaendert(base)
    gruppen, abschnitte, gruende, pytest = set(), set(), [], False
    for f in files:
        if f.endswith(".py") and (f.startswith("custom_components/") or f.startswith("tests/backend/")) \
                or f in ("pytest.ini", "tests/requirements.txt"):
            pytest = True
        if f.startswith(FRONTEND):
            pytest = True  # test_frontend.py prüft Importe und Auslieferung der Module
            rel = f[len(FRONTEND):]
            g = GRUPPEN_FUER.get(rel, ALLE)
            if g == ALLE:
                gruende.append(f"{f} → alle Gruppen")
                gruppen = ALLE
            elif gruppen != ALLE:
                gruppen |= g
        elif f.startswith(HARNESS):
            gruende.append(f"{f} → alle Gruppen")
            gruppen = ALLE
        elif f == "tests/interact.py":
            a = interact_abschnitte(base)
            if a == ALLE:
                gruende.append(f"{f} (außerhalb der Abschnitte) → alle Gruppen")
                gruppen = ALLE
            else:
                abschnitte |= a
    return files, gruppen, abschnitte, gruende, pytest


def main():
    args = sys.argv[1:]
    zeigen = "--zeigen" in args
    wunsch = args[args.index("--basis") + 1] if "--basis" in args else None
    base = basis_ref(wunsch)
    files, gruppen, abschnitte, gruende, pytest = plan(base)

    print(f"Vergleich mit {git('log', '-1', '--format=%h %s', base).strip()}")
    print(f"Geändert: {len(files)} Datei(en)" + ("".join(f"\n  {f}" for f in files) if len(files) <= 15 else ""))
    for g in gruende[:5]:
        print(f"  {g}")
    if len(gruende) > 5:
        print(f"  … und {len(gruende) - 5} weitere Dateien, die alle Gruppen auslösen")
    if gruppen == ALLE:
        auswahl = []  # leer = alle Abschnitte
        bedien = "alle"
    else:
        auswahl = sorted(gruppen) + sorted(abschnitte)
        bedien = " ".join(auswahl) if auswahl else "keine"
    run_bedien = gruppen == ALLE or bool(auswahl)
    print(f"Backend-Tests (pytest): {'ja' if pytest else 'nein'}")
    print(f"Bedienprüfungen: {bedien}")
    if zeigen:
        return 0

    py = sys.executable
    steps = [[py, "scripts/check_version.py"]]
    if pytest:
        steps.append([py, "-m", "pytest", "-q"])
    if run_bedien:
        steps.append([py, "tests/interact.py", *auswahl])
    rc = 0
    for cmd in steps:
        print(f"\n$ {' '.join(Path(c).name if c == py else c for c in cmd)}", flush=True)
        rc = subprocess.run(cmd, cwd=ROOT).returncode or rc
    return rc


if __name__ == "__main__":
    sys.exit(main())
