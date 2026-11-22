/* Haus Visualisierung – Wettervorhersage und Beschattungshinweise nach Sonnenstand und Ausrichtung der Fenster.
 * Nur Hinweise: geschaltet wird erst, wenn jemand auf „Schließen“ tippt (mit Rückfrage). */

import { esc, icon, isOn, NF0, setHtml } from "./grundlagen.js";

/* ---------- Wetterlagen ---------- */
const W_COND = {
  "clear-night": ["Klar", "mdi:weather-night"], cloudy: ["Bewölkt", "mdi:weather-cloudy"], fog: ["Nebel", "mdi:weather-fog"],
  hail: ["Hagel", "mdi:weather-hail"], lightning: ["Gewitter", "mdi:weather-lightning"], "lightning-rainy": ["Gewitter", "mdi:weather-lightning-rainy"],
  partlycloudy: ["Teils bewölkt", "mdi:weather-partly-cloudy"], pouring: ["Starkregen", "mdi:weather-pouring"], rainy: ["Regen", "mdi:weather-rainy"],
  snowy: ["Schnee", "mdi:weather-snowy"], "snowy-rainy": ["Schneeregen", "mdi:weather-snowy-rainy"], sunny: ["Sonnig", "mdi:weather-sunny"],
  windy: ["Windig", "mdi:weather-windy"], "windy-variant": ["Windig", "mdi:weather-windy-variant"], exceptional: ["Unwetter", "mdi:alert"],
};
const condName = (c) => (W_COND[c] || [c || ""])[0];
const condIcon = (c) => (W_COND[c] || [, "mdi:weather-partly-cloudy"])[1];
/** Lagen, bei denen die Sonne die Räume aufheizt */
const SUNNY = new Set(["sunny", "partlycloudy", "clear-night", "windy", "windy-variant"]);
const fin = (v) => typeof v === "number" && Number.isFinite(v);

/* ---------- Vorhersage: Abo „weather/subscribe_forecast“ (seit HA 2023.9), sonst Attribut forecast ---------- */
/* Je Wetter-Entität ein Abo, solange ein Panel offen ist. Ergebnis: Tage mit Lage, Höchst-/Tiefstwert, Regen. */
const FC = new Map(); // eid → { days, unsub, pending }
const FC_LISTENERS = new Set();
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Einträge (täglich oder stündlich) zu Tagen zusammenfassen. */
function toDays(list, hourly) {
  const by = new Map();
  for (const f of list || []) {
    const t = new Date(f.datetime);
    if (Number.isNaN(t.getTime())) continue;
    const k = dayKey(t);
    let d = by.get(k);
    if (!d) by.set(k, (d = { date: midnight(t), hi: null, lo: null, cond: null, rain: 0, _noon: 99 }));
    const hi = fin(f.temperature) ? f.temperature : null, lo = fin(f.templow) ? f.templow : hourly ? hi : null;
    if (hi !== null) d.hi = d.hi === null ? hi : Math.max(d.hi, hi);
    if (lo !== null) d.lo = d.lo === null ? lo : Math.min(d.lo, lo);
    if (fin(f.precipitation)) d.rain += f.precipitation;
    // Lage: bei stündlicher Vorhersage die um 13 Uhr, sonst die des Tages
    const dist = hourly ? Math.abs(t.getHours() - 13) : 0;
    if (f.condition && (d.cond === null || dist < d._noon)) { d.cond = f.condition; d._noon = dist; }
  }
  return [...by.values()].sort((a, b) => a.date - b.date).map(({ _noon, ...d }) => d);
}

function fcNotify() { for (const cb of FC_LISTENERS) { try { cb(); } catch (err) { console.warn("Haus Visualisierung: Vorhersage", err); } } }

/** Abo für die Wetter-Entität sicherstellen (einmal je Entität). */
function fcEnsure(h, eid) {
  if (!eid || !h || !h.states[eid] || FC.has(eid)) return;
  const st = h.states[eid], sf = Number(st.attributes.supported_features) || 0;
  const rec = { days: Array.isArray(st.attributes.forecast) ? toDays(st.attributes.forecast, false) : null, unsub: null };
  FC.set(eid, rec);
  const type = sf & 1 ? "daily" : sf & 2 ? "hourly" : sf & 4 ? "twice_daily" : null;
  if (!type || !h.connection || !h.connection.subscribeMessage) return;
  rec.unsub = h.connection.subscribeMessage((ev) => {
    if (!ev || !Array.isArray(ev.forecast)) return;
    rec.days = toDays(ev.forecast, type === "hourly");
    fcNotify();
  }, { type: "weather/subscribe_forecast", forecast_type: type, entity_id: eid });
  Promise.resolve(rec.unsub).catch((err) => console.warn("Haus Visualisierung: Vorhersage nicht verfügbar", err));
}
function fcListen(cb) { FC_LISTENERS.add(cb); }
/** Abmelden; ohne Zuhörer werden die Abos beendet. */
function fcUnlisten(cb) {
  FC_LISTENERS.delete(cb);
  if (FC_LISTENERS.size) return;
  for (const rec of FC.values()) if (rec.unsub) Promise.resolve(rec.unsub).then((un) => un && un()).catch(() => {});
  FC.clear();
}
/** Tage ab heute (leer, solange nichts da ist). */
function fcDays(h, eid) {
  if (!eid) return [];
  fcEnsure(h, eid);
  const rec = FC.get(eid);
  if (!rec || !rec.days) return [];
  const today = midnight(new Date()).getTime();
  return rec.days.filter((d) => d.date.getTime() >= today);
}
const dayOf = (days, offset) => { const t = midnight(new Date()); t.setDate(t.getDate() + offset); return days.find((d) => d.date.getTime() === t.getTime()) || null; };

/* ---------- Sonnenstand (Näherung nach NOAA/Almanach, genau auf etwa 1°) ---------- */
const RAD = Math.PI / 180;
/** Azimut (0 = Nord, 90 = Ost, im Uhrzeigersinn) und Höhe in Grad. */
function sunPos(date, lat, lon) {
  const d = date.getTime() / 86400000 - 10957.5; // Tage seit J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * RAD;
  const H = gmst + lon * RAD - ra, phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { az: ((az / RAD) % 360 + 360) % 360, el: el / RAD };
}
/** Standort aus Home Assistant (Einstellungen → System → Allgemein). */
function homeLoc(h) {
  const c = (h && h.config) || {};
  return fin(c.latitude) && fin(c.longitude) && (c.latitude || c.longitude) ? { lat: c.latitude, lon: c.longitude } : null;
}

/* ---------- Ausrichtung ---------- */
const FACES = [["N", 0, "Nord"], ["NO", 45, "Nordost"], ["O", 90, "Ost"], ["SO", 135, "Südost"], ["S", 180, "Süd"], ["SW", 225, "Südwest"], ["W", 270, "West"], ["NW", 315, "Nordwest"]];
const FACE = Object.fromEntries(FACES.map(([k, deg, name]) => [k, { k, deg, name }]));
const faceSide = (k) => `${FACE[k].name}seite`;
const faceCovers = (k) => (k.length === 1 ? `${FACE[k].name}rollos` : `${FACE[k].name}-Rollos`);
/* Ausrichtung aus dem Namen raten, z. B. „Rollo Süd“, „Fenster Südwest“, „cover.west_1“ */
const GUESS = [["NO", /nord[-_ ]?ost|north[-_ ]?east/], ["NW", /nord[-_ ]?west|north[-_ ]?west/], ["SO", /s(ü|ue|u)d[-_ ]?ost|south[-_ ]?east/], ["SW", /s(ü|ue|u)d[-_ ]?west|south[-_ ]?west/],
  ["N", /(^|[^a-zäöü])(nord|north)($|[^a-zäöü])/], ["S", /(^|[^a-zäöü])(s(ü|ue)d|south)($|[^a-zäöü])/], ["O", /(^|[^a-zäöü])(ost|east)($|[^a-zäöü])/], ["W", /(^|[^a-zäöü])(west)($|[^a-zäöü])/]];
function guessFace(h, eid) {
  const st = h.states[eid];
  const s = `${eid.replace(/^cover\./, "").replace(/_/g, " ")} ${(st && st.attributes.friendly_name) || ""}`.toLowerCase();
  const hit = GUESS.find(([, re]) => re.test(s));
  return hit ? hit[0] : "";
}
/** Ausrichtung eines Rollos: eingestellt, sonst geraten; "-" = keine Beschattung. */
function coverFace(h, L, eid) {
  const set = ((L.shading && L.shading.facing) || {})[eid];
  if (set === "-") return "";
  return FACE[set] ? set : guessFace(h, eid);
}

/** Zeitfenster, in denen die Sonne auf die Fassade scheint (Höhe über 10°, höchstens 70° seitlich).
    Meist eins; nach Norden im Sommer zwei (morgens und abends). */
const _win = new Map();
function sunWindows(day, face, loc) {
  const key = `${dayKey(day)}|${face}|${loc.lat}|${loc.lon}`;
  if (_win.has(key)) return _win.get(key);
  const deg = FACE[face].deg, t0 = midnight(day).getTime(), res = [];
  let cur = null;
  for (let m = 0; m <= 1440; m += 10) {
    const t = new Date(t0 + m * 60000), p = sunPos(t, loc.lat, loc.lon);
    const diff = Math.abs(((p.az - deg + 540) % 360) - 180);
    if (p.el > 10 && diff < 70) { if (!cur) res.push((cur = { from: t, to: t })); else cur.to = t; } else cur = null;
  }
  // kurze Streifen (unter einer halben Stunde) heizen kaum auf
  const out = res.filter((w) => w.to - w.from >= 30 * 60000);
  if (_win.size > 200) _win.clear();
  _win.set(key, out);
  return out;
}

/* ---------- Hinweise ---------- */
const hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
/** Rechtzeitig schließen: eine halbe Stunde vor der Sonne, auf Viertelstunden abgerundet. */
function closeBy(from) {
  const t = new Date(from.getTime() - 30 * 60000);
  t.setMinutes(Math.floor(t.getMinutes() / 15) * 15, 0, 0);
  return t;
}
const hotDay = (d, lim) => !!d && fin(d.hi) && d.hi >= lim && (!d.cond || SUNNY.has(d.cond));
const tC = (v) => `${NF0.format(v)} °C`;

/**
 * Beschattungshinweise für heute und morgen.
 * Ergebnis: { days, hints: [{ k: "jetzt"|"heute"|"morgen", face, title, sub, eids }], noFace, lim }
 */
function shadeHints(h, m, L, now = new Date()) {
  const S = L.shading || {}, wid = weatherIdOf(h, L), loc = homeLoc(h);
  const days = fcDays(h, wid), lim = fin(S.hot) ? S.hot : 26;
  const out = { days, hints: [], noFace: false, lim, wid };
  if (S.enabled === false || !m) return out;
  const covers = m.agg.covers || [];
  const byFace = new Map();
  for (const e of covers) { const f = coverFace(h, L, e); if (!f) continue; if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(e); }
  const today = dayOf(days, 0), tomorrow = dayOf(days, 1);
  const hotToday = hotDay(today, lim), hotTomorrow = hotDay(tomorrow, lim);
  if (!hotToday && !hotTomorrow) return out;
  if (!loc || !byFace.size) {
    // ohne Ausrichtung: allgemeiner Hinweis
    out.noFace = covers.length > 0;
    const d = hotToday && now.getHours() < 15 ? today : hotTomorrow ? tomorrow : null;
    if (d && covers.length) out.hints.push({ k: d === today ? "heute" : "morgen", face: "", eids: [],
      title: `${d === today ? "Heute" : "Morgen"} ${tC(d.hi)} und ${condName(d.cond).toLowerCase() || "sonnig"}: Rollos auf der Sonnenseite rechtzeitig schließen`,
      sub: loc ? "Mit der Ausrichtung der Rollos (Einstellungen → Technik → Beschattung) gibt es Uhrzeiten je Seite." : "Standort in Home Assistant fehlt (Einstellungen → System → Allgemein)." });
    return out;
  }
  for (const [f, eids] of byFace) {
    const open = eids.filter((e) => isOn(h.states[e]));
    if (hotToday) {
      const w = sunWindows(today.date, f, loc).find((x) => now < x.to);
      if (w && open.length) {
        const n = `${open.length} von ${eids.length} ${eids.length === 1 ? "Rollo" : "Rollos"} offen`;
        if (now >= w.from) out.hints.push({ k: "jetzt", face: f, eids: open, at: w.from, title: `Sonne auf der ${faceSide(f)} bis ${hm(w.to)}`, sub: `Heute bis ${tC(today.hi)} · ${n}` });
        else out.hints.push({ k: "heute", face: f, eids: open, at: w.from, title: `${faceCovers(f)} bis ${hm(closeBy(w.from))} schließen`, sub: `Sonne auf der ${faceSide(f)} ab ${hm(w.from)} · heute bis ${tC(today.hi)} · ${n}` });
      }
    }
    if (hotTomorrow) {
      const ws = sunWindows(tomorrow.date, f, loc), w = ws[0];
      if (w) {
        const cb = closeBy(w.from), early = cb.getHours() < 8;
        out.hints.push({ k: "morgen", face: f, eids: [], at: w.from,
          title: `Morgen ${tC(tomorrow.hi)}: ${faceCovers(f)} ${early ? "morgens geschlossen lassen" : `bis ${hm(cb)} schließen`}`,
          sub: `Sonne auf der ${faceSide(f)} ${ws.map((x) => `${hm(x.from)}–${hm(x.to)}`).join(" und ")} · ${eids.length} ${eids.length === 1 ? "Rollo" : "Rollos"}` });
      }
    }
  }
  const ord = { jetzt: 0, heute: 1, morgen: 2 };
  out.hints.sort((a, b) => ord[a.k] - ord[b.k] || a.at - b.at);
  return out;
}
/** Kurzform für Kopfzeile und Bildschirmschoner, z. B. „Morgen 30 °C, Südrollos rechtzeitig schließen“. */
function shadeHeadline(res) {
  const hs = res.hints;
  if (!hs.length) return "";
  const k = hs[0].k, same = hs.filter((x) => x.k === k && x.face);
  if (!same.length) return hs[0].title;
  const names = same.map((x) => faceCovers(x.face));
  const list = names.length > 2 ? `${names.slice(0, 2).join(", ")} u. a.` : names.join(" und ");
  if (k === "jetzt") return `Sonne auf der ${same.map((x) => faceSide(x.face)).slice(0, 2).join(" und ")}: ${same.reduce((n, x) => n + x.eids.length, 0)} Rollos offen`;
  const d = dayOf(res.days, k === "heute" ? 0 : 1);
  return `${k === "heute" ? "Heute" : "Morgen"} ${d ? tC(d.hi) : ""}, ${list} rechtzeitig schließen`;
}

const weatherIdOf = (h, L) => { const w = L && L.wallpanel && L.wallpanel.weather; return w && h.states[w] ? w : Object.keys(h.states).find((e) => e.startsWith("weather.")) || ""; };

/* ---------- Anzeige ---------- */
const WD = (d, i) => (i === 0 ? "Heute" : i === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""));
/** Karte „Sonne & Wetter“ auf der Seite Beschattung (data-u="shade"). */
function shadeCardHTML(wid) {
  return `<div class="glass shade" data-u="shade" data-eid="${esc(wid || "")}"><div class="shd"><h3>${icon("mdi:weather-sunny")}Sonne & Wetter</h3><span class="sp"></span><small class="shsun"></small></div>
    <div class="fcs"></div><div class="shints"></div></div>`;
}
function updateShade(el, ctx) {
  const h = ctx._hass, res = shadeHints(h, ctx._model, ctx._layout);
  const sun = h.states["sun.sun"], loc = homeLoc(h);
  let az = sun && fin(sun.attributes.azimuth) ? sun.attributes.azimuth : null, elv = sun && fin(sun.attributes.elevation) ? sun.attributes.elevation : null;
  if (az === null && loc) { const p = sunPos(new Date(), loc.lat, loc.lon); az = p.az; elv = p.el; }
  const dir = az === null ? "" : FACES[Math.round(az / 45) % 8][2];
  setHtml(el.querySelector(".shsun"), az === null ? "" : elv > 0 ? `${icon("mdi:white-balance-sunny")}Sonne im ${esc(dir)}en, ${NF0.format(elv)}° hoch` : `${icon("mdi:weather-night")}Sonne untergegangen`);
  const days = res.days.slice(0, 5);
  setHtml(el.querySelector(".fcs"), days.length
    ? days.map((d, i) => `<div class="fc${hotDay(d, res.lim) ? " hot" : ""}" title="${esc(condName(d.cond))}"><small>${WD(d.date, i)}</small>${icon(condIcon(d.cond))}<b>${fin(d.hi) ? `${NF0.format(d.hi)}°` : "–"}</b><small>${fin(d.lo) ? `${NF0.format(d.lo)}°` : ""}${d.rain >= 0.5 ? ` · ${NF0.format(d.rain)} mm` : ""}</small></div>`).join("")
    : `<small class="fcnone">${res.wid ? "Vorhersage wird geladen …" : "Keine Wetter-Entität gefunden."}</small>`);
  const hs = res.hints;
  setHtml(el.querySelector(".shints"), hs.length
    ? hs.map((x) => `<div class="shint ${x.k}">${icon(x.k === "jetzt" ? "mdi:white-balance-sunny" : x.k === "heute" ? "mdi:clock-alert-outline" : "mdi:calendar-arrow-right")}<div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div>
        ${x.eids.length ? `<button class="pbtn" data-act="list-covers" data-svc="close_cover" data-confirm="1" data-eids="${esc(x.eids.join(","))}" data-ctitle="${esc(`${faceCovers(x.face)} schließen?`)}" data-ctext="${esc(`${x.eids.length} ${x.eids.length === 1 ? "Rollo" : "Rollos"} auf der ${faceSide(x.face)}.`)}">${icon("mdi:arrow-down")}Schließen</button>` : ""}</div>`).join("")
    : ctx._layout.shading && ctx._layout.shading.enabled === false ? "" : days.length ? `<div class="shint calm">${icon("mdi:check-circle-outline")}<div><b>Keine Beschattung nötig</b><small>Heute und morgen unter ${tC(res.lim)} oder ohne viel Sonne.</small></div></div>` : "");
}
/** Watch-Liste der Karte: Rollos, Wetter und Sonne. */
const shadeWatch = (el, c) => [...(c._model.agg.covers || []), el.dataset.eid, "sun.sun"].filter(Boolean);

export { condIcon, condName, coverFace, dayOf, FACES, fcDays, fcEnsure, fcListen, fcUnlisten, guessFace, homeLoc, shadeCardHTML, shadeHeadline, shadeHints, shadeWatch, sunPos, sunWindows, updateShade, W_COND, weatherIdOf };
