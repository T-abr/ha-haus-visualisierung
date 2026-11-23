/* Haus Visualisierung – Rückblick: Monat gegen Vormonat und Vorjahresmonat (Energie, Kosten, Klima), Rekorde des Jahres. */

import { icon, NF0, NF1, setHidden, setHtml, setText } from "./grundlagen.js";
import { finite, tsMs } from "./verlauf.js";
import { climRooms, outdoorTempId } from "./klima.js";
import { priceCfg, unitFactor } from "./strompreis.js";

/* Daten aus der Langzeitstatistik des Recorders (nur Sensoren mit state_class):
   - je Zeitraum (Monat, Vormonat, Vorjahresmonat) eine Abfrage der Stundenmittel. Leistung in W je Stunde ergibt Wh;
     Netz stündlich, damit Bezug und Einspeisung getrennt bleiben. Kosten = Bezug je Stunde × Preis dieser Stunde
     (Stundenmittel des Preissensors, sonst fester Preis), Vergütung = Einspeisung × Einspeisepreis.
   - für die Rekorde eine Abfrage der Tagesmittel ab 1. Januar.
   Im laufenden Monat werden gleich lange Abschnitte verglichen (1. bis heute, bis zur letzten vollen Stunde),
   vergangene Monate ganz. Abgerufen wird nur beim Öffnen der Seite und beim Blättern; kein Neuzeichnen je Messwert. */
const NF2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const HOUR = 3600000;
const RB_TTL = 30 * 60 * 1000;
const RB_MIN = -36; // höchstens drei Jahre zurück
const CACHE = new Map(); // Abfrage → { at, rows, loading }
let OFF = 0; // 0 = dieser Monat, −1 = Vormonat …

/** Sensoren für den Rückblick; null = nichts zu zeigen. */
function rbCfg(ctx) {
  const m = ctx._model, h = ctx._hass, c = m.energy;
  const out = outdoorTempId(h, m, ctx._layout || {});
  const rooms = climRooms(m).map((a) => a.tempId).filter(Boolean);
  if (!c && !out && !rooms.length) return null;
  const p = m.price || priceCfg(h, ctx._layout || {});
  const st = p.sensor ? h.states[p.sensor] : null;
  return { c, out, rooms, price: st ? p.sensor : "", pf: st ? unitFactor(st.attributes.unit_of_measurement) : null, fixed: p.fixed, feedIn: p.feedIn, add: p.add };
}

const addMonths = (t, k) => { const d = new Date(t); d.setMonth(d.getMonth() + k); return d.getTime(); };
const monthStart = (now, off) => { const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + off); return d.getTime(); };

/** Drei Zeiträume [Beginn, Ende): gewählter Monat, Vormonat, Vorjahresmonat. */
function rbWindows(off, now = Date.now()) {
  const m0 = monthStart(now, off), part = off === 0;
  const cut = Math.floor(now / HOUR) * HOUR, nd = new Date(cut);
  return [0, 1, 12].map((k) => {
    const a = addMonths(m0, -k), full = addMonths(a, 1);
    if (!part) return { a, e: full, part: false };
    // gleicher Tag und gleiche Uhrzeit wie jetzt, höchstens bis Monatsende
    const ad = new Date(a), dim = new Date(ad.getFullYear(), ad.getMonth() + 1, 0).getDate();
    const e = nd.getDate() > dim ? full : new Date(ad.getFullYear(), ad.getMonth(), nd.getDate(), nd.getHours()).getTime();
    return { a, e: Math.min(full, Math.max(a, e)), part: true };
  });
}

/** Statistik laden (gesammelt, zwischengespeichert); cb nach dem Laden. Ergebnis: Zeilen oder null während des Ladens. */
function rbStats(h, ids, a, e, period, cb) {
  const key = `${period}|${a}|${e}|${ids.join(",")}`, now = Date.now();
  let r = CACHE.get(key);
  // abgeschlossene Zeiträume bleiben, solange die Seite offen ist; laufende werden nach 30 Minuten neu geholt
  if ((!r || (!r.loading && e > now - HOUR && now - r.at > RB_TTL)) && h.callWS) {
    r = { at: now, rows: {}, loading: true };
    CACHE.set(key, r);
    h.callWS({ type: "recorder/statistics_during_period", start_time: new Date(a).toISOString(), end_time: new Date(e).toISOString(),
      statistic_ids: ids, period, types: ["mean"], units: { power: "W", temperature: "°C" } })
      .then((res) => { r.rows = res || {}; }).catch(() => { r.rows = {}; })
      .finally(() => { r.loading = false; r.at = Date.now(); cb(); });
  }
  return !r || r.loading ? null : r.rows;
}

/** Zeilen eines Sensors als [Zeit, Mittel], auf den Zeitraum beschränkt. */
const rowsOf = (rows, eid, a, e) => (eid && rows[eid] ? rows[eid].map((x) => [tsMs(x.start), x.mean]).filter(([t, v]) => finite(t) && finite(v) && t >= a && t < e) : []);

/** Kennzahlen eines Zeitraums aus Stundenmitteln. */
function rbFigures(cfg, rows, w) {
  const { c } = cfg, R = (eid) => rowsOf(rows, eid, w.a, w.e);
  const sum = (pts, f) => (pts.length ? pts.reduce((s, [, v]) => s + f(v), 0) : null);
  const F = { pv: null, use: null, imp: null, exp: null, autark: null, cost: null, net: null, out: null, inn: null, hdd: null, cov: 1 };
  const hrs = Math.max(1, (w.e - w.a) / HOUR);
  if (c) {
    const pv = R(c.pv), house = R(c.house), bat = R(c.bat), grid = R(c.grid);
    F.pv = sum(pv, (v) => Math.max(0, v));
    const houseWh = sum(house, (v) => Math.max(0, v)), batWh = sum(bat, (v) => (c.batInv ? -v : v));
    if (grid.length) {
      const price = new Map(R(cfg.price).map(([t, v]) => [t, cfg.pf !== null ? v * cfg.pf + cfg.add : null]));
      let imp = 0, exp = 0, net = 0, cost = 0;
      for (const [t, v] of grid) {
        const g = c.gridInv ? -v : v, i = Math.max(0, g);
        imp += i; exp += Math.max(0, -g); net += g;
        const p = price.get(t);
        cost += (i / 1000) * (finite(p) ? p : cfg.fixed);
      }
      Object.assign(F, { imp, exp, cost, net: cost - (exp / 1000) * cfg.feedIn });
      if (!c.house) F.use = Math.max(0, (F.pv || 0) + net - (batWh || 0));
    }
    if (c.house) F.use = houseWh;
    if (F.use && F.imp !== null) F.autark = Math.max(0, Math.min(1, 1 - F.imp / F.use));
    const n = Math.max(pv.length, house.length, grid.length);
    if (n) F.cov = n / hrs;
  }
  const out = R(cfg.out);
  if (out.length) {
    F.out = out.reduce((s, [, v]) => s + v, 0) / out.length;
    // Heizgradtage (20/15): Tage mit Mittel unter 15 °C zählen mit 20 °C minus Tagesmittel
    const days = new Map();
    for (const [t, v] of out) { const d = new Date(t); d.setHours(0, 0, 0, 0); const k = d.getTime(), x = days.get(k) || [0, 0]; x[0] += v; x[1]++; days.set(k, x); }
    F.hdd = [...days.values()].filter(([, n]) => n >= 12).reduce((s, [v, n]) => s + (v / n < 15 ? 20 - v / n : 0), 0);
  }
  // Ø innen: je Stunde das Mittel der Räume, darüber das Mittel
  const byHour = new Map();
  for (const e of cfg.rooms) for (const [t, v] of R(e)) { const x = byHour.get(t) || [0, 0]; x[0] += v; x[1]++; byHour.set(t, x); }
  if (byHour.size) F.inn = [...byHour.values()].reduce((s, [v, n]) => s + v / n, 0) / byHour.size;
  return F;
}

/* ---------- Zeilen der Tabelle: Schlüssel, Name, Einheit, Format, Vergleich, besser wenn ---------- */
const kwh = (wh) => { const v = wh / 1000; return Math.abs(v) >= 100 ? NF0.format(v) : NF1.format(v); };
const eur = (v) => (Math.abs(v) >= 1000 ? NF0.format(v) : NF2.format(v));
/** Vorzeichen nach dem gerundeten Betrag: was als 0 erscheint, bekommt ±. */
const sign = (v, s) => `${/^[0,\s]+[^0-9]*$/.test(s) ? "±" : v > 0 ? "+" : v < 0 ? "−" : "±"}${s}`;
const pct = (cur, ref) => (Math.abs(ref) < 50 ? null : { v: cur / ref - 1, t: sign(cur - ref, `${NF0.format(Math.abs(Math.round((cur / ref - 1) * 100)))} %`) });
const ROWS = [
  ["en", "Energie"],
  ["pv", "PV erzeugt", "kWh", kwh, pct, 1],
  ["use", "Verbrauch", "kWh", kwh, pct, -1],
  ["imp", "Netzbezug", "kWh", kwh, pct, -1],
  ["exp", "Einspeisung", "kWh", kwh, pct, 0],
  ["autark", "Autarkie", "%", (v) => NF0.format(Math.round(v * 100)), (c, r) => ({ v: c - r, t: sign(c - r, `${NF0.format(Math.abs(Math.round((c - r) * 100)))} Pp.`) }), 1],
  ["cost", "Stromkosten", "€ Netzbezug", eur, (c, r) => ({ v: c - r, t: sign(c - r, `${NF2.format(Math.abs(c - r))} €`) }), -1],
  ["net", "Bilanz", "€ Kosten − Vergütung", eur, (c, r) => ({ v: c - r, t: sign(c - r, `${NF2.format(Math.abs(c - r))} €`) }), -1],
  ["kl", "Klima"],
  ["out", "Ø außen", "°C", (v) => NF1.format(v), (c, r) => ({ v: c - r, t: sign(c - r, `${NF1.format(Math.abs(c - r))} K`) }), 0],
  ["inn", "Ø innen", "°C", (v) => NF1.format(v), (c, r) => ({ v: c - r, t: sign(c - r, `${NF1.format(Math.abs(c - r))} K`) }), 0],
  ["hdd", "Heizgradtage", "Kd (20/15)", (v) => NF0.format(v), (c, r) => (r < 5 ? null : { v: c / r - 1, t: sign(c - r, `${NF0.format(Math.abs(Math.round((c / r - 1) * 100)))} %`) }), 0],
];

const monthName = (t, long = true) => new Date(t).toLocaleDateString("de-DE", long ? { month: "long", year: "numeric" } : { month: "long" });
function colHead(w, role, k) {
  const d = new Date(w.a);
  if (!w.part) return `<small>${role}</small><span>${k === 12 ? `${MON[d.getMonth()]} ${d.getFullYear()}` : monthName(w.a, false)}</span>`;
  const last = new Date(w.e - 1);
  return `<small>${role}${k === 12 ? ` ${d.getFullYear()}` : ""}</small><span>${last.getDate() > 1 ? `1.–${last.getDate()}.` : "1."} ${MON[d.getMonth()]}</span>`;
}

function rbTableHTML(cfg, W, F) {
  const has = (k) => F.some((f) => f && f[k] !== null);
  const roles = ["Dieser Monat", "Vormonat", "Vorjahr"];
  if (OFF !== 0) roles[0] = "Monat";
  let html = `<div class="rbr rbhd"><span></span>${W.map((w, i) => `<span class="rbc">${colHead(w, roles[i], [0, 1, 12][i])}</span>`).join("")}</div>`;
  let sec = "";
  for (const [k, name, unit, fmt, cmp, dir] of ROWS) {
    if (!unit) { sec = `<div class="rbsec">${name}</div>`; continue; }
    if (!has(k)) continue;
    if (sec) { html += sec; sec = ""; }
    const cur = F[0] && F[0][k];
    const cells = F.map((f, i) => {
      const v = f ? f[k] : null;
      if (v === null) return `<span class="rbc"><b>–</b></span>`;
      let d = "";
      if (i > 0 && cur !== null) {
        const x = cmp(cur, v);
        if (x) d = `<em class="${dir && Math.abs(x.v) > 0.005 ? (x.v * dir > 0 ? "good" : "bad") : ""}" title="dieser Monat gegenüber ${roles[i]}">${x.t}</em>`;
      }
      return `<span class="rbc${f.cov < 0.9 ? " part" : ""}"${f.cov < 0.9 ? ` title="nur ${NF0.format(Math.round(f.cov * 100))} % der Stunden mit Daten"` : ""}><b>${fmt(v)}</b>${d}</span>`;
    }).join("");
    html += `<div class="rbr" data-k="${k}"><span class="rbl">${name}<small>${unit}</small></span>${cells}</div>`;
  }
  return html;
}

/* ---------- Rekorde des Jahres aus Tagesmitteln ---------- */
function rbRecords(cfg, rows, year) {
  const c = cfg.c, today = new Date(); today.setHours(0, 0, 0, 0);
  const a = new Date(year, 0, 1).getTime(), e = Math.min(new Date(year + 1, 0, 1).getTime(), today.getTime());
  const day = (eid) => rowsOf(rows, eid, a, e);
  const best = (pts, f) => pts.reduce((b, p) => (!b || f(p[1], b[1]) ? p : b), null);
  const dTxt = (t) => { const d = new Date(t); return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };
  const R = [];
  if (c && c.pv) {
    const pv = day(c.pv);
    const b = best(pv, (x, y) => x > y);
    if (b && b[1] > 0) R.push(["Bester PV-Tag", `${kwh(b[1] * 24)} kWh`, dTxt(b[0]), "pv"]);
    const mon = new Map();
    for (const [t, v] of pv) { const m = new Date(t).getMonth(); mon.set(m, (mon.get(m) || 0) + Math.max(0, v) * 24); }
    const bm = [...mon.entries()].reduce((x, y) => (!x || y[1] > x[1] ? y : x), null);
    if (bm && bm[1] > 0 && mon.size > 1) R.push(["Bester PV-Monat", `${kwh(bm[1])} kWh`, monthName(new Date(year, bm[0], 1).getTime(), false), "pv"]);
  }
  if (c && c.house) {
    const b = best(day(c.house), (x, y) => x > y);
    if (b) R.push(["Höchster Verbrauch", `${kwh(b[1] * 24)} kWh`, dTxt(b[0]), "use"]);
  }
  if (cfg.out) {
    const o = day(cfg.out), hi = best(o, (x, y) => x > y), lo = best(o, (x, y) => x < y);
    if (hi) R.push(["Wärmster Tag", `Ø ${NF1.format(hi[1])} °C`, dTxt(hi[0]), "warm"]);
    if (lo) R.push(["Kältester Tag", `Ø ${NF1.format(lo[1])} °C`, dTxt(lo[0]), "cold"]);
  }
  return R;
}

/* ---------- Karte ---------- */
function rbCardHTML() {
  return `<div class="glass rback" data-u="rback">
    <div class="trh"><span class="trt">${icon("mdi:calendar-month-outline")}Rückblick</span>
      <span class="rbnav"><button class="pbtn sm" data-act="rb-month" data-d="-1" title="Monat zurück" aria-label="Monat zurück">${icon("mdi:chevron-left")}</button><b class="rbm"></b><button class="pbtn sm" data-act="rb-month" data-d="1" title="Monat vor" aria-label="Monat vor">${icon("mdi:chevron-right")}</button></span></div>
    <div class="rbtab"></div>
    <div class="rbmsg">${icon("mdi:loading", "spin")}Lade Rückblick …</div>
    <div class="rbrecw" hidden><div class="trh"><span class="trt">${icon("mdi:trophy-outline")}<span class="rbry">Rekorde</span></span></div><div class="ctstats rbrec"></div></div>
    <div class="enhint rbnote"></div></div>`;
}

function updateRback(el, ctx) {
  const cfg = rbCfg(ctx), h = ctx._hass;
  if (!cfg) return;
  const now = Date.now(), W = rbWindows(OFF, now);
  setText(el, ".rbm", monthName(W[0].a));
  const nx = el.querySelector('[data-d="1"]'), pv = el.querySelector('[data-d="-1"]');
  if (nx) nx.disabled = OFF >= 0;
  if (pv) pv.disabled = OFF <= RB_MIN;
  const c = cfg.c;
  const ids = [...new Set([c && c.pv, c && c.house, c && c.bat, c && c.grid, cfg.price, cfg.out, ...cfg.rooms].filter(Boolean))];
  const again = () => { if (el.isConnected) updateRback(el, ctx); };
  const rows = W.map((w) => (w.e > w.a ? rbStats(h, ids, w.a, w.e, "hour", again) : {}));
  const year = new Date(W[0].a).getFullYear();
  const dIds = [c && c.pv, c && c.house, cfg.out].filter(Boolean);
  const ya = new Date(year, 0, 1).getTime(), ye = Math.min(new Date(year + 1, 0, 1).getTime(), new Date(now).setHours(0, 0, 0, 0));
  const drows = dIds.length && ye > ya ? rbStats(h, dIds, ya, ye, "day", again) : {};
  const msg = el.querySelector(".rbmsg");
  if (rows.some((r) => r === null)) { setHidden(msg, false); setHtml(msg, `${icon("mdi:loading", "spin")}Lade Rückblick …`); return; }
  const F = W.map((w, i) => (w.e > w.a ? rbFigures(cfg, rows[i], w) : null));
  const any = F.some((f) => f && ROWS.some(([k, , u]) => u && f[k] !== null));
  el._rb = { W, F };
  if (!any) {
    setHtml(el.querySelector(".rbtab"), "");
    setHidden(msg, false);
    setHtml(msg, `${icon("mdi:chart-line-variant")}Keine Langzeitstatistik für ${monthName(W[0].a)} (Sensoren brauchen state_class).`);
  } else {
    setHidden(msg, true);
    setHtml(el.querySelector(".rbtab"), rbTableHTML(cfg, W, F));
  }
  const notes = [];
  if (W[0].part) notes.push("Verglichen werden gleich lange Abschnitte bis zur letzten vollen Stunde.");
  if (F.some((f) => f && f.cov < 0.9)) notes.push("Grau: Zeitraum nur teilweise aufgezeichnet.");
  if (c && c.grid && !cfg.price) notes.push(`Kosten mit festem Preis ${NF1.format(cfg.fixed * 100)} ct/kWh.`);
  setText(el, ".rbnote", notes.join(" "));
  const box = el.querySelector(".rbrecw");
  const R = drows ? rbRecords(cfg, drows, year) : [];
  setHidden(box, !R.length);
  if (R.length) {
    setText(el, ".rbry", `Rekorde ${year}`);
    setHtml(el.querySelector(".rbrec"), R.map(([l, v, s, k]) => `<span class="cts rec ${k}"><small>${l}</small><b>${v}</b><em>${s}</em></span>`).join(""));
  }
}

/** Monat blättern (Aktion rb-month). */
function rbShift(el, ctx, d) {
  OFF = Math.max(RB_MIN, Math.min(0, OFF + d));
  updateRback(el, ctx);
}

const rbCard = (ctx) => (rbCfg(ctx) ? rbCardHTML() : "");

export { rbCard, rbCfg, rbFigures, rbShift, rbWindows, updateRback };
