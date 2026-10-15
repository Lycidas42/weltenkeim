// Wild an Land: Rehe und Hasen

import * as THREE from 'three';
import { smooth, rnd } from '../core/util.js';
import { scene } from '../core/render.js';
import { HALF, heightAt } from '../world/terrain.js';
import { fox } from '../creature/kinds.js';
import { SHRINE_POS } from '../village/layout.js';
import { spawnMote } from '../village/shrine.js';
import { blockedAt, followPath, navReady, navV, setGoal, smoothH } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { hand } from '../hand/hand.js';

/* ------------------------------------------------------------------ Wildtiere */
// Rehe und Hasen leben außerhalb des Dorfes, Fische im flachen Wasser rund um die Insel. Später sollen Jäger und Angler
// sie nutzen: `wild` (Rehe, Hasen) und `fish` stehen dafür bereit.
const wild = [];
const fish = [];
const animalMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true });
function makeDeer() {
  const g = new THREE.Group(), fur = animalMat(0x9a6a40), light = animalMat(0xd9c3a2), dark = animalMat(0x3a2a20), white = animalMat(0xf2ede4);
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.noSnow = true; par.add(o); return o; };
  add(new THREE.SphereGeometry(1, 10, 7).scale(.14, .13, .27), fur, 0, .42, 0);
  add(new THREE.SphereGeometry(1, 8, 5).scale(.115, .06, .22), light, 0, .35, .01);              // helle Unterseite
  add(new THREE.SphereGeometry(.045, 6, 4), white, 0, .45, -.27);                                 // weißer Spiegel
  const neck = new THREE.Group(); neck.position.set(0, .5, .2); g.add(neck);
  add(new THREE.CylinderGeometry(.04, .055, .2, 6).translate(0, .1, 0), fur, 0, 0, 0, neck).rotation.x = .45;
  const head = new THREE.Group(); head.position.set(0, .17, .09); neck.add(head);
  add(new THREE.SphereGeometry(1, 8, 6).scale(.045, .05, .1), fur, 0, 0, .04, head);
  add(new THREE.SphereGeometry(.018, 5, 4), dark, 0, -.01, .14, head);                         // Nase
  for (const sx of [-1, 1]) { const e = add(new THREE.ConeGeometry(.025, .09, 4), fur, sx * .04, .05, -.01, head); e.rotation.z = -sx * .7; }
  const legs = [];
  for (const [x, z] of [[.075, .17], [-.075, .17], [.075, -.17], [-.075, -.17]]) {
    const L = new THREE.Group(); L.position.set(x, .36, z); g.add(L);
    add(new THREE.CylinderGeometry(.022, .014, .34, 6).translate(0, -.17, 0), fur, 0, 0, 0, L); add(new THREE.CylinderGeometry(.015, .018, .035, 5), dark, 0, -.34, 0, L);
    legs.push(L);
  }
  g.scale.setScalar(.8); scene.add(g); return { g, legs, neck, head }; // etwas kleiner als ein Bewohner
}
function makeHare() {
  const g = new THREE.Group(), fur = animalMat(0x8f7b62), light = animalMat(0xcdbba0), white = animalMat(0xf4efe6), dark = animalMat(0x2a211b);
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.noSnow = true; par.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  add(new THREE.SphereGeometry(1, 8, 6).scale(.065, .06, .1), fur, 0, .08, 0, body);
  add(new THREE.SphereGeometry(1, 6, 4).scale(.045, .045, .06), fur, 0, .055, -.06, body);      // Hinterläufe
  add(new THREE.SphereGeometry(.03, 6, 4), white, 0, .1, -.1, body);                              // Blume (Schwanz)
  const head = new THREE.Group(); head.position.set(0, .14, .08); body.add(head);
  add(new THREE.SphereGeometry(1, 7, 5).scale(.035, .035, .045), fur, 0, 0, 0, head);
  add(new THREE.SphereGeometry(.008, 4, 3), dark, 0, .005, .045, head);
  const ears = [];
  for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * .015, .03, -.01); head.add(e); add(new THREE.SphereGeometry(1, 5, 4).scale(.01, .055, .02).translate(0, .05, 0), light, 0, 0, 0, e); e.rotation.set(-.3, 0, sx * .2); ears.push(e); }
  g.scale.setScalar(.95); scene.add(g); return { g, body, head, ears };
}
// Lebensraum: offenes Land und Waldrand außerhalb des Dorfes
function wildSpot(x0, z0, r) {
  for (let k = 0; k < 30; k++) {
    const a = Math.random() * 6.28, d = r * (.3 + Math.random() * .7), x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d, h = heightAt(x, z);
    if (h > .5 && h < 2.8 && Math.hypot(x, z) > 9.5 && Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) > 3.5 && (!navReady || !blockedAt(navV, x, z))) return { x, z };
  }
  return null;
}
for (let k = 0; k < 20; k++) {
  const deer = k < 8, at = wildSpot(0, 0, 29); if (!at) continue;
  wild.push({ kind: deer ? 'reh' : 'hase', ...at, h: Math.random() * 6.28, state: 'idle', timer: Math.random() * 4, ph: Math.random() * 6.28, sp: 0, m: deer ? makeDeer() : makeHare(), threatT: 0 });
}
// Rehe und Hasen: äsen bzw. sitzen, ziehen umher, fliehen vor Bewohnern, dem Tiergeist und der Hand
// Wild wächst nach: fehlen Tiere, kommt etwa jede halbe Minute eines an einem ruhigen Ort dazu
const WILD_TARGET = { reh: 8, hase: 12 }; let wildT = 30;
function killAnimal(a) { a.state = 'dead'; a.timer = 40; a.m.g.rotation.z = Math.PI / 2; }
function removeAnimal(a) { scene.remove(a.m.g); wild.splice(wild.indexOf(a), 1); }
function updateWild(dt, t) {
  if ((wildT -= dt) <= 0) {
    wildT = 30;
    for (const kind of ['reh', 'hase']) if (wild.filter(a => a.kind === kind && a.state !== 'dead').length < WILD_TARGET[kind]) {
      const at = wildSpot(0, 0, HALF * .9); if (at && villagers.every(v => Math.hypot(v.x - at.x, v.z - at.z) > 6)) wild.push({ kind, ...at, h: Math.random() * 6.28, state: 'idle', timer: 3, ph: Math.random() * 6.28, sp: 0, m: kind === 'reh' ? makeDeer() : makeHare(), threatT: 0 });
      break;
    }
  }
  for (const a of [...wild]) {
    if (a.state === 'dead') { // liegt, bis ein Jäger es holt (sonst verschwindet es nach einer Weile)
      a.timer -= dt; a.m.g.position.set(a.x, heightAt(a.x, a.z) + (a.kind === 'reh' ? .12 : .05), a.z);
      if (a.timer <= 0) removeAnimal(a);
      continue;
    }
    const deer = a.kind === 'reh', stunned = (a.stun = Math.max(0, (a.stun || 0) - dt)) > 0;
    if (stunned && Math.random() < dt * 3) spawnMote(a.x + rnd(.15), heightAt(a.x, a.z) + (deer ? .5 : .2), a.z + rnd(.15)); // gebannt: Funken steigen auf
    a.threatT -= dt;
    if (a.threatT <= 0 && !stunned) { // Gefahr prüfen
      a.threatT = .3; let tx = 0, tz = 0, n = 0;
      const near = (x, z, r) => { const d = Math.hypot(a.x - x, a.z - z); if (d < r) { tx += (a.x - x) / (d || 1); tz += (a.z - z) / (d || 1); n++; } };
      // eher gelassen, damit man sie beobachten kann: nur wer sehr nahe kommt, scheucht sie auf
      for (const v of villagers) if (v.state !== 'sleep') near(v.x, v.z, deer ? 1.6 : 1.1);
      near(fox.x, fox.z, deer ? 2.8 : 2.2);
      if (hand.g.visible && (hand.pressing || hand.vel.length() > 6)) near(hand.g.position.x, hand.g.position.z, 1.6); // die Hand nur beim Zugreifen oder schnellen Bewegen
      if (n && a.state !== 'flee') {
        const l = Math.hypot(tx, tz) || 1, run = deer ? 3.5 : 2.5, px = a.x + tx / l * run + rnd(1), pz = a.z + tz / l * run + rnd(1);
        a.state = 'flee'; setGoal(a, px, pz, navV); a.sp = deer ? 2.6 : 3; a.timer = 2;
      }
    }
    if (stunned) a.state = 'idle';
    else if (a.state === 'idle') { a.timer -= dt; if (a.timer <= 0) { const p = wildSpot(a.x, a.z, deer ? 7 : 4); if (p) { a.state = 'walk'; setGoal(a, p.x, p.z, navV); a.sp = deer ? .55 : 1.1; } else a.timer = 2; } }
    else { a.timer -= dt; if (followPath(a, a.sp * dt) || (a.state === 'flee' && a.timer <= 0)) { a.state = 'idle'; a.timer = 3 + Math.random() * 6; } }
    const y = heightAt(a.x, a.z), M = a.m, moving = a.state !== 'idle', fast = a.state === 'flee';
    if (deer) {
      const cyc = t * (fast ? 11 : 6) + a.ph, sw = moving ? Math.sin(cyc) * (fast ? .7 : .35) : 0;
      M.legs.forEach((L, k) => { L.rotation.x = (k === 0 || k === 3 ? sw : -sw); });
      const graze = !moving ? smooth(.2, .8, Math.sin(t * .4 + a.ph) * .5 + .5) : 0;   // Kopf zum Gras
      M.neck.rotation.x = graze * 1.5 - (fast ? .2 : 0); M.head.rotation.x = graze * -.4;
      M.g.position.set(a.x, y + (fast ? Math.abs(Math.sin(cyc)) * .12 : 0), a.z);
    } else {
      const hop = moving ? Math.abs(Math.sin(t * (fast ? 13 : 8) + a.ph)) : 0;
      M.body.position.y = hop * (fast ? .16 : .08); M.body.rotation.x = moving ? -Math.cos(t * (fast ? 13 : 8) + a.ph) * .25 : 0;
      M.ears.forEach((e, k) => { e.rotation.x = -.3 + (moving ? .4 : Math.max(0, Math.sin(t * 3 + a.ph + k)) ** 8 * .5); });
      M.head.rotation.y = !moving ? Math.sin(t * .8 + a.ph) * .4 : 0;
      M.g.position.set(a.x, y, a.z);
    }
    M.g.rotation.y = smoothH(a, dt, a.state === 'flee' ? 12 : 7, a.state === 'flee' ? 9 : 5);
  }
}

export { fish, killAnimal, removeAnimal, updateWild, wild };
