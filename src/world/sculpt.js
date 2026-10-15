// Gelände formen (Werkzeug) und Bauplätze ebnen

import { clamp, smooth } from '../core/util.js';
import { S } from '../core/state.js';
import { CELL, H, HALF, N, SEG, heightAt, markTerrainDirty, tCol, tPos } from './terrain.js';
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
  tPos.needsUpdate = true; tCol.needsUpdate = true; markTerrainDirty();
}
// Bauplatz einebnen: innen ganz auf die Höhe der Mitte, zum Rand hin weich auslaufend
function flattenAt(px, pz, R) {
  const target = heightAt(px, pz);
  const i0 = Math.max(1, Math.floor((px - R + HALF) / CELL)), i1 = Math.min(SEG - 1, Math.ceil((px + R + HALF) / CELL));
  const j0 = Math.max(1, Math.floor((pz - R + HALF) / CELL)), j1 = Math.min(SEG - 1, Math.ceil((pz + R + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - px, z - pz) / R;
    if (d >= 1) continue;
    const k = j * N + i, h = H[k] + (target - H[k]) * smooth(1, .55, d);
    H[k] = h; tPos.setY(k, h); const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b);
  }
  tPos.needsUpdate = true; tCol.needsUpdate = true; markTerrainDirty();
}

export { flattenAt, sculpt };
