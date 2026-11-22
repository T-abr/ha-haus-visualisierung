/* Haus Visualisierung – Energie-Seite: Fluss, Kennzahlen, Bilanz heute, Verlauf 24 h. */

import { batteryIcon, dc, esc, icon, isOn, NF0, NF1, num, powerW, setHidden, setHtml, setIcon, setText, setWidth, UPD } from "./grundlagen.js";
import { axisCut, axisKey, finite, TREND_BUCKET, TREND_GAP, TREND_MS, trendAt, trendPath } from "./verlauf.js";
import { trendEnsure, trendSeries } from "./klima.js";
import { enPriceHTML, priceInfo, unitFactor, updateEnPrice } from "./strompreis.js";

/* ---------- Energie-Seite: Fluss, Kennzahlen, Bilanz heute, Verlauf 24 h ---------- */
/* Quellen: „Energie auf dem Dach“ (PV, Akku-Ladestand, Hausverbrauch, Netz), Speicher-Leistung und Wallbox.
   Vorzeichen: Netz positiv = Bezug, Speicher positiv = Laden (beides umkehrbar). Eine Recorder-Abfrage für alle Leistungen.
   Farben (dunkle Fläche): PV #ffc457, Verbrauch #63c7ff, Netz #b39cff. */
const EN_PV = "#ffc457", EN_USE = "#63c7ff", EN_GRID = "#b39cff";
const BAT_RE = /(akku|batter|battery|hausspeicher|stromspeicher)/i;
const EN_POS = { pv: [50, 14], grid: [12, 50], bat: [88, 50], wb: [50, 86] };

/** Welche Sensoren die Energie-Seite nutzt; null = keine Energiedaten. */
function energyCfg(h, L, tech, price) {
  const H = L.header || {}, E = L.energy || {};
  if (E.enabled === false) return null;
  const S = (e) => (e && h.states[e] ? e : "");
  const pv = S(H.pv), grid = S(H.grid), house = S(H.power), soc = S(H.battery);
  const wb = (tech && tech.wb && tech.wb.power) || "";
  const lbl = (e) => `${e} ${h.states[e].attributes.friendly_name || ""}`;
  const bat = S(E.battery_power) || Object.keys(h.states).find((e) => e.startsWith("sensor.") && dc(h.states[e]) === "power" && ![pv, grid, house, wb].includes(e)
    && BAT_RE.test(lbl(e)) && !/(pv|solar|grid|netz|soc|wallbox|evcc|lade)/i.test(lbl(e))) || "";
  if (!pv && !grid && !house && !bat) return null;
  return { pv, grid, house, soc, bat, wb, wbOn: (tech && tech.wb && tech.wb.charging) || "", gridInv: !!E.grid_invert, batInv: !!E.battery_invert, price: (price && price.sensor) || "" };
}
const energyWatch = (c) => (c ? [c.pv, c.grid, c.house, c.soc, c.bat, c.wb, c.wbOn].filter(Boolean) : []);
const energyIds = (c) => (c ? [c.pv, c.grid, c.house, c.bat, c.price].filter(Boolean) : []);
const kwTxt = (w) => (w === null ? "–" : Math.abs(w) >= 1000 ? `${NF1.format(w / 1000)} kW` : `${NF0.format(w)} W`);
const kwhTxt = (wh) => (wh === null ? "–" : `${NF1.format(wh / 1000)} kWh`);
const pctTxt = (v) => (v === null ? "–" : `${NF0.format(Math.round(v * 100))} %`);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Leistungen jetzt in W, mit Vorzeichen wie oben. Gesamtverbrauch aus der Bilanz (PV + Netz − Speicher). */
function energyFlows(pv, grid, bat, house, wb) {
  const p = pv === null ? null : Math.max(0, pv);
  const total = grid !== null ? Math.max(0, (p || 0) + grid - (bat || 0)) : house !== null ? house + (wb || 0) : null;
  const home = house !== null ? Math.max(0, house) : total !== null ? Math.max(0, total - (wb || 0)) : null;
  const imp = grid === null ? null : Math.max(0, grid), exp = grid === null ? null : Math.max(0, -grid);
  return {
    pv: p, grid, bat, wb, home, total, imp, exp,
    autark: total && imp !== null ? clamp01(1 - imp / total) : total === 0 && imp !== null ? 1 : null,
    own: p !== null && p > 50 && exp !== null ? clamp01(1 - exp / p) : null,
  };
}

function energyNow(h, c) {
  const W = (e) => (e ? powerW(h.states[e]) : null);
  const g = W(c.grid), b = W(c.bat);
  return energyFlows(W(c.pv), g === null ? null : c.gridInv ? -g : g, b === null ? null : c.batInv ? -b : b, W(c.house), W(c.wb));
}

function energyFlowHTML(c) {
  const has = { pv: !!c.pv, grid: !!c.grid, bat: !!(c.bat || c.soc), wb: !!c.wb };
  const node = (k, ic, lbl, eid) => (has[k] ? `<button class="enode ${k}" style="left:${EN_POS[k][0]}%;top:${EN_POS[k][1]}%" data-act="more" data-eid="${esc(eid)}"><span class="enic">${icon(ic)}</span><b></b><small>${lbl}</small></button>` : "");
  const line = (k) => (has[k] ? `<line class="eft ${k}" x1="${EN_POS[k][0]}" y1="${EN_POS[k][1]}" x2="50" y2="50"/><line class="efd ${k} off" x1="${EN_POS[k][0]}" y1="${EN_POS[k][1]}" x2="50" y2="50"/>` : "");
  return `<div class="glass eflow" data-u="energy">
    <div class="trh"><span class="trt">${icon("mdi:transit-connection-variant")}Energiefluss</span></div>
    <div class="efwrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${["pv", "grid", "bat", "wb"].map(line).join("")}</svg>
      ${node("pv", "mdi:solar-power-variant", "Erzeugung", c.pv)}
      ${node("grid", "mdi:transmission-tower", "Netz", c.grid)}
      ${node("bat", "mdi:battery", "Speicher", c.soc || c.bat)}
      ${node("wb", "mdi:ev-station", "Wallbox", c.wb)}
      <button class="enode hub" style="left:50%;top:50%" data-act="more" data-eid="${esc(c.house || c.grid || c.pv)}"><span class="enic">${icon("mdi:home-lightning-bolt-outline")}</span><b></b><small>Haus</small></button>
    </div></div>`;
}

/** Fluss und Kennzahlen „jetzt“ – sofort bei jedem neuen Wert. */
function updateEnergy(el, ctx) {
  const c = ctx._model.energy;
  if (!c) return;
  const h = ctx._hass, F = energyNow(h, c), soc = num(h.states[c.soc]);
  const sig = energyWatch(c).map((e) => { const s = h.states[e]; return s ? s.state : ""; }).join(";");
  if (el._sig === sig) return;
  el._sig = sig;
  const wbOn = c.wbOn ? isOn(h.states[c.wbOn]) : F.wb !== null && F.wb > 50;
  const set = (k, val, sub) => { const n = el.querySelector(`.enode.${k}`); if (!n) return; setText(n, "b", val); setText(n, "small", sub); };
  set("pv", kwTxt(F.pv), "Erzeugung");
  set("grid", kwTxt(F.grid === null ? null : Math.abs(F.grid)), F.grid === null ? "Netz" : F.grid < -20 ? "Einspeisung" : F.grid > 20 ? "Bezug" : "Netz");
  set("bat", soc !== null ? `${NF0.format(soc)} %` : kwTxt(F.bat === null ? null : Math.abs(F.bat)),
    F.bat === null || Math.abs(F.bat) <= 20 ? "Speicher" : `${F.bat > 0 ? "lädt" : "entlädt"} ${kwTxt(Math.abs(F.bat))}`);
  set("wb", kwTxt(F.wb), wbOn ? "lädt" : "Wallbox");
  set("hub", kwTxt(F.home), "Haus");
  if (soc !== null) setIcon(el.querySelector(".enode.bat") || el, ".enic ha-icon", batteryIcon(soc));
  // Punkte laufen in Flussrichtung; Richtung ist Knoten → Haus, rev = Haus → Knoten
  const flow = { pv: F.pv, grid: F.grid, bat: F.bat === null ? null : -F.bat, wb: F.wb === null ? null : wbOn || F.wb > 50 ? -F.wb : 0 };
  for (const [k, w] of Object.entries(flow)) {
    const d = el.querySelector(`.efd.${k}`);
    if (!d) continue;
    const on = w !== null && Math.abs(w) > 20;
    d.classList.toggle("off", !on);
    d.classList.toggle("rev", on && w < 0);
    if (on) d.style.animationDuration = Math.abs(w) >= 3000 ? "0.7s" : Math.abs(w) >= 1000 ? "1.1s" : "1.7s";
  }
  el.classList.toggle("producing", F.pv !== null && F.pv > 20);
  // Seitenkopf und Kennzahlen „jetzt“
  const page = el.getRootNode();
  const st = page.querySelector && page.querySelector(".ensub");
  if (st) setText(st, ".ct", F.exp !== null && F.exp > 50 ? `Speist ${kwTxt(F.exp)} ein` : F.imp !== null && F.imp > 50 ? `Bezieht ${kwTxt(F.imp)} aus dem Netz` : F.grid !== null ? "Netz ausgeglichen" : "");
  const now = page.querySelector && page.querySelector(".ennow");
  if (now) {
    const stat = (lbl, val, sub = "") => `<span class="cts"><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ""}</span>`;
    setHtml(now, [
      F.autark !== null ? stat("Autarkie", pctTxt(F.autark), "Verbrauch aus eigener Energie") : "",
      F.own !== null ? stat("Eigenverbrauch", pctTxt(F.own), "der PV-Leistung im Haus") : "",
      F.total !== null && c.grid ? stat("Verbrauch gesamt", kwTxt(F.total), c.wb && F.wb ? `davon Wallbox ${kwTxt(F.wb)}` : "") : "",
      soc !== null ? stat("Speicher", `${NF0.format(soc)} %`, F.bat !== null && Math.abs(F.bat) > 20 ? `${F.bat > 0 ? "lädt" : "entlädt"} ${kwTxt(Math.abs(F.bat))}` : "Ruhe") : "",
    ].join("") || `<span class="cts"><small>Jetzt</small><b>–</b></span>`);
  }
}

/** Werte je 5 Minuten auf gemeinsamem Raster (NaN = keine Daten). */
function rasterSeries(pts, start, now, f = 1) {
  const n = Math.ceil((now - start) / TREND_BUCKET) + 1, out = new Float64Array(n).fill(NaN);
  if (!pts) return out;
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = Math.min(now, start + k * TREND_BUCKET);
    while (i < pts.length - 1 && pts[i + 1][0] <= t) i++;
    const p = pts[i];
    if (p && p[0] <= t + TREND_BUCKET && t - p[0] <= TREND_GAP && finite(p[1])) out[k] = p[1] * f;
  }
  return out;
}

/** Reihen der letzten 24 h (W) und Bilanz seit Mitternacht (Wh). Höchstens alle 15 s neu gerechnet. */
function energySeries(ctx, force) {
  const c = ctx._model.energy, h = ctx._hass, now = Date.now();
  if (ctx._enS && ctx._enS.c === c && now - ctx._enS.at < 15000 && !force) return ctx._enS;
  const start = now - TREND_MS;
  const unit = (e) => (e && h.states[e] && h.states[e].attributes.unit_of_measurement === "kW" ? 1000 : 1);
  const get = (e, inv) => (e ? rasterSeries(trendSeries(h, e), start, now, unit(e) * (inv ? -1 : 1)) : null);
  const pv = get(c.pv), grid = get(c.grid, c.gridInv), bat = get(c.bat, c.batInv), house = get(c.house);
  const n = Math.ceil((now - start) / TREND_BUCKET) + 1;
  const use = new Float64Array(n).fill(NaN);
  for (let k = 0; k < n; k++) {
    const F = energyFlows(pv ? (finite(pv[k]) ? pv[k] : null) : null, grid && finite(grid[k]) ? grid[k] : null, bat && finite(bat[k]) ? bat[k] : null, house && finite(house[k]) ? house[k] : null, null);
    if (house && finite(house[k])) use[k] = house[k];
    else if (!house && F.total !== null && (!c.pv || (pv && finite(pv[k])))) use[k] = F.total;
  }
  // Bilanz seit Mitternacht: 5-Minuten-Mittelwerte × 5 Minuten
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const k0 = Math.max(0, Math.ceil((mid.getTime() - start) / TREND_BUCKET));
  const dt = TREND_BUCKET / 3600000;
  const sum = (arr, fn) => { if (!arr) return null; let s = 0, any = false; for (let k = k0; k < n; k++) if (finite(arr[k])) { s += fn(arr[k]) * dt; any = true; } return any ? s : null; };
  const day = { pv: sum(pv, (v) => Math.max(0, v)), imp: sum(grid, (v) => Math.max(0, v)), exp: sum(grid, (v) => Math.max(0, -v)) };
  let tot = 0, anyT = false;
  if (grid) for (let k = k0; k < n; k++) if (finite(grid[k])) { tot += Math.max(0, (pv && finite(pv[k]) ? Math.max(0, pv[k]) : 0) + grid[k] - (bat && finite(bat[k]) ? bat[k] : 0)) * dt; anyT = true; }
  day.use = anyT ? tot : sum(house, (v) => Math.max(0, v));
  day.autark = day.use && day.imp !== null ? clamp01(1 - day.imp / day.use) : null;
  day.own = day.pv && day.pv > 50 && day.exp !== null ? clamp01(1 - day.exp / day.pv) : null;
  ctx._enS = { c, at: now, start, now, S: { pv, use, grid, bat }, day };
  return ctx._enS;
}

function enLoad(el, ctx) {
  const c = ctx._model.energy;
  const rerun = () => ctx.shadowRoot.querySelectorAll('[data-u="enday"],[data-u="entrend"],[data-u="enprice"]').forEach((x) => { if (x.isConnected) { x._force = true; UPD[x.dataset.u].run(x, ctx); x._force = false; } });
  return trendEnsure(ctx._hass, energyIds(c), rerun);
}

function enDayHTML(withDay = true) {
  return `<div class="glass enside" data-u="enday"${withDay ? "" : ` data-noday="1"`}>
    <div class="trh"><span class="trt">${icon("mdi:gauge")}Jetzt</span></div><div class="ctstats ennow"></div>
    ${withDay ? `<div class="trh"><span class="trt">${icon("mdi:calendar-today")}Heute</span><span class="enhint">seit Mitternacht, aus dem Verlauf berechnet</span></div>
    <div class="ctstats enday"><span class="cts"><small>Heute</small><b>–</b><em>Lade Verlauf …</em></span></div>
    <div class="ensplit" hidden><i class="own"></i><i class="imp"></i></div><div class="ensplitl" hidden></div>` : ""}</div>`;
}

function updateEnDay(el, ctx) {
  const c = ctx._model.energy;
  if (!c || el.dataset.noday) return;
  if (enLoad(el, ctx)) return;
  const now = Date.now();
  if (el._drawn && now - el._drawn < 15000 && !el._force) {
    if (!el._tq) el._tq = setTimeout(() => { el._tq = 0; if (el.isConnected) { el._force = true; updateEnDay(el, ctx); el._force = false; } }, 15000 - (now - el._drawn));
    return;
  }
  el._drawn = now;
  const { day: D } = energySeries(ctx, el._force);
  const stat = (lbl, val, sub = "") => `<span class="cts"><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ""}</span>`;
  const any = [D.pv, D.use, D.imp, D.exp].some((v) => v !== null);
  setHtml(el.querySelector(".enday"), any ? [
    D.pv !== null ? stat("Erzeugt", kwhTxt(D.pv)) : "",
    D.use !== null ? stat("Verbraucht", kwhTxt(D.use)) : "",
    D.imp !== null ? stat("Bezogen", kwhTxt(D.imp)) : "",
    D.exp !== null ? stat("Eingespeist", kwhTxt(D.exp)) : "",
    D.autark !== null ? stat("Autarkie", pctTxt(D.autark)) : "",
    D.own !== null ? stat("Eigenverbrauch", pctTxt(D.own)) : "",
  ].join("") : stat("Heute", "–", "Noch kein Verlauf aufgezeichnet (Recorder)."));
  const bar = el.querySelector(".ensplit"), lab = el.querySelector(".ensplitl");
  const show = D.autark !== null && D.use > 0;
  setHidden(bar, !show); setHidden(lab, !show);
  if (show) {
    setWidth(bar.querySelector(".own"), D.autark * 100); setWidth(bar.querySelector(".imp"), (1 - D.autark) * 100);
    setHtml(lab, `<span class="own"><i></i>eigene Energie ${kwhTxt(D.use - D.imp)}</span><span class="imp"><i></i>aus dem Netz ${kwhTxt(D.imp)}</span>`);
  }
}

function enTrendHTML(c) {
  return `<div class="glass ctrend entrend" data-u="entrend">
    <div class="trh"><span class="trt">${icon("mdi:chart-areaspline")}Leistung 24 h</span>
      ${c.pv ? `<span class="ctl pv"><i></i>PV<b></b></span>` : ""}<span class="ctl use"><i></i>Verbrauch<b></b></span>${c.grid ? `<span class="ctl grid" title="unter null = Einspeisung"><i></i>Netz<b></b></span>` : ""}</div>
    <div class="trc enc"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><g class="trgrid"></g><g class="ctgrid"></g><line class="enzero" x1="0" x2="1000"/>
      <path class="ena pv"/><path class="enp grid"/><path class="enp use"/><path class="enp pv"/></svg>
      <div class="cty"></div><div class="trx"></div><div class="trcur"><i class="pv"></i><i class="use"></i><i class="grid"></i></div><div class="trtip"></div>
      <div class="trmsg">${icon("mdi:loading", "spin")}Lade Verlauf …</div></div></div>`;
}

function updateEnTrend(el, ctx) {
  const c = ctx._model.energy;
  if (!c) return;
  const h = ctx._hass, msg = el.querySelector(".trmsg");
  const F = energyNow(h, c);
  setText(el, ".ctl.pv b", kwTxt(F.pv)); setText(el, ".ctl.use b", kwTxt(c.house ? F.home : F.total)); setText(el, ".ctl.grid b", kwTxt(F.grid));
  if (enLoad(el, ctx)) { setHidden(msg, false); return; }
  const now = Date.now();
  if (el._drawn && now - el._drawn < 15000 && !el._force) {
    if (!el._tq) el._tq = setTimeout(() => { el._tq = 0; if (el.isConnected) { el._force = true; updateEnTrend(el, ctx); el._force = false; } }, 15000 - (now - el._drawn));
    return;
  }
  const E = energySeries(ctx, el._force), { start } = E;
  const toPts = (arr) => (arr ? Array.from(arr, (v, k) => [Math.min(E.now, start + k * TREND_BUCKET), v]) : []);
  const S = { pv: toPts(E.S.pv), use: toPts(E.S.use), grid: toPts(E.S.grid) };
  const vals = [...S.pv, ...S.use, ...S.grid].map((p) => p[1]).filter(finite);
  if (vals.length < 3) {
    setHidden(msg, false);
    msg.innerHTML = `${icon("mdi:chart-line-variant")}Noch kein Verlauf aufgezeichnet (Recorder).`;
    el.classList.add("nodata"); return;
  }
  setHidden(msg, true); el.classList.remove("nodata");
  el._drawn = now;
  const lo0 = Math.min(0, ...vals) / 1000, hi0 = Math.max(500, ...vals) / 1000;
  let step = 50, lo = 0, hi = 50;
  for (const s of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]) {
    const l = Math.floor(lo0 / s) * s, u = Math.ceil(hi0 / s) * s;
    if ((u - l) / s <= 4) { step = s; lo = l; hi = u; break; }
  }
  const H = 100, pad = 4, x = (t) => ((t - start) / TREND_MS) * 1000, y = (w) => H - pad - ((w / 1000 - lo) / (hi - lo)) * (H - 2 * pad);
  for (const k of ["pv", "use", "grid"]) el.querySelector(`.enp.${k}`).setAttribute("d", trendPath(S[k], x, y));
  // PV als Fläche bis null
  el.querySelector(".ena.pv").setAttribute("d", areaPath(S.pv, x, y, y(0)));
  const z = el.querySelector(".enzero"); z.setAttribute("y1", y(0).toFixed(1)); z.setAttribute("y2", y(0).toFixed(1));
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  el.querySelector(".ctgrid").innerHTML = ticks.map((v) => `<line x1="0" x2="1000" y1="${y(v * 1000).toFixed(1)}" y2="${y(v * 1000).toFixed(1)}"/>`).join("");
  setHtml(el.querySelector(".cty"), ticks.map((v) => `<span style="top:${y(v * 1000)}%">${NF1.format(v).replace(",0", "")}${v === ticks[ticks.length - 1] ? " kW" : ""}</span>`).join(""));
  const hour = Math.floor(now / 3600000);
  const trx = el.querySelector(".trx"), axk = axisKey(trx, hour);
  if (el._hour !== axk) {
    el._hour = axk;
    const tk = []; const d0 = new Date(start); d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime() + 3600000; t < now; t += 3600000) if (new Date(t).getHours() % 6 === 0) tk.push(t);
    el.querySelector(".trgrid").innerHTML = tk.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="0" y2="${H}"/>`).join("");
    el.querySelector(".trx").innerHTML = tk.filter((t) => x(t) < axisCut(trx)).map((t) => `<span style="left:${(x(t) / 10).toFixed(2)}%">${new Date(t).getHours()} Uhr</span>`).join("") + `<span class="now">jetzt</span>`;
  }
  el._en = { S, start, y };
  if (el._hover !== undefined) enHover(el, el._hover);
}

/** Fläche unter einer Reihe bis zur Nulllinie, mit Lücken wie trendPath. */
function areaPath(pts, x, y, y0) {
  let d = "", run = [], lastT = 0;
  const flush = () => { if (run.length > 1) d += `M${run[0][0]} ${y0.toFixed(1)}${run.map(([a, b]) => `L${a} ${b}`).join("")}L${run[run.length - 1][0]} ${y0.toFixed(1)}Z`; run = []; };
  for (const [t, v] of pts) {
    if (!finite(v) || (run.length && t - lastT > TREND_GAP)) { flush(); if (!finite(v)) continue; }
    run.push([x(t).toFixed(1), y(v).toFixed(1)]); lastT = t;
  }
  flush();
  return d;
}

function enHover(el, frac) {
  const T = el._en, tip = el.querySelector(".trtip"), cur = el.querySelector(".trcur");
  if (!T || frac === null) { el._hover = undefined; cur.classList.remove("on"); tip.classList.remove("on"); return; }
  el._hover = frac;
  const t = T.start + frac * TREND_MS, parts = [];
  for (const [k, lbl] of [["pv", "PV"], ["use", "Verbrauch"], ["grid", "Netz"]]) {
    const p = trendAt(T.S[k], t), dot = cur.querySelector(`i.${k}`);
    if (!p || !finite(p[1])) { dot.style.display = "none"; continue; }
    dot.style.display = ""; dot.style.top = `${T.y(p[1])}%`;
    parts.push(`<span class="tk ${k}"><i></i>${k === "grid" ? (p[1] < -20 ? "Einspeisung" : "Bezug") : lbl} <b>${kwTxt(k === "grid" ? Math.abs(p[1]) : p[1])}</b></span>`);
  }
  tip.innerHTML = `<span>${new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>${parts.join("")}`;
  cur.style.left = `${frac * 100}%`; tip.style.left = `${Math.min(Math.max(frac * 100, 20), 80)}%`;
  cur.classList.add("on"); tip.classList.add("on");
}

/* ---------- Strompreis und Kosten (Anzeige in strompreis.js) ---------- */
/** Karte nur, wenn es etwas zu zeigen gibt: Preissensor oder Netz (Kosten zum festen Preis). */
const enPriceCard = (c, p) => (p && (p.sensor || (c && c.grid)) ? enPriceHTML() : "");

function updateEnPriceCard(el, ctx) {
  const c = ctx._model.energy, p = ctx._model.price, h = ctx._hass;
  if (!p) return;
  const cost = !!(c && c.grid);
  setHidden(el.querySelector(".enpch"), !cost); setHidden(el.querySelector(".enpcost"), !cost);
  if (!cost || enLoad(el, ctx)) { updateEnPrice(el, ctx, null); return; }
  // Preis „jetzt“ sofort, Kosten höchstens alle 15 s
  const now = Date.now();
  if (el._drawn && now - el._drawn < 15000 && !el._force) {
    updateEnPrice(el, ctx, null);
    if (!el._tq) el._tq = setTimeout(() => { el._tq = 0; if (el.isConnected) { el._force = true; updateEnPriceCard(el, ctx); el._force = false; } }, 15000 - (now - el._drawn));
    return;
  }
  el._drawn = now;
  const E = energySeries(ctx, el._force);
  const st = c.price && h.states[c.price], f = st ? unitFactor(st.attributes.unit_of_measurement) : null;
  const hist = st && f !== null && !priceInfo(h, p).slots.length ? rasterSeries(trendSeries(h, c.price), E.start, E.now, f) : null;
  updateEnPrice(el, ctx, E, hist);
}

export { enDayHTML, enPriceCard, updateEnPriceCard, energyCfg, energyFlowHTML, energyIds, energyWatch, enHover, enTrendHTML, updateEnDay, updateEnergy, updateEnTrend };
