// Wald setzen, Felsen, Büsche, Gras und Blumen; zeichnen

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd, smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { noise } from '../core/noise.js';
import { dummy, scene } from '../core/render.js';
import { weather } from './sky.js';
import { BARE, CELL, HALF, N, heightAt, laneDist, streamDist } from './terrain.js';
import { BUSH_GEOS, COL, ROCK_GEOS, TK, TREE_FOREST, bark, fol, paint, plantMat, rockGeo } from '../models/nature.js';
import { input } from '../hand/pointer.js';
import { LAGER, MILL_POS, SHRINE_POS, ST, onSacred } from '../village/layout.js';
import { addTree, stumpSwarm, treeMeshes, treeNear, trees } from './trees.js';
import { sites } from '../village/houses.js';
import { hutSites, onFarm } from '../village/huts.js';
import { natureColor as nc, natureColors, slotId, slotMaterial } from '../core/colors.js';

for (let tries = 0; tries < 4000 && trees.length < 165; tries++) {
  const x = rnd(HALF * .9), z = rnd(HALF * .9), h = heightAt(x, z);
  if (h < .45 || h > 3.0 || Math.hypot(x, z) < 8.5 || streamDist(x, z) < 1.1 || onSacred(x, z, .9) || laneDist(x, z) < 1 || sites.some(st => Math.hypot(st.x - x, st.z - z) < 2.6) || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 3.6 || Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 2.2 || onFarm(x, z, .8) || treeNear(x, z, 1.0) || hutSites.some(st => st.used && Math.hypot(st.x - x, st.z - z) < 1.5)) continue;
  addTree(x, z, .75 + Math.random() * .25);
}
// Bauplätze, Dorfplatz und Werkstätten bleiben frei von Felsen und Büschen
const keepFree = (x, z, r = 0) => Math.hypot(x, z) < 7 || onFarm(x, z, .5 + r) || streamDist(x, z) < 1 + r || laneDist(x, z) < 1 + r || onSacred(x, z, .8 + r) || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 3.4 + r || Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 2.2 + r || hutSites.some(st => Math.hypot(st.x - x, st.z - z) < 2.2 + r) || sites.some(st => Math.hypot(st.x - x, st.z - z) < 1.4 + r) || Math.hypot(x - LAGER.x, z - LAGER.z) < 2.8 + r;
const rocks = [];
const rockMeshes = ROCK_GEOS.map(g => { const m = new THREE.InstancedMesh(g, plantMat, 60); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });
function addRock(x, z, s) { const h = heightAt(x, z); if (h < .05 || keepFree(x, z, s) || treeNear(x, z, s + .35)) return false; rocks.push({ x, z, v: rocks.length % ROCK_GEOS.length, s, r: Math.random() * 6.28, tx: rnd(.15), tz: rnd(.15), tint: .85 + Math.random() * .25 }); return true; }
// Felsen bleiben, wo sie liegen: beim ersten Start zufällig verteilt, danach aus dem Spielstand (S.rocks), damit auch
// verschobene Felsen (Kreatur, kreatur.md 3.13) nach dem Neuladen am neuen Platz liegen
const okRock = a => Array.isArray(a) && a.length >= 8 && a.every(n => typeof n === 'number' && isFinite(n));
if (Array.isArray(S.rocks) && S.rocks.length && S.rocks.every(okRock)) {
  for (const a of S.rocks) if (rocks.length < 84) rocks.push({ x: a[0], z: a[1], v: Math.abs(a[2] | 0) % ROCK_GEOS.length, s: a[3], r: a[4], tx: a[5], tz: a[6], tint: a[7] });
} else {
  for (let tries = 0; tries < 3000 && rocks.length < 24; tries++) addRock(rnd(HALF * .88), rnd(HALF * .88), .55 + Math.random() * .55); // große Findlinge
  for (let tries = 0; tries < 3000 && rocks.length < 84; tries++) { // mittlere Felsen, gern in Gruppen um die großen
    const o = Math.random() < .55 ? rocks[Math.floor(Math.random() * 24)] : null, a = Math.random() * 6.28, r = o ? o.s + .4 + Math.random() * 1.2 : 0;
    addRock(o ? o.x + Math.cos(a) * r : rnd(HALF * .88), o ? o.z + Math.sin(a) * r : rnd(HALF * .88), .2 + Math.random() * .3);
  }
}
// Farben je Instanz (Tönung); nach dem Entfernen eines Felsens neu verteilen
function recolorRocks() { const cnt = ROCK_GEOS.map(() => 0); for (const r of rocks) rockMeshes[r.v].setColorAt(cnt[r.v]++, COL.setScalar(r.tint)); for (const m of rockMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true; }
recolorRocks();
// Felsen ganz abgebaut (Steinmetz, werkstaetten.md 1)
function removeRock(r) { const i = rocks.indexOf(r); if (i < 0) return; rocks.splice(i, 1); recolorRocks(); }
const r3 = n => Math.round(n * 1000) / 1000;
onSave(() => { S.rocks = rocks.map(r => [r3(r.x), r3(r.z), r.v, r3(r.s), r3(r.r), r3(r.tx), r3(r.tz), r3(r.tint)]); });
// Büsche: gern am Waldrand, seltener auf offener Wiese
const bushes = [];
// kleine Büsche ohne eigenen Schatten (spart Rechenzeit)
const bushMeshes = BUSH_GEOS.map(g => { const m = new THREE.InstancedMesh(g, plantMat, 120); m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });
for (let tries = 0; tries < 6000 && bushes.length < 260; tries++) {
  const x = rnd(HALF * .88), z = rnd(HALF * .88), h = heightAt(x, z);
  if (h < .5 || h > 2.7 || keepFree(x, z) || treeNear(x, z, .6) || rocks.some(r => Math.hypot(r.x - x, r.z - z) < r.s + .3)) continue;
  if (Math.random() > (treeNear(x, z, 2.2) ? .8 : .22)) continue;
  bushes.push({ x, z, v: Math.random() < .55 ? 0 : Math.random() < .5 ? 1 : 2, s: .8 + Math.random() * .7, r: Math.random() * 6.28, tint: .85 + Math.random() * .3 });
}
{ const cnt = BUSH_GEOS.map(() => 0); for (const b of bushes) bushMeshes[b.v].setColorAt(cnt[b.v]++, COL.setScalar(b.tint)); }
// Bodenbewuchs: Grasbüschel, Blumen, Farne, Kiesel, Muscheln, Treibholz. Viele kleine Teile, instanziert.
// Höhe und Sichtbarkeit (nicht auf Pfaden, unter Gebäuden, Bäumen oder im Wasser) werden reihum aktualisiert.
const grassU = { uT: { value: 0 } };
function tuftGeo() {
  const pos = [], col = [], nor = [];
  for (let b = 0; b < 6; b++) {
    const a = Math.random() * 6.28, r = Math.random() * .06, x = Math.cos(a) * r, z = Math.sin(a) * r, w = .011 + Math.random() * .008, h = .07 + Math.random() * .08;
    const la = Math.random() * 6.28, lean = .02 + Math.random() * .035, ox = Math.cos(la), oz = Math.sin(la);
    pos.push(x + oz * w, 0, z - ox * w, x - oz * w, 0, z + ox * w, x + ox * lean, h, z + oz * lean);
    col.push(.5, .56, .42, .5, .56, .42, 1.06, 1.1, .92); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); // Normalen nach oben: Halme hell wie der Boden
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('slot', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(slotId('grass')), 1)); return g;
}
const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
grassMat.onBeforeCompile = sh => { // Wind: Halmspitzen wiegen sich, in Wellen über die Wiese
  sh.uniforms.uT = grassU.uT;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
    { vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]); float sw = sin(uT * 1.6 + ip.x * .45 + ip.y * .3) + .5 * sin(uT * 2.7 + ip.x * 1.3);
      transformed.x += sw * .18 * position.y; transformed.z += cos(uT * 1.3 + ip.y * .5) * .1 * position.y; }`);
  // beide Seiten der Halme wie der Boden beleuchten (sonst ist die Rückseite schwarz)
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);');
};
slotMaterial(grassMat);
const flowerGeo = mergeGeometries([
  paint(new THREE.BoxGeometry(.005, .1, .005).translate(0, .05, 0), (x, y, z, ny, c) => c.set(nc('stem', 0)), false, 'stem'),
  paint(new THREE.CircleGeometry(.026, 5).rotateX(-Math.PI / 2).translate(0, .1, 0), (x, y, z, ny, c) => c.set(0xffffff)), // Blüte: Farbe je Blume
  paint(new THREE.IcosahedronGeometry(.009, 0).translate(0, .104, 0), (x, y, z, ny, c) => c.set(nc('flower.eye')), false, 'flower.eye'),
]);
// zweite Blütenform: Kelch (Tulpe/Glocke) mit Blatt
const bellGeo = mergeGeometries([
  paint(new THREE.BoxGeometry(.005, .11, .005).translate(0, .055, 0), (x, y, z, ny, c) => c.set(nc('stem', 0)), false, 'stem'),
  paint(new THREE.ConeGeometry(.012, .05, 3).rotateZ(.9).translate(.018, .035, 0), (x, y, z, ny, c) => c.set(nc('stem', 1)), false, 'stem'),
  paint(new THREE.CylinderGeometry(.022, .01, .045, 6, 1, true).translate(0, .125, 0), (x, y, z, ny, c) => c.set(0xffffff).multiplyScalar(.8 + .2 * smooth(.1, .15, y))),
]);
const fernGeo = mergeGeometries([0, 1, 2, 3, 4, 5].map(k => paint(new THREE.ConeGeometry(.02, .17, 3).rotateX(Math.PI / 2).translate(0, 0, .085).rotateX(-.55).rotateY(k * 1.05 + rnd(.2)), fol(-.02, .1, nc('fern', 0), nc('fern', 1)), false, 'fern')));
const pebbleGeos = [5, 11].map(sd => rockGeo(sd, 0));
const shellGeo = paint(new THREE.SphereGeometry(.024, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .55, 1.25), (x, y, z, ny, c) => c.set(0xffffff).multiplyScalar(.8 + .25 * Math.abs(Math.sin(Math.atan2(z, x) * 5))));
const driftGeo = mergeGeometries([paint(new THREE.CylinderGeometry(.028, .036, .5, 6).rotateZ(Math.PI / 2), bark(.1, 'driftwood'), false, 'driftwood'), paint(new THREE.CylinderGeometry(.012, .018, .2, 5).translate(0, .1, 0).rotateZ(-.9).translate(.08, 0, 0), bark(.1, 'driftwood'), false, 'driftwood')]);
const cover = [];
function coverKind(geo, mat, items, o) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)); m.frustumCulled = false; m.receiveShadow = true; m.castShadow = !!o.shadow; m.count = items.length;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0); items.forEach((it, i) => { m.setMatrixAt(i, hide); m.setColorAt(i, COL.set(it.c ?? 0xffffff)); });
  scene.add(m); const k = { m, items, hmin: o.hmin, hmax: o.hmax, sink: o.sink || 0, lie: !!o.lie }; cover.push(k); return k;
}
{
  const BARE_AT = (x, z) => { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? 0 : BARE[j * N + i]; };
  const grassC = natureColors('grass');
  const grass = [];
  for (let tries = 0; tries < 120000 && grass.length < 12500; tries++) {
    const x = rnd(HALF * .92), z = rnd(HALF * .92), h = heightAt(x, z);
    if (h < .42 || h > 2.8) continue;
    const dens = (.3 + .7 * smooth(-.35, .45, noise(x * .22 + 5, z * .22))) * (1 - smooth(.3, .42, BARE_AT(x, z)));
    if (Math.random() > dens) continue;
    grass.push({ x, z, r: Math.random() * 6.28, s: .9 + Math.random() * .8, c: grassC[Math.floor(Math.random() * grassC.length)] });
  }
  coverKind(tuftGeo(), grassMat, grass, { hmin: .38, hmax: 2.9 });
  const PAL = natureColors('flower');
  const flowers = [];
  for (let c = 0; c < 140; c++) {
    let cx = 0, cz = 0, ok = false;
    for (let t = 0; t < 30 && !ok; t++) { cx = rnd(HALF * .85); cz = rnd(HALF * .85); const h = heightAt(cx, cz); ok = h > .5 && h < 2.2; }
    if (!ok) continue;
    const col = PAL[Math.floor(Math.random() * PAL.length)], n = 5 + Math.floor(Math.random() * 12);
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * .9; flowers.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, r: Math.random() * 6.28, s: .8 + Math.random() * .5, c: col }); }
  }
  // Blumenwiesen: einige dichte, bunte Flächen auf offenem Land, jede mit zwei, drei vorherrschenden Farben
  const bells = [];
  for (let m = 0, tries = 0; m < 7 && tries < 400; tries++) {
    const cx = rnd(HALF * .8), cz = rnd(HALF * .8), h = heightAt(cx, cz);
    if (h < .5 || h > 2 || Math.hypot(cx, cz) < 6 || onSacred(cx, cz, 2) || treeNear(cx, cz, 2.2)) continue;
    m++;
    const R = 2.2 + Math.random() * 1.8, main = [0, 1, 2].map(() => PAL[Math.floor(Math.random() * PAL.length)]);
    for (let k = 0; k < 260; k++) {
      const a = Math.random() * 6.28, r = Math.pow(Math.random(), .65) * R, x = cx + Math.cos(a) * r * (1 + .3 * Math.sin(a * 3)), z = cz + Math.sin(a) * r;
      const col = Math.random() < .8 ? main[k % 3] : PAL[Math.floor(Math.random() * PAL.length)];
      (Math.random() < .55 ? flowers : bells).push({ x, z, r: Math.random() * 6.28, s: .75 + Math.random() * .55, c: col });
    }
  }
  coverKind(flowerGeo, plantMat, flowers, { hmin: .45, hmax: 2.6 });
  coverKind(bellGeo, plantMat, bells, { hmin: .45, hmax: 2.6 });
  const ferns = [];
  for (const t of trees) if (TREE_FOREST.includes(t.type) && Math.random() < .55) for (let k = 0; k < 1 + (Math.random() < .4); k++) { const a = Math.random() * 6.28, r = .35 + Math.random() * .5; ferns.push({ x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r, r: Math.random() * 6.28, s: .8 + Math.random() * .6, c: 0xffffff }); }
  coverKind(fernGeo, plantMat, ferns, { hmin: .45, hmax: 2.9 });
  const pebbles = [[], []];
  for (let k = 0; k < 760; k++) {
    let x, z; const u = Math.random();
    if (u < .45 && rocks.length) { const o = rocks[Math.floor(Math.random() * rocks.length)], a = Math.random() * 6.28, r = o.s * (1.05 + Math.random() * .9); x = o.x + Math.cos(a) * r; z = o.z + Math.sin(a) * r; }
    else { x = rnd(HALF * .9); z = rnd(HALF * .9); const h = heightAt(x, z); if (!(h > -.05 && h < .45) && BARE_AT(x, z) < .3) { k--; continue; } }
    pebbles[k % 2].push({ x, z, r: Math.random() * 6.28, s: .05 + Math.random() * .08, c: COL.setScalar(.85 + Math.random() * .3).getHex() });
  }
  pebbles.forEach((pb, k) => coverKind(pebbleGeos[k], plantMat, pb, { hmin: -.08, hmax: 4.5, sink: .25 }));
  const shells = [], drift = [], SH = natureColors('shell');
  for (let tries = 0; tries < 8000 && shells.length < 170; tries++) { const x = rnd(HALF * .95), z = rnd(HALF * .95), h = heightAt(x, z); if (h > -.04 && h < .3) shells.push({ x, z, r: Math.random() * 6.28, s: .7 + Math.random() * .6, c: SH[Math.floor(Math.random() * SH.length)] }); }
  for (let tries = 0; tries < 8000 && drift.length < 18; tries++) { const x = rnd(HALF * .95), z = rnd(HALF * .95), h = heightAt(x, z); if (h > .02 && h < .22) drift.push({ x, z, r: Math.random() * 6.28, s: 1 + Math.random() * .7, c: 0xffffff }); }
  coverKind(shellGeo, plantMat, shells, { hmin: -.06, hmax: .4 });
  coverKind(driftGeo, plantMat, drift, { hmin: -.02, hmax: .35, sink: -.03, shadow: true });
}

// Bäume (wachsen, wackeln beim Ausreißen, Stümpfe verrotten), Felsen und Büsche folgen dem geformten Gelände
function renderNature(dt, t) {
  const tc2 = TK.map(() => 0); let sc = 0;
  for (const tr of trees) {
    if (tr.gone) continue;
    const y = heightAt(tr.x, tr.z);
    if (y < .05) { tr.gone = true; if (tr.reserved && tr.reserved !== 'fox') tr.reserved.tree = null; tr.reserved = null; continue; }
    if (tr.alive) {
      if (tr.g < 1) tr.g = Math.min(1, tr.g + dt * .008 * (1 + 2 * weather.rain)); // Regen lässt Bäume schneller wachsen
      const s = ST * tr.g, pull = input.treeGrab && input.treeGrab.tr === tr ? input.treeGrab.prog : 0;
      if (tr.shake > 0) tr.shake = Math.max(0, tr.shake - dt * 3.5);
      const shk = tr.shake ? Math.sin(t * 45) * tr.shake * .045 : 0;
      dummy.position.set(tr.x, y + pull * .25, tr.z); dummy.rotation.set(Math.sin(t * 1.3 + tr.ph) * .03 + Math.sin(t * 31) * pull * .12 + shk, tr.rot, Math.sin(t * 27) * pull * .1); dummy.scale.setScalar(s); dummy.updateMatrix();
      const tm = treeMeshes[tr.type], ti = tc2[tr.type]++; tm.setMatrixAt(ti, dummy.matrix); tm.setColorAt(ti, COL.setScalar(tr.tint || 1));
    } else if (tr.stumpT > 0) {
      tr.stumpT -= dt;
      dummy.position.set(tr.x, y, tr.z); dummy.rotation.set(0, tr.rot, 0); dummy.scale.setScalar(ST); dummy.updateMatrix(); stumpSwarm.set(sc++, dummy.matrix);
    } else if (tr.regrow > 0) { tr.regrow -= dt; if (tr.regrow <= 0) { tr.alive = true; tr.g = .15; } }
    else if (!tr.reserved && Math.random() < dt / 900 * (1 + 3 * weather.rain)) { tr.alive = true; tr.g = .12; } // selten sät sich der Wald selbst aus, bei Regen öfter
  }
  treeMeshes.forEach((m, k) => { m.count = tc2[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }); stumpSwarm.commit(sc);
  const rc = ROCK_GEOS.map(() => 0);
  for (const r of rocks) { const y = heightAt(r.x, r.z) + (r.lift || 0); dummy.position.set(r.x, y - r.s * .28, r.z); dummy.rotation.set(r.tx, r.r, r.tz); dummy.scale.setScalar(r.s); dummy.updateMatrix(); rockMeshes[r.v].setMatrixAt(rc[r.v]++, dummy.matrix); }
  rockMeshes.forEach((m, k) => { m.count = rc[k]; m.instanceMatrix.needsUpdate = true; });
  const bc = BUSH_GEOS.map(() => 0);
  for (const b of bushes) { const y = heightAt(b.x, b.z); dummy.position.set(b.x, y, b.z); dummy.rotation.set(Math.sin(t * 1.1 + b.r * 3) * .03, b.r, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); bushMeshes[b.v].setMatrixAt(bc[b.v]++, dummy.matrix); }
  bushMeshes.forEach((m, k) => { m.count = bc[k]; m.instanceMatrix.needsUpdate = true; });
}

export { bushes, cover, grassU, removeRock, renderNature, rocks };
