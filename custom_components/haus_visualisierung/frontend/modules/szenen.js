/* Haus Visualisierung – Szenen je Raum.
 * Auf der Raumseite stehen die Szenen des Raums als Knöpfe oben im Kopf (ein Tipp schaltet). Admins legen dort
 * eigene Szenen an: Lichter mit Helligkeit und Farbe bzw. Weißton, Rollos mit Position, Schalter an/aus; „Aktuellen
 * Zustand übernehmen“ füllt alles aus dem Ist-Zustand. Gespeichert wird im Layout unter scenes (je Szene ein Pfad),
 * die Integration macht daraus scene.haus_<id> (scene.py) – damit auch Kachel am Wanddisplay und Automationen.
 * Vorhandene scene.* des Raums erscheinen ebenso als Knöpfe. Wird in panel.js zur Klasse des Panels gesetzt. */

import { DOMAIN } from "./version.js";
import { dom, entName, esc, icon, isOn, UNAV, withDefaults } from "./grundlagen.js";

const SZ_DOMAINS = ["light", "cover", "switch", "fan", "input_boolean"];
const SZ_ICONS = ["mdi:palette", "mdi:movie-open", "mdi:silverware-fork-knife", "mdi:broom", "mdi:sofa", "mdi:bed", "mdi:weather-night",
  "mdi:book-open-variant", "mdi:party-popper", "mdi:white-balance-sunny", "mdi:television", "mdi:lightbulb-group"];
const COLOR_MODES = new Set(["hs", "rgb", "xy", "rgbw", "rgbww"]);
const slug = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const hex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const isAdmin = (h) => !!(h && h.user && h.user.is_admin);

/** Eigene Szene (aus dem Panel) → ihre ID, sonst "" */
const ownId = (st) => (st && st.attributes && typeof st.attributes.haus_szene === "string" ? st.attributes.haus_szene : "");

/** Was eine Lampe kann: dimmen, Weißton (min/max Kelvin), Farbe */
function lightCaps(st) {
  const modes = (st && st.attributes.supported_color_modes) || [];
  return {
    dim: modes.some((m) => m !== "onoff"),
    ct: modes.includes("color_temp"),
    color: modes.some((m) => COLOR_MODES.has(m)),
    ctMin: Math.round((st && st.attributes.min_color_temp_kelvin) || 2000),
    ctMax: Math.round((st && st.attributes.max_color_temp_kelvin) || 6500),
  };
}

/** Ist-Zustand einer Entität als Zeile des Editors */
function capture(h, eid) {
  const st = h.states[eid], d = dom(eid), row = { inc: true };
  if (!st) return { inc: false, on: false };
  if (d === "cover") {
    const p = st.attributes.current_position;
    row.pos = typeof p === "number" ? Math.round(p) : (st.state === "open" || st.state === "opening" ? 100 : 0);
    return row;
  }
  row.on = isOn(st);
  if (d === "light" && row.on) {
    const a = st.attributes;
    if (typeof a.brightness === "number") row.bri = Math.max(1, Math.round(a.brightness / 2.55));
    if (COLOR_MODES.has(a.color_mode) && Array.isArray(a.rgb_color)) { row.cmode = "color"; row.color = hex(a.rgb_color); }
    else if (a.color_mode === "color_temp" && typeof a.color_temp_kelvin === "number") { row.cmode = "ct"; row.ct = Math.round(a.color_temp_kelvin); }
  }
  return row;
}

/** Gespeicherter Zustand → Zeile des Editors */
function fromSpec(eid, s) {
  if (dom(eid) === "cover") return { inc: true, pos: s.pos };
  const row = { inc: true, on: !!s.on };
  if (typeof s.bri === "number") row.bri = s.bri;
  if (s.color) { row.cmode = "color"; row.color = s.color; } else if (typeof s.ct === "number") { row.cmode = "ct"; row.ct = s.ct; }
  return row;
}

/** Zeile des Editors → gespeicherter Zustand (wie scenes.py ihn erwartet) */
function toSpec(eid, r) {
  if (dom(eid) === "cover") return { pos: Math.round(r.pos ?? 100) };
  const s = { on: !!r.on };
  if (dom(eid) === "light" && r.on) {
    if (typeof r.bri === "number") s.bri = r.bri;
    if (r.cmode === "color" && r.color) s.color = r.color;
    else if (r.cmode === "ct" && r.ct) s.ct = r.ct;
  }
  return s;
}

const posText = (p) => (p >= 100 ? "Auf" : p <= 0 ? "Zu" : `${p} %`);

const CSS = `
.szmodal{width:min(520px,100%);max-height:calc(100% - 20px);display:flex;flex-direction:column;text-align:left}
.szmodal .mic,.szmodal .mt{text-align:center}
.szbody{margin-top:12px;overflow:auto;min-height:0;display:flex;flex-direction:column;gap:8px}
.szfield{display:flex;gap:8px;align-items:center}.szfield .inp{flex:1}
.szicons{display:flex;flex-wrap:wrap;gap:6px}
.szic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface);border:1px solid var(--hv-line);color:var(--hv-dim);cursor:pointer;padding:0}
.szic.on{background:rgba(199,155,255,.18);border-color:rgba(199,155,255,.55);color:#dcc8ff}
.szsec{display:flex;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--hv-faint);margin:8px 2px 0}
.szsec .sp{flex:1}.szsec .pbtn{text-transform:none;letter-spacing:0;padding:6px 10px;font-size:12px}
.szrow{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:12px;background:var(--hv-surface)}
.szrow.off{opacity:.55}
.szhead{display:flex;align-items:center;gap:10px;font-size:14px}
.szhead label{flex:1;min-width:0;display:flex;align-items:center;gap:8px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.szhead input[type=checkbox]{width:18px;height:18px;flex:none;accent-color:var(--hv-accent)}
.szctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-left:26px;font-size:12.5px;color:var(--hv-dim)}
.szctl input[type=range]{flex:1;min-width:120px;accent-color:var(--hv-accent)}
.szctl select{background:rgba(0,0,0,.3);border:1px solid var(--hv-line);border-radius:8px;color:var(--hv-text);padding:5px 8px;font:inherit;font-size:12.5px}
.szctl input[type=color]{width:38px;height:28px;border:0;padding:0;background:none;cursor:pointer}
.szctl .szv{min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
.szempty{padding:12px;border-radius:12px;background:var(--hv-surface);color:var(--hv-dim);font-size:13px}
.szmodal .mb{flex-wrap:wrap}.szmodal .mb .pbtn{flex:1 1 22%;min-width:0;white-space:normal}
.szmodal .pbtn.danger{color:#ff8a80}
`;

const SzenenMixin = (Base) => class extends Base {
  /* ---------- Raumseite: Knöpfe im Kopf ---------- */
  /** scene.* eines Raums (eigene und vorhandene) */
  _roomSceneIds(a) { return (a.groups.scene || []).filter((e) => dom(e) === "scene"); }

  _roomScenesHTML(a) {
    const h = this._hass, ids = this._roomSceneIds(a), admin = isAdmin(h);
    if (!ids.length && !admin) return "";
    const chips = ids.map((e) => {
      const st = h.states[e];
      return `<button class="schip" data-act="run" data-eid="${esc(e)}" title="${esc(entName(h, e))} schalten">${icon((st && st.attributes.icon) || "mdi:palette")}<span>${esc(entName(h, e, a))}</span></button>`;
    }).join("");
    return `<div class="szbar">${chips}${this._szEditChip(a)}</div>`;
  }

  /** Knopf „Szenen“ (bearbeiten) bzw. „Szene anlegen“ für Admins – im Raumkopf beider Ansichten */
  _szEditChip(a) {
    const h = this._hass;
    if (!isAdmin(h)) return "";
    const own = Object.values(this._layout.scenes || {}).some((s) => s.area === a.id);
    return `<button class="schip szadd" data-act="sz-list" data-area="${esc(a.id)}" title="Szenen anlegen und bearbeiten">${icon(own ? "mdi:pencil" : "mdi:plus")}<span>${own ? "Szenen" : "Szene anlegen"}</span></button>`;
  }

  /* ---------- Editor ---------- */
  _szCandidates(a) {
    const g = a.groups;
    return [...(g.light || []), ...(g.cover || []), ...(g.switch || []).filter((e) => SZ_DOMAINS.includes(dom(e)))];
  }

  _szOpen(areaId, sid) {
    const a = this._model && this._model.areas.get(areaId);
    if (!a || !isAdmin(this._hass)) return;
    const h = this._hass, sc = sid ? (this._layout.scenes || {})[sid] : null;
    const cands = this._szCandidates(a);
    const rows = {};
    if (sc) {
      for (const e of cands) rows[e] = { ...capture(h, e), inc: false };
      for (const [e, s] of Object.entries(sc.ents || {})) rows[e] = fromSpec(e, s);
    } else for (const e of cands) rows[e] = capture(h, e);
    const eid = sid ? this._szEntity(sid) : "";
    this._sz = { area: a.id, sid: sid || "", name: sc ? sc.name : "", icon: sc ? sc.icon : "mdi:palette", rows,
      fav: !!(eid && (this._layout.favorites || []).includes(eid)), del: false, mode: "edit" };
    this._szShow();
  }

  _szList(areaId) {
    const a = this._model && this._model.areas.get(areaId);
    if (!a || !isAdmin(this._hass)) return;
    const own = Object.entries(this._layout.scenes || {}).filter(([, s]) => s.area === a.id);
    if (!own.length) { this._szOpen(a.id, ""); return; }
    this._sz = { area: a.id, mode: "list" };
    this._szShow();
  }

  /** Entität einer eigenen Szene (Name kann bei Kollision abweichen) */
  _szEntity(sid) {
    const h = this._hass;
    return Object.keys(h.states).find((e) => e.startsWith("scene.") && ownId(h.states[e]) === sid) || `scene.haus_${sid}`;
  }

  _szShow() {
    let m = this.shadowRoot.querySelector(".szbg");
    if (!m) {
      m = document.createElement("div");
      m.className = "mbg szbg";
      m.innerHTML = `<style>${CSS}</style><div class="modal glass szmodal" role="dialog" aria-modal="true" aria-label="Szene"></div>`;
      m.addEventListener("click", (ev) => { if (ev.target === m) this._szClose(); });
      m.addEventListener("input", (ev) => this._szInput(ev));
      m.addEventListener("change", (ev) => this._szInput(ev));
      this._szKey = (ev) => { if (ev.key === "Escape") this._szClose(); };
      window.addEventListener("keydown", this._szKey);
      (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(m);
    }
    this._szRender();
  }

  _szClose() {
    const m = this.shadowRoot && this.shadowRoot.querySelector(".szbg");
    if (m) m.remove();
    if (this._szKey) { window.removeEventListener("keydown", this._szKey); this._szKey = null; }
    this._sz = null;
  }

  _szRender() {
    const box = this.shadowRoot.querySelector(".szmodal"), S = this._sz;
    if (!box || !S) return;
    const h = this._hass, a = this._model.areas.get(S.area);
    if (!a) { this._szClose(); return; }
    if (S.mode === "list") {
      const own = Object.entries(this._layout.scenes || {}).filter(([, s]) => s.area === a.id);
      box.innerHTML = `<span class="mic">${icon("mdi:palette")}</span><div class="mt">Szenen ${esc(a.name)}</div>
        <div class="szbody">${own.map(([id, s]) => `<div class="szrow"><div class="szhead">${icon(s.icon)}<label>${esc(s.name)}</label>
          <button class="pbtn" data-act="sz-edit" data-sid="${esc(id)}">${icon("mdi:pencil")}Bearbeiten</button></div></div>`).join("")}</div>
        <div class="mb"><button class="pbtn" data-act="sz-close">Schließen</button><button class="pbtn primary" data-act="sz-new">${icon("mdi:plus")}Neue Szene</button></div>`;
      return;
    }
    const groups = [["light", "Licht"], ["cover", "Rollos"], ["switch", "Schalter"]];
    const kind = (e) => (dom(e) === "light" ? "light" : dom(e) === "cover" ? "cover" : "switch");
    const all = Object.keys(S.rows);
    const body = groups.map(([k, t]) => {
      const list = all.filter((e) => kind(e) === k);
      if (!list.length) return "";
      return `<div class="szsec">${t}</div>${list.map((e) => this._szRowHTML(e, S.rows[e], a)).join("")}`;
    }).join("");
    const n = all.filter((e) => S.rows[e].inc).length;
    box.innerHTML = `<span class="mic">${icon(S.icon)}</span><div class="mt">${S.sid ? "Szene bearbeiten" : "Neue Szene"} · ${esc(a.name)}</div>
      <div class="szbody">
        <div class="szfield"><input class="inp" data-sz="name" maxlength="40" placeholder="Name, z. B. Kino, Essen, Putzen" value="${esc(S.name)}"></div>
        <div class="szicons">${SZ_ICONS.map((i) => `<button class="szic${i === S.icon ? " on" : ""}" data-act="sz-icon" data-icon="${i}" title="Symbol">${icon(i)}</button>`).join("")}</div>
        <div class="srow"><span class="lbl">Im Schnellzugriff<small>als Knopf auf der Übersicht (Favorit)</small></span><label class="tgl"><input type="checkbox" data-sz="fav" ${S.fav ? "checked" : ""}><span></span></label></div>
        <div class="szsec">${n} von ${all.length} Geräten<span class="sp"></span><button class="pbtn" data-act="sz-capture" title="Ist-Zustand aller Geräte des Raums übernehmen">${icon("mdi:camera-iris")}Aktuellen Zustand übernehmen</button></div>
        ${body || `<div class="szempty">Im Raum gibt es keine Lichter, Rollos oder Schalter.</div>`}
      </div>
      <div class="mb">
        ${S.sid ? `<button class="pbtn danger" data-act="sz-del">${S.del ? "Wirklich löschen?" : "Löschen"}</button>` : ""}
        <button class="pbtn" data-act="sz-close">Abbrechen</button>
        <button class="pbtn" data-act="sz-test"${n ? "" : " disabled"} title="Jetzt schalten, ohne zu speichern">${icon("mdi:play")}Ausprobieren</button>
        <button class="pbtn primary" data-act="sz-save"${n && S.name.trim() ? "" : " disabled"}>Speichern</button>
      </div>`;
  }

  _szRowHTML(e, r, a) {
    const h = this._hass, st = h.states[e], d = dom(e), id = esc(e);
    const name = esc(st ? entName(h, e, a) : e);
    let ctl = "";
    if (r.inc && d === "cover") {
      const p = r.pos ?? 100;
      ctl = `<span>Position</span><input type="range" min="0" max="100" step="5" value="${p}" data-sz="pos" data-eid="${id}"><span class="szv">${posText(p)}</span>`;
    } else if (r.inc) {
      ctl = `<label class="tgl"><input type="checkbox" data-sz="on" data-eid="${id}" ${r.on ? "checked" : ""}><span></span></label><span>${r.on ? "An" : "Aus"}</span>`;
      if (d === "light" && r.on) {
        const c = lightCaps(st);
        if (c.dim) {
          const b = r.bri ?? 100;
          ctl += `<input type="range" min="1" max="100" value="${b}" data-sz="bri" data-eid="${id}" title="Helligkeit"><span class="szv">${b} %</span>`;
        }
        if (c.ct || c.color || r.cmode) {
          ctl += `<select data-sz="cmode" data-eid="${id}"><option value="">Farbe unverändert</option>${c.ct || r.cmode === "ct" ? `<option value="ct"${r.cmode === "ct" ? " selected" : ""}>Weißton</option>` : ""}${c.color || r.cmode === "color" ? `<option value="color"${r.cmode === "color" ? " selected" : ""}>Farbe</option>` : ""}</select>`;
          if (r.cmode === "color") ctl += `<input type="color" value="${esc(r.color || "#ffb060")}" data-sz="color" data-eid="${id}" title="Farbe">`;
          else if (r.cmode === "ct") {
            const v = r.ct || Math.round((c.ctMin + c.ctMax) / 2);
            ctl += `<input type="range" min="${c.ctMin}" max="${c.ctMax}" step="50" value="${v}" data-sz="ct" data-eid="${id}" title="Weißton (warm … kalt)"><span class="szv">${v} K</span>`;
          }
        }
      }
    }
    const unav = !st || UNAV.has(st.state);
    return `<div class="szrow${r.inc ? "" : " off"}"><div class="szhead"><label><input type="checkbox" data-sz="inc" data-eid="${id}" ${r.inc ? "checked" : ""}>${name}${unav ? ` <small>(nicht erreichbar)</small>` : ""}</label></div>${ctl ? `<div class="szctl">${ctl}</div>` : ""}</div>`;
  }

  _szInput(ev) {
    const t = ev.target, S = this._sz, k = t.dataset && t.dataset.sz;
    if (!S || !k) return;
    ev.stopPropagation();
    if (k === "name") {
      S.name = t.value;
      const b = this.shadowRoot.querySelector('.szmodal [data-act="sz-save"]');
      if (b) b.disabled = !(S.name.trim() && Object.values(S.rows).some((r) => r.inc));
      return;
    }
    if (k === "fav") { S.fav = t.checked; return; }
    const r = S.rows[t.dataset.eid];
    if (!r) return;
    if (k === "pos" || k === "bri" || k === "ct") {
      r[k] = Number(t.value);
      const v = t.nextElementSibling;
      if (v && v.classList.contains("szv")) v.textContent = k === "pos" ? posText(r.pos) : k === "bri" ? `${r.bri} %` : `${r.ct} K`;
      return;
    }
    if (ev.type !== "change") return;
    if (k === "inc") r.inc = t.checked;
    else if (k === "on") r.on = t.checked;
    else if (k === "cmode") r.cmode = t.value;
    else if (k === "color") { r.color = t.value; return; }
    const sc = this.shadowRoot.querySelector(".szbody"), top = sc ? sc.scrollTop : 0;
    this._szRender();
    const sc2 = this.shadowRoot.querySelector(".szbody");
    if (sc2) sc2.scrollTop = top;
  }

  _szEnts() {
    const out = {};
    for (const [e, r] of Object.entries(this._sz.rows)) if (r.inc) out[e] = toSpec(e, r);
    return out;
  }

  async _szSave() {
    const S = this._sz, h = this._hass, L = this._layout;
    if (!S || !S.name.trim()) return;
    const ents = this._szEnts();
    if (!Object.keys(ents).length) return;
    let sid = S.sid;
    if (!sid) {
      const base = (slug(`${S.area}_${S.name}`) || "szene").slice(0, 36);
      sid = base;
      for (let n = 2; (L.scenes || {})[sid]; n++) sid = `${base}_${n}`;
    }
    const changes = [{ path: ["scenes", sid], value: { name: S.name.trim(), icon: S.icon, area: S.area, ents } }];
    const eid = this._szEntity(sid), favs = L.favorites || [];
    if (S.fav !== favs.includes(eid)) changes.push({ path: ["favorites"], value: S.fav ? [...favs, eid] : favs.filter((e) => e !== eid) });
    await this._szWrite(changes, S.sid ? "Szene gespeichert" : `Szene „${S.name.trim()}“ angelegt`);
  }

  async _szDelete() {
    const S = this._sz;
    if (!S || !S.sid) return;
    if (!S.del) { S.del = true; this._szRender(); return; }
    const eid = this._szEntity(S.sid), favs = this._layout.favorites || [];
    const changes = [{ path: ["scenes", S.sid], delete: true }];
    if (favs.includes(eid)) changes.push({ path: ["favorites"], value: favs.filter((e) => e !== eid) });
    await this._szWrite(changes, "Szene gelöscht");
  }

  async _szWrite(changes, msg) {
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/save`, changes });
      this._layout = withDefaults(res.layout);
      this._szClose();
      this._dirty = true;
      this._flush();
      this._toast(msg);
    } catch (err) {
      this._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`);
    }
  }

  async _szTest() {
    if (!this._sz) return;
    try {
      await this._hass.callWS({ type: `${DOMAIN}/scene_test`, ents: this._szEnts() });
      this._toast("Szene geschaltet");
    } catch (err) {
      this._toast(`Fehler: ${err && err.message ? err.message : err}`);
    }
  }

  _actionExtra(act, t) {
    switch (act) {
      case "sz-list": this._szList(t.dataset.area); return undefined;
      case "sz-new": if (this._sz) this._szOpen(this._sz.area, ""); return undefined;
      case "sz-edit": if (this._sz) this._szOpen(this._sz.area, t.dataset.sid); return undefined;
      case "sz-close": this._szClose(); return undefined;
      case "sz-icon": if (this._sz) { this._sz.icon = t.dataset.icon; this._szRender(); } return undefined;
      case "sz-capture": {
        const S = this._sz;
        if (!S) return undefined;
        for (const e of Object.keys(S.rows)) S.rows[e] = capture(this._hass, e);
        this._szRender();
        return undefined;
      }
      case "sz-test": return this._szTest();
      case "sz-save": return this._szSave();
      case "sz-del": return this._szDelete();
      default: return super._actionExtra(act, t);
    }
  }

  disconnectedCallback() {
    this._szClose();
    if (super.disconnectedCallback) super.disconnectedCallback();
  }
};

export { SzenenMixin, capture, toSpec };
