/* Haus Visualisierung – Standardwerte, Hausmodi, Navigation, Designvariablen und allgemeine Hilfsfunktionen (Formatieren, Symbole, DOM). */

/* ------------------------------------------------------------------------ */
/*  Standardwerte (Spiegel von const.py DEFAULT_LAYOUT)                      */
/* ------------------------------------------------------------------------ */
const DEFAULT_LAYOUT = {
  area_order: [], hidden_areas: [], floor_order: [], outdoor_floors: [],
  pins: {}, favorites: [], hidden_entities: [], hide_labels: ["no_dboard", "no-dboard"],
  header: { power: "", pv: "", battery: "", grid: "" },
  energy: { enabled: true, battery_power: "", grid_invert: false, battery_invert: false },
  price: { sensor: "", use_sensor: true, fixed_ct: 30, feed_in_ct: 8, surcharge_ct: 0, window_h: 3 },
  links: [
    { title: "Solar", icon: "mdi:solar-power-variant", path: "/solar-visualisierung", embed: true, mode: "theme" },
    { title: "Kameras", icon: "mdi:cctv", path: "/protect-visualisierung", embed: true, mode: "theme" },
  ],
  show_energy_sensors: false, show_other: true, camera_interval: 10, glass: true,
  start_view: "overview", battery_critical: 15, battery_low: 35, density: "kompakt", header_style: "kompakt", overview_style: "auto",
  confirm_quick: true, show_trends: true,
  heating: { enabled: true, area: "", tank: [], tank_min: 30, tank_max: 65, stove: "", stove_pump: "", stove_hot: 50, curve: "", mixer: "", flow: "", outdoor: "",
    manual_curve: false, manual: { slope: 0.3, level: 0, room: 20, min: 22, max: 40, limit: 16 } },
  wallpanel: { saver_min: 5, black_min: 0, return_min: 2, fullscreen: true, hide_sidebar: true, wake_alarm: true, night_dim: true, wander: false, weather: "", wake_entity: "" },
  shading: { enabled: true, hot: 26, facing: {} },
  forecast: { enabled: true, solar: true, solar_today: "", solar_tomorrow: "" },
  appliances: { enabled: true, auto: true, items: [] },
  wallbox: { enabled: true, area: "", power: "", mode: "", soc: "", limit: "", energy: "", connected: "", charging: "", range: "" },
  doorbell: { enabled: true, entity: "", camera: "", lock: "", timeout: 60, pulse: 2 },
  push: { enabled: true, targets: [], levels: { alarm: true, warn: true, info: true }, resolved: "clear", cooldown: 10, critical: true, persistent: false },
  alerts: {
    builtin: { contacts: true, window_heating: true, safety: true, locks: true, garage: true, battery: false, offline: false, presence_away: true, alarm_panel: true, mold: true, appliances: true },
    modes: {}, contacts_min: 0, mold_hum: 65, mold_min: 30, rules: [],
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
const BUILTIN_MODES = { presence_away: ["abwesend", "urlaub"], mold: ["zuhause"] };
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
    price: { ...DEFAULT_LAYOUT.price, ...((l && l.price) || {}) },
    wallpanel: { ...DEFAULT_LAYOUT.wallpanel, ...((l && l.wallpanel) || {}) },
    forecast: { ...DEFAULT_LAYOUT.forecast, ...((l && l.forecast) || {}) },
    appliances: { ...DEFAULT_LAYOUT.appliances, ...((l && l.appliances) || {}), items: Array.isArray(l && l.appliances && l.appliances.items) ? l.appliances.items : [] },
    shading: { ...DEFAULT_LAYOUT.shading, ...((l && l.shading) || {}), facing: { ...((l && l.shading && l.shading.facing) || {}) } },
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


// Technische Temperaturen taugen nicht als Raumtemperatur
const TECH_RE = /(vorlauf|r(ü|ue)cklauf|speicher|puffer|kessel|kamin|solar|kollektor|boiler|warmwasser|abgas|cpu)/i;
const OUTDOOR_RE = /(au(ß|ss)en|garten|drau(ß|ss)en|outdoor|grundst(ü|ue)ck)/i;

/* ---------- DOM-Helfer ---------- */
const icon = (i, cls = "") => `<ha-icon icon="${esc(i)}"${cls ? ` class="${cls}"` : ""}></ha-icon>`;
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
const setHtml = (n, html) => { if (n && n._h !== html) { n.innerHTML = html; n._h = html; } };

/* ---------- Navigation des Panels ---------- */
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

/** Aktualisierer je data-u: { watch, run }. Gefüllt in bindungen.js, damit Klima- und Energie-Seite
 *  ohne Ringabhängigkeit nachladen können. */
const UPD = {};

export { areaIcon, batteryIcon, BUILTIN_MODES, dc, DEFAULT_LAYOUT, dom, entIcon, entName, esc, fmtPower, fmtState, hideHaChrome, HOUSE_MODES, HV_BLUR, HV_HA_VARS, hvThemeCss, icon, installNavGuard, isDense, isOn, isUnav, MODE_ICON, MODE_NAME, NAV, NF0, NF1, num, OUTDOOR_RE, panelPathOf, powerW, relTime, setHidden, setHtml, setIcon, setText, setWidth, TECH_RE, themeFrame, UNAV, UPD, withDefaults };
