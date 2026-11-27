/* Haus Visualisierung – Anbindung an die Integration „Solar Visualisierung“ (eigenes Repository, falls installiert).
 * Leere Energie-Felder der Einstellungen (PV-Leistung, Akku-Ladestand, Hausverbrauch) füllt sie automatisch (nach Labels, vor Energie-Dashboard und Namen):
 * Hausverbrauch = AC-seitig berechneter Sensor der Solar-Integration, PV und Akku = Growatt-Sensoren mit ihrem Präfix.
 * Netz kommt aus Label oder Energie-Dashboard (Growatt meldet Bezug und Einspeisung getrennt, die Seite braucht einen Sensor mit Vorzeichen).
 * Dazu Sprünge von der Energie-Seite direkt auf die Ansichten der Solar-Visualisierung. */

import { esc, icon } from "./grundlagen.js";
import { energieAuto } from "./erkennung.js";

const SV_PANEL = "solar-visualisierung";
const SV_PLATFORM = "solar_visualisierung";
/* Ansichten, die es in der Solar-Visualisierung immer gibt (Laden und Strompreis nur mit EVCC bzw. Tibber) */
const SV_VIEWS = [["uebersicht", "Übersicht", "mdi:view-dashboard-outline"], ["technik", "Technik", "mdi:chart-areaspline"],
  ["auswertung", "Auswertung", "mdi:chart-timeline-variant-shimmer"], ["steuerung", "Steuerung", "mdi:tune-variant"]];

const svPanel = (h) => (h && h.panels && h.panels[SV_PANEL]) || null;

/* Hausverbrauch-Sensor über die Entitäts-Registry (bleibt gültig, wenn die Entitäts-ID umbenannt wurde) */
let _ents = null, _house = "";
function svHouse(h) {
  if (!h.entities) return "";
  if (h.entities !== _ents) {
    _ents = h.entities;
    const e = Object.values(h.entities).find((x) => x.platform === SV_PLATFORM && x.translation_key === "house_ac_power");
    _house = e ? e.entity_id : "";
  }
  return _house;
}

/** Energie-Sensoren der Kopfzeile: eingestellte Werte, leere Felder automatisch – Label, Solar-Integration,
 *  Energie-Dashboard von Home Assistant, zuletzt Namen (nur ohne Solar-Integration, siehe erkennung.js).
 *  `auto: false` im Kopf schaltet das ab (Karte Hausschnitt mit show_energy: false). */
function headerOf(h, L) {
  return headerAuto(h, L).v;
}
/** Wie headerOf, dazu die Herkunft je Feld (für Assistent und Einstellungen). */
function headerAuto(h, L) {
  const H = (L && L.header) || {};
  if (H.auto === false || !h || !h.states) return { v: H, src: {} };
  const src = {};
  const own = (k) => (H[k] ? ((src[k] = "eingestellt"), H[k]) : "");
  if (H.pv && H.battery && H.power && H.grid) return { v: H, src: { pv: "eingestellt", battery: "eingestellt", power: "eingestellt", grid: "eingestellt" } };
  const S = (e) => (e && h.states[e] ? e : "");
  const A = energieAuto(h), p = svPanel(h);
  const pre = (p && p.config && p.config.prefix) || "growatt_modbus";
  const sv = p ? { pv: S(`sensor.${pre}_solar_solar_total_power`), battery: S(`sensor.${pre}_battery_battery_soc`), power: S(svHouse(h)) } : {};
  const pick = (k) => {
    if (H[k]) return own(k);
    const cand = [[A.src[k] === "Label" && A[k], "Label"], [sv[k], "Solar-Visualisierung"], [A.src[k] === "Energie-Dashboard" && A[k], "Energie-Dashboard"], [(!p || k !== "grid") && A.src[k] === "Name" && A[k], "Name"]];
    const hit = cand.find(([e]) => e);
    if (hit) src[k] = hit[1];
    return hit ? hit[0] : "";
  };
  return { v: { ...H, pv: pick("pv"), battery: pick("battery"), power: pick("power"), grid: pick("grid") }, src };
}

/** Sprungknöpfe auf die Ansichten der Solar-Visualisierung (leer, wenn sie nicht installiert ist). */
function svJumpsHTML(h) {
  if (!svPanel(h)) return "";
  return `<span class="svjump" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">${SV_VIEWS.map(([id, t, ic]) => `<button class="pbtn" data-act="link" data-path="/${SV_PANEL}/${id}" title="Solar Visualisierung: ${esc(t)}">${icon(ic)}${esc(t)}</button>`).join("")}</span>`;
}

export { headerAuto, headerOf, svJumpsHTML, svPanel, SV_PANEL };
