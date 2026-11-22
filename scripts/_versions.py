"""Gemeinsame Helfer: wo die Versionsnummer überall steht."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "custom_components" / "haus_visualisierung"
MANIFEST = COMP / "manifest.json"
CONST = COMP / "const.py"
JS = COMP / "frontend" / "modules" / "version.js"
CHANGELOG = ROOT / "CHANGELOG.md"

CONST_RE = re.compile(r'^VERSION = "([^"]+)"', re.M)
JS_RE = re.compile(r'^const VERSION = "([^"]+)";', re.M)  # in frontend/modules/version.js


def manifest_version() -> str:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]


def found_versions() -> dict[str, str | None]:
    c = CONST_RE.search(CONST.read_text(encoding="utf-8"))
    j = JS_RE.search(JS.read_text(encoding="utf-8"))
    return {
        "manifest.json": manifest_version(),
        "const.py": c.group(1) if c else None,
        "frontend/modules/version.js": j.group(1) if j else None,
    }


def write_version(v: str) -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    data["version"] = v
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    CONST.write_text(CONST_RE.sub(f'VERSION = "{v}"', CONST.read_text(encoding="utf-8")), encoding="utf-8")
    JS.write_text(JS_RE.sub(f'const VERSION = "{v}";', JS.read_text(encoding="utf-8")), encoding="utf-8")
