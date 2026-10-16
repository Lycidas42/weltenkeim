// Wegfindung: Raster, Hindernisse, A*, Schritte

import { clamp } from '../core/util.js';
import { S } from '../core/state.js';
import { HALF, SIZE, seaAt } from './terrain.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { modelInfo } from '../assets/models.js';
import { LAGER, MILL_POS, PLAZA, SB, SHRINE_POS, WELL } from '../village/layout.js';
import { trees } from './trees.js';
import { sacredProps } from '../village/shrine.js';
import { build, houses } from '../village/houses.js';
import { FARM, farmPt, huts, lager, localPt, onFarm } from '../village/huts.js';
import { farms } from '../farm/farm.js';
import { bushes, rocks } from './nature.js';

// Raster über die ganze Insel (NAV_C Einheiten je Feld). Belegt sind Gebäude (gedrehte Rechtecke aus den Modellmaßen),
// Felsen, Baumstämme und Wasser. Es gibt zwei Raster: eins für Bewohner und eins mit mehr Abstand für den Tiergeist.
// Das Raster wird jede Sekunde neu gestempelt (Bäume wachsen und fallen, Häuser entstehen, das Gelände wird geformt).
const NAV_C = .25, NAV_N = Math.round(SIZE / NAV_C), NAV_SZ = NAV_N * NAV_N;
const navV = { m: .12, g: new Uint8Array(NAV_SZ) }, navF = { m: .3, g: new Uint8Array(NAV_SZ) };
const navWater = new Uint8Array(NAV_SZ);
const navCell = (x, z) => { const i = Math.floor((x + HALF) / NAV_C), j = Math.floor((z + HALF) / NAV_C); return i < 0 || j < 0 || i >= NAV_N || j >= NAV_N ? -1 : j * NAV_N + i; };
const cellX = c => -HALF + (c % NAV_N + .5) * NAV_C, cellZ = c => -HALF + (Math.floor(c / NAV_N) + .5) * NAV_C;
// Grundrisse im Modellraum: Mitte (cx, cz) und halbe Ausdehnung (hx, hz)
function buildingObstacles() {
  const rects = [], circles = [];
  const rect = (e, f) => { const k = e.o.scale.x, p = localPt(e, f[0], f[1]); rects.push({ x: p.x, z: p.z, ry: e.o.rotation.y, hx: f[2] * k, hz: f[3] * k }); };
  for (const h of houses) { rect(h, modelInfo(h.key).foot); if (h.garden) rects.push({ x: h.garden.x, z: h.garden.z, ry: h.garden.ry, hx: .58, hz: .4 }); }
  for (const h of huts) { rect(h, modelInfo(h.key).foot); if (h.oven) circles.push({ x: h.oven.x, z: h.oven.z, r: .36 }, { x: localPt(h, -.95 - .62 / SB, .05).x, z: localPt(h, -.95 - .62 / SB, .05).z, r: .28 }); if (h.pile) circles.push({ x: h.pile.x, z: h.pile.z, r: .38 }); }
  for (const F of farms) { // Felder und Weidezaun (die Weide selbst bleibt Gras)
    for (const f of F.fields) rects.push({ x: f.x, z: f.z, ry: f.ry, hx: FARM.fw / 2, hz: FARM.fd / 2 });
    const P = FARM.pen, fr = (lx, lz, hx, hz) => { const p = farmPt(F, lx, lz); rects.push({ x: p.x, z: p.z, ry: F.ry, hx, hz }); };
    fr((P.x0 + P.x1) / 2, P.z0, (P.x1 - P.x0) / 2 + .04, .04); fr((P.x0 + P.x1) / 2, P.z1, (P.x1 - P.x0) / 2 + .04, .04); fr(P.x0, (P.z0 + P.z1) / 2, .04, (P.z1 - P.z0) / 2); fr(P.x1, (P.z0 + P.z1) / 2, .04, (P.z1 - P.z0) / 2);
    fr(FARM.coop[0] - .1, FARM.coop[1] + .05, .56, .38); for (const [hx, hz] of FARM.hay) { const p = farmPt(F, hx, hz); circles.push({ x: p.x, z: p.z, r: .22 }); }
    circles.push({ x: F.barrow.x, z: F.barrow.z, r: .3 }, { x: F.bucket.x, z: F.bucket.z, r: .14 });
  }
  rects.push({ x: lager.x, z: lager.z, ry: lager.o.rotation.y, hx: 2.0, hz: .86 });
  circles.push({ x: SHRINE_POS.x, z: SHRINE_POS.z, r: 1.62 }, { x: WELL.x, z: WELL.z, r: .45 }, { x: MILL_POS.x, z: MILL_POS.z, r: .8 }, ...sacredProps.obstacles);
  if (build.construction) circles.push({ x: build.construction.site.x, z: build.construction.site.z, r: .9 });
  return { rects, circles };
}
// Liegt der Punkt (mit Abstand m) in oder an einem Gebäude, Garten, Feld, Zaun?
function nearBuilding(x, z, m = .5) {
  const o = buildingObstacles();
  for (const c of o.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + m) ** 2) return true;
  for (const r of o.rects) { const dx = x - r.x, dz = z - r.z, co = Math.cos(r.ry), si = Math.sin(r.ry); if (Math.abs(dx * co - dz * si) < r.hx + m && Math.abs(dx * si + dz * co) < r.hz + m) return true; }
  return Math.hypot(x - LAGER.x, z - LAGER.z) < 2.6 || Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + .5 || onFarm(x, z, .3);
}
function navObstacles() {
  const { rects, circles } = buildingObstacles();
  for (const r of rocks) if (!r.moving) circles.push({ x: r.x, z: r.z, r: r.s * .95 }); // ein gerade geschobener Felsen bewegt sich mit der Kreatur
  for (const b of bushes) circles.push({ x: b.x, z: b.z, r: .17 * b.s });
  for (const t of trees) if (t.alive && !t.gone && t.g > .25) circles.push({ x: t.x, z: t.z, r: .12 });
  return { rects, circles };
}
function stampNav(nav, obs) {
  const g = nav.g, m = nav.m; g.set(navWater);
  for (const c of obs.circles) {
    const R = c.r + m, i0 = Math.max(0, Math.floor((c.x - R + HALF) / NAV_C)), i1 = Math.min(NAV_N - 1, Math.floor((c.x + R + HALF) / NAV_C));
    const j0 = Math.max(0, Math.floor((c.z - R + HALF) / NAV_C)), j1 = Math.min(NAV_N - 1, Math.floor((c.z + R + HALF) / NAV_C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -HALF + (i + .5) * NAV_C, z = -HALF + (j + .5) * NAV_C; if ((x - c.x) ** 2 + (z - c.z) ** 2 < R * R) g[j * NAV_N + i] = 1; }
  }
  for (const r of obs.rects) {
    const hx = r.hx + m, hz = r.hz + m, R = Math.hypot(hx, hz), co = Math.cos(r.ry), si = Math.sin(r.ry);
    const i0 = Math.max(0, Math.floor((r.x - R + HALF) / NAV_C)), i1 = Math.min(NAV_N - 1, Math.floor((r.x + R + HALF) / NAV_C));
    const j0 = Math.max(0, Math.floor((r.z - R + HALF) / NAV_C)), j1 = Math.min(NAV_N - 1, Math.floor((r.z + R + HALF) / NAV_C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = -HALF + (i + .5) * NAV_C - r.x, dz = -HALF + (j + .5) * NAV_C - r.z;
      if (Math.abs(dx * co - dz * si) < hx && Math.abs(dx * si + dz * co) < hz) g[j * NAV_N + i] = 1;
    }
  }
}
let navReady = false, navT = 0, navBudget = 0;
// Wegnetz jede Sekunde neu (Gebäude, Bäume, geformtes Gelände); Rechenbudget der Wegsuche je Bild
function updateNav(dt) {
  navT -= dt; if (navT <= 0 || !navReady) { navT = 1; buildNav(); }
  navBudget = 30000;
}
function buildNav() {
  for (let c = 0; c < NAV_SZ; c++) navWater[c] = seaAt(cellX(c), cellZ(c)) ? 1 : 0;
  const obs = navObstacles();
  navF.m = clamp(CREATURES[fox.kind || S.creature].h * .15, .22, .42); // großer Hirsch braucht mehr Platz als die Katze
  stampNav(navV, obs); stampNav(navF, obs); navReady = true;
}
const blockedAt = (nav, x, z) => { const c = navCell(x, z); return c < 0 || nav.g[c] === 1; };
// freie Sicht auf dem Raster (Strecke in kleinen Schritten abtasten)
function navLos(g, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (NAV_C * .45));
  for (let k = 1; k < n; k++) { const c = navCell(ax + (bx - ax) * k / n, az + (bz - az) * k / n); if (c < 0 || g[c]) return false; }
  return true;
}
// nächstes freies Feld (ringförmig suchen)
function nearestFree(g, c, maxR = 14) {
  const ci = c % NAV_N, cj = Math.floor(c / NAV_N);
  for (let r = 1; r <= maxR; r++) {
    let best = -1, bd = 1e9;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= NAV_N || j >= NAV_N) continue;
      const k = j * NAV_N + i; if (g[k]) continue; const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = k; }
    }
    if (best >= 0) return best;
  }
  return -1;
}
// A* mit 8 Nachbarn (keine Ecken schneiden), danach Wegpunkte glätten
const aG = new Float32Array(NAV_SZ), aFrom = new Int32Array(NAV_SZ), aSeen = new Uint32Array(NAV_SZ), aShut = new Uint32Array(NAV_SZ);
const hIdx = new Int32Array(NAV_SZ), hF = new Float32Array(NAV_SZ); let aStamp = 0;
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
function findPath(nav, sx, sz, tx, tz) {
  const g = nav.g, end = { x: tx, z: tz };
  let s = navCell(sx, sz); const t0 = navCell(tx, tz);
  if (s < 0 || t0 < 0) return [end];
  const pts = [];
  if (g[s]) { s = nearestFree(g, s); if (s < 0) return [end]; pts.push({ x: cellX(s), z: cellZ(s) }); } // erst aus dem Hindernis heraus
  const t = g[t0] ? nearestFree(g, t0) : t0; if (t < 0) return [end];
  const ox = pts.length ? pts[0].x : sx, oz = pts.length ? pts[0].z : sz;
  if (s === t || navLos(g, ox, oz, cellX(t), cellZ(t))) { if (t !== t0) pts.push({ x: cellX(t), z: cellZ(t) }); pts.push(end); return pts; }
  if (++aStamp > 4e9) { aStamp = 1; aSeen.fill(0); aShut.fill(0); }
  const st = aStamp, ti = t % NAV_N, tj = Math.floor(t / NAV_N);
  const hEst = c => { const dx = Math.abs(c % NAV_N - ti), dz = Math.abs(Math.floor(c / NAV_N) - tj); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  let hn = 0;
  const push = (c, f) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hIdx[k] = hIdx[p]; hF[k] = hF[p]; k = p; } hIdx[k] = c; hF[k] = f; };
  const pop = () => {
    const top = hIdx[0], lc = hIdx[--hn], lf = hF[hn]; let k = 0;
    while (true) { let ch = 2 * k + 1; if (ch >= hn) break; if (ch + 1 < hn && hF[ch + 1] < hF[ch]) ch++; if (hF[ch] >= lf) break; hIdx[k] = hIdx[ch]; hF[k] = hF[ch]; k = ch; }
    hIdx[k] = lc; hF[k] = lf; return top;
  };
  aG[s] = 0; aSeen[s] = st; aFrom[s] = -1; push(s, hEst(s));
  let found = false, n = 0;
  while (hn > 0) {
    const c = pop(); if (aShut[c] === st) continue; aShut[c] = st;
    if (c === t) { found = true; break; }
    if (++n > 24000) break;
    const ci = c % NAV_N, cj = Math.floor(c / NAV_N);
    for (const [di, dj, w] of NB) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NAV_N || j >= NAV_N) continue;
      const k = j * NAV_N + i; if (g[k] || aShut[k] === st) continue;
      if (di && dj && (g[cj * NAV_N + i] || g[j * NAV_N + ci])) continue;
      const ng = aG[c] + w;
      if (aSeen[k] !== st || ng < aG[k]) { aSeen[k] = st; aG[k] = ng; aFrom[k] = c; push(k, ng + hEst(k)); }
    }
  }
  navBudget -= n;
  if (!found) { pts.push(end); return pts; } // kein Weg (z. B. eingeschlossen): direkt hin
  const cells = []; for (let c = t; c !== -1; c = aFrom[c]) cells.push(c); cells.reverse();
  // glätten: vom aktuellen Punkt aus so weit wie möglich geradeaus
  let cx = ox, cz = oz, i = 0;
  while (i < cells.length - 1) {
    let j = i + 1; while (j + 1 < cells.length && navLos(g, cx, cz, cellX(cells[j + 1]), cellZ(cells[j + 1]))) j++;
    cx = cellX(cells[j]); cz = cellZ(cells[j]); pts.push({ x: cx, z: cz }); i = j;
  }
  pts.push(end); return pts;
}
// Laufen entlang des Wegs; der Weg wird erst berechnet, wenn im Frame noch Rechenzeit frei ist
function setGoal(o, x, z, nav) { o.tx = x; o.tz = z; o.path = null; o.pi = 0; o.nav = nav; }
function followPath(o, d) {
  if (!o.path) {
    if (!navReady) buildNav();
    if (navBudget <= 0) return false; // diesen Frame warten, die Wegsuche ist für jetzt ausgelastet
    o.path = findPath(o.nav || navV, o.x, o.z, o.tx, o.tz); o.pi = 0;
  }
  while (o.pi < o.path.length) {
    const w = o.path[o.pi];
    if (!stepTo(o, w.x, w.z, d)) return false;
    o.pi++; d = 0; // Rest des Schritts verfällt, der nächste Wegpunkt kommt im nächsten Frame
    if (o.pi < o.path.length) return false;
  }
  return true;
}
// freie Bewegung (Flucht, Spielen): nur weiter, wenn das Ziel des Schritts frei ist
function moveFree(o, tx, tz, d, nav) {
  const dx = tx - o.x, dz = tz - o.z, dist = Math.hypot(dx, dz); if (dist < 1e-4) return true;
  const k = Math.min(1, d / dist), nx = o.x + dx * k, nz = o.z + dz * k;
  if (blockedAt(nav, nx, nz) && !blockedAt(nav, o.x, o.z)) return false;
  return stepTo(o, tx, tz, d);
}
// sichtbare Blickrichtung folgt o.h weich (zeitbasiert, mit Höchstgeschwindigkeit in rad/s), damit Figuren an Wegecken nicht springen
function smoothH(o, dt, k = 9, max = 7) {
  if (o.vh === undefined) o.vh = o.h;
  const d = Math.atan2(Math.sin(o.h - o.vh), Math.cos(o.h - o.vh));
  o.vh += Math.sign(d) * Math.min(Math.abs(d) * (1 - Math.exp(-dt * k)), dt * max);
  return o.vh;
}
function stepTo(o, tx, tz, d) {
  const dx = tx - o.x, dz = tz - o.z, dist = Math.hypot(dx, dz);
  if (dist <= d + .02) { o.x = tx; o.z = tz; return true; }
  o.x += dx / dist * d; o.z += dz / dist * d;
  const th = Math.atan2(dx, dz); let dh = th - o.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); o.h += dh * Math.min(1, .2 + d * 3);
  return false;
}

export { blockedAt, buildNav, findPath, followPath, moveFree, navCell, navF, navReady, navV, navWater, nearBuilding, setGoal, smoothH, updateNav };
