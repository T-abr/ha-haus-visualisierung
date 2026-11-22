"""Frontend-Module: alle Importe vorhanden, und Home Assistant liefert sie unter dem Pfad mit Version aus."""
import re
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.haus_visualisierung.const import DOMAIN, FRONTEND_URL, MODULE_URL, VERSION

FRONTEND = Path(__file__).parents[2] / "custom_components" / "haus_visualisierung" / "frontend"
IMPORT_RE = re.compile(r'^\s*(?:import|export)\s[^;]*?\bfrom\s+"([^"]+)"|^\s*import\s+"([^"]+)"', re.M)


def _imports(f: Path) -> list[str]:
    return [a or b for a, b in IMPORT_RE.findall(f.read_text(encoding="utf-8"))]


def test_alle_relativen_importe_vorhanden() -> None:
    files = [FRONTEND / "haus-visualisierung.js", *sorted((FRONTEND / "modules").glob("*.js"))]
    seen = set()
    for f in files:
        for spec in _imports(f):
            assert spec.startswith("./"), f"{f.name}: nur relative Importe erlaubt, nicht {spec}"
            target = (f.parent / spec).resolve()
            assert target.is_file(), f"{f.name} importiert {spec}, die Datei fehlt"
            seen.add(target)
    # Jedes Modul wird von irgendwo geladen (keine verwaisten Dateien)
    orphans = [m.name for m in (FRONTEND / "modules").glob("*.js") if m.resolve() not in seen]
    assert not orphans, f"nicht importiert: {orphans}"


def test_modul_url_traegt_version() -> None:
    assert MODULE_URL == f"{FRONTEND_URL}/haus-visualisierung.js"
    assert f"/{VERSION}" in FRONTEND_URL


async def test_static_pfad_liefert_module(hass: HomeAssistant, hass_client) -> None:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    client = await hass_client()
    r = await client.get(MODULE_URL)
    assert r.status == 200
    assert 'from "./modules/panel.js"' in await r.text()
    r = await client.get(f"{FRONTEND_URL}/modules/version.js")
    assert r.status == 200
    assert f'const VERSION = "{VERSION}";' in await r.text()
