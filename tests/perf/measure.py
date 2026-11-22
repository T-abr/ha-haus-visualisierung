"""Performance-Messung der Haus Visualisierung (python3 tests/perf/measure.py).

Messaufbau: 4 Etagen × 6 Räume, je Raum 6 Lichter, 2 Rollos, Thermostat, Temperatur,
Feuchte, Fensterkontakt, Bewegungsmelder, Batterie (≈ 400 Entitäten) plus 300 fremde
Sensoren. Alle 250 ms ändert sich ein Zustand – abwechselnd ein fremder Sensor und
eine Entität aus den Räumen. Werte werden auf eine Minute hochgerechnet.
"""
import functools
import http.server
import json
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parents[1] / "harness"
SECONDS = 20
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_port}/index.html?big"

JS_RUN = """async (seconds) => {
  const p = window.__panel, api = window.__api;
  const root = p.shadowRoot;
  let mutations = 0;
  const mo = new MutationObserver((l) => { mutations += l.length; });
  mo.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  window.__setterTimes = [];
  const s0 = { ...p._stats };
  const room = Object.keys(api.hass.states).filter((e) => /^(light|cover|binary_sensor|sensor\\.a)/.test(e));
  const foreign = Object.keys(api.hass.states).filter((e) => e.startsWith("sensor.fremd_"));
  let i = 0;
  await new Promise((res) => {
    const t = setInterval(() => {
      i++;
      if (i % 2) { const e = foreign[(i * 7) % foreign.length]; api.set(e, Math.round(Math.random() * 1000)); }
      else {
        const e = room[(i * 13) % room.length];
        const st = api.hass.states[e];
        if (e.startsWith("light.") || e.startsWith("binary_sensor.")) api.set(e, st.state === "on" ? "off" : "on");
        else if (e.startsWith("cover.")) api.set(e, "open", { current_position: Math.round(Math.random() * 100) });
        else api.set(e, (20 + Math.random() * 3).toFixed(1));
      }
      if (i >= seconds * 4) { clearInterval(t); setTimeout(res, 300); }
    }, 250);
  });
  mo.disconnect();
  const st = window.__setterTimes;
  const avg = st.reduce((a, b) => a + b, 0) / st.length;
  return { changes: i, setterAvgUs: Math.round(avg * 1000), setterMaxUs: Math.round(Math.max(...st) * 1000),
           updates: p._stats.updates - s0.updates, renders: p._stats.renders - s0.renders, mutations, watched: p._binds.size };
}"""

rows = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for view in ["", "ov=cockpit", "ov=fokus", "raum/a1_1", "licht", "klima", "alarme"]:
        pg = b.new_page(viewport={"width": 1440, "height": 1000})
        pg.goto(base + (f"&{view}" if view.startswith("ov=") else f"&view={view}" if view else ""))
        pg.wait_for_timeout(800)
        t0 = pg.evaluate("""() => { const p = window.__panel; const t = performance.now(); p._dirty = true; p._flush(); return performance.now() - t; }""")
        r = pg.evaluate(JS_RUN, SECONDS)
        # Setter einzeln messen: performance.now() ist im Browser auf 0,1 ms gerundet,
        # daher 2000 Aufrufe mit wechselnden Zuständen am Stück.
        bench = pg.evaluate("""() => {
          const p = window.__panel, api = window.__api;
          const h1 = { ...api.hass }, e = "sensor.fremd_1";
          const h2 = { ...h1, states: { ...h1.states, [e]: { ...h1.states[e], state: "x" } } };
          const n = 2000, t = performance.now();
          for (let i = 0; i < n; i++) p.hass = i % 2 ? h2 : h1;
          const us = (performance.now() - t) * 1000 / n;
          p._pending.clear();
          return Math.round(us * 10) / 10;
        }""")
        r["setterAvgUs"] = bench
        f = 60 / SECONDS
        rows.append({"Seite": {"": "Übersicht Hausschnitt", "ov=cockpit": "Übersicht Cockpit", "ov=fokus": "Übersicht Aktiv-Fokus"}.get(view, view), "Aufbau ms": round(t0, 1), "beobachtete Entitäten": r["watched"],
                     "Aktualisierer/min": round(r["updates"] * f), "DOM-Änderungen/min": round(r["mutations"] * f),
                     "Neuaufbauten/min": round(r["renders"] * f), "hass-Setter Ø µs": r["setterAvgUs"]})
        pg.close()
    b.close()
srv.shutdown()

keys = list(rows[0].keys())
print("| " + " | ".join(keys) + " |")
print("| " + " | ".join("---" for _ in keys) + " |")
for r in rows:
    print("| " + " | ".join(str(r[k]) for k in keys) + " |")
if "--json" in sys.argv:
    print(json.dumps(rows, ensure_ascii=False))
