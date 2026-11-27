#!/usr/bin/env python3
"""Installations-ZIPs bauen:
- dist/haus_visualisierung_v<version>.zip – zum Entpacken in /config (enthält custom_components/haus_visualisierung/)
- dist/haus_visualisierung.zip – für HACS (hacs.json: zip_release): Inhalt des Integrationsordners ohne Pfad davor

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
    hacs = dist / "haus_visualisierung.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z, zipfile.ZipFile(hacs, "w", zipfile.ZIP_DEFLATED) as zh:
        for f in sorted(COMP.rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts and f.suffix != ".pyc":
                z.write(f, f.relative_to(ROOT))
                zh.write(f, f.relative_to(COMP))
                if f.suffix == ".js" and FRONTEND in f.parents:
                    # mtime=0: gleiche Eingabe ergibt dieselbe Datei; ZIP_STORED, gepackt ist sie schon
                    data = gzip.compress(f.read_bytes(), compresslevel=9, mtime=0)
                    z.writestr(str(f.relative_to(ROOT)) + ".gz", data, compress_type=zipfile.ZIP_STORED)
                    zh.writestr(str(f.relative_to(COMP)) + ".gz", data, compress_type=zipfile.ZIP_STORED)
        for extra in ("CHANGELOG.md", "README.md"):
            if (ROOT / extra).exists():
                z.write(ROOT / extra, extra)
    print(f"✓ {out.relative_to(ROOT)}")
    print(f"✓ {hacs.relative_to(ROOT)} (HACS)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
