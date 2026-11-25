#!/usr/bin/env python3
"""Neue Version setzen.

  python3 scripts/bump_version.py patch|minor|major|X.Y.Z [--commit] [--tag] [--immer]

Einzige Quelle ist manifest.json. Das Skript überträgt die Nummer nach const.py und ins
Frontend (frontend/modules/version.js) und macht aus „## Unveröffentlicht“ im CHANGELOG.md den neuen Versionsabschnitt.
Ohne Abschnitt „### Performance“ (Ergebnis von tests/perf/measure.py) wird keine Version gesetzt.
--immer (so ruft es der Release-Workflow auf): fehlt „### Performance“, gibt es nur eine Warnung; fehlt
„## Unveröffentlicht“, bekommt die neue Version einen leeren Abschnitt.
"""
import argparse
import datetime as dt
import re
import subprocess
import sys

from _versions import CHANGELOG, ROOT, manifest_version, write_version

UNRELEASED = "## Unveröffentlicht"
UNRELEASED_RE = re.compile(r"^## Unveröffentlicht[ \t]*$", re.M)  # nur die Überschrift, nicht Erwähnungen im Text


def next_version(cur: str, part: str) -> str:
    if re.fullmatch(r"\d+\.\d+\.\d+", part):
        return part
    major, minor, patch = (int(x) for x in cur.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise SystemExit(f"Unbekannt: {part}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("part")
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--tag", action="store_true")
    ap.add_argument("--immer", action="store_true")
    args = ap.parse_args()

    cur = manifest_version()
    new = next_version(cur, args.part)
    text = CHANGELOG.read_text(encoding="utf-8")
    today = dt.date.today().isoformat()
    m = UNRELEASED_RE.search(text)
    if m:
        section = text[m.end():].split("\n## ", 1)[0]
        if "### Performance" not in section:
            msg = "Im Abschnitt „Unveröffentlicht“ fehlt „### Performance“ – erst tests/perf/measure.py laufen lassen."
            if not args.immer:
                print(msg)
                return 1
            print(f"::warning::{msg}")
        text = f"{text[:m.end()]}\n\n## {new} – {today}{text[m.end():]}"
    elif args.immer:
        print("::warning::CHANGELOG.md hat keinen Abschnitt „## Unveröffentlicht“, die neue Version bekommt einen leeren.")
        head, sep, rest = text.partition("\n## ")
        text = f"{head.rstrip()}\n\n{UNRELEASED}\n\n## {new} – {today}\n- Keine Einträge.\n\n" + (sep.lstrip("\n") + rest if sep else "")
    else:
        print("CHANGELOG.md hat keinen Abschnitt „## Unveröffentlicht“.")
        return 1

    CHANGELOG.write_text(text, encoding="utf-8")
    write_version(new)
    print(f"{cur} → {new}")

    if args.commit:
        subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
        subprocess.run(["git", "commit", "-m", f"Version {new}"], cwd=ROOT, check=True)
    if args.tag:
        subprocess.run(["git", "tag", f"v{new}"], cwd=ROOT, check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
