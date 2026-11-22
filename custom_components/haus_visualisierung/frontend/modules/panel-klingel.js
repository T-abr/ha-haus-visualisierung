/* Haus Visualisierung – Klingel-Overlay: Kamerabild, Tür öffnen, Aktionen beim Klingeln.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { dc, dom, entName, esc, icon, setText } from "./grundlagen.js";

const KlingelMixin = (Base) => class extends Base {
  /* ---------- Klingel-Overlay ---------- */
  _bellEntity() {
    const h = this._hass, cfg = this._layout.doorbell || {};
    if (cfg.entity) return h.states[cfg.entity] ? cfg.entity : null;
    if (this._bellAuto !== undefined && this._bellAutoFor === h.entities) return this._bellAuto;
    const all = Object.values(h.states);
    const pick = all.find((st) => dom(st.entity_id) === "event" && dc(st) === "doorbell")
      || all.find((st) => ["event", "binary_sensor"].includes(dom(st.entity_id)) && /(doorbell|klingel)/i.test(st.entity_id));
    this._bellAutoFor = h.entities;
    this._bellAuto = pick ? pick.entity_id : null;
    return this._bellAuto;
  }

  _bellCamera() {
    const h = this._hass, cfg = this._layout.doorbell || {};
    if (cfg.camera && h.states[cfg.camera]) return cfg.camera;
    const bell = this._bellEntity();
    const dev = bell && h.entities && h.entities[bell] && h.entities[bell].device_id;
    const cams = Object.keys(h.states).filter((e) => e.startsWith("camera."));
    const pref = (list) => list.find((e) => !/(paket|package)/i.test(e)) || list[0];
    if (dev) {
      const same = cams.filter((e) => h.entities[e] && h.entities[e].device_id === dev);
      if (same.length) return pref(same);
    }
    return pref(cams.filter((e) => /(entry|doorbell|klingel|haust)/i.test(e))) || cams[0] || null;
  }

  _showBell(test = false, override = null) {
    const h = this._hass, cfg = override || this._layout.doorbell || {};
    const cam = this._bellCamera();
    if (this._bell) {                       // klingelt erneut, während das Overlay offen ist
      this._bell.left = cfg.timeout || 60;
      setText(this._bell.el, ".bt", "Es klingelt erneut");
      setText(this._bell.el, ".bs", `${cam ? entName(h, cam) : "Haustür"} · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
      this._bell.el.classList.remove("again"); void this._bell.el.offsetWidth; this._bell.el.classList.add("again");
      return;
    }
    // Klingel weckt das Wandpanel
    this._saverHide();
    this._wallActive = Date.now();
    this._closeConfirm(false);
    const lock = cfg.lock && h.states[cfg.lock] ? cfg.lock : "";
    const protect = (this._layout.links || []).find((l) => /protect|kamera|camera/i.test(`${l.path} ${l.title}`));
    const el = document.createElement("div");
    el.className = "bellbg";
    el.innerHTML = `<div class="bell glass" role="dialog" aria-modal="true">
      <div class="bhead"><span class="bic">${icon("mdi:doorbell-video")}</span>
        <div><div class="bt">${test ? "Test: Es klingelt" : "Es klingelt"}</div><div class="bs">${esc(cam ? entName(h, cam) : "Keine Kamera gefunden")} · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</div></div>
        <span class="sp"></span><span class="bcount"></span>
        <button class="iconbtn" data-act="bell-close" title="Schließen">${icon("mdi:close")}</button></div>
      <div class="bcam">${cam ? `<img class="bimg" alt="">` : `<div class="bnone">${icon("mdi:cctv-off")}Unter Einstellungen → Klingel eine Kamera wählen</div>`}<div class="blive"></div></div>
      <div class="bacts">
        ${cam ? `<button class="pbtn" data-act="bell-live">${icon("mdi:video")}<span>Live</span></button>` : ""}
        ${protect ? `<button class="pbtn" data-act="bell-protect" data-path="${esc(protect.path)}">${icon(protect.icon || "mdi:cctv")}${esc(protect.title || "Kameras")} öffnen</button>` : ""}
        ${lock ? `<button class="pbtn bunlock" data-act="bell-unlock">${icon("mdi:lock-open-variant")}<span>Tür öffnen</span></button>` : ""}
        <span class="sp"></span>
        <button class="pbtn primary" data-act="bell-close">Schließen</button>
      </div></div>`;
    el.addEventListener("click", (ev) => { if (ev.target === el) this._closeBell(); });
    (this.shadowRoot.querySelector(".app") || this.shadowRoot).appendChild(el);
    this._bell = { el, cam, lock, pulse: cfg.pulse ?? 2, left: cfg.timeout || 60, hold: false };
    this._bellKey = (ev) => { if (ev.key === "Escape") this._closeBell(); };
    window.addEventListener("keydown", this._bellKey);
    this._bellSnap();
    this._bellTimer = setInterval(() => {
      const b = this._bell;
      if (!b) return;
      if (!b.live && !document.hidden) this._bellSnap();
      if (b.hold) { setText(b.el, ".bcount", ""); return; }
      b.left -= 1;
      setText(b.el, ".bcount", `schließt in ${b.left} s`);
      if (b.left <= 0) this._closeBell();
    }, 1000);
  }

  _bellSnap() {
    const b = this._bell, st = b && b.cam && this._hass.states[b.cam];
    const img = b && b.el.querySelector(".bimg");
    if (!img || !st || !st.attributes.access_token || b.loading) return;
    b.loading = true;
    const url = `/api/camera_proxy/${b.cam}?token=${st.attributes.access_token}&t=${Date.now()}`;
    const pre = new Image();
    pre.onload = () => { img.src = url; img.classList.add("ready"); b.loading = false; };
    pre.onerror = () => { b.loading = false; };
    pre.src = url;
  }

  _closeBell() {
    clearInterval(this._bellTimer);
    if (this._bellKey) { window.removeEventListener("keydown", this._bellKey); this._bellKey = null; }
    if (this._bell) { this._bell.el.remove(); this._bell = null; }
  }

  async _openDoor(eid, pulse, btn) {
    const h = this._hass, d = dom(eid), st = h.states[eid];
    setText(btn, "span", "Tür wird geöffnet …");
    btn.disabled = true;
    try {
      if (d === "lock") {
        // Schloss mit Öffnen-Funktion (Falle ziehen) öffnen, sonst entriegeln
        const canOpen = st && (Number(st.attributes.supported_features) & 1);
        await h.callService("lock", canOpen ? "open" : "unlock", { entity_id: eid });
      } else if (d === "button" || d === "input_button") {
        await h.callService(d, "press", { entity_id: eid });
      } else if (d === "script" || d === "scene") {
        await h.callService(d, "turn_on", { entity_id: eid });
      } else {
        // Schalter (z. B. KNX-Türöffner): einschalten und nach dem Impuls wieder aus
        const svcDom = ["switch", "input_boolean", "light"].includes(d) ? d : "homeassistant";
        await h.callService(svcDom, "turn_on", { entity_id: eid });
        if (pulse > 0) setTimeout(() => { h.callService(svcDom, "turn_off", { entity_id: eid }).catch(() => {}); }, pulse * 1000);
      }
      setText(btn, "span", "Türöffner ausgelöst");
      this._toast("Türöffner ausgelöst");
    } catch (err) {
      btn.disabled = false;
      setText(btn, "span", "Tür öffnen");
      this._toast(`Tür öffnen fehlgeschlagen: ${err && err.message ? err.message : err}`);
    }
  }

  _bellAction(act, t) {
    const b = this._bell;
    if (!b) return;
    switch (act) {
      case "bell-close": this._closeBell(); return;
      case "bell-live": {
        b.hold = true;
        const st = this._hass.states[b.cam];
        if (customElements.get("ha-camera-stream") && st) {
          const live = document.createElement("ha-camera-stream");
          live.hass = this._hass; live.stateObj = st; live.muted = true; live.controls = true; live.allowExoPlayer = true;
          b.el.querySelector(".blive").replaceChildren(live);
          b.el.classList.add("islive");
          b.live = live;
          t.disabled = true;
        } else this._more(b.cam);
        return;
      }
      case "bell-protect": { const p = t.dataset.path; this._closeBell(); this._openLink(p); return; }
      case "bell-unlock": {
        b.hold = true;
        if (t.dataset.armed === "1") {
          t.dataset.armed = "";
          this._openDoor(b.lock, b.pulse, t);
        } else {
          t.dataset.armed = "1";
          setText(t, "span", "Nochmal tippen zum Öffnen");
          setTimeout(() => { if (t.isConnected && t.dataset.armed === "1") { t.dataset.armed = ""; setText(t, "span", "Tür öffnen"); } }, 4000);
        }
        return;
      }
    }
  }
};

export { KlingelMixin };
