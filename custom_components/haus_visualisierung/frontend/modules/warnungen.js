/* Haus Visualisierung – Warnungen und Alarmmanager: Status-Chips, aktive Meldungen aus dem Backend (alerts.py), Texte fürs Protokoll.
   Die Warnregeln stehen nur im Backend; hier wird nur angezeigt. */

import { dom, entIcon, entName, esc, fmtState, icon, isOn, isUnav, MODE_NAME, NF1, num, relTime, setIcon, setText } from "./grundlagen.js";

const CHIPS = {
  lights: (h, m) => { const n = m.agg.lights.filter((e) => isOn(h.states[e])).length; return m.agg.lights.length ? { t: n ? `${n} ${n === 1 ? "Licht" : "Lichter"} an` : "Alle Lichter aus", c: n ? "warm" : "calm", i: n ? "mdi:lightbulb-on" : "mdi:lightbulb-outline" } : null; },
  contacts: (h, m) => { const n = m.agg.contacts.filter((e) => isOn(h.states[e])).length; return m.agg.contacts.length ? { t: n ? `${n} offen` : "Fenster & Türen zu", c: n ? "alert" : "ok", i: n ? "mdi:window-open-variant" : "mdi:window-closed-variant" } : null; },
  covers: (h, m) => { const n = m.agg.covers.filter((e) => isOn(h.states[e])).length; return m.agg.covers.length ? { t: n ? `${n} ${n === 1 ? "Rollo" : "Rollos"} offen` : "Alle Rollos zu", c: "calm", i: n ? "mdi:window-shutter-open" : "mdi:window-shutter" } : null; },
  temp: (h, m) => { const v = m.agg.temps.map((e) => num(h.states[e])).filter((x) => x !== null); return v.length ? { t: `Ø ${NF1.format(v.reduce((a, b) => a + b, 0) / v.length)} °C innen`, c: "calm", i: "mdi:home-thermometer" } : null; },
  heat: (h, m) => { const n = m.agg.climates.filter((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating").length; return n ? { t: `${n} ${n === 1 ? "Raum heizt" : "Räume heizen"}`, c: "heat", i: "mdi:fire" } : null; },
  safety: (h, m) => { const on = m.agg.safety.filter((e) => isOn(h.states[e])); return on.length ? { t: on.length === 1 ? `${entName(h, on[0])}` : `${on.length} Meldungen`, c: "alert", i: "mdi:alarm-light" } : null; },
  batt: (h, m, L) => {
    let crit = 0, low = 0;
    for (const e of m.agg.batteries) {
      const st = h.states[e];
      if (dom(e) === "binary_sensor") { if (isOn(st)) crit++; continue; }
      const v = num(st);
      if (v === null) continue;
      if (v < L.battery_critical) crit++; else if (v < L.battery_low) low++;
    }
    const n = crit + low;
    return n ? { t: `${n} ${n === 1 ? "Batterie" : "Batterien"} schwach`, c: crit ? "alert" : "warm", i: "mdi:battery-alert-variant-outline" } : null;
  },
  unav: (h, m) => { const n = m.agg.unavailable.filter((e) => isUnav(h.states[e])).length; return n ? { t: `${n} nicht erreichbar`, c: "dim", i: "mdi:lan-disconnect" } : null; },
};
CHIPS.contactsAlert = (h, m) => { const r = CHIPS.contacts(h, m); return r && r.c === "alert" ? r : null; };
const CHIP_WATCH = { lights: "lights", contacts: "contacts", contactsAlert: "contacts", covers: "covers", temp: "temps", heat: "climates", safety: "safety", batt: "batteries", unav: "unavailable" };

/* ---------- Warnungen ---------- */
const LEVELS = { alarm: 3, warn: 2, info: 1 };
/* Entitäten, deren Zustand im Untertitel einer Meldung stehen kann (fmt "state") – ob eine Meldung aktiv ist,
   entscheidet das Backend und schickt es über das Alarmmanager-Abo. */
function alertWatch(m, L) {
  const r = (L.alerts && L.alerts.rules) || [];
  return [...m.agg.safety, ...(m._panelIds || []), ...r.map((x) => x.entity)].filter(Boolean);
}
/* Alarmmanager: aktive Meldungen mit Zustand (neu, quittiert, stumm) und jüngstes Protokoll */
let ALARMS = null;
const setAlarms = (snap) => { ALARMS = snap && Array.isArray(snap.log) ? { ...snap, log: snap.log.slice().sort((a, b) => a.ts - b.ts) } : snap; _alertMemo = null; };
let _alertMemo = null;
const tsIso = (ts) => new Date(ts * 1000).toISOString();
/* Untertitel: Zustand bzw. Zeit live aus hass, sonst der Text des Backends */
function alertDetail(h, b) {
  const st = b.eid ? h.states[b.eid] : null;
  if (b.fmt === "state") return st ? fmtState(h, st) : b.detail || "";
  if (b.fmt === "since" || b.fmt === "ago") {
    const at = b.ts ? tsIso(b.ts) : st && st.last_changed;
    if (!at) return b.detail || "";
    const rel = relTime(at);
    return [b.fmt === "since" ? `seit ${rel.replace(/^vor /, "")}` : rel, b.detail].filter(Boolean).join(" · ");
  }
  return b.detail || "";
}
/** Alle aktiven Meldungen mit Zustand (auch stumme) – für den Alarmmanager */
function evalAlertsAll(h, m, L) {
  const now = Date.now();
  if (_alertMemo && _alertMemo.s === h.states && _alertMemo.a === ALARMS && now - _alertMemo.t < 1000) return _alertMemo.all;
  const book = (ALARMS && ALARMS.alarms) || {};
  const keys = (ALARMS && Array.isArray(ALARMS.active)) ? ALARMS.active : Object.keys(book);
  const all = keys.map((k) => book[k]).filter(Boolean).map((b) => {
    const st = b.eid ? h.states[b.eid] : null;
    return { key: b.key, level: b.level || "warn", icon: b.icon || (st ? entIcon(h, st) : "mdi:bell-alert"), title: b.title || b.key,
      detail: alertDetail(h, b), eid: b.eid || undefined, to: b.to || undefined,
      status: b.status || "neu", since: b.since, ack_by: b.ack_by, ack_at: b.ack_at, mute_until: b.mute_until, escalated: b.escalated };
  }).sort((x, y) => (LEVELS[y.level] || 0) - (LEVELS[x.level] || 0));
  const list = all.filter((x) => x.status !== "stumm");
  _alertMemo = { s: h.states, a: ALARMS, t: now, all, list };
  return all;
}
/** Aktive Meldungen ohne stumme – für Warnkarte, Kopfzeile und Aktiv-Fokus */
function evalAlerts(h, m, L) { evalAlertsAll(h, m, L); return _alertMemo.list; }
/* Warnungen je Raum: über die Entität oder den Verweis auf die Raumseite */
function alertsByArea(h, m, L) {
  const map = new Map();
  for (const al of evalAlerts(h, m, L)) {
    const a = al.eid ? m.eidArea.get(al.eid) : al.to && al.to.startsWith("raum/") ? m.areas.get(al.to.slice(5)) : null;
    if (!a) continue;
    if (!map.has(a.id)) map.set(a.id, []);
    map.get(a.id).push(al);
  }
  return map;
}
const curMode = () => (ALARMS && ALARMS.mode && ALARMS.mode.mode) || "zuhause";
CHIPS.alerts = (h, m, L) => {
  const l = evalAlerts(h, m, L).filter((a) => a.level !== "info");
  return l.length ? { t: l.length === 1 ? l[0].title : `${l.length} Meldungen (${l.filter((a) => a.level === "alarm").length} Alarm)`.replace(" (0 Alarm)", ""), c: l.some((a) => a.level === "alarm") ? "alert" : "warmalert", i: l.some((a) => a.level === "alarm") ? "mdi:alarm-light" : "mdi:bell-alert" } : null;
};

const alertsCardHTML = (cls = "") => `<div class="glass acard ok ${cls}" data-u="alerts"><button class="ahead"><span class="ssic">${icon("mdi:shield-check")}</span><span class="ah"><span class="sst"></span><span class="ssd"></span></span></button><div class="alist"></div></div>`;

function updateAlerts(el, ctx) {
  const all = evalAlertsAll(ctx._hass, ctx._model, ctx._layout);
  const list = all.filter((a) => a.status !== "stumm"), muted = all.length - list.length;
  const top = list[0], lvl = top ? top.level : "ok";
  for (const k of ["ok", "alarm", "warn", "info"]) el.classList.toggle(k, k === lvl);
  el.classList.toggle("acked", !!list.length && list.every((a) => a.status === "quittiert"));
  setIcon(el, ".ssic ha-icon", lvl === "ok" ? "mdi:shield-check" : lvl === "alarm" ? "mdi:alarm-light" : lvl === "warn" ? "mdi:shield-alert" : "mdi:information-outline");
  const warns = list.filter((a) => a.level !== "info").length;
  const cnt = (lv) => list.filter((x) => x.level === lv).length;
  const parts = [[cnt("alarm"), "Alarm", "Alarme"], [cnt("warn"), "Warnung", "Warnungen"], [cnt("info"), "Hinweis", "Hinweise"]].filter(([n]) => n).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  setText(el, ".sst", !list.length ? "Alles in Ordnung" : list.length === 1 ? top.title : parts.join(" · "));
  const sub = (a) => a.status === "quittiert" ? `quittiert${a.ack_by ? ` von ${a.ack_by}` : ""}` : a.detail || "";
  setText(el, ".ssd", !list.length ? (muted ? `${muted} stumm geschaltet` : "Keine Warnungen aktiv") : list.length === 1 ? sub(top) : "");
  const head = el.querySelector(".ahead");
  if (head) {
    // Kopf öffnet immer den Alarmmanager (bei einer Meldung direkt mit ihr ausgewählt)
    head.dataset.act = "al-open-page";
    if (list.length === 1) head.dataset.key = top.key; else delete head.dataset.key;
    head.title = "Alarmmanager öffnen";
  }
  const html = (list.length > 1 ? list.slice(0, 8).map((a) => `<button class="aitem ${a.level}${a.status === "quittiert" ? " acked" : ""}" data-act="al-open-page" data-key="${esc(a.key)}">${icon(a.icon)}<span class="at">${esc(a.title)}</span><span class="ad">${esc(sub(a))}</span></button>`).join("")
    + (list.length > 8 ? `<div class="amore">und ${list.length - 8} weitere</div>` : "") : "")
    + (muted && list.length ? `<button class="amore amute" data-act="al-open-page">${icon("mdi:bell-off-outline")}${muted} stumm geschaltet</button>` : "");
  const lst = el.querySelector(".alist");
  if (lst && lst._h !== html) { lst.innerHTML = html; lst._h = html; }
}

/* ------------------------------------------------------------------------ */
/*  Alarmmanager                                                             */
/* ------------------------------------------------------------------------ */
const LEVEL_TXT = { alarm: "Alarm", warn: "Warnung", info: "Hinweis" };
const LEVEL_ICON = { alarm: "mdi:alarm-light", warn: "mdi:shield-alert", info: "mdi:information-outline" };
const ALARMO_TXT = { disarmed: "unscharf", armed_home: "scharf · zuhause", armed_away: "scharf · abwesend", armed_night: "scharf · Nacht",
  armed_vacation: "scharf · Urlaub", armed_custom_bypass: "scharf · eigene", arming: "wird scharf …", pending: "Eingangsverzögerung", triggered: "ALARM ausgelöst" };
const clockOf = (ts) => new Date(ts * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
function dayOf(ts) {
  const d = new Date(ts * 1000), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return diff === 0 ? "Heute" : diff === 1 ? "Gestern" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function durTxt(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? `${h} Std.${r ? ` ${r} Min.` : ""}` : `${Math.floor(h / 24)} T. ${h % 24} Std.`;
}
function muteTxt(until) {
  if (!until) return "stumm bis behoben";
  const d = new Date(until * 1000), now = new Date();
  return `stumm bis ${d.toDateString() === now.toDateString() ? "" : "morgen "}${clockOf(until)}`;
}
function statusTxt(a) {
  if (a.status === "quittiert") return `quittiert${a.ack_by ? ` von ${a.ack_by}` : ""}${a.ack_at ? ` · ${clockOf(a.ack_at)}` : ""}`;
  if (a.status === "stumm") return muteTxt(a.mute_until);
  return "neu";
}
function sinceTs(h, a) {
  if (a.since) return a.since;
  const st = a.eid && h.states[a.eid];
  return st ? new Date(st.last_changed).getTime() / 1000 : Date.now() / 1000;
}
const LOG_ICON = { eskaliert: "mdi:alarm-light-outline", aktion: "mdi:lightning-bolt-outline", modus: "mdi:home-switch-outline", hinweis: "mdi:alert-outline", neu: null, quittiert: "mdi:check", stumm: "mdi:bell-off-outline", stumm_aus: "mdi:bell-outline", stumm_ende: "mdi:bell-ring-outline", behoben: "mdi:check-circle-outline" };
function logTxt(e) {
  switch (e.type) {
    case "neu": return `${LEVEL_TXT[e.level] || "Meldung"} aufgetreten`;
    case "quittiert": return `quittiert${e.user ? ` von ${e.user}` : ""}`;
    case "stumm": return `${muteTxt(e.until)}${e.user ? ` · ${e.user}` : ""}`;
    case "stumm_aus": return `Stummschaltung aufgehoben${e.user ? ` · ${e.user}` : ""}`;
    case "stumm_ende": return "Stummschaltung abgelaufen, wieder offen";
    case "behoben": return `behoben${e.dur != null ? ` nach ${durTxt(e.dur)}` : ""}`;
    case "eskaliert": return `eskaliert – ${e.minutes || "?"} Min. nicht quittiert`;
    case "aktion": return `${e.text || "Aktion ausgeführt"}${e.test ? " (Test)" : ""}`;
    case "modus": return `${e.previous ? `vorher ${MODE_NAME[e.previous] || e.previous} · ` : ""}${e.user || "Automatik"}`;
    case "hinweis": return e.detail || "";
    default: return e.type;
  }
}
const logRow = (e, withTitle = true) => `<div class="lgrow ${esc(e.type)} ${esc(e.level || "")}"><span class="lgt">${clockOf(e.ts)}</span>${icon(LOG_ICON[e.type] || LEVEL_ICON[e.level] || "mdi:bell")}<span class="lgx">${withTitle ? `<b>${esc(e.title || "")}</b>` : ""}<span>${esc(logTxt(e))}</span></span></div>`;
function navBadge(el, ctx) {
  const n = evalAlerts(ctx._hass, ctx._model, ctx._layout).filter((a) => a.status === "neu" && a.level !== "info");
  const al = n.some((a) => a.level === "alarm");
  el.textContent = n.length ? String(n.length) : "";
  el.classList.toggle("on", n.length > 0);
  el.classList.toggle("alarm", al);
}


export { ALARMO_TXT, ALARMS, alertsByArea, alertsCardHTML, alertWatch, CHIP_WATCH, CHIPS, clockOf, curMode, dayOf, durTxt, evalAlerts, evalAlertsAll, LEVEL_ICON, LEVEL_TXT, LEVELS, logRow, navBadge, setAlarms, sinceTs, statusTxt, updateAlerts };
