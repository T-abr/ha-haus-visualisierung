/* Haus Visualisierung – Wandpanel: Vollbild, Bildschirmschoner, Rückkehr zur Startseite.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { DOMAIN } from "./version.js";
import { DEFAULT_LAYOUT, esc, icon, isOn, MODE_ICON, MODE_NAME, NF0, NF1, num, powerW, setHtml, setText } from "./grundlagen.js";
import { WEATHER_ICON } from "./aktualisierer.js";
import { curMode, evalAlerts, LEVEL_ICON, LEVELS } from "./warnungen.js";
import { finite } from "./verlauf.js";
import { dayOf, fcDays, shadeHeadline, shadeHints } from "./wetter.js";
import { saverTermHTML } from "./termine.js";
import { headerOf } from "./solar.js";
import { outdoorTemp } from "./klima.js";
import { applSaverHint } from "./geraete.js";

/** Liegt die Uhrzeit in der Nachtzeit „von–bis“ (HH:MM, auch über Mitternacht)? */
const hm = (v, d) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "")); return m ? +m[1] * 60 + +m[2] : d; };
function inNight(now, from, to) {
  const t = now.getHours() * 60 + now.getMinutes(), a = hm(from, 23 * 60), b = hm(to, 6 * 60);
  return a === b ? false : a < b ? t >= a && t < b : t >= a || t < b;
}

/** Innentemperatur für den Schoner: "avg" = Haus Ø (alle Innenräume), sonst Bereichs-ID. */
function indoorTemp(h, m, which) {
  if (!m) return null;
  if (which === "avg") {
    const vals = m.agg.temps.map((e) => num(h.states[e])).filter((v) => v !== null);
    return vals.length ? { name: "", t: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
  }
  const a = m.areas.get(which), t = a && a.tempId ? num(h.states[a.tempId]) : null;
  return t !== null ? { name: a.name, t } : null;
}

/** Foto füllt den Bildschirm, wenn es dieselbe Ausrichtung hat (Querformat auf quer stehendem Tablet), sonst Rahmen. */
const photoFills = (ph, w, h) => !(ph.w && ph.h) || (ph.w >= ph.h) === (w >= h);
/** Beschriftung eines Fotos: Titel · Monat Jahr. */
function photoCaption(ph) {
  const d = ph.date ? new Date(ph.date) : null;
  const when = d && !isNaN(d) ? d.toLocaleDateString("de-DE", { month: "short", year: "numeric" }) : "";
  return [ph.caption, when].filter(Boolean).join(" · ");
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const WandpanelMixin = (Base) => class extends Base {
  /* ---------- Wandpanel: Vollbild, Bildschirmschoner, Rückkehr zur Startseite ---------- */
  /* Ob ein Gerät ein Wandpanel ist, gilt je Browser (localStorage, auch per Adresse ?wandpanel=1 bzw. =0).
     Zeiten und Inhalte gelten für alle Wandpanels (Einstellungen → Wandpanel & Displays). Ein Takt von 5 s prüft
     die Ruhezeit – nur bei sichtbarem Tab und nur auf Wandpanels. */
  _wallIsOn() {
    if (this._wallFlag === undefined) {
      let v = null;
      try {
        const q = new URLSearchParams(location.search).get("wandpanel");
        if (q !== null) { v = q !== "0" && q !== "false"; localStorage.setItem("hv-wallpanel", v ? "1" : "0"); }
        else v = localStorage.getItem("hv-wallpanel") === "1";
      } catch (err) { v = false; }
      this._wallFlag = !!v;
    }
    return this._wallFlag;
  }

  _wallSet(on) {
    this._wallFlag = !!on;
    try { localStorage.setItem("hv-wallpanel", on ? "1" : "0"); } catch (err) { /* egal */ }
    if (on) this._wallStart(); else this._wallStop();
    this._dirty = true; this._flush();
  }

  _wallCfg() { return { ...DEFAULT_LAYOUT.wallpanel, ...(this._layout.wallpanel || {}) }; }

  _wallStart() {
    if (!this._wallIsOn() || !this._connected) return;
    const W = this._wallCfg();
    this._wallActive = this._wallActive || Date.now();
    if (!this._wallWired) {
      this._wallWired = true;
      this._onWallAct = (e) => {
        if (!this._wallIsOn()) return;
        this._wallActive = Date.now();
        this._wallReturned = false;
        if (e && e.type === "pointerdown") this._saverSwallow = false;
        if (this._saverOn) {
          // Tipp weckt nur auf: sein Klick wird verschluckt, der nächste Tipp wirkt wieder normal
          if (e && e.type === "pointerdown") { e.stopPropagation(); e.preventDefault(); this._saverSwallow = true; }
          this._saverHide();
        }
        if (e && e.type === "pointerdown" && this._wallCfg().fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      this._onWallClick = (e) => { if (this._saverSwallow) { this._saverSwallow = false; e.stopPropagation(); e.preventDefault(); } };
      window.addEventListener("pointerdown", this._onWallAct, true);
      window.addEventListener("click", this._onWallClick, true);
      window.addEventListener("keydown", this._onWallAct, true);
      window.addEventListener("wheel", this._onWallAct, { capture: true, passive: true });
    }
    if (W.hide_sidebar && !this._wallDocked) {
      this._wallDocked = true;
      try { if (!localStorage.getItem("hv-wall-prev-dock")) localStorage.setItem("hv-wall-prev-dock", localStorage.getItem("dockedSidebar") || '"docked"'); } catch (err) { /* egal */ }
      this.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: "always_hidden" }, bubbles: true, composed: true }));
    }
    clearInterval(this._wallT);
    this._wallT = setInterval(() => this._wallTick(), 5000);
  }

  _wallStop() {
    clearInterval(this._wallT); this._wallT = 0;
    this._saverHide();
    if (this._wallWired) {
      window.removeEventListener("pointerdown", this._onWallAct, true);
      window.removeEventListener("click", this._onWallClick, true);
      window.removeEventListener("keydown", this._onWallAct, true);
      window.removeEventListener("wheel", this._onWallAct, { capture: true });
      this._wallWired = false;
    }
    if (this._wallDocked && !this._wallIsOn()) {
      this._wallDocked = false;
      let prev = "docked";
      try { prev = JSON.parse(localStorage.getItem("hv-wall-prev-dock") || '"docked"'); localStorage.removeItem("hv-wall-prev-dock"); } catch (err) { /* egal */ }
      this.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: prev === "always_hidden" ? "docked" : prev }, bubbles: true, composed: true }));
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  _wallTick() {
    if (document.hidden || !this._wallIsOn() || !this._hass) return;
    const W = this._wallCfg(), now = Date.now();
    // Bewegungsmelder am Panel weckt wie eine Berührung
    const ws = W.wake_entity && this._hass.states[W.wake_entity];
    if (ws && isOn(ws) && Date.parse(ws.last_changed) > (this._wallWakeSeen || 0)) {
      this._wallWakeSeen = Date.parse(ws.last_changed);
      this._wallActive = now; this._wallReturned = false;
      if (this._saverOn) this._saverHide();
    }
    const idle = (now - (this._wallActive || now)) / 60000;
    if (W.return_min > 0 && idle >= W.return_min && !this._wallReturned) {
      this._wallReturned = true;
      const start = this._layout.start_view && this._layout.start_view !== "overview" ? this._layout.start_view : "";
      const here = this._view ? `${this._view}${this._arg ? `/${this._arg}` : ""}` : "";
      const dirtySettings = this._view === "einstellungen" && this._dirtySettings;
      if (here !== start && !dirtySettings && !this._bell) this._go(start);
    }
    if (W.saver_min > 0 && idle >= W.saver_min && !this._saverOn && !this._bell) this._saverShow();
    if (this._saverOn) this._saverUpdate(idle);
  }

  _saverShow() {
    this._saverOn = true;
    this._saverMount();
  }

  _saverHide() {
    if (!this._saverOn) return;
    this._saverOn = false;
    clearTimeout(this._fotoTimer); this._fotoTimer = null;
    const s = this.shadowRoot.querySelector(".saver");
    if (s) s.remove();
  }

  /** Nach jedem Neuaufbau wieder einhängen (das Gerüst ersetzt den ganzen Inhalt). */
  _saverMount() {
    if (!this._saverOn || this.shadowRoot.querySelector(".saver")) return;
    const d = document.createElement("div");
    d.className = "saver";
    d.setAttribute("role", "button");
    d.setAttribute("aria-label", "Bildschirmschoner – tippen zum Aufwecken");
    // .svside bündelt Hinweise, Termine und Status (mit Fotos: Vollbild rechts unten, Rahmen als Chip-Zeile)
    d.innerHTML = `<div class="svph"></div><div class="svbox"><div class="svclock"></div><div class="svdate"></div><div class="svrow"></div><div class="svside"><div class="svhint"></div><div class="svcal"></div><div class="svstat"></div></div><div class="svcap"></div></div>`;
    this.shadowRoot.appendChild(d);
    this._saverMin = null;
    this._fotoCur = null;
    this._saverUpdate((Date.now() - (this._wallActive || Date.now())) / 60000, true);
  }

  /* ---------- Fotos aus dem geteilten iCloud-Album (Backend: fotos.py) ---------- */

  /** Liste der Fotos holen (signierte Adressen 24 h gültig, daher stündlich neu) und gemischt merken.
   *  Leere Liste alle 2 min neu fragen: sonst sieht ein Wandpanel, das vor dem ersten Abruf geladen hat, eine Stunde lang nichts. */
  _fotoLoad() {
    if (this._fotoLoading || !this._hass || !this._hass.callWS) return;
    if (this._fotos && Date.now() - this._fotosAt < (this._fotos.length ? 3600e3 : 120e3)) return;
    this._fotoLoading = true;
    this._hass.callWS({ type: `${DOMAIN}/fotos` })
      .then((r) => { this._fotos = shuffle((r && r.photos) || []); this._fotoIdx = 0; })
      .catch(() => { this._fotos = []; })
      .finally(() => { this._fotosAt = Date.now(); this._fotoLoading = false; if (this._saverOn) { this._saverDirty = true; this._saverUpdate((Date.now() - (this._wallActive || Date.now())) / 60000); } });
  }

  /** Nächstes Foto vorladen und überblenden; Querformat als Vollbild mit langsamem Zoom, Hochformat im Rahmen. */
  _fotoNext() {
    clearTimeout(this._fotoTimer); this._fotoTimer = null;
    const el = this.shadowRoot.querySelector(".saver");
    const list = this._fotos || [];
    if (!el || !el.classList.contains("ph") || !list.length) return;
    const W = this._wallCfg(), sec = Math.max(5, Number(W.photo_sec) || 30);
    const ph = list[(this._fotoIdx = ((this._fotoIdx || 0) + (this._fotoCur ? 1 : 0)) % list.length)];
    this._fotoCur = ph;
    const img = new Image();
    const show = () => {
      if (!this._saverOn || !el.isConnected) return;
      const fill = photoFills(ph, innerWidth, innerHeight), url = `url("${String(ph.url).replace(/["\\]/g, encodeURIComponent)}")`;
      const s = document.createElement("div");
      s.className = `svslide ${fill ? "fill" : "frame"}`;
      // Hintergrund per DOM setzen: in einem style-Attribut per innerHTML beenden die Anführungszeichen von url("…") das Attribut
      const bg = document.createElement("i");
      bg.className = fill ? "kb" : "blur";
      bg.style.backgroundImage = url;
      s.appendChild(bg);
      if (fill) {
        // Ken-Burns: Richtung je Bild zufällig, Dauer = Anzeigedauer plus Überblendung
        const k = Math.floor(Math.random() * 4);
        bg.style.transformOrigin = `${[20, 80, 30, 70][k]}% ${[30, 70, 75, 25][k]}%`;
        bg.style.animationDuration = `${sec + 3}s`;
      } else {
        const im = document.createElement("img");
        im.alt = ""; im.src = ph.url;
        s.appendChild(im);
      }
      const box = el.querySelector(".svph");
      box.appendChild(s);
      requestAnimationFrame(() => s.classList.add("in"));
      // ältere Bilder nach der Überblendung entfernen
      setTimeout(() => { [...box.children].slice(0, -1).forEach((c) => c.remove()); }, 1800);
      el.dataset.ph = fill ? "fill" : "frame";
      setText(el, ".svcap", W.photo_caption ? photoCaption(ph) : "");
      this._fotoTimer = setTimeout(() => this._fotoNext(), sec * 1000);
    };
    img.onload = show;
    img.onerror = () => { this._fotoTimer = setTimeout(() => this._fotoNext(), 3000); };
    img.src = ph.url;
  }

  _saverUpdate(idle, force = false) {
    const el = this.shadowRoot.querySelector(".saver");
    if (!el || !this._hass) return;
    const W = this._wallCfg(), h = this._hass, now = new Date();
    const black = W.black_min > 0 && idle >= W.saver_min + W.black_min;
    const night = W.night_dim && (curMode() === "nacht" || inNight(now, W.night_from, W.night_to));
    el.classList.toggle("black", black);
    el.classList.toggle("night", night && !black);
    // Fotos: nur tagsüber und nicht im Schwarz-Modus
    if (W.photos) this._fotoLoad();
    const phOn = !!W.photos && !black && !night && !!(this._fotos && this._fotos.length);
    if (phOn !== el.classList.contains("ph")) {
      el.classList.toggle("ph", phOn);
      if (phOn) this._fotoNext();
      else { clearTimeout(this._fotoTimer); this._fotoTimer = null; el.querySelector(".svph").innerHTML = ""; setText(el, ".svcap", ""); delete el.dataset.ph; }
    }
    const minute = Math.floor(now.getTime() / 60000);
    if (!force && this._saverMin === minute && !this._saverDirty) return;
    this._saverMin = minute; this._saverDirty = false;
    // Elemente einzeln abschaltbar (Einstellungen → Wandpanel → Bildschirmschoner)
    el.dataset.clock = ["s", "m"].includes(W.clock_size) ? W.clock_size : "l";
    setText(el, ".svclock", now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setText(el, ".svdate", W.sv_date ? now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) : "");
    const wid = W.weather || Object.keys(h.states).find((e) => e.startsWith("weather."));
    const wst = wid && h.states[wid];
    // Außentemperatur aus derselben Quelle wie Kopfzeile und Klimaseite: Außenfühler, sonst Wetter-Entität
    const outT = outdoorTemp(h, this._model, this._layout, wid);
    const parts = [];
    if (W.sv_weather) {
      if (wst) parts.push(`<span>${icon(WEATHER_ICON[wst.state] || "mdi:weather-cloudy")}${outT !== null ? `${NF1.format(outT)}°` : ""}</span>`);
      else if (outT !== null) parts.push(`<span>${icon("mdi:thermometer")}${NF1.format(outT)}°</span>`);
    }
    const inT = W.sv_indoor ? indoorTemp(h, this._model, W.sv_indoor) : null;
    if (inT) parts.push(`<span class="svin">${icon("mdi:home-thermometer")}${inT.name ? `${esc(inT.name)} ` : ""}${NF1.format(inT.t)}°</span>`);
    const pv = W.sv_pv ? powerW(h.states[headerOf(h, this._layout).pv || ""]) : null;
    if (pv !== null && pv > 50) parts.push(`<span>${icon("mdi:solar-power-variant")}${pv >= 1000 ? `${NF1.format(pv / 1000)} kW` : `${NF0.format(pv)} W`}</span>`);
    // Vorhersage morgen
    const tm = W.sv_forecast && wid ? dayOf(fcDays(h, wid), 1) : null;
    if (tm && finite(tm.hi)) parts.push(`<span class="svfc">${icon(WEATHER_ICON[tm.cond] || "mdi:weather-partly-cloudy")}Morgen ${NF0.format(tm.hi)}°${finite(tm.lo) ? ` / ${NF0.format(tm.lo)}°` : ""}</span>`);
    const md = curMode();
    if (W.sv_mode) parts.push(`<span>${icon(MODE_ICON[md])}${MODE_NAME[md]}</span>`);
    setHtml(el.querySelector(".svrow"), parts.join(""));
    const hl = W.sv_shade && this._model ? shadeHeadline(shadeHints(h, this._model, this._layout)) : "";
    setHtml(el.querySelector(".svcal"), saverTermHTML(h, this._layout));
    const ap = W.sv_appl ? applSaverHint(h, this._layout) : null;
    setHtml(el.querySelector(".svhint"), [ap ? `<span class="svappl">${icon(ap.icon)}${esc(ap.text)}</span>` : "", hl ? `<span>${icon("mdi:window-shutter-alert")}${esc(hl)}</span>` : ""].filter(Boolean).join("<br>"));
    const al = W.sv_status && this._model ? evalAlerts(h, this._model, this._layout) : [];
    const top = al.length ? al.reduce((a, b) => (LEVELS[b.level] > LEVELS[a.level] ? b : a)) : null;
    setHtml(el.querySelector(".svstat"), !W.sv_status ? "" : top ? `<span class="${top.level}">${icon(LEVEL_ICON[top.level])}${al.length === 1 ? esc(top.title) : `${al.length} Meldungen · ${esc(top.title)}`}</span>` : `<span class="ok">${icon("mdi:shield-check")}Alles in Ordnung</span>`);
    // Standard: mittig. Auf Wunsch gegen Einbrennen jede Minute ein Stück versetzen.
    const box = el.querySelector(".svbox");
    const k = minute % 9, dx = ((k % 3) - 1) * 6, dy = (Math.floor(k / 3) - 1) * 5;
    box.style.transform = W.wander && !el.classList.contains("ph") ? `translate(${dx}vw,${dy}vh)` : "";
  }
};

export { inNight, WandpanelMixin };
