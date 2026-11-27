/* Haus Visualisierung – Seite „Kalender“: Familienkalender als Woche (Raster, am Handy als Liste) oder Monat.
 * Quelle sind dieselben Kalender-Entitäten wie für Kopfzeile und Bildschirmschoner (termine.js), z. B. der Apple-
 * Kalender über die CalDAV-Integration von Home Assistant. Farbe und Anzeigename je Kalender stehen in den
 * Einstellungen (termine.colors, termine.names); ohne Einstellung kommt die Farbe aus einer festen Reihe, der Name
 * aus der Entität. Termine der Müllabfuhr behalten Farbe und Symbol ihrer Tonne. */

import { entName, esc, icon } from "./grundlagen.js";
import { binOf, fromApi, midnight, termCals } from "./termine.js";

const DAY = 86400000;
/* Farben ohne Einstellung, in der Reihenfolge der Kalender (gut unterscheidbar auf dunklem Glas) */
const PALETTE = ["#5aa0ff", "#f06292", "#4cbf6b", "#ffb74d", "#ba68c8", "#4dd0e1", "#e57373", "#aed581"];
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const REFRESH = 5 * 60000;

const CSS = `
.kbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kbar .altab.on{background:var(--hv-surface-2);color:var(--hv-text)}
.kleg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:-6px 0 14px;font-size:13px;color:var(--hv-dim)}
.kleg span{display:inline-flex;align-items:center;gap:6px}
.kleg i{width:10px;height:10px;border-radius:50%;background:var(--kc)}
.kweek{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.kday{padding:10px 8px;min-height:180px;display:flex;flex-direction:column;gap:6px}
.kday.past{opacity:.6}
.kday.today{border-color:var(--hv-accent);box-shadow:inset 0 0 0 1px var(--hv-accent)}
.khead{display:flex;align-items:baseline;gap:6px;font-size:13px;color:var(--hv-dim);padding:0 2px 4px;border-bottom:1px solid var(--hv-line)}
.khead b{font-size:20px;font-weight:400;color:var(--hv-text)}
.kday.today .khead b{color:var(--hv-accent)}
.kev{display:block;padding:5px 7px;border-radius:8px;font-size:12.5px;line-height:1.3;background:var(--hv-surface);border-left:3px solid var(--kc);overflow:hidden;text-overflow:ellipsis;word-break:break-word}
.kev.ad{background:color-mix(in srgb,var(--kc) 28%,transparent);border-left-color:transparent}
.kev .kt{color:var(--hv-dim);font-variant-numeric:tabular-nums;margin-right:5px}
.kev ha-icon{--mdc-icon-size:14px;margin-right:4px;color:var(--kc);vertical-align:-2px}
.kev small{display:block;color:var(--hv-dim);font-size:11.5px}
.knone{color:var(--hv-faint);font-size:12px;padding:2px}
.klist{display:flex;flex-direction:column;gap:10px}
.klist .kday{min-height:0}
.kmonth{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:8px}
.kwd{text-align:center;font-size:12px;color:var(--hv-dim);padding:2px 0 4px}
.kcell{min-height:96px;padding:5px;border-radius:10px;background:var(--hv-surface);display:flex;flex-direction:column;gap:3px;text-align:left;overflow:hidden;min-width:0}
.kcell:hover{background:var(--hv-surface-2)}
.kcell.out{opacity:.4}
.kcell.today{box-shadow:inset 0 0 0 1px var(--hv-accent)}
.kcell .kn{font-size:13px}
.kcell.today .kn{color:var(--hv-accent);font-weight:600}
.kcell .kev{padding:2px 5px;font-size:11.5px;white-space:nowrap;border-left-width:2px}
.kmore{font-size:11px;color:var(--hv-dim)}
.kdots{display:flex;flex-wrap:wrap;gap:3px}
.kdots i{width:7px;height:7px;border-radius:50%;background:var(--kc)}
.narrow .kmonth{gap:3px;padding:6px}
.narrow .kcell{min-height:52px;padding:4px;align-items:center}
@media (max-width:1100px){.app:not(.narrow) .kday{padding:8px 6px}}
`;

/* ---------- Zeit ---------- */
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = midnight(d); return addDays(x, -((x.getDay() + 6) % 7)); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromYmd = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** Kalenderwoche nach ISO 8601 */
function isoWeek(d) {
  const x = midnight(d);
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const w1 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x - w1) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

/** Sichtbarer Zeitraum: Woche Mo–So oder Monat als 6 Wochen ab dem Montag vor dem Ersten */
function kalRange(mode, ref) {
  if (mode === "monat") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1), start = monday(first);
    return { start, end: addDays(start, 42), days: 42 };
  }
  const start = monday(ref);
  return { start, end: addDays(start, 7), days: 7 };
}

/* ---------- Kalender, Farben, Namen ---------- */
/** Gezeigte Kalender mit Farbe und Namen: [{ eid, kind, color, name }] */
function kalCals(h, L) {
  const T = (L && L.termine) || {}, C = T.colors || {}, N = T.names || {};
  let i = 0;
  return termCals(h, L).map(({ eid, kind }) => {
    const auto = PALETTE[i++ % PALETTE.length];
    return { eid, kind, color: /^#[0-9a-f]{6}$/i.test(C[eid] || "") ? C[eid] : auto, auto, name: String(N[eid] || "").trim() || entName(h, eid) };
  });
}
/** Seite im Menü: eingeschaltet und mindestens ein Kalender gezeigt */
const kalOn = (h, L) => { const T = (L && L.termine) || {}; return T.enabled !== false && T.page !== false && termCals(h, L).length > 0; };

/* ---------- Termine im Zeitraum holen (Kalender-API), je Kalender und Zeitraum zwischengespeichert ---------- */
const CACHE = new Map();   // `${eid}|${start}|${end}` → { at, events, busy, error }

function load(p, cal, start, end) {
  const key = `${cal.eid}|${start.getTime()}|${end.getTime()}`, h = p._hass;
  let rec = CACHE.get(key);
  if (rec && (rec.busy || Date.now() - rec.at < REFRESH)) return rec;
  if (typeof h.callApi !== "function") return rec || { events: [], at: Date.now() };
  rec = { events: rec ? rec.events : null, at: Date.now(), busy: true, error: "" };
  CACHE.set(key, rec);
  if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value);
  const url = `calendars/${cal.eid}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  Promise.resolve().then(() => h.callApi("GET", url)).then((list) => {
    rec.events = (Array.isArray(list) ? list : []).map((ev) => fromApi(cal.eid, cal.kind, ev)).filter(Boolean);
  }).catch((err) => {
    console.warn(`Haus Visualisierung: Kalender ${cal.eid} nicht lesbar`, err);
    rec.error = (err && (err.body && err.body.message || err.message)) || String(err);
    rec.events = rec.events || [];
  }).finally(() => {
    rec.busy = false;
    if (p._view === "kalender") { p._dirty = true; p._schedule(); }
  });
  return rec;
}

/** Termine aller Kalender im Zeitraum: { events, loading, errors } */
function rangeEvents(p, cals, start, end) {
  const events = [], errors = [];
  let loading = false;
  for (const cal of cals) {
    const rec = load(p, cal, start, end);
    if (!rec || rec.events === null) { loading = true; continue; }
    if (rec.error) errors.push(cal.name);
    for (const e of rec.events) if (e.end > start && e.start < end) events.push({ ...e, cal });
  }
  events.sort((a, b) => (b.allDay - a.allDay) || a.start - b.start || a.title.localeCompare(b.title, "de"));
  return { events, loading, errors };
}

/** Termine eines Tages (mehrtägige an jedem ihrer Tage) */
const onDay = (events, day) => { const d0 = day.getTime(), d1 = addDays(day, 1).getTime(); return events.filter((e) => e.start.getTime() < d1 && e.end.getTime() > d0); };

/* ---------- Darstellung ---------- */
function colorOf(e) { return e.kind === "waste" ? binOf(e.title).color : e.cal.color; }
function tipOf(e) {
  const fmt = (d) => d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
  const lastDay = e.allDay ? addDays(e.end, -1) : e.end;
  const when = e.allDay
    ? (ymd(e.start) === ymd(lastDay) ? `${fmt(e.start)}, ganztägig` : `${fmt(e.start)} – ${fmt(lastDay)}`)
    : (ymd(e.start) === ymd(e.end) ? `${fmt(e.start)} ${hm(e.start)}–${hm(e.end)}` : `${fmt(e.start)} ${hm(e.start)} – ${fmt(e.end)} ${hm(e.end)}`);
  return [e.title, when, [e.cal.name, e.where].filter(Boolean).join(" · ")].join("\n");
}
function evHTML(e, day, full) {
  const ad = e.allDay || (e.start < day && e.end > addDays(day, 1));
  const time = ad ? "" : e.start < day ? `bis ${hm(e.end)}` : hm(e.start);
  const ic = e.kind === "waste" ? icon(binOf(e.title).icon) : "";
  const where = full && e.where ? `<small>${esc(e.where)}</small>` : "";
  return `<span class="kev${ad ? " ad" : ""}" style="--kc:${colorOf(e)}" title="${esc(tipOf(e))}">${ic}${time ? `<span class="kt">${time}</span>` : ""}${esc(e.title)}${where}</span>`;
}

function weekHTML(events, start, narrow, now) {
  const today = ymd(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const col = (d) => {
    const list = onDay(events, d), k = ymd(d);
    const head = `<div class="khead"><b>${d.getDate()}.</b>${d.toLocaleDateString("de-DE", { weekday: narrow ? "long" : "short" })}${narrow && k === today ? " · heute" : ""}</div>`;
    return `<div class="kday glass${k === today ? " today" : ""}${d < midnight(now) ? " past" : ""}" data-day="${k}">${head}
      ${list.length ? list.map((e) => evHTML(e, d, true)).join("") : '<span class="knone">–</span>'}</div>`;
  };
  if (!narrow) return `<div class="kweek">${days.map(col).join("")}</div>`;
  // Handy: Liste; leere Tage nur heute zeigen
  const shown = days.filter((d) => onDay(events, d).length || ymd(d) === today);
  return shown.length ? `<div class="klist">${shown.map(col).join("")}</div>` : `<div class="glass empty">${icon("mdi:calendar-blank-outline")}Keine Termine in dieser Woche.</div>`;
}

function monthHTML(events, start, ref, narrow, now) {
  const today = ymd(now), month = ref.getMonth();
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i)).map((d) => {
    const list = onDay(events, d), k = ymd(d);
    const body = narrow
      ? (list.length ? `<span class="kdots">${list.slice(0, 4).map((e) => `<i style="--kc:${colorOf(e)}"></i>`).join("")}</span>` : "")
      : `${list.slice(0, 3).map((e) => evHTML(e, d, false)).join("")}${list.length > 3 ? `<span class="kmore">+${list.length - 3} weitere</span>` : ""}`;
    const label = `${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}: ${list.length ? `${list.length} ${list.length === 1 ? "Termin" : "Termine"}` : "keine Termine"}`;
    return `<button class="kcell${d.getMonth() !== month ? " out" : ""}${k === today ? " today" : ""}" data-act="kal-day" data-day="${k}" aria-label="${esc(label)}"><span class="kn">${d.getDate()}</span>${body}</button>`;
  }).join("");
  return `<div class="kmonth glass">${WD.map((w) => `<div class="kwd">${w}</div>`).join("")}${cells}</div>`;
}

/** Ansicht (Woche/Monat) und Bezugstag der Seite; Ansicht bleibt je Gerät gemerkt */
function kalState(p) {
  if (!p._kal) {
    let mode = "woche";
    try { if (localStorage.getItem("hv-kal-mode") === "monat") mode = "monat"; } catch (err) { /* egal */ }
    p._kal = { mode, ref: midnight(new Date()) };
  }
  return p._kal;
}

function kalPageHTML(p, now = new Date()) {
  const h = p._hass, L = p._layout, S = kalState(p);
  const isAdmin = !!(h.user && h.user.is_admin);
  const edit = isAdmin ? `<button class="pbtn" data-act="go" data-to="einstellungen/darstellung" title="Kalender, Farben und Namen">${icon("mdi:pencil")}Kalender wählen</button>` : "";
  const cals = kalCals(h, L);
  if (!cals.length) return `<style>${CSS}</style><div class="ptitle"><h1>Kalender</h1><span class="sp"></span>${edit}</div>
    <div class="glass empty">${icon("mdi:calendar-question")}Noch kein Kalender gewählt.<br><small>Apple-Kalender: in Home Assistant die Integration „CalDAV“ mit dem Server https://caldav.icloud.com, der Apple-ID und einem app-spezifischen Passwort einrichten, dann unter Einstellungen → Darstellung → Müllabfuhr und Termine den Kalender auf „Termine“ stellen.</small></div>`;
  const { start, end } = kalRange(S.mode, S.ref);
  // offene Seite (z. B. am Wandpanel) regelmäßig auffrischen: neue Termine und „heute“ nach Mitternacht
  clearTimeout(p._kalTimer);
  p._kalTimer = setTimeout(() => { if (p._view === "kalender" && p.isConnected) { p._dirty = true; p._schedule(); } }, REFRESH + 1000);
  const { events, loading, errors } = rangeEvents(p, cals, start, end);
  const last = addDays(end, -1);
  const sub = S.mode === "monat"
    ? S.ref.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : `KW ${isoWeek(start)} · ${start.getMonth() === last.getMonth() ? `${start.getDate()}.` : start.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}`;
  const tab = (m, t) => `<button class="altab${S.mode === m ? " on" : ""}" data-act="kal-mode" data-mode="${m}" aria-pressed="${S.mode === m}">${t}</button>`;
  const bar = `<span class="kbar"><button class="pbtn" data-act="kal-shift" data-d="-1" aria-label="zurück">${icon("mdi:chevron-left")}</button>
    <button class="pbtn" data-act="kal-today">Heute</button>
    <button class="pbtn" data-act="kal-shift" data-d="1" aria-label="weiter">${icon("mdi:chevron-right")}</button>
    ${tab("woche", "Woche")}${tab("monat", "Monat")}</span>`;
  const legend = cals.filter((c) => c.kind === "event").map((c) => `<span><i style="--kc:${c.color}"></i>${esc(c.name)}</span>`).join("")
    + (cals.some((c) => c.kind === "waste") ? `<span><i style="--kc:#9aa3b2"></i>Müllabfuhr</span>` : "");
  const note = loading && !events.length ? `<div class="glass empty">${icon("mdi:loading", "spin")}Lade Termine …</div>`
    : (S.mode === "monat" ? monthHTML(events, start, S.ref, !!p._isNarrow, now) : weekHTML(events, start, !!p._isNarrow, now));
  const err = errors.length ? `<p class="hint">${icon("mdi:alert-outline")}Nicht lesbar: ${esc(errors.join(", "))}</p>` : "";
  return `<style>${CSS}</style><div class="ptitle"><h1>Kalender</h1><span class="psub">${esc(sub)}</span><span class="sp"></span>${bar}${edit}</div>
    <div class="kleg">${legend}</div>${err}${note}`;
}

/** Knöpfe der Seite: kal-mode, kal-shift, kal-today, kal-day */
function kalAction(p, act, t) {
  const S = kalState(p);
  if (act === "kal-mode") {
    S.mode = t.dataset.mode === "monat" ? "monat" : "woche";
    try { localStorage.setItem("hv-kal-mode", S.mode); } catch (err) { /* egal */ }
  } else if (act === "kal-shift") {
    const d = Number(t.dataset.d) || 0;
    S.ref = S.mode === "monat" ? new Date(S.ref.getFullYear(), S.ref.getMonth() + d, 1) : addDays(S.ref, 7 * d);
  } else if (act === "kal-today") S.ref = midnight(new Date());
  else if (act === "kal-day") {
    const d = fromYmd(t.dataset.day);
    if (!d) return;
    S.ref = d; S.mode = "woche";
  }
  p._dirty = true;
  p._flush();
}

export { isoWeek, kalAction, kalCals, kalOn, kalPageHTML, kalRange, PALETTE };
