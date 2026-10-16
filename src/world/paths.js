// Trampelpfade: Abnutzung des Bodens, wo Bewohner oft gehen

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { C, CELL, H, HALF, J, N, SEG, tCol, terrainColor, tg } from './terrain.js';

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
  if (PAVE[k]) return c.copy(C.pave).lerp(C.pave2, hash(k) * .8 + J[k] * .2); // Pflastersteine, jeder Punkt etwas anders
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
// Ein Stein pflastert die ausgetretenen Punkte im Umkreis r (folgt so der Form des Pfads); liefert die Anzahl
function paveAt(x, z, r = .8) {
  let n = 0; const i0 = Math.floor((x - r + HALF) / CELL), i1 = Math.ceil((x + r + HALF) / CELL), j0 = Math.floor((z - r + HALF) / CELL), j1 = Math.ceil((z + r + HALF) / CELL);
  for (let j = Math.max(1, j0); j <= Math.min(SEG - 1, j1); j++) for (let i = Math.max(1, i0); i <= Math.min(SEG - 1, i1); i++) {
    const k = j * N + i, px = -HALF + i * CELL, pz = -HALF + j * CELL;
    if (PAVE[k] || WEAR[k] < 12 || Math.hypot(px - x, pz - z) > r || H[k] < .1) continue;
    PAVE[k] = 1; WEAR[k] = WEAR_MAX; wearDirty.add(k); n++;
  }
  return n;
}
// Nächste Stelle zum Pflastern: gut ausgetreten, noch nicht gepflastert, nah am Dorf; bevorzugt neben schon
// gepflasterten Stellen, so wachsen die Straßen vom Dorf aus weiter. skip: Stellen, an denen schon jemand pflastert
function paveSpot(skip = []) {
  let best = -1, bs = 1e9;
  for (let k = 0; k < WEAR.length; k++) {
    if (PAVE[k] || WEAR[k] < 22 || H[k] < .1) continue;
    const i = k % N, j = (k - i) / N, x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x, z);
    if (d > 22 || skip.some(p => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
    const next = PAVE[k - 1] || PAVE[k + 1] || PAVE[k - N] || PAVE[k + N] || PAVE[k - N - 1] || PAVE[k + N + 1];
    const sc = d - (next ? 6 : 0) - WEAR[k] * .05; if (sc < bs) { bs = sc; best = k; }
  }
  if (best < 0) return null; const i = best % N, j = (best - i) / N; return { x: -HALF + i * CELL, z: -HALF + j * CELL };
}
const pavedCount = () => { let n = 0; for (let k = 0; k < PAVE.length; k++) n += PAVE[k]; return n; };
for (let k = 0; k < N * N; k++) if (WEAR[k] > 6) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
tCol.needsUpdate = true;

export { PAVE, WEAR, addWear, paveAt, paveSpot, pavedAt, pavedCount, setTerrainColor, terrainColorOf, updateWear, vertexColor };
