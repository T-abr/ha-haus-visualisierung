"""Gemeinsamer Webserver und Browserstart für die Bedien- und Screenshot-Prüfungen.

Der Server liefert tests/harness/ aus. Unter /haus-visualisierung.js liefert er direkt die
echte Frontend-Datei der Integration, damit nie eine veraltete Kopie getestet wird. Sie liegt
bewusst auf derselben Ebene wie das Harness, damit relative Importe (z. B. ./test-panels.js)
wie bisher aufgelöst werden.
"""
import functools
import http.server
import os
import threading
from pathlib import Path

HARNESS = Path(__file__).parent / "harness"
PANEL = Path(__file__).parents[1] / "custom_components" / "haus_visualisierung" / "frontend" / "haus-visualisierung.js"


class _Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.split("?", 1)[0].split("#", 1)[0] == "/" + PANEL.name:
            return str(PANEL)
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
