/* Haus Visualisierung – Gute-Nacht- und Verlassen-Check.
 * Vor dem Wechsel auf „Nacht“ oder „Abwesend“ zeigt ein Fenster, was noch offen ist (Fenster und Türen, Licht,
 * Schlösser, Garage, Herd & Co.). Jede Zeile lässt sich einzeln schließen bzw. ausschalten, umgeschaltet wird erst
 * auf „Nacht einschalten“ / „Trotzdem …“. Wird in panel.js als äußerster Teil zur Klasse des Panels gesetzt. */

import { dc, dom, entName, esc, icon, isOn, MODE_ICON, MODE_NAME, UNAV } from "./grundlagen.js";
import { ALARMS } from "./warnungen.js";

const CHECK_MODES = ["nacht", "abwesend"];
const TITLE = { nacht: "Gute Nacht", abwesend: "Ich gehe" };
const GO = { nacht: "Nacht einschalten", abwesend: "Abwesend einschalten" };
const ANYWAY = { nacht: "Trotzdem Nacht", abwesend: "Trotzdem abwesend" };
const ARM_TXT = { arm_away: "Danach wird die Alarmanlage scharf geschaltet (abwesend).", arm_night: "Danach wird die Alarmanlage scharf geschaltet (Nacht).",
  arm_vacation: "Danach wird die Alarmanlage scharf geschaltet (Urlaub).", arm_home: "Danach wird die Alarmanlage scharf geschaltet (zuhause)." };
/* Geräte, die beim Gehen bzw. nachts nicht an sein sollten (Schalter und Steckdosen nach Namen) */
const HOT_RE = /herd|kochfeld|backofen|\bofen\b|bügeleisen|buegeleisen|glätteisen|wasserkocher|kaffeemaschine|heizlüfter|stove|oven|\biron\b|kettle/i;
const GARAGE_DC = new Set(["garage", "gate"]);

const checkOn = (L) => !!(L.house_mode && L.house_mode.enabled !== false && L.house_mode.check !== false);

/* Offene Punkte für den Wechsel auf mode: [{ eid, kind, icon, name, room, state, act, svc }] */
function checkItems(h, m, L, mode) {
  const out = [], seen = new Set();
  const room = (e) => { const a = m.eidArea && m.eidArea.get(e); return a ? a.name : ""; };
  const add = (e, kind, ic, state, act) => {
    if (seen.has(e)) return;
    seen.add(e);
    const a = m.eidArea && m.eidArea.get(e);
    out.push({ eid: e, kind, icon: ic, name: entName(h, e, a), room: room(e), state, act });
  };
  const areas = m.visibleAreas || [];
  const all = (k) => areas.flatMap((a) => a.groups[k] || []);
  // Garage und Tore (cover)
  const garages = all("cover").filter((e) => GARAGE_DC.has(dc(h.states[e])));
  for (const e of garages) {
    const st = h.states[e];
    if (st && isOn(st)) add(e, "garage", "mdi:garage-open-variant", st.state === "opening" ? "öffnet" : "offen", { domain: "cover", service: "close_cover", label: "Schließen" });
  }
  const garageAreas = new Set(garages.map((e) => room(e)));
  // Fenster und Türen: Sensoren lassen sich nicht schließen → antippen zeigt den Sensor
  for (const e of all("contact")) {
    const st = h.states[e];
    if (!st || st.state !== "on") continue;
    const c = dc(st);
    if (c === "garage_door" && garageAreas.has(room(e))) continue; // steht schon als Garage drin
    const ic = c === "window" ? "mdi:window-open-variant" : c === "garage_door" ? "mdi:garage-open-variant" : c === "door" ? "mdi:door-open" : "mdi:window-open-variant";
    add(e, "contact", ic, "offen", null);
  }
  // Schlösser
  for (const e of all("lock")) {
    const st = h.states[e];
    if (!st || UNAV.has(st.state) || st.state === "locked" || st.state === "locking") continue;
    add(e, "lock", st.state === "jammed" ? "mdi:lock-alert" : "mdi:lock-open-variant", st.state === "jammed" ? "klemmt" : st.state === "open" ? "offen" : "nicht verriegelt",
      { domain: "lock", service: "lock", label: "Verriegeln" });
  }
  // Herd, Bügeleisen & Co. sowie eigene Geräte aus den Einstellungen
  const extra = (L.house_mode && L.house_mode.check_devices) || [];
  for (const e of [...all("switch").filter((x) => HOT_RE.test(entName(h, x))), ...extra]) {
    const st = h.states[e];
    if (!st || !isOn(st)) continue;
    const d = dom(e);
    const act = ["light", "switch", "fan", "input_boolean", "climate", "media_player", "water_heater", "humidifier"].includes(d) ? { domain: "homeassistant", service: "turn_off", label: "Ausschalten" }
      : d === "cover" ? { domain: "cover", service: "close_cover", label: "Schließen" } : d === "lock" ? { domain: "lock", service: "lock", label: "Verriegeln" } : null;
    add(e, "device", "mdi:power-plug-outline", "an", act);
  }
  // Licht
  for (const e of all("light")) {
    const st = h.states[e];
    if (st && isOn(st)) add(e, "light", "mdi:lightbulb-on", "an", { domain: "light", service: "turn_off", label: "Aus" });
  }
  // Medien nur beim Gehen
  if (mode === "abwesend") for (const e of all("media")) {
    const st = h.states[e];
    if (st && st.state === "playing") add(e, "media", "mdi:speaker-play", "spielt", { domain: "media_player", service: "media_pause", label: "Pause" });
  }
  return out;
}

const KIND_TITLE = { garage: "Garage & Tore", contact: "Fenster & Türen", lock: "Schlösser", device: "Geräte", light: "Licht", media: "Medien" };

const CSS = `
.gnmodal{width:min(460px,100%);max-height:calc(100% - 20px);display:flex;flex-direction:column;text-align:left}
.gnmodal .mic,.gnmodal .mt,.gnmodal .mx{text-align:center}
.gnlist{margin-top:14px;overflow:auto;display:flex;flex-direction:column;gap:4px;min-height:0}
.gnsec{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--hv-faint);margin:8px 2px 2px}
.gnrow{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:var(--hv-surface)}
.gnrow>ha-icon{color:var(--hv-warm);flex:none}
.gnrow .gnt{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;border:0;color:inherit;text-align:left;padding:0;font:inherit;cursor:pointer}
.gnrow .gnt small{display:block;color:var(--hv-dim);font-size:12px}
.gnrow .pbtn{padding:7px 12px;font-size:12.5px;flex:none}
.gnrow.busy{opacity:.55}
.gnok{display:flex;align-items:center;gap:10px;justify-content:center;padding:14px;margin-top:12px;border-radius:12px;background:var(--hv-surface);color:var(--hv-ok)}
.gnmodal .mb{flex-wrap:wrap}.gnmodal .mb .pbtn{flex:1 1 30%;min-width:0;white-space:normal}
`;

const GuteNachtMixin = (Base) => class extends Base {
  /* Knöpfe für den Schnellzugriff (Übersicht, Wandpanel, Handy) */
  _checkBtns(cls = "qbtn") {
    if (!checkOn(this._layout)) return "";
    return CHECK_MODES.map((md) => `<button class="${cls} gnbtn" data-act="gn-open" data-mode="${md}">${icon(md === "nacht" ? "mdi:weather-night" : "mdi:exit-run")}<span>${TITLE[md]}</span></button>`).join("");
  }

  /* Hausmodus-Karte: ist vor Nacht/Abwesend noch etwas offen, erst der Check (ersetzt dort die einfache Abfrage);
   * ist alles zu, schaltet die Karte wie bisher. */
  _onClick(e) {
    const t = !this._suppress && e.target.closest && e.target.closest('[data-act="hm-set"]');
    if (t && CHECK_MODES.includes(t.dataset.mode) && checkOn(this._layout) && this._model) {
      const cur = (ALARMS && ALARMS.mode && ALARMS.mode.mode) || "zuhause";
      if (cur !== t.dataset.mode && checkItems(this._hass, this._model, this._layout, t.dataset.mode).length) { this._gnOpen(t.dataset.mode); return; }
    }
    super._onClick(e);
  }

  _actionExtra(act, t) {
    switch (act) {
      case "gn-open": this._gnOpen(t.dataset.mode); return undefined;
      case "gn-close": this._gnClose(); return undefined;
      case "gn-fix": this._gnFix([t.dataset.eid]); return undefined;
      case "gn-fixall": this._gnFix(this._gnItems().filter((x) => x.act).map((x) => x.eid)); return undefined;
      case "gn-more": this._more(t.dataset.eid); return undefined;
      case "gn-go": {
        const md = this._gnMode;
        this._gnClose();
        const cur = (ALARMS && ALARMS.mode && ALARMS.mode.mode) || "zuhause";
        if (md && md !== cur) return super._actionExtra("hm-set", { dataset: { mode: md } });
        return undefined;
      }
      case "s-chk-add": {
        const D = this._draft, inp = this.shadowRoot.querySelector("[data-chk-input]"), v = inp && inp.value.trim();
        if (!D || !v) return undefined;
        if (!this._hass.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return undefined; }
        const list = D.house_mode.check_devices || [];
        if (!list.includes(v)) D.house_mode.check_devices = [...list, v];
        this._rerenderSettings();
        return undefined;
      }
      case "s-chk-del": {
        const D = this._draft;
        if (!D) return undefined;
        D.house_mode.check_devices = (D.house_mode.check_devices || []).filter((x) => x !== t.dataset.eid);
        this._rerenderSettings();
        return undefined;
      }
      default: return super._actionExtra(act, t);
    }
  }

  _gnItems() { return this._model && this._gnMode ? checkItems(this._hass, this._model, this._layout, this._gnMode) : []; }

  _gnOpen(mode) {
    if (!CHECK_MODES.includes(mode)) return;
    this._gnClose();
    if (this._closeConfirm) this._closeConfirm(false);
    this._gnMode = mode;
    this._gnBusy = new Map();
    const m = document.createElement("div");
    m.className = "mbg gnbg";
    m.innerHTML = `<style>${CSS}</style><div class="modal glass gnmodal" role="dialog" aria-modal="true" aria-label="${esc(TITLE[mode])}"></div>`;
    m.addEventListener("click", (ev) => { if (ev.target === m) this._gnClose(); });
    this._gnKey = (ev) => { if (ev.key === "Escape") this._gnClose(); };
    window.addEventListener("keydown", this._gnKey);
    (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(m);
    this._gnSig = null;
    this._gnRender();
    this._gnTimer = setInterval(() => this._gnRender(), 600);
  }

  _gnClose() {
    clearInterval(this._gnTimer);
    this._gnTimer = null;
    const m = this.shadowRoot && this.shadowRoot.querySelector(".gnbg");
    if (m) m.remove();
    if (this._gnKey) { window.removeEventListener("keydown", this._gnKey); this._gnKey = null; }
    this._gnMode = null;
  }

  _gnFix(eids) {
    const items = this._gnItems().filter((x) => x.act && eids.includes(x.eid));
    const by = {};
    for (const x of items) {
      const k = `${x.act.domain}.${x.act.service}`;
      (by[k] = by[k] || []).push(x.eid);
      this._gnBusy.set(x.eid, Date.now());
    }
    for (const [k, list] of Object.entries(by)) {
      const [domain, service] = k.split(".");
      this._call(domain, service, { entity_id: list });
    }
    this._gnRender(true);
  }

  _gnRender(force = false) {
    const box = this.shadowRoot && this.shadowRoot.querySelector(".gnmodal");
    if (!box || !this._gnMode) { this._gnClose(); return; }
    const md = this._gnMode, items = this._gnItems(), now = Date.now();
    for (const [e, t0] of this._gnBusy) if (now - t0 > 8000 || !items.some((x) => x.eid === e)) this._gnBusy.delete(e);
    const sig = JSON.stringify([items.map((x) => [x.eid, x.state]), [...this._gnBusy.keys()]]);
    if (!force && sig === this._gnSig) return;
    this._gnSig = sig;
    const H = this._layout.house_mode || {}, arm = H.alarmo_sync ? (H.arm || {})[md] : "";
    const cur = (ALARMS && ALARMS.mode && ALARMS.mode.mode) || "zuhause";
    const fixable = items.filter((x) => x.act);
    let list = "", kind = "";
    for (const x of items) {
      if (x.kind !== kind) { kind = x.kind; list += `<div class="gnsec">${KIND_TITLE[kind]}</div>`; }
      const busy = this._gnBusy.has(x.eid);
      list += `<div class="gnrow${busy ? " busy" : ""}" data-eid="${esc(x.eid)}">${icon(x.icon)}
        <button class="gnt" data-act="gn-more" data-eid="${esc(x.eid)}" title="Details">${esc(x.name)}<small>${esc([x.room, x.state].filter(Boolean).join(" · "))}</small></button>
        ${x.act ? `<button class="pbtn" data-act="gn-fix" data-eid="${esc(x.eid)}"${busy ? " disabled" : ""}>${busy ? "…" : esc(x.act.label)}</button>` : ""}</div>`;
    }
    const n = items.length;
    const sub = cur === md ? `Der Hausmodus ist bereits „${MODE_NAME[md]}“.` : n ? `${n} ${n === 1 ? "Punkt ist" : "Punkte sind"} noch offen.` : "Alles zu und aus.";
    const goLbl = cur === md ? "Fertig" : n ? ANYWAY[md] : GO[md];
    box.innerHTML = `<span class="mic">${icon(MODE_ICON[md])}</span><div class="mt">${esc(TITLE[md])}</div>
      <div class="mx">${esc(sub)}${cur !== md && ARM_TXT[arm] ? ` ${esc(ARM_TXT[arm])}` : ""}</div>
      ${n ? `<div class="gnlist">${list}</div>` : `<div class="gnok">${icon("mdi:check-circle-outline")}Nichts mehr offen</div>`}
      <div class="mb"><button class="pbtn" data-act="gn-close">Abbrechen</button>
        ${fixable.length > 1 ? `<button class="pbtn" data-act="gn-fixall">Alles schließen</button>` : ""}
        <button class="pbtn primary" data-act="gn-go">${esc(goLbl)}</button></div>`;
  }

  disconnectedCallback() {
    this._gnClose();
    if (super.disconnectedCallback) super.disconnectedCallback();
  }

  /* Einstellungen → Alarme, unter „Hausmodus“ */
  _setCheck(D) {
    const H = D.house_mode, h = this._hass, list = H.check_devices || [];
    const chip = (e) => `<span class="pin">${esc(h.states[e] ? entName(h, e) : e)}<button data-act="s-chk-del" data-eid="${esc(e)}" title="Entfernen">${icon("mdi:close")}</button></span>`;
    return `<div class="set glass"><h2>${icon("mdi:weather-night")}Gute-Nacht- und Verlassen-Check</h2>
      <p class="hint">Vor „Nacht“ und „Abwesend“ zeigt ein Fenster, was noch offen ist: Fenster und Türen, Licht, nicht verriegelte Schlösser, Garage und Geräte wie Herd oder Bügeleisen (Schalter mit passendem Namen). Jeder Punkt lässt sich dort schließen oder ausschalten, umgeschaltet wird erst nach Bestätigung. Knöpfe „Gute Nacht“ und „Ich gehe“ im Schnellzugriff der Übersicht.</p>
      <div class="srow"><span class="lbl">Check vor Nacht und Abwesend<small>aus = Hausmodus wie bisher direkt umschalten</small></span><label class="tgl"><input type="checkbox" data-set="house_mode.check" data-bool="1" ${H.check !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Weitere Geräte prüfen<small>z. B. Steckdose von Bügeleisen oder Kaffeemaschine – erscheinen, wenn sie an sind</small></span></div>
      ${list.length ? `<div class="srow"><div class="pins" style="padding-left:0">${list.map(chip).join("")}</div></div>` : ""}
      <div class="srow"><input class="inp w" list="dl-all" placeholder="Entität hinzufügen, z. B. switch.buegeleisen" data-chk-input="1"><button class="pbtn" data-act="s-chk-add">${icon("mdi:plus")}Hinzufügen</button></div>
    </div>`;
  }
};

export { checkItems, CHECK_MODES, GuteNachtMixin };
