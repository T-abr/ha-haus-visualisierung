/* Haus Visualisierung – Tabelle der Bindungen: welcher Aktualisierer auf welche Entitäten hört (data-u). */

import { MODE_ICON, MODE_NAME, setIcon, setText, UPD } from "./grundlagen.js";
import { chipWatch, updateChip, updateFloor, updateFocus, updateGroupCount, updateHero, updateKChip, updateKpi, updatePerson, updateRoof, updateRoom, updateSatz, updateSecSum, updateTile, updateWeather } from "./aktualisierer.js";
import { alertWatch, curMode, navBadge, updateAlerts } from "./warnungen.js";
import { updateTrend } from "./verlauf.js";
import { techWatch, updateHeat, updateWallbox } from "./technik.js";
import { climRooms, humRooms, outdoorTempId, updateClimTrend, updateSpark } from "./klima.js";
import { shadeWatch, updateShade } from "./wetter.js";
import { fcastWatch, updateFcast } from "./prognose.js";
import { energyIds, energyWatch, updateEnDay, updateEnergy, updateEnPriceCard, updateEnTrend } from "./energie.js";
import { priceWatch, updateWbPrice } from "./strompreis.js";

Object.assign(UPD, {
  alerts: { watch: (el, c) => alertWatch(c._model, c._layout), run: updateAlerts },
  alarmpage: { watch: (el, c) => alertWatch(c._model, c._layout), run: (el, c) => c._renderAlarmPage(el) },
  navbadge: { watch: (el, c) => alertWatch(c._model, c._layout), run: navBadge },
  hmode: { watch: () => [], run: (el) => { const md = curMode(); el.dataset.mode = md; setIcon(el, "ha-icon", MODE_ICON[md]); setText(el, ".hml", MODE_NAME[md]); el.title = `Hausmodus: ${MODE_NAME[md]}`; } },
  kchip: { watch: chipWatch, run: updateKChip },
  kpi: { watch: chipWatch, run: updateKpi },
  hsatz: { watch: (el, c) => [...c._model.agg.lights, ...c._model.agg.covers, ...c._model.agg.climates, ...c._model.agg.temps], run: updateSatz },
  focus: { watch: (el, c) => [...c._model.visibleAreas.flatMap((a) => a.watch), ...alertWatch(c._model, c._layout)], run: updateFocus },
  secsum: { watch: (el, c) => [...c._model.agg.contacts, ...c._model.agg.safety], run: updateSecSum },
  tile: { watch: (el) => [el.dataset.eid], run: updateTile },
  room: { watch: (el, c) => (c._model.areas.get(el.dataset.area) || { watch: [] }).watch, run: updateRoom },
  hero: { watch: (el, c) => (c._model.areas.get(el.dataset.area) || { watch: [] }).watch, run: updateHero },
  floor: { watch: (el, c) => (c._model.floors.find((f) => f.id === el.dataset.floor) || { watch: [] }).watch, run: updateFloor },
  chip: { watch: chipWatch, run: updateChip },
  roof: { watch: (el, c) => Object.values(c._layout.header).filter(Boolean), run: updateRoof },
  weather: { watch: (el) => [el.dataset.eid], run: updateWeather },
  shade: { watch: shadeWatch, run: updateShade },
  fcast: { watch: fcastWatch, run: updateFcast },
  person: { watch: (el) => [el.dataset.eid], run: updatePerson },
  gcount: { watch: (el) => (el._eids = (el.dataset.eids || "").split(",").filter(Boolean)), run: updateGroupCount },
  heat: { watch: (el, c) => techWatch(c._model.tech && c._model.tech.heat), run: updateHeat },
  wallbox: { watch: (el, c) => techWatch(c._model.tech && c._model.tech.wb), run: updateWallbox },
  energy: { watch: (el, c) => energyWatch(c._model.energy), run: updateEnergy },
  enday: { watch: (el, c) => energyIds(c._model.energy), run: updateEnDay },
  entrend: { watch: (el, c) => energyIds(c._model.energy), run: updateEnTrend },
  enprice: { watch: (el, c) => [...new Set([...energyIds(c._model.energy), ...priceWatch(c._model.price)])], run: updateEnPriceCard },
  wbprice: { watch: (el, c) => { const m = c._model, e = m.energy; return [...priceWatch(m.price), m.tech && m.tech.wb && m.tech.wb.power, e && e.grid].filter(Boolean); }, run: updateWbPrice },
  climtrend: { watch: (el, c) => (el.dataset.kind === "h"
    ? [...humRooms(c._model).flatMap((a) => [a.humId, a.tempId]), ...(c._model._outClim || [])]
    : [...climRooms(c._model).map((a) => a.tempId), outdoorTempId(c._hass, c._model, c._layout), ...c._model.agg.climates]).filter(Boolean), run: updateClimTrend },
  spark: { watch: (el, c) => { const a = c._model.areas.get(el.dataset.area); return !a ? [] : el.dataset.kind === "h" ? [a.humId].filter(Boolean) : [a.tempId, ...a.climates].filter(Boolean); }, run: updateSpark },
  trend: { watch: (el, c) => { const a = c._model.areas.get(el.dataset.area); return a ? [a.tempId, a.humId].filter(Boolean) : []; }, run: updateTrend },
});
