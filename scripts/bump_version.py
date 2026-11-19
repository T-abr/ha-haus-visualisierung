#!/usr/bin/env python3
"""Neue Version setzen.

  python3 scripts/bump_version.py patch|minor|major|X.Y.Z [--commit] [--tag]

Einzige Quelle ist manifest.json. Das Skript überträgt die Nummer nach const.py und ins
Frontend und macht aus „## Unveröffentlicht“ im CHANGELOG.md den neuen Versionsabschnitt.
Ohne Abschnitt „### Performance“ (Ergebnis von tests/perf/measure.py) wird keine Version gesetzt.
"""
import argparse
import datetime as dt
import re
import subprocess
import sys

from _versions import CHANGELOG, ROOT, manifest_version, write_version

UNRELEASED = "## Unveröffentlicht"


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
    args = ap.parse_args()

    cur = manifest_version()
    new = next_version(cur, args.part)
    text = CHANGELOG.read_text(encoding="utf-8")
    if UNRELEASED not in text:
        print("CHANGELOG.md hat keinen Abschnitt „## Unveröffentlicht“.")
        return 1
    section = text.split(UNRELEASED, 1)[1].split("\n## ", 1)[0]
    if "### Performance" not in section:
        print("Im Abschnitt „Unveröffentlicht“ fehlt „### Performance“ – erst tests/perf/measure.py laufen lassen.")
        return 1

    today = dt.date.today().isoformat()
    text = text.replace(UNRELEASED, f"{UNRELEASED}\n\n## {new} – {today}", 1)
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
