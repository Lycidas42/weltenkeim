// Im Code gebaute Modelle: Bäume, Felsen, Büsche

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rnd, smooth } from '../core/util.js';
import { noise } from '../core/noise.js';
import { isMobile, scene } from '../core/render.js';
import { heightAt } from '../world/terrain.js';

// Hilfen: Geometrie ohne Index mit einer Farbe je Dreieck (Verläufe, dunklere Unterseiten, leichte Streuung), leicht verbeult
const COL = new THREE.Color(), COL2 = new THREE.Color();
const jit = (x, y, z) => .9 + .2 * (((Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453) % 1 + 1) % 1);
function paint(geo, fn, soft = false) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  if (soft) { // weich: Normalen der Grundform behalten (rund schattiert), Farbe je Ecke
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), n.getY(i), COL); col.set([COL.r, COL.g, COL.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  g.computeVertexNormals(); const n = g.attributes.normal;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    fn(x, y, z, (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3, COL);
    for (let k = 0; k < 3; k++) col.set([COL.r, COL.g, COL.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function lumpy(geo, amt, f = 2.2, seed = Math.random() * 50) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amt * noise(x * f + seed, z * f + y * f * 1.3 - seed); p.setXYZ(i, x * k, y * k, z * k); }
  return geo;
}
// Laub: von dunkel (unten) nach hell (oben), Unterseiten im Schatten
const fol = (y0, y1, dark, light) => (x, y, z, ny, c) => { c.set(dark).lerp(COL2.set(light), clamp(smooth(y0, y1, y) * .8 + (ny > .55 ? .2 : 0), 0, 1)); c.multiplyScalar((ny < -.25 ? .6 : ny < .2 ? .82 : 1) * jit(x, y, z)); };
// Laub weich: Helligkeit folgt der Normalen stufenlos (Unterseite dunkler), leichte Streuung
const folS = (y0, y1, dark, light) => (x, y, z, ny, c) => { c.set(dark).lerp(COL2.set(light), clamp(smooth(y0, y1, y) * .75 + smooth(.2, .9, ny) * .3, 0, 1)); c.multiplyScalar((.62 + .38 * smooth(-.8, .3, ny)) * (.95 + .1 * (jit(x, y, z) - .9) * 5)); };
const CROWN_DET = isMobile ? 1 : 2; // feinere Kronen am Desktop
const bark = (h, c0, c1) => (x, y, z, ny, c) => c.set(c0).lerp(COL2.set(c1), clamp(y / h, 0, 1)).multiplyScalar(jit(x, y, z));
const trunkGeo = (h, r0, r1, c0, c1, seg = 8) => paint(new THREE.CylinderGeometry(r1, r0, h, seg, 2).translate(0, h / 2, 0), bark(h, c0, c1));
const blob = (x, y, z, r, sy = 1, amt = .25, det = 1) => lumpy(new THREE.IcosahedronGeometry(r, det), amt, 3).scale(1, sy, 1).translate(x, y, z);
// Kanten bleiben trotzdem sichtbar, wo die Normalen je Dreieck berechnet sind (Felsen, Stämme); Laub ist weich schattiert
const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
const kindOf = (name, parts) => { const geo = mergeGeometries(parts), sc = new THREE.Group(); sc.add(new THREE.Mesh(geo, plantMat)); return { name, geo, scene: sc }; };
// Baumarten (Höhe etwa 1,1 im Modellraum, wie zuvor die KayKit-Bäume)
function spruce(slim) {
  const parts = [trunkGeo(.32, .055, .035, 0x4f3420, 0x6b4a2c)], n = slim ? 5 : 4;
  for (let k = 0; k < n; k++) {
    const r = (slim ? .27 : .37) * (1 - k / (n + .7)), h = slim ? .3 : .38, y = .15 + k * (slim ? .165 : .2);
    parts.push(paint(lumpy(new THREE.ConeGeometry(r, h, isMobile ? 9 : 14, 3), .07, 4).rotateY(k * .7).translate(rnd(.015), y + h / 2, rnd(.015)), folS(.1, 1.1, slim ? 0x22503e : 0x275a2e, slim ? 0x4d8a68 : 0x579b45), true));
  }
  return parts;
}
function oak() {
  const parts = [trunkGeo(.52, .075, .045, 0x4a3322, 0x6a4a30)];
  for (const [rz, ry] of [[.8, 0], [-.7, 1.4]]) parts.push(paint(new THREE.CylinderGeometry(.018, .03, .28, 5).translate(0, .14, 0).rotateZ(rz).rotateY(ry).translate(0, .36, 0), bark(.6, 0x4a3322, 0x6a4a30)));
  for (const [x, y, z, r] of [[0, .8, 0, .3], [.2, .7, .1, .22], [-.2, .72, -.06, .23], [.04, .96, -.1, .2], [-.06, .68, .2, .2], [.12, .84, -.18, .18]])
    parts.push(paint(blob(x, y, z, r, .9, .2, CROWN_DET), folS(.5, 1.12, 0x3a7a2c, 0x8dc24f), true));
  return parts;
}
function birch() {
  const h = .78, parts = [paint(new THREE.CylinderGeometry(.027, .042, h, 6, 6).translate(0, h / 2, 0), (x, y, z, ny, c) => c.set(Math.sin(y * 52 + x * 40) > .72 ? 0x3d3832 : 0xebe7dc).multiplyScalar(jit(x, y, z)))];
  for (const [x, y, z, r, sy] of [[0, .88, 0, .16, 1.5], [.1, .72, .05, .13, 1.3], [-.09, .78, -.05, .14, 1.4], [0, 1.02, .03, .11, 1.3]])
    parts.push(paint(blob(x, y, z, r, sy, .18, CROWN_DET), folS(.55, 1.15, 0x5f9a35, 0xb8da6c), true));
  return parts;
}
function fruit() {
  const parts = [trunkGeo(.36, .065, .045, 0x4e3524, 0x6e4c32)];
  for (const [x, y, z, r, sy] of [[0, .63, 0, .33, .8], [.18, .56, .1, .2, 1], [-.17, .6, -.08, .21, 1]]) parts.push(paint(blob(x, y, z, r, sy, .18, CROWN_DET), folS(.35, .9, 0x3f7f30, 0x86bd4c), true));
  for (let k = 0; k < 11; k++) { // Äpfel rundum, eher in der unteren Hälfte der Krone
    const a = k / 11 * Math.PI * 2 + rnd(.3), e = -.5 + Math.random() * .8, x = Math.cos(a) * Math.cos(e) * .35, y = .63 + Math.sin(e) * .28, z = Math.sin(a) * Math.cos(e) * .35;
    const red = Math.random() < .75; parts.push(paint(new THREE.IcosahedronGeometry(.036, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(red ? 0xc8322a : 0xe2a12f).lerp(COL2.set(0xffffff), ny > .6 ? .2 : 0)));
  }
  return parts;
}
const TK = [kindOf('Fichte', spruce(false)), kindOf('Tanne', spruce(true)), kindOf('Laubbaum', oak()), kindOf('Birke', birch()), kindOf('Obstbaum', fruit())];
const TREE_FOREST = [0, 1, 2]; // Arten, unter denen Farne wachsen
// Baumart je Ort: Nadelwald in der Höhe und in dunklen Hainen, Birkenhaine, sonst Laubwald; Obstbäume selten und nahe am Dorf
function treeKindAt(x, z) {
  const h = heightAt(x, z), n = noise(x * .09 + 40, z * .09 - 7), d = Math.hypot(x, z);
  if (d < 13.5 && Math.random() < .09) return 4;
  if (h > 1.9 || n > .25) return Math.random() < .6 ? 0 : 1;
  if (n < -.28) return Math.random() < .6 ? 3 : 2;
  return Math.random() < .7 ? 2 : Math.random() < .5 ? 0 : 3;
}
// Felsen: verbeulte, flach gedrückte Körper, grau mit hellerer Oberseite und Moos auf flachen Stellen
const rockGeo = (seed, det = 1) => paint(lumpy(new THREE.IcosahedronGeometry(1, det), .32, 1.4, seed).scale(1, .62, 1), (x, y, z, ny, c) => {
  c.set(0x76706a).lerp(COL2.set(0xa29c90), smooth(-.3, .6, y));
  if (ny > .8 && noise(x * 3 + seed, z * 3) > .05) c.lerp(COL2.set(0x5f7d3c), .4);
  c.multiplyScalar((ny < -.2 ? .7 : 1) * jit(x, y, z));
});
const ROCK_GEOS = [3, 17, 29, 41].map(sd => rockGeo(sd));
// Büsche: drei Sorten (schlicht, blühend, mit Beeren)
function bushGeo(v) {
  const parts = [], n = 4 + v;
  for (let k = 0; k < n; k++) parts.push(paint(blob(rnd(.13), .1 + Math.random() * .1, rnd(.13), .11 + Math.random() * .06, .85, .22, 1), folS(0, .32, v === 2 ? 0x2a5c27 : 0x2f6a2a, v === 2 ? 0x5e9443 : 0x6fa648), true));
  if (v) for (let k = 0; k < 12; k++) {
    const a = Math.random() * 6.28, e = Math.random() * 1.2, x = Math.cos(a) * Math.cos(e) * .2, y = .14 + Math.sin(e) * .14, z = Math.sin(a) * Math.cos(e) * .2;
    const c0 = v === 1 ? (k % 3 ? 0xf2a5c6 : 0xffffff) : (k % 2 ? 0xc0302b : 0x3b3f8f);
    parts.push(paint(new THREE.IcosahedronGeometry(v === 1 ? .022 : .018, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(c0)));
  }
  return mergeGeometries(parts);
}
const BUSH_GEOS = [0, 1, 2].map(bushGeo);
class Swarm {
  constructor(p, cap) { this.meshes = p.map(({ geo, mat }) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; }); }
  set(i, mat) { for (const m of this.meshes) m.setMatrixAt(i, mat); }
  commit(n) { for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; } }
}

export { BUSH_GEOS, COL, COL2, ROCK_GEOS, Swarm, TK, TREE_FOREST, bark, fol, jit, lumpy, paint, plantMat, rockGeo, treeKindAt };
