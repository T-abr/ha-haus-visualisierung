/*
 * Haus Visualisierung – Panel und Karten für Home Assistant
 * Baut sich wie eine Dashboard-Strategy aus Etagen → Bereichen → Geräten auf,
 * hat aber ein eigenes Layout („Hausschnitt“).
 *
 * Einstiegspunkt: lädt die Module aus ./modules/ und meldet Panel und Karten an.
 */
import { VERSION } from "./modules/version.js";
import { DEFAULT_LAYOUT, hideHaChrome, HV_HA_VARS, themeFrame } from "./modules/grundlagen.js";
import { buildModel, classify } from "./modules/modell.js";
import { evalAlertsAll, MOLD } from "./modules/warnungen.js";
import { addInterval } from "./modules/wartung.js";
import { curveFlow, techCfg } from "./modules/technik.js";
import { absHum, dewPoint, ventAdvice } from "./modules/klima.js";
import { HausVisualisierungPanel } from "./modules/panel.js";
import { modeKind, pinNeeded } from "./modules/pin.js";
import { setupChecks } from "./modules/system.js";
import { withDefaults } from "./modules/grundlagen.js";
import { HausHausschnittCard, HausRaumCard } from "./modules/karten.js";

if (!window.__HAUS_VIS_LOADED__) {
  window.__HAUS_VIS_LOADED__ = VERSION;
  console.info(
    `%c HAUS VISUALISIERUNG v${VERSION} `,
    "background:#1c2740;color:#ffc457;font-weight:700;border-radius:4px;padding:2px 4px"
  );
}

if (!customElements.get("haus-visualisierung-panel")) customElements.define("haus-visualisierung-panel", HausVisualisierungPanel);
if (!customElements.get("haus-raum-card")) customElements.define("haus-raum-card", HausRaumCard);
if (!customElements.get("haus-hausschnitt-card")) customElements.define("haus-hausschnitt-card", HausHausschnittCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "haus-raum-card")) {
  window.customCards.push(
    { type: "haus-raum-card", name: "Haus Visualisierung – Raum", description: "Raumkachel mit Temperatur, Licht, Rollos und Hinweisen", preview: false },
    { type: "haus-hausschnitt-card", name: "Haus Visualisierung – Hausschnitt", description: "Alle Etagen und Räume als Hausschnitt", preview: false },
  );
}

// Für Tests
window.__HAUS_VIS__ = { VERSION, buildModel, classify, DEFAULT_LAYOUT, hideHaChrome, themeFrame, HV_HA_VARS, evalAlertsAll, techCfg, curveFlow, dewPoint, absHum, ventAdvice, MOLD, addInterval, modeKind, pinNeeded, setupChecks, withDefaults };
