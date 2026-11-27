/* Haus Visualisierung – Technik: Heizung (Speicher, Kamin, Heizkurve) und Wallbox (EVCC). */

import { dc, dom, entName, esc, fmtState, icon, isOn, NF0, NF1, num, outdoorSensor, powerW, setText } from "./grundlagen.js";
import { finite } from "./verlauf.js";
import { wbPriceHTML } from "./strompreis.js";
import { isWallboxPlatform, labelled, labelledAreas, sameDevice } from "./erkennung.js";

/* ------------------------------------------------------------------------ */
/*  Technik: Heizung (Speicher, Kamin, Heizkurve) und Wallbox (EVCC)          */
/* ------------------------------------------------------------------------ */
/* Alles wird aus vorhandenen Entitäten erkannt; in Einstellungen → Technik lässt sich jede Zuordnung
   von Hand setzen. Die Karten erscheinen auf der Raumseite des Heizungsraums bzw. der Einfahrt. */
const HEAT_AREA_RE = /(heiz|technik)/i;
const WB_AREA_RE = /(einfahrt|garage|carport|stellplatz|auffahrt)/i;
const TANK_RE = /(speicher|puffer|boiler|tank)/i;
const STOVE_RE = /(kamin|ofen|stove|holz)/i;
const WB_RE = /(evcc|wallbox|wall_box|go_?e|easee|wattpilot|openwb|keba|ladestation|ladepunkt|loadpoint|charger)/i;
const TANK_POS = (s) => (/(oben|top|ober)/i.test(s) ? 0 : /(mitte|middle|mid)/i.test(s) ? 1 : /(unten|bottom|unter)/i.test(s) ? 2 : 1.5);
/* Bekannte Lademodi (EVCC); andere Wallboxen: Namen je Option in Einstellungen → Wallbox („-“ blendet aus) */
const WB_MODES = { off: "Aus", now: "Sofort", minpv: "Min + PV", pv: "PV" };
const wbModeName = (W, o) => { const n = ((W && W.mode_names) || {})[o]; return n || WB_MODES[String(o).toLowerCase()] || String(o); };

function entArea(h, e) {
  const r = (h.entities || {})[e];
  if (!r) return null;
  return r.area_id || (r.device_id && h.devices && h.devices[r.device_id] && h.devices[r.device_id].area_id) || null;
}

/** Zuordnung für Heizung und Wallbox: Einstellungen zuerst, sonst automatisch. */
function techCfg(h, L, areas) {
  const ids = Object.keys(h.states);
  const S = (e) => h.states[e];
  const labels = new Map();
  const label = (e) => { let l = labels.get(e); if (l === undefined) labels.set(e, (l = `${e} ${(S(e) && S(e).attributes.friendly_name) || ""}`)); return l; };
  const temps = ids.filter((e) => e.startsWith("sensor.") && dc(S(e)) === "temperature");
  const tempSet = new Set(temps);
  const isTemp = (e) => tempSet.has(e);
  const pick = (v) => (v && S(v) ? v : "");
  const byAreaName = (re) => [...areas.values()].find((a) => re.test(a.name));
  const byAreaLabel = (id) => labelledAreas(h, id).map((x) => areas.get(x)).find(Boolean);
  const lab = (id, ok = () => true) => labelled(h, id).filter(ok);
  const used = new Set();
  // ---- Heizung ----
  const H = L.heating || {};
  let heat = null;
  if (H.enabled !== false) {
    const curveOn = (H.parts || {}).curve !== false;
    const curve = !curveOn ? "" : pick(H.curve) || ids.find((e) => e.startsWith("sensor.") && S(e).attributes.slope !== undefined && (S(e).attributes.curve !== undefined || S(e).attributes.heating_limit !== undefined)) || "";
    const mixer = pick(H.mixer) || ids.find((e) => e.startsWith("sensor.") && S(e).attributes.feedforward !== undefined && S(e).attributes.status !== undefined) || "";
    const tankSort = (a, b) => TANK_POS(label(a)) - TANK_POS(label(b)) || label(a).localeCompare(label(b), "de");
    const tankLab = lab("haus_speicher", isTemp).sort(tankSort);
    const parts = { tank: true, stove: true, curve: true, ...(H.parts || {}) };
    const tank = !parts.tank ? [] : (H.tank || []).filter((e) => S(e)).length ? H.tank.filter((e) => S(e)) : tankLab.length ? tankLab
      : temps.filter((e) => TANK_RE.test(label(e)) && !/soll|target/i.test(label(e))).sort((a, b) => TANK_POS(label(a)) - TANK_POS(label(b)) || label(a).localeCompare(label(b), "de"));
    const stove = !parts.stove ? "" : pick(H.stove) || lab("haus_kamin", isTemp)[0] || temps.find((e) => STOVE_RE.test(label(e))) || "";
    const pump = !stove ? "" : pick(H.stove_pump) || lab("haus_kamin_pumpe")[0] || ids.find((e) => /^(sensor|switch|fan|binary_sensor|number)\./.test(e) && STOVE_RE.test(label(e)) && /pump/i.test(label(e))) || "";
    const flow = pick(H.flow) || lab("haus_vorlauf", isTemp)[0] || temps.find((e) => /vorlauf|flow/i.test(label(e)) && !/soll|target|prim/i.test(label(e))) || "";
    // Baustein „Weitere Werte“: beliebige Entitäten (Wärmepumpe, Rücklauf, Leistung …), sonst Label „Haus Heizung“
    const extra = (H.extra || []).filter((e) => S(e)).length ? H.extra.filter((e) => S(e)) : lab("haus_heizung").filter((e) => ![...tank, stove, pump, flow].includes(e)).slice(0, 12);
    const outdoor = pick(H.outdoor) || outdoorSensor(h, "temperature");
    const manual = !!H.manual_curve && curveOn;
    if (tank.length || stove || curve || manual || extra.length) {
      const area = (H.area && areas.get(H.area)) || byAreaLabel("haus_heizung") || byAreaName(HEAT_AREA_RE) || areas.get(entArea(h, tank[0] || curve || flow || extra[0]));
      heat = { area: area ? area.id : null, tank, stove, pump, curve, mixer, flow, outdoor, extra, manual };
      [...tank, stove, pump, curve, mixer, flow, ...extra].filter(Boolean).forEach((e) => used.add(e));
    }
  }
  // ---- Wallbox ----
  const W = L.wallbox || {};
  let wb = null;
  if (W.enabled !== false) {
    // Kandidaten: Label „Haus Wallbox“ (Entität oder Gerät), Integration der Wallbox, Name – jeweils mit dem ganzen Gerät
    const seed = [...lab("haus_wallbox"), ...ids.filter((e) => isWallboxPlatform(h, e))];
    const cand = [...new Set([...seed, ...seed.flatMap((e) => sameDevice(h, e)), ...ids.filter((e) => WB_RE.test(label(e)))])];
    const find = (doms, re, not) => cand.find((e) => doms.includes(dom(e)) && re.test(label(e)) && !(not && not.test(label(e)))) || "";
    const power = pick(W.power) || cand.find((e) => e.startsWith("sensor.") && dc(S(e)) === "power" && /(charg|lade|power|leistung)/i.test(label(e)) && !/(pv|grid|netz|home|haus)/i.test(e)) || "";
    const mode = pick(W.mode) || cand.find((e) => /^(select|input_select)\./.test(e) && (S(e).attributes.options || []).some((o) => ["pv", "now", "minpv"].includes(String(o).toLowerCase()))) || find(["select", "input_select"], /(mode|modus)/i);
    const soc = pick(W.soc) || find(["sensor"], /(soc|ladestand)/i, /(limit|min|target|ziel|max)/i);
    const limit = pick(W.limit) || find(["number", "input_number", "select"], /(limit|target|ziel)/i);
    const energy = pick(W.energy) || cand.find((e) => e.startsWith("sensor.") && dc(S(e)) === "energy" && /(session|charged|geladen|sitzung)/i.test(label(e))) || "";
    const connected = pick(W.connected) || find(["binary_sensor"], /(connected|plugged|angesteckt|verbunden)/i);
    const charging = pick(W.charging) || find(["binary_sensor"], /(charging|l(ä|ae)dt)/i);
    const range = pick(W.range) || find(["sensor"], /(range|reichweite)/i);
    if (power || mode) {
      const area = (W.area && areas.get(W.area)) || byAreaLabel("haus_wallbox") || areas.get(entArea(h, power || mode)) || byAreaName(WB_AREA_RE);
      wb = { area: area ? area.id : null, power, mode, soc, limit, energy, connected, charging, range };
      [power, mode, soc, limit, energy, connected, charging, range].filter(Boolean).forEach((e) => used.add(e));
    }
  }
  return { heat, wb, used };
}

/* ---------- Heizkurve ---------- */
/** Heizkurvenformel (wie die Integration „Heizkurve Fußbodenheizung“): DAR = Außen − Raum-Soll. */
function curveFlow(ta, p) {
  const dar = ta - p.room;
  const v = p.room + p.level - p.slope * dar * (1.4347 + 0.021 * dar + 247.9e-6 * dar * dar);
  return Math.min(p.max, Math.max(p.min, v));
}

function curveParams(h, cfg, L) {
  const st = cfg.curve && h.states[cfg.curve];
  const a = st ? st.attributes : {};
  const M = (L.heating && L.heating.manual) || {};
  const n = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
  return { slope: n(a.slope, n(M.slope, 0.3)), level: n(a.level, n(M.level, 0)), room: n(a.room_temperature, n(M.room, 20)),
    min: n(a.min_flow, n(M.min, 22)), max: n(a.max_flow, n(M.max, 40)), limit: n(a.heating_limit, n(M.limit, 16)), fromEntity: !!st };
}

/** Kurvenpunkte aus dem Attribut „curve“ (Liste oder Objekt), sonst aus der Formel. */
function curvePoints(st, p) {
  const c = st && st.attributes.curve;
  let pts = [];
  if (Array.isArray(c)) {
    pts = c.map((q) => (Array.isArray(q) ? [parseFloat(q[0]), parseFloat(q[1])]
      : q && typeof q === "object" ? [parseFloat(q.outdoor ?? q.outdoor_temperature ?? q.t ?? q.x ?? q.temp), parseFloat(q.flow ?? q.flow_temperature ?? q.target ?? q.y ?? q.v ?? q.value)] : [NaN, NaN]));
  } else if (c && typeof c === "object") pts = Object.entries(c).map(([k, v]) => [parseFloat(k), parseFloat(v)]);
  pts = pts.filter(([x, y]) => finite(x) && finite(y)).sort((x, y) => x[0] - y[0]);
  if (pts.length >= 2) return pts;
  const out = [];
  for (let t = -20; t <= 20; t++) out.push([t, curveFlow(t, p)]);
  return out;
}

const curveAt = (pts, t) => {
  if (!pts.length) return null;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((t - x0) / (x1 - x0)) * (y1 - y0); }
  return pts[pts.length - 1][1];
};

/** Farbe einer Wassertemperatur: kalt blau → warm orange → heiß rot. */
function tempColor(t, lo, hi) {
  const f = Math.max(0, Math.min(1, (t - lo) / Math.max(1, hi - lo)));
  // über Violett statt Grün: 215 (blau) → 270 → 330 → 15 (orange-rot)
  return `hsl(${Math.round(215 + f * 160) % 360} 78% ${Math.round(58 - f * 4)}%)`;
}

const techWatch = (cfg) => (cfg ? Object.values(cfg).flat().filter((e) => typeof e === "string" && e.includes(".")) : []);
const deg = (v, d = 1) => (v === null || v === undefined ? "–" : `${(d ? NF1 : NF0).format(v)}°`);

function heatCardHTML(a) {
  return `<div class="glass tech heat" data-u="heat" data-area="${esc(a.id)}"><div class="techh">${icon("mdi:heating-coil")}<span>Heizung</span><span class="techs"></span></div><div class="heatgrid"></div></div>`;
}

function updateHeat(el, ctx) {
  const cfg = ctx._model.tech && ctx._model.tech.heat;
  if (!cfg) return;
  const h = ctx._hass, L = ctx._layout, H = L.heating || {};
  const sig = techWatch(cfg).map((e) => { const s = h.states[e]; return s ? `${s.state}|${s.attributes.outdoor_temperature ?? ""}|${s.attributes.status ?? ""}|${s.attributes.heating_active ?? ""}` : ""; }).join(";") + ctx._isNarrow;
  if (el._sig === sig) return;
  el._sig = sig;
  const parts = [], status = [];
  // Speicher
  if (cfg.tank.length) {
    const lo = H.tank_min ?? 30, hi = H.tank_max ?? 65;
    const vals = cfg.tank.map((e) => num(h.states[e]));
    const ok = vals.filter((v) => v !== null);
    const load = ok.length ? Math.round((ok.reduce((s, v) => s + Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo))), 0) / ok.length) * 100) : null;
    const n = cfg.tank.length;
    const stops = vals.map((v, i) => `<stop offset="${n === 1 ? 50 : Math.round((i / (n - 1)) * 100)}%" stop-color="${v === null ? "#555" : tempColor(v, lo, hi)}"/>`).join("");
    const labels = cfg.tank.map((e, i) => `<button class="tkl" style="top:${n === 1 ? 50 : 12 + (i / (n - 1)) * 76}%" data-act="more" data-eid="${esc(e)}"><b>${deg(vals[i])}</b><small>${esc(entName(h, e).replace(TANK_RE, "").trim() || entName(h, e))}</small></button>`).join("");
    parts.push(`<div class="hpanel tank"><div class="hpt">${icon("mdi:storage-tank-outline")}Speicher</div>
      <div class="tkwrap"><svg viewBox="0 0 60 120" aria-hidden="true"><defs><linearGradient id="tkg-${esc(el.dataset.area)}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>
        <rect x="4" y="4" width="52" height="112" rx="22" fill="url(#tkg-${esc(el.dataset.area)})" opacity=".88"/><rect x="4" y="4" width="52" height="112" rx="22" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
        <rect x="12" y="12" width="7" height="96" rx="3.5" fill="rgba(255,255,255,.18)"/></svg><div class="tkls">${labels}</div></div>
      <div class="hpf">${load !== null ? `Ladung <b>${load} %</b>` : ""}${ok.length ? ` · Ø ${deg(ok.reduce((s, v) => s + v, 0) / ok.length)}` : ""}</div></div>`);
    if (load !== null) status.push(`Speicher ${load} %`);
  }
  // Kamin
  if (cfg.stove) {
    const t = num(h.states[cfg.stove]), hot = H.stove_hot ?? 50;
    const ps = cfg.pump && h.states[cfg.pump];
    const pv = ps ? (["on", "off"].includes(ps.state) ? (ps.state === "on" ? 100 : 0) : num(ps)) : null;
    const burning = t !== null && t >= hot, warm = t !== null && !burning && t >= hot - 15;
    const run = pv !== null && pv > 0;
    parts.push(`<div class="hpanel stove${burning ? " burn" : warm ? " warm" : ""}"><div class="hpt">${icon("mdi:fireplace")}Kamin</div>
      <button class="stv" data-act="more" data-eid="${esc(cfg.stove)}"><span class="flame">${icon(burning ? "mdi:fire" : warm ? "mdi:fire-circle" : "mdi:fire-off")}</span><b>${deg(t)}</b><small>${burning ? "Heizt" : warm ? "Kühlt ab" : "Aus"}</small></button>
      ${ps ? `<button class="pump${run ? " run" : ""}" data-act="more" data-eid="${esc(cfg.pump)}"><span>${icon("mdi:pump")}Pumpe</span><i><em style="width:${Math.max(0, Math.min(100, pv ?? 0))}%"></em></i><b>${pv === null ? "–" : ["on", "off"].includes(ps.state) ? (run ? "an" : "aus") : `${NF0.format(pv)} %`}</b></button>
        ${run && cfg.tank.length ? `<div class="hpf flowto">${icon("mdi:arrow-right-thin")}lädt den Speicher</div>` : ""}` : ""}</div>`);
    if (burning) status.push(`Kamin ${deg(t, 0)}`);
  }
  // Heizkurve
  if (cfg.curve || cfg.manual) {
    const st = cfg.curve && h.states[cfg.curve];
    const p = curveParams(h, cfg, L);
    const pts = curvePoints(st, p);
    const ta = st && finite(parseFloat(st.attributes.outdoor_temperature)) ? parseFloat(st.attributes.outdoor_temperature) : num(h.states[cfg.outdoor]);
    const soll = st ? num(st) : ta !== null ? curveFlow(ta, p) : null;
    const ist = num(h.states[cfg.flow]);
    const active = st && st.attributes.heating_active !== undefined ? st.attributes.heating_active !== false : ta === null || ta < p.limit;
    const ys = [...pts.map((q) => q[1]), p.min, p.max, soll, ist].filter(finite);
    const lo = Math.floor(Math.min(...ys) - 2), hi = Math.ceil(Math.max(...ys) + 2);
    const X = (t) => ((t + 20) / 40) * 300, Y = (v) => 150 - ((v - lo) / (hi - lo)) * 140;
    const path = pts.filter(([t]) => t >= -20 && t <= 20).map(([t, v], i) => `${i ? "L" : "M"}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
    const dev = soll !== null && ist !== null ? ist - soll : null;
    const mx = cfg.mixer && h.states[cfg.mixer];
    const pct = (x, y) => `left:${(X(x) / 3).toFixed(2)}%;top:${(Y(y) / 1.6).toFixed(2)}%`;
    const tac = ta === null ? null : Math.max(-20, Math.min(20, ta));
    parts.push(`<div class="hpanel curve"><div class="hpt">${icon("mdi:chart-bell-curve")}Heizkurve<span class="chip${active ? " on" : ""}">${active ? "Heizbetrieb" : "über Heizgrenze"}</span></div>
      <div class="hkv">
        <button data-act="more" data-eid="${esc(cfg.outdoor || cfg.curve)}"><small>Außen</small><b>${deg(ta)}</b></button>
        <button data-act="more" data-eid="${esc(cfg.curve)}"><small>Soll</small><b>${deg(soll)}</b></button>
        ${cfg.flow ? `<button data-act="more" data-eid="${esc(cfg.flow)}"><small>Ist</small><b>${deg(ist)}</b></button>` : ""}
        ${dev !== null ? `<span class="dev ${Math.abs(dev) <= 1 ? "ok" : Math.abs(dev) < 3 ? "mid" : "bad"}"><small>Abw.</small><b>${dev > 0 ? "+" : dev < 0 ? "−" : ""}${NF1.format(Math.abs(dev))} K</b></span>` : ""}
      </div>
      <div class="hcc" data-lo="${lo}" data-hi="${hi}" data-pts="${esc(JSON.stringify(pts.map(([t, v]) => [t, Math.round(v * 10) / 10])))}">
        <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true">
          <line class="hcg" x1="${X(0)}" x2="${X(0)}" y1="0" y2="160"/>
          <line class="hcm" x1="0" x2="300" y1="${Y(p.min).toFixed(1)}" y2="${Y(p.min).toFixed(1)}"/><line class="hcm" x1="0" x2="300" y1="${Y(p.max).toFixed(1)}" y2="${Y(p.max).toFixed(1)}"/>
          ${p.limit > -20 && p.limit < 20 ? `<line class="hcl" x1="${X(p.limit).toFixed(1)}" x2="${X(p.limit).toFixed(1)}" y1="0" y2="160"/>` : ""}
          <path class="hcp" d="${path}"/>
          ${tac !== null ? `<line class="hcn" x1="${X(tac).toFixed(1)}" x2="${X(tac).toFixed(1)}" y1="0" y2="160"/>` : ""}
        </svg>
        ${tac !== null && soll !== null ? `<i class="hcpt soll" style="${pct(tac, soll)}"></i>` : ""}
        ${tac !== null && ist !== null ? `<i class="hcpt ist" style="${pct(tac, ist)}"></i>` : ""}
        <span class="hcy hi">${hi}°</span><span class="hcy lo">${lo}°</span>
        <span class="hcx" style="left:0">−20°</span><span class="hcx" style="left:50%">0°</span><span class="hcx" style="right:0;left:auto">+20°</span>
        <div class="hctip"></div>
      </div>
      <div class="hpf">Steilheit ${NF1.format(p.slope)} · Niveau ${p.level > 0 ? "+" : ""}${NF1.format(p.level)} K · Raum ${deg(p.room, 0)} · Grenze ${deg(p.limit, 0)}${mx ? ` · <button class="lnk" data-act="more" data-eid="${esc(cfg.mixer)}">Mischer ${num(mx) === null ? "–" : `${NF0.format(num(mx))} %`}${mx.attributes.status ? ` · ${esc(mx.attributes.status)}` : ""}</button>` : ""}</div></div>`);
    if (soll !== null) status.push(`Vorlauf ${deg(soll, 0)}`);
  }
  const nMain = parts.length;
  // Weitere Werte (Baustein für Wärmepumpe, Gastherme …): Name und Zustand je Entität
  if (cfg.extra && cfg.extra.length) {
    parts.push(`<div class="hpanel hextra"><div class="hpt">${icon("mdi:gauge")}Werte</div><div class="hxl">${cfg.extra.map((e) => {
      const st = h.states[e];
      return `<button class="hx" data-act="more" data-eid="${esc(e)}"><small>${esc(entName(h, e))}</small><b>${st ? esc(fmtState(h, st)) : "–"}</b></button>`;
    }).join("")}</div></div>`);
  }
  el.querySelector(".heatgrid").innerHTML = parts.join("");
  el.querySelector(".heatgrid").dataset.n = String(nMain || 1);
  setText(el, ".techs", status.join(" · "));
}

/** Wert der Heizkurve unter dem Zeiger. */
function heatHover(c, frac) {
  const tip = c.querySelector(".hctip");
  if (frac === null) { tip.classList.remove("on"); return; }
  const pts = JSON.parse(c.dataset.pts || "[]"), t = Math.round(-20 + frac * 40);
  const v = curveAt(pts, t);
  if (v === null) return;
  tip.innerHTML = `Außen <b>${t > 0 ? "+" : ""}${t}°</b> → Vorlauf <b>${NF1.format(v)}°</b>`;
  tip.style.left = `${Math.min(80, Math.max(20, frac * 100))}%`;
  tip.classList.add("on");
}

/* ---------- Wallbox ---------- */
function wbCardHTML(a) {
  return `<div class="glass tech wb" data-u="wallbox" data-area="${esc(a.id)}"><div class="techh">${icon("mdi:ev-station")}<span>Wallbox</span><span class="techs"></span></div><div class="wbbody"></div>${wbPriceHTML()}</div>`;
}

function updateWallbox(el, ctx) {
  const cfg = ctx._model.tech && ctx._model.tech.wb;
  if (!cfg) return;
  const h = ctx._hass, S = (e) => (e ? h.states[e] : null);
  const sig = techWatch(cfg).map((e) => { const s = h.states[e]; return s ? s.state : ""; }).join(";");
  if (el._sig === sig) return;
  el._sig = sig;
  const pw = powerW(S(cfg.power));
  const kw = pw === null ? null : pw / 1000;
  const charging = cfg.charging ? isOn(S(cfg.charging)) : kw !== null && kw > 0.05;
  const connected = cfg.connected ? isOn(S(cfg.connected)) || charging : null;
  const soc = num(S(cfg.soc)), lim = num(S(cfg.limit)), range = num(S(cfg.range));
  const en = S(cfg.energy), enV = num(en);
  const enU = en ? en.attributes.unit_of_measurement || "kWh" : "";
  const txt = charging ? `Lädt mit ${NF1.format(kw ?? 0)} kW` : connected ? "Angesteckt – lädt nicht" : connected === false ? "Kein Fahrzeug" : "Bereit";
  const ms = S(cfg.mode);
  const W = (ctx._layout && ctx._layout.wallbox) || {};
  const opts = ms ? (ms.attributes.options || []).filter((o) => wbModeName(W, o) !== "-") : [];
  const limSt = S(cfg.limit), limStep = limSt && limSt.attributes.step ? Number(limSt.attributes.step) : 5;
  el.classList.toggle("charging", charging);
  el.querySelector(".wbbody").innerHTML = `
    <div class="wbmain">
      <button class="wbpow" data-act="more" data-eid="${esc(cfg.power || cfg.mode)}"><span class="wbic">${icon(charging ? "mdi:ev-plug-type2" : connected ? "mdi:power-plug-outline" : "mdi:power-plug-off-outline")}</span>
        <span><b>${kw === null ? "–" : NF1.format(kw)}</b> kW<small>${esc(txt)}</small></span></button>
      ${cfg.soc ? `<button class="wbcar" data-act="more" data-eid="${esc(cfg.soc)}"><span class="wbct">${icon("mdi:car-electric")}<b>${soc === null ? "–" : `${NF0.format(soc)} %`}</b>${range !== null ? `<small>${NF0.format(range)} km</small>` : ""}${lim !== null ? `<small>Ziel ${NF0.format(lim)} %</small>` : ""}</span>
        <i class="socbar"><em style="width:${Math.max(0, Math.min(100, soc ?? 0))}%"></em>${lim !== null ? `<u style="left:${Math.max(0, Math.min(100, lim))}%"></u>` : ""}</i></button>` : ""}
      ${en ? `<button class="wbses" data-act="more" data-eid="${esc(cfg.energy)}"><small>Geladen</small><b>${enV === null ? "–" : `${NF1.format(enV)} ${esc(enU)}`}</b></button>` : ""}
    </div>
    ${opts.length ? `<div class="wbmodes" role="group" aria-label="Lademodus">${opts.map((o) => `<button class="altab sm${ms.state === o ? " on" : ""}" data-act="select-opt" data-eid="${esc(cfg.mode)}" data-opt="${esc(o)}"><span>${esc(wbModeName(W, o))}</span></button>`).join("")}
      ${limSt && /^(number|input_number)\./.test(cfg.limit) ? `<span class="wblim"><small>Ziel</small><button class="sbtn" data-act="num-step" data-eid="${esc(cfg.limit)}" data-step="${-limStep}" title="Ziel senken">${icon("mdi:minus")}</button><b>${lim === null ? "–" : `${NF0.format(lim)} %`}</b><button class="sbtn" data-act="num-step" data-eid="${esc(cfg.limit)}" data-step="${limStep}" title="Ziel erhöhen">${icon("mdi:plus")}</button></span>` : ""}</div>` : ""}`;
  setText(el, ".techs", charging ? `${NF1.format(kw ?? 0)} kW` : connected ? "angesteckt" : "");
}

export { WB_MODES, wbModeName, curveFlow, heatCardHTML, heatHover, techCfg, techWatch, updateHeat, updateWallbox, wbCardHTML };
