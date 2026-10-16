// Späne und Spritzer (Axthieb, Feldarbeit, Fische)

import * as THREE from 'three';
import { rnd } from '../core/util.js';
import { dummy, scene } from '../core/render.js';
import { surfaceAt } from './terrain.js';

// Holzspäne beim Axthieb
const CHIP_N = 48, chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.03, .012, .022), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true }), CHIP_N);
const chipC = new THREE.Color();
chipMesh.frustumCulled = false; chipMesh.count = 0; scene.add(chipMesh);
const chips = [];
function spawnChips(x, y, z, h, col = 0xd9b07a) { // Holzspäne, beim Steinmetz graue Splitter
  for (let k = 0; k < 5; k++) {
    if (chips.length >= CHIP_N) chips.shift();
    const a = h + Math.PI + rnd(1.3), sp = .8 + Math.random() * 1.2;
    chips.push({ x, y, z, vx: Math.sin(a) * sp, vy: 1 + Math.random() * 1.4, vz: Math.cos(a) * sp, r: Math.random() * 6, life: .7, col });
  }
}
function updateChips(dt) {
  for (let i = chips.length - 1; i >= 0; i--) {
    const c = chips[i]; c.life -= dt;
    if (c.life <= 0) { chips.splice(i, 1); continue; }
    c.vy -= 6 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.r += dt * 14;
    const g = surfaceAt(c.x, c.z); if (c.y < g) { c.y = g; c.vx *= .5; c.vz *= .5; c.vy = 0; }
  }
  chips.forEach((c, i) => { dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.r, c.r * .7, 0); dummy.scale.setScalar(Math.min(1, c.life / .2)); dummy.updateMatrix(); chipMesh.setMatrixAt(i, dummy.matrix); chipMesh.setColorAt(i, chipC.setHex(c.col)); });
  if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  chipMesh.count = chips.length; chipMesh.instanceMatrix.needsUpdate = true;
}

export { spawnChips, updateChips };
