/* Haus Visualisierung – Einrichtungsassistent im Panel (Seite „einrichtung“, nur Administratoren).
 * Startet beim ersten Öffnen (setup.done = false) und lässt sich jederzeit aus den Einstellungen erneut starten,
 * um Lücken zu ergänzen. Jeder Schritt zeigt, was automatisch erkannt wurde (Label, Energie-Dashboard, Integration,
 * Name), und bietet eine Auswahl nach Art bzw. Einheit statt freier Eingabe. Gespeichert wird beim Wechsel des
 * Schritts – nur die Änderungen, wie in den Einstellungen. */

import { DOMAIN } from "./version.js";
import { dc, dom, entName, esc, fmtState, icon, withDefaults } from "./grundlagen.js";
import { buildModel } from "./modell.js";
import { headerAuto } from "./solar.js";
import { energieAuto, energyPrefs, isEnergyUnit, isPower, isPrice, labelled, ROLLEN } from "./erkennung.js";
import { techCfg, WB_MODES } from "./technik.js";
import { weatherIdOf } from "./wetter.js";
import { wxAuto } from "./wetterwarnung.js";
import { solarCfg } from "./prognose.js";
import { calKind } from "./termine.js";
import { priceCfg } from "./strompreis.js";
import { setupChecks } from "./system.js";
import { layoutChanges } from "./panel-aktionen.js";

const STEPS = [
  ["raeume", "Räume", "mdi:floor-plan"],
  ["energie", "Energie", "mdi:solar-power-variant"],
  ["wetter", "Wetter", "mdi:weather-partly-cloudy"],
  ["sicherheit", "Sicherheit", "mdi:shield-home-outline"],
  ["technik", "Heizung & Wallbox", "mdi:heat-pump-outline"],
  ["kalender", "Kalender", "mdi:calendar-month"],
  ["push", "Push", "mdi:cellphone-message"],
  ["fertig", "Fertig", "mdi:check-circle-outline"],
];

/* Auswahl nach Art: welche Entitäten in eine Liste gehören (Domäne, Geräteklasse, Einheit) */
const unit = (st) => String((st && st.attributes.unit_of_measurement) || "");
const KIND = {
  power: (e, st) => dom(e) === "sensor" && isPower(st),
  soc: (e, st) => dom(e) === "sensor" && (dc(st) === "battery" || unit(st) === "%"),
  price: (e, st) => dom(e) === "sensor" && isPrice(st),
  temp: (e, st) => dom(e) === "sensor" && dc(st) === "temperature",
  energy: (e, st) => dom(e) === "sensor" && isEnergyUnit(st),
  percent: (e, st) => (dom(e) === "sensor" && unit(st) === "%") || ["switch", "fan", "binary_sensor", "number"].includes(dom(e)),
  km: (e, st) => dom(e) === "sensor" && /^(km|mi)$/.test(unit(st)),
  weather: (e) => dom(e) === "weather",
  dwd: (e, st) => dom(e) === "sensor" && "warning_count" in st.attributes,
  binary: (e) => dom(e) === "binary_sensor",
  cover: (e) => dom(e) === "cover",
  alarm: (e) => dom(e) === "alarm_control_panel",
  bell: (e) => ["event", "binary_sensor"].includes(dom(e)),
  camera: (e) => dom(e) === "camera",
  opener: (e) => ["lock", "switch", "button", "input_button", "script", "input_boolean"].includes(dom(e)),
  select: (e) => ["select", "input_select"].includes(dom(e)),
  number: (e) => ["number", "input_number", "select", "input_select"].includes(dom(e)),
  sensor: (e) => dom(e) === "sensor",
  value: (e) => ["sensor", "binary_sensor", "climate", "water_heater", "switch", "number", "select"].includes(dom(e)),
};
const KIND_TXT = { power: "Leistung (W, kW)", soc: "Prozent (%)", price: "Preis je kWh", temp: "Temperatur", energy: "Energie (kWh)", percent: "Prozent oder Schalter",
  km: "Kilometer", weather: "Wetter-Entität", dwd: "DWD-Warnsensor", binary: "Binärsensor", cover: "Rollo/Markise", alarm: "Alarmanlage", bell: "Ereignis oder Binärsensor",
  camera: "Kamera", opener: "Schloss, Schalter, Taste oder Skript", select: "Auswahl", number: "Zahl oder Auswahl", sensor: "Sensor", value: "Sensor, Klima, Schalter …" };

let _cand = { states: null, ents: null, lists: {} };
/** Kandidaten einer Art, nach Anzeigenamen sortiert (zwischengespeichert, bis neue Entitäten dazukommen). */
function candidates(h, kind) {
  const n = Object.keys(h.states).length;
  if (_cand.n !== n || _cand.ents !== h.entities) _cand = { n, ents: h.entities, lists: {} };
  if (!_cand.lists[kind]) {
    const ok = KIND[kind] || (() => true);
    _cand.lists[kind] = Object.keys(h.states).filter((e) => { try { return ok(e, h.states[e]); } catch (err) { return false; } })
      .sort((a, b) => entName(h, a).localeCompare(entName(h, b), "de") || a.localeCompare(b));
  }
  return _cand.lists[kind];
}

const get = (o, path) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function put(o, path, v) {
  const ks = path.split(".");
  let x = o;
  for (const k of ks.slice(0, -1)) x = x[k] = x[k] !== null && typeof x[k] === "object" && !Array.isArray(x[k]) ? x[k] : {};
  x[ks[ks.length - 1]] = v;
}

const AS_CSS = `
.asnav{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.asnav .altab.done ha-icon{color:var(--hv-ok,#5fd38d)}
.asbar{position:sticky;bottom:0;display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px 12px;margin-top:12px;border-radius:14px;z-index:3}
.asbar .sp{flex:1}
.asfound{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.asfound span{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:13px}
.asfound span.no{opacity:.6}
.asval{min-width:84px;text-align:right;color:var(--hv-dim);font-size:13px;white-space:nowrap}
.asfloor{margin:8px 0 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.asfloor b{font-size:14px}
.astab{width:100%;border-collapse:collapse;font-size:13px}.astab td{padding:4px 6px;border-top:1px solid var(--hv-line);vertical-align:top}.astab code{font-size:12px}
.narrow .asval{display:none}
`;

/* ---------- Bausteine der Schritte ---------- */
function srcTxt(src) {
  return { Label: "über ein Label", "Energie-Dashboard": "aus dem Energie-Dashboard", "Solar-Visualisierung": "aus der Solar-Visualisierung", Name: "nach dem Namen", Einheit: "nach der Einheit", Gerät: "am selben Gerät", Integration: "über die Integration", eingestellt: "eingestellt" }[src] || src || "";
}

/** Auswahl einer Entität mit „Automatisch“ als erstem Eintrag; daneben der aktuelle Wert. */
function pick(p, path, label, kind, auto, src, hint) {
  const h = p._hass, D = p._as.draft, cur = get(D, path) || "";
  const list = candidates(h, kind);
  const opts = cur && !list.includes(cur) ? [cur, ...list] : list;
  const eff = cur || auto;
  const st = eff && h.states[eff];
  const autoTxt = auto ? `Automatisch: ${entName(h, auto)}${src ? ` (${srcTxt(src)})` : ""}` : "Automatisch – nichts erkannt";
  return `<div class="srow"><span class="lbl">${label}<small>${esc(hint || KIND_TXT[kind] || "")}</small></span>
    <select class="inp w" data-as="${path}" aria-label="${esc(label)}"><option value="">${esc(autoTxt)}</option>${opts.map((e) => `<option value="${esc(e)}" ${cur === e ? "selected" : ""}>${esc(entName(h, e))} · ${esc(e)}</option>`).join("")}</select>
    <span class="asval">${st ? esc(fmtState(h, st)) : ""}</span></div>`;
}

/** Liste von Entitäten: Chips (entfernen per Tipp) plus Auswahl zum Hinzufügen; leer = automatisch. */
function multi(p, path, label, kind, auto, hint) {
  const h = p._hass, cur = get(p._as.draft, path) || [];
  const eff = cur.length ? cur : auto || [];
  const chips = eff.length ? eff.map((e) => `<span class="pin">${esc(entName(h, e))}<button data-act="as-del" data-path="${path}" data-eid="${esc(e)}" title="Entfernen" aria-label="${esc(entName(h, e))} entfernen">${icon("mdi:close")}</button></span>`).join("")
    : '<span class="lbl"><small>Nichts erkannt.</small></span>';
  const rest = candidates(h, kind).filter((e) => !eff.includes(e));
  return `<div class="srow"><span class="lbl">${label}<small>${esc(hint || "")} ${cur.length ? "Eigene Auswahl." : auto && auto.length ? "Automatisch erkannt." : ""}</small></span></div>
    <div class="srow"><div class="pins" style="padding-left:0">${chips}</div></div>
    <div class="srow"><select class="inp w" data-as-add="${path}" aria-label="${esc(label)} hinzufügen"><option value="">Hinzufügen … (${esc(KIND_TXT[kind] || "")})</option>${rest.map((e) => `<option value="${esc(e)}">${esc(entName(h, e))} · ${esc(e)}</option>`).join("")}</select>
      ${cur.length ? `<button class="pbtn sm" data-act="as-auto" data-path="${path}">${icon("mdi:auto-fix")}Automatisch</button>` : ""}</div>`;
}

const toggle = (p, path, label, hint) => {
  const on = !!get(p._as.draft, path);
  return `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><label class="tgl"><input type="checkbox" data-as="${path}" data-as-bool="1" ${on ? "checked" : ""}><span></span></label></div>`;
};
const found = (items) => `<div class="asfound">${items.map(([ok, txt]) => `<span class="${ok ? "" : "no"}">${icon(ok ? "mdi:check" : "mdi:minus")}${esc(txt)}</span>`).join("")}</div>`;

/* ---------- Schritte ---------- */
function stepRaeume(p) {
  const h = p._hass, D = p._as.draft;
  const m = buildModel(h, { ...D, hidden_areas: [] });
  const hidden = new Set(D.hidden_areas || []), outF = new Set(D.outdoor_floors || []);
  const areas = [...m.areas.values()];
  const cnt = (k) => areas.reduce((s, a) => s + ((a.groups && a.groups[k]) || []).length, 0);
  const temps = areas.filter((a) => a.tempId).length;
  const floors = m.floors.map((f) => `<div class="asfloor"><b>${icon(f.outdoor ? "mdi:tree-outline" : "mdi:layers-outline")}${esc(f.name)}</b>
      ${f.virtual ? "" : `<label class="tchip${outF.has(f.id) ? " on" : ""}" title="Etage als „Außen“ darstellen"><input type="checkbox" data-as-floor="${esc(f.id)}" ${outF.has(f.id) ? "checked" : ""}>${icon("mdi:pine-tree")}Außen</label>`}</div>
    <div class="tchips">${f.areas.map((a) => `<label class="tchip${hidden.has(a.id) ? "" : " on"}" title="${hidden.has(a.id) ? "ausgeblendet – Tipp zeigt den Raum" : "angezeigt – Tipp blendet ihn aus"}"><input type="checkbox" data-as-area="${esc(a.id)}" ${hidden.has(a.id) ? "" : "checked"}>${icon(a.icon)}${esc(a.name)}</label>`).join("")}</div>`).join("");
  return `<h2>${icon("mdi:floor-plan")}Räume und Etagen</h2>
    <p class="hint">Die Visualisierung baut sich aus den Etagen und Bereichen von Home Assistant auf: jedes Gerät erscheint in seinem Raum, sortiert nach Art. Neue Räume legst du in Home Assistant an und ordnest dort Geräte zu – hier wählst du nur, was angezeigt wird.</p>
    ${found([[m.floors.length, `${m.floors.filter((f) => !f.virtual).length} Etagen`], [areas.length, `${areas.length} Bereiche`], [cnt("light"), `${cnt("light")} Lichter`], [cnt("cover"), `${cnt("cover")} Rollos`], [temps, `${temps} Räume mit Temperatur`], [cnt("contact"), `${cnt("contact")} Fenster/Türen`]])}
    ${areas.length ? floors : `<p class="hint">${icon("mdi:alert-outline")} Noch keine Bereiche. Lege sie in Home Assistant unter Einstellungen → Bereiche, Labels & Zonen an und ordne die Geräte zu.</p>`}
    <div class="srow"><button class="pbtn" data-act="link" data-path="/config/areas/dashboard">${icon("mdi:open-in-new")}Bereiche in Home Assistant</button></div>
    <p class="hint">Reihenfolge, Raum-Pins und Favoriten: Einstellungen → Räume.</p>`;
}

function stepEnergie(p) {
  const h = p._hass, D = p._as.draft;
  const prefs = energyPrefs(h, () => { p._dirty = true; p._schedule(); });
  // automatisch erkannt = mit leeren Feldern
  const HA = headerAuto(h, { ...D, header: { power: "", pv: "", battery: "", grid: "" } });
  const A = energieAuto(h);
  const pc = priceCfg(h, { ...D, price: { ...D.price, sensor: "" } });
  const ed = prefs && (prefs.energy_sources || []).length;
  return `<h2>${icon("mdi:solar-power-variant")}Energie</h2>
    <p class="hint">Für Kopfzeile, Dach im Hausschnitt und die Seite „Energie“. Erkannt wird über Labels, das Energie-Dashboard von Home Assistant${p._hass.panels && p._hass.panels["solar-visualisierung"] ? ", die Solar-Visualisierung" : ""} und zuletzt über Namen. Ohne PV bleiben die Felder einfach leer.</p>
    ${found([[ed, ed ? "Energie-Dashboard eingerichtet" : prefs === null ? "Energie-Dashboard nicht gefunden" : "Energie-Dashboard wird gelesen …"], [HA.v.pv, "PV"], [HA.v.grid, "Netz"], [HA.v.battery, "Akku"], [pc.sensor, "Strompreis"]])}
    ${toggle(p, "energy.enabled", "Seite „Energie“ anzeigen")}
    ${pick(p, "header.pv", "PV-Leistung", "power", HA.v.pv, HA.src.pv)}
    ${pick(p, "header.grid", "Netz-Leistung", "power", HA.v.grid, HA.src.grid, "Leistung mit Vorzeichen: Bezug positiv, Einspeisung negativ")}
    ${toggle(p, "energy.grid_invert", "Netz umkehren", "falls der Sensor Einspeisung positiv meldet")}
    ${pick(p, "header.power", "Hausverbrauch", "power", HA.v.power, HA.src.power, "ohne Sensor aus PV, Netz und Speicher berechnet")}
    ${pick(p, "header.battery", "Akku-Ladestand", "soc", HA.v.battery, HA.src.battery)}
    ${pick(p, "energy.battery_power", "Speicher-Leistung", "power", A.battery_power, A.src.battery_power, "Laden positiv, Entladen negativ")}
    ${toggle(p, "energy.battery_invert", "Speicher umkehren", "falls der Sensor Entladen positiv meldet")}
    ${pick(p, "price.sensor", "Strompreis", "price", pc.auto ? pc.sensor : "", pc.auto ? "Einheit" : "", "Sensor mit Einheit …/kWh (Tibber, Nordpool, EPEX …); ohne Sensor gilt der feste Preis in den Einstellungen")}`;
}

function stepWetter(p) {
  const h = p._hass, D = p._as.draft;
  const wx = wxAuto(h), sc = solarCfg(h, { ...D, forecast: { ...D.forecast, solar_today: "", solar_tomorrow: "" } });
  const wid = weatherIdOf(h, { ...D, wallpanel: { ...D.wallpanel, weather: "" } });
  return `<h2>${icon("mdi:weather-partly-cloudy")}Wetter</h2>
    <p class="hint">Vorhersage, Beschattungshinweise, Wetterwarnungen und Solarprognose. Alles optional.</p>
    ${found([[wid, "Wetter-Entität"], [wx.dwd.length, wx.dwd.length ? `${wx.dwd.length} DWD-Warnsensoren` : "keine DWD-Warnungen"], [wx.rain, "Regensensor"], [wx.awnings.length, `${wx.awnings.length} Markisen`], [sc, sc ? `Solarprognose (${sc.src})` : "keine Solarprognose"]])}
    ${pick(p, "wallpanel.weather", "Wetter", "weather", wid, wid ? "Integration" : "")}
    ${toggle(p, "weather_alerts.enabled", "Wetterwarnungen", "Unwetter, Regen bei offenen Fenstern, Sturm bei ausgefahrener Markise")}
    ${multi(p, "weather_alerts.dwd", "DWD-Warnsensoren", "dwd", wx.dwd, "Integration „DWD Weather Warnings“.")}
    ${pick(p, "weather_alerts.rain_sensor", "Regensensor", "binary", wx.rain, wx.rain ? (labelled(h, "haus_regensensor").includes(wx.rain) ? "Label" : "Name") : "")}
    ${multi(p, "weather_alerts.awnings", "Markisen", "cover", wx.awnings, "Für die Sturmwarnung.")}
    ${pick(p, "forecast.solar_today", "Solarprognose heute", "energy", sc && sc.today[0], sc ? "Integration" : "", "kWh – Forecast.Solar, Solcast oder eigener Sensor")}
    ${pick(p, "forecast.solar_tomorrow", "Solarprognose morgen", "energy", sc && sc.tomorrow[0], sc ? "Integration" : "", "kWh")}`;
}

function alarmAuto(h) {
  const ids = Object.keys(h.states).filter((e) => e.startsWith("alarm_control_panel."));
  return ids.find((e) => e.includes("alarmo")) || (ids.length === 1 ? ids[0] : "");
}

function stepSicherheit(p) {
  const h = p._hass, D = p._as.draft;
  const al = alarmAuto(h);
  const saved = p._layout;
  p._layout = { ...saved, doorbell: { ...D.doorbell, entity: "", camera: "" } };
  p._bellAuto = undefined;
  let bell = null, cam = null;
  try { bell = p._bellEntity(); cam = p._bellCamera ? p._bellCamera() : null; } finally { p._layout = saved; p._bellAuto = undefined; }
  return `<h2>${icon("mdi:shield-home-outline")}Sicherheit</h2>
    <p class="hint">Fenster, Türen, Schlösser, Rauch- und Wassermelder erkennt die Visualisierung selbst (Geräteklasse). Hier geht es um Alarmanlage und Klingel.</p>
    ${found([[al, al ? "Alarmanlage" : "keine Alarmanlage"], [bell, bell ? "Klingel" : "keine Klingel"], [cam, cam ? "Kamera an der Klingel" : "keine Kamera"]])}
    ${pick(p, "house_mode.alarmo", "Alarmanlage", "alarm", al, al ? "Integration" : "", "z. B. Alarmo; der Hausmodus kann sie scharf schalten")}
    ${toggle(p, "house_mode.alarmo_sync", "Hausmodus und Alarmanlage koppeln", "Abwesend schaltet scharf, Zuhause unscharf")}
    ${toggle(p, "doorbell.enabled", "Klingel-Fenster", "bei jedem Klingeln mit Kamera und Türöffner")}
    ${pick(p, "doorbell.entity", "Klingel", "bell", bell, bell ? (labelled(h, "haus_klingel").includes(bell) ? "Label" : dc(h.states[bell]) === "doorbell" ? "Gerät" : "Name") : "", "Ereignis (event) oder Binärsensor; jede Klingel mit device_class doorbell wird erkannt")}
    ${pick(p, "doorbell.camera", "Kamera", "camera", cam, cam ? "Gerät" : "")}
    ${pick(p, "doorbell.lock", "Türöffner", "opener", "", "", "optional")}`;
}

function stepTechnik(p) {
  const h = p._hass, D = p._as.draft;
  const m = buildModel(h, { ...D, hidden_areas: [] });
  const blankH = Object.fromEntries(Object.entries(D.heating).map(([k, v]) => [k, typeof v === "string" ? "" : k === "tank" || k === "extra" ? [] : v]));
  const blankW = Object.fromEntries(Object.entries(D.wallbox).map(([k, v]) => [k, typeof v === "string" ? "" : v]));
  const auto = techCfg(h, { ...D, heating: { ...blankH, enabled: true, parts: {} }, wallbox: { ...blankW, enabled: true } }, m.areas);
  const AH = auto.heat || {}, AW = auto.wb || {};
  const areaName = (id) => (id && m.areas.get(id) ? m.areas.get(id).name : "–");
  const areaSel = (path, autoId) => { const cur = get(D, path) || ""; return `<select class="inp w" data-as="${path}"><option value="">Automatisch (${esc(areaName(autoId))})</option>${[...m.areas.values()].sort((a, b) => a.name.localeCompare(b.name, "de")).map((a) => `<option value="${esc(a.id)}" ${cur === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`; };
  const parts = { tank: true, stove: true, curve: true, ...(D.heating.parts || {}) };
  const partChips = [["tank", "Speicher", "mdi:storage-tank-outline"], ["stove", "Kamin", "mdi:fireplace"], ["curve", "Heizkurve", "mdi:chart-bell-curve-cumulative"]]
    .map(([k, t, i]) => `<label class="tchip${parts[k] ? " on" : ""}"><input type="checkbox" data-as="heating.parts.${k}" data-as-bool="1" ${parts[k] ? "checked" : ""}>${icon(i)}${t}</label>`).join("");
  const ms = (D.wallbox.mode || AW.mode) && h.states[D.wallbox.mode || AW.mode];
  const opts = ms ? ms.attributes.options || [] : [];
  const names = D.wallbox.mode_names || {};
  return `<h2>${icon("mdi:heat-pump-outline")}Heizung</h2>
    <p class="hint">Die Karte „Heizung“ setzt sich aus Bausteinen zusammen: Speicher (Schichtung), Kamin, Heizkurve und beliebige weitere Werte, z. B. von einer Wärmepumpe oder Gastherme. Sie erscheint auf der Raumseite des Heizungsraums.</p>
    ${found([[AH.area, AH.area ? `Raum ${areaName(AH.area)}` : "kein Heizungsraum"], [(AH.tank || []).length, `${(AH.tank || []).length} Speicherfühler`], [AH.stove, "Kamin"], [AH.curve, "Heizkurve"], [(AH.extra || []).length, `${(AH.extra || []).length} weitere Werte`]])}
    ${toggle(p, "heating.enabled", "Heizungs-Karte anzeigen")}
    <div class="srow"><span class="lbl">Raum<small>Label „Haus Heizung“ am Bereich oder Name wie „Heizung“/„Technik“</small></span>${areaSel("heating.area", AH.area)}</div>
    <div class="srow"><span class="lbl">Bausteine</span><div class="tchips">${partChips}</div></div>
    ${parts.tank ? multi(p, "heating.tank", "Speicherfühler", "temp", AH.tank, "Von oben nach unten.") : ""}
    ${parts.stove ? pick(p, "heating.stove", "Kamin-Temperatur", "temp", AH.stove, AH.stove ? "Name" : "") : ""}
    ${parts.stove ? pick(p, "heating.stove_pump", "Kamin-Pumpe", "percent", AH.pump, AH.pump ? "Name" : "") : ""}
    ${parts.curve ? pick(p, "heating.curve", "Heizkurve", "sensor", AH.curve, AH.curve ? "Integration" : "", "Sensor der Integration „Heizkurve Fußbodenheizung“ – ohne sie: Einstellungen → Technik") : ""}
    ${pick(p, "heating.flow", "Vorlauf", "temp", AH.flow, AH.flow ? "Name" : "")}
    ${multi(p, "heating.extra", "Weitere Werte", "value", AH.extra, "Baustein „Werte“, z. B. Wärmepumpe: Leistung, Rücklauf, Betriebsart.")}
    <h2 style="margin-top:18px">${icon("mdi:ev-station")}Wallbox</h2>
    <p class="hint">Erkannt über das Label „Haus Wallbox“, die Integration (EVCC, go-e, Easee, Wallbox, KEBA, openWB, OCPP, Zaptec …) samt aller Entitäten des Geräts, zuletzt über Namen.</p>
    ${found([[AW.power || AW.mode, AW.power || AW.mode ? "Wallbox erkannt" : "keine Wallbox"], [AW.mode, "Lademodus"], [AW.soc, "Ladestand"]])}
    ${toggle(p, "wallbox.enabled", "Wallbox-Karte anzeigen")}
    <div class="srow"><span class="lbl">Raum</span>${areaSel("wallbox.area", AW.area)}</div>
    ${pick(p, "wallbox.power", "Ladeleistung", "power", AW.power, AW.power ? "Integration" : "")}
    ${pick(p, "wallbox.mode", "Lademodus", "select", AW.mode, AW.mode ? "Integration" : "")}
    ${opts.length ? `<p class="hint">Namen der Lademodi auf der Karte; leer = ${opts.some((o) => WB_MODES[String(o).toLowerCase()]) ? "wie bei EVCC" : "Name der Option"}, „-“ blendet aus.</p>${opts.map((o) => `<div class="srow"><span class="lbl">${esc(o)}</span><input class="inp" data-as-wbmode="${esc(o)}" value="${esc(names[o] || "")}" placeholder="${esc(WB_MODES[String(o).toLowerCase()] || o)}" maxlength="30"></div>`).join("")}` : ""}
    ${pick(p, "wallbox.soc", "Ladestand Auto", "soc", AW.soc, AW.soc ? "Integration" : "")}
    ${pick(p, "wallbox.limit", "Ziel-Ladestand", "number", AW.limit, AW.limit ? "Integration" : "")}
    ${pick(p, "wallbox.range", "Reichweite", "km", AW.range, AW.range ? "Integration" : "")}`;
}

function stepKalender(p) {
  const h = p._hass, D = p._as.draft, T = D.termine || {};
  const cals = Object.keys(h.states).filter((e) => e.startsWith("calendar.")).sort();
  const kindTxt = { waste: "Müllabfuhr", event: "Termine", "": "nicht anzeigen" };
  const rows = cals.map((e) => {
    const set = (T.cals || {})[e] || "", auto = calKind(h, { ...T, cals: {} }, e);
    return `<div class="srow"><span class="lbl">${esc(entName(h, e))}<small>${esc(e)}</small></span>
      <select class="inp" data-as-cal="${esc(e)}"><option value="">Automatisch (${kindTxt[auto]})</option>${[["waste", "Müllabfuhr"], ["event", "Termine"], ["-", "nicht anzeigen"]].map(([k, t]) => `<option value="${k}" ${set === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  }).join("");
  return `<h2>${icon("mdi:calendar-month")}Kalender</h2>
    <p class="hint">Müllabfuhr und Termine erscheinen in Kopfzeile, Bildschirmschoner und auf der Seite „Kalender“. Müllkalender erkennt die Visualisierung am Label „Haus Müll“, an der Integration (z. B. Waste Collection Schedule) oder am Namen.</p>
    ${found([[cals.length, `${cals.length} Kalender`], [cals.some((e) => calKind(h, T, e) === "waste"), cals.some((e) => calKind(h, T, e) === "waste") ? "Müllabfuhr erkannt" : "keine Müllabfuhr"]])}
    ${toggle(p, "termine.enabled", "Müllabfuhr und Termine anzeigen")}
    ${toggle(p, "termine.page", "Seite „Kalender“ im Menü")}
    ${rows || '<p class="hint">Keine Kalender gefunden – z. B. Waste Collection Schedule, CalDAV (iCloud), Google Kalender oder Lokaler Kalender einrichten.</p>'}
    <h2 style="margin-top:18px">${icon("mdi:image-multiple-outline")}Fotos im Bildschirmschoner</h2>
    <p class="hint">Optional: Fotos aus Apple Fotos auf dem Wandpanel. In der Fotos-App ein geteiltes Album anlegen, unter „Personen“ → „Öffentliche Website“ einschalten und den Link hier eintragen.</p>
    <div class="srow"><span class="lbl">Link zum geteilten iCloud-Album<small>leer = ohne Fotos</small></span><input class="inp w" type="url" data-as="wallpanel.photos" value="${esc((p._as.draft.wallpanel || {}).photos || "")}" placeholder="https://www.icloud.com/sharedalbum/#…"></div>`;
}

function stepPush(p) {
  const h = p._hass, D = p._as.draft, P = D.push;
  if (!p._pushInfo && !p._pushLoading && h.callWS) {
    p._pushLoading = true;
    h.callWS({ type: `${DOMAIN}/push_info` }).then((r) => { p._pushInfo = r; }).catch(() => { p._pushInfo = { services: [], targets: [], active: [] }; })
      .finally(() => { p._pushLoading = false; p._dirty = true; p._schedule(); });
  }
  const info = p._pushInfo;
  const services = info ? info.services.filter((x) => !["send_message", "persistent_notification"].includes(x)) : [];
  const chips = info ? (services.length ? services.map((sv) => `<label class="tchip${P.targets.includes(sv) ? " on" : ""}"><input type="checkbox" data-as-push="${esc(sv)}" ${P.targets.includes(sv) ? "checked" : ""}>${icon(sv.startsWith("mobile_app_") ? "mdi:cellphone" : "mdi:bell-outline")}${esc(sv)}</label>`).join("")
    : '<span class="lbl"><small>Keine notify-Dienste gefunden – ist die Companion-App eingerichtet?</small></span>') : '<span class="lbl"><small>Lade …</small></span>';
  return `<h2>${icon("mdi:cellphone-message")}Push-Benachrichtigungen</h2>
    <p class="hint">Warnungen und Alarme kommen über die Companion-App aufs Handy – auch wenn kein Panel offen ist.</p>
    ${found([[services.length, `${services.length} Benachrichtigungsdienste`]])}
    ${toggle(p, "push.enabled", "Push-Benachrichtigungen senden")}
    <div class="srow"><div class="tchips">${chips}</div></div>
    <p class="hint">${P.targets.length ? "Nur die markierten Dienste erhalten Meldungen." : `Keine Auswahl = alle Handys mit der Companion-App${info && info.targets.length ? `: ${info.targets.map(esc).join(", ")}` : ""}.`}</p>`;
}

function stepFertig(p) {
  const h = p._hass, D = p._as.draft;
  const checks = setupChecks(h, D), warns = checks.filter((x) => x.lvl === "warn");
  const rollen = Object.entries(ROLLEN).map(([id, [name, txt]]) => `<tr><td>${esc(name)}</td><td><code>${id}</code></td><td>${esc(txt)}</td></tr>`).join("");
  return `<h2>${icon("mdi:check-circle-outline")}Fertig</h2>
    <p class="hint">Alles Weitere – Alarme und Warnregeln, Hausmodus, Wanddisplays, Darstellung – steht in den Einstellungen. Den Assistenten startest du dort jederzeit erneut, um etwas zu ergänzen.</p>
    ${found([[!warns.length, warns.length ? `${warns.length} wichtige Punkte im Einrichtungs-Check` : "Einrichtungs-Check ohne wichtige Punkte"]])}
    ${warns.slice(0, 6).map((x) => `<div class="srow">${icon(x.icon)}<span class="lbl">${esc(x.title)}<small>${esc(x.detail)}</small></span></div>`).join("")}
    <details class="sadv"><summary>Labels für die Zuordnung</summary>
      <p class="hint">Was die Erkennung nicht trifft, ordnest du in Home Assistant mit einem Label zu (an der Entität, am Gerät oder – für Räume – am Bereich). Das Label „Haus PV“ bekommt dort die ID <code>haus_pv</code>.</p>
      <table class="astab">${rollen}</table></details>`;
}

const STEP_HTML = { raeume: stepRaeume, energie: stepEnergie, wetter: stepWetter, sicherheit: stepSicherheit, technik: stepTechnik, kalender: stepKalender, push: stepPush, fertig: stepFertig };

/* ---------- Seite ---------- */
function asEnsure(p) {
  if (!p._as) p._as = { step: 0, draft: structuredClone(p._layout), base: structuredClone(p._layout), seen: new Set([0]) };
  return p._as;
}

function asPageHTML(p) {
  const A = asEnsure(p), [key] = STEPS[A.step], last = A.step === STEPS.length - 1;
  let body;
  try { body = STEP_HTML[key](p); } catch (err) { console.error("Haus Visualisierung:", err); body = `<p class="hint">Fehler: ${esc(err.message)}</p>`; }
  const nav = STEPS.map(([k, t, i], n) => `<button class="altab sm${n === A.step ? " on" : ""}${A.seen.has(n) && n !== A.step ? " done" : ""}" data-act="as-go" data-step="${n}">${icon(i)}<span>${t}</span></button>`).join("");
  const first = !p._layout.setup || p._layout.setup.done === false;
  return `<style>${AS_CSS}</style>
    <div class="ptitle"><h1>Einrichtung</h1><span class="psub">Schritt ${A.step + 1} von ${STEPS.length}${first ? " · erste Einrichtung" : " · ergänzen"}</span><span class="sp"></span></div>
    <nav class="asnav" aria-label="Schritte">${nav}</nav>
    <div class="set glass asstep" data-step="${key}">${body}</div>
    <div class="asbar glass">
      <button class="pbtn" data-act="as-skip">${icon("mdi:close")}${first ? "Später" : "Schließen"}</button><span class="sp"></span>
      ${A.step ? `<button class="pbtn" data-act="as-go" data-step="${A.step - 1}">${icon("mdi:chevron-left")}Zurück</button>` : ""}
      ${last ? `<button class="pbtn primary" data-act="as-done">${icon("mdi:check")}Fertig</button>` : `<button class="pbtn primary" data-act="as-go" data-step="${A.step + 1}">Weiter${icon("mdi:chevron-right")}</button>`}
    </div>`;
}

/** Änderungen des Assistenten speichern (nur Unterschiede); extra = zusätzliche Werte wie setup.done. */
async function asSave(p, extra) {
  const A = asEnsure(p);
  const next = structuredClone(A.draft);
  if (extra) for (const [k, v] of Object.entries(extra)) put(next, k, v);
  const changes = layoutChanges(A.base, next);
  if (!changes.length) return true;
  try {
    const res = await p._hass.callWS({ type: `${DOMAIN}/save`, changes });
    p._layout = withDefaults(res.layout);
    A.base = structuredClone(p._layout);
    A.draft = structuredClone(p._layout);
    return true;
  } catch (err) {
    p._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`);
    return false;
  }
}

const AssistentMixin = (Base) => class extends Base {
  async _actionExtra(act, t) {
    if (!act || !act.startsWith("as-")) return super._actionExtra(act, t);
    const A = asEnsure(this);
    const redraw = () => { this._dirty = true; this._flush(); };
    switch (act) {
      case "as-go": {
        const n = Math.max(0, Math.min(STEPS.length - 1, Number(t.dataset.step)));
        if (!(await asSave(this))) return;
        A.step = n; A.seen.add(n);
        redraw();
        const mn = this.shadowRoot.querySelector(".main");
        if (mn) mn.scrollTop = 0;
        return;
      }
      case "as-del": {
        const path = t.dataset.path, cur = get(A.draft, path) || [];
        const eff = cur.length ? cur : this._asAuto(path);
        const next = eff.filter((e) => e !== t.dataset.eid);
        put(A.draft, path, next);  // leer = wieder automatisch
        redraw(); return;
      }
      case "as-auto": put(A.draft, t.dataset.path, []); redraw(); return;
      case "as-skip": case "as-done": {
        if (!(await asSave(this, { "setup.done": true }))) return;
        this._as = null;
        if (act === "as-done") this._toast("Einrichtung gespeichert");
        this._go("");
        this._dirty = true; this._flush();
        return;
      }
      default: return;
    }
  }

  /** Automatisch erkannte Liste eines Mehrfachfelds (für „entfernen“ aus der automatischen Auswahl). */
  _asAuto(path) {
    const h = this._hass, D = this._as.draft;
    if (path === "weather_alerts.dwd") return wxAuto(h).dwd;
    if (path === "weather_alerts.awnings") return wxAuto(h).awnings;
    if (path === "heating.tank" || path === "heating.extra") {
      const m = buildModel(h, { ...D, hidden_areas: [] });
      const H = { ...D.heating, tank: [], extra: [] };
      const c = techCfg(h, { ...D, heating: H }, m.areas).heat || {};
      return (path === "heating.tank" ? c.tank : c.extra) || [];
    }
    return [];
  }

  _onChange(e) {
    const t = e.target, d = t && t.dataset;
    const A = this._as;
    if (!A || !d || !(d.as || d.asAdd || d.asArea || d.asFloor || d.asCal || d.asPush || d.asWbmode !== undefined)) return super._onChange(e);
    if (d.asWbmode !== undefined) {
      if (e.type !== "change") return;
      const N = { ...(A.draft.wallbox.mode_names || {}) }, v = String(t.value || "").trim().slice(0, 30);
      if (v) N[d.asWbmode] = v; else delete N[d.asWbmode];
      A.draft.wallbox.mode_names = N;
      return;
    }
    if (e.type !== "change") return;
    if (d.as) put(A.draft, d.as, d.asBool ? t.checked : t.value);
    else if (d.asAdd) { if (!t.value) return; const cur = get(A.draft, d.asAdd) || []; const eff = cur.length ? cur : this._asAuto(d.asAdd); put(A.draft, d.asAdd, [...new Set([...eff, t.value])]); }
    else if (d.asArea) { const s = new Set(A.draft.hidden_areas || []); if (t.checked) s.delete(d.asArea); else s.add(d.asArea); A.draft.hidden_areas = [...s]; }
    else if (d.asFloor) { const s = new Set(A.draft.outdoor_floors || []); if (t.checked) s.add(d.asFloor); else s.delete(d.asFloor); A.draft.outdoor_floors = [...s]; }
    else if (d.asCal) { const T = A.draft.termine, C = T.cals = { ...(T.cals || {}) }; if (t.value) C[d.asCal] = t.value; else delete C[d.asCal]; }
    else if (d.asPush) { const P = A.draft.push; P.targets = t.checked ? [...new Set([...P.targets, d.asPush])] : P.targets.filter((x) => x !== d.asPush); }
    this._dirty = true; this._flush();
  }
};

/** Beim ersten Öffnen: Assistent statt Startseite (nur Admins, nicht als Wandpanel). */
const asFirstRun = (L, isAdmin) => isAdmin && !!L.setup && L.setup.done === false;

export { AssistentMixin, asFirstRun, asPageHTML, STEPS as AS_STEPS };
