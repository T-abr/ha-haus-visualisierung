/* Haus Visualisierung – Anwesenheits-Simulation: Einstellungen, Status und Protokoll (Reiter „Alarme“).
 * Geplant und geschaltet wird im Backend (presence.py); hier nur Auswahl der Geräte und Anzeige. */

import { DOMAIN } from "./version.js";
import { entName, esc, HOUSE_MODES, icon } from "./grundlagen.js";

const SIM_RE = /^(light|cover|switch|input_boolean)\./;
const clock = (ts) => new Date(ts * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const dayTxt = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }); };

/** Status vom Backend holen (einmal je Aufruf der Einstellungen bzw. per „Aktualisieren“). */
function loadSim(p) {
  if (p._simInfo || p._simLoading || !p._hass.callWS) return;
  p._simLoading = true;
  p._hass.callWS({ type: `${DOMAIN}/presence_sim` }).then((r) => { p._simInfo = r; })
    .catch(() => { p._simInfo = { active: false, next: [], log: [], planned: 0, note: "" }; })
    .finally(() => { p._simLoading = false; if (p._view === "einstellungen") { p._dirty = true; p._flush(); } });
}

function statusHTML(info) {
  if (!info) return '<div class="srow"><span class="lbl"><small>Lade …</small></span></div>';
  const head = info.active
    ? `Läuft${info.source ? ` – Vorlage ${esc(dayTxt(info.source))}` : ""}, noch ${info.planned} Schaltvorgänge heute`
    : "Läuft gerade nicht.";
  const next = (info.next || []).map((n) => `<li><b>${clock(n.ts)}</b> ${esc(n.name)} ${esc(n.action)}</li>`).join("");
  const log = (info.log || []).slice(-8).reverse().map((e) => `<li class="${e.type === "fehler" ? "err" : ""}"><b>${clock(e.ts)}</b> ${esc(e.text)}</li>`).join("");
  return `<div class="srow simst"><span class="lbl">${icon(info.active ? "mdi:play-circle-outline" : "mdi:pause-circle-outline")} ${head}${info.note ? `<small>${esc(info.note)}</small>` : ""}</span>
      <button class="pbtn sm" data-act="s-sim-refresh">${icon("mdi:refresh")}Aktualisieren</button></div>
    ${next ? `<div class="srow sub"><span class="lbl"><small>Als Nächstes</small><ul class="simlist">${next}</ul></span></div>` : ""}
    ${log ? `<div class="srow sub"><span class="lbl"><small>Protokoll</small><ul class="simlist">${log}</ul></span></div>` : ""}`;
}

/** Abschnitt „Anwesenheits-Simulation“ in den Einstellungen. */
function simSettingsHTML(p, D) {
  loadSim(p);
  const S = D.presence_sim, h = p._hass, ids = Object.keys(h.states);
  const opt = (e) => `<option value="${esc(e)}">${esc(entName(h, e))}</option>`;
  const tg = (path, on) => `<label class="tgl"><input type="checkbox" data-set="${path}" data-bool="1" ${on ? "checked" : ""}><span></span></label>`;
  const chips = S.entities.map((e) => `<span class="pin">${esc(h.states[e] ? entName(h, e) : e)}<button data-act="s-sim-del" data-eid="${esc(e)}" title="Entfernen">${icon("mdi:close")}</button></span>`).join("");
  const mchips = `<span class="mchips">${HOUSE_MODES.map(([k, t, i]) => `<button class="mchip${S.modes.includes(k) ? " on" : ""}" data-act="s-mode-chip" data-path="presence_sim.modes" data-m="${k}" title="${t}">${icon(i)}</button>`).join("")}</span>`;
  return `<div class="set glass" data-sec="presence_sim"><h2>${icon("mdi:home-lightbulb-outline")}Anwesenheits-Simulation</h2>
    <p class="hint">Im Urlaub schaltet Home Assistant die ausgewählten Lichter und Rollos wie an einem echten Tag der letzten Wochen (aus dem Verlauf, bevorzugt derselbe Wochentag), jede Schaltzeit leicht zufällig verschoben. Läuft im Hintergrund, auch ohne offenes Panel, und endet sofort, wenn der Hausmodus wechselt – z. B. bei der Rückkehr. Benötigt den Recorder (Verlauf).</p>
    <div class="srow"><span class="lbl">Anwesenheit simulieren</span>${tg("presence_sim.enabled", S.enabled)}</div>
    <div class="srow"><span class="lbl">In diesen Hausmodi<small>Standard: Urlaub</small></span>${mchips}</div>
    <div class="srow"><span class="lbl">Zusätzlich per Schalter<small>optional; solange er an ist, läuft die Simulation unabhängig vom Hausmodus (input_boolean oder switch)</small></span>
      <input class="inp w" list="dl-sim-sw" data-set="presence_sim.switch" value="${esc(S.switch)}" placeholder="input_boolean.…"><datalist id="dl-sim-sw">${ids.filter((e) => /^(input_boolean|switch)\./.test(e)).map(opt).join("")}</datalist></div>
    <div class="srow"><span class="lbl">Vorlage aus den letzten Wochen<small>Anzahl Wochen im Verlauf (1–4)</small></span><input class="inp s" type="number" min="1" max="4" data-set="presence_sim.weeks" data-num="1" value="${S.weeks}"></div>
    <div class="srow"><span class="lbl">Zufällig verschieben um bis zu<small>Minuten früher oder später, damit es nicht jede Woche gleich aussieht</small></span><input class="inp s" type="number" min="0" max="60" data-set="presence_sim.jitter" data-num="1" value="${S.jitter}"><span class="rl">min</span></div>
    <div class="fl-title">Geräte</div>
    <div class="srow">${chips ? `<div class="pins" style="padding-left:0">${chips}</div>` : '<span class="lbl"><small>Noch keine Geräte – Lichter und Rollos hinzufügen.</small></span>'}</div>
    <div class="srow"><input class="inp w" list="dl-sim" placeholder="Licht oder Rollo hinzufügen, z. B. light.wohnzimmer_decke" data-sim-input="1"><datalist id="dl-sim">${ids.filter((e) => SIM_RE.test(e) && !S.entities.includes(e)).map(opt).join("")}</datalist>
      <button class="pbtn" data-act="s-sim-add">${icon("mdi:plus")}Hinzufügen</button></div>
    <div class="fl-title">Status</div>
    ${statusHTML(p._simInfo)}
  </div>`;
}

/** Klicks im Abschnitt; true = erledigt. */
function simAction(p, act, t) {
  const D = p._draft;
  if (act === "s-sim-refresh") { p._simInfo = null; loadSim(p); p._dirty = true; p._flush(); return true; }
  if (!D) return false;
  const S = D.presence_sim;
  if (act === "s-sim-add") {
    const inp = p.shadowRoot.querySelector("[data-sim-input]");
    const v = inp && inp.value.trim();
    if (!v) return true;
    if (!SIM_RE.test(v)) { p._toast("Nur Lichter, Rollos und Schalter"); return true; }
    if (!p._hass.states[v]) { p._toast(`Entität ${v} nicht gefunden`); return true; }
    if (!S.entities.includes(v)) S.entities = [...S.entities, v];
  } else if (act === "s-sim-del") {
    S.entities = S.entities.filter((e) => e !== t.dataset.eid);
  } else return false;
  p._rerenderSettings();
  return true;
}

export { simAction, simSettingsHTML };
