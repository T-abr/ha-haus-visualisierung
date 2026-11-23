"""PIN für heikle Aktionen: Tür öffnen, Alarm aus (zurück auf „Zuhause“), Abwesend/Urlaub einschalten.

Gedacht als Schutz vor Besuch und Kindern an Wandpanels und Wanddisplays, nicht als Ersatz für Benutzerrechte.
Die PIN liegt nur als salziger Hash im Backend (AlarmBook, wie der Code der Alarmanlage) und wird nie an Browser
geschickt. Nach mehreren Fehlversuchen sperrt die Prüfung kurz (je Verbindung bzw. Display).
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time

PIN_RE = re.compile(r"^\d{4,8}$")
KINDS = ("door", "disarm", "arm")
KIND_TXT = {"door": "Tür öffnen", "disarm": "Alarm aus", "arm": "Abwesend/Urlaub einschalten"}
SECURE_MODES = ("nacht", "abwesend", "urlaub")
MAX_TRIES = 5
LOCK_S = 60


def make_hash(pin: str) -> dict:
    salt = secrets.token_hex(8)
    return {"salt": salt, "hash": _digest(pin, salt)}


def _digest(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 20000).hex()


def verify(stored: dict | None, pin: str) -> bool:
    if not stored or not stored.get("hash") or not isinstance(pin, str):
        return False
    return hmac.compare_digest(_digest(pin, str(stored.get("salt", ""))), str(stored["hash"]))


def mode_kind(current: str, target: str) -> str | None:
    """Welche Schutzart ein Wechsel des Hausmodus braucht (None = keine)."""
    if target == current:
        return None
    if target == "zuhause" and current in SECURE_MODES:
        return "disarm"
    if target in ("abwesend", "urlaub"):
        return "arm"
    return None


def needs(cfg: dict, kind: str | None, wall: bool) -> bool:
    """Gilt der Schutz für diese Aktion auf diesem Gerät? Displays zählen immer als Wandgerät."""
    if not kind or not cfg.get(kind):
        return False
    return wall or cfg.get("scope") == "all"


class Throttle:
    """Fehlversuche je Quelle zählen; nach MAX_TRIES für LOCK_S Sekunden sperren."""

    def __init__(self) -> None:
        self._fails: dict[str, list[float]] = {}

    def locked_for(self, src: str) -> int:
        now = time.time()
        fails = [t for t in self._fails.get(src, []) if now - t < LOCK_S]
        self._fails[src] = fails
        return int(LOCK_S - (now - fails[-MAX_TRIES])) + 1 if len(fails) >= MAX_TRIES else 0

    def fail(self, src: str) -> None:
        self._fails.setdefault(src, []).append(time.time())

    def ok(self, src: str) -> None:
        self._fails.pop(src, None)
