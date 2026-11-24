/* Nachgebaute Warnregeln des Backends (alerts.py) für die Testumgebung.
   Das Panel rechnet keine Warnungen mehr selbst; das Mock-Backend wertet nach jeder Zustandsänderung aus
   und legt die aktiven Meldungen wie AlarmBook.sync (alarms.py) in den Alarm-Schnappschuss. */

import { BUILTIN_MODES, dc, DEFAULT_LAYOUT, dom, entName, HOUSE_MODES, isOn, isUnav, MODE_NAME, NF0, NF1, num, UNAV } from "./modules/grundlagen.js";
import { dewPoint, humRooms, MOLD_HYST, outdoorClim, ventAdvice } from "./modules/klima.js";
import { applList } from "./modules/geraete.js";
import { maintOn, taskInfo } from "./modules/wartung.js";

const LEVELS = { alarm: 3, warn: 2, info: 1 };
const WETTER = "sensor.haus_wetter";
const sinceMin = (st) => (st && st.last_changed ? (Date.now() - Date.parse(st.last_changed)) / 60000 : 0);
const fmt = (st) => {
  const v = num(st), u = st.attributes.unit_of_measurement;
  if (v !== null) { const t = String(Math.round(v * 10) / 10).replace(".", ","); return u ? `${t} ${u}` : t; }
  return { on: "an", off: "aus", unavailable: "nicht erreichbar", unknown: "unbekannt" }[st.state] || st.state;
};
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

/* Schimmelrisiko wie _mold_alerts: Zeitpunkt über der Grenze je Raum (Tests schieben ihn zurück) */
export const MOLD = new Map();
function moldAlerts(h, m, c, book) {
  const now = Date.now(), limit = c.mold_hum || 65, wait = (c.mold_min ?? 30) * 60000, out = [];
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

/** Aktive Meldungen im Format von AlarmBook (alarms.py): key, level, title, detail, icon, eid, to, fmt, ts */
export function evaluate(h, m, L, mode, book) {
  const c = L.alerts || DEFAULT_LAYOUT.alerts, out = [];
  const modeOk = (k) => ((c.modes && c.modes[k] && c.modes[k].length ? c.modes[k] : BUILTIN_MODES[k]) || HOUSE_MODES.map((x) => x[0])).includes(mode);
  const B = Object.fromEntries(Object.entries(c.builtin || {}).map(([k, v]) => [k, v && modeOk(k)]));
  const nm = (e) => { const a = m.eidArea.get(e); return `${a ? `${a.name} · ` : ""}${entName(h, e, a)}`; };
  const heatingArea = (a) => a && a.climates.some((x) => h.states[x] && h.states[x].attributes.hvac_action === "heating");
  const openLong = (e) => isOn(h.states[e]) && sinceMin(h.states[e]) >= (c.contacts_min || 0);
  if (B.contacts) for (const e of m.agg.contacts) {
    if (B.window_heating && heatingArea(m.eidArea.get(e))) continue;
    if (openLong(e)) out.push({ key: `contact:${e}`, level: "warn", title: `${nm(e)} offen`, eid: e, fmt: "since" });
  }
  if (B.window_heating) for (const a of m.visibleAreas) {
    if (a.contacts.some(openLong) && heatingArea(a))
      out.push({ key: `heat:${a.id}`, level: "warn", icon: "mdi:radiator-disabled", title: `Fenster offen beim Heizen · ${a.name}`, detail: `${a.contacts.filter(openLong).map((e) => entName(h, e, a)).join(", ")} offen – Heizung läuft dagegen`, to: `raum/${a.id}` });
  }
  if (B.safety) for (const e of m.agg.safety) {
    if (dom(e) === "alarm_control_panel") continue;
    if (isOn(h.states[e])) out.push({ key: `safety:${e}`, level: "alarm", title: nm(e), detail: "ausgelöst", eid: e, fmt: "state" });
  }
  if (B.alarm_panel) for (const e of m._panels || []) {
    const st = h.states[e];
    if (st && st.state === "triggered") out.push({ key: `alarmpanel:${e}`, level: "alarm", icon: "mdi:alarm-light", title: `${st.attributes.friendly_name || e} ausgelöst`, detail: "Alarmanlage", eid: e });
  }
  if (B.presence_away) for (const a of m.visibleAreas) for (const e of a.presence) {
    if (isOn(h.states[e])) out.push({ key: `presence:${e}`, level: "alarm", icon: "mdi:motion-sensor", title: `${/beweg|präsenz|praesenz|motion|presence|anwesen/i.test(entName(h, e, a)) ? a.name : nm(e)}: Bewegung erkannt`, detail: `während Hausmodus ${MODE_NAME[mode]}`, eid: e, to: `raum/${a.id}` });
  }
  if (B.locks) for (const a of m.visibleAreas) for (const e of a.groups.lock || []) {
    if (isOn(h.states[e])) out.push({ key: `lock:${e}`, level: "warn", icon: "mdi:lock-open-variant", title: `${nm(e)} entriegelt`, eid: e, fmt: "ago" });
  }
  if (B.garage) for (const a of m.visibleAreas) for (const e of a.covers) {
    const st = h.states[e];
    if (["garage", "gate"].includes(dc(st)) && isOn(st)) out.push({ key: `garage:${e}`, level: "warn", title: `${nm(e)} offen`, eid: e, fmt: "ago" });
  }
  if (B.battery) {
    const crit = m.agg.batteries.filter((e) => { const st = h.states[e]; if (dom(e) === "binary_sensor") return isOn(st); const v = num(st); return v !== null && v < L.battery_critical; });
    const base = { key: "battery", level: "warn", icon: "mdi:battery-alert-variant-outline", to: "batterien" };
    if (crit.length === 1) out.push({ ...base, title: `${nm(crit[0])} fast leer`, detail: fmt(h.states[crit[0]]) });
    else if (crit.length) out.push({ ...base, title: `${crit.length} Batterien fast leer`, detail: `unter ${L.battery_critical} %` });
  }
  if (B.offline) {
    const n = m.agg.unavailable.filter((e) => isUnav(h.states[e])).length;
    if (n) out.push({ key: "offline", level: "info", icon: "mdi:lan-disconnect", title: `${n} ${n === 1 ? "Gerät" : "Geräte"} nicht erreichbar` });
  }
  if (B.mold) out.push(...moldAlerts(h, m, c, book));
  else MOLD.clear();
  if (B.appliances) for (const a of applList(h, L).filter((x) => x.state === "fertig"))
    out.push({ key: `appliance:${a.id}`, level: "info", icon: a.icon || "mdi:check-circle-outline", title: `${a.name} fertig`, eid: a.power || "", fmt: "since", ts: a.end || a.since || 0 });
  if (B.maintenance && maintOn(L)) for (const i of L.maintenance.tasks.map((t) => taskInfo(t, L)).filter((x) => x.status === "due"))
    out.push({ key: `maint:${i.t.id}`, level: "info", icon: i.t.icon || "mdi:wrench-clock", title: `Wartung fällig · ${i.t.title || "Aufgabe"}`,
      detail: i.days === null ? "noch nie erledigt" : i.days === 0 ? "heute fällig" : `seit ${-i.days} ${i.days === -1 ? "Tag" : "Tagen"} fällig`, to: "wartung" });
  if (B.weather) {
    const st = h.states[WETTER], l = st && st.attributes.meldungen;
    if (Array.isArray(l)) for (const a of l) out.push({ key: a.key, level: a.level, icon: a.icon || "mdi:weather-lightning", title: a.title, detail: a.detail || "", to: a.path || "" });
  }
  (c.rules || []).forEach((r, i) => {
    if (r.enabled === false || !r.entity) return;
    if (r.modes && r.modes.length && !r.modes.includes(mode)) return;
    const st = h.states[r.entity];
    if (!st || !ruleMatch(st, r) || (r.minutes && sinceMin(st) < r.minutes)) return;
    out.push({ key: `rule:${i}:${r.entity}`, level: r.level || "warn", title: r.title || nm(r.entity), detail: fmt(st), eid: r.entity, fmt: "state" });
  });
  return out.sort((x, y) => LEVELS[y.level] - LEVELS[x.level]);
}
