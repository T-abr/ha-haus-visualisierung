/* Haus Visualisierung – HTML-Bausteine: Kacheln, Zeilen, Raumkarten. */

import { dc, dom, entName, esc, icon, isOn, weit } from "./grundlagen.js";
import { CONTACT_DC, GROUP_META, PRESENCE_DC, SAFETY_DC } from "./modell.js";
import { sparkHTML } from "./klima.js";

/* ------------------------------------------------------------------------ */
/*  HTML-Bausteine                                                           */
/* ------------------------------------------------------------------------ */
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
    <div class="room-clim"><span class="rt"></span><span class="rh"></span>${opts.dp && a.humId && a.tempId ? '<small class="rdp"></small>' : ""}</div>
    ${opts.spark ? sparkHTML(a, opts.kind) : ""}
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
  // auf großen Monitoren immer offen, ohne Aufklapp-Knopf
  const zu = opts.collapsed && !weit();
  const head = `${icon(i)}<span class="st">${esc(t)}</span><span class="gc">${opts.collapsed ? eids.length : ""}</span><span class="sp"></span>${actions}${zu ? icon("mdi:chevron-down", "chev") : ""}`;
  const rows = `<div class="rows">${eids.map((e) => rowHTML(h, e, a)).join("")}</div>`;
  if (zu) return `<details class="section glass"><summary class="shead">${head}</summary>${rows}</details>`;
  return `<div class="section glass"><div class="shead"${cnt}>${head}</div>${rows}</div>`;
}

export { CTRL_DOMAINS, isBigRoom, roomActive, roomChipHTML, roomRowHTML, roomTileHTML, rowHTML, rowsSectionHTML, tileHTML, vchipHTML };
