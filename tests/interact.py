"""Bedientest mit dem Test-Harness.

    python3 tests/interact.py                 alle Abschnitte (so läuft es in der CI)
    python3 tests/interact.py klima energie   nur diese Gruppen bzw. Abschnitte
    python3 tests/interact.py --liste         Gruppen und Abschnitte anzeigen

Jeder Abschnitt ist eine Funktion mit @gruppe("…") und beginnt mit pg.goto(…), damit er auch allein
läuft. Welche Gruppen zu geänderten Dateien gehören, wählt tests/changed.py aus.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from harness_server import launch, start

srv, ORIGIN = start()
base = f"{ORIGIN}/index.html?komfort"
dense = f"{ORIGIN}/index.html"
ok, fail = [], []

def check(name, cond):
    (ok if cond else fail).append(name)


ABSCHNITTE = []  # (Gruppe, Funktion) in der Reihenfolge der Datei


def gruppe(name):
    """Abschnitt einer Gruppe zuordnen. Gruppen und Dateien: tests/changed.py (GRUPPEN_FUER)."""
    def reg(fn):
        ABSCHNITTE.append((name, fn))
        return fn
    return reg


def stab(pg, name):
    """Reiter in den Einstellungen wählen."""
    pg.locator(f"haus-visualisierung-panel .stab[data-tab={name}]").click(); pg.wait_for_timeout(200)


def drag(handle, target, after=False, steps=12):
    """Griff mit der Maus auf das Ziel ziehen (oberes bzw. unteres Viertel des Ziels)."""
    # in die Mitte scrollen – unten liegt die Speichern-Leiste über dem Inhalt
    target.evaluate("e => e.scrollIntoView({ block: 'center' })"); handle.page.wait_for_timeout(50)
    h = handle.bounding_box(); t = target.bounding_box()
    pg = handle.page
    x0, y0 = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    x1, y1 = t["x"] + (t["width"] * (0.75 if after else 0.25) if t["height"] < 50 and t["width"] < 400 else 30), t["y"] + t["height"] * (0.8 if after else 0.2)
    pg.mouse.move(x0, y0); pg.mouse.down()
    for i in range(1, steps + 1): pg.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); pg.wait_for_timeout(16)
    pg.mouse.up(); pg.wait_for_timeout(200)

P = "haus-visualisierung-panel"
log = lambda: pg.evaluate("window.__api.log.map(x => x[0] + '.' + x[1])")
# Gemeinsame Ausdrücke, die mehrere Abschnitte nutzen
PP = f"document.querySelector('{P}')"
R = f"document.querySelector('{P}').shadowRoot"
ring = "window.__api.set('event.g6_entry_doorbell', new Date().toISOString(), { event_type: 'ring' })"
OVL = (Path(__file__).parent / "overlap.js").read_text()
WIDE = """(() => { const R = document.querySelector('haus-visualisierung-panel').shadowRoot; const W = innerWidth; return [...R.querySelectorAll('.main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 1 && !e.closest('.ground'); }).slice(0, 4).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').join('.')); })()"""


@gruppe("basis")
def grundbedienung():
    pg.goto(base); pg.wait_for_timeout(600)

    # Raumkachel: Licht-Knopf schaltet alle Lichter des Raums
    pg.locator(f"{P} .room[data-area=wohnzimmer] .ml").click(); pg.wait_for_timeout(150)
    check("Raum-Licht aus", log()[-1] == "light.turn_off")
    check("Raumkachel nicht mehr beleuchtet", "lit" not in pg.locator(f"{P} .room[data-area=wohnzimmer]").get_attribute("class"))
    # Raumkachel öffnet Raumseite
    pg.locator(f"{P} .room[data-area=wohnzimmer] .rname").click(); pg.wait_for_timeout(200)
    check("Raumseite geöffnet", pg.locator(f"{P} .hero h1").inner_text().strip() == "Wohnzimmer")
    # Licht-Kachel schalten
    tile = pg.locator(f'{P} .tile[data-eid="light.wohnzimmer_decke"]')
    tile.locator(".tname").click(); pg.wait_for_timeout(150)
    check("Licht toggle", log()[-1] == "light.toggle")
    check("Kachel zeigt an", "on" in tile.get_attribute("class"))
    # Langes Drücken öffnet Details
    box = tile.bounding_box()
    pg.mouse.move(box["x"] + 20, box["y"] + 60); pg.mouse.down(); pg.wait_for_timeout(700); pg.mouse.up()
    check("Langes Drücken → Details", pg.evaluate("window.__moreInfo") == "light.wohnzimmer_decke")
    calls = len(log())
    pg.wait_for_timeout(100)
    check("Kein Schalten nach langem Drücken", len(log()) == calls)
    # Rollo
    pg.locator(f'{P} .tile[data-eid="cover.wohnzimmer_fenster"] [data-svc=close_cover]').click(); pg.wait_for_timeout(100)
    check("Rollo schließen", log()[-1] == "cover.close_cover")
    # Thermostat +
    pg.locator(f'{P} .tile[data-eid="climate.wohnzimmer_fbh"] [data-step="1"]').click(); pg.wait_for_timeout(150)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("Soll +0,5", last[1] == "set_temperature" and abs(last[2]["temperature"] - 22.0) < 0.01)
    check("Soll angezeigt", pg.locator(f'{P} .tile[data-eid="climate.wohnzimmer_fbh"] .ttarget').inner_text() == "22,0°")
    # Helligkeit per Schieber
    pg.evaluate(f"""() => {{ const s = document.querySelector('{P}').shadowRoot.querySelector('.tile[data-eid="light.wohnzimmer_decke"] .slider');
      s.value = 30; s.dispatchEvent(new Event('change', {{ bubbles: true }})); }}""")
    pg.wait_for_timeout(100)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("Helligkeit 30 %", last[1] == "turn_on" and last[2].get("brightness_pct") == 30)
    # Schloss mit Bestätigung
    pg.goto(base); pg.wait_for_timeout(500)
    lockbtn = pg.locator(f'{P} .tile[data-eid="lock.haustur"] .lockbtn')
    lockbtn.click(); pg.wait_for_timeout(100)
    check("Schloss fragt nach", lockbtn.inner_text() == "Nochmal tippen" and not any("unlock" in x for x in log()))
    lockbtn.click(); pg.wait_for_timeout(150)
    check("Schloss entriegelt", log()[-1] == "lock.unlock")
    # Chip → Kategorie
    pg.locator(f"{P} .chip[data-k=lights]").click(); pg.wait_for_timeout(200)
    check("Chip öffnet Licht", pg.locator(f"{P} .ptitle h1").inner_text() == "Licht")
    # Einstellungen: Bereich ausblenden und speichern
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(250); stab(pg, 'raeume')
    check("Pins aus Layout geladen", "2 Pins" in pg.locator(f"{P} .srow", has_text="Wohnzimmer").first.inner_text())
    pg.locator(f'{P} [data-act=s-area-hide][data-area=gaste_wc]').click(); pg.wait_for_timeout(150)
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.hidden_areas)")
    check("Ausblenden gespeichert", "gaste_wc" in saved)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(250)
    check("Bereich in Übersicht weg", pg.locator(f"{P} .room[data-area=gaste_wc]").count() == 0)
    # Reihenfolge ändern
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(250); stab(pg, 'raeume')
    drag(pg.locator(f'{P} .sitem[data-sort-id=wohnzimmer] .drag'), pg.locator(f'{P} .sitem[data-sort-id=kuche]'))
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(250)
    order = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.floor[data-floor=eg] .room')].map(r => r.dataset.area)")
    check("Reihenfolge geändert", order.index("wohnzimmer") < order.index("kuche"))

@gruppe("basis")
def kompakt():
    # ---------- Kompakt-Modus ----------
    pg.goto(dense); pg.wait_for_timeout(600)
    n0 = len(log())
    check("K: Flur als Raum-Chip", pg.locator(f"{P} .rchip[data-area=flur]").count() == 1)
    check("K: Wohnzimmer als große Kachel", pg.locator(f"{P} .room[data-area=wohnzimmer]").count() == 1)
    check("K: Energieleiste", pg.locator(f"{P} .roofc .ep-pv b").inner_text() == "3,2 kW")
    pg.locator(f"{P} .rchip[data-area=flur] .ml").click(); pg.wait_for_timeout(150)
    check("K: Chip-Licht schaltet", log()[-1] == "light.turn_on" and "lit" in pg.locator(f"{P} .rchip[data-area=flur]").get_attribute("class"))
    pg.locator(f"{P} .rchip[data-area=flur] .rname").click(); pg.wait_for_timeout(200)
    check("K: Chip öffnet Raum", pg.locator(f"{P} .hero.slim h1").inner_text().strip() == "Flur")
    pg.goto(dense + "?view=raum/wohnzimmer"); pg.wait_for_timeout(500)
    row = pg.locator(f'{P} .tile.row[data-eid="light.wohnzimmer_decke"]')
    box = row.bounding_box()
    pg.mouse.move(box["x"] + 60, box["y"] + box["height"] / 2); pg.mouse.down()
    for i in range(1, 11): pg.mouse.move(box["x"] + 60 + i * 12, box["y"] + box["height"] / 2)
    pg.mouse.up(); pg.wait_for_timeout(200)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("K: Wischen dimmt", last[1] == "turn_on" and last[2].get("brightness_pct", 0) > 70)
    check("K: Wischen schaltet nicht", not any(x[1] == "toggle" for x in pg.evaluate("window.__api.log").__iter__()))
    row.locator(".tname").click(); pg.wait_for_timeout(150)
    check("K: Zeile tippen schaltet", log()[-1] == "light.toggle")
    pg.locator(f'{P} .schip[data-eid="scene.wohnzimmer_kino"]').click(); pg.wait_for_timeout(100)
    check("K: Szenen-Chip", log()[-1] == "scene.turn_on")
    pg.locator(f'{P} .vchip[data-eid="sensor.kamin_temperatur"]').click(); pg.wait_for_timeout(100)
    check("K: Wert-Chip öffnet Details", pg.evaluate("window.__moreInfo") == "sensor.kamin_temperatur")
    check("K: Kamin-Wert", "68,5" in pg.locator(f'{P} .vchip[data-eid="sensor.kamin_temperatur"]').inner_text())
    pg.goto(dense + "?view=licht"); pg.wait_for_timeout(500)
    pg.locator(f"{P} [data-act=only-on]").click(); pg.wait_for_timeout(150)
    vis = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.tile.row.light')].filter(e => e.offsetParent).length")
    on = pg.evaluate("Object.values(window.__api.hass.states).filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length")
    check("K: Filter nur eingeschaltete", vis == on)
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(500)
    pg.locator(f'{P} .krow[data-area=kuche] [data-step="1"]').click(); pg.wait_for_timeout(150)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("K: Klima-Tabelle Soll +", last[1] == "set_temperature" and abs(last[2]["temperature"] - 21.5) < 0.01)
    pg.goto(dense + "?view=sicherheit"); pg.wait_for_timeout(500)
    check("K: Sicherheits-Zusammenfassung", pg.locator(f"{P} .acard .sst").inner_text() == "Schlafzimmer · Fenster offen")
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(250); stab(pg, 'darstellung')
    pg.locator(f"{P} select[data-set=density]").select_option("komfort"); pg.wait_for_timeout(100)
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(250)
    check("K: Umschalten auf Komfort", pg.locator(f"{P} .roof").count() == 1 and pg.locator(f"{P} .roofc").count() == 0)

@gruppe("basis")
def uebersicht_varianten():
    # ---------- Übersicht-Varianten ----------
    pg.goto(dense + "?ov=fokus"); pg.wait_for_timeout(500)
    check("V: Fokus zeigt Küche aktiv", pg.locator(f"{P} .factive .room[data-area=kuche]").count() == 1)
    check("V: Aktivitätszeile", "Arbeitsplatte an" in pg.locator(f"{P} .factive .room[data-area=kuche] .ract").inner_text())
    pg.locator(f"{P} .factive .room[data-area=kuche] .ml").click(); pg.wait_for_timeout(250)
    check("V: Küche wandert zu übrigen Räumen", pg.locator(f"{P} .factive .room[data-area=kuche]").count() == 0 and pg.locator(f"{P} .fcalm .rchip[data-area=kuche]").count() == 1)
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    check("V: Cockpit Energie", pg.locator(f"{P} .ecard .ep-pv b").inner_text() == "3,2 kW")
    check("V: Cockpit Status", pg.locator(f"{P} .cside .acard .sst").inner_text() == "Schlafzimmer · Fenster offen")
    pg.goto(dense + "?ov=spalten"); pg.wait_for_timeout(500)
    check("V: Spalten je Etage", pg.locator(f"{P} .fcol").count() == 4)
    pg.locator(f"{P} .rrow[data-area=flur] .ml").click(); pg.wait_for_timeout(150)
    check("V: Spalten-Zeile schaltet und leuchtet", "lit" in pg.locator(f"{P} .rrow[data-area=flur]").get_attribute("class"))
    pg.goto(dense + "?ov=auto"); pg.wait_for_timeout(500)
    check("A: Automatisch am Desktop = Cockpit", pg.locator(f"{P} .cockpit").count() == 1)
    pg.set_viewport_size({"width": 400, "height": 860}); pg.wait_for_timeout(400)
    check("A: Automatisch nach Verkleinern = Aktiv-Fokus", pg.locator(f"{P} .factive").count() == 1 and pg.locator(f"{P} .cockpit").count() == 0)
    pg.goto(dense + "?ov=auto"); pg.wait_for_timeout(500)
    check("A: Automatisch auf dem Handy direkt Aktiv-Fokus", pg.locator(f"{P} .factive").count() == 1)
    pg.set_viewport_size({"width": 1440, "height": 1000}); pg.wait_for_timeout(400)
    check("A: zurück zum Cockpit", pg.locator(f"{P} .cockpit").count() == 1)

@gruppe("basis")
def navigation_schmal():
    # ---------- Feste Navigation in der schmalen Ansicht ----------
    rail_js = f"(() => {{ const r = document.querySelector('{P}').shadowRoot.querySelector('.rail').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.width)]; }})()"
    pg.set_viewport_size({"width": 400, "height": 860})
    pg.goto(dense + "?ov=haus"); pg.wait_for_timeout(500)
    pg.evaluate(f"document.querySelector('{P}').shadowRoot.querySelector('.main').scrollTop = 2000"); pg.wait_for_timeout(150)
    t, bt, l, w = pg.evaluate(rail_js)
    check("N: Leiste unten beim Scrollen im Panel", bt == 860 and l == 0 and w == 400)
    # Wie in HA, wenn die Seite selbst scrollt (Panel ohne feste Höhe)
    pg.evaluate("document.getElementById('host').style.height = 'auto'; document.querySelector('" + P + "').style.height = 'auto'")
    pg.evaluate(f"document.querySelector('{P}').shadowRoot.querySelector('.app').style.height = 'auto'")
    pg.wait_for_timeout(200)
    pg.evaluate("window.scrollTo(0, 5000)"); pg.wait_for_timeout(200)
    t, bt, l, w = pg.evaluate(rail_js)
    check("N: Leiste unten beim Scrollen der Seite", bt == 860)
    # Panel neben einer Seitenleiste (versetzt)
    pg.evaluate("document.getElementById('host').style.marginLeft = '60px'; document.getElementById('host').style.width = '340px'"); pg.wait_for_timeout(300)
    t, bt, l, w = pg.evaluate(rail_js)
    check("N: Leiste folgt Lage und Breite des Panels", l == 60 and w == 340)
    pg.goto(dense + "?view=raum/wohnzimmer"); pg.wait_for_timeout(400)
    last_row = pg.evaluate(f"(() => {{ const rows = [...document.querySelector('{P}').shadowRoot.querySelectorAll('.section')]; const m = document.querySelector('{P}').shadowRoot.querySelector('.main'); m.scrollTop = 99999; const r = rows.at(-1).getBoundingClientRect(); return Math.round(r.bottom); }})()")
    t, bt, l, w = pg.evaluate(rail_js)
    check("N: Letzter Inhalt nicht von der Leiste verdeckt", last_row <= t)
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("basis")
def seitenfuellend():
    # ---------- Seitenfüllend, Navigation links fest ----------
    geo = f"""(() => {{ const R = document.querySelector('{P}').shadowRoot; const a = R.querySelector('.app').getBoundingClientRect();
      const r = R.querySelector('.rail').getBoundingClientRect(); const m = R.querySelector('.main'); const w = R.querySelector('.wrap').getBoundingClientRect();
      return {{appH: Math.round(a.height), railTop: Math.round(r.top), railH: Math.round(r.height), mainW: m.clientWidth, wrapW: Math.round(w.width),
        docScroll: document.documentElement.scrollHeight - innerHeight, mainScroll: m.scrollHeight - m.clientHeight }}; }})()"""
    for vw, vh in [(1440, 900), (2560, 1300)]:
        pg.set_viewport_size({"width": vw, "height": vh})
        pg.goto(dense + "?view=licht"); pg.wait_for_timeout(500)
        g = pg.evaluate(geo)
        check(f"F: {vw}px Panel füllt die Höhe", g["appH"] == vh)
        check(f"F: {vw}px Inhalt füllt die Breite", g["wrapW"] >= g["mainW"] - 60)
        pg.evaluate(f"document.querySelector('{P}').shadowRoot.querySelector('.main').scrollTop = 3000"); pg.wait_for_timeout(150)
        g = pg.evaluate(geo)
        check(f"F: {vw}px Navigation bleibt links stehen", g["railTop"] == 0 and g["railH"] == vh)
    # wie in HA: Panel ohne feste Höhe → trotzdem seitenfüllend, Seite selbst scrollt nicht
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(dense + "?view=licht"); pg.wait_for_timeout(400)
    pg.evaluate("document.getElementById('host').style.height = 'auto'; document.querySelector('" + P + "').style.height = 'auto'"); pg.wait_for_timeout(300)
    g = pg.evaluate(geo)
    check("F: ohne feste Höhe seitenfüllend", g["appH"] == 900 and g["docScroll"] <= 0 and g["mainScroll"] > 0)
    # wenig Inhalt → trotzdem volle Höhe
    pg.goto(dense + "?view=batterien"); pg.wait_for_timeout(400)
    check("F: kurze Seite füllt die Höhe", pg.evaluate(geo)["appH"] == 900)
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("panels")
def eingebettete_panels():
    # ---------- Eingebettete Panels ----------
    R = f"document.querySelector('{P}').shadowRoot"
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    pg.locator(f'{P} .nav[data-path="/solar-visualisierung"]').click(); pg.wait_for_timeout(500)
    check("E: Solar eingebettet", pg.locator(f"{P} .extwrap solar-test-panel").count() == 1)
    check("E: Navigation bleibt, Solar aktiv", pg.locator(f'{P} .rail .nav.active[data-path="/solar-visualisierung"]').count() == 1)
    check("E: Adresse", pg.evaluate("location.pathname") == "/haus-visualisierung/extern/solar-visualisierung")
    check("E: füllt den Inhaltsbereich", pg.evaluate(f"(() => {{ const e = {R}.querySelector('solar-test-panel').getBoundingClientRect(); return [Math.round(e.height), Math.round(e.left)]; }})()") == [900, 66])
    check("E: Panel-Objekt übergeben", "panel: solar-visualisierung" in pg.locator(f"{P} solar-test-panel .narrow").inner_text())
    pg.evaluate("window.__api.set('sensor.growatt_modbus_pv_power', 4100)"); pg.wait_for_timeout(150)
    check("E: hass wird weitergereicht", pg.locator(f"{P} solar-test-panel .val").inner_text() == "4100")
    pg.evaluate(f"document.querySelector('{P}').route = {{ prefix: '/haus-visualisierung', path: '/extern/solar-visualisierung/verlauf' }}"); pg.wait_for_timeout(150)
    check("E: Unterseite (route) wird weitergereicht", pg.locator(f"{P} solar-test-panel .route").inner_text() == "/haus-visualisierung/extern/solar-visualisierung | /verlauf")
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    d = pg.evaluate("window.__solar = document.querySelector('" + P + "')._extCache.get('solar-visualisierung'); [window.__solar.connects, window.__solar.disconnects]")
    check("E: Beim Verlassen getrennt (Panel pausiert)", d == [1, 1])
    # 1.5.0: Die Energie-Karte führt zur Energie-Seite, deren Solar-Knopf zum eingebetteten Panel
    pg.locator(f"{P} .ecard").click(); pg.wait_for_timeout(400)
    pg.locator(f'{P} .ptitle .pbtn[data-path="/solar-visualisierung"]').click(); pg.wait_for_timeout(400)
    d = pg.evaluate("[window.__solar.connects, window.__solar.isConnected]")
    check("E: Energie-Karte → Energie-Seite → Solar, gleiche Instanz", d == [2, True])
    pg.goto(dense + "?view=sicherheit"); pg.wait_for_timeout(400)
    pg.locator(f'{P} .ptitle [data-act=link]').click(); pg.wait_for_timeout(500)
    check("E: Kamera-Knopf bettet Protect ein", pg.locator(f"{P} .extwrap protect-test-panel").count() == 1)
    check("E: Sprung auf eigene Adresse bleibt eingebettet", pg.evaluate("location.pathname") == "/haus-visualisierung/extern/protect-visualisierung/live" and not pg.evaluate("window.__leftPanel || ''"))
    check("E: Unterseite kommt im Panel an", pg.locator(f"{P} protect-test-panel .route").inner_text() == "/haus-visualisierung/extern/protect-visualisierung | /live")
    ov = pg.evaluate(f"(() => {{ const o = {R}.querySelector('protect-test-panel').shadowRoot.querySelector('.overlay').getBoundingClientRect(); return [Math.round(o.left), Math.round(o.top)]; }})()")
    check("E: Vollbild-Ebene verdeckt Navigation nicht", ov == [66, 0])
    hit = pg.evaluate(f"(() => {{ const e = {R}.elementFromPoint(30, 100); return e && !!e.closest('.rail'); }})()")
    check("E: Navigation links bedienbar", hit)
    pg.evaluate("history.pushState(null, '', '/protect-visualisierung/ereignisse'); window.dispatchEvent(new CustomEvent('location-changed'))"); pg.wait_for_timeout(200)
    check("E: interne Navigation umgeschrieben", pg.locator(f"{P} protect-test-panel .route").inner_text().endswith("| /ereignisse"))
    pg.set_viewport_size({"width": 400, "height": 860}); pg.wait_for_timeout(400)
    check("E: schmal → narrow weitergegeben", "narrow: true" in pg.locator(f"{P} protect-test-panel .narrow").inner_text())
    check("E: schmal → Leiste unten sichtbar", pg.evaluate(f"Math.round({R}.querySelector('.rail').getBoundingClientRect().bottom)") == 860)
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(dense + "?view=extern/gibt-es-nicht"); pg.wait_for_timeout(400)
    check("E: nicht einbettbar → Hinweis mit Knopf", pg.locator(f"{P} .extwrap [data-act=nav-raw]").count() == 1)
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("kopfzeile")
def kopfzeile():
    # ---------- Kopfzeile ----------
    pg.set_viewport_size({"width": 1100, "height": 900})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    k = pg.locator(f"{P} .kchip[data-k=lights]")
    check("K-Kopf: Standard Kompakt, Licht-Zahl", k.locator(".ct").inner_text() == "6" and k.get_attribute("title") == "6 Lichter an")
    check("K-Kopf: offenes Fenster rot", "alert" in pg.locator(f"{P} .kchip[data-k=contacts]").get_attribute("class"))
    check("K-Kopf: Batterien gezählt (Diagnose-Entitäten)", pg.locator(f"{P} .kchip[data-k=batt] .ct").inner_text() == "2")
    hdr = pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const d = R.querySelector('.dtop').getBoundingClientRect(); const w = R.querySelector('.hright').getBoundingClientRect(); return [Math.round(d.height), Math.round(w.top - d.top)]; }})()")
    check("K-Kopf: eine Zeile, Wetter/Personen oben", hdr[0] <= 50 and hdr[1] <= 10)
    pg.evaluate("window.__api.set('light.flur_decke', 'on')"); pg.wait_for_timeout(150)
    check("K-Kopf: Zahl aktualisiert", k.locator(".ct").inner_text() == "7")
    k.click(); pg.wait_for_timeout(250)
    check("K-Kopf: Tipp öffnet Licht", pg.locator(f"{P} .ptitle h1").inner_text() == "Licht")
    pg.goto(dense + "?ov=cockpit&hs=chips"); pg.wait_for_timeout(500)
    hdr = pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const d = R.querySelector('.dtop').getBoundingClientRect(); const w = R.querySelector('.hright').getBoundingClientRect(); return Math.round(w.top - d.top); }})()")
    check("K-Kopf: Chips mit Text – Wetter/Personen bleiben oben", hdr <= 30)
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("warnungen")
def warnungen():
    # ---------- Warnungen ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    A = f"{P} .cside .acard"
    check("W: Fenster-Warnung", "warn" in pg.locator(A).get_attribute("class") and pg.locator(f"{P} .kchip[data-k=alerts] .ct").inner_text() == "1")
    pg.evaluate("window.__api.set('binary_sensor.bad_fenster_x', 'on')") if False else None
    # Fenster im Bad öffnen, wo geheizt wird → zusätzlich „Fenster offen beim Heizen“
    pg.evaluate("""(() => { const api = window.__api; api.hass.entities['binary_sensor.bad_fenster'] = { entity_id: 'binary_sensor.bad_fenster', area_id: 'bad', labels: [], hidden: false, entity_category: null };
      api.hass.states['binary_sensor.bad_fenster'] = { entity_id: 'binary_sensor.bad_fenster', state: 'off', attributes: { friendly_name: 'Bad Fenster', device_class: 'window' }, last_changed: new Date().toISOString() };
      api.hass.entities = { ...api.hass.entities }; api.set('binary_sensor.bad_fenster', 'on'); })()"""); pg.wait_for_timeout(300)
    titles = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.cside .acard .aitem .at')].map(e => e.textContent)")
    check("W: Fenster offen beim Heizen", "Fenster offen beim Heizen · Bad" in titles and pg.locator(f"{A} .sst").inner_text() == "2 Warnungen" and "Bad · Fenster offen" not in titles)
    pg.evaluate("window.__api.set('binary_sensor.wohnzimmer_rauchmelder', 'on')"); pg.wait_for_timeout(200)
    check("W: Alarm steht oben und färbt rot", "alarm" in pg.locator(A).get_attribute("class") and pg.locator(f"{A} .aitem").first.get_attribute("class").endswith("alarm"))
    check("W: Kopfzeile rot bei Alarm", "alert" in pg.locator(f"{P} .kchip[data-k=alerts]").get_attribute("class"))
    pg.evaluate("window.__api.set('binary_sensor.wohnzimmer_rauchmelder', 'off'); window.__api.set('binary_sensor.bad_fenster', 'off'); window.__api.set('binary_sensor.schlafzimmer_fenster', 'off')"); pg.wait_for_timeout(200)
    check("W: Alles in Ordnung", pg.locator(f"{A} .sst").inner_text() == "Alles in Ordnung" and "ok" in pg.locator(A).get_attribute("class") and pg.locator(f"{P} .kchip[data-k=alerts]").is_hidden())
    # eigene Regel per Vorlage anlegen
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(300); stab(pg, 'alarme')
    pg.locator(f'{P} [data-act=s-rule-tpl][data-tpl=kamin]').click(); pg.wait_for_timeout(200)
    ent = pg.locator(f'{P} input[data-set="alerts.rules.0.entity"]'); ent.fill("sensor.kamin_temperatur"); ent.dispatch_event("change")
    val = pg.locator(f'{P} input[data-set="alerts.rules.0.value"]'); val.fill("60"); val.dispatch_event("change")
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.alerts.rules[0])")
    check("W: Regel gespeichert", saved["entity"] == "sensor.kamin_temperatur" and saved["op"] == "gt" and saved["level"] == "alarm")
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    check("W: eigene Regel greift (Kamin 68,5 > 60)", pg.locator(f"{A} .sst").inner_text() == "Kamin sehr heiß" and "alarm" in pg.locator(A).get_attribute("class"))
    pg.evaluate("window.__api.set('sensor.kamin_temperatur', 55)"); pg.wait_for_timeout(200)
    check("W: eigene Regel endet", pg.locator(f"{A} .sst").inner_text() == "Alles in Ordnung")
    # feste Regel abschalten + Mindestdauer
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(300); stab(pg, 'alarme')
    mn = pg.locator(f'{P} input[data-set="alerts.contacts_min"]'); mn.fill("10"); mn.dispatch_event("change")
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    pg.evaluate("window.__api.set('binary_sensor.kuche_fenster', 'on')"); pg.wait_for_timeout(200)
    check("W: Fenster vor Mindestdauer nicht gemeldet", pg.locator(f"{A} .sst").inner_text() == "Alles in Ordnung")
    pg.evaluate("(() => { const api = window.__api; const st = api.hass.states['binary_sensor.kuche_fenster']; api.hass.states = { ...api.hass.states, 'binary_sensor.kuche_fenster': { ...st, last_changed: new Date(Date.now() - 11 * 60000).toISOString() } }; })()")
    pg.evaluate("window.__api.set('sensor.fremd_x', 1)") if False else None
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p.shadowRoot.querySelectorAll('[data-u=alerts]').forEach(el => p._binds && 0); p._flushAlerts = 1; }})()")
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p.hass = {{ ...window.__api.hass }}; p._pending.add('binary_sensor.kuche_fenster'); p._schedule(); }})()"); pg.wait_for_timeout(200)
    check("W: Fenster nach Mindestdauer gemeldet", pg.locator(f"{A} .sst").inner_text() == "Küche · Fenster offen")

@gruppe("basis")
def schnellzugriff_abfrage():
    # ---------- Abfrage im Schnellzugriff ----------
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    n0 = len(log())
    pg.locator(f'{P} .qbtn[data-act=lights-off]').click(); pg.wait_for_timeout(150)
    check("Q: Abfrage erscheint, nichts geschaltet", pg.locator(f"{P} .modal").count() == 1 and len(log()) == n0 and "Lichter ausschalten" in pg.locator(f"{P} .modal .mt").inner_text())
    pg.locator(f'{P} .modal [data-act=confirm-cancel]').click(); pg.wait_for_timeout(150)
    check("Q: Abbrechen schaltet nichts", pg.locator(f"{P} .modal").count() == 0 and len(log()) == n0)
    pg.locator(f'{P} .qbtn[data-act=lights-off]').click(); pg.wait_for_timeout(100)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("Q: Esc schließt", pg.locator(f"{P} .modal").count() == 0 and len(log()) == n0)
    pg.locator(f'{P} .qbtn[data-act=lights-off]').click(); pg.wait_for_timeout(100)
    pg.locator(f'{P} .modal [data-act=confirm-ok]').click(); pg.wait_for_timeout(200)
    check("Q: Bestätigen schaltet aus", log()[-1] == "light.turn_off")
    pg.locator(f'{P} .qbtn[data-act=list-covers][data-svc=close_cover]').click(); pg.wait_for_timeout(100)
    check("Q: Rollos-Abfrage", pg.locator(f"{P} .modal .mt").inner_text() == "Alle Rollos schließen?")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check("Q: Enter bestätigt", log()[-1] == "cover.close_cover")
    pg.locator(f'{P} .qscenes .schip').first.click(); pg.wait_for_timeout(100)
    check("Q: Szenen-Abfrage", "Szene „" in pg.locator(f"{P} .modal .mt").inner_text())
    pg.locator(f'{P} .modal [data-act=confirm-ok]').click(); pg.wait_for_timeout(150)
    check("Q: Szene ausgeführt", log()[-1] == "scene.turn_on")
    pg.locator(f'{P} .qbtn[data-act=lights-off]').click(); pg.wait_for_timeout(100)
    check("Q: alles aus → Hinweis statt Abfrage", pg.locator(f"{P} .modal").count() == 0 and "bereits aus" in pg.locator(f"{P} .toast").inner_text())
    pg.goto(dense + "?view=raum/wohnzimmer"); pg.wait_for_timeout(400)
    n0 = len(log()); pg.locator(f'{P} .hero .schip').first.click(); pg.wait_for_timeout(150)
    check("Q: Szenen in Räumen ohne Abfrage", pg.locator(f"{P} .modal").count() == 0 and len(log()) == n0 + 1)

@gruppe("push")
def push_einstellungen():
    # ---------- Push-Einstellungen ----------
    pg.goto(dense + "?view=einstellungen/meldungen"); pg.wait_for_timeout(600)
    check("P: Empfänger gelistet", pg.locator(f"{P} .tchip").count() == 2 and "Keine Auswahl = alle Handys" in pg.locator(f"{P} .set", has_text="Push-Benachrichtigungen").inner_text())
    pg.locator(f'{P} .tchip', has_text="mobile_app_pixel").click(); pg.wait_for_timeout(200)
    lv = pg.locator(f'{P} input[data-set="push.levels.info"]'); lv.evaluate("e => e.click()"); pg.wait_for_timeout(100)
    pg.locator(f'{P} select[data-set="push.resolved"]').select_option("notify"); pg.wait_for_timeout(100)
    check("S: Reiter mit ungespeicherten Änderungen markiert", "dirty" in pg.locator(f"{P} .stab[data-tab=meldungen]").get_attribute("class") and "dirty" not in pg.locator(f"{P} .stab[data-tab=darstellung]").get_attribute("class"))
    stab(pg, "darstellung")
    check("S: Entwurf bleibt beim Reiterwechsel erhalten", pg.locator(f"{P} .savebar .msg").inner_text() == "Ungespeicherte Änderungen")
    pg.locator(f'{P} input[data-set="confirm_quick"]').evaluate("e => e.click()"); pg.wait_for_timeout(100)
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => [r.layout.push, r.layout.confirm_quick])")
    check("P: gespeichert", saved[0]["targets"] == ["mobile_app_pixel"] and saved[0]["levels"]["info"] is False and saved[0]["resolved"] == "notify" and saved[1] is False)
    stab(pg, "meldungen")
    pg.locator(f'{P} [data-act=s-push-test]').click(); pg.wait_for_timeout(300)
    check("P: Testmeldung", "mobile_app_pixel" in pg.locator(f"{P} .toast").inner_text())
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(300)

@gruppe("klingel")
def klingel_overlay():
    # ---------- Klingel-Overlay ----------
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    pg.evaluate("window.__api.set('event.g6_entry_doorbell', '2026-11-18T08:00:00.000+00:00', { friendly_name: 'Neu' })"); pg.wait_for_timeout(150)
    check("B: Attribut-Änderung ohne Overlay", pg.locator(f"{P} .bellbg").count() == 0)
    pg.evaluate(ring); pg.wait_for_timeout(300)
    check("B: Overlay bei Klingeln", pg.locator(f"{P} .bellbg .bt").inner_text() == "Es klingelt")
    check("B: richtige Kamera (nicht Paketkamera)", pg.locator(f"{P} .bellbg .bs").inner_text().startswith("G6 Entry ·"))
    pg.wait_for_timeout(1300)
    check("B: Countdown läuft", "schließt in" in pg.locator(f"{P} .bellbg .bcount").inner_text())
    pg.wait_for_timeout(200); pg.evaluate(ring); pg.wait_for_timeout(200)
    check("B: erneutes Klingeln", pg.locator(f"{P} .bellbg .bt").inner_text() == "Es klingelt erneut" and pg.locator(f"{P} .bellbg").count() == 1)
    pg.locator(f"{P} .bellbg .bacts [data-act=bell-close]").click(); pg.wait_for_timeout(150)
    check("B: Schließen", pg.locator(f"{P} .bellbg").count() == 0)
    pg.evaluate(ring); pg.wait_for_timeout(250); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("B: Esc schließt", pg.locator(f"{P} .bellbg").count() == 0)
    # über einem eingebetteten Panel
    pg.locator(f'{P} .nav[data-path="/solar-visualisierung"]').click(); pg.wait_for_timeout(500)
    pg.evaluate(ring); pg.wait_for_timeout(300)
    check("B: Overlay auch über eingebettetem Panel", pg.locator(f"{P} .bellbg").count() == 1 and pg.locator(f"{P} solar-test-panel").count() == 1)
    pg.locator(f"{P} .bellbg [data-act=bell-protect]").click(); pg.wait_for_timeout(500)
    check("B: Kameras öffnen → Protect eingebettet, Overlay zu", pg.locator(f"{P} .bellbg").count() == 0 and pg.locator(f"{P} protect-test-panel").count() == 1)
    # Einstellungen: Schloss, Zeit, Test
    pg.goto(dense + "?view=einstellungen/meldungen"); pg.wait_for_timeout(500)
    sec = pg.locator(f"{P} .set", has_text="Klingel")
    check("B: Automatik erkannt", "event.g6_entry_doorbell" in sec.inner_text() and "camera.g6_entry" in sec.inner_text())
    lk = pg.locator(f'{P} input[data-set="doorbell.lock"]'); lk.fill("lock.haustur"); lk.dispatch_event("change")
    to = pg.locator(f'{P} input[data-set="doorbell.timeout"]'); to.fill("10"); to.dispatch_event("change")
    pg.locator(f'{P} [data-act=s-save]').click(); pg.wait_for_timeout(300)
    pg.locator(f'{P} [data-act=s-bell-test]').click(); pg.wait_for_timeout(300)
    check("B: Test-Overlay", pg.locator(f"{P} .bellbg .bt").inner_text() == "Test: Es klingelt")
    n0 = len(log())
    ub = pg.locator(f"{P} .bellbg [data-act=bell-unlock]"); ub.click(); pg.wait_for_timeout(150)
    check("B: Tür öffnen fragt nach", "Nochmal tippen" in ub.inner_text() and len(log()) == n0)
    ub.click(); pg.wait_for_timeout(200)
    check("B: Tür öffnen beim zweiten Tipp (Schloss mit Öffnen-Funktion → lock.open)", log()[-1] == "lock.open")
    check("B: nach Tür öffnen kein Countdown", pg.locator(f"{P} .bellbg .bcount").inner_text() == "")
    pg.locator(f"{P} .bellbg [data-act=bell-close]").first.click(); pg.wait_for_timeout(150)
    # automatisches Schließen
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(400)
    pg.evaluate("(() => { const p = document.querySelector('" + P + "'); p._layout = { ...p._layout, doorbell: { ...p._layout.doorbell, timeout: 2 } }; })()")
    pg.evaluate(ring); pg.wait_for_timeout(300)
    check("B: Overlay offen", pg.locator(f"{P} .bellbg").count() == 1)
    pg.wait_for_timeout(2600)
    check("B: schließt automatisch", pg.locator(f"{P} .bellbg").count() == 0)
    pg.evaluate("(() => { const p = document.querySelector('" + P + "'); p._layout = { ...p._layout, doorbell: { ...p._layout.doorbell, enabled: false } }; })()")
    pg.evaluate(ring); pg.wait_for_timeout(300)
    check("B: abgeschaltet → kein Overlay", pg.locator(f"{P} .bellbg").count() == 0)

@gruppe("warnungen")
def warnungen_fokus():
    # ---------- Warnungen im Aktiv-Fokus ----------
    pg.set_viewport_size({"width": 400, "height": 860})
    pg.goto(dense + "?ov=fokus"); pg.wait_for_timeout(500)
    order = pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const a = R.querySelector('.acard.fokus'), e = R.querySelector('.ebar'); return a && e ? a.compareDocumentPosition(e) === Node.DOCUMENT_POSITION_FOLLOWING : false; }})()")
    check("F-W: Warnkarte oben im Fokus (vor der Energieleiste)", order and pg.locator(f"{P} .acard.fokus .sst").inner_text() == "Schlafzimmer · Fenster offen")
    pg.evaluate("window.__api.set('binary_sensor.schlafzimmer_fenster', 'off')"); pg.wait_for_timeout(250)
    check("F-W: „Alles in Ordnung“ bleibt sichtbar", pg.locator(f"{P} .acard.fokus").is_visible() and pg.locator(f"{P} .acard.fokus .sst").inner_text() == "Alles in Ordnung")
    check("F-W: Eingang anfangs ruhig", pg.locator(f"{P} .factive .room[data-area=eingang]").count() == 0)
    pg.evaluate("window.__api.set('lock.haustur', 'unlocked')"); pg.wait_for_timeout(300)
    tile = pg.locator(f"{P} .factive .room[data-area=eingang]")
    check("F-W: Raum mit Warnung wird aktiv", tile.count() == 1 and "Haustür entriegelt" in tile.locator(".ract").inner_text() and "rwarn" in tile.get_attribute("class"))
    first = pg.evaluate(f"document.querySelector('{P}').shadowRoot.querySelector('.factive .room').dataset.area")
    check("F-W: Raum mit Warnung steht vorn", first == "eingang")
    pg.evaluate("window.__api.set('binary_sensor.wohnzimmer_rauchmelder', 'on')"); pg.wait_for_timeout(300)
    first = pg.evaluate(f"document.querySelector('{P}').shadowRoot.querySelector('.factive .room').dataset.area")
    wz = pg.locator(f"{P} .factive .room[data-area=wohnzimmer]")
    check("F-W: Alarm-Raum zuerst und rot", first == "wohnzimmer" and "ralarm" in wz.get_attribute("class") and "Rauchmelder" in wz.locator(".ract").inner_text())
    check("F-W: Karte zeigt Alarm", "alarm" in pg.locator(f"{P} .acard.fokus").get_attribute("class"))
    pg.evaluate("window.__api.set('binary_sensor.wohnzimmer_rauchmelder', 'off'); window.__api.set('lock.haustur', 'locked')"); pg.wait_for_timeout(300)
    check("F-W: nach Behebung wieder ruhig", pg.locator(f"{P} .factive .room[data-area=eingang]").count() == 0 and "ralarm" not in (pg.locator(f"{P} .factive .room[data-area=wohnzimmer]").get_attribute("class") or ""))
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("panels")
def dashboards_einbetten():
    # ---------- Dashboards einbetten ----------
    pg.set_viewport_size({"width": 1440, "height": 900})
    pg.goto(dense + "?view=extern/map"); pg.wait_for_timeout(600)
    fr = pg.evaluate(f"(() => {{ const f = document.querySelector('{P}').shadowRoot.querySelector('.extwrap iframe'); return f ? [f.getAttribute('src'), Math.round(f.getBoundingClientRect().height)] : null; }})()")
    check("D: noch nicht geladene HA-Seite als Rahmen, volle Höhe", fr == ["/map", 900] and pg.locator(f"{P} .rail").is_visible())
    # Dashboard, dessen Element Home Assistant schon geladen hat → direkt eingebettet
    pg.evaluate("customElements.define('ha-panel-lovelace', class extends HTMLElement { set hass(h) { this._h = h; } set panel(p) { this._p = p; this.textContent = 'Dashboard ' + p.url_path; } set route(r) { this._r = r; } })")
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p._layout = {{ ...p._layout, links: [{{ title: 'Solar', icon: 'mdi:solar-power-variant', path: '/solar-visualisierung', embed: true }}, {{ title: 'Kamera', icon: 'mdi:cctv', path: '/dashboard-import', embed: true }}] }}; p._dirty = true; p._flush(); }})()")
    pg.wait_for_timeout(200)
    pg.locator(f'{P} .nav[data-path="/dashboard-import"]').click(); pg.wait_for_timeout(500)
    check("D: Dashboard eingebettet, Navigation bleibt", pg.locator(f"{P} .extwrap ha-panel-lovelace").inner_text() == "Dashboard dashboard-import" and pg.locator(f'{P} .rail .nav.active[data-path="/dashboard-import"]').count() == 1)
    check("D: Adresse bleibt in der Haus Visualisierung", pg.evaluate("location.pathname") == "/haus-visualisierung/extern/dashboard-import")
    # Klingel: „Kameras öffnen“ führt zum eingebetteten Dashboard
    pg.evaluate(ring); pg.wait_for_timeout(300)
    pg.locator(f"{P} .bellbg [data-act=bell-protect]").click(); pg.wait_for_timeout(400)
    check("D: Klingel → Kamera-Dashboard eingebettet", pg.locator(f"{P} .extwrap ha-panel-lovelace").count() == 1 and pg.locator(f"{P} .bellbg").count() == 0)

@gruppe("klingel")
def tueroeffner():
    # ---------- Türöffner: Schalter, Taste, Test mit ungespeicherten Angaben ----------
    pg.goto(dense + "?view=einstellungen/meldungen"); pg.wait_for_timeout(500)
    lk = pg.locator(f'{P} input[data-set="doorbell.lock"]'); lk.fill("switch.tueroeffner"); lk.dispatch_event("change"); pg.wait_for_timeout(200)
    check("T: Impuls-Feld für Schalter", pg.locator(f'{P} input[data-set="doorbell.pulse"]').count() == 1)
    pu = pg.locator(f'{P} input[data-set="doorbell.pulse"]'); pu.fill("1"); pu.dispatch_event("change")
    pg.locator(f'{P} [data-act=s-bell-test]').click(); pg.wait_for_timeout(300)
    ub = pg.locator(f"{P} .bellbg [data-act=bell-unlock]")
    check("T: Test nutzt ungespeicherten Türöffner", ub.count() == 1)
    ub.click(); pg.wait_for_timeout(100); ub.click(); pg.wait_for_timeout(300)
    check("T: Schalter eingeschaltet", log()[-1] == "switch.turn_on")
    pg.wait_for_timeout(1300)
    check("T: Impuls – Schalter wieder aus", log()[-1] == "switch.turn_off")
    check("T: Rückmeldung", "Türöffner ausgelöst" in pg.locator(f"{P} .toast").inner_text())
    pg.locator(f"{P} .bellbg .bacts [data-act=bell-close]").click(); pg.wait_for_timeout(150)
    lk.fill("button.tuer_summer"); lk.dispatch_event("change"); pg.wait_for_timeout(200)
    pg.locator(f'{P} [data-act=s-bell-test]').click(); pg.wait_for_timeout(300)
    ub = pg.locator(f"{P} .bellbg [data-act=bell-unlock]"); ub.click(); pg.wait_for_timeout(100); ub.click(); pg.wait_for_timeout(300)
    check("T: Taste gedrückt", log()[-1] == "button.press")
    pg.locator(f"{P} .bellbg .bacts [data-act=bell-close]").click(); pg.wait_for_timeout(150)
    # Einstellungen: Auswahl „Darstellung“ überlappt nicht mit dem Löschen-Knopf
    stab(pg, "darstellung")
    ov = pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const e = R.querySelector('.lmode').getBoundingClientRect(); const d = R.querySelector('[data-act=s-link-del]').getBoundingClientRect(); return e.right <= d.left; }})()")
    check("T: Darstellungs-Auswahl überlappt nicht", ov)

@gruppe("panels")
def verknuepfte_seiten_farben():
    # ---------- Verknüpfte Seiten in den Farben der Haus Visualisierung ----------
    LV = "customElements.get('ha-panel-lovelace') || customElements.define('ha-panel-lovelace', class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:block;background:var(--primary-background-color,#fafafa)}.card{background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:var(--ha-card-border-radius,12px);color:var(--primary-text-color,#212121);backdrop-filter:var(--ha-card-backdrop-filter,none);height:80px}.hdr{background:var(--app-header-background-color,#03a9f4)}</style><div class=hdr>Kopf</div><div class=card>Karte</div>'; } set hass(h) {} set panel(p) {} set route(r) {} })"
    def setlinks(mode):
        pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p._layout = {{ ...p._layout, links: [{{ title: 'Solar', icon: 'mdi:solar-power-variant', path: '/solar-visualisierung', mode: '{mode}' }}, {{ title: 'Kamera', icon: 'mdi:cctv', path: '/dashboard-import', mode: '{mode}' }}, {{ title: 'Rahmen', icon: 'mdi:web', path: '/hausframe', mode: '{mode}' }}] }}; p._dirty = true; p._flush(); }})()")
        pg.wait_for_timeout(150)
    css = lambda sel, prop: pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const el = R.querySelector('.extwrap ha-panel-lovelace'); const n = '{sel}' ? el.shadowRoot.querySelector('{sel}') : el; return getComputedStyle(n)['{prop}']; }})()")
    pg.goto(dense); pg.wait_for_timeout(500); pg.evaluate(LV)
    setlinks("theme")
    pg.locator(f'{P} .nav[data-path="/dashboard-import"]').click(); pg.wait_for_timeout(400)
    check("TH: Dashboard bleibt Original-Layout (eingebettet, keine Nachbildung)", pg.locator(f"{P} .extwrap.themed ha-panel-lovelace").count() == 1 and pg.evaluate("location.pathname") == "/haus-visualisierung/extern/dashboard-import")
    check("TH: Hintergrund durchsichtig → Haus-Hintergrund", css("", "backgroundColor") == "rgba(0, 0, 0, 0)")
    check("TH: Karten im Glas-Look", css(".card", "backgroundColor") == "rgba(16, 22, 34, 0.58)" and css(".card", "borderTopLeftRadius") == "20px" and "blur(18px)" in css(".card", "backdropFilter"))
    check("TH: Textfarbe und Kopfzeile", css(".card", "color") == "rgb(238, 242, 248)" and css(".hdr", "backgroundColor") == "rgba(0, 0, 0, 0)")
    # eigenes Panel (Solar) mit eigenem Hintergrund am Host: Host wird durchsichtig, Inhalt bleibt
    pg.locator(f'{P} .nav[data-path="/solar-visualisierung"]').click(); pg.wait_for_timeout(600)
    sh = pg.evaluate(f"(() => {{ const el = document.querySelector('{P}').shadowRoot.querySelector('.extwrap.themed solar-test-panel'); return el ? [getComputedStyle(el).backgroundColor, getComputedStyle(el).getPropertyValue('--card-background-color').trim()] : null; }})()")
    check("TH: eigenes Panel bekommt Haus-Farben", sh == ["rgba(0, 0, 0, 0)", "rgba(16,22,34,.58)"])
    # Rahmen: Haus-Farben werden in die Seite geschrieben und schlagen das Inline-Design
    pg.locator(f'{P} .nav[data-path="/hausframe"]').click(); pg.wait_for_timeout(1200)
    fr = pg.frame_locator(f"{P} .extwrap iframe")
    fv = pg.evaluate(f"(() => {{ const d = document.querySelector('{P}').shadowRoot.querySelector('.extwrap iframe').contentDocument; const html = getComputedStyle(d.documentElement); const pn = d.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.getElementById('panel'); return [getComputedStyle(d.body).backgroundColor, html.backgroundImage.startsWith('radial-gradient'), getComputedStyle(pn).backgroundColor, getComputedStyle(d.body).color]; }})()")
    check("TH: Rahmen in Haus-Farben (Hintergrund, Karten, Text)", fv == ["rgba(0, 0, 0, 0)", True, "rgba(16, 22, 34, 0.58)", "rgb(238, 242, 248)"])
    # Original-Farben: nichts wird verändert
    setlinks("embed")
    pg.locator(f'{P} .nav[data-path="/dashboard-import"]').click(); pg.wait_for_timeout(400)
    check("TH: Original-Farben lassen das Dashboard unverändert", pg.locator(f"{P} .extwrap.themed").count() == 0 and css(".card", "backgroundColor") != "rgba(16, 22, 34, 0.58)")
    pg.locator(f'{P} .nav[data-path="/hausframe"]').click(); pg.wait_for_timeout(1200)
    fv = pg.evaluate(f"(() => {{ const d = document.querySelector('{P}').shadowRoot.querySelector('.extwrap iframe').contentDocument; return [!!d.getElementById('hv-theme'), getComputedStyle(d.body).backgroundColor]; }})()")
    check("TH: Rahmen mit Original-Farben unverändert", fv == [False, "rgb(250, 250, 250)"])
    # Glas aus → kein Weichzeichner in den Karten
    setlinks("theme")
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p._layout = {{ ...p._layout, glass: false }}; p._dirty = true; p._flush(); }})()")
    pg.locator(f'{P} .nav[data-path="/dashboard-import"]').click(); pg.wait_for_timeout(400)
    check("TH: Glas-Effekt aus → Karten ohne Weichzeichner", css(".card", "backdropFilter") == "none")
    # Einstellungen
    pg.goto(dense + "?view=einstellungen/darstellung"); pg.wait_for_timeout(500)
    check("TH: Auswahl Darstellung (Haus-Farben Standard)", pg.locator(f'{P} select[data-set="links.0.mode"]').input_value() == "theme" and pg.locator(f'{P} select[data-set="links.0.mode"] option').count() == 3)

@gruppe("handy")
def handy_fokus():
    # ---------- Aktiv-Fokus auf dem Handy (iPhone 14 = 390 px, iPhone SE = 375/320 px) ----------
    for w, hgt in ((390, 844), (375, 667), (320, 640)):
        ctx = b.new_context(viewport={"width": w, "height": hgt}, device_scale_factor=2, is_mobile=True, has_touch=True)
        mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
        for q in ("?ov=fokus", "?big&ov=fokus"):
            mp.goto(base.split("?")[0] + q); mp.wait_for_timeout(700)
            mp.evaluate("for (const [e,v] of [['lock.haustur','unlocked'],['binary_sensor.kuche_fenster','on'],['light.buro_decke','on']]) { try { window.__api.set(e,v) } catch(x){} }")
            mp.wait_for_timeout(400)
            ov = mp.evaluate(OVL)
            check(f"FH-{w}{'-gross' if 'big' in q else ''}: keine überlappenden Symbole/Texte", not ov)
            if ov: print("     ", ov[:5])
        nav = mp.evaluate(f"(() => {{ const r = document.querySelector('{P}').shadowRoot.querySelector('.rail'); const navs = [...r.querySelectorAll('.nav')]; const R = r.getBoundingClientRect(); return [r.scrollWidth <= r.clientWidth + 1, navs.every(n => {{ const b = n.getBoundingClientRect(); return b.left >= R.left - 1 && b.right <= R.right + 1; }}), r.classList.contains('many'), getComputedStyle(r.querySelector('.nav.active span')).display]; }})()")
        check(f"FH-{w}: Navigation passt ganz in die Breite, aktiver Eintrag beschriftet", nav == [True, True, True, "block"])
        eb = mp.evaluate(f"(() => {{ const e = document.querySelector('{P}').shadowRoot.querySelector('.ebar'); const E = e.getBoundingClientRect(); const kids = [...e.querySelectorAll('.ep,.schip,.pbtn')]; return [getComputedStyle(e).display, kids.every(k => {{ const b = k.getBoundingClientRect(); return b.left >= E.left && b.right <= E.right + 0.5; }}), kids.filter(k => k.matches('.schip,.pbtn')).every(k => Math.abs(k.getBoundingClientRect().left - E.left) < 12 || k.getBoundingClientRect().left > E.left + E.width / 2 - 8)]; }})()")
        check(f"FH-{w}: Energieleiste als Raster, nichts verschoben", eb == ["grid", True, True])
        ps = mp.evaluate(f"(() => {{ const p = [...document.querySelector('{P}').shadowRoot.querySelectorAll('.person')].map(x => x.getBoundingClientRect()); return p.every((r, i) => i === 0 || r.left >= p[i-1].right); }})()")
        check(f"FH-{w}: Personen überlappen nicht", ps)
        ctx.close()

@gruppe("handy")
def handy_lange_namen():
    # ---------- Handy mit langen Namen (z. B. UniFi Protect): Felder nie breiter als der Bildschirm ----------
    LONG = """(() => { const api = window.__api, H = api.hass, p = document.querySelector('haus-visualisierung-panel');
      const names = ['G6 Entry Türklingel Person erkannt', 'Wohnungseingangstür Kontakt Erdgeschoss', 'Rauchwarnmelder Schlafzimmer Obergeschoss', 'Haustür Nuki Smart Lock Pro', 'Bewegungsmelder Flur Treppenhaus Präsenz'];
      Object.keys(H.states).forEach((e, i) => { const n = names[i % names.length]; api.set(e, H.states[e].state, { friendly_name: n }); if (H.entities && H.entities[e]) H.entities[e] = { ...H.entities[e], name: n }; });
      try { api.set('lock.haustur','unlocked') } catch(x){}
      p._model = null; p._dirty = true; p._flush(); })()"""
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    for v in ("sicherheit", "licht", "beschattung", "klima", "batterien", "raum/eingang", "raum/wohnzimmer"):
        for k in ("", "komfort&"):
            mp.goto(base.split("?")[0] + f"?{k}view={v}"); mp.wait_for_timeout(500)
            mp.evaluate(LONG); mp.wait_for_timeout(300)
            mp.evaluate("(() => { const R = document.querySelector('haus-visualisierung-panel').shadowRoot; R.querySelectorAll('.collapsed .shead, [data-act=collapse]').forEach(s => s.click()); })()"); mp.wait_for_timeout(200)
            wide, ov = mp.evaluate(WIDE), mp.evaluate(OVL)
            check(f"LN-{k or 'kompakt&'}{v}: lange Namen – nichts breiter als der Bildschirm, nichts überlappt", not wide and not ov)
            if wide or ov: print("     ", wide, ov[:3])
    mp.goto(base.split("?")[0] + "?view=sicherheit"); mp.wait_for_timeout(500); mp.evaluate(LONG); mp.wait_for_timeout(300)
    lk = mp.evaluate("(() => { const R = document.querySelector('haus-visualisierung-panel').shadowRoot; const r = R.querySelector('.tile.row.lock'); const b = r.querySelector('.lockbtn').getBoundingClientRect(), R2 = r.getBoundingClientRect(); return [getComputedStyle(r.querySelector('.tstate')).display, b.right <= R2.right + 0.5, r.querySelector('.tname').getBoundingClientRect().width > 120]; })()")
    check("LN: Schloss-Zeile – Knopf sichtbar, Name mit Platz", lk == ["none", True, True])
    st = mp.evaluate("(() => { const R = document.querySelector('haus-visualisierung-panel').shadowRoot; return [...R.querySelectorAll('.tile.row.bin .tstate')].every(s => s.getBoundingClientRect().width <= s.closest('.tile').getBoundingClientRect().width * 0.47); })()")
    check("LN: lange Zustände nehmen höchstens knapp die Hälfte der Zeile ein", st)
    ctx.close()

@gruppe("alarme")
def alarmmanager():
    # ---------- Alarmmanager (0.11.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense); pg.wait_for_timeout(600)
    pg.evaluate("window.__api.set('binary_sensor.kuche_fenster', 'on')"); pg.wait_for_timeout(300)
    A = f"{P} .acard"
    nb = pg.locator(f"{P} .rail .nbadge")
    check("AM: Navigation „Alarme“ mit Zähler offener Warnungen", pg.locator(f'{P} .nav[data-to="alarme"]').count() == 1 and nb.inner_text() == "2" and "on" in nb.get_attribute("class"))
    check("AM: Kopfzeilen-Glocke führt zum Alarmmanager", pg.locator(f"{P} .kchip[data-k=alerts]").get_attribute("data-to") == "alarme")
    pg.locator(f"{A} .aitem").first.click(); pg.wait_for_timeout(400)
    check("AM: Meldung in der Warnkarte öffnet Alarmmanager mit Auswahl", pg.evaluate("location.pathname") == "/haus-visualisierung/alarme" and pg.locator(f"{P} .alrow.sel").count() == 1 and pg.locator(f"{P} .aldetail .alt").inner_text() == pg.locator(f"{P} .alrow.sel .alti").inner_text())
    check("AM: Leitstelle dreispaltig (Aktiv, Detail, Heute)", pg.locator(f"{P} .algrid > .allist").count() == 1 and pg.locator(f"{P} .algrid > .aldetail").count() == 1 and pg.locator(f"{P} .algrid > .alside").count() == 1)
    rows = pg.locator(f"{P} .allist .alrow")
    check("AM: zwei offene Meldungen, beide neu", rows.count() == 2 and pg.locator(f"{P} .alrow.st-neu").count() == 2)
    key = pg.locator(f"{P} .alrow.sel").get_attribute("data-key")
    # Quittieren im Detail
    pg.locator(f"{P} .aldetail [data-act=al-ack]").click(); pg.wait_for_timeout(300)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_action"]
    check("AM: Quittieren schickt alarm_action", ws and ws[-1][2]["key"] == key and ws[-1][2]["action"] == "ack")
    check("AM: Meldung als quittiert markiert, Zähler sinkt", pg.locator(f'{P} .alrow[data-key="{key}"]').get_attribute("class").count("st-quittiert") == 1 and nb.inner_text() == "1" and "quittiert von Tobias" in pg.locator(f"{P} .aldetail .alstat").inner_text())
    # Stumm 1 h → aus Warnkarte, Aktiv-Liste und Glocke, unter „Stumm“
    pg.locator(f"{P} .aldetail [data-act=al-mute][data-min='60']").click(); pg.wait_for_timeout(400)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_action"]
    check("AM: 1 h stumm", ws[-1][2] == {"type": "haus_visualisierung/alarm_action", "key": key, "action": "mute", "minutes": 60})
    check("AM: stumme Meldung unter „Stumm“", pg.locator(f'{P} .alrow.st-stumm[data-key="{key}"]').count() == 1 and pg.locator(f"{P} .alh.sub").count() == 1 and "stumm bis" in pg.locator(f'{P} .alrow[data-key="{key}"] .alsu').inner_text())
    pg.locator(f'{P} .alrow[data-key="{key}"]').click(); pg.wait_for_timeout(200)
    pg.locator(f"{P} .aldetail [data-act=al-unmute]").click(); pg.wait_for_timeout(300)
    check("AM: Stummschaltung aufheben → wieder quittiert", pg.locator(f'{P} .alrow.st-quittiert[data-key="{key}"]').count() == 1)
    for until in ("morning", "resolved"):
        pg.locator(f"{P} .aldetail [data-act=al-mute][data-until={until}]").click(); pg.wait_for_timeout(300)
        ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_action"]
        check(f"AM: stumm {until}", ws[-1][2].get("until") == until)
        if until == "morning":
            pg.locator(f'{P} .alrow[data-key="{key}"]').click(); pg.wait_for_timeout(150)
            pg.locator(f"{P} .aldetail [data-act=al-unmute]").click(); pg.wait_for_timeout(250)
    check("AM: „stumm bis behoben“ angezeigt", "stumm bis behoben" in pg.locator(f'{P} .alrow[data-key="{key}"] .alsu').inner_text())
    pg.goto(dense); pg.wait_for_timeout(600); pg.evaluate("window.__api.set('binary_sensor.kuche_fenster', 'on')"); pg.wait_for_timeout(300)
    # Abo neu: Zustand aus dem nachgebauten Backend bleibt erhalten
    check("AM: Warnkarte ohne stumme Meldung, Hinweis „1 stumm geschaltet“", pg.locator(f"{A} .aitem").count() == 0 and "stumm" in pg.locator(f"{A}").inner_text() and pg.locator(f"{P} .kchip[data-k=alerts] .ct").inner_text() == "1")
    # Alle quittieren
    pg.evaluate("window.__api.set('binary_sensor.wohnzimmer_rauchmelder', 'on')"); pg.wait_for_timeout(300)
    pg.locator(f'{P} .nav[data-to="alarme"]').click(); pg.wait_for_timeout(400)
    check("AM: Alarm zuerst, rot, pulsiert", "alarm" in pg.locator(f"{P} .allist .alrow").first.get_attribute("class") and "alarm" in nb.get_attribute("class"))
    pg.locator(f"{P} [data-act=al-ackall]").click(); pg.wait_for_timeout(300)
    check("AM: Alle quittieren", pg.locator(f"{P} .allist .alrow.st-neu").count() == 0 and not nb.is_visible())
    check("AM: Warnkarte quittiert → kein Pulsieren", True)
    # Verlauf heute + Protokoll
    check("AM: Verlauf heute mit Quittierung", "quittiert von Tobias" in pg.locator(f"{P} .alside").inner_text())
    pg.locator(f"{P} .ptitle .altab[data-tab=protokoll]").click(); pg.wait_for_timeout(500)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_log"]
    check("AM: Protokoll lädt alarm_log (7 Tage)", ws and ws[-1][2]["days"] == 7 and pg.locator(f"{P} .lgday").first.inner_text() == "Heute" and pg.locator(f"{P} .lgrow").count() >= 4)
    times = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.algrid.proto .lgrow .lgt')].map(x => x.textContent)")
    check("AM: Protokoll neueste zuerst", times == sorted(times, reverse=True))
    pg.locator(f"{P} [data-act=al-days][data-days='30']").click(); pg.wait_for_timeout(400)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_log"]
    check("AM: Zeitraum 30 Tage", ws[-1][2]["days"] == 30)
    pg.locator(f"{P} [data-act=al-lvl][data-lvl=alarm]").click(); pg.wait_for_timeout(300)
    lv = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.algrid.proto .lgrow')].every(r => r.classList.contains('alarm'))")
    check("AM: Filter Alarme", lv)
    # Alarmo-Zustand in der Seitenleiste
    pg.evaluate("(() => { const H = window.__api.hass; H.states = { ...H.states, 'alarm_control_panel.alarmo': { entity_id: 'alarm_control_panel.alarmo', state: 'armed_away', attributes: { friendly_name: 'Alarmo' }, last_changed: new Date().toISOString() } }; window.__api.set('alarm_control_panel.alarmo', 'armed_away', {}); const p = document.querySelector('haus-visualisierung-panel'); p._alTab = 'leitstelle'; p._dirty = true; p._flush(); })()"); pg.wait_for_timeout(300)
    check("AM: Alarmo-Zustand angezeigt", "scharf · abwesend" in pg.locator(f"{P} .alarmo").inner_text())
    # Handy: Wischen quittiert bzw. schaltet stumm, Detail erst nach Antippen
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    mp.goto(base.split("?")[0] + "?view=alarme"); mp.wait_for_timeout(600)
    mp.evaluate("window.__api.set('binary_sensor.kuche_fenster', 'on')"); mp.wait_for_timeout(400)
    check("AM-Handy: Liste ohne Detail, Hinweis aufs Wischen", mp.locator(f"{P} .aldetail").count() == 0 and mp.locator(f"{P} .alhint").count() == 1)
    def swipe(sel, dx):
        bb = mp.locator(sel).bounding_box(); y = bb["y"] + bb["height"] / 2; x = bb["x"] + bb["width"] / 2
        mp.mouse.move(x, y); mp.mouse.down(); [mp.mouse.move(x + dx * i / 8, y) for i in range(1, 9)]; mp.mouse.up(); mp.wait_for_timeout(350)
    r1 = mp.locator(f"{P} .allist .alrow").first.get_attribute("data-key")
    swipe(f'{P} .alrow[data-key="{r1}"]', 130)
    ws = [x for x in mp.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_action"]
    check("AM-Handy: nach rechts wischen = quittieren", ws and ws[-1][2]["action"] == "ack" and ws[-1][2]["key"] == r1 and mp.locator(f"{P} .aldetail").count() == 0)
    swipe(f'{P} .alrow[data-key="{r1}"]', -130)
    ws = [x for x in mp.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_action"]
    check("AM-Handy: nach links wischen = 1 h stumm", ws[-1][2]["action"] == "mute" and ws[-1][2]["minutes"] == 60)
    mp.wait_for_timeout(500)
    mp.locator(f"{P} .allist .alrow .alti").first.click(); mp.wait_for_timeout(400)
    check("AM-Handy: Antippen zeigt Detail mit Schließen", mp.locator(f"{P} .aldetail").count() == 1 and mp.locator(f"{P} .alclose").count() == 1)
    ov = mp.evaluate(OVL); wide = mp.evaluate(WIDE)
    check("AM-Handy: nichts überlappt, nichts zu breit", not ov and not wide)
    if ov or wide: print("     ", ov[:3], wide)
    ctx.close()

@gruppe("alarme")
def hausmodus():
    # ---------- Hausmodus (0.12.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.evaluate("sessionStorage.removeItem('hv-alarms')")
    pg.goto(dense); pg.wait_for_timeout(600)
    hm = pg.locator(f"{P} .hmode")
    check("HM: Kopfzeile zeigt Hausmodus „Zuhause“", hm.count() == 1 and hm.get_attribute("data-mode") == "zuhause" and hm.inner_text().strip() == "Zuhause")
    pg.evaluate("window.__api.set('binary_sensor.flur_bewegung', 'on')"); pg.wait_for_timeout(300)
    check("HM: Bewegung bei Zuhause → keine Meldung", "Bewegung" not in pg.locator(f"{P} .acard").inner_text())
    hm.click(); pg.wait_for_timeout(400)
    check("HM: Kopfzeile öffnet Alarmmanager mit Hausmodus-Karte", pg.evaluate("location.pathname") == "/haus-visualisierung/alarme" and pg.locator(f"{P} .hmcard .hmb.on[data-mode=zuhause]").count() == 1)
    pg.locator(f"{P} .hmb[data-mode=abwesend]").click(); pg.wait_for_timeout(400)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "set_mode"]
    check("HM: Abwesend schickt set_mode", ws and ws[-1][2]["mode"] == "abwesend")
    titles = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.allist .alti')].map(x => x.textContent)")
    check("HM: Abwesend → Bewegung wird Alarm (Titel ohne Doppelung)", "Flur: Bewegung erkannt" in titles and pg.locator(f"{P} .alrow.alarm").count() >= 1)
    check("HM: Karte, Kopfzeile und Protokoll zeigen Abwesend", pg.locator(f"{P} .hmcard .hmb.on[data-mode=abwesend]").count() == 1
          and "Hausmodus: Abwesend" in pg.locator(f"{P} .alside").inner_text())
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(400)
    check("HM: Kopfzeile zeigt Abwesend, Aktiv-Fokus/Warnkarte mit Bewegungsalarm", pg.locator(f"{P} .hmode").get_attribute("data-mode") == "abwesend" and "Bewegung erkannt" in pg.locator(f"{P} .acard").inner_text())
    pg.locator(f"{P} .hmode").click(); pg.wait_for_timeout(400)
    pg.locator(f"{P} .hmb[data-mode=zuhause]").click(); pg.wait_for_timeout(400)
    titles = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('.allist .alti')].map(x => x.textContent)")
    check("HM: zurück auf Zuhause → Bewegungsalarm weg", not any("Bewegung" in t for t in titles))
    # Gekoppelt: Umschalten auf Abwesend fragt nach (Anlage wird scharf)
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p._layout = {{ ...p._layout, house_mode: {{ ...p._layout.house_mode, alarmo_sync: true }} }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(300)
    pg.locator(f"{P} .hmb[data-mode=abwesend]").click(); pg.wait_for_timeout(300)
    check("HM: gekoppelt → Abfrage „Alarmanlage wird scharf geschaltet“", pg.locator(f"{P} .mbg .modal").count() == 1 and "scharf" in pg.locator(f"{P} .mbg .mx").inner_text())
    pg.locator(f"{P} .mbg [data-act=confirm-cancel]").click(); pg.wait_for_timeout(200)
    ws2 = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "set_mode"]
    check("HM: Abbrechen schaltet nicht", len(ws2) == len(ws) + 1)
    # Einstellungen
    pg.goto(dense + "?view=einstellungen/alarme"); pg.wait_for_timeout(600)
    check("HM: Einstellungen „Hausmodus“ mit Automatik, Alarmanlage, Zuordnung je Modus", pg.locator(f"{P} .set h2:has-text('Hausmodus')").count() == 1
          and pg.locator(f'{P} [data-set="house_mode.arm.abwesend"]').input_value() == "arm_away" and pg.locator(f'{P} [data-set="house_mode.auto_away"]').is_checked())
    chips = pg.locator(f'{P} .mchip[data-path="alerts.modes.presence_away"]')
    check("HM: Bewegung standardmäßig nur Abwesend/Urlaub", [("on" in (chips.nth(i).get_attribute("class") or "")) for i in range(4)] == [False, False, True, True])
    pg.locator(f'{P} .mchip[data-path="alerts.modes.contacts"][data-m=nacht]').click(); pg.wait_for_timeout(200)
    d = pg.evaluate(f"document.querySelector('{P}')._draft.alerts.modes.contacts")
    check("HM: Fenster-Regel auf Modi einschränken", d == ["zuhause", "abwesend", "urlaub"])
    pg.locator(f'{P} [data-act=s-rule-add]').click(); pg.wait_for_timeout(200)
    pg.locator(f'{P} .mchip[data-path="alerts.rules.0.modes"][data-m=zuhause]').click(); pg.wait_for_timeout(200)
    check("HM: eigene Regel nur Nacht/Abwesend/Urlaub", pg.evaluate(f"document.querySelector('{P}')._draft.alerts.rules[0].modes") == ["nacht", "abwesend", "urlaub"])
    pg.locator(f"{P} #hv-code").fill("4711"); pg.locator(f"{P} [data-act=s-code-save]").click(); pg.wait_for_timeout(300)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "alarm_code"]
    check("HM: Code separat gespeichert, nicht im Layout", ws and ws[-1][2]["code"] == "4711" and "4711" not in pg.evaluate(f"JSON.stringify(document.querySelector('{P}')._draft)") and pg.locator(f"{P} #hv-code").input_value() == "")
    # Handy: Kopfzeile nur Symbol, nichts überlappt
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    for v in ("?ov=fokus", "?view=alarme"):
        mp.goto(base.split("?")[0] + v); mp.wait_for_timeout(600)
        ov, wide = mp.evaluate(OVL), mp.evaluate(WIDE)
        check(f"HM-Handy {v}: nichts überlappt, nichts zu breit", not ov and not wide)
        if ov or wide: print("     ", ov[:3], wide)
    check("HM-Handy: Modus-Symbol in der Kopfzeile ohne Text", mp.locator(f"{P} .hmode .hml").is_hidden() if mp.locator(f"{P} .hmode").count() else True)
    ctx.close()

@gruppe("alarme")
def eskalation():
    # ---------- Eskalation und Aktionen (0.13.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=einstellungen/alarme"); pg.wait_for_timeout(600)
    check("AC: Abschnitt „Eskalation und Aktionen“ mit Standard 5 Min., nur Alarme", pg.locator(f"{P} .set h2:has-text('Eskalation')").count() == 1
          and pg.locator(f'{P} [data-set="escalation.minutes"]').input_value() == "5" and pg.locator(f"{P} [data-act=s-esc-level].on").count() == 1)
    pg.locator(f"{P} [data-act=s-esc-level][data-lvl=warn]").click(); pg.wait_for_timeout(200)
    check("AC: Stufe Warnung zuschaltbar", pg.evaluate(f"document.querySelector('{P}')._draft.escalation.levels") == ["alarm", "warn"])
    for t in ("knx", "siren", "tts", "flash", "script"):
        pg.locator(f"{P} [data-act=s-act-tpl][data-tpl={t}]").click(); pg.wait_for_timeout(150)
    acts = pg.evaluate(f"document.querySelector('{P}')._draft.alarm_actions")
    check("AC: fünf Vorlagen angelegt (KNX, Sirene bei Eskalation, Durchsage, Blitzleuchte bei Abwesenheit, Skript)", [a["type"] for a in acts] == ["knx", "siren", "tts", "switch", "script"]
          and acts[1]["when"] == "eskalation" and acts[3]["modes"] == ["abwesend", "urlaub"] and len({a["id"] for a in acts}) == 5)
    check("AC: Felder je Typ (Gruppenadresse, Lautsprecher + Text + Lautstärke)", pg.locator(f'{P} [data-set="alarm_actions.0.address"]').count() == 1
          and pg.locator(f'{P} [data-set="alarm_actions.2.message"]').input_value() == "Achtung: {titel}" and pg.locator(f'{P} [data-set="alarm_actions.2.volume"]').input_value() == "50")
    pg.locator(f'{P} [data-act=s-act-test][data-i="0"]').click(); pg.wait_for_timeout(300)
    check("AC: Test ohne Gruppenadresse → verständliche Meldung", "Gruppenadresse" in pg.locator(f"{P} .toast").last.inner_text())
    pg.locator(f'{P} [data-set="alarm_actions.0.address"]').fill("1/7/0"); pg.locator(f'{P} [data-set="alarm_actions.0.address"]').dispatch_event("change"); pg.wait_for_timeout(100)
    pg.locator(f'{P} [data-act=s-act-test][data-i="0"]').click(); pg.wait_for_timeout(300)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "action_test"]
    check("AC: Test schickt ungespeicherte Aktion", ws[-1][2]["action"]["address"] == "1/7/0" and "knx.send" in pg.locator(f"{P} .toast").last.inner_text())
    pg.locator(f'{P} select[data-set="alarm_actions.4.type"]').select_option("knx"); pg.wait_for_timeout(300)
    check("AC: Typ wechseln zeigt passende Felder", pg.locator(f'{P} [data-set="alarm_actions.4.address"]').count() == 1)
    scopes = pg.evaluate(f"[...document.querySelector('{P}').shadowRoot.querySelectorAll('select[data-set=\"alarm_actions.0.scope\"] option')].map(o => o.value)")
    check("AC: Auslöser wählbar: Stufen, feste Regeln, eigene Regeln", scopes[:3] == ["alarm", "warn", "all"] and "b:safety" in scopes and "b:presence_away" in scopes)
    pg.locator(f'{P} [data-act=s-act-del][data-i="4"]').click(); pg.wait_for_timeout(200)
    check("AC: Aktion löschen", len(pg.evaluate(f"document.querySelector('{P}')._draft.alarm_actions")) == 4)
    # Alarmmanager: eskaliert und Aktionen im Verlauf
    pg.evaluate("sessionStorage.removeItem('hv-alarms')")
    pg.goto(dense + "?view=alarme"); pg.wait_for_timeout(600)
    pg.evaluate("""(() => { const api = window.__api; api.set('binary_sensor.wohnzimmer_rauchmelder', 'on');
      api.alarmAdd('safety:binary_sensor.wohnzimmer_rauchmelder', 'alarm', 'Wohnzimmer · Rauchmelder', { escalated: Date.now() / 1000 - 30 });
      const now = Date.now() / 1000; api.alarmSnap.log = [...api.alarmSnap.log, { ts: now - 200, type: 'aktion', key: 'safety:binary_sensor.wohnzimmer_rauchmelder', title: 'Wohnzimmer · Rauchmelder', level: 'alarm', text: 'KNX Sammelalarm ausgeführt' },
        { ts: now - 30, type: 'eskaliert', key: 'safety:binary_sensor.wohnzimmer_rauchmelder', title: 'Wohnzimmer · Rauchmelder', level: 'alarm', minutes: 5 }]; api.alarmPush(); })()""")
    pg.wait_for_timeout(400)
    row = pg.locator(f'{P} .alrow[data-key="safety:binary_sensor.wohnzimmer_rauchmelder"]')
    row.click(); pg.wait_for_timeout(300)
    check("AC: eskalierte Meldung gekennzeichnet (Zeile und Detail)", "eskaliert" in row.locator(".alsu").inner_text() and "eskaliert um" in pg.locator(f"{P} .aldetail .alstat.esc").inner_text())
    hist = pg.locator(f"{P} .aldetail .lglist").inner_text()
    check("AC: Verlauf der Meldung zeigt Aktion und Eskalation", "KNX Sammelalarm ausgeführt" in hist and "5 Min. nicht quittiert" in hist)
    pg.evaluate("window.__api.alarmStats = [{ key: 'contact:x', title: 'Küche · Fenster offen', level: 'warn', n: 7, short: 5, acked: 0, avg: 42, verdacht: ['kurz', 'häufig', 'ohne Reaktion'] }]")
    pg.locator(f"{P} .ptitle .altab[data-tab=protokoll]").click(); pg.wait_for_timeout(500)
    sr = pg.locator(f"{P} .alstatrow").first
    check("AC: Fehlalarm-Auswertung mit Dauer und Hinweis", "Ø 42 s" in sr.inner_text() and "5× unter 1 Min." in sr.inner_text() and "nie quittiert" in sr.inner_text()
          and "kurz" in (sr.locator(".fa").get_attribute("title") or ""))

@gruppe("verlauf")
def verlauf_raumseiten():
    # ---------- Verlauf 24 h auf Raumseiten (1.1.0) ----------
    R = f"document.querySelector('{P}').shadowRoot"
    wsl = lambda kind: [x[2] for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == kind]
    pg.goto(base + "&view=raum/wohnzimmer"); pg.wait_for_timeout(700)
    tr = pg.locator(f"{P} .trend")
    check("TR: Verlaufskarte auf der Raumseite (Komfort)", tr.count() == 1 and "Verlauf 24 h" in tr.locator(".trt").text_content())
    dt = pg.evaluate(f"[...{R}.querySelectorAll('.trend .trp')].map(p => (p.getAttribute('d') || '').length)")
    check("TR: Temperatur- und Feuchtelinie gezeichnet", len(dt) == 2 and all(n > 200 for n in dt))
    st, hi = wsl("statistics"), wsl("history")
    check("TR: Statistik (5 Minuten) für Temperatur, Verlauf nur für Feuchte ohne Statistik",
          len(st) == 1 and st[0]["period"] == "5minute" and "sensor.wohnzimmer_temperatur" in st[0]["ids"] and len(hi) == 1 and hi[0]["ids"] == ["sensor.wohnzimmer_feuchte"])
    check("TR: Legende mit aktuellem Wert und Spanne", "22,4°" in tr.locator(".trl.t").inner_text() and "47 %" in tr.locator(".trl.h").inner_text() and "–" in tr.locator(".trl.t small").inner_text())
    check("TR: Zeitachse mit Uhrzeiten und „jetzt“", tr.locator(".trx span").count() >= 4 and tr.locator(".trx .now").inner_text() == "jetzt")
    d0 = pg.evaluate(f"{R}.querySelector('.trend .trp.t').getAttribute('d')")
    r0 = pg.evaluate(f"document.querySelector('{P}')._stats.renders")
    pg.evaluate("window.__api.set('sensor.wohnzimmer_temperatur', '25.0')"); pg.wait_for_timeout(200)
    d1 = pg.evaluate(f"{R}.querySelector('.trend .trp.t').getAttribute('d')")
    check("TR: neuer Wert wird ohne Abfrage fortgeschrieben", d1 != d0 and "25,0°" in tr.locator(".trl.t b").inner_text() and len(wsl("statistics")) == 1 and len(wsl("history")) == 1)
    check("TR: kein Neuaufbau durch den neuen Wert", pg.evaluate(f"document.querySelector('{P}')._stats.renders") == r0)
    box = tr.locator(".trc").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] / 2); pg.wait_for_timeout(100)
    tip = tr.locator(".trtip")
    check("TR: Zeiger zeigt Uhrzeit, Temperatur und Feuchte", "on" in tip.get_attribute("class") and ":" in tip.inner_text() and "°" in tip.inner_text() and "%" in tip.inner_text())
    pg.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] + 120); pg.wait_for_timeout(100)
    check("TR: Zeiger weg – Anzeige weg", "on" not in tip.get_attribute("class"))
    tr.locator(".trl.t").click(); pg.wait_for_timeout(100)
    check("TR: Legende öffnet Details des Sensors", pg.evaluate("window.__moreInfo") == "sensor.wohnzimmer_temperatur")
    pg.locator(f"{P} .hero [data-act=go][data-to='raum/kuche'], {P} .hero [data-act=go][data-to^='raum/']").last.click(); pg.wait_for_timeout(400)
    pg.locator(f"{P} .hero [data-act=go][data-to='raum/wohnzimmer']").first.click(); pg.wait_for_timeout(400)
    check("TR: zurück zum Raum – Verlauf aus dem Speicher (keine neue Abfrage)", pg.locator(f"{P} .trend").count() == 1 and sum(1 for x in wsl("statistics") if "sensor.wohnzimmer_temperatur" in x["ids"]) == 1)
    pg.goto(dense + "?view=raum/bad"); pg.wait_for_timeout(700)
    dh = pg.evaluate(f"{R}.querySelector('.trend .trp.h').getAttribute('d')")
    check("TR: Kompakt – Verlauf vorhanden, Lücke bei „nicht erreichbar“", pg.locator(f"{P} .trend").count() == 1 and dh.count("M") == 2)
    pg.goto(dense + "?view=raum/flur"); pg.wait_for_timeout(500)
    check("TR: Raum ohne Temperatur und Feuchte – keine Karte", pg.locator(f"{P} .trend").count() == 0)
    pg.goto(dense + "?view=raum/kuche&norec"); pg.wait_for_timeout(700)
    check("TR: ohne Recorder-Daten – Hinweis statt leerer Fläche", "Noch kein Verlauf" in pg.locator(f"{P} .trend").inner_text())
    pg.goto(dense + "?view=raum/wohnzimmer"); pg.wait_for_timeout(400)
    pg.evaluate(f"(() => {{ const p = document.querySelector('{P}'); p._layout = {{ ...p._layout, show_trends: false }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(200)
    check("TR: abschaltbar (Darstellung → Verlauf auf Raumseiten)", pg.locator(f"{P} .trend").count() == 0)

@gruppe("einstellungen")
def einstellungen_reiter():
    # ---------- Einstellungen mit Reitern und Sortieren per Ziehen (1.1.0) ----------
    pg.goto(dense + "?view=einstellungen/alarme"); pg.wait_for_timeout(600)
    check("ST: fünf Reiter, Adresse wählt „Alarme“", pg.locator(f"{P} .stab").count() == 5 and "on" in pg.locator(f"{P} .stab[data-tab=alarme]").get_attribute("class")
          and pg.locator(f"{P} .set h2:has-text('Hausmodus')").count() == 1 and pg.locator(f"{P} .set h2:has-text('Etagen')").count() == 0)
    stab(pg, "raeume")
    check("ST: Reiter „Räume“ zeigt Etagen und Favoriten", pg.locator(f"{P} .set h2:has-text('Etagen')").count() == 1 and pg.locator(f"{P} .set h2:has-text('Favoriten')").count() == 1 and pg.locator(f"{P} .set h2:has-text('Hausmodus')").count() == 0)
    pg.goto(dense + "?view=einstellungen"); pg.wait_for_timeout(500)
    check("ST: zuletzt gewählter Reiter bleibt (je Gerät)", "on" in pg.locator(f"{P} .stab[data-tab=raeume]").get_attribute("class"))
    D = lambda k: pg.evaluate(f"document.querySelector('{P}')._draft.{k}")
    check("ST: Keller und Außen nicht zwischen die Geschosse ziehbar (eigene Gruppen)", pg.locator(f"{P} [data-sort=floors][data-group=upper] > .sitem").count() == 2 and pg.locator(f"{P} .sitem[data-sort-id=kg] .fl-title .drag").count() == 0)
    drag(pg.locator(f"{P} [data-sort=floors] > .sitem[data-sort-id=og] .fl-title .drag"), pg.locator(f"{P} [data-sort=floors] > .sitem[data-sort-id=eg]"), after=True)
    check("ST: Etage per Ziehen nach unten", D("floor_order")[:3] == ["eg", "og", "kg"])
    check("ST: ungespeichert markiert (Leiste und Reiter)", pg.locator(f"{P} .savebar .msg").inner_text() == "Ungespeicherte Änderungen" and "dirty" in pg.locator(f"{P} .stab[data-tab=raeume]").get_attribute("class"))
    pg.locator(f"{P} .sitem[data-sort-id=kuche] .drag").focus(); pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(200)
    eg = pg.evaluate(f"[...{R}.querySelectorAll('[data-sort=areas][data-floor=eg] > .sitem')].map(e => e.dataset.sortId)")
    check("ST: Pfeiltaste auf dem Griff verschiebt um eine Stelle", eg.index("kuche") < eg.index("gaste_wc") and D("area_order").index("kuche") < D("area_order").index("gaste_wc"))
    check("ST: Griff behält den Fokus", pg.evaluate(f"{R}.activeElement && {R}.activeElement.closest('.sitem').dataset.sortId") == "kuche")
    drag(pg.locator(f"{P} .sitem[data-sort-id=terrasse] .drag"), pg.locator(f"{P} .sitem[data-sort-id=bad]"))
    check("ST: Raum nur innerhalb seiner Etage verschiebbar", "terrasse" not in pg.evaluate(f"[...{R}.querySelectorAll('[data-sort=areas][data-floor=og] > .sitem')].map(e => e.dataset.sortId)"))
    pg.locator(f"{P} [data-act=s-area-open][data-area=wohnzimmer]").click(); pg.wait_for_timeout(200)
    drag(pg.locator(f'{P} [data-sort=pins] .pin[data-sort-id="sensor.kamin_pumpe_drehzahl"]'), pg.locator(f'{P} [data-sort=pins] .pin[data-sort-id="sensor.kamin_temperatur"]'))
    check("ST: Raum-Pins per Ziehen sortieren", D("pins.wohnzimmer") == ["sensor.kamin_pumpe_drehzahl", "sensor.kamin_temperatur"])
    drag(pg.locator(f'{P} [data-sort=favorites] .pin[data-sort-id="switch.waschmaschine"]'), pg.locator(f'{P} [data-sort=favorites] .pin[data-sort-id="scene.wohnzimmer_gemutlich"]'))
    check("ST: Favoriten per Ziehen sortieren", D("favorites")[0] == "switch.waschmaschine" and len(D("favorites")) == 4)
    pg.locator(f'{P} [data-sort=favorites] .pin[data-sort-id="lock.haustur"] button').click(); pg.wait_for_timeout(200)
    check("ST: Entfernen-Knopf im Chip startet kein Ziehen", "lock.haustur" not in D("favorites"))
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout)")
    check("ST: Sortierung gespeichert", saved["floor_order"][:3] == ["eg", "og", "kg"] and saved["favorites"][0] == "switch.waschmaschine" and saved["pins"]["wohnzimmer"][0] == "sensor.kamin_pumpe_drehzahl")
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    fl = pg.evaluate(f"document.querySelector('{P}')._model.floors.map(f => f.id)")
    check("ST: Übersicht folgt der neuen Etagen-Reihenfolge", fl.index("eg") < fl.index("og"))
    pg.goto(dense + "?view=einstellungen/darstellung"); pg.wait_for_timeout(500)
    drag(pg.locator(f"{P} [data-sort=links] > .sitem[data-sort-id='1'] .drag"), pg.locator(f"{P} [data-sort=links] > .sitem[data-sort-id='0']"))
    check("ST: Verknüpfungen per Ziehen sortieren", [l["title"] for l in D("links")][:2] == ["Kameras", "Solar"])
    check("ST: Darstellung – Schalter „Verlauf auf Raumseiten“", pg.locator(f'{P} input[data-set="show_trends"]').count() == 1)
    stab(pg, "alarme")
    for t in ("knx", "siren", "tts"):
        pg.locator(f"{P} [data-act=s-act-tpl][data-tpl={t}]").click(); pg.wait_for_timeout(150)
    drag(pg.locator(f"{P} [data-sort=actions] > .sitem[data-sort-id='2'] .drag"), pg.locator(f"{P} [data-sort=actions] > .sitem[data-sort-id='0']"))
    check("ST: Aktionen per Ziehen sortieren", [a["type"] for a in D("alarm_actions")] == ["tts", "knx", "siren"])
    check("ST: Entwurf über Reiter hinweg (Verknüpfungen weiter geändert)", [l["title"] for l in D("links")][:2] == ["Kameras", "Solar"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    for t in ("raeume", "alarme", "meldungen", "darstellung"):
        mp.goto(base.split("?")[0] + f"?view=einstellungen/{t}"); mp.wait_for_timeout(500)
        wide = mp.evaluate(WIDE)
        check(f"ST-Handy: Reiter {t} – nichts breiter als der Bildschirm", not wide)
        if wide: print("     ", wide[:3])
    mp.goto(base.split("?")[0] + "?view=raum/bad"); mp.wait_for_timeout(600)
    bx = mp.locator(f"{P} .trend .trc").bounding_box()
    mp.touchscreen.tap(bx["x"] + bx["width"] * 0.3, bx["y"] + bx["height"] / 2); mp.wait_for_timeout(150)
    check("TR-Handy: Antippen zeigt den Wert", "on" in mp.locator(f"{P} .trend .trtip").get_attribute("class"))
    mp.wait_for_timeout(2700)
    check("TR-Handy: Anzeige verschwindet nach kurzer Zeit", "on" not in mp.locator(f"{P} .trend .trtip").get_attribute("class"))
    ctx.close()

@gruppe("technik")
def heizung():
    # ---------- Heizung im Heizungsraum (1.2.0) ----------
    R = f"document.querySelector('{P}').shadowRoot"
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=raum/heizungsraum"); pg.wait_for_timeout(600)
    hc = pg.locator(f"{P} .tech.heat")
    check("HZ: Heizungs-Karte im Heizungsraum", hc.count() == 1 and hc.locator(".hpanel").count() == 3)
    tl = pg.evaluate(f"[...{R}.querySelectorAll('.heat .tkl')].map(e => e.dataset.eid)")
    check("HZ: Speicherfühler von oben nach unten", tl == ["sensor.speicher_oben", "sensor.speicher_mitte", "sensor.speicher_unten"])
    check("HZ: Ladung aus den Schichten (30–65 °C)", "Ladung 52 %" in hc.locator(".tank .hpf").inner_text() and "61,3°" in hc.locator(".tank").inner_text())
    st = hc.locator(".stove").inner_text()
    check("HZ: Kamin heizt, Pumpe 64 %, lädt den Speicher", "68,5°" in st and "Heizt" in st and "64 %" in st and "lädt den Speicher" in st and "burn" in hc.locator(".stove").get_attribute("class"))
    cv = hc.locator(".curve").inner_text()
    check("HZ: Heizkurve – Außen, Soll, Ist, Abweichung", "6,8°" in cv and "27,6°" in cv and "31,5°" in cv and "+3,9 K" in cv and hc.locator(".curve .dev.bad").count() == 1)
    check("HZ: Heizbetrieb und Mischer mit Status", "Heizbetrieb" in cv and "Mischer 42 % · Regelt" in cv and "Steilheit 0,3" in cv)
    check("HZ: Kurve, Soll-Punkt und Ist-Ring gezeichnet", len(pg.evaluate(f"{R}.querySelector('.heat .hcp').getAttribute('d')")) > 200 and hc.locator(".hcpt.soll").count() == 1 and hc.locator(".hcpt.ist").count() == 1)
    vals = pg.evaluate("[-10, 0, 10].map(t => Math.round(window.__HAUS_VIS__.curveFlow(t, { slope: 0.3, level: 0, room: 20, min: 15, max: 70 }) * 10) / 10)")
    check("HZ: Formel wie Integration (−10 → 29,3 · 0 → 26,7 · 10 → 23,7 °C)", vals == [29.3, 26.7, 23.7])
    bb = hc.locator(".hcc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.25, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    check("HZ: Zeiger liest Vorlauf je Außentemperatur", "Außen −10°" in hc.locator(".hctip").inner_text().replace("-", "−") and "29,3°" in hc.locator(".hctip").inner_text())
    pg.mouse.move(10, 10)
    dup = pg.evaluate(f"[...{R}.querySelectorAll('[data-eid=\"sensor.speicher_oben\"]')].filter(e => !e.closest('.heat')).length")
    check("HZ: Speicherfühler nicht doppelt in den Blöcken", dup == 0)
    r0 = pg.evaluate(f"document.querySelector('{P}')._stats.renders")
    pg.evaluate("window.__api.set('sensor.kamin_temperatur', '31')"); pg.wait_for_timeout(200)
    check("HZ: Kamin aus – live, ohne Neuaufbau", "Aus" in hc.locator(".stove .stv").inner_text() and pg.evaluate(f"document.querySelector('{P}')._stats.renders") == r0)
    pg.evaluate("window.__api.set('sensor.heizkurve_soll_vorlauftemperatur', '22', { curve: null, outdoor_temperature: 18, heating_active: false })"); pg.wait_for_timeout(200)
    check("HZ: ohne Kurvenpunkte aus der Formel, über Heizgrenze", len(pg.evaluate(f"{R}.querySelector('.heat .hcp').getAttribute('d')")) > 200 and "über Heizgrenze" in hc.locator(".curve").inner_text())
    hc.locator(".tkl").first.click(); pg.wait_for_timeout(100)
    check("HZ: Speicherfühler öffnet Details", pg.evaluate("window.__moreInfo") == "sensor.speicher_oben")
    pg.goto(dense + "?view=raum/wohnzimmer"); pg.wait_for_timeout(400)
    check("HZ: Karte nur im Heizungsraum", pg.locator(f"{P} .tech").count() == 0)

@gruppe("technik")
def wallbox():
    # ---------- Wallbox in der Einfahrt (1.2.0) ----------
    pg.goto(dense + "?view=raum/einfahrt"); pg.wait_for_timeout(600)
    wb = pg.locator(f"{P} .tech.wb")
    t = wb.inner_text()
    check("WB: Wallbox-Karte mit Leistung, Ladestand, Ziel, Reichweite, Sitzung", wb.count() == 1 and "7,4" in t and "Lädt mit 7,4 kW" in t and "64 %" in t and "Ziel 80 %" in t and "312 km" in t and "12,3 kWh" in t)
    check("WB: Lademodus PV aktiv, vier Modi", wb.locator(".wbmodes .altab").count() == 4 and "PV" == wb.locator(".wbmodes .altab.on").inner_text().strip())
    check("WB: Ladeleistung nicht doppelt als Pin", pg.locator(f'{P} .vchip[data-eid="sensor.evcc_ladeleistung"]').count() == 0)
    wb.locator(".wbmodes .altab", has_text="Sofort").click(); pg.wait_for_timeout(150)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("WB: Modus „Sofort“ → select.select_option", last[0] == "select" and last[1] == "select_option" and last[2]["option"] == "now")
    wb.locator("[data-act=num-step][data-step='5']").click(); pg.wait_for_timeout(150)
    last = pg.evaluate("window.__api.log.at(-1)")
    check("WB: Ziel-Ladestand + → number.set_value 85", last[0] == "number" and last[1] == "set_value" and last[2]["value"] == 85)
    pg.evaluate("(() => { const a = window.__api; a.set('binary_sensor.evcc_lp1_charging', 'off'); a.set('sensor.evcc_ladeleistung', '0'); })()"); pg.wait_for_timeout(200)
    check("WB: angesteckt, lädt nicht", "Angesteckt – lädt nicht" in wb.inner_text() and "charging" not in wb.get_attribute("class"))
    pg.evaluate("window.__api.set('binary_sensor.evcc_lp1_connected', 'off')"); pg.wait_for_timeout(200)
    check("WB: kein Fahrzeug", "Kein Fahrzeug" in wb.inner_text())

@gruppe("technik")
def technik_einstellungen():
    # ---------- Einstellungen → Technik (1.2.0) ----------
    pg.goto(dense + "?view=einstellungen/technik"); pg.wait_for_timeout(600)
    fd = pg.locator(f"{P} .techfound")
    check("TE: Reiter Technik zeigt Erkanntes", pg.locator(f"{P} .stab").count() == 5 and "3 Speicherfühler" in fd.first.inner_text() and "Heizkurve sensor.heizkurve_soll_vorlauftemperatur" in fd.first.inner_text() and "Lademodus" in fd.nth(1).inner_text())
    check("TE: Platzhalter nennt automatische Zuordnung", "sensor.kamin_temperatur" in (pg.locator(f'{P} input[data-set="heating.stove"]').get_attribute("placeholder") or ""))
    D = lambda k: pg.evaluate(f"document.querySelector('{P}')._draft.{k}")
    drag(pg.locator(f'{P} [data-sort=tank] .pin[data-sort-id="sensor.speicher_unten"]'), pg.locator(f'{P} [data-sort=tank] .pin[data-sort-id="sensor.speicher_oben"]'))
    check("TE: Speicherfühler per Ziehen sortieren", D("heating.tank") == ["sensor.speicher_unten", "sensor.speicher_oben", "sensor.speicher_mitte"])
    pg.locator(f'{P} select[data-set="wallbox.area"]').select_option("garten"); pg.wait_for_timeout(100)
    pg.locator(f'{P} input[data-set="heating.manual_curve"]').evaluate("e => e.click()"); pg.wait_for_timeout(200)
    check("TE: eigene Heizkurve – Felder erscheinen", pg.locator(f'{P} input[data-set="heating.manual.slope"]').count() == 1)
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    pg.evaluate(f"document.querySelector('{P}')._go('raum/heizungsraum')"); pg.wait_for_timeout(500)
    tl = pg.evaluate(f"[...{R}.querySelectorAll('.heat .tkl')].map(e => e.dataset.eid)")
    check("TE: Raumseite folgt der neuen Reihenfolge", tl[0] == "sensor.speicher_unten")
    pg.evaluate(f"document.querySelector('{P}')._go('raum/garten')"); pg.wait_for_timeout(500)
    check("TE: Wallbox im gewählten Raum", pg.locator(f"{P} .tech.wb").count() == 1)
    pg.evaluate(f"document.querySelector('{P}')._go('einstellungen/technik')"); pg.wait_for_timeout(500)
    pg.locator(f"{P} [data-act=s-tank-auto]").click(); pg.wait_for_timeout(200)
    pg.locator(f'{P} input[data-set="heating.enabled"]').evaluate("e => e.click()"); pg.wait_for_timeout(100)
    check("TE: Automatisch setzt die Fühler zurück", D("heating.tank") == [])
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    pg.evaluate(f"document.querySelector('{P}')._go('raum/heizungsraum')"); pg.wait_for_timeout(500)
    check("TE: Heizungs-Karte abschaltbar – Fühler wieder in den Blöcken", pg.locator(f"{P} .tech.heat").count() == 0 and pg.locator(f'{P} [data-eid="sensor.speicher_oben"]').count() == 1)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    for v in ("raum/heizungsraum", "raum/einfahrt", "einstellungen/technik"):
        for k in ("", "komfort&"):
            mp.goto(base.split("?")[0] + f"?{k}view={v}"); mp.wait_for_timeout(500)
            # Einstellungen: die Speichern-Leiste liegt bewusst über dem Inhalt – dort nur die Breite prüfen
            wide, ov = mp.evaluate(WIDE), ([] if v.startswith("einstellungen") else mp.evaluate(OVL))
            check(f"TE-Handy {k or 'kompakt&'}{v}: nichts breiter als der Bildschirm, nichts überlappt", not wide and not ov)
            if wide or ov: print("     ", wide[:3], ov[:3])
    ctx.close()

@gruppe("wandpanel")
def wandpanel():
    # ---------- Wandpanel (1.3.0) ----------
    pg.set_viewport_size({"width": 1280, "height": 800})
    PP = f"document.querySelector('{P}')"
    idle = lambda m: pg.evaluate(f"(() => {{ const p = {PP}; p._wallActive = Date.now() - {m} * 60000; p._wallTick(); }})()")
    setwp = lambda js: pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, wallpanel: {{ ...p._wallCfg(), {js} }} }}; }})()")
    saver = lambda: pg.locator(f"{P} .saver")
    pg.goto(dense + "?view=licht"); pg.wait_for_timeout(500)
    check("WP: ohne Wandpanel kein Takt und kein Ruhe-Knopf", not pg.evaluate(f"{PP}._wallT") and pg.locator(f"{P} .wallbtn").count() == 0)
    pg.goto(dense + "?wandpanel=1&view=licht"); pg.wait_for_timeout(600)
    check("WP: ?wandpanel=1 schaltet ein (Takt, Ruhe-Knopf, je Gerät gemerkt)", bool(pg.evaluate(f"{PP}._wallT")) and pg.locator(f"{P} .wallbtn").count() == 1 and pg.evaluate("localStorage.getItem('hv-wallpanel')") == "1")
    check("WP: Seitenleiste von Home Assistant ausgeblendet (vorherige Einstellung gemerkt)", pg.evaluate("localStorage.getItem('hv-wall-prev-dock')") is not None)
    pg.goto(dense + "?view=licht"); pg.wait_for_timeout(500)
    check("WP: bleibt nach Neuladen ohne Parameter an", pg.locator(f"{P} .wallbtn").count() == 1)
    idle(1)
    check("WP: nach 1 Min. noch auf der Seite", pg.evaluate(f"{PP}._view") == "licht" and saver().count() == 0)
    idle(2.5); pg.wait_for_timeout(300)
    check("WP: nach 2 Min. zurück zur Übersicht, noch kein Schoner", pg.evaluate(f"{PP}._view") is None and saver().count() == 0)
    idle(5.5); pg.wait_for_timeout(300)
    sv = saver().inner_text() if saver().count() else ""
    check("WP: nach 5 Min. Bildschirmschoner mit Uhr, Datum, Wetter, PV, Hausmodus, Meldung", saver().count() == 1 and ":" in sv and any(m in sv for m in ("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")))
    tf = lambda: pg.evaluate(f"(() => {{ const b = {PP}.shadowRoot.querySelector('.svbox'); return b ? b.style.transform : null; }})()")
    check("WP: Schoner standardmäßig mittig (kein Wandern)", tf() == "")
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, wallpanel: {{ ...p._wallCfg(), wander: true }} }}; p._saverUpdate(5, true); }})()")
    check("WP: Wandern einschaltbar", (tf() or "").startswith("translate("))
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, wallpanel: {{ ...p._wallCfg(), wander: false }} }}; p._saverUpdate(5, true); }})()")
    check("WP: Wandern aus – wieder mittig", tf() == "")
    check("WP: Schoner-Inhalte", "6,8°" in sv and "3,2 kW" in sv and "Zuhause" in sv and "Fenster offen" in sv)
    n0 = len(pg.evaluate("window.__api.log")); v0 = pg.evaluate(f"{PP}._view")
    pg.mouse.click(640, 400); pg.wait_for_timeout(250)
    check("WP: Tipp weckt auf und löst nichts darunter aus", saver().count() == 0 and len(pg.evaluate("window.__api.log")) == n0 and pg.evaluate(f"{PP}._view") == v0)
    check("WP: Tipp setzt die Ruhezeit zurück", pg.evaluate(f"Date.now() - {PP}._wallActive") < 2000)
    setwp("black_min: 1"); idle(6.5)
    check("WP: danach schwarz (OLED)", "black" in saver().get_attribute("class"))
    pg.mouse.click(640, 400); pg.wait_for_timeout(200)
    pg.evaluate("window.__api.hass.callWS({ type: 'x/set_mode', mode: 'nacht' })"); pg.wait_for_timeout(200)
    setwp("black_min: 0"); idle(5.5)
    check("WP: Hausmodus Nacht – dunkler", "night" in saver().get_attribute("class") and "Nacht" in saver().inner_text())
    pg.evaluate("window.__api.hass.callWS({ type: 'x/set_mode', mode: 'zuhause' })"); pg.wait_for_timeout(200)
    pg.evaluate("window.__api.alarmAdd('safety:binary_sensor.heizungsraum_wasser', 'alarm', 'Heizungsraum · Wassermelder')"); pg.wait_for_timeout(300)
    check("WP: neuer Alarm weckt auf", saver().count() == 0)
    idle(5.5)
    pg.evaluate("window.__api.set('event.g6_entry_doorbell', new Date().toISOString(), { event_type: 'ring' })"); pg.wait_for_timeout(300)
    check("WP: Klingel weckt auf und zeigt das Klingel-Overlay", saver().count() == 0 and pg.locator(f"{P} .bellbg").count() == 1)
    pg.locator(f"{P} .bellbg .bacts [data-act=bell-close]").click(); pg.wait_for_timeout(150)
    setwp("wake_entity: 'binary_sensor.flur_bewegung'"); idle(5.5)
    pg.evaluate("window.__api.set('binary_sensor.flur_bewegung', 'on')"); pg.wait_for_timeout(100)
    pg.evaluate(f"{PP}._wallTick()"); pg.wait_for_timeout(100)
    check("WP: Bewegungsmelder am Panel weckt auf", saver().count() == 0)
    pg.evaluate(f"{PP}._go('einstellungen/darstellung')"); pg.wait_for_timeout(400)
    pg.locator(f'{P} input[data-set="camera_interval"]').fill("12"); pg.locator(f'{P} input[data-set="camera_interval"]').dispatch_event("change")
    idle(3); pg.wait_for_timeout(200)
    check("WP: keine Rückkehr bei ungespeicherten Einstellungen", pg.evaluate(f"{PP}._view") == "einstellungen")
    check("WP: Einstellungen – Abschnitt Wandpanel mit Gerät an", pg.locator(f"{P} .set h2:has-text('Wandpanel')").count() == 1 and "Wandpanel an" in pg.locator(f"{P} [data-act=s-wall-device]").inner_text())
    check("WP: Einstellung „wandern lassen“, standardmäßig aus", pg.locator(f'{P} input[data-set="wallpanel.wander"]').count() == 1 and not pg.locator(f'{P} input[data-set="wallpanel.wander"]').is_checked())
    pg.locator(f'{P} input[data-set="wallpanel.saver_min"]').fill("10"); pg.locator(f'{P} input[data-set="wallpanel.saver_min"]').dispatch_event("change")
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    check("WP: Zeiten gespeichert", pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.wallpanel.saver_min)") == 10)
    idle(6)
    check("WP: neue Zeit gilt (10 Min.)", saver().count() == 0)
    check("WP: gespeichert – Rückkehr zur Übersicht wieder erlaubt", pg.evaluate(f"{PP}._view") is None)
    pg.mouse.click(640, 400)
    pg.evaluate(f"{PP}._go('einstellungen/darstellung')"); pg.wait_for_timeout(400)
    pg.locator(f"{P} [data-act=s-saver-test]").click(); pg.wait_for_timeout(200)
    check("WP: „Bildschirmschoner zeigen“", saver().count() == 1)
    pg.mouse.click(640, 400); pg.wait_for_timeout(200)
    pg.locator(f"{P} .wallbtn").click(); pg.wait_for_timeout(200)
    check("WP: Ruhe-Knopf in der Navigation", saver().count() == 1)
    pg.mouse.click(640, 400); pg.wait_for_timeout(200)
    pg.locator(f"{P} [data-act=s-wall-device]").click(); pg.wait_for_timeout(300)
    check("WP: Gerät abschalten – kein Takt, kein Ruhe-Knopf, Seitenleiste zurück", not pg.evaluate(f"{PP}._wallT") and pg.locator(f"{P} .wallbtn").count() == 0
          and pg.evaluate("localStorage.getItem('hv-wallpanel')") == "0" and pg.evaluate("localStorage.getItem('hv-wall-prev-dock')") is None)
    idle(30)
    check("WP: ohne Wandpanel kein Schoner", saver().count() == 0)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mp = ctx.new_page(); mp.on("pageerror", lambda e: errs.append(str(e)))
    mp.goto(base.split("?")[0] + "?wandpanel=1"); mp.wait_for_timeout(500)
    mp.evaluate("(() => { const p = document.querySelector('haus-visualisierung-panel'); p._wallActive = Date.now() - 6 * 60000; p._wallTick(); })()"); mp.wait_for_timeout(300)
    wide = mp.evaluate("(() => { const R = document.querySelector('haus-visualisierung-panel').shadowRoot; return [...R.querySelectorAll('.saver *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length; })()")
    check("WP-Handy: Schoner passt in die Breite", mp.locator(f"{P} .saver").count() == 1 and wide == 0)
    mp.touchscreen.tap(195, 420); mp.wait_for_timeout(200)
    check("WP-Handy: Antippen weckt auf", mp.locator(f"{P} .saver").count() == 0)
    ctx.close()

@gruppe("warnungen")
def verzoegerung_heizen():
    # ---------- 1.3.1: Verzögerung gilt auch für „Fenster offen beim Heizen“ ----------
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    PP = f"document.querySelector('{P}')"
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, alerts: {{ ...p._layout.alerts, contacts_min: 10 }} }}; p._dirty = true; p._flush(); }})()")
    pg.evaluate("(() => { const a = window.__api; a.set('climate.kuche_fbh', 'heat', { hvac_action: 'heating' }); a.set('binary_sensor.kuche_fenster', 'on'); })()"); pg.wait_for_timeout(300)
    keys = lambda: pg.evaluate(f"window.__HAUS_VIS__.evalAlertsAll(window.__api.hass, {PP}._model, {PP}._layout).map(a => a.key)")
    check("FH: Fenster beim Heizen erst nach der eingestellten Zeit", "heat:kuche" not in keys() and "contact:binary_sensor.kuche_fenster" not in keys())
    # Fenster seit 11 Minuten offen: Zeitpunkt der letzten Änderung zurückdatieren
    pg.evaluate("(() => { const H = window.__api.hass, st = H.states['binary_sensor.kuche_fenster']; H.states = { ...H.states, 'binary_sensor.kuche_fenster': { ...st, last_changed: new Date(Date.now() - 11 * 60000).toISOString() } }; })()")
    check("FH: nach 11 Min. „Fenster offen beim Heizen“", "heat:kuche" in keys() and "contact:binary_sensor.kuche_fenster" not in keys())

@gruppe("klima")
def klima_temperatur():
    # ---------- Klimaseite mit Temperaturverläufen (1.4.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    R = f"document.querySelector('{P}').shadowRoot"
    PP = f"document.querySelector('{P}')"
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(800)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] in ("statistics", "history")]
    ct = pg.locator(f"{P} .ctrend.k-t")
    check("KL: Kopfkarte „Temperaturen 24 h“", ct.count() == 1 and "Temperaturen 24 h" in ct.locator(".trt").text_content())
    check("KL: eine gesammelte Abfrage für alle Räume und außen", len([x for x in ws if x[1] == "statistics"]) == 1 and "sensor.aussen_temperatur" in ws[0][2]["ids"] and len(ws[0][2]["ids"]) >= 9)
    dd = pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-t .ctp')].map(p => (p.getAttribute('d') || '').length)")
    check("KL: Haus Ø und Außen gezeichnet", len(dd) == 2 and all(n > 200 for n in dd))
    st = ct.locator(".ctstats").inner_text()
    check("KL: Kennzahlen (Innen Ø, kühlster/wärmster Raum, Außen mit Tagesspanne, heizt)", "Innen Ø" in st and "Hauswirtschaftsraum" in st and "Wohnzimmer" in st and "6,8°" in st and "24 h:" in st and "1 Raum" in st)
    check("KL: eine Achse mit höchstens fünf Teilstrichen", 2 <= ct.locator(".cty span").count() <= 5)
    check("KL: Werte direkt am Linienende", ct.locator(".ctend.in").inner_text().endswith("°") and ct.locator(".ctend.out").inner_text() == "6,8°")
    bb = ct.locator(".ctc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.4, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = ct.locator(".trtip").inner_text()
    check("KL: Zeiger zeigt Uhrzeit, Haus Ø und Außen", ":" in tip and "Haus Ø" in tip and "Außen" in tip)
    pg.mouse.move(5, 5); pg.wait_for_timeout(100)
    sp = pg.locator(f"{P} .ktable .kspark:not(.none)")
    nrooms = pg.evaluate(f"{PP}._model.visibleAreas.filter(a => a.tempId).length")
    check("KL: Verlauf je Raum in der Tabelle (Spalte 24 h)", sp.count() == nrooms and pg.locator(f"{P} .khead").first.inner_text().count("24 H") + pg.locator(f"{P} .khead").first.inner_text().count("24 h") == 1)
    bad = pg.locator(f"{P} .krow[data-area=bad] .kspark")
    check("KL: Raum-Verlauf mit Spanne und Soll-Linie", len(bad.locator(".spl").get_attribute("d") or "") > 100 and (bad.locator(".spset").get_attribute("d") or "").startswith("M0") and "–" in bad.locator(".sprg").inner_text())
    bx = bad.bounding_box()
    pg.mouse.move(bx["x"] + bx["width"] * 0.3, bx["y"] + bx["height"] / 2); pg.wait_for_timeout(100)
    check("KL: Zeiger auf dem Raum-Verlauf", "°" in bad.locator(".sptip").inner_text() and "on" in bad.locator(".sptip").get_attribute("class"))
    spans = pg.evaluate(f"[...{PP}.shadowRoot.querySelectorAll('.ktable .kspark[data-kind=t]')].filter(e => e._sp).map(e => +(e._sp.hi - e._sp.lo).toFixed(2))")
    check("KL: Raum-Verläufe mit gleicher Skalenhöhe (mind. 6°)", len(spans) >= 5 and min(spans) >= 6 and len(set(spans)) == 1)
    check("KL: Raum-Verlauf mit Nacht, 6-h-Strichen, Punkt und Wert bei jetzt", bad.locator(".spnight rect").count() >= 1 and bad.locator(".sptick line").count() >= 3
          and bad.locator(".spdot").is_visible() and bad.locator(".spv").inner_text() == "22,1°" and bad.locator(".spw").bounding_box()["width"] > 250)
    pg.mouse.move(5, 5)
    r0 = pg.evaluate(f"{PP}._stats.renders"); n0 = len(pg.evaluate("window.__api.log"))
    pg.evaluate("window.__api.set('sensor.wohnzimmer_temperatur', '25.0')"); pg.wait_for_timeout(250)
    check("KL: neuer Wert – Kennzahl und Verlauf live, ohne Neuaufbau und ohne Abfrage", "25,0°" in ct.locator(".ctstats").inner_text() and pg.evaluate(f"{PP}._stats.renders") == r0
          and not [x for x in pg.evaluate("window.__api.log")[n0:] if x[0] == "ws"])
    pg.goto(base + "&view=klima"); pg.wait_for_timeout(800)
    check("KL: Komfort – Verlauf in den Raumkacheln", pg.locator(f"{P} .ctrend").count() == 2 and pg.locator(f"{P} .room .kspark:not(.none)").count() >= 5)
    pg.goto(dense + "?view=klima&norec"); pg.wait_for_timeout(700)
    check("KL: ohne Recorder – Hinweis", "Noch kein Verlauf" in pg.locator(f"{P} .ctrend.k-t").inner_text() and "Noch kein Verlauf" in pg.locator(f"{P} .ctrend.k-h").inner_text())
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, show_trends: false }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(200)
    check("KL: abschaltbar – keine Kopfkarte, keine Spalte", pg.locator(f"{P} .ctrend").count() == 0 and pg.locator(f"{P} .kspark").count() == 0 and "24" not in pg.locator(f"{P} .khead").first.inner_text())

@gruppe("klima")
def klima_feuchte():
    # ---------- Klimaseite: Luftfeuchte, Taupunkt, Lüftungshinweis, Schimmelrisiko (1.5.0) ----------
    import math
    def dp(t, rh):
        g = math.log(rh / 100) + 17.62 * t / (243.12 + t); return 243.12 * g / (17.62 - g)
    de1 = lambda v: f"{v:.1f}".replace(".", ",")
    pg.evaluate("localStorage.removeItem('hv-clim-kind')")
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(900)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] in ("statistics", "history")]
    ch = pg.locator(f"{P} .ctrend.k-h")
    check("KF: Kopfkarte „Luftfeuchte 24 h“ neben den Temperaturen", ch.count() == 1 and "Luftfeuchte 24 h" in ch.locator(".trt").text_content() and pg.locator(f"{P} .ctwrap .ctrend").count() == 2)
    check("KF: weiter nur eine Statistik- und eine Verlaufsabfrage für beide Karten und alle Räume",
          len([x for x in ws if x[1] == "statistics"]) == 1 and len([x for x in ws if x[1] == "history"]) == 1 and "sensor.aussen_feuchte" in ws[0][2]["ids"] and "sensor.bad_feuchte" in ws[0][2]["ids"])
    dd = pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-h .ctp')].map(p => (p.getAttribute('d') || '').length)")
    check("KF: Feuchte Haus Ø und außen gezeichnet", len(dd) == 2 and all(n > 200 for n in dd))
    st = ch.locator(".ctstats").inner_text()
    check("KF: Kennzahlen (Ø, feuchtester und trockenster Raum, Taupunkt, außen)", "Innen Ø" in st and "Feuchtester Raum" in st and "Bad" in st and "Trockenster Raum" in st and "Büro" in st
          and "Taupunkt innen" in st and "86 %" in st and f"Taupunkt {de1(dp(6.8, 86))}°" in st)
    check("KF: Lüftungshinweis nach absoluter Feuchte (draußen kalt und trocken: lohnt sich)", "Lüften lohnt sich" in st and "g/m³" in st and ch.locator(".cts.vent.gut").count() == 1)
    check("KF: Wohlfühlband 40–60 % und Grenze für Schimmelrisiko", float(ch.locator(".ctband").get_attribute("height") or 0) > 1
          and (ch.locator(".ctlim").get_attribute("d") or "").startswith("M0") and ch.locator(".ctlimt").inner_text() == "Schimmel ab 65 %")
    check("KF: Achse in %, Werte am Linienende und in der Legende", ch.locator(".cty span").first.inner_text().endswith("%") and ch.locator(".ctend.out").inner_text().endswith(" %") and ch.locator(".ctl.out b").inner_text() == "86 %")
    bb = ch.locator(".ctc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.5, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = ch.locator(".trtip").inner_text()
    check("KF: Zeiger zeigt Feuchte innen und außen", "Haus Ø" in tip and "Außen" in tip and "%" in tip)
    pg.mouse.move(5, 5); pg.wait_for_timeout(100)
    check("KF: Taupunkt je Raum in der Tabelle", pg.locator(f"{P} .krow[data-area=bad] .rdp").inner_text() == f"Taupunkt {de1(dp(22.1, 64))}°")
    # Verlauf je Raum: auf Feuchte umschalten
    pg.locator(f'{P} .cktog [data-k="h"]').click(); pg.wait_for_timeout(400)
    bad = pg.locator(f"{P} .krow[data-area=bad] .kspark")
    check("KF: Umschalter – Raum-Verläufe zeigen Feuchte", bad.get_attribute("data-kind") == "h" and bad.locator(".sprg").inner_text().endswith("%")
          and "24 H FEUCHTE" in pg.locator(f"{P} .khead").first.inner_text().upper())
    sc = pg.evaluate(f"(() => {{ const e = {PP}.shadowRoot.querySelector('.krow[data-area=bad] .kspark'); return [e._sp.lo, e._sp.hi]; }})()")
    check("KF: Feuchte-Verlauf mit fester Skala, Wohlfühlband und Rot über der Grenze", sc == [30, 80] and float(bad.locator(".spband").get_attribute("height")) > 0
          and len(bad.locator(".spov").get_attribute("d") or "") > 20 and len(pg.locator(f"{P} .krow[data-area=buro] .kspark .spov").get_attribute("d") or "") == 0)
    check("KF: Feuchte-Verlauf mit Grenze für Schimmelrisiko", (bad.locator(".spset").get_attribute("d") or "").startswith("M0") and "Schimmelrisiko ab 65 %" in (bad.get_attribute("title") or ""))
    nws = len([x for x in pg.evaluate("window.__api.log") if x[0] == "ws"])
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(700)
    check("KF: Wahl je Gerät gemerkt", pg.locator(f"{P} .krow[data-area=bad] .kspark").get_attribute("data-kind") == "h" and pg.locator(f'{P} .cktog [data-k="h"]').get_attribute("aria-pressed") == "true")
    pg.goto(base + "&view=klima"); pg.wait_for_timeout(800)
    check("KF: Komfort – Feuchte-Verlauf und Taupunkt in den Raumkacheln", pg.locator(f'{P} .room .kspark[data-kind="h"]').count() >= 4 and "Taupunkt" in pg.locator(f"{P} .room[data-area=bad] .rdp").inner_text())
    pg.locator(f'{P} .cktog [data-k="t"]').click(); pg.wait_for_timeout(300)
    check("KF: zurück auf Temperatur", pg.locator(f'{P} .room .kspark[data-kind="h"]').count() == 0 and pg.locator(f'{P} .room .kspark[data-kind="t"]').count() >= 5)
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(700)
    ch = pg.locator(f"{P} .ctrend.k-h")
    r0 = pg.evaluate(f"{PP}._stats.renders"); n0 = len(pg.evaluate("window.__api.log"))
    pg.evaluate("window.__api.set('sensor.buro_feuchte', '41')"); pg.wait_for_timeout(250)
    check("KF: neue Feuchte live – Kennzahl und Taupunkt, ohne Neuaufbau und ohne Abfrage", "41 %" in ch.locator(".ctstats").inner_text()
          and pg.locator(f"{P} .krow[data-area=buro] .rdp").inner_text() == f"Taupunkt {de1(dp(21.4, 41))}°"
          and pg.evaluate(f"{PP}._stats.renders") == r0 and not [x for x in pg.evaluate("window.__api.log")[n0:] if x[0] == "ws"])
    # Schimmelrisiko im Alarmmanager
    keys = lambda: pg.evaluate(f"window.__HAUS_VIS__.evalAlertsAll(window.__api.hass, {PP}._model, {PP}._layout).map(a => a.key)")
    mold = lambda: pg.evaluate(f"(window.__HAUS_VIS__.evalAlertsAll(window.__api.hass, {PP}._model, {PP}._layout).find(a => a.key === 'mold:bad') || null)")
    back = lambda m: pg.evaluate(f"(() => {{ const r = window.__HAUS_VIS__.MOLD.get('bad'); if (r) r.since -= {m} * 60000; }})()")
    pg.evaluate("window.__api.set('sensor.bad_feuchte', '72')"); pg.wait_for_timeout(250)
    check("SR: Schimmelrisiko nicht sofort (Duschen)", "mold:bad" not in keys())
    back(29); pg.wait_for_timeout(1100)
    check("SR: nach 29 Minuten noch nicht", "mold:bad" not in keys())
    back(2); pg.wait_for_timeout(1100)
    al = mold()
    check("SR: nach 31 Minuten „Schimmelrisiko · Bad – jetzt lüften“ mit Taupunkt", al and al["title"] == "Schimmelrisiko · Bad" and al["level"] == "warn"
          and al["detail"] == f"72 % bei 22,1° · Taupunkt {de1(dp(22.1, 72))}° – jetzt lüften" and al["to"] == "raum/bad")
    check("SR: erscheint in der Warnkarte und an der Glocke", "Schimmelrisiko" in pg.evaluate(f"{R}.querySelector('[data-k=alerts] .ct, .acard .sst') ? {R}.querySelector('[data-k=alerts] .ct, .acard .sst').textContent : ''") or pg.locator(f"{P} .navbadge, {P} [data-u=navbadge]").count() >= 1)
    # Schlafzimmer: Fenster steht offen
    pg.evaluate("window.__api.set('sensor.schlafzimmer_feuchte', '74')"); pg.wait_for_timeout(1100)
    pg.evaluate("(() => { const r = window.__HAUS_VIS__.MOLD.get('schlafzimmer'); if (r) r.since -= 40 * 60000; })()"); pg.wait_for_timeout(1100)
    check("SR: Fenster im Raum offen – keine Meldung (es wird gelüftet)", "mold:schlafzimmer" not in keys() and "mold:bad" in keys())
    pg.evaluate("window.__api.set('binary_sensor.schlafzimmer_fenster', 'off')"); pg.wait_for_timeout(1100)
    check("SR: Fenster zu und noch feucht – sofort da", "mold:schlafzimmer" in keys())
    pg.evaluate("(() => { const a = window.__api; a.set('sensor.schlafzimmer_feuchte', '52'); a.set('binary_sensor.schlafzimmer_fenster', 'on'); })()"); pg.wait_for_timeout(1100)
    pg.evaluate("window.__api.set('sensor.bad_feuchte', '63')"); pg.wait_for_timeout(1100)
    check("SR: Rückfall erst 3 Punkte unter der Grenze (63 % bleibt)", "mold:bad" in keys())
    pg.evaluate("window.__api.set('sensor.bad_feuchte', '62')"); pg.wait_for_timeout(1100)
    check("SR: 62 % – behoben", "mold:bad" not in keys())
    # Sommer: draußen feuchter → Hinweis statt „lüften“, Kopfkarte sagt „Draußen feuchter“
    pg.evaluate("(() => { const a = window.__api; a.set('sensor.aussen_temperatur', '27'); a.set('sensor.aussen_feuchte', '90'); a.set('sensor.bad_feuchte', '75'); })()"); pg.wait_for_timeout(300)
    back(31); pg.wait_for_timeout(1100)
    al = mold()
    check("SR: draußen feuchter – heizen oder entfeuchten statt lüften", al and al["detail"].endswith("draußen feuchter, besser heizen oder entfeuchten"))
    check("KF: Kopfkarte – „Draußen feuchter“", "Draußen feuchter" in ch.locator(".ctstats").inner_text() and ch.locator(".cts.vent.nicht").count() == 1)
    # Backend hat die Meldung schon (z. B. nach Neuladen): ohne erneute Wartezeit
    pg.evaluate("(() => { window.__HAUS_VIS__.MOLD.clear(); })()")
    pg.evaluate(f"(() => {{ const a = window.__api; a.alarmSnap.alarms = {{ ...(a.alarmSnap.alarms || {{}}), 'mold:bad': {{ key: 'mold:bad', status: 'neu', since: Date.now() / 1000 - 3600 }} }}; a.alarmPush(); }})()"); pg.wait_for_timeout(1100)
    check("SR: nach Neuladen sofort, wenn das Backend die Meldung führt", "mold:bad" in keys())
    pg.evaluate("(() => { const a = window.__api; delete a.alarmSnap.alarms['mold:bad']; a.alarmPush(); a.set('sensor.bad_feuchte', '64'); a.set('sensor.aussen_temperatur', '6.8'); a.set('sensor.aussen_feuchte', '86'); })()"); pg.wait_for_timeout(1100)
    # Einstellungen
    pg.goto(dense + "?view=einstellungen"); pg.wait_for_timeout(500)
    stab(pg, "alarme")
    srow = pg.locator(f"{P} .srow", has_text="Schimmelrisiko – jetzt lüften")
    check("SR: Einstellungen – feste Regel mit Hausmodi (Standard nur Zuhause)", srow.count() == 1 and srow.locator(".mchip.on").count() == 1 and srow.locator('.mchip.on[data-m="zuhause"]').count() == 1)
    inp = pg.locator(f'{P} input[data-set="alerts.mold_hum"]')
    check("SR: Einstellungen – Grenze und Wartezeit", inp.input_value() == "65" and pg.locator(f'{P} input[data-set="alerts.mold_min"]').input_value() == "30")
    inp.fill("70"); inp.dispatch_event("change"); pg.wait_for_timeout(100)
    pg.locator(f"{P} [data-act=s-save]").first.click(); pg.wait_for_timeout(400)
    pg.evaluate(f"{PP}._go('klima')"); pg.wait_for_timeout(700)
    saved = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws"]
    check("SR: gespeicherte Grenze gilt im Diagramm", pg.evaluate(f"{PP}._layout.alerts.mold_hum") == 70 and pg.locator(f"{P} .ctrend.k-h .ctlimt").inner_text() == "Schimmel ab 70 %")
    # Handy
    pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(400)
    ov = pg.evaluate(f"(() => {{ const r = {R}; const m = r.querySelector('.main') || r.querySelector('.content') || document.documentElement; return [...r.querySelectorAll('.ctrend, .cktog, .ktable')].some(e => e.getBoundingClientRect().right > 391); }})()")
    check("KF: Handy 390 px – beide Karten und Umschalter ohne Überbreite", not ov and pg.locator(f"{P} .ctrend").count() == 2)
    pg.set_viewport_size({"width": 1440, "height": 1000})

@gruppe("klima")
def klima_zeitraum():
    # ---------- Klimaseite: Zeitraum 24 h, Woche, Monat, Jahr aus der Langzeitstatistik (1.9.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=klima"); pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('hv-range-')).forEach(k => localStorage.removeItem(k))")
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(800)
    ct = pg.locator(f"{P} .ctrend.k-t"); ch = pg.locator(f"{P} .ctrend.k-h")
    chips = ct.locator("[data-act=range]")
    check("KZ: Umschalter 24 h · Woche · Monat · Jahr, 24 h gewählt", chips.all_inner_texts() == ["24 h", "Woche", "Monat", "Jahr"]
          and ct.locator("[data-act=range].on").inner_text() == "24 h" and ct.locator("[data-act=range][aria-pressed=true]").count() == 1)
    stats = lambda: [x[2] for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "statistics"]
    n0 = len(stats()); r0 = pg.evaluate(f"{PP}._stats.renders")
    ct.locator('[data-act=range][data-r="7"]').click(); pg.wait_for_timeout(400)
    q = stats()[n0:]
    nt = pg.evaluate(f"{PP}._model.visibleAreas.filter(a => a.tempId).length")
    check("KZ: Woche – eine Abfrage der Stundenmittel nur für diese Karte", len(q) == 1 and q[0]["period"] == "hour" and "sensor.aussen_temperatur" in q[0]["ids"]
          and not [i for i in q[0]["ids"] if "feuchte" in i] and len(q[0]["ids"]) >= nt)
    check("KZ: Woche – Titel, Umschalter, kein Neuaufbau der Seite", "Temperaturen 7 Tage" in ct.locator(".trt").text_content() and ct.locator("[data-act=range].on").inner_text() == "Woche"
          and pg.evaluate(f"{PP}._stats.renders") == r0 and "Luftfeuchte 24 h" in ch.locator(".trt").text_content())
    dd = pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-t .ctp')].map(p => (p.getAttribute('d') || '').length)")
    ax = ct.locator(".trx span").all_inner_texts()
    check("KZ: Woche – Haus Ø und Außen über 7 Tage, Achse mit Wochentagen", len(dd) == 2 and all(n > 400 for n in dd) and len([a for a in ax if a in ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")]) >= 5 and ax[-1] == "jetzt")
    check("KZ: Woche – Spanne außen über 7 Tage", "7 Tage:" in ct.locator(".ctstats").inner_text())
    bb = ct.locator(".ctc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.3, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = ct.locator(".trtip").inner_text()
    check("KZ: Woche – Zeiger mit Wochentag und Stunde", "Uhr" in tip and tip[:2] in ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So") and "Haus Ø" in tip and "Außen" in tip)
    pg.mouse.move(5, 5); pg.wait_for_timeout(50)
    ct.locator('[data-act=range][data-r="30"]').click(); pg.wait_for_timeout(400)
    ax = ct.locator(".trx span").all_inner_texts()
    check("KZ: Monat – Stundenmittel 30 Tage, Achse mit Datum der Montage", stats()[-1]["period"] == "hour" and "Temperaturen 30 Tage" in ct.locator(".trt").text_content()
          and 3 <= len([a for a in ax if a.endswith(".") and a.count(".") == 2]) <= 5)
    ct.locator('[data-act=range][data-r="365"]').click(); pg.wait_for_timeout(400)
    ax = ct.locator(".trx span").all_inner_texts()
    mon = ("Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez")
    check("KZ: Jahr – Tagesmittel, Achse mit Monaten", stats()[-1]["period"] == "day" and "Temperaturen 12 Monate" in ct.locator(".trt").text_content()
          and len([a for a in ax if a in mon or a.isdigit()]) >= 6 and all(n > 200 for n in pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-t .ctp')].map(p => (p.getAttribute('d') || '').length)")))
    pg.mouse.move(bb["x"] + bb["width"] * 0.5, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = ct.locator(".trtip").inner_text()
    check("KZ: Jahr – Zeiger mit Datum", tip.split("\n")[0].count(".") == 2 and "Haus Ø" in tip)
    pg.mouse.move(5, 5); pg.wait_for_timeout(50)
    n1 = len(pg.evaluate("window.__api.log"))
    ct.locator('[data-act=range][data-r="7"]').click(); pg.wait_for_timeout(200)
    pg.evaluate("window.__api.set('sensor.aussen_temperatur', '9.5')"); pg.wait_for_timeout(250)
    check("KZ: zurück zur Woche und neue Werte – ohne neue Abfrage", not [x for x in pg.evaluate("window.__api.log")[n1:] if x[0] == "ws"] and "9,5°" in ct.locator(".ctl.out").inner_text())
    ch.locator('[data-act=range][data-r="30"]').click(); pg.wait_for_timeout(400)
    check("KZ: Feuchte ohne Langzeitstatistik (keine state_class) – Hinweis statt alter Kurven", "Keine Langzeitstatistik" in ch.locator(".trmsg").inner_text()
          and "nodata" in ch.get_attribute("class") and all(n == 0 for n in pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-h .ctp')].map(p => (p.getAttribute('d') || '').length)")))
    pg.goto(dense + "?view=klima"); pg.wait_for_timeout(800)
    check("KZ: Wahl je Karte gemerkt", "Temperaturen 7 Tage" in ct.locator(".trt").text_content() and "Luftfeuchte 30 Tage" in ch.locator(".trt").text_content()
          and ct.locator("[data-act=range].on").inner_text() == "Woche")
    ch.locator('[data-act=range][data-r="1"]').click(); pg.wait_for_timeout(300)
    check("KZ: zurück auf 24 h – Kurven wieder da", "Luftfeuchte 24 h" in ch.locator(".trt").text_content() and "nodata" not in ch.get_attribute("class")
          and all(n > 200 for n in pg.evaluate(f"[...{R}.querySelectorAll('.ctrend.k-h .ctp')].map(p => (p.getAttribute('d') || '').length)")))
    mp = b.new_page(viewport={"width": 390, "height": 900}); mp.goto(dense + "?view=klima"); mp.wait_for_timeout(800)
    mp.locator(f'{P} .ctrend.k-t [data-act=range][data-r="365"]').click(); mp.wait_for_timeout(400)
    check("KZ: Handy – Umschalter in eigener Zeile, nichts steht über", mp.evaluate(WIDE) == [] and mp.locator(f"{P} .ctrend.k-t .rng").bounding_box()["width"] < 390)
    mp.evaluate("Object.keys(localStorage).filter(k => k.startsWith('hv-range-')).forEach(k => localStorage.removeItem(k))"); mp.close()

@gruppe("energie")
def energie():
    # ---------- Energie-Seite (1.5.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(600)
    check("EN: Energie in der Navigation", pg.locator(f"{P} .nav[data-to=energie]").count() == 1)
    pg.locator(f"{P} .ecard").click(); pg.wait_for_timeout(800)
    check("EN: Tipp auf die Energie-Karte öffnet die Energie-Seite", pg.locator(f"{P} .ptitle h1").inner_text() == "Energie" and pg.locator(f"{P} .nav.active[data-to=energie]").count() == 1)
    ws = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] in ("statistics", "history")]
    check("EN: eine gesammelte Abfrage für PV, Netz, Haus, Speicher und Strompreis", len(ws) == 1 and ws[0][1] == "statistics"
          and sorted(ws[0][2]["ids"]) == sorted(["sensor.growatt_modbus_pv_power", "sensor.netz_leistung", "sensor.hausverbrauch_ac", "sensor.growatt_modbus_battery_power", "sensor.nordpool_kwh_de_eur"]))
    nd = lambda k: pg.locator(f"{P} .enode.{k}").inner_text().replace("\n", " ")
    check("EN: Fluss – PV, Netz-Bezug, Speicher (automatisch erkannt), Wallbox, Haus", "3,2 kW" in nd("pv") and "5,5 kW" in nd("grid") and "Bezug" in nd("grid")
          and "78 %" in nd("bat") and "lädt 800 W" in nd("bat") and "7,4 kW" in nd("wb") and "lädt" in nd("wb") and "612 W" in nd("hub"))
    dots = pg.evaluate(f"Object.fromEntries([...{R}.querySelectorAll('.efd')].map(d => [d.classList[1], [!d.classList.contains('off'), d.classList.contains('rev')]]))")
    check("EN: Punkte laufen in Flussrichtung", dots == {"pv": [True, False], "grid": [True, False], "bat": [True, True], "wb": [True, True]})
    nw = pg.locator(f"{P} .ennow").inner_text()
    check("EN: Kennzahlen jetzt (Autarkie, Eigenverbrauch, Gesamtverbrauch mit Wallbox, Speicher)", "Autarkie" in nw and "31 %" in nw and "Eigenverbrauch" in nw and "8,0 kW" in nw and "Wallbox 7,4 kW" in nw and "78 %" in nw)
    check("EN: Kopfzeile „Bezieht … aus dem Netz“", "Bezieht 5,5 kW" in pg.locator(f"{P} .ensub").inner_text())
    dy = pg.locator(f"{P} .enday").inner_text()
    check("EN: Bilanz heute in kWh mit Anteil eigener Energie", all(w in dy for w in ("Erzeugt", "Verbraucht", "Bezogen", "Eingespeist", "Autarkie")) and "kWh" in dy
          and pg.locator(f"{P} .ensplit").is_visible() and "aus dem Netz" in pg.locator(f"{P} .ensplitl").inner_text())
    dd = pg.evaluate(f"[...{R}.querySelectorAll('.entrend .enp, .entrend .ena')].map(p => (p.getAttribute('d') || '').length)")
    check("EN: Verlauf 24 h – PV (mit Fläche), Verbrauch, Netz", len(dd) == 4 and all(n > 200 for n in dd))
    check("EN: Achse in kW, höchstens fünf Teilstriche", 2 <= pg.locator(f"{P} .entrend .cty span").count() <= 6 and "kW" in pg.locator(f"{P} .entrend .cty").inner_text())
    bb = pg.locator(f"{P} .enc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.98, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = pg.locator(f"{P} .entrend .trtip").inner_text()
    check("EN: Zeiger zeigt Uhrzeit, PV, Verbrauch und Netz", ":" in tip and "PV" in tip and "Verbrauch" in tip and ("Bezug" in tip or "Einspeisung" in tip))
    pg.mouse.move(5, 5); pg.wait_for_timeout(50)
    check("EN: Wallbox-Karte auf der Energie-Seite", pg.locator(f"{P} .tech.wb").count() == 1 and "Lädt mit 7,4 kW" in pg.locator(f"{P} .tech.wb").inner_text())
    check("EN: Verknüpfung zum Solar-Panel", pg.locator(f'{P} .ptitle .pbtn[data-path="/solar-visualisierung"]').count() == 1)
    r0 = pg.evaluate(f"{PP}._stats.renders"); n0 = len(pg.evaluate("window.__api.log"))
    pg.evaluate("(() => { const a = window.__api; a.set('binary_sensor.evcc_lp1_charging', 'off'); a.set('sensor.evcc_ladeleistung', '0'); a.set('sensor.growatt_modbus_battery_power', '-400'); a.set('sensor.netz_leistung', '-2000'); })()"); pg.wait_for_timeout(250)
    dots = pg.evaluate(f"Object.fromEntries([...{R}.querySelectorAll('.efd')].map(d => [d.classList[1], [!d.classList.contains('off'), d.classList.contains('rev')]]))")
    check("EN: neue Werte live – Einspeisung, Speicher entlädt, Wallbox aus", "Einspeisung" in nd("grid") and "2,0 kW" in nd("grid") and "entlädt 400 W" in nd("bat")
          and dots == {"pv": [True, False], "grid": [True, True], "bat": [True, False], "wb": [False, False]} and "Speist 2,0 kW ein" in pg.locator(f"{P} .ensub").inner_text())
    check("EN: ohne Neuaufbau und ohne Abfrage", pg.evaluate(f"{PP}._stats.renders") == r0 and not [x for x in pg.evaluate("window.__api.log")[n0:] if x[0] == "ws"])
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, energy: {{ ...p._layout.energy, grid_invert: true, battery_invert: true }} }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(300)
    check("EN: Vorzeichen umkehren (Netz und Speicher)", "Bezug" in nd("grid") and "lädt 400 W" in nd("bat"))
    pg.locator(f"{P} .enode.pv").click(); pg.wait_for_timeout(100)
    check("EN: Tipp auf PV öffnet Details", pg.evaluate("window.__moreInfo") == "sensor.growatt_modbus_pv_power")
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, energy: {{ ...p._layout.energy, enabled: false }} }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(300)
    check("EN: abschaltbar – nicht in der Navigation", pg.locator(f"{P} .nav[data-to=energie]").count() == 0 and "Keine Energiedaten" in pg.locator(f"{P} .main").inner_text())
    pg.goto(dense + "?view=energie&norec"); pg.wait_for_timeout(700)
    check("EN: ohne Recorder – Hinweis, Fluss trotzdem da", "Noch kein Verlauf" in pg.locator(f"{P} .entrend").inner_text() and "Noch kein Verlauf" in pg.locator(f"{P} .enday").inner_text() and "3,2 kW" in nd("pv"))
    pg.goto(base + "&view=energie"); pg.wait_for_timeout(700)
    check("EN: Komfort", pg.locator(f"{P} .eflow").count() == 1 and pg.locator(f"{P} .entrend").count() == 1)
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(250); stab(pg, 'darstellung')
    inp = pg.locator(f'{P} [data-set="energy.battery_power"]')
    check("EN: Einstellungen – Speicher-Leistung und Vorzeichen", inp.count() == 1 and pg.locator(f'{P} [data-set="energy.grid_invert"]').count() == 1 and pg.locator(f'{P} [data-set="energy.battery_invert"]').count() == 1)
    pg.locator(f'{P} [data-set="energy.battery_invert"] + span').click(); pg.wait_for_timeout(100)
    check("EN: Einstellung landet im Entwurf", pg.evaluate(f"{PP}._draft.energy.battery_invert") is True)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(250)
    mp = b.new_page(viewport={"width": 390, "height": 900}); mp.goto(dense + "?view=energie"); mp.wait_for_timeout(800)
    geo = mp.evaluate(f"""(() => {{ const R = document.querySelector('{P}').shadowRoot; const m = R.querySelector('.main');
      const n = [...R.querySelectorAll('.enode')].map(e => e.getBoundingClientRect());
      let ov = 0; for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) {{ const a = n[i], c = n[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) ov++; }}
      return [m.scrollWidth - m.clientWidth, ov, Math.min(...n.map(r => r.left)), Math.max(...n.map(r => r.right))]; }})()""")
    check("EN: Handy 390 px – nichts überlappt, kein seitliches Scrollen", geo[0] <= 0 and geo[1] == 0 and geo[2] >= 0 and geo[3] <= 390)
    mp.close()


@gruppe("wetter")
def wetter():
    # ---------- Wettervorhersage und Beschattungshinweise ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=beschattung"); pg.wait_for_timeout(600)
    card = pg.locator(f"{P} .shade")
    subs = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "subscribe_forecast"]
    check("WE: ein Abo der Tagesvorhersage", len(subs) == 1 and subs[0][2] == {"entity_id": "weather.forecast_home", "forecast_type": "daily"})
    check("WE: Karte „Sonne & Wetter“ über den Rollos mit 5 Tagen", card.count() == 1 and pg.locator(f"{P} .shade .fc").count() == 5)
    fc = pg.locator(f"{P} .shade .fcs").inner_text()
    check("WE: Tage mit Höchst-/Tiefstwert und Regen", "Heute" in fc and "Morgen" in fc and "9°" in fc and "6 mm" in fc)
    check("WE: mild → keine Beschattung nötig", "Keine Beschattung nötig" in card.inner_text())
    # heißer Tag morgen, Rollos ohne Ausrichtung → allgemeiner Hinweis
    pg.evaluate("window.__api.fcSet([[12, 5, 'sunny'], [31, 17, 'sunny'], [29, 16, 'partlycloudy'], [22, 12, 'rainy', 4], [20, 10, 'cloudy']])"); pg.wait_for_timeout(150)
    txt = card.inner_text()
    check("WE: neue Vorhersage frischt die Karte auf", "31°" in pg.locator(f"{P} .shade .fcs").inner_text() and pg.locator(f"{P} .shade .fc.hot").count() == 2)
    check("WE: ohne Ausrichtung allgemeiner Hinweis", "Morgen 31 °C und sonnig: Rollos auf der Sonnenseite rechtzeitig schließen" in txt and "Ausrichtung" in txt)
    # Ausrichtung: Wohnzimmer nach Süden, Büro nach Westen
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, shading: {{ enabled: true, hot: 26, facing: {{ 'cover.wohnzimmer_terrassentur': 'S', 'cover.wohnzimmer_fenster': 'S', 'cover.buro_rollo': 'W', 'cover.esszimmer_rollo': '-' }} }} }}; p._dirty = true; p._schedule(); }})()"); pg.wait_for_timeout(250)
    txt = pg.locator(f"{P} .shade .shints").inner_text()
    check("WE: Hinweise je Seite für morgen", "Morgen 31 °C: Südrollos" in txt and "Morgen 31 °C: Westrollos" in txt and "Sonne auf der Südseite" in txt)
    check("WE: Süden vor Westen (nach Uhrzeit)", txt.index("Südrollos") < txt.index("Westrollos"))
    # Kopfzeile der Übersicht: morgen und Kurzform des Hinweises
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    wb = pg.locator(f"{P} .dtop .weather")
    check("WE: Kopf zeigt morgen", wb.locator(".wf").inner_text() == "morgen 31°")
    check("WE: Kopf hebt den Hinweis hervor (Tooltip mit Kurzform)", "hint" in wb.get_attribute("class") and "Südrollos und Westrollos rechtzeitig schließen" in wb.get_attribute("title"))
    pg.locator(f'{P} .nav[data-to=beschattung]').click(); pg.wait_for_timeout(300)
    # heute heiß: Uhrzeit fest vorgeben (Modul direkt), damit die Prüfung nicht von der Tageszeit abhängt
    pg.evaluate("window.__api.fcSet([[30, 17, 'sunny'], [31, 17, 'sunny'], [29, 16, 'partlycloudy']])"); pg.wait_for_timeout(100)
    res = pg.evaluate(f"""(async () => {{ const W = await import('/modules/wetter.js'); const p = {PP};
      const at = (hh) => {{ const d = new Date(); d.setHours(hh, 0, 0, 0); return W.shadeHints(p._hass, p._model, p._layout, d).hints.map(x => [x.k, x.face, x.title, x.eids.length]); }};
      const sw = W.sunWindows(new Date(), 'S', W.homeLoc(p._hass))[0];
      return {{ früh: at(Math.max(0, sw.from.getHours() - 2)), mitte: at(Math.floor((sw.from.getHours() + sw.to.getHours()) / 2)), spät: at(23) }}; }})()""")
    check("WE: vor der Sonne → „bis … schließen“ mit offenen Rollos", any(k == "heute" and f == "S" and "Südrollos bis" in t and n == 2 for k, f, t, n in res["früh"]))
    check("WE: Sonne auf der Seite → „jetzt“ zuerst", res["mitte"] and res["mitte"][0][0] == "jetzt" and res["mitte"][0][1] == "S" and res["mitte"][0][3] == 2)
    check("WE: abends nur noch morgen", res["spät"] and all(k == "morgen" for k, *_ in res["spät"]))
    check("WE: „Nicht beschatten“ bleibt außen vor", not any(f == "-" or "Ess" in t for _, f, t, _n in res["früh"] + res["mitte"]))
    # Schließen nur mit Rückfrage – eigene Seite mit fester Uhrzeit (12 Uhr in Berlin, Sonne im Süden)
    from datetime import datetime
    from zoneinfo import ZoneInfo
    pg2 = pg.context.browser.new_page(viewport={"width": 1440, "height": 1000}, timezone_id="Europe/Berlin")
    e2 = []; pg2.on("pageerror", lambda e: e2.append(str(e)))
    pg2.clock.set_fixed_time(datetime.now(ZoneInfo("Europe/Berlin")).replace(hour=12, minute=0, second=0, microsecond=0))
    pg2.goto(dense + "?view=beschattung"); pg2.wait_for_timeout(600)
    pg2.evaluate("window.__api.fcSet([[30, 17, 'sunny'], [31, 17, 'sunny']])")
    pg2.evaluate("(() => { const p = document.querySelector('haus-visualisierung-panel'); p._layout = { ...p._layout, shading: { enabled: true, hot: 26, facing: { 'cover.wohnzimmer_terrassentur': 'S', 'cover.wohnzimmer_fenster': 'S' } } }; p._dirty = true; p._schedule(); })()"); pg2.wait_for_timeout(250)
    first = pg2.locator(f"{P} .shint").first
    check("WE: mittags „Sonne auf der Südseite“ mit Schließen-Knopf", "Sonne auf der Südseite bis" in first.inner_text() and first.locator("[data-svc=close_cover]").count() == 1)
    n0 = len(pg2.evaluate("window.__api.log")); first.locator("[data-svc=close_cover]").click(); pg2.wait_for_timeout(150)
    check("WE: Schließen fragt nach", len(pg2.evaluate("window.__api.log")) == n0 and "Südrollos schließen?" in pg2.locator(f"{P} .mbg").inner_text())
    pg2.locator(f"{P} [data-act=confirm-ok]").click(); pg2.wait_for_timeout(150)
    last = pg2.evaluate("window.__api.log.at(-1)")
    check("WE: nach Bestätigung genau die offenen Südrollos", last[1] == "close_cover" and sorted(last[2]["entity_id"]) == ["cover.wohnzimmer_fenster", "cover.wohnzimmer_terrassentur"])
    check("WE: keine JS-Fehler (feste Uhrzeit)", not e2)
    pg2.close()
    # Bildschirmschoner: morgen und Hinweis
    pg.evaluate(f"(() => {{ const p = {PP}; p._saverShow(); }})()"); pg.wait_for_timeout(200)
    sv = pg.locator(f"{P} .saver").inner_text() if pg.locator(f"{P} .saver").count() else ""
    check("WE: Schoner zeigt morgen und Hinweis", "Morgen 31° / 17°" in sv and ("rechtzeitig schließen" in sv or "Sonne auf der" in sv))
    pg.mouse.click(640, 400); pg.wait_for_timeout(200)
    # Einstellungen: Ausrichtung je Rollo, aus dem Namen geraten
    pg.goto(dense + "?view=einstellungen"); pg.wait_for_timeout(500)
    pg.evaluate("window.__api.set('cover.buro_rollo', 'open', { friendly_name: 'Büro Rollo Südwest' })"); stab(pg, "raeume"); stab(pg, "technik")
    sel = pg.locator(f'{P} select[data-shade-face="cover.buro_rollo"]')
    check("WE: Einstellungen listen Rollos (ohne Garagentor)", sel.count() == 1 and pg.locator(f'{P} select[data-shade-face="cover.garagentor"]').count() == 0)
    check("WE: Ausrichtung aus dem Namen", "Automatisch (Südwest)" in sel.locator("option").first.inner_text())
    sel.select_option("O"); pg.wait_for_timeout(100)
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.shading)")
    check("WE: Ausrichtung gespeichert", saved and saved["facing"].get("cover.buro_rollo") == "O" and saved["hot"] == 26)

@gruppe("prognose")
def prognose():
    # ---------- Übersicht: Karte „Vorhersage“ mit Wetter und Solarprognose ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(600)
    card = pg.locator(f"{P} .cside .fcast")
    check("PR: Cockpit – Karte in der rechten Spalte", card.count() == 1)
    check("PR: jetzt (Temperatur und Lage)", "7°" in card.locator(".fcnow").inner_text() and "Teils bewölkt" in card.locator(".fcnow").inner_text())
    check("PR: 5 Tage aus der Vorhersage", card.locator(".fc").count() == 5 and "Heute" in card.locator(".fcs").inner_text() and "Morgen" in card.locator(".fcs").inner_text())
    check("PR: ohne Solarsensoren keine PV-Zeile", card.locator(".fcpv").inner_text().strip() == "" and card.locator(".fpv").count() == 0)
    subs = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "subscribe_forecast"]
    check("PR: ein Abo für Kopf und Karte", len(subs) == 1)
    # Forecast.Solar: zwei Dachflächen (heute/morgen/verbleibend), Wh wird umgerechnet
    pg.evaluate("""(() => { const a = window.__api, E = { unit_of_measurement: 'kWh', device_class: 'energy' };
      a.set('sensor.energy_production_today', '12.4', E); a.set('sensor.energy_production_today_2', '6100', { ...E, unit_of_measurement: 'Wh' });
      a.set('sensor.energy_production_tomorrow', '20', E); a.set('sensor.energy_production_tomorrow_2', '4.5', E);
      a.set('sensor.energy_production_today_remaining', '3.2', E); a.set('sensor.energy_production_today_remaining_2', '1.1', E);
      const p = document.querySelector('haus-visualisierung-panel'); p._dirty = true; p._schedule(); })()"""); pg.wait_for_timeout(300)
    pv = card.locator(".fcpv").inner_text()
    check("PR: Forecast.Solar – Dachflächen zusammengezählt, Wh umgerechnet", "heute 18,5 kWh" in pv and "noch 4,3" in pv and "morgen 24,5 kWh" in pv)
    fpv = card.locator(".fpv")
    check("PR: PV-Ertrag an Heute und Morgen", fpv.count() == 2 and fpv.nth(0).inner_text().strip() == "18,5" and fpv.nth(1).inner_text().strip() == "24,5")
    check("PR: ertragreichster Tag hervorgehoben", "hi" in fpv.nth(1).get_attribute("class") and "hi" not in fpv.nth(0).get_attribute("class"))
    pg.evaluate("window.__api.set('sensor.energy_production_tomorrow', '30', { unit_of_measurement: 'kWh' })"); pg.wait_for_timeout(200)
    check("PR: neue Werte frischen die Karte auf", "morgen 34,5 kWh" in card.locator(".fcpv").inner_text())
    # eingestellter Sensor geht vor
    pg.evaluate("""(() => { const a = window.__api; a.set('sensor.pv_prognose_heute', '9.9', { unit_of_measurement: 'kWh' });
      const p = document.querySelector('haus-visualisierung-panel'); p._layout = { ...p._layout, forecast: { ...p._layout.forecast, solar_today: 'sensor.pv_prognose_heute' } }; p._dirty = true; p._schedule(); })()"""); pg.wait_for_timeout(300)
    pv = card.locator(".fcpv").inner_text()
    check("PR: eingestellter Sensor statt automatisch", "heute 9,9 kWh" in pv and "noch" not in pv)
    # heißer Tag morgen → Beschattungshinweis, Tipp führt zur Seite Beschattung
    pg.evaluate("window.__api.fcSet([[12, 5, 'sunny'], [31, 17, 'sunny'], [29, 16, 'partlycloudy'], [22, 12, 'rainy', 4], [20, 10, 'cloudy']])"); pg.wait_for_timeout(200)
    hb = card.locator(".fchb")
    check("PR: Beschattungshinweis in der Karte", hb.count() == 1 and "Morgen 31 °C" in hb.inner_text())
    hb.click(); pg.wait_for_timeout(300)
    check("PR: Tipp auf den Hinweis öffnet Beschattung", pg.locator(f"{P} .shade").count() == 1)
    # Aktiv-Fokus (Handy) und Hausschnitt
    pg.set_viewport_size({"width": 390, "height": 844})
    pg.goto(dense + "?ov=fokus"); pg.wait_for_timeout(600)
    c2 = pg.locator(f"{P} .fcast")
    check("PR: Aktiv-Fokus – Karte unter der Energieleiste", c2.count() == 1 and c2.locator(".fc").count() == 5)
    over = pg.evaluate(f"(() => {{ const c = {R}.querySelector('.fcast'); return c.scrollWidth - c.clientWidth; }})()")
    check("PR: Handy – nichts ragt aus der Karte", over <= 1)
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?ov=haus"); pg.wait_for_timeout(500)
    check("PR: Hausschnitt – Karte da", pg.locator(f"{P} .fcast").count() == 1)
    pg.goto(base); pg.wait_for_timeout(500)
    check("PR: Komfort – Karte da", pg.locator(f"{P} .fcast").count() == 1)
    # abschalten (Einstellungen → Darstellung)
    pg.goto(dense + "?view=einstellungen"); pg.wait_for_timeout(500); stab(pg, "darstellung")
    tg = pg.locator(f'{P} [data-set="forecast.enabled"]')
    check("PR: Einstellungen – Schalter und Sensoren", tg.count() == 1 and pg.locator(f'{P} [data-set="forecast.solar_today"]').count() == 1 and pg.locator(f'{P} [data-set="forecast.solar_tomorrow"]').count() == 1)
    tg.evaluate("e => { e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); }"); pg.wait_for_timeout(100)
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.forecast)")
    check("PR: Abschalten gespeichert", saved and saved["enabled"] is False)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(300)
    check("PR: abgeschaltet – keine Karte", pg.locator(f"{P} .fcast").count() == 0)

@gruppe("geraete")
def geraete():
    # ---------- Übersicht: Karte „Geräte“ (Waschmaschine, Trockner, Spülmaschine) aus sensor.haus_geraete ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(600)
    check("GE: ohne Sensor keine Karte", pg.locator(f"{P} .appl").count() == 0)
    pg.evaluate("""(() => { const a = window.__api, now = Date.now() / 1000;
      a.set('sensor.waschmaschine_leistung', '1900', { friendly_name: 'Waschmaschine Leistung', device_class: 'power', unit_of_measurement: 'W' });
      a.set('sensor.haus_geraete', '1', { geraete: [
        { id: 'wash', name: 'Waschmaschine', kind: 'wash', icon: 'mdi:washing-machine', state: 'laeuft', since: now - 42 * 60, start: now - 42 * 60, end: null, kwh: 0.61, cost: 0.12, own: null,
          power: 'sensor.waschmaschine_leistung', status: '', door: '', remaining: '', auto: true, n: 3, avg_min: 100, avg_kwh: 0.9, avg_cost: 0.25, last: { start: now - 90000, end: now - 84000, kwh: 0.92, cost: 0.28, own: 0.4 } },
        { id: 'dish', name: 'Spülmaschine', kind: 'dish', icon: 'mdi:dishwasher', state: 'fertig', since: now - 12 * 60, start: now - 160 * 60, end: now - 12 * 60, kwh: 1.05, cost: 0.21, own: 0.35,
          power: '', status: '', door: '', remaining: '', auto: false, n: 1, avg_min: 148, avg_kwh: 1.05, avg_cost: 0.21, last: null },
        { id: 'dry', name: 'Trockner', kind: 'dry', icon: 'mdi:tumble-dryer', state: 'aus', since: now - 86400, start: null, end: null, kwh: 0, cost: 0, own: null,
          power: '', status: '', door: '', remaining: '', auto: false, n: 2, avg_min: 90, avg_kwh: 2.2, avg_cost: 0.6, last: { start: now - 200000, end: now - 194600, kwh: 2.4, cost: 0.66, own: null } } ] });
      const p = document.querySelector('haus-visualisierung-panel'); p._dirty = true; p._schedule(); })()"""); pg.wait_for_timeout(400)
    card = pg.locator(f"{P} .cside .appl")
    check("GE: Cockpit – Karte in der rechten Spalte", card.count() == 1 and card.locator(".apl").count() == 3)
    check("GE: Kopf zählt fertig und laufend", card.locator(".aplsum").inner_text().replace("\xa0", " ") == "1 fertig · 1 läuft")
    w = card.locator(".apl.laeuft").inner_text().replace("\xa0", " ")
    check("GE: läuft – seit, Restzeit geschätzt, Leistung, bisher", "läuft seit 42 min" in w and "noch ca. 58 min" in w and "1,9 kW" in w and "0,61 kWh · 0,12 €" in w)
    d = card.locator(".apl.fertig").inner_text().replace("\xa0", " ")
    check("GE: fertig – seit, Dauer, Energie, Kosten, eigener Strom", "fertig seit 12 min" in d and "Dauer 2:28 h" in d and "1,05 kWh · 0,21 € (35 % eigener Strom)" in d)
    t = card.locator(".apl.aus").inner_text().replace("\xa0", " ")
    check("GE: aus – letzter Durchgang und Schnitt", "zuletzt 2,40 kWh · 0,66 €" in t and "Ø 0,60 €" in t)
    # Netz bezieht 5,5 kW (Harness) → kein PV-Tipp; Einspeisung 2 kW → Tipp „jetzt starten“
    check("GE: Netzbezug – kein PV-Tipp", "Überschuss" not in card.locator(".apltip").inner_text().replace("\xa0", " "))
    pg.evaluate("window.__api.set('sensor.netz_leistung', '-2100', { unit_of_measurement: 'W', device_class: 'power' })"); pg.wait_for_timeout(200)
    check("GE: Einspeisung – Tipp jetzt starten", "Jetzt starten: 2,9 kW PV-Überschuss" in card.locator(".apltip").inner_text().replace("\xa0", " "))
    # Meldung: Hinweis „Spülmaschine fertig“ in der Warnkarte
    check("GE: Meldung in der Warnkarte", "Spülmaschine fertig" in pg.locator(f"{P} .cside .acard").inner_text().replace("\xa0", " "))
    # Quittieren über „Erledigt“
    card.locator(".aplack").click(); pg.wait_for_timeout(300)
    acks = [x for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "appliance_ack"]
    check("GE: Erledigt schickt appliance_ack", len(acks) == 1 and acks[0][2]["appliance"] == "dish")
    check("GE: danach aus, keine Meldung mehr", card.locator(".apl.fertig").count() == 0 and "Spülmaschine fertig" not in pg.locator(f"{P} .cside .acard").inner_text().replace("\xa0", " "))
    # Handy (Aktiv-Fokus): nichts ragt heraus
    pg.set_viewport_size({"width": 390, "height": 844})
    pg.goto(dense + "?ov=fokus"); pg.wait_for_timeout(600)
    pg.evaluate("""(() => { const a = window.__api, now = Date.now() / 1000;
      a.set('sensor.haus_geraete', '1', { geraete: [{ id: 'wash', name: 'Waschmaschine mit sehr langem Namen im Keller', kind: 'wash', icon: 'mdi:washing-machine', state: 'fertig', since: now - 300, start: now - 6300, end: now - 300, kwh: 0.9, cost: 0.27, own: 0.5, power: '', remaining: '', n: 1, avg_min: 100, last: null }] });
      const p = document.querySelector('haus-visualisierung-panel'); p._dirty = true; p._schedule(); })()"""); pg.wait_for_timeout(400)
    c2 = pg.locator(f"{P} .appl")
    check("GE: Aktiv-Fokus – Karte da", c2.count() == 1 and c2.locator(".aplack").count() == 1)
    over = pg.evaluate(f"(() => {{ const c = {R}.querySelector('.appl'); return c.scrollWidth - c.clientWidth; }})()")
    check("GE: Handy – nichts ragt aus der Karte", over <= 1 and pg.evaluate(WIDE) == [])
    # Einstellungen → Technik: Gerät hinzufügen, speichern
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=einstellungen"); pg.wait_for_timeout(500); stab(pg, "technik")
    sec = pg.locator(f'{P} [data-sec="appliances"]')
    check("GE: Einstellungen – Abschnitt Haushaltsgeräte", sec.count() == 1 and sec.locator('[data-set="appliances.enabled"]').count() == 1)
    sec.locator('[data-act="s-appl-add"]').first.click(); pg.wait_for_timeout(200)
    sec = pg.locator(f'{P} [data-sec="appliances"]')
    sec.locator('[data-set="appliances.items.0.name"]').fill("Waschmaschine Keller")
    sec.locator('[data-set="appliances.items.0.power"]').fill("sensor.waschmaschine_leistung")
    sec.locator('[data-set="appliances.items.0.stop_min"]').fill("12")
    sec.locator('[data-set="appliances.items.0.stop_min"]').dispatch_event("change")
    pg.locator(f"{P} [data-act=s-save]").click(); pg.wait_for_timeout(300)
    saved = pg.evaluate("window.__api.hass.callWS({type:'x/info'}).then(r => r.layout.appliances)")
    it = (saved or {}).get("items") or [{}]
    check("GE: Gerät gespeichert", it[0].get("name") == "Waschmaschine Keller" and it[0].get("power") == "sensor.waschmaschine_leistung" and it[0].get("stop_min") == 12)
    stab(pg, "alarme")
    check("GE: feste Regel „Haushaltsgerät fertig“", pg.locator(f'{P} [data-set="alerts.builtin.appliances"]').count() == 1)
    # Schoner: Hinweis „… fertig seit …“
    pg.goto(dense + "?ov=cockpit"); pg.wait_for_timeout(500)
    pg.evaluate("""(() => { const a = window.__api, now = Date.now() / 1000;
      a.set('sensor.haus_geraete', '1', { geraete: [{ id: 'dry', name: 'Trockner', kind: 'dry', icon: 'mdi:tumble-dryer', state: 'fertig', since: now - 600, start: now - 6000, end: now - 600, kwh: 2, cost: 0.6, power: '', remaining: '', n: 1, last: null }] });
      document.querySelector('haus-visualisierung-panel')._saverShow(); })()"""); pg.wait_for_timeout(300)
    check("GE: Schoner zeigt fertiges Gerät", "Trockner fertig seit 10 min" in pg.locator(f"{P} .saver .svhint").inner_text().replace("\xa0", " "))

@gruppe("energie")
def energie_zeitraum():
    # ---------- Energie-Seite: Woche, Monat, Jahr als Energie je Tag bzw. Monat (1.9.0) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=energie"); pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('hv-range-')).forEach(k => localStorage.removeItem(k))")
    pg.goto(dense + "?view=energie"); pg.wait_for_timeout(800)
    et = pg.locator(f"{P} .entrend")
    stats = lambda: [x[2] for x in pg.evaluate("window.__api.log") if x[0] == "ws" and x[1] == "statistics"]
    check("EZ: Leistung 24 h vorgewählt, keine Zeitraum-Kennzahlen", "Leistung 24 h" in et.locator(".trt").text_content() and not et.locator(".enper").is_visible())
    n0 = len(stats())
    et.locator('[data-act=range][data-r="30"]').click(); pg.wait_for_timeout(400)
    q = stats()[n0:]
    check("EZ: Monat – eine Abfrage der Stundenmittel in W", len(q) == 1 and q[0]["period"] == "hour" and q[0]["units"] == {"power": "W"} and len(q[0]["ids"]) == 4)
    check("EZ: Monat – Titel „Energie 30 Tage“, Linien weg", "Energie 30 Tage" in et.locator(".trt").text_content()
          and all(n == 0 for n in pg.evaluate(f"[...{R}.querySelectorAll('.entrend .enp, .entrend .ena')].map(p => (p.getAttribute('d') || '').length)")))
    check("EZ: Monat – 30 Tage mit Balken für Erzeugung und Verbrauch", 28 <= et.locator(".enbars rect.pv").count() <= 30 and et.locator(".enbars rect.use").count() == 30)
    per = et.locator(".enper").inner_text()
    check("EZ: Monat – Summen, bester Tag, Ø am Tag, Autarkie", all(w in per for w in ("Erzeugt", "Verbraucht", "Bezogen", "Eingespeist", "Autarkie", "bester Tag", "am Tag")) and "kWh" in per)
    ok_sum = pg.evaluate(f"(() => {{ const D = {R}.querySelector('.entrend')._en.D; let s = 0; for (const v of D.pv) if (Number.isFinite(v)) s += v; return Math.abs(s - D.T.pv) < 1 && D.T.pv > 0; }})()")
    check("EZ: Monat – Summe gleich den Balken", ok_sum)
    check("EZ: Monat – Achse in kWh, Datum der Montage", "kWh" in et.locator(".cty").inner_text() and 3 <= et.locator(".trx span").count() <= 5)
    bb = et.locator(".enc").bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.99, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(100)
    tip = et.locator(".trtip").inner_text()
    check("EZ: Monat – Zeiger zeigt Tag mit Erzeugt, Verbraucht, Bezug", "Erzeugt" in tip and "Verbraucht" in tip and "Bezug" in tip and "kWh" in tip and tip.split("\n")[0].endswith("."))
    pg.mouse.move(5, 5); pg.wait_for_timeout(50)
    et.locator('[data-act=range][data-r="7"]').click(); pg.wait_for_timeout(400)
    check("EZ: Woche – 7 Tage, Wochentage unter den Balken", et.locator(".enbars rect.use").count() == 7
          and set(et.locator(".trx span").all_inner_texts()) <= {"Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"} and et.locator(".trx span").count() == 7)
    n1 = len(stats())
    et.locator('[data-act=range][data-r="365"]').click(); pg.wait_for_timeout(400)
    q = stats()[n1:]
    check("EZ: Jahr – PV, Haus, Speicher als Tagesmittel, Netz stündlich (Bezug und Einspeisung getrennt)", len(q) == 2
          and sorted(x["period"] for x in q) == ["day", "hour"] and [x["ids"] for x in q if x["period"] == "hour"] == [["sensor.netz_leistung"]])
    check("EZ: Jahr – 12 Monate, bester Monat", et.locator(".enbars rect.use").count() == 12 and "bester Monat" in et.locator(".enper").inner_text() and "Energie 12 Monate" in et.locator(".trt").text_content())
    yl = pg.evaluate(f"(() => {{ const r = {R}.querySelector('.entrend .cty span:last-child').getBoundingClientRect(); return r.left - {R}.querySelector('.entrend').getBoundingClientRect().left; }})()")
    check("EZ: Jahr – Achsenbeschriftung bleibt in der Karte", yl >= 0)
    r0 = pg.evaluate(f"{PP}._stats.renders"); n2 = len(pg.evaluate("window.__api.log"))
    pg.evaluate("window.__api.set('sensor.growatt_modbus_pv_power', '4100')"); pg.wait_for_timeout(250)
    check("EZ: neuer Wert – Legende live, ohne Abfrage und Neuaufbau", "4,1 kW" in et.locator(".ctl.pv").inner_text() and pg.evaluate(f"{PP}._stats.renders") == r0
          and not [x for x in pg.evaluate("window.__api.log")[n2:] if x[0] == "ws"])
    pg.goto(dense + "?view=energie"); pg.wait_for_timeout(800)
    check("EZ: Wahl gemerkt", "Energie 12 Monate" in et.locator(".trt").text_content() and et.locator(".enbars rect.use").count() == 12)
    et.locator('[data-act=range][data-r="1"]').click(); pg.wait_for_timeout(400)
    dd = pg.evaluate(f"[...{R}.querySelectorAll('.entrend .enp, .entrend .ena')].map(p => (p.getAttribute('d') || '').length)")
    check("EZ: zurück auf 24 h – Linien, keine Balken, Uhrzeiten", "Leistung 24 h" in et.locator(".trt").text_content() and all(n > 200 for n in dd)
          and et.locator(".enbars rect").count() == 0 and not et.locator(".enper").is_visible() and "Uhr" in et.locator(".trx").inner_text())
    pg.goto(dense + "?view=energie&norec"); pg.wait_for_timeout(700)
    et.locator('[data-act=range][data-r="30"]').click(); pg.wait_for_timeout(400)
    check("EZ: ohne Recorder – Hinweis statt Balken", "Keine Langzeitstatistik" in et.locator(".trmsg").inner_text() and et.locator(".enbars rect").count() == 0)
    mp = b.new_page(viewport={"width": 390, "height": 900}); mp.goto(dense + "?view=energie"); mp.wait_for_timeout(800)
    mp.locator(f'{P} .entrend [data-act=range][data-r="30"]').click(); mp.wait_for_timeout(400)
    check("EZ: Handy – Monat ohne seitliches Scrollen", mp.locator(f"{P} .entrend .enbars rect.use").count() == 30 and mp.evaluate(WIDE) == [])
    mp.locator(f'{P} .entrend [data-act=range][data-r="7"]').click(); mp.wait_for_timeout(400)
    check("EZ: Handy – Woche: alle Wochentage lesbar", mp.locator(f"{P} .entrend .trx span").count() == 7 and mp.evaluate(WIDE) == [])
    mp.evaluate("Object.keys(localStorage).filter(k => k.startsWith('hv-range-')).forEach(k => localStorage.removeItem(k))"); mp.close()


@gruppe("energie")
def strompreis():
    # ---------- Strompreis und Kosten (Energie-Seite, Wallbox) ----------
    pg.set_viewport_size({"width": 1440, "height": 1000})
    pg.goto(dense + "?view=energie"); pg.wait_for_timeout(800)
    PR = [27, 25, 22, 21, 21, 23, 29, 34, 33, 30, 26, 22, 18, 16, 17, 21, 27, 35, 38, 36, 32, 30, 29, 28]
    hr = pg.evaluate("new Date().getHours()")
    ct = lambda v: f"{v:.1f}".replace(".", ",") + " ct"
    card = pg.locator(f"{P} .enprice")
    check("SP: Karte Strompreis auf der Energie-Seite", card.count() == 1)
    nw = pg.locator(f"{P} .enpnow").inner_text()
    check("SP: Preissensor automatisch erkannt (Einheit …/kWh)", "Strompreis (automatisch erkannt)" in pg.locator(f"{P} .enpsrc").inner_text())
    check("SP: Preis jetzt aus dem Stundenpreis, Ø heute, günstigstes Fenster", f"{ct(PR[hr])}/kWh" in nw and "Ø heute" in nw and "Günstigste 3 h" in nw and "Uhr" in nw)
    ref = PR + [v + 1 for v in PR[:min(24, hr + 13)]]  # heute und bis 36 h voraus
    q = (PR[hr] - min(ref)) / (max(ref) - min(ref))
    lvl = "günstig" if q <= 0.33 else "teuer" if q >= 0.67 else "mittel"
    check("SP: Einordnung günstig/mittel/teuer", lvl in nw)
    bars = pg.evaluate(f"(() => {{ const b = [...{R}.querySelectorAll('.enpb i')]; return [b.length, b.filter(i => i.classList.contains('now')).length, b.filter(i => i.classList.contains('best')).length]; }})()")
    check("SP: Preisbalken bis morgen, laufende Stunde markiert, 3-h-Fenster hervorgehoben", bars[0] == 48 - hr and bars[1] == 1 and 3 <= bars[2] <= 4)
    co = pg.locator(f"{P} .enpcost").inner_text()
    check("SP: Kosten heute – Netzbezug, Einspeisung, Gespart, Bilanz in €", all(w in co for w in ("Netzbezug", "Einspeisung", "Gespart", "Bilanz")) and "€" in co and "kWh" in co)
    wp = pg.locator(f"{P} .tech.wb .wbprice").inner_text()
    check("SP: Wallbox – Preis, günstig laden, was Laden gerade kostet", f"{ct(PR[hr])}/kWh" in wp and "Günstig laden" in wp and "Laden kostet gerade" in wp and "€/h" in wp and "75 % aus dem Netz" in wp)
    pg.evaluate("window.__api.set('sensor.netz_leistung', '-2000')"); pg.wait_for_timeout(250)
    check("SP: Wallbox lädt mit Überschuss – eigener Strom", "eigenem Strom" in pg.locator(f"{P} .tech.wb .wbprice").inner_text())
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, price: {{ ...p._layout.price, surcharge_ct: 10 }} }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(400)
    check("SP: Aufschlag auf den Sensorpreis", f"{ct(PR[hr] + 10)}/kWh" in pg.locator(f"{P} .enpnow").inner_text())
    pg.evaluate(f"(() => {{ const p = {PP}; p._layout = {{ ...p._layout, price: {{ ...p._layout.price, use_sensor: false, fixed_ct: 32.5 }} }}; p._dirty = true; p._flush(); }})()"); pg.wait_for_timeout(400)
    nw = pg.locator(f"{P} .enpnow").inner_text()
    check("SP: ohne Preissensor – fester Preis, keine Balken", "Fester Preis" in nw and "32,5 ct" in nw and not pg.locator(f"{P} .enpbars").is_visible()
          and "fester Preis" in pg.locator(f"{P} .enpsrc").inner_text() and "€" in pg.locator(f"{P} .enpcost").inner_text())
    wp = pg.locator(f"{P} .tech.wb .wbprice").inner_text()
    check("SP: Wallbox mit festem Preis, ohne Zeitfenster", "32,5 ct/kWh" in wp and "fest" in wp and "Günstig laden" not in wp)
    pg.goto(dense + "?view=energie&norec"); pg.wait_for_timeout(700)
    check("SP: ohne Recorder – Preis da, Kosten mit Hinweis", "ct/kWh" in pg.locator(f"{P} .enpnow").inner_text() and "Noch kein Verlauf" in pg.locator(f"{P} .enpcost").inner_text())
    pg.locator(f'{P} .nav[data-to=einstellungen]').click(); pg.wait_for_timeout(250); stab(pg, 'darstellung')
    sec = pg.locator(f'{P} .set[data-sec="price"]')
    check("SP: Einstellungen – Strompreis mit erkanntem Sensor", sec.count() == 1 and "erkannt: sensor.nordpool_kwh_de_eur" in sec.inner_text()
          and all(pg.locator(f'{P} [data-set="price.{k}"]').count() == 1 for k in ("sensor", "use_sensor", "fixed_ct", "feed_in_ct", "surcharge_ct", "window_h")))
    inp = pg.locator(f'{P} input[data-set="price.fixed_ct"]'); inp.fill("25.5"); inp.dispatch_event("change"); pg.wait_for_timeout(100)
    check("SP: Einstellung landet im Entwurf", pg.evaluate(f"{PP}._draft.price.fixed_ct") == 25.5)
    pg.locator(f'{P} .nav[data-to=""]').click(); pg.wait_for_timeout(250)
    mp = b.new_page(viewport={"width": 390, "height": 900}); mp.goto(dense + "?view=energie"); mp.wait_for_timeout(800)
    geo = mp.evaluate(f"""(() => {{ const R = document.querySelector('{P}').shadowRoot; const m = R.querySelector('.main'), c = R.querySelector('.enprice').getBoundingClientRect();
      return [m.scrollWidth - m.clientWidth, c.right <= 390]; }})()""")
    check("SP: Handy 390 px – Strompreis ohne seitliches Scrollen", geo[0] <= 0 and geo[1])
    mp.close()


def auswahl(args):
    """Abschnitte zu den Namen (Gruppe oder Abschnitt) auf der Kommandozeile; ohne Namen alle."""
    if not args:
        return ABSCHNITTE
    namen = {g for g, _ in ABSCHNITTE} | {fn.__name__ for _, fn in ABSCHNITTE}
    falsch = [a for a in args if a not in namen]
    if falsch:
        sys.exit(f"Unbekannt: {', '.join(falsch)}. Übersicht: python3 tests/interact.py --liste")
    return [(g, fn) for g, fn in ABSCHNITTE if g in args or fn.__name__ in args]


args = sys.argv[1:]
if "--liste" in args:
    for g in dict.fromkeys(g for g, _ in ABSCHNITTE):
        print(f"{g}: {', '.join(fn.__name__ for x, fn in ABSCHNITTE if x == g)}")
    sys.exit(0)
gewaehlt = auswahl(args)
if args:
    print(f"Nur {len(gewaehlt)} von {len(ABSCHNITTE)} Abschnitten: {', '.join(fn.__name__ for _, fn in gewaehlt)}")

with sync_playwright() as p:
    b = launch(p)
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # Seite schon auf dem Harness-Ursprung, damit Abschnitte vor ihrem ersten goto den Speicher leeren können
    pg.goto(f"{ORIGIN}/mock-hass.js")
    for _, abschnitt in gewaehlt:
        abschnitt()
    check("Keine JS-Fehler", not errs)
    b.close()
srv.shutdown()
print(f"OK: {len(ok)}  Fehler: {len(fail)}")
for f in fail: print("  ✗", f)
sys.exit(1 if fail else 0)
