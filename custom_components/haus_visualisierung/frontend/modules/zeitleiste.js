/* Haus Visualisierung – Zeitleiste „Was war los?“ (Seite Sicherheit): Türen, Klingel mit Standbild, Bewegung,
 * Hausmodus und Alarme der letzten Tage, nach Tag gruppiert und filterbar.
 * Die Daten rechnet das Backend (zeitleiste.py, Befehl haus_visualisierung/zeitleiste); hier wird nur angezeigt.
 * Abgefragt wird beim Aufbau der Seite (höchstens jede Minute neu), beim Wechsel des Zeitraums und per „Neu laden“;
 * Messwerte lösen kein Neuzeichnen aus. */

import { esc, icon, MODE_ICON, setHidden, setHtml } from "./grundlagen.js";

const TTL = 60 * 1000;
const DAY_ROWS = 30;           // Zeilen je Tag, der Rest aufklappbar
const RANGES = [[1, "Heute"], [3, "3 Tage"], [7, "7 Tage"], [14, "14 Tage"]];
const KINDS = [["alle", "Alle", "mdi:format-list-bulleted"], ["tuer", "Türen", "mdi:door-open"], ["klingel", "Klingel", "mdi:doorbell-video"],
  ["bewegung", "Bewegung", "mdi:motion-sensor"], ["modus", "Hausmodus", "mdi:home-switch-outline"], ["alarm", "Alarme", "mdi:alert-outline"]];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const CACHE = new Map(); // Tage → { at, data, err, loading, gen }
let GEN = 0;                // zählt jede Antwort: Liste nur neu zeichnen, wenn neue Daten oder anderer Filter
const S = { days: 3, kind: "alle" };
try { const v = JSON.parse(localStorage.getItem("hv-zeitleiste") || "{}"); if (RANGES.some(([d]) => d === v.days)) S.days = v.days; if (KINDS.some(([k]) => k === v.kind)) S.kind = v.kind; } catch (err) { /* egal */ }
const remember = () => { try { localStorage.setItem("hv-zeitleiste", JSON.stringify(S)); } catch (err) { /* egal */ } };

const CSS = `
.zl{padding:12px 16px 14px;margin-bottom:16px;min-width:0}
.dense .zl{padding:9px 12px 12px;margin-bottom:12px;border-radius:16px}
.sgrid+.zl,.glass+.zl{margin-top:16px}.dense .sgrid+.zl,.dense .glass+.zl{margin-top:12px}
.zlf{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.zlf .altab b{font-weight:500;color:var(--hv-faint);margin-left:2px}.zlf .altab.on b{color:var(--hv-dim)}
.zlmsg{display:flex;align-items:center;gap:8px;color:var(--hv-dim);font-size:13px;padding:10px 2px}
.zlday+.zlday{margin-top:10px}
.zldh{font-size:12px;color:var(--hv-dim);padding:4px 2px;border-bottom:1px solid var(--hv-line);margin-bottom:2px;display:flex;gap:8px}
.zldh b{color:var(--hv-text);font-weight:600}
.zlr{display:grid;grid-template-columns:44px 28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 2px;font-size:13px}
.zlr+.zlr{border-top:1px solid var(--hv-line)}
.zlt{color:var(--hv-dim);font-variant-numeric:tabular-nums}
.zli{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--hv-surface-2)}
.zli ha-icon{--mdc-icon-size:16px}
.zlx{min-width:0}.zlx b{font-weight:500;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zlx small{display:block;color:var(--hv-dim);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zlr.k-tuer .zli{color:var(--hv-warm)}.zlr.k-klingel .zli{color:var(--hv-cool)}.zlr.k-bewegung .zli{color:var(--hv-dim)}
.zlr.k-modus .zli{color:var(--hv-accent)}.zlr.l-alarm .zli{background:rgba(255,107,91,.2);color:var(--hv-alert)}
.zlr.l-warn .zli{background:rgba(255,196,87,.2);color:var(--hv-warm)}.zlr.l-info .zli{color:var(--hv-cool)}
.zlimg{width:64px;height:40px;object-fit:cover;border-radius:8px;cursor:zoom-in;background:var(--hv-surface-2);display:block}
.zlmore summary{cursor:pointer;color:var(--hv-dim);font-size:12px;padding:6px 2px;list-style:none}
.zlbig{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:16px;cursor:zoom-out}
.zlbig img{max-width:100%;max-height:100%;border-radius:12px}
`;

/** Karte (Gerüst); gefüllt wird sie in updateZl. */
function zlCardHTML() {
  return `<div class="glass zl" data-u="zeitl"><style>${CSS}</style>
    <div class="trh"><span class="trt">${icon("mdi:timeline-clock-outline")}Was war los?</span>
      <span class="rng" role="group" aria-label="Zeitraum">${RANGES.map(([d, t]) => `<button class="altab sm" data-act="zl-days" data-d="${d}" aria-pressed="false"><span>${t}</span></button>`).join("")}</span>
      <button class="pbtn sm" data-act="zl-reload" title="Neu laden" aria-label="Neu laden">${icon("mdi:refresh")}</button></div>
    <div class="zlf" role="group" aria-label="Filter">${KINDS.map(([k, t, ic]) => `<button class="altab sm" data-act="zl-kind" data-k="${k}" aria-pressed="false">${icon(ic)}<span>${t}</span><b></b></button>`).join("")}</div>
    <div class="zlmsg">${icon("mdi:loading", "spin")}Lade Zeitleiste …</div>
    <div class="zlbody"></div><div class="zlbigw"></div></div>`;
}

function zlLoad(h, days, force, cb) {
  let r = CACHE.get(days);
  const now = Date.now();
  if ((!r || force || (!r.loading && now - r.at > TTL)) && h && h.callWS) {
    const prev = r && r.data;
    r = { at: now, data: prev || null, err: null, loading: true };
    CACHE.set(days, r);
    h.callWS({ type: "haus_visualisierung/zeitleiste", days })
      .then((res) => { r.data = res || { events: [] }; r.err = null; })
      .catch((e) => { r.err = (e && e.message) || "Fehler"; })
      .finally(() => { r.loading = false; r.at = Date.now(); r.gen = ++GEN; cb(); });
  }
  return r || { loading: false, data: null, err: "nicht verbunden" };
}

const hhmm = (ts) => new Date(ts * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
function dur(s) {
  if (s < 60) return `${Math.max(1, Math.round(s))} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const hh = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60);
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
function dayKey(ts) { const d = new Date(ts * 1000); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(ts, now = new Date()) {
  const d = new Date(ts * 1000), t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  const date = `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`;
  return diff === 0 ? ["Heute", date] : diff === 1 ? ["Gestern", date] : [date, ""];
}

/** Eine Zeile: [Klassen, Symbol, Titel, Unterzeile]. */
function rowOf(e, h) {
  const where = (x) => x.area || "";
  switch (e.typ) {
    case "tuer": {
      const ic = e.lock ? (e.text === "abgeschlossen" ? "mdi:lock" : "mdi:lock-open-variant") : "mdi:door-open";
      return ["k-tuer", ic, `${e.name} ${e.text}`, [where(e), e.dur !== undefined ? `${dur(e.dur)} offen` : (e.lock ? "" : "noch offen")].filter(Boolean).join(" · ")];
    }
    case "bewegung":
      return ["k-bewegung", "mdi:motion-sensor", `Bewegung: ${e.name}`, [where(e), e.n > 1 ? `${e.n}× bis ${hhmm(e.bis)}` : ""].filter(Boolean).join(" · ")];
    case "klingel": {
      const cam = e.cam && h && h.states[e.cam];
      return ["k-klingel", "mdi:doorbell-video", e.text || "Es hat geklingelt", cam ? (cam.attributes.friendly_name || e.cam) : ""];
    }
    case "modus":
      return ["k-modus", MODE_ICON[e.mode] || "mdi:home-switch-outline", e.text, e.user ? `von ${e.user}` : ""];
    case "alarm": {
      const lv = e.level || "warn";
      if (e.art === "quittiert") return [`k-alarm l-info`, "mdi:check-circle-outline", `Quittiert: ${e.text}`, e.user ? `von ${e.user}` : ""];
      if (e.art === "eskaliert") return [`k-alarm l-${lv}`, "mdi:alert-octagon-outline", `Eskaliert: ${e.text}`, "keine Reaktion"];
      if (e.art === "hinweis") return ["k-alarm l-warn", "mdi:information-outline", e.text, ""];
      return [`k-alarm l-${lv}`, lv === "alarm" ? "mdi:alarm-light-outline" : lv === "info" ? "mdi:information-outline" : "mdi:alert-outline", e.text, lv === "alarm" ? "Alarm" : lv === "info" ? "Hinweis" : "Warnung"];
    }
    default: return ["", "mdi:circle-small", e.text || "", ""];
  }
}

function rowHTML(e, h) {
  const [cls, ic, title, sub] = rowOf(e, h);
  const img = e.bild ? `<img class="zlimg" loading="lazy" alt="Standbild" src="${esc(e.bild)}" data-act="zl-img" data-src="${esc(e.bild)}">` : "<span></span>";
  return `<div class="zlr ${cls}" data-k="${esc(e.typ)}"><span class="zlt">${hhmm(e.ts)}</span><span class="zli">${icon(ic)}</span>
    <span class="zlx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${img}</div>`;
}

/** Liste nach Tagen (neueste zuerst). */
function zlBodyHTML(events, h, now = new Date()) {
  const days = [];
  for (const e of events) {
    const k = dayKey(e.ts);
    if (!days.length || days[days.length - 1].k !== k) days.push({ k, ts: e.ts, list: [] });
    days[days.length - 1].list.push(e);
  }
  return days.map((d) => {
    const [a, b] = dayLabel(d.ts, now);
    const rows = d.list.slice(0, DAY_ROWS).map((e) => rowHTML(e, h)).join("");
    const more = d.list.length > DAY_ROWS ? `<details class="zlmore"><summary>${d.list.length - DAY_ROWS} weitere anzeigen</summary>${d.list.slice(DAY_ROWS).map((e) => rowHTML(e, h)).join("")}</details>` : "";
    return `<div class="zlday"><div class="zldh"><b>${a}</b>${b ? `<span>${b}</span>` : ""}<span>· ${d.list.length} ${d.list.length === 1 ? "Ereignis" : "Ereignisse"}</span></div>${rows}${more}</div>`;
  }).join("");
}

function updateZl(el, ctx, force = false) {
  const h = ctx._hass;
  el.querySelectorAll('[data-act="zl-days"]').forEach((b) => { const on = Number(b.dataset.d) === S.days; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const again = () => { if (el.isConnected) updateZl(el, ctx); };
  const r = zlLoad(h, S.days, force, again);
  const msg = el.querySelector(".zlmsg"), body = el.querySelector(".zlbody");
  const all = (r.data && r.data.events) || [];
  const count = (k) => (k === "alle" ? all.length : all.filter((e) => e.typ === k).length);
  el.querySelectorAll('[data-act="zl-kind"]').forEach((b) => {
    const on = b.dataset.k === S.kind; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
    const bb = b.querySelector("b"); if (bb) bb.textContent = r.data ? String(count(b.dataset.k)) : "";
  });
  if (!r.data) {
    setHidden(msg, false);
    setHtml(msg, r.loading ? `${icon("mdi:loading", "spin")}Lade Zeitleiste …` : `${icon("mdi:timeline-alert-outline")}Zeitleiste nicht verfügbar (${esc(r.err || "")}).`);
    setHtml(body, "");
    return;
  }
  const list = S.kind === "alle" ? all : all.filter((e) => e.typ === S.kind);
  const key = `${r.gen}|${S.kind}`;
  const note = r.data.recorder === false ? "Ohne Recorder nur Klingel, Hausmodus und Alarme." : "";
  if (!list.length) {
    setHidden(msg, false);
    setHtml(msg, `${icon("mdi:sleep")}${S.kind === "alle" ? "Nichts los in diesem Zeitraum." : "Nichts davon in diesem Zeitraum."} ${esc(note)}`);
    setHtml(body, "");
    el._zl = key;
    return;
  }
  setHidden(msg, !note);
  if (note) setHtml(msg, `${icon("mdi:information-outline")}${esc(note)}`);
  if (el._zl !== key) { setHtml(body, zlBodyHTML(list, h)); el._zl = key; }
}

/** Aktionen der Karte (panel-aktionen.js). */
function zlAction(act, t, ctx) {
  const el = t.closest('[data-u="zeitl"]');
  if (!el) return;
  if (act === "zl-days") { S.days = Number(t.dataset.d) || 3; remember(); updateZl(el, ctx); }
  else if (act === "zl-kind") { S.kind = t.dataset.k || "alle"; remember(); updateZl(el, ctx); }
  else if (act === "zl-reload") { el._zl = ""; updateZl(el, ctx, true); }
  else if (act === "zl-img") setHtml(el.querySelector(".zlbigw"), `<div class="zlbig" data-act="zl-close" role="dialog" aria-label="Standbild"><img alt="Standbild" src="${esc(t.dataset.src)}"></div>`);
  else if (act === "zl-close") setHtml(el.querySelector(".zlbigw"), "");
}

const zlCard = () => zlCardHTML();

export { dayLabel, zlAction, zlBodyHTML, zlCard, updateZl };
