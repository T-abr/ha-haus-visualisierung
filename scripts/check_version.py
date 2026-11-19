#!/usr/bin/env python3
"""Prüft, ob manifest.json, const.py und das Frontend dieselbe Version tragen."""
import sys

from _versions import found_versions


def main() -> int:
    found = found_versions()
    ref = found["manifest.json"]
    bad = {k: v for k, v in found.items() if v != ref}
    for k, v in found.items():
        print(f"{'✓' if v == ref else '✗'} {k}: {v}")
    if bad:
        print(f"Versionen stimmen nicht überein (Quelle: manifest.json = {ref}). Mit scripts/bump_version.py {ref} angleichen.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
