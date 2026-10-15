// Schrein, heilige Requisiten, Lichtfunken

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../core/util.js';
import { S } from '../core/state.js';
import { dummy, scene } from '../core/render.js';
import { glowTex } from '../world/sky.js';
import { SACRED_SEG, heightAt } from '../world/terrain.js';
import { BUSH_GEOS, COL, TK, paint, plantMat } from '../models/nature.js';
import { PLAZA, SHRINE_POS, SHRINE_ROT, ST, place, shrinePt, statics } from './layout.js';

// Schrein des Weltenkeims, das Herz der Insel: dreistufiger Sockel mit Goldkanten, sechs Runensteine mit Blumengirlanden,
// Säule mit goldener Schale, darüber schwebt der leuchtende Keim mit einem Spross, umkreist von Lichtringen.
// Davor Opfergaben und Kerzen, dahinter zwei Banner. Jede Weihestufe (S.temple) lässt eine weitere Rune aufleuchten.
const staticLights = []; // { x, y, z, s } Lichter, die nachts einen Schein werfen (Kerzen, Feuerschalen, Laternen)
const shrine = (() => {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, flatShading: true }, o));
  const stoneL = M(0xd8d1c1), stone = M(0xbdb6a6), stoneD = M(0x8f897e), wood = M(0x5e3d24), cloth = M(0x2d4f8f, { side: THREE.DoubleSide });
  const gold = M(0xdcb24c, { metalness: .3, roughness: .35, emissive: 0x4a3608, emissiveIntensity: .7 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false });
  const add = (geo, m, x = 0, y = 0, z = 0, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
  const hex = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 6).rotateY(Math.PI / 6); // flache Seite nach vorn
  // drei Stufen mit Goldkante, Treppenstufen nach vorn
  for (const [r0, r1, y, m] of [[1.5, 1.6, 0, stoneL], [1.08, 1.16, .15, stone], [.68, .74, .3, stoneL]]) {
    add(hex(r0, r1, .15), m, 0, y + .075); add(new THREE.CylinderGeometry(r0 + .012, r0 + .012, .035, 6, 1, true).rotateY(Math.PI / 6), gold, 0, y + .135); // Goldkante nur am Rand
    add(new THREE.BoxGeometry(.8, .075, .18), m, 0, y + .0375, r1 * .866 + .07);
  }
  // Säule mit Goldbändern und Schale
  add(new THREE.CylinderGeometry(.15, .21, .52, 8), stoneL, 0, .45 + .26);
  for (const y of [.52, .9]) add(new THREE.CylinderGeometry(.19, .19, .035, 8), gold, 0, y);
  add(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.14, 0), new THREE.Vector2(.3, .1), new THREE.Vector2(.36, .19), new THREE.Vector2(.33, .2)], 12), gold, 0, .96);
  // Runensteine
  const runeOff = M(0x4a5b66, { roughness: .6 }), runeOn = M(0x9fdcff, { emissive: 0x4fb4ff, emissiveIntensity: 1.6, roughness: .4 });
  const runes = [], tops = [];
  for (let k = 0; k < 6; k++) {
    const a = (k + .5) / 6 * Math.PI * 2, R = 1.3, h = .62 + (k % 2) * .08, m = new THREE.Group();
    m.position.set(Math.sin(a) * R, .15, Math.cos(a) * R); m.rotation.set(rnd(.05), a, rnd(.05)); g.add(m);
    m.add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .14, h, 4, 1).translate(0, h / 2, 0), stoneD));
    add(new THREE.ConeGeometry(.085, .09, 4), gold, 0, h + .04, 0, m);
    const rg = mergeGeometries([new THREE.BoxGeometry(.035, .23, .02), new THREE.BoxGeometry(.025, .1, .02).rotateZ(.7).translate(.035, .06, 0), new THREE.BoxGeometry(.025, .1, .02).rotateZ(-.7).translate(-.035, .06, 0)]);
    const r = new THREE.Mesh(rg.translate(0, h * .5, 0), runeOff); r.position.z = .105; r.rotation.x = -.085; m.add(r); runes.push(r);
    tops.push(new THREE.Vector3(Math.sin(a) * R, .15 + h - .06, Math.cos(a) * R));
  }
  // Blumengirlanden zwischen den Runensteinen (durchhängend, bunte Blüten mit Blättern)
  const FL = [0xf6f3e8, 0xf2cf3a, 0xec86ad, 0x9c82dc, 0xdc4a3c], gp = [];
  for (let k = 0; k < 6; k++) {
    const A = tops[k], B = tops[(k + 1) % 6];
    for (let i = 1; i < 10; i++) {
      const u = i / 10, x = A.x + (B.x - A.x) * u, z = A.z + (B.z - A.z) * u, y = A.y + (B.y - A.y) * u - Math.sin(u * Math.PI) * .2;
      gp.push(paint(new THREE.IcosahedronGeometry(i % 2 ? .034 : .026, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(i % 2 ? FL[(k + i) % 5] : 0x4f8d3a)));
    }
  }
  add(mergeGeometries(gp), plantMat);
  // Opfergaben: Blumensträuße und Kerzen auf der zweiten Stufe
  for (const [x, z, sc] of [[-.62, .62, .42], [.62, .62, .42], [-.9, -.2, .36], [.9, -.2, .36]]) { const b = add(BUSH_GEOS[1], plantMat, x, .3, z); b.scale.setScalar(sc); }
  const flames = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 6 - .5) * 1.7, x = Math.sin(a) * .9, z = Math.cos(a) * .9, h = .07 + (k % 3) * .03;
    add(new THREE.CylinderGeometry(.022, .024, h, 6), M(0xf3ead6), x, .3 + h / 2, z);
    const f = add(new THREE.ConeGeometry(.018, .05, 5), flameM, x, .3 + h + .03, z); flames.push(f);
    staticLights.push({ x, y: .3 + h + .03, z, s: .2, local: true });
  }
  // zwei Banner hinter dem Schrein
  const banners = [];
  for (const sx of [-1, 1]) {
    const px = sx * 1.05, pz = -1.55;
    add(new THREE.CylinderGeometry(.025, .03, 1.75, 6), wood, px, .875, pz); add(new THREE.SphereGeometry(.05, 8, 6), gold, px, 1.78, pz);
    add(new THREE.BoxGeometry(.42, .03, .03), wood, px, 1.62, pz);
    const bg = paint(new THREE.PlaneGeometry(.36, .78, 2, 6).translate(0, -.39, 0), (x, y, z, ny, c) => c.set(Math.abs(x) > .14 || y < -.72 ? 0xdcb24c : y > -.5 && y < -.32 && Math.abs(x) < .06 ? 0xffe7a8 : 0x2d4f8f));
    const b = add(bg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9, flatShading: true }), px, 1.6, pz + .03); banners.push(b);
  }
  // der Keim: schwebt über der Schale, ein Spross bricht aus ihm hervor, zwei Lichtringe kreisen
  const core = new THREE.Group(); core.position.y = 1.55; g.add(core);
  const seed = add(new THREE.IcosahedronGeometry(.15, 0).scale(1, 1.35, 1), M(0xffe7a8, { emissive: 0xffb83d, emissiveIntensity: 1.1, roughness: .3 }), 0, 0, 0, core);
  const sproutM = M(0x9be06a, { emissive: 0x3f8a1e, emissiveIntensity: .6 });
  const sprout = new THREE.Group(); sprout.position.y = .17; core.add(sprout);
  add(new THREE.CylinderGeometry(.012, .016, .2, 5).translate(0, .1, 0), sproutM, 0, 0, 0, sprout);
  for (const sx of [-1, 1]) { const l = add(new THREE.SphereGeometry(.06, 6, 4).scale(1.4, .25, .7).translate(sx * .07, 0, 0), sproutM, 0, .19, 0, sprout); l.rotation.z = sx * -.45; }
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rings = [add(new THREE.TorusGeometry(.34, .011, 6, 48), ringM, 0, 0, 0, core), add(new THREE.TorusGeometry(.46, .008, 6, 56), ringM, 0, 0, 0, core)];
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc870, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 }));
  halo.scale.setScalar(1.3); core.add(halo);
  // Lichtpollen steigen aus der Schale auf
  const POL = 26, polGeo = new THREE.BufferGeometry(), polPos = new Float32Array(POL * 3), pol = [];
  for (let i = 0; i < POL; i++) pol.push({ a: Math.random() * 6.28, t: Math.random(), r: .1 + Math.random() * .25, sp: .25 + Math.random() * .25 });
  polGeo.setAttribute('position', new THREE.BufferAttribute(polPos, 3));
  const pollen = new THREE.Points(polGeo, new THREE.PointsMaterial({ color: 0xffe08a, size: .07, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex, toneMapped: false }));
  pollen.frustumCulled = false; g.add(pollen);
  g.traverse(o => { if (o.isMesh && o.material !== ringM && o.material !== flameM) { o.castShadow = true; o.receiveShadow = true; } });
  g.rotation.y = SHRINE_ROT; scene.add(g); statics.push({ o: g, x: SHRINE_POS.x, z: SHRINE_POS.z });
  staticLights.push({ x: 0, y: 1.55, z: 0, s: 4, local: true, gold: true });
  for (const L of staticLights) if (L.local) { const w = shrinePt(L.x, L.z); L.x = w.x; L.z = w.z; } // Schreinlichter in Weltkoordinaten
  return { g, seed, halo, runes, runeOn, runeOff, pulse: 0, core, sprout, rings, flames, banners, pol, polPos, pollen };
})();
// Prozessionsweg: Steinplatten, Steinlaternen zu beiden Seiten, Feuerschalen am Platz, Torbogen am Dorfrand
const sacredProps = (() => {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, flatShading: true }, o));
  const stoneD = M(0x9a9385), wood = M(0x6b3e26), gold = M(0xdcb24c, { metalness: .3, roughness: .35, emissive: 0x4a3608, emissiveIntensity: .7 });
  const glass = new THREE.MeshBasicMaterial({ color: 0xffd78a, toneMapped: false }), flameM = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
  // Steinplatten: auf dem Weg, rund um den Schrein und als Pflaster des Dorfplatzes
  const G = SACRED_SEG, px = -G.uz, pz = G.ux, rot = Math.atan2(G.ux, G.uz), at = (s0, u) => ({ x: G.ax + G.ux * s0 + px * u, z: G.az + G.uz * s0 + pz * u });
  const slabs = [];
  for (let s0 = .1; s0 < G.len + .05; s0 += .3) for (let u = -.45 + ((Math.round(s0 / .3) % 2) ? .07 : 0); u < .5; u += .3) { const q = at(s0, u); slabs.push({ x: q.x + rnd(.02), z: q.z + rnd(.02), r: rot + rnd(.12), s: .9 + Math.random() * .2 }); }
  const ring = (cx, cz, r0, r1) => { for (let r = r0; r < r1; r += .3) { const n = Math.round(r * Math.PI * 2 / .3); for (let k = 0; k < n; k++) { const a = (k + (Math.round(r / .3) % 2 ? .5 : 0)) / n * Math.PI * 2; slabs.push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, r: a + rnd(.1), s: .9 + Math.random() * .2 }); } } };
  ring(SHRINE_POS.x, SHRINE_POS.z, 1.72, 2.3); ring(PLAZA.x, PLAZA.z, .95, PLAZA.r);
  const slabGeo = paint(new THREE.BoxGeometry(.27, .05, .25, 1, 1, 1), (x, y, z, ny, c) => c.set(0xcfc8b8).multiplyScalar(ny > .5 ? 1 : .8));
  const slabMesh = new THREE.InstancedMesh(slabGeo, plantMat, slabs.length); slabMesh.receiveShadow = true; slabMesh.frustumCulled = false; scene.add(slabMesh);
  slabs.forEach((sl, i) => slabMesh.setColorAt(i, COL.setScalar(.85 + Math.random() * .22)));
  const group = (x, z, ry = rot) => { const o = new THREE.Group(); o.rotation.y = ry; scene.add(o); statics.push({ o, x, z }); return o; };
  const obstacles = []; // für die Wegfindung
  const add = (par, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = m !== glass && m !== flameM; par.add(o); return o; };
  // Steinlaternen
  for (const s0 of [.7, G.len * .5, G.len - .5]) for (const sx of [-1, 1]) {
    const { x, z } = at(s0, sx * .88), o = group(x, z); obstacles.push({ x, z, r: .14 });
    add(o, new THREE.BoxGeometry(.2, .06, .2), stoneD, 0, .03); add(o, new THREE.BoxGeometry(.09, .38, .09), stoneD, 0, .25);
    add(o, new THREE.BoxGeometry(.19, .16, .19), stoneD, 0, .52); add(o, new THREE.BoxGeometry(.12, .1, .2), glass, 0, .52); add(o, new THREE.BoxGeometry(.2, .1, .12), glass, 0, .52);
    add(o, new THREE.ConeGeometry(.17, .14, 4).rotateY(Math.PI / 4), stoneD, 0, .67);
    staticLights.push({ x, z, y: .52, s: .5 });
  }
  // Feuerschalen am Platz
  const fires = [];
  for (const sx of [-1, 1]) {
    const { x, z } = at(G.len - .1, sx * 1.25), o = group(x, z); obstacles.push({ x, z, r: .22 });
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = add(o, new THREE.CylinderGeometry(.018, .022, .5, 5), wood, Math.sin(a) * .1, .25, Math.cos(a) * .1); leg.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25); }
    add(o, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.08, 0), new THREE.Vector2(.18, .08), new THREE.Vector2(.2, .13)], 10), gold, 0, .48);
    const f1 = add(o, new THREE.ConeGeometry(.12, .3, 7), flameM, 0, .7), f2 = add(o, new THREE.ConeGeometry(.07, .22, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0, toneMapped: false }), 0, .66);
    fires.push(f1, f2); staticLights.push({ x, z, y: .7, s: 1.1, fire: true });
  }
  // Torbogen am Beginn des Wegs, mit Girlande und goldener Tafel
  { const { x: ox, z } = at(.15, 0), o = group(ox, z, rot + Math.PI); for (const sx of [-1, 1]) { const q = at(.15, sx * .8); obstacles.push({ x: q.x, z: q.z, r: .12 }); }
    for (const sx of [-1, 1]) { add(o, new THREE.CylinderGeometry(.06, .075, 1.4, 7), wood, sx * .8, .7); add(o, new THREE.CylinderGeometry(.1, .1, .08, 7), stoneD, sx * .8, .04); }
    add(o, new THREE.BoxGeometry(2.05, .09, .15), wood, 0, 1.43); add(o, new THREE.BoxGeometry(1.75, .07, .09), wood, 0, 1.16);
    for (const sx of [-1, 1]) { const tip = add(o, new THREE.BoxGeometry(.3, .07, .15), wood, sx * 1.12, 1.47); tip.rotation.z = sx * .35; }
    add(o, new THREE.BoxGeometry(.3, .2, .03), gold, 0, 1.29, .05);
    const gp = []; for (let i = 1; i < 14; i++) { const u = i / 14, x = -.75 + 1.5 * u, y = 1.1 - Math.sin(u * Math.PI) * .22; gp.push(paint(new THREE.IcosahedronGeometry(i % 2 ? .035 : .027, 0).translate(x, y, .05), (px, py, pz, ny, c) => c.set(i % 2 ? [0xf6f3e8, 0xf2cf3a, 0xec86ad][i % 3] : 0x4f8d3a))); }
    add(o, mergeGeometries(gp), plantMat);
    staticLights.push({ x: ox, z, y: 1.05, s: .3 });
  }
  for (const sx of [-1, 1]) { const q = shrinePt(sx * 1.05, -1.55); obstacles.push({ x: q.x, z: q.z, r: .08 }); } // Bannerstangen
  // Dorflinde in der Mitte des Platzes, mit runder Bank um den Stamm
  const tree = place(TK[2], PLAZA.x, PLAZA.z, .7, ST * 2.3);
  { const o = group(PLAZA.x, PLAZA.z, 0);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = add(o, new THREE.BoxGeometry(.3, .04, .14), wood, Math.sin(a) * .5, .17, Math.cos(a) * .5); b.rotation.y = a; if (k % 2 === 0) add(o, new THREE.BoxGeometry(.04, .17, .04), wood, Math.sin(a) * .5, .085, Math.cos(a) * .5); } }
  obstacles.push({ x: PLAZA.x, z: PLAZA.z, r: .62 });
  return { slabs, slabMesh, fires, obstacles, tree };
})();
// Glaubensfunken: steigen beim Gebet vom Bewohner zum Keim auf
const MOTE_N = 40, moteMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.04, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }), MOTE_N);
moteMesh.frustumCulled = false; moteMesh.count = 0; scene.add(moteMesh);
const motes = [], moteV = new THREE.Vector3();
function spawnMote(x, y, z) { if (motes.length >= MOTE_N) motes.shift(); motes.push({ a: new THREE.Vector3(x, y, z), t: 0, side: rnd(1) }); }
let slabT = 0;
function updateShrine(dt, t) {
  const S0 = shrine, top = S0.g.position.y + 1.55, lit = Math.min(6, S.temple);
  S0.runes.forEach((r, k) => { r.material = k < lit ? S0.runeOn : S0.runeOff; });
  S0.pulse = Math.max(0, S0.pulse - dt * 1.5);
  // der Keim schwebt, der Spross wiegt sich, die Lichtringe kreisen
  S0.core.position.y = 1.55 + Math.sin(t * 1.6) * .05; S0.seed.rotation.y = t * .6; S0.sprout.rotation.set(Math.sin(t * 1.3) * .12, t * .6, Math.sin(t * 1.7) * .1);
  S0.seed.material.emissiveIntensity = 1.1 + S0.pulse * 1.4 + Math.sin(t * 2.3) * .1;
  S0.rings[0].rotation.set(1.2 + Math.sin(t * .7) * .2, t * .9, 0); S0.rings[1].rotation.set(.4, -t * .6, .6 + Math.sin(t * .5) * .3);
  S0.rings.forEach(r => r.scale.setScalar(1 + S0.pulse * .25)); S0.rings[0].material.opacity = .55 + S0.pulse * .4;
  S0.halo.scale.setScalar(1.3 + S0.pulse * .6 + Math.sin(t * 2.3) * .05);
  S0.flames.forEach((f, k) => f.scale.set(1, .8 + Math.sin(t * 13 + k * 2.1) * .2 + Math.sin(t * 23 + k) * .1, 1));
  sacredProps.fires.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 9 + k) * .08, .85 + Math.sin(t * 11 + k * 1.7) * .15 + Math.sin(t * 19 + k) * .08, 1 + Math.cos(t * 8 + k) * .08); f.rotation.y = t * 2 + k; });
  S0.banners.forEach((b, k) => { b.rotation.set(Math.sin(t * 1.4 + k) * .08, Math.sin(t * .9 + k * 2) * .15, 0); });
  // Lichtpollen steigen in Spiralen auf
  S0.pol.forEach((q, i) => { q.t += dt * q.sp; if (q.t > 1) { q.t = 0; q.a = Math.random() * 6.28; } const a = q.a + q.t * 4, r = q.r * (1 - q.t * .5); S0.polPos.set([Math.cos(a) * r, 1.05 + q.t * 1.3, Math.sin(a) * r], i * 3); });
  S0.pollen.geometry.attributes.position.needsUpdate = true; S0.pollen.material.opacity = .5 + .4 * Math.sin(t * 1.3) ** 2;
  // Steinplatten folgen dem Gelände
  slabT -= dt; if (slabT <= 0) { slabT = .5; const P = sacredProps; P.slabs.forEach((sl, i) => { dummy.position.set(sl.x, heightAt(sl.x, sl.z) + .005, sl.z); dummy.rotation.set(0, sl.r, 0); dummy.scale.set(sl.s, 1, sl.s); dummy.updateMatrix(); P.slabMesh.setMatrixAt(i, dummy.matrix); }); P.slabMesh.instanceMatrix.needsUpdate = true; }
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i]; m.t += dt / 1.1;
    if (m.t >= 1) { motes.splice(i, 1); S0.pulse = Math.min(1, S0.pulse + .35); continue; }
  }
  motes.forEach((m, i) => {
    const k = m.t, e = k * k * (3 - 2 * k), dx = SHRINE_POS.x - m.a.x, dz = SHRINE_POS.z - m.a.z;
    // Bogen nach oben, leicht seitlich geschwungen
    moteV.set(m.a.x + dx * e + dz * m.side * .25 * Math.sin(k * Math.PI), m.a.y + (top - m.a.y) * e + Math.sin(k * Math.PI) * .45, m.a.z + dz * e - dx * m.side * .25 * Math.sin(k * Math.PI));
    dummy.position.copy(moteV); dummy.rotation.set(t * 3, t * 4, 0); dummy.scale.setScalar(1 - k * .5); dummy.updateMatrix(); moteMesh.setMatrixAt(i, dummy.matrix);
  });
  moteMesh.count = motes.length; moteMesh.instanceMatrix.needsUpdate = true;
}
// Gebet: knien, Arme zum Himmel heben (Funke steigt auf), tief verbeugen, aufrichten
const PRAY_T = 1.7;
function prayPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .35) { const e = sm(p / .35); return { arm: -1.2 - 1.65 * e, splay: .1 + .35 * e, tilt: -.18 * e }; }
  if (p < .5) return { arm: -2.85, splay: .45, tilt: -.18 };
  if (p < .75) { const e = sm((p - .5) / .25); return { arm: -2.85 + .95 * e, splay: .45 - .3 * e, tilt: -.18 + .93 * e }; }
  const e = sm((p - .75) / .25); return { arm: -1.9 + .7 * e, splay: .15 - .05 * e, tilt: .75 * (1 - e) };
}

export { PRAY_T, prayPose, sacredProps, shrine, spawnMote, staticLights, updateShrine };
