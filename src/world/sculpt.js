// Gelände formen (Werkzeug) und Bauplätze ebnen

import { clamp, smooth } from '../core/util.js';
import { S } from '../core/state.js';
import { CELL, H, HALF, N, SEG, STREAM, fitStream, heightAt, markTerrainDirty, tCol, tPos, updateSea } from './terrain.js';
import { vertexColor } from './paths.js';

function sculpt(px, pz, dir, dt) {
  const pw = 1 + 0.35 * (S.hand - 1), R = 2.6 * pw, str = 2.6 * pw * dt * dir;
  const i0 = Math.max(1, Math.floor((px - R + HALF) / CELL)), i1 = Math.min(SEG - 1, Math.ceil((px + R + HALF) / CELL));
  const j0 = Math.max(1, Math.floor((pz - R + HALF) / CELL)), j1 = Math.min(SEG - 1, Math.ceil((pz + R + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - px, z - pz) / R;
    if (d >= 1) continue;
    const k = j * N + i, h = clamp(H[k] + str * (1 + Math.cos(Math.PI * d)) / 2, -3, 8.5);
    H[k] = h; tPos.setY(k, h); const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b);
  }
  tPos.needsUpdate = true; tCol.needsUpdate = true; markTerrainDirty(); followStream(px, pz, R); refreshSea();
}
// Bauplatz einebnen: innen ganz auf die Höhe der Mitte (oder eine vorgegebene Höhe), zum Rand hin weich auslaufend
function flattenAt(px, pz, R, target = heightAt(px, pz)) {
  const i0 = Math.max(1, Math.floor((px - R + HALF) / CELL)), i1 = Math.min(SEG - 1, Math.ceil((px + R + HALF) / CELL));
  const j0 = Math.max(1, Math.floor((pz - R + HALF) / CELL)), j1 = Math.min(SEG - 1, Math.ceil((pz + R + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - px, z - pz) / R;
    if (d >= 1) continue;
    const k = j * N + i, h = H[k] + (target - H[k]) * smooth(1, .55, d);
    H[k] = h; tPos.setY(k, h); const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b);
  }
  tPos.needsUpdate = true; tCol.needsUpdate = true; markTerrainDirty(); followStream(px, pz, R); refreshSea();
}

// Wurde Gelände am Bach verändert, passt sich der Bach an (Bett nachgraben, Wasserspiegel nachführen)
function followStream(px, pz, R) {
  if (!STREAM.pts.some(p => Math.abs(p.x - px) < R + 2 && Math.abs(p.z - pz) < R + 2)) return;
  for (const k of fitStream()) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
  tCol.needsUpdate = true;
}
// Meer neu bestimmen: läuft eine Grube voll (Graben bis zur Küste) oder fällt trocken, die Punkte neu färben
function refreshSea() { const ch = updateSea(); for (const k of ch) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); } if (ch.length) { tCol.needsUpdate = true; markTerrainDirty(); } }
// geformtes Gelände aus dem Spielstand: Bach gleich anpassen
if (S.terrain && S.terrain.length) { followStream(0, 0, 99); refreshSea(); }

export { flattenAt, sculpt };
