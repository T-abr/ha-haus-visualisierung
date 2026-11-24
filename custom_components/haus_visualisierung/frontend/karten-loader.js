/*
 * Haus Visualisierung – kleiner Lader für die Dashboard-Karten.
 *
 * Home Assistant lädt diese Datei auf jeder Seite (add_extra_js_url). Sie meldet nur die Karten
 * haus-raum-card und haus-hausschnitt-card an; der eigentliche Code (modules/karten.js mit Modell,
 * Bausteinen und Stilen) kommt erst, wenn eine Karte wirklich auf einem Dashboard steht.
 * Das Panel selbst lädt Home Assistant beim Öffnen über module_url (haus-visualisierung.js).
 */
import { VERSION } from "./modules/version.js";

let impl = null;
const loadCards = () => impl || (impl = import("./modules/karten.js"));

/* Hülle: nimmt Konfiguration und hass sofort an und reicht beides an die echte Karte weiter, sobald sie geladen ist. */
function lazyCard(tag, cls, size, stub) {
  if (customElements.get(tag)) return;
  customElements.define(tag, class extends HTMLElement {
    static getStubConfig(hass) { return stub(hass); }
    setConfig(config) {
      this._config = config;
      if (this._card) this._card.setConfig(config);
      else this._load();
    }
    set hass(h) {
      this._hass = h;
      if (this._card) this._card.hass = h;
    }
    get hass() { return this._hass; }
    get card() { return this._card || null; }
    getCardSize() { return this._card ? this._card.getCardSize() : size; }
    connectedCallback() {
      this.style.display = "block";
      this._load();
    }
    _load() {
      if (this._loading) return;
      this._loading = loadCards().then((m) => {
        const card = new m[cls]();
        card.setConfig(this._config || {});
        this._card = card;
        this.appendChild(card);
        if (this._hass) card.hass = this._hass;
      }).catch((err) => {
        this._loading = null;
        console.error("Haus Visualisierung: Karte nicht geladen", err);
      });
    }
  });
}

lazyCard("haus-raum-card", "HausRaumCard", 2, (hass) => ({ area: Object.keys((hass && hass.areas) || {})[0] || "" }));
lazyCard("haus-hausschnitt-card", "HausHausschnittCard", 8, () => ({}));

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "haus-raum-card")) {
  window.customCards.push(
    { type: "haus-raum-card", name: "Haus Visualisierung – Raum", description: "Raumkachel mit Temperatur, Licht, Rollos und Hinweisen", preview: false },
    { type: "haus-hausschnitt-card", name: "Haus Visualisierung – Hausschnitt", description: "Alle Etagen und Räume als Hausschnitt", preview: false },
  );
}

if (!window.__HAUS_VIS_LOADED__) {
  window.__HAUS_VIS_LOADED__ = VERSION;
  console.info(
    `%c HAUS VISUALISIERUNG v${VERSION} `,
    "background:#1c2740;color:#ffc457;font-weight:700;border-radius:4px;padding:2px 4px"
  );
}
