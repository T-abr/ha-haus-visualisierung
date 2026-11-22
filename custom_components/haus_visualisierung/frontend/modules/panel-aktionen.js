/* Haus Visualisierung – Aktionen des Panels (Klicks auf data-act), vor allem in den Einstellungen, und Navigation.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { DOMAIN } from "./version.js";
import { BUILTIN_MODES, HOUSE_MODES, MODE_NAME, UPD, withDefaults } from "./grundlagen.js";
import { rangeSet } from "./verlauf.js";
import { buildModel } from "./modell.js";
import { ALARMS } from "./warnungen.js";

const AktionenMixin = (Base) => class extends Base {
  async _actionExtra(act, t) {
    const D = this._draft;
    switch (act) {
      case "go": this._go(t.dataset.to); return;
      case "range": {
        // Zeitraum einer Verlaufs-Karte: nur diese Karte neu zeichnen, kein Neuaufbau der Seite
        const card = t.closest("[data-u]"), d = rangeSet(t.dataset.rk, Number(t.dataset.r));
        if (!card) return;
        card.querySelectorAll('[data-act="range"]').forEach((b) => { const on = Number(b.dataset.r) === d; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
        card._hour = null; card._drawn = 0; card._barsAt = 0;
        if (card._hover !== undefined) card._hover = undefined;
        card.querySelectorAll(".trcur,.trtip").forEach((n) => n.classList.remove("on"));
        card._force = true; UPD[card.dataset.u].run(card, this); card._force = false;
        return;
      }
      case "clim-kind": this._ck = t.dataset.k === "h" ? "h" : "t"; try { localStorage.setItem("hv-clim-kind", this._ck); } catch (err) { /* egal */ } this._render(); return;
      case "nav": this._go(t.dataset.to); return;
      case "link": this._openLink(t.dataset.path); return;
      case "nav-raw": this._navigate(t.dataset.path); return;
      case "roof": { if (this._model && this._model.energy) { this._go("energie"); return; } const l = (this._layout.links || [])[0]; if (l && l.path) this._openLink(l.path); return; }
      case "menu": this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })); return;
      case "bell-close": case "bell-live": case "bell-protect": case "bell-unlock": this._bellAction(act, t); return;
      case "s-bell-test": this._closeBell(); this._showBell(true, this._draft ? this._draft.doorbell : null); return;
      case "saver": this._saverShow(); return;
      case "s-wall-device": this._wallSet(!this._wallIsOn()); this._toast(this._wallIsOn() ? "Dieses Gerät ist jetzt ein Wandpanel" : "Wandpanel-Modus aus"); return;
      case "s-saver-test": { const prev = this._layout; this._layout = { ...prev, wallpanel: { ...this._wallCfg(), ...((this._draft && this._draft.wallpanel) || {}) } }; this._saverShow(); this._layout = prev; this._wallActive = Date.now(); return; }
      case "ftab": this._floorTab = t.dataset.floor; this._dirty = true; this._flush(); return;
      case "al-open-page": if (t.dataset.key) this._alSel = t.dataset.key; this._alTab = "leitstelle"; if (this._view === "alarme") this._alRefresh(); else this._go("alarme"); return;
      case "al-sel": this._alSel = t.dataset.key || null; this._alRefresh(); if (this._isNarrow && this._alSel) { const d = this.shadowRoot.querySelector(".aldetail"); if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "nearest" }); } return;
      case "al-tab": this._alTab = t.dataset.tab; this.shadowRoot.querySelectorAll(".ptitle .altab").forEach((b) => b.classList.toggle("on", b.dataset.tab === this._alTab)); this._alRefresh(); return;
      case "al-lvl": this._alLvl = t.dataset.lvl; this._alRefresh(); return;
      case "al-days": this._alDays = Number(t.dataset.days); this._alRefresh(); return;
      case "al-ack": this._alCall({ key: t.dataset.key, action: "ack" }, "Quittiert"); return;
      case "al-ackall": this._alCall({ key: "", action: "ack_all" }, "Alle Meldungen quittiert"); return;
      case "al-unmute": this._alCall({ key: t.dataset.key, action: "unmute" }, "Stummschaltung aufgehoben"); return;
      case "al-mute": this._alCall(t.dataset.until ? { key: t.dataset.key, action: "mute", until: t.dataset.until } : { key: t.dataset.key, action: "mute", minutes: Number(t.dataset.min) || 60 },
        t.dataset.until === "resolved" ? "Stumm bis behoben" : t.dataset.until === "morning" ? "Stumm bis morgen 7 Uhr" : "1 Stunde stumm"); return;
      case "al-lock": this._call("lock", "lock", { entity_id: t.dataset.eid }); this._toast("Wird verriegelt"); return;
      case "hm-set": {
        const md = t.dataset.mode;
        try {
          const st = await this._hass.callWS({ type: `${DOMAIN}/set_mode`, mode: md });
          if (ALARMS && st) this._onAlarms({ ...ALARMS, mode: st });
          this._toast(`Hausmodus: ${MODE_NAME[md]}`);
        } catch (err) { this._toast(`Umschalten fehlgeschlagen: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "only-on": {
        this._onlyOn = !this._onlyOn;
        t.classList.toggle("on", this._onlyOn);
        const w = this.shadowRoot.querySelector(".lwrap");
        if (w) w.classList.toggle("only-on", this._onlyOn);
        return;
      }
    }
    if (act === "s-code-save") {
      const inp = this.shadowRoot.getElementById("hv-code");
      try { await this._hass.callWS({ type: `${DOMAIN}/alarm_code`, code: inp ? inp.value : "" }); this._toast(inp && inp.value ? "Code gespeichert" : "Code gelöscht"); if (inp) inp.value = ""; }
      catch (err) { this._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`); }
      return;
    }
    if (!D) return;
    const h = this._hass;
    switch (act) {
      case "s-mode-chip": {
        const path = t.dataset.path.split("."), m = t.dataset.m, allM = HOUSE_MODES.map((x) => x[0]);
        let o = D;
        for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] ?? {};
        const key = path[path.length - 1];
        const cur = o[key] && o[key].length ? o[key] : path[1] === "modes" ? BUILTIN_MODES[key] || allM : allM;
        let next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
        if (!next.length) { this._toast("Mindestens ein Hausmodus"); return; }
        next = allM.filter((x) => next.includes(x));
        o[key] = next.length === allM.length && path[1] !== "modes" ? [] : next;
        break;
      }
      case "s-floor-outdoor": {
        const id = t.dataset.floor;
        D.outdoor_floors = D.outdoor_floors.includes(id) ? D.outdoor_floors.filter((x) => x !== id) : [...D.outdoor_floors, id];
        break;
      }
      case "s-area-hide": {
        const id = t.dataset.area;
        D.hidden_areas = D.hidden_areas.includes(id) ? D.hidden_areas.filter((x) => x !== id) : [...D.hidden_areas, id];
        break;
      }
      case "s-area-open": this._openArea = this._openArea === t.dataset.area ? null : t.dataset.area; this._dirty = true; this._flush(); return;
      case "s-pin-add": {
        const inp = this.shadowRoot.querySelector(`[data-pin-input="${CSS.escape(t.dataset.area)}"]`);
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        const list = D.pins[t.dataset.area] || [];
        if (!list.includes(v)) D.pins[t.dataset.area] = [...list, v];
        break;
      }
      case "s-pin-del": D.pins[t.dataset.area] = (D.pins[t.dataset.area] || []).filter((e) => e !== t.dataset.eid); break;
      case "s-fav-add": {
        const inp = this.shadowRoot.querySelector("[data-fav-input]");
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        if (!D.favorites.includes(v)) D.favorites = [...D.favorites, v];
        break;
      }
      case "s-fav-del": D.favorites = D.favorites.filter((e) => e !== t.dataset.eid); break;
      case "s-tank-del": {
        const cur = (buildModel(h, { ...D, hidden_areas: [] }).tech.heat || { tank: [] }).tank;
        D.heating.tank = cur.filter((e) => e !== t.dataset.eid);
        if (!D.heating.tank.length) { this._toast("Mindestens ein Fühler – sonst automatisch"); D.heating.tank = []; }
        break;
      }
      case "s-tank-add": {
        const inp = this.shadowRoot.querySelector("[data-tank-input]");
        const v = inp && inp.value.trim();
        if (!v) return;
        if (!h.states[v]) { this._toast(`Entität ${v} nicht gefunden`); return; }
        const cur = (buildModel(h, { ...D, hidden_areas: [] }).tech.heat || { tank: [] }).tank;
        if (!cur.includes(v)) D.heating.tank = [...cur, v];
        break;
      }
      case "s-tank-auto": D.heating.tank = []; break;
      case "s-push-test": {
        try {
          const r = await h.callWS({ type: `${DOMAIN}/push_test` });
          this._toast(r.targets.length ? `Testmeldung gesendet an ${r.targets.join(", ")}` : "Kein Empfänger gefunden – Companion-App eingerichtet?");
        } catch (err) { this._toast(`Test fehlgeschlagen: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "s-act-add": D.alarm_actions = [...D.alarm_actions, { id: `a${Date.now().toString(36)}`, name: "", type: "knx", enabled: true, when: "neu", scope: "alarm", modes: [], address: "", payload: 1, reset_payload: 0, reset: true }]; break;
      case "s-act-del": D.alarm_actions = D.alarm_actions.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-act-tpl": {
        const id = `a${Date.now().toString(36)}`;
        const T = {
          knx: { name: "KNX Sammelalarm", type: "knx", when: "neu", scope: "alarm", address: "", payload: 1, reset_payload: 0, reset: true },
          siren: { name: "Sirene", type: "siren", when: "eskalation", scope: "alarm", entity: "", reset: true },
          tts: { name: "Durchsage", type: "tts", when: "neu", scope: "alarm", entity: "", tts: Object.keys(h.states).find((e) => e.startsWith("tts.")) || "", message: "Achtung: {titel}", volume: 50 },
          flash: { name: "Blitzleuchte", type: "switch", when: "neu", scope: "alarm", entity: "", reset: true, modes: ["abwesend", "urlaub"] },
          script: { name: "Skript", type: "script", when: "neu", scope: "alarm", entity: "" },
        }[t.dataset.tpl];
        D.alarm_actions = [...D.alarm_actions, { id, enabled: true, modes: [], ...T }];
        break;
      }
      case "s-esc-level": {
        const l = t.dataset.lvl, cur = D.escalation.levels || [];
        D.escalation.levels = ["alarm", "warn", "info"].filter((x) => (x === l ? !cur.includes(x) : cur.includes(x)));
        break;
      }
      case "s-act-test": {
        const a = D.alarm_actions[Number(t.dataset.i)];
        try {
          const r = await this._hass.callWS({ type: `${DOMAIN}/action_test`, action: a });
          this._toast(`Test ausgeführt: ${(r.calls || []).map((c) => `${c.domain}.${c.service}`).join(", ")}`);
        } catch (err) { this._toast(`Test nicht möglich: ${err && err.message ? err.message : err}`); }
        return;
      }
      case "s-rule-add": D.alerts.rules = [...D.alerts.rules, { title: "", entity: "", op: "on", value: "", minutes: 0, level: "warn", enabled: true }]; break;
      case "s-rule-del": D.alerts.rules = D.alerts.rules.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-rule-tpl": {
        const H = D.header || {};
        const T = {
          akku: { title: "Akku fast leer", entity: H.battery || "", op: "lt", value: "15", minutes: 0, level: "warn" },
          speicher: { title: "Warmwasser-Speicher kalt", entity: "", op: "lt", value: "45", minutes: 0, level: "info" },
          kamin: { title: "Kamin sehr heiß", entity: "", op: "gt", value: "85", minutes: 0, level: "alarm" },
          netz: { title: "Hoher Netzbezug", entity: H.grid || "", op: "gt", value: "3000", minutes: 0, level: "info" },
          geraet: { title: "Gerät läuft lange", entity: "", op: "on", value: "", minutes: 120, level: "info" },
          offline: { title: "Gerät nicht erreichbar", entity: "", op: "unavailable", value: "", minutes: 10, level: "warn" },
        }[t.dataset.tpl];
        if (T) D.alerts.rules = [...D.alerts.rules, { ...T, enabled: true }];
        break;
      }
      case "s-link-add": D.links = [...(D.links || []), { title: "", icon: "mdi:link", path: "", embed: true, mode: "theme" }]; break;
      case "s-link-del": D.links = D.links.filter((_, i) => i !== Number(t.dataset.i)); break;
      case "s-tab": {
        this._setTabSel = t.dataset.tab;
        try { localStorage.setItem("hv-settings-tab", t.dataset.tab); } catch (err) { /* egal */ }
        this._dirty = true; this._flush();
        const mn = this.shadowRoot.querySelector(".main");
        if (mn) mn.scrollTop = 0;
        return;
      }
      case "s-reset": this._draft = null; this._dirtySettings = false; this._dirty = true; this._flush(); return;
      case "s-save": {
        try {
          const res = await h.callWS({ type: `${DOMAIN}/save`, layout: D });
          this._layout = withDefaults(res.layout);
          this._draft = structuredClone(this._layout);
          this._dirtySettings = false;
          this._startCams();
          this._dirty = true;
          this._flush();
          this._toast("Gespeichert");
        } catch (err) {
          this._toast(`Speichern fehlgeschlagen: ${err && err.message ? err.message : err}`);
        }
        return;
      }
      default: return;
    }
    this._rerenderSettings();
  }
};

export { AktionenMixin };
