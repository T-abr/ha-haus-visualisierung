#!/usr/bin/env python3
"""Installations-ZIP bauen: dist/haus_visualisierung_v<version>.zip

Neben jede JavaScript-Datei des Frontends kommt eine vorgepackte .js.gz. Home Assistant (aiohttp) liefert sie
Browsern aus, die gzip annehmen; das spart rund zwei Drittel der Übertragung (ohne eigenen Build-Schritt).
"""
import gzip
import subprocess
import sys
import zipfile

from _versions import COMP, ROOT, manifest_version

FRONTEND = COMP / "frontend"


def main() -> int:
    if subprocess.run([sys.executable, str(ROOT / "scripts" / "check_version.py")]).returncode:
        return 1
    v = manifest_version()
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / f"haus_visualisierung_v{v}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(COMP.rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts and f.suffix != ".pyc":
                z.write(f, f.relative_to(ROOT))
                if f.suffix == ".js" and FRONTEND in f.parents:
                    # mtime=0: gleiche Eingabe ergibt dieselbe Datei; ZIP_STORED, gepackt ist sie schon
                    data = gzip.compress(f.read_bytes(), compresslevel=9, mtime=0)
                    z.writestr(str(f.relative_to(ROOT)) + ".gz", data, compress_type=zipfile.ZIP_STORED)
        for extra in ("CHANGELOG.md", "README.md"):
            if (ROOT / extra).exists():
                z.write(ROOT / extra, extra)
    print(f"✓ {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
