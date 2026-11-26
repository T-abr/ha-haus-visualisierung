/* Haus Visualisierung – Reiter „Prüfen & Sichern“: Einrichtungs-Check (was fehlt oder nicht passt) und Sicherungen
 * der Einstellungen (backup.py: automatisch vor Updates und täglich vor dem Speichern, von Hand, Export/Import). */

import { DOMAIN } from "./version.js";
import { esc, icon, isUnav, withDefaults } from "./grundlagen.js";
import { buildModel } from "./modell.js";
import { coverFace, homeLoc, weatherIdOf } from "./wetter.js";
import { termCals } from "./termine.js";
import { ALARMS } from "./warnungen.js";
import { wxAuto } from "./wetterwarnung.js";

const ENT_RE = /^[a-z_]+\.[a-z0-9_]+$/;

/** Alle Entitäten, die in den Einstellungen stehen, mit Fundstelle und Reiter. */
function layoutRefs(L) {
  const out = [];
  const add = (e, where, tab) => { if (typeof e === "string" && ENT_RE.test(e)) out.push({ e, where, tab }); };
  const H = L.header || {};
  [["pv", "PV-Leistung"], ["battery", "Akku-Ladestand"], ["power", "Hausverbrauch"], ["grid", "Netz"]].forEach(([k, t]) => add(H[k], `Energie · ${t}`, "energie"));
  add((L.energy || {}).battery_power, "Energie · Speicher-Leistung", "energie");
  add((L.price || {}).sensor, "Strompreis · Sensor", "energie");
  add((L.forecast || {}).solar_today, "Vorhersage · Solar heute", "energie");
  add((L.forecast || {}).solar_tomorrow, "Vorhersage · Solar morgen", "energie");
  add((L.wallpanel || {}).weather, "Wandpanel · Wetter", "displays");
  add((L.wallpanel || {}).wake_entity, "Wandpanel · Aufwecken", "displays");
  const HE = L.heating || {};
  ["stove", "stove_pump", "curve", "mixer", "flow", "outdoor"].forEach((k) => add(HE[k], `Heizung · ${k}`, "technik"));
  (HE.tank || []).forEach((e) => add(e, "Heizung · Speicher", "technik"));
  const WB = L.wallbox || {};
  ["power", "mode", "soc", "limit", "energy", "connected", "charging", "range"].forEach((k) => add(WB[k], `Wallbox · ${k}`, "energie"));
  (((L.appliances || {}).items) || []).forEach((a) => ["power", "energy", "status", "door", "remaining"].forEach((k) => add(a[k], `Haushaltsgerät ${a.name || a.id} · ${k}`, "technik")));
  const WX = L.weather_alerts || {};
  (WX.dwd || []).forEach((e) => add(e, "Wetterwarnungen · DWD", "technik"));
  add(WX.rain_sensor, "Wetterwarnungen · Regensensor", "technik");
  (WX.awnings || []).forEach((e) => add(e, "Wetterwarnungen · Markise", "technik"));
  const DB = L.doorbell || {};
  add(DB.entity, "Klingel · Auslöser", "meldungen"); add(DB.camera, "Klingel · Kamera", "meldungen"); add(DB.lock, "Klingel · Türöffner", "meldungen");
  const HM = L.house_mode || {};
  add(HM.alarmo, "Hausmodus · Alarmanlage", "alarme");
  (HM.check_devices || []).forEach((e) => add(e, "Gute-Nacht-Check", "alarme"));
  const PS = L.presence_sim || {};
  add(PS.switch, "Anwesenheits-Simulation · Schalter", "alarme");
  (PS.entities || []).forEach((e) => add(e, "Anwesenheits-Simulation", "alarme"));
  (((L.alerts || {}).rules) || []).forEach((r, i) => add(r.entity, `Eigene Regel ${r.title || i + 1}`, "alarme"));
  (L.alarm_actions || []).forEach((a, i) => add(a.entity, `Aktion ${a.name || i + 1}`, "alarme"));
  Object.entries(L.pins || {}).forEach(([, l]) => (l || []).forEach((e) => add(e, "Raum-Pin", "raeume")));
  (L.favorites || []).forEach((e) => add(e, "Favorit", "raeume"));
  Object.values(L.scenes || {}).forEach((sc) => Object.keys(sc.ents || {}).forEach((e) => add(e, `Szene ${sc.name}`, "raeume")));
  (L.displays || []).forEach((d) => {
    (d.tiles || []).forEach((t) => { if (typeof t === "string" && t.startsWith("entity:")) add(t.slice(7), `Display ${d.name} · Kachel`, "displays"); });
    (d.custom || []).forEach((pg) => (pg.tiles || []).forEach((t) => add(t && t.entity, `Display ${d.name} · ${pg.name}`, "displays")));
  });
  return out;
}

/* Abschnitt der Einstellungen zu einer Fundstelle aus layoutRefs (Schlüssel wie secKey in einstellungen.js) */
const WHERE_SEC = [["Energie", "energie"], ["Strompreis", "strompreis"], ["Vorhersage", "vorhersage-und-pv-prognose"], ["Wandpanel", "wandpanel"],
  ["Heizung", "heizung"], ["Wallbox", "wallbox"], ["Haushaltsgerät", "haushaltsgeraete"], ["Wetterwarnungen", "wetterwarnungen"], ["Klingel", "klingel"],
  ["Hausmodus", "hausmodus"], ["Gute-Nacht", "gute-nacht-und-verlassen-check"], ["Anwesenheits", "anwesenheits-simulation"], ["Eigene Regel", "warnungen"],
  ["Aktion", "eskalation-und-aktionen"], ["Raum-Pin", "etagen-bereiche"], ["Favorit", "favoriten"], ["Display", "wanddisplays"]];
const whereSec = (w) => (WHERE_SEC.find(([p]) => w.startsWith(p)) || [])[1];

/** Einrichtungs-Check: [{ lvl: "warn"|"info", icon, title, detail, tab, sec }] – je Punkt ein Satz, was fehlt und wo
 *  (sec = Abschnitt(e) der Einstellungen, dort erscheint ein Warnzeichen in der Überschrift). */
function setupChecks(h, L) {
  const S = h.states, out = [];
  const push = (lvl, ic, title, detail, tab, sec) => out.push({ lvl, icon: ic, title, detail, tab, sec });
  const secs = (l) => [...new Set(l.map((r) => whereSec(r.where)).filter(Boolean))];
  const short = (l, n = 4) => `${l.slice(0, n).join(", ")}${l.length > n ? ` und ${l.length - n} weitere` : ""}`;

  // Entitäten aus den Einstellungen, die es nicht (mehr) gibt oder die nicht erreichbar sind
  const refs = layoutRefs(L), missing = refs.filter((r) => !S[r.e]), unav = refs.filter((r) => S[r.e] && isUnav(S[r.e]));
  const byTab = (l) => [...new Set(l.map((r) => r.tab))];
  for (const tab of byTab(missing)) {
    const l = missing.filter((r) => r.tab === tab);
    push("warn", "mdi:link-variant-off", `${l.length} ${l.length === 1 ? "Entität gibt" : "Entitäten gibt"} es nicht mehr`, short(l.map((r) => `${r.where}: ${r.e}`), 3), tab, secs(l));
  }
  if (unav.length) push("info", "mdi:lan-disconnect", `${unav.length} eingetragene ${unav.length === 1 ? "Entität ist" : "Entitäten sind"} nicht erreichbar`, short(unav.map((r) => `${r.where}: ${r.e}`), 3), byTab(unav)[0], secs(unav));

  // Räume
  const m = buildModel(h, L);
  const indoor = m.floors.filter((f) => !f.outdoor).flatMap((f) => f.areas);
  const noTemp = indoor.filter((a) => !a.tempId);
  if (noTemp.length) push("info", "mdi:thermometer-off", `${noTemp.length} ${noTemp.length === 1 ? "Raum hat" : "Räume haben"} keinen Temperaturfühler`, `${short(noTemp.map((a) => a.name))} – fehlen im Klima-Durchschnitt und in den Verläufen; Fühler dem Bereich zuordnen (Home Assistant → Bereiche)`, "raeume", "etagen-bereiche");
  if (m.floors.some((f) => f.virtual && f.id !== "_out") && m.floors.some((f) => !f.virtual)) {
    const loose = m.floors.filter((f) => f.virtual && f.id !== "_out").flatMap((f) => f.areas);
    if (loose.length) push("info", "mdi:floor-plan", `${loose.length} ${loose.length === 1 ? "Bereich ohne" : "Bereiche ohne"} Etage`, `${short(loose.map((a) => a.name))} – stehen unter „Weitere Bereiche“; Etage in Home Assistant → Bereiche zuordnen`, "raeume", "etagen-bereiche");
  }

  // Wetter, Beschattung, Wetterwarnungen
  const wid = weatherIdOf(h, L);
  if (!wid) push("warn", "mdi:weather-cloudy-alert", "Keine Wetter-Entität", "Ohne Wetter gibt es keine Vorhersage, keine Beschattungs- und keine Regenhinweise (z. B. Integration „Met.no“ oder „DWD“ einrichten)", "displays", "wandpanel");
  else if (L.weather_alerts && L.weather_alerts.rain !== false && !(Number(S[wid].attributes.supported_features) & 2) && !wxAuto(h).rain && !(L.weather_alerts.rain_sensor))
    push("info", "mdi:weather-pouring", "Regenhinweis nur nach aktueller Wetterlage", `${wid} liefert keine stündliche Vorhersage und es gibt keinen Regensensor – „Regen kommt“ geht erst mit einem von beiden`, "technik", "wetterwarnungen");
  if (L.weather_alerts && L.weather_alerts.enabled !== false && !wxAuto(h).dwd.length && !(L.weather_alerts.dwd || []).length)
    push("info", "mdi:alert-outline", "Keine DWD-Warnungen eingerichtet", "Amtliche Unwetterwarnungen kommen mit der Integration „Deutscher Wetterdienst (DWD) Weather Warnings“ (Region wählen)", "technik", "wetterwarnungen");
  if (L.shading && L.shading.enabled !== false) {
    const covers = (m.agg.covers || []).filter((e) => !["garage", "gate", "awning"].includes(S[e] && S[e].attributes.device_class));
    const noFace = covers.filter((e) => !coverFace(h, L, e) && ((L.shading.facing || {})[e] !== "-"));
    if (covers.length && noFace.length) push("info", "mdi:compass-off-outline", `${noFace.length} ${noFace.length === 1 ? "Rollo ohne" : "Rollos ohne"} Ausrichtung`, `${short(noFace.map((e) => (S[e] && S[e].attributes.friendly_name) || e))} – bekommen keine Beschattungshinweise; Himmelsrichtung oder „keine“ wählen`, "technik", "beschattung");
    if (covers.length && !homeLoc(h)) push("warn", "mdi:map-marker-off", "Standort fehlt", "Für den Sonnenstand braucht Home Assistant den Standort (Einstellungen → System → Allgemein)", "technik", "beschattung");
  }

  // Termine
  const T = L.termine || {};
  if (T.enabled !== false && Object.keys(S).some((e) => e.startsWith("calendar.")) && !termCals(h, L).length)
    push("info", "mdi:calendar-question", "Kein Kalender für Müll und Termine gewählt", "Kalender sind da, aber keiner zählt – Art je Kalender wählen", "darstellung", "muellabfuhr-und-termine");

  // Meldungen
  const P = L.push || {}, notify = Object.keys((h.services && h.services.notify) || {});
  if (P.enabled !== false) {
    const mobile = notify.filter((s) => s.startsWith("mobile_app_"));
    const gone = (P.targets || []).filter((t) => !notify.includes(t));
    if (!(P.targets || []).length && !mobile.length) push("warn", "mdi:cellphone-off", "Kein Handy für Push-Meldungen", "Es gibt keinen Dienst notify.mobile_app_… – Companion-App installieren und anmelden", "meldungen", "push-benachrichtigungen");
    else if (gone.length) push("warn", "mdi:cellphone-remove", `${gone.length} Push-${gone.length === 1 ? "Empfänger gibt" : "Empfänger gibt"} es nicht mehr`, gone.map((g) => `notify.${g}`).join(", "), "meldungen", "push-benachrichtigungen");
  }

  // Hausmodus und Alarmanlage
  const HM = L.house_mode || {}, panels = Object.keys(S).filter((e) => e.startsWith("alarm_control_panel."));
  if (HM.alarmo_sync && !panels.length) push("warn", "mdi:shield-off-outline", "Kopplung mit der Alarmanlage ohne Alarmanlage", "„Hausmodus und Alarmanlage koppeln“ ist an, aber es gibt kein alarm_control_panel (z. B. Alarmo)", "alarme", "hausmodus");
  const persons = Object.keys(S).filter((e) => e.startsWith("person."));
  if (HM.enabled !== false && HM.auto_away && !persons.length) push("info", "mdi:account-off-outline", "Automatik „Abwesend“ ohne Personen", "Es gibt keine Personen-Entitäten; Abwesend schaltet dann nie automatisch", "alarme", "hausmodus");

  // PIN
  const PN = L.pin || {}, M = (ALARMS && ALARMS.mode) || {};
  if ((L.displays || []).length && !M.pin && (PN.door || PN.disarm || PN.arm))
    push("info", "mdi:dialpad", "Keine PIN gesetzt", "Am Wandpanel und Display kann jeder die Tür öffnen und den Alarm ausschalten – PIN unter Alarme setzen", "alarme", "pin-fuer-heikle-aktionen");

  // Displays
  const noDev = (L.displays || []).filter((d) => !d.device);
  if (noDev.length) push("info", "mdi:tablet-dashboard", `${noDev.length} ${noDev.length === 1 ? "Display ohne" : "Displays ohne"} Gerät`, `${short(noDev.map((d) => d.name || d.id))} – im Reiter „Wandpanel & Displays“ ein Gerät zuordnen`, "displays", "wanddisplays");

  return out.sort((a, b) => (a.lvl === b.lvl ? 0 : a.lvl === "warn" ? -1 : 1));
}

const TAB_NAME = { raeume: "Räume", alarme: "Alarme", meldungen: "Meldungen", energie: "Energie", technik: "Technik", displays: "Wandpanel & Displays", darstellung: "Darstellung" };
const REASON = { update: "vor dem Update", taeglich: "automatisch", wiederherstellen: "vor dem Wiederherstellen", manuell: "von Hand", import: "vor dem Import" };
const dt = (ts) => new Date(ts * 1000).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function checkHTML(h, L) {
  const list = setupChecks(h, L), warns = list.filter((x) => x.lvl === "warn").length;
  const rows = list.map((x) => `<div class="srow chk ${x.lvl}">${icon(x.icon)}<span class="lbl">${esc(x.title)}<small>${esc(x.detail)}</small></span>
      ${x.tab ? `<button class="pbtn sm" data-act="s-tab" data-tab="${x.tab}">${icon("mdi:arrow-right")}${TAB_NAME[x.tab] || "Öffnen"}</button>` : ""}</div>`).join("");
  return `<div class="set glass" data-sec="check"><h2>${icon("mdi:clipboard-check-outline")}Einrichtungs-Check</h2>
    <p class="hint">Was fehlt oder nicht mehr passt – z. B. gelöschte Entitäten in den Einstellungen, Räume ohne Fühler, Rollos ohne Ausrichtung. Geprüft wird der gespeicherte Stand; der Knopf führt zum passenden Reiter.</p>
    <div class="srow chkhead ${warns ? "warn" : list.length ? "info" : "ok"}">${icon(warns ? "mdi:alert-outline" : list.length ? "mdi:information-outline" : "mdi:check-circle-outline")}<span class="lbl">${!list.length ? "Alles eingerichtet" : `${list.length} ${list.length === 1 ? "Punkt" : "Punkte"} zum Prüfen`}<small>${warns ? `${warns} davon wichtig` : list.length ? "nur Hinweise" : "Keine Auffälligkeiten gefunden"}</small></span></div>
    ${rows}</div>`;
}

function backupHTML(p) {
  const B = p._bk;
  if (B === undefined) loadBackups(p);
  const items = (B && B.items) || [];
  const sum = (s) => [s.raeume && `${s.raeume} Räume`, s.regeln && `${s.regeln} Regeln`, s.aktionen && `${s.aktionen} Aktionen`, s.displays && `${s.displays} Displays`, s.wartung && `${s.wartung} Wartungsaufgaben`, s.geraete && `${s.geraete} Geräte`].filter(Boolean).join(" · ");
  const rows = !B ? '<p class="hint">Lade …</p>' : items.length ? items.map((i) => `<div class="srow bk">${icon(i.reason === "manuell" ? "mdi:content-save-outline" : i.reason === "update" ? "mdi:update" : "mdi:history")}
      <span class="lbl">${esc(dt(i.ts))}<small>${esc(REASON[i.reason] || i.reason)}${i.note ? ` (${esc(i.note)})` : ""} · Version ${esc(i.version)}${sum(i.summary || {}) ? ` · ${esc(sum(i.summary || {}))}` : ""}</small></span>
      <button class="sbtn" data-act="s-bk-dl" data-id="${esc(i.id)}" title="Herunterladen">${icon("mdi:download")}</button>
      <button class="pbtn sm" data-act="s-bk-restore" data-id="${esc(i.id)}">${icon("mdi:backup-restore")}Wiederherstellen</button>
      <button class="sbtn danger" data-act="s-bk-del" data-id="${esc(i.id)}" title="Löschen">${icon("mdi:delete-outline")}</button></div>`).join("")
    : '<p class="hint">Noch keine Sicherung. Die erste entsteht beim nächsten Update, vor dem ersten Speichern eines Tages oder mit „Jetzt sichern“.</p>';
  const ask = p._bkAsk;
  return `<div class="set glass" data-sec="backup"><h2>${icon("mdi:backup-restore")}Sicherungen</h2>
    <p class="hint">Gesichert werden alle Einstellungen dieser Seite und der Stand des Wartungsplaners – nicht der Code der Alarmanlage, nicht die PIN und keine Protokolle. Automatisch beim ersten Start einer neuen Version, vor dem ersten Speichern eines Tages und vor jedem Wiederherstellen; behalten werden die letzten 12. Als Datei herunterladen, um sie auf einer anderen Installation einzuspielen.</p>
    ${ask ? `<div class="srow bkask">${icon("mdi:alert-outline")}<span class="lbl">${esc(ask.text)}<small>Der jetzige Stand wird vorher gesichert und lässt sich so zurückholen.</small></span>
      <button class="pbtn sm" data-act="s-bk-cancel">Abbrechen</button><button class="pbtn sm primary" data-act="s-bk-yes">${icon("mdi:backup-restore")}Übernehmen</button></div>` : ""}
    <div class="srow"><button class="pbtn" data-act="s-bk-create">${icon("mdi:content-save-outline")}Jetzt sichern</button>
      <button class="pbtn" data-act="s-bk-export">${icon("mdi:download")}Aktuellen Stand herunterladen</button>
      <button class="pbtn" data-act="s-bk-import">${icon("mdi:upload")}Datei einspielen …</button>
      <input type="file" accept="application/json,.json" id="hv-bk-file" data-bk-file="1" hidden></div>
    ${rows}</div>`;
}

function systemSettingsHTML(p, D) {
  // Geprüft wird der gespeicherte Stand (der Entwurf kann halb ausgefüllt sein)
  return `<style>${SYSTEM_CSS}</style>${checkHTML(p._hass, p._layout || D)}${backupHTML(p)}`;
}

const problems = (h, L) => setupChecks(h, L).filter((x) => x.lvl === "warn").length;

async function loadBackups(p) {
  if (p._bkLoading) return;
  p._bkLoading = true;
  try { p._bk = await p._hass.callWS({ type: `${DOMAIN}/backup_list` }); } catch (err) { p._bk = { items: [], error: String(err && err.message ? err.message : err) }; }
  p._bkLoading = false;
  p._dirty = true; p._flush();
}

function download(doc, name) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileName = (doc) => `haus-visualisierung-${String(doc.created || "").slice(0, 16).replace(/[T:]/g, "-") || "sicherung"}.json`;

async function restore(p, req) {
  const res = await p._hass.callWS({ type: `${DOMAIN}/backup_restore`, ...req });
  p._bk = { items: res.items };
  if (res.layout) p._layout = withDefaults(res.layout);
  p._draft = null; p._dirtySettings = false;
  // Das Abo meldet das neue Layout gleich hinterher und baut die Seite neu – Rückmeldung erst danach zeigen
  setTimeout(() => p._toast("Wiederhergestellt"), 300);
}

/** Klicks im Reiter; true = erledigt. */
async function systemAction(p, act, t) {
  const h = p._hass, done = () => { p._dirty = true; p._flush(); };
  try {
    switch (act) {
      case "s-bk-create": { const r = await h.callWS({ type: `${DOMAIN}/backup_create` }); p._bk = { items: r.items }; p._toast("Gesichert"); done(); return true; }
      case "s-bk-export": { const doc = await h.callWS({ type: `${DOMAIN}/export` }); download(doc, fileName(doc)); return true; }
      case "s-bk-dl": { const doc = await h.callWS({ type: `${DOMAIN}/backup_get`, backup: t.dataset.id }); download(doc, fileName(doc)); return true; }
      case "s-bk-del": { const r = await h.callWS({ type: `${DOMAIN}/backup_delete`, backup: t.dataset.id }); p._bk = { items: r.items }; done(); return true; }
      case "s-bk-import": { const f = p.shadowRoot.getElementById("hv-bk-file"); if (f) f.click(); return true; }
      case "s-bk-restore": {
        const it = ((p._bk && p._bk.items) || []).find((x) => x.id === t.dataset.id);
        p._bkAsk = { req: { backup: t.dataset.id }, text: `Sicherung vom ${it ? dt(it.ts) : "?"} wiederherstellen?${p._dirtySettings ? " Ungespeicherte Änderungen gehen verloren." : ""}` };
        done(); return true;
      }
      case "s-bk-cancel": p._bkAsk = null; done(); return true;
      case "s-bk-yes": { const ask = p._bkAsk; p._bkAsk = null; if (ask) await restore(p, ask.req); done(); return true; }
      default: return false;
    }
  } catch (err) {
    p._toast(`Fehlgeschlagen: ${err && err.message ? err.message : err}`);
    return true;
  }
}

/** Datei gewählt: lesen, prüfen, nachfragen. */
function systemFile(p, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let doc = null;
    try { doc = JSON.parse(String(r.result)); } catch (_e) { /* unten */ }
    input.value = "";
    if (!doc || typeof doc !== "object" || !(doc.format === "haus_visualisierung" || doc.alerts || doc.area_order)) { p._toast("Keine Sicherung der Haus Visualisierung"); return; }
    p._bkAsk = { req: { data: doc }, text: `Datei „${f.name}“${doc.created ? ` vom ${new Date(doc.created).toLocaleString("de-DE")}` : ""}${doc.version ? ` (Version ${doc.version})` : ""} einspielen?` };
    p._dirty = true; p._flush();
  };
  r.readAsText(f);
}

const SYSTEM_CSS = `.chk>ha-icon,.chkhead>ha-icon{--mdc-icon-size:22px;flex:none;color:var(--hv-dim)}.chk.warn>ha-icon,.chkhead.warn>ha-icon{color:var(--hv-warm)}.chkhead.ok>ha-icon{color:var(--hv-ok)}
.chkhead .lbl{font-weight:600}.bk>ha-icon,.bkask>ha-icon{--mdc-icon-size:20px;flex:none;color:var(--hv-dim)}.bkask{background:rgba(255,196,87,.12);border-radius:12px}.bkask>ha-icon{color:var(--hv-warm)}`;

export { layoutRefs, problems, setupChecks, SYSTEM_CSS, systemAction, systemFile, systemSettingsHTML };
