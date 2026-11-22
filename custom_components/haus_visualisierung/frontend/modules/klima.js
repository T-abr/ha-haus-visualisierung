/* Haus Visualisierung – Klimaseite: Temperaturen und Feuchte 24 h, Taupunkt, absolute Feuchte, Lüftungshinweis. */

import { dc, esc, icon, NF0, NF1, num, OUTDOOR_RE, setHidden, setHtml, setText, UPD } from "./grundlagen.js";
import { finite, TREND, TREND_BUCKET, TREND_GAP, TREND_MS, TREND_TTL, trendAt, trendFetch, trendPath, trendPush, trendScale } from "./verlauf.js";

/* ---------- Klimaseite: Temperaturen 24 h (Haus Ø und Außen) und Verlauf je Raum ---------- */
/* Eine Recorder-Abfrage für alle Räume und die Außentemperatur (über die Kopfkarte), danach fortgeschrieben.
   Farben (dunkle Fläche, geprüft): innen #e26a1c, außen #2a9ad8. Eine gemeinsame Achse in °C. */
const CL_IN = "#e26a1c", CL_OUT = "#2a9ad8";

/* ---------- Feuchte: Taupunkt, absolute Feuchte, Lüftungshinweis, Schimmelrisiko ---------- */
/* Magnus-Formel über Wasser (Sonntag 1990). Dieselben Formeln und Grenzen stehen im Backend (alerts.py). */
const MAG_A = 17.62, MAG_B = 243.12, MOLD_HYST = 3;
function dewPoint(t, rh) {
  if (!finite(t) || !finite(rh) || rh <= 0) return null;
  const g = Math.log(Math.min(rh, 100) / 100) + (MAG_A * t) / (MAG_B + t);
  return (MAG_B * g) / (MAG_A - g);
}
/** Absolute Feuchte in g/m³. */
function absHum(t, rh) {
  if (!finite(t) || !finite(rh) || rh < 0) return null;
  return (216.7 * (Math.min(rh, 100) / 100) * 6.112 * Math.exp((MAG_A * t) / (MAG_B + t))) / (273.15 + t);
}
/** Lüften lohnt sich, wenn draußen deutlich weniger Wasser in der Luft ist (absolute Feuchte, g/m³). */
function ventAdvice(tIn, rhIn, tOut, rhOut) {
  const a = absHum(tIn, rhIn), b = absHum(tOut, rhOut);
  if (a === null || b === null) return null;
  const d = a - b;
  return d >= 2 ? { k: "gut", t: "Lüften lohnt sich", d } : d >= 0.5 ? { k: "wenig", t: "Lüften bringt wenig", d } : { k: "nicht", t: "Draußen feuchter", d };
}
const outdoorHumId = (h) => Object.keys(h.states).find((e) => e.startsWith("sensor.") && dc(h.states[e]) === "humidity" && OUTDOOR_RE.test(`${e} ${h.states[e].attributes.friendly_name || ""}`)) || "";
const weatherId = (h, L) => { const w = L.wallpanel && L.wallpanel.weather; return w && h.states[w] ? w : Object.keys(h.states).find((e) => e.startsWith("weather.")) || ""; };
/** Außen jetzt: Temperatur und Feuchte aus den Fühlern, sonst aus der Wetter-Entität. Die IDs merkt sich das Modell. */
function outdoorClim(h, m) {
  const o = m._oc || {}, w = h.states[o.wId];
  let t = num(h.states[o.tId]), rh = num(h.states[o.hId]);
  if (w && t === null && finite(w.attributes.temperature)) t = w.attributes.temperature;
  if (w && rh === null && finite(w.attributes.humidity)) rh = w.attributes.humidity;
  return { ...o, t, rh };
}
const isIndoor = (m, a) => !OUTDOOR_RE.test(a.name) && !m.outdoor.some((f) => f.areas.includes(a));
const humRooms = (m) => m.visibleAreas.filter((a) => a.humId && isIndoor(m, a));

/** Lädt fehlende Verläufe gesammelt; cb läuft nach dem Laden. Ergebnis: true, solange noch geladen wird. */
function trendEnsure(h, ids, cb) {
  const now = Date.now();
  const missing = ids.filter((e) => { const r = TREND.get(e); return !r || (!r.loading && now - r.at > TREND_TTL && !r.live); });
  if (missing.length && h.callWS) {
    for (const e of missing) TREND.set(e, { at: now, pts: [], loading: true, seen: null });
    trendFetch(h, missing).then((res) => { for (const e of missing) TREND.set(e, { at: Date.now(), pts: res[e] || [], loading: false, seen: null }); })
      .catch(() => { for (const e of missing) TREND.set(e, { at: Date.now(), pts: [], loading: false, seen: null }); })
      .finally(cb);
  }
  return ids.some((e) => TREND.get(e) && TREND.get(e).loading);
}

/** Reihe eines Sensors für die Anzeige: gespeicherte Werte + aktueller Wert bis „jetzt“. */
function trendSeries(h, eid) {
  const rec = eid && TREND.get(eid);
  if (!rec || rec.loading) return null;
  const fromRecorder = rec.pts.some((p) => !p.live);
  rec.live = true; rec.at = Date.now();
  trendPush(rec, h.states[eid]);
  if (!fromRecorder && rec.pts.length < 2) return [];
  const pts = rec.pts.slice(), cur = num(h.states[eid]);
  if (cur !== null && pts.length && pts[pts.length - 1][0] < Date.now()) pts.push([Date.now(), cur]);
  return pts;
}

function outdoorTempId(h, m, L) {
  const pick = (L.heating && L.heating.outdoor) || (m.tech && m.tech.heat && m.tech.heat.outdoor);
  if (pick && h.states[pick]) return pick;
  return Object.keys(h.states).find((e) => e.startsWith("sensor.") && dc(h.states[e]) === "temperature" && OUTDOOR_RE.test(`${e} ${h.states[e].attributes.friendly_name || ""}`)) || "";
}

const climRooms = (m) => m.visibleAreas.filter((a) => a.tempId && isIndoor(m, a));

/* Zwei Kopfkarten mit derselben Mechanik: Temperaturen (°C) und Luftfeuchte (%). Innen immer orange, außen immer blau. */
const CLIM_KIND = {
  t: { title: "Temperaturen 24 h", ic: "mdi:chart-line", id: (a) => a.tempId, rooms: climRooms, out: (h, m, L) => outdoorTempId(h, m, L),
    fmt: (v) => `${NF1.format(v)}°`, ax: (v) => `${v}°`, pad: 0.5, steps: [1, 2, 5, 10, 20] },
  h: { title: "Luftfeuchte 24 h", ic: "mdi:water-percent", id: (a) => a.humId, rooms: humRooms, out: (h, m) => (m._oc && m._oc.hId) || "",
    fmt: (v) => `${NF0.format(v)} %`, ax: (v) => `${v} %`, pad: 2, steps: [5, 10, 20, 25, 50] },
};
/** Alle Verlaufs-Fühler der Klimaseite – beide Karten und alle Raum-Verläufe in einer Abfrage. */
function climPageIds(h, m, L) {
  return [...new Set([...m.visibleAreas.flatMap((a) => [a.tempId, a.humId]), outdoorTempId(h, m, L), m._oc && m._oc.hId].filter(Boolean))];
}
const moldLimit = (L) => (L.alerts && L.alerts.mold_hum) || 65;

function climTrendHTML(k = "t") {
  const K = CLIM_KIND[k];
  return `<div class="glass ctrend k-${k}" data-u="climtrend" data-kind="${k}">
    <div class="trh"><span class="trt">${icon(K.ic)}${K.title}</span>
      <span class="ctl in"><i></i>Haus Ø<b></b></span><span class="ctl out"><i></i>Außen<b></b></span></div>
    <div class="ctstats"></div>
    <div class="trc ctc"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><g class="trgrid"></g><g class="ctgrid"></g>${k === "h" ? '<rect class="ctband" x="0" width="1000"/><path class="ctlim"/>' : ""}<path class="ctp out"/><path class="ctp in"/></svg>
      <div class="cty"></div><span class="ctend in"></span><span class="ctend out"></span>${k === "h" ? '<span class="ctlimt"></span>' : ""}
      <div class="trx"></div><div class="trcur"><i class="cin"></i><i class="cout"></i></div><div class="trtip"></div>
      <div class="trmsg">${icon("mdi:loading", "spin")}Lade Verlauf …</div></div></div>`;
}

/** Durchschnitt mehrerer Reihen je 5 Minuten. */
function avgSeries(list, start, now) {
  const n = Math.ceil((now - start) / TREND_BUCKET) + 1, sum = new Float64Array(n), cnt = new Uint16Array(n);
  for (const pts of list) {
    let i = 0;
    for (let k = 0; k < n; k++) {
      const t = start + k * TREND_BUCKET;
      while (i < pts.length - 1 && pts[i + 1][0] <= t) i++;
      const p = pts[i];
      if (p && p[0] <= t + TREND_BUCKET && t - p[0] <= TREND_GAP && finite(p[1])) { sum[k] += p[1]; cnt[k]++; }
    }
  }
  const out = [];
  for (let k = 0; k < n; k++) if (cnt[k]) out.push([Math.min(now, start + k * TREND_BUCKET), sum[k] / cnt[k]]);
  return out;
}

const climStat = (lbl, val, sub = "", cls = "") => `<span class="cts${cls ? ` ${cls}` : ""}"><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ""}</span>`;
const avg = (vals) => (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);

/** Kennzahlen der Temperatur-Karte; liefert [HTML, Haus Ø jetzt, außen jetzt]. */
function climStatsT(h, m, rooms, out, outS, start) {
  const curs = rooms.map((a) => [a, num(h.states[a.tempId])]).filter(([, v]) => v !== null).sort((x, y) => x[1] - y[1]);
  const avgNow = avg(curs.map(([, v]) => v)), outNow = num(h.states[out]);
  const outDay = trendScale(outS.filter(([t]) => t >= start).map((p) => p[1]), 0);
  const heating = m.visibleAreas.filter((a) => a.climates.some((c) => h.states[c] && h.states[c].attributes.hvac_action === "heating")).length;
  return [[
    avgNow !== null ? climStat("Innen Ø", `${NF1.format(avgNow)}°`) : "",
    curs.length > 1 ? climStat("Kühlster Raum", `${NF1.format(curs[0][1])}°`, esc(curs[0][0].name)) : "",
    curs.length > 1 ? climStat("Wärmster Raum", `${NF1.format(curs[curs.length - 1][1])}°`, esc(curs[curs.length - 1][0].name)) : "",
    outNow !== null ? climStat("Außen", `${NF1.format(outNow)}°`, outDay ? `24 h: ${NF1.format(outDay.min)}° bis ${NF1.format(outDay.max)}°` : "") : "",
    m.agg.climates.length ? climStat("Heizt", `${heating} ${heating === 1 ? "Raum" : "Räume"}`) : "",
  ].join(""), avgNow, outNow];
}

/** Kennzahlen der Feuchte-Karte: Ø, feuchtester und trockenster Raum, Taupunkt, außen und Lüftungshinweis. */
function climStatsH(h, m, rooms, L) {
  const curs = rooms.map((a) => [a, num(h.states[a.humId]), num(h.states[a.tempId])]).filter(([, v]) => v !== null).sort((x, y) => x[1] - y[1]);
  const avgNow = avg(curs.map(([, v]) => v));
  const withT = curs.filter(([, , t]) => t !== null);
  const dpAvg = avg(withT.map(([, rh, t]) => dewPoint(t, rh)).filter(finite));
  const o = outdoorClim(h, m), oDp = dewPoint(o.t, o.rh);
  // Lüftungshinweis aus dem Haus-Durchschnitt (Temperatur und Feuchte derselben Räume)
  const adv = withT.length ? ventAdvice(avg(withT.map(([, , t]) => t)), avg(withT.map(([, rh]) => rh)), o.t, o.rh) : null;
  const aIn = withT.length ? absHum(avg(withT.map(([, , t]) => t)), avg(withT.map(([, rh]) => rh))) : null, aOut = absHum(o.t, o.rh);
  const hi = curs[curs.length - 1], lo = curs[0];
  return [[
    avgNow !== null ? climStat("Innen Ø", `${NF0.format(avgNow)} %`) : "",
    curs.length > 1 ? climStat("Feuchtester Raum", `${NF0.format(hi[1])} %`, esc(hi[0].name), hi[1] >= moldLimit(L) ? "hot" : "") : "",
    curs.length > 1 ? climStat("Trockenster Raum", `${NF0.format(lo[1])} %`, esc(lo[0].name)) : "",
    dpAvg !== null ? climStat("Taupunkt innen", `${NF1.format(dpAvg)}°`, "Ø der Räume") : "",
    o.rh !== null ? climStat("Außen", `${NF0.format(o.rh)} %`, oDp !== null ? `Taupunkt ${NF1.format(oDp)}°` : "") : "",
    adv ? climStat("Lüften", adv.t, `innen ${NF1.format(aIn)} · außen ${NF1.format(aOut)} g/m³`, `vent ${adv.k}`) : "",
  ].join(""), avgNow, o.hId ? num(h.states[o.hId]) : null];
}

function updateClimTrend(el, ctx) {
  const h = ctx._hass, m = ctx._model, L = ctx._layout, now = Date.now(), start = now - TREND_MS;
  const k = el.dataset.kind || "t", K = CLIM_KIND[k];
  const rooms = K.rooms(m), out = K.out(h, m, L);
  // alle Fühler der Seite in einer Abfrage – auch Außenbereiche und die andere Karte
  const rerun = () => ctx.shadowRoot.querySelectorAll('[data-u="climtrend"],[data-u="spark"]').forEach((x) => x.isConnected && UPD[x.dataset.u].run(x, ctx));
  const msg = el.querySelector(".trmsg");
  if (trendEnsure(h, climPageIds(h, m, L), rerun)) { setHidden(msg, false); return; }
  const outS = (out && trendSeries(h, out)) || [];
  const [stats, avgNow, outNow] = k === "h" ? climStatsH(h, m, rooms, L) : climStatsT(h, m, rooms, out, outS, start);
  setHtml(el.querySelector(".ctstats"), stats);
  setText(el, ".ctl.in b", avgNow !== null ? K.fmt(avgNow) : "–");
  setText(el, ".ctl.out b", outNow !== null ? K.fmt(outNow) : "–");
  setHidden(el.querySelector(".ctl.out"), !out);
  // Kurve höchstens alle 15 s neu rechnen (5-Minuten-Werte), Kennzahlen oben sofort
  if (el._drawn && now - el._drawn < 15000 && !el._force) {
    if (!el._tq) el._tq = setTimeout(() => { el._tq = 0; if (el.isConnected) { el._force = true; updateClimTrend(el, ctx); el._force = false; } }, 15000 - (now - el._drawn));
    return;
  }
  const inner = rooms.map((a) => trendSeries(h, K.id(a))).filter((p) => p && p.length > 1);
  const S = { in: inner.length ? avgSeries(inner, start, now) : [], out: outS };
  if (S.in.length < 2 && S.out.length < 2) {
    setHidden(msg, false);
    msg.innerHTML = `${icon("mdi:chart-line-variant")}Noch kein Verlauf aufgezeichnet (Recorder).`;
    el.classList.add("nodata"); return;
  }
  setHidden(msg, true); el.classList.remove("nodata");
  el._drawn = now;
  // eine Achse für beide Reihen, höchstens vier Abschnitte, runde Teilstriche
  const all = [...S.in, ...S.out].filter(([t]) => t >= start).map((p) => p[1]).filter(finite);
  let lo0 = Math.min(...all) - K.pad, hi0 = Math.max(...all) + K.pad;
  if (k === "h") { lo0 = Math.max(0, lo0); hi0 = Math.min(100, hi0); }
  const big = K.steps[K.steps.length - 1];
  let step = big, lo = Math.floor(lo0 / big) * big, hi = Math.ceil(hi0 / big) * big;
  for (const s of K.steps) {
    const l = Math.floor(lo0 / s) * s, u = Math.ceil(hi0 / s) * s;
    if ((u - l) / s <= 4) { step = s; lo = l; hi = u; break; }
  }
  const H = 100, pad = 4, x = (t) => ((t - start) / TREND_MS) * 1000, y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  el.querySelector(".ctp.in").setAttribute("d", trendPath(S.in, x, y));
  el.querySelector(".ctp.out").setAttribute("d", trendPath(S.out, x, y));
  const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
  el.querySelector(".ctgrid").innerHTML = ticks.map((v) => `<line x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join("");
  setHtml(el.querySelector(".cty"), ticks.map((v) => `<span style="top:${y(v)}%">${K.ax(v)}</span>`).join(""));
  if (k === "h") {
    // Wohlfühlbereich 40–60 % als Band, Grenze für Schimmelrisiko gestrichelt
    const b0 = Math.max(lo, 40), b1 = Math.min(hi, 60), band = el.querySelector(".ctband");
    band.setAttribute("y", b1 > b0 ? y(b1).toFixed(1) : "0"); band.setAttribute("height", b1 > b0 ? (y(b0) - y(b1)).toFixed(1) : "0");
    const lim = moldLimit(L), on = lim > lo && lim < hi && L.alerts && L.alerts.builtin && L.alerts.builtin.mold !== false;
    el.querySelector(".ctlim").setAttribute("d", on ? `M0 ${y(lim).toFixed(1)}H1000` : "");
    const lt = el.querySelector(".ctlimt");
    setHidden(lt, !on);
    if (on) { lt.style.top = `${y(lim)}%`; lt.textContent = `Schimmel ab ${NF0.format(lim)} %`; }
  }
  // Werte am Linienende (direkte Beschriftung)
  for (const s of ["in", "out"]) {
    const last = S[s][S[s].length - 1], lab = el.querySelector(`.ctend.${s}`);
    setHidden(lab, !last);
    if (last) { lab.style.top = `${y(last[1])}%`; lab.textContent = K.fmt(last[1]); }
  }
  const li = el.querySelector(".ctend.in"), lo2 = el.querySelector(".ctend.out");
  if (!li.hidden && !lo2.hidden && Math.abs(parseFloat(li.style.top) - parseFloat(lo2.style.top)) < 12) {
    const up = parseFloat(li.style.top) < parseFloat(lo2.style.top) ? li : lo2, dn = up === li ? lo2 : li;
    up.style.top = `${parseFloat(up.style.top) - 6}%`; dn.style.top = `${parseFloat(dn.style.top) + 6}%`;
  }
  const hour = Math.floor(now / 3600000);
  if (el._hour !== hour) {
    el._hour = hour;
    const tk = []; const d0 = new Date(start); d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime() + 3600000; t < now; t += 3600000) if (new Date(t).getHours() % 6 === 0) tk.push(t);
    el.querySelector(".trgrid").innerHTML = tk.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="0" y2="${H}"/>`).join("");
    el.querySelector(".trx").innerHTML = tk.filter((t) => x(t) < 900).map((t) => `<span style="left:${(x(t) / 10).toFixed(2)}%">${new Date(t).getHours()} Uhr</span>`).join("") + `<span class="now">jetzt</span>`;
  }
  el._ct = { S, start, y, fmt: K.fmt };
  if (el._hover !== undefined) climHover(el, el._hover);
}

function climHover(el, frac) {
  const T = el._ct, tip = el.querySelector(".trtip"), cur = el.querySelector(".trcur");
  if (!T || frac === null) { el._hover = undefined; cur.classList.remove("on"); tip.classList.remove("on"); return; }
  el._hover = frac;
  const t = T.start + frac * TREND_MS, parts = [];
  for (const [k, cls, lbl] of [["in", "cin", "Haus Ø"], ["out", "cout", "Außen"]]) {
    const p = trendAt(T.S[k], t), dot = cur.querySelector(`i.${cls}`);
    if (!p) { dot.style.display = "none"; continue; }
    dot.style.display = ""; dot.style.top = `${T.y(p[1])}%`;
    parts.push(`<span class="tk ${k}"><i></i>${lbl} <b>${T.fmt(p[1])}</b></span>`);
  }
  tip.innerHTML = `<span>${new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>${parts.join("")}`;
  cur.style.left = `${frac * 100}%`; tip.style.left = `${Math.min(Math.max(frac * 100, 15), 85)}%`;
  cur.classList.add("on"); tip.classList.add("on");
}

/* Verlauf je Raum: eine Reihe der gewählten Größe, dazu der aktuelle Wert und die Spanne der letzten 24 h.
   Lesbarkeit: alle Räume mit derselben Skalenhöhe (Temperatur 6°, Feuchte fest 30–80 %), damit gleiche
   Schwankungen gleich groß aussehen; Nacht 22–6 Uhr schattiert, feine Striche alle 6 Stunden, Punkt bei „jetzt“.
   Temperatur mit Soll als gestrichelter Linie; Feuchte mit Wohlfühlband 40–60 % und Abschnitten über der
   Grenze für Schimmelrisiko in Rot. */
const SPARK_W = 200, SPARK_H = 40, SPARK_T_SPAN = 6, SPARK_H_LO = 30, SPARK_H_HI = 80, NIGHT_FROM = 22, NIGHT_TO = 6;
let sparkSeq = 0;
function sparkHTML(a, k = "t") {
  const id = k === "h" ? a.humId : a.tempId;
  if (!id) return `<span class="kspark none"></span>`;
  const cid = `spc${++sparkSeq}`;
  return `<span class="kspark k-${k}" data-u="spark" data-kind="${k}" data-area="${esc(a.id)}"><span class="spw"><svg viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<defs><clipPath id="${cid}"><rect class="spclip" x="0" y="0" width="${SPARK_W}" height="0"/></clipPath></defs>`
    + `<g class="spnight"></g><g class="sptick"></g>${k === "h" ? '<rect class="spband" x="0" width="' + SPARK_W + '" y="0" height="0"/>' : ""}`
    + `<path class="spset"/><path class="spl"/>${k === "h" ? `<path class="spov" clip-path="url(#${cid})"/>` : ""}</svg><i class="spdot" hidden></i><span class="sptip"></span></span>`
    + `<small class="sprg"><b class="spv"></b><span class="spr"></span></small></span>`;
}

/** Skala einer Raumkurve: Temperatur immer gleich hoch (mind. 6°) um den eigenen Verlauf, Feuchte fest 30–80 %. */
function sparkScale(vals, k) {
  const day = trendScale(vals, 0);
  if (!day) return null;
  if (k === "h") {
    const lo = Math.max(0, Math.min(SPARK_H_LO, Math.floor((day.min - 2) / 10) * 10));
    const hi = Math.min(100, Math.max(SPARK_H_HI, Math.ceil((day.max + 2) / 10) * 10));
    return { lo, hi, min: day.min, max: day.max };
  }
  return trendScale(vals, SPARK_T_SPAN / 1.15);
}

/** Nachtabschnitte (22–6 Uhr) und volle 6-Stunden-Zeitpunkte im Fenster, in Ortszeit. */
function sparkTimes(start, now) {
  const nights = [], ticks = [], d = new Date(start);
  d.setHours(0, 0, 0, 0);
  for (let day = d.getTime() - 86400000; day <= now; day += 86400000) {
    const n0 = new Date(day); n0.setHours(NIGHT_FROM - 24, 0, 0, 0);
    const n1 = new Date(day); n1.setHours(NIGHT_TO, 0, 0, 0);
    const a = Math.max(start, n0.getTime()), b = Math.min(now, n1.getTime());
    if (b > a) nights.push([a, b]);
    for (const hr of [0, 6, 12, 18]) { const t = new Date(day); t.setHours(hr, 0, 0, 0); if (t > start && t < now) ticks.push(t.getTime()); }
  }
  return { nights, ticks };
}

function updateSpark(el, ctx) {
  const a = ctx._model.areas.get(el.dataset.area), k = el.dataset.kind || "t";
  const eid = a && (k === "h" ? a.humId : a.tempId);
  if (!eid) return;
  const h = ctx._hass, L = ctx._layout, now = Date.now(), start = now - TREND_MS;
  if (trendEnsure(h, [eid], () => el.isConnected && updateSpark(el, ctx))) return;
  const pts = trendSeries(h, eid) || [];
  let ref = null;
  if (k === "h") ref = L.alerts && L.alerts.builtin && L.alerts.builtin.mold !== false ? moldLimit(L) : null;
  else { const cl = a.climates.map((c) => h.states[c]).find((s) => s && finite(s.attributes.temperature)); ref = cl ? cl.attributes.temperature : null; }
  const vals = pts.filter(([t]) => t >= start).map((p) => p[1]).filter(finite);
  // Soll in die Skala nehmen, wenn es nahe am Verlauf liegt (sonst bliebe die Linie unsichtbar)
  const day = trendScale(vals, 0);
  const near = k === "t" && ref !== null && day && ref >= day.min - 2 && ref <= day.max + 2;
  const sc = sparkScale(near ? [...vals, ref] : vals, k);
  const dot = el.querySelector(".spdot"), fmt = k === "h" ? (v) => `${NF0.format(v)} %` : (v) => `${NF1.format(v)}°`;
  if (!sc || pts.length < 2) {
    el.classList.add("empty"); el.querySelector(".spl").setAttribute("d", ""); setText(el, ".spv", ""); setText(el, ".spr", ""); setHidden(dot, true);
    return;
  }
  el.classList.remove("empty");
  const W = SPARK_W, H = SPARK_H, x = (t) => ((t - start) / TREND_MS) * W, y = (v) => H - 2 - ((v - sc.lo) / (sc.hi - sc.lo)) * (H - 4);
  const line = trendPath(pts, x, y);
  el.querySelector(".spl").setAttribute("d", line);
  // Zeitbezug: Nacht schattiert, Striche alle 6 Stunden – alle 5 Minuten neu (das Fenster wandert mit)
  const slot = Math.floor(now / 300000);
  if (el._slot !== slot) {
    el._slot = slot;
    const T = sparkTimes(start, now);
    el.querySelector(".spnight").innerHTML = T.nights.map(([a0, b0]) => `<rect x="${x(a0).toFixed(1)}" y="0" width="${(x(b0) - x(a0)).toFixed(1)}" height="${H}"/>`).join("");
    el.querySelector(".sptick").innerHTML = T.ticks.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="0" y2="${H}"/>`).join("");
  }
  const refOn = ref !== null && ref > sc.lo && ref < sc.hi;
  el.querySelector(".spset").setAttribute("d", refOn ? `M0 ${y(ref).toFixed(1)}L${W} ${y(ref).toFixed(1)}` : "");
  if (k === "h") {
    const b0 = Math.max(sc.lo, 40), b1 = Math.min(sc.hi, 60), band = el.querySelector(".spband");
    band.setAttribute("y", b1 > b0 ? y(b1).toFixed(1) : "0"); band.setAttribute("height", b1 > b0 ? (y(b0) - y(b1)).toFixed(1) : "0");
    // über der Grenze: dieselbe Linie rot, auf den Bereich oberhalb der Grenze beschnitten
    el.querySelector(".spclip").setAttribute("height", refOn ? y(ref).toFixed(1) : "0");
    el.querySelector(".spov").setAttribute("d", refOn && day.max > ref ? line : "");
    el.classList.toggle("over", ref !== null && (num(h.states[eid]) ?? pts[pts.length - 1][1]) >= ref);
  }
  // Punkt am Linienende (jetzt) und aktueller Wert
  const last = pts[pts.length - 1];
  setHidden(dot, !last);
  if (last) { dot.style.left = `${(x(last[0]) / W) * 100}%`; dot.style.top = `${(y(last[1]) / H) * 100}%`; }
  const cur = num(h.states[eid]);
  setText(el, ".spv", cur !== null ? fmt(cur) : last ? fmt(last[1]) : "");
  if (k === "h") {
    setText(el, ".spr", day ? `${NF0.format(day.min)}–${NF0.format(day.max)} %` : "");
    el.title = `${a.name}: Luftfeuchte 24 h ${day ? `${NF0.format(day.min)} bis ${NF0.format(day.max)} %` : ""}${ref !== null ? ` · Schimmelrisiko ab ${NF0.format(ref)} %` : ""}`;
  } else {
    setText(el, ".spr", day ? `${NF1.format(day.min)}–${NF1.format(day.max)}°` : "");
    el.title = `${a.name}: 24 h ${day ? `${NF1.format(day.min)} bis ${NF1.format(day.max)} °C` : ""}${ref !== null ? ` · Soll ${NF1.format(ref)} °C` : ""}`;
  }
  el._sp = { pts, start, fmt, lo: sc.lo, hi: sc.hi };
}

function sparkHover(el, frac) {
  const T = el._sp, tip = el.querySelector(".sptip");
  if (!T || frac === null) { tip.classList.remove("on"); return; }
  const t = T.start + frac * TREND_MS, p = trendAt(T.pts, t);
  if (!p) { tip.classList.remove("on"); return; }
  tip.textContent = `${new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${T.fmt(p[1])}`;
  tip.style.left = `${Math.min(Math.max(frac * 100, 20), 80)}%`;
  tip.classList.add("on");
}

export { absHum, climHover, climRooms, climTrendHTML, dewPoint, humRooms, MOLD_HYST, outdoorClim, outdoorHumId, outdoorTempId, sparkHover, sparkHTML, trendEnsure, trendSeries, updateClimTrend, updateSpark, ventAdvice, weatherId };
