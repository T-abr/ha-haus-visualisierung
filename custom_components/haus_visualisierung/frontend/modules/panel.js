/* Haus Visualisierung – Panel: Navigation, Lebenszyklus, Gerüst und Seitenwahl. Die übrigen Methoden kommen aus den panel-*.js-Teilen. */

import { DOMAIN, VERSION } from "./version.js";
import { esc, hideHaChrome, icon, installNavGuard, isDense, NAV, panelPathOf, setText, themeFrame, UPD, withDefaults } from "./grundlagen.js";
import { linkMode } from "./modell.js";
import { isRing } from "./aktualisierer.js";
import { trendHover } from "./verlauf.js";
import { heatHover } from "./technik.js";
import { climHover, sparkHover } from "./klima.js";
import { enHover } from "./energie.js";
import { fcListen, fcUnlisten } from "./wetter.js";
import { termListen, termUnlisten } from "./termine.js";
import { MAINT, maintDueCount, maintOn, maintPageHTML, setMaint } from "./wartung.js";
import { LOGO, STYLES } from "./stile.js";
import { HvBase } from "./basis.js";
import { KlingelMixin } from "./panel-klingel.js";
import { WandpanelMixin } from "./panel-wandpanel.js";
import { AlarmseiteMixin } from "./panel-alarmseite.js";
import { AnsichtenMixin } from "./panel-ansichten.js";
import { KompaktMixin } from "./panel-kompakt.js";
import { EinstellungenMixin } from "./panel-einstellungen.js";
import { AktionenMixin } from "./panel-aktionen.js";
import { GuteNachtMixin } from "./gutenacht.js";

/* Relative module_url fremder Panels wie bisher gegen den Einstiegspunkt auflösen, nicht gegen modules/. */
const ENTRY_URL = new URL("../haus-visualisierung.js", import.meta.url);

class HausVisualisierungPanel extends GuteNachtMixin(AktionenMixin(EinstellungenMixin(KompaktMixin(AnsichtenMixin(
  AlarmseiteMixin(WandpanelMixin(KlingelMixin(HvBase)))))))) {
  constructor() {
    super();
    this._view = null;
    this._arg = null;
    this._draft = null;
    this._serverVersion = null;
  }

  set panel(p) {
    this._panel = p;
    this._applyTheme();
  }
  set narrow(n) { this._narrowProp = n; this._updateNarrow(); }
  set route(r) {
    this._route = r;
    const path = (r && r.path) || "";
    const [, view, arg, ...rest] = path.split("/");
    const v = view || null;
    this._rest = rest.join("/");
    if (this._extEl && v === "extern" && arg === this._arg) this._extEl.route = this._extRoute();
    if (v !== this._view || (arg || null) !== this._arg) {
      this._view = v;
      this._arg = arg ? decodeURIComponent(arg) : null;
      this._dirty = true;
      this._schedule();
    }
  }

  set hass(h) {
    const old = this._hass;
    super.hass = h;
    if (!h) return;
    if (!this._sub && this._connected) this._subscribe();
    if (!old || h.themes !== old.themes) this._applyTheme();
    if (this._extEl && this._extEl.isConnected) this._extEl.hass = h;
    if (old && h.states !== old.states && this._layout.doorbell && this._layout.doorbell.enabled) {
      const bell = this._bellEntity();
      if (bell && h.states[bell] !== old.states[bell] && isRing(old.states[bell], h.states[bell])) this._showBell();
    }
    if (this._bell && this._bell.live) this._bell.live.hass = h;
  }
  get hass() { return this._hass; }

  connectedCallback() {
    super.connectedCallback();
    if (this._hass && !this._sub) this._subscribe();
    this._clockT = setInterval(() => { if (!document.hidden) this._tickClock(); }, 15000);
    this._alertT = setInterval(() => {
      if (document.hidden || !this._model) return;
      this.shadowRoot.querySelectorAll('[data-u="alerts"], [data-k="alerts"], [data-u="alarmpage"], [data-u="navbadge"], [data-u="shade"], [data-u="fcast"], [data-u="termin"], [data-u="appl"]').forEach((el) => UPD[el.dataset.u].run(el, this));
    }, 30000);
    // Wettervorhersage: neue Daten frischen Kopfzeile, Karten „Sonne & Wetter“ und „Vorhersage“ sowie Bildschirmschoner auf
    this._onForecast = this._onForecast || (() => {
      if (!this._model) return;
      this.shadowRoot.querySelectorAll('[data-u="weather"], [data-u="shade"], [data-u="fcast"]').forEach((el) => UPD[el.dataset.u].run(el, this));
      this._saverDirty = true;
    });
    fcListen(this._onForecast);
    // Termine aus den Kalendern: Kopfzeile und Bildschirmschoner auffrischen, sobald sie da sind
    this._onTermine = this._onTermine || (() => {
      if (!this._model) return;
      this.shadowRoot.querySelectorAll('[data-u="termin"]').forEach((el) => UPD.termin.run(el, this));
      this._saverDirty = true;
    });
    termListen(this._onTermine);
    if (!this._alWired) {
      this._alWired = true;
      const r = this.shadowRoot;
      r.addEventListener("pointerdown", (e) => this._alSwipeStart(e));
      r.addEventListener("pointermove", (e) => this._alSwipeMove(e));
      r.addEventListener("pointerup", () => this._alSwipeEnd());
      r.addEventListener("pointercancel", () => this._alSwipeEnd());
      r.addEventListener("click", (e) => { if (this._alSwiped && Date.now() - this._alSwiped < 400 && e.target.closest(".alrow")) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
      // Verlauf: Wert unter Maus oder Finger anzeigen
      const trMove = (e) => {
        const frac = (n) => { const b = n.getBoundingClientRect(); return b.width ? Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) : null; };
        const ct = e.target.closest && e.target.closest(".ctc");
        if (ct) { clearTimeout(this._trHideT); this._ctHover = ct.closest(".ctrend"); climHover(this._ctHover, frac(ct)); }
        else if (this._ctHover) { climHover(this._ctHover, null); this._ctHover = null; }
        const enc = e.target.closest && e.target.closest(".enc");
        if (enc) { clearTimeout(this._trHideT); this._enHover = enc.closest(".entrend"); enHover(this._enHover, frac(enc)); }
        else if (this._enHover) { enHover(this._enHover, null); this._enHover = null; }
        const spk = e.target.closest && e.target.closest(".kspark");
        if (spk && spk !== this._spHover && this._spHover) sparkHover(this._spHover, null);
        if (spk) { clearTimeout(this._trHideT); this._spHover = spk; sparkHover(spk, frac(spk.querySelector(".spw") || spk)); }
        else if (this._spHover) { sparkHover(this._spHover, null); this._spHover = null; }
        const hc = e.target.closest && e.target.closest(".hcc");
        if (hc) { const b = hc.getBoundingClientRect(); this._hcHover = hc; heatHover(hc, Math.min(1, Math.max(0, (e.clientX - b.left) / b.width))); }
        else if (this._hcHover) { heatHover(this._hcHover, null); this._hcHover = null; }
        const c = e.target.closest && e.target.closest(".trc");
        if (!c) { if (this._trHover) { trendHover(this._trHover, null); this._trHover = null; } return; }
        const el = c.closest(".trend"), b = c.getBoundingClientRect();
        if (!el || !b.width) return;
        clearTimeout(this._trHideT);
        this._trHover = el;
        trendHover(el, Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)));
      };
      r.addEventListener("pointermove", trMove);
      r.addEventListener("pointerdown", trMove);
      r.addEventListener("pointerout", (e) => {
        if (e.pointerType === "touch") return;
        const to0 = e.relatedTarget;
        if (this._ctHover && !(to0 && to0.closest && to0.closest(".ctc"))) { climHover(this._ctHover, null); this._ctHover = null; }
        if (this._spHover && !(to0 && to0.closest && to0.closest(".kspark"))) { sparkHover(this._spHover, null); this._spHover = null; }
        if (this._enHover && !(to0 && to0.closest && to0.closest(".enc"))) { enHover(this._enHover, null); this._enHover = null; }
        if (!this._trHover) return;
        const to = e.relatedTarget;
        if (!to || !to.closest || !to.closest(".trc")) { trendHover(this._trHover, null); this._trHover = null; }
      });
      r.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "touch" || !(this._trHover || this._ctHover || this._spHover || this._enHover)) return;
        clearTimeout(this._trHideT);
        // am Handy bleibt der Wert kurz stehen
        this._trHideT = setTimeout(() => {
          if (this._trHover) { trendHover(this._trHover, null); this._trHover = null; }
          if (this._ctHover) { climHover(this._ctHover, null); this._ctHover = null; }
          if (this._spHover) { sparkHover(this._spHover, null); this._spHover = null; }
          if (this._enHover) { enHover(this._enHover, null); this._enHover = null; }
        }, 2500);
      });
      // Einstellungen: Sortieren per Ziehen
      r.addEventListener("pointerdown", (e) => this._sortStart(e));
      r.addEventListener("keydown", (e) => this._sortKey(e));
    }
    this._wallStart();
    this._ro = new ResizeObserver(() => this._updateNarrow());
    this._onWinResize = () => this._updateNarrow();
    window.addEventListener("resize", this._onWinResize);
    this._ro.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockT);
    clearInterval(this._alertT);
    fcUnlisten(this._onForecast);
    termUnlisten(this._onTermine);
    clearInterval(this._wallT); this._wallT = 0;
    if (this._wallWired) {
      window.removeEventListener("pointerdown", this._onWallAct, true);
      window.removeEventListener("click", this._onWallClick, true);
      window.removeEventListener("keydown", this._onWallAct, true);
      window.removeEventListener("wheel", this._onWallAct, { capture: true });
      this._wallWired = false;
    }
    this._closeBell();
    if (this._ro) this._ro.disconnect();
    window.removeEventListener("resize", this._onWinResize);
    if (this._sub) { this._sub.then((un) => un && un()).catch(() => {}); this._sub = null; }
    if (this._alSub) { this._alSub.then((un) => un && un()).catch(() => {}); this._alSub = null; }
    if (window.__hvEmbed && window.__hvEmbed.owner === this) window.__hvEmbed = null;
  }

  _updateNarrow() {
    const n = this._narrowProp || this.clientWidth < 760;
    // Seitenfüllend: Höhe = sichtbarer Bereich ab Oberkante des Panels
    const top = `${Math.max(0, Math.round(this.getBoundingClientRect().top + window.scrollY))}px`;
    if (this._top !== top) { this._top = top; this.style.setProperty("--hv-top", top); }
    // Feste Navigationsleiste: an Lage und Breite des Panels ausrichten (z. B. neben der HA-Seitenleiste)
    if (n) {
      const r = this.getBoundingClientRect();
      const left = `${Math.round(r.left)}px`, width = `${Math.round(r.width || window.innerWidth)}px`;
      if (this._railLeft !== left) { this._railLeft = left; this.style.setProperty("--hv-rail-left", left); }
      if (this._railWidth !== width) { this._railWidth = width; this.style.setProperty("--hv-rail-width", width); }
    }
    if (n !== this._isNarrow) {
      this._isNarrow = n;
      const app = this.shadowRoot.querySelector(".app");
      if (app) app.classList.toggle("narrow", n);
      if (this._extEl) this._extEl.narrow = n;
      if (app && isDense(this._layout) && this._view !== "extern") { this._dirty = true; this._schedule(); }
    }
  }

  _subscribe() {
    if (!this._hass || !this._hass.connection) return;
    this._sub = this._hass.connection
      .subscribeMessage((msg) => {
        if (msg.version) this._serverVersion = msg.version;
        if (msg.maintenance) {
          // Wartungsplaner: neuer Erledigt-Stand (auch von anderen Geräten); gleicher Stand wie nach eigenem Tipp → nichts tun
          const same = JSON.stringify(msg.maintenance) === JSON.stringify(MAINT);
          setMaint(msg.maintenance);
          if (!same && !msg.layout && this._view !== "einstellungen") { this._dirty = true; this._schedule(); }
        }
        if (msg.layout) {
          this._layout = withDefaults(msg.layout);
          this._startCams();
          if (!this._dirtySettings) { this._draft = null; this._dirty = true; this._schedule(); }
        }
      }, { type: `${DOMAIN}/subscribe` })
      .catch((err) => {
        console.warn("Haus Visualisierung: Abo fehlgeschlagen", err);
        this._dirty = true;
        this._schedule();
      });
    this._alSub = this._hass.connection
      .subscribeMessage((snap) => this._onAlarms(snap), { type: `${DOMAIN}/alarms_subscribe` })
      .catch((err) => console.warn("Haus Visualisierung: Alarmmanager nicht erreichbar", err));
  }

  _applyTheme() {
    const name = this._panel && this._panel.config && this._panel.config.theme;
    const themes = this._hass && this._hass.themes;
    const key = `${name}|${themes && themes.darkMode}|${themes && themes.themes && name && !!themes.themes[name]}`;
    if (key === this._themeKey) return;
    this._themeKey = key;
    for (const p of this._themeProps || []) this.style.removeProperty(p);
    this._themeProps = [];
    if (!name || !themes || !themes.themes || !themes.themes[name]) return;
    let vars = { ...themes.themes[name] };
    if (vars.modes) {
      const m = themes.darkMode ? vars.modes.dark : vars.modes.light;
      vars = { ...vars, ...(m || {}) };
      delete vars.modes;
    }
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v !== "string" && typeof v !== "number") continue;
      this.style.setProperty(`--${k}`, String(v));
      this._themeProps.push(`--${k}`);
    }
    const bg = vars["lovelace-background"];
    if (bg) { this.style.setProperty("--hv-bg", String(bg)); this._themeProps.push("--hv-bg"); }
  }

  get _base() { return `/${(this._panel && this._panel.url_path) || "haus-visualisierung"}`; }

  _tickClock() {
    const r = this.shadowRoot;
    const now = new Date();
    const c = r.querySelector(".clock");
    if (!c) return;
    setText(c, null, now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setText(r, ".date", now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }));
    const hr = now.getHours();
    setText(r, ".greet", hr < 5 ? "Gute Nacht" : hr < 11 ? "Guten Morgen" : hr < 17 ? "Guten Tag" : hr < 22 ? "Guten Abend" : "Gute Nacht");
  }

  /* ---------- Gerüst ---------- */
  _render() {
    const h = this._hass;
    if (this._isNarrow === undefined) this._isNarrow = !!this._narrowProp || (this.clientWidth || window.innerWidth) < 760;
    const L = this._layout;
    let view = this._view || L.start_view || "overview";
    const isAdmin = !!(h.user && h.user.is_admin);
    if (view === "einstellungen" && !isAdmin) view = "overview";
    const active = view === "raum" ? "overview" : view;

    // Energie nur, wenn es Energiedaten gibt; Wartung nur mit Aufgaben (Zahl = fällige)
    const navList = NAV.filter(([k]) => (k !== "energie" || (this._model && this._model.energy)) && (k !== "wartung" || maintOn(L)));
    const nDue = maintOn(L) ? maintDueCount(L) : 0;
    const badge = (k) => (k === "alarme" ? `<i class="nbadge" data-u="navbadge"></i>` : k === "wartung" && nDue ? `<i class="nbadge on wbadge">${nDue}</i>` : "");
    const nav = navList.map(([k, t, i]) => `<button class="nav${active === k ? " active" : ""}" data-act="go" data-to="${k === "overview" ? "" : k}" title="${t}">${icon(i)}${badge(k)}<span>${t}</span></button>`).join("");
    const links = (L.links || []).filter((l) => l.path).map((l) => `<button class="nav${view === "extern" && panelPathOf(l.path) === this._arg ? " active" : ""}" data-act="link" data-path="${esc(l.path)}" title="${esc(l.title)}">${icon(l.icon || "mdi:link")}<span>${esc(l.title)}</span></button>`).join("");

    let body;
    try {
      body = this._renderView(view);
    } catch (err) {
      console.error("Haus Visualisierung:", err);
      body = `<div class="empty">${icon("mdi:alert")}Fehler beim Aufbau: ${esc(err.message)}</div>`;
    }

    const old = this.shadowRoot.querySelector(".main");
    const keepScroll = old && this._lastView === `${view}/${this._arg}` ? old.scrollTop : 0;
    this._lastView = `${view}/${this._arg}`;

    const verNote = this._serverVersion && this._serverVersion !== VERSION
      ? `<div class="notice">Der Browser zeigt noch Version ${VERSION}, installiert ist ${esc(this._serverVersion)}. Bitte mit Strg + F5 neu laden bzw. in der App den Frontend-Cache leeren.</div>` : "";

    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="app${L.glass ? " blur" : ""}${this._isNarrow ? " narrow" : ""}${isDense(L) ? " dense" : ""}">
        <div class="bg"></div>
        <nav class="rail${navList.length + (L.links || []).filter((l) => l.path).length + (isAdmin ? 1 : 0) > 6 ? " many" : ""}">
          <div class="logo">${LOGO}<small>v${VERSION}</small></div>
          ${nav}
          ${links ? `<hr>${links}` : ""}
          <div class="grow"></div>
          ${this._wallIsOn() ? `<button class="nav wallbtn" data-act="saver" title="Bildschirmschoner">${icon("mdi:power-sleep")}<span>Ruhe</span></button>` : ""}
          ${isAdmin ? `<button class="nav${active === "einstellungen" ? " active" : ""}" data-act="go" data-to="einstellungen" title="Einstellungen">${icon("mdi:cog")}<span>Einstellungen</span></button>` : ""}
        </nav>
        <main class="main${view === "extern" ? " ext" : ""}"><div class="wrap">${view === "extern" ? "" : verNote}${body}</div></main>
      </div>`;
    const main = this.shadowRoot.querySelector(".main");
    if (keepScroll) main.scrollTop = keepScroll;
    this._saverMount();
    this._wire(this.shadowRoot);
    this._tickClock();
    this._updateNarrow();
    if (view === "extern") this._mountExt(this._arg);
    else { this._extEl = null; if (window.__hvEmbed && window.__hvEmbed.owner === this) window.__hvEmbed = null; }
  }

  /* ---------- Eingebettete Panels (Solar, Protect …) ---------- */
  /* custom = eigenes Panel (Solar, Protect …), builtin = Dashboard/HA-Seite, frame = nur als Rahmen */
  _embedKind(urlPath) {
    const p = this._hass && this._hass.panels && this._hass.panels[urlPath];
    if (!p || urlPath === panelPathOf(this._base)) return null;
    const pc = p.config && p.config._panel_custom;
    if (p.component_name === "custom") {
      if (pc && pc.name && !pc.embed_iframe && (pc.module_url || pc.js_url)) return "custom";
      return pc && pc.embed_iframe ? "frame" : null;
    }
    if (p.component_name === "iframe") return "frame";
    return "builtin";
  }
  _embeddable(urlPath) { return !!this._embedKind(urlPath); }

  _openLink(path) {
    if (!path) return;
    const up = panelPathOf(path);
    const link = (this._layout.links || []).find((l) => panelPathOf(l.path) === up);
    const mode = link ? linkMode(link) : "theme";
    // Unterseite (z. B. /solar-visualisierung/technik) wird ans eingebettete Panel weitergereicht
    const sub = String(path).replace(/^\/+/, "").split(/[?#]/)[0].split("/").slice(1).filter(Boolean).join("/");
    if (up !== panelPathOf(this._base) && this._embeddable(up) && mode !== "open") this._go(`extern/${encodeURIComponent(up)}${sub ? `/${sub}` : ""}`);
    else this._navigate(path);
  }

  _extRoute() {
    return { prefix: `${this._base}/extern/${this._arg}`, path: this._rest ? `/${this._rest}` : "" };
  }

  async _mountExt(up) {
    const host = this.shadowRoot.querySelector(".extwrap");
    if (!host) return;
    const panel = this._hass.panels && this._hass.panels[up];
    if (!this._embeddable(up)) {
      host.innerHTML = `<div class="glass empty" style="margin:20px">${icon("mdi:puzzle-remove-outline")}Das Panel „${esc(up)}“ lässt sich nicht einbetten${panel ? "" : " (nicht gefunden oder keine Berechtigung)"}.<br><br>
        <button class="pbtn" data-act="nav-raw" data-path="/${esc(up)}">${icon("mdi:open-in-new")}Im eigenen Panel öffnen</button></div>`;
      return;
    }
    this._extCache = this._extCache || new Map();
    const kind = this._embedKind(up);
    const link = (this._layout.links || []).find((l) => panelPathOf(l.path) === up);
    const themed = linkMode(link) !== "embed";
    host.classList.toggle("themed", themed);
    let el = this._extCache.get(up);
    if (!el && kind !== "custom") {
      const tag = `ha-panel-${panel.component_name}`;
      if (kind === "builtin" && customElements.get(tag)) {
        el = document.createElement(tag);              // Dashboard direkt, wie Home Assistant selbst
        this._extCache.set(up, el);
      } else {
        // Seite noch nicht geladen bzw. iFrame-Panel: als Rahmen ohne HA-Seitenleiste
        const fr = document.createElement("iframe");
        fr.className = "extframe";
        fr.title = panel.title || up;
        fr.src = panel.component_name === "iframe" && panel.config && panel.config.url ? panel.config.url : `/${up}${this._rest ? `/${this._rest}` : ""}`;
        const glass = !!this._layout.glass;
        fr.addEventListener("load", () => { if (themed) themeFrame(fr, glass); hideHaChrome(fr); });
        if (this._view !== "extern" || this._arg !== up || !host.isConnected) return;
        installNavGuard();
        window.__hvEmbed = { owner: this, up, base: this._base, active: () => this.isConnected && this._view === "extern" && this._arg === up };
        this._extEl = null;
        host.replaceChildren(fr);
        return;
      }
    }
    if (!el) {
      const pc = panel.config._panel_custom;
      try {
        if (!customElements.get(pc.name)) {
          if (pc.module_url) await import(/^\.\.?\//.test(pc.module_url) ? new URL(pc.module_url, ENTRY_URL).href : pc.module_url);
          else await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = pc.js_url; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
          await Promise.race([customElements.whenDefined(pc.name), new Promise((_, rej) => setTimeout(() => rej(new Error("Zeitüberschreitung")), 15000))]);
        }
      } catch (err) {
        host.innerHTML = `<div class="glass empty" style="margin:20px">${icon("mdi:alert")}Panel „${esc(panel.title || up)}“ konnte nicht geladen werden: ${esc(err.message || err)}</div>`;
        return;
      }
      el = document.createElement(pc.name);
      this._extCache.set(up, el);
    }
    if (this._view !== "extern" || this._arg !== up || !host.isConnected) return;
    el.panel = panel;
    el.narrow = !!this._isNarrow;
    el.route = this._extRoute();
    el.hass = this._hass;
    installNavGuard();
    window.__hvEmbed = { owner: this, up, base: this._base, active: () => this.isConnected && this._view === "extern" && this._arg === up };
    this._extEl = el;
    if (el.parentNode !== host) host.replaceChildren(el);
    // Hat das Panel beim Einhängen selbst die Adresse geändert, aktuelle Route nachreichen
    const r = this._extRoute();
    if (!el.route || el.route.path !== r.path) el.route = r;
  }

  _renderView(view) {
    const d = isDense(this._layout);
    switch (view) {
      case "raum": return d ? this._vRoomDense(this._arg) : this._vRoom(this._arg);
      case "licht": return d ? this._vLightsDense() : this._vLights();
      case "beschattung": return d ? this._vCoversDense() : this._vCovers();
      case "klima": return d ? this._vClimateDense() : this._vClimate();
      case "energie": return this._vEnergy();
      case "sicherheit": return d ? this._vSecurityDense() : this._vSecurity();
      case "alarme": return this._vAlarme();
      case "batterien": return d ? this._vBatteriesDense() : this._vBatteries();
      case "wartung": return maintPageHTML(this._layout, !!(this._hass.user && this._hass.user.is_admin));
      case "einstellungen": return this._vSettings();
      case "extern": return `<div class="extwrap"><div class="extload">${icon("mdi:loading", "spin")}Lade …</div></div>`;
      default: return this._vOverview();
    }
  }

  _go(sub) {
    sub = sub || "";
    const toSettings = sub.split("/")[0] === "einstellungen";
    if (this._view === "einstellungen" && !toSettings && this._dirtySettings) {
      this._toast("Ungespeicherte Änderungen verworfen");
      this._dirtySettings = false;
    }
    if (!toSettings) this._draft = null;
    // „einstellungen/<reiter>“ wählt den Reiter auch dann, wenn dieselbe Adresse schon einmal offen war
    else this._setTabArg = null;
    this._navigate(sub ? `${this._base}/${sub}` : this._base);
    // Falls Home Assistant die Route nicht zurückmeldet (z. B. im Test), selbst umschalten.
    const [view, arg] = sub.split("/");
    if ((view || null) !== this._view || (arg || null) !== this._arg) {
      this._view = view || null;
      this._arg = arg ? decodeURIComponent(arg) : null;
      this._dirty = true;
      this._schedule();
    }
    const m = this.shadowRoot.querySelector(".main");
    if (m) m.scrollTop = 0;
  }
}

export { HausVisualisierungPanel };
