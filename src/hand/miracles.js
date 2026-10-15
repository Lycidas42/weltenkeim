// Wunder: Regen und Eile

import * as THREE from 'three';
import { MIRACLES, S } from '../core/state.js';
import { scene } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { heightAt, streamDist, surfaceAt } from '../world/terrain.js';
import { input } from './pointer.js';
import { CLOUD_GEOS, placeProxy, shadowProxy } from '../world/weather-fx.js';
import { addTree, treeNear, trees } from '../world/trees.js';
import { fields } from '../farm/farm.js';
import { nearBuilding } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { wishDone } from '../village/wishes.js';
import { foxCast } from '../creature/ai.js';
import { forestHelped } from '../village/forest-alert.js';

// Regenwolke des Wunders: eine dunkle Wolke aus denselben Formen
const rainCloud = new THREE.Mesh(CLOUD_GEOS[2], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, color: 0x8d98a4, transparent: true, opacity: .55, depthWrite: false })); // halb durchsichtig, damit man sieht, wo es regnet
const rainCloudSh = shadowProxy(CLOUD_GEOS[2]); rainCloud.visible = false; rainCloud.scale.setScalar(1.6); scene.add(rainCloud);
const RAIN_N = 450;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 3), 3));
const rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbfe4ff, size: .09, transparent: true, opacity: .8 }));
rainPts.visible = false; rainPts.frustumCulled = false; scene.add(rainPts);
const rain = { t: 0, x: 0, z: 0 };
const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf3c04d, transparent: true, opacity: 0, depthWrite: false }));
scene.add(ring); let ringT = 0;

function castRain(x, z) {
  rain.t = 5.5; rain.x = x; rain.z = z; rainPts.visible = true; rainCloud.visible = true;
  const p = rainGeo.attributes.position;
  for (let i = 0; i < RAIN_N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4; p.setXYZ(i, x + Math.cos(a) * r, Math.random() * 7, z + Math.sin(a) * r); }
  let rev = 0;
  for (const t of trees) { if (t.gone || (t.x - x) ** 2 + (t.z - z) ** 2 > 25) continue; if (t.alive) t.g = Math.min(1, t.g + .5); else if (!t.reserved) { t.alive = true; t.g = .35; t.stumpT = 0; rev++; } }
  let n = 0; for (let k = 0; k < 60 && n < 6; k++) { const a = Math.random() * 6.28, r = Math.random() * 4.5, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, h = heightAt(tx, tz);
    if (h < .4 || h > 3.4 || Math.hypot(tx, tz) < 8.5 || treeNear(tx, tz, .8) || streamDist(tx, tz) < 1 || nearBuilding(tx, tz, .55)) continue; if (addTree(tx, tz, .15)) n++; }
  floatText(x, surfaceAt(x, z) + 2, z, n ? `${n} neue Setzlinge` : 'Der Wald trinkt', 's');
  let wet = 0; for (const f of fields) if ((f.x - x) ** 2 + (f.z - z) ** 2 < 36) { f.water = 150; if (f.state === 'grow') f.g = Math.min(1, f.g + .12); wet++; }
  if (wet) floatText(x, surfaceAt(x, z) + 2.6, z, `${wet} ${wet === 1 ? 'Feld trinkt' : 'Felder trinken'}`, 's');
  if (n + rev > 0 || trees.some(t => t.alive && !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < 25)) wishDone('rain');
  forestHelped(x, z);
}
function castHaste(x, z) {
  ringT = 1.4; ring.position.set(x, surfaceAt(x, z) + .15, z);
  let n = 0; for (const v of villagers) if ((v.x - x) ** 2 + (v.z - z) ** 2 < 36) { v.haste = 30; n++; }
  floatText(x, surfaceAt(x, z) + 1.6, z, n ? `${n} Bewohner beflügelt` : 'Niemand in Reichweite', 's');
  if (n) wishDone('haste');
}
// Regenwolke regnet ab, Ring der Eile breitet sich aus
function updateMiracleFx(dt, t) {
  if (rain.t > 0) {
    rain.t -= dt; const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) { let y = p.getY(i) - dt * 11; if (y < surfaceAt(p.getX(i), p.getZ(i))) y = 6.5; p.setY(i, y); }
    p.needsUpdate = true; rainCloud.position.set(rain.x, 6.6 + Math.sin(t) * .1, rain.z); placeProxy(rainCloudSh, rainCloud, 1);
    rainPts.material.opacity = Math.min(.8, rain.t);
    if (rain.t <= 0) { rainPts.visible = false; rainCloud.visible = false; rainCloudSh.visible = false; }
  }
  if (ringT > 0) { ringT -= dt; const k = 1 - ringT / 1.4; ring.scale.setScalar(.2 + k * .8); ring.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * .75; }
}
function tryMiracle(p) {
  const m = MIRACLES[input.miracle];
  if (S.glaube < m.cost) { toast(`${m.label} kostet ${m.cost} Glaube. Deine Bewohner beten noch.`); return; }
  S.glaube -= m.cost;
  if (input.miracle === 'rain') castRain(p.x, p.z); else castHaste(p.x, p.z);
  foxCast(p.x, p.z);
}

export { castHaste, castRain, rain, tryMiracle, updateMiracleFx };
