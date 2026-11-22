/* Haus Visualisierung – Seite „Alarme“: Leitstelle, Details, Protokoll, Wischgesten.
 * Wird in panel.js mit den anderen Teilen zur Klasse des Panels zusammengesetzt. */

import { DOMAIN } from "./version.js";
import { dom, entName, esc, HOUSE_MODES, icon, isOn, MODE_ICON, MODE_NAME, UPD } from "./grundlagen.js";
import { ALARMO_TXT, ALARMS, clockOf, dayOf, durTxt, evalAlertsAll, LEVEL_ICON, LEVEL_TXT, logRow, setAlarms, sinceTs, statusTxt } from "./warnungen.js";

const AlarmseiteMixin = (Base) => class extends Base {
  /* ---------- Alarmmanager ---------- */
  _vAlarme() {
    const tab = this._alTab || "leitstelle";
    return `<div class="ptitle"><h1>Alarme</h1><span class="sp"></span>
      <div class="altabs">${[["leitstelle", "Leitstelle", "mdi:monitor-dashboard"], ["protokoll", "Protokoll", "mdi:timeline-clock-outline"]].map(([k, t, i]) =>
        `<button class="altab${tab === k ? " on" : ""}" data-act="al-tab" data-tab="${k}">${icon(i)}<span>${t}</span></button>`).join("")}</div></div>
      <div class="alpage" data-u="alarmpage"></div>`;
  }

  _renderAlarmPage(el) {
    const h = this._hass, tab = this._alTab || "leitstelle";
    const all = evalAlertsAll(h, this._model, this._layout);
    const minute = Math.floor(Date.now() / 60000);
    const sig = JSON.stringify([tab, this._isNarrow, this._alSel, minute, ALARMS && ALARMS.rev, ALARMS && ALARMS.mode, all.map((a) => [a.key, a.status, a.escalated, a.title, a.detail, a.ack_by, a.mute_until, a.level]),
      tab === "protokoll" ? [this._alLvl, this._alDays, this._alLog && this._alLog.at] : 0]);
    if (el._sig === sig) return;
    el._sig = sig;
    el.innerHTML = tab === "protokoll" ? this._alProtocolHTML() : this._alLeitstelleHTML(all);
  }

  _alLeitstelleHTML(all) {
    const h = this._hass;
    const open = all.filter((a) => a.status !== "stumm"), muted = all.filter((a) => a.status === "stumm");
    if (this._alSel && !all.some((a) => a.key === this._alSel)) this._alSel = null;
    const sel = all.find((a) => a.key === this._alSel) || (this._isNarrow ? null : open[0] || muted[0]);
    const row = (a) => {
      const since = sinceTs(h, a);
      return `<div class="alrow ${a.level} st-${a.status}${sel && sel.key === a.key ? " sel" : ""}" data-act="al-sel" data-key="${esc(a.key)}" role="button" tabindex="0">
        <span class="alsw ack">${icon("mdi:check")}Quittieren</span><span class="alsw mute">1 h stumm${icon("mdi:bell-off-outline")}</span>
        <span class="alin"><span class="alic">${icon(a.icon || LEVEL_ICON[a.level])}</span><span class="altx"><span class="alti">${esc(a.title)}</span>
        <span class="alsu">${LEVEL_TXT[a.level]} · seit ${durTxt(Date.now() / 1000 - since)}${a.escalated && a.status === "neu" ? ` · <em class="esc">eskaliert</em>` : ""}${a.status !== "neu" ? ` · <em>${esc(statusTxt(a))}</em>` : ""}</span></span>
        ${a.status === "neu" ? `<button class="alq" data-act="al-ack" data-key="${esc(a.key)}" title="Quittieren">${icon("mdi:check")}</button>` : ""}</span></div>`;
    };
    const anyNew = open.some((a) => a.status === "neu");
    const list = `<div class="glass alcol allist">
      <div class="alh">${icon("mdi:bell-ring-outline")}<span>Aktiv</span><span class="cnt">${open.length}</span><span class="sp"></span>
        ${anyNew && open.length > 1 ? `<button class="pbtn sm" data-act="al-ackall">${icon("mdi:check-all")}<span>Alle quittieren</span></button>` : ""}</div>
      ${open.length ? open.map(row).join("") : `<div class="alok">${icon("mdi:shield-check")}<b>Alles in Ordnung</b><span>Keine offenen Meldungen</span></div>`}
      ${muted.length ? `<div class="alh sub">${icon("mdi:bell-off-outline")}<span>Stumm</span><span class="cnt">${muted.length}</span></div>${muted.map(row).join("")}` : ""}
      ${this._isNarrow && open.length ? `<div class="alhint">Nach rechts wischen = quittieren · nach links = 1 h stumm</div>` : ""}
    </div>`;
    const detail = sel ? this._alDetailHTML(sel) : this._isNarrow ? "" : `<div class="glass alcol aldetail alempty">${icon("mdi:gesture-tap")}<span>Meldung auswählen</span></div>`;
    return `<div class="algrid">${list}${detail}${this._alSideHTML()}</div>`;
  }

  _alDetailHTML(a) {
    const h = this._hass, since = sinceTs(h, a);
    const area = a.eid ? this._model.eidArea.get(a.eid) : a.to && a.to.startsWith("raum/") ? this._model.areas.get(a.to.slice(5)) : null;
    const target = a.to ? `data-act="go" data-to="${esc(a.to)}"` : a.eid ? `data-act="more" data-eid="${esc(a.eid)}"` : "";
    const isLock = a.key.startsWith("lock:") && a.eid && isOn(h.states[a.eid]);
    const btns = a.status === "stumm"
      ? `<button class="pbtn" data-act="al-unmute" data-key="${esc(a.key)}">${icon("mdi:bell-outline")}<span>Stummschaltung aufheben</span></button>`
      : `${a.status === "neu" ? `<button class="pbtn primary" data-act="al-ack" data-key="${esc(a.key)}">${icon("mdi:check")}<span>Quittieren</span></button>` : ""}
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-min="60">${icon("mdi:bell-off-outline")}<span>1 h stumm</span></button>
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-until="morning">${icon("mdi:weather-night")}<span>Bis morgen 7 Uhr</span></button>
         <button class="pbtn" data-act="al-mute" data-key="${esc(a.key)}" data-until="resolved">${icon("mdi:bell-cancel-outline")}<span>Bis behoben</span></button>`;
    const hist = ((ALARMS && ALARMS.log) || []).filter((e) => e.key === a.key).slice(-8).reverse();
    return `<div class="glass alcol aldetail ${a.level}">
      ${this._isNarrow ? `<button class="alclose" data-act="al-sel" data-key="" title="Schließen">${icon("mdi:close")}</button>` : ""}
      <div class="aldh"><span class="ssic">${icon(a.icon || LEVEL_ICON[a.level])}</span><div class="aldt"><div class="alt">${esc(a.title)}</div>
        <div class="ald"><span class="lvl ${a.level}">${LEVEL_TXT[a.level]}</span> seit ${clockOf(since)} · ${durTxt(Date.now() / 1000 - since)}</div></div></div>
      <div class="alinfo">${a.detail ? `<div>${icon("mdi:information-outline")}<span>${esc(a.detail)}</span></div>` : ""}
        ${area ? `<div>${icon(area.icon || "mdi:floor-plan")}<span>${esc(area.name)}</span></div>` : ""}
        ${a.escalated ? `<div class="alstat esc">${icon("mdi:alarm-light-outline")}<span>eskaliert um ${clockOf(a.escalated)}</span></div>` : ""}
        <div class="alstat st-${a.status}">${icon(a.status === "neu" ? "mdi:bell-ring-outline" : a.status === "quittiert" ? "mdi:check-circle-outline" : "mdi:bell-off-outline")}<span>${esc(a.status === "neu" ? "Noch nicht quittiert" : statusTxt(a))}</span></div></div>
      <div class="albtns">${btns}</div>
      <div class="albtns sec">${target ? `<button class="pbtn" ${target}>${icon("mdi:open-in-app")}<span>${a.to && a.to.startsWith("raum/") ? "Raum öffnen" : a.to ? "Seite öffnen" : "Details"}</span></button>` : ""}
        ${isLock ? `<button class="pbtn" data-act="al-lock" data-eid="${esc(a.eid)}">${icon("mdi:lock")}<span>Verriegeln</span></button>` : ""}</div>
      ${hist.length ? `<div class="alsub">Verlauf dieser Meldung</div><div class="lglist">${hist.map((e) => logRow(e, false)).join("")}</div>` : ""}
    </div>`;
  }

  _alSideHTML() {
    const h = this._hass, t = (ALARMS && ALARMS.today) || { alarm: 0, warn: 0, info: 0 };
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const today = ((ALARMS && ALARMS.log) || []).filter((e) => e.ts * 1000 >= start.getTime()).slice(-8).reverse();
    const panels = Object.keys(h.states).filter((e) => dom(e) === "alarm_control_panel");
    return `<div class="alside">${this._hmCardHTML()}
      <div class="glass alcol"><div class="alh">${icon("mdi:calendar-today")}<span>Heute</span></div>
        <div class="alkpi">${[["alarm", "Alarme"], ["warn", "Warnungen"], ["info", "Hinweise"]].map(([k, l]) => `<div class="k ${k}${t[k] ? " n" : ""}"><b>${t[k] || 0}</b><span>${l}</span></div>`).join("")}</div></div>
      ${panels.length ? `<div class="glass alcol"><div class="alh">${icon("mdi:shield-home-outline")}<span>Alarmanlage</span></div>${panels.map((e) => {
        const st = h.states[e];
        return `<button class="alarmo st-${esc(st.state)}" data-act="more" data-eid="${esc(e)}">${icon(st.state === "disarmed" ? "mdi:shield-off-outline" : st.state === "triggered" ? "mdi:alarm-light" : "mdi:shield-lock")}<span class="an">${esc(entName(h, e))}</span><span class="as">${esc(ALARMO_TXT[st.state] || st.state)}</span></button>`;
      }).join("")}</div>` : ""}
      <div class="glass alcol"><div class="alh">${icon("mdi:history")}<span>Verlauf heute</span><span class="sp"></span><button class="pbtn sm" data-act="al-tab" data-tab="protokoll"><span>Protokoll</span>${icon("mdi:chevron-right")}</button></div>
        ${today.length ? `<div class="lglist">${today.map((e) => logRow(e)).join("")}</div>` : `<div class="alnone">Heute noch nichts passiert</div>`}</div>
    </div>`;
  }

  _hmCardHTML() {
    const H = this._layout.house_mode || {};
    if (H.enabled === false) return "";
    const M = (ALARMS && ALARMS.mode) || { mode: "zuhause" };
    const md = M.mode || "zuhause", h = this._hass;
    const arms = (k) => H.alarmo_sync && ["arm_home", "arm_night", "arm_away", "arm_vacation"].includes((H.arm || {})[k]);
    const pst = M.panel && h.states[M.panel];
    return `<div class="glass alcol hmcard m-${md}"><div class="alh">${icon(MODE_ICON[md])}<span>Hausmodus</span><span class="sp"></span><b class="hmnow">${MODE_NAME[md]}</b></div>
      <div class="hmseg">${HOUSE_MODES.map(([k, t, i]) => `<button class="hmb${k === md ? " on" : ""}" data-act="hm-set" data-mode="${k}"${arms(k) && k !== md ? ' data-confirm="1"' : ""}>${icon(i)}<span>${t}</span></button>`).join("")}</div>
      <div class="hminfo">${M.since ? `seit ${clockOf(M.since)}${dayOf(M.since) !== "Heute" ? ` (${dayOf(M.since)})` : ""} · ${esc(M.by || "Automatik")}` : "Automatik"}</div>
      ${M.away_pending ? `<div class="hminfo warn">${icon("mdi:timer-sand")}Alle weg – gleich „Abwesend“</div>` : ""}
      ${pst ? `<div class="hminfo">${icon(pst.state === "disarmed" ? "mdi:shield-off-outline" : "mdi:shield-lock")}${esc(entName(h, M.panel))}: ${esc(ALARMO_TXT[pst.state] || pst.state)}${M.sync ? " · gekoppelt" : " · nicht gekoppelt"}</div>` : ""}
      ${H.auto_away || H.auto_night ? `<div class="hminfo dim">${icon("mdi:robot-outline")}${[H.auto_away ? "Abwesend, wenn alle weg sind" : "", H.auto_night ? `Nacht ${H.night_start}–${H.night_end}` : ""].filter(Boolean).join(" · ")}</div>` : ""}
    </div>`;
  }

  _alProtocolHTML() {
    const days = this._alDays || 7, lvl = this._alLvl || "";
    const L = this._alLog;
    if (!L || L.days !== days || (ALARMS && L.rev !== ALARMS.rev)) this._alFetchLog(days);
    const chips = (items, cur, act, key) => items.map(([v, t]) => `<button class="altab sm${String(cur) === String(v) ? " on" : ""}" data-act="${act}" data-${key}="${v}"><span>${t}</span></button>`).join("");
    const filters = `<div class="alfilter"><div class="altabs">${chips([["", "Alle"], ["alarm", "Alarme"], ["warn", "Warnungen"], ["info", "Hinweise"]], lvl, "al-lvl", "lvl")}</div>
      <div class="altabs">${chips([[1, "Heute"], [7, "7 Tage"], [30, "30 Tage"]], days, "al-days", "days")}</div></div>`;
    if (!L || !L.log) return `${filters}<div class="glass empty">${icon("mdi:loading", "spin")}Lade Protokoll …</div>`;
    const log = L.log.filter((e) => !lvl || e.level === lvl).slice().reverse();
    let day = "", tl = "";
    for (const e of log.slice(0, 400)) {
      const d = dayOf(e.ts);
      if (d !== day) { day = d; tl += `<div class="lgday">${esc(d)}</div>`; }
      tl += logRow(e);
    }
    const stats = (L.stats || []).filter((x) => !lvl || x.level === lvl);
    return `${filters}<div class="algrid proto">
      <div class="glass alcol"><div class="alh">${icon("mdi:timeline-clock-outline")}<span>Ereignisse</span><span class="cnt">${log.length}</span></div>
        ${log.length ? `<div class="lglist">${tl}</div>` : `<div class="alnone">Keine Ereignisse im gewählten Zeitraum</div>`}</div>
      <div class="glass alcol"><div class="alh">${icon("mdi:chart-bar")}<span>Häufigste Meldungen</span></div>
        ${stats.length ? stats.map((x) => {
          const v = x.verdacht || (x.n >= 5 ? ["häufig"] : []);
          const info = [x.avg != null ? `Ø ${durTxt(x.avg)}` : "", x.short ? `${x.short}× unter 1 Min.` : "", x.acked != null ? (x.acked ? `${x.acked}× quittiert` : "nie quittiert") : ""].filter(Boolean).join(" · ");
          return `<div class="alstatrow ${x.level}${v.length ? " sus" : ""}"><span class="n">${x.n}×</span><span class="t">${esc(x.title)}${info ? `<small>${esc(info)}</small>` : ""}</span>${v.length ? `<span class="fa" title="${esc(`Möglicher Fehlalarm: ${v.join(", ")}`)}">prüfen</span>` : ""}</div>`;
        }).join("") : `<div class="alnone">Keine Meldungen</div>`}
        <div class="alhint">„prüfen“ = möglicher Fehlalarm: häufig (ab 5×), mehrfach nach weniger als 1 Minute wieder weg oder nie quittiert. Abhilfe: Mindestdauer in der Regel („ab … min“), Regel auf Hausmodi beschränken oder Sensor prüfen.</div></div>
    </div>`;
  }

  async _alFetchLog(days) {
    if (this._alLogBusy === days) return;
    this._alLogBusy = days;
    try {
      const r = await this._hass.callWS({ type: `${DOMAIN}/alarm_log`, days });
      this._alLog = { days, rev: ALARMS && ALARMS.rev, at: Date.now(), log: (r.log || []).slice().sort((a, b) => a.ts - b.ts), stats: r.stats || [] };
    } catch (err) {
      this._alLog = { days, rev: ALARMS && ALARMS.rev, at: Date.now(), log: [], stats: [] };
    }
    this._alLogBusy = null;
    this._alRefresh();
  }

  _alRefresh() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('[data-u="alarmpage"], [data-u="alerts"], [data-u="navbadge"], [data-k="alerts"], [data-u="hmode"], [data-u="focus"]').forEach((el) => UPD[el.dataset.u].run(el, this));
  }

  _onAlarms(snap) {
    // Neuer Alarm weckt das Wandpanel
    if (this._saverOn && this._wallCfg().wake_alarm) {
      const neu = (s) => new Set(Object.values((s && s.alarms) || {}).filter((a) => a.status === "neu" && a.level === "alarm").map((a) => a.key));
      const old = neu(ALARMS);
      if ([...neu(snap)].some((k) => !old.has(k))) { this._wallActive = Date.now(); this._saverHide(); }
    }
    if (this._saverOn) this._saverDirty = true;
    const mutedKeys = (s) => Object.values((s && s.alarms) || {}).filter((a) => a.status === "stumm").map((a) => a.key).sort().join("|");
    const before = mutedKeys(ALARMS);
    setAlarms(snap);
    // Stumm geschaltet/aufgehoben ändert, welche Räume im Aktiv-Fokus erscheinen → einmal neu aufbauen
    if (before !== mutedKeys(snap) && this._model) { this._dirty = true; this._schedule(); return; }
    this._alRefresh();
  }

  async _alCall(data, okMsg) {
    try {
      const r = await this._hass.callWS({ type: `${DOMAIN}/alarm_action`, ...data });
      if (r && r.alarm && ALARMS && r.alarm.key) this._onAlarms({ ...ALARMS, alarms: { ...ALARMS.alarms, [r.alarm.key]: r.alarm } });
      if (okMsg) this._toast(okMsg);
    } catch (err) {
      this._toast(err && err.code === "not_found" ? "Die Meldung ist nicht mehr aktiv." : `Fehlgeschlagen: ${err && err.message ? err.message : err}`);
    }
  }

  /* Wischen auf dem Handy: rechts = quittieren, links = 1 h stumm */
  _alSwipeStart(e) {
    const row = e.target.closest && e.target.closest(".alrow");
    if (!row || e.target.closest("button") || !this._isNarrow) return;
    this._alSw = { row, x0: e.clientX, y0: e.clientY, dx: 0, active: false, id: e.pointerId };
  }
  _alSwipeMove(e) {
    const s = this._alSw;
    if (!s) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { this._alSw = null; return; }
      if (Math.abs(dx) < 12) return;
      s.active = true;
      s.row.classList.add("swiping");
      try { s.row.setPointerCapture(s.id); } catch (err) { /* egal */ }
    }
    s.dx = Math.max(-140, Math.min(140, dx));
    s.row.style.setProperty("--sx", `${s.dx}px`);
    s.row.classList.toggle("go-ack", s.dx > 80 && !s.row.classList.contains("st-quittiert"));
    s.row.classList.toggle("go-mute", s.dx < -80);
  }
  _alSwipeEnd() {
    const s = this._alSw;
    this._alSw = null;
    if (!s || !s.active) return;
    this._alSwiped = Date.now();
    s.row.classList.remove("swiping", "go-ack", "go-mute");
    s.row.style.removeProperty("--sx");
    const key = s.row.dataset.key;
    if (s.dx > 80 && !s.row.classList.contains("st-quittiert") && !s.row.classList.contains("st-stumm")) this._alCall({ key, action: "ack" }, "Quittiert");
    else if (s.dx < -80 && !s.row.classList.contains("st-stumm")) this._alCall({ key, action: "mute", minutes: 60 }, "1 Stunde stumm");
  }
};

export { AlarmseiteMixin };
