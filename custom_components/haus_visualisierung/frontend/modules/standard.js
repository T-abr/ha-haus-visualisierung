/* Haus Visualisierung – als Standard-Dashboard von Home Assistant festlegen.
 * Home Assistant öffnet beim Start das Panel aus (in dieser Reihenfolge): Benutzer-Einstellung (Profil → Dashboard),
 * Vorgabe für alle (Einstellungen → Dashboards), Browser-Speicher „defaultPanel“ (ältere Versionen), sonst die Übersicht.
 * Das Profil und die Dashboard-Liste von Home Assistant bieten eigene Panels nicht an, deshalb setzt dieser Abschnitt
 * die Werte direkt (frontend/set_user_data bzw. frontend/set_system_data, Schlüssel „core“). Wirkt sofort, ohne Speichern. */

import { esc, icon, instant } from "./grundlagen.js";

const LS_KEY = "defaultPanel";

function lsGet() {
  try { const v = window.localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null; } catch (_e) { return null; }
}
function lsSet(v) {
  try { if (v) window.localStorage.setItem(LS_KEY, JSON.stringify(v)); else window.localStorage.removeItem(LS_KEY); } catch (_e) { /* privater Modus */ }
}

/** Neuere Home-Assistant-Versionen speichern das Standard-Dashboard am Server (Benutzer und System). */
const serverSupport = (h) => !!h && "systemData" in h;
const ownPath = (p) => (p._panel && p._panel.url_path) || "haus-visualisierung";

/** Welches Panel Home Assistant auf diesem Gerät beim Öffnen zeigt – dieselbe Reihenfolge wie im Frontend. */
function effectiveDefault(h) {
  const t = (h.userData && h.userData.default_panel) || (h.systemData && h.systemData.default_panel) || lsGet() || "home";
  return t !== "lovelace" || (h.panels && h.panels.lovelace && h.panels.lovelace.config) ? t : "home";
}

function panelTitle(p, h, path) {
  if (path === ownPath(p)) return (p._panel && p._panel.title) || "Haus Visualisierung";
  const pn = h.panels && h.panels[path];
  if (!pn) return path === "home" ? "Übersicht" : path;
  return (h.localize && h.localize(`panel.${pn.title}`)) || pn.title || (path === "lovelace" || path === "home" ? "Übersicht" : path);
}

/** Abschnitt „Beim Öffnen von Home Assistant“ im Reiter „Darstellung“. */
function defaultSettingsHTML(p) {
  const h = p._hass, me = ownPath(p), srv = serverSupport(h);
  const user = srv && h.userData ? h.userData.default_panel : undefined;
  const sys = srv && h.systemData ? h.systemData.default_panel : undefined;
  const dev = lsGet(), admin = !!(h.user && h.user.is_admin);
  const eff = effectiveDefault(h), isMe = eff === me;
  const other = (v) => (v && v !== me ? ` (bisher: ${esc(panelTitle(p, h, v))})` : "");
  const row = (act, on, label, hint, disabled) => `<div class="srow walldev${on ? " on" : ""}"><span class="lbl">${label}<small>${hint}</small></span>
      <button class="pbtn${on ? " primary" : ""}" data-act="${act}"${disabled ? " disabled" : ""}>${icon(on ? "mdi:check" : "mdi:home-import-outline")}${on ? "Ist Standard" : "Als Standard"}</button></div>`;
  const rows = srv ? [
    row("s-std-user", user === me, `Für mich${h.user && h.user.name ? ` (${esc(h.user.name)})` : ""}`,
      `auf allen Geräten, an denen du angemeldet bist, auch in der Companion-App${other(user)}; entspricht Profil → Dashboard`),
    row("s-std-system", sys === me, "Für alle Benutzer",
      `${admin ? "" : "nur für Administratoren · "}gilt für jeden, der im Profil nichts anderes gewählt hat${other(sys)}${p._panel && p._panel.require_admin ? "; die Visualisierung ist auf Administratoren beschränkt, alle anderen sehen weiter die Übersicht" : ""}`, !admin),
  ] : [];
  rows.push(row("s-std-device", dev === me, "Nur dieses Gerät",
    srv ? `nur dieser Browser; greift erst, wenn oben nichts festgelegt ist${other(dev)}` : `nur dieser Browser${other(dev)}`));
  return `<div class="set glass" data-sec="default-panel"><h2>${icon("mdi:home-import-outline")}Beim Öffnen von Home Assistant ${instant()}</h2>
      <p class="hint">Die Haus Visualisierung statt der Übersicht zeigen, sobald Home Assistant geöffnet wird (Browser, Companion-App, Wandpanel). Das Profil und die Dashboard-Liste von Home Assistant bieten eigene Panels nicht zur Auswahl an, deshalb geht das hier. Wirkt sofort, ohne Speichern; zurück zur Übersicht mit demselben Knopf.${srv ? "" : " Diese Home-Assistant-Version merkt sich das Standard-Dashboard nur im Browser; ab einer neueren Version geht es auch je Benutzer und für alle."}</p>
      <div class="srow"><span class="lbl">Auf diesem Gerät öffnet Home Assistant<small>${isMe ? "die Haus Visualisierung" : esc(panelTitle(p, h, eff))}</small></span>${icon(isMe ? "mdi:check-circle" : "mdi:circle-outline")}</div>
      ${rows.join("")}</div>`;
}

/** Klicks im Abschnitt; true = erledigt. */
async function defaultAction(p, act) {
  const h = p._hass, me = ownPath(p);
  const done = (msg) => { p._toast(msg); p._dirty = true; p._flush(); };
  try {
    if (act === "s-std-device") {
      const on = lsGet() === me;
      lsSet(on ? null : me);
      done(on ? "Dieses Gerät öffnet wieder die Übersicht" : "Dieses Gerät öffnet jetzt die Haus Visualisierung");
      return true;
    }
    if (act === "s-std-user" || act === "s-std-system") {
      if (!serverSupport(h)) return true;
      const sysWide = act === "s-std-system";
      const cur = (sysWide ? h.systemData : h.userData) || {};
      const on = cur.default_panel === me;
      const value = { ...cur };
      if (on) delete value.default_panel; else value.default_panel = me;
      await h.callWS({ type: sysWide ? "frontend/set_system_data" : "frontend/set_user_data", key: "core", value });
      // Home Assistant meldet die Änderung über sein Abo zurück; bis dahin lokal nachziehen, damit der Knopf stimmt
      if (sysWide) h.systemData = value; else h.userData = value;
      done(on ? (sysWide ? "Für alle wieder die Übersicht" : "Für dich wieder die Übersicht")
        : (sysWide ? "Home Assistant öffnet jetzt für alle die Haus Visualisierung" : "Home Assistant öffnet jetzt für dich die Haus Visualisierung"));
      return true;
    }
  } catch (err) {
    p._toast(`Ändern fehlgeschlagen: ${err && err.message ? err.message : err}`);
    return true;
  }
  return false;
}

export { defaultAction, defaultSettingsHTML, effectiveDefault };
