/* Haus Visualisierung – Karte „Vorhersage“ auf der Übersicht: Wetter der nächsten Tage und Solarprognose (PV-Ertrag).
 * Wetter kommt aus wetter.js (gleiches Abo wie Beschattung und Kopfzeile). Solarprognose: eingestellte Sensoren,
 * sonst automatisch Forecast.Solar oder Solcast. */

import { esc, icon, NF0, NF1, num, setHtml } from "./grundlagen.js";
import { condIcon, condName, fcDays, shadeHeadline, shadeHints, weatherIdOf } from "./wetter.js";

const fin = (v) => typeof v === "number" && Number.isFinite(v);

/* ---------- Solarprognose ---------- */
/* Forecast.Solar legt je Dachfläche einen Satz Sensoren an (Endung _2, _3 …): die werden zusammengezählt.
   Solcast: heute, morgen, verbleibend und Tag 3 bis 7. */
const SOLAR_AUTO = [
  { src: "Forecast.Solar",
    today: /^sensor\.(.+_)?(energy_production_today|energieproduktion_heute)(_\d+)?$/,
    tomorrow: /^sensor\.(.+_)?(energy_production_tomorrow|energieproduktion_morgen)(_\d+)?$/,
    rest: /^sensor\.(.+_)?(energy_production_today_remaining|energieproduktion_heute_verbleibend)(_\d+)?$/ },
  { src: "Solcast",
    today: /^sensor\.solcast_.*forecast_today$/, tomorrow: /^sensor\.solcast_.*forecast_tomorrow$/,
    rest: /^sensor\.solcast_.*forecast_remaining_today$/, day: /^sensor\.solcast_.*forecast_day_([3-7])$/ },
];
const ENERGY_UNIT = { wh: 0.001, kwh: 1, mwh: 1000 };
const isEnergy = (st) => !!st && ENERGY_UNIT[String(st.attributes.unit_of_measurement || "").toLowerCase()] !== undefined;
/** Wert in kWh (Einheit Wh, kWh oder MWh); null = unbekannt. */
function kwh(st) {
  const v = num(st), f = st && ENERGY_UNIT[String(st.attributes.unit_of_measurement || "").toLowerCase()];
  return v === null || f === undefined ? null : v * f;
}
const sumKwh = (h, ids) => {
  const vals = ids.map((e) => kwh(h.states[e])).filter(fin);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
};

/**
 * Welche Sensoren die Solarprognose liefern. Ergebnis: { src, today: [ids], tomorrow: [ids], rest: [ids], days: {offset: id} } oder null.
 * Eingestellte Sensoren (forecast.solar_today/solar_tomorrow) gehen vor; sonst automatisch.
 */
let _memo = { states: null, F: null, v: null };
function solarCfg(h, L) {
  const F = (L && L.forecast) || {};
  if (_memo.states === h.states && _memo.F === F) return _memo.v;
  const v = solarFind(h, F);
  _memo = { states: h.states, F, v };
  return v;
}
function solarFind(h, F) {
  if (F.solar === false) return null;
  const S = (e) => (e && isEnergy(h.states[e]) ? [e] : []);
  const ids = Object.keys(h.states).filter((e) => e.startsWith("sensor.")).sort();
  let auto = null;
  for (const a of SOLAR_AUTO) {
    const today = ids.filter((e) => a.today.test(e) && isEnergy(h.states[e]));
    const tomorrow = ids.filter((e) => a.tomorrow.test(e) && isEnergy(h.states[e]));
    if (!today.length && !tomorrow.length) continue;
    const days = {};
    if (a.day) for (const e of ids) { const mm = e.match(a.day); if (mm && isEnergy(h.states[e])) days[Number(mm[1]) - 1] = e; }
    auto = { src: a.src, today, tomorrow, rest: ids.filter((e) => a.rest.test(e) && isEnergy(h.states[e])), days };
    break;
  }
  const ct = S(F.solar_today), cm = S(F.solar_tomorrow);
  if (ct.length || cm.length) {
    // eingestellt: Rest und weitere Tage nur, wenn „heute“ aus derselben automatischen Quelle stammt
    const same = auto && ct.length && auto.today.includes(ct[0]);
    return { src: "", today: ct, tomorrow: cm.length ? cm : auto && same ? auto.tomorrow : [], rest: same ? auto.rest : [], days: same ? auto.days : {} };
  }
  return auto;
}
const solarWatch = (c) => (c ? [...c.today, ...c.tomorrow, ...c.rest, ...Object.values(c.days)] : []);
/** Werte in kWh: { today, tomorrow, rest, byOffset: Map(offset → kWh) } */
function solarVals(h, c) {
  const today = sumKwh(h, c.today), tomorrow = sumKwh(h, c.tomorrow), rest = sumKwh(h, c.rest);
  const by = new Map();
  if (fin(today)) by.set(0, today);
  if (fin(tomorrow)) by.set(1, tomorrow);
  for (const [k, e] of Object.entries(c.days)) { const v = kwh(h.states[e]); if (fin(v)) by.set(Number(k), v); }
  return { today, tomorrow, rest, byOffset: by };
}
const kwhTxt = (v) => (v >= 100 ? NF0.format(v) : NF1.format(v));

/* ---------- Karte ---------- */
/** Gibt es etwas anzuzeigen? (Wetter-Entität oder Solarprognose, Karte nicht abgeschaltet) */
function fcastShown(h, L) {
  const F = (L && L.forecast) || {};
  if (F.enabled === false) return false;
  return !!weatherIdOf(h, L) || !!solarCfg(h, L);
}
/** Karte „Vorhersage“ (data-u="fcast"); variant: "side" (Cockpit-Spalte) oder "" (volle Breite). */
function fcastCardHTML(h, L, variant = "") {
  if (!fcastShown(h, L)) return "";
  const wid = weatherIdOf(h, L);
  return `<div class="glass fcast${variant ? ` ${variant}` : ""}" data-u="fcast" data-eid="${esc(wid)}">
    <div class="fch">${wid ? `<button class="fcnow" data-act="more" data-eid="${esc(wid)}" title="Wetter"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon><b class="fct"></b><small class="fcc"></small></button>` : `<span class="fcnow">${icon("mdi:solar-power-variant")}<b>Solarprognose</b></span>`}
      <span class="sp"></span><span class="fcpv"></span></div>
    <div class="fcs"></div><div class="fchint"></div></div>`;
}

const WD = (d, i) => (i === 0 ? "Heute" : i === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""));
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function updateFcast(el, ctx) {
  const h = ctx._hass, L = ctx._layout, wid = el.dataset.eid, st = wid && h.states[wid];
  // jetzt
  if (wid) {
    const now = el.querySelector(".fcnow"), t = st && st.attributes.temperature;
    const ic = now.querySelector("ha-icon"), want = condIcon(st ? st.state : "");
    if (ic.getAttribute("icon") !== want) ic.setAttribute("icon", want);
    now.querySelector(".fct").textContent = st && t != null ? `${NF0.format(t)}°` : "–";
    now.querySelector(".fcc").textContent = st ? condName(st.state) : "Wetter nicht verfügbar";
  }
  // Solarprognose
  const sc = solarCfg(h, L), sv = sc ? solarVals(h, sc) : null;
  const pvParts = [];
  if (sv && fin(sv.today)) pvParts.push(`heute <b>${kwhTxt(sv.today)} kWh</b>${fin(sv.rest) && sv.rest > 0.05 && sv.rest < sv.today - 0.05 ? ` <small>· noch ${kwhTxt(sv.rest)}</small>` : ""}`);
  if (sv && fin(sv.tomorrow)) pvParts.push(`morgen <b>${kwhTxt(sv.tomorrow)} kWh</b>`);
  setHtml(el.querySelector(".fcpv"), pvParts.length ? `${icon("mdi:solar-power-variant")}<span>PV ${pvParts.join(" · ")}</span>` : "");
  el.classList.toggle("haspv", !!pvParts.length);
  // Tage: Wetter (bis 5), sonst nur die Tage der Solarprognose
  let days = wid ? fcDays(h, wid).slice(0, 5) : [];
  if (!days.length && sv && sv.byOffset.size) {
    const t0 = midnight(new Date());
    days = [...sv.byOffset.keys()].sort((a, b) => a - b).slice(0, 5).map((k) => { const d = new Date(t0); d.setDate(d.getDate() + k); return { date: d, hi: null, lo: null, cond: null, rain: 0 }; });
  }
  const today = midnight(new Date()).getTime();
  const maxPv = sv ? Math.max(0, ...sv.byOffset.values()) : 0;
  setHtml(el.querySelector(".fcs"), days.length
    ? days.map((d) => {
      const off = Math.round((d.date.getTime() - today) / 86400000), pv = sv ? sv.byOffset.get(off) : undefined;
      const sunny = fin(pv) && maxPv > 0 && pv >= maxPv * 0.9;
      return `<div class="fc" title="${esc([condName(d.cond), fin(pv) ? `PV ${kwhTxt(pv)} kWh` : ""].filter(Boolean).join(" · "))}"><small>${WD(d.date, off)}</small>${d.cond ? icon(condIcon(d.cond)) : ""}
        ${fin(d.hi) ? `<b>${NF0.format(d.hi)}°</b>` : ""}${fin(d.lo) || d.rain >= 0.5 ? `<small>${fin(d.lo) ? `${NF0.format(d.lo)}°` : ""}${d.rain >= 0.5 ? ` · ${NF0.format(d.rain)} mm` : ""}</small>` : ""}
        ${fin(pv) ? `<i class="fpv${sunny ? " hi" : ""}">${icon("mdi:white-balance-sunny")}${kwhTxt(pv)}</i>` : ""}</div>`;
    }).join("")
    : `<small class="fcnone">${wid ? "Vorhersage wird geladen …" : "Keine Vorhersage"}</small>`);
  // wichtigster Beschattungshinweis, Tipp führt zur Seite Beschattung
  const hl = ctx._model && L.shading && L.shading.enabled !== false ? shadeHeadline(shadeHints(h, ctx._model, L)) : "";
  setHtml(el.querySelector(".fchint"), hl ? `<button class="fchb" data-act="go" data-to="beschattung">${icon("mdi:sun-angle-outline")}<span>${esc(hl)}</span>${icon("mdi:chevron-right")}</button>` : "");
}
/** Watch-Liste: Wetter, Solarsensoren und Rollos (für den Beschattungshinweis). */
const fcastWatch = (el, c) => [el.dataset.eid, ...solarWatch(solarCfg(c._hass, c._layout)), ...((c._model && c._model.agg.covers) || [])].filter(Boolean);

export { fcastCardHTML, fcastShown, fcastWatch, kwh, solarCfg, solarVals, updateFcast };
