// Vögel: Möwen, Krähen, Spatzen

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, smooth, rnd } from '../core/util.js';
import { scene } from '../core/render.js';
import { sky } from '../world/sky.js';
import { HALF, heightAt } from '../world/terrain.js';
import { shoreLine } from '../world/water.js';
import { fox } from '../creature/kinds.js';
import { paint } from '../models/nature.js';
import { fields } from '../farm/farm.js';
import { blockedAt, navReady, navV } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { hand } from '../hand/hand.js';

/* ------------------------------------------------------------------ Vögel */
// Möwen kreisen über dem Meer und setzen sich an den Strand, Krähen ziehen über die Insel und picken auf Wiesen und
// Feldern, Spatzen fliegen in kleinen Schwärmen tief übers Land. Gelandete Vögel picken, hüpfen und fliegen auf,
// wenn jemand zu nahe kommt. Nachts schlafen Krähen und Spatzen (unsichtbar im Gehölz), Möwen sitzen am Strand.
const BIRD_KINDS = {
  moewe: { span: .72, speed: 2.6, alt: [3, 6.5], flap: 7, glide: .75, body: 0xf4f4f0, back: 0xc7ccd2, tip: 0x2b2b2b, beak: 0xe9b53a },
  kraehe: { span: .56, speed: 3, alt: [3.5, 7], flap: 9, glide: .35, body: 0x24242a, back: 0x2e2e36, tip: 0x18181c, beak: 0x2a2a2a },
  spatz: { span: .26, speed: 3.6, alt: [1.2, 2.8], flap: 22, glide: .1, body: 0x8a6a48, back: 0x6b4f35, tip: 0x4a3828, beak: 0x3a3028 },
};
const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
function makeBird(kind) {
  const K = BIRD_KINDS[kind], g = new THREE.Group(), body = new THREE.Group(), s = K.span;
  const P = (geo, c) => paint(geo, typeof c === 'function' ? c : (x, y, z, ny, col) => col.set(c));
  g.add(body);
  const bm = new THREE.Mesh(mergeGeometries([
    P(new THREE.SphereGeometry(1, 8, 6).scale(s * .1, s * .09, s * .26), (x, y, z, ny, c) => c.set(y > s * .03 ? K.back : K.body)),
    P(new THREE.SphereGeometry(s * .075, 7, 5).translate(0, s * .05, s * .24), K.body),
    P(new THREE.ConeGeometry(s * .025, s * .09, 4).rotateX(Math.PI / 2).translate(0, s * .04, s * .34), K.beak),
    P(new THREE.ConeGeometry(s * .07, s * .16, 4).rotateX(-Math.PI / 2).scale(1, .3, 1).translate(0, s * .01, -s * .3), K.back), // Schwanz
  ]), birdMat);
  bm.castShadow = kind !== 'spatz'; bm.userData.noSnow = true; body.add(bm);
  const wings = [-1, 1].map(sx => {
    const w = new THREE.Group(); w.position.set(sx * s * .07, s * .04, s * .03); body.add(w);
    const shape = new THREE.Shape([new THREE.Vector2(0, -.09), new THREE.Vector2(.5, -.02), new THREE.Vector2(.42, .07), new THREE.Vector2(0, .1)]);
    const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).scale(sx * s, 1, s);
    const m = new THREE.Mesh(P(geo, (x, y, z, ny, c) => c.set(Math.abs(x) > s * .36 ? K.tip : K.back)), birdMat);
    m.material.side = THREE.DoubleSide; m.castShadow = kind !== 'spatz'; m.userData.noSnow = true; w.add(m); return w;
  });
  birdMat.side = THREE.DoubleSide;
  scene.add(g); return { g, body, wings };
}
const birds = [];
let birdsReady = false;
function landAt(x, z) { const h = heightAt(x, z); return h > .02 && (!navReady || !blockedAt(navV, x, z)) ? h : null; }
function birdSpot(b) { // Landeplatz je nach Art
  for (let k = 0; k < 20; k++) {
    if (b.kind === 'moewe') { if (!shoreLine.length) return null; const S0 = shoreLine[Math.floor(Math.random() * shoreLine.length)], r = .4 + Math.random() * .8, x = S0.x - S0.dx * r, z = S0.z - S0.dz * r, h = heightAt(x, z); if (h > .02 && h < .6) return { x, z }; continue; }
    if (b.kind === 'kraehe' && fields.length && Math.random() < .5) { const f = fields[Math.floor(Math.random() * fields.length)]; return { x: f.x + rnd(.5), z: f.z + rnd(.8) }; }
    const a = Math.random() * 6.28, r = b.kind === 'spatz' ? 4 + Math.random() * 12 : 8 + Math.random() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r, h = landAt(x, z);
    if (h !== null && h > .35 && h < 3) return { x, z };
  }
  return null;
}
function birdAir(b) { // Wegpunkt in der Luft
  if (b.kind === 'moewe') { // über dem Meer vor der Küste
    for (let k = 0; k < 20; k++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 16, x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(x, z) < -.3 || r > HALF) return { x, z }; }
    return { x: rnd(30), z: rnd(30) };
  }
  const r = b.kind === 'spatz' ? 14 : 24; return { x: rnd(r), z: rnd(r) };
}
function birdFly(b, land) { let p = land ? birdSpot(b) : null; if (!p) { p = birdAir(b); land = false; } b.tx = p.x; b.tz = p.z; b.landing = land; b.state = 'fly'; b.alt = BIRD_KINDS[b.kind].alt[0] + Math.random() * (BIRD_KINDS[b.kind].alt[1] - BIRD_KINDS[b.kind].alt[0]); }
function initBirds() {
  birdsReady = true;
  const add = (kind, x, z, leader) => { const b = { kind, x, z, y: 5, h: Math.random() * 6.28, bank: 0, state: 'fly', tx: x, tz: z, alt: 4, cur: 4, timer: 0, ph: Math.random() * 6.28, leader, off: { x: rnd(.9), z: rnd(.9) }, m: makeBird(kind), landing: false, sleep: false }; birds.push(b); if (!leader) birdFly(b, false); return b; };
  for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28; add('moewe', Math.cos(a) * 26, Math.sin(a) * 26); }
  for (let k = 0; k < 4; k++) add('kraehe', rnd(15), rnd(15));
  for (let f = 0; f < 2; f++) { const L = add('spatz', rnd(10), rnd(10)); for (let k = 0; k < 5; k++) add('spatz', L.x + rnd(1), L.z + rnd(1), L); }
}
function updateBirds(dt, t) {
  if (!birdsReady) { if (!shoreLine.length) return; initBirds(); }
  const night = sky.night > .6;
  for (const b of birds) {
    const K = BIRD_KINDS[b.kind], M = b.m, L = b.leader;
    if (L) { // Schwarmvogel folgt dem Anführer (landet und startet mit ihm)
      if (L.state === 'fly' && b.state !== 'fly') { b.state = 'fly'; b.cur = Math.max(b.cur, .05); }
      if (L.state !== 'fly' && b.state === 'fly' && !b.landing) { b.landing = true; }
      b.tx = L.tx + b.off.x; b.tz = L.tz + b.off.z; b.alt = L.alt + b.off.x * .3; b.landing = L.landing;
    }
    if (b.state === 'ground') {
      // aufscheuchen: Bewohner, Kreatur, Hand
      let scare = false; const near = (x, z, r) => { if ((b.x - x) ** 2 + (b.z - z) ** 2 < r * r) scare = true; };
      for (const v of villagers) if (v.state !== 'sleep') near(v.x, v.z, b.kind === 'spatz' ? .7 : 1.1);
      near(fox.x, fox.z, 2.2); if (hand.g.visible && (hand.pressing || hand.vel.length() > 5)) near(hand.g.position.x, hand.g.position.z, 2);
      if (night && b.kind !== 'moewe' && !scare) { b.sleep = true; M.g.visible = false; continue; }
      if (b.sleep) { b.sleep = false; M.g.visible = true; b.timer = Math.random() * 3; }
      b.timer -= dt;
      if (L) { if (scare) L.timer = 0; } // ein aufgeschreckter Spatz nimmt den ganzen Schwarm mit
      else if (scare || (b.timer <= 0 && !night)) birdFly(b, false);
      // picken und hüpfen
      const peck = Math.max(0, Math.sin(t * (b.kind === 'spatz' ? 9 : 4) + b.ph)) ** 6;
      if (Math.random() < dt * (b.kind === 'spatz' ? 1.5 : .5)) { const a = Math.random() * 6.28, d = b.kind === 'spatz' ? .12 : .18, nx = b.x + Math.cos(a) * d, nz = b.z + Math.sin(a) * d; if (landAt(nx, nz) !== null || b.kind === 'moewe') { b.x = nx; b.z = nz; b.h = Math.atan2(Math.cos(a), Math.sin(a)); b.hop = 1; } }
      b.hop = Math.max(0, (b.hop || 0) - dt * 6);
      M.body.rotation.x = peck * .7; M.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * -.05; w.rotation.y = (k ? 1 : -1) * 1.25; }); // Flügel angelegt
      b.y = Math.max(heightAt(b.x, b.z), 0) + Math.sin(b.hop * Math.PI) * .04;
    } else {
      // Fliegen: zum Ziel steuern, Höhe über Grund, beim Anflug sinken; mit Kurvenlage
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz), sp = K.speed * (b.landing && d < 2 ? .5 + .5 * d / 2 : 1);
      const want = Math.atan2(dx, dz); let dh = want - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const turn = clamp(dh * 2, -1.6, 1.6) * dt; b.h += turn; b.bank += (clamp(-dh * 1.2, -.7, .7) - b.bank) * Math.min(1, dt * 3);
      if (b.landing && d < .9) { const st = Math.min(d, sp * dt); if (d > 1e-4) { b.x += dx / d * st; b.z += dz / d * st; } } // letzter Anflug gerade aufs Ziel
      else { b.x += Math.sin(b.h) * sp * dt; b.z += Math.cos(b.h) * sp * dt; }
      const tgt = b.landing ? b.alt * smooth(.1, 4, d) : b.alt; b.cur += (tgt - b.cur) * Math.min(1, dt * (b.landing ? (d < .9 ? 5 : 2.5) : 1));
      const ground = Math.max(heightAt(b.x, b.z), 0); b.y = ground + Math.max(b.cur, b.landing ? 0 : .6);
      if (b.landing && d < .04 && b.cur < .15) { b.state = 'ground'; b.timer = (b.kind === 'moewe' ? 8 : 5) + Math.random() * (b.kind === 'moewe' ? 25 : 12); b.cur = 0; b.y = ground; }
      else if (!L && d < 1.5 && !b.landing) birdFly(b, night || Math.random() < (b.kind === 'moewe' ? .2 : .35)); // weiterziehen oder landen
      // Flügelschlag, Gleitphasen; beim Landen flattern
      const glide = !b.landing && Math.sin(t * .35 + b.ph) < K.glide * 2 - 1 ? 0 : 1, fl = b.landing && d < 3 ? 1.6 : 1;
      const flap = glide ? Math.sin(t * K.flap * fl + b.ph) * .65 : -.12 + Math.sin(t * 1.3 + b.ph) * .05;
      M.wings.forEach((w, k) => { w.rotation.y = 0; w.rotation.z = (k ? -1 : 1) * flap; });
      M.body.rotation.x = b.landing && d < 2 ? -.35 : 0;
      M.g.visible = true; b.sleep = false;
    }
    M.g.position.set(b.x, b.y, b.z); M.g.rotation.set(0, b.h, b.state === 'fly' ? b.bank : 0, 'YXZ');
  }
}

export { birds, updateBirds };
