#!/usr/bin/env python3
"""Abschnitt einer Version aus CHANGELOG.md ausgeben (für die Release-Beschreibung).

  python3 scripts/release_notes.py [X.Y.Z]   (ohne Angabe: Version aus manifest.json)
"""
import sys

from _versions import CHANGELOG, manifest_version


def notes(version: str) -> str | None:
    text = CHANGELOG.read_text(encoding="utf-8")
    head = f"## {version} "
    for block in text.split("\n## ")[1:]:
        if ("## " + block).startswith(head):
            return block.split("\n", 1)[1].strip() if "\n" in block else ""
    return None


def main() -> int:
    version = sys.argv[1] if len(sys.argv) > 1 else manifest_version()
    body = notes(version)
    if body is None:
        print(f"CHANGELOG.md hat keinen Abschnitt für {version}.", file=sys.stderr)
        return 1
    print(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
