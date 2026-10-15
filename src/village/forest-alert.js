// Wald-Warnung der Holzfäller

import * as THREE from 'three';
import { scene } from '../core/render.js';
import { addGlaube, floatText, toast } from '../ui/feedback.js';
import { heightAt } from '../world/terrain.js';
import { trees } from '../world/trees.js';
import { huts } from './huts.js';
import { villagers } from './villagers.js';

// Gibt es im Umkreis einer bewohnten Holzfällerhütte kaum noch schlagreife Bäume, meldet sich der Holzfäller:
// Schild über der Hütte, Ring auf der Lichtung. Regen dort lässt den Wald nachwachsen und löst die Warnung auf.
const FOREST_R = 9, FOREST_LOW = 5;
const forestAlert = { hut: null, at: null, checkT: 0, cool: 20 };
const forestAround = h => trees.reduce((n, t) => n + (t.alive && !t.gone && t.g >= .7 && (t.x - h.x) ** 2 + (t.z - h.z) ** 2 < FOREST_R * FOREST_R ? 1 : 0), 0);
function forestSpot(h) { // Mitte der Stümpfe und leeren Plätze im Umkreis, sonst ein Stück hinter der Hütte
  let sx = 0, sz = 0, n = 0;
  for (const t of trees) if (!t.gone && !t.alive && (t.x - h.x) ** 2 + (t.z - h.z) ** 2 < FOREST_R * FOREST_R) { sx += t.x; sz += t.z; n++; }
  if (n) return { x: sx / n, z: sz / n };
  const d = Math.hypot(h.x, h.z) || 1; return { x: h.x + h.x / d * 3, z: h.z + h.z / d * 3 };
}
const alertRing = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0, depthWrite: false }));
alertRing.visible = false; scene.add(alertRing);
function updateForestAlert(dt, t) {
  const A = forestAlert;
  if (alertRing.visible) { alertRing.position.set(A.at.x, Math.max(heightAt(A.at.x, A.at.z), 0) + .12, A.at.z); alertRing.material.opacity = .35 + .25 * Math.sin(t * 3); alertRing.scale.setScalar(1 + .03 * Math.sin(t * 3)); }
  if ((A.checkT -= dt) > 0) return; A.checkT = 2; A.cool -= 2;
  if (A.hut) { if (!huts.includes(A.hut) || forestAround(A.hut) >= FOREST_LOW + 2) A.hut = null; return; }
  if (A.cool > 0) return;
  for (const h of huts) if (h.role === 'lumber' && villagers.some(v => v.hut === h) && forestAround(h) < FOREST_LOW) {
    A.hut = h; A.at = forestSpot(h); toast('Ein Holzfäller meldet: Sein Wald geht zur Neige. Regen dort lässt ihn nachwachsen.', 4.5); break;
  }
}
function forestHelped(x, z) { // nach einem Regen
  const A = forestAlert; if (!A.hut || Math.hypot(x - A.at.x, z - A.at.z) > 6) return;
  addGlaube(10, A.hut.x, heightAt(A.hut.x, A.hut.z) + 1.4, A.hut.z); floatText(A.hut.x, heightAt(A.hut.x, A.hut.z) + 2, A.hut.z, 'Danke!', 's');
  toast('Der Holzfäller dankt dir: Sein Wald wächst nach.', 3); A.hut = null; A.cool = 60;
}

export { alertRing, forestAlert, forestHelped, updateForestAlert };
