"""Gemeinsamer Webserver und Browserstart für die Bedien- und Screenshot-Prüfungen.

Der Server liefert tests/harness/ aus. Unter /haus-visualisierung.js und /modules/… liefert er
direkt das echte Frontend der Integration (Einstiegspunkt und Module), damit nie eine veraltete
Kopie getestet wird. Es liegt bewusst auf derselben Ebene wie das Harness, damit relative Importe
(z. B. ./test-panels.js) wie bisher aufgelöst werden.
"""
import functools
import http.server
import os
import threading
from pathlib import Path

HARNESS = Path(__file__).parent / "harness"
FRONTEND = Path(__file__).parents[1] / "custom_components" / "haus_visualisierung" / "frontend"
PANEL = FRONTEND / "haus-visualisierung.js"
MODULES = FRONTEND / "modules"


class _Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == "/" + PANEL.name:
            return str(PANEL)
        if p.startswith("/modules/"):
            f = (MODULES / p[len("/modules/"):]).resolve()
            if f.parent == MODULES.resolve():
                return str(f)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def start():
    """Server im Hintergrund starten. Gibt (Server, Basis-URL ohne Schrägstrich am Ende) zurück."""
    handler = functools.partial(_Handler, directory=str(HARNESS))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}"


def launch(p):
    """Chromium starten: $CHROME, sonst /usr/bin/google-chrome, sonst das Chromium von Playwright."""
    exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if Path("/usr/bin/google-chrome").exists() else None)
    return p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
