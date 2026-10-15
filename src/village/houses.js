// Wohnhäuser, Brunnen, Wassermühle, Baugerüst

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { scene } from '../core/render.js';
import { GARDEN_R, HOUSE_R, heightAt, streamDist } from '../world/terrain.js';
import { flattenAt } from '../world/sculpt.js';
import { findPart, modelInfo } from '../assets/models.js';
import { COL2, paint, plantMat } from '../models/nature.js';
import { LAGER, MILL, MILL_POS, SB, SHRINE_POS, WELL, onSacred, place, statics } from './layout.js';

place('well', WELL.x, WELL.z, 0.4, 1.3);
flattenAt(MILL_POS.x, MILL_POS.z, 1.3, MILL.y); // Ufer unter dem Haus eben, knapp über dem Wasser (der Bach gräbt sein Bett gleich wieder frei)
const mill = place('hut.watermill', MILL.x, MILL.z, MILL.ry, MILL.k); // Wassermühle am Bach, Rad im Wasser
mill.gx = MILL_POS.x; mill.gz = MILL_POS.z; // Höhe vom Ufer unter dem Haus, nicht vom Bachbett
const millWheel = findPart(mill.o, 'hut.watermill', 'wheel');

const sites = [];
// 20 Plätze im Abstand von 18° auf dem Hauskreis; Schreinweg und Lager bleiben frei. Gebaut wird von Süden (Kameraseite)
// aus abwechselnd nach beiden Seiten, so wächst das Dorf gleichmäßig um den Platz.
for (let k = 0; k < 20; k++) {
  const a = (k + .5) / 20 * Math.PI * 2, x = Math.cos(a) * HOUSE_R, z = Math.sin(a) * HOUSE_R, h = heightAt(x, z);
  if (h < .3 || streamDist(x, z) < 2 || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 4.6 || Math.hypot(x - LAGER.x, z - LAGER.z) < 3 || onSacred(x, z, 1.1)) continue;
  sites.push({ x, z, ry: Math.atan2(-x, -z), a, used: false }); // Tür (+z des Modells) zum Platz
}
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
sites.sort((p, q) => angDist(p.a, Math.PI / 2) - angDist(q.a, Math.PI / 2));
const houses = [];
onSave(() => { S.houses = houses.length; });
// Nachts leuchten die Fenster: die Scheiben liegen im Texturatlas (8×4 Felder) in Spalte 6, Zeile 1
const winMask = (() => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 4; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 8, 4); g.fillStyle = '#fff'; g.fillRect(6, 1, 1, 1);
  const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; return t; })();
const houseMats = new Map();
const houseMat = m => { if (!houseMats.has(m)) { const c = m.clone(); c.emissive = new THREE.Color(0xffa94d); c.emissiveMap = winMask; c.emissiveIntensity = 0; houseMats.set(m, c); } return houseMats.get(m); };
// Tür (Andockpunkt door des Modells im Theme) in Weltkoordinaten, d = Abstand davor
function houseDoor(hs, d = .25, out = {}) {
  const door = modelInfo(hs.key).anchors.door, lx = door.x * SB, lz = door.z * SB + d, ry = hs.o.rotation.y;
  out.x = hs.x + lx * Math.cos(ry) + lz * Math.sin(ry); out.z = hs.z - lx * Math.sin(ry) + lz * Math.cos(ry); return out;
}
function freeSite() { return sites.find(s => !s.used && heightAt(s.x, s.z) > 0.25); }
// Hausgarten: Holzzaun, dunkle Beete mit Kohl, Möhren und Tomaten (eine Geometrie für alle Gärten)
const gardenGeo = (() => {
  const parts = [], W = 1.1, D = .74, woodC = 0x8a5f3a, B = (w, h, d, x, y, z, c) => parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), (px, py, pz, ny, cc) => cc.set(c).multiplyScalar(ny > .5 ? 1 : .82)));
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-D / 2, D / 2]) B(.035, .2, .035, x, .1, z, woodC);
  for (const z of [-D / 2, D / 2]) for (const y of [.08, .16]) B(W, .022, .018, 0, y, z, woodC);
  for (const x of [-W / 2, W / 2]) { B(.035, .2, .035, x, .1, 0, woodC); for (const y of [.08, .16]) B(.018, .022, D, x, y, 0, woodC); }
  B(W - .1, .04, D - .1, 0, .02, 0, 0x5c4330);
  for (let k = 0; k < 6; k++) { // Kohl
    const x = -.42 + k * .17; parts.push(paint(new THREE.IcosahedronGeometry(.055, 1).scale(1, .75, 1).translate(x, .07, -.2), (px, py, pz, ny, c) => c.set(0x77a84f).lerp(COL2.set(0xb7d98a), smooth(.03, .1, py) * .6), false, 'crop'));
  }
  for (let k = 0; k < 8; k++) { const x = -.44 + k * .125; parts.push(paint(new THREE.ConeGeometry(.025, .09, 4).translate(x, .085, 0), (px, py, pz, ny, c) => c.set(0x4f9a3a), false, 'crop')); parts.push(paint(new THREE.ConeGeometry(.015, .03, 4).rotateX(Math.PI).translate(x, .05, 0), (px, py, pz, ny, c) => c.set(0xe2802c))); }
  for (let k = 0; k < 5; k++) { // Tomatenstauden
    const x = -.38 + k * .19; parts.push(paint(new THREE.IcosahedronGeometry(.06, 0).scale(.8, 1.3, .8).translate(x, .1, .2), (px, py, pz, ny, c) => c.set(0x3f7f2e), false, 'crop'));
    for (const [dx, dy] of [[.04, .1], [-.03, .14], [.01, .06]]) parts.push(paint(new THREE.IcosahedronGeometry(.017, 0).translate(x + dx, dy, .24), (px, py, pz, ny, c) => c.set(0xd8352a)));
  }
  return mergeGeometries(parts);
})();
function addHouse(site) {
  site.used = true; const b = houses.length % 2, h = place(b ? 'house.b' : 'house.a', site.x, site.z, site.ry, SB); h.b = b;
  h.o.traverse(o => { if (o.isMesh) o.material = houseMat(o.material); });
  const back = GARDEN_R - HOUSE_R, gx = site.x - Math.sin(site.ry) * back, gz = site.z - Math.cos(site.ry) * back; // hinter dem Haus, nach außen
  if (heightAt(gx, gz) > .3 && !onSacred(gx, gz, .9) && Math.hypot(gx - SHRINE_POS.x, gz - SHRINE_POS.z) > 4) {
    flattenAt(gx, gz, 1.25); // Beetfläche eben (auch für ältere Spielstände), sonst steckt der Garten am Hang in der Erde
    const o = new THREE.Mesh(gardenGeo, plantMat); o.rotation.y = site.ry; o.castShadow = o.receiveShadow = true; scene.add(o); statics.push({ o, x: gx, z: gz }); h.garden = { x: gx, z: gz, ry: site.ry }; }
  houses.push(h); return h;
}
for (let i = 0; i < S.houses; i++) { const s = freeSite(); if (s) addHouse(s); }
S.houses = houses.length;
const build = { construction: null };
const scaff = place('scaffold', 0, 0, 0, 0.95); scaff.o.visible = false;

export { addHouse, build, freeSite, houseDoor, houseMat, houseMats, houses, mill, millWheel, scaff, sites };
