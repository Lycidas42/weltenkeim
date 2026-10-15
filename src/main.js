// Start: Hauptschleife und Debug-Zugang

import { $ } from './core/util.js';
import { PROC, S, save } from './core/state.js';
import './core/noise.js';
import { camera, clock, controls, renderer, scene, sun, toScreen } from './core/render.js';
import { updateFloats, updateIncome } from './ui/feedback.js';
import { lightDir, lightRaw, setWeather, snowSkip, snowU, snowify, toggleDayNight, updateDay, weather } from './world/sky.js';
import { STREAM, depData, heightAt, updateTerrain } from './world/terrain.js';
import { updateWater, waterMat, waterU } from './world/water.js';
import { addWear, setTerrainColor, terrainColorOf, updateWear } from './world/paths.js';
import { sculpt } from './world/sculpt.js';
import { updateChips } from './world/particles.js';
import { fox } from './creature/kinds.js';
import './assets/models.js';
import './models/nature.js';
import { heldTree, input } from './hand/pointer.js';
import { clouds, updateClouds, updatePuddles, updateSnowfall, updateWeatherRain } from './world/weather-fx.js';
import { updateStatics } from './village/layout.js';
import { trees } from './world/trees.js';
import { shrine, updateShrine } from './village/shrine.js';
import { houses } from './village/houses.js';
import { farmSites, fisherSites, huts, jetties, lager } from './village/huts.js';
import { farms, fields, stock, updateFarm } from './farm/farm.js';
import { puffs, updateWorkshops } from './village/workshops.js';
import './village/build.js';
import { bushes, cover, renderNature, rocks } from './world/nature.js';
import { buildNav, findPath, navF, navV, nearBuilding, updateNav } from './world/nav.js';
import { updateCover } from './world/cover.js';
import { vAll, villagers } from './village/villagers.js';
import { updateLights } from './village/night.js';
import { hand } from './hand/hand.js';
import './creature/creature.js';
import { renderPortrait } from './ui/portrait.js';
import './creature/gestures.js';
import { fish, updateWild, wild } from './wildlife/land.js';
import { sharks, updateFish, updateSharks } from './wildlife/sea.js';
import { birds, updateBirds } from './wildlife/birds.js';
import { arrows, startFishing, updateArrows, updateFishingLines, updateSleepers, updateVillager, wish } from './village/ai.js';
import { reconcileJobs } from './village/jobs.js';
import { placeWishUI, startWish, updateWish } from './village/wishes.js';
import { renderVillagers } from './village/render.js';
import { updateVillage } from './village/economy.js';
import { foxHaul, reinforce, updateFox } from './creature/ai.js';
import { forestAlert, updateForestAlert } from './village/forest-alert.js';
import { castHaste, castRain, rain, tryMiracle, updateMiracleFx } from './hand/miracles.js';
import { throwTree, updateTrees, uprootTree } from './hand/grab.js';
import { closeSheets, openSheet, renderName, setCreature, updateCamera } from './ui/sheets.js';
import { placeFoxUI } from './ui/ring.js';
import { carryGrabbed, handHelp, harvestByHand, helpAt, setTool, updateHand, updateHandHover, updatePointer } from './hand/input.js';
import { placeFieldTags, placeForestUI, updateHud } from './ui/hud.js';
import { SLOTS, setSlot, slotState } from './core/colors.js';

setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save); addEventListener('wk-save', save); // vor dem Neuladen (Update) speichern
setTool('hand'); renderName();

let snowScanT = 0;
let drawFrames = true; // __wk.step(n, dt, false) rechnet ohne zu zeichnen (Prüflauf: Software-WebGL ist langsam)
function scanSnow() {
  snowSkip.add(waterMat); for (const m of vAll) snowSkip.add(m.material);
  hand.g.traverse(o => { if (o.material) [].concat(o.material).forEach(m => snowSkip.add(m)); });
  scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.isSkinnedMesh && !o.userData.shell && !o.userData.noSnow) [].concat(o.material).forEach(snowify); });
}
// Ein Bild: alle Bereiche fortschreiben, dann zeichnen
function frame() {
  const dt = Math.min(clock.getDelta(), .05);
  tick(dt, clock.elapsedTime);
  requestAnimationFrame(frame);
}
function tick(dt, t) {
  updatePointer(dt);
  updateIncome(dt); updateVillage(dt);
  updateNav(dt);

  updateDay(dt, t);
  updateWish(dt); updateForestAlert(dt, t);
  updateSleepers(dt);

  // villagers
  for (const v of villagers) updateVillager(v, dt, t);
  updateWear(dt);
  carryGrabbed();
  renderVillagers(dt, t);
  updateArrows(dt); updateFishingLines(t);
  updateLights(t);
  updateChips(dt);
  updateShrine(dt, t);
  renderNature(dt, t); updateCover(t); updateStatics();

  updateWorkshops(dt, t);

  updateFox(dt, t);
  updateWild(dt, t); updateFish(dt, t); updateFarm(dt, t); updateBirds(dt, t); updateSharks(dt, t);
  updateTrees(dt, t);
  updateHand(dt, t);
  updateMiracleFx(dt, t);

  updateClouds(dt); updateWeatherRain(dt); updateSnowfall(dt, t); updatePuddles(dt, t);
  if ((snowScanT -= dt) <= 0) { snowScanT = 2; scanSnow(); } // neue Gebäude und Bäume bekommen auch Schnee
  updateWater(dt, t, rain.t > 0);
  updateTerrain(dt);
  updateCamera(dt);

  placeFoxUI(dt);
  placeWishUI(); placeForestUI(); placeFieldTags(); updateHandHover(dt);

  updateFloats(dt);
  updateHud(dt, t);

  if (!drawFrames) return;
  renderer.render(scene, camera);
  if (!$('sheetFox').hidden) renderPortrait(dt, t);
}
$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 800);
// Debug-Zugang für Tests in der Konsole bzw. im Browser-Werkzeug (bewusst dauerhaft drin)
window.__wk = {
  // n Bilder ohne den Takt des Browsers durchrechnen (Tests, auch bei verborgenem Tab); draw = false zeichnet nur das letzte
  step: (n = 60, dt = 1 / 60, draw = true) => { for (let i = 0; i < n; i++) { drawFrames = draw || i === n - 1; clock.elapsedTime += dt; tick(dt, clock.elapsedTime); } drawFrames = true; },
  setSlot, slotState, SLOTS, setTerrainColor, terrainColorOf, input, S, tryMiracle, castRain, castHaste, sculpt, reinforce, setCreature, openSheet, closeSheets, uprootTree, throwTree, heldTree, startFishing, helpAt, toggleDayNight, clouds, sun, lightDir, lightRaw, PROC, puffs, handHelp, foxHaul, toScreen, birds, sharks, fields, stock, farms, farmSites, harvestByHand, nearBuilding, villagers, trees, fox, setTool, jetties, fisherSites, arrows, STREAM, wild, fish, forestAlert, depData, snowU, wish, startWish, shrine, weather, setWeather, camera, controls, huts, houses, lager, rocks, bushes, cover, navV, navF, findPath, buildNav, waterU, heightAt, reconcileJobs, addWear };
requestAnimationFrame(frame);
