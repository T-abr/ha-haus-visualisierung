/* Haus Visualisierung – Wanddisplays (z. B. 4-Zoll-ESP32-S3 mit ESPHome): Reiter „Displays“ in den Einstellungen.
 * Das Display ist ein Client der Visualisierung: Seiten und Kacheln stehen hier (Layout-Schlüssel „displays“), die
 * Inhalte rechnet das Backend (display.py) und schickt sie ans zugeordnete Gerät (Feld „device“).
 * Einrichten ohne Handarbeit: Assistent oben im Reiter – Firmware aus dem Browser flashen (ESP Web Tools, mitgeliefert
 * unter vendor/), WLAN per Improv, Gerät übernehmen und zuordnen (display_setup.py).
 * Schnittstelle: DISPLAY_PROTOKOLL.md; Firmware: Repository ha-haus-display. */

import { entName, esc, icon } from "./grundlagen.js";
import { DOMAIN } from "./version.js";

/* Muss zu display.py passen (TILES, PAGES, Protokoll) */
const DISPLAY_PROTOCOL = 1;
const DISPLAY_TILES = [["pv_jetzt", "PV jetzt"], ["energie_heute", "Energie heute"], ["klima_mittel", "Raumklima Ø"], ["morgen", "Müll und Termine"],
  ["wetter", "Wetter"], ["meldungen", "Meldungen"], ["geraete", "Haushaltsgeräte"], ["strompreis", "Strompreis"]];
const DISPLAY_PAGES = [["start", "Start"], ["energie", "Energie"], ["klima", "Klima"], ["haus", "Haus"]];
const DEFAULT_TILES = ["pv_jetzt", "energie_heute", "klima_mittel", "morgen"];
const FIRMWARE_URL = "https://github.com/T-abr/ha-haus-display";
/* Eigene Seiten: Grenzen wie display.py (CUSTOM_PAGES, CUSTOM_TILES); Symbole nur aus der Firmware (DISPLAY_ICONS) */
const CUSTOM_PAGES = 3, CUSTOM_TILES = 6;
const CUSTOM_ICONS = ["air-conditioner", "airplane", "battery", "battery-70", "bed", "bell", "blinds", "car", "cctv", "ceiling-light", "coffee", "desk-lamp", "door", "door-closed", "door-open", "eye", "fan", "fan-off", "fire", "flash", "floor-lamp", "flower", "garage", "garage-open-variant", "gate", "gauge", "gesture-tap-button", "heat-pump", "home", "home-lightning-bolt", "home-thermometer", "home-variant", "lamp", "leaf", "led-strip-variant", "lightbulb", "lightbulb-group", "lightbulb-on", "lightbulb-outline", "lightning-bolt", "lock", "lock-open", "lock-open-variant", "motion-sensor", "music", "palette", "pool", "power", "power-plug", "power-plug-outline", "power-socket-eu", "radiator", "robot-vacuum", "script-text", "shield-check", "shield-home", "shield-lock", "shower", "silverware-fork-knife", "snowflake", "sofa", "sofa-outline", "solar-power-variant", "speaker", "speaker-play", "sprinkler", "star", "string-lights", "television", "thermometer", "thermostat", "toggle-switch", "toggle-switch-off-outline", "view-dashboard", "washing-machine", "water", "water-percent", "window-closed", "window-open-variant", "window-shutter", "window-shutter-open"];

const slug = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);

/** Neues Display mit freier Kennung (flur, flur_2 …) */
function newDisplay(list) {
  const ids = new Set((list || []).map((d) => d.id));
  let id = "flur", n = 2;
  while (ids.has(id)) id = `flur_${n++}`;
  return { id, name: n > 2 ? `Flur ${n - 1}` : "Flur", pages: ["start", "energie", "klima", "haus"], tiles: [...DEFAULT_TILES],
    hint: true, bright_day: 80, bright_night: 10, wake: true, device: "", custom: [], saver: false, saver_min: 5, saver_bright: 20 };
}

/** Seite ein- bzw. ausschalten (Start bleibt immer), Reihenfolge wie DISPLAY_PAGES */
function togglePage(d, page) {
  if (page === "start") return d.pages;
  const on = new Set(d.pages || ["start"]);
  if (on.has(page)) on.delete(page); else on.add(page);
  on.add("start");
  return DISPLAY_PAGES.map(([k]) => k).filter((k) => on.has(k));
}

/** Kennung beim Umbenennen nachziehen, solange das Display noch nicht gespeichert ist */
function renameId(d, saved, list) {
  if ((saved || []).some((x) => x.id === d.id)) return d.id;
  const ids = new Set(list.filter((x) => x !== d).map((x) => x.id));
  const base = slug(d.name) || "display";
  let id = base, n = 2;
  while (ids.has(id)) id = `${base}_${n++}`;
  return id;
}

function displaySettingsHTML(ctx, D) {
  const h = ctx._hass, list = D.displays || [];
  const saved = new Set(((ctx._layout && ctx._layout.displays) || []).map((d) => d.id));
  const tileSel = (d, i, k) => {
    const v = (d.tiles || [])[k] || "";
    const isEnt = v.startsWith("entity:");
    const opts = [["", "– leer –"], ...DISPLAY_TILES, ["entity:", "Entität …"]]
      .map(([key, t]) => `<option value="${key}" ${(isEnt ? key === "entity:" : key === v) ? "selected" : ""}>${t}</option>`).join("");
    return `<div class="dslot"><span class="dsn">${k + 1}</span><select class="inp" data-disp-tile="${i}.${k}">${opts}</select>
      ${isEnt ? `<input class="inp w" list="dl-all" data-disp-ent="${i}.${k}" value="${esc(v.slice(7))}" placeholder="light.flur">` : ""}</div>`;
  };
  const iconSel = (key, v, auto) => `<span class="dico">${icon(`mdi:${v || auto}`)}</span><select class="inp s" data-set="${key}" title="Symbol">
      ${auto ? `<option value="" ${!v ? "selected" : ""}>automatisch</option>` : ""}${CUSTOM_ICONS.map((n) => `<option value="${n}" ${n === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  const customHTML = (d, i) => {
    const pages = (d.custom || []).map((pg, p) => {
      const base = `displays.${i}.custom.${p}`;
      const tiles = (pg.tiles || []).map((t, k) => `<div class="dct">
          <input class="inp w" list="dl-all" data-set="${base}.tiles.${k}.entity" value="${esc(t.entity || "")}" placeholder="light.wohnzimmer">
          <input class="inp" data-set="${base}.tiles.${k}.name" value="${esc(t.name || "")}" placeholder="${esc(t.entity && h.states[t.entity] ? entName(h, t.entity) : "Name (optional)")}">
          ${iconSel(`${base}.tiles.${k}.icon`, t.icon, "circle-outline")}
          <button class="sbtn" data-act="s-disp-cust" data-op="tile-up" data-i="${i}" data-p="${p}" data-k="${k}" ${k ? "" : "disabled"} title="Nach vorn">${icon("mdi:arrow-up")}</button>
          <button class="sbtn danger" data-act="s-disp-cust" data-op="tile-del" data-i="${i}" data-p="${p}" data-k="${k}" title="Entfernen">${icon("mdi:close")}</button></div>`).join("");
      return `<div class="dcp"><div class="dcph"><span class="dsn">${p + 1}</span>
          <input class="inp" data-set="${base}.name" value="${esc(pg.name || "")}" placeholder="Wohnzimmer" maxlength="20">
          ${iconSel(`${base}.icon`, pg.icon || "view-dashboard", "")}
          <button class="sbtn" data-act="s-disp-cust" data-op="page-up" data-i="${i}" data-p="${p}" ${p ? "" : "disabled"} title="Im Dock nach vorn">${icon("mdi:arrow-left")}</button>
          <button class="sbtn danger" data-act="s-disp-cust" data-op="page-del" data-i="${i}" data-p="${p}" title="Seite entfernen">${icon("mdi:delete-outline")}</button></div>
        ${tiles}
        <button class="pbtn sm" data-act="s-disp-cust" data-op="tile-add" data-i="${i}" data-p="${p}" ${(pg.tiles || []).length >= CUSTOM_TILES ? "disabled" : ""}>${icon("mdi:plus")}Entität</button></div>`;
    }).join("");
    return `<div class="srow dcust"><span class="lbl">Eigene Seiten<small>bis zu ${CUSTOM_PAGES} Seiten mit je ${CUSTOM_TILES} Entitäten, im Dock nach den festen Seiten. Antippen schaltet Licht, Schalter, Lüfter, Rollo, Klima und Schloss bzw. löst Szene, Skript oder Taster aus; Sensoren zeigen ihren Wert. Neue Symbole brauchen eine neue Firmware.</small></span>
      <div class="dcps">${pages}<button class="pbtn sm" data-act="s-disp-cust" data-op="page-add" data-i="${i}" ${(d.custom || []).length >= CUSTOM_PAGES ? "disabled" : ""}>${icon("mdi:plus")}Seite hinzufügen</button></div></div>`;
  };
  const rows = list.map((d, i) => {
    const eid = `sensor.haus_display_${d.id}`, st = h.states[eid];
    const status = (!saved.has(d.id) ? "noch nicht gespeichert" : st ? `${eid} · Protokoll ${esc(st.state)}` : `${eid} fehlt`)
      + (d.device ? ` · Gerät <code>${esc(d.device)}</code>` : " · kein Gerät zugeordnet");
    const pages = DISPLAY_PAGES.map(([k, t]) => `<button class="pbtn sm dpage${(d.pages || []).includes(k) ? " on" : ""}" data-act="s-disp-page" data-i="${i}" data-page="${k}" ${k === "start" ? "disabled" : ""}>${t}</button>`).join("");
    return `<div class="dcard" data-disp="${esc(d.id)}">
      <div class="srow"><span class="lbl">${icon("mdi:tablet-dashboard")} <b>${esc(d.name || d.id)}</b><small>Kennung <code>${esc(d.id)}</code> · ${status}</small></span>
        <button class="sbtn danger" data-act="s-disp-del" data-i="${i}" title="Display entfernen">${icon("mdi:delete-outline")}</button></div>
      <div class="srow"><span class="lbl">Name</span><input class="inp" data-set="displays.${i}.name" data-disp-name="${i}" value="${esc(d.name || "")}" placeholder="Flur"></div>
      <div class="srow"><span class="lbl">Seiten<small>Start ist immer dabei; unten im Dock in dieser Reihenfolge</small></span><span class="dpages">${pages}</span></div>
      <div class="srow dtiles"><span class="lbl">Kacheln auf „Start“<small>bis zu vier; „Entität“ zeigt den Zustand und schaltet Licht, Schalter, Rollo oder Schloss</small></span>
        <div class="dslots">${[0, 1, 2, 3].map((k) => tileSel(d, i, k)).join("")}</div></div>
      ${customHTML(d, i)}
      <div class="srow"><span class="lbl">Hinweiszeile<small>Alarm, abends „Gute Nacht – … offen“, sonst wichtigste Meldung oder fertiges Gerät</small></span>
        <label class="tgl"><input type="checkbox" data-set="displays.${i}.hint" data-bool="1" ${d.hint !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Helligkeit Tag / Nacht<small>in %; Nacht gilt im Hausmodus „Nacht“ (0 = aus bis zur Berührung)</small></span>
        <input class="inp s" type="number" min="10" max="100" data-set="displays.${i}.bright_day" data-num="1" value="${d.bright_day ?? 80}">
        <input class="inp s" type="number" min="0" max="100" data-set="displays.${i}.bright_night" data-num="1" value="${d.bright_night ?? 10}"></div>
      <div class="srow"><span class="lbl">Bildschirmschoner<small>wie am Wandpanel: große Uhr, Wetter, Müll und Termine, Meldungen; Tippen weckt</small></span>
        <label class="tgl"><input type="checkbox" data-set="displays.${i}.saver" data-bool="1" ${d.saver ? "checked" : ""}><span></span></label></div>
      ${d.saver ? `<div class="srow"><span class="lbl">Schoner nach / Helligkeit<small>Minuten ohne Berührung; Helligkeit in % (0 = aus, nachts gilt die geringere)</small></span>
        <input class="inp s" type="number" min="1" max="120" data-set="displays.${i}.saver_min" data-num="1" value="${d.saver_min ?? 5}">
        <input class="inp s" type="number" min="0" max="100" data-set="displays.${i}.saver_bright" data-num="1" value="${d.saver_bright ?? 20}"></div>` : ""}
      <div class="srow"><span class="lbl">Aufwecken bei Alarm<small>neue Alarm-Meldung schaltet das Display hell</small></span>
        <label class="tgl"><input type="checkbox" data-set="displays.${i}.wake" data-bool="1" ${d.wake !== false ? "checked" : ""}><span></span></label></div>
    </div>`;
  }).join("");
  const ents = Object.keys(h.states).filter((e) => /^(light|switch|cover|lock|fan|input_boolean|sensor|binary_sensor|scene|script|button|input_button|climate|media_player)\./.test(e)).sort();
  return `<style>${DISPLAY_CSS}</style><datalist id="dl-all">${ents.map((e) => `<option value="${esc(e)}">${esc(entName(h, e))}</option>`).join("")}</datalist>
    ${wizardHTML(ctx, D)}
    <div class="set glass"><h2>${icon("mdi:tablet-dashboard")}Wanddisplays</h2>
      <p class="hint">Kleine Displays an der Wand, z. B. ein 4-Zoll-ESP32-S3 (480 × 480) mit ESPHome. Das Display zeigt die Inhalte der Visualisierung im gleichen Stil; Seiten, Kacheln und Helligkeit wirken nach dem Speichern sofort, ohne neu zu flashen. Je Display gibt es die Entität <code>sensor.haus_display_&lt;kennung&gt;</code> (Protokoll ${DISPLAY_PROTOCOL}). Firmware und Hintergründe: Repository <a href="${FIRMWARE_URL}" target="_blank" rel="noreferrer">ha-haus-display</a>.</p>
      ${rows || '<p class="hint">Noch kein Display eingerichtet.</p>'}
      <div class="srow"><button class="pbtn" data-act="s-disp-add" ${list.length >= 6 ? "disabled" : ""}>${icon("mdi:plus")}Display hinzufügen</button></div>
    </div>`;
}

/* ---------- Assistent: Gerät flashen, übernehmen, zuordnen ---------- */
const EWT_URL = new URL("../vendor/esp-web-tools/install-button.js", import.meta.url).href;
const ESPHOME_WEB = "https://web.esphome.io";
const POLL_MS = 5000;

/** Zustand des Assistenten am Panel (überlebt Neuaufbauten) */
const wiz = (ctx) => (ctx._dw = ctx._dw || { devices: null, firmware: undefined, busy: "", timer: 0, sig: "", ewt: null });

/** Ist Flashen aus diesem Browser möglich? (Web Serial: Chrome/Edge am Computer, nur über HTTPS) */
function serialSupport() {
  const secure = typeof window !== "undefined" && window.isSecureContext;
  const serial = typeof navigator !== "undefined" && "serial" in navigator;
  return { ok: secure && serial, secure, serial };
}

function flashHTML(W) {
  const fw = W.firmware;
  if (fw === undefined) return '<p class="hint">Lade …</p>';
  if (!fw) return `<p class="hint">In dieser Version der Integration ist keine Firmware enthalten. Firmware selbst bauen: Repository <a href="${FIRMWARE_URL}" target="_blank" rel="noreferrer">ha-haus-display</a>.</p>`;
  const S = serialSupport();
  const why = !S.secure ? "Flashen aus dem Browser braucht eine HTTPS-Verbindung zu Home Assistant (z. B. über Home Assistant Cloud oder eine eigene HTTPS-Adresse); über http:// sperrt der Browser den USB-Zugriff."
    : !S.serial ? "Flashen aus dem Browser geht nur in Chrome oder Edge am Computer (Web Serial), nicht in Firefox, Safari oder der App." : "";
  const dl = `<a class="pbtn sm" href="${esc(fw.bin)}" download="haus-display-${esc(fw.version)}.factory.bin">${icon("mdi:download")}Firmware herunterladen</a>`;
  return S.ok
    ? `<div class="dflash"><esp-web-install-button manifest="${esc(fw.manifest)}"><button slot="activate" class="pbtn">${icon("mdi:usb")}Firmware ${esc(fw.version)} installieren</button></esp-web-install-button>${dl}</div>`
    : `<p class="dwarn">${icon("mdi:alert-outline")}<span>${why} Alternativ die Firmware herunterladen und mit <a href="${ESPHOME_WEB}" target="_blank" rel="noreferrer">ESPHome Web</a> aufspielen (läuft auch ohne Home Assistant, braucht aber ebenfalls Chrome oder Edge) oder diese Seite in Chrome/Edge über HTTPS öffnen.</span></p><div class="dflash">${dl}</div>`;
}

function devState(x) {
  if (x.flow_id) return ["Im Netz gefunden", "warn"];
  if (x.disabled) return ["in ESPHome deaktiviert", "dim"];
  if (!x.allowed) return ["in ESPHome, darf noch keine Aktionen ausführen", "warn"];
  if (!x.online) return ["offline", "dim"];
  return [`verbunden${x.version ? ` · Firmware ${esc(x.version)}` : ""}`, "ok"];
}

function devicesHTML(ctx, D) {
  const W = wiz(ctx), list = (D && D.displays) || [];
  if (W.devices === null) return '<p class="hint">Suche Geräte …</p>';
  const rows = W.devices.map((x) => {
    const [txt, cls] = devState(x);
    const key = x.flow_id ? `flow:${x.flow_id}` : `entry:${x.entry_id}`;
    const adopt = x.flow_id || !x.allowed
      ? `<button class="pbtn sm" data-act="s-disp-adopt" ${x.flow_id ? `data-flow="${esc(x.flow_id)}"` : `data-entry="${esc(x.entry_id)}"`} ${W.busy ? "disabled" : ""}>${W.busy === key ? "Übernehme …" : `${icon("mdi:check")}Übernehmen`}</button>` : "";
    const fwv = W.firmware && W.firmware.version;
    const upd = !(x.update && x.entry_id && fwv) ? "" : x.ota && x.online
      ? `<button class="pbtn sm" data-act="s-disp-update" data-dev="${esc(x.name)}" ${W.busy ? "disabled" : ""}>${W.busy === `upd:${x.name}` ? "Update läuft …" : `${icon("mdi:update")}Update auf ${esc(fwv)}`}</button>`
      : `<small class="dupd warn">${x.ota ? `Update auf ${esc(fwv)}, sobald das Gerät online ist` : `Firmware ${esc(fwv)} einmal per USB installieren (Schritt 1), danach kommen Updates über das Netz`}</small>`;
    const cur = list.findIndex((d) => d.device === x.name);
    const opts = [`<option value="">– keinem Display –</option>`, ...list.map((d, i) => `<option value="${i}" ${i === cur ? "selected" : ""}>${esc(d.name || d.id)}</option>`),
      list.length < 6 ? `<option value="neu">+ neues Display anlegen</option>` : ""].join("");
    return `<div class="ddev"><span class="lbl">${icon("mdi:tablet-dashboard")} <b>${esc(x.name)}</b><small class="${cls}">${txt}${x.host ? ` · ${esc(x.host)}` : ""}</small></span>
      ${adopt}${upd}<select class="inp" data-disp-assign="${esc(x.name)}" title="Display zuordnen">${opts}</select></div>`;
  }).join("");
  return rows || `<p class="hint">Noch kein Gerät gefunden. Nach dem Flashen und WLAN dauert es bis zu einer Minute. Steht das Gerät in einem anderen Netz (VLAN), hier seine IP-Adresse eintragen.</p>`;
}

function wizardHTML(ctx, D) {
  const W = wiz(ctx);
  setTimeout(() => wizardStart(ctx), 0);
  return `<div class="set glass dwiz"><h2>${icon("mdi:auto-fix")}Neues Gerät einrichten</h2>
    <div class="dstep"><span class="dnum">1</span><div class="dbody"><b>Firmware aufspielen</b>
      <small>Display per USB-C an diesen Computer anschließen, „Firmware installieren“ wählen und den Anschluss aussuchen (meist „USB Serial“ oder „CH340“). Für alle Displays gleich, nichts anzupassen.</small>
      <div class="dw-flash">${flashHTML(W)}</div></div></div>
    <div class="dstep"><span class="dnum">2</span><div class="dbody"><b>WLAN</b>
      <small>Fragt der Installationsdialog direkt nach dem Flashen ab. Ohne Flashen aus dem Browser: mit dem WLAN-Hotspot <code>haus-display-…</code> des Geräts verbinden und dort das WLAN wählen.</small></div></div>
    <div class="dstep"><span class="dnum">3</span><div class="dbody"><b>Übernehmen und zuordnen</b>
      <small>Home Assistant findet das Gerät im Netz. „Übernehmen“ fügt es zu ESPHome hinzu und erlaubt ihm, Aktionen auszuführen (für Tipps wie Gute Nacht); danach einem Display zuordnen – die Inhalte kommen sofort.</small>
      <div class="ddevs">${devicesHTML(ctx, D)}</div>
      <div class="srow dhost"><input class="inp" data-disp-host="1" placeholder="IP-Adresse, z. B. 192.168.1.50"><button class="pbtn sm" data-act="s-disp-ip" ${W.busy ? "disabled" : ""}>${icon("mdi:ip-network-outline")}Per IP hinzufügen</button></div></div></div>
  </div>`;
}

/** Nach dem Zeichnen: ESP Web Tools laden und Geräte abfragen, solange der Reiter offen ist */
function wizardStart(ctx) {
  const W = wiz(ctx);
  if (!ctx.shadowRoot || !ctx.shadowRoot.querySelector(".dwiz")) return;
  if (serialSupport().ok && !W.ewt) W.ewt = import(EWT_URL).catch((err) => { W.ewt = null; console.warn("ESP Web Tools nicht geladen", err); });
  if (!W.timer) {
    loadDevices(ctx);
    W.timer = setInterval(() => {
      if (!ctx.isConnected || !ctx.shadowRoot.querySelector(".dwiz")) { clearInterval(W.timer); W.timer = 0; return; }
      loadDevices(ctx);
    }, POLL_MS);
  }
}

/** Geräte und Firmware vom Backend; nur den Assistenten neu füllen, damit Eingaben nicht verloren gehen */
async function loadDevices(ctx) {
  const W = wiz(ctx);
  let res;
  try { res = await ctx._hass.callWS({ type: `${DOMAIN}/display_devices` }); } catch (err) { return; }
  const sig = JSON.stringify(res);
  if (sig === W.sig) return;
  const fwChanged = W.firmware === undefined || JSON.stringify(W.firmware) !== JSON.stringify(res.firmware);
  W.sig = sig; W.devices = res.devices || []; W.firmware = res.firmware || null;
  refreshWizard(ctx, fwChanged);
}

function refreshWizard(ctx, flash = false) {
  const R = ctx.shadowRoot, W = wiz(ctx);
  const el = R && R.querySelector(".ddevs");
  if (el) el.innerHTML = devicesHTML(ctx, ctx._draft);
  const f = flash && R && R.querySelector(".dw-flash");
  if (f) f.innerHTML = flashHTML(W);
  if (R) R.querySelectorAll(".dwiz [data-act=s-disp-ip]").forEach((b) => { b.disabled = !!W.busy; });
}

/** „Übernehmen“: gefundenes Gerät bestätigen bzw. vorhandenem Aktionen erlauben, oder per IP hinzufügen */
async function adoptDevice(ctx, t) {
  const W = wiz(ctx), msg = { type: `${DOMAIN}/display_adopt` };
  if (t.dataset.flow) msg.flow_id = t.dataset.flow;
  else if (t.dataset.entry) msg.entry_id = t.dataset.entry;
  else {
    const inp = ctx.shadowRoot.querySelector("[data-disp-host]");
    msg.host = inp ? inp.value.trim() : "";
    if (!msg.host) { ctx._toast("Bitte die IP-Adresse des Displays eintragen"); return; }
  }
  W.busy = msg.flow_id ? `flow:${msg.flow_id}` : msg.entry_id ? `entry:${msg.entry_id}` : "host";
  refreshWizard(ctx);
  try {
    const r = await ctx._hass.callWS(msg);
    ctx._toast(r.ok ? `${r.name} übernommen – jetzt einem Display zuordnen` : `Nicht übernommen: ${r.error}`);
    if (r.ok && msg.host) { const inp = ctx.shadowRoot.querySelector("[data-disp-host]"); if (inp) inp.value = ""; }
  } catch (err) {
    ctx._toast(`Nicht übernommen: ${err && err.message ? err.message : err}`);
  }
  W.busy = ""; W.sig = "";
  await loadDevices(ctx);
  refreshWizard(ctx);
}

/** „Update auf …“: mitgelieferte Firmware über das Netz installieren (Gerät lädt sie von Home Assistant) */
async function updateDevice(ctx, t) {
  const W = wiz(ctx), dev = t.dataset.dev;
  W.busy = `upd:${dev}`;
  refreshWizard(ctx);
  try {
    const r = await ctx._hass.callWS({ type: `${DOMAIN}/display_update`, device: dev });
    ctx._toast(r.ok ? `Update auf ${r.version} gestartet – das Display zeigt den Fortschritt und startet neu` : `Kein Update: ${r.error}`);
  } catch (err) {
    ctx._toast(`Kein Update: ${err && err.message ? err.message : err}`);
  }
  // Knopf erst nach dem Neustart wieder freigeben (neue Version kommt mit der nächsten Abfrage)
  setTimeout(() => { if (W.busy === `upd:${dev}`) { W.busy = ""; W.sig = ""; loadDevices(ctx); } }, 60000);
}

/** Gerät einem Display zuordnen (oder neues Display dafür anlegen); jedes Gerät gehört zu höchstens einem Display */
function assignDevice(D, dev, val) {
  const list = (D.displays || []).map((d) => ({ ...d, device: d.device === dev ? "" : (d.device || "") }));
  if (val === "neu") {
    if (list.length >= 6) return false;
    const n = newDisplay(list);
    n.device = dev;
    list.push(n);
  } else if (val !== "") {
    const d = list[Number(val)];
    if (!d) return false;
    d.device = dev;
  }
  D.displays = list;
  return true;
}

/** Eingaben, die nicht über data-set laufen (Kachelart, Entität, Name → Kennung). Liefert true, wenn neu zu zeichnen ist. */
function displayInput(D, t, saved) {
  const list = D.displays || [];
  if (t.dataset.dispTile) {
    const [i, k] = t.dataset.dispTile.split(".").map(Number), d = list[i];
    if (!d) return false;
    const tiles = [...(d.tiles || [])];
    while (tiles.length < 4) tiles.push("");
    const prev = tiles[k] || "";
    tiles[k] = t.value === "entity:" ? (prev.startsWith("entity:") ? prev : "entity:") : t.value;
    d.tiles = tiles;
    return true;
  }
  if (t.dataset.dispEnt) {
    const [i, k] = t.dataset.dispEnt.split(".").map(Number), d = list[i];
    if (!d) return false;
    const tiles = [...(d.tiles || [])];
    while (tiles.length < 4) tiles.push("");
    tiles[k] = `entity:${t.value.trim()}`;
    d.tiles = tiles;
    return false;
  }
  if (t.dataset.dispName) {
    const d = list[Number(t.dataset.dispName)];
    if (d) { d.name = t.value; d.id = renameId(d, saved, list); }
    return false;
  }
  return false;
}

/** Eigene Seiten bearbeiten (Knöpfe data-act="s-disp-cust", data-op …) */
function customAction(D, t) {
  const d = (D.displays || [])[Number(t.dataset.i)];
  if (!d) return;
  const pages = d.custom = [...(d.custom || [])];
  const p = Number(t.dataset.p), k = Number(t.dataset.k);
  const pg = pages[p] && (pages[p] = { ...pages[p], tiles: [...(pages[p].tiles || [])] });
  const up = (arr, n) => { if (n > 0) [arr[n - 1], arr[n]] = [arr[n], arr[n - 1]]; };
  switch (t.dataset.op) {
    case "page-add": if (pages.length < CUSTOM_PAGES) pages.push({ name: `Seite ${pages.length + 1}`, icon: "view-dashboard", tiles: [] }); break;
    case "page-del": pages.splice(p, 1); break;
    case "page-up": up(pages, p); break;
    case "tile-add": if (pg && pg.tiles.length < CUSTOM_TILES) pg.tiles.push({ entity: "", name: "", icon: "" }); break;
    case "tile-del": if (pg) pg.tiles.splice(k, 1); break;
    case "tile-up": if (pg) up(pg.tiles, k); break;
    default: break;
  }
}

/** Vor dem Speichern: leere Kacheln und unvollständige Entitäten weglassen */
function displaysForSave(list) {
  return (list || []).map((d) => ({ ...d, tiles: (d.tiles || []).filter((x) => x && x !== "entity:"),
    custom: (d.custom || []).map((pg) => ({ ...pg, tiles: (pg.tiles || []).filter((x) => x && String(x.entity || "").trim()) })) }));
}

const DISPLAY_CSS = `
.dwiz .dstep{display:flex;gap:12px;padding:8px 0;border-top:1px solid var(--hv-line)}.dwiz .dstep:first-of-type{border-top:0}
.dnum{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--hv-accent);color:#06142b;font-weight:600;flex:none}
.dbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}.dbody>small{color:var(--hv-dim)}
.dflash{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dwarn{display:flex;gap:8px;align-items:flex-start;margin:0;padding:8px 10px;border-radius:10px;background:rgba(255,196,87,.12);color:var(--hv-text);font-size:13px}
.dwarn a,.dbody small a{color:var(--hv-accent)}.dflash a.pbtn{text-decoration:none;color:inherit}
.ddevs{display:flex;flex-direction:column;gap:6px}
.ddev{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0}.ddev .lbl{flex:1 1 220px;min-width:0}.ddev select{flex:0 1 220px;min-width:0}
.ddev .lbl small{display:block;margin-top:2px}.ddev .dupd{flex:1 1 100%;order:9}.ddev small.ok{color:#4fd18b}.ddev small.warn{color:#ffc457}.ddev small.dim{color:var(--hv-dim)}
.dhost .inp{flex:1 1 200px;min-width:0}
.dcard{padding:6px 0 10px;border-top:1px solid var(--hv-line)}.dcard:first-of-type{border-top:0}
.dpages{display:flex;flex-wrap:wrap;gap:6px}.dpage.on{background:var(--hv-accent);color:#06142b}.dpage[disabled]{opacity:.8;cursor:default}
.dtiles{align-items:flex-start}.dslots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:6px;flex:1 1 320px}
.set .hint a{color:var(--hv-accent)}
.dslot{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}.dslot select{flex:1;min-width:0}.dslot .inp.w{flex:1 1 100%}
.dcust{align-items:flex-start}.dcps{display:flex;flex-direction:column;gap:10px;flex:1 1 320px;min-width:0;align-items:flex-start}
.dcp{display:flex;flex-direction:column;gap:6px;width:100%;padding:8px;border:1px solid var(--hv-line);border-radius:12px}
.dcph,.dct{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.dcph .inp:not(.s){flex:1 1 140px;min-width:0}
.dct .inp.w{flex:2 1 180px;min-width:0}.dct .inp:not(.w):not(.s){flex:1 1 120px;min-width:0}.dct .inp.s,.dcph .inp.s{flex:0 1 150px;min-width:0}
.dico{display:inline-grid;place-items:center;width:22px;color:var(--hv-dim)}
.dsn{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:var(--hv-surface-2);font-size:12px;color:var(--hv-dim);flex:none}
@media (max-width:600px){.dslots{grid-template-columns:1fr}}
`;

export { adoptDevice, assignDevice, customAction, updateDevice, DISPLAY_CSS, DISPLAY_PAGES, DISPLAY_PROTOCOL, DISPLAY_TILES, displayInput, displaySettingsHTML, displaysForSave, newDisplay, togglePage };
