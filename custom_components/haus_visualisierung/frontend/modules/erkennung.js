/* Haus Visualisierung – Erkennung ohne Namen: Labels von Home Assistant, Integration (Plattform), Gerät und das
 * Energie-Dashboard von Home Assistant. Die Namensregeln der Fachmodule bleiben die letzte Stufe.
 *
 * Reihenfolge überall: Einstellungen → Label → Gerät/Integration/Energie-Dashboard → Name.
 * Labels: in Home Assistant ein Label anlegen (Einstellungen → Bereiche, Labels & Zonen → Labels), z. B. „Haus PV“ –
 * Home Assistant macht daraus die ID „haus_pv“. Labels wirken an Entitäten, Geräten und (für Räume) an Bereichen. */

import { dc } from "./grundlagen.js";

/** Rollen-Labels: ID → [Anzeigename des Labels, Bedeutung]. Die Liste steht auch im README. */
const ROLLEN = {
  haus_pv: ["Haus PV", "PV-Leistung"],
  haus_netz: ["Haus Netz", "Netz-Leistung (Bezug positiv)"],
  haus_verbrauch: ["Haus Verbrauch", "Hausverbrauch"],
  haus_akku: ["Haus Akku", "Akku-Ladestand"],
  haus_akku_leistung: ["Haus Akku Leistung", "Speicher-Leistung (Laden positiv)"],
  haus_strompreis: ["Haus Strompreis", "Strompreis-Sensor"],
  haus_wallbox: ["Haus Wallbox", "Wallbox (Gerät oder Entitäten)"],
  haus_heizung: ["Haus Heizung", "Heizungsraum (Bereich) bzw. weitere Werte der Heizungskarte (Entität)"],
  haus_speicher: ["Haus Speicher", "Speicherfühler (Reihenfolge nach Namen: oben, mitte, unten)"],
  haus_kamin: ["Haus Kamin", "Kamin-Temperatur"],
  haus_kamin_pumpe: ["Haus Kamin Pumpe", "Kamin-Pumpe"],
  haus_vorlauf: ["Haus Vorlauf", "Vorlauf-Temperatur"],
  haus_aussen: ["Haus Außen", "Außenbereich (Bereich) bzw. Außenfühler (Entität)"],
  haus_regensensor: ["Haus Regensensor", "Regensensor"],
  haus_markise: ["Haus Markise", "Markise (Sturmwarnung)"],
  haus_klingel: ["Haus Klingel", "Klingel-Auslöser"],
  haus_muell: ["Haus Müll", "Kalender der Müllabfuhr"],
};

/* Integrationen (Plattform der Entität), an denen sich Geräte ohne passenden Namen erkennen lassen */
const WALLBOX_PLATFORMS = new Set(["evcc", "goecharger", "go_e", "goe_charger", "easee", "wallbox", "keba", "openwb", "openwb2", "ocpp",
  "tesla_wall_connector", "wattpilot", "zaptec", "alfen_wallbox", "heidelberg_energy_control", "nrgkick", "vestel_evc", "smartevse", "peblar", "ohme"]);
const WASTE_PLATFORMS = new Set(["waste_collection_schedule", "abfallplus", "awido", "awb_koeln", "abfall_io", "ics_calendar_waste"]);

/* Indizes je hass.entities bzw. hass.devices (beide wechseln nur bei Änderungen der Registrierung) */
let _idx = { ents: null, devs: null, areas: null, byDev: null, byLabel: null, areaLabel: null };
function index(h) {
  const ents = h.entities || {}, devs = h.devices || {}, areas = h.areas || {};
  if (_idx.ents === ents && _idx.devs === devs && _idx.areas === areas) return _idx;
  const byDev = new Map(), byLabel = new Map(), areaLabel = new Map();
  const add = (m, k, v) => { let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(v); };
  for (const [e, r] of Object.entries(ents)) {
    if (r.device_id) add(byDev, r.device_id, e);
    const labels = new Set([...(r.labels || []), ...((r.device_id && devs[r.device_id] && devs[r.device_id].labels) || [])]);
    for (const l of labels) add(byLabel, l, e);
  }
  for (const [id, a] of Object.entries(areas)) for (const l of a.labels || []) add(areaLabel, l, id);
  _idx = { ents, devs, areas, byDev, byLabel, areaLabel };
  return _idx;
}

/** Entitäten mit diesem Rollen-Label (an der Entität oder an ihrem Gerät), nur vorhandene, sortiert. */
const labelled = (h, id) => (index(h).byLabel.get(id) || []).filter((e) => h.states[e]).sort();
/** Bereiche mit diesem Label. */
const labelledAreas = (h, id) => index(h).areaLabel.get(id) || [];
/** Weitere Entitäten am selben Gerät. */
const sameDevice = (h, e) => {
  const r = (h.entities || {})[e];
  return r && r.device_id ? (index(h).byDev.get(r.device_id) || []).filter((x) => x !== e && h.states[x]) : [];
};
const platformOf = (h, e) => ((h.entities || {})[e] || {}).platform || "";
const isWallboxPlatform = (h, e) => WALLBOX_PLATFORMS.has(platformOf(h, e));
const isWastePlatform = (h, e) => WASTE_PLATFORMS.has(platformOf(h, e));

/* ---------- Einheiten: Auswahl im Assistenten nach Art statt nach Namen ---------- */
const unit = (st) => String((st && st.attributes.unit_of_measurement) || "");
const isPower = (st) => !!st && (dc(st) === "power" || /^(m?W|kW|MW)$/.test(unit(st)));
const isPercentBattery = (st) => !!st && (dc(st) === "battery" || (unit(st) === "%" && /soc|akku|batter|speicher/i.test(st.entity_id)));
const isEnergyUnit = (st) => !!st && (dc(st) === "energy" || /^(Wh|kWh|MWh)$/.test(unit(st)));
const isPrice = (st) => !!st && /\/\s*kWh$/i.test(unit(st));
const isTemp = (st) => !!st && dc(st) === "temperature";

/* ---------- Energie-Dashboard von Home Assistant ---------- */
/* energy/get_prefs liefert Energiezähler (kWh). Daraus: Leistungssensor (stat_rate, neuere Versionen) oder ein
   Leistungssensor am selben Gerät wie der Zähler. Einmal je Sitzung geladen; danach neu aufbauen lassen. */
let _prefs, _prefsLoading = false;
const _prefsWaiters = new Set();
function energyPrefs(h, onLoad) {
  if (_prefs !== undefined) return _prefs;
  if (onLoad) _prefsWaiters.add(onLoad);
  if (!_prefsLoading && h && h.callWS) {
    _prefsLoading = true;
    h.callWS({ type: "energy/get_prefs" }).then((p) => { _prefs = p || null; }).catch(() => { _prefs = null; })
      .finally(() => { _prefsLoading = false; _memo = {}; const w = [..._prefsWaiters]; _prefsWaiters.clear(); w.forEach((f) => { try { f(); } catch (err) { /* egal */ } }); });
  }
  return null;
}
/** Nur für Tests: Zwischenspeicher leeren. */
const energyPrefsReset = () => { _prefs = undefined; _prefsLoading = false; _memo = {}; };

const statOf = (x) => (typeof x === "string" && /^sensor\./.test(x) ? x : "");
/** Aus den Einstellungen des Energie-Dashboards: Zähler und ggf. Leistungssensoren je Quelle. */
function prefsSources(p) {
  const out = { solar: [], grid: [], battery: [], rate: {} };
  for (const s of (p && p.energy_sources) || []) {
    const rate = statOf(s.stat_rate) || statOf(s.power && (Array.isArray(s.power) ? s.power[0] && s.power[0].stat_rate : s.power.stat_rate));
    if (s.type === "solar") { if (statOf(s.stat_energy_from)) out.solar.push(s.stat_energy_from); if (rate) out.rate.solar = out.rate.solar || rate; }
    if (s.type === "battery") { [s.stat_energy_from, s.stat_energy_to].filter(statOf).forEach((e) => out.battery.push(e)); if (rate) out.rate.battery = out.rate.battery || rate; }
    if (s.type === "grid") {
      [s.stat_energy_from, s.stat_energy_to, ...((s.flow_from || []).map((f) => f.stat_energy_from)), ...((s.flow_to || []).map((f) => f.stat_energy_to))].filter(statOf).forEach((e) => out.grid.push(e));
      if (rate) out.rate.grid = out.rate.grid || rate;
    }
  }
  return out;
}
/* Unter mehreren Leistungssensoren eines Geräts den Gesamtwert nehmen, nicht eine einzelne Phase oder einen String */
const PART_RE = /(_l[123]\b|phase|_mppt|string_?\d|_pv[1-9]\b|\bl[123]\b)/i;
function devicePower(h, meters, want) {
  const cand = [...new Set(meters.flatMap((m) => sameDevice(h, m)))].filter((e) => e.startsWith("sensor.") && isPower(h.states[e]));
  if (!cand.length) return "";
  const lbl = (e) => `${e} ${h.states[e].attributes.friendly_name || ""}`;
  const score = (e) => (PART_RE.test(lbl(e)) ? 2 : 0) - (want && want.test(lbl(e)) ? 1 : 0);
  return cand.sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0];
}

/* ---------- Energiewerte ohne Namen ---------- */
let _memo = {};
/**
 * Automatisch erkannte Energiesensoren: { pv, grid, power, battery, battery_power, price } mit Herkunft in src.
 * Herkunft: "Label", "Energie-Dashboard" oder "Name". Leere Felder = nichts gefunden.
 */
function energieAuto(h) {
  if (!h || !h.states) return { src: {} };
  // Ergebnis hängt an Registrierung, Energie-Dashboard und der Menge der Entitäten, nicht an jedem Zustandswechsel
  const n = Object.keys(h.states).length;
  if (_memo.n === n && _memo.ents === h.entities && _memo.prefs === _prefs && _memo.v) return _memo.v;
  const v = { src: {} };
  const set = (k, e, src) => { if (e && !v[k] && h.states[e]) { v[k] = e; v.src[k] = src; } };
  const S = (e) => h.states[e];
  // 1. Labels
  const lab = (id, ok) => labelled(h, id).find((e) => ok(S(e))) || "";
  set("pv", lab("haus_pv", isPower), "Label");
  set("grid", lab("haus_netz", isPower), "Label");
  set("power", lab("haus_verbrauch", isPower), "Label");
  set("battery", lab("haus_akku", isPercentBattery), "Label");
  set("battery_power", lab("haus_akku_leistung", isPower), "Label");
  set("price", lab("haus_strompreis", isPrice), "Label");
  // 2. Energie-Dashboard
  const P = _prefs ? prefsSources(_prefs) : null;
  if (P) {
    set("pv", (P.rate.solar && isPower(S(P.rate.solar)) && P.rate.solar) || devicePower(h, P.solar, /(pv|solar|input|eingang|gesamt|total)/i), "Energie-Dashboard");
    set("grid", (P.rate.grid && isPower(S(P.rate.grid)) && P.rate.grid) || devicePower(h, P.grid, /(grid|netz|meter|zähler|total|gesamt)/i), "Energie-Dashboard");
    set("battery_power", (P.rate.battery && isPower(S(P.rate.battery)) && P.rate.battery) || devicePower(h, P.battery, /(batter|akku|speicher)/i), "Energie-Dashboard");
    const soc = [...new Set(P.battery.flatMap((m) => sameDevice(h, m)))].find((e) => e.startsWith("sensor.") && dc(S(e)) === "battery" && unit(S(e)) === "%");
    set("battery", soc, "Energie-Dashboard");
  }
  // 3. Namen (letzte Stufe; nur eindeutige Leistungssensoren)
  const ids = Object.keys(h.states).filter((e) => e.startsWith("sensor."));
  const byName = (re, not, ok = isPower) => ids.filter((e) => ok(S(e)) && re.test(`${e} ${S(e).attributes.friendly_name || ""}`) && !(not && not.test(`${e} ${S(e).attributes.friendly_name || ""}`))).sort((a, b) => a.length - b.length)[0] || "";
  set("pv", byName(/(^sensor\.(pv|solar)|photovoltaik|pv[_ ]?(power|leistung)|solar[_ ]?(power|leistung))/i, /(forecast|prognose|l[123]\b|string|mppt|_pv[1-9]\b|max|peak)/i), "Name");
  set("grid", byName(/(netz|grid)/i, /(l[123]\b|phase|frequen|spannung|voltage|strom\b|current|forecast)/i), "Name");
  set("power", byName(/(hausverbrauch|house[_ ]?(power|consumption|load)|home[_ ]?(power|consumption)|verbrauch[_ ]?haus)/i, /(l[123]\b|phase)/i), "Name");
  set("battery", byName(/(soc|state_of_charge|ladezustand|hausakku|hausspeicher|stromspeicher)/i, /(phone|handy|ipad|tablet|watch|auto|car|fahrzeug|evcc|wallbox|min|max|limit|ziel|target|reserve)/i, (st) => !!st && unit(st) === "%"), "Name");
  set("price", ids.find((e) => isPrice(S(e))) || "", "Einheit");
  _memo = { n, ents: h.entities, prefs: _prefs, v };
  return v;
}

/* ---------- Standard-Links: nur zeigen, wenn das Panel installiert ist ---------- */
/** Ist der Pfad ein Panel bzw. Dashboard dieser Installation? Unbekannt (keine Panel-Liste) zählt als ja. */
function linkInstalled(h, path) {
  if (!path || !path.startsWith("/") || !h || !h.panels || !Object.keys(h.panels).length) return true;
  const seg = path.split(/[/?#]/)[1] || "";
  return !seg || !!h.panels[seg];
}

/** Verknüpfungen, deren Ziel es in dieser Installation gibt (Standard-Links auf Solar/Protect nur mit dem Panel). */
const activeLinks = (h, L) => ((L && L.links) || []).filter((l) => l.path && linkInstalled(h, l.path));

export {
  activeLinks, energieAuto, energyPrefs, energyPrefsReset, isEnergyUnit, isPercentBattery, isPower, isPrice, isTemp, isWallboxPlatform, isWastePlatform,
  labelled, labelledAreas, linkInstalled, platformOf, prefsSources, ROLLEN, sameDevice,
};
