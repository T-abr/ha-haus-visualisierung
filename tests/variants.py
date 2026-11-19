"""Screenshots der Übersichts-Varianten (python3 tests/variants.py [Ordner])."""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent / "harness"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hv-var"); OUT.mkdir(parents=True, exist_ok=True)
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h); threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for ov in ["haus", "cockpit", "spalten", "fokus"]:
        for name, size in [("desktop", (1440, 900)), ("mobil", (400, 860))]:
            pg = b.new_page(viewport={"width": size[0], "height": size[1]})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://127.0.0.1:{srv.server_port}/index.html?ov={ov}"); pg.wait_for_timeout(700)
            pg.screenshot(path=str(OUT / f"{ov}-{name}.png"))
            pg.close()
    b.close()
print("Fehler:", errs or "keine")
