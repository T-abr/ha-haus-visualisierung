/* Haus Visualisierung – Warnungen und Alarmmanager: Status-Chips, Regeln, Schimmelrisiko, Zustände aus dem Backend, Texte fürs Protokoll. */

import { BUILTIN_MODES, dc, DEFAULT_LAYOUT, dom, entIcon, entName, esc, fmtState, HOUSE_MODES, icon, isOn, isUnav, MODE_NAME, NF0, NF1, num, relTime, setIcon, setText, UNAV } from "./grundlagen.js";
import { dewPoint, humRooms, MOLD_HYST, outdoorClim, ventAdvice } from "./klima.js";

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
const sinceMin = (st) => (st && st.last_changed ? (Date.now() - Date.parse(st.last_changed)) / 60000 : 0);
function ruleMatch(st, r) {
  const v = num(st), w = parseFloat(String(r.value ?? "").replace(",", "."));
  switch (r.op) {
    case "gt": return v !== null && Number.isFinite(w) && v > w;
    case "lt": return v !== null && Number.isFinite(w) && v < w;
    case "eq": return st.state === String(r.value ?? "");
    case "ne": return st.state !== String(r.value ?? "") && !UNAV.has(st.state);
    case "off": return !isOn(st) && !UNAV.has(st.state);
    case "unavailable": return UNAV.has(st.state);
    default: return isOn(st);
  }
}
function alertWatch(m, L) {
  const r = (L.alerts && L.alerts.rules) || [];
  const garages = m.visibleAreas.flatMap((a) => a.covers);
  const locks = m.visibleAreas.flatMap((a) => a.groups.lock || []);
  const pres = m.visibleAreas.flatMap((a) => a.presence);
  // Schimmelrisiko: nur die Raumfeuchte. Temperatur und außen ändern bloß den Text; den frischt der 30-s-Takt auf.
  const hum = (L.alerts && L.alerts.builtin && L.alerts.builtin.mold === false) ? [] : m.visibleAreas.map((a) => a.humId);
  return [...m.agg.contacts, ...m.agg.safety, ...m.agg.climates, ...m.agg.batteries, ...m.agg.unavailable, ...garages, ...locks, ...pres, ...hum, ...(m._panelIds || []), ...r.map((x) => x.entity).filter(Boolean)].filter(Boolean);
}
/* Alarmmanager: Zustände aus dem Backend (neu, quittiert, stumm) und jüngstes Protokoll */
let ALARMS = null;
const setAlarms = (snap) => { ALARMS = snap && Array.isArray(snap.log) ? { ...snap, log: snap.log.slice().sort((a, b) => a.ts - b.ts) } : snap; _alertMemo = null; };
let _alertMemo = null;
/** Alle aktiven Meldungen mit Zustand (auch stumme) – für den Alarmmanager */
function evalAlertsAll(h, m, L) {
  const now = Date.now();
  if (_alertMemo && _alertMemo.s === h.states && _alertMemo.m === m && _alertMemo.L === L && _alertMemo.a === ALARMS && now - _alertMemo.t < 1000) return _alertMemo.all;
  const book = (ALARMS && ALARMS.alarms) || {};
  const all = evalAlertsRaw(h, m, L).map((x) => {
    const b = book[x.key];
    return b ? { ...x, status: b.status || "neu", since: b.since, ack_by: b.ack_by, ack_at: b.ack_at, mute_until: b.mute_until, escalated: b.escalated } : { ...x, status: "neu" };
  });
  const list = all.filter((x) => x.status !== "stumm");
  _alertMemo = { s: h.states, m, L, a: ALARMS, t: now, all, list };
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
const alarmPanels = (h, m) => m._panels || [];
function evalAlertsRaw(h, m, L) {
  const c = L.alerts || DEFAULT_LAYOUT.alerts, out = [];
  const mode = curMode();
  const modeOk = (k) => ((c.modes && c.modes[k] && c.modes[k].length ? c.modes[k] : BUILTIN_MODES[k]) || HOUSE_MODES.map((x) => x[0])).includes(mode);
  const B = Object.fromEntries(Object.entries(c.builtin || {}).map(([k, v]) => [k, v && modeOk(k)]));
  const nm = (e) => { const a = m.eidArea.get(e); return `${a ? `${a.name} · ` : ""}${entName(h, e, a)}`; };
  const heatingArea = (a) => a && a.climates.some((x) => h.states[x] && h.states[x].attributes.hvac_action === "heating");
  // „Erst melden nach … Minuten“ gilt auch für „Fenster offen beim Heizen“
  const openLong = (e) => isOn(h.states[e]) && sinceMin(h.states[e]) >= (c.contacts_min || 0);
  if (B.contacts) for (const e of m.agg.contacts) {
    const st = h.states[e];
    if (B.window_heating && heatingArea(m.eidArea.get(e))) continue; // steckt schon in „Fenster offen beim Heizen“
    if (openLong(e)) out.push({ key: `contact:${e}`, level: "warn", icon: entIcon(h, st), title: `${nm(e)} offen`, detail: `seit ${relTime(st.last_changed).replace(/^vor /, "")}`, eid: e });
  }
  if (B.window_heating) for (const a of m.visibleAreas) {
    if (a.contacts.some(openLong) && a.climates.some((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating"))
      out.push({ key: `heat:${a.id}`, level: "warn", icon: "mdi:radiator-disabled", title: `Fenster offen beim Heizen · ${a.name}`, detail: `${a.contacts.filter(openLong).map((e) => entName(h, e, a)).join(", ")} offen – Heizung läuft dagegen`, to: `raum/${a.id}` });
  }
  if (B.safety) for (const e of m.agg.safety) {
    const st = h.states[e];
    if (dom(e) === "alarm_control_panel") continue; // eigene Regel „Alarmanlage ausgelöst“
    if (isOn(st)) out.push({ key: `safety:${e}`, level: "alarm", icon: entIcon(h, st), title: nm(e), detail: fmtState(h, st), eid: e });
  }
  if (B.alarm_panel) for (const e of alarmPanels(h, m)) {
    const st = h.states[e];
    if (st && st.state === "triggered") out.push({ key: `alarmpanel:${e}`, level: "alarm", icon: "mdi:alarm-light", title: `${st.attributes.friendly_name || e} ausgelöst`, detail: "Alarmanlage", eid: e });
  }
  if (B.presence_away) for (const a of m.visibleAreas) for (const e of a.presence) {
    const st = h.states[e];
    if (isOn(st)) out.push({ key: `presence:${e}`, level: "alarm", icon: "mdi:motion-sensor", title: `${/beweg|präsenz|praesenz|motion|presence|anwesen/i.test(entName(h, e, a)) ? a.name : nm(e)}: Bewegung erkannt`, detail: `während Hausmodus ${MODE_NAME[mode]}`, eid: e, to: `raum/${a.id}` });
  }
  if (B.locks) for (const a of m.visibleAreas) for (const e of a.groups.lock || []) {
    const st = h.states[e];
    if (isOn(st)) out.push({ key: `lock:${e}`, level: "warn", icon: "mdi:lock-open-variant", title: `${nm(e)} entriegelt`, detail: relTime(st.last_changed), eid: e });
  }
  if (B.garage) for (const a of m.visibleAreas) for (const e of a.covers) {
    const st = h.states[e];
    if (["garage", "gate"].includes(dc(st)) && isOn(st)) out.push({ key: `garage:${e}`, level: "warn", icon: entIcon(h, st), title: `${nm(e)} offen`, detail: relTime(st.last_changed), eid: e });
  }
  if (B.battery) {
    const crit = m.agg.batteries.filter((e) => { const st = h.states[e]; if (dom(e) === "binary_sensor") return isOn(st); const v = num(st); return v !== null && v < L.battery_critical; });
    if (crit.length === 1) out.push({ key: "battery", level: "warn", icon: "mdi:battery-alert-variant-outline", title: `${nm(crit[0])} fast leer`, detail: fmtState(h, h.states[crit[0]]), to: "batterien" });
    else if (crit.length) out.push({ key: "battery", level: "warn", icon: "mdi:battery-alert-variant-outline", title: `${crit.length} Batterien fast leer`, detail: `unter ${L.battery_critical} %`, to: "batterien" });
  }
  if (B.offline) {
    const n = m.agg.unavailable.filter((e) => isUnav(h.states[e])).length;
    if (n) out.push({ key: "offline", level: "info", icon: "mdi:lan-disconnect", title: `${n} ${n === 1 ? "Gerät" : "Geräte"} nicht erreichbar`, detail: "" });
  }
  if (B.mold) out.push(...moldAlerts(h, m, L, c));
  else MOLD.clear();
  (c.rules || []).forEach((r, i) => {
    if (r.enabled === false || !r.entity) return;
    if (r.modes && r.modes.length && !r.modes.includes(mode)) return;
    const st = h.states[r.entity];
    if (!st || !ruleMatch(st, r) || (r.minutes && sinceMin(st) < r.minutes)) return;
    out.push({ key: `rule:${i}:${r.entity}`, level: r.level || "warn", icon: entIcon(h, st), title: r.title || nm(r.entity), detail: fmtState(h, st), eid: r.entity });
  });
  return out.sort((x, y) => LEVELS[y.level] - LEVELS[x.level]);
}
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


/* Schimmelrisiko: Raumfeuchte ab der Grenze (Standard 65 %) für mindestens … Minuten (Standard 30).
   Rückfall erst 3 Prozentpunkte darunter. Während ein Fenster des Raums offen ist, wird schon gelüftet: keine Meldung. */
const MOLD = new Map();
function moldAlerts(h, m, L, c) {
  const now = Date.now(), limit = c.mold_hum || 65, wait = (c.mold_min ?? 30) * 60000, book = (ALARMS && ALARMS.alarms) || {}, out = [];
  const o = outdoorClim(h, m), seen = new Set();
  for (const a of humRooms(m)) {
    const key = `mold:${a.id}`, rh = num(h.states[a.humId]), t = num(h.states[a.tempId]);
    const prev = MOLD.get(a.id), active = (prev && prev.on) || !!book[key];
    if (rh === null || !(rh >= limit || (active && rh > limit - MOLD_HYST))) continue;
    const since = prev ? prev.since : now, on = active || now - since >= wait;
    MOLD.set(a.id, { since, on }); seen.add(a.id);
    if (!on || a.contacts.some((e) => isOn(h.states[e]))) continue;
    const dp = dewPoint(t, rh), adv = t !== null ? ventAdvice(t, rh, o.t, o.rh) : null;
    out.push({ key, level: "warn", icon: "mdi:water-alert", title: `Schimmelrisiko · ${a.name}`,
      detail: `${NF0.format(rh)} %${t !== null ? ` bei ${NF1.format(t)}°` : ""}${dp !== null ? ` · Taupunkt ${NF1.format(dp)}°` : ""} – ${adv && adv.k === "nicht" ? "draußen feuchter, besser heizen oder entfeuchten" : "jetzt lüften"}`,
      eid: a.humId, to: `raum/${a.id}` });
  }
  for (const id of [...MOLD.keys()]) if (!seen.has(id)) MOLD.delete(id);
  return out;
}

export { ALARMO_TXT, ALARMS, alertsByArea, alertsCardHTML, alertWatch, CHIP_WATCH, CHIPS, clockOf, curMode, dayOf, durTxt, evalAlerts, evalAlertsAll, LEVEL_ICON, LEVEL_TXT, LEVELS, logRow, MOLD, navBadge, setAlarms, sinceTs, statusTxt, updateAlerts };
