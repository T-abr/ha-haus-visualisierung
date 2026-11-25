/* Haus Visualisierung – Karten für eigene Dashboards: haus-raum-card und haus-hausschnitt-card.
 * Geladen erst bei Bedarf über ../karten-loader.js; dessen Hüllen tragen die öffentlichen Namen, die Karten
 * selbst laufen unter eigenen Namen darin. */

import { DOMAIN } from "./version.js";
import { DEFAULT_LAYOUT, esc, withDefaults } from "./grundlagen.js";
import { roomTileHTML } from "./bausteine.js";
import { STYLES } from "./stile.js";
import { HvBase } from "./basis.js";
import { houseHTML } from "./hausschnitt.js";

/* ------------------------------------------------------------------------ */
/*  Karten für eigene Dashboards                                             */
/* ------------------------------------------------------------------------ */
let infoPromise = null;
function getInfo(hass) {
  if (!infoPromise) infoPromise = hass.callWS({ type: `${DOMAIN}/info` }).catch(() => ({ layout: DEFAULT_LAYOUT }));
  return infoPromise;
}

class HvCardBase extends HvBase {
  setConfig(config) {
    this._config = config || {};
    this._dirty = true;
    this._schedule();
  }
  connectedCallback() {
    this.classList.add("card");
    super.connectedCallback();
  }
  set hass(h) {
    const first = !this._hass;
    super.hass = h;
    if (first && h) getInfo(h).then((info) => { this._layout = withDefaults(info.layout); this._dirty = true; this._schedule(); });
  }
  get hass() { return this._hass; }
  _actionExtra(act, t) {
    if (act === "nav" || act === "go") {
      const to = t.dataset.to || "";
      this._navigate(`/haus-visualisierung${to ? `/${to}` : ""}`);
    }
    if (act === "roof") { const l = (this._layout.links || [])[0]; if (l && l.path) this._navigate(l.path); }
  }
  getCardSize() { return 3; }
}

class HausRaumCard extends HvCardBase {
  static getStubConfig(hass) { return { area: Object.keys((hass && hass.areas) || {})[0] || "" }; }
  _render() {
    this._config = this._config || {};
    const a = this._model.areas.get(this._config.area);
    const body = a ? roomTileHTML(a) : `<div class="empty">Bereich „${esc(this._config.area || "")}“ nicht gefunden.</div>`;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card style="padding:0;overflow:hidden;background:none;border:0;box-shadow:none">${body}</ha-card>`;
    this._wire(this.shadowRoot);
  }
  getCardSize() { return 2; }
}

class HausHausschnittCard extends HvCardBase {
  static getStubConfig() { return {}; }
  _render() {
    this._config = this._config || {};
    const L = { ...this._layout };
    if (this._config.show_energy === false) L.header = { auto: false };
    const body = this._model.visibleAreas.length ? houseHTML(this._model, L, this._hass) : `<div class="empty">Keine Bereiche gefunden.</div>`;
    const title = this._config.title ? `<div class="secttitle" style="margin:4px 4px 10px">${esc(this._config.title)}</div>` : "";
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card style="padding:12px">${title}${body}</ha-card>`;
    this._wire(this.shadowRoot);
  }
  getCardSize() { return 8; }
}

if (!customElements.get("haus-raum-card-inhalt")) customElements.define("haus-raum-card-inhalt", HausRaumCard);
if (!customElements.get("haus-hausschnitt-card-inhalt")) customElements.define("haus-hausschnitt-card-inhalt", HausHausschnittCard);

export { HausHausschnittCard, HausRaumCard };
