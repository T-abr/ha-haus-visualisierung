"""Screenshots der Übersichts-Varianten (python3 tests/variants.py [Ordner])."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from harness_server import launch, start

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hv-var"); OUT.mkdir(parents=True, exist_ok=True)
srv, ORIGIN = start()
errs = []
with sync_playwright() as p:
    b = launch(p)
    for ov in ["haus", "cockpit", "spalten", "fokus"]:
        for name, size in [("desktop", (1440, 900)), ("mobil", (400, 860))]:
            pg = b.new_page(viewport={"width": size[0], "height": size[1]})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"{ORIGIN}/index.html?ov={ov}"); pg.wait_for_timeout(700)
            pg.screenshot(path=str(OUT / f"{ov}-{name}.png"))
            pg.close()
    b.close()
print("Fehler:", errs or "keine")
