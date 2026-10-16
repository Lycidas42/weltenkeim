// Straßennetz (werkstaetten.md 3): vom Lager zu jeder Werkstatt und zur Mine. Die Strecken plant die Wegsuche der
// Bewohner, gepflastert wird zuerst entlang dieser Straßen, vom Lager nach außen. Breite Pflasterflächen aus älteren
// Spielständen werden beim ersten Planen auf Straßenbreite zurückgebaut.

import { S } from '../core/state.js';
import { CELL, H, HALF, N, SEG, streamDist } from '../world/terrain.js';
import { PAVE, ROAD_FILL, paveFill, unpave } from '../world/paths.js';
import { buildNav, findPath, navReady, navV } from '../world/nav.js';
import { PLAZA } from './layout.js';
import { huts, lagerDrop } from './huts.js';
import { hutWork } from './build.js';

const ROAD_R = .42; // halbe Straßenbreite: zwei bis drei Geländepunkte
const PLAN = new Float32Array(N * N).fill(-1); // Abstand entlang der Straße vom Lager, -1 = keine Straße
let planSig = '', trimmed = false;
// Straßen neu planen, wenn eine Hütte dazugekommen ist
function ensurePlan() {
  const sig = huts.map(h => h.role).join();
  if (sig === planSig) return;
  if (!navReady) buildNav();
  planSig = sig; PLAN.fill(-1);
  const from = lagerDrop();
  for (const h of huts) {
    const to = hutWork(h), pts = [{ x: from.x, z: from.z }, ...findPath(navV, from.x, from.z, to.x, to.z)];
    let d = 0;
    for (let p = 1; p < pts.length; p++) {
      const a = pts[p - 1], b = pts[p], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / .12));
      for (let s = 0; s <= n; s++) mark(a.x + (b.x - a.x) * s / n, a.z + (b.z - a.z) * s / n, d + L * s / n);
      d += L;
    }
  }
  if (!trimmed) { trimmed = true; trim(); }
}
function mark(x, z, d) {
  const i0 = Math.max(1, Math.floor((x - ROAD_R + HALF) / CELL)), i1 = Math.min(SEG - 1, Math.ceil((x + ROAD_R + HALF) / CELL));
  const j0 = Math.max(1, Math.floor((z - ROAD_R + HALF) / CELL)), j1 = Math.min(SEG - 1, Math.ceil((z + ROAD_R + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = -HALF + i * CELL, pz = -HALF + j * CELL, k = j * N + i;
    if (Math.hypot(px - x, pz - z) > ROAD_R || H[k] < .1 || streamDist(px, pz) < .5 || Math.hypot(px - PLAZA.x, pz - PLAZA.z) < PLAZA.r + .1) continue;
    if (PLAN[k] < 0 || d < PLAN[k]) PLAN[k] = d;
  }
}
// Zu breite Pflasterflächen (aus der Zeit vor der Breitengrenze): Punkte abseits der Straßen, um die herum zu viel
// gepflastert ist, werden wieder Erde; die Steine kommen zurück ins Lager (etwa ein Stein je drei Punkte)
// Maßstab ist die Lage vor dem Rückbau: Ein schmaler Weg hat höchstens etwa ROAD_FILL gepflasterte Punkte im 5×5-Feld,
// eine Fläche mehr (auch an ihrem Rand). Was danach abseits der Straßen fast allein liegt, kommt ebenfalls weg.
function trim() {
  const drop = [], lo = 2 * N + 2, hi = PAVE.length - 2 * N - 2;
  for (let k = lo; k < hi; k++) if (PAVE[k] && PLAN[k] < 0 && paveFill(k) > ROAD_FILL + 1) drop.push(k);
  for (const k of drop) unpave(k);
  const lone = [];
  for (let k = lo; k < hi; k++) { if (!PAVE[k] || PLAN[k] >= 0) continue; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) n += PAVE[k + dj * N + di]; if (n <= 2) lone.push(k); }
  for (const k of lone) unpave(k); drop.push(...lone);
  if (drop.length) S.stone += Math.round(drop.length / 3);
}
// Nächste Stelle zum Pflastern auf einer geplanten Straße, die dem Lager am nächsten ist; skip: dort pflastert schon jemand
function roadSpot(skip = []) {
  ensurePlan();
  let best = -1, bd = 1e9;
  for (let k = 0; k < PLAN.length; k++) {
    if (PLAN[k] < 0 || PAVE[k] || PLAN[k] >= bd) continue;
    const i = k % N, j = (k - i) / N, x = -HALF + i * CELL, z = -HALF + j * CELL;
    if (skip.some(p => Math.hypot(p.x - x, p.z - z) < 1.2)) continue;
    bd = PLAN[k]; best = k;
  }
  if (best < 0) return null; const i = best % N, j = (best - i) / N; return { x: -HALF + i * CELL, z: -HALF + j * CELL, plan: true };
}
// jede zweite Sekunde: Straßen planen, sobald die Wegsuche bereit ist (beim ersten Mal auch der Rückbau)
let roadT = 0;
function updateRoads(dt) { if ((roadT -= dt) > 0) return; roadT = 2; ensurePlan(); }
const onRoad = k => PLAN[k] >= 0; // für paveAt: auf geplanten Straßen wird ohne Rücksicht auf Abnutzung gepflastert

export { PLAN, ensurePlan, onRoad, roadSpot, updateRoads };
