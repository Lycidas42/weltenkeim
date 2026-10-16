// Trampelpfade: Abnutzung des Bodens, wo Bewohner oft gehen

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { scene } from '../core/render.js';
import { C, CELL, H, HALF, J, N, SEG, heightAt, tCol, terrainColor, tg } from './terrain.js';

// Trampelpfade: jeder Geländepunkt zählt, wie lange dort gelaufen wurde (Sekunden, gedeckelt).
// Ab etwa 6 s färbt sich das Gras zu Erde, bei 30 s ist der Pfad voll ausgetreten. Ungenutzte Pfade wachsen langsam zu.
// Gut ausgetretene Pfade pflastern die Bewohner mit Steinen (PAVE, werkstaetten.md 3): gepflastert bleibt ein Weg
// dauerhaft, wächst nicht zu, und man kommt darauf schneller voran.
const WEAR = new Float32Array(N * N), WEAR_MAX = 40, wearDirty = new Set();
if (S.pathsN !== N) S.paths = []; // gespeicherte Pfade passen nur zur gleichen Rastergröße
if (Array.isArray(S.paths)) for (let i = 0; i + 1 < S.paths.length; i += 2) { const k = S.paths[i] | 0; if (k >= 0 && k < N * N) WEAR[k] = Math.min(WEAR_MAX, +S.paths[i + 1] || 0); }
const PAVE = new Uint8Array(N * N);
if (S.pathsN === N && Array.isArray(S.paved)) for (const k of S.paved) if (k >= 0 && k < N * N) { PAVE[k] = 1; WEAR[k] = WEAR_MAX; }
const hash = k => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
function vertexColor(k) {
  const c = terrainColor(H[k], J[k], k), w = WEAR[k];
  if (PAVE[k]) return c.copy(C.paveJoint); // Fugen; die Steine selbst liegen als eigene Körper darauf (paveStones)
  if (w > 6 && H[k] > .15 && H[k] < 3.4) c.lerp(tg.copy(C.path).lerp(C.path2, J[k]), smooth(6, 30, w) * .92);
  return c;
}
function addWear(x, z, dt) { // auf die vier umliegenden Punkte verteilt, so wird der Pfad breiter und weich
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  if (i < 1 || j < 1 || i >= SEG - 1 || j >= SEG - 1) return;
  for (const [di, dj, wgt] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
    const k = (j + dj) * N + i + di; WEAR[k] = Math.min(WEAR_MAX, WEAR[k] + dt * (.6 + wgt)); if (WEAR[k] > 5) wearDirty.add(k);
  }
}
let wearT = 0;
// Grundfarbe des Geländes ändern (Jahreszeiten, Ereignisse): Namen wie in palette.terrain (g1, g2, dry, sand …).
// Das Gelände wird danach über einige Bilder verteilt neu gefärbt.
let repaintK = -1;
function setTerrainColor(name, color) { if (!C[name]) throw new Error('Unbekannte Geländefarbe: ' + name); C[name].set(color); repaintK = 0; }
const terrainColorOf = name => C[name].getHex();
function repaintStep() {
  if (repaintK < 0) return;
  const end = Math.min(N * N, repaintK + 5000);
  for (let k = repaintK; k < end; k++) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
  tCol.needsUpdate = true; repaintK = end < N * N ? end : -1;
}
function updateWear(dt) {
  repaintStep();
  if ((stonesT -= dt) <= 0 || stonesDirty) { stonesT = 2; if (stonesDirty || stoneMesh.count) layStones(); stonesDirty = false; }
  wearT += dt; if (wearT < .5) return;
  // alle halbe Sekunde: Pfade langsam zuwachsen lassen (Halbwertszeit etwa 10 Minuten) und geänderte Punkte neu färben
  const decay = Math.pow(.5, wearT / 600); wearT = 0;
  for (let k = 0; k < WEAR.length; k++) if (WEAR[k] > 0 && !PAVE[k]) { WEAR[k] *= decay; if (WEAR[k] < 6.5 && WEAR[k] > 4) wearDirty.add(k); if (WEAR[k] < .05) WEAR[k] = 0; }
  if (!wearDirty.size) return;
  for (const k of wearDirty) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
  wearDirty.clear(); tCol.needsUpdate = true;
}
onSave(savePaths);
function savePaths() { const out = [], pv = []; for (let k = 0; k < WEAR.length; k++) { if (WEAR[k] > 3) out.push(k, Math.round(WEAR[k])); if (PAVE[k]) pv.push(k); } S.paths = out; S.paved = pv; S.pathsN = N; }
const vtx = (x, z) => { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); return i < 1 || j < 1 || i >= SEG || j >= SEG ? -1 : j * N + i; };
const pavedAt = (x, z) => { const k = vtx(x, z); return k >= 0 && PAVE[k] === 1; };
// Straßen bleiben schmal: Ein Punkt wird nur gepflastert, wenn im 5×5-Feld um ihn herum höchstens ROAD_FILL Punkte
// gepflastert sind. Eine Straße von zwei bis drei Punkten Breite (knapp 1 Einheit) passt, eine ganze Fläche nicht.
const ROAD_FILL = 11;
function paveFill(k) { let n = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) n += PAVE[k + dj * N + di] || 0; return n; }
const roomForRoad = k => paveFill(k) < ROAD_FILL;
// Pflaster wieder entfernen (zu breite Flächen, village/roads.js): der Pfad bleibt ausgetreten
function unpave(k) { if (!PAVE[k]) return; PAVE[k] = 0; WEAR[k] = 7; wearDirty.add(k); stonesDirty = true; }
// Ein Stein pflastert die ausgetretenen Punkte im Umkreis r (folgt so der Form des Pfads); liefert die Anzahl.
// pick: eigene Auswahl der Punkte (geplante Straßen, village/roads.js) statt Abnutzung und Breitengrenze
function paveAt(x, z, r = .6, pick = null) {
  let n = 0; const i0 = Math.floor((x - r + HALF) / CELL), i1 = Math.ceil((x + r + HALF) / CELL), j0 = Math.floor((z - r + HALF) / CELL), j1 = Math.ceil((z + r + HALF) / CELL);
  for (let j = Math.max(1, j0); j <= Math.min(SEG - 1, j1); j++) for (let i = Math.max(1, i0); i <= Math.min(SEG - 1, i1); i++) {
    const k = j * N + i, px = -HALF + i * CELL, pz = -HALF + j * CELL;
    if (PAVE[k] || Math.hypot(px - x, pz - z) > r || H[k] < .1 || (pick ? !pick(k) : WEAR[k] < 12 || !roomForRoad(k))) continue;
    PAVE[k] = 1; WEAR[k] = WEAR_MAX; wearDirty.add(k); n++;
  }
  if (n) stonesDirty = true;
  return n;
}
// Nächste Stelle zum Pflastern: gut ausgetreten, noch nicht gepflastert, nah am Dorf; bevorzugt neben schon
// gepflasterten Stellen, so wachsen die Straßen vom Dorf aus weiter. skip: Stellen, an denen schon jemand pflastert
function paveSpot(skip = []) {
  let best = -1, bs = 1e9;
  for (let k = 0; k < WEAR.length; k++) {
    if (PAVE[k] || WEAR[k] < 22 || H[k] < .1 || k < 2 * N + 2 || k >= PAVE.length - 2 * N - 2 || !roomForRoad(k)) continue;
    const i = k % N, j = (k - i) / N, x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x, z);
    if (d > 22 || skip.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
    const next = PAVE[k - 1] || PAVE[k + 1] || PAVE[k - N] || PAVE[k + N] || PAVE[k - N - 1] || PAVE[k + N + 1];
    const sc = d - (next ? 6 : 0) - WEAR[k] * .05; if (sc < bs) { bs = sc; best = k; }
  }
  if (best < 0) return null; const i = best % N, j = (best - i) / N; return { x: -HALF + i * CELL, z: -HALF + j * CELL };
}
// Pflastersteine wie bei einer Römerstraße: je gepflastertem Geländepunkt vier flache, leicht unregelmäßige Steine,
// der Neigung des Bodens folgend, mit dunklen Fugen dazwischen. Alle in einem InstancedMesh; neu gelegt, wenn gepflastert
// wird, und alle zwei Sekunden der Höhe nach nachgeführt (die Hand kann das Gelände formen)
const STONE_MAX = 16000, stoneMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.172, .06, .172), new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), STONE_MAX);
stoneMesh.castShadow = false; stoneMesh.receiveShadow = true; stoneMesh.frustumCulled = false; stoneMesh.count = 0; scene.add(stoneMesh);
const stoneC = new THREE.Color(), dummy = new THREE.Object3D(), STONE_OFF = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
let stonesDirty = true, stonesT = 0;
function layStones() {
  let n = 0; const q = CELL / 4, e = .08;
  for (let k = 0; k < PAVE.length && n < STONE_MAX - 4; k++) {
    if (!PAVE[k]) continue;
    const i = k % N, j = (k - i) / N, cx = -HALF + i * CELL, cz = -HALF + j * CELL;
    STONE_OFF.forEach(([ox, oz], m) => {
      const r = hash(k * 4 + m), x = cx + ox * q + (r - .5) * .02, z = cz + oz * q + (hash(k * 7 + m) - .5) * .02, h = heightAt(x, z);
      const sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
      dummy.position.set(x, h + .002, z); dummy.rotation.set(-Math.atan(sz), (r - .5) * .3, Math.atan(sx)); // flach auf dem Hang
      const s = .86 + r * .18; dummy.scale.set(s * (.92 + hash(k + m * 13) * .16), .7 + r * .3, s); dummy.updateMatrix();
      stoneMesh.setMatrixAt(n, dummy.matrix); stoneMesh.setColorAt(n, stoneC.copy(C.pave).lerp(C.pave2, hash(k * 3 + m * 5)).multiplyScalar(.92 + r * .14)); n++;
    });
  }
  stoneMesh.count = n; stoneMesh.instanceMatrix.needsUpdate = true; if (stoneMesh.instanceColor) stoneMesh.instanceColor.needsUpdate = true;
}
const pavedCount = () => { let n = 0; for (let k = 0; k < PAVE.length; k++) n += PAVE[k]; return n; };
for (let k = 0; k < N * N; k++) if (WEAR[k] > 6) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
tCol.needsUpdate = true;

export { PAVE, ROAD_FILL, WEAR, addWear, paveAt, paveFill, unpave, paveSpot, pavedAt, pavedCount, setTerrainColor, terrainColorOf, updateWear, vertexColor };
