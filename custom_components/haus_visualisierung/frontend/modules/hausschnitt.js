/* Haus Visualisierung – Hausschnitt und Seitenbausteine, die Panel und Karten gemeinsam nutzen. */

import { esc, icon } from "./grundlagen.js";
import { GROUP_META } from "./modell.js";
import { isBigRoom, roomChipHTML, roomTileHTML, tileHTML } from "./bausteine.js";

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

export { energyPills, houseHTML, pageEmpty, sectionHTML };
