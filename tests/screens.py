"""Screenshots aller Seiten mit dem Test-Harness (python3 tests/screens.py)."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from harness_server import launch, start

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hv-shots")
KOMFORT = "--komfort" in sys.argv
OUT.mkdir(parents=True, exist_ok=True)

srv, ORIGIN = start()
base = f"{ORIGIN}/index.html"

VIEWS = [("overview", ""), ("raum", "raum/wohnzimmer"), ("heizungsraum", "raum/heizungsraum"), ("licht", "licht"),
         ("beschattung", "beschattung"), ("klima", "klima"), ("sicherheit", "sicherheit"), ("batterien", "batterien"), ("einstellungen", "einstellungen")]
errors = []
with sync_playwright() as p:
    b = launch(p)
    for name, view, size in [(n, v, (1440, 1000)) for n, v in VIEWS] + [("mobil-overview", "", (400, 860)), ("mobil-raum", "raum/wohnzimmer", (400, 860))]:
        pg = b.new_page(viewport={"width": size[0], "height": size[1]})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.goto(base + "?" + ("komfort&" if KOMFORT else "") + (f"view={view}" if view else ""))
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
        if name in ("overview", "raum"):
            pg.evaluate("document.querySelector('haus-visualisierung-panel').shadowRoot.querySelector('.main').style.height='auto'")
            h = pg.evaluate("document.querySelector('haus-visualisierung-panel').shadowRoot.querySelector('.wrap').scrollHeight")
            pg.set_viewport_size({"width": size[0], "height": min(int(h) + 80, 3000)})
            pg.wait_for_timeout(200)
            pg.screenshot(path=str(OUT / f"{name}-voll.png"))
        pg.close()
    b.close()
srv.shutdown()
print("Fehler:", errors if errors else "keine")
