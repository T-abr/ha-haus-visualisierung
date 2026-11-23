/* Haus Visualisierung – Wandpanel: Vollbild, Bildschirmschoner, Rückkehr zur Startseite.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { DEFAULT_LAYOUT, esc, icon, isOn, MODE_ICON, MODE_NAME, NF0, NF1, num, powerW, setHtml, setText } from "./grundlagen.js";
import { WEATHER_ICON } from "./aktualisierer.js";
import { curMode, evalAlerts, LEVEL_ICON, LEVELS } from "./warnungen.js";
import { finite } from "./verlauf.js";
import { dayOf, fcDays, shadeHeadline, shadeHints } from "./wetter.js";
import { applSaverHint } from "./geraete.js";

const WandpanelMixin = (Base) => class extends Base {
  /* ---------- Wandpanel: Vollbild, Bildschirmschoner, Rückkehr zur Startseite ---------- */
  /* Ob ein Gerät ein Wandpanel ist, gilt je Browser (localStorage, auch per Adresse ?wandpanel=1 bzw. =0).
     Zeiten und Inhalte gelten für alle Wandpanels (Einstellungen → Darstellung). Ein Takt von 5 s prüft
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
    d.innerHTML = `<div class="svbox"><div class="svclock"></div><div class="svdate"></div><div class="svrow"></div><div class="svhint"></div><div class="svstat"></div></div>`;
    this.shadowRoot.appendChild(d);
    this._saverMin = null;
    this._saverUpdate((Date.now() - (this._wallActive || Date.now())) / 60000, true);
  }

  _saverUpdate(idle, force = false) {
    const el = this.shadowRoot.querySelector(".saver");
    if (!el || !this._hass) return;
    const W = this._wallCfg(), h = this._hass, now = new Date();
    const black = W.black_min > 0 && idle >= W.saver_min + W.black_min;
    const night = W.night_dim && (curMode() === "nacht" || now.getHours() >= 23 || now.getHours() < 6);
    el.classList.toggle("black", black);
    el.classList.toggle("night", night && !black);
    const minute = Math.floor(now.getTime() / 60000);
    if (!force && this._saverMin === minute && !this._saverDirty) return;
    this._saverMin = minute; this._saverDirty = false;
    setText(el, ".svclock", now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setText(el, ".svdate", now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }));
    const wid = W.weather || Object.keys(h.states).find((e) => e.startsWith("weather."));
    const wst = wid && h.states[wid];
    const out = this._model && this._model.tech && this._model.tech.heat && this._model.tech.heat.outdoor;
    const outT = num(h.states[out || ""]) ?? (wst && finite(wst.attributes.temperature) ? wst.attributes.temperature : null);
    const pv = powerW(h.states[this._layout.header.pv || ""]);
    const md = curMode();
    const parts = [];
    if (wst) parts.push(`<span>${icon(WEATHER_ICON[wst.state] || "mdi:weather-cloudy")}${outT !== null ? `${NF1.format(outT)}°` : ""}</span>`);
    else if (outT !== null) parts.push(`<span>${icon("mdi:thermometer")}${NF1.format(outT)}°</span>`);
    if (pv !== null && pv > 50) parts.push(`<span>${icon("mdi:solar-power-variant")}${pv >= 1000 ? `${NF1.format(pv / 1000)} kW` : `${NF0.format(pv)} W`}</span>`);
    // Vorhersage morgen
    const tm = wid ? dayOf(fcDays(h, wid), 1) : null;
    if (tm && finite(tm.hi)) parts.push(`<span class="svfc">${icon(WEATHER_ICON[tm.cond] || "mdi:weather-partly-cloudy")}Morgen ${NF0.format(tm.hi)}°${finite(tm.lo) ? ` / ${NF0.format(tm.lo)}°` : ""}</span>`);
    parts.push(`<span>${icon(MODE_ICON[md])}${MODE_NAME[md]}</span>`);
    setHtml(el.querySelector(".svrow"), parts.join(""));
    const hl = this._model ? shadeHeadline(shadeHints(h, this._model, this._layout)) : "";
    const ap = applSaverHint(h, this._layout);
    setHtml(el.querySelector(".svhint"), [ap ? `<span class="svappl">${icon(ap.icon)}${esc(ap.text)}</span>` : "", hl ? `<span>${icon("mdi:window-shutter-alert")}${esc(hl)}</span>` : ""].filter(Boolean).join("<br>"));
    const al = this._model ? evalAlerts(h, this._model, this._layout) : [];
    const top = al.length ? al.reduce((a, b) => (LEVELS[b.level] > LEVELS[a.level] ? b : a)) : null;
    setHtml(el.querySelector(".svstat"), top ? `<span class="${top.level}">${icon(LEVEL_ICON[top.level])}${al.length === 1 ? esc(top.title) : `${al.length} Meldungen · ${esc(top.title)}`}</span>` : `<span class="ok">${icon("mdi:shield-check")}Alles in Ordnung</span>`);
    // Standard: mittig. Auf Wunsch gegen Einbrennen jede Minute ein Stück versetzen.
    const box = el.querySelector(".svbox");
    const k = minute % 9, dx = ((k % 3) - 1) * 6, dy = (Math.floor(k / 3) - 1) * 5;
    box.style.transform = W.wander ? `translate(${dx}vw,${dy}vh)` : "";
  }
};

export { WandpanelMixin };
