"""Frontend-Module: alle Importe vorhanden, und Home Assistant liefert sie unter dem Pfad mit Version aus."""
import re
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.haus_visualisierung.const import CARDS_URL, DOMAIN, FRONTEND_URL, MODULE_URL, VERSION

FRONTEND = Path(__file__).parents[2] / "custom_components" / "haus_visualisierung" / "frontend"
IMPORT_RE = re.compile(r'^\s*(?:import|export)\s[^;]*?\bfrom\s+"([^"]+)"|^\s*import\s+"([^"]+)"', re.M)
DYNAMIC_RE = re.compile(r'\bimport\("(\./[^"]+)"\)')  # bei Bedarf nachgeladene Module


def _imports(f: Path) -> list[str]:
    return [a or b for a, b in IMPORT_RE.findall(f.read_text(encoding="utf-8"))]


def test_alle_relativen_importe_vorhanden() -> None:
    files = [FRONTEND / "haus-visualisierung.js", FRONTEND / "karten-loader.js", *sorted((FRONTEND / "modules").glob("*.js"))]
    seen = set()
    for f in files:
        for spec in _imports(f):
            assert spec.startswith("./"), f"{f.name}: nur relative Importe erlaubt, nicht {spec}"
            target = (f.parent / spec).resolve()
            assert target.is_file(), f"{f.name} importiert {spec}, die Datei fehlt"
            seen.add(target)
        for spec in DYNAMIC_RE.findall(f.read_text(encoding="utf-8")):
            target = (f.parent / spec).resolve()
            assert target.is_file(), f"{f.name} lädt {spec} nach, die Datei fehlt"
            seen.add(target)
    # Jedes Modul wird von irgendwo geladen (keine verwaisten Dateien)
    orphans = [m.name for m in (FRONTEND / "modules").glob("*.js") if m.resolve() not in seen]
    assert not orphans, f"nicht importiert: {orphans}"


def test_modul_url_traegt_version() -> None:
    assert MODULE_URL == f"{FRONTEND_URL}/haus-visualisierung.js"
    assert CARDS_URL == f"{FRONTEND_URL}/karten-loader.js"
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


def test_karten_lader_bleibt_klein() -> None:
    """Der Lader läuft auf jeder Seite von Home Assistant: nur version.js statisch, die Karten per import()."""
    src = (FRONTEND / "karten-loader.js").read_text(encoding="utf-8")
    assert _imports(FRONTEND / "karten-loader.js") == ["./modules/version.js"]
    assert 'import("./modules/karten.js")' in src
    assert len(src.encode()) < 6000


async def test_jede_seite_laedt_nur_den_lader(hass: HomeAssistant, hass_client) -> None:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    extra = hass.data["frontend_extra_module_url"].urls
    assert CARDS_URL in extra
    assert MODULE_URL not in extra
    client = await hass_client()
    r = await client.get(CARDS_URL)
    assert r.status == 200
    assert "customElements.define(tag" in await r.text()


def test_veraltete_gz_werden_entfernt(tmp_path: Path) -> None:
    from custom_components.haus_visualisierung import _drop_stale_gz
    import os

    (tmp_path / "modules").mkdir()
    for name in ("a.js", "modules/b.js"):
        (tmp_path / name).write_text("neu")
        (tmp_path / f"{name}.gz").write_bytes(b"alt")
    os.utime(tmp_path / "a.js.gz", (1, 1))  # älter als a.js → weg
    os.utime(tmp_path / "modules/b.js", (1, 1))  # b.js älter als die .gz → bleibt
    (tmp_path / "c.js.gz").write_bytes(b"verwaist")  # ohne .js → weg
    _drop_stale_gz(tmp_path)
    assert sorted(p.name for p in tmp_path.rglob("*.gz")) == ["b.js.gz"]
