/* Haus Visualisierung – Strompreis: Preissensor (dynamisch) oder fester Preis, Kosten heute, günstige Zeitfenster. */

import { esc, icon, NF0, NF1, num, powerW, setHidden, setHtml, setText } from "./grundlagen.js";
import { finite, TREND_BUCKET } from "./verlauf.js";

/* ---------- Preissensor erkennen ---------- */
/* Erkannt wird ein Sensor mit Einheit „…/kWh“ oder „…/MWh“ (z. B. Tibber, Nordpool, EPEX Spot, Energi Data Service, evcc).
   Vorhersagen liest die Seite aus den üblichen Attributen: Nordpool raw_today/raw_tomorrow bzw. today/tomorrow,
   EPEX Spot data, Tibber-Varianten prices/today/tomorrow. Alle Preise intern in €/kWh. */
const NF2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NAME_RE = /(tibber|nordpool|epex|awattar|energi|strompreis|electricity.?price|energy.?price|current.?price|spot|tarif|tariff|price|preis)/i;
const SKIP_RE = /(feed.?in|einspeis|export|sell|verkauf|min|max|average|avg|durchschnitt|mittel|median|cheap|günstig|expensive|teuer|cost|kosten|monthly|monat|daily|tages)/i;
const LIST_KEYS = ["raw_today", "raw_tomorrow", "data", "prices", "forecast", "prices_today", "prices_tomorrow", "today", "tomorrow"];
const TIME_KEYS = ["start", "start_time", "startsAt", "starts_at", "from", "time", "datetime", "hour"];
const END_KEYS = ["end", "end_time", "endsAt", "ends_at", "till", "to"];
// Schlüssel mit eigener Einheit (Faktor auf €/kWh) und solche in der Einheit des Sensors (null)
const VAL_KEYS = [["price_ct_per_kwh", 0.01], ["price_eur_per_mwh", 0.001], ["price_per_kwh", null], ["total", null], ["value", null], ["price", null], ["marketprice", null]];
const LEVEL = { VERY_CHEAP: "billig", CHEAP: "billig", NORMAL: "mittel", EXPENSIVE: "teuer", VERY_EXPENSIVE: "teuer" };
const LEVEL_TXT = { billig: "günstig", mittel: "mittel", teuer: "teuer" };

/** Faktor von der Einheit des Sensors auf €/kWh; null = kein Preis. */
function unitFactor(u) {
  const s = String(u || "").replace(/\s+/g, "").toLowerCase();
  if (!/\/(k|m)wh$/.test(s)) return null;
  return (/^(ct|cent|c|¢|öre|ore|øre|p)\//.test(s) ? 0.01 : 1) / (/\/mwh$/.test(s) ? 1000 : 1);
}

const hasList = (st) => LIST_KEYS.some((k) => Array.isArray(st.attributes[k]) && st.attributes[k].length);

/** Einstellungen und Preissensor (ausgewählt oder automatisch erkannt). */
function priceCfg(h, L) {
  const P = L.price || {};
  const isPrice = (e) => e && e.startsWith("sensor.") && h.states[e] && unitFactor(h.states[e].attributes.unit_of_measurement) !== null;
  let sensor = "", auto = false;
  if (P.use_sensor !== false) {
    if (P.sensor && h.states[P.sensor]) sensor = P.sensor;
    else {
      const lbl = (e) => `${e} ${h.states[e].attributes.friendly_name || ""}`;
      const cand = Object.keys(h.states).filter((e) => isPrice(e) && !SKIP_RE.test(lbl(e)));
      const score = (e) => (hasList(h.states[e]) ? 2 : 0) + (NAME_RE.test(lbl(e)) ? 1 : 0);
      cand.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
      sensor = cand[0] || ""; auto = !!sensor;
    }
  }
  const ct = (v, d) => (finite(Number(v)) ? Number(v) / 100 : d);
  return { sensor, auto, fixed: ct(P.fixed_ct, 0.3), feedIn: ct(P.feed_in_ct, 0.08), add: ct(P.surcharge_ct, 0), hours: Math.max(1, Math.min(12, Math.round(Number(P.window_h) || 3))) };
}
const priceWatch = (p) => (p && p.sensor ? [p.sensor] : []);

const tms = (v) => {
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  const t = Date.parse(v);
  return finite(t) ? t : null;
};

/** Zeitfenster mit Preis aus den Attributen: [{s, e, p}] in €/kWh (ohne Aufschlag), sortiert. */
function priceSlots(st) {
  if (!st) return [];
  const f = unitFactor(st.attributes.unit_of_measurement) ?? 1, sv = num(st);
  // Werte ohne eigene Einheit: Faktor so wählen, dass sie zum Zustand des Sensors passen (manche Integrationen
  // melden den Zustand in ct/kWh, die Liste aber in €/kWh oder umgekehrt)
  const fit = (vals) => {
    const v = vals.filter((x) => finite(x) && x > 0).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)];
    if (!med || sv === null || sv <= 0) return f;
    return [f, 1, 0.01, 0.001].reduce((b, c) => (Math.abs(Math.log((med * c) / (sv * f))) < Math.abs(Math.log((med * b) / (sv * f))) ? c : b), f);
  };
  const raw = [];
  for (const k of LIST_KEYS) {
    const arr = st.attributes[k];
    if (!Array.isArray(arr) || !arr.length) continue;
    if (arr.every((v) => v === null || typeof v === "number")) {
      // Nordpool today/tomorrow: Zahlen ab Mitternacht, gleich lange Abschnitte
      if (k !== "today" && k !== "tomorrow") continue;
      const d = new Date(); d.setHours(0, 0, 0, 0);
      if (k === "tomorrow") d.setDate(d.getDate() + 1);
      const d1 = new Date(d); d1.setDate(d1.getDate() + 1);
      const len = (d1 - d) / arr.length, ff = fit(arr);
      arr.forEach((v, i) => { if (finite(v)) raw.push({ s: d.getTime() + i * len, e: d.getTime() + (i + 1) * len, p: v * ff }); });
      continue;
    }
    const items = [];
    for (const o of arr) {
      if (!o || typeof o !== "object") continue;
      const tk = TIME_KEYS.find((x) => o[x] !== undefined), s = tk ? tms(o[tk]) : null;
      if (s === null) continue;
      const ek = END_KEYS.find((x) => o[x] !== undefined), e = ek ? tms(o[ek]) : null;
      const vk = VAL_KEYS.find(([x]) => finite(Number(o[x])) && o[x] !== null && o[x] !== "");
      if (!vk) continue;
      items.push({ s, e, v: Number(o[vk[0]]), c: vk[1] });
    }
    const ff = fit(items.filter((x) => x.c === null).map((x) => x.v));
    for (const x of items) raw.push({ s: x.s, e: x.e, p: x.v * (x.c ?? ff) });
  }
  raw.sort((a, b) => a.s - b.s);
  const out = [];
  for (const r of raw) if (!out.length || r.s > out[out.length - 1].s) out.push(r);
  // fehlendes Ende: nächster Beginn bzw. übliche Länge
  const gaps = out.slice(1).map((r, i) => r.s - out[i].s).filter((d) => d > 0).sort((a, b) => a - b);
  const typ = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 3600000;
  out.forEach((r, i) => { if (!r.e || r.e <= r.s) r.e = i + 1 < out.length && out[i + 1].s - r.s <= typ * 1.5 ? out[i + 1].s : r.s + typ; });
  return out;
}

/** Alles, was die Anzeige braucht; zwischengespeichert je Zustand des Sensors. */
function priceInfo(h, p) {
  const st = p && p.sensor ? h.states[p.sensor] : null;
  // neu gerechnet bei neuem Zustandsobjekt, sonst höchstens jede Minute (laufender Abschnitt, günstigstes Fenster)
  if (p._info && p._info.st === st && Date.now() - p._info.at < 60000) return p._info;
  const key = `${st ? st.last_updated + st.state : "fix"}|${Date.now()}`;
  const slots = st ? priceSlots(st).map((r) => ({ ...r, p: r.p + p.add })) : [];
  const now = Date.now(), at = (t) => { const r = slots.find((x) => x.s <= t && t < x.e); return r ? r.p : null; };
  const f = st ? unitFactor(st.attributes.unit_of_measurement) : null, sv = num(st);
  const cur = at(now) ?? (sv !== null && f !== null ? sv * f + p.add : null);
  // Vergleich: Preise von heute und kommende (höchstens 36 h)
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const ref = slots.filter((r) => r.e > mid.getTime() && r.s < now + 36 * 3600000).map((r) => r.p);
  let level = null;
  if (cur !== null && ref.length >= 4) {
    const lo = Math.min(...ref), hi = Math.max(...ref), q = hi - lo < 0.005 ? 0.5 : (cur - lo) / (hi - lo);
    level = q <= 0.33 ? "billig" : q >= 0.67 ? "teuer" : "mittel";
  } else if (st && LEVEL[String(st.attributes.price_level || st.attributes.level || "").toUpperCase()]) {
    level = LEVEL[String(st.attributes.price_level || st.attributes.level).toUpperCase()];
  }
  const today = slots.filter((r) => r.s >= mid.getTime() && r.s < mid.getTime() + 86400000);
  p._info = { key, st, at: now, slots, cur, dyn: !!st, level, priceAt: at, best: bestWindow(slots, p.hours, now),
    avg: today.length ? today.reduce((s, r) => s + r.p * (r.e - r.s), 0) / today.reduce((s, r) => s + (r.e - r.s), 0) : null };
  return p._info;
}

/** Günstigstes zusammenhängendes Fenster von `hours` Stunden ab jetzt (zeitgewichteter Mittelwert). */
function bestWindow(slots, hours, now) {
  const len = hours * 3600000, fut = slots.filter((r) => r.e > now);
  if (!fut.length) return null;
  let best = null;
  for (let i = 0; i < fut.length; i++) {
    const s = Math.max(fut[i].s, now), e = s + len;
    let sum = 0, cov = 0, t = s;
    for (let j = i; j < fut.length && t < e; j++) {
      const r = fut[j];
      if (r.s > t + 60000) break; // Lücke
      const d = Math.min(r.e, e) - t;
      sum += r.p * d; cov += d; t += d;
    }
    if (cov < len - 60000) continue;
    const avg = sum / cov;
    if (!best || avg < best.avg - 1e-6) best = { s, e, avg };
  }
  return best;
}

/* ---------- Text ---------- */
const ctTxt = (v) => (v === null ? "–" : `${NF1.format(v * 100)} ct`);
const eurTxt = (v) => (v === null ? "–" : `${NF2.format(v)} €`);
const hhmm = (t) => { const d = new Date(t); return d.getMinutes() ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : `${d.getHours()}`; };
function dayWord(t) {
  const d = new Date(t), n = new Date(); d.setHours(0, 0, 0, 0); n.setHours(0, 0, 0, 0);
  const k = Math.round((d - n) / 86400000);
  return k === 0 ? "heute" : k === 1 ? "morgen" : d.toLocaleDateString("de-DE", { weekday: "short" });
}
function windowTxt(w, now = Date.now()) {
  if (!w) return "";
  const from = w.s <= now + 60000 ? "jetzt" : `${dayWord(w.s)} ${hhmm(w.s)}`;
  return `${from}–${hhmm(w.e)} Uhr`;
}

/* ---------- Energie-Seite: Karte „Strompreis und Kosten“ ---------- */
function enPriceHTML() {
  return `<div class="glass enprice" data-u="enprice">
    <div class="trh"><span class="trt">${icon("mdi:currency-eur")}Strompreis</span><span class="enhint enpsrc"></span></div>
    <div class="ctstats enpnow"></div>
    <div class="enpbars" hidden><div class="enpb"></div><div class="enpx"></div></div>
    <div class="trh enpch"><span class="trt">${icon("mdi:cash-multiple")}Kosten heute</span><span class="enhint">seit Mitternacht, Netzbezug × Preis</span></div>
    <div class="ctstats enpcost"><span class="cts"><small>Kosten</small><b>–</b><em>Lade Verlauf …</em></span></div></div>`;
}

/** Kosten seit Mitternacht aus den 5-Minuten-Reihen (W) der Energie-Seite. */
function costToday(E, info, p, hist) {
  const { pv, grid, bat } = E.S, n = grid ? grid.length : 0;
  if (!n) return null;
  const mid = new Date(E.now); mid.setHours(0, 0, 0, 0);
  const k0 = Math.max(0, Math.ceil((mid.getTime() - E.start) / TREND_BUCKET)), dt = TREND_BUCKET / 3600000 / 1000;
  let cost = 0, earn = 0, saved = 0, imp = 0, any = false;
  for (let k = k0; k < n; k++) {
    const g = grid[k];
    if (!finite(g)) continue;
    const t = Math.min(E.now, E.start + k * TREND_BUCKET);
    const pr = info.priceAt(t) ?? (hist && finite(hist[k]) ? hist[k] + p.add : null) ?? info.cur ?? p.fixed;
    const tot = Math.max(0, (pv && finite(pv[k]) ? Math.max(0, pv[k]) : 0) + g - (bat && finite(bat[k]) ? bat[k] : 0));
    const i = Math.max(0, g), x = Math.max(0, -g);
    cost += i * dt * pr; imp += i * dt; earn += x * dt * p.feedIn; saved += Math.max(0, tot - i) * dt * pr; any = true;
  }
  return any ? { cost, earn, saved, imp, avg: imp > 0.05 ? cost / imp : null } : null;
}

function updateEnPrice(el, ctx, E, hist) {
  const p = ctx._model.price, h = ctx._hass;
  if (!p) return;
  const info = priceInfo(h, p), now = Date.now();
  const stat = (lbl, val, sub = "", cls = "") => `<span class="cts${cls ? ` ${cls}` : ""}"><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ""}</span>`;
  setText(el, ".enpsrc", info.dyn ? `${h.states[p.sensor].attributes.friendly_name || p.sensor}${p.auto ? " (automatisch erkannt)" : ""}` : "fester Preis · in den Einstellungen änderbar");
  setHtml(el.querySelector(".enpnow"), info.dyn ? [
    stat("Jetzt", `${ctTxt(info.cur)}/kWh`, info.level ? LEVEL_TXT[info.level] : "", info.level ? `plv ${info.level}` : ""),
    info.avg !== null ? stat("Ø heute", `${ctTxt(info.avg)}/kWh`) : "",
    info.best ? stat(`Günstigste ${p.hours} h`, windowTxt(info.best, now), `Ø ${ctTxt(info.best.avg)}/kWh`, "best") : stat(`Günstigste ${p.hours} h`, "–", info.slots.length ? `noch keine Preise für die nächsten ${p.hours} h` : "Sensor liefert keine Preise für später"),
  ].join("") : stat("Fester Preis", `${ctTxt(p.fixed)}/kWh`, `Einspeisung ${ctTxt(p.feedIn)}/kWh`));
  drawBars(el.querySelector(".enpbars"), info, now);
  if (!E) return;
  const C = costToday(E, info, p, hist);
  setHtml(el.querySelector(".enpcost"), C ? [
    stat("Netzbezug", eurTxt(C.cost), `${NF1.format(C.imp)} kWh${C.avg !== null && info.dyn ? ` · Ø ${ctTxt(C.avg)}` : ""}`),
    stat("Einspeisung", `+${eurTxt(C.earn)}`, `zu ${ctTxt(p.feedIn)}/kWh`),
    stat("Gespart", eurTxt(C.saved), "eigener Strom statt Netz", "saved"),
    stat("Bilanz", eurTxt(C.cost - C.earn), "Bezug minus Vergütung"),
  ].join("") : stat("Kosten", "–", "Noch kein Verlauf aufgezeichnet (Recorder)."));
}

/** Balken der Preise ab der laufenden Stunde, günstigstes Fenster hervorgehoben. */
function drawBars(box, info, now) {
  const from = Math.floor(now / 3600000) * 3600000, sl = info.slots.filter((r) => r.e > from).slice(0, 200);
  const show = sl.length >= 4;
  setHidden(box, !show);
  if (!show) return;
  const sig = `${info.key}|${Math.floor(now / 300000)}`;
  if (box._sig === sig) return;
  box._sig = sig;
  const t0 = sl[0].s, t1 = sl[sl.length - 1].e, span = t1 - t0;
  const lo = Math.min(0, ...sl.map((r) => r.p)), hi = Math.max(...sl.map((r) => r.p), lo + 0.01);
  const ps = sl.map((r) => r.p).sort((a, b) => a - b), q1 = ps[Math.floor(ps.length / 3)], q2 = ps[Math.floor((ps.length * 2) / 3)];
  const b = info.best;
  setHtml(box.querySelector(".enpb"), sl.map((r) => {
    const cls = [r.p <= q1 ? "billig" : r.p >= q2 ? "teuer" : "mittel", r.s <= now && now < r.e ? "now" : "", b && r.e > b.s && r.s < b.e ? "best" : ""].filter(Boolean).join(" ");
    return `<i class="${cls}" style="left:${(((r.s - t0) / span) * 100).toFixed(2)}%;width:${(((r.e - r.s) / span) * 100).toFixed(2)}%;height:${Math.max(3, ((r.p - lo) / (hi - lo)) * 100).toFixed(1)}%" title="${esc(`${dayWord(r.s)} ${hhmm(r.s)} Uhr: ${ctTxt(r.p)}/kWh`)}"></i>`;
  }).join(""));
  const tk = [];
  for (let t = Math.ceil(t0 / 3600000) * 3600000; t < t1; t += 3600000) if (new Date(t).getHours() % 6 === 0) tk.push(t);
  setHtml(box.querySelector(".enpx"), tk.map((t) => `<span style="left:${(((t - t0) / span) * 100).toFixed(2)}%">${new Date(t).getHours() === 0 ? dayWord(t) : `${new Date(t).getHours()} Uhr`}</span>`).join(""));
}

/* ---------- Wallbox: Preis jetzt, günstiges Fenster, was das Laden gerade kostet ---------- */
function wbPriceHTML() {
  return `<div class="wbprice" data-u="wbprice"></div>`;
}

function updateWbPrice(el, ctx) {
  const p = ctx._model.price, wb = ctx._model.tech && ctx._model.tech.wb, h = ctx._hass;
  if (!p || !wb) { setHtml(el, ""); return; }
  const info = priceInfo(h, p), c = ctx._model.energy;
  const wbW = powerW(h.states[wb.power]);
  let gridW = c && c.grid ? powerW(h.states[c.grid]) : null;
  if (gridW !== null && c.gridInv) gridW = -gridW;
  const pr = info.cur ?? p.fixed, parts = [];
  parts.push(`<span class="wbp${info.level ? ` plv ${info.level}` : ""}">${icon("mdi:currency-eur")}<b>${ctTxt(pr)}/kWh</b>${info.level ? ` ${LEVEL_TXT[info.level]}` : info.dyn ? "" : " fest"}</span>`);
  if (info.best) parts.push(`<span class="wbp best">${icon("mdi:clock-check-outline")}Günstig laden <b>${windowTxt(info.best)}</b> · Ø ${ctTxt(info.best.avg)}</span>`);
  if (wbW !== null && wbW > 50) {
    const fromGrid = gridW === null ? wbW : Math.max(0, Math.min(wbW, gridW));
    parts.push(fromGrid < 50 ? `<span class="wbp own">${icon("mdi:solar-power-variant")}Lädt gerade mit eigenem Strom</span>`
      : `<span class="wbp">${icon("mdi:cash-clock")}Laden kostet gerade <b>${eurTxt((fromGrid / 1000) * pr)}/h</b>${gridW !== null && fromGrid < wbW - 50 ? ` (${NF0.format(Math.round((fromGrid / wbW) * 100))} % aus dem Netz)` : ""}</span>`);
  }
  setHtml(el, parts.join(""));
}

export { costToday, enPriceHTML, priceCfg, priceInfo, priceSlots, priceWatch, unitFactor, updateEnPrice, updateWbPrice, wbPriceHTML };
