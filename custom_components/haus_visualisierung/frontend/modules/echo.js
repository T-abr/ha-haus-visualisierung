/* Haus Visualisierung – Echo-Modus: hält das Panel im Browser Silk eines Amazon Echo Show offen.
 * Der Echo kehrt sonst nach einer Weile zur Alexa-Startseite zurück. Gegenmittel, alle nur auf Geräten mit Echo-Modus:
 * - stumme Audio-Schleife (Silk bleibt im Vordergrund, solange „Musik“ läuft; startet erst nach einer Berührung),
 * - Neuladen, wenn die Verbindung zu Home Assistant über 2 Minuten fehlt oder die Seite hing, und einmal nachts.
 * Gegen Einbrennen sorgt der Bildschirmschoner (mit Fotos), daher keine eigene Pixelverschiebung.
 * Ob ein Gerät ein Echo ist, gilt je Browser (localStorage „hv-echo“, auch per Adresse ?echo=1 bzw. =0). */

const KEY = "hv-echo", RELOAD_KEY = "hv-echo-reload";
const OFFLINE_MS = 120e3;      // so lange ohne Verbindung, dann neu laden
const STALL_MS = 60e3;         // so lange kein Takt (Seite eingefroren), dann neu laden
const MIN_GAP_MS = 300e3;      // höchstens alle 5 Minuten neu laden (keine Schleife bei dauerhaft fehlendem Netz)
const NIGHT = [3 * 60 + 30, 3 * 60 + 40]; // nächtliches Neuladen 3:30–3:40 (einmal je Nacht)

/** Ist dieser Browser ein Echo? ?echo=1 schaltet ein (und den Wandpanel-Modus mit), ?echo=0 aus. */
function echoFlag() {
  try {
    const q = new URLSearchParams(location.search).get("echo");
    if (q !== null) {
      const v = q !== "0" && q !== "false";
      localStorage.setItem(KEY, v ? "1" : "0");
      if (v) localStorage.setItem("hv-wallpanel", "1");
      return v;
    }
    return localStorage.getItem(KEY) === "1";
  } catch (err) { return false; }
}

function echoStore(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (err) { /* egal */ }
}

/** Läuft der Browser auf einem Echo bzw. Fire-Gerät (Silk)? Nur für den Hinweis in den Einstellungen. */
const isSilk = () => /\bSilk\//.test(navigator.userAgent || "");

/** Fast stille WAV-Datei (1 s, 8 kHz, 8 Bit) mit leisem Rauschen von ±1 Stufe: echte Stille erkennt manches System als „keine Wiedergabe“. */
function silentWav() {
  const n = 8000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128 + (i % 2 ? 1 : -1) * (Math.random() < 0.5 ? 1 : 0));
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Liegt die Uhrzeit im Fenster fürs nächtliche Neuladen? */
const inNightReload = (d) => { const t = d.getHours() * 60 + d.getMinutes(); return t >= NIGHT[0] && t < NIGHT[1]; };

const EchoMixin = (Base) => class extends Base {
  _echoIsOn() {
    if (this._echoFlag === undefined) this._echoFlag = echoFlag();
    return this._echoFlag && this._wallIsOn();
  }

  _echoSet(on) {
    this._echoFlag = !!on; echoStore(on);
    if (on && !this._wallIsOn()) this._wallSet(true);
    if (on) this._echoStart(); else this._echoStop();
    this._dirty = true; this._flush();
  }

  /** Aus _wallStart: Audio vorbereiten und Takt der Überwachung zurücksetzen. Ohne Hinweis: der erste Tipp startet die Schleife. */
  _echoStart() {
    if (!this._echoIsOn()) return;
    this._echoBeat = Date.now();
    if (!this._echoAudio) {
      const a = new Audio();
      a.loop = true; a.preload = "auto"; a.src = silentWav();
      a.setAttribute("playsinline", "");
      this._echoAudio = a;
      this._onEchoTap = () => this._echoPlay();
      window.addEventListener("pointerdown", this._onEchoTap, true);
    }
    this._echoPlay();
  }

  _echoStop() {
    if (this._echoAudio) {
      this._echoAudio.pause();
      URL.revokeObjectURL(this._echoAudio.src);
      this._echoAudio = null;
      window.removeEventListener("pointerdown", this._onEchoTap, true);
    }
  }

  /** Wiedergabe starten; ohne vorherige Berührung lehnt der Browser ab, dann klappt es beim nächsten Tipp
   *  (auch nachdem Silk die Wiedergabe angehalten hat, etwa nach einem Alexa-Dialog). */
  _echoPlay() {
    const a = this._echoAudio;
    if (!a || !a.paused) return;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }

  /** Neu laden, aber höchstens alle 5 Minuten (Zeitpunkt im Browser gemerkt). */
  _echoReload(why) {
    let last = 0;
    try { last = Number(localStorage.getItem(RELOAD_KEY)) || 0; } catch (err) { /* egal */ }
    if (Date.now() - last < MIN_GAP_MS) return false;
    try { localStorage.setItem(RELOAD_KEY, String(Date.now())); } catch (err) { /* egal */ }
    console.info(`Haus Visualisierung: Echo-Modus lädt neu (${why})`);
    (this._echoReloadFn || (() => location.reload()))();
    return true;
  }

  /** Aus _wallTick (alle 5 s, nur bei sichtbarem Tab): Hänger, Verbindung, Nacht.
   *  Ein langer Abstand seit dem letzten Takt heißt: die Seite war eingefroren oder lag im Hintergrund. */
  _echoTick() {
    if (!this._echoIsOn()) return;
    const now = Date.now(), d = new Date(now);
    // Takt kam lange nicht: Seite war eingefroren (Silk im Hintergrund, Speicher knapp)
    const gap = now - (this._echoBeat || now);
    this._echoBeat = now;
    if (gap > STALL_MS && this._echoReload("Seite hing")) return;
    // Verbindung zu Home Assistant weg
    const off = this._hass && this._hass.connected === false;
    if (!off) this._echoOff = 0;
    else if (!this._echoOff) this._echoOff = now;
    else if (now - this._echoOff > OFFLINE_MS && this._echoReload("keine Verbindung")) return;
    // einmal je Nacht (nicht während Klingel oder ungespeicherter Einstellungen)
    if (inNightReload(d) && !this._bell && !(this._view === "einstellungen" && this._dirtySettings)) {
      let last = 0;
      try { last = Number(localStorage.getItem(RELOAD_KEY)) || 0; } catch (err) { /* egal */ }
      if (now - last > 3600e3 && this._echoReload("nachts")) return;
    }
    this._echoPlay();
  }
};

export { EchoMixin, inNightReload, isSilk, silentWav };
