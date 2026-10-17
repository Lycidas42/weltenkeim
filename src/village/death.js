// Tod eines Bewohners (bisher nur durch den Blitz): Er sackt zusammen und wird zu einem Häufchen Asche, das verweht.
// Danach zeigt nichts mehr auf ihn: Beruf, Aufträge, Bitte, Reservierungen und was er trug, sind frei bzw. verloren.

import * as THREE from 'three';
import { rnd } from '../core/util.js';
import { save } from '../core/state.js';
import { dummy, scene } from '../core/render.js';
import { theme } from '../assets/theme.js';
import { surfaceAt } from '../world/terrain.js';
import { trees } from '../world/trees.js';
import { rocks } from '../world/nature.js';
import { fields } from '../farm/farm.js';
import { toast } from '../ui/feedback.js';
import { fox } from '../creature/kinds.js';
import { input } from '../hand/pointer.js';
import { vAll, villagers } from './villagers.js';
import { puffs } from './workshops.js';
import { food } from './food.js';
import { dropLoad, wish } from './ai.js';
import { leaveJob } from './jobs.js';
import { endWish } from './wishes.js';

const DIE_T = 1.6; // zusammensacken und zu Asche zerfallen
const C = theme.palette.miracles, charred = new THREE.Color(C.charred);
// Häufchen Asche: eine Instanz je Toter, wächst kurz, liegt eine Weile und verweht
const ASH_N = 8, ashMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(.13, .09, 9).translate(0, .045, 0), new THREE.MeshStandardMaterial({ color: C.ash, roughness: 1, flatShading: true }), ASH_N);
ashMesh.count = 0; ashMesh.frustumCulled = false; ashMesh.receiveShadow = true; scene.add(ashMesh);
const ashes = []; // { x, z, t, life }
// vom Blitz getroffen: Aufträge sofort freigeben (solange er noch zu sehen ist, kann ihn niemand mehr einplanen)
function killVillager(v, why = 'Der Blitz hat einen Bewohner getroffen.') {
  if (!villagers.includes(v) || v.state === 'dying') return false;
  v.carry = 0; v.drop = null; v.dropAt = null; v.stones = 0; v.haul = null; v.saplings = 0; v.catch = 0; // was er trägt, ist verloren
  if (v.gift) { if (food.giftBy === v) food.giftBy = null; v.gift = null; }
  if (v.load) dropLoad(v);
  leaveJob(v); v.plant = null; v.field = null; v.rock = null; // Beruf, Baum, Feld, Felsen, Beute
  for (const t of trees) if (t.reserved === v) t.reserved = null; // auch ältere Reservierungen
  for (const f of fields) if (f.by === v) f.by = null;
  for (const r of rocks) if (r.by === v) r.by = null;
  if (wish.by === v) endWish(40);
  v.wish = false;
  if (fox.riders && fox.riders.includes(v)) { fox.riders = fox.riders.filter(r => r !== v); if (!fox.riders.length) fox.riders = null; fox.rider = fox.riders ? fox.riders[0] : null; }
  if (input.grabbed === v) input.grabbed = null;
  v.state = 'dying'; v.timer = DIE_T; v.dieT = DIE_T; v.emo = null; v.cheer = 0; v.haste = 0;
  // verkohlt: alle eingefärbten Teile dunkel
  const i = villagers.indexOf(v);
  for (const m of vAll) if (m.instanceColor) { m.setColorAt(i, charred); m.instanceColor.needsUpdate = true; }
  toast(why, 4);
  return true;
}
// aus der Liste nehmen: Die Farben der Bewohner dahinter rücken mit auf, damit niemand plötzlich anders aussieht
function removeVillager(v) {
  const i = villagers.indexOf(v); if (i < 0) return;
  const n = villagers.length;
  for (const m of vAll) if (m.instanceColor) { m.instanceColor.array.copyWithin(i * 3, (i + 1) * 3, n * 3); m.instanceColor.needsUpdate = true; }
  villagers.splice(i, 1);
  for (let k = i; k < villagers.length; k++) villagers[k].mealC = null; // Essen in der Hand neu einfärben
  if (fox.esc && fox.esc.v === v) fox.esc.t = 0;
  if (ashes.length >= ASH_N) ashes.shift();
  ashes.push({ x: v.x, z: v.z, t: 0, life: 9 });
  save(); // nach dem Neuladen ist er nicht wieder da
}
function updateDeaths(dt) {
  for (const v of [...villagers]) if (v.state === 'dying' && v.timer <= 0) removeVillager(v);
  for (let i = ashes.length - 1; i >= 0; i--) {
    const a = ashes[i]; a.t += dt;
    if (a.t > a.life) { ashes.splice(i, 1); continue; }
    if (a.t > a.life - 3 && Math.random() < dt * 5) { if (puffs.length < 120) puffs.push({ x: a.x + rnd(.08), y: surfaceAt(a.x, a.z) + .06, z: a.z + rnd(.08), t: 0, life: 1.4 + Math.random() }); } // verweht
  }
  ashes.forEach((a, i) => {
    const grow = Math.min(1, a.t / .4), fade = Math.min(1, (a.life - a.t) / 3);
    dummy.position.set(a.x + (1 - fade) * .15, surfaceAt(a.x, a.z), a.z); dummy.rotation.set(0, a.x * 7, 0); dummy.scale.set(grow * (.6 + .4 * fade), grow * fade, grow * (.6 + .4 * fade)); dummy.updateMatrix();
    ashMesh.setMatrixAt(i, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
  ashMesh.count = ashes.length; ashMesh.instanceMatrix.needsUpdate = true;
}

export { DIE_T, ashes, killVillager, removeVillager, updateDeaths };
