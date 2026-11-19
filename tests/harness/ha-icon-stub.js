// Ersatz für <ha-icon> im Test (in Home Assistant liefert HA das Element selbst).
let paths = {};
try { paths = await import("./mdi.js"); } catch (e) { /* ohne Symbole */ }
const toKey = (n) => "mdi" + n.replace(/^mdi:/, "").split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
class HaIcon extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._r(); }
  attributeChangedCallback() { this._r(); }
  _r() {
    const d = paths[toKey(this.getAttribute("icon") || "")] || "M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8Z";
    const s = "var(--mdc-icon-size, 24px)";
    this.style.display = "inline-flex";
    this.innerHTML = `<svg viewBox="0 0 24 24" style="width:${s};height:${s};fill:currentColor"><path d="${d}"/></svg>`;
  }
}
customElements.define("ha-icon", HaIcon);
customElements.define("ha-card", class extends HTMLElement { connectedCallback() { this.style.display = "block"; this.style.borderRadius = "16px"; this.style.background = "var(--card-background-color, #1c1f26)"; } });
