/* Haus Visualisierung – Übersicht der Einstellungen: Abschnitte auf- und zuklappen (Zustand je Gerät), Kurzinfo und
 * Markierungen in der Überschrift (ungespeichert, Einrichtungs-Check), lange Hinweise kürzen, „Erweitert“ und die Suche
 * über alle Reiter. Arbeitet auf dem fertigen HTML der Reiter: Ein Abschnitt ist jedes `<div class="set glass…"><h2>`. */

import { esc, icon, NAV } from "./grundlagen.js";
import { ALARMS } from "./warnungen.js";
import { termCals } from "./termine.js";
import { applList } from "./geraete.js";
import { setupChecks } from "./system.js";

const UML = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
const norm = (s) => String(s).toLowerCase().replace(/[äöüß]/g, (c) => UML[c]);
const plain = (html) => String(html).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const noInstant = (h2) => String(h2).replace(/<span class="instant"[\s\S]*?<\/span>/g, "");
/** Schlüssel eines Abschnitts aus seiner Überschrift, z. B. „Etagen & Bereiche“ → etagen-bereiche */
const secKey = (h2) => norm(plain(noInstant(h2))).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SEC_RE = /^<div class="set glass([^"]*)"([^>]*)><h2>([\s\S]*?)<\/h2>/;
const splitSecs = (html) => html.split(/(?=<div class="set glass)/);

/** Zeilen, die selten gebraucht werden, eingeklappt unter „Erweitert“ (offen bleibt, was man geöffnet hat). */
const advanced = (rows) => (rows.trim() ? `<details class="sadv"><summary data-act="s-adv">${icon("mdi:tune-variant")}Erweitert${icon("mdi:chevron-down", "chev")}</summary>${rows}</details>` : "");

/* ---------- Was je Abschnitt gespeichert wird (für den Punkt „ungespeichert“) ---------- */
const omit = (o, ks) => { const r = { ...(o || {}) }; ks.forEach((k) => delete r[k]); return r; };
const SEC_DATA = {
  "etagen-bereiche": (D) => [D.area_order, D.hidden_areas, D.floor_order, D.outdoor_floors, D.pins],
  favoriten: (D) => D.favorites,
  energie: (D) => [D.header, D.energy],
  "vorhersage-und-pv-prognose": (D) => D.forecast,
  strompreis: (D) => D.price,
  wallbox: (D) => D.wallbox,
  heizung: (D) => D.heating,
  haushaltsgeraete: (D) => D.appliances,
  beschattung: (D) => D.shading,
  wetterwarnungen: (D) => D.weather_alerts,
  wartungsplaner: (D) => D.maintenance,
  hausmodus: (D) => omit(D.house_mode, ["check", "check_devices"]),
  "gute-nacht-und-verlassen-check": (D) => [(D.house_mode || {}).check, (D.house_mode || {}).check_devices],
  "pin-fuer-heikle-aktionen": (D) => D.pin,
  "anwesenheits-simulation": (D) => D.presence_sim,
  warnungen: (D) => D.alerts,
  "eskalation-und-aktionen": (D) => [D.escalation, D.alarm_actions],
  "push-benachrichtigungen": (D) => D.push,
  klingel: (D) => D.doorbell,
  wandpanel: (D) => [D.wallpanel, (D.termine || {}).saver],
  wanddisplays: (D) => D.displays,
  aussehen: (D) => [D.density, D.header_style, D.overview_style, D.glass],
  "startseite-und-inhalte": (D) => [D.start_view, D.show_trends, D.show_energy_sensors, D.show_other, D.confirm_quick],
  "kameras-und-batterien": (D) => [D.camera_interval, D.battery_critical, D.battery_low, D.hide_labels],
  "muellabfuhr-und-termine": (D) => D.termine,
  verknuepfungen: (D) => D.links,
};
function secDirty(p, k) {
  const f = SEC_DATA[k], D = p._draft, B = p._draftBase || p._layout;
  return !!(f && D && B && p._dirtySettings && JSON.stringify(f(D) ?? null) !== JSON.stringify(f(B) ?? null));
}

/* ---------- Kurzinfo in der Überschrift ---------- */
const OVERVIEW = { auto: "automatisch", haus: "Hausschnitt", cockpit: "Cockpit", spalten: "Etagen-Spalten", fokus: "Aktiv-Fokus" };
function secSummary(k, p, D, checks) {
  const h = p._hass, off = (o) => !!o && o.enabled === false;
  const n = (x, one, many) => (x ? `${x} ${x === 1 ? one : many}` : `keine ${many}`);
  switch (k) {
    case "etagen-bereiche": {
      const hid = (D.hidden_areas || []).length, pins = Object.values(D.pins || {}).reduce((s, l) => s + (l || []).length, 0);
      return [hid ? `${hid} ausgeblendet` : "alle sichtbar", pins && n(pins, "Pin", "Pins")].filter(Boolean).join(" · ");
    }
    case "favoriten": return (D.favorites || []).length ? n(D.favorites.length, "Favorit", "Favoriten") : "keine";
    case "energie": {
      const c = ["pv", "battery", "power", "grid"].filter((x) => (D.header || {})[x]).length;
      return c ? `${c} von 4 Sensoren${off(D.energy) ? " · Seite aus" : ""}` : "nicht eingerichtet";
    }
    case "vorhersage-und-pv-prognose": return off(D.forecast) ? "aus" : (D.forecast || {}).solar === false ? "an, ohne Solarprognose" : "an";
    case "strompreis": {
      const P = D.price || {}, pc = p._model && p._model.price;
      if (P.use_sensor !== false && P.sensor) return "eigener Preissensor";
      if (P.use_sensor !== false && pc && pc.sensor) return "Preissensor automatisch";
      return `fester Preis ${String(P.fixed_ct ?? "").replace(".", ",")} ct/kWh`;
    }
    case "wallbox": case "heizung": {
      const T = p._model && p._model.tech;
      if (off(k === "wallbox" ? D.wallbox : D.heating)) return "aus";
      return T && T[k === "wallbox" ? "wb" : "heat"] ? "eingerichtet" : "nicht gefunden";
    }
    case "haushaltsgeraete": return off(D.appliances) ? "aus" : n(applList(h, D).length, "Gerät", "Geräte");
    case "beschattung": return off(D.shading) ? "aus" : "an";
    case "wetterwarnungen": return off(D.weather_alerts) ? "aus" : "an";
    case "wartungsplaner": {
      const M = D.maintenance || {};
      return off(M) ? "aus" : (M.tasks || []).length ? n(M.tasks.length, "Aufgabe", "Aufgaben") : "keine Aufgaben";
    }
    case "hausmodus": {
      const H = D.house_mode || {};
      if (off(H)) return "aus";
      return [H.auto_away && "Abwesend automatisch", H.auto_night && `Nacht ab ${H.night_start}`, H.alarmo_sync && "mit Alarmanlage"].filter(Boolean).join(" · ") || "nur von Hand";
    }
    case "gute-nacht-und-verlassen-check": {
      const H = D.house_mode || {}, l = H.check_devices || [];
      return H.check === false ? "aus" : `an${l.length ? ` · ${n(l.length, "weiteres Gerät", "weitere Geräte")}` : ""}`;
    }
    case "pin-fuer-heikle-aktionen": return ALARMS && ALARMS.mode && ALARMS.mode.pin ? "PIN gesetzt" : "keine PIN";
    case "anwesenheits-simulation": { const S = D.presence_sim || {}; return S.enabled ? `an · ${n((S.entities || []).length, "Gerät", "Geräte")}` : "aus"; }
    case "warnungen": {
      const A = D.alerts || {}, B = A.builtin || {}, r = (A.rules || []).length;
      return `${Object.values(B).filter(Boolean).length} von ${Object.keys(B).length} festen Regeln${r ? ` · ${r} eigene` : ""}`;
    }
    case "eskalation-und-aktionen": {
      const E = D.escalation || {}, a = (D.alarm_actions || []).length;
      return [E.enabled ? `Eskalation nach ${E.minutes} min` : "keine Eskalation", a && n(a, "Aktion", "Aktionen")].filter(Boolean).join(" · ");
    }
    case "push-benachrichtigungen": { const P = D.push || {}; return off(P) ? "aus" : (P.targets || []).length ? n(P.targets.length, "Empfänger", "Empfänger") : "alle Handys"; }
    case "klingel": return (D.doorbell || {}).enabled ? "an" : "aus";
    case "wandpanel": {
      const W = D.wallpanel || {};
      if (p._wallIsOn && p._wallIsOn()) return "dieses Gerät ist ein Wandpanel";
      return W.saver_min ? `Bildschirmschoner nach ${W.saver_min} min` : "ohne Bildschirmschoner";
    }
    case "wanddisplays": return (D.displays || []).length ? n(D.displays.length, "Display", "Displays") : "keins eingerichtet";
    case "aussehen": return D.density === "komfort" ? "Komfort" : `Kompakt · Übersicht ${OVERVIEW[D.overview_style || "auto"] || ""}`;
    case "startseite-und-inhalte": {
      const v = [["overview", "Übersicht"], ...NAV.slice(1)].find(([x]) => x === D.start_view);
      return `Start: ${v ? v[1] : "Übersicht"}`;
    }
    case "kameras-und-batterien": return `Kamera alle ${D.camera_interval} s · Batterie ${D.battery_critical} / ${D.battery_low} %`;
    case "muellabfuhr-und-termine": return off(D.termine) ? "aus" : n(termCals(h, D).length, "Kalender", "Kalender");
    case "verknuepfungen": return (D.links || []).length ? n(D.links.length, "Verknüpfung", "Verknüpfungen") : "keine";
    case "einrichtungs-check": return checks.length ? `${n(checks.length, "Punkt", "Punkte")} zum Prüfen` : "alles eingerichtet";
    case "sicherungen": return p._bk && p._bk.items ? n(p._bk.items.length, "Sicherung", "Sicherungen") : "";
    default: return "";
  }
}

/* ---------- Lange Hinweise: erster Satz sichtbar, der Rest hinter „Mehr …“ ---------- */
const ABBR = /(?:^|[\s(])(?:bzw|ca|evtl|ggf|inkl|max|min|Nr|usw|etc|[A-Za-zÄÖÜäöü])$/;
function splitHint(html) {
  if (plain(html).length < 170) return null;
  let depth = 0;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === "<") {
      const end = html.indexOf(">", i);
      if (end < 0) return null;
      const tag = html.slice(i, end + 1);
      if (tag[1] === "/") depth--;
      else if (!/^<(br|img|input|wbr)\b/i.test(tag) && !tag.endsWith("/>")) depth++;
      i = end;
      continue;
    }
    if (depth || !".!?".includes(c) || html[i + 1] !== " " || !/[A-ZÄÖÜ„"(0-9]/.test(html[i + 2] || "")) continue;
    if (ABBR.test(html.slice(Math.max(0, i - 6), i))) continue;
    const first = html.slice(0, i + 1), rest = html.slice(i + 2);
    if (plain(first).length < 25) continue;
    return plain(rest).length >= 40 ? [first, rest] : null;
  }
  return null;
}

/* ---------- Zustand: welche Abschnitte offen sind (je Gerät) ---------- */
function openSet(p) {
  if (!p._secOpen) {
    let l = [];
    try { l = JSON.parse(localStorage.getItem("hv-set-open") || "[]"); } catch (err) { /* egal */ }
    p._secOpen = new Set(Array.isArray(l) ? l : []);
  }
  return p._secOpen;
}
function saveOpen(p) {
  try { localStorage.setItem("hv-set-open", JSON.stringify([...openSet(p)])); } catch (err) { /* egal */ }
}

/** Reiter-HTML aufbereiten: Abschnitte klappbar, Kurzinfo, Markierungen, Hinweise gekürzt. Liefert auch die Überschriften. */
function sectionize(p, body, D) {
  const open = openSet(p), adv = p._advOpen || (p._advOpen = new Set());
  const checks = setupChecks(p._hass, p._layout || D), marks = new Map();
  for (const c of checks) for (const k of [].concat(c.sec || [])) {
    const w = marks.get(k) || { lvl: "info", t: [] };
    if (c.lvl === "warn") w.lvl = "warn";
    w.t.push(c.title);
    marks.set(k, w);
  }
  const jumps = [];
  const html = splitSecs(body).map((chunk) => {
    const m = chunk.match(SEC_RE);
    if (!m) return chunk;
    const [all, cls, attrs, h2] = m, k = secKey(h2), fixed = /\bdwiz\b/.test(cls);
    jumps.push(h2);
    const isOpen = fixed || open.has(k), w = marks.get(k), sum = fixed ? "" : secSummary(k, p, D, checks);
    const head = fixed ? `<h2>${h2}</h2>`
      : `<h2><button class="shd" data-act="s-sec" aria-expanded="${isOpen}">${h2}<span class="ssum">${esc(sum)}</span><i class="sdot" title="Ungespeicherte Änderungen"></i>${w ? `<span class="smark ${w.lvl}" title="Einrichtungs-Check: ${esc(w.t.join(" · "))}">${icon(w.lvl === "warn" ? "mdi:alert-outline" : "mdi:information-outline")}</span>` : ""}${icon("mdi:chevron-down", "chev")}</button></h2>`;
    const rest = chunk.slice(all.length)
      .replace(/<details class="sadv">/g, `<details class="sadv"${adv.has(k) ? " open" : ""}>`)
      .replace(/<p class="hint"([^>]*)>([\s\S]*?)<\/p>/g, (a, at, txt) => {
        const s = splitHint(txt);
        return s ? `<p class="hint hlong"${at}>${s[0]} <span class="hrest">${s[1]}</span> <button class="hmore" data-act="s-more">Mehr …</button></p>` : a;
      });
    return `<div class="set glass${cls}${isOpen ? "" : " zu"}${secDirty(p, k) ? " dirty" : ""}"${attrs} data-jump="${jumps.length - 1}" data-sk="${k}">${head}${rest}`;
  }).join("");
  return { html, jumps };
}

/** Knopf „Alle auf-/zuklappen“: zeigt, was ein Tipp tun würde. */
const allLabel = (anyClosed) => `${icon(anyClosed ? "mdi:unfold-more-horizontal" : "mdi:unfold-less-horizontal")}${anyClosed ? "Alle aufklappen" : "Alle zuklappen"}`;
const foldable = (root) => [...root.querySelectorAll(".set[data-sk]")].filter((s) => s.querySelector(":scope > h2 > .shd"));
function updAll(p) {
  const b = p.shadowRoot.querySelector('[data-act="s-all"]');
  if (b) b.innerHTML = allLabel(foldable(p.shadowRoot).some((s) => s.classList.contains("zu")));
}
function toggleSec(p, sec, on) {
  const k = sec && sec.dataset.sk;
  if (!k || !sec.querySelector(":scope > h2 > .shd")) return;
  const want = on ?? sec.classList.contains("zu");
  sec.classList.toggle("zu", !want);
  sec.querySelector(":scope > h2 > .shd").setAttribute("aria-expanded", String(want));
  if (want) openSet(p).add(k); else openSet(p).delete(k);
}
/** Abschnitt öffnen (Sprungleiste, Suche). */
function openSec(p, sec) { toggleSec(p, sec, true); saveOpen(p); updAll(p); }

/** Punkte „ungespeichert“ an Abschnitten und Reitern nachziehen, ohne die Seite neu aufzubauen. */
function markDirty(p, tabDirty) {
  const root = p.shadowRoot;
  root.querySelectorAll(".set[data-sk]").forEach((s) => s.classList.toggle("dirty", secDirty(p, s.dataset.sk)));
  if (tabDirty) root.querySelectorAll(".stab[data-tab]").forEach((b) => b.classList.toggle("dirty", tabDirty(b.dataset.tab)));
}

/* ---------- Suche über alle Reiter ---------- */
/** Alle Überschriften und Zeilen aller Reiter; wird beim Start einer Suche einmal erstellt. */
function searchIndex(p, tabs) {
  if (p._setIdx) return p._setIdx;
  // Beim Erstellen nichts nachladen (Push-Dienste, Sicherungen): das würde die Seite während des Tippens neu aufbauen
  const pl = p._pushLoading, bk = p._bk;
  p._pushLoading = true;
  if (bk === undefined) p._bk = null;
  const idx = [], seen = new Set();
  const add = (e) => { const id = `${e.tab}|${e.sk}|${e.label}`; if (!seen.has(id)) { seen.add(id); idx.push({ ...e, hay: norm(`${e.title} ${e.label} ${e.more || ""}`) }); } };
  try {
    for (const [tab, tname] of tabs) {
      for (const chunk of splitSecs(p._setBody(tab))) {
        const m = chunk.match(SEC_RE);
        if (!m) continue;
        const sk = secKey(m[3]), title = plain(noInstant(m[3]));
        add({ tab, tname, sk, title, label: "" });
        for (const r of chunk.matchAll(/<span class="lbl">([\s\S]*?)(?=<small>|<span|<\/span>)(?:<small>([\s\S]*?)<\/small>)?/g)) {
          const label = plain(r[1]);
          if (label) add({ tab, tname, sk, title, label, more: plain(r[2] || "") });
        }
        for (const r of chunk.matchAll(/<div class="fl-title">([^<]+)/g)) add({ tab, tname, sk, title, label: "", more: plain(r[1]) });
      }
    }
  } finally {
    p._pushLoading = pl;
    if (bk === undefined) p._bk = undefined;
  }
  p._setIdx = idx;
  return idx;
}

function searchHTML(p, q, tabs) {
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.join("").length < 2) return "";
  const hits = searchIndex(p, tabs).filter((e) => words.every((w) => e.hay.includes(w)));
  // zuerst der ganze Suchtext im Namen der Einstellung, dann alle Wörter im Namen, dann Überschrift oder Erklärung
  const whole = norm(q).trim().replace(/\s+/g, " ");
  const score = (e) => { const n = norm(e.label || e.title); return n.includes(whole) ? 0 : words.every((w) => n.includes(w)) ? 1 : 2; };
  hits.sort((a, b) => score(a) - score(b));
  if (!hits.length) return '<p class="hint snone">Nichts gefunden.</p>';
  return hits.slice(0, 10).map((e) => `<button class="sfind" data-act="s-find" data-tab="${e.tab}" data-sk="${esc(e.sk)}" data-lbl="${esc(e.label)}"><b>${esc(e.label || e.title)}</b><small>${esc(e.tname)} › ${esc(e.title)}</small></button>`).join("")
    + (hits.length > 10 ? `<p class="hint snone">… und ${hits.length - 10} weitere – genauer suchen</p>` : "");
}

/** Text des Namens einer Zeile (ohne Erklärung und „wirkt sofort“). */
function lblText(el) {
  let s = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 1 && (n.tagName === "SMALL" || n.tagName === "SPAN")) break;
    s += n.textContent;
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Treffer der Suche: Reiter wählen, Abschnitt (und ggf. „Erweitert“) öffnen, Zeile hervorheben. */
function findGo(p, t) {
  const { tab, sk, lbl } = t.dataset;
  p._setTabSel = tab;
  try { localStorage.setItem("hv-settings-tab", tab); } catch (err) { /* egal */ }
  openSet(p).add(sk); saveOpen(p);
  p._setQuery = "";
  p._dirty = true; p._flush();
  const sec = p.shadowRoot.querySelector(`.set[data-sk="${sk}"]`);
  if (!sec) return;
  const row = lbl ? [...sec.querySelectorAll(".srow")].find((r) => { const l = r.querySelector(".lbl"); return l && lblText(l) === lbl; }) : null;
  const d = row && row.closest("details.sadv");
  if (d && !d.open) { d.open = true; (p._advOpen || (p._advOpen = new Set())).add(sk); }
  const target = row || sec;
  target.scrollIntoView({ block: row ? "center" : "start" });
  target.classList.add("hit");
  setTimeout(() => target.classList.remove("hit"), 2200);
}

/** Tipps auf Abschnitts-Überschriften, „Alle“, „Erweitert“, „Mehr …“ und Suchtreffer. true = erledigt. */
function settingsNavAction(p, act, t) {
  switch (act) {
    case "s-sec": toggleSec(p, t.closest(".set")); saveOpen(p); updAll(p); return true;
    case "s-all": {
      const secs = foldable(p.shadowRoot), anyClosed = secs.some((s) => s.classList.contains("zu"));
      secs.forEach((s) => toggleSec(p, s, anyClosed));
      saveOpen(p); updAll(p);
      return true;
    }
    case "s-adv": {
      // der Browser klappt <details> erst nach dem Klick um
      const d = t.closest("details"), sec = t.closest(".set[data-sk]"), s = p._advOpen || (p._advOpen = new Set());
      if (d && sec) { if (d.open) s.delete(sec.dataset.sk); else s.add(sec.dataset.sk); }
      return true;
    }
    case "s-more": {
      const hint = t.closest(".hint"), on = hint.classList.toggle("open");
      t.textContent = on ? "Weniger" : "Mehr …";
      return true;
    }
    case "s-find": findGo(p, t); return true;
    default: return false;
  }
}

export { advanced, allLabel, markDirty, openSec, searchHTML, secKey, sectionize, settingsNavAction };
