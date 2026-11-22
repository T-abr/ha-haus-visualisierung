/*
 * Haus Visualisierung – Panel und Karten für Home Assistant
 * Baut sich wie eine Dashboard-Strategy aus Etagen → Bereichen → Geräten auf,
 * hat aber ein eigenes Layout („Hausschnitt“).
 */
const VERSION = "1.5.0";
const DOMAIN = "haus_visualisierung";

if (!window.__HAUS_VIS_LOADED__) {
  window.__HAUS_VIS_LOADED__ = VERSION;
  console.info(
    `%c HAUS VISUALISIERUNG v${VERSION} `,
    "background:#1c2740;color:#ffc457;font-weight:700;border-radius:4px;padding:2px 4px"
  );
}

/* ------------------------------------------------------------------------ */
/*  Standardwerte (Spiegel von const.py DEFAULT_LAYOUT)                      */
/* ------------------------------------------------------------------------ */
const DEFAULT_LAYOUT = {
  area_order: [], hidden_areas: [], floor_order: [], outdoor_floors: [],
  pins: {}, favorites: [], hidden_entities: [], hide_labels: ["no_dboard", "no-dboard"],
  header: { power: "", pv: "", battery: "", grid: "" },
  energy: { enabled: true, battery_power: "", grid_invert: false, battery_invert: false },
  links: [
    { title: "Solar", icon: "mdi:solar-power-variant", path: "/solar-visualisierung", embed: true, mode: "theme" },
    { title: "Kameras", icon: "mdi:cctv", path: "/protect-visualisierung", embed: true, mode: "theme" },
  ],
  show_energy_sensors: false, show_other: true, camera_interval: 10, glass: true,
  start_view: "overview", battery_critical: 15, battery_low: 35, density: "kompakt", header_style: "kompakt", overview_style: "auto",
  confirm_quick: true, show_trends: true,
  heating: { enabled: true, area: "", tank: [], tank_min: 30, tank_max: 65, stove: "", stove_pump: "", stove_hot: 50, curve: "", mixer: "", flow: "", outdoor: "",
    manual_curve: false, manual: { slope: 0.3, level: 0, room: 20, min: 22, max: 40, limit: 16 } },
  wallpanel: { saver_min: 5, black_min: 0, return_min: 2, fullscreen: true, hide_sidebar: true, wake_alarm: true, night_dim: true, weather: "", wake_entity: "" },
  wallbox: { enabled: true, area: "", power: "", mode: "", soc: "", limit: "", energy: "", connected: "", charging: "", range: "" },
  doorbell: { enabled: true, entity: "", camera: "", lock: "", timeout: 60, pulse: 2 },
  push: { enabled: true, targets: [], levels: { alarm: true, warn: true, info: true }, resolved: "clear", cooldown: 10, critical: true, persistent: false },
  alerts: {
    builtin: { contacts: true, window_heating: true, safety: true, locks: true, garage: true, battery: false, offline: false, presence_away: true, alarm_panel: true },
    modes: {}, contacts_min: 0, rules: [],
  },
  escalation: { enabled: true, minutes: 5, levels: ["alarm"], push_critical: true },
  alarm_actions: [],
  house_mode: { enabled: true, auto_away: true, away_delay: 10, auto_night: false, night_start: "23:00", night_end: "06:30", alarmo: "", alarmo_sync: false,
    arm: { zuhause: "disarm", nacht: "arm_night", abwesend: "arm_away", urlaub: "arm_vacation" } },
};
/* Hausmodus */
const HOUSE_MODES = [["zuhause", "Zuhause", "mdi:home-account"], ["nacht", "Nacht", "mdi:weather-night"], ["abwesend", "Abwesend", "mdi:home-export-outline"], ["urlaub", "Urlaub", "mdi:airplane"]];
const MODE_NAME = Object.fromEntries(HOUSE_MODES.map(([k, t]) => [k, t]));
const MODE_ICON = Object.fromEntries(HOUSE_MODES.map(([k, , i]) => [k, i]));
const BUILTIN_MODES = { presence_away: ["abwesend", "urlaub"] };
const withDefaults = (l) => {
  const a = (l && l.alerts) || {};
  return {
    ...structuredClone(DEFAULT_LAYOUT), ...(l || {}),
    header: { ...DEFAULT_LAYOUT.header, ...((l && l.header) || {}) },
    alerts: { ...structuredClone(DEFAULT_LAYOUT.alerts), ...a, builtin: { ...DEFAULT_LAYOUT.alerts.builtin, ...(a.builtin || {}) }, modes: { ...(a.modes || {}) }, rules: Array.isArray(a.rules) ? a.rules : [] },
    escalation: { ...structuredClone(DEFAULT_LAYOUT.escalation), ...((l && l.escalation) || {}) },
    alarm_actions: Array.isArray(l && l.alarm_actions) ? l.alarm_actions : [],
    house_mode: { ...structuredClone(DEFAULT_LAYOUT.house_mode), ...((l && l.house_mode) || {}), arm: { ...DEFAULT_LAYOUT.house_mode.arm, ...((l && l.house_mode && l.house_mode.arm) || {}) } },
    doorbell: { ...DEFAULT_LAYOUT.doorbell, ...((l && l.doorbell) || {}) },
    heating: { ...structuredClone(DEFAULT_LAYOUT.heating), ...((l && l.heating) || {}), manual: { ...DEFAULT_LAYOUT.heating.manual, ...((l && l.heating && l.heating.manual) || {}) } },
    wallbox: { ...DEFAULT_LAYOUT.wallbox, ...((l && l.wallbox) || {}) },
    energy: { ...DEFAULT_LAYOUT.energy, ...((l && l.energy) || {}) },
    wallpanel: { ...DEFAULT_LAYOUT.wallpanel, ...((l && l.wallpanel) || {}) },
    push: { ...structuredClone(DEFAULT_LAYOUT.push), ...((l && l.push) || {}), levels: { ...DEFAULT_LAYOUT.push.levels, ...((l && l.push && l.push.levels) || {}) } },
  };
};

/* ------------------------------------------------------------------------ */
/*  Hilfsfunktionen                                                          */
/* ------------------------------------------------------------------------ */
/* Farben der Haus Visualisierung als Home-Assistant-Designvariablen.
   Verknüpfte Seiten behalten Layout und Inhalt, übernehmen aber Hintergrund, Karten, Text- und Akzentfarben. */
const HV_BG = "radial-gradient(1100px 650px at 12% -8%,#2a3e66 0%,transparent 62%),radial-gradient(900px 600px at 108% 6%,#3a2a58 0%,transparent 55%),radial-gradient(800px 500px at 60% 120%,#123a3a 0%,transparent 60%),linear-gradient(160deg,#0c111d,#111a2c 50%,#0a0e17)";
const HV_BLUR = "blur(18px) saturate(140%)";
const HV_HA_VARS = {
  "primary-background-color": "transparent", "lovelace-background": "transparent", "view-background": "transparent",
  "secondary-background-color": "rgba(22,30,46,.92)", "clear-background-color": "rgba(16,22,34,.9)",
  "card-background-color": "rgba(16,22,34,.58)", "ha-card-background": "rgba(16,22,34,.58)",
  "ha-card-border-radius": "20px", "ha-card-border-width": "1px", "ha-card-border-color": "rgba(255,255,255,.09)", "ha-card-box-shadow": "none",
  "primary-text-color": "#eef2f8", "secondary-text-color": "rgba(238,242,248,.64)", "disabled-text-color": "rgba(238,242,248,.38)", "text-primary-color": "#fff",
  "divider-color": "rgba(255,255,255,.09)", "outline-color": "rgba(255,255,255,.12)",
  "app-header-background-color": "transparent", "app-header-text-color": "#eef2f8", "app-header-border-bottom": "1px solid rgba(255,255,255,.09)",
  "sidebar-background-color": "rgba(8,12,20,.55)", "sidebar-text-color": "rgba(238,242,248,.64)",
  "state-icon-color": "rgba(238,242,248,.72)", "paper-item-icon-color": "rgba(238,242,248,.72)",
  "mdc-theme-surface": "#172033", "mdc-theme-on-surface": "#eef2f8", "mdc-theme-text-primary-on-background": "#eef2f8",
  "input-fill-color": "rgba(255,255,255,.055)", "input-ink-color": "#eef2f8", "input-label-ink-color": "rgba(238,242,248,.64)",
  "input-idle-line-color": "rgba(255,255,255,.18)", "input-hover-line-color": "rgba(255,255,255,.3)",
  "table-row-background-color": "transparent", "table-row-alternative-background-color": "rgba(255,255,255,.03)",
  "data-table-background-color": "transparent", "markdown-code-background-color": "rgba(255,255,255,.06)",
  "success-color": "#4fd18b", "warning-color": "#ff8a3d", "error-color": "#ff6b5b", "info-color": "#63c7ff",
  "state-light-on-color": "#ffc457", "energy-solar-color": "#ffc457", "energy-battery-in-color": "#4fd18b", "energy-battery-out-color": "#4fd18b",
  "energy-grid-consumption-color": "#63c7ff", "energy-grid-return-color": "#9a86ff",
};
/** CSS-Deklarationen (optional mit !important) für die Designvariablen; glass = Weichzeichner hinter Karten */
function hvThemeCss(glass, imp = false) {
  const i = imp ? "!important" : "";
  const vars = { ...HV_HA_VARS, "ha-card-backdrop-filter": glass ? HV_BLUR : "none" };
  return Object.entries(vars).map(([k, v]) => `--${k}:${v}${i}`).join(";") + `;color-scheme:dark${i}`;
}

/* Im Rahmen geladenes Home Assistant: Farben der Haus Visualisierung erzwingen.
   !important schlägt die Inline-Variablen, die Home Assistant für sein Design am <html> setzt. */
function themeFrame(fr, glass) {
  try {
    const doc = fr.contentDocument;
    if (!doc || !doc.documentElement) return false;
    let st = doc.getElementById("hv-theme");
    if (!st) { st = doc.createElement("style"); st.id = "hv-theme"; (doc.head || doc.documentElement).appendChild(st); }
    st.textContent = `html{${hvThemeCss(glass, true)};background:${HV_BG}!important;background-attachment:fixed!important}body{background:transparent!important}`;
    return true;
  } catch (e) { return false; } // fremder Ursprung: unverändert lassen
}

/* Im Rahmen (iframe) geladenes Home Assistant: Seitenleiste ausblenden, damit nur die Seite bleibt */
function hideHaChrome(fr) {
  let tries = 0;
  const tick = () => {
    let done = false;
    try {
      const doc = fr.contentDocument;
      const ha = doc && doc.querySelector("home-assistant");
      const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
      const root = main && main.shadowRoot;
      if (root) {
        if (!root.getElementById("hv-hide")) {
          const st = doc.createElement("style");
          st.id = "hv-hide";
          st.textContent = "ha-sidebar{display:none!important} ha-drawer{--mdc-drawer-width:0px!important}";
          root.appendChild(st);
        }
        const drawer = root.querySelector("ha-drawer");
        const dr = drawer && drawer.shadowRoot;
        if (dr) {
          if (!dr.getElementById("hv-hide")) {
            const st = doc.createElement("style");
            st.id = "hv-hide";
            st.textContent = ".mdc-drawer{display:none!important} .mdc-drawer-app-content{margin-left:0!important;margin-right:0!important;padding-left:0!important}";
            dr.appendChild(st);
          }
          done = true;
        }
      }
    } catch (e) { return; } // fremder Ursprung: unverändert lassen
    if (!done && ++tries < 60) setTimeout(tick, 250);
  };
  tick();
}

/* Springt ein eingebettetes Panel auf seine eigene Adresse (z. B. /protect-visualisierung/live),
   wird die Adresse auf die eingebettete umgeschrieben – die Haus-Navigation bleibt. */
function installNavGuard() {
  if (window.__hvNavGuard) return;
  window.__hvNavGuard = true;
  for (const fn of ["pushState", "replaceState"]) {
    const orig = history[fn].bind(history);
    history[fn] = function (state, title, url) {
      const g = window.__hvEmbed;
      if (g && url != null && g.active()) {
        try {
          const u = new URL(String(url), location.href);
          const own = `/${g.up}`;
          if (u.origin === location.origin && (u.pathname === own || u.pathname.startsWith(`${own}/`))) {
            url = `${g.base}/extern/${g.up}${u.pathname.slice(own.length)}${u.search}${u.hash}`;
          }
        } catch (e) { /* Adresse unverändert lassen */ }
      }
      return orig(state, title, url);
    };
  }
}
const panelPathOf = (path) => String(path || "").replace(/^\/+/, "").split(/[/?#]/)[0];
const isDense = (L) => !L || L.density !== "komfort";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dom = (eid) => eid.slice(0, eid.indexOf("."));
const NF1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const num = (st) => {
  if (!st) return null;
  const v = parseFloat(st.state);
  return Number.isFinite(v) ? v : null;
};
const UNAV = new Set(["unavailable", "unknown"]);
const STATELESS = new Set(["scene", "button", "input_button", "event"]);
const isUnav = (st) => !st || st.state === "unavailable" || (st.state === "unknown" && !STATELESS.has(dom(st.entity_id)));
const dc = (st) => (st && st.attributes.device_class) || "";

function isOn(st) {
  if (!st) return false;
  const d = dom(st.entity_id);
  switch (d) {
    case "cover": return st.state !== "closed" && !UNAV.has(st.state);
    case "media_player": return st.state === "playing";
    case "lock": return st.state === "unlocked" || st.state === "open";
    case "climate": return st.state !== "off" && !UNAV.has(st.state);
    case "water_heater": return st.state !== "off" && !UNAV.has(st.state);
    case "alarm_control_panel": return st.state === "triggered";
    case "vacuum": case "lawn_mower": return ["cleaning", "mowing", "returning"].includes(st.state);
    case "valve": return st.state === "open";
    default: return st.state === "on";
  }
}

function relTime(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return "";
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  return `vor ${Math.round(s / 86400)} Tg.`;
}

function fmtState(h, st) {
  if (!st) return "Nicht vorhanden";
  try { if (h.formatEntityState) return h.formatEntityState(st); } catch (e) { /* älteres HA */ }
  const u = st.attributes.unit_of_measurement;
  const v = num(st);
  if (v !== null && u) return `${NF1.format(v)} ${u}`;
  return st.state;
}

function fmtPower(st) {
  const v = num(st);
  if (v === null) return "–";
  const u = st.attributes.unit_of_measurement || "W";
  if (u === "W" && Math.abs(v) >= 1000) return `${NF1.format(v / 1000)} kW`;
  if (u === "W") return `${NF0.format(v)} W`;
  return `${NF1.format(v)} ${u}`;
}
const powerW = (st) => {
  const v = num(st);
  if (v === null) return null;
  return (st.attributes.unit_of_measurement || "W") === "kW" ? v * 1000 : v;
};

function entName(h, eid, area) {
  const st = h.states[eid];
  const reg = h.entities && h.entities[eid];
  let n = (st && st.attributes.friendly_name) || (reg && reg.name) || eid;
  if (area && area.name) {
    const an = area.name.toLowerCase();
    if (n.toLowerCase().startsWith(an + " ") && n.length > an.length + 1) n = n.slice(an.length + 1);
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/* ---------- Symbole ---------- */
const BIN_ICONS = {
  door: ["mdi:door-open", "mdi:door-closed"], window: ["mdi:window-open-variant", "mdi:window-closed-variant"],
  garage_door: ["mdi:garage-open", "mdi:garage"], opening: ["mdi:square-outline", "mdi:square"],
  motion: ["mdi:motion-sensor", "mdi:motion-sensor-off"], occupancy: ["mdi:home-account", "mdi:home-outline"],
  presence: ["mdi:home-account", "mdi:home-outline"], smoke: ["mdi:smoke-detector-variant-alert", "mdi:smoke-detector-variant"],
  moisture: ["mdi:water-alert", "mdi:water-off"], gas: ["mdi:gas-cylinder", "mdi:gas-cylinder"],
  carbon_monoxide: ["mdi:molecule-co", "mdi:molecule-co"], safety: ["mdi:alert-circle", "mdi:check-circle"],
  problem: ["mdi:alert-circle", "mdi:check-circle"], tamper: ["mdi:shield-alert", "mdi:shield-check"],
  heat: ["mdi:thermometer-alert", "mdi:thermometer"], battery: ["mdi:battery-alert", "mdi:battery"],
};
const SENSOR_ICONS = {
  temperature: "mdi:thermometer", humidity: "mdi:water-percent", illuminance: "mdi:brightness-5",
  carbon_dioxide: "mdi:molecule-co2", pm25: "mdi:blur", pm10: "mdi:blur", pressure: "mdi:gauge",
  atmospheric_pressure: "mdi:gauge", power: "mdi:flash", energy: "mdi:lightning-bolt", current: "mdi:current-ac",
  voltage: "mdi:sine-wave", volatile_organic_compounds: "mdi:air-filter",
  volatile_organic_compounds_parts: "mdi:air-filter", moisture: "mdi:water-percent", gas: "mdi:meter-gas",
  water: "mdi:water",
};
function batteryIcon(v) {
  if (v === null) return "mdi:battery-unknown";
  const r = Math.max(0, Math.min(100, Math.round(v / 10) * 10));
  if (r >= 100) return "mdi:battery";
  if (r <= 0) return "mdi:battery-outline";
  return `mdi:battery-${r}`;
}

function entIcon(h, st) {
  if (!st) return "mdi:help-circle-outline";
  const reg = h.entities && h.entities[st.entity_id];
  if (reg && reg.icon) return reg.icon;
  if (st.attributes.icon) return st.attributes.icon;
  const d = dom(st.entity_id), c = dc(st), on = isOn(st);
  switch (d) {
    case "light": return on ? "mdi:lightbulb" : "mdi:lightbulb-outline";
    case "switch": return c === "outlet" ? (on ? "mdi:power-socket-de" : "mdi:power-socket-de") : (on ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off");
    case "input_boolean": return on ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
    case "fan": return on ? "mdi:fan" : "mdi:fan-off";
    case "cover":
      if (c === "garage" || c === "gate") return on ? "mdi:garage-open" : "mdi:garage";
      if (c === "curtain") return on ? "mdi:curtains" : "mdi:curtains-closed";
      if (c === "awning") return "mdi:awning-outline";
      if (c === "window") return on ? "mdi:window-open" : "mdi:window-closed";
      if (c === "door") return on ? "mdi:door-open" : "mdi:door-closed";
      return on ? "mdi:window-shutter-open" : "mdi:window-shutter";
    case "climate": return st.attributes.hvac_action === "heating" ? "mdi:fire" : "mdi:thermostat";
    case "water_heater": return "mdi:water-boiler";
    case "humidifier": return "mdi:air-humidifier";
    case "media_player": return c === "tv" ? "mdi:television" : c === "receiver" ? "mdi:audio-video" : "mdi:speaker";
    case "lock": return on ? "mdi:lock-open-variant" : "mdi:lock";
    case "camera": return "mdi:cctv";
    case "scene": return "mdi:palette";
    case "script": return "mdi:script-text-play";
    case "button": case "input_button": return "mdi:gesture-tap-button";
    case "select": case "input_select": return "mdi:format-list-bulleted";
    case "number": case "input_number": return "mdi:ray-vertex";
    case "vacuum": return "mdi:robot-vacuum";
    case "lawn_mower": return "mdi:robot-mower";
    case "valve": return "mdi:valve";
    case "alarm_control_panel": return "mdi:shield-home";
    case "siren": return "mdi:bullhorn";
    case "binary_sensor": { const p = BIN_ICONS[c]; return p ? p[on ? 0 : 1] : on ? "mdi:checkbox-marked-circle" : "mdi:radiobox-blank"; }
    case "sensor": if (c === "battery") return batteryIcon(num(st)); return SENSOR_ICONS[c] || "mdi:eye";
    default: return "mdi:circle-medium";
  }
}

const AREA_ICON_RULES = [
  [/wohn/i, "mdi:sofa"], [/k(ü|ue|u)che/i, "mdi:stove"], [/ess/i, "mdi:silverware-fork-knife"],
  [/schlaf/i, "mdi:bed"], [/kind/i, "mdi:teddy-bear"], [/bad/i, "mdi:shower"], [/(wc|toilette)/i, "mdi:toilet"],
  [/(b(ü|ue)ro|arbeit|office)/i, "mdi:desk"], [/(flur|diele|eingang|treppe)/i, "mdi:door"],
  [/(heiz|technik)/i, "mdi:water-boiler"], [/(garage|carport|einfahrt)/i, "mdi:garage"],
  [/garten/i, "mdi:flower"], [/(terrasse|balkon)/i, "mdi:grill"], [/(hauswirt|wasch)/i, "mdi:washing-machine"],
  [/gast/i, "mdi:bed-outline"], [/keller/i, "mdi:stairs-down"], [/(dach|spitzboden)/i, "mdi:home-roof"],
  [/ankleide/i, "mdi:hanger"],
];
const areaIcon = (a) => a.icon || (AREA_ICON_RULES.find(([re]) => re.test(a.name)) || [0, "mdi:floor-plan"])[1];

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

// Technische Temperaturen taugen nicht als Raumtemperatur
const TECH_RE = /(vorlauf|r(ü|ue)cklauf|speicher|puffer|kessel|kamin|solar|kollektor|boiler|warmwasser|abgas|cpu)/i;
const OUTDOOR_RE = /(au(ß|ss)en|garten|drau(ß|ss)en|outdoor|grundst(ü|ue)ck)/i;

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
  return { areas, floors: ordered, upper, lower, outdoor, visibleAreas, agg, batteries, eidArea, _panelIds, _panels: _panelIds, tech, energy: energyCfg(h, L, tech) };
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

/* ------------------------------------------------------------------------ */
/*  HTML-Bausteine                                                           */
/* ------------------------------------------------------------------------ */
const icon = (i, cls = "") => `<ha-icon icon="${esc(i)}"${cls ? ` class="${cls}"` : ""}></ha-icon>`;

function roomTileHTML(a, nav = true, opts = {}) {
  const pic = a.picture ? `<div class="pic" style="background-image:url('${esc(a.picture)}')"></div>` : "";
  return `<div class="room${a.picture ? " has-pic" : ""}" data-u="room" data-area="${esc(a.id)}" data-act="nav" data-to="raum/${esc(a.id)}"${nav ? "" : ' data-ext="1"'}>
    ${pic}
    <div class="room-head">${icon(a.icon, "ri")}<span class="rname">${esc(a.name)}</span>
      <span class="room-alerts">
        <span class="al al-win" hidden title="Offen">${icon("mdi:window-open-variant")}<b></b></span>
        <span class="al al-heat" hidden title="Heizt">${icon("mdi:fire")}</span>
        <span class="al al-pres" hidden title="Präsenz"><i class="pulse"></i></span>
      </span></div>
    <div class="room-clim"><span class="rt"></span><span class="rh"></span></div>
    ${opts.spark ? sparkHTML(a) : ""}
    ${opts.act ? '<div class="ract"></div>' : ""}
    <div class="room-foot">
      ${a.lights.length ? `<button class="mini ml" data-act="area-lights" data-area="${esc(a.id)}" title="Licht schalten">${icon("mdi:lightbulb-group")}<span></span></button>` : ""}
      ${a.covers.length ? `<span class="mini mc">${icon("mdi:window-shutter")}<span></span></span>` : ""}
    </div>
  </div>`;
}

function tileHTML(h, eid, area, opts = {}) {
  const st = h.states[eid];
  const d = dom(eid), c = dc(st);
  const name = esc(opts.name || entName(h, eid, area));
  const sub = opts.sub ? `<span class="tsub">${esc(opts.sub)}</span>` : "";
  const base = (cls, inner, act = "more") =>
    `<div class="tile ${cls}" data-u="tile" data-eid="${esc(eid)}" data-act="${act}" data-long="1">${inner}</div>`;
  const head = (extra = "") => `<div class="trow"><span class="tic">${icon("mdi:circle-medium")}</span>${extra}</div>`;

  switch (d) {
    case "light": {
      const dim = st && (st.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      return base("light", `<span class="fill"></span>${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>
        ${dim ? `<input class="slider" type="range" min="1" max="100" step="1" data-act="noop" data-bri="${esc(eid)}" aria-label="Helligkeit">` : ""}`, "toggle");
    }
    case "switch": case "input_boolean": case "fan": case "siren":
      return base("switch", `${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>`, "toggle");
    case "cover":
      return base("cover", `<span class="fill cfill"></span>${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>
        <div class="ctrls">
          <button class="btn" data-act="cover" data-svc="open_cover" data-eid="${esc(eid)}" title="Öffnen">${icon("mdi:arrow-up")}</button>
          <button class="btn" data-act="cover" data-svc="stop_cover" data-eid="${esc(eid)}" title="Stopp">${icon("mdi:stop")}</button>
          <button class="btn" data-act="cover" data-svc="close_cover" data-eid="${esc(eid)}" title="Schließen">${icon("mdi:arrow-down")}</button>
        </div>`);
    case "climate": case "water_heater":
      return base("climate wide", `${head(`<span class="tbig tval"></span>`)}<span class="tname">${name}</span>${sub}
        <div class="crow"><span class="tstate"></span><span class="sp"></span>
          <button class="btn sm" data-act="clim" data-step="-1" data-eid="${esc(eid)}" title="Kälter">${icon("mdi:minus")}</button>
          <span class="ttarget"></span>
          <button class="btn sm" data-act="clim" data-step="1" data-eid="${esc(eid)}" title="Wärmer">${icon("mdi:plus")}</button></div>`);
    case "media_player":
      return base("media wide", `${head(`<span class="sp"></span>
          <button class="btn sm" data-act="media" data-svc="media_play_pause" data-eid="${esc(eid)}">${icon("mdi:play-pause")}</button>
          <button class="btn sm" data-act="media" data-svc="media_next_track" data-eid="${esc(eid)}">${icon("mdi:skip-next")}</button>`)}
        <span class="tname">${name}</span>${sub}<span class="tmeta"></span><span class="tstate"></span>`);
    case "lock":
      return base("lock", `${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>
        <button class="btn lockbtn" data-act="lock" data-eid="${esc(eid)}"></button>`);
    case "camera":
      return base("camera wide", `<div class="cam"><img data-cam="${esc(eid)}" alt="" loading="lazy"><span class="camname">${icon("mdi:cctv")} ${name}</span></div>`);
    case "scene": case "script": case "button": case "input_button":
      return base("scene", `${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>`, "run");
    case "sensor":
      if (c === "battery") return base("sensor batt", `${head(`<span class="tbig tval"></span>`)}<span class="tname">${name}</span>${sub}<span class="bar"><i></i></span>`);
      return base("sensor", `${head(`<span class="tbig tval"></span>`)}<span class="tname">${name}</span>${sub}`);
    case "binary_sensor": {
      const k = CONTACT_DC.has(c) ? "contact" : PRESENCE_DC.has(c) ? "presence" : SAFETY_DC.has(c) ? "safety" : c === "battery" ? "safety" : "bin";
      return base(`bin ${k}`, `${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>`);
    }
    default:
      return base("other", `${head()}<span class="tname">${name}</span>${sub}<span class="tstate"></span>`);
  }
}

/* ---------- Kompakt: Zeilen statt Kacheln ---------- */
const CTRL_DOMAINS = new Set(["light", "switch", "input_boolean", "fan", "siren", "cover", "climate", "water_heater", "media_player",
  "lock", "camera", "scene", "script", "button", "input_button", "select", "input_select", "number", "input_number",
  "vacuum", "lawn_mower", "valve", "alarm_control_panel"]);

function rowHTML(h, eid, area, opts = {}) {
  const st = h.states[eid];
  const d = dom(eid), c = dc(st);
  const name = esc(opts.name || entName(h, eid, area));
  const sub = opts.sub ? `<span class="tsub">${esc(opts.sub)}</span>` : "";
  const ic = `<span class="tic">${icon("mdi:circle-medium")}</span>`;
  const nm = `<span class="tn"><span class="tname">${name}</span>${sub}</span>`;
  const e = esc(eid);
  const row = (cls, inner, act = "more", extra = "") =>
    `<div class="tile row ${cls}" data-u="tile" data-eid="${e}" data-act="${act}" data-long="1"${extra}>${inner}</div>`;
  const b = (act, attrs, ic2, title) => `<button class="btn" data-act="${act}" ${attrs} data-eid="${e}" title="${title}">${icon(ic2)}</button>`;
  switch (d) {
    case "light": {
      const dim = st && (st.attributes.supported_color_modes || []).some((m) => m !== "onoff");
      return row("light", `<span class="fill"></span>${ic}${nm}<span class="tstate"></span>`, "toggle", dim ? ' data-dim="1"' : "");
    }
    case "switch": case "input_boolean": case "fan": case "siren":
      return row("switch", `${ic}${nm}<span class="tstate"></span><span class="pill"></span>`, "toggle");
    case "cover":
      return row("cover", `<span class="fill cfill"></span>${ic}${nm}<span class="tstate"></span><span class="rbtns">
        ${b("cover", 'data-svc="open_cover"', "mdi:arrow-up", "Öffnen")}${b("cover", 'data-svc="stop_cover"', "mdi:stop", "Stopp")}${b("cover", 'data-svc="close_cover"', "mdi:arrow-down", "Schließen")}</span>`);
    case "climate": case "water_heater":
      return row("climate", `${ic}${nm}<span class="tval"></span><span class="rbtns">${b("clim", 'data-step="-1"', "mdi:minus", "Kälter")}<span class="ttarget"></span>${b("clim", 'data-step="1"', "mdi:plus", "Wärmer")}</span>`);
    case "media_player":
      return row("media", `${ic}<span class="tn"><span class="tname">${name}</span><span class="tmeta"></span></span><span class="tstate"></span><span class="rbtns">
        ${b("media", 'data-svc="media_play_pause"', "mdi:play-pause", "Play/Pause")}${b("media", 'data-svc="media_next_track"', "mdi:skip-next", "Weiter")}</span>`);
    case "lock":
      return row("lock", `${ic}${nm}<span class="tstate"></span><button class="btn lockbtn" data-act="lock" data-eid="${e}"></button>`);
    case "camera":
      return tileHTML(h, eid, area, opts);
    case "sensor":
      if (c === "battery") return row("sensor batt", `${ic}${nm}<span class="bar"><i></i></span><span class="tval"></span>`);
      return row("sensor", `${ic}${nm}<span class="tval"></span>`);
    case "scene": case "script": case "button": case "input_button":
      return row("scene", `${ic}${nm}<span class="tstate"></span>`, "run");
    case "binary_sensor": {
      const k = CONTACT_DC.has(c) ? "contact" : PRESENCE_DC.has(c) ? "presence" : "safety";
      return row(`bin ${k}`, `${ic}${nm}<span class="tstate"></span>`);
    }
    default:
      return row("other", `${ic}${nm}<span class="tstate"></span>`);
  }
}

function vchipHTML(h, eid, area) {
  return `<button class="vchip" data-u="tile" data-eid="${esc(eid)}" data-act="more" data-long="1"><span class="tic">${icon("mdi:circle-medium")}</span><span class="tname">${esc(entName(h, eid, area))}</span><b class="tval"></b><span class="tstate"></span></button>`;
}

function roomChipHTML(a) {
  return `<div class="rchip" data-u="room" data-area="${esc(a.id)}" data-act="nav" data-to="raum/${esc(a.id)}">${icon(a.icon, "ri")}<span class="rname">${esc(a.name)}</span><span class="rt"></span>
    <span class="room-alerts"><span class="al al-win" hidden>${icon("mdi:window-open-variant")}<b></b></span><span class="al al-heat" hidden>${icon("mdi:fire")}</span><span class="al al-pres" hidden><i class="pulse"></i></span></span>
    ${a.lights.length ? `<button class="mini ml" data-act="area-lights" data-area="${esc(a.id)}" title="Licht schalten">${icon("mdi:lightbulb-outline")}<span></span></button>` : ""}</div>`;
}
function roomRowHTML(a) {
  return `<div class="rrow" data-u="room" data-area="${esc(a.id)}" data-act="nav" data-to="raum/${esc(a.id)}"><span class="tdot"></span>${icon(a.icon, "ri")}<span class="rname">${esc(a.name)}</span>
    <span class="room-alerts"><span class="al al-win" hidden>${icon("mdi:window-open-variant")}<b></b></span><span class="al al-heat" hidden>${icon("mdi:fire")}</span><span class="al al-pres" hidden><i class="pulse"></i></span></span>
    <span class="sp"></span><span class="rt"></span>
    ${a.covers.length ? `<span class="mini mc">${icon("mdi:window-shutter")}<span></span></span>` : ""}
    ${a.lights.length ? `<button class="mini ml" data-act="area-lights" data-area="${esc(a.id)}" title="Licht schalten">${icon("mdi:lightbulb-outline")}<span></span></button>` : '<span class="mlph"></span>'}</div>`;
}
function roomActive(h, a) {
  return a.lights.some((e) => isOn(h.states[e])) || a.contacts.some((e) => isOn(h.states[e])) || a.presence.some((e) => isOn(h.states[e]))
    || a.climates.some((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating") || a.media.some((e) => h.states[e] && h.states[e].state === "playing");
}
const isBigRoom = (a) => !!(a.tempId || a.climates.length || a.covers.length || a.lights.length >= 3);

function rowsSectionHTML(h, a, kind, eids, title, ic, opts = {}) {
  const meta = GROUP_META[kind] || {};
  const t = title || meta.t || kind;
  const i = ic || meta.i || "mdi:dots-horizontal";
  const counted = kind === "light" || kind === "cover";
  const list = esc(eids.join(","));
  let actions = "";
  if (kind === "light") actions = `<button class="gbtn" data-act="list-lights" data-eids="${list}">${icon("mdi:lightbulb-group")}<span></span></button>`;
  if (kind === "cover") actions = `<button class="gbtn" data-act="list-covers" data-svc="open_cover" data-eids="${list}">${icon("mdi:arrow-up")}</button><button class="gbtn" data-act="list-covers" data-svc="close_cover" data-eids="${list}">${icon("mdi:arrow-down")}</button>`;
  const cnt = counted ? ` data-u="gcount" data-kind="${kind}" data-eids="${list}"` : "";
  const head = `${icon(i)}<span class="st">${esc(t)}</span><span class="gc">${opts.collapsed ? eids.length : ""}</span><span class="sp"></span>${actions}${opts.collapsed ? icon("mdi:chevron-down", "chev") : ""}`;
  const rows = `<div class="rows">${eids.map((e) => rowHTML(h, e, a)).join("")}</div>`;
  if (opts.collapsed) return `<details class="section glass"><summary class="shead">${head}</summary>${rows}</details>`;
  return `<div class="section glass"><div class="shead"${cnt}>${head}</div>${rows}</div>`;
}

/* ------------------------------------------------------------------------ */
/*  Aktualisierer (werden nur für geänderte Entitäten ausgeführt)            */
/* ------------------------------------------------------------------------ */
function setText(el, sel, txt) {
  const n = sel ? el.querySelector(sel) : el;
  if (n && n.textContent !== txt) n.textContent = txt;
}
function setHidden(n, v) {
  if (n && n.hidden !== v) n.hidden = v;
}
function setWidth(n, pct) {
  if (n && n._w !== pct) { n._w = pct; n.style.width = `${pct}%`; }
}
function setIcon(el, sel, ic) {
  const n = el.querySelector(sel);
  if (n && n.getAttribute("icon") !== ic) n.setAttribute("icon", ic);
}

const COVER_TXT = { open: "Offen", closed: "Geschlossen", opening: "Öffnet …", closing: "Schließt …" };
const HVAC_TXT = { heating: "Heizt", cooling: "Kühlt", idle: "Bereit", off: "Aus", drying: "Trocknet", fan: "Lüftet", preheating: "Vorheizen" };
const MEDIA_TXT = { playing: "Spielt", paused: "Pausiert", idle: "Bereit", off: "Aus", on: "An", standby: "Standby", buffering: "Lädt …" };
const LOCK_TXT = { locked: "Verriegelt", unlocked: "Entriegelt", locking: "Verriegelt …", unlocking: "Entriegelt …", jammed: "Blockiert", open: "Offen", opening: "Öffnet …" };

function updateTile(el, ctx) {
  const h = ctx._hass, eid = el.dataset.eid, st = h.states[eid];
  const d = dom(eid);
  const unav = isUnav(st);
  const on = isOn(st);
  el.classList.toggle("on", on);
  el.classList.toggle("unavail", unav);
  setIcon(el, ".tic ha-icon", entIcon(h, st));
  if (!st) { setText(el, ".tstate", "Nicht vorhanden"); return; }
  const a = st.attributes;
  let text;
  switch (d) {
    case "light": {
      const pct = on ? (a.brightness != null ? Math.max(1, Math.round((a.brightness / 255) * 100)) : 100) : 0;
      text = unav ? fmtState(h, st) : on ? (a.brightness != null ? `An · ${pct} %` : "An") : "Aus";
      setWidth(el.querySelector(".fill"), pct);
      const s = el.querySelector(".slider");
      if (s) { if (s.hidden === on) s.hidden = !on; if (ctx.shadowRoot.activeElement !== s && s.value !== String(pct || 1)) s.value = String(pct || 1); }
      const lc = on && Array.isArray(a.rgb_color) ? `rgb(${a.rgb_color.join(",")})` : "";
      if (el._lc !== lc) { el._lc = lc; if (lc) el.style.setProperty("--lc", lc); else el.style.removeProperty("--lc"); }
      break;
    }
    case "cover": {
      const pos = a.current_position;
      text = unav ? fmtState(h, st) : `${COVER_TXT[st.state] || fmtState(h, st)}${pos != null && st.state === "open" && pos < 100 ? ` · ${pos} %` : ""}`;
      setWidth(el.querySelector(".cfill"), pos != null ? pos : on ? 100 : 0);
      break;
    }
    case "climate": case "water_heater": {
      const cur = a.current_temperature;
      setText(el, ".tval", cur != null ? `${NF1.format(cur)}°` : "–");
      const tgt = a.temperature ?? a.target_temp_low;
      setText(el, ".ttarget", tgt != null ? `${NF1.format(tgt)}°` : "–");
      el.classList.toggle("heating", a.hvac_action === "heating");
      text = unav ? fmtState(h, st) : (HVAC_TXT[a.hvac_action] || fmtState(h, st));
      break;
    }
    case "media_player": {
      const meta = [a.media_title, a.media_artist].filter(Boolean).join(" · ");
      setText(el, ".tmeta", meta);
      text = MEDIA_TXT[st.state] || fmtState(h, st);
      break;
    }
    case "lock": {
      text = LOCK_TXT[st.state] || fmtState(h, st);
      const b = el.querySelector(".lockbtn");
      const pending = el.dataset.confirm === "1";
      if (b) setText(b, null, pending ? "Nochmal tippen" : on ? "Verriegeln" : "Entriegeln");
      el.classList.toggle("alert", on);
      break;
    }
    case "sensor": {
      const v = fmtState(h, st);
      setText(el, ".tval", v);
      if (dc(st) === "battery") {
        const n = num(st);
        setWidth(el.querySelector(".bar i"), n ?? 0);
        const L = ctx._layout;
        el.classList.toggle("crit", n !== null && n < L.battery_critical);
        el.classList.toggle("low", n !== null && n >= L.battery_critical && n < L.battery_low);
      }
      return;
    }
    case "scene": case "button": case "input_button": {
      const t = Date.parse(st.state);
      text = Number.isFinite(t) ? `Zuletzt ${relTime(st.state)}` : "Tippen zum Starten";
      break;
    }
    case "script":
      text = st.state === "on" ? "Läuft …" : "Bereit";
      break;
    case "binary_sensor": {
      text = fmtState(h, st);
      const c = dc(st);
      if (PRESENCE_DC.has(c) && !on && st.last_changed) text = `${text} · ${relTime(st.last_changed)}`;
      el.classList.toggle("alert", on && (CONTACT_DC.has(c) || SAFETY_DC.has(c) || c === "battery"));
      break;
    }
    default:
      text = fmtState(h, st);
  }
  setText(el, ".tstate", text);
}

function areaState(h, a) {
  const lightsOn = a.lights.filter((e) => isOn(h.states[e])).length;
  const coversOpen = a.covers.filter((e) => isOn(h.states[e])).length;
  const open = a.contacts.filter((e) => isOn(h.states[e]));
  const presence = a.presence.some((e) => isOn(h.states[e]));
  const heating = a.climates.some((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating");
  return { lightsOn, coversOpen, open, presence, heating, t: num(h.states[a.tempId]), hu: num(h.states[a.humId]) };
}

function updateRoom(el, ctx) {
  const a = ctx._model.areas.get(el.dataset.area);
  if (!a) return;
  const s = areaState(ctx._hass, a);
  setText(el, ".rt", s.t !== null ? `${NF1.format(s.t)}°` : "");
  setText(el, ".rh", s.hu !== null ? `${NF0.format(s.hu)} %` : "");
  el.classList.toggle("lit", s.lightsOn > 0);
  const dense = isDense(ctx._layout), chip = el.classList.contains("rchip");
  const ml = el.querySelector(".ml");
  if (ml) {
    ml.classList.toggle("on", s.lightsOn > 0);
    setText(ml, "span", s.lightsOn ? (chip ? String(s.lightsOn) : `${s.lightsOn}/${a.lights.length}`) : dense ? "" : "Aus");
    setIcon(ml, "ha-icon", s.lightsOn ? "mdi:lightbulb-on" : chip ? "mdi:lightbulb-outline" : "mdi:lightbulb-group");
  }
  const mc = el.querySelector(".mc");
  if (mc) { setText(mc, "span", s.coversOpen ? (dense ? String(s.coversOpen) : `${s.coversOpen} offen`) : "zu"); if (dense) { setHidden(mc, !s.coversOpen); setIcon(mc, "ha-icon", "mdi:window-shutter-open"); } }
  const tdot = el.querySelector(".tdot");
  if (tdot) {
    const c = s.t === null ? "transparent" : s.t < 18 ? "#63c7ff" : s.t < 20 ? "#5ad1c8" : s.t <= 23 ? "#4fd18b" : "#ff8a3d";
    if (tdot._c !== c) { tdot._c = c; tdot.style.background = c; }
  }
  const ract = el.querySelector(".ract");
  if (ract) {
    const h = ctx._hass, parts = [];
    const on = a.lights.filter((e) => isOn(h.states[e])).map((e) => entName(h, e, a));
    if (on.length) parts.push(`${on.join(", ")} an`);
    if (s.open.length) parts.push(`${s.open.map((e) => entName(h, e, a)).join(", ")} offen`);
    if (s.heating) parts.push("heizt");
    for (const e of a.media) if (h.states[e] && h.states[e].state === "playing") parts.push(`♪ ${h.states[e].attributes.media_title || entName(h, e, a)}`);
    if (s.presence) parts.push("Bewegung");
    const al = (alertsByArea(h, ctx._model, ctx._layout).get(a.id) || []);
    const extra = al.filter((x) => !(x.eid && a.contacts.includes(x.eid))).map((x) => x.title.replace(`${a.name} · `, "").replace(` · ${a.name}`, ""));
    setText(ract, null, [...extra, ...parts].join(" · "));
    const lvl = al.some((x) => x.level === "alarm") ? "alarm" : al.some((x) => x.level === "warn") ? "warn" : "";
    el.classList.toggle("ralarm", lvl === "alarm");
    el.classList.toggle("rwarn", lvl === "warn");
  }
  const w = el.querySelector(".al-win");
  setHidden(w, !s.open.length);
  if (w) setText(w, "b", s.open.length > 1 ? String(s.open.length) : "");
  setHidden(el.querySelector(".al-heat"), !s.heating);
  setHidden(el.querySelector(".al-pres"), !s.presence);
}

function updateHero(el, ctx) {
  const a = ctx._model.areas.get(el.dataset.area);
  if (!a) return;
  const h = ctx._hass;
  const s = areaState(h, a);
  setText(el, ".ht", s.t !== null ? `${NF1.format(s.t)} °C` : "");
  setText(el, ".hh", s.hu !== null ? `${NF0.format(s.hu)} %${el.classList.contains("slim") ? "" : " Luftfeuchte"}` : "");
  const badges = [];
  for (const e of s.open) badges.push(`<span class="badge alert">${icon(entIcon(h, h.states[e]))}${esc(entName(h, e, a))} offen</span>`);
  if (s.presence) badges.push(`<span class="badge acc">${icon("mdi:motion-sensor")}Präsenz</span>`);
  if (s.heating) badges.push(`<span class="badge heat">${icon("mdi:fire")}Heizt</span>`);
  const b = el.querySelector(".hero-badges");
  const html = badges.join("");
  if (b && b._h !== html) { b.innerHTML = html; b._h = html; }
  const lb = el.querySelector(".hl");
  if (lb) { setText(lb, "span", s.lightsOn ? "Licht aus" : "Licht an"); lb.classList.toggle("on", s.lightsOn > 0); }
}

function updateFloor(el, ctx) {
  const f = ctx._model.floors.find((x) => x.id === el.dataset.floor);
  if (!f) return;
  const h = ctx._hass;
  const lights = f.areas.flatMap((a) => a.lights);
  const on = lights.filter((e) => isOn(h.states[e])).length;
  const temps = f.areas.map((a) => num(h.states[a.tempId])).filter((v) => v !== null);
  setText(el, ".fl-l", lights.length ? String(on) : "");
  setHidden(el.querySelector(".fl-lw"), !lights.length);
  el.querySelector(".fl-lw").classList.toggle("on", on > 0);
  setText(el, ".fl-t", temps.length ? `${NF1.format(temps.reduce((x, y) => x + y, 0) / temps.length)}°` : "");
}

const CHIPS = {
  lights: (h, m) => { const n = m.agg.lights.filter((e) => isOn(h.states[e])).length; return m.agg.lights.length ? { t: n ? `${n} ${n === 1 ? "Licht" : "Lichter"} an` : "Alle Lichter aus", c: n ? "warm" : "calm", i: n ? "mdi:lightbulb-on" : "mdi:lightbulb-outline" } : null; },
  contacts: (h, m) => { const n = m.agg.contacts.filter((e) => isOn(h.states[e])).length; return m.agg.contacts.length ? { t: n ? `${n} offen` : "Fenster & Türen zu", c: n ? "alert" : "ok", i: n ? "mdi:window-open-variant" : "mdi:window-closed-variant" } : null; },
  covers: (h, m) => { const n = m.agg.covers.filter((e) => isOn(h.states[e])).length; return m.agg.covers.length ? { t: n ? `${n} ${n === 1 ? "Rollo" : "Rollos"} offen` : "Alle Rollos zu", c: "calm", i: n ? "mdi:window-shutter-open" : "mdi:window-shutter" } : null; },
  temp: (h, m) => { const v = m.agg.temps.map((e) => num(h.states[e])).filter((x) => x !== null); return v.length ? { t: `Ø ${NF1.format(v.reduce((a, b) => a + b, 0) / v.length)} °C innen`, c: "calm", i: "mdi:home-thermometer" } : null; },
  heat: (h, m) => { const n = m.agg.climates.filter((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating").length; return n ? { t: `${n} ${n === 1 ? "Raum heizt" : "Räume heizen"}`, c: "heat", i: "mdi:fire" } : null; },
  safety: (h, m) => { const on = m.agg.safety.filter((e) => isOn(h.states[e])); return on.length ? { t: on.length === 1 ? `${entName(h, on[0])}` : `${on.length} Meldungen`, c: "alert", i: "mdi:alarm-light" } : null; },
  batt: (h, m, L) => {
    let crit = 0, low = 0;
    for (const e of m.agg.batteries) {
      const st = h.states[e];
      if (dom(e) === "binary_sensor") { if (isOn(st)) crit++; continue; }
      const v = num(st);
      if (v === null) continue;
      if (v < L.battery_critical) crit++; else if (v < L.battery_low) low++;
    }
    const n = crit + low;
    return n ? { t: `${n} ${n === 1 ? "Batterie" : "Batterien"} schwach`, c: crit ? "alert" : "warm", i: "mdi:battery-alert-variant-outline" } : null;
  },
  unav: (h, m) => { const n = m.agg.unavailable.filter((e) => isUnav(h.states[e])).length; return n ? { t: `${n} nicht erreichbar`, c: "dim", i: "mdi:lan-disconnect" } : null; },
};
CHIPS.contactsAlert = (h, m) => { const r = CHIPS.contacts(h, m); return r && r.c === "alert" ? r : null; };
const CHIP_WATCH = { lights: "lights", contacts: "contacts", contactsAlert: "contacts", covers: "covers", temp: "temps", heat: "climates", safety: "safety", batt: "batteries", unav: "unavailable" };

/* ---------- Klingel ---------- */
function isRing(oldSt, st) {
  if (!st || !oldSt || oldSt === st || UNAV.has(st.state)) return false;
  if (Date.now() - Date.parse(st.last_changed || 0) > 60000) return false;   // nur frische Ereignisse
  if (dom(st.entity_id) === "event") {
    if (st.state === oldSt.state) return false;                                // nur Attribute geändert
    const et = st.attributes.event_type;
    return !et || /(ring|press|doorbell|klingel)/i.test(et);
  }
  return st.state === "on" && oldSt.state !== "on";
}

/* ---------- Warnungen ---------- */
const LEVELS = { alarm: 3, warn: 2, info: 1 };
const sinceMin = (st) => (st && st.last_changed ? (Date.now() - Date.parse(st.last_changed)) / 60000 : 0);
function ruleMatch(st, r) {
  const v = num(st), w = parseFloat(String(r.value ?? "").replace(",", "."));
  switch (r.op) {
    case "gt": return v !== null && Number.isFinite(w) && v > w;
    case "lt": return v !== null && Number.isFinite(w) && v < w;
    case "eq": return st.state === String(r.value ?? "");
    case "ne": return st.state !== String(r.value ?? "") && !UNAV.has(st.state);
    case "off": return !isOn(st) && !UNAV.has(st.state);
    case "unavailable": return UNAV.has(st.state);
    default: return isOn(st);
  }
}
function alertWatch(m, L) {
  const r = (L.alerts && L.alerts.rules) || [];
  const garages = m.visibleAreas.flatMap((a) => a.covers);
  const locks = m.visibleAreas.flatMap((a) => a.groups.lock || []);
  const pres = m.visibleAreas.flatMap((a) => a.presence);
  return [...m.agg.contacts, ...m.agg.safety, ...m.agg.climates, ...m.agg.batteries, ...m.agg.unavailable, ...garages, ...locks, ...pres, ...(m._panelIds || []), ...r.map((x) => x.entity).filter(Boolean)];
}
/* Alarmmanager: Zustände aus dem Backend (neu, quittiert, stumm) und jüngstes Protokoll */
let ALARMS = null;
const setAlarms = (snap) => { ALARMS = snap && Array.isArray(snap.log) ? { ...snap, log: snap.log.slice().sort((a, b) => a.ts - b.ts) } : snap; _alertMemo = null; };
let _alertMemo = null;
/** Alle aktiven Meldungen mit Zustand (auch stumme) – für den Alarmmanager */
function evalAlertsAll(h, m, L) {
  const now = Date.now();
  if (_alertMemo && _alertMemo.s === h.states && _alertMemo.m === m && _alertMemo.L === L && _alertMemo.a === ALARMS && now - _alertMemo.t < 1000) return _alertMemo.all;
  const book = (ALARMS && ALARMS.alarms) || {};
  const all = evalAlertsRaw(h, m, L).map((x) => {
    const b = book[x.key];
    return b ? { ...x, status: b.status || "neu", since: b.since, ack_by: b.ack_by, ack_at: b.ack_at, mute_until: b.mute_until, escalated: b.escalated } : { ...x, status: "neu" };
  });
  const list = all.filter((x) => x.status !== "stumm");
  _alertMemo = { s: h.states, m, L, a: ALARMS, t: now, all, list };
  return all;
}
/** Aktive Meldungen ohne stumme – für Warnkarte, Kopfzeile und Aktiv-Fokus */
function evalAlerts(h, m, L) { evalAlertsAll(h, m, L); return _alertMemo.list; }
/* Warnungen je Raum: über die Entität oder den Verweis auf die Raumseite */
function alertsByArea(h, m, L) {
  const map = new Map();
  for (const al of evalAlerts(h, m, L)) {
    const a = al.eid ? m.eidArea.get(al.eid) : al.to && al.to.startsWith("raum/") ? m.areas.get(al.to.slice(5)) : null;
    if (!a) continue;
    if (!map.has(a.id)) map.set(a.id, []);
    map.get(a.id).push(al);
  }
  return map;
}
const curMode = () => (ALARMS && ALARMS.mode && ALARMS.mode.mode) || "zuhause";
const alarmPanels = (h, m) => m._panels || [];
function evalAlertsRaw(h, m, L) {
  const c = L.alerts || DEFAULT_LAYOUT.alerts, out = [];
  const mode = curMode();
  const modeOk = (k) => ((c.modes && c.modes[k] && c.modes[k].length ? c.modes[k] : BUILTIN_MODES[k]) || HOUSE_MODES.map((x) => x[0])).includes(mode);
  const B = Object.fromEntries(Object.entries(c.builtin || {}).map(([k, v]) => [k, v && modeOk(k)]));
  const nm = (e) => { const a = m.eidArea.get(e); return `${a ? `${a.name} · ` : ""}${entName(h, e, a)}`; };
  const heatingArea = (a) => a && a.climates.some((x) => h.states[x] && h.states[x].attributes.hvac_action === "heating");
  // „Erst melden nach … Minuten“ gilt auch für „Fenster offen beim Heizen“
  const openLong = (e) => isOn(h.states[e]) && sinceMin(h.states[e]) >= (c.contacts_min || 0);
  if (B.contacts) for (const e of m.agg.contacts) {
    const st = h.states[e];
    if (B.window_heating && heatingArea(m.eidArea.get(e))) continue; // steckt schon in „Fenster offen beim Heizen“
    if (openLong(e)) out.push({ key: `contact:${e}`, level: "warn", icon: entIcon(h, st), title: `${nm(e)} offen`, detail: `seit ${relTime(st.last_changed).replace(/^vor /, "")}`, eid: e });
  }
  if (B.window_heating) for (const a of m.visibleAreas) {
    if (a.contacts.some(openLong) && a.climates.some((e) => h.states[e] && h.states[e].attributes.hvac_action === "heating"))
      out.push({ key: `heat:${a.id}`, level: "warn", icon: "mdi:radiator-disabled", title: `Fenster offen beim Heizen · ${a.name}`, detail: `${a.contacts.filter(openLong).map((e) => entName(h, e, a)).join(", ")} offen – Heizung läuft dagegen`, to: `raum/${a.id}` });
  }
  if (B.safety) for (const e of m.agg.safety) {
    const st = h.states[e];
    if (dom(e) === "alarm_control_panel") continue; // eigene Regel „Alarmanlage ausgelöst“
    if (isOn(st)) out.push({ key: `safety:${e}`, level: "alarm", icon: entIcon(h, st), title: nm(e), detail: fmtState(h, st), eid: e });
  }
  if (B.alarm_panel) for (const e of alarmPanels(h, m)) {
    const st = h.states[e];
    if (st && st.state === "triggered") out.push({ key: `alarmpanel:${e}`, level: "alarm", icon: "mdi:alarm-light", title: `${st.attributes.friendly_name || e} ausgelöst`, detail: "Alarmanlage", eid: e });
  }
  if (B.presence_away) for (const a of m.visibleAreas) for (const e of a.presence) {
    const st = h.states[e];
    if (isOn(st)) out.push({ key: `presence:${e}`, level: "alarm", icon: "mdi:motion-sensor", title: `${/beweg|präsenz|praesenz|motion|presence|anwesen/i.test(entName(h, e, a)) ? a.name : nm(e)}: Bewegung erkannt`, detail: `während Hausmodus ${MODE_NAME[mode]}`, eid: e, to: `raum/${a.id}` });
  }
  if (B.locks) for (const a of m.visibleAreas) for (const e of a.groups.lock || []) {
    const st = h.states[e];
    if (isOn(st)) out.push({ key: `lock:${e}`, level: "warn", icon: "mdi:lock-open-variant", title: `${nm(e)} entriegelt`, detail: relTime(st.last_changed), eid: e });
  }
  if (B.garage) for (const a of m.visibleAreas) for (const e of a.covers) {
    const st = h.states[e];
    if (["garage", "gate"].includes(dc(st)) && isOn(st)) out.push({ key: `garage:${e}`, level: "warn", icon: entIcon(h, st), title: `${nm(e)} offen`, detail: relTime(st.last_changed), eid: e });
  }
  if (B.battery) {
    const crit = m.agg.batteries.filter((e) => { const st = h.states[e]; if (dom(e) === "binary_sensor") return isOn(st); const v = num(st); return v !== null && v < L.battery_critical; });
    if (crit.length === 1) out.push({ key: "battery", level: "warn", icon: "mdi:battery-alert-variant-outline", title: `${nm(crit[0])} fast leer`, detail: fmtState(h, h.states[crit[0]]), to: "batterien" });
    else if (crit.length) out.push({ key: "battery", level: "warn", icon: "mdi:battery-alert-variant-outline", title: `${crit.length} Batterien fast leer`, detail: `unter ${L.battery_critical} %`, to: "batterien" });
  }
  if (B.offline) {
    const n = m.agg.unavailable.filter((e) => isUnav(h.states[e])).length;
    if (n) out.push({ key: "offline", level: "info", icon: "mdi:lan-disconnect", title: `${n} ${n === 1 ? "Gerät" : "Geräte"} nicht erreichbar`, detail: "" });
  }
  (c.rules || []).forEach((r, i) => {
    if (r.enabled === false || !r.entity) return;
    if (r.modes && r.modes.length && !r.modes.includes(mode)) return;
    const st = h.states[r.entity];
    if (!st || !ruleMatch(st, r) || (r.minutes && sinceMin(st) < r.minutes)) return;
    out.push({ key: `rule:${i}:${r.entity}`, level: r.level || "warn", icon: entIcon(h, st), title: r.title || nm(r.entity), detail: fmtState(h, st), eid: r.entity });
  });
  return out.sort((x, y) => LEVELS[y.level] - LEVELS[x.level]);
}
CHIPS.alerts = (h, m, L) => {
  const l = evalAlerts(h, m, L).filter((a) => a.level !== "info");
  return l.length ? { t: l.length === 1 ? l[0].title : `${l.length} Meldungen (${l.filter((a) => a.level === "alarm").length} Alarm)`.replace(" (0 Alarm)", ""), c: l.some((a) => a.level === "alarm") ? "alert" : "warmalert", i: l.some((a) => a.level === "alarm") ? "mdi:alarm-light" : "mdi:bell-alert" } : null;
};

const alertsCardHTML = (cls = "") => `<div class="glass acard ok ${cls}" data-u="alerts"><button class="ahead"><span class="ssic">${icon("mdi:shield-check")}</span><span class="ah"><span class="sst"></span><span class="ssd"></span></span></button><div class="alist"></div></div>`;

function updateAlerts(el, ctx) {
  const all = evalAlertsAll(ctx._hass, ctx._model, ctx._layout);
  const list = all.filter((a) => a.status !== "stumm"), muted = all.length - list.length;
  const top = list[0], lvl = top ? top.level : "ok";
  for (const k of ["ok", "alarm", "warn", "info"]) el.classList.toggle(k, k === lvl);
  el.classList.toggle("acked", !!list.length && list.every((a) => a.status === "quittiert"));
  setIcon(el, ".ssic ha-icon", lvl === "ok" ? "mdi:shield-check" : lvl === "alarm" ? "mdi:alarm-light" : lvl === "warn" ? "mdi:shield-alert" : "mdi:information-outline");
  const warns = list.filter((a) => a.level !== "info").length;
  const cnt = (lv) => list.filter((x) => x.level === lv).length;
  const parts = [[cnt("alarm"), "Alarm", "Alarme"], [cnt("warn"), "Warnung", "Warnungen"], [cnt("info"), "Hinweis", "Hinweise"]].filter(([n]) => n).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  setText(el, ".sst", !list.length ? "Alles in Ordnung" : list.length === 1 ? top.title : parts.join(" · "));
  const sub = (a) => a.status === "quittiert" ? `quittiert${a.ack_by ? ` von ${a.ack_by}` : ""}` : a.detail || "";
  setText(el, ".ssd", !list.length ? (muted ? `${muted} stumm geschaltet` : "Keine Warnungen aktiv") : list.length === 1 ? sub(top) : "");
  const head = el.querySelector(".ahead");
  if (head) {
    // Kopf öffnet immer den Alarmmanager (bei einer Meldung direkt mit ihr ausgewählt)
    head.dataset.act = "al-open-page";
    if (list.length === 1) head.dataset.key = top.key; else delete head.dataset.key;
    head.title = "Alarmmanager öffnen";
  }
  const html = (list.length > 1 ? list.slice(0, 8).map((a) => `<button class="aitem ${a.level}${a.status === "quittiert" ? " acked" : ""}" data-act="al-open-page" data-key="${esc(a.key)}">${icon(a.icon)}<span class="at">${esc(a.title)}</span><span class="ad">${esc(sub(a))}</span></button>`).join("")
    + (list.length > 8 ? `<div class="amore">und ${list.length - 8} weitere</div>` : "") : "")
    + (muted && list.length ? `<button class="amore amute" data-act="al-open-page">${icon("mdi:bell-off-outline")}${muted} stumm geschaltet</button>` : "");
  const lst = el.querySelector(".alist");
  if (lst && lst._h !== html) { lst.innerHTML = html; lst._h = html; }
}

/* ------------------------------------------------------------------------ */
/*  Alarmmanager                                                             */
/* ------------------------------------------------------------------------ */
const LEVEL_TXT = { alarm: "Alarm", warn: "Warnung", info: "Hinweis" };
const LEVEL_ICON = { alarm: "mdi:alarm-light", warn: "mdi:shield-alert", info: "mdi:information-outline" };
const ALARMO_TXT = { disarmed: "unscharf", armed_home: "scharf · zuhause", armed_away: "scharf · abwesend", armed_night: "scharf · Nacht",
  armed_vacation: "scharf · Urlaub", armed_custom_bypass: "scharf · eigene", arming: "wird scharf …", pending: "Eingangsverzögerung", triggered: "ALARM ausgelöst" };
const clockOf = (ts) => new Date(ts * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
function dayOf(ts) {
  const d = new Date(ts * 1000), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return diff === 0 ? "Heute" : diff === 1 ? "Gestern" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function durTxt(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? `${h} Std.${r ? ` ${r} Min.` : ""}` : `${Math.floor(h / 24)} T. ${h % 24} Std.`;
}
function muteTxt(until) {
  if (!until) return "stumm bis behoben";
  const d = new Date(until * 1000), now = new Date();
  return `stumm bis ${d.toDateString() === now.toDateString() ? "" : "morgen "}${clockOf(until)}`;
}
function statusTxt(a) {
  if (a.status === "quittiert") return `quittiert${a.ack_by ? ` von ${a.ack_by}` : ""}${a.ack_at ? ` · ${clockOf(a.ack_at)}` : ""}`;
  if (a.status === "stumm") return muteTxt(a.mute_until);
  return "neu";
}
function sinceTs(h, a) {
  if (a.since) return a.since;
  const st = a.eid && h.states[a.eid];
  return st ? new Date(st.last_changed).getTime() / 1000 : Date.now() / 1000;
}
const LOG_ICON = { eskaliert: "mdi:alarm-light-outline", aktion: "mdi:lightning-bolt-outline", modus: "mdi:home-switch-outline", hinweis: "mdi:alert-outline", neu: null, quittiert: "mdi:check", stumm: "mdi:bell-off-outline", stumm_aus: "mdi:bell-outline", stumm_ende: "mdi:bell-ring-outline", behoben: "mdi:check-circle-outline" };
function logTxt(e) {
  switch (e.type) {
    case "neu": return `${LEVEL_TXT[e.level] || "Meldung"} aufgetreten`;
    case "quittiert": return `quittiert${e.user ? ` von ${e.user}` : ""}`;
    case "stumm": return `${muteTxt(e.until)}${e.user ? ` · ${e.user}` : ""}`;
    case "stumm_aus": return `Stummschaltung aufgehoben${e.user ? ` · ${e.user}` : ""}`;
    case "stumm_ende": return "Stummschaltung abgelaufen, wieder offen";
    case "behoben": return `behoben${e.dur != null ? ` nach ${durTxt(e.dur)}` : ""}`;
    case "eskaliert": return `eskaliert – ${e.minutes || "?"} Min. nicht quittiert`;
    case "aktion": return `${e.text || "Aktion ausgeführt"}${e.test ? " (Test)" : ""}`;
    case "modus": return `${e.previous ? `vorher ${MODE_NAME[e.previous] || e.previous} · ` : ""}${e.user || "Automatik"}`;
    case "hinweis": return e.detail || "";
    default: return e.type;
  }
}
const logRow = (e, withTitle = true) => `<div class="lgrow ${esc(e.type)} ${esc(e.level || "")}"><span class="lgt">${clockOf(e.ts)}</span>${icon(LOG_ICON[e.type] || LEVEL_ICON[e.level] || "mdi:bell")}<span class="lgx">${withTitle ? `<b>${esc(e.title || "")}</b>` : ""}<span>${esc(logTxt(e))}</span></span></div>`;
function navBadge(el, ctx) {
  const n = evalAlerts(ctx._hass, ctx._model, ctx._layout).filter((a) => a.status === "neu" && a.level !== "info");
  const al = n.some((a) => a.level === "alarm");
  el.textContent = n.length ? String(n.length) : "";
  el.classList.toggle("on", n.length > 0);
  el.classList.toggle("alarm", al);
}

/* Kurzform (Zahl) und Kennzahl (Wert + Beschriftung) für die Kopfzeilen-Varianten */
function chipInfo(k, h, m, L) {
  const r = CHIPS[k](h, m, L);
  if (!r) return null;
  const n = parseInt(r.t, 10), has = Number.isFinite(n);
  let s = "", v = "", l = "";
  switch (k) {
    case "lights": v = has ? n : 0; s = has ? String(n) : ""; l = "Licht an"; break;
    case "contacts": case "contactsAlert": v = has ? n : "✓"; s = has ? String(n) : ""; l = has ? "offen" : "Fenster zu"; break;
    case "covers": v = has ? n : 0; s = has ? String(n) : ""; l = "Rollos offen"; break;
    case "temp": s = v = r.t.replace(/^Ø /, "").replace(" °C innen", "°"); l = "Ø innen"; break;
    case "heat": v = n; s = String(n); l = n === 1 ? "heizt" : "heizen"; break;
    case "safety": v = has ? n : 1; s = String(v); l = "Meldung"; break;
    case "batt": v = n; s = String(n); l = n === 1 ? "Batterie" : "Batterien"; break;
    case "unav": v = n; s = String(n); l = "offline"; break;
    case "alerts": v = has ? n : 1; s = String(v); l = v === 1 ? "Warnung" : "Warnungen"; break;
  }
  return { ...r, s, v, l };
}

function updateChip(el, ctx) {
  const r = CHIPS[el.dataset.k](ctx._hass, ctx._model, ctx._layout);
  if (el.hidden !== !r) el.hidden = !r;
  if (!r) return;
  const cls = `chip ${r.c}`;
  if (el.classList.contains("psub")) { /* Kopf einer Kategorieseite */ } else if (el.className !== cls) el.className = cls;
  setIcon(el, "ha-icon", r.i);
  setText(el, ".ct", r.t);
}

function updateRoof(el, ctx) {
  const h = ctx._hass, H = ctx._layout.header;
  for (const k of ["pv", "battery", "power", "grid"]) {
    const p = el.querySelector(`.ep-${k}`);
    if (!p) continue;
    const st = h.states[H[k]];
    let txt = "–";
    if (st) txt = k === "battery" ? (num(st) !== null ? `${NF0.format(num(st))} %` : fmtState(h, st)) : fmtPower(st);
    setText(p, "b", txt);
    if (k === "battery") setIcon(p, "ha-icon", batteryIcon(num(st)));
  }
  const pv = powerW(h.states[H.pv]);
  el.classList.toggle("producing", pv !== null && pv > 20);
}

const WEATHER_ICON = { "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy", fog: "mdi:weather-fog", hail: "mdi:weather-hail", lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy", partlycloudy: "mdi:weather-partly-cloudy", pouring: "mdi:weather-pouring", rainy: "mdi:weather-rainy", snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy", sunny: "mdi:weather-sunny", windy: "mdi:weather-windy", "windy-variant": "mdi:weather-windy-variant", exceptional: "mdi:alert" };
const setHtml = (n, html) => { if (n && n._h !== html) { n.innerHTML = html; n._h = html; } };

function updateWeather(el, ctx) {
  const st = ctx._hass.states[el.dataset.eid];
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  const W = { "clear-night": ["Klar", "mdi:weather-night"], cloudy: ["Bewölkt", "mdi:weather-cloudy"], fog: ["Nebel", "mdi:weather-fog"],
    hail: ["Hagel", "mdi:weather-hail"], lightning: ["Gewitter", "mdi:weather-lightning"], "lightning-rainy": ["Gewitter", "mdi:weather-lightning-rainy"],
    partlycloudy: ["Teils bewölkt", "mdi:weather-partly-cloudy"], pouring: ["Starkregen", "mdi:weather-pouring"], rainy: ["Regen", "mdi:weather-rainy"],
    snowy: ["Schnee", "mdi:weather-snowy"], "snowy-rainy": ["Schneeregen", "mdi:weather-snowy-rainy"], sunny: ["Sonnig", "mdi:weather-sunny"],
    windy: ["Windig", "mdi:weather-windy"], "windy-variant": ["Windig", "mdi:weather-windy-variant"], exceptional: ["Unwetter", "mdi:alert"] }[st.state] || [st.state, "mdi:weather-partly-cloudy"];
  setIcon(el, "ha-icon", W[1]);
  const t = st.attributes.temperature;
  setText(el, ".wt", t != null ? `${NF0.format(t)}°` : "");
  setText(el, ".wc", W[0]);
}

function updatePerson(el, ctx) {
  const st = ctx._hass.states[el.dataset.eid];
  el.classList.toggle("home", !!st && st.state === "home");
  el.title = st ? `${st.attributes.friendly_name || ""}: ${st.state === "home" ? "Zuhause" : st.state === "not_home" ? "Unterwegs" : st.state}` : "";
}

function updateGroupCount(el, ctx) {
  const eids = el._eids || [];
  const n = eids.filter((e) => isOn(ctx._hass.states[e])).length;
  const kind = el.dataset.kind;
  if (kind === "light") {
    setText(el, ".gc", n ? `${n} von ${eids.length} an` : "alle aus");
    const b = el.querySelector(".gbtn");
    if (b) setText(b, "span", n ? "Alle aus" : "Alle an");
  } else if (kind === "cover") setText(el, ".gc", n ? `${n} von ${eids.length} offen` : "alle zu");
  else if (kind === "contact") { setText(el, ".gc", n ? `${n} offen` : "alle zu"); el.classList.toggle("alert", n > 0); }
}

function updateSecSum(el, ctx) {
  const h = ctx._hass, m = ctx._model;
  const open = m.agg.contacts.filter((e) => isOn(h.states[e]));
  const alarm = m.agg.safety.filter((e) => isOn(h.states[e]));
  const bad = [...alarm, ...open];
  el.classList.toggle("bad", bad.length > 0);
  setIcon(el, ".ssic ha-icon", bad.length ? "mdi:shield-alert" : "mdi:shield-check");
  setText(el, ".sst", alarm.length ? `${alarm.length === 1 ? "Meldung" : `${alarm.length} Meldungen`}` : open.length ? `${open.length} offen` : "Alles zu");
  const area = (e) => { for (const a of m.visibleAreas) if (Object.values(a.groups).some((l) => l.includes(e))) return a; return null; };
  setText(el, ".ssd", bad.length ? bad.map((e) => { const a = area(e); return `${a ? a.name + " · " : ""}${entName(h, e, a)}`; }).join(", ") : "Fenster und Türen geschlossen, keine Melder ausgelöst");
}

function focusRooms(h, m, L) {
  const al = alertsByArea(h, m, L);
  const rank = (a) => { const l = al.get(a.id) || []; return l.some((x) => x.level === "alarm") ? 2 : l.some((x) => x.level === "warn") ? 1 : 0; };
  return m.visibleAreas.filter((a) => roomActive(h, a) || (al.get(a.id) || []).some((x) => x.level !== "info"))
    .map((a, i) => [a, rank(a), i]).sort((x, y) => y[1] - x[1] || x[2] - y[2]).map(([a]) => a);
}
function updateFocus(el, ctx) {
  const ids = focusRooms(ctx._hass, ctx._model, ctx._layout).map((a) => a.id).join(",");
  if (ids !== el.dataset.ids) { el.dataset.ids = ids; ctx._dirty = true; ctx._schedule(); }
}

function updateKChip(el, ctx) {
  const r = chipInfo(el.dataset.k, ctx._hass, ctx._model, ctx._layout);
  setHidden(el, !r);
  if (!r) return;
  const cls = `kchip ${r.c}${r.s ? "" : " iconly"}`;
  if (el.className !== cls) el.className = cls;
  setIcon(el, "ha-icon", r.i);
  setText(el, ".ct", r.s);
  if (el.title !== r.t) el.title = r.t;
}
function updateKpi(el, ctx) {
  const r = chipInfo(el.dataset.k, ctx._hass, ctx._model, ctx._layout);
  setHidden(el, !r);
  if (!r) return;
  const cls = `kpi ${r.c}`;
  if (el.className !== cls) el.className = cls;
  setIcon(el, "ha-icon", r.i);
  setText(el, ".kv", String(r.v));
  setText(el, ".kl", r.l);
  if (el.title !== r.t) el.title = r.t;
}
function updateSatz(el, ctx) {
  const h = ctx._hass, m = ctx._model, L = ctx._layout;
  const parts = ["lights", "covers", "heat", "temp"].map((k) => CHIPS[k](h, m, L)).filter(Boolean).map((r) => r.t);
  setText(el, ".htext", parts.join(" · "));
}

const chipWatch = (el, c) => (el.dataset.k === "alerts" ? alertWatch(c._model, c._layout) : c._model.agg[CHIP_WATCH[el.dataset.k]] || []);

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
const WB_MODES = { off: "Aus", now: "Sofort", minpv: "Min + PV", pv: "PV" };

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
  const used = new Set();
  // ---- Heizung ----
  const H = L.heating || {};
  let heat = null;
  if (H.enabled !== false) {
    const curve = pick(H.curve) || ids.find((e) => e.startsWith("sensor.") && S(e).attributes.slope !== undefined && (S(e).attributes.curve !== undefined || S(e).attributes.heating_limit !== undefined)) || "";
    const mixer = pick(H.mixer) || ids.find((e) => e.startsWith("sensor.") && S(e).attributes.feedforward !== undefined && S(e).attributes.status !== undefined) || "";
    const tank = (H.tank || []).filter((e) => S(e)).length ? H.tank.filter((e) => S(e))
      : temps.filter((e) => TANK_RE.test(label(e)) && !/soll|target/i.test(label(e))).sort((a, b) => TANK_POS(label(a)) - TANK_POS(label(b)) || label(a).localeCompare(label(b), "de"));
    const stove = pick(H.stove) || temps.find((e) => STOVE_RE.test(label(e))) || "";
    const pump = pick(H.stove_pump) || ids.find((e) => /^(sensor|switch|fan|binary_sensor|number)\./.test(e) && STOVE_RE.test(label(e)) && /pump/i.test(label(e))) || "";
    const flow = pick(H.flow) || temps.find((e) => /vorlauf|flow/i.test(label(e)) && !/soll|target|prim/i.test(label(e))) || "";
    const outdoor = pick(H.outdoor) || temps.find((e) => OUTDOOR_RE.test(label(e))) || "";
    if (tank.length || stove || curve || H.manual_curve) {
      const area = (H.area && areas.get(H.area)) || byAreaName(HEAT_AREA_RE) || areas.get(entArea(h, tank[0] || curve || flow));
      heat = { area: area ? area.id : null, tank, stove, pump, curve, mixer, flow, outdoor };
      [...tank, stove, pump, curve, mixer, flow].filter(Boolean).forEach((e) => used.add(e));
    }
  }
  // ---- Wallbox ----
  const W = L.wallbox || {};
  let wb = null;
  if (W.enabled !== false) {
    const cand = ids.filter((e) => WB_RE.test(label(e)));
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
      const area = (W.area && areas.get(W.area)) || areas.get(entArea(h, power || mode)) || byAreaName(WB_AREA_RE);
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
  if (cfg.curve || H.manual_curve) {
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
  el.querySelector(".heatgrid").innerHTML = parts.join("");
  el.querySelector(".heatgrid").dataset.n = String(parts.length);
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
  return `<div class="glass tech wb" data-u="wallbox" data-area="${esc(a.id)}"><div class="techh">${icon("mdi:ev-station")}<span>Wallbox</span><span class="techs"></span></div><div class="wbbody"></div></div>`;
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
  const opts = ms ? (ms.attributes.options || []) : [];
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
    ${opts.length ? `<div class="wbmodes" role="group" aria-label="Lademodus">${opts.map((o) => `<button class="altab sm${ms.state === o ? " on" : ""}" data-act="select-opt" data-eid="${esc(cfg.mode)}" data-opt="${esc(o)}"><span>${esc(WB_MODES[String(o).toLowerCase()] || o)}</span></button>`).join("")}
      ${limSt && /^(number|input_number)\./.test(cfg.limit) ? `<span class="wblim"><small>Ziel</small><button class="sbtn" data-act="num-step" data-eid="${esc(cfg.limit)}" data-step="${-limStep}" title="Ziel senken">${icon("mdi:minus")}</button><b>${lim === null ? "–" : `${NF0.format(lim)} %`}</b><button class="sbtn" data-act="num-step" data-eid="${esc(cfg.limit)}" data-step="${limStep}" title="Ziel erhöhen">${icon("mdi:plus")}</button></span>` : ""}</div>` : ""}`;
  setText(el, ".techs", charging ? `${NF1.format(kw ?? 0)} kW` : connected ? "angesteckt" : "");
}

/* ---------- Klimaseite: Temperaturen 24 h (Haus Ø und Außen) und Verlauf je Raum ---------- */
/* Eine Recorder-Abfrage für alle Räume und die Außentemperatur (über die Kopfkarte), danach fortgeschrieben.
   Farben (dunkle Fläche, geprüft): innen #e26a1c, außen #2a9ad8. Eine gemeinsame Achse in °C. */
const CL_IN = "#e26a1c", CL_OUT = "#2a9ad8";

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

const climRooms = (m) => m.visibleAreas.filter((a) => a.tempId && !OUTDOOR_RE.test(a.name) && !m.outdoor.some((f) => f.areas.includes(a)));

function climTrendHTML() {
  return `<div class="glass ctrend" data-u="climtrend">
    <div class="trh"><span class="trt">${icon("mdi:chart-line")}Temperaturen 24 h</span>
      <span class="ctl in"><i></i>Haus Ø<b></b></span><span class="ctl out"><i></i>Außen<b></b></span></div>
    <div class="ctstats"></div>
    <div class="trc ctc"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><g class="trgrid"></g><g class="ctgrid"></g><path class="ctp out"/><path class="ctp in"/></svg>
      <div class="cty"></div><span class="ctend in"></span><span class="ctend out"></span>
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

function updateClimTrend(el, ctx) {
  const h = ctx._hass, m = ctx._model, now = Date.now(), start = now - TREND_MS;
  const rooms = climRooms(m), out = outdoorTempId(h, m, ctx._layout);
  // alle Fühler der Seite in einer Abfrage – auch Außenbereiche, die nur einen Raum-Verlauf haben
  const ids = [...new Set([...m.visibleAreas.map((a) => a.tempId), out].filter(Boolean))];
  const rerun = () => ctx.shadowRoot.querySelectorAll('[data-u="climtrend"],[data-u="spark"]').forEach((x) => x.isConnected && UPD[x.dataset.u].run(x, ctx));
  const msg = el.querySelector(".trmsg");
  if (trendEnsure(h, ids, rerun)) { setHidden(msg, false); return; }
  const outS = (out && trendSeries(h, out)) || [];
  // Kennzahlen jetzt
  const curs = rooms.map((a) => [a, num(h.states[a.tempId])]).filter(([, v]) => v !== null).sort((x, y) => x[1] - y[1]);
  const avgNow = curs.length ? curs.reduce((s, [, v]) => s + v, 0) / curs.length : null;
  const outNow = num(h.states[out]);
  const outDay = trendScale(outS.filter(([t]) => t >= start).map((p) => p[1]), 0);
  const heating = m.visibleAreas.filter((a) => a.climates.some((c) => h.states[c] && h.states[c].attributes.hvac_action === "heating")).length;
  const stat = (lbl, val, sub = "") => `<span class="cts"><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ""}</span>`;
  setHtml(el.querySelector(".ctstats"), [
    avgNow !== null ? stat("Innen Ø", `${NF1.format(avgNow)}°`) : "",
    curs.length > 1 ? stat("Kühlster Raum", `${NF1.format(curs[0][1])}°`, esc(curs[0][0].name)) : "",
    curs.length > 1 ? stat("Wärmster Raum", `${NF1.format(curs[curs.length - 1][1])}°`, esc(curs[curs.length - 1][0].name)) : "",
    outNow !== null ? stat("Außen", `${NF1.format(outNow)}°`, outDay ? `24 h: ${NF1.format(outDay.min)}° bis ${NF1.format(outDay.max)}°` : "") : "",
    m.agg.climates.length ? stat("Heizt", `${heating} ${heating === 1 ? "Raum" : "Räume"}`) : "",
  ].join(""));
  setText(el, ".ctl.in b", avgNow !== null ? `${NF1.format(avgNow)}°` : "–");
  setText(el, ".ctl.out b", outNow !== null ? `${NF1.format(outNow)}°` : "–");
  setHidden(el.querySelector(".ctl.out"), !out);
  // Kurve höchstens alle 15 s neu rechnen (5-Minuten-Werte), Kennzahlen oben sofort
  if (el._drawn && now - el._drawn < 15000 && !el._force) {
    if (!el._tq) el._tq = setTimeout(() => { el._tq = 0; if (el.isConnected) { el._force = true; updateClimTrend(el, ctx); el._force = false; } }, 15000 - (now - el._drawn));
    return;
  }
  const inner = rooms.map((a) => trendSeries(h, a.tempId)).filter((p) => p && p.length > 1);
  const S = { in: inner.length ? avgSeries(inner, start, now) : [], out: outS };
  if (S.in.length < 2 && S.out.length < 2) {
    setHidden(msg, false);
    msg.innerHTML = `${icon("mdi:chart-line-variant")}Noch kein Verlauf aufgezeichnet (Recorder).`;
    el.classList.add("nodata"); return;
  }
  setHidden(msg, true); el.classList.remove("nodata");
  el._drawn = now;
  // eine Achse für beide Reihen, runde Teilstriche
  const all = [...S.in, ...S.out].filter(([t]) => t >= start).map((p) => p[1]).filter(finite);
  const lo0 = Math.min(...all) - 0.5, hi0 = Math.max(...all) + 0.5;
  // höchstens vier Abschnitte auf der Achse, runde Teilstriche
  let step = 20, lo = Math.floor(lo0 / 20) * 20, hi = Math.ceil(hi0 / 20) * 20;
  for (const s of [1, 2, 5, 10]) {
    const l = Math.floor(lo0 / s) * s, u = Math.ceil(hi0 / s) * s;
    if ((u - l) / s <= 4) { step = s; lo = l; hi = u; break; }
  }
  const H = 100, pad = 4, x = (t) => ((t - start) / TREND_MS) * 1000, y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  el.querySelector(".ctp.in").setAttribute("d", trendPath(S.in, x, y));
  el.querySelector(".ctp.out").setAttribute("d", trendPath(S.out, x, y));
  const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
  el.querySelector(".ctgrid").innerHTML = ticks.map((v) => `<line x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join("");
  setHtml(el.querySelector(".cty"), ticks.map((v) => `<span style="top:${y(v)}%">${v}°</span>`).join(""));
  // Werte am Linienende (direkte Beschriftung)
  for (const k of ["in", "out"]) {
    const last = S[k][S[k].length - 1], lab = el.querySelector(`.ctend.${k}`);
    setHidden(lab, !last);
    if (last) { lab.style.top = `${y(last[1])}%`; lab.textContent = `${NF1.format(last[1])}°`; }
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
  el._ct = { S, start, y };
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
    parts.push(`<span class="tk ${k}"><i></i>${lbl} <b>${NF1.format(p[1])}°</b></span>`);
  }
  tip.innerHTML = `<span>${new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>${parts.join("")}`;
  cur.style.left = `${frac * 100}%`; tip.style.left = `${Math.min(Math.max(frac * 100, 15), 85)}%`;
  cur.classList.add("on"); tip.classList.add("on");
}

/* Verlauf je Raum: eine Reihe, Soll als gestrichelte Linie, Spanne der letzten 24 h */
function sparkHTML(a) {
  return a.tempId ? `<span class="kspark" data-u="spark" data-area="${esc(a.id)}"><svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><path class="spset"/><path class="spl"/></svg><small class="sprg"></small><span class="sptip"></span></span>` : `<span class="kspark none"></span>`;
}

function updateSpark(el, ctx) {
  const a = ctx._model.areas.get(el.dataset.area);
  if (!a || !a.tempId) return;
  const h = ctx._hass, now = Date.now(), start = now - TREND_MS;
  if (trendEnsure(h, [a.tempId], () => el.isConnected && updateSpark(el, ctx))) return;
  const pts = trendSeries(h, a.tempId) || [];
  const cl = a.climates.map((c) => h.states[c]).find((s) => s && finite(s.attributes.temperature));
  const soll = cl ? cl.attributes.temperature : null;
  const sc = trendScale([...pts.filter(([t]) => t >= start).map((p) => p[1]), soll].filter(finite), 1.5);
  if (!sc || pts.length < 2) { el.classList.add("empty"); el.querySelector(".spl").setAttribute("d", ""); setText(el, ".sprg", ""); return; }
  el.classList.remove("empty");
  const x = (t) => ((t - start) / TREND_MS) * 200, y = (v) => 38 - ((v - sc.lo) / (sc.hi - sc.lo)) * 36;
  el.querySelector(".spl").setAttribute("d", trendPath(pts, x, y));
  el.querySelector(".spset").setAttribute("d", soll !== null ? `M0 ${y(soll).toFixed(1)}L200 ${y(soll).toFixed(1)}` : "");
  const day = trendScale(pts.filter(([t]) => t >= start).map((p) => p[1]), 0);
  setText(el, ".sprg", day ? `${NF1.format(day.min)}–${NF1.format(day.max)}°` : "");
  el.title = `${a.name}: 24 h ${day ? `${NF1.format(day.min)} bis ${NF1.format(day.max)} °C` : ""}${soll !== null ? ` · Soll ${NF1.format(soll)} °C` : ""}`;
  el._sp = { pts, start };
}

function sparkHover(el, frac) {
  const T = el._sp, tip = el.querySelector(".sptip");
  if (!T || frac === null) { tip.classList.remove("on"); return; }
  const t = T.start + frac * TREND_MS, p = trendAt(T.pts, t);
  if (!p) { tip.classList.remove("on"); return; }
  tip.textContent = `${new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${NF1.format(p[1])}°`;
  tip.style.left = `${Math.min(Math.max(frac * 100, 20), 80)}%`;
  tip.classList.add("on");
}

/* ---------- Energie-Seite: Fluss, Kennzahlen, Bilanz heute, Verlauf 24 h ---------- */
/* Quellen: „Energie auf dem Dach“ (PV, Akku-Ladestand, Hausverbrauch, Netz), Speicher-Leistung und Wallbox.
   Vorzeichen: Netz positiv = Bezug, Speicher positiv = Laden (beides umkehrbar). Eine Recorder-Abfrage für alle Leistungen.
   Farben (dunkle Fläche): PV #ffc457, Verbrauch #63c7ff, Netz #b39cff. */
const EN_PV = "#ffc457", EN_USE = "#63c7ff", EN_GRID = "#b39cff";
const BAT_RE = /(akku|batter|battery|hausspeicher|stromspeicher)/i;
const EN_POS = { pv: [50, 14], grid: [12, 50], bat: [88, 50], wb: [50, 86] };

/** Welche Sensoren die Energie-Seite nutzt; null = keine Energiedaten. */
function energyCfg(h, L, tech) {
  const H = L.header || {}, E = L.energy || {};
  if (E.enabled === false) return null;
  const S = (e) => (e && h.states[e] ? e : "");
  const pv = S(H.pv), grid = S(H.grid), house = S(H.power), soc = S(H.battery);
  const wb = (tech && tech.wb && tech.wb.power) || "";
  const lbl = (e) => `${e} ${h.states[e].attributes.friendly_name || ""}`;
  const bat = S(E.battery_power) || Object.keys(h.states).find((e) => e.startsWith("sensor.") && dc(h.states[e]) === "power" && ![pv, grid, house, wb].includes(e)
    && BAT_RE.test(lbl(e)) && !/(pv|solar|grid|netz|soc|wallbox|evcc|lade)/i.test(lbl(e))) || "";
  if (!pv && !grid && !house && !bat) return null;
  return { pv, grid, house, soc, bat, wb, wbOn: (tech && tech.wb && tech.wb.charging) || "", gridInv: !!E.grid_invert, batInv: !!E.battery_invert };
}
const energyWatch = (c) => (c ? [c.pv, c.grid, c.house, c.soc, c.bat, c.wb, c.wbOn].filter(Boolean) : []);
const energyIds = (c) => (c ? [c.pv, c.grid, c.house, c.bat].filter(Boolean) : []);
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
  ctx._enS = { c, at: now, start, now, S: { pv, use, grid }, day };
  return ctx._enS;
}

function enLoad(el, ctx) {
  const c = ctx._model.energy;
  const rerun = () => ctx.shadowRoot.querySelectorAll('[data-u="enday"],[data-u="entrend"]').forEach((x) => { if (x.isConnected) { x._force = true; UPD[x.dataset.u].run(x, ctx); x._force = false; } });
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
  if (el._hour !== hour) {
    el._hour = hour;
    const tk = []; const d0 = new Date(start); d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime() + 3600000; t < now; t += 3600000) if (new Date(t).getHours() % 6 === 0) tk.push(t);
    el.querySelector(".trgrid").innerHTML = tk.map((t) => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="0" y2="${H}"/>`).join("");
    el.querySelector(".trx").innerHTML = tk.filter((t) => x(t) < 900).map((t) => `<span style="left:${(x(t) / 10).toFixed(2)}%">${new Date(t).getHours()} Uhr</span>`).join("") + `<span class="now">jetzt</span>`;
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

const UPD = {
  alerts: { watch: (el, c) => alertWatch(c._model, c._layout), run: updateAlerts },
  alarmpage: { watch: (el, c) => alertWatch(c._model, c._layout), run: (el, c) => c._renderAlarmPage(el) },
  navbadge: { watch: (el, c) => alertWatch(c._model, c._layout), run: navBadge },
  hmode: { watch: () => [], run: (el) => { const md = curMode(); el.dataset.mode = md; setIcon(el, "ha-icon", MODE_ICON[md]); setText(el, ".hml", MODE_NAME[md]); el.title = `Hausmodus: ${MODE_NAME[md]}`; } },
  kchip: { watch: chipWatch, run: updateKChip },
  kpi: { watch: chipWatch, run: updateKpi },
  hsatz: { watch: (el, c) => [...c._model.agg.lights, ...c._model.agg.covers, ...c._model.agg.climates, ...c._model.agg.temps], run: updateSatz },
  focus: { watch: (el, c) => [...c._model.visibleAreas.flatMap((a) => a.watch), ...alertWatch(c._model, c._layout)], run: updateFocus },
  secsum: { watch: (el, c) => [...c._model.agg.contacts, ...c._model.agg.safety], run: updateSecSum },
  tile: { watch: (el) => [el.dataset.eid], run: updateTile },
  room: { watch: (el, c) => (c._model.areas.get(el.dataset.area) || { watch: [] }).watch, run: updateRoom },
  hero: { watch: (el, c) => (c._model.areas.get(el.dataset.area) || { watch: [] }).watch, run: updateHero },
  floor: { watch: (el, c) => (c._model.floors.find((f) => f.id === el.dataset.floor) || { watch: [] }).watch, run: updateFloor },
  chip: { watch: chipWatch, run: updateChip },
  roof: { watch: (el, c) => Object.values(c._layout.header).filter(Boolean), run: updateRoof },
  weather: { watch: (el) => [el.dataset.eid], run: updateWeather },
  person: { watch: (el) => [el.dataset.eid], run: updatePerson },
  gcount: { watch: (el) => (el._eids = (el.dataset.eids || "").split(",").filter(Boolean)), run: updateGroupCount },
  heat: { watch: (el, c) => techWatch(c._model.tech && c._model.tech.heat), run: updateHeat },
  wallbox: { watch: (el, c) => techWatch(c._model.tech && c._model.tech.wb), run: updateWallbox },
  energy: { watch: (el, c) => energyWatch(c._model.energy), run: updateEnergy },
  enday: { watch: (el, c) => energyIds(c._model.energy), run: updateEnDay },
  entrend: { watch: (el, c) => energyIds(c._model.energy), run: updateEnTrend },
  climtrend: { watch: (el, c) => [...climRooms(c._model).map((a) => a.tempId), outdoorTempId(c._hass, c._model, c._layout), ...c._model.agg.climates].filter(Boolean), run: updateClimTrend },
  spark: { watch: (el, c) => { const a = c._model.areas.get(el.dataset.area); return a ? [a.tempId, ...a.climates].filter(Boolean) : []; }, run: updateSpark },
  trend: { watch: (el, c) => { const a = c._model.areas.get(el.dataset.area); return a ? [a.tempId, a.humId].filter(Boolean) : []; }, run: updateTrend },
};

/* ------------------------------------------------------------------------ */
/*  Stile                                                                    */
/* ------------------------------------------------------------------------ */
const STYLES = `
:host{display:block;height:100%;
  --hv-accent:var(--primary-color,#5aa0ff);--hv-text:#eef2f8;--hv-dim:rgba(238,242,248,.64);--hv-faint:rgba(238,242,248,.38);
  --hv-glass:rgba(16,22,34,.58);--hv-surface:rgba(255,255,255,.055);--hv-surface-2:rgba(255,255,255,.1);--hv-line:rgba(255,255,255,.09);
  --hv-warm:#ffc457;--hv-alert:#ff6b5b;--hv-ok:#4fd18b;--hv-cool:#63c7ff;--hv-heat:#ff8a3d;--hv-r:20px;
  color:var(--hv-text);font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif));
  -webkit-font-smoothing:antialiased}
:host(.card){height:auto;--hv-text:var(--primary-text-color);--hv-dim:var(--secondary-text-color);--hv-faint:var(--disabled-text-color);
  --hv-surface:rgba(127,127,127,.1);--hv-surface-2:rgba(127,127,127,.18);--hv-line:var(--divider-color,rgba(127,127,127,.2));
  --hv-glass:rgba(127,127,127,.05);--hv-lower:rgba(127,127,127,.1);--hv-pill:rgba(127,127,127,.14);--hv-out:rgba(110,200,120,.1)}
*{box-sizing:border-box}[hidden]{display:none!important}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0}
ha-icon{--mdc-icon-size:20px;display:inline-flex;align-items:center;justify-content:center;flex:none;width:var(--mdc-icon-size);height:var(--mdc-icon-size);line-height:0;vertical-align:middle}
.app{position:relative;display:flex;height:calc(100vh - var(--hv-top,0px));height:calc(100dvh - var(--hv-top,0px));overflow:hidden}
.rail{height:100%}
.bg{position:absolute;inset:0;z-index:0;background:var(--hv-bg,radial-gradient(1100px 650px at 12% -8%,#2a3e66 0%,transparent 62%),radial-gradient(900px 600px at 108% 6%,#3a2a58 0%,transparent 55%),radial-gradient(800px 500px at 60% 120%,#123a3a 0%,transparent 60%),linear-gradient(160deg,#0c111d,#111a2c 50%,#0a0e17));background-size:cover;background-position:center}
.glass{background:var(--hv-glass);border:1px solid var(--hv-line);border-radius:var(--hv-r)}
.blur .glass,.blur .rail{-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}

/* Navigation */
.rail{position:relative;z-index:2;width:88px;flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 0 12px;background:rgba(8,12,20,.55);border-right:1px solid var(--hv-line);overflow-y:auto;scrollbar-width:none}
.logo{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:12px}
.logo svg{width:40px;height:40px}.logo small{font-size:10px;color:var(--hv-faint);letter-spacing:.04em}
.nav{width:72px;padding:9px 0 7px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--hv-dim);font-size:11px;line-height:1.1;text-align:center;transition:background .2s,color .2s}
.nav:hover{background:rgba(255,255,255,.05)}
.nav.active{background:rgba(255,255,255,.1);color:var(--hv-text)}.nav.active ha-icon{color:var(--hv-accent)}
.nav ha-icon{--mdc-icon-size:22px}
.rail hr{width:44px;border:0;border-top:1px solid var(--hv-line);margin:8px 0}
.rail .grow{flex:1}
.main{position:relative;z-index:1;flex:1;overflow-y:auto;overflow-x:hidden;padding:22px 28px 48px}
.wrap{width:100%;margin:0}

/* Kopfzeile */
.top{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
.menu{display:none;width:40px;height:40px;border-radius:12px;align-items:center;justify-content:center;background:var(--hv-surface)}
.greet{font-size:14px;color:var(--hv-dim)}
.clock{font-size:46px;font-weight:300;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.date{font-size:14px;color:var(--hv-dim);margin-top:4px}
.top .sp{flex:1}
.weather{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:18px}
.weather ha-icon{--mdc-icon-size:30px;color:var(--hv-warm)}.weather .wt{font-size:24px;font-weight:300}.weather .wc{font-size:12px;color:var(--hv-dim)}
.persons{display:flex;gap:6px}
.person{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:600;background:var(--hv-surface-2);border:2px solid rgba(255,255,255,.15);overflow:hidden;opacity:.6}
.person.home{border-color:var(--hv-ok);opacity:1}.person img{width:100%;height:100%;object-fit:cover}
.notice{margin:0 0 14px;padding:10px 14px;border-radius:14px;background:rgba(255,196,87,.14);border:1px solid rgba(255,196,87,.35);font-size:13px}

/* Status-Chips */
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 20px}
.chip{display:flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:13px;transition:transform .15s}
.chip:active{transform:scale(.97)}
.chip .ic{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--hv-surface-2)}
.chip .ic ha-icon{--mdc-icon-size:17px}
.chip.warm .ic{background:rgba(255,196,87,.2);color:var(--hv-warm)}.chip.alert .ic{background:rgba(255,107,91,.2);color:var(--hv-alert)}
.chip.ok .ic{background:rgba(79,209,139,.18);color:var(--hv-ok)}.chip.heat .ic{background:rgba(255,138,61,.2);color:var(--hv-heat)}
.chip.dim{color:var(--hv-dim)}
.chip.alert{border-color:rgba(255,107,91,.35)}

/* Hausschnitt */
.house{position:relative;margin:0 auto}
.roof{position:relative;height:110px;margin:0 2px -1px;cursor:pointer}
.roof>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.roof .shape{fill:rgba(255,255,255,.045);stroke:var(--hv-line);stroke-width:1.2;vector-effect:non-scaling-stroke}
.roof .pv{fill:rgba(99,150,255,.16);stroke:rgba(140,180,255,.35);stroke-width:1;vector-effect:non-scaling-stroke;transition:fill .6s}
.roof .pvl{stroke:rgba(140,180,255,.25);stroke-width:1;vector-effect:non-scaling-stroke}
.roof.producing .pv{fill:rgba(120,180,255,.42);filter:drop-shadow(0 0 6px rgba(120,180,255,.55))}
.roof .sun{position:absolute;left:6%;top:-6px;color:var(--hv-faint);transition:color .6s}
.roof .sun ha-icon{--mdc-icon-size:30px}
.roof.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 10px rgba(255,196,87,.7))}
.energy{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 18%}
.ep{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--hv-pill,rgba(0,0,0,.38));border:1px solid var(--hv-line);font-size:12px;color:var(--hv-dim);white-space:nowrap}
.ep b{color:var(--hv-text);font-weight:600;font-variant-numeric:tabular-nums}.ep ha-icon{--mdc-icon-size:16px}
.ep-pv ha-icon{color:var(--hv-warm)}.ep-battery ha-icon{color:var(--hv-ok)}.ep-power ha-icon{color:var(--hv-cool)}
.roof .rtitle{position:absolute;left:0;right:0;top:60px;text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--hv-faint)}
.frame{border:1px solid var(--hv-line);border-radius:0 0 6px 6px;overflow:hidden}
.frame.lower{border-radius:0 0 22px 22px;border-top:0;background:var(--hv-lower,rgba(0,0,0,.22))}
.floor{display:flex;background:var(--hv-glass)}
.floor+.floor{border-top:1px dashed var(--hv-line)}
.flabel{width:60px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px 0;border-right:1px solid var(--hv-line);color:var(--hv-dim)}
.fname{writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--hv-text);white-space:nowrap;max-height:180px;overflow:hidden;text-overflow:ellipsis}
.fstat{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;font-variant-numeric:tabular-nums}
.fl-lw{display:flex;flex-direction:column;align-items:center;gap:1px}.fl-lw ha-icon{--mdc-icon-size:16px}.fl-lw.on{color:var(--hv-warm)}
.rooms{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:12px;padding:14px}
.ground{position:relative;height:16px;margin:0 -18px}
.ground::before{content:"";position:absolute;left:0;right:0;top:6px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(110,200,120,.55) 12%,rgba(110,200,120,.55) 88%,transparent)}
.outdoor{margin-top:22px}
.outdoor .floor{border-radius:22px;border:1px solid rgba(110,200,120,.22);background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.outdoor .flabel{border-right-color:rgba(110,200,120,.2)}
.secttitle{display:flex;align-items:center;gap:10px;margin:28px 2px 12px;font-size:15px;font-weight:600}
.secttitle ha-icon{color:var(--hv-dim)}.secttitle .sp{flex:1}

/* Raumkachel */
.room{position:relative;min-height:132px;border-radius:18px;padding:12px 13px;background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.025));border:1px solid var(--hv-line);overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:box-shadow .5s,border-color .5s,transform .15s}
:host(.card) .room{background:var(--hv-surface)}
.room:active{transform:scale(.985)}
.room .pic{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.5}
.room .pic::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,12,20,.25),rgba(8,12,20,.88))}
.room::before{content:"";position:absolute;left:-20%;right:-20%;top:-60%;height:130%;background:radial-gradient(closest-side,rgba(255,196,87,.32),transparent);opacity:0;transition:opacity .6s;pointer-events:none}
.room.lit{border-color:rgba(255,196,87,.42);box-shadow:0 10px 30px -14px rgba(255,196,87,.55)}
.room.lit::before{opacity:1}
.room-head{position:relative;display:flex;align-items:center;gap:7px}
.room-head .ri{--mdc-icon-size:18px;color:var(--hv-dim)}.room.lit .ri{color:var(--hv-warm)}
.rname{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.room-alerts{margin-left:auto;display:flex;align-items:center;gap:4px}
.al{display:flex;align-items:center;gap:1px;font-size:11px}.al ha-icon{--mdc-icon-size:16px}
.al-win{color:var(--hv-alert)}.al-heat{color:var(--hv-heat)}
.pulse{display:block;width:8px;height:8px;border-radius:50%;background:var(--hv-accent);box-shadow:0 0 0 0 rgba(90,160,255,.6);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(90,160,255,.55)}70%{box-shadow:0 0 0 8px rgba(90,160,255,0)}100%{box-shadow:0 0 0 0 rgba(90,160,255,0)}}
.room-clim{position:relative;margin-top:auto;display:flex;align-items:baseline;gap:10px;padding-top:10px}
.rt{font-size:28px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.rh{font-size:12px;color:var(--hv-dim)}
.room-foot{position:relative;display:flex;gap:6px;margin-top:8px;min-height:0}
.mini{white-space:nowrap;display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid var(--hv-line);font-size:11.5px;color:var(--hv-dim);font-variant-numeric:tabular-nums}
:host(.card) .mini{background:var(--hv-surface)}
.mini ha-icon{--mdc-icon-size:15px}.mini.on{background:rgba(255,196,87,.18);color:var(--hv-warm);border-color:rgba(255,196,87,.38)}

/* Seiten */
.ptitle{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.ptitle h1{margin:0;font-size:30px;font-weight:400;letter-spacing:-.01em}
.ptitle .psub{color:var(--hv-dim);font-size:14px}.ptitle .sp{flex:1}
.pbtn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:12px;background:var(--hv-surface-2);border:1px solid var(--hv-line);font-size:13px;white-space:nowrap}
.pbtn:hover{background:rgba(255,255,255,.15)}.pbtn.on{background:rgba(255,196,87,.2);color:var(--hv-warm);border-color:rgba(255,196,87,.38)}
.pbtn.primary{background:var(--hv-accent);color:#fff;border-color:transparent}
.pbtn ha-icon{--mdc-icon-size:18px}
.iconbtn{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.3);border:1px solid var(--hv-line)}
.fhead{display:flex;align-items:center;gap:10px;margin:26px 2px 12px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--hv-dim);font-weight:600}
.fhead .sp{flex:1;height:1px;background:var(--hv-line)}
.fhead .pbtn{letter-spacing:0;text-transform:none;font-weight:400}

/* Raumseite */
.hero{position:relative;overflow:hidden;padding:16px 20px 18px;min-height:190px;display:flex;flex-direction:column;margin-bottom:18px}
.hero .pic{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.55}
.hero .pic::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,12,20,.9),rgba(8,12,20,.45) 60%,rgba(8,12,20,.7))}
.hero>*{position:relative}
.hero-top{display:flex;align-items:center;gap:10px}.hero-top .crumb{font-size:13px;color:var(--hv-dim);letter-spacing:.1em;text-transform:uppercase}.hero-top .sp{flex:1}
.hero-main{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-top:auto;padding-top:22px}
.hero h1{margin:0;font-size:38px;font-weight:400;letter-spacing:-.01em;display:flex;align-items:center;gap:12px}
.hero h1 ha-icon{--mdc-icon-size:34px;color:var(--hv-dim)}
.hero-clim{display:flex;gap:16px;margin-top:6px;color:var(--hv-dim);font-size:15px;font-variant-numeric:tabular-nums}.hero-clim .ht{color:var(--hv-text);font-size:22px;font-weight:300}
.hero-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;background:var(--hv-surface-2)}
.badge ha-icon{--mdc-icon-size:15px}.badge.alert{background:rgba(255,107,91,.2);color:#ffb0a6}.badge.acc{background:rgba(90,160,255,.2)}.badge.heat{background:rgba(255,138,61,.2);color:#ffc29a}
.hero-acts{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}

.sections{columns:360px;column-gap:16px}
.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:16px;align-items:start}
.sgrid>*{min-width:0}
.sgrid .section{margin-bottom:0}
.narrow .sgrid{grid-template-columns:minmax(0,1fr)}
.section{break-inside:avoid;margin-bottom:16px;display:inline-block;width:100%}
.shead{display:flex;align-items:center;gap:10px;padding:13px 16px 4px}
.shead ha-icon{color:var(--hv-dim);--mdc-icon-size:19px}
.shead .st{font-size:15px;font-weight:600}.shead .gc{font-size:12px;color:var(--hv-dim)}.shead .sp{flex:1}
.shead.alert .gc{color:var(--hv-alert)}
.gbtn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:10px;background:var(--hv-surface-2);font-size:12px}
.gbtn ha-icon{--mdc-icon-size:16px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:8px;padding:8px 12px 14px}

/* Kacheln */
.tile{position:relative;display:flex;flex-direction:column;gap:3px;padding:11px 12px 12px;border-radius:16px;background:var(--hv-surface);border:1px solid transparent;cursor:pointer;overflow:hidden;min-height:84px;user-select:none;-webkit-user-select:none;transition:background .25s,border-color .25s,transform .12s}
.tile:active{transform:scale(.98)}
.tile.wide{grid-column:span 2}
.tile.on{background:var(--hv-surface-2)}
.tile.unavail{opacity:.42}
.trow{position:relative;z-index:1;display:flex;align-items:center;gap:8px;margin-bottom:5px}
.tic{width:36px;height:36px;flex:none;border-radius:12px;display:grid;place-items:center;background:var(--hv-surface-2);transition:background .25s,color .25s}
.tname{position:relative;z-index:1;font-size:13px;font-weight:500;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tsub{position:relative;z-index:1;font-size:11px;color:var(--hv-faint)}
.tstate,.tmeta{position:relative;z-index:1;font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmeta{color:var(--hv-text)}
.tbig{margin-left:auto;font-size:20px;font-weight:300;font-variant-numeric:tabular-nums;white-space:nowrap}
.sp{flex:1}
.fill{position:absolute;left:0;top:0;bottom:0;width:0;pointer-events:none;transition:width .45s ease}
.tile.light .fill{background:linear-gradient(90deg,rgba(255,196,87,.24),rgba(255,196,87,.07))}
.tile.light.on{border-color:rgba(255,196,87,.32)}
.tile.light.on .tic{color:var(--lc,var(--hv-warm));background:rgba(255,196,87,.18)}
.tile.switch.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.cover .cfill{background:linear-gradient(90deg,rgba(99,199,255,.16),rgba(99,199,255,.04))}
.tile.cover.on .tic{color:var(--hv-cool);background:rgba(99,199,255,.18)}
.tile.climate.heating .tic{color:var(--hv-heat);background:rgba(255,138,61,.2)}
.tile.climate.heating{border-color:rgba(255,138,61,.3)}
.tile.media.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.alert{border-color:rgba(255,107,91,.42)}
.tile.alert .tic{color:var(--hv-alert);background:rgba(255,107,91,.2)}
.tile.presence.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.scene .tic{color:#c79bff}
.tile.flash{animation:flash .7s}
@keyframes flash{0%{background:rgba(199,155,255,.35)}100%{background:var(--hv-surface)}}
.tile.batt .bar{position:relative;z-index:1;height:5px;border-radius:3px;background:var(--hv-surface-2);overflow:hidden;margin-top:6px}
.tile.batt .bar i{display:block;height:100%;background:var(--hv-ok);border-radius:3px}
.tile.batt.low .bar i{background:var(--hv-warm)}.tile.batt.crit .bar i{background:var(--hv-alert)}
.tile.batt.crit .tic{color:var(--hv-alert)}.tile.batt.low .tic{color:var(--hv-warm)}
.ctrls{position:relative;z-index:1;display:flex;gap:6px;margin-top:8px}
.btn{flex:1;height:34px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;transition:background .15s}
:host(.card) .btn{background:var(--hv-surface-2)}
.btn:hover{background:rgba(255,255,255,.16)}.btn:active{background:rgba(255,255,255,.24)}
.btn.sm{flex:none;width:34px;height:34px}
.btn ha-icon{--mdc-icon-size:18px}
.crow{position:relative;z-index:1;display:flex;align-items:center;gap:6px;margin-top:6px}
.ttarget{min-width:52px;text-align:center;font-size:16px;font-variant-numeric:tabular-nums}
.lockbtn{position:relative;z-index:1;flex:none;margin-top:8px;height:32px;padding:0 12px;font-size:12px}
.slider{position:relative;z-index:2;width:100%;margin:8px 0 0;height:22px;accent-color:var(--hv-warm);cursor:pointer}
.tile.camera{padding:0;min-height:0}
.cam{position:relative;aspect-ratio:16/9;background:#05070c}
.cam img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .3s}
.cam img.ready{opacity:1}
.camname{position:absolute;left:10px;bottom:8px;display:flex;align-items:center;gap:6px;font-size:12px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.55)}
.camname ha-icon{--mdc-icon-size:15px}
.empty{padding:40px 20px;text-align:center;color:var(--hv-dim)}
.empty ha-icon{--mdc-icon-size:42px;display:block;margin:0 auto 10px;color:var(--hv-faint)}

/* Einstellungen */
.set{padding:18px 20px;margin-bottom:16px}
.set h2{margin:0 0 4px;font-size:17px;font-weight:600;display:flex;align-items:center;gap:8px}
.set h2 ha-icon{color:var(--hv-accent)}
.set p.hint{margin:0 0 14px;color:var(--hv-dim);font-size:13px;line-height:1.45}
.srow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hv-line);flex-wrap:wrap}
.srow:first-of-type{border-top:0}
.srow .lbl{flex:1;min-width:160px;font-size:14px}.srow .lbl small{display:block;color:var(--hv-dim);font-size:12px;margin-top:2px}
.srow.sub{padding-left:34px}
.srow.hiddenarea .lbl{opacity:.45;text-decoration:line-through}
.inp{background:rgba(0,0,0,.3);border:1px solid var(--hv-line);border-radius:10px;color:var(--hv-text);padding:9px 11px;font:inherit;font-size:13px;min-width:0}
.inp.w{width:280px;max-width:100%}.inp.s{width:90px}
.sbtn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface-2)}
.sbtn:hover{background:rgba(255,255,255,.18)}.sbtn:disabled{opacity:.28;cursor:default;background:var(--hv-surface)}.sbtn.on{color:var(--hv-accent)}.sbtn.danger:hover{background:rgba(255,107,91,.3)}
.sbtn ha-icon{--mdc-icon-size:18px}
.pins{display:flex;flex-wrap:wrap;gap:6px;width:100%;padding-left:34px}
.pin{display:inline-flex;align-items:center;gap:4px;padding:4px 4px 4px 10px;border-radius:999px;background:var(--hv-surface-2);font-size:12px}
.pin button{width:22px;height:22px;border-radius:50%;display:grid;place-items:center}.pin button:hover{background:rgba(255,107,91,.35)}
.pin ha-icon{--mdc-icon-size:14px}
/* Einstellungen: Reiter und Sortieren */
.stabs{margin:-6px 0 14px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.stabs::-webkit-scrollbar{display:none}
.stab{flex:none;padding:8px 15px;font-size:13.5px;position:relative}
.stab i{display:none;width:7px;height:7px;border-radius:50%;background:var(--hv-warm);margin-left:2px}
.stab.dirty i{display:inline-block}
.drag{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:32px;margin:0 -2px 0 -6px;border-radius:8px;color:var(--hv-faint);cursor:grab;touch-action:none}
.drag:hover,.drag:focus-visible{color:var(--hv-text);background:var(--hv-surface)}
.drag ha-icon{--mdc-icon-size:20px}
.fl-title .drag{width:24px;height:24px;margin:0 -4px 0 -4px}.fl-title .drag ha-icon{--mdc-icon-size:18px}
.sortl{position:relative}
.sortl>.sitem+.sitem>.srow:first-child,.sortl>.srow.sitem+.srow.sitem{border-top:1px solid var(--hv-line)}
.sitem.dragging{position:relative;z-index:5;cursor:grabbing;border-radius:12px;background:rgba(30,40,60,.92);box-shadow:0 10px 30px rgba(0,0,0,.45);transition:none}
.sitem.dragging>.srow{border-top-color:transparent!important}
.pin.sitem{cursor:grab;touch-action:pan-y;user-select:none}
.pin.sitem.dragging{background:rgba(124,196,255,.3)}
.actcard.dragging{background:rgba(30,40,60,.95)}
.sorting .sitem:not(.dragging){transition:transform .12s}
.flb+.flb{margin-top:4px}
.techfound{color:var(--hv-text)!important;background:var(--hv-surface);border-radius:10px;padding:7px 10px}
.techman{gap:10px}.tml{display:flex;flex-direction:column;gap:3px}.tml small{font-size:11px;color:var(--hv-dim)}
.fl-title{margin:14px 0 2px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--hv-dim);display:flex;align-items:center;gap:8px}
.tgl{position:relative;width:44px;height:26px;flex:none}
.tgl input{opacity:0;width:0;height:0}
.tgl span{position:absolute;inset:0;border-radius:13px;background:var(--hv-surface-2);transition:background .2s;cursor:pointer}
.tgl span::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.tgl input:checked+span{background:var(--hv-accent)}.tgl input:checked+span::after{transform:translateX(18px)}
.savebar{position:sticky;bottom:12px;display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 16px;margin-top:8px;z-index:3}
.savebar .msg{flex:1;color:var(--hv-dim);font-size:13px}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:rgba(20,24,34,.95);border:1px solid var(--hv-line);font-size:13px;z-index:20;box-shadow:0 10px 30px rgba(0,0,0,.4)}

/* ====== Kompakt-Modus ====== */
.dense .main{padding:14px 20px 32px}
.dense:not(.narrow) .rail{width:66px;padding-top:10px}
.dense:not(.narrow) .nav{width:50px;padding:11px 0;gap:0}
.dense:not(.narrow) .nav span{display:none}
.dense .logo{margin-bottom:8px}.dense .logo svg{width:34px;height:34px}
.dtop{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.dtop .clockbox{display:flex;flex-direction:column;line-height:1.05;min-width:90px}
.dtop .clock{font-size:30px}.dtop .date{font-size:11.5px;margin-top:3px;white-space:nowrap}
.dtop .chips{margin:0;gap:6px;flex:0 1 auto}
.dtop .chip{padding:3px 11px 3px 3px;font-size:12.5px;gap:6px}.dtop .chip .ic{width:24px;height:24px}.dtop .chip .ic ha-icon{--mdc-icon-size:15px}
.dtop .weather{padding:5px 12px 5px 8px;border-radius:999px;gap:6px}.dtop .weather ha-icon{--mdc-icon-size:22px}.dtop .weather .wt{font-size:16px}
.dtop .person{width:32px;height:32px;font-size:12px}
.roofc{position:relative;height:40px;margin:0 2px -1px;cursor:pointer}
.roofc>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.roofc .shape{fill:rgba(255,255,255,.04);stroke:var(--hv-line);stroke-width:1.2;vector-effect:non-scaling-stroke}
.roofc .energy{bottom:6px;padding:0 10%;gap:6px}
.roofc .sun{position:absolute;left:5%;bottom:6px;color:var(--hv-faint);transition:color .6s}.roofc .sun ha-icon{--mdc-icon-size:20px}
.roofc.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.dense .ep{padding:3px 10px;font-size:11.5px;background:rgba(10,14,22,.7)}
.dense .flabel{width:38px;gap:6px;padding:8px 0}
.dense .fname{font-size:11px;letter-spacing:.12em}
.dense .fl-t{display:none}
.fbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;padding:10px}
.dense .rooms{padding:0;gap:8px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.dense .room{min-height:0;padding:9px 11px 9px;border-radius:14px}
.dense .room-head .ri{--mdc-icon-size:16px}.dense .rname{font-size:13px}
.dense .room-clim{padding-top:4px;gap:8px}.dense .rt{font-size:23px}
.dense .room-foot{margin-top:5px}.dense .room-foot:not(:has(:not([hidden]))){display:none}
.dense .mini.ml:not(.on){padding:4px 6px}
.rchips{display:flex;flex-wrap:wrap;gap:6px}
.rchip{position:relative;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:3px 4px 3px 10px;border-radius:11px;background:var(--hv-surface);border:1px solid var(--hv-line);cursor:pointer;transition:border-color .4s,background .4s}
.rchip:not(:has(.ml)){padding-right:11px}
.rchip .ri{--mdc-icon-size:16px;color:var(--hv-dim)}
.rchip .rname{font-size:12.5px;font-weight:500}
.rchip .rt{font-size:12px;color:var(--hv-dim);font-weight:400;letter-spacing:0}
.rchip .room-alerts{margin-left:0}.rchip .room-alerts:not(:has(:not([hidden]))){display:none}
.rchip .mini{padding:3px 6px;background:transparent;border-color:transparent}.rchip .mini.on{background:rgba(255,196,87,.18);border-color:rgba(255,196,87,.38)}
.rchip.lit{border-color:rgba(255,196,87,.42);background:rgba(255,196,87,.09)}.rchip.lit .ri{color:var(--hv-warm)}
.dense .outdoor{margin-top:12px}.dense .outdoor .floor{border-radius:16px;align-items:center}
.dense .outdoor .flabel{width:auto;padding:0 2px 0 14px;border-right:0}
.dense .outdoor .fname{writing-mode:horizontal-tb;transform:none}
.dense .outdoor .fstat{display:none}
.dense .ground{height:12px}.dense .ground::before{top:4px}
.dense .frame.lower{border-radius:0 0 16px 16px}
.house.tabs .flabel{display:none}
.house.tabs .frame{border-radius:0 0 16px 16px}.house.tabs .frame.out .floor{background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.ftabs{display:flex;gap:6px;overflow-x:auto;margin:8px 0;scrollbar-width:none}
.ftab{padding:6px 14px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:13px;white-space:nowrap;color:var(--hv-dim)}
.ftab.active{background:var(--hv-surface-2);color:var(--hv-text);border-color:rgba(255,255,255,.28)}
.house.tabs .roofc{margin-bottom:0}
.dense .secttitle{margin:18px 2px 8px;font-size:14px}
.rows.favrows{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;padding:10px}

.hero.slim{min-height:0;padding:9px 12px;margin-bottom:10px;border-radius:16px}
.hrow{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hero.slim h1{font-size:22px;gap:8px;white-space:nowrap}.hero.slim h1 ha-icon{--mdc-icon-size:22px}
.hero.slim .hero-clim{margin:0;font-size:13px;gap:8px;align-items:baseline}.hero.slim .hero-clim .ht{font-size:17px}
.hero.slim .crumb{font-size:11px;letter-spacing:.12em;color:var(--hv-faint)}
.hero.slim .hero-badges{margin:0}
.hero.slim .iconbtn{width:34px;height:34px;border-radius:10px}
.hero.slim .pbtn{padding:6px 10px;font-size:12.5px;border-radius:10px}
.schip{display:inline-flex;align-items:center;gap:5px;padding:5px 11px 5px 8px;border-radius:999px;background:rgba(199,155,255,.13);color:#dcc8ff;font-size:12px;border:1px solid rgba(199,155,255,.24)}
.schip ha-icon{--mdc-icon-size:15px}.schip.flash{animation:flash .7s}
.vstrip{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.vchip{display:inline-flex;align-items:center;gap:6px;padding:3px 11px 3px 3px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:12.5px;color:var(--hv-dim)}
.vchip .tic{width:24px;height:24px;border-radius:50%}.vchip .tic ha-icon{--mdc-icon-size:15px}
.vchip .tname{display:inline;font-size:12.5px;font-weight:400;-webkit-line-clamp:unset}
.vchip .tval,.vchip .tstate{position:static;color:var(--hv-text);font-weight:500;font-size:12.5px}
.vchip .tval:empty,.vchip .tstate:empty{display:none}
.vchip.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.vchip.alert{border-color:rgba(255,107,91,.45)}.vchip.alert .tic{color:var(--hv-alert);background:rgba(255,107,91,.2)}
.vchip.unavail{opacity:.45}

.dense .sections{column-gap:12px}.dense .section{margin-bottom:12px;border-radius:16px}
.dense .sgrid{gap:12px}
.dense .shead{padding:9px 12px 2px}.dense .shead .st{font-size:14px}
summary.shead{list-style:none;cursor:pointer;padding-bottom:9px}
summary.shead::-webkit-details-marker{display:none}
details[open]>summary.shead{padding-bottom:2px}
.chev{transition:transform .2s}details[open] .chev{transform:rotate(180deg)}
.rows{display:flex;flex-direction:column;gap:5px;padding:6px 8px 8px}
.tile.row{flex-direction:row;align-items:center;gap:9px;min-height:46px;padding:5px 8px 5px 5px;border-radius:12px;touch-action:pan-y}
.tile.row .tic{width:34px;height:34px;border-radius:10px}
.tn{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column}
.tile.row .tname{font-size:13px;-webkit-line-clamp:1;display:block;white-space:nowrap;text-overflow:ellipsis}
.tile.row .tsub{font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.row .tmeta{font-size:11.5px;color:var(--hv-dim)}
.tile.row .tstate{flex:none;font-size:12px}
.tile.row .tval{position:relative;z-index:1;font-size:15px;font-weight:300;font-variant-numeric:tabular-nums;white-space:nowrap}
.rbtns{position:relative;z-index:1;display:flex;align-items:center;gap:4px;flex:none}
.rbtns .btn{width:30px;height:30px;flex:none;border-radius:9px}
.rbtns .ttarget{min-width:44px;text-align:center;font-size:14px;font-variant-numeric:tabular-nums}
.tile.row .pill{position:relative;z-index:1;width:34px;height:20px;border-radius:10px;background:var(--hv-surface-2);flex:none;transition:background .2s}
.tile.row .pill::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#c9d1de;transition:transform .2s}
.tile.row.on .pill{background:var(--hv-accent)}.tile.row.on .pill::after{transform:translateX(14px);background:#fff}
.tile.row.switch .tstate,.tile.row.scene .tstate{display:none}
.tile.row.batt .bar{flex:0 0 64px;margin:0}
.tile.row .lockbtn{margin:0;height:30px;flex:none}
.tile.row.dragging,.tile.row.dragging .fill{transition:none}
.tile.row.dragging{border-color:rgba(255,196,87,.6)}
.tile.row.light[data-dim]{cursor:ew-resize}
.rlist{padding:4px 2px;columns:300px;column-gap:0}
.rgroup{break-inside:avoid;display:inline-block;width:100%}
.rsub{display:flex;align-items:center;gap:8px;padding:9px 12px 2px;font-size:13px}
.rsub ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}.rsub .st{font-weight:600;cursor:pointer}.rsub .gc{font-size:12px;color:var(--hv-dim)}
.rgroup .rows{display:flex;flex-direction:column;gap:5px;padding:5px 10px 8px}
.only-on .tile.row.light:not(.on){display:none}
.only-on .rgroup:not(:has(.tile.light.on)){display:none}
.only-on .rlist:not(:has(.tile.light.on)){display:none}
.only-on .fhead:has(+ .rlist:not(:has(.tile.light.on))){display:none}
.ktable{padding:2px 0}
.ktable.withspark .khead,.ktable.withspark .krow{grid-template-columns:minmax(150px,230px) 70px 76px minmax(120px,190px) 1fr}
.kspark{position:relative;display:flex;align-items:center;gap:6px;height:34px;min-width:0;cursor:crosshair;touch-action:pan-y}
.kspark svg{flex:1;min-width:60px;height:28px;overflow:visible}
.kspark .spl{fill:none;stroke:#e26a1c;stroke-width:1.8;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.kspark .spset{fill:none;stroke:var(--hv-faint);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.kspark .sprg{flex:none;font-size:11px;color:var(--hv-dim);font-variant-numeric:tabular-nums;min-width:58px}
.kspark.empty .sprg::after{content:"–"}.kspark.none{cursor:default}
.sptip{position:absolute;bottom:calc(100% + 2px);transform:translateX(-50%);display:none;padding:3px 8px;border-radius:8px;background:rgba(10,14,23,.94);border:1px solid var(--hv-line);font-size:11.5px;white-space:nowrap;pointer-events:none;z-index:3;font-variant-numeric:tabular-nums}
.sptip.on{display:block}
.room .kspark{margin:2px 0 4px;position:relative;z-index:1}
.narrow .krow .kna{display:none}
.ctrend{padding:12px 16px 10px;margin-bottom:16px}
.dense .ctrend{padding:9px 12px 8px;margin-bottom:12px;border-radius:16px}
.ctl{display:inline-flex;align-items:baseline;gap:6px;font-size:13px;color:var(--hv-dim)}
.ctl i{width:14px;height:3px;border-radius:2px;align-self:center}.ctl.in i{background:#e26a1c}.ctl.out i{background:#2a9ad8}
.ctl b{color:var(--hv-text);font-weight:500;font-size:15px;font-variant-numeric:tabular-nums}
.ctstats{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 10px}
.cts{display:flex;flex-direction:column;min-width:0}.cts small{font-size:11px;color:var(--hv-dim)}
.cts b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}.cts em{font-style:normal;font-size:11.5px;color:var(--hv-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctc{height:140px;margin:0 40px 18px 34px}.dense .ctc{height:110px}
.ctp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.ctp.in{stroke:#e26a1c}.ctp.out{stroke:#2a9ad8}
.ctgrid line{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.cty span{position:absolute;right:calc(100% + 6px);white-space:nowrap;transform:translateY(-50%);font-size:10.5px;color:var(--hv-faint);font-variant-numeric:tabular-nums}
.ctend{position:absolute;left:calc(100% + 6px);transform:translateY(-50%);font-size:11px;color:var(--hv-text);font-variant-numeric:tabular-nums;white-space:nowrap}
.trcur i.cin{background:#e26a1c}.trcur i.cout{background:#2a9ad8}
.trtip .tk{display:inline-flex;align-items:center;gap:5px;color:var(--hv-dim)}.trtip .tk i{width:8px;height:8px;border-radius:50%}.trtip .tk.in i{background:#e26a1c}.trtip .tk.out i{background:#2a9ad8}
.trtip .tk b{color:var(--hv-text);font-weight:500}
.ctrend.nodata .ctc{height:48px}.ctrend.nodata .cty,.ctrend.nodata .trx,.ctrend.nodata .ctend{display:none}
.narrow .ktable.withspark .krow{grid-template-columns:1fr auto auto}.narrow .krow .kspark{grid-column:1/-1;order:5}
.narrow .ctc{margin:0 34px 18px 30px}
.khead,.krow{display:grid;grid-template-columns:minmax(150px,230px) 70px 76px 1fr;align-items:center;gap:10px;padding:6px 14px}
.khead{font-size:10.5px;color:var(--hv-faint);letter-spacing:.1em;text-transform:uppercase;padding-top:10px;padding-bottom:2px}
.krow+.krow{border-top:1px solid var(--hv-line)}
.kname{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;cursor:pointer}.kname ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.krow .rt{font-size:18px;font-weight:300}.krow .rh{font-size:13px;color:var(--hv-dim)}
.kna{color:var(--hv-faint)}
.tile.row.kcell{background:none;border:0;min-height:0;padding:0}
.tile.row.kcell .tstate{min-width:56px}
.secsum{display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:12px;border-color:rgba(79,209,139,.3)}
.secsum .ssic{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(79,209,139,.18);color:var(--hv-ok)}
.secsum .ssic ha-icon{--mdc-icon-size:26px}
.secsum .sst{font-size:18px;font-weight:500}.secsum .ssd{font-size:12.5px;color:var(--hv-dim);margin-top:2px}
.secsum.bad{border-color:rgba(255,107,91,.45)}.secsum.bad .ssic{background:rgba(255,107,91,.2);color:var(--hv-alert)}
.dense .ptitle{margin-bottom:10px}.dense .ptitle h1{font-size:24px}
.dense .fhead{margin:16px 2px 8px}
.narrow .khead{display:none}.narrow .krow{grid-template-columns:1fr auto auto}.narrow .krow .kcell,.narrow .krow .kna{grid-column:1/-1}
.narrow.dense .dtop .chips{order:5;width:100%}
.narrow .hero.slim h1{font-size:19px}
.narrow .hero.slim .pn,.narrow .hero.slim .sp{display:none}\n.narrow .hrow{gap:6px}.narrow .schip{padding:5px 9px 5px 7px}.narrow .hero.slim .pbtn{padding:6px 8px}
.narrow .roofc{height:auto;padding-top:16px}
.narrow .roofc .energy{position:relative;bottom:auto;padding:0 4% 6px}
.narrow .roofc .sun{bottom:auto;top:2px}

/* ====== Übersicht-Varianten ====== */
.cfhead{display:flex;align-items:center;gap:10px;padding:10px 14px 0}
.cfn{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.cfhead .fstat{flex-direction:row;gap:12px;font-size:12px;color:var(--hv-dim)}
.cfhead .fl-lw{flex-direction:row;gap:3px}
.dense .cfhead .fl-t{display:inline}
.cockpit{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.cmain{display:flex;flex-direction:column;gap:12px;min-width:0}
.cfloor{border-radius:16px}
.cfloor .fbody{padding:10px 12px 12px}
.cfloor.out,.fcol.out{border-color:rgba(110,200,120,.22);background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.cside{display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
.cside .secsum{margin:0;border-radius:16px;padding:12px 14px}
.cside .secsum .ssic{width:38px;height:38px;border-radius:12px}.cside .secsum .sst{font-size:16px}
.qhead{display:flex;align-items:center;gap:8px;padding:11px 14px 4px;font-size:13px;font-weight:600}
.qhead ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}
.ecard,.qcard{border-radius:16px;padding-bottom:8px}
.ecard{cursor:pointer}
.ecard .sun{color:var(--hv-faint);transition:color .6s}.ecard.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.ecard .sun ha-icon{--mdc-icon-size:18px;color:inherit}
.erow{display:flex;align-items:center;gap:10px;padding:6px 14px;font-size:13px;color:var(--hv-dim)}
.erow b{margin-left:auto;font-size:17px;font-weight:400;color:var(--hv-text);font-variant-numeric:tabular-nums}
.erow ha-icon{--mdc-icon-size:18px}.erow.ep-pv ha-icon{color:var(--hv-warm)}.erow.ep-battery ha-icon{color:var(--hv-ok)}.erow.ep-power ha-icon{color:var(--hv-cool)}
.qbtns{display:flex;flex-direction:column;gap:6px;padding:6px 10px}
.qbtn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:var(--hv-surface);font-size:13px;text-align:left}
.qbtn:hover{background:var(--hv-surface-2)}.qbtn ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.qscenes{display:flex;flex-wrap:wrap;gap:6px;padding:4px 10px 4px}
.cside .rows{padding:4px 8px}
.ebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 10px;border-radius:14px;margin-bottom:12px}
.ebar-e{display:flex;align-items:center;gap:6px;flex-wrap:wrap;cursor:pointer}
.ebar .sun{color:var(--hv-faint);display:flex;transition:color .6s}.ebar .sun ha-icon{--mdc-icon-size:20px}
.ebar-e.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.pbtn.sm{padding:5px 10px;font-size:12px;border-radius:999px}.pbtn.sm ha-icon{--mdc-icon-size:16px}
.fcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start}
.fcol{border-radius:16px;padding-bottom:6px}
.rrows{display:flex;flex-direction:column;padding:6px 6px 2px}
.rrow{position:relative;display:flex;align-items:center;gap:8px;min-height:42px;padding:4px 6px 4px 8px;border-radius:10px;cursor:pointer;border-left:3px solid transparent;transition:background .3s,border-color .4s}
.rrow:hover{background:var(--hv-surface)}
.rrow+.rrow{margin-top:2px}
.rrow .tdot{width:8px;height:8px;border-radius:50%;flex:none}
.rrow .ri{--mdc-icon-size:17px;color:var(--hv-dim)}
.rrow .rname{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.rrow .rt{font-size:16px;font-weight:300;letter-spacing:0}.rrow .rh{font-size:11.5px;color:var(--hv-dim);min-width:30px}
.rrow .room-alerts{margin-left:2px}
.rrow .mini{padding:3px 7px;background:transparent;border-color:transparent}
.rrow .mini.on{background:rgba(255,196,87,.18);border-color:rgba(255,196,87,.38)}
.rrow .mlph{width:30px}
.rrow.lit{border-left-color:var(--hv-warm);background:rgba(255,196,87,.07)}.rrow.lit .ri{color:var(--hv-warm)}
.factive{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.factive .room{min-height:120px}
.ract{position:relative;font-size:12px;color:var(--hv-dim);margin-top:4px;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.room.lit .ract{color:#ffe2a8}
.secttitle .gc{font-size:12px;font-weight:400;color:var(--hv-dim)}
.calm{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:16px}
.calm ha-icon{--mdc-icon-size:30px;color:var(--hv-cool)}.calm b{display:block;font-size:17px;font-weight:500}.calm small{color:var(--hv-dim);font-size:13px}
.fcalm{border-radius:16px;padding:6px 12px}
.crow2{display:flex;align-items:center;gap:12px;padding:6px 0}
.crow2+.crow2{border-top:1px solid var(--hv-line)}
.cfl{width:44px;flex:none;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);font-weight:600}
.narrow .cockpit{grid-template-columns:1fr}.narrow .cside{order:-1;position:static}
.narrow .crow2{flex-direction:column;align-items:flex-start;gap:6px}

/* ====== Warnungen ====== */
.acard{border-radius:16px;overflow:hidden;margin-bottom:12px}
.cside .acard{margin-bottom:0}
.acard.slim.ok{display:none}
.acard.fokus.ok .ahead{padding:8px 12px;gap:10px}.acard.fokus.ok .ssic{width:30px;height:30px;border-radius:10px}.acard.fokus.ok .ssic ha-icon{--mdc-icon-size:18px}
.acard.fokus.ok .sst{font-size:14px}.acard.fokus.ok .ssd{display:none}
.room.rwarn{border-color:rgba(255,160,70,.6);box-shadow:0 0 0 1px rgba(255,160,70,.25) inset}
.room.ralarm{border-color:rgba(255,107,91,.75);box-shadow:0 0 0 1px rgba(255,107,91,.35) inset,0 10px 30px -14px rgba(255,107,91,.6)}
.room.rwarn .ract{color:#ffc08a}.room.ralarm .ract{color:#ffb0a6}
.ahead{display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;text-align:left}
.ahead[data-act="noop"]{cursor:default}
.ah{display:flex;flex-direction:column;min-width:0}
.acard .ssic{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center}
.acard .ssic ha-icon{--mdc-icon-size:24px}
.acard .sst{font-size:16px;font-weight:500}.acard .ssd{font-size:12.5px;color:var(--hv-dim);margin-top:2px}.acard .ssd:empty{display:none}
.acard.ok{border-color:rgba(79,209,139,.3)}.acard.ok .ssic{background:rgba(79,209,139,.18);color:var(--hv-ok)}
.acard.info{border-color:rgba(99,199,255,.35)}.acard.info .ssic{background:rgba(99,199,255,.18);color:var(--hv-cool)}
.acard.warn{border-color:rgba(255,160,70,.45)}.acard.warn .ssic{background:rgba(255,160,70,.2);color:#ffa046}
.acard.alarm{border-color:rgba(255,107,91,.6)}.acard.alarm .ssic{background:rgba(255,107,91,.25);color:var(--hv-alert);animation:apulse 1.6s infinite}
@keyframes apulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,91,.5)}50%{box-shadow:0 0 0 6px rgba(255,107,91,0)}}
.alist{display:flex;flex-direction:column;gap:4px;padding:0 10px 10px}.alist:empty{display:none}
.acard.slim .alist,.acard.wide .alist{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.aitem{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;padding:7px 10px;border-radius:10px;background:var(--hv-surface);text-align:left;border-left:3px solid transparent}
.aitem ha-icon{grid-row:1/3;--mdc-icon-size:18px}
.aitem .at{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aitem .ad{font-size:11.5px;color:var(--hv-dim)}.aitem .ad:empty{display:none}
.aitem.alarm{border-left-color:var(--hv-alert)}.aitem.alarm ha-icon{color:var(--hv-alert)}
.aitem.warn{border-left-color:#ffa046}.aitem.warn ha-icon{color:#ffa046}
.aitem.acked{opacity:.72;border-left-style:dashed}
.acard.acked .ssic{animation:none}
.amute{display:flex;align-items:center;gap:6px;justify-content:flex-start}.amute ha-icon{--mdc-icon-size:15px}
.aitem.info{border-left-color:var(--hv-cool)}.aitem.info ha-icon{color:var(--hv-cool)}
.amore{font-size:12px;color:var(--hv-dim);padding:2px 10px}
.kchip.warmalert{color:#ffc08a;border-color:rgba(255,160,70,.45);background:rgba(255,160,70,.12)}.kchip.warmalert ha-icon{color:#ffa046}
.chip.warmalert .ic{background:rgba(255,160,70,.2);color:#ffa046}.chip.warmalert{border-color:rgba(255,160,70,.4)}
.kpi.warmalert .kic{background:rgba(255,160,70,.2);color:#ffa046}.kpi.warmalert .kv{color:#ffc08a}
.emb{display:inline-flex;align-items:center;gap:8px;flex:none;cursor:pointer;font-size:12px;color:var(--hv-dim);margin:0 6px}
.emb .tgl span{pointer-events:none}
.rule{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--hv-line)}
.rule .rl{font-size:12px;color:var(--hv-dim)}
.set .pbtn.sm{padding:5px 10px;font-size:12px}

/* ====== Klingel-Overlay ====== */
.bellbg{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,6,12,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:mfade .2s ease}
.bell{width:min(980px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:rgba(14,19,30,.95);border-color:rgba(255,196,87,.45);box-shadow:0 24px 80px rgba(0,0,0,.6);animation:mpop .22s ease}
.bell.again{animation:bshake .5s}
@keyframes bshake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.bhead{display:flex;align-items:center;gap:12px;padding:12px 14px}
.bic{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,196,87,.2);color:var(--hv-warm);animation:bring 1.2s ease-in-out infinite}
.bic ha-icon{--mdc-icon-size:26px}
@keyframes bring{0%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
.bt{font-size:19px;font-weight:500}.bs{font-size:12.5px;color:var(--hv-dim)}
.bcount{font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums;margin-right:4px}
.bcam{position:relative;aspect-ratio:16/9;background:#05070c;min-height:0}
.bimg{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .3s}.bimg.ready{opacity:1}
.blive{position:absolute;inset:0;display:none}.bell.islive .blive{display:block}.bell.islive .bimg{visibility:hidden}
.blive ha-camera-stream{display:block;width:100%;height:100%}
.bnone{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--hv-dim);font-size:13px}.bnone ha-icon{--mdc-icon-size:40px}
.bacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px}
.bacts .pbtn{padding:10px 14px}
.bunlock[data-armed="1"]{background:rgba(255,107,91,.25);border-color:rgba(255,107,91,.6);color:#ffb0a6}
.narrow .bellbg{padding:8px}.narrow .bt{font-size:17px}

/* ====== Abfrage-Dialog ====== */
.mbg{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,6,12,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:mfade .15s ease}
.modal{width:min(380px,100%);padding:22px 22px 18px;border-radius:20px;text-align:center;background:rgba(18,24,38,.94);box-shadow:0 20px 60px rgba(0,0,0,.5);animation:mpop .18s ease}
.mic{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-warm)}
.mic ha-icon{--mdc-icon-size:28px}
.mt{font-size:18px;font-weight:500;line-height:1.3}.mx{margin-top:6px;font-size:13.5px;color:var(--hv-dim)}
.mb{display:flex;gap:10px;margin-top:18px}.mb .pbtn{flex:1;justify-content:center;padding:11px 14px;font-size:14px}
@keyframes mfade{from{opacity:0}}@keyframes mpop{from{opacity:0;transform:scale(.95)}}
.tchips{display:flex;flex-wrap:wrap;gap:6px}
.tchip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 9px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:12.5px;cursor:pointer}
.tchip input{display:none}.tchip ha-icon{--mdc-icon-size:16px;color:var(--hv-dim)}
.tchip.on{background:rgba(90,160,255,.18);border-color:rgba(90,160,255,.5)}.tchip.on ha-icon{color:var(--hv-accent)}

/* ====== Kopfzeilen-Varianten ====== */
.dtop{flex-wrap:wrap}
.app:not(.narrow) .dtop,.app:not(.narrow) .hbar{flex-wrap:nowrap}
.app:not(.narrow) .dtop .chips{flex-wrap:wrap}
.dtop .chips{flex:1 1 auto;min-width:0}
.hright{display:flex;align-items:center;gap:10px;margin-left:auto;flex:none}
.persons.stack{gap:0}
.persons.stack .person{margin-left:-9px;box-shadow:0 0 0 2px rgba(8,12,20,.9)}
.persons.stack .person:first-child{margin-left:0}
.hk .kchips{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
.kchip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px 0 10px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;flex:none;transition:transform .15s}
.kchip:active{transform:scale(.96)}
.kchip ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.kchip.iconly{padding:0 9px}
.kchip.warm,.kchip.warm ha-icon{color:var(--hv-warm)}
.kchip.alert{color:#ffb0a6;border-color:rgba(255,107,91,.45);background:rgba(255,107,91,.12)}.kchip.alert ha-icon{color:var(--hv-alert)}
.kchip.ok ha-icon{color:var(--hv-ok)}.kchip.heat ha-icon{color:var(--hv-heat)}.kchip.heat{color:#ffc29a}
.kchip.dim{color:var(--hv-dim)}
.hs .hsatz{flex:1 1 260px;min-width:0}
.hs .greet{font-size:12px;color:var(--hv-dim)}
.htext{font-size:15px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hs .alerts{flex:none;margin:0}
.hbar{display:flex;align-items:stretch;flex-wrap:wrap;padding:6px 8px;border-radius:16px;margin-bottom:12px}
.hbar .clockbox{display:flex;flex-direction:column;justify-content:center;line-height:1.05;padding:2px 16px 2px 8px;border-right:1px solid var(--hv-line)}
.hbar .clock{font-size:28px}.hbar .date{font-size:11.5px;margin-top:3px;color:var(--hv-dim);white-space:nowrap}
.kpis{display:flex;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
.kpi{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;column-gap:9px;align-items:center;padding:4px 16px;border-right:1px solid var(--hv-line);text-align:left;flex:none;border-radius:0}
.kpi:hover{background:rgba(255,255,255,.04)}
.kic{grid-row:1/3;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface-2)}
.kic ha-icon{--mdc-icon-size:18px}
.kv{font-size:19px;line-height:1.1;font-variant-numeric:tabular-nums}.kl{font-size:11px;color:var(--hv-dim);white-space:nowrap}
.kpi.warm .kic{background:rgba(255,196,87,.2);color:var(--hv-warm)}.kpi.alert .kic{background:rgba(255,107,91,.2);color:var(--hv-alert)}.kpi.alert .kv{color:#ffb0a6}
.kpi.ok .kic{background:rgba(79,209,139,.18);color:var(--hv-ok)}.kpi.heat .kic{background:rgba(255,138,61,.2);color:var(--hv-heat)}.kpi.dim .kv{color:var(--hv-dim)}
.hbar .hright{padding-left:12px}
.hbar .weather{padding:5px 12px 5px 8px;border-radius:999px;gap:6px}.hbar .weather ha-icon{--mdc-icon-size:22px}.hbar .weather .wt{font-size:16px}
.hbar .person{width:32px;height:32px;font-size:12px}
.narrow .dtop .chips,.narrow .hk .kchips,.narrow .hs .alerts{order:5;width:100%;flex-basis:100%}
.narrow .hk .kchips{flex-wrap:wrap;overflow:visible}
.narrow .hs .hsatz{order:4;flex-basis:100%}.narrow .hs .htext{white-space:normal}
.narrow .hbar .kpis{order:5;flex-basis:100%;border-top:1px solid var(--hv-line);margin-top:6px;padding-top:4px}
.narrow .hbar .kpis{-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}
.narrow .hbar .clockbox{border-right:0}
.narrow .kpi{padding:4px 12px}

/* ====== Eingebettete Panels ====== */
.main.ext{padding:0}
.main.ext .wrap{height:100%}
.lmode{width:auto;min-width:150px}
.extwrap.themed{${hvThemeCss(false)}}
.app.blur .extwrap.themed{--ha-card-backdrop-filter:${HV_BLUR}}
.extwrap.themed>:not(.extload):not(.empty):not(iframe){background:transparent!important;--primary-background-color:transparent}
.extwrap{position:relative;height:100%;min-height:100%;contain:layout;isolation:isolate;overflow-x:hidden}
.extwrap>:not(.extload):not(.empty){display:block;height:100%;min-height:100%}
.extframe{width:100%;border:0;background:transparent}
.extload{display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:var(--hv-dim)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

/* WebKit (iPhone/iPad): Schrift nicht automatisch vergrößern, Texte kürzen statt Symbole zu verschieben */
:host{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.room-head .rname{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.room-head .ri,.room-alerts,.al,.mini,.rchip .ri,.rchip .mini{flex:none}
.room-clim{min-width:0;flex-wrap:nowrap;white-space:nowrap}
.room-foot{flex-wrap:wrap}
.rchip .rname{white-space:nowrap}

/* Schmal (Handy, kleines Tablet) */
.narrow.app{flex-direction:column}
.narrow .rail{height:auto !important;position:fixed;z-index:10;left:var(--hv-rail-left,0px);width:var(--hv-rail-width,100%);bottom:0;height:auto;flex-direction:row;padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-right:0;border-top:1px solid var(--hv-line);overflow-x:auto;overflow-y:hidden;justify-content:flex-start;background:rgba(8,12,20,.86);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}
.app.narrow .main{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
.narrow .toast{bottom:calc(86px + env(safe-area-inset-bottom))}
.narrow .savebar{bottom:calc(76px + env(safe-area-inset-bottom))}
.narrow .rail .logo,.narrow .rail hr,.narrow .rail .grow{display:none}
.narrow .nav{width:auto;min-width:64px;padding:7px 8px 5px;flex:none}
.narrow .main{padding:14px 12px 28px}
.narrow .menu{display:flex}
.narrow .clock{font-size:36px}
.narrow .rooms{grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:9px;padding:10px}
.narrow .flabel{width:34px}.narrow .fstat{display:none}
.narrow .roof{height:120px}.narrow .energy{padding:0 4%}
.narrow .hero h1{font-size:30px}
.narrow .sections{columns:1}
.narrow .tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
/* ---------- Hausmodus ---------- */
.hmode{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 9px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:12.5px;white-space:nowrap;flex:none}
.hmode ha-icon{--mdc-icon-size:17px}
.hmode[data-mode=nacht]{background:rgba(154,134,255,.16);border-color:rgba(154,134,255,.35)}.hmode[data-mode=nacht] ha-icon{color:#b8a8ff}
.hmode[data-mode=abwesend]{background:rgba(255,160,70,.14);border-color:rgba(255,160,70,.35)}.hmode[data-mode=abwesend] ha-icon{color:#ffa046}
.hmode[data-mode=urlaub]{background:rgba(99,199,255,.14);border-color:rgba(99,199,255,.35)}.hmode[data-mode=urlaub] ha-icon{color:var(--hv-cool)}
.hmode[data-mode=zuhause] ha-icon{color:var(--hv-ok)}
.narrow .hmode .hml{display:none}.narrow .hmode{padding:0;width:34px;justify-content:center}
.hmnow{font-weight:500;font-size:13px}
.hmseg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.hmb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 2px 7px;border-radius:12px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:11.5px;color:var(--hv-dim);min-width:0}
.hmb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hmb ha-icon{--mdc-icon-size:20px}
.hmb.on{color:var(--hv-text);border-color:rgba(124,196,255,.5);background:rgba(124,196,255,.14)}
.hmcard.m-nacht .hmb.on{background:rgba(154,134,255,.18);border-color:rgba(154,134,255,.5)}.hmcard.m-nacht .hmb.on ha-icon{color:#b8a8ff}
.hmcard.m-abwesend .hmb.on{background:rgba(255,160,70,.16);border-color:rgba(255,160,70,.5)}.hmcard.m-abwesend .hmb.on ha-icon{color:#ffa046}
.hmcard.m-urlaub .hmb.on{background:rgba(99,199,255,.16);border-color:rgba(99,199,255,.5)}.hmcard.m-urlaub .hmb.on ha-icon{color:var(--hv-cool)}
.hmcard.m-zuhause .hmb.on ha-icon{color:var(--hv-ok)}
.hminfo{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--hv-text);margin-top:8px}
.hminfo ha-icon{--mdc-icon-size:15px;color:var(--hv-dim);flex:none}.hminfo.dim{color:var(--hv-dim)}.hminfo.warn{color:#ffc890}
.mchips{display:inline-flex;gap:3px;flex:none}
.mchip{width:28px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--hv-surface);border:1px solid var(--hv-line);color:var(--hv-faint)}
.mchip ha-icon{--mdc-icon-size:15px}.mchip.on{color:var(--hv-text);background:rgba(124,196,255,.16);border-color:rgba(124,196,255,.4)}
/* ---------- Aktionen ---------- */
.actcard{border:1px solid var(--hv-line);border-radius:14px;padding:8px 10px;margin:8px 0;background:var(--hv-surface)}
.actcard.off{opacity:.55}
.actrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.actrow.sub{margin-top:6px;padding-top:6px;border-top:1px dashed var(--hv-line)}
.actrow .inp.xs{width:64px}.actrow select.wide{max-width:230px}
.actg{display:inline-flex;align-items:center;gap:6px}.actg small{color:var(--hv-dim);font-size:11.5px}
.lvchips{display:inline-flex;gap:6px;flex-wrap:wrap}
.alsu em.esc{color:#ffb3a8}
.alstat.esc{color:#ffb3a8}.alstat.esc ha-icon{color:var(--hv-alert)}
.lgrow.eskaliert ha-icon{color:var(--hv-alert)}.lgrow.aktion ha-icon{color:#c79bff}
.alstatrow .t small{display:block;color:var(--hv-dim);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alstatrow.sus .n{color:#ffa046}
/* ---------- Alarmmanager ---------- */
.nav{position:relative}
.nbadge{position:absolute;top:4px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#ffa046;color:#1a1206;font:600 10px/16px var(--hv-font, inherit);font-style:normal;text-align:center;display:none}
.nbadge.on{display:block}.nbadge.alarm{background:var(--hv-alert);color:#fff;animation:apulse 1.6s infinite}
.altabs{display:flex;gap:6px;flex-wrap:wrap}
.altab{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);color:var(--hv-dim);font-size:13px}
.altab ha-icon{--mdc-icon-size:16px}.altab.sm{padding:5px 11px;font-size:12px}
.altab.on{background:rgba(124,196,255,.16);border-color:rgba(124,196,255,.4);color:var(--hv-text)}
.algrid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.85fr);gap:14px;align-items:start}
.algrid.proto{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.alside{display:flex;flex-direction:column;gap:14px;min-width:0}
.alcol{border-radius:16px;padding:10px 12px 12px;min-width:0}
.alh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;padding:2px 2px 8px}
.alh ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}.alh .cnt{color:var(--hv-dim);font-weight:400}
.alh.sub{margin-top:10px;padding-top:10px;border-top:1px solid var(--hv-line);font-size:13px}
.alrow{position:relative;overflow:hidden;border-radius:12px;margin-bottom:6px;cursor:pointer;touch-action:pan-y}
.alin{position:relative;z-index:1;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:var(--hv-surface);border:1px solid var(--hv-line);border-left:3px solid transparent;transform:translateX(var(--sx,0));transition:transform .2s}
.alrow.swiping .alin{transition:none}
.alrow.alarm .alin{border-left-color:var(--hv-alert);background:rgba(255,107,91,.1)}
.alrow.warn .alin{border-left-color:#ffa046}
.alrow.info .alin{border-left-color:var(--hv-cool)}
.alrow.sel .alin{border-color:rgba(124,196,255,.55);box-shadow:0 0 0 1px rgba(124,196,255,.35) inset}
.alrow.st-quittiert .alin{border-left-style:dashed;opacity:.85}
.alrow.st-stumm .alin{opacity:.6;border-left-color:var(--hv-line)}
.alic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--hv-surface-2)}
.alic ha-icon{--mdc-icon-size:19px}
.alrow.alarm .alic{background:rgba(255,107,91,.22);color:var(--hv-alert)}.alrow.alarm.st-neu .alic{animation:apulse 1.6s infinite}
.alrow.warn .alic{background:rgba(255,160,70,.18);color:#ffa046}.alrow.info .alic{background:rgba(99,199,255,.16);color:var(--hv-cool)}
.altx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.alti{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alsu{font-size:11.5px;color:var(--hv-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alsu em{font-style:normal;color:var(--hv-text)}
.alq{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--hv-surface-2);border:1px solid var(--hv-line)}
.alq ha-icon{--mdc-icon-size:18px}.alq:hover{background:rgba(79,209,139,.2);color:var(--hv-ok)}
.alsw{position:absolute;top:0;bottom:0;display:flex;align-items:center;gap:6px;padding:0 16px;font-size:12.5px;font-weight:500;opacity:0;transition:opacity .15s}
.alsw ha-icon{--mdc-icon-size:18px}
.alsw.ack{left:0;right:50%;background:rgba(79,209,139,.25);color:var(--hv-ok);border-radius:12px 0 0 12px}
.alsw.mute{right:0;left:50%;justify-content:flex-end;background:rgba(160,170,190,.22);color:var(--hv-text);border-radius:0 12px 12px 0}
.alsw{visibility:hidden}.alrow.swiping .alsw{visibility:visible;opacity:.6}.alrow.go-ack .alsw.ack,.alrow.go-mute .alsw.mute{opacity:1}
.alok{display:flex;flex-direction:column;align-items:center;gap:4px;padding:26px 10px;color:var(--hv-dim);font-size:12.5px}
.alok ha-icon{--mdc-icon-size:38px;color:var(--hv-ok);margin-bottom:4px}.alok b{color:var(--hv-text);font-size:15px;font-weight:500}
.alhint{font-size:11.5px;color:var(--hv-faint);padding:6px 4px 0}
.alnone{font-size:12.5px;color:var(--hv-dim);padding:10px 4px}
.aldetail{position:relative;display:flex;flex-direction:column;gap:12px;padding:14px}
.aldetail.alarm{border-color:rgba(255,107,91,.45)}.aldetail.warn{border-color:rgba(255,160,70,.35)}
.alempty{align-items:center;justify-content:center;min-height:200px;color:var(--hv-dim);font-size:13px}.alempty ha-icon{--mdc-icon-size:30px}
.alclose{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface)}
.aldh{display:flex;gap:12px;align-items:center;padding-right:30px}
.aldh .ssic{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2)}
.aldh .ssic ha-icon{--mdc-icon-size:26px}
.aldetail.alarm .ssic{background:rgba(255,107,91,.22);color:var(--hv-alert)}.aldetail.warn .ssic{background:rgba(255,160,70,.18);color:#ffa046}.aldetail.info .ssic{background:rgba(99,199,255,.16);color:var(--hv-cool)}
.aldt{min-width:0}.alt{font-size:16px;font-weight:500;line-height:1.3}
.ald{font-size:12px;color:var(--hv-dim);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lvl{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--hv-surface-2)}
.lvl.alarm{background:rgba(255,107,91,.22);color:#ffb3a8}.lvl.warn{background:rgba(255,160,70,.2);color:#ffc890}.lvl.info{background:rgba(99,199,255,.18);color:#a8dcff}
.alinfo{display:flex;flex-direction:column;gap:6px;font-size:13px}
.alinfo>div{display:flex;gap:8px;align-items:flex-start}.alinfo ha-icon{--mdc-icon-size:17px;color:var(--hv-dim);flex:none}
.alstat.st-neu{color:#ffc890}.alstat.st-neu ha-icon{color:#ffa046}.alstat.st-quittiert ha-icon{color:var(--hv-ok)}
.albtns{display:flex;flex-wrap:wrap;gap:6px}.albtns .pbtn{padding:8px 12px;font-size:12.5px}
.albtns.sec:empty{display:none}
.alsub{font-size:12px;color:var(--hv-dim);border-top:1px solid var(--hv-line);padding-top:10px}
.lglist{display:flex;flex-direction:column}
.lgrow{display:flex;align-items:flex-start;gap:8px;padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px}
.lgrow:last-child{border-bottom:0}
.lgrow .lgt{flex:none;width:40px;color:var(--hv-dim);font-variant-numeric:tabular-nums}
.lgrow ha-icon{--mdc-icon-size:15px;flex:none;margin-top:1px;color:var(--hv-dim)}
.lgrow.neu.alarm ha-icon{color:var(--hv-alert)}.lgrow.neu.warn ha-icon{color:#ffa046}.lgrow.neu.info ha-icon{color:var(--hv-cool)}
.lgrow.behoben ha-icon,.lgrow.quittiert ha-icon{color:var(--hv-ok)}
.lgx{display:flex;flex-direction:column;min-width:0}.lgx b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lgx span{color:var(--hv-dim)}
.lgday{font-size:11.5px;font-weight:500;color:var(--hv-dim);text-transform:none;padding:10px 2px 4px}
.lgday:first-child{padding-top:0}
.alkpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.alkpi .k{display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:12px;background:var(--hv-surface)}
.alkpi b{font-size:20px;font-weight:400}.alkpi span{font-size:11px;color:var(--hv-dim)}
.alkpi .alarm.n b{color:var(--hv-alert)}.alkpi .warn.n b{color:#ffa046}.alkpi .info.n b{color:var(--hv-cool)}
.alarmo{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:12px;background:var(--hv-surface);text-align:left;margin-bottom:6px}
.alarmo ha-icon{--mdc-icon-size:20px}.alarmo .an{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alarmo .as{font-size:12px;color:var(--hv-dim)}
.alarmo.st-disarmed ha-icon{color:var(--hv-dim)}.alarmo.st-triggered{background:rgba(255,107,91,.2)}.alarmo.st-triggered ha-icon{color:var(--hv-alert)}
.alarmo[class*="st-armed"] ha-icon{color:var(--hv-ok)}
.alfilter{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:-4px 0 12px}
.alstatrow{display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px}
.alstatrow .n{flex:none;width:34px;font-variant-numeric:tabular-nums;color:var(--hv-dim)}
.alstatrow .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alstatrow .fa{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,160,70,.2);color:#ffc890}
.alstatrow.alarm .n{color:var(--hv-alert)}
@media (max-width:1180px){.algrid{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}.alside{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}}
.narrow .algrid,.narrow .algrid.proto{grid-template-columns:minmax(0,1fr)}
.narrow .alside{display:flex}
.narrow .ptitle .altab span{display:inline}
/* Handy: Karten nie breiter als der Bildschirm; lange Zustände zweizeilig statt den Namen zu verdrängen */
.narrow .section,.narrow .rows,.narrow .tile.row{min-width:0;max-width:100%}
.narrow .tile.row .tstate{max-width:46%;white-space:normal;text-align:right;line-height:1.25;overflow-wrap:anywhere}
.narrow .tile.row .tn{flex:1 1 0}
.narrow .tile.row.lock .tstate{display:none}
.narrow .ground{margin:0 -8px}
/* Handy: Navigation passt immer in die Breite; bei vielen Einträgen nur Symbole, Beschriftung am aktiven Eintrag */
.narrow .rail{justify-content:space-between;gap:2px}
.narrow .nav{flex:1 1 0;min-width:52px;max-width:104px;padding:7px 2px 5px}
.narrow .nav span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}
.narrow .rail.many .nav{min-width:0;padding:9px 0 7px}
.narrow .rail.many .nav span{display:none}
.narrow .rail.many .nav.active{flex-grow:2.2}
.narrow .rail.many .nav.active span{display:block}
/* Handy: Personen nebeneinander statt überlappend */
.narrow .persons.stack{gap:4px}.narrow .persons.stack .person{margin-left:0;box-shadow:none}
/* Handy: Energieleiste als festes Raster – nichts rutscht beim Umbrechen nach rechts */
.narrow .ebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}
.narrow .ebar>.sp,.narrow .ebar .sun{display:none}
.narrow .ebar-e{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.narrow .ebar .ep{min-width:0;overflow:hidden;padding:6px 10px}
.narrow .ebar .ep b{margin-left:auto}
.narrow .ebar .schip,.narrow .ebar .pbtn{display:flex;justify-content:center;min-width:0;overflow:hidden;padding:8px 10px;font-size:12.5px;border-radius:12px}
.narrow .ebar .schip span,.narrow .ebar .pbtn span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Wandpanel: Bildschirmschoner */
.saver{position:fixed;inset:0;z-index:40;background:#05070c;display:flex;align-items:center;justify-content:center;cursor:none;animation:mfade .6s ease;user-select:none}
.svbox{display:flex;flex-direction:column;align-items:center;gap:10px;transition:transform 2s ease;color:#e9eef7;text-align:center;padding:24px}
.svclock{font-size:clamp(72px,18vw,180px);font-weight:200;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.svdate{font-size:clamp(16px,2.6vw,26px);color:rgba(233,238,247,.7)}
.svrow{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:14px;font-size:clamp(16px,2.4vw,24px);color:rgba(233,238,247,.85)}
.svrow span,.svstat span{display:inline-flex;align-items:center;gap:8px}
.svrow ha-icon{--mdc-icon-size:1.3em;color:rgba(233,238,247,.6)}
.svstat{margin-top:16px;font-size:clamp(14px,2vw,19px)}
.svstat span{padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.06)}
.svstat .ok{color:#7fdcaa}.svstat .alarm{color:#fff;background:rgba(255,80,60,.35);animation:svpulse 1.6s ease-in-out infinite}.svstat .warn{color:#ffc277}.svstat .info{color:#8fd0ff}
@keyframes svpulse{50%{background:rgba(255,80,60,.6)}}
.saver.night .svbox{opacity:.4}
.saver.black .svbox{opacity:0}
.walldev.on .lbl{color:var(--hv-ok)}
/* Technik: Heizung und Wallbox */
.tech{padding:12px 16px 14px;margin-bottom:16px}
.dense .tech{padding:10px 12px 12px;margin-bottom:12px;border-radius:16px}
.techh{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);margin-bottom:10px}
.techh ha-icon{--mdc-icon-size:17px;color:var(--hv-heat)}.wb .techh ha-icon{color:var(--hv-ok)}
.techs{margin-left:auto;letter-spacing:0;text-transform:none;font-size:13px;color:var(--hv-text);font-variant-numeric:tabular-nums}
.heatgrid{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(170px,.8fr) minmax(300px,2fr);gap:12px}
.heatgrid[data-n="2"]{grid-template-columns:minmax(170px,1fr) minmax(300px,2fr)}
.heatgrid[data-n="1"]{grid-template-columns:minmax(0,1fr)}
.hpanel{background:var(--hv-surface);border:1px solid var(--hv-line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.hpt{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}.hpt ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}
.hpt .chip{margin-left:auto;font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--hv-surface-2);color:var(--hv-dim)}
.hpt .chip.on{background:rgba(255,138,61,.2);color:#ffb27a}
.hpf{font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums}.hpf b{color:var(--hv-text);font-weight:500}
.hpf .lnk{color:var(--hv-text);text-decoration:underline dotted;text-underline-offset:3px}
.tkwrap{position:relative;display:flex;gap:10px;align-items:stretch;flex:1;min-height:150px}
.tkwrap svg{width:62px;flex:none;height:150px}
.tkls{position:relative;flex:1}
.tkl{position:absolute;left:0;transform:translateY(-50%);display:flex;align-items:baseline;gap:6px;text-align:left;white-space:nowrap}
.tkl b{font-size:17px;font-weight:400;font-variant-numeric:tabular-nums}.tkl small{font-size:11.5px;color:var(--hv-dim)}
.stv{display:flex;align-items:center;gap:10px;text-align:left}
.stv .flame{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-faint)}
.stv .flame ha-icon{--mdc-icon-size:28px}
.stv b{font-size:26px;font-weight:300;font-variant-numeric:tabular-nums}.stv small{display:block;font-size:12px;color:var(--hv-dim)}
.stove.burn .flame{background:rgba(255,120,50,.22);color:#ff9a4d;animation:hvflame 1.6s ease-in-out infinite}
.stove.warm .flame{color:#ffb27a}
@keyframes hvflame{0%,100%{box-shadow:0 0 0 0 rgba(255,120,50,.0)}50%{box-shadow:0 0 18px 2px rgba(255,120,50,.35)}}
.pump{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;font-size:12.5px;color:var(--hv-dim);text-align:left}
.pump span{display:flex;align-items:center;gap:4px}.pump ha-icon{--mdc-icon-size:16px}
.pump i{height:6px;border-radius:3px;background:var(--hv-surface-2);overflow:hidden}.pump em{display:block;height:100%;background:var(--hv-cool);border-radius:3px}
.pump.run em{background:repeating-linear-gradient(90deg,var(--hv-cool) 0 10px,#9adcff 10px 20px);background-size:40px 100%;animation:hvpump 1s linear infinite}
.pump b{color:var(--hv-text);font-weight:500;font-variant-numeric:tabular-nums}
@keyframes hvpump{to{background-position:40px 0}}
.flowto{display:flex;align-items:center;gap:2px;color:var(--hv-cool)}.flowto ha-icon{--mdc-icon-size:18px}
.hkv{display:flex;gap:6px 16px;flex-wrap:wrap}
.hkv>*{display:flex;flex-direction:column;text-align:left}.hkv small{font-size:11px;color:var(--hv-dim)}
.hkv b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}
.hkv .dev.ok b{color:var(--hv-ok)}.hkv .dev.mid b{color:var(--hv-warm)}.hkv .dev.bad b{color:var(--hv-alert)}
.hcc{position:relative;height:150px;margin:2px 30px 16px;cursor:crosshair;touch-action:pan-y}
.dense .hcc{height:120px}
.hcc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.hcp{fill:none;stroke:var(--hv-heat);stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.hcm{stroke:var(--hv-faint);stroke-dasharray:4 4;stroke-width:1;vector-effect:non-scaling-stroke}
.hcl{stroke:var(--hv-cool);stroke-dasharray:3 5;stroke-width:1.2;vector-effect:non-scaling-stroke;opacity:.8}
.hcg{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.hcn{stroke:rgba(255,255,255,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.hcpt{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;pointer-events:none}
.hcpt.soll{background:var(--hv-heat);box-shadow:0 0 0 3px rgba(255,138,61,.25)}
.hcpt.ist{border:2px solid #fff;width:16px;height:16px;margin:-8px 0 0 -8px}
.hcy{position:absolute;right:calc(100% + 6px);font-size:10.5px;color:var(--hv-faint);font-variant-numeric:tabular-nums}.hcy.hi{top:0}.hcy.lo{bottom:0}
.hcx{position:absolute;top:calc(100% + 3px);font-size:10.5px;color:var(--hv-faint);transform:translateX(-50%)}
.hcx[style*="left:0"]{transform:none}.hcx[style*="right:0"]{transform:none}
.hctip{position:absolute;top:-4px;transform:translate(-50%,-100%);display:none;padding:4px 9px;border-radius:9px;background:rgba(10,14,23,.92);border:1px solid var(--hv-line);font-size:12px;white-space:nowrap;pointer-events:none;z-index:2}
.hctip.on{display:block}.hctip b{font-weight:500}
.wbmain{display:grid;grid-template-columns:minmax(180px,1fr) minmax(200px,1.4fr) minmax(110px,.6fr);gap:12px;align-items:stretch}
.wbmain>button{background:var(--hv-surface);border:1px solid var(--hv-line);border-radius:14px;padding:10px 12px;text-align:left;min-width:0}
.wbpow{display:flex;align-items:center;gap:12px}
.wbic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-faint);flex:none}
.wbic ha-icon{--mdc-icon-size:26px}
.wb.charging .wbic{background:rgba(79,209,139,.2);color:var(--hv-ok);animation:hvcharge 2s ease-in-out infinite}
@keyframes hvcharge{50%{box-shadow:0 0 16px 2px rgba(79,209,139,.35)}}
.wbpow b{font-size:26px;font-weight:300;font-variant-numeric:tabular-nums}.wbpow small{display:block;font-size:12px;color:var(--hv-dim)}
.wbcar{display:flex;flex-direction:column;justify-content:center;gap:8px}
.wbct{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.wbct ha-icon{--mdc-icon-size:20px;color:var(--hv-dim);align-self:center}
.wbct b{font-size:20px;font-weight:400;font-variant-numeric:tabular-nums}.wbct small{font-size:12px;color:var(--hv-dim)}
.socbar{position:relative;height:8px;border-radius:4px;background:var(--hv-surface-2)}
.socbar em{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#3fbf7f,var(--hv-ok))}
.socbar u{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:#fff;border-radius:1px}
.wbses{display:flex;flex-direction:column;justify-content:center}.wbses small{font-size:11.5px;color:var(--hv-dim)}.wbses b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}
.wbmodes{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}
.wblim{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:13px}.wblim small{color:var(--hv-dim)}.wblim b{min-width:42px;text-align:center;font-variant-numeric:tabular-nums}
.narrow .heatgrid,.narrow .heatgrid[data-n]{grid-template-columns:minmax(0,1fr)}
.narrow .techs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.narrow .wbmain{grid-template-columns:repeat(2,minmax(0,1fr))}.narrow .wbpow,.narrow .wbcar{grid-column:1/-1}
.narrow .wblim{margin-left:0}
@media (max-width:1100px){.heatgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.heatgrid .curve{grid-column:1/-1}.heatgrid[data-n="1"] .curve{grid-column:auto}}
/* Verlauf 24 h */
.trend{padding:12px 16px 10px;margin-bottom:16px}
.dense .trend{padding:9px 12px 8px;margin-bottom:12px;border-radius:16px}
.trh{display:flex;align-items:center;gap:6px 16px;flex-wrap:wrap;margin-bottom:8px}
.trt{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);margin-right:auto}
.trt ha-icon{--mdc-icon-size:16px}
.trl{display:inline-flex;align-items:baseline;gap:6px;font-size:13px;color:var(--hv-dim);padding:2px 4px;border-radius:8px;font-variant-numeric:tabular-nums}
.trl:hover{background:var(--hv-surface)}
.trl i{width:10px;height:3px;border-radius:2px;align-self:center}.trl.t i{background:var(--hv-heat)}.trl.h i{background:var(--hv-cool)}
.trl b{color:var(--hv-text);font-weight:500;font-size:15px}.trl small{font-size:11.5px;color:var(--hv-faint)}
.trc{position:relative;height:120px;margin:0 34px 18px;touch-action:pan-y;cursor:crosshair}
.dense .trc{height:92px}
.trc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.trgrid line{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.trp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.trp.t{stroke:var(--hv-heat)}.trp.h{stroke:var(--hv-cool);stroke-width:1.6;opacity:.9}
.ty{position:absolute;white-space:nowrap;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--hv-faint);line-height:1}
.ty.t{right:calc(100% + 6px)}.ty.h{left:calc(100% + 6px)}.ty.hi{top:2px}.ty.lo{bottom:2px}
.ty.t{color:rgba(255,138,61,.75)}.ty.h{color:rgba(99,199,255,.75)}
.trx{position:absolute;left:0;right:0;top:calc(100% + 4px);height:12px;font-size:10.5px;color:var(--hv-faint)}
.trx span{position:absolute;transform:translateX(-50%);white-space:nowrap}.trx .now{right:0;transform:none}
.trcur{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35);display:none;pointer-events:none}
.trcur.on{display:block}
.trcur i{position:absolute;left:-4px;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;border:2px solid #0c111d}
.trcur i.t{background:var(--hv-heat)}.trcur i.h{background:var(--hv-cool)}
.trtip{position:absolute;top:-6px;transform:translate(-50%,-100%);display:none;gap:8px;align-items:baseline;padding:4px 9px;border-radius:9px;background:rgba(10,14,23,.92);border:1px solid var(--hv-line);font-size:12px;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;z-index:2}
.trtip.on{display:flex}.trtip span{color:var(--hv-dim)}.trtip b.t{color:#ffb27a;font-weight:500}.trtip b.h{color:#8fd6ff;font-weight:500}
.trmsg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:var(--hv-dim);background:transparent}
.trend.nodata .trc{height:48px}.trend.nodata .ty,.trend.nodata .trx{display:none}
:host(.card) .trtip{background:var(--card-background-color,#222)}
.narrow .trc{margin:0 30px 18px}
.narrow .trl small{display:none}
/* Energie */
.engrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;margin-bottom:16px}
.dense .engrid{gap:12px;margin-bottom:12px}
.eflow,.enside{padding:12px 16px 14px;min-width:0}
.dense .eflow,.dense .enside{padding:9px 12px 12px;border-radius:16px}
.efwrap{position:relative;height:350px;max-width:560px;margin:0 auto}
.dense .efwrap{height:330px}
.efwrap svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.eft{stroke:var(--hv-line);stroke-width:3;vector-effect:non-scaling-stroke;stroke-linecap:round}
.efd{stroke-width:6;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-dasharray:0 16;animation:hvflow 1.2s linear infinite}
.efd.pv{stroke:#ffc457}.efd.grid{stroke:#b39cff}.efd.bat{stroke:var(--hv-ok)}.efd.wb{stroke:var(--hv-cool)}
.efd.rev{animation-direction:reverse}.efd.off{display:none}
@keyframes hvflow{to{stroke-dashoffset:-16}}
@media (prefers-reduced-motion:reduce){.efd{animation:none;stroke-dasharray:none;stroke-width:3;opacity:.8}}
.enode{position:absolute;transform:translate(-50%,-50%);width:112px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-radius:16px;background:rgba(16,22,34,.88);border:1px solid var(--hv-line);text-align:center}
.enode:hover{border-color:rgba(255,255,255,.22)}
.enic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-dim)}
.enic ha-icon{--mdc-icon-size:22px}
.enode b{font-size:17px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}
.enode small{font-size:11.5px;color:var(--hv-dim);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.enode.pv .enic{color:#ffc457;background:rgba(255,196,87,.14)}.eflow.producing .enode.pv .enic{box-shadow:0 0 16px rgba(255,196,87,.35)}
.enode.grid .enic{color:#b39cff;background:rgba(179,156,255,.14)}
.enode.bat .enic{color:var(--hv-ok);background:rgba(79,209,139,.14)}
.enode.wb .enic{color:var(--hv-cool);background:rgba(99,199,255,.14)}
.enode.hub{width:128px;padding:10px 6px}.enode.hub .enic{width:48px;height:48px;color:var(--hv-text);background:rgba(255,255,255,.12)}.enode.hub b{font-size:20px}
.enside .trh+.ctstats{margin-bottom:14px}
.enside .cts b{font-size:20px}
.enhint{font-size:11.5px;color:var(--hv-faint)}
.ensplit{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--hv-surface-2);margin:2px 0 6px}
.ensplit i{display:block;height:100%}.ensplit .own{background:var(--hv-ok)}.ensplit .imp{background:#b39cff}
.ensplitl{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;color:var(--hv-dim)}
.ensplitl span{display:inline-flex;align-items:center;gap:6px}.ensplitl i{width:9px;height:9px;border-radius:50%}
.ensplitl .own i{background:var(--hv-ok)}.ensplitl .imp i{background:#b39cff}
.ctl.pv i{background:#ffc457}.ctl.use i{background:#63c7ff}.ctl.grid i{background:#b39cff}
.enp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.enp.pv{stroke:#ffc457}.enp.use{stroke:#63c7ff}.enp.grid{stroke:#b39cff;stroke-width:1.6;opacity:.9}
.ena.pv{fill:rgba(255,196,87,.14);stroke:none}
.enzero{stroke:rgba(255,255,255,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.trcur i.pv{background:#ffc457}.trcur i.use{background:#63c7ff}.trcur i.grid{background:#b39cff}
.trtip .tk.pv i{background:#ffc457}.trtip .tk.use i{background:#63c7ff}.trtip .tk.grid i{background:#b39cff}
.entrend.nodata .enc{height:48px}
.narrow .engrid{grid-template-columns:minmax(0,1fr)}
.narrow .efwrap{height:310px}
.narrow .enode{width:92px;padding:6px 4px}.narrow .enode.hub{width:104px}
.narrow .enic{width:34px;height:34px}.narrow .enode b{font-size:15px}
@media (max-width:1100px){.engrid{grid-template-columns:minmax(0,1fr)}}
`;

const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="hvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#9a86ff"/></linearGradient></defs>
<path d="M5.5 22.5 24 7l18.5 15.5" fill="none" stroke="url(#hvg)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11 20v19a2.5 2.5 0 0 0 2.5 2.5h21A2.5 2.5 0 0 0 37 39V20" fill="none" stroke="url(#hvg)" stroke-width="3.4" stroke-linejoin="round"/>
<path d="M11 30.5h26" stroke="url(#hvg)" stroke-width="2" opacity=".55"/>
<rect x="15.5" y="22.5" width="7" height="5" rx="1.3" fill="#ffc457"/><rect x="25.5" y="22.5" width="7" height="5" rx="1.3" fill="url(#hvg)" opacity=".45"/>
<rect x="15.5" y="33.5" width="7" height="5" rx="1.3" fill="url(#hvg)" opacity=".45"/><rect x="25.5" y="33.5" width="7" height="5" rx="1.3" fill="#ffc457"/></svg>`;

/* ------------------------------------------------------------------------ */
/*  Basisklasse: Bindungen, sparsame Aktualisierung, Aktionen                */
/* ------------------------------------------------------------------------ */
class HvBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._layout = withDefaults();
    this._model = null;
    this._binds = new Map();
    this._watchList = [];
    this._pending = new Set();
    this._dirty = true;
    this._raf = 0;
    this._stats = { renders: 0, updates: 0 };
    this._onClick = this._onClick.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onVis = () => { if (!document.hidden) { this._schedule(); this._camTick(true); } };
  }

  connectedCallback() {
    this._connected = true;
    const r = this.shadowRoot;
    r.addEventListener("click", this._onClick);
    r.addEventListener("pointerdown", this._onDown);
    r.addEventListener("pointerup", this._onUp);
    r.addEventListener("pointercancel", this._onUp);
    r.addEventListener("pointermove", (e) => {
      if (this._downAt && Math.hypot(e.clientX - this._downAt[0], e.clientY - this._downAt[1]) > 12) { this._downAt = null; clearTimeout(this._longT); }
      const dm = this._dim;
      if (!dm) return;
      const dx = e.clientX - dm.x0, dy = e.clientY - dm.y0;
      if (!dm.active && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        dm.active = true;
        clearTimeout(this._longT);
        dm.el.classList.add("dragging");
        try { dm.el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
      if (dm.active) {
        dm.pct = Math.max(1, Math.min(100, Math.round(dm.pct0 + (dx / dm.w) * 100)));
        setWidth(dm.el.querySelector(".fill"), dm.pct);
        setText(dm.el, ".tstate", `${dm.pct} %`);
      }
    });
    r.addEventListener("contextmenu", (e) => { const t = e.target.closest("[data-long]"); if (t) { e.preventDefault(); this._more(t.dataset.eid); } });
    r.addEventListener("change", this._onChange);
    r.addEventListener("input", this._onChange);
    document.addEventListener("visibilitychange", this._onVis);
    this._dirty = true;
    this._schedule();
    this._startCams();
  }

  disconnectedCallback() {
    this._connected = false;
    document.removeEventListener("visibilitychange", this._onVis);
    clearInterval(this._camTimer);
    if (this._camObs) this._camObs.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  set hass(h) {
    const old = this._hass;
    this._hass = h;
    if (!this._connected || !h) return;
    if (!old || h.entities !== old.entities || h.areas !== old.areas || h.devices !== old.devices || h.floors !== old.floors) {
      this._dirty = true;
      this._schedule();
      return;
    }
    if (h.states === old.states) return;
    const s = h.states, o = old.states, w = this._watchList;
    for (let i = 0; i < w.length; i++) if (s[w[i]] !== o[w[i]]) this._pending.add(w[i]);
    if (this._pending.size) this._schedule();
  }
  get hass() { return this._hass; }

  _schedule() {
    if (this._raf || !this._connected) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._flush(); });
  }

  _flush() {
    if (!this._hass) return;
    if (this._dirty) {
      this._dirty = false;
      this._pending.clear();
      this._model = buildModel(this._hass, this._layout);
      this._render();
      this._stats.renders++;
      return;
    }
    if (!this._pending.size) return;
    const runs = new Set();
    for (const eid of this._pending) { const l = this._binds.get(eid); if (l) for (const el of l) runs.add(el); }
    this._pending.clear();
    for (const el of runs) if (el.isConnected) { UPD[el.dataset.u].run(el, this); this._stats.updates++; }
  }

  /** Nach jedem Neuaufbau: Bindungen einsammeln und einmal füllen. */
  _wire(root) {
    this._binds = new Map();
    root.querySelectorAll("[data-u]").forEach((el) => {
      const u = UPD[el.dataset.u];
      if (!u) return;
      for (const eid of u.watch(el, this)) {
        let l = this._binds.get(eid);
        if (!l) this._binds.set(eid, (l = []));
        l.push(el);
      }
      u.run(el, this);
    });
    this._watchList = [...this._binds.keys()];
    this._observeCams(root);
  }

  /* ---------- Kamera-Standbilder: nur sichtbare, nur bei sichtbarem Tab ---------- */
  _startCams() {
    clearInterval(this._camTimer);
    const sec = Math.max(3, this._layout.camera_interval || 10);
    this._camTimer = setInterval(() => this._camTick(false), sec * 1000);
  }
  _observeCams(root) {
    if (this._camObs) this._camObs.disconnect();
    this._camVisible = new Set();
    const imgs = root.querySelectorAll("img[data-cam]");
    if (!imgs.length) return;
    this._camObs = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.isIntersecting) { this._camVisible.add(e.target); this._loadCam(e.target); } else this._camVisible.delete(e.target);
      }
    });
    imgs.forEach((i) => this._camObs.observe(i));
  }
  _camTick() {
    if (document.hidden || !this._camVisible) return;
    for (const img of this._camVisible) if (img.isConnected) this._loadCam(img);
  }
  _loadCam(img) {
    const st = this._hass && this._hass.states[img.dataset.cam];
    if (!st || !st.attributes.access_token || img._loading) return;
    img._loading = true;
    const url = `/api/camera_proxy/${st.entity_id}?token=${st.attributes.access_token}&t=${Date.now()}`;
    const pre = new Image();
    pre.onload = () => { img.src = url; img.classList.add("ready"); img._loading = false; };
    pre.onerror = () => { img._loading = false; };
    pre.src = url;
  }

  /* ---------- Bedienung ---------- */
  _onDown(e) {
    const t = e.target.closest("[data-long]");
    if (!t || e.target.closest("button, input")) return;
    if (t.dataset.dim) {
      const f = t.querySelector(".fill");
      this._dim = { el: t, x0: e.clientX, y0: e.clientY, w: t.offsetWidth || 200, pct0: (f && f._w) || 0, pct: 0, active: false };
    }
    this._downAt = [e.clientX, e.clientY];
    clearTimeout(this._longT);
    this._longT = setTimeout(() => { this._suppress = true; this._more(t.dataset.eid); }, 550);
  }
  _onUp() {
    clearTimeout(this._longT);
    this._downAt = null;
    const dm = this._dim;
    this._dim = null;
    if (dm && dm.active) {
      dm.el.classList.remove("dragging");
      this._suppress = true;
      setTimeout(() => { this._suppress = false; }, 400);
      this._call("light", "turn_on", { entity_id: dm.el.dataset.eid, brightness_pct: dm.pct });
    }
  }

  _onClick(e) {
    if (this._suppress) { this._suppress = false; e.preventDefault(); return; }
    const t = e.target.closest("[data-act]");
    if (!t || t.dataset.act === "noop") return;
    if (t.dataset.act === "confirm-ok" || t.dataset.act === "confirm-cancel") { this._closeConfirm(t.dataset.act === "confirm-ok"); return; }
    if (t.dataset.confirm && this._layout.confirm_quick !== false) { this._askConfirm(t); return; }
    this._action(t.dataset.act, t, e);
  }

  /* ---------- Abfrage vor dem Ausführen (Schnellzugriff) ---------- */
  _askConfirm(t) {
    const h = this._hass, act = t.dataset.act;
    const eids = (t.dataset.eids || "").split(",").filter(Boolean);
    let title = "Wirklich ausführen?", text = "", ok = "Ausführen", ic = "mdi:help-circle-outline";
    if (act === "lights-off") {
      const n = eids.filter((e) => isOn(h.states[e])).length;
      if (!n) { this._toast("Alle Lichter sind bereits aus"); return; }
      title = "Alle Lichter ausschalten?"; text = `${n} ${n === 1 ? "Licht ist" : "Lichter sind"} gerade an.`; ok = "Ausschalten"; ic = "mdi:lightbulb-off-outline";
    } else if (act === "list-covers") {
      const open = t.dataset.svc === "open_cover";
      title = open ? "Alle Rollos öffnen?" : "Alle Rollos schließen?";
      text = `${eids.length} ${eids.length === 1 ? "Rollo" : "Rollos"} im ganzen Haus.`; ok = open ? "Öffnen" : "Schließen"; ic = open ? "mdi:window-shutter-open" : "mdi:window-shutter";
    } else if (act === "hm-set") {
      const md = t.dataset.mode, arm = (this._layout.house_mode.arm || {})[md];
      title = `Hausmodus „${MODE_NAME[md]}“?`; ok = "Umschalten"; ic = MODE_ICON[md];
      text = { arm_away: "Die Alarmanlage wird scharf geschaltet (abwesend).", arm_night: "Die Alarmanlage wird scharf geschaltet (Nacht).", arm_vacation: "Die Alarmanlage wird scharf geschaltet (Urlaub).", arm_home: "Die Alarmanlage wird scharf geschaltet (zuhause)." }[arm] || "";
    } else if (act === "run") {
      const script = dom(t.dataset.eid) === "script";
      title = `${script ? "Skript" : "Szene"} „${entName(h, t.dataset.eid)}“ ausführen?`; ok = "Ausführen"; ic = script ? "mdi:script-text-play" : "mdi:palette";
    }
    this._closeConfirm(false);
    this._confirmFor = t;
    const m = document.createElement("div");
    m.className = "mbg";
    m.innerHTML = `<div class="modal glass" role="dialog" aria-modal="true"><span class="mic">${icon(ic)}</span>
      <div class="mt">${esc(title)}</div>${text ? `<div class="mx">${esc(text)}</div>` : ""}
      <div class="mb"><button class="pbtn" data-act="confirm-cancel">Abbrechen</button><button class="pbtn primary" data-act="confirm-ok">${esc(ok)}</button></div></div>`;
    m.addEventListener("click", (ev) => { if (ev.target === m) this._closeConfirm(false); });
    this._confirmKey = (ev) => { if (ev.key === "Escape") this._closeConfirm(false); else if (ev.key === "Enter") { ev.preventDefault(); this._closeConfirm(true); } };
    window.addEventListener("keydown", this._confirmKey);
    (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(m);
    const b = m.querySelector('[data-act="confirm-ok"]');
    if (b) b.focus();
  }

  _closeConfirm(run) {
    const m = this.shadowRoot.querySelector(".mbg");
    if (m) m.remove();
    if (this._confirmKey) { window.removeEventListener("keydown", this._confirmKey); this._confirmKey = null; }
    const t = this._confirmFor;
    this._confirmFor = null;
    if (run && t) this._action(t.dataset.act, t);
  }

  _onChange(e) {
    const t = e.target;
    if (t.dataset && t.dataset.bri && e.type === "change") {
      this._call("light", "turn_on", { entity_id: t.dataset.bri, brightness_pct: Number(t.value) });
    }
  }

  _more(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  async _call(domain, service, data) {
    try { await this._hass.callService(domain, service, data); } catch (err) { this._toast(`Fehler: ${err && err.message ? err.message : err}`); }
  }

  _toast(msg) {
    const r = this.shadowRoot;
    let t = r.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; r.appendChild(t); }
    t.textContent = msg;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.remove(), 3500);
  }

  _toggleList(eids) {
    const h = this._hass;
    const anyOn = eids.some((e) => isOn(h.states[e]));
    const byDomain = {};
    for (const e of eids) (byDomain[dom(e)] = byDomain[dom(e)] || []).push(e);
    for (const [d, list] of Object.entries(byDomain)) this._call(d === "light" ? "light" : "homeassistant", anyOn ? "turn_off" : "turn_on", { entity_id: list });
  }

  _action(act, t) {
    const h = this._hass;
    const eid = t.dataset.eid;
    switch (act) {
      case "more": this._more(eid); break;
      case "toggle": {
        const d = dom(eid);
        this._call(["light", "switch", "fan", "input_boolean", "siren"].includes(d) ? d : "homeassistant", "toggle", { entity_id: eid });
        break;
      }
      case "run": {
        const d = dom(eid);
        const svc = d === "button" || d === "input_button" ? "press" : "turn_on";
        this._call(d, svc, { entity_id: eid });
        t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
        setTimeout(() => t.classList.remove("flash"), 800);
        break;
      }
      case "cover": this._call("cover", t.dataset.svc, { entity_id: eid }); break;
      case "select-opt": this._call(dom(eid), "select_option", { entity_id: eid, option: t.dataset.opt }); break;
      case "num-step": {
        const st = h.states[eid], v = num(st);
        if (v === null) break;
        const a = st.attributes, nv = Math.min(a.max ?? 100, Math.max(a.min ?? 0, v + Number(t.dataset.step)));
        this._call(dom(eid), "set_value", { entity_id: eid, value: nv });
        break;
      }
      case "clim": {
        const st = h.states[eid];
        if (!st) return;
        const stepSize = st.attributes.target_temp_step || (dom(eid) === "water_heater" ? 1 : 0.5);
        const cur = st.attributes.temperature;
        if (cur == null) { this._more(eid); return; }
        const v = Math.round((cur + Number(t.dataset.step) * stepSize) * 10) / 10;
        const min = st.attributes.min_temp ?? -100, max = st.attributes.max_temp ?? 100;
        this._call(dom(eid), "set_temperature", { entity_id: eid, temperature: Math.min(max, Math.max(min, v)) });
        break;
      }
      case "media": this._call("media_player", t.dataset.svc, { entity_id: eid }); break;
      case "lock": {
        const tile = t.closest(".tile");
        const st = h.states[eid];
        if (isOn(st)) { this._call("lock", "lock", { entity_id: eid }); break; }
        if (tile.dataset.confirm === "1") {
          tile.dataset.confirm = "";
          this._call("lock", "unlock", { entity_id: eid });
        } else {
          tile.dataset.confirm = "1";
          updateTile(tile, this);
          setTimeout(() => { tile.dataset.confirm = ""; if (tile.isConnected) updateTile(tile, this); }, 3500);
        }
        break;
      }
      case "area-lights": {
        const a = this._model.areas.get(t.dataset.area);
        if (a && a.lights.length) this._toggleList(a.lights);
        break;
      }
      case "area-covers": {
        const a = this._model.areas.get(t.dataset.area);
        if (a && a.covers.length) this._call("cover", t.dataset.svc, { entity_id: a.covers });
        break;
      }
      case "list-lights": this._toggleList((t.dataset.eids || "").split(",").filter(Boolean)); break;
      case "lights-off": {
        const list = (t.dataset.eids || "").split(",").filter((e) => e && isOn(h.states[e]));
        if (list.length) this._call("light", "turn_off", { entity_id: list });
        break;
      }
      case "list-covers": {
        const list = (t.dataset.eids || "").split(",").filter(Boolean);
        if (list.length) this._call("cover", t.dataset.svc, { entity_id: list });
        break;
      }
      default: this._actionExtra && this._actionExtra(act, t);
    }
  }
}

/* ------------------------------------------------------------------------ */
/*  Panel                                                                    */
/* ------------------------------------------------------------------------ */
const NAV = [
  ["overview", "Übersicht", "mdi:home-variant"],
  ["licht", "Licht", "mdi:lightbulb-group"],
  ["beschattung", "Beschattung", "mdi:window-shutter"],
  ["klima", "Klima", "mdi:thermometer"],
  ["energie", "Energie", "mdi:lightning-bolt-circle"],
  ["sicherheit", "Sicherheit", "mdi:shield-home"],
  ["alarme", "Alarme", "mdi:bell-ring-outline"],
  ["batterien", "Batterien", "mdi:battery-heart-variant"],
];

class HausVisualisierungPanel extends HvBase {
  constructor() {
    super();
    this._view = null;
    this._arg = null;
    this._draft = null;
    this._serverVersion = null;
  }

  set panel(p) {
    this._panel = p;
    this._applyTheme();
  }
  set narrow(n) { this._narrowProp = n; this._updateNarrow(); }
  set route(r) {
    this._route = r;
    const path = (r && r.path) || "";
    const [, view, arg, ...rest] = path.split("/");
    const v = view || null;
    this._rest = rest.join("/");
    if (this._extEl && v === "extern" && arg === this._arg) this._extEl.route = this._extRoute();
    if (v !== this._view || (arg || null) !== this._arg) {
      this._view = v;
      this._arg = arg ? decodeURIComponent(arg) : null;
      this._dirty = true;
      this._schedule();
    }
  }

  set hass(h) {
    const old = this._hass;
    super.hass = h;
    if (!h) return;
    if (!this._sub && this._connected) this._subscribe();
    if (!old || h.themes !== old.themes) this._applyTheme();
    if (this._extEl && this._extEl.isConnected) this._extEl.hass = h;
    if (old && h.states !== old.states && this._layout.doorbell && this._layout.doorbell.enabled) {
      const bell = this._bellEntity();
      if (bell && h.states[bell] !== old.states[bell] && isRing(old.states[bell], h.states[bell])) this._showBell();
    }
    if (this._bell && this._bell.live) this._bell.live.hass = h;
  }
  get hass() { return this._hass; }

  /* ---------- Klingel-Overlay ---------- */
  _bellEntity() {
    const h = this._hass, cfg = this._layout.doorbell || {};
    if (cfg.entity) return h.states[cfg.entity] ? cfg.entity : null;
    if (this._bellAuto !== undefined && this._bellAutoFor === h.entities) return this._bellAuto;
    const all = Object.values(h.states);
    const pick = all.find((st) => dom(st.entity_id) === "event" && dc(st) === "doorbell")
      || all.find((st) => ["event", "binary_sensor"].includes(dom(st.entity_id)) && /(doorbell|klingel)/i.test(st.entity_id));
    this._bellAutoFor = h.entities;
    this._bellAuto = pick ? pick.entity_id : null;
    return this._bellAuto;
  }

  _bellCamera() {
    const h = this._hass, cfg = this._layout.doorbell || {};
    if (cfg.camera && h.states[cfg.camera]) return cfg.camera;
    const bell = this._bellEntity();
    const dev = bell && h.entities && h.entities[bell] && h.entities[bell].device_id;
    const cams = Object.keys(h.states).filter((e) => e.startsWith("camera."));
    const pref = (list) => list.find((e) => !/(paket|package)/i.test(e)) || list[0];
    if (dev) {
      const same = cams.filter((e) => h.entities[e] && h.entities[e].device_id === dev);
      if (same.length) return pref(same);
    }
    return pref(cams.filter((e) => /(entry|doorbell|klingel|haust)/i.test(e))) || cams[0] || null;
  }

  _showBell(test = false, override = null) {
    const h = this._hass, cfg = override || this._layout.doorbell || {};
    const cam = this._bellCamera();
    if (this._bell) {                       // klingelt erneut, während das Overlay offen ist
      this._bell.left = cfg.timeout || 60;
      setText(this._bell.el, ".bt", "Es klingelt erneut");
      setText(this._bell.el, ".bs", `${cam ? entName(h, cam) : "Haustür"} · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
      this._bell.el.classList.remove("again"); void this._bell.el.offsetWidth; this._bell.el.classList.add("again");
      return;
    }
    // Klingel weckt das Wandpanel
    this._saverHide();
    this._wallActive = Date.now();
    this._closeConfirm(false);
    const lock = cfg.lock && h.states[cfg.lock] ? cfg.lock : "";
    const protect = (this._layout.links || []).find((l) => /protect|kamera|camera/i.test(`${l.path} ${l.title}`));
    const el = document.createElement("div");
    el.className = "bellbg";
    el.innerHTML = `<div class="bell glass" role="dialog" aria-modal="true">
      <div class="bhead"><span class="bic">${icon("mdi:doorbell-video")}</span>
        <div><div class="bt">${test ? "Test: Es klingelt" : "Es klingelt"}</div><div class="bs">${esc(cam ? entName(h, cam) : "Keine Kamera gefunden")} · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</div></div>
        <span class="sp"></span><span class="bcount"></span>
        <button class="iconbtn" data-act="bell-close" title="Schließen">${icon("mdi:close")}</button></div>
      <div class="bcam">${cam ? `<img class="bimg" alt="">` : `<div class="bnone">${icon("mdi:cctv-off")}Unter Einstellungen → Klingel eine Kamera wählen</div>`}<div class="blive"></div></div>
      <div class="bacts">
        ${cam ? `<button class="pbtn" data-act="bell-live">${icon("mdi:video")}<span>Live</span></button>` : ""}
        ${protect ? `<button class="pbtn" data-act="bell-protect" data-path="${esc(protect.path)}">${icon(protect.icon || "mdi:cctv")}${esc(protect.title || "Kameras")} öffnen</button>` : ""}
        ${lock ? `<button class="pbtn bunlock" data-act="bell-unlock">${icon("mdi:lock-open-variant")}<span>Tür öffnen</span></button>` : ""}
        <span class="sp"></span>
        <button class="pbtn primary" data-act="bell-close">Schließen</button>
      </div></div>`;
    el.addEventListener("click", (ev) => { if (ev.target === el) this._closeBell(); });
    (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(el);
    this._bell = { el, cam, lock, pulse: cfg.pulse ?? 2, left: cfg.timeout || 60, hold: false };
    this._bellKey = (ev) => { if (ev.key === "Escape") this._closeBell(); };
    window.addEventListener("keydown", this._bellKey);
    this._bellSnap();
    this._bellTimer = setInterval(() => {
      const b = this._bell;
      if (!b) return;
      if (!b.live && !document.hidden) this._bellSnap();
      if (b.hold) { setText(b.el, ".bcount", ""); return; }
      b.left -= 1;
      setText(b.el, ".bcount", `schließt in ${b.left} s`);
      if (b.left <= 0) this._closeBell();
    }, 1000);
  }

  _bellSnap() {
    const b = this._bell, st = b && b.cam && this._hass.states[b.cam];
    const img = b && b.el.querySelector(".bimg");
    if (!img || !st || !st.attributes.access_token || b.loading) return;
    b.loading = true;
    const url = `/api/camera_proxy/${b.cam}?token=${st.attributes.access_token}&t=${Date.now()}`;
    const pre = new Image();
    pre.onload = () => { img.src = url; img.classList.add("ready"); b.loading = false; };
    pre.onerror = () => { b.loading = false; };
    pre.src = url;
  }

  _closeBell() {
    clearInterval(this._bellTimer);
    if (this._bellKey) { window.removeEventListener("keydown", this._bellKey); this._bellKey = null; }
    if (this._bell) { this._bell.el.remove(); this._bell = null; }
  }

  async _openDoor(eid, pulse, btn) {
    const h = this._hass, d = dom(eid), st = h.states[eid];
    setText(btn, "span", "Tür wird geöffnet …");
    btn.disabled = true;
    try {
      if (d === "lock") {
        // Schloss mit Öffnen-Funktion (Falle ziehen) öffnen, sonst entriegeln
        const canOpen = st && (Number(st.attributes.supported_features) & 1);
        await h.callService("lock", canOpen ? "open" : "unlock", { entity_id: eid });
      } else if (d === "button" || d === "input_button") {
        await h.callService(d, "press", { entity_id: eid });
      } else if (d === "script" || d === "scene") {
        await h.callService(d, "turn_on", { entity_id: eid });
      } else {
        // Schalter (z. B. KNX-Türöffner): einschalten und nach dem Impuls wieder aus
        const svcDom = ["switch", "input_boolean", "light"].includes(d) ? d : "homeassistant";
        await h.callService(svcDom, "turn_on", { entity_id: eid });
        if (pulse > 0) setTimeout(() => { h.callService(svcDom, "turn_off", { entity_id: eid }).catch(() => {}); }, pulse * 1000);
      }
      setText(btn, "span", "Türöffner ausgelöst");
      this._toast("Türöffner ausgelöst");
    } catch (err) {
      btn.disabled = false;
      setText(btn, "span", "Tür öffnen");
      this._toast(`Tür öffnen fehlgeschlagen: ${err && err.message ? err.message : err}`);
    }
  }

  _bellAction(act, t) {
    const b = this._bell;
    if (!b) return;
    switch (act) {
      case "bell-close": this._closeBell(); return;
      case "bell-live": {
        b.hold = true;
        const st = this._hass.states[b.cam];
        if (customElements.get("ha-camera-stream") && st) {
          const live = document.createElement("ha-camera-stream");
          live.hass = this._hass; live.stateObj = st; live.muted = true; live.controls = true; live.allowExoPlayer = true;
          b.el.querySelector(".blive").replaceChildren(live);
          b.el.classList.add("islive");
          b.live = live;
          t.disabled = true;
        } else this._more(b.cam);
        return;
      }
      case "bell-protect": { const p = t.dataset.path; this._closeBell(); this._openLink(p); return; }
      case "bell-unlock": {
        b.hold = true;
        if (t.dataset.armed === "1") {
          t.dataset.armed = "";
          this._openDoor(b.lock, b.pulse, t);
        } else {
          t.dataset.armed = "1";
          setText(t, "span", "Nochmal tippen zum Öffnen");
          setTimeout(() => { if (t.isConnected && t.dataset.armed === "1") { t.dataset.armed = ""; setText(t, "span", "Tür öffnen"); } }, 4000);
        }
        return;
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._hass && !this._sub) this._subscribe();
    this._clockT = setInterval(() => { if (!document.hidden) this._tickClock(); }, 15000);
    this._alertT = setInterval(() => {
      if (document.hidden || !this._model) return;
      this.shadowRoot.querySelectorAll('[data-u="alerts"], [data-k="alerts"], [data-u="alarmpage"], [data-u="navbadge"]').forEach((el) => UPD[el.dataset.u].run(el, this));
    }, 30000);
    if (!this._alWired) {
      this._alWired = true;
      const r = this.shadowRoot;
      r.addEventListener("pointerdown", (e) => this._alSwipeStart(e));
      r.addEventListener("pointermove", (e) => this._alSwipeMove(e));
      r.addEventListener("pointerup", () => this._alSwipeEnd());
      r.addEventListener("pointercancel", () => this._alSwipeEnd());
      r.addEventListener("click", (e) => { if (this._alSwiped && Date.now() - this._alSwiped < 400 && e.target.closest(".alrow")) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
      // Verlauf: Wert unter Maus oder Finger anzeigen
      const trMove = (e) => {
        const frac = (n) => { const b = n.getBoundingClientRect(); return b.width ? Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) : null; };
        const ct = e.target.closest && e.target.closest(".ctc");
        if (ct) { clearTimeout(this._trHideT); this._ctHover = ct.closest(".ctrend"); climHover(this._ctHover, frac(ct)); }
        else if (this._ctHover) { climHover(this._ctHover, null); this._ctHover = null; }
        const enc = e.target.closest && e.target.closest(".enc");
        if (enc) { clearTimeout(this._trHideT); this._enHover = enc.closest(".entrend"); enHover(this._enHover, frac(enc)); }
        else if (this._enHover) { enHover(this._enHover, null); this._enHover = null; }
        const spk = e.target.closest && e.target.closest(".kspark");
        if (spk && spk !== this._spHover && this._spHover) sparkHover(this._spHover, null);
        if (spk) { clearTimeout(this._trHideT); this._spHover = spk; sparkHover(spk, frac(spk)); }
        else if (this._spHover) { sparkHover(this._spHover, null); this._spHover = null; }
        const hc = e.target.closest && e.target.closest(".hcc");
        if (hc) { const b = hc.getBoundingClientRect(); this._hcHover = hc; heatHover(hc, Math.min(1, Math.max(0, (e.clientX - b.left) / b.width))); }
        else if (this._hcHover) { heatHover(this._hcHover, null); this._hcHover = null; }
        const c = e.target.closest && e.target.closest(".trc");
        if (!c) { if (this._trHover) { trendHover(this._trHover, null); this._trHover = null; } return; }
        const el = c.closest(".trend"), b = c.getBoundingClientRect();
        if (!el || !b.width) return;
        clearTimeout(this._trHideT);
        this._trHover = el;
        trendHover(el, Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)));
      };
      r.addEventListener("pointermove", trMove);
      r.addEventListener("pointerdown", trMove);
      r.addEventListener("pointerout", (e) => {
        if (e.pointerType === "touch") return;
        const to0 = e.relatedTarget;
        if (this._ctHover && !(to0 && to0.closest && to0.closest(".ctc"))) { climHover(this._ctHover, null); this._ctHover = null; }
        if (this._spHover && !(to0 && to0.closest && to0.closest(".kspark"))) { sparkHover(this._spHover, null); this._spHover = null; }
        if (this._enHover && !(to0 && to0.closest && to0.closest(".enc"))) { enHover(this._enHover, null); this._enHover = null; }
        if (!this._trHover) return;
        const to = e.relatedTarget;
        if (!to || !to.closest || !to.closest(".trc")) { trendHover(this._trHover, null); this._trHover = null; }
      });
      r.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "touch" || !(this._trHover || this._ctHover || this._spHover || this._enHover)) return;
        clearTimeout(this._trHideT);
        // am Handy bleibt der Wert kurz stehen
        this._trHideT = setTimeout(() => {
          if (this._trHover) { trendHover(this._trHover, null); this._trHover = null; }
          if (this._ctHover) { climHover(this._ctHover, null); this._ctHover = null; }
          if (this._spHover) { sparkHover(this._spHover, null); this._spHover = null; }
          if (this._enHover) { enHover(this._enHover, null); this._enHover = null; }
        }, 2500);
      });
      // Einstellungen: Sortieren per Ziehen
      r.addEventListener("pointerdown", (e) => this._sortStart(e));
      r.addEventListener("keydown", (e) => this._sortKey(e));
    }
    this._wallStart();
    this._ro = new ResizeObserver(() => this._updateNarrow());
    this._onWinResize = () => this._updateNarrow();
    window.addEventListener("resize", this._onWinResize);
    this._ro.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockT);
    clearInterval(this._alertT);
    clearInterval(this._wallT); this._wallT = 0;
    if (this._wallWired) {
      window.removeEventListener("pointerdown", this._onWallAct, true);
      window.removeEventListener("click", this._onWallClick, true);
      window.removeEventListener("keydown", this._onWallAct, true);
      window.removeEventListener("wheel", this._onWallAct, { capture: true });
      this._wallWired = false;
    }
    this._closeBell();
    if (this._ro) this._ro.disconnect();
    window.removeEventListener("resize", this._onWinResize);
    if (this._sub) { this._sub.then((un) => un && un()).catch(() => {}); this._sub = null; }
    if (this._alSub) { this._alSub.then((un) => un && un()).catch(() => {}); this._alSub = null; }
    if (window.__hvEmbed && window.__hvEmbed.owner === this) window.__hvEmbed = null;
  }

  _updateNarrow() {
    const n = this._narrowProp || this.clientWidth < 760;
    // Seitenfüllend: Höhe = sichtbarer Bereich ab Oberkante des Panels
    const top = `${Math.max(0, Math.round(this.getBoundingClientRect().top + window.scrollY))}px`;
    if (this._top !== top) { this._top = top; this.style.setProperty("--hv-top", top); }
    // Feste Navigationsleiste: an Lage und Breite des Panels ausrichten (z. B. neben der HA-Seitenleiste)
    if (n) {
      const r = this.getBoundingClientRect();
      const left = `${Math.round(r.left)}px`, width = `${Math.round(r.width || window.innerWidth)}px`;
      if (this._railLeft !== left) { this._railLeft = left; this.style.setProperty("--hv-rail-left", left); }
      if (this._railWidth !== width) { this._railWidth = width; this.style.setProperty("--hv-rail-width", width); }
    }
    if (n !== this._isNarrow) {
      this._isNarrow = n;
      const app = this.shadowRoot.querySelector(".app");
      if (app) app.classList.toggle("narrow", n);
      if (this._extEl) this._extEl.narrow = n;
      if (app && isDense(this._layout) && this._view !== "extern") { this._dirty = true; this._schedule(); }
    }
  }

  _subscribe() {
    if (!this._hass || !this._hass.connection) return;
    this._sub = this._hass.connection
      .subscribeMessage((msg) => {
        if (msg.version) this._serverVersion = msg.version;
        if (msg.layout) {
          this._layout = withDefaults(msg.layout);
          this._startCams();
          if (!this._dirtySettings) { this._draft = null; this._dirty = true; this._schedule(); }
        }
      }, { type: `${DOMAIN}/subscribe` })
      .catch((err) => {
        console.warn("Haus Visualisierung: Abo fehlgeschlagen", err);
        this._dirty = true;
        this._schedule();
      });
    this._alSub = this._hass.connection
      .subscribeMessage((snap) => this._onAlarms(snap), { type: `${DOMAIN}/alarms_subscribe` })
      .catch((err) => console.warn("Haus Visualisierung: Alarmmanager nicht erreichbar", err));
  }

  _applyTheme() {
    const name = this._panel && this._panel.config && this._panel.config.theme;
    const themes = this._hass && this._hass.themes;
    const key = `${name}|${themes && themes.darkMode}|${themes && themes.themes && name && !!themes.themes[name]}`;
    if (key === this._themeKey) return;
    this._themeKey = key;
    for (const p of this._themeProps || []) this.style.removeProperty(p);
    this._themeProps = [];
    if (!name || !themes || !themes.themes || !themes.themes[name]) return;
    let vars = { ...themes.themes[name] };
    if (vars.modes) {
      const m = themes.darkMode ? vars.modes.dark : vars.modes.light;
      vars = { ...vars, ...(m || {}) };
      delete vars.modes;
    }
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v !== "string" && typeof v !== "number") continue;
      this.style.setProperty(`--${k}`, String(v));
      this._themeProps.push(`--${k}`);
    }
    const bg = vars["lovelace-background"];
    if (bg) { this.style.setProperty("--hv-bg", String(bg)); this._themeProps.push("--hv-bg"); }
  }

  get _base() { return `/${(this._panel && this._panel.url_path) || "haus-visualisierung"}`; }

  _tickClock() {
    const r = this.shadowRoot;
    const now = new Date();
    const c = r.querySelector(".clock");
    if (!c) return;
    setText(c, null, now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setText(r, ".date", now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }));
    const hr = now.getHours();
    setText(r, ".greet", hr < 5 ? "Gute Nacht" : hr < 11 ? "Guten Morgen" : hr < 17 ? "Guten Tag" : hr < 22 ? "Guten Abend" : "Gute Nacht");
  }

  /* ---------- Wandpanel: Vollbild, Bildschirmschoner, Rückkehr zur Startseite ---------- */
  /* Ob ein Gerät ein Wandpanel ist, gilt je Browser (localStorage, auch per Adresse ?wandpanel=1 bzw. =0).
     Zeiten und Inhalte gelten für alle Wandpanels (Einstellungen → Darstellung). Ein Takt von 5 s prüft
     die Ruhezeit – nur bei sichtbarem Tab und nur auf Wandpanels. */
  _wallIsOn() {
    if (this._wallFlag === undefined) {
      let v = null;
      try {
        const q = new URLSearchParams(location.search).get("wandpanel");
        if (q !== null) { v = q !== "0" && q !== "false"; localStorage.setItem("hv-wallpanel", v ? "1" : "0"); }
        else v = localStorage.getItem("hv-wallpanel") === "1";
      } catch (err) { v = false; }
      this._wallFlag = !!v;
    }
    return this._wallFlag;
  }

  _wallSet(on) {
    this._wallFlag = !!on;
    try { localStorage.setItem("hv-wallpanel", on ? "1" : "0"); } catch (err) { /* egal */ }
    if (on) this._wallStart(); else this._wallStop();
    this._dirty = true; this._flush();
  }

  _wallCfg() { return { ...DEFAULT_LAYOUT.wallpanel, ...(this._layout.wallpanel || {}) }; }

  _wallStart() {
    if (!this._wallIsOn() || !this._connected) return;
    const W = this._wallCfg();
    this._wallActive = this._wallActive || Date.now();
    if (!this._wallWired) {
      this._wallWired = true;
      this._onWallAct = (e) => {
        if (!this._wallIsOn()) return;
        this._wallActive = Date.now();
        this._wallReturned = false;
        if (e && e.type === "pointerdown") this._saverSwallow = false;
        if (this._saverOn) {
          // Tipp weckt nur auf: sein Klick wird verschluckt, der nächste Tipp wirkt wieder normal
          if (e && e.type === "pointerdown") { e.stopPropagation(); e.preventDefault(); this._saverSwallow = true; }
          this._saverHide();
        }
        if (e && e.type === "pointerdown" && this._wallCfg().fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      this._onWallClick = (e) => { if (this._saverSwallow) { this._saverSwallow = false; e.stopPropagation(); e.preventDefault(); } };
      window.addEventListener("pointerdown", this._onWallAct, true);
      window.addEventListener("click", this._onWallClick, true);
      window.addEventListener("keydown", this._onWallAct, true);
      window.addEventListener("wheel", this._onWallAct, { capture: true, passive: true });
    }
    if (W.hide_sidebar && !this._wallDocked) {
      this._wallDocked = true;
      try { if (!localStorage.getItem("hv-wall-prev-dock")) localStorage.setItem("hv-wall-prev-dock", localStorage.getItem("dockedSidebar") || '"docked"'); } catch (err) { /* egal */ }
      this.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: "always_hidden" }, bubbles: true, composed: true }));
    }
    clearInterval(this._wallT);
    this._wallT = setInterval(() => this._wallTick(), 5000);
  }

  _wallStop() {
    clearInterval(this._wallT); this._wallT = 0;
    this._saverHide();
    if (this._wallWired) {
      window.removeEventListener("pointerdown", this._onWallAct, true);
      window.removeEventListener("click", this._onWallClick, true);
      window.removeEventListener("keydown", this._onWallAct, true);
      window.removeEventListener("wheel", this._onWallAct, { capture: true });
      this._wallWired = false;
    }
    if (this._wallDocked && !this._wallIsOn()) {
      this._wallDocked = false;
      let prev = "docked";
      try { prev = JSON.parse(localStorage.getItem("hv-wall-prev-dock") || '"docked"'); localStorage.removeItem("hv-wall-prev-dock"); } catch (err) { /* egal */ }
      this.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: prev === "always_hidden" ? "docked" : prev }, bubbles: true, composed: true }));
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  _wallTick() {
    if (document.hidden || !this._wallIsOn() || !this._hass) return;
    const W = this._wallCfg(), now = Date.now();
    // Bewegungsmelder am Panel weckt wie eine Berührung
    const ws = W.wake_entity && this._hass.states[W.wake_entity];
    if (ws && isOn(ws) && Date.parse(ws.last_changed) > (this._wallWakeSeen || 0)) {
      this._wallWakeSeen = Date.parse(ws.last_changed);
      this._wallActive = now; this._wallReturned = false;
      if (this._saverOn) this._saverHide();
    }
    const idle = (now - (this._wallActive || now)) / 60000;
    if (W.return_min > 0 && idle >= W.return_min && !this._wallReturned) {
      this._wallReturned = true;
      const start = this._layout.start_view && this._layout.start_view !== "overview" ? this._layout.start_view : "";
      const here = this._view ? `${this._view}${this._arg ? `/${this._arg}` : ""}` : "";
      const dirtySettings = this._view === "einstellungen" && this._dirtySettings;
      if (here !== start && !dirtySettings && !this._bell) this._go(start);
    }
    if (W.saver_min > 0 && idle >= W.saver_min && !this._saverOn && !this._bell) this._saverShow();
    if (this._saverOn) this._saverUpdate(idle);
  }

  _saverShow() {
    this._saverOn = true;
    this._saverMount();
  }

  _saverHide() {
    if (!this._saverOn) return;
    this._saverOn = false;
    const s = this.shadowRoot.querySelector(".saver");
    if (s) s.remove();
  }

  /** Nach jedem Neuaufbau wieder einhängen (das Gerüst ersetzt den ganzen Inhalt). */
  _saverMount() {
    if (!this._saverOn || this.shadowRoot.querySelector(".saver")) return;
    const d = document.createElement("div");
    d.className = "saver";
    d.setAttribute("role", "button");
    d.setAttribute("aria-label", "Bildschirmschoner – tippen zum Aufwecken");
    d.innerHTML = `<div class="svbox"><div class="svclock"></div><div class="svdate"></div><div class="svrow"></div><div class="svstat"></div></div>`;
    this.shadowRoot.appendChild(d);
    this._saverMin = null;
    this._saverUpdate((Date.now() - (this._wallActive || Date.now())) / 60000, true);
  }

  _saverUpdate(idle, force = false) {
    const el = this.shadowRoot.querySelector(".saver");
    if (!el || !this._hass) return;
    const W = this._wallCfg(), h = this._hass, now = new Date();
    const black = W.black_min > 0 && idle >= W.saver_min + W.black_min;
    const night = W.night_dim && (curMode() === "nacht" || now.getHours() >= 23 || now.getHours() < 6);
    el.classList.toggle("black", black);
    el.classList.toggle("night", night && !black);
    const minute = Math.floor(now.getTime() / 60000);
    if (!force && this._saverMin === minute && !this._saverDirty) return;
    this._saverMin = minute; this._saverDirty = false;
    setText(el, ".svclock", now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setText(el, ".svdate", now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }));
    const wid = W.weather || Object.keys(h.states).find((e) => e.startsWith("weather."));
    const wst = wid && h.states[wid];
    const out = this._model && this._model.tech && this._model.tech.heat && this._model.tech.heat.outdoor;
    const outT = num(h.states[out || ""]) ?? (wst && finite(wst.attributes.temperature) ? wst.attributes.temperature : null);
    const pv = powerW(h.states[this._layout.header.pv || ""]);
    const md = curMode();
    const parts = [];
    if (wst) parts.push(`<span>${icon(WEATHER_ICON[wst.state] || "mdi:weather-cloudy")}${outT !== null ? `${NF1.format(outT)}°` : ""}</span>`);
    else if (outT !== null) parts.push(`<span>${icon("mdi:thermometer")}${NF1.format(outT)}°</span>`);
    if (pv !== null && pv > 50) parts.push(`<span>${icon("mdi:solar-power-variant")}${pv >= 1000 ? `${NF1.format(pv / 1000)} kW` : `${NF0.format(pv)} W`}</span>`);
    parts.push(`<span>${icon(MODE_ICON[md])}${MODE_NAME[md]}</span>`);
    setHtml(el.querySelector(".svrow"), parts.join(""));
    const al = this._model ? evalAlerts(h, this._model, this._layout) : [];
    const top = al.length ? al.reduce((a, b) => (LEVELS[b.level] > LEVELS[a.level] ? b : a)) : null;
    setHtml(el.querySelector(".svstat"), top ? `<span class="${top.level}">${icon(LEVEL_ICON[top.level])}${al.length === 1 ? esc(top.title) : `${al.length} Meldungen · ${esc(top.title)}`}</span>` : `<span class="ok">${icon("mdi:shield-check")}Alles in Ordnung</span>`);
    // gegen Einbrennen: jede Minute ein Stück versetzen
    const box = el.querySelector(".svbox");
    const k = minute % 9, dx = ((k % 3) - 1) * 6, dy = (Math.floor(k / 3) - 1) * 5;
    box.style.transform = `translate(${dx}vw,${dy}vh)`;
  }

  /* ---------- Gerüst ---------- */
  _render() {
    const h = this._hass;
    if (this._isNarrow === undefined) this._isNarrow = !!this._narrowProp || (this.clientWidth || window.innerWidth) < 760;
    const L = this._layout;
    let view = this._view || L.start_view || "overview";
    const isAdmin = !!(h.user && h.user.is_admin);
    if (view === "einstellungen" && !isAdmin) view = "overview";
    const active = view === "raum" ? "overview" : view;

    // Energie nur, wenn es Energiedaten gibt
    const navList = NAV.filter(([k]) => k !== "energie" || (this._model && this._model.energy));
    const nav = navList.map(([k, t, i]) => `<button class="nav${active === k ? " active" : ""}" data-act="go" data-to="${k === "overview" ? "" : k}" title="${t}">${icon(i)}${k === "alarme" ? `<i class="nbadge" data-u="navbadge"></i>` : ""}<span>${t}</span></button>`).join("");
    const links = (L.links || []).filter((l) => l.path).map((l) => `<button class="nav${view === "extern" && panelPathOf(l.path) === this._arg ? " active" : ""}" data-act="link" data-path="${esc(l.path)}" title="${esc(l.title)}">${icon(l.icon || "mdi:link")}<span>${esc(l.title)}</span></button>`).join("");

    let body;
    try {
      body = this._renderView(view);
    } catch (err) {
      console.error("Haus Visualisierung:", err);
      body = `<div class="empty">${icon("mdi:alert")}Fehler beim Aufbau: ${esc(err.message)}</div>`;
    }

    const old = this.shadowRoot.querySelector(".main");
    const keepScroll = old && this._lastView === `${view}/${this._arg}` ? old.scrollTop : 0;
    this._lastView = `${view}/${this._arg}`;

    const verNote = this._serverVersion && this._serverVersion !== VERSION
      ? `<div class="notice">Der Browser zeigt noch Version ${VERSION}, installiert ist ${esc(this._serverVersion)}. Bitte mit Strg + F5 neu laden bzw. in der App den Frontend-Cache leeren.</div>` : "";

    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="app${L.glass ? " blur" : ""}${this._isNarrow ? " narrow" : ""}${isDense(L) ? " dense" : ""}">
        <div class="bg"></div>
        <nav class="rail${navList.length + (L.links || []).filter((l) => l.path).length + (isAdmin ? 1 : 0) > 6 ? " many" : ""}">
          <div class="logo">${LOGO}<small>v${VERSION}</small></div>
          ${nav}
          ${links ? `<hr>${links}` : ""}
          <div class="grow"></div>
          ${this._wallIsOn() ? `<button class="nav wallbtn" data-act="saver" title="Bildschirmschoner">${icon("mdi:power-sleep")}<span>Ruhe</span></button>` : ""}
          ${isAdmin ? `<button class="nav${active === "einstellungen" ? " active" : ""}" data-act="go" data-to="einstellungen" title="Einstellungen">${icon("mdi:cog")}<span>Einstellungen</span></button>` : ""}
        </nav>
        <main class="main${view === "extern" ? " ext" : ""}"><div class="wrap">${view === "extern" ? "" : verNote}${body}</div></main>
      </div>`;
    const main = this.shadowRoot.querySelector(".main");
    if (keepScroll) main.scrollTop = keepScroll;
    this._saverMount();
    this._wire(this.shadowRoot);
    this._tickClock();
    this._updateNarrow();
    if (view === "extern") this._mountExt(this._arg);
    else { this._extEl = null; if (window.__hvEmbed && window.__hvEmbed.owner === this) window.__hvEmbed = null; }
  }

  /* ---------- Eingebettete Panels (Solar, Protect …) ---------- */
  /* custom = eigenes Panel (Solar, Protect …), builtin = Dashboard/HA-Seite, frame = nur als Rahmen */
  _embedKind(urlPath) {
    const p = this._hass && this._hass.panels && this._hass.panels[urlPath];
    if (!p || urlPath === panelPathOf(this._base)) return null;
    const pc = p.config && p.config._panel_custom;
    if (p.component_name === "custom") {
      if (pc && pc.name && !pc.embed_iframe && (pc.module_url || pc.js_url)) return "custom";
      return pc && pc.embed_iframe ? "frame" : null;
    }
    if (p.component_name === "iframe") return "frame";
    return "builtin";
  }
  _embeddable(urlPath) { return !!this._embedKind(urlPath); }

  _openLink(path) {
    if (!path) return;
    const up = panelPathOf(path);
    const link = (this._layout.links || []).find((l) => panelPathOf(l.path) === up);
    const mode = link ? linkMode(link) : "theme";
    if (up !== panelPathOf(this._base) && this._embeddable(up) && mode !== "open") this._go(`extern/${encodeURIComponent(up)}`);
    else this._navigate(path);
  }

  _extRoute() {
    return { prefix: `${this._base}/extern/${this._arg}`, path: this._rest ? `/${this._rest}` : "" };
  }

  async _mountExt(up) {
    const host = this.shadowRoot.querySelector(".extwrap");
    if (!host) return;
    const panel = this._hass.panels && this._hass.panels[up];
    if (!this._embeddable(up)) {
      host.innerHTML = `<div class="glass empty" style="margin:20px">${icon("mdi:puzzle-remove-outline")}Das Panel „${esc(up)}“ lässt sich nicht einbetten${panel ? "" : " (nicht gefunden oder keine Berechtigung)"}.<br><br>
        <button class="pbtn" data-act="nav-raw" data-path="/${esc(up)}">${icon("mdi:open-in-new")}Im eigenen Panel öffnen</button></div>`;
      return;
    }
    this._extCache = this._extCache || new Map();
    const kind = this._embedKind(up);
    const link = (this._layout.links || []).find((l) => panelPathOf(l.path) === up);
    const themed = linkMode(link) !== "embed";
    host.classList.toggle("themed", themed);
    let el = this._extCache.get(up);
    if (!el && kind !== "custom") {
      const tag = `ha-panel-${panel.component_name}`;
      if (kind === "builtin" && customElements.get(tag)) {
        el = document.createElement(tag);              // Dashboard direkt, wie Home Assistant selbst
        this._extCache.set(up, el);
      } else {
        // Seite noch nicht geladen bzw. iFrame-Panel: als Rahmen ohne HA-Seitenleiste
        const fr = document.createElement("iframe");
        fr.className = "extframe";
        fr.title = panel.title || up;
        fr.src = panel.component_name === "iframe" && panel.config && panel.config.url ? panel.config.url : `/${up}${this._rest ? `/${this._rest}` : ""}`;
        const glass = !!this._layout.glass;
        fr.addEventListener("load", () => { if (themed) themeFrame(fr, glass); hideHaChrome(fr); });
        if (this._view !== "extern" || this._arg !== up || !host.isConnected) return;
        installNavGuard();
        window.__hvEmbed = { owner: this, up, base: this._base, active: () => this.isConnected && this._view === "extern" && this._arg === up };
        this._extEl = null;
        host.replaceChildren(fr);
        return;
      }
    }
    if (!el) {
      const pc = panel.config._panel_custom;
      try {
        if (!customElements.get(pc.name)) {
          if (pc.module_url) await import(pc.module_url);
          else await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = pc.js_url; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
          await Promise.race([customElements.whenDefined(pc.name), new Promise((_, rej) => setTimeout(() => rej(new Error("Zeitüberschreitung")), 15000))]);
        }
      } catch (err) {
        host.innerHTML = `<div class="glass empty" style="margin:20px">${icon("mdi:alert")}Panel „${esc(panel.title || up)}“ konnte nicht geladen werden: ${esc(err.message || err)}</div>`;
        return;
      }
      el = document.createElement(pc.name);
      this._extCache.set(up, el);
    }
    if (this._view !== "extern" || this._arg !== up || !host.isConnected) return;
    el.panel = panel;
    el.narrow = !!this._isNarrow;
    el.route = this._extRoute();
    el.hass = this._hass;
    installNavGuard();
    window.__hvEmbed = { owner: this, up, base: this._base, active: () => this.isConnected && this._view === "extern" && this._arg === up };
    this._extEl = el;
    if (el.parentNode !== host) host.replaceChildren(el);
    // Hat das Panel beim Einhängen selbst die Adresse geändert, aktuelle Route nachreichen
    const r = this._extRoute();
    if (!el.route || el.route.path !== r.path) el.route = r;
  }

  _renderView(view) {
    const d = isDense(this._layout);
    switch (view) {
      case "raum": return d ? this._vRoomDense(this._arg) : this._vRoom(this._arg);
      case "licht": return d ? this._vLightsDense() : this._vLights();
      case "beschattung": return d ? this._vCoversDense() : this._vCovers();
      case "klima": return d ? this._vClimateDense() : this._vClimate();
      case "energie": return this._vEnergy();
      case "sicherheit": return d ? this._vSecurityDense() : this._vSecurity();
      case "alarme": return this._vAlarme();
      case "batterien": return d ? this._vBatteriesDense() : this._vBatteries();
      case "einstellungen": return this._vSettings();
      case "extern": return `<div class="extwrap"><div class="extload">${icon("mdi:loading", "spin")}Lade …</div></div>`;
      default: return this._vOverview();
    }
  }

  /* ---------- Alarmmanager ---------- */
  _vAlarme() {
    const tab = this._alTab || "leitstelle";
    return `<div class="ptitle"><h1>Alarme</h1><span class="sp"></span>
      <div class="altabs">${[["leitstelle", "Leitstelle", "mdi:monitor-dashboard"], ["protokoll", "Protokoll", "mdi:timeline-clock-outline"]].map(([k, t, i]) =>
        `<button class="altab${tab === k ? " on" : ""}" data-act="al-tab" data-tab="${k}">${icon(i)}<span>${t}</span></button>`).join("")}</div></div>
      <div class="alpage" data-u="alarmpage"></div>`;
  }

  _renderAlarmPage(el) {
    const h = this._hass, tab = this._alTab || "leitstelle";
    const all = evalAlertsAll(h, this._model, this._layout);
    const minute = Math.floor(Date.now() / 60000);
    const sig = JSON.stringify([tab, this._isNarrow, this._alSel, minute, ALARMS && ALARMS.rev, ALARMS && ALARMS.mode, all.map((a) => [a.key, a.status, a.escalated, a.title, a.detail, a.ack_by, a.mute_until, a.level]),
      tab === "protokoll" ? [this._alLvl, this._alDays, this._alLog && this._alLog.at] : 0]);
    if (el._sig === sig) return;
    el._sig = sig;
    el.innerHTML = tab === "protokoll" ? this._alProtocolHTML() : this._alLeitstelleHTML(all);
  }

  _alLeitstelleHTML(all) {
    const h = this._hass;
    const open = all.filter((a) => a.status !== "stumm"), muted = all.filter((a) => a.status === "stumm");
    if (this._alSel && !all.some((a) => a.key === this._alSel)) this._alSel = null;
    const sel = all.find((a) => a.key === this._alSel) || (this._isNarrow ? null : open[0] || muted[0]);
    const row = (a) => {
      const since = sinceTs(h, a);
      return `<div class="alrow ${a.level} st-${a.status}${sel && sel.key === a.key ? " sel" : ""}" data-act="al-sel" data-key="${esc(a.key)}" role="button" tabindex="0">
        <span class="alsw ack">${icon("mdi:check")}Quittieren</span><span class="alsw mute">1 h stumm${icon("mdi:bell-off-outline")}</span>
        <span class="alin"><span class="alic">${icon(a.icon || LEVEL_ICON[a.level])}</span><span class="altx"><span class="alti">${esc(a.title)}</span>
        <span class="alsu">${LEVEL_TXT[a.level]} · seit ${durTxt(Date.now() / 1000 - since)}${a.escalated && a.status === "neu" ? ` · <em class="esc">eskaliert</em>` : ""}${a.status !== "neu" ? ` · <em>${esc(statusTxt(a))}</em>` : ""}</span></span>
        ${a.status === "neu" ? `<button class="alq" data-act="al-ack" data-key="${esc(a.key)}" title="Quittieren">${icon("mdi:check")}</button>` : ""}</span></div>`;
    };
    const anyNew = open.some((a) => a.status === "neu");
    const list = `<div class="glass alcol allist">
      <div class="alh">${icon("mdi:bell-ring-outline")}<span>Aktiv</span><span class="cnt">${open.length}</span><span class="sp"></span>
        ${anyNew && open.length > 1 ? `<button class="pbtn sm" data-act="al-ackall">${icon("mdi:check-all")}<span>Alle quittieren</span></button>` : ""}</div>
      ${open.length ? open.map(row).join("") : `<div class="alok">${icon("mdi:shield-check")}<b>Alles in Ordnung</b><span>Keine offenen Meldungen</span></div>`}
      ${muted.length ? `<div class="alh sub">${icon("mdi:bell-off-outline")}<span>Stumm</span><span class="cnt">${muted.length}</span></div>${muted.map(row).join("")}` : ""}
      ${this._isNarrow && open.length ? `<div class="alhint">Nach rechts wischen = quittieren · nach links = 1 h stumm</div>` : ""}
    </div>`;
    const detail = sel ? this._alDetailHTML(sel) : this._isNarrow ? "" : `<div class="glass alcol aldetail alempty">${icon("mdi:gesture-tap")}<span>Meldung auswählen</span></div>`;
    return `<div class="algrid">${list}${detail}${this._alSideHTML()}</div>`;
  }

  _alDetailHTML(a) {
    const h = this._hass, since = sinceTs(h, a);
    const area = a.eid ? this._model.eidArea.get(a.eid) : a.to && a.to.startsWith("raum/") ? this._model.areas.get(a.to.slice(5)) : null;
    const target = a.to ? `data-act="go" data-to="${esc(a.to)}"` : a.eid ? `data-act="more" data-eid="${esc(a.eid)}"` : "";
    const isLock = a.key.startsWith("lock:") && a.eid && isOn(h.states[a.eid]);
    const btns = a.status === "stumm"
      ? `<button class="pbtn" data-act="al-unmute" data-key="${esc(a.key)}">${icon("mdi:bell-outline")}<span>Stummschaltung aufheben</span></button>`
      : `${a.status === "neu" ? `<button class="pbtn primary" data-act="al-ack" data-key="${esc(a.key)}">${icon("mdi:check")}<span>Quittieren</span></button>` : ""}
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-min="60">${icon("mdi:bell-off-outline")}<span>1 h stumm</span></button>
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-until="morning">${icon("mdi:weather-night")}<span>Bis morgen 7 Uhr</span></button>
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-until="resolved">${icon("mdi:bell-cancel-outline")}<span>Bis behoben</span></button>`;
    const hist = ((ALARMS && ALARMS.log) || []).filter((e) => e.key === a.key).slice(-8).reverse();
    return `<div class="glass alcol aldetail ${a.level}">
      ${this._isNarrow ? `<button class="alclose" data-act="al-sel" data-key="" title="Schließen">${icon("mdi:close")}</button>` : ""}
      <div class="aldh"><span class="ssic">${icon(a.icon || LEVEL_ICON[a.level])}</span><div class="aldt"><div class="alt">${esc(a.title)}</div>
        <div class="ald"><span class="lvl ${a.level}">${LEVEL_TXT[a.level]}</span> seit ${clockOf(since)} · ${durTxt(Date.now() / 1000 - since)}</div></div></div>
      <div class="alinfo">${a.detail ? `<div>${icon("mdi:information-outline")}<span>${esc(a.detail)}</span></div>` : ""}
        ${area ? `<div>${icon(area.icon || "mdi:floor-plan")}<span>${esc(area.name)}</span></div>` : ""}
        ${a.escalated ? `<div class="alstat esc">${icon("mdi:alarm-light-outline")}<span>eskaliert um ${clockOf(a.escalated)}</span></div>` : ""}
        <div class="alstat st-${a.status}">${icon(a.status === "neu" ? "mdi:bell-ring-outline" : a.status === "quittiert" ? "mdi:check-circle-outline" : "mdi:bell-off-outline")}<span>${esc(a.status === "neu" ? "Noch nicht quittiert" : statusTxt(a))}</span></div></div>
      <div class="albtns">${btns}</div>
      <div class="albtns sec">${target ? `<button class="pbtn" ${target}>${icon("mdi:open-in-app")}<span>${a.to && a.to.startsWith("raum/") ? "Raum öffnen" : a.to ? "Seite öffnen" : "Details"}</span></button>` : ""}
        ${isLock ? `<button class="pbtn" data-act="al-lock" data-eid="${esc(a.eid)}">${icon("mdi:lock")}<span>Verriegeln</span></button>` : ""}</div>
      ${hist.length ? `<div class="alsub">Verlauf dieser Meldung</div><div class="lglist">${hist.map((e) => logRow(e, false)).join("")}</div>` : ""}
    </div>`;
  }

  _alSideHTML() {
    const h = this._hass, t = (ALARMS && ALARMS.today) || { alarm: 0, warn: 0, info: 0 };
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const today = ((ALARMS && ALARMS.log) || []).filter((e) => e.ts * 1000 >= start.getTime()).slice(-8).reverse();
    const panels = Object.keys(h.states).filter((e) => dom(e) === "alarm_control_panel");
    return `<div class="alside">${this._hmCardHTML()}
      <div class="glass alcol"><div class="alh">${icon("mdi:calendar-today")}<span>Heute</span></div>
        <div class="alkpi">${[["alarm", "Alarme"], ["warn", "Warnungen"], ["info", "Hinweise"]].map(([k, l]) => `<div class="k ${k}${t[k] ? " n" : ""}"><b>${t[k] || 0}</b><span>${l}</span></div>`).join("")}</div></div>
      ${panels.length ? `<div class="glass alcol"><div class="alh">${icon("mdi:shield-home-outline")}<span>Alarmanlage</span></div>${panels.map((e) => {
        const st = h.states[e];
        return `<button class="alarmo st-${esc(st.state)}" data-act="more" data-eid="${esc(e)}">${icon(st.state === "disarmed" ? "mdi:shield-off-outline" : st.state === "triggered" ? "mdi:alarm-light" : "mdi:shield-lock")}<span class="an">${esc(entName(h, e))}</span><span class="as">${esc(ALARMO_TXT[st.state] || st.state)}</span></button>`;
      }).join("")}</div>` : ""}
      <div class="glass alcol"><div class="alh">${icon("mdi:history")}<span>Verlauf heute</span><span class="sp"></span><button class="pbtn sm" data-act="al-tab" data-tab="protokoll"><span>Protokoll</span>${icon("mdi:chevron-right")}</button></div>
        ${today.length ? `<div class="lglist">${today.map((e) => logRow(e)).join("")}</div>` : `<div class="alnone">Heute noch nichts passiert</div>`}</div>
    </div>`;
  }

  _hmCardHTML() {
    const H = this._layout.house_mode || {};
    if (H.enabled === false) return "";
    const M = (ALARMS && ALARMS.mode) || { mode: "zuhause" };
    const md = M.mode || "zuhause", h = this._hass;
    const arms = (k) => H.alarmo_sync && ["arm_home", "arm_night", "arm_away", "arm_vacation"].includes((H.arm || {})[k]);
    const pst = M.panel && h.states[M.panel];
    return `<div class="glass alcol hmcard m-${md}"><div class="alh">${icon(MODE_ICON[md])}<span>Hausmodus</span><span class="sp"></span><b class="hmnow">${MODE_NAME[md]}</b></div>
      <div class="hmseg">${HOUSE_MODES.map(([k, t, i]) => `<button class="hmb${k === md ? " on" : ""}" data-act="hm-set" data-mode="${k}"${arms(k) && k !== md ? ' data-confirm="1"' : ""}>${icon(i)}<span>${t}</span></button>`).join("")}</div>
      <div class="hminfo">${M.since ? `seit ${clockOf(M.since)}${dayOf(M.since) !== "Heute" ? ` (${dayOf(M.since)})` : ""} · ${esc(M.by || "Automatik")}` : "Automatik"}</div>
      ${M.away_pending ? `<div class="hminfo warn">${icon("mdi:timer-sand")}Alle weg – gleich „Abwesend“</div>` : ""}
      ${pst ? `<div class="hminfo">${icon(pst.state === "disarmed" ? "mdi:shield-off-outline" : "mdi:shield-lock")}${esc(entName(h, M.panel))}: ${esc(ALARMO_TXT[pst.state] || pst.state)}${M.sync ? " · gekoppelt" : " · nicht gekoppelt"}</div>` : ""}
      ${H.auto_away || H.auto_night ? `<div class="hminfo dim">${icon("mdi:robot-outline")}${[H.auto_away ? "Abwesend, wenn alle weg sind" : "", H.auto_night ? `Nacht ${H.night_start}–${H.night_end}` : ""].filter(Boolean).join(" · ")}</div>` : ""}
    </div>`;
  }

  _alProtocolHTML() {
    const days = this._alDays || 7, lvl = this._alLvl || "";
    const L = this._alLog;
    if (!L || L.days !== days || (ALARMS && L.rev !== ALARMS.rev)) this._alFetchLog(days);
    const chips = (items, cur, act, key) => items.map(([v, t]) => `<button class="altab sm${String(cur) === String(v) ? " on" : ""}" data-act="${act}" data-${key}="${v}"><span>${t}</span></button>`).join("");
    const filters = `<div class="alfilter"><div class="altabs">${chips([["", "Alle"], ["alarm", "Alarme"], ["warn", "Warnungen"], ["info", "Hinweise"]], lvl, "al-lvl", "lvl")}</div>
      <div class="altabs">${chips([[1, "Heute"], [7, "7 Tage"], [30, "30 Tage"]], days, "al-days", "days")}</div></div>`;
    if (!L || !L.log) return `${filters}<div class="glass empty">${icon("mdi:loading", "spin")}Lade Protokoll …</div>`;
    const log = L.log.filter((e) => !lvl || e.level === lvl).slice().reverse();
    let day = "", tl = "";
    for (const e of log.slice(0, 400)) {
      const d = dayOf(e.ts);
      if (d !== day) { day = d; tl += `<div class="lgday">${esc(d)}</div>`; }
      tl += logRow(e);
    }
    const stats = (L.stats || []).filter((x) => !lvl || x.level === lvl);
    return `${filters}<div class="algrid proto">
      <div class="glass alcol"><div class="alh">${icon("mdi:timeline-clock-outline")}<span>Ereignisse</span><span class="cnt">${log.length}</span></div>
        ${log.length ? `<div class="lglist">${tl}</div>` : `<div class="alnone">Keine Ereignisse im gewählten Zeitraum</div>`}</div>
      <div class="glass alcol"><div class="alh">${icon("mdi:chart-bar")}<span>Häufigste Meldungen</span></div>
        ${stats.length ? stats.map((x) => {
          const v = x.verdacht || (x.n >= 5 ? ["häufig"] : []);
          const info = [x.avg != null ? `Ø ${durTxt(x.avg)}` : "", x.short ? `${x.short}× unter 1 Min.` : "", x.acked != null ? (x.acked ? `${x.acked}× quittiert` : "nie quittiert") : ""].filter(Boolean).join(" · ");
          return `<div class="alstatrow ${x.level}${v.length ? " sus" : ""}"><span class="n">${x.n}×</span><span class="t">${esc(x.title)}${info ? `<small>${esc(info)}</small>` : ""}</span>${v.length ? `<span class="fa" title="${esc(`Möglicher Fehlalarm: ${v.join(", ")}`)}">prüfen</span>` : ""}</div>`;
        }).join("") : `<div class="alnone">Keine Meldungen</div>`}
        <div class="alhint">„prüfen“ = möglicher Fehlalarm: häufig (ab 5×), mehrfach nach weniger als 1 Minute wieder weg oder nie quittiert. Abhilfe: Mindestdauer in der Regel („ab … min“), Regel auf Hausmodi beschränken oder Sensor prüfen.</div></div>
    </div>`;
  }

  async _alFetchLog(days) {
    if (this._alLogBusy === days) return;
    this._alLogBusy = days;
    try {
      const r = await this._hass.callWS({ type: `${DOMAIN}/alarm_log`, days });
      this._alLog = { days, rev: ALARMS && ALARMS.rev, at: Date.now(), log: (r.log || []).slice().sort((a, b) => a.ts - b.ts), stats: r.stats || [] };
    } catch (err) {
      this._alLog = { days, rev: ALARMS && ALARMS.rev, at: Date.now(), log: [], stats: [] };
    }
    this._alLogBusy = null;
    this._alRefresh();
  }

  _alRefresh() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('[data-u="alarmpage"], [data-u="alerts"], [data-u="navbadge"], [data-k="alerts"], [data-u="hmode"], [data-u="focus"]').forEach((el) => UPD[el.dataset.u].run(el, this));
  }

  _onAlarms(snap) {
    // Neuer Alarm weckt das Wandpanel
    if (this._saverOn && this._wallCfg().wake_alarm) {
      const neu = (s) => new Set(Object.values((s && s.alarms) || {}).filter((a) => a.status === "neu" && a.level === "alarm").map((a) => a.key));
      const old = neu(ALARMS);
      if ([...neu(snap)].some((k) => !old.has(k))) { this._wallActive = Date.now(); this._saverHide(); }
    }
    if (this._saverOn) this._saverDirty = true;
    const mutedKeys = (s) => Object.values((s && s.alarms) || {}).filter((a) => a.status === "stumm").map((a) => a.key).sort().join("|");
    const before = mutedKeys(ALARMS);
    setAlarms(snap);
    // Stumm geschaltet/aufgehoben ändert, welche Räume im Aktiv-Fokus erscheinen → einmal neu aufbauen
    if (before !== mutedKeys(snap) && this._model) { this._dirty = true; this._schedule(); return; }
    this._alRefresh();
  }

  async _alCall(data, okMsg) {
    try {
      const r = await this._hass.callWS({ type: `${DOMAIN}/alarm_action`, ...data });
      if (r && r.alarm && ALARMS && r.alarm.key) this._onAlarms({ ...ALARMS, alarms: { ...ALARMS.alarms, [r.alarm.key]: r.alarm } });
      if (okMsg) this._toast(okMsg);
    } catch (err) {
      this._toast(err && err.code === "not_found" ? "Die Meldung ist nicht mehr aktiv." : `Fehlgeschlagen: ${err && err.message ? err.message : err}`);
    }
  }

  /* Wischen auf dem Handy: rechts = quittieren, links = 1 h stumm */
  _alSwipeStart(e) {
    const row = e.target.closest && e.target.closest(".alrow");
    if (!row || e.target.closest("button") || !this._isNarrow) return;
    this._alSw = { row, x0: e.clientX, y0: e.clientY, dx: 0, active: false, id: e.pointerId };
  }
  _alSwipeMove(e) {
    const s = this._alSw;
    if (!s) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { this._alSw = null; return; }
      if (Math.abs(dx) < 12) return;
      s.active = true;
      s.row.classList.add("swiping");
      try { s.row.setPointerCapture(s.id); } catch (err) { /* egal */ }
    }
    s.dx = Math.max(-140, Math.min(140, dx));
    s.row.style.setProperty("--sx", `${s.dx}px`);
    s.row.classList.toggle("go-ack", s.dx > 80 && !s.row.classList.contains("st-quittiert"));
    s.row.classList.toggle("go-mute", s.dx < -80);
  }
  _alSwipeEnd() {
    const s = this._alSw;
    this._alSw = null;
    if (!s || !s.active) return;
    this._alSwiped = Date.now();
    s.row.classList.remove("swiping", "go-ack", "go-mute");
    s.row.style.removeProperty("--sx");
    const key = s.row.dataset.key;
    if (s.dx > 80 && !s.row.classList.contains("st-quittiert") && !s.row.classList.contains("st-stumm")) this._alCall({ key, action: "ack" }, "Quittiert");
    else if (s.dx < -80 && !s.row.classList.contains("st-stumm")) this._alCall({ key, action: "mute", minutes: 60 }, "1 Stunde stumm");
  }

  _topbar() {
    const h = this._hass;
    const weather = Object.keys(h.states).find((e) => e.startsWith("weather."));
    const persons = Object.keys(h.states).filter((e) => e.startsWith("person.")).slice(0, 6);
    const pers = persons.map((e) => {
      const st = h.states[e];
      const pic = st.attributes.entity_picture;
      const initials = (st.attributes.friendly_name || e.slice(7)).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      return `<button class="person" data-u="person" data-eid="${esc(e)}" data-act="more">${pic ? `<img src="${esc(pic)}" alt="">` : esc(initials)}</button>`;
    }).join("");
    return `<div class="top">
      <button class="menu" data-act="menu">${icon("mdi:menu")}</button>
      <div><div class="greet"></div><div class="clock"></div><div class="date"></div></div>
      <span class="sp"></span>
      ${weather ? `<button class="weather glass" data-u="weather" data-eid="${esc(weather)}" data-act="more">${icon("mdi:weather-partly-cloudy")}<div><div class="wt"></div><div class="wc"></div></div></button>` : ""}
      ${pers ? `<div class="persons">${pers}</div>` : ""}
    </div>`;
  }

  _topbarDense() {
    const h = this._hass;
    const weather = Object.keys(h.states).find((e) => e.startsWith("weather."));
    const persons = Object.keys(h.states).filter((e) => e.startsWith("person.")).slice(0, 6);
    const pers = persons.map((e) => {
      const st = h.states[e];
      const pic = st.attributes.entity_picture;
      const initials = (st.attributes.friendly_name || e.slice(7)).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      return `<button class="person" data-u="person" data-eid="${esc(e)}" data-act="more">${pic ? `<img src="${esc(pic)}" alt="">` : esc(initials)}</button>`;
    }).join("");
    const hm = this._layout.house_mode && this._layout.house_mode.enabled !== false
      ? `<button class="hmode" data-u="hmode" data-act="go" data-to="alarme" title="Hausmodus">${icon("mdi:home-account")}<span class="hml"></span></button>` : "";
    const right = `<div class="hright">${hm}
      ${weather ? `<button class="weather glass" data-u="weather" data-eid="${esc(weather)}" data-act="more">${icon("mdi:weather-partly-cloudy")}<span class="wt"></span></button>` : ""}
      ${pers ? `<div class="persons stack">${pers}</div>` : ""}</div>`;
    const menu = `<button class="menu" data-act="menu">${icon("mdi:menu")}</button>`;
    const clock = `<div class="clockbox"><div class="clock"></div><div class="date"></div></div>`;
    const spec = [["alerts", "alarme"], ["lights", "licht"], ["contacts", "sicherheit"], ["covers", "beschattung"], ["temp", "klima"], ["heat", "klima"], ["batt", "batterien"], ["unav", ""]];
    switch (this._layout.header_style || "kompakt") {
      case "kompakt":
        return `<div class="dtop hk">${menu}${clock}<div class="kchips">${spec.map(([k, to]) => `<button class="kchip" data-u="kchip" data-k="${k}" data-act="go" data-to="${to}">${icon("mdi:circle")}<span class="ct"></span></button>`).join("")}</div>${right}</div>`;
      case "satz":
        return `<div class="dtop hs">${menu}${clock}<div class="hsatz" data-u="hsatz"><div class="greet"></div><div class="htext"></div></div>
          <div class="chips alerts">${[["alerts", "alarme"], ["batt", "batterien"], ["unav", ""]].map(([k, to]) => `<button class="chip" data-u="chip" data-k="${k}" data-act="go" data-to="${to}"><span class="ic">${icon("mdi:circle")}</span><span class="ct"></span></button>`).join("")}</div>${right}</div>`;
      case "leiste":
        return `<div class="hbar glass">${menu}${clock}<div class="kpis">${spec.map(([k, to]) => `<button class="kpi" data-u="kpi" data-k="${k}" data-act="go" data-to="${to}"><span class="kic">${icon("mdi:circle")}</span><span class="kv"></span><span class="kl"></span></button>`).join("")}</div>${right}</div>`;
      default:
        return `<div class="dtop">${menu}${clock}${this._chips()}${right}</div>`;
    }
  }

  _chips() {
    const spec = [["alerts", "alarme"], ["lights", "licht"], ["contacts", "sicherheit"], ["covers", "beschattung"], ["temp", "klima"], ["heat", "klima"], ["batt", "batterien"], ["unav", ""]];
    return `<div class="chips">${spec.map(([k, to]) => `<button class="chip" data-u="chip" data-k="${k}" data-act="go" data-to="${to}"><span class="ic">${icon("mdi:circle")}</span><span class="ct"></span></button>`).join("")}</div>`;
  }

  /* ---------- Übersicht: Hausschnitt ---------- */
  _vOverview() {
    const m = this._model, L = this._layout, h = this._hass;
    if (!m.visibleAreas.length) {
      return `${this._topbar()}<div class="glass empty" style="margin-top:20px">${icon("mdi:floor-plan")}
        Noch keine Bereiche gefunden.<br>Lege unter Einstellungen → Bereiche, Etagen & Labels deine Räume an und ordne die Geräte zu – die Haus Visualisierung baut sich dann von selbst auf.</div>`;
    }
    const fav = (L.favorites || []).filter((e) => h.states[e]);
    // Automatisch: Cockpit auf großen Bildschirmen, Aktiv-Fokus auf dem Handy
    const ov = !L.overview_style || L.overview_style === "auto" ? (this._isNarrow ? "fokus" : "cockpit") : L.overview_style;
    if (isDense(L) && ov === "cockpit") return this._ovCockpit(fav);
    if (isDense(L) && ov === "spalten") return this._ovSpalten(fav);
    if (isDense(L) && ov === "fokus") return this._ovFokus(fav);
    if (isDense(L)) {
      const tabs = this._isNarrow ? (this._floorTab && m.floors.some((f) => f.id === this._floorTab) ? this._floorTab : m.floors[0].id) : null;
      return `${this._topbarDense()}${alertsCardHTML("slim")}${houseHTML(m, L, h, { dense: true, tab: tabs })}
        ${fav.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${fav.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
    }
    return `${this._topbar()}${this._chips()}
      ${houseHTML(m, L, this._hass)}
      ${fav.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="tiles">${fav.map((e) => tileHTML(h, e, null)).join("")}</div></div>` : ""}`;
  }

  /* ---------- Raumseite ---------- */
  _vRoom(id) {
    const m = this._model, h = this._hass;
    const a = m.areas.get(id);
    if (!a) return `<div class="empty">${icon("mdi:help-circle-outline")}Bereich „${esc(id)}“ nicht gefunden.<br><br><button class="pbtn" data-act="go" data-to="">Zur Übersicht</button></div>`;
    const floor = m.floors.find((f) => f.areas.includes(a));
    const list = m.visibleAreas;
    const idx = list.indexOf(a);
    const prev = idx > 0 ? list[idx - 1] : null, next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    const pic = a.picture ? `<div class="pic" style="background-image:url('${esc(a.picture)}')"></div>` : "";

    const sections = [];
    if (a.pins.length) sections.push(sectionHTML(h, a, "pins", a.pins, "Angeheftet", "mdi:pin"));
    for (const [k] of GROUPS) {
      const eids = a.groups[k];
      if (!eids || !eids.length) continue;
      if (k === "sensor") {
        const rest = eids.filter((e) => e !== a.tempId && e !== a.humId);
        if (!rest.length) continue;
        sections.push(sectionHTML(h, a, k, rest));
      } else sections.push(sectionHTML(h, a, k, eids));
    }
    if (a.batteries.length) sections.push(sectionHTML(h, a, "batt", a.batteries, "Batterien", "mdi:battery-heart-variant"));

    return `<div class="hero glass" data-u="hero" data-area="${esc(a.id)}">${pic}
      <div class="hero-top">
        <button class="iconbtn" data-act="go" data-to="" title="Übersicht">${icon("mdi:arrow-left")}</button>
        <span class="crumb">${esc(floor ? floor.name : "")}</span><span class="sp"></span>
        ${prev ? `<button class="iconbtn" data-act="go" data-to="raum/${esc(prev.id)}" title="${esc(prev.name)}">${icon("mdi:chevron-left")}</button>` : ""}
        ${next ? `<button class="iconbtn" data-act="go" data-to="raum/${esc(next.id)}" title="${esc(next.name)}">${icon("mdi:chevron-right")}</button>` : ""}
      </div>
      <div class="hero-main">
        <div><h1>${icon(a.icon)}${esc(a.name)}</h1>
          <div class="hero-clim"><span class="ht"></span><span class="hh"></span></div>
          <div class="hero-badges"></div></div>
        <div class="hero-acts">
          ${a.lights.length ? `<button class="pbtn hl" data-act="area-lights" data-area="${esc(a.id)}">${icon("mdi:lightbulb-group")}<span>Licht</span></button>` : ""}
          ${a.covers.length ? `<button class="pbtn" data-act="area-covers" data-svc="open_cover" data-area="${esc(a.id)}">${icon("mdi:arrow-up")}Auf</button>
            <button class="pbtn" data-act="area-covers" data-svc="close_cover" data-area="${esc(a.id)}">${icon("mdi:arrow-down")}Zu</button>` : ""}
        </div>
      </div></div>
      ${this._techCards(a)}
      ${this._layout.show_trends !== false ? trendCardHTML(a) : ""}
      ${sections.length ? `<div class="sections">${sections.join("")}</div>` : `<div class="glass empty">${icon("mdi:package-variant")}In diesem Bereich sind noch keine Geräte.</div>`}`;
  }

  _techCards(a) {
    const T = this._model.tech || {};
    return `${T.heat && T.heat.area === a.id ? heatCardHTML(a) : ""}${T.wb && T.wb.area === a.id ? wbCardHTML(a) : ""}`;
  }

  /* ---------- Kategorieseiten ---------- */
  _byFloor(kind, pick, extraHead) {
    const m = this._model, h = this._hass;
    let out = "";
    for (const f of m.floors) {
      const rooms = f.areas.map((a) => [a, pick(a)]).filter(([, e]) => e.length);
      if (!rooms.length) continue;
      const all = rooms.flatMap(([, e]) => e);
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span>${extraHead ? extraHead(all) : ""}</div>
        <div class="sgrid">${rooms.map(([a, e]) => sectionHTML(h, a, kind, e, a.name, a.icon, true)).join("")}</div>`;
    }
    return out;
  }

  _vLights() {
    const all = this._model.agg.lights;
    if (!all.length) return pageEmpty("Licht", "mdi:lightbulb-off-outline", "Keine Lichter in den Bereichen gefunden.");
    return `<div class="ptitle"><h1>Licht</h1><span class="psub" data-u="chip" data-k="lights"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>
      <button class="pbtn" data-act="lights-off" data-eids="${esc(all.join(","))}">${icon("mdi:lightbulb-off-outline")}Alle aus</button></div>
      ${this._byFloor("light", (a) => a.lights, (e) => `<button class="pbtn" data-act="lights-off" data-eids="${esc(e.join(","))}">${icon("mdi:lightbulb-off-outline")}Etage aus</button>`)}`;
  }

  _vCovers() {
    const all = this._model.agg.covers.concat(this._model.visibleAreas.flatMap((a) => a.covers).filter((e) => !this._model.agg.covers.includes(e)));
    if (!all.length) return pageEmpty("Beschattung", "mdi:window-shutter", "Keine Rollos, Jalousien oder Markisen gefunden.");
    const btns = (e) => `<button class="pbtn" data-act="list-covers" data-svc="open_cover" data-eids="${esc(e.join(","))}">${icon("mdi:arrow-up")}Auf</button>
      <button class="pbtn" data-act="list-covers" data-svc="close_cover" data-eids="${esc(e.join(","))}">${icon("mdi:arrow-down")}Zu</button>`;
    return `<div class="ptitle"><h1>Beschattung</h1><span class="psub" data-u="chip" data-k="covers"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>${btns(this._model.agg.covers)}</div>
      ${this._byFloor("cover", (a) => a.covers, btns)}`;
  }

  _vClimate() {
    const m = this._model, h = this._hass;
    const rooms = m.visibleAreas.filter((a) => a.tempId || a.climates.length);
    if (!rooms.length) return pageEmpty("Klima", "mdi:thermometer-off", "Keine Temperatur-Sensoren oder Thermostate in den Bereichen gefunden.");
    const tr = this._layout.show_trends !== false;
    let out = `<div class="ptitle"><h1>Klima</h1><span class="psub" data-u="chip" data-k="temp"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span></div>
      ${tr && climRooms(m).length ? climTrendHTML() : ""}`;
    for (const f of m.floors) {
      const list = f.areas.filter((a) => a.tempId || a.climates.length);
      if (!list.length) continue;
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span></div><div class="rooms" style="padding:0">${list.map((a) => roomTileHTML(a, true, { spark: tr && !!a.tempId })).join("")}</div>`;
      const cl = list.filter((a) => a.climates.length);
      if (cl.length) out += `<div class="sgrid" style="margin-top:14px">${cl.map((a) => sectionHTML(h, a, "climate", a.climates, a.name, a.icon, true)).join("")}</div>`;
    }
    return out;
  }

  /* ---------- Energie ---------- */
  _vEnergy() {
    const c = this._model.energy;
    if (!c) return pageEmpty("Energie", "mdi:lightning-bolt-outline", "Keine Energiedaten gefunden. Unter Einstellungen → Darstellung → „Energie“ PV-Leistung, Netz, Hausverbrauch oder Speicher eintragen.");
    const L = this._layout, T = this._model.tech || {};
    const solar = (L.links || []).find((l) => l.path && /(solar|pv|energ)/i.test(`${l.path} ${l.title}`));
    const tr = L.show_trends !== false;
    return `<div class="ptitle"><h1>Energie</h1><span class="psub ensub"><span class="ct"></span></span><span class="sp"></span>
      ${solar ? `<button class="pbtn" data-act="link" data-path="${esc(solar.path)}">${icon(solar.icon || "mdi:solar-power-variant")}${esc(solar.title)}</button>` : ""}</div>
      <div class="engrid">${energyFlowHTML(c)}${enDayHTML(tr)}</div>
      ${tr ? enTrendHTML(c) : ""}
      ${T.wb ? wbCardHTML(this._model.areas.get(T.wb.area) || { id: "" }) : ""}`;
  }

  _vSecurity() {
    const m = this._model, h = this._hass;
    const contacts = (a) => a.contacts;
    const locks = m.visibleAreas.flatMap((a) => (a.groups.lock || []).map((e) => [a, e]));
    const safety = m.visibleAreas.flatMap((a) => (a.groups.safety || []).map((e) => [a, e]));
    const pres = m.visibleAreas.flatMap((a) => a.presence.map((e) => [a, e]));
    const cams = m.visibleAreas.flatMap((a) => (a.groups.camera || []).map((e) => [a, e]));
    if (!m.agg.contacts.length && !locks.length && !safety.length && !pres.length && !cams.length)
      return pageEmpty("Sicherheit", "mdi:shield-off-outline", "Keine Fenster-/Türkontakte, Schlösser, Melder oder Kameras gefunden.");
    const flat = (title, ic, pairs) => pairs.length ? `<div class="section glass"><div class="shead">${icon(ic)}<span class="st">${title}</span></div>
      <div class="tiles">${pairs.map(([a, e]) => tileHTML(h, e, a, { sub: a.name })).join("")}</div></div>` : "";
    const camLink = (this._layout.links || []).find((l) => /protect|kamera|camera/i.test(`${l.path} ${l.title}`));
    return `<div class="ptitle"><h1>Sicherheit</h1><span class="psub" data-u="chip" data-k="contacts"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>
        ${camLink ? `<button class="pbtn" data-act="link" data-path="${esc(camLink.path)}">${icon(camLink.icon || "mdi:cctv")}${esc(camLink.title)}</button>` : ""}</div>
      <div class="sgrid">${flat("Melder & Alarm", "mdi:smoke-detector-variant", safety)}${flat("Schlösser", "mdi:lock", locks)}${flat("Bewegung & Präsenz", "mdi:motion-sensor", pres)}${flat("Kameras", "mdi:cctv", cams)}</div>
      ${this._byFloor("contact", contacts)}`;
  }

  _vBatteries() {
    const m = this._model, h = this._hass, L = this._layout;
    const list = m.batteries.filter((b) => !b.areaId || !L.hidden_areas.includes(b.areaId))
      .map((b) => ({ ...b, v: dom(b.eid) === "binary_sensor" ? (isOn(h.states[b.eid]) ? 0 : 100) : num(h.states[b.eid]) }))
      .sort((x, y) => (x.v ?? 101) - (y.v ?? 101));
    if (!list.length) return pageEmpty("Batterien", "mdi:battery-unknown", "Keine Batterie-Sensoren gefunden.");
    const crit = list.filter((b) => b.v !== null && b.v < L.battery_critical);
    const low = list.filter((b) => b.v !== null && b.v >= L.battery_critical && b.v < L.battery_low);
    const ok = list.filter((b) => b.v === null || b.v >= L.battery_low);
    const sec = (title, ic, items) => items.length ? `<div class="section glass"><div class="shead">${icon(ic)}<span class="st">${title}</span><span class="gc">${items.length}</span></div>
      <div class="tiles">${items.map((b) => tileHTML(h, b.eid, m.areas.get(b.areaId), { sub: (m.areas.get(b.areaId) || {}).name || "Ohne Bereich" })).join("")}</div></div>` : "";
    return `<div class="ptitle"><h1>Batterien</h1><span class="psub">${list.length} Geräte · kritisch unter ${L.battery_critical} %, schwach unter ${L.battery_low} %</span></div>
      <div class="sgrid">${sec("Kritisch", "mdi:battery-alert-variant-outline", crit)}${sec("Schwach", "mdi:battery-30", low)}${sec("In Ordnung", "mdi:battery-check", ok)}</div>`;
  }

  /* ---------- Übersicht: Varianten ---------- */
  _floorBody(f) {
    const big = f.outdoor ? [] : f.areas.filter(isBigRoom), small = f.outdoor ? f.areas : f.areas.filter((a) => !isBigRoom(a));
    return `${big.length ? `<div class="rooms">${big.map((a) => roomTileHTML(a)).join("")}</div>` : ""}${small.length ? `<div class="rchips">${small.map(roomChipHTML).join("")}</div>` : ""}`;
  }
  _floorHead(f) {
    return `<div class="cfhead"><span class="cfn">${esc(f.name)}</span><span class="sp"></span><span class="fstat"><span class="fl-lw">${icon("mdi:lightbulb-on-outline")}<span class="fl-l"></span></span><span class="fl-t"></span></span></div>`;
  }
  _quickBtns(cls = "qbtn") {
    const m = this._model;
    const l = esc(m.agg.lights.join(",")), c = esc(m.agg.covers.join(","));
    return `${m.agg.lights.length ? `<button class="${cls}" data-act="lights-off" data-confirm="1" data-eids="${l}">${icon("mdi:lightbulb-off-outline")}<span>Alle Lichter aus</span></button>` : ""}
      ${m.agg.covers.length ? `<button class="${cls}" data-act="list-covers" data-svc="open_cover" data-confirm="1" data-eids="${c}">${icon("mdi:window-shutter-open")}<span>Rollos auf</span></button>
      <button class="${cls}" data-act="list-covers" data-svc="close_cover" data-confirm="1" data-eids="${c}">${icon("mdi:window-shutter")}<span>Rollos zu</span></button>` : ""}`;
  }
  _sceneChips(fav) {
    const h = this._hass;
    return fav.filter((e) => ["scene", "script"].includes(dom(e))).map((e) => `<button class="schip" data-act="run" data-confirm="1" data-eid="${esc(e)}">${icon(dom(e) === "script" ? "mdi:script-text-play" : "mdi:palette")}<span>${esc(entName(h, e))}</span></button>`).join("");
  }
  _ebar(fav) {
    const pills = energyPills(this._layout, this._hass);
    return `<div class="ebar glass"><span class="ebar-e" data-u="roof" data-act="roof"><span class="sun">${icon("mdi:white-balance-sunny")}</span>${pills}</span>
      <span class="sp"></span>${this._sceneChips(fav)}${this._quickBtns("pbtn sm")}</div>`;
  }

  _ovCockpit(fav) {
    const m = this._model, L = this._layout, h = this._hass;
    const H = L.header || {};
    const rows = [["pv", "mdi:solar-power-variant", "PV"], ["battery", "mdi:battery", "Akku"], ["power", "mdi:home-lightning-bolt-outline", "Haus"], ["grid", "mdi:transmission-tower", "Netz"]]
      .filter(([k]) => H[k] && h.states[H[k]]).map(([k, i, t]) => `<div class="erow ep-${k}">${icon(i)}<span class="el">${t}</span><b></b></div>`).join("");
    const other = fav.filter((e) => !["scene", "script"].includes(dom(e)));
    const scenes = this._sceneChips(fav);
    return `${this._topbarDense()}
      <div class="cockpit">
        <div class="cmain">${m.floors.map((f) => `<section class="cfloor glass${f.outdoor ? " out" : ""}" data-u="floor" data-floor="${esc(f.id)}">${this._floorHead(f)}<div class="fbody">${this._floorBody(f)}</div></section>`).join("")}</div>
        <aside class="cside">
          ${alertsCardHTML()}
          ${rows ? `<div class="glass ecard" data-u="roof" data-act="roof"><div class="qhead"><span class="sun">${icon("mdi:white-balance-sunny")}</span>Energie<span class="sp"></span>${icon("mdi:chevron-right")}</div>${rows}</div>` : ""}
          <div class="glass qcard"><div class="qhead">${icon("mdi:gesture-tap")}Schnellzugriff</div><div class="qbtns">${this._quickBtns()}</div>${scenes ? `<div class="qscenes">${scenes}</div>` : ""}</div>
          ${other.length ? `<div class="glass qcard"><div class="qhead">${icon("mdi:star")}Favoriten</div><div class="rows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}
        </aside>
      </div>`;
  }

  _ovSpalten(fav) {
    const m = this._model, h = this._hass;
    const other = fav.filter((e) => !["scene", "script"].includes(dom(e)));
    return `${this._topbarDense()}${this._ebar(fav)}${alertsCardHTML("slim")}
      <div class="fcols">${m.floors.map((f) => `<section class="fcol glass${f.outdoor ? " out" : ""}" data-u="floor" data-floor="${esc(f.id)}">${this._floorHead(f)}
        <div class="rrows">${f.areas.map(roomRowHTML).join("")}</div></section>`).join("")}</div>
      ${other.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
  }

  _ovFokus(fav) {
    const m = this._model, h = this._hass;
    const active = focusRooms(h, m, this._layout);
    const calm = m.floors.map((f) => [f, f.areas.filter((a) => !active.includes(a))]).filter(([, l]) => l.length);
    const other = fav.filter((e) => !["scene", "script"].includes(dom(e)));
    return `${this._topbarDense()}${alertsCardHTML("fokus")}${this._ebar(fav)}
      <div data-u="focus" data-ids="${esc(active.map((a) => a.id).join(","))}">
        ${active.length
          ? `<div class="secttitle">${icon("mdi:flash")}Jetzt aktiv<span class="gc">${active.length} ${active.length === 1 ? "Raum" : "Räume"}</span></div><div class="factive">${active.map((a) => roomTileHTML(a, true, { act: true })).join("")}</div>`
          : `<div class="glass calm">${icon("mdi:weather-night")}<div><b>Alles ruhig</b><small>Keine Lichter an, alle Fenster zu, keine Bewegung.</small></div></div>`}
        ${calm.length ? `<div class="secttitle">${icon("mdi:home-outline")}Übrige Räume</div><div class="glass fcalm">${calm.map(([f, l]) => `<div class="crow2"><span class="cfl">${esc(f.short || f.name)}</span><div class="rchips">${l.map(roomChipHTML).join("")}</div></div>`).join("")}</div>` : ""}
      </div>
      ${other.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
  }

  /* ---------- Kompakt-Seiten ---------- */
  _vRoomDense(id) {
    const m = this._model, h = this._hass;
    const a = m.areas.get(id);
    if (!a) return this._vRoom(id);
    const floor = m.floors.find((f) => f.areas.includes(a));
    const list = m.visibleAreas, idx = list.indexOf(a);
    const prev = idx > 0 ? list[idx - 1] : null, next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    const pic = a.picture ? `<div class="pic" style="background-image:url('${esc(a.picture)}')"></div>` : "";
    const g = (k) => a.groups[k] || [];
    const pinCtrl = a.pins.filter((e) => CTRL_DOMAINS.has(dom(e)) && !["scene", "script"].includes(dom(e)));
    const values = [
      ...a.pins.filter((e) => !CTRL_DOMAINS.has(dom(e))),
      ...g("sensor").filter((e) => e !== a.tempId && e !== a.humId), ...g("energy"),
      ...g("contact"), ...g("presence"), ...g("safety").filter((e) => dom(e) === "binary_sensor"),
    ];
    const scenes = [...a.pins.filter((e) => ["scene", "script"].includes(dom(e))), ...g("scene")];
    const sec = [];
    if (pinCtrl.length) sec.push(rowsSectionHTML(h, a, "pins", pinCtrl, "Angeheftet", "mdi:pin"));
    for (const k of ["light", "climate", "cover", "media", "switch", "lock", "device", "camera"]) if (g(k).length) sec.push(rowsSectionHTML(h, a, k, g(k)));
    const alarm = g("safety").filter((e) => dom(e) !== "binary_sensor");
    if (alarm.length) sec.push(rowsSectionHTML(h, a, "safety", alarm));
    if (g("other").length) sec.push(rowsSectionHTML(h, a, "other", g("other"), null, null, { collapsed: true }));
    if (a.batteries.length) sec.push(rowsSectionHTML(h, a, "batt", a.batteries, "Batterien", "mdi:battery-heart-variant", { collapsed: true }));
    return `<div class="hero slim glass" data-u="hero" data-area="${esc(a.id)}">${pic}
      <div class="hrow">
        <button class="iconbtn" data-act="go" data-to="" title="Übersicht">${icon("mdi:arrow-left")}</button>
        <h1>${icon(a.icon)}${esc(a.name)}</h1>
        <span class="hero-clim"><span class="ht"></span><span class="hh"></span></span>
        <span class="crumb">${esc(floor ? floor.short || floor.name : "")}</span>
        <div class="hero-badges"></div>
        <span class="sp"></span>
        ${scenes.map((e) => `<button class="schip" data-act="run" data-eid="${esc(e)}">${icon(dom(e) === "script" ? "mdi:script-text-play" : "mdi:palette")}${esc(entName(h, e, a))}</button>`).join("")}
        ${a.lights.length ? `<button class="pbtn hl" data-act="area-lights" data-area="${esc(a.id)}">${icon("mdi:lightbulb-group")}<span>Licht</span></button>` : ""}
        ${a.covers.length ? `<button class="pbtn" data-act="area-covers" data-svc="open_cover" data-area="${esc(a.id)}" title="Rollos auf">${icon("mdi:arrow-up")}</button><button class="pbtn" data-act="area-covers" data-svc="close_cover" data-area="${esc(a.id)}" title="Rollos zu">${icon("mdi:arrow-down")}</button>` : ""}
        ${prev ? `<button class="iconbtn pn" data-act="go" data-to="raum/${esc(prev.id)}" title="${esc(prev.name)}">${icon("mdi:chevron-left")}</button>` : ""}
        ${next ? `<button class="iconbtn pn" data-act="go" data-to="raum/${esc(next.id)}" title="${esc(next.name)}">${icon("mdi:chevron-right")}</button>` : ""}
      </div></div>
      ${values.length ? `<div class="vstrip">${values.map((e) => vchipHTML(h, e, a)).join("")}</div>` : ""}
      ${this._techCards(a)}
      ${this._layout.show_trends !== false ? trendCardHTML(a) : ""}
      ${sec.length ? `<div class="sections">${sec.join("")}</div>` : (values.length ? "" : `<div class="glass empty">${icon("mdi:package-variant")}In diesem Bereich sind noch keine Geräte.</div>`)}`;
  }

  _listByFloor(kind, pick, extraHead) {
    const m = this._model, h = this._hass;
    let out = "";
    for (const f of m.floors) {
      const rooms = f.areas.map((a) => [a, pick(a)]).filter(([, e]) => e.length);
      if (!rooms.length) continue;
      const all = rooms.flatMap(([, e]) => e);
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span>${extraHead ? extraHead(all) : ""}</div>
        <div class="glass rlist">${rooms.map(([a, e]) => {
          const list = esc(e.join(","));
          const acts = kind === "light" ? `<button class="gbtn" data-act="list-lights" data-eids="${list}">${icon("mdi:lightbulb-group")}<span></span></button>`
            : kind === "cover" ? `<button class="gbtn" data-act="list-covers" data-svc="open_cover" data-eids="${list}">${icon("mdi:arrow-up")}</button><button class="gbtn" data-act="list-covers" data-svc="close_cover" data-eids="${list}">${icon("mdi:arrow-down")}</button>` : "";
          return `<div class="rgroup"><div class="rsub" data-u="gcount" data-kind="${kind}" data-eids="${list}">${icon(a.icon)}<span class="st" data-act="go" data-to="raum/${esc(a.id)}">${esc(a.name)}</span><span class="gc"></span><span class="sp"></span>${acts}</div>
            <div class="rows">${e.map((x) => rowHTML(h, x, a)).join("")}</div></div>`;
        }).join("")}</div>`;
    }
    return out;
  }

  _vLightsDense() {
    const all = this._model.agg.lights;
    if (!all.length) return pageEmpty("Licht", "mdi:lightbulb-off-outline", "Keine Lichter in den Bereichen gefunden.");
    return `<div class="ptitle"><h1>Licht</h1><span class="psub" data-u="chip" data-k="lights"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>
      <button class="pbtn${this._onlyOn ? " on" : ""}" data-act="only-on">${icon("mdi:filter-variant")}Nur eingeschaltete</button>
      <button class="pbtn" data-act="lights-off" data-eids="${esc(all.join(","))}">${icon("mdi:lightbulb-off-outline")}Alle aus</button></div>
      <div class="lwrap${this._onlyOn ? " only-on" : ""}">${this._listByFloor("light", (a) => a.lights, (e) => `<button class="pbtn" data-act="lights-off" data-eids="${esc(e.join(","))}">${icon("mdi:lightbulb-off-outline")}Etage aus</button>`)}</div>`;
  }

  _vCoversDense() {
    const m = this._model;
    const all = m.visibleAreas.flatMap((a) => a.covers);
    if (!all.length) return pageEmpty("Beschattung", "mdi:window-shutter", "Keine Rollos, Jalousien oder Markisen gefunden.");
    const btns = (e) => `<button class="pbtn" data-act="list-covers" data-svc="open_cover" data-eids="${esc(e.join(","))}">${icon("mdi:arrow-up")}Auf</button>
      <button class="pbtn" data-act="list-covers" data-svc="close_cover" data-eids="${esc(e.join(","))}">${icon("mdi:arrow-down")}Zu</button>`;
    return `<div class="ptitle"><h1>Beschattung</h1><span class="psub" data-u="chip" data-k="covers"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>${btns(m.agg.covers)}</div>
      ${this._listByFloor("cover", (a) => a.covers, btns)}`;
  }

  _vClimateDense() {
    const m = this._model, h = this._hass;
    const rooms = m.visibleAreas.filter((a) => a.tempId || a.climates.length);
    if (!rooms.length) return pageEmpty("Klima", "mdi:thermometer-off", "Keine Temperatur-Sensoren oder Thermostate in den Bereichen gefunden.");
    const tr = this._layout.show_trends !== false;
    let out = `<div class="ptitle"><h1>Klima</h1><span class="psub" data-u="chip" data-k="temp"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span>
      <span class="psub" data-u="chip" data-k="heat"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span></div>
      ${tr && climRooms(m).length ? climTrendHTML() : ""}`;
    for (const f of m.floors) {
      const list = f.areas.filter((a) => a.tempId || a.climates.length);
      if (!list.length) continue;
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span></div><div class="glass ktable${tr ? " withspark" : ""}">
        <div class="khead"><span>Raum</span><span>Ist</span><span>Feuchte</span>${tr ? "<span>24 h</span>" : ""}<span>Thermostat</span></div>
        ${list.map((a) => {
          const cl = a.climates[0];
          const cell = cl ? `<div class="tile row climate kcell" data-u="tile" data-eid="${esc(cl)}" data-act="more" data-long="1"><span class="tic">${icon("mdi:thermostat")}</span>
              <span class="rbtns"><button class="btn" data-act="clim" data-step="-1" data-eid="${esc(cl)}" title="Kälter">${icon("mdi:minus")}</button><span class="ttarget"></span><button class="btn" data-act="clim" data-step="1" data-eid="${esc(cl)}" title="Wärmer">${icon("mdi:plus")}</button></span>
              <span class="tstate"></span></div>` : `<span class="kna">–</span>`;
          return `<div class="krow" data-u="room" data-area="${esc(a.id)}"><span class="kname" data-act="go" data-to="raum/${esc(a.id)}">${icon(a.icon)}${esc(a.name)}</span><span class="rt"></span><span class="rh"></span>${tr ? sparkHTML(a) : ""}${cell}</div>`;
        }).join("")}</div>`;
    }
    return out;
  }

  _vSecurityDense() {
    const m = this._model, h = this._hass;
    const pairs = (k, filter = () => true) => m.visibleAreas.flatMap((a) => (a.groups[k] || []).filter(filter).map((e) => [a, e]));
    const contacts = pairs("contact"), safety = pairs("safety"), locks = pairs("lock"), pres = pairs("presence"), cams = pairs("camera");
    if (!contacts.length && !safety.length && !locks.length && !pres.length && !cams.length)
      return pageEmpty("Sicherheit", "mdi:shield-off-outline", "Keine Fenster-/Türkontakte, Schlösser, Melder oder Kameras gefunden.");
    const camLink = (this._layout.links || []).find((l) => /protect|kamera|camera/i.test(`${l.path} ${l.title}`));
    const sec = (title, ic, list, collapsed) => {
      if (!list.length) return "";
      const rows = `<div class="rows">${list.map(([a, e]) => rowHTML(h, e, a, { sub: a.name })).join("")}</div>`;
      const head = `${icon(ic)}<span class="st">${title}</span><span class="gc">${list.length}</span><span class="sp"></span>${collapsed ? icon("mdi:chevron-down", "chev") : ""}`;
      return collapsed ? `<details class="section glass"><summary class="shead">${head}</summary>${rows}</details>` : `<div class="section glass"><div class="shead">${head}</div>${rows}</div>`;
    };
    return `<div class="ptitle"><h1>Sicherheit</h1><span class="sp"></span>
        ${camLink ? `<button class="pbtn" data-act="link" data-path="${esc(camLink.path)}">${icon(camLink.icon || "mdi:cctv")}${esc(camLink.title)}</button>` : ""}</div>
      ${alertsCardHTML("wide")}
      <div class="sgrid">${sec("Melder & Alarm", "mdi:smoke-detector-variant", safety)}${sec("Schlösser", "mdi:lock", locks)}${sec("Bewegung & Präsenz", "mdi:motion-sensor", pres)}
        ${sec("Fenster & Türen", "mdi:window-closed-variant", contacts, true)}</div>
      ${cams.length ? `<div class="secttitle">${icon("mdi:cctv")}Kameras</div><div class="glass"><div class="tiles">${cams.map(([a, e]) => tileHTML(h, e, a)).join("")}</div></div>` : ""}`;
  }

  _vBatteriesDense() {
    const m = this._model, h = this._hass, L = this._layout;
    const list = m.batteries.filter((b) => !b.areaId || !L.hidden_areas.includes(b.areaId))
      .map((b) => ({ ...b, v: dom(b.eid) === "binary_sensor" ? (isOn(h.states[b.eid]) ? 0 : 100) : num(h.states[b.eid]) }))
      .sort((x, y) => (x.v ?? 101) - (y.v ?? 101));
    if (!list.length) return pageEmpty("Batterien", "mdi:battery-unknown", "Keine Batterie-Sensoren gefunden.");
    const crit = list.filter((b) => b.v !== null && b.v < L.battery_critical);
    const low = list.filter((b) => b.v !== null && b.v >= L.battery_critical && b.v < L.battery_low);
    const ok = list.filter((b) => b.v === null || b.v >= L.battery_low);
    const sec = (title, ic, items, collapsed) => {
      if (!items.length) return "";
      const rows = `<div class="rows">${items.map((b) => rowHTML(h, b.eid, m.areas.get(b.areaId), { sub: (m.areas.get(b.areaId) || {}).name || "Ohne Bereich" })).join("")}</div>`;
      const head = `${icon(ic)}<span class="st">${title}</span><span class="gc">${items.length}</span><span class="sp"></span>${collapsed ? icon("mdi:chevron-down", "chev") : ""}`;
      return collapsed ? `<details class="section glass"><summary class="shead">${head}</summary>${rows}</details>` : `<div class="section glass"><div class="shead">${head}</div>${rows}</div>`;
    };
    return `<div class="ptitle"><h1>Batterien</h1><span class="psub">${list.length} Geräte · kritisch unter ${L.battery_critical} %, schwach unter ${L.battery_low} %</span></div>
      <div class="sgrid">${sec("Kritisch", "mdi:battery-alert-variant-outline", crit)}${sec("Schwach", "mdi:battery-30", low)}${sec("In Ordnung", "mdi:battery-check", ok, true)}</div>`;
  }

  /* ---------- Einstellungen ---------- */
  _vSettings() {
    const h = this._hass;
    if (!this._draft) this._draft = structuredClone(this._layout);
    const D = this._draft;
    const m = buildModel(h, { ...D, hidden_areas: [] });
    const allIds = Object.keys(h.states).sort();
    const opt = (e) => `<option value="${esc(e)}">${esc(h.states[e].attributes.friendly_name || "")}</option>`;
    const tab0 = this._settingsTab();
    const dlAll = tab0 === "raeume" || tab0 === "alarme" || tab0 === "technik" ? `<datalist id="dl-all">${allIds.map(opt).join("")}</datalist>` : "";
    const dlSensor = tab0 === "darstellung" ? `<datalist id="dl-sensor">${allIds.filter((e) => e.startsWith("sensor.")).map(opt).join("")}</datalist>` : "";
    const chip = (e, del) => `<span class="pin sitem" data-sort-id="${esc(e)}" data-drag title="Ziehen zum Sortieren">${esc(h.states[e] ? entName(h, e) : e)}<button ${del} data-eid="${esc(e)}" title="Entfernen">${icon("mdi:close")}</button></span>`;
    const pinChips = (list, area) => list.map((e) => chip(e, `data-act="s-pin-del" data-area="${esc(area)}"`)).join("");

    const tab = this._settingsTab();
    const floorBlock = (f) => {
      const many = f.areas.length > 1;
      const rows = f.areas.map((a) => {
        const hidden = D.hidden_areas.includes(a.id);
        const pins = D.pins[a.id] || [];
        const open = this._openArea === a.id;
        return `<div class="sitem" data-sort-id="${esc(a.id)}"><div class="srow${hidden ? " hiddenarea" : ""}">
            ${many ? dragHandle(`${a.name} verschieben`) : ""}${icon(a.icon)}<span class="lbl">${esc(a.name)}<small>${a.lights.length} Lichter · ${a.covers.length} Rollos · ${pins.length} Pins</small></span>
            <button class="sbtn${open ? " on" : ""}" data-act="s-area-open" data-area="${esc(a.id)}" title="Raum-Pins">${icon("mdi:pin")}</button>
            <button class="sbtn" data-act="s-area-hide" data-area="${esc(a.id)}" title="${hidden ? "Einblenden" : "Ausblenden"}">${icon(hidden ? "mdi:eye-off" : "mdi:eye")}</button>
          </div>
          ${open ? `<div class="srow sub">${pins.length ? `<div class="pins sortl" data-sort="pins" data-area="${esc(a.id)}" data-axis="x">${pinChips(pins, a.id)}</div>` : '<span class="lbl"><small>Noch keine Pins.</small></span>'}</div>
            <div class="srow sub"><input class="inp w" list="dl-all" placeholder="Entität anheften, z. B. sensor.kamin_temperatur" data-pin-input="${esc(a.id)}">
            <button class="pbtn" data-act="s-pin-add" data-area="${esc(a.id)}">${icon("mdi:plus")}Anheften</button></div>` : ""}</div>`;
      }).join("");
      const real = !f.virtual, groupCount = m.floors.filter((x) => !x.virtual && floorGroup(x) === floorGroup(f)).length;
      return `<div class="sitem flb" data-sort-id="${esc(f.id)}"><div class="fl-title">${real && groupCount > 1 ? dragHandle(`Etage ${f.name} verschieben`) : ""}${esc(f.name)}
          ${real ? `<button class="sbtn${f.outdoor ? " on" : ""}" data-act="s-floor-outdoor" data-floor="${esc(f.id)}" title="Als Außenbereich darstellen">${icon("mdi:pine-tree")}</button>` : ""}
        </div><div class="sortl" data-sort="areas" data-floor="${esc(f.id)}">${rows}</div></div>`;
    };
    // Der Hausschnitt hält Geschosse, Keller und Außen getrennt – gezogen wird innerhalb dieser Gruppen
    const floorsHTML = tab !== "raeume" ? "" : ["upper", "lower", "outdoor"].map((g) => {
      const fl = m.floors.filter((f) => !f.virtual && floorGroup(f) === g);
      return fl.length ? `<div class="sortl" data-sort="floors" data-group="${g}">${fl.map(floorBlock).join("")}</div>` : "";
    }).join("") + m.floors.filter((f) => f.virtual).map(floorBlock).join("");

    const favs = D.favorites || [];
    const links = (D.links || []).map((l, i) => `<div class="srow sitem" data-sort-id="${i}">${D.links.length > 1 ? dragHandle("Verknüpfung verschieben") : ""}
        <input class="inp" style="width:130px" data-set="links.${i}.title" value="${esc(l.title)}" placeholder="Titel">
        <input class="inp" style="width:190px" data-set="links.${i}.icon" value="${esc(l.icon)}" placeholder="mdi:solar-power-variant">
        <input class="inp w" data-set="links.${i}.path" value="${esc(l.path)}" placeholder="/solar-visualisierung">
        <select class="inp lmode" data-set="links.${i}.mode" title="Darstellung der verknüpften Seite">${[["theme", "Haus-Farben"], ["embed", "Original-Farben"], ["open", "Eigene Seite"]].map(([k, t]) => `<option value="${k}" ${linkMode(l) === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button class="sbtn danger" data-act="s-link-del" data-i="${i}" title="Entfernen">${icon("mdi:delete-outline")}</button></div>`).join("");
    const sw = (key, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span>
      <label class="tgl"><input type="checkbox" data-set="${key}" data-bool="1" ${D[key] ? "checked" : ""}><span></span></label></div>`;
    const ent = (key, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span>
      <input class="inp w" list="dl-sensor" data-set="header.${key}" value="${esc(D.header[key] || "")}" placeholder="sensor.…"></div>`;
    const views = [["overview", "Übersicht"], ...NAV.slice(1).map(([k, t]) => [k, t])];

    const tabs = SET_TABS.map(([k, t, i]) => `<button class="altab stab${tab === k ? " on" : ""}${this._tabDirty(k) ? " dirty" : ""}" data-act="s-tab" data-tab="${k}">${icon(i)}<span>${t}</span><i></i></button>`).join("");
    let body = "";
    if (tab === "raeume") body = `${dlAll}
      <div class="set glass"><h2>${icon("mdi:floor-plan")}Etagen & Bereiche</h2>
        <p class="hint">Die Struktur kommt aus Home Assistant (Einstellungen → Bereiche, Etagen & Labels). Hier legst du nur Reihenfolge (am Griff ziehen), Sichtbarkeit und Raum-Pins fest. Keller und Außenbereiche bleiben im Hausschnitt unten. Entitäten mit dem Label <b>no-dboard</b> werden ausgeblendet.</p>
        ${floorsHTML || '<p class="hint">Keine Bereiche vorhanden.</p>'}</div>
      <div class="set glass"><h2>${icon("mdi:star")}Favoriten</h2>
        <p class="hint">Erscheinen auf der Übersicht unter dem Hausschnitt.</p>
        <div class="srow">${favs.length ? `<div class="pins sortl" style="padding-left:0" data-sort="favorites" data-axis="x">${favs.map((e) => chip(e, 'data-act="s-fav-del"')).join("")}</div>` : '<span class="lbl"><small>Noch keine Favoriten.</small></span>'}</div>
        <div class="srow"><input class="inp w" list="dl-all" placeholder="Entität hinzufügen" data-fav-input="1"><button class="pbtn" data-act="s-fav-add">${icon("mdi:plus")}Hinzufügen</button></div></div>`;
    else if (tab === "alarme") body = `${dlAll}
      ${this._setMode(D)}
      ${this._setAlerts(D)}
      ${this._setActions(D)}`;
    else if (tab === "technik") body = `${dlAll}
      ${this._setTech(D)}`;
    else if (tab === "meldungen") body = `
      ${this._setPush(D)}
      ${this._setBell(D)}`;
    else body = `${dlSensor}
      ${this._setWall(D)}
      <div class="set glass"><h2>${icon("mdi:tune-variant")}Darstellung</h2>
        ${sw("confirm_quick", "Schnellzugriff bestätigen", "Abfrage vor „Alle Lichter aus“, „Rollos auf/zu“ und Szenen im Schnellzugriff")}
        ${sw("glass", "Glas-Effekt", "Weichzeichner hinter Karten; auf schwachen Tablets ausschalten")}
        ${sw("show_trends", "Verläufe (Raumseiten und Klima)", "Temperatur und Luftfeuchte der letzten 24 Stunden aus dem Recorder")}
        ${sw("show_energy_sensors", "Energie-Sensoren in Räumen", "Leistung, Energie, Strom, Spannung")}
        ${sw("show_other", "Bereich „Weitere“", "Auswahlen, Zahlen und Tasten")}
        <div class="srow"><span class="lbl">Darstellung<small>Kompakt: mehr auf einen Blick · Komfort: große Kacheln fürs Wandpanel</small></span><select class="inp" data-set="density"><option value="kompakt" ${D.density !== "komfort" ? "selected" : ""}>Kompakt</option><option value="komfort" ${D.density === "komfort" ? "selected" : ""}>Komfort</option></select></div>
        <div class="srow"><span class="lbl">Kopfzeile<small>nur in „Kompakt“</small></span><select class="inp" data-set="header_style">${[["kompakt", "Kompakt (Symbol + Zahl)"], ["chips", "Chips mit Text"], ["satz", "Satz + Hinweise"], ["leiste", "Kennzahlen-Leiste"]].map(([k, t]) => `<option value="${k}" ${(D.header_style || "kompakt") === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="srow"><span class="lbl">Übersicht<small>nur in „Kompakt“ · Automatisch: Cockpit ab 760 px Breite, darunter Aktiv-Fokus</small></span><select class="inp" data-set="overview_style">${[["auto", "Automatisch (Cockpit / Aktiv-Fokus)"], ["haus", "Hausschnitt"], ["cockpit", "Cockpit"], ["spalten", "Etagen-Spalten"], ["fokus", "Aktiv-Fokus"]].map(([k, t]) => `<option value="${k}" ${(D.overview_style || "auto") === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="srow"><span class="lbl">Startseite</span><select class="inp" data-set="start_view">${views.map(([k, t]) => `<option value="${k}" ${D.start_view === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="srow"><span class="lbl">Kamera-Standbilder<small>Sekunden zwischen zwei Bildern, nur sichtbare Kameras</small></span><input class="inp s" type="number" min="3" max="120" data-set="camera_interval" data-num="1" value="${D.camera_interval}"></div>
        <div class="srow"><span class="lbl">Batterie kritisch / schwach<small>in %</small></span>
          <input class="inp s" type="number" min="1" max="99" data-set="battery_critical" data-num="1" value="${D.battery_critical}">
          <input class="inp s" type="number" min="1" max="99" data-set="battery_low" data-num="1" value="${D.battery_low}"></div>
        <div class="srow"><span class="lbl">Ausblende-Labels<small>Label-IDs, durch Komma getrennt</small></span><input class="inp w" data-set="hide_labels" data-csv="1" value="${esc((D.hide_labels || []).join(", "))}"></div></div>
      <div class="set glass"><h2>${icon("mdi:solar-power-variant")}Energie</h2>
        <p class="hint">Diese Werte stehen im Dach des Hausschnitts und auf der Seite „Energie“ (Energiefluss, Bilanz heute, Verlauf 24 h; die Wallbox kommt aus Technik). Ein Tipp aufs Dach öffnet die Seite „Energie“; ohne Energiedaten die erste Verknüpfung.</p>
        ${ent("pv", "PV-Leistung", "z. B. sensor.growatt_modbus_…_pv_power")}
        ${ent("battery", "Akku-Ladestand", "in %")}
        ${ent("power", "Hausverbrauch", "z. B. dein AC-seitig berechneter Verbrauch")}
        ${ent("grid", "Netz", "positiv = Bezug, negativ = Einspeisung")}
        <div class="srow"><span class="lbl">Speicher-Leistung<small>positiv = Laden, negativ = Entladen; leer = automatisch</small></span>
          <input class="inp w" list="dl-sensor" data-set="energy.battery_power" value="${esc(D.energy.battery_power || "")}" placeholder="sensor.…"></div>
        <div class="srow"><span class="lbl">Netz: Vorzeichen umkehren<small>wenn dein Zähler Einspeisung positiv meldet</small></span><label class="tgl"><input type="checkbox" data-set="energy.grid_invert" data-bool="1" ${D.energy.grid_invert ? "checked" : ""}><span></span></label></div>
        <div class="srow"><span class="lbl">Speicher: Vorzeichen umkehren<small>wenn dein Wechselrichter Entladen positiv meldet</small></span><label class="tgl"><input type="checkbox" data-set="energy.battery_invert" data-bool="1" ${D.energy.battery_invert ? "checked" : ""}><span></span></label></div>
        <div class="srow"><span class="lbl">Seite „Energie“ zeigen<small>in der Navigation, sobald Energiedaten da sind</small></span><label class="tgl"><input type="checkbox" data-set="energy.enabled" data-bool="1" ${D.energy.enabled !== false ? "checked" : ""}><span></span></label></div></div>
      <div class="set glass"><h2>${icon("mdi:link-variant")}Verknüpfungen</h2>
        <p class="hint">Erscheinen in der Navigation, z. B. Solar Visualisierung, Protect Visualisierung oder Solarthermie. Die Seiten öffnen sich innerhalb der Haus Visualisierung, die Navigation links bleibt. Layout und Inhalt bleiben wie im Original. „Haus-Farben“ übernimmt Hintergrund, Karten- und Textfarben der Haus Visualisierung, „Original-Farben“ lässt das Design der Seite unverändert, „Eigene Seite“ öffnet sie außerhalb. Funktioniert für eigene Panels (z. B. Solar, Protect, Solarthermie) und für Dashboards (z. B. <code>/dashboard-kameras</code>).</p>
        <div class="sortl" data-sort="links">${links}</div><div class="srow"><button class="pbtn" data-act="s-link-add">${icon("mdi:plus")}Verknüpfung hinzufügen</button></div></div>`;

    return `<div class="ptitle"><h1>Einstellungen</h1><span class="psub">Version ${VERSION} · gilt für alle Geräte</span><span class="sp"></span></div>
      <div class="altabs stabs" role="tablist">${tabs}</div>
      ${body}
      <div class="savebar glass"><span class="msg">${this._dirtySettings ? "Ungespeicherte Änderungen" : "Alles gespeichert"}</span>
        <button class="pbtn" data-act="s-reset">${icon("mdi:undo")}Verwerfen</button>
        <button class="pbtn primary" data-act="s-save">${icon("mdi:content-save")}Speichern</button></div>`;
  }

  _setWall(D) {
    const W = D.wallpanel, on = this._wallIsOn(), h = this._hass;
    const ids = Object.keys(h.states);
    const tg = (key, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><label class="tgl"><input type="checkbox" data-set="wallpanel.${key}" data-bool="1" ${W[key] ? "checked" : ""}><span></span></label></div>`;
    const nm = (key, label, hint, max) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><input class="inp s" type="number" min="0" max="${max}" data-set="wallpanel.${key}" data-num="1" value="${W[key]}"></div>`;
    const autoW = ids.find((e) => e.startsWith("weather."));
    return `<div class="set glass"><h2>${icon("mdi:tablet-dashboard")}Wandpanel</h2>
      <p class="hint">Für ein Tablet an der Wand: Vollbild ohne Seitenleiste, Bildschirmschoner mit Uhr, Wetter, Hausmodus und Meldungen, und nach einer Weile ohne Berührung zurück zur Startseite. Klingel, neue Alarme und ein Bewegungsmelder wecken das Panel.</p>
      <div class="srow walldev${on ? " on" : ""}"><span class="lbl">Dieses Gerät ist ein Wandpanel<small>gilt nur für diesen Browser und sofort – ohne Speichern; alternativ Adresse mit <code>?wandpanel=1</code> öffnen (z. B. im Kiosk-Browser)</small></span>
        <button class="pbtn${on ? " primary" : ""}" data-act="s-wall-device">${icon(on ? "mdi:check" : "mdi:tablet")}${on ? "Wandpanel an" : "Als Wandpanel nutzen"}</button></div>
      <div class="fl-title">Zeiten</div>
      ${nm("saver_min", "Bildschirmschoner nach", "Minuten ohne Berührung; 0 = nie", 240)}
      ${nm("black_min", "Danach schwarz nach", "weitere Minuten; 0 = nie (schont OLED-Bildschirme)", 600)}
      ${nm("return_min", "Zurück zur Startseite nach", "Minuten ohne Berührung; 0 = nie. Nicht bei ungespeicherten Einstellungen", 240)}
      <div class="fl-title">Verhalten</div>
      ${tg("fullscreen", "Vollbild", "beim ersten Tippen; Kiosk-Browser wie Fully Kiosk erledigen das selbst")}
      ${tg("hide_sidebar", "Seitenleiste von Home Assistant ausblenden", "nur auf Wandpanels; wird beim Ausschalten zurückgesetzt")}
      ${tg("wake_alarm", "Bei neuem Alarm aufwecken", "Klingel weckt immer")}
      ${tg("night_dim", "Nachts dunkler", "im Hausmodus Nacht und von 23 bis 6 Uhr")}
      <div class="srow"><span class="lbl">Wetter<small>leer = automatisch${autoW ? ` (${esc(autoW)})` : ""}</small></span><input class="inp w" list="dl-weather" data-set="wallpanel.weather" value="${esc(W.weather || "")}" placeholder="weather.…"></div>
      <div class="srow"><span class="lbl">Bewegungsmelder am Panel<small>weckt wie eine Berührung, z. B. binary_sensor.flur_bewegung</small></span><input class="inp w" list="dl-motion" data-set="wallpanel.wake_entity" value="${esc(W.wake_entity || "")}" placeholder="binary_sensor.…"></div>
      <div class="srow"><button class="pbtn" data-act="s-saver-test">${icon("mdi:power-sleep")}Bildschirmschoner zeigen</button><span class="lbl"><small>Tippen beendet ihn wieder.</small></span></div>
      <datalist id="dl-weather">${ids.filter((e) => e.startsWith("weather.")).map((e) => `<option value="${esc(e)}">`).join("")}</datalist>
      <datalist id="dl-motion">${ids.filter((e) => e.startsWith("binary_sensor.") && PRESENCE_DC.has(dc(h.states[e]))).map((e) => `<option value="${esc(e)}">`).join("")}</datalist>
    </div>`;
  }

  _setTech(D) {
    const h = this._hass, m = buildModel(h, { ...D, hidden_areas: [] }), T = m.tech;
    // automatisch erkannte Zuordnung (ohne eigene Einträge) für die Platzhalter
    const blankH = Object.fromEntries(Object.entries(D.heating).map(([k, v]) => [k, typeof v === "string" ? "" : k === "tank" ? [] : v]));
    const blankW = Object.fromEntries(Object.entries(D.wallbox).map(([k, v]) => [k, typeof v === "string" ? "" : v]));
    const auto = techCfg(h, { ...D, heating: { ...blankH, enabled: true }, wallbox: { ...blankW, enabled: true } }, m.areas);
    const AH = auto.heat || {}, AW = auto.wb || {};
    const areaName = (id) => (id && m.areas.get(id) ? m.areas.get(id).name : "–");
    const areaSel = (path, cur, autoId) => `<select class="inp" data-set="${path}"><option value="">Automatisch (${esc(areaName(autoId))})</option>${[...m.areas.values()].sort((a, b) => a.name.localeCompare(b.name, "de")).map((a) => `<option value="${esc(a.id)}" ${cur === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
    const fld = (sec, key, label, hint, autoV) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span>
      <input class="inp w" list="dl-all" data-set="${sec}.${key}" value="${esc(D[sec][key] || "")}" placeholder="${autoV ? `automatisch: ${esc(autoV)}` : "nicht gefunden – Entität eintragen"}"></div>`;
    const tg = (path, on, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><label class="tgl"><input type="checkbox" data-set="${path}" data-bool="1" ${on ? "checked" : ""}><span></span></label></div>`;
    const numf = (path, v, label, hint, min, max, step = 1) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><input class="inp s" type="number" min="${min}" max="${max}" step="${step}" data-set="${path}" data-num="1" value="${v}"></div>`;
    const H = D.heating, W = D.wallbox, eh = T.heat, ew = T.wb;
    const tank = eh ? eh.tank : [];
    const found = (c, parts) => (c ? `Erkannt: ${parts.filter(Boolean).join(" · ")}` : "Nichts erkannt.");
    const M = H.manual || {};
    return `<div class="set glass"><h2>${icon("mdi:heating-coil")}Heizung</h2>
      <p class="hint">Die Karte „Heizung“ erscheint auf der Raumseite des Heizungsraums: Speicher mit Schichtung und Ladung, Kamin mit Pumpe und die Heizkurve mit Betriebspunkt. Die Heizkurve kommt aus der Integration „Heizkurve Fußbodenheizung“ (Sensor mit Kurvenpunkten), sonst aus den Werten unten. Leere Felder = automatisch.</p>
      <p class="hint techfound">${esc(found(eh, [eh && `Raum ${areaName(eh.area)}`, tank.length && `${tank.length} Speicherfühler`, eh && eh.stove && "Kamin", eh && eh.curve && `Heizkurve ${eh.curve}`, eh && eh.mixer && "Mischer"]))}</p>
      ${tg("heating.enabled", H.enabled !== false, "Heizungs-Karte anzeigen")}
      <div class="srow"><span class="lbl">Raum<small>auf dessen Raumseite die Karte steht</small></span>${areaSel("heating.area", H.area, AH.area)}</div>
      <div class="fl-title">Speicher</div>
      <div class="srow">${tank.length ? `<div class="pins sortl" style="padding-left:0" data-sort="tank" data-axis="x">${tank.map((e) => `<span class="pin sitem" data-sort-id="${esc(e)}" data-drag title="Ziehen: von oben nach unten sortieren">${esc(entName(h, e))}<button data-act="s-tank-del" data-eid="${esc(e)}" title="Entfernen">${icon("mdi:close")}</button></span>`).join("")}</div>` : '<span class="lbl"><small>Keine Speicherfühler gefunden.</small></span>'}</div>
      <div class="srow"><input class="inp w" list="dl-all" placeholder="Fühler hinzufügen, z. B. sensor.speicher_oben" data-tank-input="1"><button class="pbtn" data-act="s-tank-add">${icon("mdi:plus")}Hinzufügen</button>
        ${H.tank && H.tank.length ? `<button class="pbtn" data-act="s-tank-auto">${icon("mdi:auto-fix")}Automatisch</button>` : ""}</div>
      <p class="hint">Reihenfolge von oben nach unten – am Chip ziehen. ${H.tank && H.tank.length ? "Eigene Auswahl." : "Automatisch: Temperaturfühler mit „Speicher“ oder „Puffer“ im Namen."}</p>
      <div class="srow"><span class="lbl">Speicher kalt / heiß<small>°C für Farbe und Ladung: kalt = 0 %, heiß = 100 %</small></span>
        <input class="inp s" type="number" min="0" max="90" data-set="heating.tank_min" data-num="1" value="${H.tank_min}"><span class="rl">bis</span>
        <input class="inp s" type="number" min="10" max="99" data-set="heating.tank_max" data-num="1" value="${H.tank_max}"></div>
      <div class="fl-title">Kamin</div>
      ${fld("heating", "stove", "Kamin-Temperatur", "", AH.stove)}
      ${fld("heating", "stove_pump", "Kamin-Pumpe", "Drehzahl in % oder Schalter", AH.pump)}
      ${numf("heating.stove_hot", H.stove_hot, "Kamin heizt ab", "°C", 20, 120)}
      <div class="fl-title">Heizkurve</div>
      ${fld("heating", "curve", "Heizkurve (Soll-Vorlauf)", "Sensor der Integration mit Attributen slope, level, curve …", AH.curve)}
      ${fld("heating", "flow", "Vorlauf Ist", "", AH.flow)}
      ${fld("heating", "outdoor", "Außentemperatur", "nur ohne Heizkurven-Sensor nötig", AH.outdoor)}
      ${fld("heating", "mixer", "Mischer-Stellgröße", "Sensor der Mischerregelung", AH.mixer)}
      ${tg("heating.manual_curve", H.manual_curve, "Heizkurve selbst berechnen", "ohne Integration: Werte unten, Formel wie in der Integration")}
      ${H.manual_curve || !(eh && eh.curve) ? `<div class="srow sub techman">
        ${[["slope", "Steilheit", 0.1, 3, 0.05], ["level", "Niveau K", -15, 15, 0.5], ["room", "Raum °C", 15, 28, 0.5], ["min", "Min °C", 15, 45, 1], ["max", "Max °C", 25, 70, 1], ["limit", "Heizgrenze °C", 5, 25, 1]]
          .map(([k, t, mn, mx, st]) => `<label class="tml"><small>${t}</small><input class="inp xs" type="number" min="${mn}" max="${mx}" step="${st}" data-set="heating.manual.${k}" data-num="1" value="${M[k]}"></label>`).join("")}</div>` : ""}
    </div>
    <div class="set glass"><h2>${icon("mdi:ev-station")}Wallbox</h2>
      <p class="hint">Die Karte „Wallbox“ erscheint auf der Raumseite der Einfahrt: Ladeleistung, Ladestand und Reichweite des Autos, geladene Energie, Lademodus (Aus, Sofort, Min + PV, PV) und Ziel-Ladestand. Passt zu EVCC und anderen Wallboxen. Leere Felder = automatisch.</p>
      <p class="hint techfound">${esc(found(ew, [ew && `Raum ${areaName(ew.area)}`, ew && ew.power && "Ladeleistung", ew && ew.mode && "Lademodus", ew && ew.soc && "Ladestand", ew && ew.limit && "Ziel"]))}</p>
      ${tg("wallbox.enabled", W.enabled !== false, "Wallbox-Karte anzeigen")}
      <div class="srow"><span class="lbl">Raum</span>${areaSel("wallbox.area", W.area, AW.area)}</div>
      ${fld("wallbox", "power", "Ladeleistung", "W oder kW", AW.power)}
      ${fld("wallbox", "mode", "Lademodus", "Auswahl (select)", AW.mode)}
      ${fld("wallbox", "soc", "Ladestand Auto", "%", AW.soc)}
      ${fld("wallbox", "limit", "Ziel-Ladestand", "number – in der Karte mit − / + änderbar", AW.limit)}
      ${fld("wallbox", "energy", "Geladen (Sitzung)", "kWh", AW.energy)}
      ${fld("wallbox", "range", "Reichweite", "km", AW.range)}
      ${fld("wallbox", "connected", "Fahrzeug angesteckt", "binary_sensor", AW.connected)}
      ${fld("wallbox", "charging", "Lädt", "binary_sensor", AW.charging)}
    </div>`;
  }

  _setBell(D) {
    const h = this._hass, B = D.doorbell;
    const ids = Object.keys(h.states).sort();
    const opt = (e) => `<option value="${esc(e)}">${esc(h.states[e].attributes.friendly_name || "")}</option>`;
    const saved = this._layout;
    this._layout = { ...this._layout, doorbell: { ...B, entity: "", camera: "" } };
    const autoBell = this._bellEntity(), autoCam = this._bellCamera();
    this._layout = saved; this._bellAuto = undefined;
    return `<datalist id="dl-bell">${ids.filter((e) => e.startsWith("event.") || e.startsWith("binary_sensor.")).map(opt).join("")}</datalist>
      <datalist id="dl-cam">${ids.filter((e) => e.startsWith("camera.")).map(opt).join("")}</datalist>
      <datalist id="dl-lock">${ids.filter((e) => /^(lock|switch|button|input_button|script|input_boolean)\./.test(e)).map(opt).join("")}</datalist>
      <div class="set glass"><h2>${icon("mdi:doorbell-video")}Klingel</h2>
      <p class="hint">Klingelt es, legt sich das Kamerabild über die gerade offene Seite der Haus Visualisierung – auf jedem Gerät, auf dem das Panel offen ist (z. B. Wandtablet). Mit „Live“, „Kameras öffnen“, optional „Tür öffnen“ und automatischem Schließen.</p>
      <div class="srow"><span class="lbl">Bei Klingeln Kamera einblenden</span><label class="tgl"><input type="checkbox" data-set="doorbell.enabled" data-bool="1" ${B.enabled ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Klingel<small>Ereignis- oder Binär-Entität; leer = automatisch${autoBell ? `: ${esc(autoBell)}` : " (nichts gefunden)"}</small></span><input class="inp w" list="dl-bell" data-set="doorbell.entity" value="${esc(B.entity)}" placeholder="${esc(autoBell || "event.…_doorbell")}"></div>
      <div class="srow"><span class="lbl">Kamera<small>leer = Kamera am selben Gerät${autoCam ? `: ${esc(autoCam)}` : ""}</small></span><input class="inp w" list="dl-cam" data-set="doorbell.camera" value="${esc(B.camera)}" placeholder="${esc(autoCam || "camera.…")}"></div>
      <div class="srow"><span class="lbl">Türöffner für „Tür öffnen“<small>optional; Schloss, Schalter (z. B. KNX-Türöffner), Taste oder Skript; muss zweimal getippt werden</small></span><input class="inp w" list="dl-lock" data-set="doorbell.lock" value="${esc(B.lock)}" placeholder="kein Türöffner"></div>
      ${B.lock && /^(switch|input_boolean)\./.test(B.lock) ? `<div class="srow"><span class="lbl">Impuls<small>Sekunden, nach denen der Schalter wieder ausgeschaltet wird; 0 = nur einschalten (z. B. bei Treppenhausfunktion)</small></span><input class="inp s" type="number" min="0" max="30" data-set="doorbell.pulse" data-num="1" value="${B.pulse ?? 2}"></div>` : ""}
      <div class="srow"><span class="lbl">Automatisch schließen nach<small>Sekunden; nach „Live“ oder „Tür öffnen“ bleibt es offen</small></span><input class="inp s" type="number" min="10" max="600" data-set="doorbell.timeout" data-num="1" value="${B.timeout}"></div>
      <div class="srow"><button class="pbtn" data-act="s-bell-test">${icon("mdi:bell-ring-outline")}Overlay testen</button><span class="lbl"><small>nutzt auch noch nicht gespeicherte Angaben; „Tür öffnen“ löst im Test wirklich aus</small></span></div>
    </div>`;
  }

  _setPush(D) {
    const P = D.push, info = this._pushInfo;
    if (!info && !this._pushLoading && this._hass.callWS) {
      this._pushLoading = true;
      this._hass.callWS({ type: `${DOMAIN}/push_info` }).then((r) => { this._pushInfo = r; }).catch(() => { this._pushInfo = { services: [], targets: [], active: [] }; })
        .finally(() => { this._pushLoading = false; if (this._view === "einstellungen") { this._dirty = true; this._flush(); } });
    }
    const tg = (key, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><label class="tgl"><input type="checkbox" data-set="${key}" data-bool="1" ${key.split(".").reduce((o, k) => o && o[k], D) ? "checked" : ""}><span></span></label></div>`;
    const services = info ? info.services.filter((x) => !["send_message", "persistent_notification"].includes(x)) : [];
    const auto = info ? info.targets : [];
    const targets = info ? (services.length ? services.map((sv) => `<label class="tchip${P.targets.includes(sv) ? " on" : ""}"><input type="checkbox" data-push-target="${esc(sv)}" ${P.targets.includes(sv) ? "checked" : ""}>${icon(sv.startsWith("mobile_app_") ? "mdi:cellphone" : "mdi:bell-outline")}${esc(sv)}</label>`).join("") : '<span class="lbl"><small>Keine notify-Dienste gefunden – ist die Companion-App eingerichtet?</small></span>') : '<span class="lbl"><small>Lade …</small></span>';
    return `<div class="set glass"><h2>${icon("mdi:cellphone-message")}Push-Benachrichtigungen</h2>
      <p class="hint">Home Assistant prüft die Warnungen im Hintergrund – auch wenn kein Panel offen ist – und schickt neue Warnungen, Alarme und Hinweise über die Companion-App aufs Handy. Ein Tipp auf die Meldung öffnet die passende Seite. Nach einem Neustart von Home Assistant werden bereits bestehende Warnungen still übernommen; Alarme kommen trotzdem.</p>
      ${tg("push.enabled", "Push-Benachrichtigungen senden")}
      <div class="fl-title">Empfänger</div>
      <div class="srow"><div class="tchips">${targets}</div></div>
      <p class="hint">${P.targets.length ? "Nur die markierten Dienste erhalten Meldungen." : `Keine Auswahl = alle Handys mit der Companion-App${auto.length ? `: ${auto.map(esc).join(", ")}` : ""}.`}</p>
      <div class="fl-title">Stufen</div>
      ${tg("push.levels.alarm", "Alarme", "z. B. Rauch- oder Wassermelder")}
      ${tg("push.critical", "Alarme als kritische Meldung", "laut, auch bei „Nicht stören“ (iOS: kritische Hinweise erlauben; Android: Kanal „alarm_stream“)")}
      ${tg("push.levels.warn", "Warnungen", "z. B. Fenster offen, Schloss entriegelt")}
      ${tg("push.levels.info", "Hinweise", "leise Meldung ohne Ton")}
      <div class="fl-title">Verhalten</div>
      <div class="srow"><span class="lbl">Wenn eine Warnung behoben ist<small>gilt für Warnungen, die gemeldet wurden</small></span>
        <select class="inp" data-set="push.resolved">${[["clear", "Meldung vom Handy entfernen"], ["notify", "Entwarnung senden"], ["none", "nichts tun"]].map(([k, t]) => `<option value="${k}" ${P.resolved === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="srow"><span class="lbl">Sperrzeit<small>Minuten, bevor dieselbe Warnung erneut gemeldet wird (Alarme immer)</small></span><input class="inp s" type="number" min="0" max="1440" data-set="push.cooldown" data-num="1" value="${P.cooldown}"></div>
      ${tg("push.persistent", "Zusätzlich als Benachrichtigung in Home Assistant", "erscheint unter der Glocke in der Seitenleiste und verschwindet, wenn behoben")}
      <div class="srow"><button class="pbtn" data-act="s-push-test">${icon("mdi:send")}Testmeldung senden</button>
        <span class="lbl"><small>${info ? (info.active.length ? `Im Hintergrund aktiv: ${info.active.map((a) => esc(a.title)).join(", ")}` : "Im Hintergrund ist gerade keine Warnung aktiv.") : ""} Einstellungen erst speichern, dann testen.</small></span></div>
    </div>`;
  }

  _setMode(D) {
    const H = D.house_mode, h = this._hass;
    const panels = Object.keys(h.states).filter((e) => e.startsWith("alarm_control_panel."));
    const M = (ALARMS && ALARMS.mode) || {};
    const acts = [["none", "nicht ändern"], ["disarm", "unscharf"], ["arm_home", "scharf · zuhause"], ["arm_night", "scharf · Nacht"], ["arm_away", "scharf · abwesend"], ["arm_vacation", "scharf · Urlaub"]];
    const tg = (path, on) => `<label class="tgl"><input type="checkbox" data-set="${path}" data-bool="1" ${on ? "checked" : ""}><span></span></label>`;
    return `<div class="set glass"><h2>${icon("mdi:home-switch-outline")}Hausmodus</h2>
      <p class="hint">Zuhause, Nacht, Abwesend oder Urlaub. Umschalten im Alarmmanager, über <code>select.hausmodus</code> oder automatisch. Regeln im Abschnitt „Warnungen“ lassen sich auf einzelne Modi beschränken.</p>
      <div class="srow"><span class="lbl">Hausmodus verwenden<small>aus = immer „Zuhause“, alle Regeln gelten</small></span>${tg("house_mode.enabled", H.enabled !== false)}</div>
      <div class="fl-title">Automatik</div>
      <div class="srow"><span class="lbl">Abwesend, wenn alle Personen weg sind<small>Zurück auf „Zuhause“, sobald jemand heimkommt (Personen-Entitäten)</small></span>${tg("house_mode.auto_away", H.auto_away)}</div>
      <div class="srow"><span class="lbl">Verzögerung bis Abwesend<small>Minuten – verhindert Umschalten bei kurzen Wegen</small></span><input class="inp s" type="number" min="0" max="240" data-set="house_mode.away_delay" data-num="1" value="${H.away_delay}"></div>
      <div class="srow"><span class="lbl">Nacht nach Uhrzeit<small>nur aus „Zuhause“; morgens zurück auf „Zuhause“</small></span>
        <input class="inp s" type="time" data-set="house_mode.night_start" value="${esc(H.night_start)}"><span class="rl">bis</span><input class="inp s" type="time" data-set="house_mode.night_end" value="${esc(H.night_end)}">${tg("house_mode.auto_night", H.auto_night)}</div>
      <div class="fl-title">Alarmanlage</div>
      <div class="srow"><span class="lbl">Alarmanlage<small>leer = automatisch (Alarmo)${M.panel ? ` – erkannt: ${esc(M.panel)}` : panels.length ? "" : " – keine gefunden"}</small></span>
        <input class="inp" list="dl-panels" data-set="house_mode.alarmo" value="${esc(H.alarmo)}" placeholder="alarm_control_panel.alarmo"><datalist id="dl-panels">${panels.map((e) => `<option value="${esc(e)}">`).join("")}</datalist></div>
      <div class="srow"><span class="lbl">Hausmodus und Alarmanlage koppeln<small>beide Richtungen: Modus schaltet die Anlage, Schalten an der Anlage ändert den Modus</small></span>${tg("house_mode.alarmo_sync", H.alarmo_sync)}</div>
      ${HOUSE_MODES.map(([k, t, i]) => `<div class="srow"><span class="lbl">${icon(i)} ${t}</span><select class="inp" data-set="house_mode.arm.${k}">${acts.map(([a, at]) => `<option value="${a}" ${H.arm[k] === a ? "selected" : ""}>${at}</option>`).join("")}</select></div>`).join("")}
      <div class="srow"><span class="lbl">Code der Alarmanlage<small>${M.code ? "gespeichert ✓ – " : ""}nur nötig, wenn Alarmo zum Scharf-/Unscharfschalten einen Code verlangt; bleibt in Home Assistant und wird nicht an Browser geschickt</small></span>
        <input class="inp s" type="password" autocomplete="off" id="hv-code" placeholder="${M.code ? "••••" : "Code"}"><button class="pbtn sm" data-act="s-code-save">${icon("mdi:content-save-outline")}Speichern</button></div>
    </div>`;
  }

  _setActions(D) {
    const E = D.escalation, h = this._hass, ids = Object.keys(h.states);
    const opt = (e) => `<option value="${esc(e)}">${esc(entName(h, e))}</option>`;
    const dl = (id, re) => `<datalist id="${id}">${ids.filter((e) => re.test(e)).map(opt).join("")}</datalist>`;
    const types = [["knx", "KNX-Telegramm"], ["switch", "Schalter / Licht"], ["siren", "Sirene"], ["tts", "Durchsage (z. B. Sonos)"], ["script", "Skript"]];
    const whens = [["neu", "sofort bei neuer Meldung"], ["eskalation", "bei Eskalation"]];
    const bi = [["contacts", "Fenster oder Tür offen"], ["window_heating", "Fenster beim Heizen"], ["safety", "Melder ausgelöst"], ["alarm_panel", "Alarmanlage ausgelöst"],
      ["presence_away", "Bewegung bei Abwesenheit"], ["locks", "Schloss entriegelt"], ["garage", "Garagentor offen"], ["battery", "Batterien kritisch"], ["offline", "Geräte nicht erreichbar"]];
    const scopes = [["alarm", "alle Alarme"], ["warn", "Alarme und Warnungen"], ["all", "alle Meldungen"], ...bi.map(([k, t]) => [`b:${k}`, `Regel: ${t}`]),
      ...D.alerts.rules.map((r, i) => [`r:${i}`, `Eigene Regel: ${r.title || r.entity || i + 1}`])];
    const sel = (path, opts, cur, cls = "") => `<select class="inp ${cls}" data-set="${path}">${opts.map(([k, t]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    const allM = HOUSE_MODES.map((x) => x[0]);
    const mchips = (path, cur) => `<span class="mchips" title="nur in diesen Hausmodi">${HOUSE_MODES.map(([k, t, i]) => `<button class="mchip${cur.includes(k) ? " on" : ""}" data-act="s-mode-chip" data-path="${path}" data-m="${k}" title="${t}">${icon(i)}</button>`).join("")}</span>`;
    const tg = (path, on, label) => `<label class="actg"><span class="tgl"><input type="checkbox" data-set="${path}" data-bool="1" ${on ? "checked" : ""}><span></span></span><small>${label}</small></label>`;
    const fields = (a, i) => {
      const p = `alarm_actions.${i}`;
      switch (a.type) {
        case "knx": return `<input class="inp s" data-set="${p}.address" value="${esc(a.address || "")}" placeholder="1/7/0" title="Gruppenadresse">
          <span class="rl">Wert</span><input class="inp xs" type="number" min="0" max="255" data-set="${p}.payload" data-num="1" value="${a.payload ?? 1}">
          <span class="rl">zurück</span><input class="inp xs" type="number" min="0" max="255" data-set="${p}.reset_payload" data-num="1" value="${a.reset_payload ?? 0}">
          ${tg(`${p}.reset`, a.reset !== false, "beim Quittieren zurücksetzen")}`;
        case "switch": return `<input class="inp" style="flex:1 1 220px" list="dl-act-sw" data-set="${p}.entity" value="${esc(a.entity || "")}" placeholder="switch.blitzleuchte">${tg(`${p}.reset`, a.reset !== false, "beim Quittieren aus")}`;
        case "siren": return `<input class="inp" style="flex:1 1 220px" list="dl-act-siren" data-set="${p}.entity" value="${esc(a.entity || "")}" placeholder="siren.aussen">${tg(`${p}.reset`, a.reset !== false, "beim Quittieren aus")}`;
        case "tts": return `<input class="inp" style="flex:1 1 180px" list="dl-act-mp" data-set="${p}.entity" value="${esc(a.entity || "")}" placeholder="media_player.kueche" title="Lautsprecher">
          <input class="inp" style="flex:1 1 180px" list="dl-act-tts" data-set="${p}.tts" value="${esc(a.tts || "")}" placeholder="tts.google_translate_de_de" title="Sprachausgabe">
          <input class="inp" style="flex:2 1 240px" data-set="${p}.message" value="${esc(a.message || "{titel}")}" placeholder="Achtung: {titel}" title="Text – Platzhalter {titel}, {stufe}, {detail}, {modus}">
          <span class="rl">Lautstärke</span><input class="inp xs" type="number" min="0" max="100" data-set="${p}.volume" data-num="1" value="${a.volume ?? 40}"><span class="rl">%</span>`;
        case "script": return `<input class="inp" style="flex:1 1 220px" list="dl-act-script" data-set="${p}.entity" value="${esc(a.entity || "")}" placeholder="script.alarm"><span class="rl">bekommt titel, stufe, detail, key, modus</span>`;
        default: return "";
      }
    };
    const acts = D.alarm_actions.map((a, i) => `<div class="actcard sitem${a.enabled === false ? " off" : ""}" data-sort-id="${i}">
      <div class="actrow">${D.alarm_actions.length > 1 ? dragHandle("Aktion verschieben") : ""}<label class="tgl" title="aktiv"><input type="checkbox" data-set="alarm_actions.${i}.enabled" data-bool="1" ${a.enabled !== false ? "checked" : ""}><span></span></label>
        <input class="inp" style="flex:1 1 160px" data-set="alarm_actions.${i}.name" value="${esc(a.name || "")}" placeholder="Name, z. B. KNX Sammelalarm">
        ${sel(`alarm_actions.${i}.type`, types, a.type)}${sel(`alarm_actions.${i}.when`, whens, a.when || "neu")}${sel(`alarm_actions.${i}.scope`, scopes, a.scope || "alarm", "wide")}
        ${mchips(`alarm_actions.${i}.modes`, a.modes && a.modes.length ? a.modes : allM)}
        <button class="pbtn sm" data-act="s-act-test" data-i="${i}" title="Probehalber ausführen">${icon("mdi:play-outline")}Test</button>
        <button class="sbtn danger" data-act="s-act-del" data-i="${i}" title="Löschen">${icon("mdi:delete-outline")}</button></div>
      <div class="actrow sub">${fields(a, i)}</div></div>`).join("");
    const tpl = [["knx", "KNX-Sammelalarm"], ["siren", "Sirene bei Eskalation"], ["tts", "Sonos-Durchsage"], ["flash", "Blitzleuchte bei Abwesenheit"], ["script", "Skript"]];
    return `<div class="set glass"><h2>${icon("mdi:bullhorn-outline")}Eskalation und Aktionen</h2>
      <p class="hint">Aktionen laufen, wenn eine passende Meldung auftritt oder eskaliert – z. B. ein KNX-Telegramm auf eine Sammelalarm-Adresse, eine Sirene oder eine Durchsage über Sonos. Schaltende Aktionen werden zurückgesetzt, sobald alle auslösenden Meldungen quittiert, stumm oder behoben sind.</p>
      <div class="fl-title">Eskalation</div>
      <div class="srow"><span class="lbl">Eskalieren, wenn nicht quittiert<small>Meldung ist nach der Zeit noch „neu“ (nicht quittiert, nicht stumm)</small></span><label class="tgl"><input type="checkbox" data-set="escalation.enabled" data-bool="1" ${E.enabled !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Nach<small>Minuten</small></span><input class="inp s" type="number" min="1" max="240" data-set="escalation.minutes" data-num="1" value="${E.minutes}"></div>
      <div class="srow"><span class="lbl">Für Stufen</span><span class="lvchips">${[["alarm", "Alarm"], ["warn", "Warnung"], ["info", "Hinweis"]].map(([k, t]) => `<button class="altab sm${(E.levels || []).includes(k) ? " on" : ""}" data-act="s-esc-level" data-lvl="${k}"><span>${t}</span></button>`).join("")}</span></div>
      <div class="srow"><span class="lbl">Erneut als kritische Push-Meldung<small>„Nicht quittiert: …“ an alle Empfänger, laut auch bei „Nicht stören“</small></span><label class="tgl"><input type="checkbox" data-set="escalation.push_critical" data-bool="1" ${E.push_critical !== false ? "checked" : ""}><span></span></label></div>
      <div class="fl-title">Aktionen</div>
      ${acts ? `<div class="sortl" data-sort="actions">${acts}</div>` : '<p class="hint">Noch keine Aktionen. Vorlagen unten – danach Gruppenadresse bzw. Entität eintragen und mit „Test“ prüfen.</p>'}
      <div class="srow"><button class="pbtn" data-act="s-act-add">${icon("mdi:plus")}Aktion hinzufügen</button>
        <span class="lbl" style="flex:0 0 auto;min-width:0"><small>Vorlagen:</small></span>
        ${tpl.map(([k, t]) => `<button class="pbtn sm" data-act="s-act-tpl" data-tpl="${k}">${t}</button>`).join("")}</div>
      <p class="hint" style="margin-top:8px">„Test“ führt die Aktion sofort aus – auch ungespeichert – und setzt schaltende Aktionen nach 3 Sekunden zurück. KNX-Telegramme brauchen die KNX-Integration (Dienst <code>knx.send</code>).</p>
      ${dl("dl-act-sw", /^(switch|light|input_boolean|fan)\./)}${dl("dl-act-siren", /^(siren|switch)\./)}${dl("dl-act-mp", /^media_player\./)}${dl("dl-act-tts", /^tts\./)}${dl("dl-act-script", /^script\./)}
    </div>`;
  }

  _setAlerts(D) {
    const A = D.alerts;
    const B = A.builtin;
    const bi = [["contacts", "Fenster oder Tür offen", "Warnung"], ["window_heating", "Fenster offen, während der Raum heizt", "Warnung"], ["safety", "Melder ausgelöst (Rauch, Wasser, Gas …)", "Alarm"],
      ["locks", "Schloss entriegelt", "Warnung"], ["garage", "Garagentor oder Tor offen", "Warnung"], ["battery", "Batterien kritisch", "Warnung"], ["offline", "Geräte nicht erreichbar", "Hinweis"],
      ["presence_away", "Bewegung erkannt, während niemand zu Hause ist", "Alarm"], ["alarm_panel", "Alarmanlage ausgelöst (z. B. Alarmo)", "Alarm"]];
    const allM = HOUSE_MODES.map((x) => x[0]);
    const mchips = (path, cur) => `<span class="mchips" title="gilt in diesen Hausmodi">${HOUSE_MODES.map(([k, t, i]) => `<button class="mchip${cur.includes(k) ? " on" : ""}" data-act="s-mode-chip" data-path="${path}" data-m="${k}" title="${t}">${icon(i)}</button>`).join("")}</span>`;
    const bmodes = (k) => (A.modes && A.modes[k] && A.modes[k].length ? A.modes[k] : BUILTIN_MODES[k] || allM);
    const ops = [["on", "ist an / offen"], ["off", "ist aus / zu"], ["gt", "größer als"], ["lt", "kleiner als"], ["eq", "ist gleich"], ["ne", "ist nicht"], ["unavailable", "nicht erreichbar"]];
    const lv = [["info", "Hinweis"], ["warn", "Warnung"], ["alarm", "Alarm"]];
    const sel = (path, opts, cur) => `<select class="inp" data-set="${path}">${opts.map(([k, t]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    const rules = A.rules.map((r, i) => `<div class="rule">
        <label class="tgl" title="aktiv"><input type="checkbox" data-set="alerts.rules.${i}.enabled" data-bool="1" ${r.enabled !== false ? "checked" : ""}><span></span></label>
        <input class="inp" style="flex:1 1 180px" data-set="alerts.rules.${i}.title" value="${esc(r.title)}" placeholder="Titel, z. B. Kamin sehr heiß">
        <input class="inp" style="flex:1 1 220px" list="dl-all" data-set="alerts.rules.${i}.entity" value="${esc(r.entity)}" placeholder="Entität">
        ${sel(`alerts.rules.${i}.op`, ops, r.op || "on")}
        ${["gt", "lt", "eq", "ne"].includes(r.op) ? `<input class="inp s" data-set="alerts.rules.${i}.value" value="${esc(r.value)}" placeholder="Wert">` : ""}
        <span class="rl">ab</span><input class="inp s" type="number" min="0" max="1440" data-set="alerts.rules.${i}.minutes" data-num="1" value="${r.minutes || 0}"><span class="rl">min</span>
        ${sel(`alerts.rules.${i}.level`, lv, r.level || "warn")}
        ${mchips(`alerts.rules.${i}.modes`, r.modes && r.modes.length ? r.modes : allM)}
        <button class="sbtn danger" data-act="s-rule-del" data-i="${i}" title="Löschen">${icon("mdi:delete-outline")}</button></div>`).join("");
    const tpl = [["akku", "Akku fast leer"], ["speicher", "Speicher kalt"], ["kamin", "Kamin sehr heiß"], ["netz", "Hoher Netzbezug"], ["geraet", "Gerät läuft lange"], ["offline", "Gerät offline"]];
    return `<div class="set glass"><h2>${icon("mdi:bell-cog-outline")}Warnungen</h2>
      <p class="hint">Aktive Warnungen erscheinen in der Karte „Alles in Ordnung“ (Cockpit, Sicherheit), als Glocke in der Kopfzeile und oberhalb der anderen Übersichten. Stufen: <b>Alarm</b> (rot) vor <b>Warnung</b> (orange) vor <b>Hinweis</b> (blau, nicht in der Kopfzeile).</p>
      <div class="fl-title">Feste Regeln</div>
      <p class="hint">Die Symbole je Regel legen fest, in welchen Hausmodi sie gilt (${HOUSE_MODES.map(([, t]) => t).join(", ")}). Beispiel: Bewegung ist nur bei Abwesend und Urlaub ein Alarm.</p>
      ${bi.map(([k, t, l]) => `<div class="srow"><span class="lbl">${t}<small>${l}</small></span>${mchips(`alerts.modes.${k}`, bmodes(k))}<label class="tgl"><input type="checkbox" data-set="alerts.builtin.${k}" data-bool="1" ${B[k] ? "checked" : ""}><span></span></label></div>`).join("")}
      <div class="srow"><span class="lbl">Fenster und Türen erst melden nach<small>Minuten offen; 0 = sofort</small></span><input class="inp s" type="number" min="0" max="240" data-set="alerts.contacts_min" data-num="1" value="${A.contacts_min || 0}"></div>
      <div class="fl-title">Eigene Regeln</div>
      ${rules || '<p class="hint">Noch keine eigenen Regeln. Beispiele: Speicher oben unter 45 °C, Kamin über 85 °C, Akku unter 15 %, Waschmaschine seit 3 Stunden an.</p>'}
      <div class="srow"><button class="pbtn" data-act="s-rule-add">${icon("mdi:plus")}Regel hinzufügen</button>
        <span class="lbl" style="flex:0 0 auto;min-width:0"><small>Vorlagen:</small></span>
        ${tpl.map(([k, t]) => `<button class="pbtn sm" data-act="s-rule-tpl" data-tpl="${k}">${t}</button>`).join("")}</div>
      <p class="hint" style="margin-top:8px">„ab … min“ zählt ab der letzten Zustandsänderung – ideal für An/Aus und Offen/Zu (z. B. „Gerät seit 120 min an“). Bei Messwerten startet die Zeit mit jedem neuen Wert neu.</p>
    </div>`;
  }

  _settingsTab() {
    // Adresse „einstellungen/<reiter>“ wählt den Reiter (z. B. aus einem Lesezeichen)
    if (this._view === "einstellungen" && this._arg && this._arg !== this._setTabArg) {
      this._setTabArg = this._arg;
      if (SET_TABS.some(([k]) => k === this._arg)) this._setTabSel = this._arg;
    }
    if (!this._setTabSel) {
      let t = null;
      try { t = localStorage.getItem("hv-settings-tab"); } catch (err) { /* egal */ }
      this._setTabSel = SET_TABS.some(([k]) => k === t) ? t : "raeume";
    }
    return this._setTabSel;
  }

  /** Hat der Reiter ungespeicherte Änderungen? */
  _tabDirty(tab) {
    const D = this._draft, L = this._layout;
    if (!D || !this._dirtySettings) return false;
    const own = SET_TAB_KEYS[tab] || Object.keys(D).filter((k) => !Object.values(SET_TAB_KEYS).flat().includes(k));
    return own.some((k) => JSON.stringify(D[k] ?? null) !== JSON.stringify(L[k] ?? null));
  }

  /* Ziehen: das Element wandert live an die neue Stelle und folgt dem Zeiger; beim Loslassen wird die Reihenfolge übernommen. */
  _sortStart(e) {
    const hd = e.target.closest && e.target.closest("[data-drag]");
    if (!hd || this._view !== "einstellungen" || e.button > 0) return;
    if (e.target.closest("button:not([data-drag]), input, select")) return;
    const item = hd.closest(".sitem"), list = item && item.parentElement;
    if (!list || !list.dataset.sort || sortIds(list).length < 2) return;
    e.preventDefault();
    const S = { item, list, hd, axis: list.dataset.axis || "y", x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, before: sortIds(list).join("\n") };
    this._sort = S;
    // Am Fenster lauschen: Beim Umsetzen im DOM geht ein Pointer-Capture verloren
    const pid = e.pointerId;
    const main = this.shadowRoot.querySelector(".main");
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!S.moved) {
        if (Math.hypot(ev.clientX - S.x0, ev.clientY - S.y0) < 5) return;
        S.moved = true;
        item.classList.add("dragging"); list.classList.add("sorting");
      }
      S.px = ev.clientX; S.py = ev.clientY;
      this._sortPlace(S);
      if (main) {
        const r = main.getBoundingClientRect();
        S.scroll = ev.clientY < r.top + 56 ? -1 : ev.clientY > r.bottom - 56 ? 1 : 0;
        if (S.scroll && !S.scrollT) S.scrollT = setInterval(() => { if (!S.scroll) return; main.scrollTop += S.scroll * 10; this._sortPlace(S); }, 16);
      }
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      clearInterval(S.scrollT);
      this._sort = null;
      item.classList.remove("dragging"); list.classList.remove("sorting");
      item.style.transform = "";
      const ids = sortIds(list);
      if (S.moved && ids.join("\n") !== S.before) this._applySort(list, ids);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  _sortPlace(S) {
    const { item, list, axis } = S;
    if (S.px === undefined) return;
    const sibs = [...list.children].filter((c) => c !== item && c.classList.contains("sitem"));
    let ref = null;
    for (const c of sibs) {
      const r = c.getBoundingClientRect();
      if (axis === "x") {
        // Zeilenweise: erst die Zeile, dann die Position darin
        if (S.py < r.top) { ref = c; break; }
        if (S.py <= r.bottom && S.px < r.left + r.width / 2) { ref = c; break; }
      } else if (S.py < r.top + r.height / 2) { ref = c; break; }
    }
    if (ref !== item.nextElementSibling || (!ref && list.lastElementChild !== item)) {
      if (ref) list.insertBefore(item, ref); else list.appendChild(item);
    }
    // Element folgt dem Zeiger: Abstand zur natürlichen Lage (ohne Verschiebung)
    item.style.transform = "";
    const r = item.getBoundingClientRect();
    if (!S.grab) S.grab = [S.x0 - r.left, S.y0 - r.top];
    const tx = axis === "x" ? S.px - S.grab[0] - r.left : 0, ty = S.py - S.grab[1] - r.top;
    item.style.transform = `translate(${tx}px,${ty}px)`;
  }

  /** Tastatur: Pfeiltasten auf dem Griff verschieben um eine Stelle. */
  _sortKey(e) {
    const hd = e.target.closest && e.target.closest("[data-drag]");
    if (!hd || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const item = hd.closest(".sitem"), list = item && item.parentElement;
    if (!list || !list.dataset.sort) return;
    e.preventDefault();
    const ids = sortIds(list), i = ids.indexOf(item.dataset.sortId), j = i + (e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const focus = { sort: list.dataset.sort, key: list.dataset.floor || list.dataset.area || "", pos: j };
    this._applySort(list, ids);
    const nl = [...this.shadowRoot.querySelectorAll(`[data-sort="${focus.sort}"]`)].find((l) => (l.dataset.floor || l.dataset.area || "") === focus.key);
    const it = nl && nl.querySelectorAll(":scope > .sitem")[focus.pos];
    const h2 = it && (it.matches("[data-drag]") ? it : it.querySelector("[data-drag]"));
    if (h2) h2.focus();
  }

  _applySort(list, ids) {
    const D = this._draft;
    if (!D) return;
    switch (list.dataset.sort) {
      case "floors": D.floor_order = [...this.shadowRoot.querySelectorAll('[data-sort="floors"]')].flatMap((l) => sortIds(l)); break;
      case "areas": {
        // Nur die Räume dieser Etage tauschen ihre Plätze in der Gesamtreihenfolge
        const m = buildModel(this._hass, { ...D, hidden_areas: [] });
        const order = m.floors.flatMap((f) => f.areas.map((a) => a.id));
        const mine = new Set(ids);
        let k = 0;
        D.area_order = order.map((id) => (mine.has(id) ? ids[k++] : id));
        break;
      }
      case "pins": D.pins[list.dataset.area] = ids; break;
      case "favorites": D.favorites = ids; break;
      case "tank": D.heating.tank = ids; break;
      case "links": D.links = ids.map((i) => D.links[Number(i)]); break;
      case "actions": D.alarm_actions = ids.map((i) => D.alarm_actions[Number(i)]); break;
      default: return;
    }
    this._rerenderSettings();
  }

  _rerenderSettings() {
    this._dirtySettings = true;
    this._dirty = true;
    this._flush();
  }

  _onChange(e) {
    super._onChange(e);
    const t = e.target;
    if (t.dataset && t.dataset.pushTarget && e.type === "change" && this._draft) {
      const sv = t.dataset.pushTarget, P = this._draft.push;
      P.targets = t.checked ? [...new Set([...P.targets, sv])] : P.targets.filter((x) => x !== sv);
      this._rerenderSettings();
      return;
    }
    if (!t.dataset || !t.dataset.set || !this._draft) return;
    if (e.type === "input" && (t.dataset.bool || t.tagName === "SELECT")) return;
    let v = t.dataset.bool ? t.checked : t.value;
    if (t.dataset.num) v = Number(v);
    if (t.dataset.csv) v = String(v).split(",").map((s) => s.trim()).filter(Boolean);
    const path = t.dataset.set.split(".");
    let o = this._draft;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] ?? {};
    o[path[path.length - 1]] = v;
    this._dirtySettings = true;
    if ((/^(heating|wallbox)\./.test(t.dataset.set) && e.type === "change" && !/\.manual\./.test(t.dataset.set)) || /^alerts\.rules\.\d+\.op$/.test(t.dataset.set) || /^alarm_actions\.\d+\.type$/.test(t.dataset.set) || (t.dataset.set === "doorbell.lock" && e.type === "change")) { this._rerenderSettings(); return; }
    const msg = this.shadowRoot.querySelector(".savebar .msg");
    if (msg) msg.textContent = "Ungespeicherte Änderungen";
  }

  async _actionExtra(act, t) {
    const D = this._draft;
    switch (act) {
      case "go": this._go(t.dataset.to); return;
      case "nav": this._go(t.dataset.to); return;
      case "link": this._openLink(t.dataset.path); return;
      case "nav-raw": this._navigate(t.dataset.path); return;
      case "roof": { if (this._model && this._model.energy) { this._go("energie"); return; } const l = (this._layout.links || [])[0]; if (l && l.path) this._openLink(l.path); return; }
      case "menu": this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })); return;
      case "bell-close": case "bell-live": case "bell-protect": case "bell-unlock": this._bellAction(act, t); return;
      case "s-bell-test": this._closeBell(); this._showBell(true, this._draft ? this._draft.doorbell : null); return;
      case "saver": this._saverShow(); return;
      case "s-wall-device": this._wallSet(!this._wallIsOn()); this._toast(this._wallIsOn() ? "Dieses Gerät ist jetzt ein Wandpanel" : "Wandpanel-Modus aus"); return;
      case "s-saver-test": { const prev = this._layout; this._layout = { ...prev, wallpanel: { ...this._wallCfg(), ...((this._draft && this._draft.wallpanel) || {}) } }; this._saverShow(); this._layout = prev; this._wallActive = Date.now(); return; }
      case "ftab": this._floorTab = t.dataset.floor; this._dirty = true; this._flush(); return;
      case "al-open-page": if (t.dataset.key) this._alSel = t.dataset.key; this._alTab = "leitstelle"; if (this._view === "alarme") this._alRefresh(); else this._go("alarme"); return;
      case "al-sel": this._alSel = t.dataset.key || null; this._alRefresh(); if (this._isNarrow && this._alSel) { const d = this.shadowRoot.querySelector(".aldetail"); if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "nearest" }); } return;
      case "al-tab": this._alTab = t.dataset.tab; this.shadowRoot.querySelectorAll(".ptitle .altab").forEach((b) => b.classList.toggle("on", b.dataset.tab === this._alTab)); this._alRefresh(); return;
      case "al-lvl": this._alLvl = t.dataset.lvl; this._alRefresh(); return;
      case "al-days": this._alDays = Number(t.dataset.days); this._alRefresh(); return;
      case "al-ack": this._alCall({ key: t.dataset.key, action: "ack" }, "Quittiert"); return;
      case "al-ackall": this._alCall({ key: "", action: "ack_all" }, "Alle Meldungen quittiert"); return;
      case "al-unmute": this._alCall({ key: t.dataset.key, action: "unmute" }, "Stummschaltung aufgehoben"); return;
      case "al-mute": this._alCall(t.dataset.until ? { key: t.dataset.key, action: "mute", until: t.dataset.until } : { key: t.dataset.key, action: "mute", minutes: Number(t.dataset.min) || 60 },
        t.dataset.until === "resolved" ? "Stumm bis behoben" : t.dataset.until === "morning" ? "Stumm bis morgen 7 Uhr" : "1 Stunde stumm"); return;
      case "al-lock": this._call("lock", "lock", { entity_id: t.dataset.eid }); this._toast("Wird verriegelt"); return;
      case "hm-set": {
        const md = t.dataset.mode;
        try {
          const st = await this._hass.callWS({ type: `${DOMAIN}/set_mode`, mode: md });
          if (ALARMS && st) this._onAlarms({ ...ALARMS, mode: st });
          this._toast(`Hausmodus: ${MODE_NAME[md]}`);
        } catch (err) { this._toast(`Umschalten fehlgeschlagen: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "only-on": {
        this._onlyOn = !this._onlyOn;
        t.classList.toggle("on", this._onlyOn);
        const w = this.shadowRoot.querySelector(".lwrap");
        if (w) w.classList.toggle("only-on", this._onlyOn);
        return;
      }
    }
    if (act === "s-code-save") {
      const inp = this.shadowRoot.getElementById("hv-code");
      try { await this._hass.callWS({ type: `${DOMAIN}/alarm_code`, code: inp ? inp.value : "" }); this._toast(inp && inp.value ? "Code gespeichert" : "Code gelöscht"); if (inp) inp.value = ""; }
      catch (err) { this._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`); }
      return;
    }
    if (!D) return;
    const h = this._hass;
    switch (act) {
      case "s-mode-chip": {
        const path = t.dataset.path.split("."), m = t.dataset.m, allM = HOUSE_MODES.map((x) => x[0]);
        let o = D;
        for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] ?? {};
        const key = path[path.length - 1];
        const cur = o[key] && o[key].length ? o[key] : path[1] === "modes" ? BUILTIN_MODES[key] || allM : allM;
        let next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
        if (!next.length) { this._toast("Mindestens ein Hausmodus"); return; }
        next = allM.filter((x) => next.includes(x));
        o[key] = next.length === allM.length && path[1] !== "modes" ? [] : next;
        break;
      }
      case "s-floor-outdoor": {
        const id = t.dataset.floor;
        D.outdoor_floors = D.outdoor_floors.includes(id) ? D.outdoor_floors.filter((x) => x !== id) : [...D.outdoor_floors, id];
        break;
      }
      case "s-area-hide": {
        const id = t.dataset.area;
        D.hidden_areas = D.hidden_areas.includes(id) ? D.hidden_areas.filter((x) => x !== id) : [...D.hidden_areas, id];
        break;
      }
      case "s-area-open": this._openArea = this._openArea === t.dataset.area ? null : t.dataset.area; this._dirty = true; this._flush(); return;
      case "s-pin-add": {
        const inp = this.shadowRoot.querySelector(`[data-pin-input="${CSS.escape(t.dataset.area)}"]`);
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        const list = D.pins[t.dataset.area] || [];
        if (!list.includes(v)) D.pins[t.dataset.area] = [...list, v];
        break;
      }
      case "s-pin-del": D.pins[t.dataset.area] = (D.pins[t.dataset.area] || []).filter((e) => e !== t.dataset.eid); break;
      case "s-fav-add": {
        const inp = this.shadowRoot.querySelector("[data-fav-input]");
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        if (!D.favorites.includes(v)) D.favorites = [...D.favorites, v];
        break;
      }
      case "s-fav-del": D.favorites = D.favorites.filter((e) => e !== t.dataset.eid); break;
      case "s-tank-del": {
        const cur = (buildModel(h, { ...D, hidden_areas: [] }).tech.heat || { tank: [] }).tank;
        D.heating.tank = cur.filter((e) => e !== t.dataset.eid);
        if (!D.heating.tank.length) { this._toast("Mindestens ein Fühler – sonst automatisch"); D.heating.tank = []; }
        break;
      }
      case "s-tank-add": {
        const inp = this.shadowRoot.querySelector("[data-tank-input]");
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        const cur = (buildModel(h, { ...D, hidden_areas: [] }).tech.heat || { tank: [] }).tank;
        if (!cur.includes(v)) D.heating.tank = [...cur, v];
        break;
      }
      case "s-tank-auto": D.heating.tank = []; break;
      case "s-push-test": {
        try {
          const r = await h.callWS({ type: `${DOMAIN}/push_test` });
          this._toast(r.targets.length ? `Testmeldung gesendet an ${r.targets.join(", ")}` : "Kein Empfänger gefunden – Companion-App eingerichtet?");
        } catch (err) { this._toast(`Test fehlgeschlagen: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "s-act-add": D.alarm_actions = [...D.alarm_actions, { id: `a${Date.now().toString(36)}`, name: "", type: "knx", enabled: true, when: "neu", scope: "alarm", modes: [], address: "", payload: 1, reset_payload: 0, reset: true }]; break;
      case "s-act-del": D.alarm_actions = D.alarm_actions.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-act-tpl": {
        const id = `a${Date.now().toString(36)}`;
        const T = {
          knx: { name: "KNX Sammelalarm", type: "knx", when: "neu", scope: "alarm", address: "", payload: 1, reset_payload: 0, reset: true },
          siren: { name: "Sirene", type: "siren", when: "eskalation", scope: "alarm", entity: "", reset: true },
          tts: { name: "Durchsage", type: "tts", when: "neu", scope: "alarm", entity: "", tts: Object.keys(h.states).find((e) => e.startsWith("tts.")) || "", message: "Achtung: {titel}", volume: 50 },
          flash: { name: "Blitzleuchte", type: "switch", when: "neu", scope: "alarm", entity: "", reset: true, modes: ["abwesend", "urlaub"] },
          script: { name: "Skript", type: "script", when: "neu", scope: "alarm", entity: "" },
        }[t.dataset.tpl];
        D.alarm_actions = [...D.alarm_actions, { id, enabled: true, modes: [], ...T }];
        break;
      }
      case "s-esc-level": {
        const l = t.dataset.lvl, cur = D.escalation.levels || [];
        D.escalation.levels = ["alarm", "warn", "info"].filter((x) => (x === l ? !cur.includes(x) : cur.includes(x)));
        break;
      }
      case "s-act-test": {
        const a = D.alarm_actions[Number(t.dataset.i)];
        try {
          const r = await this._hass.callWS({ type: `${DOMAIN}/action_test`, action: a });
          this._toast(`Test ausgeführt: ${(r.calls || []).map((c) => `${c.domain}.${c.service}`).join(", ")}`);
        } catch (err) { this._toast(`Test nicht möglich: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "s-rule-add": D.alerts.rules = [...D.alerts.rules, { title: "", entity: "", op: "on", value: "", minutes: 0, level: "warn", enabled: true }]; break;
      case "s-rule-del": D.alerts.rules = D.alerts.rules.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-rule-tpl": {
        const H = D.header || {};
        const T = {
          akku: { title: "Akku fast leer", entity: H.battery || "", op: "lt", value: "15", minutes: 0, level: "warn" },
          speicher: { title: "Warmwasser-Speicher kalt", entity: "", op: "lt", value: "45", minutes: 0, level: "info" },
          kamin: { title: "Kamin sehr heiß", entity: "", op: "gt", value: "85", minutes: 0, level: "alarm" },
          netz: { title: "Hoher Netzbezug", entity: H.grid || "", op: "gt", value: "3000", minutes: 0, level: "info" },
          geraet: { title: "Gerät läuft lange", entity: "", op: "on", value: "", minutes: 120, level: "info" },
          offline: { title: "Gerät nicht erreichbar", entity: "", op: "unavailable", value: "", minutes: 10, level: "warn" },
        }[t.dataset.tpl];
        if (T) D.alerts.rules = [...D.alerts.rules, { ...T, enabled: true }];
        break;
      }
      case "s-link-add": D.links = [...(D.links || []), { title: "", icon: "mdi:link", path: "", embed: true, mode: "theme" }]; break;
      case "s-link-del": D.links = D.links.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-tab": {
        this._setTabSel = t.dataset.tab;
        try { localStorage.setItem("hv-settings-tab", t.dataset.tab); } catch (err) { /* egal */ }
        this._dirty = true; this._flush();
        const mn = this.shadowRoot.querySelector(".main");
        if (mn) mn.scrollTop = 0;
        return;
      }
      case "s-reset": this._draft = null; this._dirtySettings = false; this._dirty = true; this._flush(); return;
      case "s-save": {
        try {
          const res = await h.callWS({ type: `${DOMAIN}/save`, layout: D });
          this._layout = withDefaults(res.layout);
          this._draft = structuredClone(this._layout);
          this._dirtySettings = false;
          this._startCams();
          this._dirty = true;
          this._flush();
          this._toast("Gespeichert");
        } catch (err) {
          this._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`);
        }
        return;
      }
      default: return;
    }
    this._rerenderSettings();
  }

  _go(sub) {
    sub = sub || "";
    const toSettings = sub.split("/")[0] === "einstellungen";
    if (this._view === "einstellungen" && !toSettings && this._dirtySettings) {
      this._toast("Ungespeicherte Änderungen verworfen");
      this._dirtySettings = false;
    }
    if (!toSettings) this._draft = null;
    this._navigate(sub ? `${this._base}/${sub}` : this._base);
    // Falls Home Assistant die Route nicht zurückmeldet (z. B. im Test), selbst umschalten.
    const [view, arg] = sub.split("/");
    if ((view || null) !== this._view || (arg || null) !== this._arg) {
      this._view = view || null;
      this._arg = arg ? decodeURIComponent(arg) : null;
      this._dirty = true;
      this._schedule();
    }
    const m = this.shadowRoot.querySelector(".main");
    if (m) m.scrollTop = 0;
  }
}

/* ---------- Einstellungen: Reiter und Sortieren ---------- */
const SET_TABS = [["raeume", "Räume", "mdi:floor-plan"], ["alarme", "Alarme", "mdi:shield-home-outline"], ["meldungen", "Meldungen", "mdi:cellphone-message"], ["technik", "Technik", "mdi:heat-pump-outline"], ["darstellung", "Darstellung", "mdi:tune-variant"]];
const SET_TAB_KEYS = {
  raeume: ["area_order", "hidden_areas", "floor_order", "outdoor_floors", "pins", "favorites"],
  alarme: ["house_mode", "alerts", "escalation", "alarm_actions"],
  meldungen: ["push", "doorbell"],
  technik: ["heating", "wallbox"],
};
const dragHandle = (label) => `<button class="drag" data-drag aria-label="${esc(label)}" title="Ziehen zum Sortieren (oder Pfeiltasten)">${icon("mdi:drag")}</button>`;
const floorGroup = (f) => (f.outdoor ? "outdoor" : f.level !== null && f.level < 0 ? "lower" : "upper");
const sortIds = (list) => [...list.children].filter((c) => c.classList.contains("sitem")).map((c) => c.dataset.sortId);

function pageEmpty(title, ic, text) {
  return `<div class="ptitle"><h1>${esc(title)}</h1></div><div class="glass empty">${icon(ic)}${esc(text)}<br><small>Prüfe, ob die Geräte einem Bereich zugeordnet sind.</small></div>`;
}

function sectionHTML(h, a, kind, eids, title, ic, roomMode) {
  const meta = GROUP_META[kind] || {};
  const t = title || meta.t || kind;
  const i = ic || meta.i || "mdi:dots-horizontal";
  const counted = kind === "light" || kind === "cover" || kind === "contact";
  let actions = "";
  if (kind === "light") actions = `<button class="gbtn" data-act="list-lights" data-eids="${esc(eids.join(","))}">${icon("mdi:lightbulb-group")}<span></span></button>`;
  if (kind === "cover") actions = `<button class="gbtn" data-act="list-covers" data-svc="open_cover" data-eids="${esc(eids.join(","))}">${icon("mdi:arrow-up")}</button>
    <button class="gbtn" data-act="list-covers" data-svc="close_cover" data-eids="${esc(eids.join(","))}">${icon("mdi:arrow-down")}</button>`;
  const head = roomMode
    ? `<div class="shead"${counted ? ` data-u="gcount" data-kind="${kind}" data-eids="${esc(eids.join(","))}"` : ""}>${icon(i)}<span class="st" data-act="go" data-to="raum/${esc(a.id)}" style="cursor:pointer">${esc(t)}</span><span class="gc"></span><span class="sp"></span>${actions}</div>`
    : `<div class="shead"${counted ? ` data-u="gcount" data-kind="${kind}" data-eids="${esc(eids.join(","))}"` : ""}>${icon(i)}<span class="st">${esc(t)}</span><span class="gc"></span><span class="sp"></span>${actions}</div>`;
  return `<div class="section glass">${head}<div class="tiles">${eids.map((e) => tileHTML(h, e, a)).join("")}</div></div>`;
}

function houseHTML(m, L, h, opts = {}) {
  if (opts.dense) return houseDenseHTML(m, L, h, opts);
  const H = L.header || {};
  const has = (k) => H[k] && h.states[H[k]];
  const pills = [
    has("pv") ? `<span class="ep ep-pv">${icon("mdi:solar-power-variant")}PV <b></b></span>` : "",
    has("battery") ? `<span class="ep ep-battery">${icon("mdi:battery")}<b></b></span>` : "",
    has("power") ? `<span class="ep ep-power">${icon("mdi:home-lightning-bolt-outline")}Haus <b></b></span>` : "",
    has("grid") ? `<span class="ep ep-grid">${icon("mdi:transmission-tower")}Netz <b></b></span>` : "",
  ].join("");
  const floorHTML = (f) => `<div class="floor" data-u="floor" data-floor="${esc(f.id)}">
      <div class="flabel"><span class="fname" title="${esc(f.name)}">${esc(f.short || f.name)}</span>
        <span class="fstat"><span class="fl-lw">${icon("mdi:lightbulb-on-outline")}<span class="fl-l"></span></span><span class="fl-t"></span></span></div>
      <div class="rooms">${f.areas.map((a) => roomTileHTML(a)).join("")}</div></div>`;
  const roof = `<div class="roof" data-u="roof" data-act="roof">
      <svg viewBox="0 0 1000 110" preserveAspectRatio="none">
        <polygon class="shape" points="0,110 500,4 1000,110"/>
        <polygon class="pv" points="140,84 420,32 440,52 160,104"/>
        <line class="pvl" x1="210" y1="71" x2="230" y2="91"/><line class="pvl" x1="280" y1="58" x2="300" y2="78"/><line class="pvl" x1="350" y1="45" x2="370" y2="65"/>
        <line class="pvl" x1="150" y1="94" x2="430" y2="42"/>
      </svg>
      <span class="sun">${icon("mdi:white-balance-sunny")}</span>
      ${pills ? `<div class="energy">${pills}</div>` : `<div class="rtitle">Zuhause</div>`}
    </div>`;
  return `<div class="house">
    ${m.upper.length ? `${roof}<div class="frame">${m.upper.map(floorHTML).join("")}</div>` : ""}
    ${m.lower.length ? `<div class="ground"></div><div class="frame lower">${m.lower.map(floorHTML).join("")}</div>` : ""}
    ${m.outdoor.length ? `<div class="outdoor">${m.outdoor.map(floorHTML).join("")}</div>` : ""}
  </div>`;
}

function energyPills(L, h) {
  const H = L.header || {};
  const has = (k) => H[k] && h.states[H[k]];
  return [
    has("pv") ? `<span class="ep ep-pv">${icon("mdi:solar-power-variant")}PV <b></b></span>` : "",
    has("battery") ? `<span class="ep ep-battery">${icon("mdi:battery")}<b></b></span>` : "",
    has("power") ? `<span class="ep ep-power">${icon("mdi:home-lightning-bolt-outline")}Haus <b></b></span>` : "",
    has("grid") ? `<span class="ep ep-grid">${icon("mdi:transmission-tower")}Netz <b></b></span>` : "",
  ].join("");
}

function houseDenseHTML(m, L, h, opts) {
  const pills = energyPills(L, h);
  const roof = `<div class="roofc" data-u="roof" data-act="roof">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none"><polygon class="shape" points="0,40 500,2 1000,40"/></svg>
      <span class="sun">${icon("mdi:white-balance-sunny")}</span>
      ${pills ? `<div class="energy">${pills}</div>` : ""}</div>`;
  const body = (f, allChips) => {
    const big = allChips ? [] : f.areas.filter(isBigRoom);
    const small = allChips ? f.areas : f.areas.filter((a) => !isBigRoom(a));
    return `<div class="fbody">${big.length ? `<div class="rooms">${big.map((a) => roomTileHTML(a)).join("")}</div>` : ""}${small.length ? `<div class="rchips">${small.map(roomChipHTML).join("")}</div>` : ""}</div>`;
  };
  const floorHTML = (f) => `<div class="floor" data-u="floor" data-floor="${esc(f.id)}">
      <div class="flabel"><span class="fname" title="${esc(f.name)}">${esc(f.short || f.name)}</span>
        <span class="fstat"><span class="fl-lw">${icon("mdi:lightbulb-on-outline")}<span class="fl-l"></span></span><span class="fl-t"></span></span></div>
      ${body(f, f.outdoor)}</div>`;
  if (opts.tab) {
    const f = m.floors.find((x) => x.id === opts.tab) || m.floors[0];
    const tabs = m.floors.map((x) => `<button class="ftab${x === f ? " active" : ""}" data-act="ftab" data-floor="${esc(x.id)}">${esc(x.short || x.name)}</button>`).join("");
    return `<div class="house tabs">${roof}<div class="ftabs">${tabs}</div><div class="frame${f.outdoor ? " out" : ""}">${floorHTML(f)}</div></div>`;
  }
  return `<div class="house">
    ${m.upper.length ? `${roof}<div class="frame">${m.upper.map(floorHTML).join("")}</div>` : ""}
    ${m.lower.length ? `<div class="ground"></div><div class="frame lower">${m.lower.map(floorHTML).join("")}</div>` : ""}
    ${m.outdoor.length ? `<div class="outdoor">${m.outdoor.map(floorHTML).join("")}</div>` : ""}
  </div>`;
}

if (!customElements.get("haus-visualisierung-panel")) customElements.define("haus-visualisierung-panel", HausVisualisierungPanel);

/* ------------------------------------------------------------------------ */
/*  Karten für eigene Dashboards                                             */
/* ------------------------------------------------------------------------ */
let infoPromise = null;
function getInfo(hass) {
  if (!infoPromise) infoPromise = hass.callWS({ type: `${DOMAIN}/info` }).catch(() => ({ layout: DEFAULT_LAYOUT }));
  return infoPromise;
}

class HvCardBase extends HvBase {
  setConfig(config) {
    this._config = config || {};
    this._dirty = true;
    this._schedule();
  }
  connectedCallback() {
    this.classList.add("card");
    super.connectedCallback();
  }
  set hass(h) {
    const first = !this._hass;
    super.hass = h;
    if (first && h) getInfo(h).then((info) => { this._layout = withDefaults(info.layout); this._dirty = true; this._schedule(); });
  }
  get hass() { return this._hass; }
  _actionExtra(act, t) {
    if (act === "nav" || act === "go") {
      const to = t.dataset.to || "";
      this._navigate(`/haus-visualisierung${to ? `/${to}` : ""}`);
    }
    if (act === "roof") { const l = (this._layout.links || [])[0]; if (l && l.path) this._navigate(l.path); }
  }
  getCardSize() { return 3; }
}

class HausRaumCard extends HvCardBase {
  static getStubConfig(hass) { return { area: Object.keys((hass && hass.areas) || {})[0] || "" }; }
  _render() {
    this._config = this._config || {};
    const a = this._model.areas.get(this._config.area);
    const body = a ? roomTileHTML(a) : `<div class="empty">Bereich „${esc(this._config.area || "")}“ nicht gefunden.</div>`;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card style="padding:0;overflow:hidden;background:none;border:0;box-shadow:none">${body}</ha-card>`;
    this._wire(this.shadowRoot);
  }
  getCardSize() { return 2; }
}

class HausHausschnittCard extends HvCardBase {
  static getStubConfig() { return {}; }
  _render() {
    this._config = this._config || {};
    const L = { ...this._layout };
    if (this._config.show_energy === false) L.header = {};
    const body = this._model.visibleAreas.length ? houseHTML(this._model, L, this._hass) : `<div class="empty">Keine Bereiche gefunden.</div>`;
    const title = this._config.title ? `<div class="secttitle" style="margin:4px 4px 10px">${esc(this._config.title)}</div>` : "";
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card style="padding:12px">${title}${body}</ha-card>`;
    this._wire(this.shadowRoot);
  }
  getCardSize() { return 8; }
}

if (!customElements.get("haus-raum-card")) customElements.define("haus-raum-card", HausRaumCard);
if (!customElements.get("haus-hausschnitt-card")) customElements.define("haus-hausschnitt-card", HausHausschnittCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "haus-raum-card")) {
  window.customCards.push(
    { type: "haus-raum-card", name: "Haus Visualisierung – Raum", description: "Raumkachel mit Temperatur, Licht, Rollos und Hinweisen", preview: false },
    { type: "haus-hausschnitt-card", name: "Haus Visualisierung – Hausschnitt", description: "Alle Etagen und Räume als Hausschnitt", preview: false },
  );
}

// Für Tests
window.__HAUS_VIS__ = { VERSION, buildModel, classify, DEFAULT_LAYOUT, hideHaChrome, themeFrame, HV_HA_VARS, evalAlertsAll, techCfg, curveFlow };
