// Licht in der Nacht: Lichthöfe, Lichtflecken vor Türen

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { camera, dummy, scene } from '../core/render.js';
import { glowTex, sky } from '../world/sky.js';
import { heightAt, surfaceAt } from '../world/terrain.js';
import { shrine, staticLights } from './shrine.js';
import { houseDoor, houseMats, houses } from './houses.js';
import { huts } from './huts.js';
import { hutDoor } from './build.js';
import { VCAP } from './villagers.js';

const doorP = {};
function updateLights(t) {
  const k = smooth(.2, .7, sky.night);
  haloMesh.material.opacity = k * .55; poolMesh.material.opacity = k * .7;
  const fl = 1 + Math.sin(t * 7.3) * .04 + Math.sin(t * 13.1) * .03; // Kerzenflackern
  for (const m of houseMats.values()) m.emissiveIntensity = k * 2.4 * fl;
  let n = 0, p = 0;
  if (k > 0) {
    for (const l of lights) {
      dummy.position.set(l.x, l.y, l.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(.42 * fl); dummy.updateMatrix(); haloMesh.setMatrixAt(n++, dummy.matrix);
      dummy.position.set(l.x, surfaceAt(l.x, l.z) + .02, l.z); dummy.quaternion.identity(); dummy.scale.setScalar(1.5); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
    for (const L of staticLights) {
      const gy = heightAt(L.x, L.z), y = L.local ? shrine.g.position.y + L.y : gy + L.y;
      if (!L.gold) { dummy.position.set(L.x, y, L.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(L.s * (L.fire ? 1.4 : 1) * fl); dummy.updateMatrix(); haloMesh.setMatrixAt(n++, dummy.matrix); }
      dummy.position.set(L.x, gy + .02, L.z); dummy.quaternion.identity(); dummy.scale.setScalar((L.gold ? 5.2 : L.s * 2.6 + .4) * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
    for (const hs of huts) { const d = hutDoor(hs, .45); dummy.position.set(d.x, heightAt(d.x, d.z) + .02, d.z); dummy.quaternion.identity(); dummy.scale.setScalar(2.2 * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix); }
    for (const hs of houses) {
      houseDoor(hs, .45, doorP); dummy.position.set(doorP.x, heightAt(doorP.x, doorP.z) + .02, doorP.z); dummy.quaternion.identity(); dummy.scale.setScalar(2.4 * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
  }
  haloMesh.count = n; poolMesh.count = p; haloMesh.instanceMatrix.needsUpdate = poolMesh.instanceMatrix.needsUpdate = true;
}
// Lichtschein nachts: Lichthöfe um Laternen (zur Kamera gedreht) und warme Lichtflecken am Boden vor Türen und unter Laternen
const glowMat = c => new THREE.MeshBasicMaterial({ map: glowTex, color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
const haloMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(0xffb85c), VCAP + 64);
const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat(0xff9f45), VCAP + 128);
for (const m of [haloMesh, poolMesh]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 2; scene.add(m); }
// Lichtflecken am Boden addieren sich nicht (sonst wird eine Gruppe mit Laternen grell), es zählt der hellste
Object.assign(poolMesh.material, { polygonOffset: true, polygonOffsetFactor: -2, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, premultipliedAlpha: true });
const lights = []; // Laternen dieses Frames: { x, y, z }
const lV = new THREE.Vector3();

export { lV, lights, updateLights };
