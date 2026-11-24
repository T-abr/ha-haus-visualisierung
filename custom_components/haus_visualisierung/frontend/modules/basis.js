/* Haus Visualisierung – Basisklasse für Panel und Karten: Bindungen, sparsame Aktualisierung, Aktionen. */

import { dom, entName, esc, icon, isOn, MODE_ICON, MODE_NAME, num, setText, setWidth, UPD, withDefaults } from "./grundlagen.js";
import { buildModel } from "./modell.js";
import { updateTile } from "./aktualisierer.js";
import "./bindungen.js"; // füllt UPD
import { pinOk } from "./pin.js";

/* ------------------------------------------------------------------------ */
/*  Basisklasse: Bindungen, sparsame Aktualisierung, Aktionen                */
/* ------------------------------------------------------------------------ */
class HvBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._layout = withDefaults();
    this._model = null;
    this._binds = new Map();
    this._watchList = [];
    this._pending = new Set();
    this._dirty = true;
    this._raf = 0;
    this._stats = { renders: 0, updates: 0 };
    this._onClick = this._onClick.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onChange = this._onChange.bind(this);
    // Feste Funktionen: addEventListener ignoriert dieselbe Funktion beim erneuten Einhängen (Ansichtswechsel im Dashboard
    // hängt Karten ab und wieder an), anonyme Funktionen kämen bei jedem connectedCallback doppelt dazu.
    this._onMove = this._onMove.bind(this);
    this._onMenu = (e) => { const t = e.target.closest("[data-long]"); if (t) { e.preventDefault(); this._more(t.dataset.eid); } };
    this._onVis = () => { if (!document.hidden) { this._schedule(); this._camTick(true); } };
  }

  connectedCallback() {
    this._connected = true;
    const r = this.shadowRoot;
    r.addEventListener("click", this._onClick);
    r.addEventListener("pointerdown", this._onDown);
    r.addEventListener("pointerup", this._onUp);
    r.addEventListener("pointercancel", this._onUp);
    r.addEventListener("pointermove", this._onMove);
    r.addEventListener("contextmenu", this._onMenu);
    r.addEventListener("change", this._onChange);
    r.addEventListener("input", this._onChange);
    document.addEventListener("visibilitychange", this._onVis);
    this._dirty = true;
    this._schedule();
    this._startCams();
  }

  /** Zeiger bewegt: Langdruck abbrechen, Helligkeit per Wischen. */
  _onMove(e) {
    if (this._downAt && Math.hypot(e.clientX - this._downAt[0], e.clientY - this._downAt[1]) > 12) { this._downAt = null; clearTimeout(this._longT); }
    const dm = this._dim;
    if (!dm) return;
    const dx = e.clientX - dm.x0, dy = e.clientY - dm.y0;
    if (!dm.active && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      dm.active = true;
      clearTimeout(this._longT);
      dm.el.classList.add("dragging");
      try { dm.el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    }
    if (dm.active) {
      dm.pct = Math.max(1, Math.min(100, Math.round(dm.pct0 + (dx / dm.w) * 100)));
      setWidth(dm.el.querySelector(".fill"), dm.pct);
      setText(dm.el, ".tstate", `${dm.pct} %`);
    }
  }

  disconnectedCallback() {
    this._connected = false;
    document.removeEventListener("visibilitychange", this._onVis);
    clearInterval(this._camTimer);
    if (this._camObs) this._camObs.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  set hass(h) {
    const old = this._hass;
    this._hass = h;
    if (!this._connected || !h) return;
    if (!old || h.entities !== old.entities || h.areas !== old.areas || h.devices !== old.devices || h.floors !== old.floors) {
      this._dirty = true;
      this._schedule();
      return;
    }
    if (h.states === old.states) return;
    const s = h.states, o = old.states, w = this._watchList;
    for (let i = 0; i < w.length; i++) if (s[w[i]] !== o[w[i]]) this._pending.add(w[i]);
    if (this._pending.size) this._schedule();
  }
  get hass() { return this._hass; }

  _schedule() {
    if (this._raf || !this._connected) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._flush(); });
  }

  _flush() {
    if (!this._hass) return;
    if (this._dirty) {
      this._dirty = false;
      this._pending.clear();
      this._model = buildModel(this._hass, this._layout);
      this._render();
      this._stats.renders++;
      return;
    }
    if (!this._pending.size) return;
    const runs = new Set();
    for (const eid of this._pending) { const l = this._binds.get(eid); if (l) for (const el of l) runs.add(el); }
    this._pending.clear();
    for (const el of runs) if (el.isConnected) { UPD[el.dataset.u].run(el, this); this._stats.updates++; }
  }

  /** Nach jedem Neuaufbau: Bindungen einsammeln und einmal füllen. */
  _wire(root) {
    this._binds = new Map();
    root.querySelectorAll("[data-u]").forEach((el) => {
      const u = UPD[el.dataset.u];
      if (!u) return;
      for (const eid of u.watch(el, this)) {
        let l = this._binds.get(eid);
        if (!l) this._binds.set(eid, (l = []));
        l.push(el);
      }
      u.run(el, this);
    });
    this._watchList = [...this._binds.keys()];
    this._observeCams(root);
  }

  /* ---------- Kamera-Standbilder: nur sichtbare, nur bei sichtbarem Tab ---------- */
  _startCams() {
    clearInterval(this._camTimer);
    const sec = Math.max(3, this._layout.camera_interval || 10);
    this._camTimer = setInterval(() => this._camTick(false), sec * 1000);
  }
  _observeCams(root) {
    if (this._camObs) this._camObs.disconnect();
    this._camVisible = new Set();
    const imgs = root.querySelectorAll("img[data-cam]");
    if (!imgs.length) return;
    this._camObs = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.isIntersecting) { this._camVisible.add(e.target); this._loadCam(e.target); } else this._camVisible.delete(e.target);
      }
    });
    imgs.forEach((i) => this._camObs.observe(i));
  }
  _camTick() {
    if (document.hidden || !this._camVisible) return;
    for (const img of this._camVisible) if (img.isConnected) this._loadCam(img);
  }
  _loadCam(img) {
    const st = this._hass && this._hass.states[img.dataset.cam];
    if (!st || !st.attributes.access_token || img._loading) return;
    img._loading = true;
    const url = `/api/camera_proxy/${st.entity_id}?token=${st.attributes.access_token}&t=${Date.now()}`;
    const pre = new Image();
    pre.onload = () => { img.src = url; img.classList.add("ready"); img._loading = false; };
    pre.onerror = () => { img._loading = false; };
    pre.src = url;
  }

  /* ---------- Bedienung ---------- */
  _onDown(e) {
    const t = e.target.closest("[data-long]");
    if (!t || e.target.closest("button, input")) return;
    if (t.dataset.dim) {
      const f = t.querySelector(".fill");
      this._dim = { el: t, x0: e.clientX, y0: e.clientY, w: t.offsetWidth || 200, pct0: (f && f._w) || 0, pct: 0, active: false };
    }
    this._downAt = [e.clientX, e.clientY];
    clearTimeout(this._longT);
    this._longT = setTimeout(() => { this._suppress = true; this._more(t.dataset.eid); }, 550);
  }
  _onUp() {
    clearTimeout(this._longT);
    this._downAt = null;
    const dm = this._dim;
    this._dim = null;
    if (dm && dm.active) {
      dm.el.classList.remove("dragging");
      this._suppress = true;
      setTimeout(() => { this._suppress = false; }, 400);
      this._call("light", "turn_on", { entity_id: dm.el.dataset.eid, brightness_pct: dm.pct });
    }
  }

  _onClick(e) {
    if (this._suppress) { this._suppress = false; e.preventDefault(); return; }
    const t = e.target.closest("[data-act]");
    if (!t || t.dataset.act === "noop") return;
    if (t.dataset.act === "confirm-ok" || t.dataset.act === "confirm-cancel") { this._closeConfirm(t.dataset.act === "confirm-ok"); return; }
    if (t.dataset.confirm && this._layout.confirm_quick !== false) { this._askConfirm(t); return; }
    this._action(t.dataset.act, t, e);
  }

  /* ---------- Abfrage vor dem Ausführen (Schnellzugriff) ---------- */
  _askConfirm(t) {
    const h = this._hass, act = t.dataset.act;
    const eids = (t.dataset.eids || "").split(",").filter(Boolean);
    let title = "Wirklich ausführen?", text = "", ok = "Ausführen", ic = "mdi:help-circle-outline";
    if (act === "lights-off") {
      const n = eids.filter((e) => isOn(h.states[e])).length;
      if (!n) { this._toast("Alle Lichter sind bereits aus"); return; }
      title = "Alle Lichter ausschalten?"; text = `${n} ${n === 1 ? "Licht ist" : "Lichter sind"} gerade an.`; ok = "Ausschalten"; ic = "mdi:lightbulb-off-outline";
    } else if (act === "list-covers") {
      const open = t.dataset.svc === "open_cover";
      title = open ? "Alle Rollos öffnen?" : "Alle Rollos schließen?";
      text = `${eids.length} ${eids.length === 1 ? "Rollo" : "Rollos"} im ganzen Haus.`; ok = open ? "Öffnen" : "Schließen"; ic = open ? "mdi:window-shutter-open" : "mdi:window-shutter";
      if (t.dataset.ctitle) { title = t.dataset.ctitle; text = t.dataset.ctext || ""; }
    } else if (act === "hm-set") {
      const md = t.dataset.mode, arm = (this._layout.house_mode.arm || {})[md];
      title = `Hausmodus „${MODE_NAME[md]}“?`; ok = "Umschalten"; ic = MODE_ICON[md];
      text = { arm_away: "Die Alarmanlage wird scharf geschaltet (abwesend).", arm_night: "Die Alarmanlage wird scharf geschaltet (Nacht).", arm_vacation: "Die Alarmanlage wird scharf geschaltet (Urlaub).", arm_home: "Die Alarmanlage wird scharf geschaltet (zuhause)." }[arm] || "";
    } else if (act === "run") {
      const script = dom(t.dataset.eid) === "script";
      title = `${script ? "Skript" : "Szene"} „${entName(h, t.dataset.eid)}“ ausführen?`; ok = "Ausführen"; ic = script ? "mdi:script-text-play" : "mdi:palette";
    }
    this._closeConfirm(false);
    this._confirmFor = t;
    const m = document.createElement("div");
    m.className = "mbg";
    m.innerHTML = `<div class="modal glass" role="dialog" aria-modal="true"><span class="mic">${icon(ic)}</span>
      <div class="mt">${esc(title)}</div>${text ? `<div class="mx">${esc(text)}</div>` : ""}
      <div class="mb"><button class="pbtn" data-act="confirm-cancel">Abbrechen</button><button class="pbtn primary" data-act="confirm-ok">${esc(ok)}</button></div></div>`;
    m.addEventListener("click", (ev) => { if (ev.target === m) this._closeConfirm(false); });
    this._confirmKey = (ev) => { if (ev.key === "Escape") this._closeConfirm(false); else if (ev.key === "Enter") { ev.preventDefault(); this._closeConfirm(true); } };
    window.addEventListener("keydown", this._confirmKey);
    (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(m);
    const b = m.querySelector('[data-act="confirm-ok"]');
    if (b) b.focus();
  }

  _closeConfirm(run) {
    const m = this.shadowRoot.querySelector(".mbg");
    if (m) m.remove();
    if (this._confirmKey) { window.removeEventListener("keydown", this._confirmKey); this._confirmKey = null; }
    const t = this._confirmFor;
    this._confirmFor = null;
    if (run && t) this._action(t.dataset.act, t);
  }

  _onChange(e) {
    const t = e.target;
    if (t.dataset && t.dataset.bri && e.type === "change") {
      this._call("light", "turn_on", { entity_id: t.dataset.bri, brightness_pct: Number(t.value) });
    }
  }

  _more(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  async _call(domain, service, data) {
    try { await this._hass.callService(domain, service, data); } catch (err) { this._toast(`Fehler: ${err && err.message ? err.message : err}`); }
  }

  _toast(msg) {
    const r = this.shadowRoot;
    let t = r.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; r.appendChild(t); }
    t.textContent = msg;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.remove(), 3500);
  }

  _toggleList(eids) {
    const h = this._hass;
    const anyOn = eids.some((e) => isOn(h.states[e]));
    const byDomain = {};
    for (const e of eids) (byDomain[dom(e)] = byDomain[dom(e)] || []).push(e);
    for (const [d, list] of Object.entries(byDomain)) this._call(d === "light" ? "light" : "homeassistant", anyOn ? "turn_off" : "turn_on", { entity_id: list });
  }

  _action(act, t) {
    const h = this._hass;
    const eid = t.dataset.eid;
    switch (act) {
      case "more": this._more(eid); break;
      case "toggle": {
        const d = dom(eid);
        this._call(["light", "switch", "fan", "input_boolean", "siren"].includes(d) ? d : "homeassistant", "toggle", { entity_id: eid });
        break;
      }
      case "run": {
        const d = dom(eid);
        const svc = d === "button" || d === "input_button" ? "press" : "turn_on";
        this._call(d, svc, { entity_id: eid });
        t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
        setTimeout(() => t.classList.remove("flash"), 800);
        break;
      }
      case "cover": this._call("cover", t.dataset.svc, { entity_id: eid }); break;
      case "select-opt": this._call(dom(eid), "select_option", { entity_id: eid, option: t.dataset.opt }); break;
      case "num-step": {
        const st = h.states[eid], v = num(st);
        if (v === null) break;
        const a = st.attributes, nv = Math.min(a.max ?? 100, Math.max(a.min ?? 0, v + Number(t.dataset.step)));
        this._call(dom(eid), "set_value", { entity_id: eid, value: nv });
        break;
      }
      case "clim": {
        const st = h.states[eid];
        if (!st) return;
        const stepSize = st.attributes.target_temp_step || (dom(eid) === "water_heater" ? 1 : 0.5);
        const cur = st.attributes.temperature;
        if (cur == null) { this._more(eid); return; }
        const v = Math.round((cur + Number(t.dataset.step) * stepSize) * 10) / 10;
        const min = st.attributes.min_temp ?? -100, max = st.attributes.max_temp ?? 100;
        this._call(dom(eid), "set_temperature", { entity_id: eid, temperature: Math.min(max, Math.max(min, v)) });
        break;
      }
      case "media": this._call("media_player", t.dataset.svc, { entity_id: eid }); break;
      case "lock": {
        const tile = t.closest(".tile");
        const st = h.states[eid];
        if (isOn(st)) { this._call("lock", "lock", { entity_id: eid }); break; }
        if (tile.dataset.confirm === "1") {
          tile.dataset.confirm = "";
          pinOk(this, "door", `${entName(h, eid)} entriegeln`).then((ok) => { if (ok) this._call("lock", "unlock", { entity_id: eid }); });
        } else {
          tile.dataset.confirm = "1";
          updateTile(tile, this);
          setTimeout(() => { tile.dataset.confirm = ""; if (tile.isConnected) updateTile(tile, this); }, 3500);
        }
        break;
      }
      case "area-lights": {
        const a = this._model.areas.get(t.dataset.area);
        if (a && a.lights.length) this._toggleList(a.lights);
        break;
      }
      case "area-covers": {
        const a = this._model.areas.get(t.dataset.area);
        if (a && a.covers.length) this._call("cover", t.dataset.svc, { entity_id: a.covers });
        break;
      }
      case "list-lights": this._toggleList((t.dataset.eids || "").split(",").filter(Boolean)); break;
      case "lights-off": {
        const list = (t.dataset.eids || "").split(",").filter((e) => e && isOn(h.states[e]));
        if (list.length) this._call("light", "turn_off", { entity_id: list });
        break;
      }
      case "list-covers": {
        const list = (t.dataset.eids || "").split(",").filter(Boolean);
        if (list.length) this._call("cover", t.dataset.svc, { entity_id: list });
        break;
      }
      default: this._actionExtra && this._actionExtra(act, t);
    }
  }
}

export { HvBase };
