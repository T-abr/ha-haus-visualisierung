"""Screenshots der Kopfzeilen-Varianten (python3 tests/headers.py)."""

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

from harness_server import launch, start

srv, ORIGIN = start()
VARS = [("chips", "Heute: Chips mit Text"), ("kompakt", "A · Kompakt (Symbol + Zahl)"), ("satz", "B · Satz + Hinweise"), ("leiste", "C · Kennzahlen-Leiste")]
P = "haus-visualisierung-panel"
errs = []
shots = {}
with sync_playwright() as p:
    b = launch(p)
    for hs, _ in VARS:
        for w in (1440, 1100, 400):
            pg = b.new_page(viewport={"width": w, "height": 900}, device_scale_factor=1)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"{ORIGIN}/index.html?ov=cockpit&hs={hs}"); pg.wait_for_timeout(600)
            hgt = pg.evaluate(f"(() => {{ const R = document.querySelector('{P}').shadowRoot; const e = R.querySelector('.dtop, .hbar'); const r = e.getBoundingClientRect(); return Math.ceil(r.bottom + 10); }})()")
            f = f"/tmp/hdr-{hs}-{w}.png"; pg.screenshot(path=f, clip={"x": 0, "y": 0, "width": w, "height": hgt}); shots[(hs, w)] = (f, hgt - 24)
            pg.close()
    b.close()
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
for w in (1440, 1100):
    ims = [(t, Image.open(shots[(hs, w)][0]), shots[(hs, w)][1]) for hs, t in VARS]
    H = sum(i.height + 44 for _, i, _ in ims)
    out = Image.new("RGB", (w, H), (8, 10, 16)); d = ImageDraw.Draw(out); y = 0
    for t, i, hh in ims:
        d.text((14, y + 12), t, fill=(255, 196, 87), font=font); d.text((w - 260, y + 14), f"Höhe Kopfzeile: {hh} px", fill=(160, 170, 185), font=small)
        out.paste(i, (0, y + 40)); y += i.height + 44
    out.save(f"/home/claude/kopfzeile-varianten-{w}.png")
ims = [(t, Image.open(shots[(hs, 400)][0])) for hs, t in VARS]
W = sum(i.width + 16 for _, i in ims); H = max(i.height for _, i in ims) + 40
out = Image.new("RGB", (W, H), (8, 10, 16)); d = ImageDraw.Draw(out); x = 0
for t, i in ims:
    d.text((x + 8, 10), t.split(" (")[0], fill=(255, 196, 87), font=small); out.paste(i, (x, 36)); x += i.width + 16
out.save("/home/claude/kopfzeile-varianten-handy.png")
print("Fehler:", errs or "keine")
