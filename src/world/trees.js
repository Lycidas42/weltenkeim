// Baumbestand: Bäume wachsen, werden gefällt und fallen

import * as THREE from 'three';
import { scene } from '../core/render.js';
import { heightAt } from './terrain.js';
import { model, parts, shadowify } from '../assets/models.js';
import { COL, Swarm, TK, plantMat, treeKindAt } from '../models/nature.js';
import { ST } from '../village/layout.js';

// Lichtung: Bäume auf dem Bauplatz verschwinden
function clearAround(x, z, r) { for (const t of trees) if (!t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r) { if (t.reserved && t.reserved !== 'fox') t.reserved.tree = null; t.reserved = null; t.gone = true; } }
const treeMeshes = TK.map(k => { const m = new THREE.InstancedMesh(k.geo, plantMat, 480); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, COL.set(1, 1, 1)); scene.add(m); return m; });
const stumpSwarm = new Swarm(parts(model('tree.stump')), 500);
const trees = [];
const treeNear = (x, z, r) => trees.some(t => !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r);
function addTree(x, z, g = 1) { if (trees.length >= 480) return null; const t = { x, z, type: treeKindAt(x, z), tint: .88 + Math.random() * .22, g, alive: true, gone: false, stumpT: 0, reserved: null, rot: Math.random() * 6.28, ph: Math.random() * 6.28 }; trees.push(t); return t; }
function chopTree(t) { t.alive = false; t.stumpT = 90; if (t.reserved) t.reserved = null; } // Stumpf verrottet, danach ist der Platz frei für einen Setzling
const freeSlot = t => !t.gone && !t.alive && !t.reserved;
const TREE_H = 1.12; // Höhe eines ausgewachsenen Baums (Anteil der Baumgröße ST)
// Gefällte Bäume kippen vom Fäller weg um, bleiben kurz liegen und verschwinden (Stumpf bleibt stehen).
const fallen = []; // { o, t, dir, x, z, s, life }
const FALL_T = .7;
function fallTree(tr, fromX, fromZ, life, lying = false) {
  if (fallen.length >= 12) { const f = fallen.shift(); scene.remove(f.o); }
  const o = shadowify(TK[tr.type || 0].scene.clone(true)); scene.add(o);
  const f = { o, t: lying ? FALL_T : 0, dir: Math.atan2(tr.x - fromX, tr.z - fromZ), x: tr.x, z: tr.z, s: ST * (tr.g ?? 1), life };
  fallen.push(f); return f; // life = 0 setzen entfernt ihn sofort (z. B. wenn ihn jemand aufhebt)
}
const fallQ = new THREE.Quaternion(), fallE = new THREE.Euler();
function updateFallen(dt) {
  for (let i = fallen.length - 1; i >= 0; i--) {
    const f = fallen[i]; f.t += dt;
    if (f.t >= f.life) { scene.remove(f.o); fallen.splice(i, 1); continue; }
    const k = Math.min(1, f.t / FALL_T), tilt = k * k * Math.PI / 2 * .97 + (k >= 1 ? Math.sin(Math.min(1, (f.t - FALL_T) / .25) * Math.PI) * .06 : 0);
    f.o.position.set(f.x, heightAt(f.x, f.z), f.z); f.o.quaternion.setFromEuler(fallE.set(tilt, f.dir, 0, 'YXZ'));
    f.o.scale.setScalar(f.s * Math.min(1, (f.life - f.t) / .4)); // am Ende einsinken
  }
}

export { FALL_T, TREE_H, addTree, chopTree, clearAround, fallTree, freeSlot, stumpSwarm, treeMeshes, treeNear, trees, updateFallen };
