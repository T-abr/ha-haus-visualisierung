/* Haus Visualisierung – Müllabfuhr und Termine: „Morgen: Gelbe Tonne“ in der Kopfzeile und im Bildschirmschoner.
 * Quelle sind Kalender-Entitäten (calendar.*), z. B. von Waste Collection Schedule, Abfall-Integrationen, ICS oder
 * Google/CalDAV. Die Termine kommen über die Kalender-API von Home Assistant (alle Termine der nächsten Tage);
 * ohne sie bleibt der nächste Termin aus den Attributen der Entität. Welche Kalender als Müllabfuhr und welche als
 * Termine zählen, steht in den Einstellungen (termine.cals); Kalender mit „Abfall“, „Müll“, „Tonne“ … im Namen
 * gelten ohne Einstellung als Müllabfuhr. */

import { esc, icon, setHidden, setIcon, setText } from "./grundlagen.js";

const WASTE_RE = /abfall|m(ü|ue|u)ll|waste|tonne|abfuhr|wertstoff|entsorg|recycl|garbage|trash/i;

/* Farbe und Symbol je Tonne (nach dem Titel des Termins) */
const BINS = [
  [/gelb|wertstoff|verpackung|plastik|lvp|recycl/i, "#f2c230", "mdi:recycle"],
  [/papier|pappe|karton|blau|paper/i, "#4b8df8", "mdi:newspaper-variant-outline"],
  [/bio|braun|kompost|organic/i, "#a8703f", "mdi:leaf"],
  [/grün|gruen|garten|baum|laub/i, "#4cbf6b", "mdi:tree-outline"],
  [/glas|glass/i, "#3fae8f", "mdi:bottle-wine-outline"],
  [/sperr/i, "#e8893a", "mdi:sofa-outline"],
  [/schadstoff|problem|sonder/i, "#e5534b", "mdi:biohazard"],
  [/rest|grau|schwarz|haus|general/i, "#9aa3b2", "mdi:trash-can-outline"],
];
const binOf = (title) => { for (const [re, c, i] of BINS) if (re.test(title)) return { color: c, icon: i }; return { color: "#9aa3b2", icon: "mdi:trash-can-outline" }; };

const DAY = 86400000;
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayDiff = (a, b) => Math.round((midnight(a) - midnight(b)) / DAY);

/** Wie ein Kalender zählt: "waste" (Müllabfuhr), "event" (Termine) oder "" (nicht anzeigen). */
function calKind(h, T, eid) {
  const set = T.cals && T.cals[eid];
  if (set === "waste" || set === "event") return set;
  if (set === "-") return "";
  const st = h.states[eid];
  return WASTE_RE.test(`${eid} ${(st && st.attributes.friendly_name) || ""}`) ? "waste" : "";
}
/** Kalender, die gezeigt werden: [{ eid, kind }] */
function termCals(h, L) {
  const T = (L && L.termine) || {};
  if (T.enabled === false || !h || !h.states) return [];
  return Object.keys(h.states).filter((e) => e.startsWith("calendar.")).sort()
    .map((eid) => ({ eid, kind: calKind(h, T, eid) })).filter((c) => c.kind);
}
const termWatch = (h, L) => termCals(h, L).map((c) => c.eid);

/* ---------- Termine holen (Kalender-API), je Kalender zwischengespeichert ---------- */
const CACHE = new Map();           // eid → { sig, at, events: [...] | null, busy }
const LISTENERS = new Set();
const REFRESH = 15 * 60000;
function termListen(cb) { LISTENERS.add(cb); }
function termUnlisten(cb) { LISTENERS.delete(cb); }
const notify = () => { for (const cb of LISTENERS) { try { cb(); } catch (err) { console.warn("Haus Visualisierung: Termine", err); } } };

/** Datum aus der Kalender-API ({ date } oder { dateTime }) bzw. aus einem Attribut („2026-11-24 00:00:00“). */
function parseWhen(v) {
  if (!v) return null;
  if (typeof v === "object") v = v.dateTime || v.date;
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { d: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : { d, allDay: false };
}
function fromApi(eid, kind, ev) {
  const s = parseWhen(ev.start), e = parseWhen(ev.end);
  if (!s) return null;
  const end = e ? e.d : new Date(s.d.getTime() + (s.allDay ? DAY : 3600000));
  const where = String(ev.location || "").trim();
  return { eid, kind, title: String(ev.summary || ev.message || "").trim() || "Termin", start: s.d, end, allDay: s.allDay, ...(where ? { where } : {}) };
}
function fromAttrs(eid, kind, st) {
  const a = (st && st.attributes) || {};
  if (!a.start_time || !a.message) return [];
  const s = parseWhen(a.start_time), e = parseWhen(a.end_time);
  if (!s) return [];
  const allDay = !!a.all_day || s.allDay;
  const start = allDay ? midnight(s.d) : s.d;
  return [{ eid, kind, title: String(a.message).trim(), start, end: e ? e.d : new Date(start.getTime() + (allDay ? DAY : 3600000)), allDay }];
}

function ensure(h, eid, kind, days, now) {
  const st = h.states[eid], a = (st && st.attributes) || {};
  const sig = `${a.message || ""}|${a.start_time || ""}|${days}`;
  let rec = CACHE.get(eid);
  const stale = !rec || rec.sig !== sig || now - rec.at > REFRESH || dayDiff(now, rec.at) !== 0;
  if (!stale || (rec && rec.busy) || typeof h.callApi !== "function") return rec;
  rec = { events: rec ? rec.events : null, ...(rec || {}), sig, at: now.getTime(), busy: true };
  CACHE.set(eid, rec);
  const start = midnight(now), end = new Date(start.getTime() + (days + 1) * DAY);
  const url = `calendars/${eid}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  Promise.resolve().then(() => h.callApi("GET", url)).then((list) => {
    rec.events = (Array.isArray(list) ? list : []).map((ev) => fromApi(eid, kind, ev)).filter(Boolean);
  }).catch((err) => {
    console.warn(`Haus Visualisierung: Kalender ${eid} nicht lesbar`, err);
    rec.events = null;
  }).finally(() => { rec.busy = false; notify(); });
  return rec;
}

/**
 * Alle Termine der gewählten Kalender ab jetzt bis in termine.days Tagen, nach Beginn sortiert.
 * Eintrag: { eid, kind: "waste"|"event", title, start: Date, end: Date, allDay, day (0 = heute) }
 */
function termEvents(h, L, now = new Date()) {
  const T = (L && L.termine) || {}, days = Math.max(1, Math.min(14, Number(T.days) || 7));
  const out = [];
  for (const { eid, kind } of termCals(h, L)) {
    const rec = ensure(h, eid, kind, days, now);
    const list = rec && rec.events ? rec.events.map((e) => ({ ...e, kind })) : fromAttrs(eid, kind, h.states[eid]);
    for (const e of list) {
      const day = dayDiff(e.start, now);
      if (e.end <= now || day > days) continue;
      out.push({ ...e, day: Math.max(0, day) });
    }
  }
  // gleiche Abfuhr aus zwei Kalendern nur einmal
  const seen = new Set();
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, "de")).filter((e) => {
    const k = `${e.kind}|${e.day}|${e.title.toLowerCase()}|${e.allDay ? "" : e.start.getTime()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const dayWord = (day, d) => (day === 0 ? "Heute" : day === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "long" }));
const timeOf = (e) => (e.allDay ? "" : e.start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));

/**
 * Was Kopfzeile und Bildschirmschoner zeigen.
 * waste: nächste Abfuhr heute (bis Mittag) oder morgen: { day, titles, hot } – hot = am Vorabend ab termine.evening Uhr
 *   oder am Morgen der Abfuhr bis 10 Uhr.
 * events: Termine heute (noch nicht vorbei) und morgen.
 */
function termSummary(h, L, now = new Date()) {
  const T = (L && L.termine) || {}, eve = Number.isFinite(Number(T.evening)) ? Number(T.evening) : 17;
  const all = termEvents(h, L, now);
  const wasteAll = all.filter((e) => e.kind === "waste");
  const wDay = wasteAll.find((e) => (e.day === 0 && now.getHours() < 12) || e.day === 1);
  const waste = wDay ? (() => {
    const list = wasteAll.filter((e) => e.day === wDay.day);
    return { day: wDay.day, items: list, titles: list.map((e) => e.title), hot: wDay.day === 1 ? now.getHours() >= eve : now.getHours() < 10 };
  })() : null;
  const events = all.filter((e) => e.kind === "event" && e.day <= 1);
  return { all, waste, events };
}

const wasteText = (w) => `${dayWord(w.day)}: ${w.titles.join(", ")}`;
const eventText = (e, withDay = true) => `${withDay ? `${dayWord(e.day, e.start)} ` : ""}${timeOf(e) ? `${timeOf(e)} ` : ""}${e.title}`.trim();

/* ---------- Kopfzeile ---------- */
function terminBtnHTML(h, L) {
  const T = (L && L.termine) || {};
  if (T.header === false || !termCals(h, L).length) return "";
  return `<button class="termin glass" data-u="termin" data-act="more" data-eid="" hidden>${icon("mdi:calendar")}<span class="tmt"></span></button>`;
}
function updateTermin(el, ctx) {
  const h = ctx._hass, S = termSummary(h, ctx._layout);
  // Vorrang: Abfuhr am Vorabend/Morgen, dann Termine heute, dann Abfuhr morgen, dann Termine morgen
  const evToday = S.events.find((e) => e.day === 0);
  const evTomorrow = S.events.find((e) => e.day === 1);
  let pick = null;
  if (S.waste && S.waste.hot) pick = { t: wasteText(S.waste), i: binOf(S.waste.titles[0]).icon, c: binOf(S.waste.titles[0]).color, eid: S.waste.items[0].eid, hot: true };
  else if (evToday) pick = { t: eventText(evToday), i: "mdi:calendar-clock", eid: evToday.eid };
  else if (S.waste) pick = { t: wasteText(S.waste), i: binOf(S.waste.titles[0]).icon, c: binOf(S.waste.titles[0]).color, eid: S.waste.items[0].eid };
  else if (evTomorrow) pick = { t: eventText(evTomorrow), i: "mdi:calendar", eid: evTomorrow.eid };
  setHidden(el, !pick);
  if (!pick) return;
  el.classList.toggle("hot", !!pick.hot);
  el.dataset.eid = pick.eid;
  el.style.setProperty("--tc", pick.c || "");
  setIcon(el, "ha-icon", pick.i);
  setText(el, ".tmt", pick.t);
  const tip = [S.waste ? `Abfuhr ${wasteText(S.waste)}` : "", ...S.all.filter((e) => e.kind === "event").slice(0, 5).map((e) => eventText(e))]
    .filter(Boolean).join("\n");
  if (el.title !== tip) el.title = tip;
}

/* ---------- Bildschirmschoner ---------- */
function saverTermHTML(h, L) {
  const T = (L && L.termine) || {};
  if (T.saver === false) return "";
  const S = termSummary(h, L), parts = [];
  if (S.waste) {
    const b = binOf(S.waste.titles[0]);
    parts.push(`<span class="svwaste${S.waste.hot ? " hot" : ""}" style="--tc:${b.color}">${icon(b.icon)}${esc(wasteText(S.waste))}</span>`);
  }
  for (const e of S.events.slice(0, S.waste ? 2 : 3)) parts.push(`<span>${icon(e.day === 0 ? "mdi:calendar-clock" : "mdi:calendar")}${esc(eventText(e))}</span>`);
  return parts.join("");
}

export { binOf, calKind, fromApi, midnight, parseWhen, saverTermHTML, termCals, termEvents, terminBtnHTML, termListen, termSummary, termUnlisten, termWatch, updateTermin, WASTE_RE };
