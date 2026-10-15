// Leben im Meer: Fische, Wellenringe, Haie

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, smooth, rnd } from '../core/util.js';
import { dummy, scene } from '../core/render.js';
import { heightAt } from '../world/terrain.js';
import { SPRAY_N, spray } from '../world/water.js';
import { spawnChips } from '../world/particles.js';
import { COL2, paint } from '../models/nature.js';
import { fish } from './land.js';

// Fische: kleine Schwärme im flachen Wasser, ab und zu springt einer (mit Spritzer und Wellenring)
const fishGeo = mergeGeometries([
  paint(new THREE.SphereGeometry(1, 8, 5).scale(.028, .035, .1), (x, y, z, ny, c) => c.set(y > .005 ? 0x4c6a78 : 0xc9d6dc)),
  paint(new THREE.ConeGeometry(.035, .06, 4).rotateX(-Math.PI / 2).scale(.3, 1, 1).translate(0, 0, -.12), (x, y, z, ny, c) => c.set(0x5b7987)),
]);
const FISH_N = 54, fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .2 }), FISH_N);
fishMesh.frustumCulled = false; fishMesh.userData.noSnow = true; scene.add(fishMesh);
const waterDepthAt = (x, z) => -.02 - heightAt(x, z);
{
  let tries = 0;
  for (let sch = 0; sch < 9 && tries < 3000; tries++) { // neun Schwärme
    const a = Math.random() * 6.28, r = 14 + Math.random() * 20, cx = Math.cos(a) * r, cz = Math.sin(a) * r, d = waterDepthAt(cx, cz);
    if (d < .35 || d > 1.6) continue;
    sch++; const hd = Math.random() * 6.28;
    for (let k = 0; k < 6; k++) fish.push({ x: cx + rnd(.6), z: cz + rnd(.6), h: hd + rnd(.4), sp: .35 + Math.random() * .2, ph: Math.random() * 6.28, jump: 0, s: .85 + Math.random() * .4 });
  }
}
const RIPPLE_N = 24, ripples = [], rippleMesh = new THREE.InstancedMesh(new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: .6, depthWrite: false }), RIPPLE_N);
rippleMesh.frustumCulled = false; rippleMesh.count = 0; rippleMesh.userData.noSnow = true; scene.add(rippleMesh);
const splash = (x, z) => { if (ripples.length >= RIPPLE_N) ripples.shift(); ripples.push({ x, z, t: 0 }); spawnChips(x, .05, z, Math.random() * 6.28); };
let fishJumpT = 3, fishT = 40;
const FISH_TARGET = 54;
function updateFish(dt, t) {
  if ((fishT -= dt) <= 0 && fish.length < FISH_TARGET && fish.length) { fishT = 40; const o = fish[Math.floor(Math.random() * fish.length)]; fish.push({ x: o.x + rnd(.5), z: o.z + rnd(.5), h: o.h, sp: .35 + Math.random() * .2, ph: Math.random() * 6.28, jump: 0, s: .85 + Math.random() * .4 }); } // Fische wachsen nach
  fishJumpT -= dt;
  if (fishJumpT <= 0) { // springen nur, wo Absprung und Landestelle tief genug sind (nicht am Ufer)
    fishJumpT = 2.5 + Math.random() * 5; const f = fish[Math.floor(Math.random() * fish.length)];
    if (f && !f.jump && waterDepthAt(f.x, f.z) > .8 && waterDepthAt(f.x + Math.sin(f.h) * 1.3, f.z + Math.cos(f.h) * 1.3) > .8) { f.jump = .001; splash(f.x, f.z); }
  }
  fish.forEach((f, i) => {
    if (f.jump > 0) { // Sprung: Bogen aus dem Wasser, Kopf voran
      f.jump += dt / .9; f.x += Math.sin(f.h) * dt * 1.4; f.z += Math.cos(f.h) * dt * 1.4;
      if (f.jump >= 1) { f.jump = 0; splash(f.x, f.z); }
    } else {
      f.h += Math.sin(t * .7 + f.ph) * dt * .6;
      for (const sh of sharks) { const dx = f.x - sh.x, dz = f.z - sh.z; if (dx * dx + dz * dz < 7) { const want = Math.atan2(dx, dz); f.h += clamp(Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h)), -dt * 5, dt * 5); f.flee = 1.2; } } // vor dem Hai fliehen
      const fs = f.sp * ((f.flee = Math.max(0, (f.flee || 0) - dt)) > 0 ? 3 : 1);
      const nx = f.x + Math.sin(f.h) * fs * dt, nz = f.z + Math.cos(f.h) * fs * dt, d = waterDepthAt(nx, nz);
      if (d < .35 || d > 1.8) { // zu flach: von der Insel weg drehen, zu tief: zur Insel hin; dabei weiterschwimmen
        const r = Math.hypot(f.x, f.z) || 1, want = d < .35 ? Math.atan2(f.x / r, f.z / r) : Math.atan2(-f.x / r, -f.z / r);
        const dh = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h)); f.h += clamp(dh, -dt * 3, dt * 3);
        if (waterDepthAt(f.x + Math.sin(f.h) * f.sp * dt, f.z + Math.cos(f.h) * f.sp * dt) >= .2) { f.x += Math.sin(f.h) * f.sp * dt * .6; f.z += Math.cos(f.h) * f.sp * dt * .6; }
      } else { f.x = nx; f.z = nz; }
    }
    const j = f.jump, y = j > 0 ? -.05 + Math.sin(j * Math.PI) * .55 : -.2 - .04 * Math.sin(t * 2 + f.ph);
    dummy.position.set(f.x, y, f.z); dummy.rotation.set(j > 0 ? -Math.cos(j * Math.PI) * 1.1 : 0, f.h, Math.sin(t * 9 + f.ph) * .15, 'YXZ'); dummy.scale.setScalar(f.s * 1.3); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
  });
  fishMesh.count = fish.length; fishMesh.instanceMatrix.needsUpdate = true;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt / 1.6; if (ripples[i].t >= 1) ripples.splice(i, 1); }
  ripples.forEach((r, i) => { dummy.position.set(r.x, .02, r.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.15 + r.t * .9); dummy.updateMatrix(); rippleMesh.setMatrixAt(i, dummy.matrix); });
  rippleMesh.count = ripples.length; rippleMesh.material.opacity = ripples.length ? .5 : 0; rippleMesh.instanceMatrix.needsUpdate = true;
}
/* ------------------------------------------------------------------ Haie */
// Zwei, drei Haie ziehen im tiefen Wasser um die Insel. Meist schwimmen sie tiefer (dunkler Schatten unter Wasser),
// ab und zu kommen sie hoch, dann schneidet die Rückenflosse durchs Wasser und zieht eine Spur. Manchmal jagen sie
// am Rand der Fischgründe; Fische fliehen vor ihnen.
const sharks = [];
function makeShark() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, flatShading: true });
  const P = (geo, fn) => paint(geo, fn), skin = (x, y, z, ny, c) => c.set(0x6d7c88).lerp(COL2.set(0xe4e8ea), smooth(.02, -.08, y));
  const fin = (pts, d) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  const body = new THREE.Mesh(mergeGeometries([
    P(new THREE.SphereGeometry(1, 12, 8).scale(.17, .15, .78), skin),
    P(new THREE.ConeGeometry(.15, .32, 10).rotateX(Math.PI / 2).scale(1.1, .85, 1).translate(0, -.01, .86), skin), // Schnauze
    P(fin([[-.22, 0], [.12, 0], [-.18, .34]], .03).rotateY(-Math.PI / 2).translate(0, .12, .05), (x, y, z, ny, c) => c.set(0x5d6b77)), // Rückenflosse
    ...[-1, 1].map(sx => P(fin([[0, 0], [.3, -.05], [.06, .12]], .02).rotateX(Math.PI / 2).rotateZ(sx * -.35).scale(sx, 1, 1).translate(sx * .14, -.07, .25), (x, y, z, ny, c) => c.set(0x66747f))), // Brustflossen
    ...[-1, 1].map(sx => P(new THREE.SphereGeometry(.018, 5, 4).translate(sx * .1, .03, .7), (x, y, z, ny, c) => c.set(0x111111))),
  ]), mat);
  const tail = new THREE.Group(); tail.position.set(0, 0, -.72); g.add(tail);
  tail.add(new THREE.Mesh(mergeGeometries([P(new THREE.ConeGeometry(.09, .4, 8).rotateX(-Math.PI / 2).translate(0, 0, -.15), skin),
    P(fin([[0, 0], [-.32, .36], [-.2, 0], [-.3, -.22]], .025).rotateY(-Math.PI / 2).translate(0, 0, -.28), (x, y, z, ny, c) => c.set(0x5d6b77))]), mat));
  body.castShadow = false; g.add(body); g.traverse(o => { o.userData.noSnow = true; });
  scene.add(g); return { g, tail, body };
}
function sharkSpot(near) { // Ziel im tiefen Wasser; auf der Jagd an den Rand der Fischgründe
  for (let k = 0; k < 30; k++) {
    let x, z;
    if (near && fish.length) { const f = fish[Math.floor(Math.random() * fish.length)], r = Math.hypot(f.x, f.z) || 1; x = f.x + f.x / r * 1.2; z = f.z + f.z / r * 1.2; }
    else { const a = Math.random() * 6.28, r = 19 + Math.random() * 13; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (waterDepthAt(x, z) > (near ? 1.5 : 2.2)) return { x, z };
  }
  return { x: 34, z: 0 };
}
for (let k = 0; k < 3; k++) { const p = sharkSpot(false); sharks.push({ ...p, h: Math.random() * 6.28, sp: .9, tx: p.x, tz: p.z, up: 0, upT: 5 + Math.random() * 10, surf: Math.random() < .5, hunt: false, wakeT: 0, ph: Math.random() * 6.28, m: makeShark() }); }
function updateSharks(dt, t) {
  for (const sh of sharks) {
    const dx = sh.tx - sh.x, dz = sh.tz - sh.z, d = Math.hypot(dx, dz);
    if (d < 1.5) { sh.hunt = Math.random() < .3; const p = sharkSpot(sh.hunt); sh.tx = p.x; sh.tz = p.z; }
    if ((sh.upT -= dt) <= 0) { sh.surf = !sh.surf; sh.upT = sh.surf ? 6 + Math.random() * 10 : 8 + Math.random() * 16; }
    sh.up += ((sh.surf ? 1 : 0) - sh.up) * Math.min(1, dt * .6);
    // gemächlich, in weiten Bögen; auf der Jagd schneller
    let dh = Math.atan2(dx, dz) - sh.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); sh.h += clamp(dh, -.5, .5) * dt;
    const sp = (sh.hunt ? 1.6 : .9), nx = sh.x + Math.sin(sh.h) * sp * dt, nz = sh.z + Math.cos(sh.h) * sp * dt;
    if (waterDepthAt(nx, nz) > 1.1) { sh.x = nx; sh.z = nz; } else { sh.h += dt * 1.5; const p = sharkSpot(false); sh.tx = p.x; sh.tz = p.z; } // nicht ins Flache
    // Fisch geschnappt
    if (sh.hunt) for (let i = fish.length - 1; i >= 0; i--) { const f = fish[i]; if (!f.jump && (f.x - sh.x - Math.sin(sh.h) * .8) ** 2 + (f.z - sh.z - Math.cos(sh.h) * .8) ** 2 < .25) { fish.splice(i, 1); splash(f.x, f.z); sh.hunt = false; const p = sharkSpot(false); sh.tx = p.x; sh.tz = p.z; break; } }
    // Spur der Flosse an der Oberfläche
    if (sh.up > .75 && (sh.wakeT -= dt) <= 0) {
      sh.wakeT = .4 + Math.random() * .3; const fx = sh.x + Math.sin(sh.h) * .05, fz = sh.z + Math.cos(sh.h) * .05, side = Math.random() < .5 ? -1 : 1; // nur ab und zu ein Spritzer
      if (spray.length >= SPRAY_N) spray.shift(); spray.push({ x: fx + Math.cos(sh.h) * side * .05, y: .01, z: fz - Math.sin(sh.h) * side * .05, vx: Math.cos(sh.h) * side * .2 - Math.sin(sh.h) * .1, vy: .12 + Math.random() * .12, vz: -Math.sin(sh.h) * side * .2 - Math.cos(sh.h) * .1, t: 0, life: .35 + Math.random() * .2, s: 0 });
    }
    const M = sh.m, sway = Math.sin(t * (sh.hunt ? 4 : 2.4) + sh.ph);
    M.tail.rotation.y = sway * .45; M.body.rotation.y = -sway * .06;
    M.g.position.set(sh.x, -.62 + .34 * sh.up, sh.z); M.g.rotation.set(0, sh.h, sway * .04);
  }
}

export { fishGeo, fishMesh, sharks, splash, updateFish, updateSharks };
