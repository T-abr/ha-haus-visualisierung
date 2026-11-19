// Nachgebaute Fremd-Panels (wie Solar/Protect Visualisierung) für den Einbettungstest.
for (const [name, title, eid] of [["solar-test-panel", "Solar Visualisierung", "sensor.growatt_modbus_pv_power"], ["protect-test-panel", "Protect Visualisierung", "camera.g6_entry"]]) {
  customElements.define(name, class extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); this.connects = 0; this.disconnects = 0; this.hassSets = 0; }
    connectedCallback() {
      this.connects++; this._r();
      // Protect-Nachbau verhält sich „unfreundlich“: springt auf eine feste eigene Adresse
      if (this.tagName === "PROTECT-TEST-PANEL" && !(this._route && this._route.path)) {
        history.pushState(null, "", "/protect-visualisierung/live");
        window.dispatchEvent(new CustomEvent("location-changed"));
      }
    }
    disconnectedCallback() { this.disconnects++; }
    set hass(h) { this._hass = h; this.hassSets++; this._r(); }
    set route(r) { this._route = r; this._r(); }
    get route() { return this._route; }
    set narrow(n) { this._narrow = n; this._r(); }
    get narrow() { return this._narrow; }
    _r() {
      if (!this._hass) return;
      const st = this._hass.states[eid];
      this.shadowRoot.innerHTML = `<div style="height:100%;box-sizing:border-box;padding:24px;color:#eef2f8;font-family:system-ui;background:linear-gradient(160deg,#1a2a1f,#0e1a24)">
        <h1 style="margin:0 0 8px;font-weight:400">${title}</h1>
        <div class="val" style="font-size:40px;font-weight:300">${st ? st.state : "–"}</div>
        <div class="route" style="opacity:.6">${this._route ? this._route.prefix + " | " + this._route.path : ""}</div>
        <div class="narrow" style="opacity:.6">narrow: ${!!this.narrow} · panel: ${this.panel ? this.panel.url_path : ""}</div></div>
        ${this.tagName === "PROTECT-TEST-PANEL" ? '<div class="overlay" style="position:fixed;inset:0;pointer-events:none;border:2px solid #63c7ff;box-sizing:border-box"></div>' : ""}`;
    }
  });
}
