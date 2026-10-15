// Trampelpfade: Abnutzung des Bodens, wo Bewohner oft gehen

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { C, CELL, H, HALF, J, N, SEG, tCol, terrainColor, tg } from './terrain.js';

// Trampelpfade: jeder Geländepunkt zählt, wie lange dort gelaufen wurde (Sekunden, gedeckelt).
// Ab etwa 6 s färbt sich das Gras zu Erde, bei 30 s ist der Pfad voll ausgetreten. Ungenutzte Pfade wachsen langsam zu.
// Später lassen sich ausgetretene Pfade mit Stein zu Straßen ausbauen (dafür ist WEAR die Grundlage).
const WEAR = new Float32Array(N * N), WEAR_MAX = 40, wearDirty = new Set();
if (S.pathsN !== N) S.paths = []; // gespeicherte Pfade passen nur zur gleichen Rastergröße
if (Array.isArray(S.paths)) for (let i = 0; i + 1 < S.paths.length; i += 2) { const k = S.paths[i] | 0; if (k >= 0 && k < N * N) WEAR[k] = Math.min(WEAR_MAX, +S.paths[i + 1] || 0); }
function vertexColor(k) {
  const c = terrainColor(H[k], J[k], k), w = WEAR[k];
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
  for (let k = 0; k < WEAR.length; k++) if (WEAR[k] > 0) { WEAR[k] *= decay; if (WEAR[k] < 6.5 && WEAR[k] > 4) wearDirty.add(k); if (WEAR[k] < .05) WEAR[k] = 0; }
  if (!wearDirty.size) return;
  for (const k of wearDirty) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
  wearDirty.clear(); tCol.needsUpdate = true;
}
onSave(savePaths);
function savePaths() { const out = []; for (let k = 0; k < WEAR.length; k++) if (WEAR[k] > 3) out.push(k, Math.round(WEAR[k])); S.paths = out; S.pathsN = N; }
for (let k = 0; k < N * N; k++) if (WEAR[k] > 6) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
tCol.needsUpdate = true;

export { WEAR, addWear, setTerrainColor, terrainColorOf, updateWear, vertexColor };
