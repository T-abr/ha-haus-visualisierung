/* Haus Visualisierung – Wanddisplays (z. B. 4-Zoll-ESP32-S3 mit ESPHome): Reiter „Displays“ in den Einstellungen.
 * Das Display ist ein Client der Visualisierung: Seiten und Kacheln stehen hier (Layout-Schlüssel „displays“), die
 * Inhalte rechnet das Backend (display.py) und stellt sie je Display als sensor.haus_display_<id> bereit.
 * Schnittstelle: DISPLAY_PROTOKOLL.md; Firmware: Repository ha-haus-display. */

import { entName, esc, icon } from "./grundlagen.js";

/* Muss zu display.py passen (TILES, PAGES, Protokoll) */
const DISPLAY_PROTOCOL = 1;
const DISPLAY_TILES = [["pv_jetzt", "PV jetzt"], ["energie_heute", "Energie heute"], ["klima_mittel", "Raumklima Ø"], ["morgen", "Müll und Termine"],
  ["wetter", "Wetter"], ["meldungen", "Meldungen"], ["geraete", "Haushaltsgeräte"], ["strompreis", "Strompreis"]];
const DISPLAY_PAGES = [["start", "Start"], ["energie", "Energie"], ["klima", "Klima"], ["haus", "Haus"]];
const DEFAULT_TILES = ["pv_jetzt", "energie_heute", "klima_mittel", "morgen"];
const FIRMWARE_URL = "https://github.com/T-abr/ha-haus-display";

const slug = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);

/** Neues Display mit freier Kennung (flur, flur_2 …) */
function newDisplay(list) {
  const ids = new Set((list || []).map((d) => d.id));
  let id = "flur", n = 2;
  while (ids.has(id)) id = `flur_${n++}`;
  return { id, name: n > 2 ? `Flur ${n - 1}` : "Flur", pages: ["start", "energie", "klima", "haus"], tiles: [...DEFAULT_TILES],
    hint: true, bright_day: 80, bright_night: 10, wake: true };
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
  const rows = list.map((d, i) => {
    const eid = `sensor.haus_display_${d.id}`, st = h.states[eid];
    const status = !saved.has(d.id) ? "noch nicht gespeichert" : st ? `${eid} · Protokoll ${esc(st.state)}` : `${eid} fehlt`;
    const pages = DISPLAY_PAGES.map(([k, t]) => `<button class="pbtn sm dpage${(d.pages || []).includes(k) ? " on" : ""}" data-act="s-disp-page" data-i="${i}" data-page="${k}" ${k === "start" ? "disabled" : ""}>${t}</button>`).join("");
    return `<div class="dcard" data-disp="${esc(d.id)}">
      <div class="srow"><span class="lbl">${icon("mdi:tablet-dashboard")} <b>${esc(d.name || d.id)}</b><small>Kennung <code>${esc(d.id)}</code> · ${status}</small></span>
        <button class="sbtn danger" data-act="s-disp-del" data-i="${i}" title="Display entfernen">${icon("mdi:delete-outline")}</button></div>
      <div class="srow"><span class="lbl">Name</span><input class="inp" data-set="displays.${i}.name" data-disp-name="${i}" value="${esc(d.name || "")}" placeholder="Flur"></div>
      <div class="srow"><span class="lbl">Seiten<small>Start ist immer dabei; unten im Dock in dieser Reihenfolge</small></span><span class="dpages">${pages}</span></div>
      <div class="srow dtiles"><span class="lbl">Kacheln auf „Start“<small>bis zu vier; „Entität“ zeigt den Zustand und schaltet Licht, Schalter, Rollo oder Schloss</small></span>
        <div class="dslots">${[0, 1, 2, 3].map((k) => tileSel(d, i, k)).join("")}</div></div>
      <div class="srow"><span class="lbl">Hinweiszeile<small>Alarm, abends „Gute Nacht – … offen“, sonst wichtigste Meldung oder fertiges Gerät</small></span>
        <label class="tgl"><input type="checkbox" data-set="displays.${i}.hint" data-bool="1" ${d.hint !== false ? "checked" : ""}><span></span></label></div>
      <div class="srow"><span class="lbl">Helligkeit Tag / Nacht<small>in %; Nacht gilt im Hausmodus „Nacht“ (0 = aus bis zur Berührung)</small></span>
        <input class="inp s" type="number" min="10" max="100" data-set="displays.${i}.bright_day" data-num="1" value="${d.bright_day ?? 80}">
        <input class="inp s" type="number" min="0" max="100" data-set="displays.${i}.bright_night" data-num="1" value="${d.bright_night ?? 10}"></div>
      <div class="srow"><span class="lbl">Aufwecken bei Alarm<small>neue Alarm-Meldung schaltet das Display hell</small></span>
        <label class="tgl"><input type="checkbox" data-set="displays.${i}.wake" data-bool="1" ${d.wake !== false ? "checked" : ""}><span></span></label></div>
    </div>`;
  }).join("");
  const ents = Object.keys(h.states).filter((e) => /^(light|switch|cover|lock|fan|input_boolean|sensor|binary_sensor)\./.test(e)).sort();
  return `<style>${DISPLAY_CSS}</style><datalist id="dl-all">${ents.map((e) => `<option value="${esc(e)}">${esc(entName(h, e))}</option>`).join("")}</datalist>
    <div class="set glass"><h2>${icon("mdi:tablet-dashboard")}Wanddisplays</h2>
      <p class="hint">Kleine Displays an der Wand, z. B. ein 4-Zoll-ESP32-S3 (480 × 480) mit ESPHome. Das Display zeigt die Inhalte der Visualisierung im gleichen Stil und wird hier eingerichtet; Änderungen wirken nach dem Speichern sofort, ohne neu zu flashen. Je Display gibt es die Entität <code>sensor.haus_display_&lt;kennung&gt;</code> (Protokoll ${DISPLAY_PROTOCOL}). Die Firmware und die Anleitung stehen im Repository <a href="${FIRMWARE_URL}" target="_blank" rel="noreferrer">ha-haus-display</a>; dort die Kennung als <code>display_id</code> eintragen.</p>
      ${rows || '<p class="hint">Noch kein Display eingerichtet.</p>'}
      <div class="srow"><button class="pbtn" data-act="s-disp-add" ${list.length >= 6 ? "disabled" : ""}>${icon("mdi:plus")}Display hinzufügen</button></div>
    </div>`;
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

/** Vor dem Speichern: leere Kacheln und unvollständige Entitäten weglassen */
function displaysForSave(list) {
  return (list || []).map((d) => ({ ...d, tiles: (d.tiles || []).filter((x) => x && x !== "entity:") }));
}

const DISPLAY_CSS = `
.dcard{padding:6px 0 10px;border-top:1px solid var(--hv-line)}.dcard:first-of-type{border-top:0}
.dpages{display:flex;flex-wrap:wrap;gap:6px}.dpage.on{background:var(--hv-accent);color:#06142b}.dpage[disabled]{opacity:.8;cursor:default}
.dtiles{align-items:flex-start}.dslots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:6px;flex:1 1 320px}
.set .hint a{color:var(--hv-accent)}
.dslot{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}.dslot select{flex:1;min-width:0}.dslot .inp.w{flex:1 1 100%}
.dsn{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:var(--hv-surface-2);font-size:12px;color:var(--hv-dim);flex:none}
@media (max-width:600px){.dslots{grid-template-columns:1fr}}
`;

export { DISPLAY_CSS, DISPLAY_PAGES, DISPLAY_PROTOCOL, DISPLAY_TILES, displayInput, displaySettingsHTML, displaysForSave, newDisplay, togglePage };
