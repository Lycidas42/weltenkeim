// Lager und Bauplätze der Hütten (Werkstätten, Fischer, Bauernhöfe)

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { scene } from '../core/render.js';
import { HALF, heightAt, streamDist, surfaceAt } from '../world/terrain.js';
import { model, modelInfo } from '../assets/models.js';
import { LAGER, MILL_POS, SB, SHRINE_POS, onSacred, statics } from './layout.js';
import { mill } from './houses.js';

// Punkt im Modellraum (Einheiten des Modells) eines platzierten Gebäudes in Weltkoordinaten
function localPt(e, lx, lz, out = {}) { const k = e.o.scale.x, ry = e.o.rotation.y, x = lx * k, z = lz * k; out.x = e.x + x * Math.cos(ry) + z * Math.sin(ry); out.z = e.z - x * Math.sin(ry) + z * Math.cos(ry); return out; }
// Großes zentrales Lager: offene Halle; draußen wachsen Stammstapel und Bretterstapel mit dem Bestand
const lager = (() => {
  const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true });
  const stone = mat(0xa29c90), wood = mat(0x8a5a33), wood2 = mat(0x6e4526), roof = mat(0x3f6db3), plank = mat(0xd2a46c);
  const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const W = 2.3, D = 1.4, H = .95, B = .14;
  box(W + .2, B, D + .2, stone, 0, B / 2, 0);
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) box(.1, H, .1, wood, x, B + H / 2, z);
  box(W, H * .9, .05, wood2, 0, B + H * .45, -D / 2 + .02);                              // Rückwand
  for (const sx of [-1, 1]) box(.05, H * .9, D, wood2, sx * (W / 2 - .02), B + H * .45, 0); // Seitenwände
  for (const z of [-D / 2, D / 2]) box(W + .12, .08, .08, wood, 0, B + H, z);
  const run = D / 2 + .22, ang = .62, len = run / Math.cos(ang), top = B + H + .04;
  for (const sz of [-1, 1]) box(W + .44, .07, len, roof, 0, top + Math.tan(ang) * run / 2, sz * run / 2, sz * ang);
  box(W + .48, .09, .09, wood, 0, top + Math.tan(ang) * run + .02, 0);                   // First
  const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, Math.tan(ang) * D / 2)]);
  for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: .05, bevelEnabled: false }), wood2); o.rotation.y = Math.PI / 2; o.position.set(sx * (W / 2) - .025, top - .02, 0); g.add(o); }
  // Vorräte in der Halle
  const prop = (key, x, z, ry, k) => { const o = model(key).scene.clone(true); o.position.set(x, B, z); o.rotation.y = ry; o.scale.setScalar(k * (modelInfo(key).scale || 1)); g.add(o); return o; };
  prop('prop.crate', -.8, -.38, .2, 1.6); prop('prop.crate', -.42, -.42, -.1, 1.6); prop('prop.crate', -.62, -.4, .4, 1.3).position.y = B + .32;
  prop('prop.sack', .1, -.4, .5, 1.8); prop('prop.sack', .3, -.35, -.3, 1.8); prop('prop.barrel', .65, -.38, 0, 1.6); prop('prop.barrel', .88, -.2, 0, 1.6); prop('prop.barrel', .85, -.48, 0, 1.6);
  // Stammstapel (rechts außen) und Bretterstapel (links außen)
  const logs = [], planks = [];
  for (let k = 0; k < 5; k++) { const o = model('prop.logs').scene.clone(true); o.position.set(W / 2 + .45 + (k % 2) * .05, (k >> 1) * .19, -.45 + (k % 3) * .42); o.rotation.y = Math.PI / 2; o.scale.setScalar(1.3); g.add(o); logs.push(o); }
  const pg = mergeGeometries([0, 1, 2, 3].map(k => new THREE.BoxGeometry(.62, .035, .13).translate((k % 2) * .02, .02 + k * .037, (k % 2 ? .07 : -.07))));
  for (let k = 0; k < 5; k++) { const o = new THREE.Mesh(pg, plank); o.position.set(-W / 2 - .45, (k >> 1) * .15, -.45 + (k % 3) * .42); o.rotation.y = Math.PI / 2; g.add(o); planks.push(o); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.rotation.y = Math.atan2(-LAGER.x, -LAGER.z + .4); // Front zum Dorfplatz
  scene.add(g); const e = { o: g, x: LAGER.x, z: LAGER.z, logs, planks };
  statics.push(e); return e;
})();
const lagerDrop = () => localPt(lager, rnd(.6), 1.05); // abladen vor der offenen Front
function updateLagerStock() {
  lager.logs.forEach((o, k) => { o.visible = S.logs > k * 6; });
  lager.planks.forEach((o, k) => { o.visible = S.holz > k * 12; });
}
// Hütten der Spezialisten: Modell (Schlüssel im Theme) und Größe in der Welt
const HUT = {
  lumber: { key: 'hut.lumber', k: SB },
  forester: { key: 'hut.forester', k: SB },
  sawyer: { key: 'hut.sawyer', k: 1.2 },
  hunter: { key: 'hut.hunter', k: SB },
  fisher: { key: 'hut.fisher', k: SB },
  farmer: { key: 'hut.farmer', k: SB },
  miller: { key: 'hut.miller', k: 1.6 },
  baker: { key: 'hut.baker', k: SB },
};
// Tür und Arbeitsplatz liegen im Modell: sie kommen aus dem Theme (Andockpunkte)
for (const r in HUT) Object.assign(HUT[r], modelInfo(HUT[r].key).anchors);
// Fischerplätze an der Küste: Hütte etwas landeinwärts, Tür zum Meer, ein Steg führt ins tiefere Wasser
const fisherSites = [];
for (let i = 0; i < 40; i++) {
  const a = i / 40 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
  let r = 12; while (r < HALF && heightAt(dx * r, dz * r) > .3) r += .2;
  if (r >= HALF - 1) continue;
  const sx = dx * r, sz = dz * r, hx = sx - dx * 2.4, hz = sz - dz * 2.4, h = heightAt(hx, hz);
  let slope = 0; for (const [ox, oz] of [[.8, 0], [-.8, 0], [0, .8], [0, -.8]]) slope = Math.max(slope, Math.abs(heightAt(hx + ox, hz + oz) - h));
  if (h < .35 || h > 2 || slope > .6 || -.02 - heightAt(sx + dx * 3.2, sz + dz * 3.2) < .5 || streamDist(hx, hz) < 3 || Math.hypot(hx - SHRINE_POS.x, hz - SHRINE_POS.z) < 6) continue;
  fisherSites.push({ x: hx, z: hz, ry: Math.atan2(dx, dz), used: false, a, shore: { x: sx, z: sz }, dir: { x: dx, z: dz } });
}
// Stege der Fischer: Laufhöhe für Bewohner (groundAt) und Angelplatz am Ende
const jetties = [];
function groundAt(x, z) {
  let y = surfaceAt(x, z);
  for (const J of jetties) { const rx = x - J.x, rz = z - J.z, t = rx * J.dx + rz * J.dz, u = -rx * J.dz + rz * J.dx; if (t > -.2 && t < J.len + .1 && Math.abs(u) < .32) y = Math.max(y, J.y); }
  return y;
}
const huts = [];
onSave(() => { S.hutGoods = huts.map(h => h.goods); S.hutInp = huts.map(h => h.inp | 0); });
// Werkstätten haben eigene Bauplätze am Waldrand, so nehmen sie den Wohnhäusern keinen Platz weg
const hutSites = [];
for (let i = 0; i < 18; i++) {
  const a = .15 + i / 18 * Math.PI * 2, r = 11, x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
  const slope = Math.max(...[[.8, 0], [-.8, 0], [0, .8], [0, -.8]].map(([dx, dz]) => Math.abs(heightAt(x + dx, z + dz) - h)));
  if (h > .3 && h < 2.8 && slope < .55 && streamDist(x, z) > 2.2 && Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) > 5 && Math.hypot(x - MILL_POS.x, z - MILL_POS.z) > 3) hutSites.push({ x, z, ry: -a + Math.PI / 2 + Math.PI, used: false, a });
}
// Bauernhöfe brauchen Platz: ebenes, offenes Land weiter draußen. Im Hofraum zeigt z zum Dorf: Wohnhaus vorn links,
// Weide mit Hühnerstall vorn rechts, dahinter vier Felder nebeneinander. Die Plätze werden gleich zu Beginn
// reserviert, damit dort keine Bäume, Felsen und Büsche stehen.
const FARM = { house: [-1.6, 1.35], fw: 1.4, fd: 2.0, fz: -1.5, fx: [-2.4, -.8, .8, 2.4], pen: { x0: .3, x1: 3.35, z0: .4, z1: 2.85, xm: 2.05 }, coop: [-2.85, 2.3], coopRamp: .45, trough: [1.9, 2.62], troughs: [[1.17, .8], [2.7, .7]], hay: [[3.72, .95], [3.72, 1.42]], lx0: -3.4, lx1: 3.6, lz0: -2.8, lz1: 3.15 };
const farmSites = [];
{
  const cand = [];
  for (let r = 11; r <= 19; r += .75) for (let k = 0; k < 64; k++) {
    const a = k / 64 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, ry = Math.atan2(-x, -z), c = Math.cos(ry), sn = Math.sin(ry);
    let lo = 9, hi = -9, ok = true;
    for (let lx = FARM.lx0; lx <= FARM.lx1 && ok; lx += .5) for (let lz = FARM.lz0; lz <= FARM.lz1; lz += .5) {
      const px = x + lx * c + lz * sn, pz = z - lx * sn + lz * c, h = heightAt(px, pz);
      if (h < .3 || h > 3.2 || streamDist(px, pz) < 1.2 || onSacred(px, pz, 1) || Math.hypot(px, pz) < 7.6) { ok = false; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (!ok || hi - lo > 1.5 || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 7.5 || Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 5.5) continue;
    // die ersten Hüttenplätze bleiben frei (dort stehen meist schon Hütten), spätere gibt der Hof auf
    const near = hutSites.filter(st => Math.hypot(st.x - x, st.z - z) < 5);
    if (near.some(st => hutSites.indexOf(st) < 7) || fisherSites.some(st => Math.hypot(st.x - x, st.z - z) < 5.5)) continue;
    cand.push({ x, z, ry, used: false, near, score: (hi - lo) * 3 + r * .15 + near.length * .5 });
  }
  cand.sort((a, b) => a.score - b.score);
  for (const st of cand) if (farmSites.length < 3 && farmSites.every(o => Math.hypot(o.x - st.x, o.z - st.z) > 10)) { farmSites.push(st); for (const h of st.near) h.used = true; }
}
const farmPt = (F, lx, lz, out = {}) => { const c = Math.cos(F.ry), sn = Math.sin(F.ry); out.x = F.x + lx * c + lz * sn; out.z = F.z - lx * sn + lz * c; return out; };
const onFarm = (x, z, m = 0) => farmSites.some(F => { const dx = x - F.x, dz = z - F.z, c = Math.cos(F.ry), sn = Math.sin(F.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c; return lx > FARM.lx0 - m && lx < FARM.lx1 + m && lz > (F.lz0 ?? FARM.lz0) - m && lz < FARM.lz1 + m; });
// die Sägemühle möglichst nah am Lager, Holzfäller und Förster der Reihe nach rundum
function hutSite(role) {
  if (role === 'miller' && !mill.role) return { x: MILL_POS.x, z: MILL_POS.z, ry: mill.o.rotation.y, existing: mill }; // die Wassermühle am Bach wird die erste Mühle
  if (role === 'farmer') { const F = farmSites.find(st => !st.used); if (!F) return null; const p = farmPt(F, FARM.house[0], FARM.house[1]); return { x: p.x, z: p.z, ry: F.ry, farm: F }; }
  if (role === 'fisher') { const fs = fisherSites.filter(st => !st.used && fisherSites.every(o => !o.used || Math.abs(Math.atan2(Math.sin(o.a - st.a), Math.cos(o.a - st.a))) > .5)); return fs.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] || null; }
  const free = hutSites.filter(st => !st.used); if (!free.length) return null;
  if (role !== 'sawyer') return free[0];
  return free.reduce((b, st) => (Math.hypot(st.x - LAGER.x, st.z - LAGER.z) < Math.hypot(b.x - LAGER.x, b.z - LAGER.z) ? st : b));
}

export { FARM, HUT, farmPt, farmSites, fisherSites, groundAt, hutSite, hutSites, huts, jetties, lager, lagerDrop, localPt, onFarm, updateLagerStock };
