/* Haus Visualisierung – Strategy-Logik: aus den Registern von Home Assistant ein Hausmodell bauen. */

import { areaIcon, dc, dom, entName, num, OUTDOOR_RE, TECH_RE } from "./grundlagen.js";
import { techCfg } from "./technik.js";
import { outdoorHumId, outdoorTempId, weatherId } from "./klima.js";
import { energyCfg } from "./energie.js";
import { priceCfg } from "./strompreis.js";

/* ------------------------------------------------------------------------ */
/*  Strategy-Logik: aus Registern ein Hausmodell bauen                       */
/* ------------------------------------------------------------------------ */
const GROUPS = [
  ["light", "Licht", "mdi:lightbulb-group"],
  ["cover", "Beschattung", "mdi:window-shutter"],
  ["climate", "Klima", "mdi:thermostat"],
  ["media", "Medien", "mdi:speaker"],
  ["switch", "Schalter & Steckdosen", "mdi:power-socket-de"],
  ["lock", "Schlösser", "mdi:lock"],
  ["camera", "Kameras", "mdi:cctv"],
  ["contact", "Fenster & Türen", "mdi:window-closed-variant"],
  ["presence", "Präsenz", "mdi:motion-sensor"],
  ["safety", "Sicherheit", "mdi:shield-check"],
  ["sensor", "Sensoren", "mdi:thermometer"],
  ["energy", "Energie", "mdi:flash"],
  ["device", "Geräte", "mdi:robot-vacuum"],
  ["scene", "Szenen & Skripte", "mdi:palette"],
  ["other", "Weitere", "mdi:dots-horizontal"],
];
const GROUP_META = Object.fromEntries(GROUPS.map(([k, t, i]) => [k, { t, i }]));

const CONTACT_DC = new Set(["door", "window", "garage_door", "opening"]);
const PRESENCE_DC = new Set(["motion", "occupancy", "presence"]);
const SAFETY_DC = new Set(["smoke", "gas", "moisture", "carbon_monoxide", "safety", "tamper", "problem", "heat"]);
const ROOM_SENSOR_DC = new Set(["temperature", "humidity", "illuminance", "carbon_dioxide", "pm25", "pm10",
  "volatile_organic_compounds", "volatile_organic_compounds_parts", "pressure", "atmospheric_pressure", "moisture"]);
const ENERGY_DC = new Set(["power", "energy", "current", "voltage", "power_factor", "apparent_power", "reactive_power"]);

function classify(eid, st, L, pinned) {
  const d = dom(eid), c = dc(st);
  switch (d) {
    case "light": return "light";
    case "cover": return "cover";
    case "climate": case "water_heater": case "humidifier": return "climate";
    case "fan": case "switch": case "input_boolean": return "switch";
    case "media_player": return "media";
    case "lock": return "lock";
    case "camera": return "camera";
    case "scene": case "script": return "scene";
    case "alarm_control_panel": case "siren": return "safety";
    case "vacuum": case "lawn_mower": return "device";
    case "binary_sensor":
      if (c === "battery") return "battery";
      if (CONTACT_DC.has(c)) return "contact";
      if (PRESENCE_DC.has(c)) return "presence";
      if (SAFETY_DC.has(c)) return "safety";
      return pinned ? "sensor" : null;
    case "sensor":
      if (c === "battery") return "battery";
      if (ROOM_SENSOR_DC.has(c)) return "sensor";
      if (ENERGY_DC.has(c)) return L.show_energy_sensors ? "energy" : (pinned ? "sensor" : null);
      return pinned ? "sensor" : null;
    case "select": case "input_select": case "number": case "input_number":
    case "button": case "input_button": case "valve":
      return L.show_other ? "other" : (pinned ? "other" : null);
    default:
      return pinned ? "other" : null;
  }
}
function buildModel(h, L) {
  const ents = h.entities || {}, devs = h.devices || {}, areaReg = h.areas || {}, floorReg = h.floors || {};
  const hideLabels = new Set(L.hide_labels || []);
  const hiddenEnts = new Set(L.hidden_entities || []);
  const hiddenAreas = new Set(L.hidden_areas || []);
  const pinnedAll = new Set(Object.values(L.pins || {}).flat());
  const favSet = new Set(L.favorites || []);
  const orderIdx = new Map((L.area_order || []).map((id, i) => [id, i]));

  const areas = new Map();
  for (const a of Object.values(areaReg)) {
    areas.set(a.area_id, {
      id: a.area_id, name: a.name, icon: null, picture: a.picture || null,
      floorId: a.floor_id || null, tempId: a.temperature_entity_id || null, humId: a.humidity_entity_id || null,
      hidden: hiddenAreas.has(a.area_id), groups: {}, pins: [], batteries: [], watch: [],
    });
    areas.get(a.area_id).icon = areaIcon({ name: a.name, icon: a.icon });
  }

  const batteries = [];
  for (const eid in h.states) {
    const st = h.states[eid];
    const reg = ents[eid];
    const pinned = pinnedAll.has(eid) || favSet.has(eid);
    if (!reg) continue;
    const isBattery = dc(st) === "battery" && (eid.startsWith("sensor.") || eid.startsWith("binary_sensor."));
    if (!pinned) {
      if (reg.hidden || (reg.entity_category && !isBattery) || hiddenEnts.has(eid)) continue;
      if (reg.labels && reg.labels.some((l) => hideLabels.has(l))) continue;
    }
    const areaId = reg.area_id || (reg.device_id && devs[reg.device_id] && devs[reg.device_id].area_id) || null;
    const cat = classify(eid, st, L, pinned);
    if (!cat) continue;
    if (cat === "battery") { batteries.push({ eid, areaId }); continue; }
    const area = areaId && areas.get(areaId);
    if (!area) continue;
    (area.groups[cat] = area.groups[cat] || []).push(eid);
  }

  // Heizung und Wallbox: ihre Entitäten zeigt die eigene Karte, nicht noch einmal die Blöcke des Raums
  const tech = techCfg(h, L, areas);
  for (const c of [tech.heat, tech.wb]) {
    const ar = c && c.area && areas.get(c.area);
    if (ar) for (const k of Object.keys(ar.groups)) ar.groups[k] = ar.groups[k].filter((e) => !tech.used.has(e));
  }
  const byName = (a) => (x, y) => entName(h, x, a).localeCompare(entName(h, y, a), "de");
  for (const a of areas.values()) {
    // was die Heizungs- oder Wallbox-Karte dieses Raums zeigt, nicht zusätzlich als Pin
    const techHere = [tech.heat, tech.wb].some((c) => c && c.area === a.id);
    a.pins = (L.pins[a.id] || []).filter((e) => h.states[e] && !(techHere && tech.used.has(e)));
    const pinSet = new Set(a.pins);
    for (const k of Object.keys(a.groups)) {
      a.groups[k] = a.groups[k].filter((e) => !pinSet.has(e)).sort(byName(a));
      if (!a.groups[k].length) delete a.groups[k];
    }
    const sensors = a.groups.sensor || [];
    if (!a.tempId || !h.states[a.tempId]) {
      a.tempId = sensors.find((e) => {
        const st = h.states[e], v = num(st);
        return dc(st) === "temperature" && !TECH_RE.test(entName(h, e)) && (v === null || v <= 35);
      }) || null;
    }
    if (!a.humId || !h.states[a.humId]) a.humId = sensors.find((e) => dc(h.states[e]) === "humidity") || null;
    a.lights = a.groups.light || [];
    a.covers = a.groups.cover || [];
    a.contacts = a.groups.contact || [];
    a.presence = a.groups.presence || [];
    a.climates = a.groups.climate || [];
    a.media = a.groups.media || [];
    a.watch = [...a.lights, ...a.covers, ...a.contacts, ...a.presence, ...a.climates, ...a.media, ...(a.groups.lock || []), ...(a.groups.safety || []), a.tempId, a.humId].filter(Boolean);
  }
  for (const b of batteries) if (b.areaId && areas.has(b.areaId)) areas.get(b.areaId).batteries.push(b.eid);

  const sortAreas = (list) => list.sort((x, y) => {
    const ix = orderIdx.has(x.id) ? orderIdx.get(x.id) : 1e6, iy = orderIdx.has(y.id) ? orderIdx.get(y.id) : 1e6;
    return ix - iy || x.name.localeCompare(y.name, "de");
  });

  // Etagen: oben → unten, Außen und Keller getrennt
  const floorOrder = new Map((L.floor_order || []).map((id, i) => [id, i]));
  let floors = Object.values(floorReg).map((f) => ({
    id: f.floor_id, name: f.name, icon: f.icon, level: f.level ?? null,
    outdoor: (L.outdoor_floors || []).includes(f.floor_id) || OUTDOOR_RE.test(f.name), areas: [],
  }));
  floors.sort((x, y) => {
    if (floorOrder.size) {
      const ix = floorOrder.has(x.id) ? floorOrder.get(x.id) : 1e6, iy = floorOrder.has(y.id) ? floorOrder.get(y.id) : 1e6;
      if (ix !== iy) return ix - iy;
    }
    return (y.level ?? 0) - (x.level ?? 0) || x.name.localeCompare(y.name, "de");
  });
  const floorMap = new Map(floors.map((f) => [f.id, f]));
  const loose = [];
  for (const a of areas.values()) {
    if (a.hidden) continue;
    const f = a.floorId && floorMap.get(a.floorId);
    if (f) f.areas.push(a); else loose.push(a);
  }
  floors.forEach((f) => sortAreas(f.areas));
  sortAreas(loose);
  floors = floors.filter((f) => f.areas.length);
  if (loose.length) {
    if (!floors.length) floors.push({ id: "_all", name: "Räume", level: 0, outdoor: false, areas: loose, virtual: true });
    else {
      const outdoorLoose = loose.filter((a) => OUTDOOR_RE.test(a.name));
      const indoorLoose = loose.filter((a) => !OUTDOOR_RE.test(a.name));
      if (indoorLoose.length) floors.push({ id: "_loose", name: "Weitere Bereiche", level: 0, outdoor: false, areas: indoorLoose, virtual: true });
      if (outdoorLoose.length) floors.push({ id: "_out", name: "Außen", level: 0, outdoor: true, areas: outdoorLoose, virtual: true });
    }
  }
  const upper = floors.filter((f) => !f.outdoor && (f.level === null || f.level >= 0));
  const lower = floors.filter((f) => !f.outdoor && f.level !== null && f.level < 0);
  const outdoor = floors.filter((f) => f.outdoor);
  const ordered = [...upper, ...lower, ...outdoor];
  for (const f of ordered) {
    f.watch = f.areas.flatMap((a) => [...a.lights, a.tempId].filter(Boolean));
    f.short = shortFloor(f.name);
  }
  const visibleAreas = ordered.flatMap((f) => f.areas);
  const all = (k) => visibleAreas.flatMap((a) => a.groups[k] || []);

  const agg = {
    lights: all("light"), covers: all("cover").filter((e) => !["garage", "gate", "door"].includes(dc(h.states[e]))),
    contacts: all("contact"), safety: all("safety"), climates: all("climate"),
    temps: visibleAreas.filter((a) => !OUTDOOR_RE.test(a.name) && !outdoor.some((f) => f.areas.includes(a))).map((a) => a.tempId).filter(Boolean),
    batteries: batteries.filter((b) => !b.areaId || !hiddenAreas.has(b.areaId)).map((b) => b.eid),
  };
  agg.unavailable = [...new Set(visibleAreas.flatMap((a) => Object.values(a.groups).flat()))];
  agg.batt = agg.batteries;

  const eidArea = new Map();
  for (const a of visibleAreas) for (const l of Object.values(a.groups)) for (const e of l) eidArea.set(e, a);
  for (const b of batteries) if (b.areaId && areas.has(b.areaId)) eidArea.set(b.eid, areas.get(b.areaId));
  const _panelIds = Object.keys(h.entities || {}).filter((e) => e.startsWith("alarm_control_panel.") && h.states[e]);
  if (!_panelIds.length) for (const e in h.states) if (e.startsWith("alarm_control_panel.")) _panelIds.push(e);
  // Außenfühler für Feuchte und Lüftungshinweis (nur bei Änderungen an Bereichen, Geräten, Entitäten neu gesucht)
  const price = priceCfg(h, L);
  const _oc = { tId: outdoorTempId(h, { tech }, L), hId: outdoorHumId(h), wId: weatherId(h, L) };
  return { areas, floors: ordered, upper, lower, outdoor, visibleAreas, agg, batteries, eidArea, _panelIds, _panels: _panelIds, tech, _oc, _outClim: Object.values(_oc).filter(Boolean), energy: energyCfg(h, L, tech, price), price };
}

function shortFloor(name) {
  const n = name.toLowerCase();
  if (/^(eg|erdgeschoss)/.test(n)) return "EG";
  if (/^(og|obergeschoss|1\. ?og)/.test(n)) return "OG";
  if (/^(dg|dachgeschoss)/.test(n)) return "DG";
  if (/^(kg|keller|untergeschoss|ug)/.test(n)) return "KG";
  return name;
}

/* Darstellung einer Verknüpfung: theme = Original mit Farben der Haus Visualisierung, embed = Original, open = eigene Seite */
const linkMode = (l) => (l && l.mode === "haus" ? "theme" : l && ["theme", "embed", "open"].includes(l.mode) ? l.mode : l && l.embed === false ? "open" : "theme");

export { buildModel, classify, CONTACT_DC, GROUP_META, GROUPS, linkMode, PRESENCE_DC, SAFETY_DC };
