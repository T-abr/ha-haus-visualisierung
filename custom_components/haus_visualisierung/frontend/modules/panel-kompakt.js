/* Haus Visualisierung – Kompakt-Seiten (Dichte „kompakt“): Zeilen statt Kacheln.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { dom, entName, esc, icon, isOn, num } from "./grundlagen.js";
import { CTRL_DOMAINS, rowHTML, rowsSectionHTML, tileHTML, vchipHTML } from "./bausteine.js";
import { alertsCardHTML } from "./warnungen.js";
import { trendCardHTML } from "./verlauf.js";
import { sparkHTML } from "./klima.js";
import { pageEmpty } from "./hausschnitt.js";

const KompaktMixin = (Base) => class extends Base {
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
    const tr = this._layout.show_trends !== false, k = this._climKindSel();
    let out = `<div class="ptitle"><h1>Klima</h1><span class="psub" data-u="chip" data-k="temp"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span>
      <span class="psub" data-u="chip" data-k="heat"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>${this._climKindTog()}</div>
      ${this._climCards()}`;
    for (const f of m.floors) {
      const list = f.areas.filter((a) => a.tempId || a.climates.length);
      if (!list.length) continue;
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span></div><div class="glass ktable${tr ? " withspark" : ""}">
        <div class="khead"><span>Raum</span><span>Ist</span><span>Feuchte</span>${tr ? `<span>24 h${k === "h" ? " Feuchte" : ""}</span>` : ""}<span>Thermostat</span></div>
        ${list.map((a) => {
          const cl = a.climates[0];
          const cell = cl ? `<div class="tile row climate kcell" data-u="tile" data-eid="${esc(cl)}" data-act="more" data-long="1"><span class="tic">${icon("mdi:thermostat")}</span>
              <span class="rbtns"><button class="btn" data-act="clim" data-step="-1" data-eid="${esc(cl)}" title="Kälter">${icon("mdi:minus")}</button><span class="ttarget"></span><button class="btn" data-act="clim" data-step="1" data-eid="${esc(cl)}" title="Wärmer">${icon("mdi:plus")}</button></span>
              <span class="tstate"></span></div>` : `<span class="kna">–</span>`;
          return `<div class="krow" data-u="room" data-area="${esc(a.id)}"><span class="kname" data-act="go" data-to="raum/${esc(a.id)}">${icon(a.icon)}${esc(a.name)}</span><span class="rt"></span><span class="khum"><span class="rh"></span>${a.humId && a.tempId ? '<small class="rdp"></small>' : ""}</span>${tr ? sparkHTML(a, k) : ""}${cell}</div>`;
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
};

export { KompaktMixin };
