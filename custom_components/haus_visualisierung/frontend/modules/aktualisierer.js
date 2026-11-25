/* Haus Visualisierung – Aktualisierer: laufen nur für geänderte Entitäten und ändern das DOM gezielt. */

import { batteryIcon, dc, dom, entIcon, entName, esc, fmtPower, fmtState, icon, isDense, isOn, isUnav, NF0, NF1, num, powerW, relTime, setHidden, setIcon, setText, setWidth, UNAV } from "./grundlagen.js";
import { CONTACT_DC, PRESENCE_DC, SAFETY_DC } from "./modell.js";
import { roomActive } from "./bausteine.js";
import { headerOf } from "./solar.js";
import { alertsByArea, alertWatch, CHIP_WATCH, CHIPS } from "./warnungen.js";
import { dewPoint, outdoorTemp } from "./klima.js";
import { condIcon, condName, dayOf, fcDays, shadeHeadline, shadeHints, W_COND } from "./wetter.js";

/* ------------------------------------------------------------------------ */
/*  Aktualisierer (werden nur für geänderte Entitäten ausgeführt)            */
/* ------------------------------------------------------------------------ */
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
  if (el.querySelector(".rdp")) { const dp = dewPoint(s.t, s.hu); setText(el, ".rdp", dp !== null ? `Taupunkt ${NF1.format(dp)}°` : ""); }
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
  const h = ctx._hass, H = headerOf(h, ctx._layout);
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

const WEATHER_ICON = Object.fromEntries(Object.entries(W_COND).map(([k, v]) => [k, v[1]]));

/* Wetter in der Kopfzeile: jetzt, dazu morgen (Vorhersage) und der wichtigste Beschattungshinweis im Tooltip */
function updateWeather(el, ctx) {
  const h = ctx._hass, st = h.states[el.dataset.eid];
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  setIcon(el, "ha-icon", condIcon(st.state));
  // Temperatur jetzt vom Außenfühler (wie Klimaseite und Schoner), sonst von der Wetter-Entität
  const t = outdoorTemp(h, ctx._model, ctx._layout, el.dataset.eid);
  setText(el, ".wt", t != null ? `${NF0.format(t)}°` : "");
  const days = fcDays(h, el.dataset.eid), tm = dayOf(days, 1);
  const tmTxt = tm && tm.hi !== null ? `morgen ${NF0.format(tm.hi)}°` : "";
  setText(el, ".wc", tmTxt ? `${condName(st.state)} · ${tmTxt}` : condName(st.state));
  setText(el, ".wf", tmTxt);
  const hl = ctx._model ? shadeHeadline(shadeHints(h, ctx._model, ctx._layout)) : "";
  el.classList.toggle("hint", !!hl);
  el.title = [`Jetzt: ${condName(st.state)}${t != null ? `, ${NF0.format(t)} °C` : ""}`,
    ...days.slice(0, 3).map((d, i) => `${i === 0 ? "Heute" : i === 1 ? "Morgen" : d.date.toLocaleDateString("de-DE", { weekday: "long" })}: ${condName(d.cond)}${d.hi !== null ? `, ${NF0.format(d.hi)}°` : ""}${d.lo !== null ? ` / ${NF0.format(d.lo)}°` : ""}`),
    hl].filter(Boolean).join("\n");
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

export { chipWatch, focusRooms, isRing, updateChip, updateFloor, updateFocus, updateGroupCount, updateHero, updateKChip, updateKpi, updatePerson, updateRoof, updateRoom, updateSatz, updateSecSum, updateTile, updateWeather, WEATHER_ICON };
