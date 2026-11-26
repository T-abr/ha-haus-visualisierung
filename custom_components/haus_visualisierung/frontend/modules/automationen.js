/* Haus Visualisierung – Seite „Automationen“ (nur Administratoren): alle Automationen von Home Assistant,
 * Schalter zum Aktivieren/Deaktivieren, Sprung in den Editor von Home Assistant zum Bearbeiten und Anlegen,
 * dazu ein Kurzformular für einfache Automationen (ein Auslöser, eine Aktion), gespeichert über die
 * Konfigurations-API von Home Assistant (dieselbe wie der Editor, nur für Administratoren). Die Liste (mit Bereich und Beschreibung) liefert das Backend (automations.py); an/aus und „zuletzt ausgelöst“
 * kommen live aus den Zuständen. */

import { DOMAIN } from "./version.js";
import { esc, icon, relTime, setText } from "./grundlagen.js";

const NEW_PATH = "/config/automation/edit/new";
/** Stand vom Backend: { items, at, loading, error } */
let AUTO = { items: null, at: 0, loading: false, error: "" };
let QUERY = "";
/** Kurzformular „Einfache Automation“ (null = zu) */
let FORM = null;
const newForm = () => ({ name: "", desc: "", trig: "time", at: "07:00", sun: "sunset", offset: 0, tEnt: "", tTo: "", act: "turn_on", aEnt: "", notify: "", msg: "" });

const TRIGGERS = [["time", "Uhrzeit"], ["sun", "Sonnenaufgang / -untergang"], ["state", "Gerät ändert Zustand"]];
const ACTIONS = [["turn_on", "Einschalten"], ["turn_off", "Ausschalten"], ["toggle", "Umschalten"], ["scene", "Szene aktivieren"], ["notify", "Benachrichtigung senden"]];
/* Was sich schalten lässt (Aktion „Ein-/Aus-/Umschalten“) */
const SWITCHABLE = new Set(["light", "switch", "fan", "cover", "climate", "media_player", "input_boolean", "humidifier", "water_heater", "siren", "vacuum", "script", "automation", "lock", "valve"]);

const isAdmin = (h) => !!(h && h.user && h.user.is_admin);
const lastTxt = (st) => {
  const t = st && st.attributes.last_triggered;
  return t ? `zuletzt ausgelöst ${relTime(t)}` : "noch nie ausgelöst";
};
const matches = (a, q) => !q || `${a.name} ${a.area} ${a.description} ${a.entity_id}`.toLowerCase().includes(q);

/** Liste neu holen (beim Öffnen der Seite, höchstens alle 30 s, und nach Änderungen) */
async function autoLoad(p, force) {
  if (!isAdmin(p._hass) || AUTO.loading || (!force && AUTO.items && Date.now() - AUTO.at < 30000)) return;
  AUTO = { ...AUTO, loading: true };
  try {
    const r = await p._hass.callWS({ type: `${DOMAIN}/automations` });
    AUTO = { items: (r && r.automations) || [], at: Date.now(), loading: false, error: "" };
  } catch (err) {
    AUTO = { items: AUTO.items, at: Date.now(), loading: false, error: (err && err.message) || String(err) };
  }
  if (p._view === "automationen") { p._dirty = true; p._schedule(); }
}

function rowHTML(a, h) {
  const st = h.states[a.entity_id], on = (st ? st.state : a.state) === "on", unav = st && st.state === "unavailable";
  const sub = [a.area, a.description].filter(Boolean).map(esc).join(" · ");
  const edit = a.id != null && a.id !== ""
    ? `<button class="pbtn sm" data-act="nav-raw" data-path="/config/automation/edit/${encodeURIComponent(a.id)}" title="Im Editor von Home Assistant bearbeiten">${icon("mdi:pencil")}<span>Bearbeiten</span></button>`
    : `<span class="rl" title="Automation aus YAML ohne id – nur in der Datei änderbar">YAML</span>`;
  return `<div class="wrow aurow${on ? " on" : ""}" data-u="auto" data-eid="${esc(a.entity_id)}" data-q="${esc(`${a.name} ${a.area} ${a.description} ${a.entity_id}`.toLowerCase())}"${matches(a, QUERY) ? "" : " hidden"}>
    <span class="wic">${icon(on ? "mdi:robot" : "mdi:robot-off-outline")}</span>
    <span class="wtx"><b>${esc(a.name)}</b>${sub ? `<small>${sub}</small>` : ""}<small class="aulast">${unav ? "nicht verfügbar (Konfiguration fehlerhaft?)" : esc(lastTxt(st))}</small></span>
    <span class="wbtns">${edit}
      <label class="tgl" title="${on ? "Aktiv – zum Deaktivieren tippen" : "Deaktiviert – zum Aktivieren tippen"}"><input type="checkbox" data-act="auto-set" data-eid="${esc(a.entity_id)}" ${on ? "checked" : ""}${unav ? " disabled" : ""}><span></span></label></span></div>`;
}

/* ---------- Kurzformular ---------- */
const opt = (list, cur) => list.map(([k, t]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(t)}</option>`).join("");
const entOpts = (h, pick) => Object.keys(h.states).filter(pick).sort()
  .map((e) => `<option value="${esc(e)}">${esc(h.states[e].attributes.friendly_name || e)}</option>`).join("");

function formHTML(h) {
  const F = FORM, inp = (k, ph, extra = "") => `<input class="inp" data-auto="${k}" value="${esc(F[k])}" placeholder="${esc(ph)}" ${extra}>`;
  let trig = "";
  if (F.trig === "time") trig = `<input class="inp s" type="time" data-auto="at" value="${esc(F.at)}" aria-label="Uhrzeit">`;
  else if (F.trig === "sun") trig = `<select class="inp" data-auto="sun">${opt([["sunrise", "Sonnenaufgang"], ["sunset", "Sonnenuntergang"]], F.sun)}</select>
      <input class="inp s" type="number" min="-240" max="240" step="5" data-auto="offset" value="${Number(F.offset) || 0}" title="Versatz in Minuten (negativ = vorher)" aria-label="Versatz in Minuten"><span class="rl">Min. versetzt</span>`;
  else trig = `${inp("tEnt", "Entität, z. B. binary_sensor.haustuer", 'list="au-ents-all" style="flex:2 1 220px"')}
      <span class="rl">wird</span>${inp("tTo", "beliebig (z. B. on, off, home)", 'list="au-to" style="flex:1 1 140px"')}`;
  let act = "";
  if (F.act === "notify") {
    const svcs = Object.keys((h.services && h.services.notify) || {}).sort();
    act = `<select class="inp" data-auto="notify" aria-label="Benachrichtigungsdienst">${opt(svcs.map((s) => [s, s]), F.notify)}</select>
      ${inp("msg", "Text der Benachrichtigung", 'style="flex:2 1 240px"')}`;
  } else act = inp("aEnt", F.act === "scene" ? "Szene, z. B. scene.abend" : "Entität, z. B. light.flur", `list="${F.act === "scene" ? "au-ents-scene" : "au-ents-sw"}" style="flex:2 1 240px"`);
  return `<div class="section glass auform"><div class="shead">${icon("mdi:robot-outline")}<span class="st">Einfache Automation</span><span class="sp" style="flex:1"></span>
      <button class="sbtn" data-act="auto-form" data-open="0" title="Schließen">${icon("mdi:close")}</button></div>
    <div class="aubody">
      <div class="srow"><span class="lbl">Name</span>${inp("name", "z. B. Flurlicht bei Sonnenuntergang", 'style="flex:2 1 240px"')}</div>
      <div class="srow"><span class="lbl">Beschreibung<small>optional</small></span>${inp("desc", "wozu die Automation da ist", 'style="flex:2 1 240px"')}</div>
      <div class="srow"><span class="lbl">Wenn</span><select class="inp" data-auto="trig">${opt(TRIGGERS, F.trig)}</select>${trig}</div>
      <div class="srow"><span class="lbl">Dann</span><select class="inp" data-auto="act">${opt(ACTIONS, F.act)}</select>${act}</div>
      <p class="hint">Bedingungen, mehrere Auslöser oder Aktionen: nach dem Anlegen mit „Bearbeiten“ im Editor von Home Assistant ergänzen.</p>
      <div class="srow"><span class="sp" style="flex:1"></span><button class="pbtn" data-act="auto-form" data-open="0">Abbrechen</button>
        <button class="pbtn primary" data-act="auto-create">${icon("mdi:check")}Anlegen</button></div>
    </div>
    <datalist id="au-ents-all">${entOpts(h, () => true)}</datalist>
    <datalist id="au-ents-sw">${entOpts(h, (e) => SWITCHABLE.has(e.split(".")[0]))}</datalist>
    <datalist id="au-ents-scene">${entOpts(h, (e) => e.startsWith("scene."))}</datalist>
    <datalist id="au-to">${["on", "off", "home", "not_home", "open", "closed"].map((v) => `<option value="${v}">`).join("")}</datalist></div>`;
}

/** Konfiguration aus dem Formular; Fehlertext, wenn etwas fehlt */
function formConfig(F, h) {
  const name = String(F.name || "").trim();
  if (!name) return { error: "Bitte einen Namen eingeben" };
  let trigger;
  if (F.trig === "time") {
    if (!/^\d{1,2}:\d{2}$/.test(F.at || "")) return { error: "Bitte eine Uhrzeit wählen" };
    trigger = { platform: "time", at: `${F.at.padStart(5, "0")}:00` };
  } else if (F.trig === "sun") {
    const off = Math.round(Number(F.offset) || 0), a = Math.abs(off);
    trigger = { platform: "sun", event: F.sun === "sunrise" ? "sunrise" : "sunset", ...(off ? { offset: `${off < 0 ? "-" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}:00` } : {}) };
  } else {
    const e = String(F.tEnt || "").trim();
    if (!h.states[e]) return { error: "Auslöser: Entität nicht gefunden" };
    const to = String(F.tTo || "").trim();
    trigger = { platform: "state", entity_id: e, ...(to ? { to } : {}) };
  }
  let action;
  if (F.act === "notify") {
    const svc = F.notify || Object.keys((h.services && h.services.notify) || {}).sort()[0];
    if (!svc) return { error: "Kein Benachrichtigungsdienst vorhanden" };
    if (!String(F.msg || "").trim()) return { error: "Bitte einen Text für die Benachrichtigung eingeben" };
    action = { service: `notify.${svc}`, data: { message: String(F.msg).trim() } };
  } else {
    const e = String(F.aEnt || "").trim();
    if (!h.states[e]) return { error: "Aktion: Entität nicht gefunden" };
    if (F.act === "scene" && !e.startsWith("scene.")) return { error: "Bitte eine Szene wählen" };
    action = { service: F.act === "scene" ? "scene.turn_on" : `homeassistant.${F.act}`, target: { entity_id: e } };
  }
  const desc = String(F.desc || "").trim();
  return { config: { alias: name, description: desc, mode: "single", trigger: [trigger], condition: [], action: [action] } };
}

/** Anlegen über die Konfigurations-API von Home Assistant (wie der Editor); danach Liste neu laden */
async function autoCreate(p) {
  if (!FORM) return;
  const { config, error } = formConfig(FORM, p._hass);
  if (error) { p._toast(error); return; }
  const id = String(Date.now());
  try {
    await p._hass.callApi("POST", `config/automation/config/${id}`, { id, ...config });
  } catch (err) {
    p._toast(`Nicht angelegt: ${(err && (err.body && err.body.message || err.message)) || err}`);
    return;
  }
  FORM = null;
  p._toast(`Automation „${config.alias}“ angelegt`);
  await autoLoad(p, true);
  // Home Assistant lädt die Automationen nach dem Speichern neu; falls sie noch fehlt, kurz danach nochmal
  setTimeout(() => autoLoad(p, true), 1500);
}

/** Formular öffnen/schließen bzw. Feld übernehmen; Auswahl von Auslöser/Aktion baut das Formular neu auf */
function autoForm(p, open) {
  FORM = open ? newForm() : null;
  p._dirty = true; p._flush();
  if (open) { const n = p.shadowRoot.querySelector('.auform [data-auto="name"]'); if (n) n.focus(); }
}
function autoInput(p, t, e) {
  const k = t.dataset.auto;
  if (k === "search") { if (e.type === "input") autoSearch(p.shadowRoot, t.value); return; }
  if (!FORM || !(k in FORM)) return;
  FORM[k] = t.type === "number" ? Number(t.value) || 0 : t.value;
  if ((k === "trig" || k === "act") && e.type === "change") { p._dirty = true; p._flush(); }
}

function autoPageHTML(p) {
  const h = p._hass;
  autoLoad(p, false);
  const add = `<button class="pbtn" data-act="auto-form" data-open="1">${icon("mdi:plus")}Neue Automation</button>
    <button class="pbtn" data-act="nav-raw" data-path="${NEW_PATH}" title="Editor von Home Assistant mit allen Möglichkeiten">${icon("mdi:open-in-new")}Im HA-Editor</button>`;
  const form = FORM ? formHTML(h) : "";
  const items = AUTO.items;
  if (!items) return `<div class="ptitle"><h1>Automationen</h1><span class="sp"></span>${add}</div><div class="wgrid">${form}
    <div class="glass empty">${AUTO.error ? `${icon("mdi:alert")}Liste nicht geladen: ${esc(AUTO.error)}` : `${icon("mdi:loading", "spin")}Lade …`}</div></div>`;
  if (!items.length) return `<div class="ptitle"><h1>Automationen</h1><span class="sp"></span>${add}</div><div class="wgrid">${form}
    <div class="glass empty">${icon("mdi:robot-outline")}Noch keine Automationen.<br><small>„Neue Automation“ legt eine einfache an, „Im HA-Editor“ öffnet den Editor von Home Assistant.</small></div></div>`;
  const nOn = items.filter((a) => (h.states[a.entity_id] || a).state === "on").length;
  return `<div class="ptitle"><h1>Automationen</h1><span class="psub" data-u="autosum">${items.length} ${items.length === 1 ? "Automation" : "Automationen"} · ${nOn} aktiv</span><span class="sp"></span>${add}</div>
    <div class="wgrid">${form}
      <input class="inp ausearch" type="search" placeholder="Suchen (Name, Bereich, Beschreibung)" value="${esc(QUERY)}" data-auto="search" aria-label="Automationen durchsuchen">
      <div class="section glass"><div class="wlist">${items.map((a) => rowHTML(a, h)).join("")}</div>
      <p class="hint auempty"${items.some((a) => matches(a, QUERY)) ? " hidden" : ""}>Keine Automation passt zur Suche.</p></div></div>`;
}

/* ---------- Live: Zeile aus dem Zustand auffrischen ---------- */
function updateAuto(el, c) {
  const st = c._hass.states[el.dataset.eid];
  if (!st) return;
  const on = st.state === "on", unav = st.state === "unavailable";
  el.classList.toggle("on", on);
  const ic = el.querySelector(".wic ha-icon"), want = on ? "mdi:robot" : "mdi:robot-off-outline";
  if (ic && ic.getAttribute("icon") !== want) ic.setAttribute("icon", want);
  const cb = el.querySelector('input[data-act="auto-set"]');
  if (cb && !cb._busy) { cb.checked = on; cb.disabled = unav; }
  setText(el, ".aulast", unav ? "nicht verfügbar (Konfiguration fehlerhaft?)" : lastTxt(st));
}
function updateAutoSum(el, c) {
  const items = AUTO.items || [], n = items.filter((a) => (c._hass.states[a.entity_id] || a).state === "on").length;
  setText(el, null, `${items.length} ${items.length === 1 ? "Automation" : "Automationen"} · ${n} aktiv`);
}
const autoWatch = () => (AUTO.items || []).map((a) => a.entity_id);

/** Schalter: über das Backend (prüft Administrator), Zustand kommt danach live zurück */
async function autoSet(p, cb) {
  const eid = cb.dataset.eid, enabled = cb.checked, a = (AUTO.items || []).find((x) => x.entity_id === eid);
  cb._busy = true;
  try {
    await p._hass.callWS({ type: `${DOMAIN}/automation_set`, entity_id: eid, enabled });
    p._toast(`${a ? a.name : eid}: ${enabled ? "aktiviert" : "deaktiviert"}`);
  } catch (err) {
    cb.checked = !enabled;
    p._toast(`Nicht geschaltet: ${err && err.message ? err.message : err}`);
  } finally {
    cb._busy = false;
    const row = cb.closest('[data-u="auto"]');
    if (row) updateAuto(row, p);
  }
}

/** Suche: nur Zeilen ein-/ausblenden, kein Neuaufbau (Fokus bleibt im Feld) */
function autoSearch(root, value) {
  QUERY = String(value || "").trim().toLowerCase();
  let any = false;
  root.querySelectorAll(".aurow").forEach((r) => { const hit = !QUERY || r.dataset.q.includes(QUERY); r.hidden = !hit; any = any || hit; });
  const e = root.querySelector(".auempty");
  if (e) e.hidden = any;
}

export { autoCreate, autoForm, autoInput, autoLoad, autoPageHTML, autoSet, autoWatch, formConfig, updateAuto, updateAutoSum };
