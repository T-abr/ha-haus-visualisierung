/* Haus Visualisierung – Wartungsplaner: wiederkehrende Aufgaben mit Intervall und Fälligkeit, Seite „Wartung“,
 * Hinweise für die Meldungen und der Abschnitt in den Einstellungen (Technik).
 * Die Aufgaben stehen im Layout (maintenance.tasks), wann sie erledigt wurden, schickt das Backend getrennt (MAINT). */

import { DOMAIN } from "./version.js";
import { esc, icon } from "./grundlagen.js";

/** {Aufgaben-ID: {last, by, history}} aus dem Backend (Abo …/subscribe, Feld „maintenance“) */
let MAINT = {};
const setMaint = (s) => { MAINT = s && typeof s === "object" ? s : {}; };

const UNITS = [["tage", "Tag", "Tage"], ["wochen", "Woche", "Wochen"], ["monate", "Monat", "Monate"], ["jahre", "Jahr", "Jahre"]];
const EVERY = { tage: "täglich", wochen: "wöchentlich", monate: "monatlich", jahre: "jährlich" };
/* Vorlagen: [Schlüssel, Titel, Symbol, Intervall, Einheit] */
const TEMPLATES = [
  ["filter", "Lüftungsfilter wechseln", "mdi:air-filter", 6, "monate"],
  ["rauch", "Rauchmelder testen", "mdi:smoke-detector-variant", 12, "monate"],
  ["kamin", "Kaminkehrer", "mdi:fireplace", 12, "monate"],
  ["heizung", "Heizungswartung", "mdi:water-boiler", 12, "monate"],
  ["wasser", "Wasserfilter tauschen", "mdi:water-check-outline", 6, "monate"],
  ["batterie", "Batterien tauschen", "mdi:battery-sync-outline", 12, "monate"],
  ["auto", "Auto / Wallbox prüfen", "mdi:ev-station", 12, "monate"],
];

/* ---------- Datum (lokal, ohne Uhrzeit) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDay(new Date());
function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const fmtDay = (s) => { const d = parseDay(s); return d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; };
const dayDiff = (a, b) => Math.round((parseDay(a) - parseDay(b)) / 86400000);
/** Datum plus Intervall; Monate und Jahre bleiben am selben Tag (31. → Monatsende), wie maintenance.py */
function addInterval(s, n, unit) {
  const d = parseDay(s);
  if (!d) return "";
  if (unit === "tage" || unit === "wochen") { d.setDate(d.getDate() + n * (unit === "wochen" ? 7 : 1)); return isoDay(d); }
  const months = d.getMonth() + n * (unit === "jahre" ? 12 : 1), y = d.getFullYear() + Math.floor(months / 12), m = months % 12;
  return isoDay(new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate())));
}

/* ---------- Fälligkeit ---------- */
const maintOn = (L) => !!(L.maintenance && L.maintenance.enabled !== false && (L.maintenance.tasks || []).length);
/** Zuletzt erledigt: das spätere von „Erledigt“ und dem Datum aus den Einstellungen */
function lastDone(t) {
  const s = MAINT[t.id] || {}, a = parseDay(s.last) ? s.last : "", b = parseDay(t.since) ? t.since : "";
  return a > b ? { date: a, by: s.by || "" } : { date: b, by: b && b === a ? s.by || "" : "" };
}
function taskInfo(t, L, now = today()) {
  const last = lastDone(t), n = Math.max(1, Number(t.interval) || 1), unit = t.unit || "monate";
  const due = last.date ? addInterval(last.date, n, unit) : "";
  const days = due ? dayDiff(due, now) : null;
  const lead = (L.maintenance && L.maintenance.lead_days) ?? 14;
  const status = days === null || days <= 0 ? "due" : days <= lead ? "soon" : "ok";
  const span = due ? dayDiff(due, last.date) : 0;
  const frac = !due ? 1 : span > 0 ? Math.min(1, Math.max(0, 1 - days / span)) : 1;
  const s = MAINT[t.id] || {};
  return { t, last, due, days, status, frac, undo: s.last === now && (s.history || []).length > 0 };
}
const intervalTxt = (t) => {
  const n = Math.max(1, Number(t.interval) || 1), u = UNITS.find(([k]) => k === t.unit) || UNITS[2];
  return n === 1 ? EVERY[u[0]] : `alle ${n} ${u[2]}`;
};
function dueTxt(i) {
  if (i.days === null) return "noch nie erledigt";
  if (i.days === 0) return "heute fällig";
  if (i.days < 0) return `seit ${-i.days} ${i.days === -1 ? "Tag" : "Tagen"} fällig`;
  if (i.days === 1) return `morgen fällig · ${fmtDay(i.due)}`;
  return `fällig in ${i.days} Tagen · ${fmtDay(i.due)}`;
}
const maintList = (L) => (maintOn(L) ? L.maintenance.tasks.map((t) => taskInfo(t, L)) : [])
  .sort((a, b) => (a.days ?? -1e9) - (b.days ?? -1e9) || String(a.t.title).localeCompare(String(b.t.title), "de"));
const maintDueCount = (L) => maintList(L).filter((i) => i.status === "due").length;

/* ---------- Seite „Wartung“ ---------- */
function rowHTML(i) {
  const t = i.t, last = i.last.date ? `zuletzt ${fmtDay(i.last.date)}${i.last.by ? ` · ${esc(i.last.by)}` : ""}` : "";
  return `<div class="wrow ${i.status}" data-task="${esc(t.id)}">
    <span class="wic">${icon(t.icon || "mdi:wrench-clock")}</span>
    <span class="wtx"><b>${esc(t.title || "Aufgabe")}</b><small class="wdue">${esc(dueTxt(i))}</small>
      <small>${esc(intervalTxt(t))}${last ? ` · ${last}` : ""}</small>${t.note ? `<small class="wnote">${esc(t.note)}</small>` : ""}
      <span class="wbar"><i style="width:${Math.round(i.frac * 100)}%"></i></span></span>
    <span class="wbtns">${i.undo ? `<button class="pbtn sm" data-act="wt-undo" data-task="${esc(t.id)}" title="Letztes „Erledigt“ zurücknehmen">${icon("mdi:undo")}<span>Rückgängig</span></button>` : ""}
      <button class="pbtn wdone" data-act="wt-done" data-task="${esc(t.id)}">${icon("mdi:check")}<span>Erledigt</span></button></span></div>`;
}
function maintPageHTML(L, isAdmin) {
  const edit = isAdmin ? `<button class="pbtn" data-act="go" data-to="einstellungen/technik">${icon("mdi:pencil")}Aufgaben bearbeiten</button>` : "";
  const list = maintList(L);
  if (!list.length) return `<div class="ptitle"><h1>Wartung</h1><span class="sp"></span>${edit}</div>
    <div class="glass empty">${icon("mdi:wrench-clock")}Noch keine Wartungsaufgaben.<br><small>Anlegen unter Einstellungen → Technik → Wartungsplaner, z. B. Lüftungsfilter, Rauchmelder oder Kaminkehrer.</small></div>`;
  const due = list.filter((i) => i.status === "due"), soon = list.filter((i) => i.status === "soon"), ok = list.filter((i) => i.status === "ok");
  const sec = (title, ic, items, cls = "") => items.length ? `<div class="section glass wsec ${cls}"><div class="shead${cls === "due" ? " alert" : ""}">${icon(ic)}<span class="st">${title}</span><span class="gc">${items.length}</span></div>
    <div class="wlist">${items.map(rowHTML).join("")}</div></div>` : "";
  return `<div class="ptitle"><h1>Wartung</h1><span class="psub">${list.length} ${list.length === 1 ? "Aufgabe" : "Aufgaben"}${due.length ? ` · ${due.length} fällig` : " · nichts fällig"}</span><span class="sp"></span>${edit}</div>
    <div class="wgrid">${sec("Fällig", "mdi:wrench-clock", due, "due")}${sec("Demnächst", "mdi:calendar-clock", soon, "soon")}${sec("Später", "mdi:calendar-check", ok)}</div>`;
}

/** Erledigt (heute) bzw. letztes Erledigt zurücknehmen; das Backend schickt den neuen Stand auch an andere Geräte */
async function maintCall(p, task, undo) {
  const t = ((p._layout.maintenance || {}).tasks || []).find((x) => x.id === task);
  try {
    const r = await p._hass.callWS({ type: `${DOMAIN}/maintenance_done`, task, ...(undo ? { undo: true } : {}) });
    setMaint(r && r.maintenance);
    p._dirty = true; p._flush();
    const i = t && taskInfo(t, p._layout);
    p._toast(undo ? `Zurückgenommen: ${t ? t.title : task}` : `Erledigt: ${t ? t.title : task}${i && i.due ? ` · nächstes Mal ${fmtDay(i.due)}` : ""}`);
  } catch (err) { p._toast(`Nicht gespeichert: ${err && err.message ? err.message : err}`); }
}

/* ---------- Einstellungen → Technik ---------- */
function newTask(tpl) {
  const T = TEMPLATES.find(([k]) => k === tpl);
  // Startdatum heute: eine neue Aufgabe ist nicht sofort fällig; das Datum lässt sich anpassen
  return { id: `w${Date.now().toString(36)}`, title: T ? T[1] : "", icon: T ? T[2] : "mdi:wrench-clock", interval: T ? T[3] : 12, unit: T ? T[4] : "monate", since: today(), note: "" };
}
function maintSettingsHTML(D) {
  const M = D.maintenance || { enabled: true, lead_days: 14, tasks: [] };
  const rows = (M.tasks || []).map((t, i) => {
    const p = `maintenance.tasks.${i}`, s = MAINT[t.id] || {};
    const done = parseDay(s.last) && s.last > (t.since || "") ? `<span class="rl" title="auf der Seite Wartung als erledigt markiert">erledigt ${fmtDay(s.last)}</span>` : "";
    return `<div class="rule wtask">
      <span class="wsi">${icon(t.icon || "mdi:wrench-clock")}</span>
      <input class="inp" style="flex:1 1 200px" data-set="${p}.title" value="${esc(t.title)}" placeholder="Titel, z. B. Lüftungsfilter wechseln">
      <span class="rl">alle</span><input class="inp s" type="number" min="1" max="120" data-set="${p}.interval" data-num="1" value="${Number(t.interval) || 12}">
      <select class="inp" data-set="${p}.unit">${UNITS.map(([k, , many]) => `<option value="${k}" ${(t.unit || "monate") === k ? "selected" : ""}>${many}</option>`).join("")}</select>
      <span class="rl">zuletzt</span><input class="inp" type="date" data-set="${p}.since" value="${esc(t.since || "")}" title="Zuletzt erledigt (vor dem Wartungsplaner); ab hier zählt das Intervall">${done}
      <button class="sbtn danger" data-act="s-wt-del" data-i="${i}" title="Löschen">${icon("mdi:delete-outline")}</button>
      <input class="inp" style="flex:1 1 160px" data-set="${p}.icon" value="${esc(t.icon || "")}" placeholder="mdi:wrench-clock" title="Symbol">
      <input class="inp" style="flex:3 1 240px" data-set="${p}.note" value="${esc(t.note || "")}" placeholder="Notiz, z. B. Filter F7, 2 Stück, Firma Müller"></div>`;
  }).join("");
  return `<div class="set glass"><h2>${icon("mdi:wrench-clock")}Wartungsplaner</h2>
    <p class="hint">Wiederkehrende Aufgaben wie Lüftungsfilter, Rauchmelder testen, Kaminkehrer oder Heizungswartung. Die Seite „Wartung“ zeigt, was fällig ist; „Erledigt“ setzt das nächste Datum und darf jeder Benutzer drücken. Fällige Aufgaben erscheinen als <b>Hinweis</b> in den Meldungen (Alarme → Feste Regeln → „Wartung fällig“) und, wenn eingestellt, als Push.</p>
    <div class="srow"><span class="lbl">Wartungsplaner<small>Seite „Wartung“ in der Navigation, sobald es Aufgaben gibt</small></span><label class="tgl"><input type="checkbox" data-set="maintenance.enabled" data-bool="1" ${M.enabled !== false ? "checked" : ""}><span></span></label></div>
    <div class="srow"><span class="lbl">Demnächst<small>Tage vor der Fälligkeit, ab denen eine Aufgabe oben unter „Demnächst“ steht</small></span><input class="inp s" type="number" min="0" max="90" data-set="maintenance.lead_days" data-num="1" value="${M.lead_days ?? 14}"></div>
    <div class="fl-title">Aufgaben</div>
    ${rows || '<p class="hint">Noch keine Aufgaben. Eine Vorlage wählen oder eine eigene Aufgabe anlegen.</p>'}
    <div class="srow"><button class="pbtn" data-act="s-wt-add">${icon("mdi:plus")}Aufgabe hinzufügen</button>
      <span class="lbl" style="flex:0 0 auto;min-width:0"><small>Vorlagen:</small></span>
      ${TEMPLATES.map(([k, title, ic]) => `<button class="pbtn sm" data-act="s-wt-tpl" data-tpl="${k}">${icon(ic)}${esc(title)}</button>`).join("")}</div></div>`;
}

export { addInterval, MAINT, maintCall, maintDueCount, maintOn, maintPageHTML, maintSettingsHTML, newTask, setMaint, taskInfo };
