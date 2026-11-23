/* Haus Visualisierung – Einstellungen: Reiter, Formulare, Sortieren, Eingaben übernehmen.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { DOMAIN, VERSION } from "./version.js";
import { BUILTIN_MODES, dc, entName, esc, HOUSE_MODES, icon, NAV } from "./grundlagen.js";
import { buildModel, linkMode, PRESENCE_DC } from "./modell.js";
import { ALARMS } from "./warnungen.js";
import { techCfg } from "./technik.js";
import { FACES, guessFace, homeLoc, weatherIdOf } from "./wetter.js";
import { solarCfg } from "./prognose.js";
import { simSettingsHTML } from "./anwesenheit.js";
import { calKind } from "./termine.js";
import { applList } from "./geraete.js";
import { maintSettingsHTML } from "./wartung.js";
import { displayInput, displaySettingsHTML } from "./wanddisplay.js";

/* ---------- Einstellungen: Reiter und Sortieren ---------- */
const SET_TABS = [["raeume", "Räume", "mdi:floor-plan"], ["alarme", "Alarme", "mdi:shield-home-outline"], ["meldungen", "Meldungen", "mdi:cellphone-message"], ["technik", "Technik", "mdi:heat-pump-outline"], ["displays", "Displays", "mdi:tablet-dashboard"], ["darstellung", "Darstellung", "mdi:tune-variant"]];
const SET_TAB_KEYS = {
  raeume: ["area_order", "hidden_areas", "floor_order", "outdoor_floors", "pins", "favorites"],
  alarme: ["house_mode", "presence_sim", "alerts", "escalation", "alarm_actions"],
  meldungen: ["push", "doorbell"],
  technik: ["heating", "wallbox", "shading", "appliances", "maintenance"],
  displays: ["displays"],
};
const dragHandle = (label) => `<button class="drag" data-drag aria-label="${esc(label)}" title="Ziehen zum Sortieren (oder Pfeiltasten)">${icon("mdi:drag")}</button>`;
const floorGroup = (f) => (f.outdoor ? "outdoor" : f.level !== null && f.level < 0 ? "lower" : "upper");
const sortIds = (list) => [...list.children].filter((c) => c.classList.contains("sitem")).map((c) => c.dataset.sortId);


const EinstellungenMixin = (Base) => class extends Base {
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
      ${this._setCheck ? this._setCheck(D) : ""}
      ${simSettingsHTML(this, D)}
      ${this._setAlerts(D)}
      ${this._setActions(D)}`;
    else if (tab === "technik") body = `${dlAll}
      ${this._setTech(D)}
      ${this._setAppl(D)}
      ${this._setShade(D)}
      ${maintSettingsHTML(D)}`;
    else if (tab === "displays") body = displaySettingsHTML(this, D);
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
      ${this._setForecast(D)}
      ${this._setTermine(D)}
      ${this._setPrice(D)}
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

  /** Strompreis: Preissensor (automatisch erkannt oder gewählt) und feste Preise in ct/kWh. */
  /* Karte „Vorhersage“ auf der Übersicht: Wetter und Solarprognose */
  _setForecast(D) {
    const h = this._hass, F = D.forecast || {}, wid = weatherIdOf(h, D);
    const auto = solarCfg(h, { forecast: { solar: true } });
    const found = auto ? `${auto.src}: ${[...auto.today, ...auto.tomorrow].join(", ")}` : "keine Forecast.Solar- oder Solcast-Sensoren gefunden";
    const inp = (key, label, hint) => `<div class="srow"><span class="lbl">${label}<small>${hint}</small></span>
      <input class="inp w" list="dl-sensor" data-set="forecast.${key}" value="${esc(F[key] || "")}" placeholder="automatisch"></div>`;
    return `<div class="set glass"><h2>${icon("mdi:weather-partly-cloudy")}Vorhersage auf der Übersicht</h2>
      <p class="hint">Kompakte Karte mit dem Wetter der nächsten Tage${wid ? ` (${esc(wid)}, wie im Wandpanel eingestellt)` : ""}, dem erwarteten PV-Ertrag und dem wichtigsten Beschattungshinweis. Die Solarprognose kommt automatisch aus Forecast.Solar oder Solcast (${esc(found)}); eigene Sensoren in kWh oder Wh hier eintragen.</p>
      <div class="srow"><span class="lbl">Karte „Vorhersage“ zeigen</span><label class="tgl"><input type="checkbox" data-set="forecast.enabled" data-bool="1" ${F.enabled !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Solarprognose zeigen</span><label class="tgl"><input type="checkbox" data-set="forecast.solar" data-bool="1" ${F.solar !== false ? "checked" : ""}><span></span></label></div>
      ${inp("solar_today", "PV-Prognose heute", "Energie in kWh; leer = automatisch")}
      ${inp("solar_tomorrow", "PV-Prognose morgen", "Energie in kWh; leer = automatisch")}
    </div>`;
  }

  /* Müllabfuhr und Termine: welche Kalender zählen, Kopfzeile, Bildschirmschoner */
  _setTermine(D) {
    const h = this._hass, T = D.termine || {}, C = T.cals || {};
    const cals = Object.keys(h.states).filter((e) => e.startsWith("calendar.")).sort((a, b) => entName(h, a).localeCompare(entName(h, b), "de"));
    const KIND = { waste: "Müllabfuhr", event: "Termine", "": "Nicht anzeigen" };
    const tg = (key, label, hint) => `<div class="srow"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ""}</span><label class="tgl"><input type="checkbox" data-set="termine.${key}" data-bool="1" ${T[key] !== false ? "checked" : ""}><span></span></label></div>`;
    const row = (e) => {
      const cur = C[e] || "", auto = calKind(h, { cals: {} }, e);
      return `<div class="srow"><span class="lbl">${esc(entName(h, e))}<small>${esc(e)}</small></span>
        <select class="inp" data-term-cal="${esc(e)}"><option value="">Automatisch (${KIND[auto]})</option>
        ${[["waste", "Müllabfuhr"], ["event", "Termine"], ["-", "Nicht anzeigen"]].map(([k, t]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
    };
    return `<div class="set glass" data-sec="termine"><h2>${icon("mdi:trash-can-outline")}Müllabfuhr und Termine</h2>
      <p class="hint">„Morgen: Gelbe Tonne“ oder „Heute 15:30 Zahnarzt“ in der Kopfzeile und im Bildschirmschoner; am Vorabend der Abfuhr hervorgehoben. Quelle sind Kalender aus Home Assistant, z. B. von Waste Collection Schedule, einer Abfall-Integration, einem ICS-Kalender oder Google/CalDAV. Kalender mit „Abfall“, „Müll“ oder „Tonne“ im Namen zählen automatisch als Müllabfuhr; Familienkalender hier auf „Termine“ stellen.</p>
      ${tg("enabled", "Müllabfuhr und Termine zeigen")}
      ${tg("header", "In der Kopfzeile", "der wichtigste nächste Eintrag; am Handy nur die Abfuhr am Vorabend")}
      ${tg("saver", "Im Bildschirmschoner", "Abfuhr und bis zu drei Termine von heute und morgen")}
      <div class="srow"><span class="lbl">Abfuhr hervorheben ab<small>Uhr am Vorabend; am Morgen der Abfuhr bis 10 Uhr</small></span><input class="inp s" type="number" min="12" max="23" data-set="termine.evening" data-num="1" value="${esc(String(T.evening ?? 17))}"><span class="rl">Uhr</span></div>
      <div class="srow"><span class="lbl">Vorausschau<small>Tage, für den Tooltip in der Kopfzeile</small></span><input class="inp s" type="number" min="1" max="14" data-set="termine.days" data-num="1" value="${esc(String(T.days ?? 7))}"><span class="rl">Tage</span></div>
      <div class="fl-title">Kalender</div>
      ${cals.length ? cals.map(row).join("") : '<p class="hint">Keine Kalender gefunden. Waste Collection Schedule oder eine andere Kalender-Integration in Home Assistant einrichten.</p>'}
    </div>`;
  }

  _setPrice(D) {
    const P = D.price || {}, pc = this._model && this._model.price;
    const auto = pc && pc.auto && pc.sensor ? `erkannt: ${esc(pc.sensor)}` : "keiner erkannt";
    const ct = (key, label, hint, min, max) => `<div class="srow"><span class="lbl">${label}<small>${hint}</small></span><input class="inp s" type="number" min="${min}" max="${max}" step="0.1" data-set="price.${key}" data-num="1" value="${P[key]}"><span class="rl">ct/kWh</span></div>`;
    return `<div class="set glass" data-sec="price"><h2>${icon("mdi:currency-eur")}Strompreis</h2>
        <p class="hint">Für die Kosten auf der Seite „Energie“ und den Hinweis an der Wallbox. Ein dynamischer Tarif (z. B. Tibber, Nordpool, EPEX Spot, evcc) wird an der Einheit „…/kWh“ erkannt; liefert der Sensor Preise für später, zeigt die Seite das günstigste Zeitfenster.</p>
        <div class="srow"><span class="lbl">Preissensor nutzen<small>aus = immer fester Preis</small></span><label class="tgl"><input type="checkbox" data-set="price.use_sensor" data-bool="1" ${P.use_sensor !== false ? "checked" : ""}><span></span></label></div>
        <div class="srow"><span class="lbl">Preissensor<small>leer = automatisch (${auto})</small></span>
          <input class="inp w" list="dl-sensor" data-set="price.sensor" value="${esc(P.sensor || "")}" placeholder="sensor.…"></div>
        ${ct("surcharge_ct", "Aufschlag auf den Sensorpreis", "wenn der Sensor nur den Börsenpreis liefert: Netzentgelt, Steuern, Umlagen", -50, 100)}
        ${ct("fixed_ct", "Fester Preis", "ohne Preissensor", 0, 200)}
        ${ct("feed_in_ct", "Einspeisevergütung", "für die Bilanz heute", 0, 100)}
        <div class="srow"><span class="lbl">Günstiges Zeitfenster<small>Länge in Stunden, z. B. für eine Ladung des Autos</small></span><input class="inp s" type="number" min="1" max="12" data-set="price.window_h" data-num="1" value="${P.window_h}"><span class="rl">h</span></div></div>`;
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
      ${tg("wander", "Bildschirmschoner wandern lassen", "aus = Uhr und Infos bleiben mittig; an = jede Minute ein Stück versetzt gegen Einbrennen (bei OLED sinnvoll, LCDs wie im iPad brennen kaum ein)")}
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

  /* Beschattung: Hinweise nach Wettervorhersage, Sonnenstand und Ausrichtung der Rollos */
  /* Haushaltsgeräte: Erkennung über Leistung oder Status, Tür zum Quittieren, Restzeit */
  _setAppl(D) {
    const A = D.appliances || { enabled: true, auto: true, items: [] }, h = this._hass;
    const found = applList(h, { appliances: { enabled: true } });
    const auto = found.filter((a) => a.auto);
    const kinds = [["", "Automatisch (Name)"], ["wash", "Waschmaschine"], ["dry", "Trockner"], ["dish", "Spülmaschine"], ["other", "Anderes Gerät"]];
    const ent = (i, key, ph, title) => `<input class="inp" style="flex:1 1 200px" list="dl-all" data-set="appliances.items.${i}.${key}" value="${esc(A.items[i][key] || "")}" placeholder="${ph}" title="${title}">`;
    const nm = (i, key, unit, min, max, title) => `<input class="inp xs" type="number" min="${min}" max="${max}" step="1" data-set="appliances.items.${i}.${key}" data-num="1" value="${esc(String(A.items[i][key] ?? ""))}" title="${title}"><span class="rl">${unit}</span>`;
    const rows = A.items.map((it, i) => `<div class="actcard">
      <div class="actrow"><input class="inp" style="flex:1 1 160px" data-set="appliances.items.${i}.name" value="${esc(it.name || "")}" placeholder="Name, z. B. Waschmaschine">
        <select class="inp" data-set="appliances.items.${i}.kind">${kinds.map(([k, t]) => `<option value="${k}" ${(it.kind || "") === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button class="sbtn danger" data-act="s-appl-del" data-i="${i}" title="Entfernen">${icon("mdi:delete-outline")}</button></div>
      <div class="actrow sub">${ent(i, "power", "Leistung: sensor.…_power", "Leistung in W (Steckdose mit Messung)")}${ent(i, "status", "Programmstatus (optional)", "z. B. Home Connect, Miele: läuft/fertig")}</div>
      <div class="actrow sub">${ent(i, "energy", "Energiezähler in kWh (optional)", "genauer als die aufsummierte Leistung")}${ent(i, "door", "Tür (optional): binary_sensor.…", "Tür auf quittiert „fertig“")}${ent(i, "remaining", "Restzeit (optional)", "Zeitpunkt oder Minuten")}</div>
      <div class="actrow sub"><span class="rl">läuft ab</span>${nm(i, "start_w", "W", 1, 2000, "Startgrenze: so viel Leistung mindestens 1 Minute lang")}<span class="rl">fertig unter</span>${nm(i, "stop_w", "W", 1, 2000, "Stoppgrenze")}<span class="rl">für</span>${nm(i, "stop_min", "min", 1, 60, "so lange unter der Stoppgrenze (Spülmaschine trocknet oft lange ohne Strom: eher 10–20 min)")}</div></div>`).join("");
    return `<div class="set glass" data-sec="appliances"><h2>${icon("mdi:washing-machine")}Haushaltsgeräte</h2>
      <p class="hint">Karte „Geräte“ auf der Übersicht: läuft seit, Restzeit, „fertig seit …“, Energie und Kosten je Durchgang (Strompreis aus Darstellung → Strompreis; eigener PV-Strom zählt nicht). Bei „fertig“ kommt eine Meldung (Hinweis, auch als Push), bis jemand quittiert, die Tür öffnet oder das Gerät neu startet. Dazu ein Tipp, wann sich das Starten lohnt (PV-Überschuss, günstiges Zeitfenster, Solarprognose).</p>
      <div class="srow"><span class="lbl">Haushaltsgeräte auswerten</span><label class="tgl"><input type="checkbox" data-set="appliances.enabled" data-bool="1" ${A.enabled !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Automatisch erkennen<small>ohne eigene Einträge: Leistungssensoren mit Waschmaschine, Trockner oder Spülmaschine im Namen${auto.length ? ` – erkannt: ${esc(auto.map((a) => `${a.name} (${a.power})`).join(", "))}` : " – zurzeit keine erkannt"}</small></span><label class="tgl"><input type="checkbox" data-set="appliances.auto" data-bool="1" ${A.auto !== false ? "checked" : ""}><span></span></label></div>
      ${rows ? `<div class="appllist">${rows}</div>` : ""}
      <div class="srow"><button class="pbtn" data-act="s-appl-add">${icon("mdi:plus")}Gerät hinzufügen</button>${auto.length && !A.items.length ? `<button class="pbtn" data-act="s-appl-add" data-auto="1">${icon("mdi:auto-fix")}Erkannte übernehmen und anpassen</button>` : ""}</div>
    </div>`;
  }

  _setShade(D) {
    const h = this._hass, m = buildModel(h, { ...D, hidden_areas: [] }), S = D.shading || {};
    const F = S.facing || {}, loc = homeLoc(h), wid = weatherIdOf(h, D);
    const covers = [...(m.agg.covers || [])].sort((a, b) => {
      const ra = (m.eidArea.get(a) || {}).name || "", rb = (m.eidArea.get(b) || {}).name || "";
      return ra.localeCompare(rb, "de") || entName(h, a).localeCompare(entName(h, b), "de");
    });
    const name = (k) => (FACES.find((f) => f[0] === k) || [, , "–"])[2];
    const row = (e) => {
      const g = guessFace(h, e), cur = F[e] || "";
      return `<div class="srow"><span class="lbl">${esc(entName(h, e))}<small>${esc((m.eidArea.get(e) || {}).name || "")}</small></span>
        <select class="inp" data-shade-face="${esc(e)}"><option value="">${g ? `Automatisch (${esc(name(g))})` : "Automatisch (unbekannt)"}</option>
        ${FACES.map(([k, , n]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${n}</option>`).join("")}
        <option value="-" ${cur === "-" ? "selected" : ""}>Nicht beschatten</option></select></div>`;
    };
    return `<div class="set glass"><h2>${icon("mdi:sun-angle-outline")}Beschattung</h2>
      <p class="hint">Auf der Seite Beschattung, im Kopf und im Bildschirmschoner erscheinen Hinweise wie „Morgen 30 °C, Südrollos rechtzeitig schließen“. Grundlage sind die Wettervorhersage${wid ? ` (${esc(wid)})` : ""}, der Sonnenstand am Standort aus Home Assistant und die Ausrichtung der Fenster. Geschaltet wird nur auf Tippen, mit Rückfrage.</p>
      ${loc ? "" : '<p class="hint warn">Kein Standort in Home Assistant hinterlegt (Einstellungen → System → Allgemein). Ohne ihn gibt es nur allgemeine Hinweise.</p>'}
      <div class="srow"><span class="lbl">Hinweise zur Beschattung</span><label class="tgl"><input type="checkbox" data-set="shading.enabled" data-bool="1" ${S.enabled !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Heißer Tag ab<small>°C laut Vorhersage, bei Sonne oder leichter Bewölkung</small></span><input class="inp s" type="number" min="18" max="40" data-set="shading.hot" data-num="1" value="${esc(String(S.hot ?? 26))}"></div>
      <div class="fl-title">Ausrichtung der Fenster</div>
      <p class="hint">In welche Himmelsrichtung schaut das Fenster? „Automatisch“ liest die Richtung aus dem Namen (z. B. „Rollo Süd“).</p>
      ${covers.length ? covers.map(row).join("") : '<p class="hint">Keine Rollos gefunden.</p>'}
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
      ["presence_away", "Bewegung bei Abwesenheit"], ["locks", "Schloss entriegelt"], ["garage", "Garagentor offen"], ["battery", "Batterien kritisch"], ["offline", "Geräte nicht erreichbar"], ["mold", "Schimmelrisiko"], ["appliances", "Haushaltsgerät fertig"]];
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
      ["presence_away", "Bewegung erkannt, während niemand zu Hause ist", "Alarm"], ["alarm_panel", "Alarmanlage ausgelöst (z. B. Alarmo)", "Alarm"],
      ["mold", "Schimmelrisiko – jetzt lüften (Raumfeuchte zu hoch)", "Warnung"], ["appliances", "Haushaltsgerät fertig (Waschmaschine, Trockner, Spülmaschine)", "Hinweis"], ["maintenance", "Wartung fällig (Wartungsplaner)", "Hinweis"]];
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
      <div class="srow"><span class="lbl">Schimmelrisiko ab<small>% relative Raumfeuchte; Entwarnung 3 Prozentpunkte darunter</small></span><input class="inp s" type="number" min="50" max="90" data-set="alerts.mold_hum" data-num="1" value="${A.mold_hum || 65}"></div>
      <div class="srow"><span class="lbl">Schimmelrisiko erst melden nach<small>Minuten über der Grenze, damit kurzes Duschen oder Kochen nicht meldet; nicht bei offenem Fenster im Raum</small></span><input class="inp s" type="number" min="0" max="240" data-set="alerts.mold_min" data-num="1" value="${A.mold_min ?? 30}"></div>
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
    if (t.dataset && t.dataset.termCal && e.type === "change" && this._draft) {
      const T = this._draft.termine = { ...(this._draft.termine || {}) }, C = T.cals = { ...(T.cals || {}) };
      if (t.value) C[t.dataset.termCal] = t.value; else delete C[t.dataset.termCal];
      this._dirtySettings = true;
      const msg = this.shadowRoot.querySelector(".savebar .msg");
      if (msg) msg.textContent = "Ungespeicherte Änderungen";
      return;
    }
    if (t.dataset && (t.dataset.dispTile || t.dataset.dispEnt) && e.type === "change" && this._draft) {
      const redraw = displayInput(this._draft, t, this._layout.displays);
      this._dirtySettings = true;
      if (redraw) { this._rerenderSettings(); return; }
      const msg = this.shadowRoot.querySelector(".savebar .msg");
      if (msg) msg.textContent = "Ungespeicherte Änderungen";
      return;
    }
    if (t.dataset && t.dataset.dispName && e.type === "change" && this._draft) displayInput(this._draft, t, this._layout.displays);
    if (t.dataset && t.dataset.shadeFace && e.type === "change" && this._draft) {
      const S = this._draft.shading = { ...(this._draft.shading || {}) }, F = S.facing = { ...(S.facing || {}) };
      if (t.value) F[t.dataset.shadeFace] = t.value; else delete F[t.dataset.shadeFace];
      this._dirtySettings = true;
      const msg = this.shadowRoot.querySelector(".savebar .msg");
      if (msg) msg.textContent = "Ungespeicherte Änderungen";
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
};

export { EinstellungenMixin };
