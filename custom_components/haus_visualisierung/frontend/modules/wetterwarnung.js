/* Haus Visualisierung – Einstellungen der Wetterwarnungen (Reiter Technik). Ausgewertet wird im Backend (weather.py):
 * DWD-Warnungen, „Regen kommt, Fenster offen“ und „Sturm, Markise ausgefahren“; Ergebnis in sensor.haus_wetter. */

import { esc, icon, NF0 } from "./grundlagen.js";
import { weatherIdOf } from "./wetter.js";

const AWNING_RE = /(markise|awning|sonnensegel)/i;
const RAIN_RE = /(regen|rain)/i, RAIN_SKIP = /(wasser|water|leak|keller|regenwasser|zisterne|tank|menge|amount|rate|total|heute|today)/i;

/** Automatisch erkannte Quellen (wie im Backend). */
function wxAuto(h) {
  const S = h.states, ids = Object.keys(S);
  const dwd = ids.filter((e) => e.startsWith("sensor.") && "warning_count" in S[e].attributes && ("region_name" in S[e].attributes || "region_id" in S[e].attributes));
  const rain = ids.find((e) => e.startsWith("binary_sensor.") && RAIN_RE.test(`${e} ${S[e].attributes.friendly_name || ""}`) && !RAIN_SKIP.test(`${e} ${S[e].attributes.friendly_name || ""}`)) || "";
  const awnings = ids.filter((e) => e.startsWith("cover.") && (S[e].attributes.device_class === "awning" || AWNING_RE.test(`${e} ${S[e].attributes.friendly_name || ""}`)));
  return { dwd, rain, awnings };
}

function wxSettingsHTML(h, D) {
  const W = D.weather_alerts || {}, A = wxAuto(h), wid = weatherIdOf(h, D);
  const st = h.states["sensor.haus_wetter"], n = st ? Number(st.state) || 0 : null;
  const tg = (k, on) => `<label class="tgl"><input type="checkbox" data-set="weather_alerts.${k}" data-bool="1" ${on ? "checked" : ""}><span></span></label>`;
  const hourly = wid && h.states[wid] && (Number(h.states[wid].attributes.supported_features) & 2);
  const list = (l) => (l.length ? l.map(esc).join(", ") : "keine gefunden");
  return `<div class="set glass" data-sec="wetterwarnung"><h2>${icon("mdi:weather-lightning-rainy")}Wetterwarnungen</h2>
    <p class="hint">Meldungen im Alarmmanager, in der Kopfzeile, im Bildschirmschoner, am Wanddisplay und per Push: amtliche Warnungen des Deutschen Wetterdienstes, „Regen kommt“ bzw. „Es regnet“ bei offenen Fenstern und Türen und „Sturm“ bei ausgefahrener Markise. Geschaltet wird nichts.${n !== null ? ` Gerade aktiv: ${NF0.format(n)}.` : ""}</p>
    <div class="srow"><span class="lbl">Wetterwarnungen<small>feste Regel „Wetter“ unter Alarme → Warnungen legt die Hausmodi fest</small></span>${tg("enabled", W.enabled !== false)}</div>
    <div class="fl-title">Deutscher Wetterdienst</div>
    <div class="srow"><span class="lbl">Warnsensoren<small>Integration „DWD Weather Warnings“; leer = automatisch (${list(A.dwd)})</small></span>
      <input class="inp w" list="dl-all" data-set="weather_alerts.dwd" data-csv="1" value="${esc((W.dwd || []).join(", "))}" placeholder="sensor.…_aktuelle_warnstufe"></div>
    <div class="srow"><span class="lbl">Melden ab Stufe<small>Vorabinformationen und spätere Warnungen kommen als Hinweis</small></span>
      <select class="inp" data-set="weather_alerts.dwd_min" data-num="1">${[[1, "1 – Wetterwarnung (gelb)"], [2, "2 – markant (orange)"], [3, "3 – Unwetter (rot)"], [4, "4 – extremes Unwetter (violett)"]].map(([k, t]) => `<option value="${k}" ${(W.dwd_min ?? 2) === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    <div class="fl-title">Regen und offene Fenster</div>
    <div class="srow"><span class="lbl">Regen bei offenem Fenster melden<small>Fenster und Türen in Innenräumen (ohne Garagentore); Quelle: Regensensor, Wetterlage, DWD-Gewitter/Starkregen oder ${hourly ? "die stündliche Vorhersage" : "– ohne stündliche Vorhersage der Wetter-Entität nur aktuelle Lage"}</small></span>${tg("rain", W.rain !== false)}</div>
    <div class="srow"><span class="lbl">Vorausschauen<small>Minuten</small></span><input class="inp s" type="number" min="15" max="240" data-set="weather_alerts.rain_min" data-num="1" value="${esc(String(W.rain_min ?? 60))}"></div>
    <div class="srow"><span class="lbl">Ab Niederschlag<small>mm je Stunde laut Vorhersage</small></span><input class="inp s" type="number" min="0.1" max="10" step="0.1" data-set="weather_alerts.rain_mm" data-num="1" value="${esc(String(W.rain_mm ?? 0.3))}"></div>
    <div class="srow"><span class="lbl">Regensensor<small>leer = automatisch nach Namen (${A.rain ? esc(A.rain) : "keiner gefunden"})</small></span>
      <input class="inp w" list="dl-all" data-set="weather_alerts.rain_sensor" value="${esc(W.rain_sensor || "")}" placeholder="binary_sensor.regensensor"></div>
    <div class="fl-title">Sturm und Markisen</div>
    <div class="srow"><span class="lbl">Sturm bei ausgefahrener Markise melden<small>DWD-Warnung vor Wind oder Gewitter, sonst Böen laut Wetter</small></span>${tg("wind", W.wind !== false)}</div>
    <div class="srow"><span class="lbl">Ab Böen<small>km/h</small></span><input class="inp s" type="number" min="20" max="150" data-set="weather_alerts.wind_kmh" data-num="1" value="${esc(String(W.wind_kmh ?? 50))}"></div>
    <div class="srow"><span class="lbl">Markisen<small>leer = automatisch (${list(A.awnings)})</small></span>
      <input class="inp w" list="dl-all" data-set="weather_alerts.awnings" data-csv="1" value="${esc((W.awnings || []).join(", "))}" placeholder="cover.markise_terrasse"></div>
  </div>`;
}

export { wxAuto, wxSettingsHTML };
