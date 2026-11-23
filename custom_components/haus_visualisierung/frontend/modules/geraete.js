/* Haus Visualisierung – Haushaltsgeräte: Karte „Geräte“ auf der Übersicht (läuft, fertig, Kosten je Durchgang),
 * Tipp zum Starten (PV-Überschuss, günstiger Strompreis, Solarprognose), Meldung „fertig“ und Hinweis im Bildschirmschoner.
 * Erkennung, Energie und Kosten rechnet das Backend (appliances.py); hier wird nur sensor.haus_geraete gelesen. */

import { esc, icon, NF0, NF1, num, powerW, setHtml } from "./grundlagen.js";
import { priceInfo } from "./strompreis.js";
import { solarCfg, solarVals } from "./prognose.js";

const GERAETE = "sensor.haus_geraete";
const NF2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fin = (v) => typeof v === "number" && Number.isFinite(v);

/** Geräte aus dem Sensor des Backends (leer, wenn abgeschaltet oder keine gefunden). */
function applList(h, L) {
  if (L && L.appliances && L.appliances.enabled === false) return [];
  const st = h.states[GERAETE], l = st && st.attributes.geraete;
  return Array.isArray(l) ? l : [];
}
const applShown = (h, L) => applList(h, L).length > 0;

/* ---------- Texte ---------- */
function durTxt(min) {
  const m = Math.max(0, Math.round(min));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}
const sinceMin = (ts) => (fin(ts) ? (Date.now() / 1000 - ts) / 60 : 0);
const kwhTxt = (v) => `${(v < 10 ? NF2 : NF1).format(v)}\u00a0kWh`;
const eurTxt = (v) => `${NF2.format(v)}\u00a0€`;
const wTxt = (w) => (w >= 1000 ? `${NF1.format(w / 1000)}\u00a0kW` : `${NF0.format(w)}\u00a0W`);
/** „0,92 kWh · 0,28 €“ (+ Anteil eigener Strom) */
function costTxt(kwh, cost, own) {
  if (!fin(kwh) || kwh < 0.005) return "";
  return `${kwhTxt(kwh)} · ${eurTxt(cost || 0)}${fin(own) && own >= 0.05 ? ` (${NF0.format(Math.round(own * 100))} % eigener Strom)` : ""}`;
}

/** Restzeit in Minuten: Entität (Zeitpunkt oder Dauer) oder geschätzt aus früheren Durchgängen. */
function remainMin(h, a) {
  const st = a.remaining && h.states[a.remaining];
  if (st && !["unavailable", "unknown", ""].includes(st.state)) {
    if (st.attributes.device_class === "timestamp") {
      const t = Date.parse(st.state);
      if (Number.isFinite(t)) return { min: Math.max(0, (t - Date.now()) / 60000), est: false };
    }
    const v = num(st), u = String(st.attributes.unit_of_measurement || "min").toLowerCase();
    if (v !== null) return { min: u === "h" ? v * 60 : u === "s" ? v / 60 : v, est: false };
    const mm = /^(\d+):(\d{2})/.exec(st.state);
    if (mm) return { min: Number(mm[1]) * 60 + Number(mm[2]), est: false };
  }
  if (fin(a.avg_min) && fin(a.start)) {
    const r = a.avg_min - sinceMin(a.start);
    return r > 1 ? { min: r, est: true } : null;
  }
  return null;
}

/** Zeile je Gerät: Hauptzeile und Unterzeile. */
function rowText(h, a) {
  const pw = a.power ? powerW(h.states[a.power]) : null;
  if (a.state === "laeuft") {
    const r = remainMin(h, a);
    const sub = [r ? `noch ${r.est ? "ca.\u00a0" : ""}${durTxt(r.min)}` : "", pw !== null && pw > 1 ? wTxt(pw) : "", costTxt(a.kwh, a.cost, null)].filter(Boolean).join(" · ");
    return { main: `läuft seit ${durTxt(sinceMin(a.start || a.since))}`, sub };
  }
  if (a.state === "fertig") return { main: `fertig seit ${durTxt(sinceMin(a.end || a.since))}`, sub: [fin(a.start) && fin(a.end) ? `Dauer ${durTxt((a.end - a.start) / 60)}` : "", costTxt(a.kwh, a.cost, a.own)].filter(Boolean).join(" · ") };
  const last = a.last;
  return { main: "aus", sub: last ? `zuletzt ${costTxt(last.kwh, last.cost, last.own) || durTxt((last.end - last.start) / 60)}${a.n > 1 && fin(a.avg_cost) ? ` · Ø ${eurTxt(a.avg_cost)}` : ""}` : "" };
}

/* ---------- Tipp: wann starten? ---------- */
/** Wichtigster Tipp für Geräte, die gerade aus sind: PV-Überschuss jetzt, günstiges Zeitfenster, Solarprognose. */
function startTip(h, m, L, list) {
  const idle = list.filter((a) => a.state !== "laeuft");
  if (!idle.length) return null;
  // typische Leistung der Geräte, die gerade frei sind (aus früheren Durchgängen), sonst 1 kW
  const need = Math.max(...idle.map((a) => (fin(a.avg_kwh) && fin(a.avg_min) && a.avg_min > 0 ? (a.avg_kwh / (a.avg_min / 60)) * 1000 : 1000)));
  const c = m && m.energy;
  if (c && c.grid) {
    let g = powerW(h.states[c.grid]), b = c.bat ? powerW(h.states[c.bat]) : null;
    if (g !== null && c.gridInv) g = -g;
    if (b !== null && c.batInv) b = -b;
    // Einspeisung, dazu was der Speicher gerade lädt – aber nur, wenn nichts aus dem Netz kommt
    const surplus = g === null ? 0 : Math.max(0, -g) + (g <= 50 ? Math.max(0, b || 0) : 0);
    if (surplus >= Math.min(800, need * 0.6)) return { cls: "pv", icon: "mdi:solar-power-variant", text: `Jetzt starten: ${wTxt(surplus)} PV-Überschuss` };
  }
  const p = m && m.price, info = p ? priceInfo(h, p) : null;
  if (info && info.dyn) {
    if (info.level === "billig") return { cls: "pv", icon: "mdi:currency-eur", text: `Strom gerade günstig (${NF1.format(info.cur * 100)} ct/kWh): jetzt starten` };
    if (info.best && info.best.s > Date.now() + 30 * 60000) {
      const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      const day = new Date(info.best.s).getDate() !== new Date().getDate() ? "morgen " : "";
      return { cls: "", icon: "mdi:clock-check-outline", text: `Günstig starten: ${day}${hm(info.best.s)}–${hm(info.best.e)} Uhr · Ø ${NF1.format(info.best.avg * 100)} ct/kWh` };
    }
  }
  const sc = solarCfg(h, L), sv = sc ? solarVals(h, sc) : null, hr = new Date().getHours();
  if (sv) {
    const rest = fin(sv.rest) ? sv.rest : null;
    if (rest !== null && rest >= 3 && hr < 14) return { cls: "", icon: "mdi:white-balance-sunny", text: `Heute kommen noch ${NF1.format(rest)} kWh PV: bis Mittag starten` };
    if (hr >= 14 && fin(sv.tomorrow) && sv.tomorrow >= 5 && (rest === null || rest < 2)) return { cls: "", icon: "mdi:weather-sunny", text: `Morgen ${NF1.format(sv.tomorrow)} kWh PV erwartet: lieber morgen Vormittag starten` };
  }
  return null;
}

/* ---------- Karte ---------- */
/** Karte „Geräte“ (data-u="appl"); variant: "side" (Cockpit-Spalte) oder "" (volle Breite). */
function applCardHTML(h, L, variant = "") {
  if (!applShown(h, L)) return "";
  return `<div class="glass appl${variant ? ` ${variant}` : ""}" data-u="appl"><div class="aplh">${icon("mdi:washing-machine")}<b>Geräte</b><span class="sp"></span><small class="aplsum"></small></div>
    <div class="apls"></div><div class="apltip"></div></div>`;
}

function updateAppl(el, ctx) {
  const h = ctx._hass, list = applList(h, ctx._layout);
  const run = list.filter((a) => a.state === "laeuft").length, done = list.filter((a) => a.state === "fertig").length;
  el.querySelector(".aplsum").textContent = [done ? `${done} fertig` : "", run ? `${run} ${run === 1 ? "läuft" : "laufen"}` : ""].filter(Boolean).join(" · ");
  el.classList.toggle("done", done > 0);
  setHtml(el.querySelector(".apls"), list.map((a) => {
    const t = rowText(h, a);
    return `<div class="apl ${esc(a.state)}" data-id="${esc(a.id)}"><button class="aplic" data-act="more" data-eid="${esc(a.power || a.status || GERAETE)}" title="${esc(a.name)}">${icon(a.icon || "mdi:power-plug-outline")}</button>
      <span class="apln"><b>${esc(a.name)}</b><small><span class="aplst">${esc(t.main)}</span>${t.sub ? ` · ${esc(t.sub)}` : ""}</small></span>
      ${a.state === "fertig" ? `<button class="pbtn sm aplack" data-act="appl-ack" data-id="${esc(a.id)}" title="Quittieren (oder Tür öffnen)">${icon("mdi:check")}Erledigt</button>` : ""}</div>`;
  }).join(""));
  const tip = startTip(h, ctx._model, ctx._layout, list);
  setHtml(el.querySelector(".apltip"), tip ? `<div class="apltp ${tip.cls}">${icon(tip.icon)}<span>${esc(tip.text)}</span></div>` : "");
}

/** Watch-Liste: Sensor des Backends, Leistung und Restzeit der Geräte, Netz/Speicher und Preis (für den Tipp). */
function applWatch(el, c) {
  const list = applList(c._hass, c._layout), e = c._model && c._model.energy, p = c._model && c._model.price;
  return [GERAETE, ...list.flatMap((a) => [a.power, a.remaining]), e && e.grid, e && e.bat, p && p.sensor].filter(Boolean);
}

/* ---------- Meldungen und Bildschirmschoner ---------- */
/** Fertige Geräte als Meldungen (gleicher Schlüssel wie im Backend, damit Quittieren zusammenpasst). */
function applAlerts(h, L) {
  return applList(h, L).filter((a) => a.state === "fertig").map((a) => ({
    key: `appliance:${a.id}`, level: "info", icon: a.icon || "mdi:check-circle-outline", title: `${a.name} fertig`,
    detail: [`seit ${durTxt(sinceMin(a.end || a.since))}`, costTxt(a.kwh, a.cost, null)].filter(Boolean).join(" · "), eid: a.power || undefined,
  }));
}
/** Kurzer Hinweis für den Bildschirmschoner: „Waschmaschine fertig seit 12 min“ bzw. „Spülmaschine noch ca. 20 min“. */
function applSaverHint(h, L) {
  const list = applList(h, L), done = list.filter((a) => a.state === "fertig");
  if (done.length) return { icon: "mdi:check-circle-outline", text: done.map((a) => `${a.name} fertig seit ${durTxt(sinceMin(a.end || a.since))}`).join(" · ") };
  const run = list.filter((a) => a.state === "laeuft").map((a) => { const r = remainMin(h, a); return r ? `${a.name} noch ${r.est ? "ca. " : ""}${durTxt(r.min)}` : `${a.name} läuft`; });
  return run.length ? { icon: "mdi:washing-machine", text: run.join(" · ") } : null;
}

export { applAlerts, applCardHTML, applList, applSaverHint, applShown, applWatch, GERAETE, startTip, updateAppl };
