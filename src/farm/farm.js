// Bauernhof: Felder, Feldfrüchte, Vieh, Hühnerhaus

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rnd, smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { noise } from '../core/noise.js';
import { dummy, scene } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { sky, weather } from '../world/sky.js';
import { heightAt } from '../world/terrain.js';
import { flattenAt } from '../world/sculpt.js';
import { COL, COL2, paint, plantMat } from '../models/nature.js';
import { place, statics } from '../village/layout.js';
import { clearAround } from '../world/trees.js';
import { FARM, farmPt } from '../village/huts.js';

// Gemüse: wächst unterschiedlich schnell (Sekunden bis zur Reife bei Sonne), Ertrag als Gemüse im Lager
const CROPS = [
  { label: 'Salat', grow: 85, yield: 2, rows: 4, per: 7, sp: .32 },
  { label: 'Möhren', grow: 125, yield: 3, rows: 5, per: 10, sp: .26 },
  { label: 'Kohl', grow: 190, yield: 4, rows: 4, per: 6, sp: .32 },
  { label: 'Kürbis', grow: 280, yield: 6, rows: 3, per: 4, sp: .42 },
  { label: 'Weizen', grow: 240, yield: 6, rows: 6, per: 13, sp: .22, res: 'grain' }, // Korn für die Mühle
];
const FIELD_STATES = ['leer', 'grow', 'reif'];
const FIELD_STAGES = 4; // Wachstumsstufen bis zur Reife (Regenwunder hebt ein Feld auf die nächste)
const cropGeo = (() => {
  const P = (geo, fn, slot) => paint(geo, fn, false, slot), C = (c, c2, k = 6) => (x, y, z, ny, col) => col.set(c).lerp(COL2.set(c2), clamp(y * k, 0, 1));
  const ring = (n, make) => mergeGeometries([...Array(n)].map((_, k) => make(k).rotateY(k / n * Math.PI * 2 + k * .3)));
  return [
    { // Salat: Rosette heller Blätter, in der Mitte schließt sich der Kopf
      leaf: ring(6, () => P(new THREE.SphereGeometry(1, 6, 4).scale(.038, .012, .062).rotateX(-.45).translate(0, .025, .045), C(0x6fae45, 0xb9e27e, 14), 'crop')),
      fruit: P(new THREE.SphereGeometry(.046, 8, 6).scale(1, .8, 1).translate(0, .04, 0), C(0x9fd067, 0xd6f0a4, 12)),
    },
    { // Möhren: gefiedertes Kraut, oben schaut die orange Rübe heraus
      leaf: ring(6, k => P(new THREE.ConeGeometry(.014, .13, 3).translate(0, .065, 0).rotateZ(.25 + (k % 2) * .15), C(0x3f8a32, 0x7cc25a, 8), 'crop')),
      fruit: P(new THREE.ConeGeometry(.024, .06, 6).rotateX(Math.PI).translate(0, .012, 0), C(0xd4691e, 0xf09a3e, 20)),
    },
    { // Kohl: blaugrüne Außenblätter um einen festen Kopf
      leaf: ring(6, () => P(new THREE.SphereGeometry(1, 6, 4).scale(.05, .016, .08).rotateX(-.6).translate(0, .035, .06), C(0x4f7f5c, 0x86ad8a, 10), 'crop')),
      fruit: P(new THREE.IcosahedronGeometry(.066, 1).scale(1, .9, 1).translate(0, .065, 0), C(0x8dbb78, 0xc5e0a6, 8)),
    },
    { // Kürbis: große Blätter am Boden, dazwischen wächst der Kürbis
      leaf: ring(5, () => P(new THREE.SphereGeometry(1, 7, 4).scale(.075, .012, .075).translate(0, .045, .13), C(0x3f7a2c, 0x6fa84a, 10), 'crop')),
      fruit: mergeGeometries([
        P(new THREE.SphereGeometry(.11, 12, 7).scale(1, .72, 1).translate(0, .072, 0), (x, y, z, ny, c) => c.set(0xe07a22).multiplyScalar(.82 + .18 * Math.abs(Math.cos(Math.atan2(z, x) * 4)))),
        P(new THREE.CylinderGeometry(.008, .012, .045, 5).translate(0, .16, 0), (x, y, z, ny, c) => c.set(0x6b7a3a)),
      ]),
    },
    { // Weizen: Büschel schlanker Halme (Farbe kommt je Feld: erst grün, reif golden), oben die Ähren
      leaf: mergeGeometries([...Array(7)].map((_, k) => P(new THREE.ConeGeometry(.009, .28, 3).translate(0, .135, 0).rotateZ(rnd(.18)).rotateX(rnd(.18)).translate(rnd(.03), 0, rnd(.03)), C(0xb9bfa8, 0xffffff, 5), 'wheat'))),
      fruit: mergeGeometries([...Array(7)].map((_, k) => P(new THREE.SphereGeometry(1, 5, 4).scale(.013, .038, .013).translate(Math.cos(k * 2.4) * .022 * (k % 3) / 2, .28, Math.sin(k * 2.4) * .022 * (k % 3) / 2), C(0xc99a3a, 0xf0d070, 30)))),
    },
  ];
})();
// gleiche Anordnung der Pflanzen für jedes Feld (Reihen längs des Feldes, leicht versetzt)
const CROP_LAYOUT = CROPS.map(C => { const out = []; for (let i = 0; i < C.rows; i++) for (let j = 0; j < C.per; j++) out.push({ x: (i - (C.rows - 1) / 2) * (C.sp || (FARM.fw / 3) * (C.rows === 2 ? 1.2 : 1)) + rnd(.03), z: ((j + .5) / C.per - .5) * (FARM.fd - .25) + rnd(.04), r: Math.random() * 6.28, s: .85 + Math.random() * .3 }); return out; });
const cropMeshes = cropGeo.map((g, c) => ['leaf', 'fruit'].map(k => { const m = new THREE.InstancedMesh(g[k], plantMat, 12 * CROPS[c].rows * CROPS[c].per); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, COL.set(1, 1, 1)); scene.add(m); return m; }));
const fields = [], stock = [], farms = [];
onSave(() => { S.fields = fields.map(f => [f.c, FIELD_STATES.indexOf(f.state), Math.round(f.g * 1000) / 1000]); });
const stockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true });
// Rinder, Schweine, Hühner: Körper aus einem Stück, Beine und Kopf beweglich
function makeStock(kind) {
  const g = new THREE.Group(), add = (geo, par = g) => { const o = new THREE.Mesh(geo, stockMat); o.castShadow = true; o.userData.noSnow = true; par.add(o); return o; };
  const P = (geo, c) => paint(geo, typeof c === 'function' ? c : (x, y, z, ny, col) => col.set(c));
  const legs = []; let head = null, body = null;
  const leg = (x, y, z, len, r, c, hoof) => { const L = new THREE.Group(); L.position.set(x, y, z); g.add(L); add(mergeGeometries([P(new THREE.CylinderGeometry(r, r * .8, len, 6).translate(0, -len / 2, 0), c), P(new THREE.CylinderGeometry(r * .85, r * .9, len * .12, 6).translate(0, -len * .94, 0), hoof)]), L); legs.push(L); };
  if (kind === 'kuh') {
    const seed = Math.random() * 40, spots = (x, y, z, ny, col) => col.set(noise(x * 14 + seed, z * 14 + y * 9) > .18 ? 0x2b2522 : 0xf1ede6);
    body = add(mergeGeometries([P(new THREE.SphereGeometry(1, 10, 7).scale(.15, .14, .27).translate(0, .4, 0), spots), P(new THREE.SphereGeometry(.05, 6, 4).translate(0, .27, -.1), 0xeaa3a3),
      P(new THREE.CylinderGeometry(.01, .012, .22, 4).translate(0, -.11, 0).rotateX(.25).translate(0, .45, -.27), 0x2b2522)]));
    head = new THREE.Group(); head.position.set(0, .47, .24); g.add(head);
    add(mergeGeometries([P(new THREE.BoxGeometry(.11, .12, .17).translate(0, 0, .08), spots), P(new THREE.BoxGeometry(.105, .07, .06).translate(0, -.03, .18), 0xe8b1a4),
      ...[-1, 1].map(sx => P(new THREE.ConeGeometry(.014, .06, 4).rotateZ(-sx * 1.1).translate(sx * .07, .07, .05), 0xe8dcc0)),
      ...[-1, 1].map(sx => P(new THREE.SphereGeometry(1, 5, 3).scale(.04, .015, .025).translate(sx * .08, .03, .03), 0x2b2522))]), head);
    for (const [x, z] of [[.08, .16], [-.08, .16], [.08, -.16], [-.08, -.16]]) leg(x, .33, z, .32, .032, 0xf1ede6, 0x3a302a);
    g.scale.setScalar(.82);
  } else if (kind === 'schwein') {
    body = add(mergeGeometries([P(new THREE.SphereGeometry(1, 10, 7).scale(.13, .11, .19).translate(0, .2, 0), C2(0xe9a7a0, 0xf6c3bb)),
      P(new THREE.TorusGeometry(.025, .006, 4, 8, 4.5).translate(0, .24, -.19), 0xe09a93)]));
    head = new THREE.Group(); head.position.set(0, .22, .16); g.add(head);
    add(mergeGeometries([P(new THREE.SphereGeometry(.08, 8, 6).translate(0, 0, .03), 0xeeb0a8), P(new THREE.CylinderGeometry(.036, .04, .04, 8).rotateX(Math.PI / 2).translate(0, -.015, .11), 0xd98c86),
      ...[-1, 1].map(sx => P(new THREE.ConeGeometry(.03, .06, 3).rotateX(.6).rotateZ(-sx * .4).translate(sx * .045, .065, .02), 0xe09a93))]), head);
    for (const [x, z] of [[.07, .1], [-.07, .1], [.07, -.1], [-.07, -.1]]) leg(x, .12, z, .12, .026, 0xe9a7a0, 0x8f5f58);
    g.scale.setScalar(.85);
  } else if (kind === 'hahn') { // Hahn: größer, rotbraun, hoher Kamm, Kehllappen, dunkel schillernder Schwanz
    body = new THREE.Group(); g.add(body);
    add(mergeGeometries([P(new THREE.SphereGeometry(1, 8, 6).scale(.055, .05, .07).translate(0, .11, 0), 0xa9482a), P(new THREE.SphereGeometry(1, 7, 5).scale(.032, .045, .035).translate(0, .155, .035), 0xd9893a),
      P(new THREE.SphereGeometry(.03, 7, 5).translate(0, .19, .05), 0xc9702e), P(new THREE.BoxGeometry(.01, .04, .05).translate(0, .23, .048), 0xd8352a), P(new THREE.SphereGeometry(.012, 4, 3).scale(1, 1.5, 1).translate(0, .162, .07), 0xd8352a),
      P(new THREE.ConeGeometry(.011, .028, 4).rotateX(Math.PI / 2).translate(0, .188, .088), 0xe9b53a),
      ...[-.5, 0, .5].map(a => P(new THREE.SphereGeometry(1, 5, 4).scale(.012, .07, .03).rotateX(-.5).rotateZ(a * .4).translate(a * .02, .18, -.075), 0x24423a)),
      ...[-1, 1].map(sx => P(new THREE.CylinderGeometry(.006, .006, .07, 3).translate(sx * .022, .035, 0), 0xe9b53a))]), body);
  } else { // Huhn
    const col = Math.random() < .35 ? 0xb06a35 : 0xf4f1ea;
    body = new THREE.Group(); g.add(body);
    add(mergeGeometries([P(new THREE.SphereGeometry(1, 8, 6).scale(.05, .045, .065).translate(0, .1, 0), col), P(new THREE.ConeGeometry(.035, .07, 4).rotateX(-.9).translate(0, .14, -.06), col),
      P(new THREE.SphereGeometry(.03, 7, 5).translate(0, .165, .045), col), P(new THREE.BoxGeometry(.008, .025, .035).translate(0, .195, .045), 0xd8352a),
      P(new THREE.ConeGeometry(.01, .025, 4).rotateX(Math.PI / 2).translate(0, .162, .08), 0xe9b53a), P(new THREE.SphereGeometry(.009, 4, 3).translate(0, .145, .065), 0xd8352a),
      ...[-1, 1].map(sx => P(new THREE.CylinderGeometry(.005, .005, .06, 3).translate(sx * .02, .03, 0), 0xe9b53a))]), body);
    g.scale.setScalar(.9);
  }
  scene.add(g); return { g, legs, head, body };
  function C2(a, b) { return (x, y, z, ny, col) => col.set(a).lerp(COL2.set(b), clamp((y - .15) * 8, 0, 1)); }
}
// Hof anlegen: Lichtung schlagen, einebnen, Felder mit Furchen, Weide mit Zaun, Trog, Hühnerstall, Heu, Schubkarre
function buildFarm(e, F) {
  F.used = true; clearAround(F.x, F.z, 5); flattenAt(F.x, F.z, 5.2); flattenAt(e.x, e.z, 1.9);
  e.farm = F; F.hut = e; F.fields = []; F.milk = 0; F.eggs = 0; F.pork = 0; F.feedT = 0; farms.push(F);
  const y0 = heightAt(F.x, F.z), g = new THREE.Group(), parts = [], wood = 0x8a5f3a, dark = 0x6a4428;
  const at = (lx, lz) => { const p = farmPt(F, lx, lz); return heightAt(p.x, p.z) - y0; };
  const B = (w, h, d, x, y, z, c, ry = 0) => parts.push(paint(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), (px, py, pz, ny, cc) => cc.set(c).multiplyScalar(ny > .5 ? 1 : .82)));
  // Zaun um die Weide: Pfosten, zwei Querlatten je Feld
  const { x0, x1, z0, z1, xm } = FARM.pen, post = [];
  const side = (ax, az, bx, bz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / .55)); for (let k = 0; k <= n; k++) post.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n, k < n ? [ax + (bx - ax) * (k + 1) / n, az + (bz - az) * (k + 1) / n] : null]); };
  side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0); side(xm, z0, xm, z1); // Kuhweide links, Schweinekoppel rechts
  for (const [px, pz, nx] of post) {
    const y = at(px, pz); B(.05, .34, .05, px, y + .14, pz, dark);
    if (nx) { const [qx, qz] = nx, L = Math.hypot(qx - px, qz - pz), yy = (y + at(qx, qz)) / 2, ry = Math.atan2(qx - px, qz - pz); for (const h of [.13, .25]) B(.025, .035, L, (px + qx) / 2, yy + h, (pz + qz) / 2, wood, ry); }
  }
  // Hühnerstall auf Stelzen mit Satteldach und Rampe (neben dem Haus, die Hühner laufen frei)
  { const [cx, cz] = FARM.coop, y = at(cx, cz); for (const [ox, oz] of [[-.36, -.25], [.36, -.25], [-.36, .25], [.36, .25]]) B(.06, .22, .06, cx + ox, y + .11, cz + oz, dark);
    B(.82, .42, .58, cx, y + .41, cz, 0xb5523b); for (const ox of [-.41, .41]) for (const oz of [-.29, .29]) B(.05, .44, .05, cx + ox, y + .41, cz + oz, 0xe8e0cc); // Eckbalken
    B(.15, .17, .02, cx, y + .3, cz + .295, 0x2a1e16); B(.19, .03, .03, cx, y + .4, cz + .3, 0xe8e0cc); // Tür mit Sturz
    B(.14, .1, .02, cx + .24, y + .45, cz + .295, 0xf2d48a); B(.16, .02, .03, cx + .24, y + .39, cz + .3, 0xe8e0cc); // Fensterchen
    B(.3, .2, .2, cx - .5, y + .32, cz - .08, 0xa94a35); parts.push(paint(new THREE.BoxGeometry(.34, .03, .26).rotateZ(.35).translate(cx - .5, y + .45, cz - .08), (px, py, pz, ny, cc) => cc.set(0x6e4526))); // Legenest
    for (const sx of [-1, 1]) { const r = new THREE.BoxGeometry(.94, .04, .4).rotateX(sx * .6).translate(cx, y + .74, cz + sx * .16); parts.push(paint(r, (px, py, pz, ny, cc) => cc.set(0x6e4526).multiplyScalar(ny > .3 ? 1 : .8))); }
    const gable = new THREE.Shape([new THREE.Vector2(-.29, 0), new THREE.Vector2(.29, 0), new THREE.Vector2(0, .2)]);
    for (const sx of [-1, 1]) parts.push(paint(new THREE.ExtrudeGeometry(gable, { depth: .02, bevelEnabled: false }).rotateY(Math.PI / 2).translate(cx + sx * .4 - .01, y + .62, cz), (px, py, pz, ny, cc) => cc.set(0xb5523b)));
    // Hühnerleiter von der Tür zum Boden, mit Sprossen
    const R = FARM.coopRamp, L = Math.hypot(R, .21), ang = Math.atan2(.21, R), mz = cz + .29 + R / 2;
    parts.push(paint(new THREE.BoxGeometry(.14, .02, L).rotateX(ang).translate(cx, y + .115, mz), (px, py, pz, ny, cc) => cc.set(wood)));
    for (let k = 1; k < 5; k++) { const u = k / 5; B(.14, .015, .015, cx, y + .21 * (1 - u) + .025, cz + .29 + R * u, dark); } }
  // je ein Futtertrog an der Vorderseite der beiden Koppeln, Heuballen draußen neben der Weide
  { for (const [tx, w] of FARM.troughs) { const tz = FARM.trough[1], y = at(tx, tz); B(w, .14, .22, tx, y + .07, tz - .1, wood); B(w - .08, .03, .16, tx, y + .13, tz - .1, 0xc9a24a); }
    for (const [hx, hz] of FARM.hay) parts.push(paint(new THREE.CylinderGeometry(.2, .2, .32, 10).rotateZ(Math.PI / 2).translate(hx, at(hx, hz) + .2, hz), (px, py, pz, ny, cc) => cc.set(0xd9b65a).multiplyScalar(.9 + .1 * Math.sin(py * 60)))); }
  const mesh = new THREE.Mesh(mergeGeometries(parts), plantMat); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
  g.rotation.y = F.ry; scene.add(g); statics.push({ o: g, x: F.x, z: F.z });
  { const p = farmPt(F, -2.95, .55); place('prop.wheelbarrow', p.x, p.z, F.ry + .6, 1.5); F.barrow = p; const q = farmPt(F, -.45, .5); place('prop.bucket', q.x, q.z, F.ry, 1.5); F.bucket = q; }
  // Felder: Ackerboden mit Furchen, folgt dem Gelände
  FARM.fx.forEach((lx, i) => {
    const p = farmPt(F, lx, FARM.fz), sv = S.fields[fields.length], fy = heightAt(p.x, p.z);
    const f = { F, i, x: p.x, z: p.z, ry: F.ry, lx, lz: FARM.fz, c: i, state: 'leer', g: 0, water: 0, by: null };
    if (Array.isArray(sv)) { f.c = Math.abs(sv[0] | 0) % CROPS.length; f.state = FIELD_STATES[sv[1]] || 'leer'; f.g = clamp(+sv[2] || 0, 0, 1); }
    const geo = new THREE.PlaneGeometry(FARM.fw, FARM.fd, 20, 12).rotateX(-Math.PI / 2), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = Math.cos(F.ry), sn = Math.sin(F.ry);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), ridge = .5 + .5 * Math.cos(2 * Math.PI * x / (FARM.fw / 5)), edge = Math.abs(x) > FARM.fw / 2 - .01 || Math.abs(z) > FARM.fd / 2 - .01;
      pos.setY(k, heightAt(p.x + x * c + z * sn, p.z - x * sn + z * c) - fy + (edge ? .005 : .03 + ridge * .03));
      COL.set(0x4a3222).lerp(COL2.set(0x7a5638), ridge * .8).multiplyScalar(.92 + Math.random() * .12); col.set([COL.r, COL.g, COL.b], k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    f.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const o = new THREE.Mesh(geo, f.mat); o.receiveShadow = true; o.rotation.y = F.ry; scene.add(o); statics.push({ o, x: p.x, z: p.z });
    fields.push(f); F.fields.push(f);
  });
  // Vieh auf der Weide
  for (const [kind, n] of [['kuh', 2], ['schwein', 2], ['huhn', 5], ['hahn', 1]]) for (let k = 0; k < n; k++) {
    let lx = 0, lz = 0;
    if (kind === 'huhn' || kind === 'hahn') for (let t = 0; t < 40; t++) { lx = rnd(3) - .5; lz = 1.5 + rnd(1.5); if (yardOk(lx, lz)) break; }
    else { const Z = stockZone(kind); lx = Z.x0 + Math.random() * (Z.x1 - Z.x0); lz = Z.z0 + Math.random() * (Z.z1 - Z.z0); }
    stock.push({ kind, F, lx, lz, h: Math.random() * 6.28, tx: lx, tz: lz, moving: false, timer: Math.random() * 3, ph: Math.random() * 6.28, m: makeStock(kind) });
  }
}
// Bewegungsraum (Hofkoordinaten): Kühe links, Schweine rechts, jeweils mit Abstand zu Zaun und Trog
function stockZone(kind) { const P = FARM.pen, zz = { z0: P.z0 + .3, z1: FARM.trough[1] - .55 }; return kind === 'kuh' ? { x0: P.x0 + .3, x1: P.xm - .3, ...zz } : { x0: P.xm + .25, x1: P.x1 - .25, ...zz }; }
// frei laufende Hühner: Hof zwischen Feldern, Haus und Weide, nicht in Gebäuden, Weide, Stall oder auf den Feldern
function yardOk(lx, lz) {
  const P = FARM.pen, [hx, hz] = FARM.house, [cx, cz] = FARM.coop, inR = (x0, x1, z0, z1) => lx > x0 && lx < x1 && lz > z0 && lz < z1;
  if (lx < -3.25 || lx > 3.5 || lz < -.3 || lz > 3.1) return false;
  if (inR(P.x0 - .12, P.x1 + .12, P.z0 - .12, P.z1 + .12) || inR(hx - .78, hx + .78, hz - .95, hz + .95) || inR(cx - .72, cx + .5, cz - .38, cz + .85)) return false;
  return Math.hypot(lx + 2.95, lz - .55) > .38 && Math.hypot(lx + .45, lz - .5) > .2 && FARM.hay.every(([x, z]) => Math.hypot(lx - x, lz - z) > .32);
}
const fieldAt = (x, z, m = .15) => fields.find(f => { const dx = x - f.x, dz = z - f.z, c = Math.cos(f.ry), sn = Math.sin(f.ry); return Math.abs(dx * c - dz * sn) < FARM.fw / 2 + m && Math.abs(dx * sn + dz * c) < FARM.fd / 2 + m; });
const fieldFront = f => farmPt(f.F, f.lx + rnd(.45), f.lz + FARM.fd / 2 + .3);
let cropT = 0, ripeTip = false;
function updateFarm(dt, t) {
  // Wachstum: Regen (Wetter oder Wunder) beschleunigt, nachts und im Schnee wächst kaum etwas
  const k = (1 + .7 * weather.wet) * (1 - .9 * smooth(.2, .6, weather.snowCover)) * (sky.night > .6 ? .4 : 1);
  for (const f of fields) {
    f.water = Math.max(0, f.water - dt);
    // gepflügt (Stier) wächst ein Feld schneller, bis es reif ist
    if (f.state === 'grow') { f.g = Math.min(1, f.g + dt / CROPS[f.c].grow * k * (f.water > 0 ? 2.2 : 1) * (f.plowed ? 1.35 : 1)); if (f.g >= 1) { f.state = 'reif'; f.plowed = false; if (!ripeTip) { ripeTip = true; toast('Ein Feld ist reif. Der Bauer erntet es, du kannst aber auch mit der Hand darauf tippen.', 4); } } }
    f.mat.color.setScalar((1 - .4 * Math.max(weather.wet, smooth(0, 12, f.water))) * (f.plowed ? .78 : 1)); // frisch gepflügt: dunkle Erde
  }
  // Erzeugnisse der Tiere sammeln sich tagsüber im Stall
  for (const F of farms) {
    F.feedT -= dt; if (sky.night > .5) continue;
    const n = kind => stock.filter(a => a.F === F && a.kind === kind).length;
    F.milk = Math.min(6, F.milk + n('kuh') * dt / 150); F.eggs = Math.min(8, F.eggs + n('huhn') * dt / 130); F.pork = Math.min(4, F.pork + n('schwein') * dt / 650);
  }
  if ((cropT -= dt) <= 0) { // Pflanzen neu setzen (nicht in jedem Frame nötig)
    cropT = .3; const cnt = cropMeshes.map(() => 0);
    for (const f of fields) {
      if (f.state === 'leer') continue;
      const L = CROP_LAYOUT[f.c], M = cropMeshes[f.c], ls = .18 + .82 * smooth(0, .7, f.g), fs = smooth(.42, 1, f.g), co = Math.cos(f.ry), sn = Math.sin(f.ry);
      if (CROPS[f.c].res === 'grain') COL.setRGB(.5, .78, .34).lerp(COL2.setRGB(1.02, .84, .42), smooth(.55, 1, f.g)); // Weizen: grün, reif golden
      else COL.setRGB(1, 1, 1).lerp(COL2.setRGB(1.15, 1.2, 1.05), (1 - f.g) * .6); // junge Pflanzen heller
      for (const pl of L) {
        const x = f.x + pl.x * co + pl.z * sn, z = f.z - pl.x * sn + pl.z * co, y = heightAt(x, z) + .05, i = cnt[f.c]++;
        dummy.position.set(x, y, z); dummy.rotation.set(0, pl.r, 0); dummy.scale.setScalar(ls * pl.s); dummy.updateMatrix(); M[0].setMatrixAt(i, dummy.matrix); M[0].setColorAt(i, COL);
        dummy.scale.setScalar(Math.max(1e-4, fs * pl.s)); dummy.updateMatrix(); M[1].setMatrixAt(i, dummy.matrix); M[1].setColorAt(i, COL2.setRGB(1, 1, 1));
      }
    }
    cropMeshes.forEach((M, k) => M.forEach(m => { m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }));
  }
  // Vieh: grast, zieht über die Weide, beim Füttern kommt es zum Trog
  for (const a of stock) {
    const F = a.F, P = FARM.pen, chick = a.kind === 'huhn' || a.kind === 'hahn', feed = F.feedT > 0;
    a.timer -= dt;
    if (chick) { // Hühnerhaus: abends die Leiter hinauf und hinein, morgens (jedes zu seiner Zeit) wieder heraus
      if (a.wake === undefined) a.wake = 6 + Math.random() * .8;
      const [cx, cz] = FARM.coop, footZ = cz + .29 + FARM.coopRamp, bed = S.hour >= 19.2 || S.hour < a.wake;
      if (a.kind === 'hahn') { // kräht morgens, sobald er draußen ist
        if (S.hour > 12) a.crowed = false;
        else if (!a.crowed && !a.coop && S.hour >= 6 && S.hour < 7.5) { a.crowed = true; const p = farmPt(F, a.lx, a.lz); floatText(p.x, heightAt(p.x, p.z) + .5, p.z, 'Kikeriki!', 'w'); }
      }
      if (a.coop === 'in') { if (bed) { a.m.g.visible = false; continue; } a.coop = 'down'; a.rp = 1; a.m.g.visible = true; }
      if (a.coop === 'up' || a.coop === 'down') {
        a.rp = clamp(a.rp + (a.coop === 'up' ? dt : -dt) * .9, 0, 1); a.lx = cx; a.lz = footZ - a.rp * FARM.coopRamp; a.h = a.coop === 'up' ? Math.PI : 0;
        if (a.coop === 'up' && a.rp >= 1) { a.coop = 'in'; a.m.g.visible = false; continue; }
        if (a.coop === 'down' && a.rp <= 0) { a.coop = null; a.moving = false; a.timer = .3; }
        const M = a.m, p = farmPt(F, a.lx, a.lz); M.body.rotation.x = 0; M.legs.forEach(L => { L.rotation.x = 0; });
        M.g.position.set(p.x, heightAt(p.x, p.z) + a.rp * .21 + Math.abs(Math.sin(t * 14 + a.ph)) * .015, p.z); M.g.rotation.y = a.h + F.ry; continue;
      }
      if (bed && !a.moving) { // zur Leiter laufen
        if (Math.hypot(a.lx - cx, a.lz - footZ) < .06) { a.coop = 'up'; a.rp = 0; continue; }
        a.tx = cx; a.tz = footZ; a.moving = true; a.timer = 0;
      }
    }
    if (!a.moving && a.timer <= 0) {
      if (chick) { // herumlaufen und picken (bei der Fütterung zum Bauern)
        let tx = a.lx, tz = a.lz, ok = false;
        for (let k = 0; k < 10 && !ok; k++) { tx = (feed ? FARM.trough[0] - 1.9 : a.lx) + rnd(1.2); tz = (feed ? FARM.pen.z1 + .1 : a.lz) + rnd(feed ? .2 : 1.2); ok = yardOk(tx, tz) && [.25, .5, .75].every(u => yardOk(a.lx + (tx - a.lx) * u, a.lz + (tz - a.lz) * u)); }
        if (ok) { a.tx = tx; a.tz = tz; a.moving = true; } else a.timer = 1;
      } else {
        const Z = stockZone(a.kind), trough = FARM.troughs[a.kind === 'kuh' ? 0 : 1], mates = stock.filter(b => b.F === F && b.kind === a.kind), i = mates.indexOf(a);
        if (feed) { a.tx = clamp(trough[0] + (i - (mates.length - 1) / 2) * (a.kind === 'kuh' ? .42 : .34), Z.x0, Z.x1); a.tz = Z.z1; a.atTrough = true; } // feste Plätze nebeneinander am Trog
        else { // freien Fleck suchen, nicht dort, wo ein anderes Tier steht oder hinwill
          a.atTrough = false;
          for (let k = 0; k < 8; k++) { a.tx = clamp(a.lx + rnd(1.6), Z.x0, Z.x1); a.tz = clamp(a.lz + rnd(1.6), Z.z0, Z.z1); if (mates.every(b => b === a || (Math.hypot(b.lx - a.tx, b.lz - a.tz) > .75 && Math.hypot(b.tx - a.tx, b.tz - a.tz) > .75))) break; }
        }
        a.moving = true; a.stuckT = 0; a.lastD = 1e9;
      }
    }
    const sp = a.kind === 'kuh' ? .3 : a.kind === 'schwein' ? .4 : .55;
    if (a.moving) {
      const dx = a.tx - a.lx, dz = a.tz - a.lz, d = Math.hypot(dx, dz);
      // kommt es nicht voran (ein anderes Tier steht im Weg), bleibt es stehen und versucht es später anderswo
      if (!chick) { a.stuckT = d < (a.lastD ?? 1e9) - .002 ? 0 : (a.stuckT || 0) + dt; a.lastD = Math.min(a.lastD ?? 1e9, d); }
      if (d < .05 || (!chick && a.stuckT > 1.2)) { a.moving = false; a.timer = (chick ? 1 : 3) + Math.random() * (chick ? 3 : 7); if (chick && (S.hour >= 19.2 || S.hour < a.wake)) a.timer = 0; }
      else { const st = Math.min(d, sp * dt); a.lx += dx / d * st; a.lz += dz / d * st; let dh = Math.atan2(dx, dz) - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.h += dh * Math.min(1, dt * 5); }
    }
    if (!chick) { // Abstand zu den anderen Tieren der Koppel halten
      // Körper sind länglich: Abstand längs größer als seitlich (nebeneinander am Trog ist Platz, Kopf an Kopf nicht)
      const Z = stockZone(a.kind), RL = a.kind === 'kuh' ? .72 : .5, RS = a.kind === 'kuh' ? .34 : .25, sh = Math.sin(a.h), ch = Math.cos(a.h);
      for (const b of stock) if (b !== a && b.F === F && b.kind === a.kind) {
        const dx = a.lx - b.lx, dz = a.lz - b.lz, d = Math.hypot(dx, dz), e = Math.hypot((dx * sh + dz * ch) / RL, (dx * ch - dz * sh) / RS);
        if (e < 1 && d > 1e-4) { const k = Math.min(.03, (1 - e) * .5 * Math.min(RL, RS)); a.lx += dx / d * k; a.lz += dz / d * k; }
      }
      a.lx = clamp(a.lx, Z.x0, Z.x1); a.lz = clamp(a.lz, Z.z0, Z.z1);
      if (!a.moving && a.atTrough && F.feedT > 0) { let dh = -a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.h += dh * Math.min(1, dt * 3); } // zum Trog drehen
    }
    const M = a.m, p = farmPt(F, a.lx, a.lz), y = heightAt(p.x, p.z), cyc = t * (chick ? 16 : 7) + a.ph, sw = a.moving ? Math.sin(cyc) * .5 : 0;
    M.legs.forEach((L, k) => { L.rotation.x = (k === 0 || k === 3 ? sw : -sw); });
    if (chick) M.body.rotation.x = a.moving ? 0 : Math.max(0, Math.sin(t * 3 + a.ph)) ** 6 * .9; // pickt
    else if (M.head) M.head.rotation.x = a.moving ? 0 : smooth(.2, .8, Math.sin(t * .35 + a.ph) * .5 + .5) * .9; // grast
    M.g.position.set(p.x, y + (chick && a.moving ? Math.abs(Math.sin(cyc)) * .02 : 0), p.z); M.g.rotation.y = a.h + F.ry;
  }
}

export { CROPS, FIELD_STAGES, buildFarm, farms, fieldAt, fieldFront, fields, stock, updateFarm };
