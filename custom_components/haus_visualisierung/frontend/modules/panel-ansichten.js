/* Haus Visualisierung – Kopfzeile und Seiten (Übersicht, Räume, Licht, Beschattung, Klima, Energie, Sicherheit, Batterien).
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { dom, entName, esc, icon, isDense, isOn, num } from "./grundlagen.js";
import { GROUPS } from "./modell.js";
import { isBigRoom, roomChipHTML, roomRowHTML, roomTileHTML, rowHTML, tileHTML } from "./bausteine.js";
import { focusRooms } from "./aktualisierer.js";
import { alertsCardHTML } from "./warnungen.js";
import { trendCardHTML } from "./verlauf.js";
import { heatCardHTML, wbCardHTML } from "./technik.js";
import { climRooms, climTrendHTML, humRooms } from "./klima.js";
import { shadeCardHTML, weatherIdOf } from "./wetter.js";
import { fcastCardHTML } from "./prognose.js";
import { terminBtnHTML } from "./termine.js";
import { enDayHTML, energyFlowHTML, enPriceCard, enTrendHTML } from "./energie.js";
import { energyPills, houseHTML, pageEmpty, sectionHTML } from "./hausschnitt.js";

const AnsichtenMixin = (Base) => class extends Base {
  _topbar() {
    const h = this._hass;
    const weather = weatherIdOf(h, this._layout);
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
      ${terminBtnHTML(h, this._layout)}
      ${weather ? `<button class="weather glass" data-u="weather" data-eid="${esc(weather)}" data-act="more">${icon("mdi:weather-partly-cloudy")}<div><div class="wt"></div><div class="wc"></div></div></button>` : ""}
      ${pers ? `<div class="persons">${pers}</div>` : ""}
    </div>`;
  }

  _topbarDense() {
    const h = this._hass;
    const weather = weatherIdOf(h, this._layout);
    const persons = Object.keys(h.states).filter((e) => e.startsWith("person.")).slice(0, 6);
    const pers = persons.map((e) => {
      const st = h.states[e];
      const pic = st.attributes.entity_picture;
      const initials = (st.attributes.friendly_name || e.slice(7)).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      return `<button class="person" data-u="person" data-eid="${esc(e)}" data-act="more">${pic ? `<img src="${esc(pic)}" alt="">` : esc(initials)}</button>`;
    }).join("");
    const hm = this._layout.house_mode && this._layout.house_mode.enabled !== false
      ? `<button class="hmode" data-u="hmode" data-act="go" data-to="alarme" title="Hausmodus">${icon("mdi:home-account")}<span class="hml"></span></button>` : "";
    const right = `<div class="hright">${hm}${terminBtnHTML(h, this._layout)}
      ${weather ? `<button class="weather glass" data-u="weather" data-eid="${esc(weather)}" data-act="more">${icon("mdi:weather-partly-cloudy")}<span class="wt"></span><span class="wf"></span></button>` : ""}
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
      return `${this._topbarDense()}${alertsCardHTML("slim")}${fcastCardHTML(h, L)}${houseHTML(m, L, h, { dense: true, tab: tabs })}
        ${fav.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${fav.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
    }
    return `${this._topbar()}${this._chips()}
      ${houseHTML(m, L, this._hass)}
      ${fcastCardHTML(h, L)}
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
      ${this._shadeCard()}${this._byFloor("cover", (a) => a.covers, btns)}`;
  }

  /** Karte „Sonne & Wetter“ über den Rollos (Vorhersage und Hinweise), nur mit Wetter-Entität */
  _shadeCard() {
    const wid = weatherIdOf(this._hass, this._layout);
    return wid ? shadeCardHTML(wid) : "";
  }

  /* Klimaseite: Kopfkarten (Temperatur, Feuchte) und Wahl der Größe für die Raum-Verläufe (je Gerät gemerkt) */
  _climKindSel() {
    if (!this._ck) { let v = null; try { v = localStorage.getItem("hv-clim-kind"); } catch (err) { /* egal */ } this._ck = v === "h" ? "h" : "t"; }
    return this._ck === "h" && !humRooms(this._model).length ? "t" : this._ck;
  }
  _climKindTog() {
    if (this._layout.show_trends === false || !humRooms(this._model).length) return "";
    const k = this._climKindSel();
    return `<span class="cktog" role="group" aria-label="Verlauf je Raum"><small>Verlauf je Raum</small>${[["t", "Temperatur"], ["h", "Feuchte"]].map(([v, t]) => `<button class="altab sm${k === v ? " on" : ""}" data-act="clim-kind" data-k="${v}" aria-pressed="${k === v}"><span>${t}</span></button>`).join("")}</span>`;
  }
  _climCards() {
    const m = this._model;
    if (this._layout.show_trends === false) return "";
    const cards = [climRooms(m).length ? climTrendHTML("t") : "", humRooms(m).length ? climTrendHTML("h") : ""].filter(Boolean);
    return cards.length ? `<div class="ctwrap">${cards.join("")}</div>` : "";
  }

  _vClimate() {
    const m = this._model, h = this._hass;
    const rooms = m.visibleAreas.filter((a) => a.tempId || a.climates.length);
    if (!rooms.length) return pageEmpty("Klima", "mdi:thermometer-off", "Keine Temperatur-Sensoren oder Thermostate in den Bereichen gefunden.");
    const tr = this._layout.show_trends !== false, k = this._climKindSel();
    let out = `<div class="ptitle"><h1>Klima</h1><span class="psub" data-u="chip" data-k="temp"><span class="ic" hidden>${icon("mdi:circle")}</span><span class="ct"></span></span><span class="sp"></span>${this._climKindTog()}</div>
      ${this._climCards()}`;
    for (const f of m.floors) {
      const list = f.areas.filter((a) => a.tempId || a.climates.length);
      if (!list.length) continue;
      out += `<div class="fhead">${esc(f.name)}<span class="sp"></span></div><div class="rooms" style="padding:0">${list.map((a) => roomTileHTML(a, true, { spark: tr && !!(k === "h" ? a.humId : a.tempId), kind: k, dp: true })).join("")}</div>`;
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
      ${enPriceCard(c, this._model.price)}
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
          ${fcastCardHTML(h, L, "side")}
          <div class="glass qcard"><div class="qhead">${icon("mdi:gesture-tap")}Schnellzugriff</div><div class="qbtns">${this._quickBtns()}</div>${scenes ? `<div class="qscenes">${scenes}</div>` : ""}</div>
          ${other.length ? `<div class="glass qcard"><div class="qhead">${icon("mdi:star")}Favoriten</div><div class="rows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}
        </aside>
      </div>`;
  }

  _ovSpalten(fav) {
    const m = this._model, h = this._hass;
    const other = fav.filter((e) => !["scene", "script"].includes(dom(e)));
    return `${this._topbarDense()}${this._ebar(fav)}${alertsCardHTML("slim")}${fcastCardHTML(h, this._layout)}
      <div class="fcols">${m.floors.map((f) => `<section class="fcol glass${f.outdoor ? " out" : ""}" data-u="floor" data-floor="${esc(f.id)}">${this._floorHead(f)}
        <div class="rrows">${f.areas.map(roomRowHTML).join("")}</div></section>`).join("")}</div>
      ${other.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
  }

  _ovFokus(fav) {
    const m = this._model, h = this._hass;
    const active = focusRooms(h, m, this._layout);
    const calm = m.floors.map((f) => [f, f.areas.filter((a) => !active.includes(a))]).filter(([, l]) => l.length);
    const other = fav.filter((e) => !["scene", "script"].includes(dom(e)));
    return `${this._topbarDense()}${alertsCardHTML("fokus")}${this._ebar(fav)}${fcastCardHTML(h, this._layout)}
      <div data-u="focus" data-ids="${esc(active.map((a) => a.id).join(","))}">
        ${active.length
          ? `<div class="secttitle">${icon("mdi:flash")}Jetzt aktiv<span class="gc">${active.length} ${active.length === 1 ? "Raum" : "Räume"}</span></div><div class="factive">${active.map((a) => roomTileHTML(a, true, { act: true })).join("")}</div>`
          : `<div class="glass calm">${icon("mdi:weather-night")}<div><b>Alles ruhig</b><small>Keine Lichter an, alle Fenster zu, keine Bewegung.</small></div></div>`}
        ${calm.length ? `<div class="secttitle">${icon("mdi:home-outline")}Übrige Räume</div><div class="glass fcalm">${calm.map(([f, l]) => `<div class="crow2"><span class="cfl">${esc(f.short || f.name)}</span><div class="rchips">${l.map(roomChipHTML).join("")}</div></div>`).join("")}</div>` : ""}
      </div>
      ${other.length ? `<div class="secttitle">${icon("mdi:star")}Favoriten</div><div class="glass"><div class="rows favrows">${other.map((e) => rowHTML(h, e, null)).join("")}</div></div>` : ""}`;
  }
};

export { AnsichtenMixin };
