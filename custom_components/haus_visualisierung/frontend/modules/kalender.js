/* Haus Visualisierung – Seite „Kalender“: Familienkalender als Monatsraster. Mehrtägige Termine laufen als Balken
 * über ihre Tage, je Tag stehen bis zu drei weitere Termine im Raster; der gewählte Tag (Start: heute) zeigt alle
 * Termine mit Uhrzeit, Kalender und Ort daneben (schmale Bildschirme: darunter, am Handy Punkte statt Titel im Raster).
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
const LANES = 3;   // Zeilen für mehrtägige Balken je Woche
const SINGLE = 3;  // weitere Termine je Tag im Raster

const CSS = `
.kbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kleg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:-6px 0 14px;font-size:13px;color:var(--hv-dim)}
.kleg span{display:inline-flex;align-items:center;gap:6px}
.kleg i{width:10px;height:10px;border-radius:50%;background:var(--kc)}
.kwrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.kmonth{display:flex;flex-direction:column;gap:4px;padding:8px}
.kwds{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0 4px}
.kwd{text-align:center;font-size:12px;color:var(--hv-dim);padding:2px 0 2px}
.kwk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));column-gap:4px;row-gap:2px;min-height:max(96px,calc((100vh - 300px) / var(--kw)))}
.kcell{padding:4px 6px;border-radius:10px;background:var(--hv-surface);display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;border:0;color:inherit;font:inherit;cursor:pointer}
.kcell:hover{background:var(--hv-surface-2)}
.kcell.out{opacity:.4}
.kcell.today{box-shadow:inset 0 0 0 1px var(--hv-accent)}
.kcell.sel{background:var(--hv-surface-2);box-shadow:inset 0 0 0 2px var(--hv-accent)}
.kcell .kn{font-size:13px;line-height:16px}
.kcell.today .kn{color:var(--hv-accent);font-weight:600}
.kev{display:block;padding:2px 6px;margin:0 4px;border-radius:6px;font-size:11.5px;line-height:1.35;background:color-mix(in srgb,var(--hv-surface-2) 70%,transparent);border-left:2px solid var(--kc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;pointer-events:none}
.kev.ad{background:color-mix(in srgb,var(--kc) 30%,transparent);border-left-color:transparent}
.kev.cl{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0}
.kev.cr{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.kev .kt{color:var(--hv-dim);font-variant-numeric:tabular-nums;margin-right:5px}
.kev ha-icon{--mdc-icon-size:13px;margin-right:4px;color:var(--kc);vertical-align:-2px}
.kmore{font-size:11px;color:var(--hv-dim);padding:0 6px;pointer-events:none}
.kdots{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}
.kdots i{width:7px;height:7px;border-radius:50%;background:var(--kc)}
.kmini{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}
.kmini .kcell{min-height:52px;padding:4px;align-items:center}
.kdlist{padding:14px;display:flex;flex-direction:column;gap:8px}
.kdlist h2{margin:0 0 4px;font-size:16px;font-weight:500;display:flex;gap:8px;align-items:baseline}
.kdlist h2 small{color:var(--hv-accent);font-size:12px}
.kdi{display:flex;gap:10px;padding:8px 10px;border-radius:10px;background:var(--hv-surface);border-left:3px solid var(--kc)}
.kdi .kdt{flex:0 0 auto;min-width:74px;color:var(--hv-dim);font-size:13px;font-variant-numeric:tabular-nums}
.kdi .kdx{min-width:0;word-break:break-word}
.kdi .kdx ha-icon{--mdc-icon-size:15px;margin-right:4px;color:var(--kc);vertical-align:-2px}
.kdi small{display:block;color:var(--hv-dim);font-size:12px}
.knone{color:var(--hv-faint);font-size:13px}
@media (max-width:1100px){.kwrap{grid-template-columns:minmax(0,1fr)}}
.narrow .kwrap{grid-template-columns:minmax(0,1fr)}
.narrow .kmonth{padding:6px}
`;

/* ---------- Zeit ---------- */
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = midnight(d); return addDays(x, -((x.getDay() + 6) % 7)); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromYmd = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** Tage von a bis b (beide Tagesbeginn oder beliebige Zeit; Sommerzeit-fest) */
const dayIdx = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY);
/** letzter Tag eines Termins (Ende um Mitternacht zählt zum Vortag) */
const lastDay = (e) => midnight(new Date(Math.max(e.start.getTime(), e.end.getTime() - 1)));

/** Sichtbarer Zeitraum: ganze Wochen (Mo–So) vom Montag vor dem Ersten bis zum Sonntag nach dem Letzten */
function kalRange(ref) {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1), start = monday(first);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const weeks = Math.ceil((dayIdx(start, last) + 1) / 7);
  return { start, end: addDays(start, weeks * 7), weeks };
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
const wasteIcon = (e) => (e.kind === "waste" ? icon(binOf(e.title).icon) : "");
/** ganztägig an diesem Tag (ganztägiger oder den ganzen Tag überspannender Termin) */
const wholeDay = (e, day) => e.allDay || (e.start <= day && e.end >= addDays(day, 1));

/** Eine Woche des Rasters: Tageszellen (Knöpfe) als Hintergrund, darüber Balken und Termine */
function weekHTML(events, ws, month, today, sel) {
  const we = addDays(ws, 7);
  const inWeek = events.filter((e) => e.end > ws && e.start < we);
  const multi = [], single = Array.from({ length: 7 }, () => []), more = Array(7).fill(0);
  for (const e of inWeek) {
    const a = Math.max(0, dayIdx(ws, e.start)), b = Math.min(6, dayIdx(ws, lastDay(e)));
    if (dayIdx(e.start, lastDay(e)) > 0) multi.push({ e, a, b }); else single[a].push(e);
  }
  // Balken auf Zeilen verteilen (früher und länger zuerst)
  multi.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  const laneEnd = [], bars = [];
  for (const m of multi) {
    let l = laneEnd.findIndex((end) => end < m.a);
    if (l < 0 && laneEnd.length < LANES) { l = laneEnd.length; laneEnd.push(-1); }
    if (l < 0) { for (let i = m.a; i <= m.b; i++) more[i]++; continue; }
    laneEnd[l] = m.b; bars.push({ ...m, l });
  }
  const L = laneEnd.length;
  single.forEach((list, i) => { if (list.length > SINGLE) more[i] += list.length - SINGLE; });
  const S = Math.min(SINGLE, Math.max(0, ...single.map((l) => l.length)));
  const anyMore = more.some(Boolean);
  const rows = 1 + L + S + (anyMore ? 1 : 0) + 1;
  const tpl = `20px ${"auto ".repeat(rows - 2)}1fr`;
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i), k = ymd(d), n = onDay(events, d).length;
    const label = `${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}: ${n ? `${n} ${n === 1 ? "Termin" : "Termine"}` : "keine Termine"}`;
    return `<button class="kcell${d.getMonth() !== month ? " out" : ""}${k === today ? " today" : ""}${k === sel ? " sel" : ""}" style="grid-column:${i + 1};grid-row:1 / span ${rows}" data-act="kal-day" data-day="${k}" aria-label="${esc(label)}"><span class="kn">${d.getDate()}</span></button>`;
  }).join("");
  const barHTML = bars.map(({ e, a, b, l }) => {
    const cl = e.start < addDays(ws, a) ? " cl" : "", cr = lastDay(e) > addDays(ws, b) ? " cr" : "";
    const time = e.allDay || e.start < addDays(ws, a) ? "" : `<span class="kt">${hm(e.start)}</span>`;
    return `<span class="kev ad kspan${cl}${cr}" data-day="${ymd(addDays(ws, a))}" style="grid-column:${a + 1} / span ${b - a + 1};grid-row:${2 + l};--kc:${colorOf(e)}">${wasteIcon(e)}${time}${esc(e.title)}</span>`;
  }).join("");
  const singleHTML = single.map((list, i) => list.slice(0, SINGLE).map((e, j) => {
    const time = e.allDay ? "" : `<span class="kt">${hm(e.start)}</span>`;
    return `<span class="kev${e.allDay ? " ad" : ""}" data-day="${ymd(addDays(ws, i))}" style="grid-column:${i + 1};grid-row:${2 + L + j};--kc:${colorOf(e)}">${wasteIcon(e)}${time}${esc(e.title)}</span>`;
  }).join("")).join("");
  const moreHTML = more.map((n, i) => (n ? `<span class="kmore" style="grid-column:${i + 1};grid-row:${2 + L + S}">+${n} weitere</span>` : "")).join("");
  return `<div class="kwk" style="grid-template-rows:${tpl}">${cells}${barHTML}${singleHTML}${moreHTML}</div>`;
}

function monthHTML(events, range, ref, sel, narrow, now) {
  const today = ymd(now), month = ref.getMonth();
  if (narrow) {
    // Handy: kompaktes Raster mit Punkten je Termin
    const cells = Array.from({ length: range.weeks * 7 }, (_, i) => addDays(range.start, i)).map((d) => {
      const list = onDay(events, d), k = ymd(d);
      const dots = list.length ? `<span class="kdots">${list.slice(0, 4).map((e) => `<i style="--kc:${colorOf(e)}"></i>`).join("")}</span>` : "";
      const label = `${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}: ${list.length ? `${list.length} ${list.length === 1 ? "Termin" : "Termine"}` : "keine Termine"}`;
      return `<button class="kcell${d.getMonth() !== month ? " out" : ""}${k === today ? " today" : ""}${k === sel ? " sel" : ""}" data-act="kal-day" data-day="${k}" aria-label="${esc(label)}"><span class="kn">${d.getDate()}</span>${dots}</button>`;
    }).join("");
    return `<div class="kmonth glass"><div class="kmini">${WD.map((w) => `<div class="kwd">${w}</div>`).join("")}${cells}</div></div>`;
  }
  const weeks = Array.from({ length: range.weeks }, (_, w) => weekHTML(events, addDays(range.start, 7 * w), month, today, sel)).join("");
  return `<div class="kmonth glass" style="--kw:${range.weeks}"><div class="kwds">${WD.map((w) => `<div class="kwd">${w}</div>`).join("")}</div>${weeks}</div>`;
}

/** Alle Termine des gewählten Tages mit Zeit, Kalender und Ort */
function dayHTML(events, day, now) {
  const list = onDay(events, day), fmt = (d) => d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
  const items = list.map((e) => {
    let time;
    if (wholeDay(e, day)) {
      const ld = lastDay(e);
      time = dayIdx(e.start, ld) > 0 ? (ymd(ld) === ymd(day) ? "letzter Tag" : `bis ${fmt(ld)}`) : "ganztägig";
    } else if (e.start < day) time = `bis ${hm(e.end)}`;
    else if (e.end > addDays(day, 1)) time = `ab ${hm(e.start)}`;
    else time = `${hm(e.start)}–${hm(e.end)}`;
    const sub = [e.cal.name, e.where].filter(Boolean).map(esc).join(" · ");
    return `<div class="kdi" style="--kc:${colorOf(e)}"><span class="kdt">${time}</span><span class="kdx">${wasteIcon(e)}${esc(e.title)}<small>${sub}</small></span></div>`;
  }).join("");
  const head = day.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  return `<div class="kdlist glass" data-day="${ymd(day)}"><h2>${esc(head)}${ymd(day) === ymd(now) ? "<small>heute</small>" : ""}</h2>
    ${items || '<span class="knone">Keine Termine.</span>'}</div>`;
}

/** Monat (ref = Erster des Monats) und gewählter Tag der Seite */
function kalState(p) {
  if (!p._kal) { const t = midnight(new Date()); p._kal = { ref: new Date(t.getFullYear(), t.getMonth(), 1), sel: t }; }
  return p._kal;
}

function kalPageHTML(p, now = new Date()) {
  const h = p._hass, L = p._layout, S = kalState(p);
  const isAdmin = !!(h.user && h.user.is_admin);
  const edit = isAdmin ? `<button class="pbtn" data-act="go" data-to="einstellungen/darstellung" title="Kalender, Farben und Namen">${icon("mdi:pencil")}Kalender wählen</button>` : "";
  const cals = kalCals(h, L);
  if (!cals.length) return `<style>${CSS}</style><div class="ptitle"><h1>Kalender</h1><span class="sp"></span>${edit}</div>
    <div class="glass empty">${icon("mdi:calendar-question")}Noch kein Kalender gewählt.<br><small>Apple-Kalender: in Home Assistant die Integration „CalDAV“ mit dem Server https://caldav.icloud.com, der Apple-ID und einem app-spezifischen Passwort einrichten, dann unter Einstellungen → Darstellung → Müllabfuhr und Termine den Kalender auf „Termine“ stellen.</small></div>`;
  const range = kalRange(S.ref);
  if (!(S.sel >= range.start && S.sel < range.end)) S.sel = new Date(S.ref);
  // offene Seite (z. B. am Wandpanel) regelmäßig auffrischen: neue Termine und „heute“ nach Mitternacht
  clearTimeout(p._kalTimer);
  p._kalTimer = setTimeout(() => { if (p._view === "kalender" && p.isConnected) { p._dirty = true; p._schedule(); } }, REFRESH + 1000);
  const { events, loading, errors } = rangeEvents(p, cals, range.start, range.end);
  const sub = S.ref.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const bar = `<span class="kbar"><button class="pbtn" data-act="kal-shift" data-d="-1" aria-label="voriger Monat">${icon("mdi:chevron-left")}</button>
    <button class="pbtn" data-act="kal-today">Heute</button>
    <button class="pbtn" data-act="kal-shift" data-d="1" aria-label="nächster Monat">${icon("mdi:chevron-right")}</button></span>`;
  const legend = cals.filter((c) => c.kind === "event").map((c) => `<span><i style="--kc:${c.color}"></i>${esc(c.name)}</span>`).join("")
    + (cals.some((c) => c.kind === "waste") ? `<span><i style="--kc:#9aa3b2"></i>Müllabfuhr</span>` : "");
  const body = loading && !events.length ? `<div class="glass empty">${icon("mdi:loading", "spin")}Lade Termine …</div>`
    : `<div class="kwrap">${monthHTML(events, range, S.ref, ymd(S.sel), !!p._isNarrow, now)}${dayHTML(events, S.sel, now)}</div>`;
  const err = errors.length ? `<p class="hint">${icon("mdi:alert-outline")}Nicht lesbar: ${esc(errors.join(", "))}</p>` : "";
  return `<style>${CSS}</style><div class="ptitle"><h1>Kalender</h1><span class="psub">${esc(sub)}</span><span class="sp"></span>${bar}${edit}</div>
    <div class="kleg">${legend}</div>${err}${body}`;
}

/** Knöpfe der Seite: kal-shift (Monat vor/zurück), kal-today, kal-day (Tag wählen) */
function kalAction(p, act, t) {
  const S = kalState(p), today = midnight(new Date());
  const show = (ref) => {
    S.ref = new Date(ref.getFullYear(), ref.getMonth(), 1);
    S.sel = S.ref.getFullYear() === today.getFullYear() && S.ref.getMonth() === today.getMonth() ? today : new Date(S.ref);
  };
  if (act === "kal-shift") show(new Date(S.ref.getFullYear(), S.ref.getMonth() + (Number(t.dataset.d) || 0), 1));
  else if (act === "kal-today") show(today);
  else if (act === "kal-day") {
    const d = fromYmd(t.dataset.day);
    if (!d) return;
    if (d.getMonth() !== S.ref.getMonth() || d.getFullYear() !== S.ref.getFullYear()) S.ref = new Date(d.getFullYear(), d.getMonth(), 1);
    S.sel = d;
  } else return;
  p._dirty = true;
  p._flush();
}

export { kalAction, kalCals, kalOn, kalPageHTML, kalRange, PALETTE };
