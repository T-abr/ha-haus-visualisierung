/*
 * Haus Visualisierung – Panel und Karten für Home Assistant
 * Baut sich wie eine Dashboard-Strategy aus Etagen → Bereichen → Geräten auf,
 * hat aber ein eigenes Layout („Hausschnitt“).
 *
 * Einstiegspunkt des Panels: Home Assistant lädt ihn erst beim Öffnen (module_url). Die Karten meldet der
 * kleine karten-loader.js an, den Home Assistant auf jeder Seite lädt.
 */
import { VERSION } from "./modules/version.js";
import { DEFAULT_LAYOUT, hideHaChrome, HV_HA_VARS, themeFrame } from "./modules/grundlagen.js";
import { buildModel, classify } from "./modules/modell.js";
import { evalAlertsAll } from "./modules/warnungen.js";
import { addInterval } from "./modules/wartung.js";
import { formConfig } from "./modules/automationen.js";
import { curveFlow, techCfg } from "./modules/technik.js";
import { absHum, dewPoint, ventAdvice } from "./modules/klima.js";
import { HausVisualisierungPanel } from "./modules/panel.js";
import { modeKind, pinNeeded } from "./modules/pin.js";
import { setupChecks } from "./modules/system.js";
import { withDefaults } from "./modules/grundlagen.js";
import "./karten-loader.js";

if (!customElements.get("haus-visualisierung-panel")) customElements.define("haus-visualisierung-panel", HausVisualisierungPanel);

// Für Tests
window.__HAUS_VIS__ = { VERSION, buildModel, classify, DEFAULT_LAYOUT, hideHaChrome, themeFrame, HV_HA_VARS, evalAlertsAll, techCfg, curveFlow, dewPoint, absHum, ventAdvice, addInterval, formConfig, modeKind, pinNeeded, setupChecks, withDefaults };
