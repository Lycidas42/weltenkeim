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
  if ((stonesT -= dt) <= 0 || stonesDirty) { stonesT = 3; const sig = paveSig(), moved = Math.abs(sig - stonesSig) > .01 && stoneCache.size; if (stonesDirty || moved || !stoneCache.size) { layStones(moved || !stoneCache.size); stonesSig = sig; } stonesDirty = false; }
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
function unpave(k) { if (!PAVE[k]) return; PAVE[k] = 0; WEAR[k] = 7; wearDirty.add(k); touchStones(k); }
// Ein Stein pflastert die ausgetretenen Punkte im Umkreis r (folgt so der Form des Pfads); liefert die Anzahl.
// pick: eigene Auswahl der Punkte (geplante Straßen, village/roads.js) statt Abnutzung und Breitengrenze
function paveAt(x, z, r = .6, pick = null) {
  let n = 0; const i0 = Math.floor((x - r + HALF) / CELL), i1 = Math.ceil((x + r + HALF) / CELL), j0 = Math.floor((z - r + HALF) / CELL), j1 = Math.ceil((z + r + HALF) / CELL);
  for (let j = Math.max(1, j0); j <= Math.min(SEG - 1, j1); j++) for (let i = Math.max(1, i0); i <= Math.min(SEG - 1, i1); i++) {
    const k = j * N + i, px = -HALF + i * CELL, pz = -HALF + j * CELL;
    if (PAVE[k] || Math.hypot(px - x, pz - z) > r || H[k] < .1 || (pick ? !pick(k) : WEAR[k] < 12 || !roomForRoad(k))) continue;
    PAVE[k] = 1; WEAR[k] = WEAR_MAX; wearDirty.add(k); touchStones(k); n++;
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
// Pflaster wie bei einer Römerstraße: ein Mosaik aus unregelmäßigen, vieleckigen Steinen, dicht an dicht mit schmalen
// Fugen, am Rand eine Reihe etwas höherer, hellerer Randsteine. Auf einem feinen Raster (halber Punktabstand) liegt je
// Feld ein verschobener Mittelpunkt; jeder Stein ist die Voronoi-Zelle seines Mittelpunkts, etwas eingezogen (Fuge).
// Die Ecken folgen der Geländehöhe. Alles in einer Geometrie, neu gebaut, wenn gepflastert wird oder sich die Höhe ändert.
const FH = CELL / 2, FN = SEG * 2 + 1, stoneC = new THREE.Color();
const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
const stoneMesh = new THREE.Mesh(new THREE.BufferGeometry(), stoneMat); stoneMesh.receiveShadow = true; stoneMesh.frustumCulled = false; scene.add(stoneMesh);
let stonesDirty = true, stonesT = 0, stonesSig = 0;
// fertige Steine je Feld des feinen Rasters; nach dem Pflastern wird nur die Umgebung der geänderten Punkte neu gelegt
const stoneCache = new Map(), stoneTouched = [];
const touchStones = k => { stoneTouched.push(k); stonesDirty = true; };
const seedX = (fi, fj) => -HALF + fi * FH + (hash(fi * 7919 + fj * 104729) - .5) * FH * .7;
const seedZ = (fi, fj) => -HALF + fj * FH + (hash(fi * 3571 + fj * 7907 + 11) - .5) * FH * .7;
const onPave = (fi, fj) => { const i = Math.round(fi / 2 + .01), j = Math.round(fj / 2 + .01); return i > 0 && j > 0 && i < SEG && j < SEG && PAVE[j * N + i] === 1; };
function clip(poly, ax, az, nx, nz) { // Halbebene: Punkte p mit (p - a) · n <= 0 bleiben
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], dp = (p[0] - ax) * nx + (p[1] - az) * nz, dq = (q[0] - ax) * nx + (q[1] - az) * nz;
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
function stoneAt(fi, fj) { // ein Stein: Voronoi-Zelle, eingezogen, Ecken auf Geländehöhe; null, wenn hier kein Pflaster liegt
  if (!onPave(fi, fj)) return null;
  const sx = seedX(fi, fj), sz = seedZ(fi, fj);
  let poly = [[sx - FH, sz - FH], [sx + FH, sz - FH], [sx + FH, sz + FH], [sx - FH, sz + FH]], edge = false;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    const nx = seedX(fi + di, fj + dj), nz = seedZ(fi + di, fj + dj); if (!onPave(fi + di, fj + dj) && (!di || !dj)) edge = true;
    poly = clip(poly, (sx + nx) / 2, (sz + nz) / 2, nx - sx, nz - sz);
  }
  if (poly.length < 3) return null;
  let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
  const r = hash(fi * 31 + fj * 977), shrink = edge ? .86 : .9, top = (edge ? .05 : .026) + r * .008, pos = [];
  stoneC.copy(C.pave).lerp(C.pave2, edge ? .85 + r * .15 : hash(fi * 13 + fj * 71)).multiplyScalar(.9 + r * .16);
  const pts = poly.map(p => { const x = cx + (p[0] - cx) * shrink, z = cz + (p[1] - cz) * shrink; return [x, z, heightAt(x, z)]; });
  const cy = heightAt(cx, cz) + top + .006; // leicht gewölbt
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    pos.push(cx, cy, cz, b[0], b[2] + top, b[1], a[0], a[2] + top, a[1]); // Oberseite (von oben gegen den Uhrzeigersinn)
    pos.push(a[0], a[2] + top, a[1], b[0], b[2] + top, b[1], b[0], b[2] - .015, b[1], a[0], a[2] + top, a[1], b[0], b[2] - .015, b[1], a[0], a[2] - .015, a[1]); // Seite bis in den Boden
  }
  const col = new Float32Array(pos.length); for (let v = 0; v < col.length; v += 3) { col[v] = stoneC.r; col[v + 1] = stoneC.g; col[v + 2] = stoneC.b; }
  return { pos: new Float32Array(pos), col };
}
function layStones(all) {
  if (all) { stoneCache.clear(); for (let fj = 2; fj < FN - 2; fj++) for (let fi = 2; fi < FN - 2; fi++) { const st = stoneAt(fi, fj); if (st) stoneCache.set(fj * FN + fi, st); } }
  else for (const k of stoneTouched) { // nur die Felder rund um geänderte Punkte
    const i = k % N, j = (k - i) / N;
    for (let fj = 2 * j - 3; fj <= 2 * j + 3; fj++) for (let fi = 2 * i - 3; fi <= 2 * i + 3; fi++) { if (fi < 2 || fj < 2 || fi >= FN - 2 || fj >= FN - 2) continue; const st = stoneAt(fi, fj), key = fj * FN + fi; if (st) stoneCache.set(key, st); else stoneCache.delete(key); }
  }
  stoneTouched.length = 0;
  let n = 0; for (const st of stoneCache.values()) n += st.pos.length;
  const pos = new Float32Array(n), col = new Float32Array(n); let o = 0;
  for (const st of stoneCache.values()) { pos.set(st.pos, o); col.set(st.col, o); o += st.pos.length; }
  stoneMesh.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); // flatShading: keine Normalen nötig
  stoneMesh.geometry = g;
}
// Höhe der gepflasterten Punkte als Kennzahl: ändert sie sich (Hand formt das Gelände), neu legen
const paveSig = () => { let h = 0; for (let k = 0; k < PAVE.length; k++) if (PAVE[k]) h += H[k] * (1 + (k % 7)); return h; };
const pavedCount = () => { let n = 0; for (let k = 0; k < PAVE.length; k++) n += PAVE[k]; return n; };
for (let k = 0; k < N * N; k++) if (WEAR[k] > 6) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
tCol.needsUpdate = true;

export { PAVE, ROAD_FILL, WEAR, addWear, paveAt, paveFill, unpave, paveSpot, pavedAt, pavedCount, setTerrainColor, terrainColorOf, updateWear, vertexColor };
