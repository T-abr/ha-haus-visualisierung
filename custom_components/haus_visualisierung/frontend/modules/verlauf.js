/* Haus Visualisierung – Verlauf 24 h auf Raumseiten (Temperatur, Luftfeuchte) aus dem Recorder. */

import { esc, icon, NF0, NF1, num, setHidden, setText } from "./grundlagen.js";

/* ------------------------------------------------------------------------ */
/*  Verlauf 24 h auf Raumseiten (Temperatur, Luftfeuchte)                     */
/* ------------------------------------------------------------------------ */
/* Daten kommen einmal beim Öffnen der Raumseite aus dem Recorder: zuerst die 5-Minuten-Statistik
   (fertig gemittelt, 288 Werte je Sensor), für Sensoren ohne Statistik der Verlauf (auf 5 Minuten verdichtet).
   Danach schreibt die Seite neue Werte aus hass.states selbst fort – keine weiteren Abfragen.
   Der Speicher gilt für alle Raumseiten; nach 10 Minuten ohne Anzeige wird neu geladen. */
const TREND_MS = 24 * 3600 * 1000;
const TREND_BUCKET = 5 * 60 * 1000;
const TREND_TTL = 10 * 60 * 1000;
const TREND_GAP = 65 * 60 * 1000;
const TREND = new Map(); // eid → { at, pts: [[ms, wert]], seen }

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const tsMs = (v) => (typeof v === "number" ? (v < 1e11 ? v * 1000 : v) : Date.parse(v));

/** Verlauf (Stufenfunktion) auf 5-Minuten-Mittelwerte verdichten. */
function trendBucket(pts, start, end) {
  const out = [];
  let b = -1, sum = 0, n = 0;
  for (const [t, v] of pts) {
    if (t > end) break;
    const k = Math.floor((Math.max(t, start) - start) / TREND_BUCKET);
    if (k !== b) { if (n) out.push([start + b * TREND_BUCKET + TREND_BUCKET / 2, sum / n]); b = k; sum = 0; n = 0; }
    if (finite(v)) { sum += v; n++; } else if (n) { out.push([start + b * TREND_BUCKET + TREND_BUCKET / 2, sum / n]); out.push([t, NaN]); sum = 0; n = 0; }
  }
  if (n) out.push([start + b * TREND_BUCKET + TREND_BUCKET / 2, sum / n]);
  return out;
}

async function trendFetch(h, eids) {
  const now = Date.now(), start = now - TREND_MS, iso = new Date(start).toISOString();
  const out = {};
  let stats = {};
  try {
    stats = (await h.callWS({ type: "recorder/statistics_during_period", start_time: iso, statistic_ids: eids, period: "5minute", types: ["mean"] })) || {};
  } catch (err) { stats = {}; }
  const miss = [];
  for (const e of eids) {
    const pts = (stats[e] || []).map((r) => [tsMs(r.start) + TREND_BUCKET / 2, r.mean]).filter(([t, v]) => finite(t) && finite(v));
    if (pts.length >= 3) out[e] = pts; else miss.push(e);
  }
  if (miss.length) {
    try {
      const hist = (await h.callWS({ type: "history/history_during_period", start_time: iso, entity_ids: miss, minimal_response: true, no_attributes: true, significant_changes_only: false })) || {};
      for (const e of miss) {
        const raw = (hist[e] || []).map((x) => [tsMs(x.lu ?? x.last_updated ?? x.lc), parseFloat(x.s ?? x.state)]).filter(([t]) => finite(t));
        out[e] = trendBucket(raw, start, now);
      }
    } catch (err) { for (const e of miss) out[e] = []; }
  }
  return out;
}

/** Aktuellen Wert anhängen (nur wenn neu) und Werte älter als 24 h abschneiden. */
function trendPush(rec, st) {
  const v = num(st);
  const t = st ? Date.parse(st.last_updated || st.last_changed) || Date.now() : Date.now();
  const p = rec.pts;
  if (st && rec.seen !== st) {
    rec.seen = st;
    const last = p[p.length - 1];
    if (!last || t > last[0]) {
      // innerhalb von 5 Minuten zusammenfassen, damit schnelle Sensoren die Liste nicht aufblähen
      if (last && finite(last[1]) && last.live && t - last.t0 < TREND_BUCKET) { last[0] = t; last[1] = v === null ? NaN : (last[1] * last.n + v) / (last.n + 1); last.n++; }
      else { const q = [t, v === null ? NaN : v]; q.live = true; q.t0 = t; q.n = 1; p.push(q); }
    }
  }
  const cut = Date.now() - TREND_MS;
  let i = 0;
  while (i < p.length - 1 && p[i + 1][0] < cut) i++;
  if (i) p.splice(0, i);
}

function trendScale(vals, minSpan) {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) if (finite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (lo === Infinity) return null;
  const mid = (lo + hi) / 2, span = Math.max(hi - lo, minSpan) * 1.15;
  return { lo: mid - span / 2, hi: mid + span / 2, min: lo, max: hi };
}

/** SVG-Pfad mit Lücken bei fehlenden Werten oder Ausfällen über 65 Minuten. */
function trendPath(pts, x, y) {
  let d = "", pen = false, lastT = 0;
  for (const [t, v] of pts) {
    if (!finite(v) || (pen && t - lastT > TREND_GAP)) { pen = false; if (!finite(v)) continue; }
    d += `${pen ? "L" : "M"}${x(t).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true; lastT = t;
  }
  return d;
}

const TREND_KIND = [["t", "temperature", "Temperatur"], ["h", "humidity", "Luftfeuchte"]];
const trendFmt = (k, v) => (k === "t" ? `${NF1.format(v)}°` : `${NF0.format(v)} %`);

function trendCardHTML(a) {
  if (!a || (!a.tempId && !a.humId)) return "";
  const leg = (k, label, eid) => (eid ? `<button class="trl ${k}" data-act="more" data-eid="${esc(eid)}"><i></i><span>${label}</span><b></b><small></small></button>` : "");
  return `<div class="glass trend" data-u="trend" data-area="${esc(a.id)}">
    <div class="trh"><span class="trt">${icon("mdi:chart-line")}Verlauf 24 h</span>${leg("t", "Temperatur", a.tempId)}${leg("h", "Luftfeuchte", a.humId)}</div>
    <div class="trc"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="trg-${esc(a.id)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hv-heat)" stop-opacity=".28"/><stop offset="1" stop-color="var(--hv-heat)" stop-opacity="0"/></linearGradient></defs>
      <g class="trgrid"></g><path class="tra" fill="url(#trg-${esc(a.id)})"/><path class="trp h"/><path class="trp t"/></svg>
      <span class="ty t hi"></span><span class="ty t lo"></span><span class="ty h hi"></span><span class="ty h lo"></span>
      <div class="trx"></div><div class="trcur"><i class="t"></i><i class="h"></i></div><div class="trtip"></div>
      <div class="trmsg">${icon("mdi:loading", "spin")}Lade Verlauf …</div></div></div>`;
}

function updateTrend(el, ctx) {
  const a = ctx._model.areas.get(el.dataset.area);
  if (!a) return;
  const h = ctx._hass, now = Date.now();
  const ids = [a.tempId, a.humId].filter(Boolean);
  const missing = ids.filter((e) => { const r = TREND.get(e); return !r || (!r.loading && now - r.at > TREND_TTL && !r.live); });
  if (missing.length && h.callWS) {
    for (const e of missing) TREND.set(e, { at: now, pts: [], loading: true, seen: null });
    trendFetch(h, missing).then((res) => {
      for (const e of missing) TREND.set(e, { at: Date.now(), pts: res[e] || [], loading: false, seen: null });
    }).catch(() => { for (const e of missing) TREND.set(e, { at: Date.now(), pts: [], loading: false, seen: null }); })
      .finally(() => { if (el.isConnected) updateTrend(el, ctx); });
  }
  const loading = ids.some((e) => TREND.get(e)?.loading);
  const msg = el.querySelector(".trmsg");
  if (loading) { setHidden(msg, false); return; }
  const start = now - TREND_MS;
  const x = (t) => ((t - start) / TREND_MS) * 1000;
  const S = {};
  for (const [k, , label] of TREND_KIND) {
    const eid = k === "t" ? a.tempId : a.humId;
    const rec = eid && TREND.get(eid);
    if (!rec) continue;
    rec.live = true; rec.at = now;
    const st = h.states[eid];
    const fromRecorder = rec.pts.some((p) => !p.live);
    trendPush(rec, st);
    const cur = num(st);
    const pts = rec.pts.slice();
    if (cur !== null && pts.length && pts[pts.length - 1][0] < now) pts.push([now, cur]);
    const sc = trendScale(pts.filter(([t]) => t >= start).map((p) => p[1]), k === "t" ? 2 : 10);
    // ohne Recorder: erst zeichnen, wenn die Seite selbst mindestens zwei Werte gesammelt hat
    S[k] = { pts, sc: fromRecorder || rec.pts.length >= 2 ? sc : null, cur, label };
  }
  const has = Object.values(S).some((s) => s.sc && s.pts.length > 1);
  if (!has) {
    setHidden(msg, false);
    msg.innerHTML = `${icon("mdi:chart-line-variant")}Noch kein Verlauf aufgezeichnet (Recorder).`;
    el.classList.add("nodata");
    return;
  }
  setHidden(msg, true);
  el.classList.remove("nodata");
  el._trend = { S, start };
  const H = 100, pad = 8;
  for (const [k] of TREND_KIND) {
    const s = S[k], path = el.querySelector(`.trp.${k}`);
    if (!path) continue;
    if (!s || !s.sc) { path.setAttribute("d", ""); continue; }
    const y = (v) => H - pad - ((v - s.sc.lo) / (s.sc.hi - s.sc.lo)) * (H - 2 * pad);
    s.y = y;
    const d = trendPath(s.pts, x, y);
    path.setAttribute("d", d);
    if (k === "t") {
      // Fläche unter der Temperatur nur über das letzte zusammenhängende Stück
      const last = d.lastIndexOf("M"), seg = d.slice(last);
      const m = seg.match(/^M([\d.]+) /), e = seg.match(/L?([\d.]+) [\d.]+$/);
      el.querySelector(".tra").setAttribute("d", m && e ? `${seg}L${e[1]} ${H}L${m[1]} ${H}Z` : "");
    }
    setText(el, `.ty.${k}.hi`, trendFmt(k, s.sc.max));
    setText(el, `.ty.${k}.lo`, trendFmt(k, s.sc.min));
    setText(el, `.trl.${k} b`, s.cur !== null ? trendFmt(k, s.cur) : "–");
    setText(el, `.trl.${k} small`, `${trendFmt(k, s.sc.min)} – ${trendFmt(k, s.sc.max)}`);
  }
  if (!S.t || !S.t.sc) el.querySelector(".tra").setAttribute("d", "");
  // Zeitachse: volle 6 Stunden (0, 6, 12, 18 Uhr)
  const hour = Math.floor(now / 3600000);
  if (el._hour !== hour) {
    el._hour = hour;
    const ticks = [];
    const d0 = new Date(start); d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime() + 3600000; t < now; t += 3600000) if (new Date(t).getHours() % 6 === 0) ticks.push(t);
    el.querySelector(".trgrid").innerHTML = ticks.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="0" y2="${H}"/>`).join("");
    el.querySelector(".trx").innerHTML = ticks.filter((t) => x(t) < 900).map((t) => `<span style="left:${(x(t) / 10).toFixed(2)}%">${new Date(t).getHours()} Uhr</span>`).join("") + `<span class="now">jetzt</span>`;
  }
  if (el._hover !== undefined) trendHover(el, el._hover);
}

/** Wert an einer Stelle (0…1) suchen – binäre Suche je Reihe. */
function trendAt(pts, t) {
  let lo = 0, hi = pts.length - 1;
  if (hi < 0) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid][0] < t) lo = mid + 1; else hi = mid; }
  const a = pts[Math.max(0, lo - 1)], b = pts[lo];
  const p = Math.abs(a[0] - t) < Math.abs(b[0] - t) ? a : b;
  return Math.abs(p[0] - t) <= TREND_GAP && finite(p[1]) ? p : null;
}

function trendHover(el, frac) {
  const T = el._trend, tip = el.querySelector(".trtip"), cur = el.querySelector(".trcur");
  if (!T || frac === null) { el._hover = undefined; cur.classList.remove("on"); tip.classList.remove("on"); return; }
  el._hover = frac;
  const t = T.start + frac * TREND_MS;
  const parts = [];
  for (const [k] of TREND_KIND) {
    const s = T.S[k], dot = cur.querySelector(`i.${k}`);
    const p = s && s.sc ? trendAt(s.pts, t) : null;
    if (!p) { dot.style.display = "none"; continue; }
    dot.style.display = "";
    dot.style.top = `${s.y(p[1])}%`;
    parts.push(`<b class="${k}">${trendFmt(k, p[1])}</b>`);
  }
  const clock = new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  tip.innerHTML = `<span>${clock}</span>${parts.join("")}`;
  cur.style.left = `${frac * 100}%`;
  tip.style.left = `${Math.min(Math.max(frac * 100, 12), 88)}%`;
  cur.classList.add("on"); tip.classList.add("on");
}

export { finite, TREND, TREND_BUCKET, TREND_GAP, TREND_MS, TREND_TTL, trendAt, trendCardHTML, trendFetch, trendHover, trendPath, trendPush, trendScale, updateTrend };
