// Nachgebautes hass-Objekt mit Registern, Zuständen und Diensten.
export function makeHass({ big = false, komfort = false, ov = "haus", hs = "kompakt" } = {}) {
  const states = {}, entities = {}, devices = {}, areas = {}, floors = {};
  const now = new Date().toISOString();
  const floor = (id, name, level) => (floors[id] = { floor_id: id, name, level, icon: null, aliases: [] });
  const area = (id, name, floor_id, extra = {}) => (areas[id] = { area_id: id, name, floor_id, icon: null, picture: null, labels: [], aliases: [], temperature_entity_id: null, humidity_entity_id: null, ...extra });
  const ent = (eid, state, attrs = {}, area_id = null, reg = {}) => {
    states[eid] = { entity_id: eid, state: String(state), attributes: { friendly_name: eid, ...attrs }, last_changed: now, last_updated: now, context: { id: "x" } };
    entities[eid] = { entity_id: eid, area_id, device_id: null, labels: [], hidden: false, entity_category: null, platform: "demo", ...reg };
  };
  const light = (eid, name, area, on, bri, extra = {}) => ent(eid, on ? "on" : "off", { friendly_name: name, supported_color_modes: bri === null ? ["onoff"] : ["brightness"], brightness: on && bri !== null ? Math.round(bri * 2.55) : null, ...extra }, area);
  const temp = (eid, name, area, v) => ent(eid, v, { friendly_name: name, device_class: "temperature", unit_of_measurement: "°C", state_class: "measurement" }, area);
  const hum = (eid, name, area, v) => ent(eid, v, { friendly_name: name, device_class: "humidity", unit_of_measurement: "%" }, area);
  const win = (eid, name, area, open, dc = "window") => ent(eid, open ? "on" : "off", { friendly_name: name, device_class: dc }, area);
  const cover = (eid, name, area, pos) => ent(eid, pos > 0 ? "open" : "closed", { friendly_name: name, device_class: "shutter", current_position: pos }, area);
  const motion = (eid, name, area, on) => ent(eid, on ? "on" : "off", { friendly_name: name, device_class: "motion" }, area);
  const batt = (eid, name, area, v) => ent(eid, v, { friendly_name: name, device_class: "battery", unit_of_measurement: "%" }, area, { entity_category: "diagnostic" });
  const clim = (eid, name, area, cur, tgt, action) => ent(eid, "heat", { friendly_name: name, current_temperature: cur, temperature: tgt, hvac_action: action, min_temp: 5, max_temp: 30, target_temp_step: 0.5, hvac_modes: ["heat", "off"] }, area);

  if (!big) {
    floor("og", "Obergeschoss", 1); floor("eg", "Erdgeschoss", 0); floor("kg", "Keller", -1); floor("aussen", "Außen", 0);
    area("schlafzimmer", "Schlafzimmer", "og"); area("bad", "Bad", "og"); area("buro", "Büro", "og"); area("gastezimmer", "Gästezimmer", "og");
    area("wohnzimmer", "Wohnzimmer", "eg"); area("kuche", "Küche", "eg"); area("esszimmer", "Esszimmer", "eg"); area("flur", "Flur", "eg"); area("gaste_wc", "Gäste-WC", "eg");
    area("heizungsraum", "Heizungsraum", "kg"); area("hauswirtschaftsraum", "Hauswirtschaftsraum", "kg");
    area("eingang", "Eingang", "aussen"); area("einfahrt", "Einfahrt", "aussen"); area("garten", "Garten", "aussen"); area("terrasse", "Terrasse", "aussen");

    light("light.schlafzimmer_decke", "Schlafzimmer Decke", "schlafzimmer", false, 60);
    light("light.schlafzimmer_nachttisch", "Schlafzimmer Nachttisch", "schlafzimmer", true, 25);
    temp("sensor.schlafzimmer_temperatur", "Schlafzimmer Temperatur", "schlafzimmer", 18.6); hum("sensor.schlafzimmer_feuchte", "Schlafzimmer Luftfeuchte", "schlafzimmer", 52);
    cover("cover.schlafzimmer_rollo", "Schlafzimmer Rollo", "schlafzimmer", 0); win("binary_sensor.schlafzimmer_fenster", "Schlafzimmer Fenster", "schlafzimmer", true);
    batt("sensor.schlafzimmer_fenster_batterie", "Schlafzimmer Fenster Batterie", "schlafzimmer", 12);
    light("light.bad_spiegel", "Bad Spiegel", "bad", false, null); light("light.bad_decke", "Bad Decke", "bad", false, 80);
    temp("sensor.bad_temperatur", "Bad Temperatur", "bad", 22.1); hum("sensor.bad_feuchte", "Bad Luftfeuchte", "bad", 64);
    clim("climate.bad", "Bad Heizkörper", "bad", 22.1, 22.5, "heating");
    ent("fan.bad_lufter", "off", { friendly_name: "Bad Lüfter" }, "bad");
    light("light.buro_schreibtisch", "Büro Schreibtisch", "buro", true, 90); light("light.buro_decke", "Büro Decke", "buro", true, 70);
    temp("sensor.buro_temperatur", "Büro Temperatur", "buro", 21.4); hum("sensor.buro_feuchte", "Büro Luftfeuchte", "buro", 45);
    ent("sensor.buro_co2", 812, { friendly_name: "Büro CO₂", device_class: "carbon_dioxide", unit_of_measurement: "ppm" }, "buro");
    ent("switch.buro_drucker", "off", { friendly_name: "Büro Drucker", device_class: "outlet" }, "buro");
    cover("cover.buro_rollo", "Büro Rollo", "buro", 100); motion("binary_sensor.buro_bewegung", "Büro Bewegung", "buro", true);
    light("light.gastezimmer_decke", "Gästezimmer Decke", "gastezimmer", false, 50); temp("sensor.gastezimmer_temperatur", "Gästezimmer Temperatur", "gastezimmer", 17.2);

    light("light.wohnzimmer_decke", "Wohnzimmer Decke", "wohnzimmer", true, 70);
    light("light.wohnzimmer_stehlampe", "Wohnzimmer Stehlampe", "wohnzimmer", true, 40, { rgb_color: [255, 170, 90] });
    light("light.wohnzimmer_led_streifen", "Wohnzimmer LED-Streifen", "wohnzimmer", false, 30);
    temp("sensor.wohnzimmer_temperatur", "Wohnzimmer Temperatur", "wohnzimmer", 22.4); hum("sensor.wohnzimmer_feuchte", "Wohnzimmer Luftfeuchte", "wohnzimmer", 47);
    clim("climate.wohnzimmer_fbh", "Wohnzimmer Fußbodenheizung", "wohnzimmer", 22.4, 21.5, "idle");
    cover("cover.wohnzimmer_terrassentur", "Wohnzimmer Rollo Terrassentür", "wohnzimmer", 100); cover("cover.wohnzimmer_fenster", "Wohnzimmer Rollo Fenster", "wohnzimmer", 60);
    ent("media_player.wohnzimmer_sonos", "playing", { friendly_name: "Wohnzimmer Sonos", media_title: "Nachtflug", media_artist: "Hörspiel" }, "wohnzimmer");
    ent("media_player.wohnzimmer_tv", "off", { friendly_name: "Wohnzimmer Fernseher", device_class: "tv" }, "wohnzimmer");
    ent("sensor.kamin_temperatur", 68.5, { friendly_name: "Kamin Temperatur", device_class: "temperature", unit_of_measurement: "°C" }, null);
    ent("sensor.kamin_pumpe_drehzahl", 64, { friendly_name: "Kamin Pumpe", unit_of_measurement: "%", icon: "mdi:pump" }, null);
    ent("scene.wohnzimmer_kino", "unknown", { friendly_name: "Wohnzimmer Kino" }, "wohnzimmer");
    ent("scene.wohnzimmer_gemutlich", "unknown", { friendly_name: "Wohnzimmer Gemütlich" }, "wohnzimmer");
    win("binary_sensor.wohnzimmer_terrassentur", "Wohnzimmer Terrassentür", "wohnzimmer", false, "door");
    ent("binary_sensor.wohnzimmer_rauchmelder", "off", { friendly_name: "Wohnzimmer Rauchmelder", device_class: "smoke" }, "wohnzimmer");
    batt("sensor.wohnzimmer_rauchmelder_batterie", "Wohnzimmer Rauchmelder Batterie", "wohnzimmer", 88);
    light("light.kuche_decke", "Küche Decke", "kuche", false, 100); light("light.kuche_arbeitsplatte", "Küche Arbeitsplatte", "kuche", true, null);
    temp("sensor.kuche_temperatur", "Küche Temperatur", "kuche", 21.8); clim("climate.kuche_fbh", "Küche Fußbodenheizung", "kuche", 21.8, 21.0, "idle");
    win("binary_sensor.kuche_fenster", "Küche Fenster", "kuche", false); ent("switch.kuche_kaffeemaschine", "on", { friendly_name: "Küche Kaffeemaschine", device_class: "outlet" }, "kuche");
    batt("sensor.kuche_fenster_batterie", "Küche Fenster Batterie", "kuche", 31);
    light("light.esszimmer_pendel", "Esszimmer Pendelleuchte", "esszimmer", false, 80); temp("sensor.esszimmer_temperatur", "Esszimmer Temperatur", "esszimmer", 21.2);
    cover("cover.esszimmer_rollo", "Esszimmer Rollo", "esszimmer", 100);
    light("light.flur_decke", "Flur Decke", "flur", false, null); motion("binary_sensor.flur_bewegung", "Flur Bewegung", "flur", false);
    states["binary_sensor.flur_bewegung"].last_changed = new Date(Date.now() - 7 * 60000).toISOString();
    light("light.gaste_wc", "Gäste-WC Licht", "gaste_wc", false, null);

    temp("sensor.speicher_oben", "Speicher oben", "heizungsraum", 61.3); temp("sensor.speicher_mitte", "Speicher mitte", "heizungsraum", 48.9);
    temp("sensor.speicher_unten", "Speicher unten", "heizungsraum", 34.2); temp("sensor.fbh_vorlauf", "FBH Vorlauf", "heizungsraum", 31.5);
    ent("sensor.fbh_vorlauf_soll", 32.0, { friendly_name: "FBH Vorlauf Soll", device_class: "temperature", unit_of_measurement: "°C" }, "heizungsraum");
    // Integration „Heizkurve Fußbodenheizung“: Sollwert mit Kurvenpunkten, Mischer-Stellgröße
    ent("sensor.heizkurve_soll_vorlauftemperatur", 27.6, { friendly_name: "Heizkurve Soll-Vorlauftemperatur", device_class: "temperature", unit_of_measurement: "°C",
      outdoor_temperature: 6.8, heating_active: true, slope: 0.3, level: 0, room_temperature: 20, min_flow: 22, max_flow: 40, heating_limit: 16,
      curve: Array.from({ length: 41 }, (_, i) => { const t = i - 20, d = t - 20; return { outdoor: t, flow: Math.round(Math.min(40, Math.max(22, 20 - 0.3 * d * (1.4347 + 0.021 * d + 247.9e-6 * d * d))) * 10) / 10 }; }) }, "heizungsraum");
    ent("sensor.heizkurve_stellgrosse_mischer", 42, { friendly_name: "Heizkurve Stellgröße Mischer", unit_of_measurement: "%", status: "Regelt", feedforward: 30, enabled: true }, "heizungsraum");
    ent("binary_sensor.heizungsraum_wasser", "off", { friendly_name: "Heizungsraum Wassermelder", device_class: "moisture" }, "heizungsraum");
    light("light.heizungsraum", "Heizungsraum Licht", "heizungsraum", false, null);
    ent("switch.waschmaschine", "on", { friendly_name: "Waschmaschine", device_class: "outlet" }, "hauswirtschaftsraum");
    ent("switch.trockner", "off", { friendly_name: "Trockner", device_class: "outlet" }, "hauswirtschaftsraum");
    light("light.hauswirtschaftsraum", "Hauswirtschaftsraum Licht", "hauswirtschaftsraum", false, null);
    temp("sensor.hauswirtschaftsraum_temperatur", "Hauswirtschaftsraum Temperatur", "hauswirtschaftsraum", 16.4);

    ent("camera.g6_entry_package", "idle", { friendly_name: "G6 Entry Paketkamera", access_token: "t" }, "eingang", { device_id: "dev_entry" });
    ent("camera.g6_entry", "idle", { friendly_name: "G6 Entry", access_token: "t" }, "eingang", { device_id: "dev_entry" });
    ent("event.g6_entry_doorbell", "2026-11-18T08:00:00.000+00:00", { friendly_name: "G6 Entry Klingel", device_class: "doorbell", event_type: "ring", event_types: ["ring"] }, "eingang", { device_id: "dev_entry" });
    ent("lock.haustur", "locked", { friendly_name: "Haustür", supported_features: 1 }, "eingang");
    ent("switch.tueroeffner", "off", { friendly_name: "Türöffner" }, null);
    ent("button.tuer_summer", "unknown", { friendly_name: "Türsummer" }, null);
    light("light.eingang", "Eingang Licht", "eingang", false, null); motion("binary_sensor.eingang_person", "Eingang Person", "eingang", false);
    ent("camera.g6_einfahrt", "idle", { friendly_name: "G6 Einfahrt", access_token: "t" }, "einfahrt");
    cover("cover.garagentor", "Garagentor", "einfahrt", 0); states["cover.garagentor"].attributes.device_class = "garage";
    ent("sensor.evcc_ladeleistung", 7360, { friendly_name: "Wallbox Ladeleistung", device_class: "power", unit_of_measurement: "W" }, "einfahrt");
    // EVCC (Ladepunkt 1) – Entitäten wie bei der EVCC-Integration
    ent("select.evcc_lp1_mode", "pv", { friendly_name: "Wallbox Lademodus", options: ["off", "now", "minpv", "pv"] }, "einfahrt");
    ent("sensor.evcc_lp1_vehicle_soc", 64, { friendly_name: "Auto Ladestand", device_class: "battery", unit_of_measurement: "%" }, "einfahrt");
    ent("number.evcc_lp1_limit_soc", 80, { friendly_name: "Wallbox Ziel-Ladestand", min: 20, max: 100, step: 5, unit_of_measurement: "%" }, "einfahrt");
    ent("sensor.evcc_lp1_session_energy", 12.34, { friendly_name: "Wallbox geladen (Sitzung)", device_class: "energy", unit_of_measurement: "kWh" }, "einfahrt");
    ent("binary_sensor.evcc_lp1_connected", "on", { friendly_name: "Wallbox Fahrzeug angesteckt", device_class: "plug" }, "einfahrt");
    ent("binary_sensor.evcc_lp1_charging", "on", { friendly_name: "Wallbox lädt", device_class: "battery_charging" }, "einfahrt");
    ent("sensor.evcc_lp1_vehicle_range", 312, { friendly_name: "Auto Reichweite", device_class: "distance", unit_of_measurement: "km" }, "einfahrt");
    light("light.garten_wege", "Garten Wegebeleuchtung", "garten", false, null); temp("sensor.aussen_temperatur", "Außentemperatur", "garten", 6.8); hum("sensor.aussen_feuchte", "Außen Luftfeuchte", "garten", 86);
    ent("lawn_mower.luba", "docked", { friendly_name: "Mähroboter" }, "garten");
    light("light.terrasse", "Terrasse Licht", "terrasse", false, 50);

    ent("weather.forecast_home", "partlycloudy", { friendly_name: "Zuhause", temperature: 7, temperature_unit: "°C", humidity: 88, supported_features: 3 });
    ent("person.tobias", "home", { friendly_name: "Tobias" });
    ent("person.zweite_person", "home", { friendly_name: "Zweite Person" });
    ent("sensor.growatt_modbus_pv_power", 3240, { friendly_name: "PV-Leistung", device_class: "power", unit_of_measurement: "W", state_class: "measurement" });
    ent("sensor.growatt_modbus_battery_soc", 78, { friendly_name: "Akku", device_class: "battery", unit_of_measurement: "%" });
    ent("sensor.hausverbrauch_ac", 612, { friendly_name: "Hausverbrauch", device_class: "power", unit_of_measurement: "W", state_class: "measurement" });
    // Bilanz: 3240 PV + 5532 Netz = 612 Haus + 7360 Wallbox + 800 Speicher (lädt)
    ent("sensor.netz_leistung", 5532, { friendly_name: "Netz", device_class: "power", unit_of_measurement: "W", state_class: "measurement" });
    ent("sensor.growatt_modbus_battery_power", 800, { friendly_name: "Akku Leistung", device_class: "power", unit_of_measurement: "W", state_class: "measurement" });
    // Dynamischer Strompreis wie Nordpool: Stundenpreise heute und morgen (günstig nachts und mittags 12–15 Uhr)
    {
      const P = [27, 25, 22, 21, 21, 23, 29, 34, 33, 30, 26, 22, 18, 16, 17, 21, 27, 35, 38, 36, 32, 30, 29, 28].map((c) => c / 100);
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const raw = (day, add) => P.map((v, i) => { const s = new Date(d0); s.setDate(s.getDate() + day); s.setHours(i); const e = new Date(s); e.setHours(i + 1); return { start: s.toISOString(), end: e.toISOString(), value: Math.round((v + add) * 1000) / 1000 }; });
      ent("sensor.nordpool_kwh_de_eur", P[new Date().getHours()], { friendly_name: "Strompreis", unit_of_measurement: "EUR/kWh", state_class: "measurement",
        today: P, tomorrow: P.map((v) => Math.round((v + 0.01) * 1000) / 1000), raw_today: raw(0, 0), raw_tomorrow: raw(1, 0.01), tomorrow_valid: true });
    }
    ent("light.keller_flur", "unavailable", { friendly_name: "Keller Flur Licht" }, "hauswirtschaftsraum");
    ent("switch.gartenpumpe", "unavailable", { friendly_name: "Gartenpumpe" }, "garten");
    ent("sensor.debug_noise", 1, { friendly_name: "Rauschen" }, "wohnzimmer", { labels: ["no_dboard"] });
  } else {
    // Messaufbau: 4 Etagen × 6 Räume, je Raum 6 Lichter, 2 Rollos, Klima, Kontakte, Sensoren ≈ 450 Entitäten + 300 fremde
    for (let f = 0; f < 4; f++) floor(`f${f}`, ["Obergeschoss", "Erdgeschoss", "Keller", "Außen"][f], [1, 0, -1, 0][f]);
    for (let f = 0; f < 4; f++) for (let r = 0; r < 6; r++) {
      const a = `a${f}_${r}`; area(a, `Raum ${f}-${r}`, `f${f}`);
      for (let i = 0; i < 6; i++) light(`light.${a}_${i}`, `L ${i}`, a, i % 3 === 0, 50);
      for (let i = 0; i < 2; i++) cover(`cover.${a}_${i}`, `R ${i}`, a, 50);
      clim(`climate.${a}`, `K`, a, 21, 21.5, "idle"); temp(`sensor.${a}_t`, "T", a, 21); hum(`sensor.${a}_h`, "H", a, 50);
      win(`binary_sensor.${a}_w`, "F", a, false); motion(`binary_sensor.${a}_m`, "B", a, false); batt(`sensor.${a}_b`, "Bat", a, 80);
    }
    // Energie wie im kleinen Haus (für die Messung der Energie-Seite)
    for (const [e, v] of [["sensor.growatt_modbus_pv_power", 3240], ["sensor.hausverbrauch_ac", 612], ["sensor.netz_leistung", -1828], ["sensor.growatt_modbus_battery_power", 800]])
      ent(e, v, { friendly_name: e, device_class: "power", unit_of_measurement: "W", state_class: "measurement" });
    ent("sensor.growatt_modbus_battery_soc", 78, { friendly_name: "Akku", device_class: "battery", unit_of_measurement: "%" });
    for (let i = 0; i < 300; i++) ent(`sensor.fremd_${i}`, i, { friendly_name: `Fremd ${i}`, unit_of_measurement: "W", device_class: "power" });
  }

  let layout = {
    density: komfort ? "komfort" : "kompakt",
    overview_style: ov,
    header_style: hs,
    pins: { wohnzimmer: ["sensor.kamin_temperatur", "sensor.kamin_pumpe_drehzahl"], heizungsraum: ["sensor.fbh_vorlauf_soll"], einfahrt: ["sensor.evcc_ladeleistung"] },
    favorites: ["scene.wohnzimmer_gemutlich", "sensor.kamin_temperatur", "lock.haustur", "switch.waschmaschine"],
    header: { pv: "sensor.growatt_modbus_pv_power", battery: "sensor.growatt_modbus_battery_soc", power: "sensor.hausverbrauch_ac", grid: "sensor.netz_leistung" },
  };
  const listeners = [];
  const DE = { on: "An", off: "Aus", home: "Zuhause", not_home: "Unterwegs", unavailable: "Nicht verfügbar", unknown: "Unbekannt", locked: "Verriegelt", unlocked: "Entriegelt", docked: "Angedockt", idle: "Bereit" };
  const fmt = (st) => {
    const c = st.attributes.device_class, s = st.state;
    if (st.entity_id.startsWith("binary_sensor.")) {
      if (["door", "window", "opening", "garage_door"].includes(c)) return s === "on" ? "Offen" : "Geschlossen";
      if (c === "motion") return s === "on" ? "Bewegung" : "Keine Bewegung";
      if (["smoke", "moisture", "gas"].includes(c)) return s === "on" ? "Erkannt" : "Normal";
    }
    const v = parseFloat(s), u = st.attributes.unit_of_measurement;
    if (Number.isFinite(v) && u) return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(v)} ${u}`;
    return DE[s] || s;
  };
  const hass = {
    states, entities, devices, areas, floors,
    panels: {
      "solar-visualisierung": { component_name: "custom", url_path: "solar-visualisierung", title: "Solar", icon: "mdi:solar-power-variant",
        config: { theme: "", _panel_custom: { name: "solar-test-panel", module_url: "./test-panels.js", embed_iframe: false } } },
      "protect-visualisierung": { component_name: "custom", url_path: "protect-visualisierung", title: "Kameras", icon: "mdi:cctv",
        config: { _panel_custom: { name: "protect-test-panel", module_url: "./test-panels.js", embed_iframe: false } } },
      "lovelace": { component_name: "lovelace", url_path: "lovelace", title: "Übersicht", config: { mode: "storage" } },
      "dashboard-import": { component_name: "lovelace", url_path: "dashboard-import", title: "Kamera", config: { mode: "storage" } },
      "hausframe": { component_name: "iframe", url_path: "hausframe", title: "Rahmen", config: { url: "/fake-ha.html" } },
      "map": { component_name: "map", url_path: "map", title: "Karte", config: null },
    },
    config: { latitude: 50.1, longitude: 8.7, time_zone: "Europe/Berlin", unit_system: { temperature: "°C" } },
    user: { is_admin: true, name: "Tobias" }, language: "de", themes: { darkMode: true, themes: {} },
    formatEntityState: fmt,
    callService: async (d, svc, data) => { api.log.push([d, svc, data]); api.applyService(d, svc, data); },
    callWS: async (msg) => {
      if (msg.type.endsWith("/alarm_action")) { api.log.push(["ws", "alarm_action", msg]); return api.alarmAction(msg); }
      if (msg.type.endsWith("/set_mode")) {
        api.log.push(["ws", "set_mode", msg]);
        const prev = (api.alarmSnap.mode || {}).mode || "zuhause";
        api.alarmSnap.mode = { ...(api.alarmSnap.mode || {}), mode: msg.mode, since: Date.now() / 1000, by: "Tobias" };
        api.alarmSnap.log = [...api.alarmSnap.log, { ts: Date.now() / 1000, type: "modus", key: "modus", title: `Hausmodus: ${msg.mode[0].toUpperCase()}${msg.mode.slice(1)}`, level: "info", user: "Tobias", mode: msg.mode, previous: prev }];
        api.alarmPush();
        return api.alarmSnap.mode;
      }
      if (msg.type.endsWith("/action_test")) {
        api.log.push(["ws", "action_test", msg]);
        const A = msg.action || {};
        if (A.type === "knx" && !A.address) { const e = new Error("Aktion unvollständig (Entität, Gruppenadresse oder TTS-Dienst fehlt)"); e.code = "invalid"; throw e; }
        return { calls: A.type === "knx" ? [{ domain: "knx", service: "send", data: { address: A.address, payload: A.payload } }] : [{ domain: "script", service: "turn_on", data: {} }] };
      }
      if (msg.type.endsWith("/alarm_code")) { api.log.push(["ws", "alarm_code", msg]); api.alarmSnap.mode = { ...(api.alarmSnap.mode || {}), code: !!msg.code }; api.alarmPush(); return { code: !!msg.code }; }
      if (msg.type.endsWith("/alarm_log")) { api.log.push(["ws", "alarm_log", msg]); return { log: api.alarmSnap.log.filter((e) => e.ts >= Date.now() / 1000 - msg.days * 86400), stats: api.alarmStats || [] }; }
      if (msg.type.endsWith("/push_info")) return { services: ["mobile_app_iphone_tobias", "mobile_app_pixel", "persistent_notification"], targets: ["mobile_app_iphone_tobias", "mobile_app_pixel"], active: [] };
      if (msg.type.endsWith("/push_test")) { api.log.push(["ws", "push_test", {}]); return { targets: (layout.push && layout.push.targets && layout.push.targets.length) ? layout.push.targets : ["mobile_app_iphone_tobias", "mobile_app_pixel"] }; }
      if (msg.type.endsWith("/save")) { layout = msg.layout; return { layout }; }
      // Recorder: 5-Minuten-Statistik nur für Sensoren mit state_class, sonst Verlauf (wie Home Assistant)
      if (msg.type === "recorder/statistics_during_period") {
        api.log.push(["ws", "statistics", { ids: msg.statistic_ids, period: msg.period, start: msg.start_time, units: msg.units }]);
        if (api.noRecorder) return {};
        const t0 = Date.parse(msg.start_time), out = {};
        // 5 Minuten (24 h) wie bisher; Langzeitstatistik stündlich bzw. täglich: Mittel aus mehreren Stützstellen,
        // dazu ein Jahresgang (PV im Sommer mehr), damit Wochen- und Jahresansicht nicht nur Kopien eines Tages zeigen
        const step = { hour: 3600000, day: 86400000 }[msg.period] || 300000;
        const season = (e, t) => (step > 300000 && /pv_power/.test(e) ? 0.55 + 0.45 * Math.cos((new Date(t).getMonth() - 5.5) / 12 * 2 * Math.PI) : 1);
        for (const e of msg.statistic_ids) {
          const st = hass.states[e];
          if (!st || !st.attributes.state_class) continue;
          const base = parseFloat(st.state);
          out[e] = [];
          const nS = step === 86400000 ? 24 : step === 3600000 ? 4 : 1;
          for (let t = Math.ceil(t0 / step) * step; t < Date.now() - step; t += step) {
            let sum = 0; for (let i = 0; i < nS; i++) sum += api.curve(e, base, t + (i + 0.5) * step / nS);
            out[e].push({ start: t, end: t + step, mean: (sum / nS) * season(e, t) });
          }
        }
        return out;
      }
      if (msg.type === "history/history_during_period") {
        api.log.push(["ws", "history", { ids: msg.entity_ids }]);
        if (api.noRecorder) return {};
        const t0 = Date.parse(msg.start_time), out = {};
        for (const e of msg.entity_ids) {
          const st = hass.states[e];
          if (!st) continue;
          const base = parseFloat(st.state);
          out[e] = [];
          for (let t = t0; t < Date.now(); t += 180000) {
            // Bad-Feuchte: zwei Stunden nicht erreichbar (Lücke im Verlauf)
            const gap = e === "sensor.bad_feuchte" && t > Date.now() - 10 * 3600000 && t < Date.now() - 8 * 3600000;
            out[e].push({ s: gap ? "unavailable" : api.curve(e, base, t).toFixed(1), lu: t / 1000 });
          }
        }
        return out;
      }
      if (msg.type === "lovelace/config") {
        api.log.push(["ws", "lovelace/config", { url_path: msg.url_path }]);
        if (msg.url_path === null) { const e = new Error("No config found."); e.code = "config_not_found"; throw e; }
        if (msg.url_path === "dashboard-import") return window.__LV_CFG__ || {
          title: "Kamera",
          views: [
            { title: "Eingang", path: "eingang", icon: "mdi:door", badges: ["sensor.aussen_temperatur", { entity: "person.tobias" }, "sensor.gibts_nicht"],
              cards: [
                { type: "picture-glance", title: "Einfahrt", camera_image: "camera.g6_einfahrt", entities: ["light.eingang"] },
                { type: "entities", title: "Tür", entities: ["lock.haustur", { entity: "switch.tueroeffner", name: "Summer" }, { type: "divider" }, "button.tuer_summer", "sensor.weg_ist_weg"] },
                { type: "vertical-stack", cards: [{ type: "tile", entity: "light.terrasse", name: "Terrassenlicht" }, { type: "custom:mushroom-light-card", entity: "light.garten_wege" }] },
                { type: "markdown", title: "Hinweis", content: "## Paketbox\nBitte **links** ablegen." },
                { type: "markdown", content: "Hallo {{ states('sensor.x') }}" },
                { type: "map", entities: ["person.tobias"] },
                { type: "custom:advanced-camera-card", cameras: [{ camera_entity: "camera.g6_entry" }] },
              ] },
            { title: "Haus", path: "haus", type: "sections", sections: [
                { type: "grid", cards: [{ type: "heading", heading: "Wohnen", icon: "mdi:sofa" }, { type: "tile", entity: "light.wohnzimmer_decke" }, { type: "area", area: "kuche" }] },
                { type: "grid", cards: [{ type: "heading", heading: "Klima" }, { type: "thermostat", entity: "sensor.aussen_temperatur" }] },
              ] },
          ],
        };
        throw Object.assign(new Error("No config found."), { code: "config_not_found" });
      }
      return { version: window.__HAUS_VIS__.VERSION, options: {}, layout };
    },
    connection: { subscribeMessage: async (cb, msg) => {
      if (msg && msg.type === "weather/subscribe_forecast") {
        api.log.push(["ws", "subscribe_forecast", { entity_id: msg.entity_id, forecast_type: msg.forecast_type }]);
        api.fcCbs.push(cb); setTimeout(() => cb({ type: msg.forecast_type, forecast: api.forecast }), 0);
        return () => { api.fcCbs = api.fcCbs.filter((c) => c !== cb); };
      }
      if (msg && msg.type && msg.type.endsWith("/alarms_subscribe")) { api.alarmCb = cb; setTimeout(() => cb(api.alarmSnap), 0); return () => { api.alarmCb = null; }; }
      setTimeout(() => cb({ version: window.__HAUS_VIS__.VERSION, options: {}, layout }), 0); return () => {}; } },
  };
  const api = {
    hass, log: [],
    // Vorhersage (täglich): heute, morgen … – mild; Tests setzen mit fcSet([[hoch, tief, Lage], …]) andere Werte
    forecast: [], fcCbs: [],
    fcSet(rows) {
      const d0 = new Date(); d0.setHours(12, 0, 0, 0);
      api.forecast = rows.map(([hi, lo, cond, rain], i) => ({ datetime: new Date(d0.getTime() + i * 86400000).toISOString(), temperature: hi, templow: lo, condition: cond, precipitation: rain || 0 }));
      api.fcCbs.forEach((cb) => cb({ type: "daily", forecast: api.forecast }));
    },
    set(eid, state, attrs) {
      const old = hass.states[eid];
      const st = { entity_id: eid, ...old, state: String(state), attributes: { ...((old && old.attributes) || {}), ...(attrs || {}) }, last_changed: new Date().toISOString() };
      hass.states = { ...hass.states, [eid]: st };
      api.hass = hass; listeners.forEach((l) => l({ ...hass }));
    },
    onChange(l) { listeners.push(l); },
    /** Tagesverlauf für Testdaten: endet beim aktuellen Wert. */
    curve(eid, base, t) {
      if (/(_power|_leistung|verbrauch)/.test(eid)) {
        // Leistung: Tagesgang mit großer Amplitude, PV nie negativ
        const ph = (s) => Math.sin(((new Date(s).getHours() + new Date(s).getMinutes() / 60) - 7) / 24 * 2 * Math.PI);
        if (/pv_power/.test(eid)) {
          // PV: Sonnenbogen 7–19 Uhr, endet beim aktuellen Wert, wenn gerade Tag ist
          const sun = (s) => { const hh = new Date(s).getHours() + new Date(s).getMinutes() / 60; return Math.max(0, Math.sin((hh - 7) / 12 * Math.PI)); };
          return sun(t) * (sun(Date.now()) > 0.1 ? base / sun(Date.now()) : 6000);
        }
        return base + (Math.abs(base) * 0.5 + 300) * (ph(t) - ph(Date.now()));
      }
      const hum = /feuchte|humid/.test(eid), amp = hum ? 6 : 1.4;
      const ph = (s) => Math.sin(((new Date(s).getHours() + new Date(s).getMinutes() / 60) - 9) / 24 * 2 * Math.PI);
      return base + amp * (ph(t) - ph(Date.now())) + (hum ? 1.5 : 0.15) * Math.sin(t / 2.7e6);
    },
    /* nachgebautes Alarm-Backend (alarms.py) */
    alarmSnap: (() => { try { const s = JSON.parse(sessionStorage.getItem("hv-alarms")); if (s) return s; } catch (e) { /* neu */ } return { rev: 0, alarms: {}, log: [], today: { alarm: 0, warn: 0, info: 0 }, mode: { mode: "zuhause", since: 0, by: "Automatik", panel: null, sync: false, code: false } }; })(),
    alarmPush() { api.alarmSnap = { ...api.alarmSnap, rev: api.alarmSnap.rev + 1 }; try { sessionStorage.setItem("hv-alarms", JSON.stringify(api.alarmSnap)); } catch (e) { /* egal */ } if (api.alarmCb) api.alarmCb(api.alarmSnap); },
    alarmAdd(key, level, title, extra = {}) {
      const now = Date.now() / 1000;
      api.alarmSnap.alarms = { ...api.alarmSnap.alarms, [key]: { key, level, title, status: "neu", since: now - 300, ...extra } };
      api.alarmSnap.log = [...api.alarmSnap.log, { ts: now - 300, type: "neu", key, title, level }];
      api.alarmSnap.today = { ...api.alarmSnap.today, [level]: (api.alarmSnap.today[level] || 0) + 1 };
      api.alarmPush();
    },
    alarmAction(msg) {
      const now = Date.now() / 1000, A = { ...api.alarmSnap.alarms };
      const one = (key, action) => {
        const P = document.querySelector("haus-visualisierung-panel");
        const ev = !A[key] && P && P._model ? window.__HAUS_VIS__.evalAlertsAll(P._hass, P._model, P._layout).find((x) => x.key === key) : null;
        const a = A[key] ? { ...A[key] } : { key, status: "neu", since: now, level: ev ? ev.level : "warn", title: ev ? ev.title : key };
        if (action === "ack") Object.assign(a, { status: "quittiert", ack_by: "Tobias", ack_at: now });
        if (action === "mute") Object.assign(a, { status: "stumm", mute_until: msg.until === "resolved" ? 0 : msg.until === "morning" ? now + 36000 : now + (msg.minutes || 60) * 60 });
        if (action === "unmute") { a.status = a.ack_at ? "quittiert" : "neu"; delete a.mute_until; }
        A[key] = a;
        api.alarmSnap.log = [...api.alarmSnap.log, { ts: now, type: { ack: "quittiert", mute: "stumm", unmute: "stumm_aus" }[action], key, title: a.title, level: a.level, user: "Tobias", until: a.mute_until }];
        return a;
      };
      let res;
      if (msg.action === "ack_all") {
        // wie das Backend: alle aktiven Meldungen kennen (hier aus der Auswertung des Panels)
        const P = document.querySelector("haus-visualisierung-panel");
        for (const a of window.__HAUS_VIS__.evalAlertsAll(P._hass, P._model, P._layout)) if (!A[a.key]) A[a.key] = { key: a.key, level: a.level, title: a.title, status: "neu", since: now };
        for (const k of Object.keys(A)) if (A[k].status === "neu") res = one(k, "ack");
        res = res || {};
      }
      else res = one(msg.key, msg.action);
      api.alarmSnap.alarms = A;
      api.alarmPush();
      return { alarm: res };
    },
    applyService(d, svc, data) {
      const ids = [].concat(data.entity_id || []);
      for (const e of ids) {
        const st = hass.states[e]; if (!st) continue;
        if (svc === "toggle") api.set(e, st.state === "on" ? "off" : "on", e.startsWith("light.") && st.state !== "on" ? { brightness: 180 } : {});
        else if (svc === "turn_on") api.set(e, "on", data.brightness_pct ? { brightness: Math.round(data.brightness_pct * 2.55) } : {});
        else if (svc === "turn_off") api.set(e, "off");
        else if (svc === "open_cover") api.set(e, "open", { current_position: 100 });
        else if (svc === "close_cover") api.set(e, "closed", { current_position: 0 });
        else if (svc === "set_temperature") api.set(e, st.state, { temperature: data.temperature });
        else if (svc === "unlock") api.set(e, "unlocked");
        else if (svc === "lock") api.set(e, "locked");
      }
    },
  };
  api.fcSet([[8, 3, "partlycloudy"], [9, 4, "cloudy", 2], [7, 2, "rainy", 6], [6, 1, "cloudy"], [8, 2, "sunny"]]);
  return api;
}
