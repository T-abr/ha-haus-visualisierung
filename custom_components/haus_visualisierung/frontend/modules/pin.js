/* Haus Visualisierung – PIN für heikle Aktionen: Tür öffnen, Alarm aus (zurück auf „Zuhause“), Abwesend/Urlaub einschalten.
 * Die PIN prüft das Backend (pin.py, …/pin_check); im Browser liegt sie nie. Nach richtiger Eingabe bleibt das Gerät
 * 30 Sekunden entsperrt, damit z. B. „Tür öffnen“ und „Zuhause“ hintereinander nicht zweimal fragen.
 * Gedacht gegen Besuch und Kinder an Wandpanels, kein Ersatz für Benutzerrechte in Home Assistant. */

import { DOMAIN } from "./version.js";
import { esc, icon, MODE_NAME } from "./grundlagen.js";
import { ALARMS } from "./warnungen.js";

const UNLOCK_MS = 30000;
const SECURE = ["nacht", "abwesend", "urlaub"];
const KIND_TXT = { door: "Tür öffnen", disarm: "Alarm aus", arm: "Abwesend/Urlaub" };
let unlockedUntil = 0;

/** Schutzart eines Moduswechsels (wie pin.mode_kind im Backend). */
function modeKind(current, target) {
  if (!target || target === current) return null;
  if (target === "zuhause" && SECURE.includes(current)) return "disarm";
  if (target === "abwesend" || target === "urlaub") return "arm";
  return null;
}

const pinIsSet = () => !!(ALARMS && ALARMS.mode && ALARMS.mode.pin);

/** Braucht diese Aktion auf diesem Gerät die PIN? */
function pinNeeded(p, kind) {
  const P = (p._layout && p._layout.pin) || {};
  if (!kind || !P[kind] || !pinIsSet()) return false;
  return P.scope === "all" || !!(p._wallIsOn && p._wallIsOn());
}

/** true = ausführen (keine PIN nötig, gerade entsperrt oder richtig eingegeben). */
function pinOk(p, kind, title) {
  if (!pinNeeded(p, kind) || Date.now() < unlockedUntil) return Promise.resolve(true);
  return new Promise((resolve) => showPad(p, kind, title, resolve));
}

function showPad(p, kind, title, resolve) {
  const root = p.shadowRoot.querySelector(".app") || p.shadowRoot;
  const old = root.querySelector(".pinbg");
  if (old) old.remove();
  let val = "", busy = false, done = false;
  const m = document.createElement("div");
  m.className = "pinbg";
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
  m.innerHTML = `<style>${PIN_CSS}</style><div class="pinpad glass" role="dialog" aria-modal="true" aria-label="PIN eingeben">
    <span class="mic">${icon("mdi:lock-outline")}</span><div class="mt">${esc(title || KIND_TXT[kind] || "Geschützte Aktion")}</div>
    <div class="mx">PIN eingeben</div><div class="pindots" aria-live="polite"></div><div class="pinmsg"></div>
    <div class="pinkeys">${keys.map((k) => `<button class="pinkey${k === "ok" ? " ok" : ""}" data-pin="${k}" aria-label="${k === "del" ? "Löschen" : k === "ok" ? "Bestätigen" : k}">${k === "del" ? icon("mdi:backspace-outline") : k === "ok" ? icon("mdi:check") : k}</button>`).join("")}</div>
    <button class="pbtn pincancel" data-pin="cancel">Abbrechen</button></div>`;
  const dots = m.querySelector(".pindots"), msg = m.querySelector(".pinmsg"), pad = m.querySelector(".pinpad");
  const draw = () => { dots.innerHTML = Array.from({ length: Math.max(4, val.length) }, (_, i) => `<i class="${i < val.length ? "on" : ""}"></i>`).join(""); };
  const finish = (ok) => {
    if (done) return;
    done = true;
    window.removeEventListener("keydown", onKey, true);
    m.remove();
    resolve(ok);
  };
  const submit = async () => {
    if (busy || val.length < 4) return;
    busy = true;
    try {
      const res = await p._hass.callWS({ type: `${DOMAIN}/pin_check`, pin: val });
      if (res && res.ok) { unlockedUntil = Date.now() + UNLOCK_MS; finish(true); return; }
      val = "";
      msg.textContent = res && res.wait ? `Zu viele Versuche – noch ${res.wait} s gesperrt` : "Falsche PIN";
      pad.classList.remove("shake"); void pad.offsetWidth; pad.classList.add("shake");
    } catch (err) {
      msg.textContent = `Prüfen fehlgeschlagen: ${err && err.message ? err.message : err}`;
    } finally { busy = false; draw(); }
  };
  const press = (k) => {
    if (k === "cancel") { finish(false); return; }
    if (k === "del") val = val.slice(0, -1);
    else if (k === "ok") { submit(); return; }
    else if (val.length < 8) val += k;
    msg.textContent = "";
    draw();
  };
  const onKey = (ev) => {
    if (/^\d$/.test(ev.key)) press(ev.key);
    else if (ev.key === "Backspace") press("del");
    else if (ev.key === "Enter") press("ok");
    else if (ev.key === "Escape") press("cancel");
    else return;
    ev.preventDefault(); ev.stopPropagation();
  };
  m.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (ev.target === m) { finish(false); return; }
    const b = ev.target.closest("[data-pin]");
    if (b) press(b.dataset.pin);
  });
  window.addEventListener("keydown", onKey, true);
  draw();
  root.appendChild(m);
}

/** Abschnitt „PIN für heikle Aktionen“ im Reiter Alarme. */
function pinSettingsHTML(D) {
  const P = D.pin || {}, set = pinIsSet();
  const tg = (k, label, hint) => `<div class="srow"><span class="lbl">${label}<small>${hint}</small></span><label class="tgl"><input type="checkbox" data-set="pin.${k}" data-bool="1" ${P[k] ? "checked" : ""}><span></span></label></div>`;
  return `<div class="set glass" data-sec="pin"><h2>${icon("mdi:dialpad")}PIN für heikle Aktionen</h2>
    <p class="hint">Am Wandpanel und am Wanddisplay hat jeder Zugriff, auch Besuch und Kinder. Mit einer PIN fragen diese Aktionen vorher nach. Die PIN bleibt in Home Assistant (nur als Prüfsumme) und wird nicht an Browser geschickt; nach fünf Fehlversuchen ist die Eingabe eine Minute gesperrt. Das ist ein Schutz vor versehentlichem oder neugierigem Tippen, kein Ersatz für Benutzerrechte.</p>
    <div class="srow"><span class="lbl">PIN<small>${set ? "gesetzt ✓ – neue eingeben zum Ändern, leer speichern zum Löschen" : "noch keine – 4 bis 8 Ziffern; ohne PIN fragt nichts nach"}</small></span>
      <input class="inp s" type="password" inputmode="numeric" autocomplete="off" maxlength="8" id="hv-pin" placeholder="${set ? "••••" : "PIN"}"><button class="pbtn sm" data-act="s-pin-save">${icon("mdi:content-save-outline")}Speichern</button></div>
    ${tg("door", "Tür öffnen", "Türöffner im Klingelfenster und Schlösser entriegeln")}
    ${tg("disarm", "Alarm aus", `aus ${SECURE.map((k) => MODE_NAME[k]).join(", ")} zurück auf „Zuhause“ (schaltet die Alarmanlage unscharf, wenn gekoppelt)`)}
    ${tg("arm", "Abwesend und Urlaub einschalten", "Nacht fragt nie nach, damit „Gute Nacht“ immer geht")}
    <div class="srow"><span class="lbl">Gilt für<small>Wanddisplays haben kein Tastenfeld: dort sind geschützte Aktionen gesperrt und gehen nur am Panel oder Handy</small></span>
      <select class="inp" data-set="pin.scope"><option value="wall" ${P.scope !== "all" ? "selected" : ""}>Wandpanels und Wanddisplays</option><option value="all" ${P.scope === "all" ? "selected" : ""}>alle Geräte (auch Handy und PC)</option></select></div>
  </div>`;
}

/** Klick „Speichern“ im Abschnitt. */
async function pinSave(p) {
  const inp = p.shadowRoot.getElementById("hv-pin"), v = inp ? inp.value.trim() : "";
  if (v && !/^\d{4,8}$/.test(v)) { p._toast("Die PIN braucht 4 bis 8 Ziffern"); return; }
  try {
    await p._hass.callWS({ type: `${DOMAIN}/pin_set`, pin: v });
    p._toast(v ? "PIN gespeichert" : "PIN gelöscht");
    if (inp) inp.value = "";
  } catch (err) { p._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`); }
}

const PIN_CSS = `
.pinbg{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.6);padding:16px}
.pinpad{width:min(320px,100%);padding:20px 18px 16px;border-radius:22px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.pinpad .mic{--mdc-icon-size:30px;color:var(--hv-warm)}.pinpad .mt{font-size:18px;font-weight:600}.pinpad .mx{font-size:13px;color:var(--hv-dim)}
.pindots{display:flex;gap:10px;min-height:16px;margin:4px 0}.pindots i{width:12px;height:12px;border-radius:50%;border:2px solid var(--hv-dim)}.pindots i.on{background:var(--hv-text);border-color:var(--hv-text)}
.pinmsg{min-height:18px;font-size:13px;color:var(--hv-alert)}
.pinkeys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%}
.pinkey{height:58px;border-radius:16px;border:0;background:var(--hv-surface-2);color:var(--hv-text);font:600 22px/1 inherit;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pinkey:active{transform:scale(.96)}.pinkey.ok{background:var(--hv-accent);color:#fff}.pincancel{margin-top:6px}
.pinpad.shake{animation:pinshake .35s}@keyframes pinshake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`;

export { modeKind, PIN_CSS, pinNeeded, pinOk, pinSave, pinSettingsHTML };
