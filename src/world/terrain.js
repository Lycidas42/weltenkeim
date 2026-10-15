// Gelände: Höhen, Bach, Farben, Gelände-Shader, Höhen- und Tiefenkarte, gespeicherte Formung

import * as THREE from 'three';
import { theme } from '../assets/theme.js';
import { clamp, smooth } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { fbm, noise } from '../core/noise.js';
import { scene } from '../core/render.js';
import { sky, weather } from './sky.js';

const SIZE = 64, SEG = 167, N = SEG + 1, CELL = SIZE / SEG, HALF = SIZE / 2; // Insel etwa ein Drittel größer als anfangs (48)
// Lage des Schreins: auf einem sanften Hügel nordöstlich vor dem Dorf, mit dem Gebirge dahinter.
// Der Prozessionsweg führt vom Rand des Dorfplatzes (Inselmitte) den Hügel hinauf.
const SHRINE_AT = { x: 4.4, z: -7.8 };
const SACRED_SEG = (() => { const d = Math.hypot(SHRINE_AT.x, SHRINE_AT.z), ux = SHRINE_AT.x / d, uz = SHRINE_AT.z / d; return { ax: ux * 2.95, az: uz * 2.95, bx: SHRINE_AT.x - ux * 2.2, bz: SHRINE_AT.z - uz * 2.2, ux, uz, len: d - 5.15 }; })();
// Runddorf: ein Ringweg läuft um den Dorfplatz, die Häuser stehen gleichmäßig auf einem Kreis dahinter (Tür zum Platz),
// jeder Garten liegt genau hinter seinem Haus. RING_R = Ringweg, HOUSE_R = Häuser, GARDEN_R = Gärten.
const RING_R = 3.75, HOUSE_R = 5.7, GARDEN_R = 7.25;
function laneDist(x, z) { return Math.abs(Math.hypot(x, z) - RING_R); } // Abstand zum Ringweg
// Abstand zum Weg (Strecke vom Dorfplatz zum Schreinplatz); Breite des Wegs ±0,6
function sacredDist(x, z) { const S0 = SACRED_SEG, t = clamp(((x - S0.ax) * S0.ux + (z - S0.az) * S0.uz) / S0.len, 0, 1); return Math.hypot(x - (S0.ax + S0.ux * S0.len * t), z - (S0.az + S0.uz * S0.len * t)); }
const H = new Float32Array(N * N), J = new Float32Array(N * N), DRY = new Float32Array(N * N), BARE = new Float32Array(N * N);
// Strand: knapp über und unter dem Wasser wird das Gelände flacher, so entstehen ein breiter Sandstreifen und flaches, helles Ufer
const beach = h => h >= 0 ? (h < 1 ? h * (.42 + .58 * smooth(.25, 1, h)) : h) : h * (.45 + .55 * smooth(-.2, -1.6, h));
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i;
  const d = Math.hypot(x, z) / HALF + fbm(x * .05 + 9, z * .05 - 4) * .28;
  const n = fbm(x * .07 + 3.1, z * .07 - 1.7);
  const mask = smooth(0.92, 0.5, d);
  let h = mask * (1.5 + n * 2.6 + Math.max(0, n) * 5.2) + (1 - mask) * -2.4;
  const vb = smooth(8.5, 4.5, Math.hypot(x, z));
  h = beach(h * (1 - vb) + 1.25 * vb);
  H[k] = h; J[k] = clamp(.5 + noise(x * .35, z * .35) * .8, 0, 1);
  DRY[k] = fbm(x * .13 + 21, z * .13 - 9); BARE[k] = fbm(x * .21 - 5, z * .21 + 14) + noise(x * .9, z * .9) * .12;
}
{
  const hill = (x, z) => 1.3 * smooth(4.6, 1.2, Math.hypot(x - SHRINE_AT.x, z - SHRINE_AT.z));
  let top = 0; { const i = Math.round((SHRINE_AT.x + HALF) / CELL), j = Math.round((SHRINE_AT.z + HALF) / CELL); top = H[j * N + i] + 1.3; }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i, d = Math.hypot(x - SHRINE_AT.x, z - SHRINE_AT.z);
    if (d > 4.7) continue;
    H[k] += hill(x, z); H[k] += (top - H[k]) * smooth(3.2, 2.5, d); // Kuppe eben
  }
}
// Bach: entspringt am höchsten Punkt der Insel und folgt der natürlichen Abflussrinne ins Meer.
// Die Rinne liefert ein Priority Flood vom Meer aus (jeder Punkt kennt seinen Abfluss). Dann wird der Lauf geglättet,
// das Bett ins Gelände gegraben (stets bergab) und STREAM für Wasserband, Abstände und Darstellung gefüllt.
const STREAM = (() => {
  const par = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N), lv = new Float32Array(N * N), heap = [], hv = [];
  const push = (k, v) => { let i = heap.length; heap.push(k); hv.push(v); while (i > 0) { const q = (i - 1) >> 1; if (hv[q] <= v) break; heap[i] = heap[q]; hv[i] = hv[q]; i = q; } heap[i] = k; hv[i] = v; };
  const pop = () => { const top = heap[0], lk = heap.pop(), l = hv.pop(); if (heap.length) { let i = 0; while (true) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && hv[c + 1] < hv[c]) c++; if (hv[c] >= l) break; heap[i] = heap[c]; hv[i] = hv[c]; i = c; } heap[i] = lk; hv[i] = l; } return top; };
  // für die Wegsuche des Wassers sind Dorf und Schreinhügel künstlich erhöht: der Bach fließt außen herum
  const Hr = new Float32Array(N * N); for (let k = 0; k < N * N; k++) { const x = -HALF + (k % N) * CELL, z = -HALF + ((k / N) | 0) * CELL; Hr[k] = H[k] + 6 * smooth(11, 7.5, Math.hypot(x, z)) + 4 * smooth(5.5, 3, Math.hypot(x - SHRINE_AT.x, z - SHRINE_AT.z)); }
  for (let k = 0; k < N * N; k++) if (H[k] < -.05) { done[k] = 1; lv[k] = H[k]; push(k, H[k]); }
  while (heap.length) {
    const k = pop(), i = k % N, j = (k / N) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const n = jj * N + ii; if (done[n]) continue; done[n] = 1; par[n] = k; lv[n] = Math.max(Hr[n], lv[k]); push(n, lv[n]);
    }
  }
  // Quelle: unter den hohen Lagen (ab 60 % der Gipfelhöhe) die, deren Wasser den längsten Weg zum Meer hat
  let top = 0; for (let k = 0; k < N * N; k++) if (H[k] > H[top]) top = k;
  let src = top, bestLen = 0;
  for (let k = 0; k < N * N; k++) {
    if (H[k] < H[top] * .6 || (k % N) % 3 || ((k / N) | 0) % 3) continue; // jeden dritten Punkt prüfen genügt
    let n = 0; for (let q = k; q >= 0 && n < 900; q = par[q]) { n++; if (H[q] < -.05) break; }
    if (n > bestLen) { bestLen = n; src = k; }
  }
  // Quelle nicht oben auf dem Grat, sondern etwas hangabwärts, wo das Wasser aus dem Fels tritt
  { const h0 = H[src]; for (let n = 0, k = src; n < 40 && par[k] >= 0 && H[k] > h0 - .5; n++) { k = par[k]; src = k; } }
  const raw = []; for (let k = src; k >= 0 && raw.length < 600; k = par[k]) { raw.push({ x: -HALF + (k % N) * CELL, z: -HALF + ((k / N) | 0) * CELL }); if (H[k] < -.05) break; }
  // glätten (gleitender Mittelwert) und gleichmäßig neu abtasten
  let pts = raw;
  for (let it = 0; it < 4; it++) pts = pts.map((p, i) => { if (i === 0 || i === pts.length - 1) return p; const a = pts[i - 1], b = pts[i + 1]; return { x: (a.x + 2 * p.x + b.x) / 4, z: (a.z + 2 * p.z + b.z) / 4 }; });
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z); acc += d; if (acc >= .3) { out.push(b); acc = 0; } }
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  const hAt = (x, z) => { const fx = clamp((x + HALF) / CELL, 0, SEG - .001), fz = clamp((z + HALF) / CELL, 0, SEG - .001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i; return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v; };
  let len = 0; out.forEach((p, i) => { if (i) len += Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z); p.s = len; });
  let bed = 1e9;
  for (const p of out) { const f = p.s / (len || 1); p.w = (.22 + .4 * f) * (.45 + .55 * smooth(0, 1.6, p.s)); const depth = .14 + .1 * f; bed = Math.min(bed - .004, hAt(p.x, p.z) - depth); p.bed = bed; } // Bett immer bergab, an der Quelle schmal
  // Bett graben: Geländepunkte nahe am Lauf auf Bett-Höhe senken, Ufer weich auslaufen lassen
  const dist = new Float32Array(N * N).fill(99), cells = []; // cells: Geländepunkt, Abschnitt, Lage darauf, Abstand (zum Nachgraben)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i; let bd = 99, bp = null;
    for (let q = 1; q < out.length; q++) {
      const a = out[q - 1], b = out[q]; if (Math.abs(x - a.x) > 2.5 && Math.abs(x - b.x) > 2.5) continue; if (Math.abs(z - a.z) > 2.5 && Math.abs(z - b.z) > 2.5) continue;
      const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1, t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1), d = Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
      if (d < bd) { bd = d; bp = { w: a.w + (b.w - a.w) * t, bed: a.bed + (b.bed - a.bed) * t, q, t }; }
    }
    dist[k] = bd;
    if (bp && bd < bp.w + 1) { H[k] = Math.min(H[k], bp.bed + (H[k] - bp.bed) * smooth(bp.w * .55, bp.w + 1, bd)); cells.push(k, bp.q, bp.t, bd); }
  }
  // Quelltopf: kleine runde Mulde, in der das Wasser aufquillt
  const S0 = out[0], poolBed = S0.bed - .04;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - S0.x, z - S0.z); if (d > 1) continue;
    const k = j * N + i; H[k] = Math.min(H[k], poolBed + (H[k] - poolBed) * smooth(.4, 1, d)); dist[k] = Math.min(dist[k], d * .5);
  }
  // Ufer links und rechts: ihre Höhe beim Erzeugen; ändert der Spieler das Gelände dort, folgt der Bach (fitStream)
  out.forEach((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.nx = -(b.z - a.z) / l; p.nz = (b.x - a.x) / l; p.bank = p.w + 1.15;
    p.gL0 = hAt(p.x + p.nx * p.bank, p.z + p.nz * p.bank); p.gR0 = hAt(p.x - p.nx * p.bank, p.z - p.nz * p.bank); p.bed0 = p.bed; });
  for (const p of out) p.y = p.bed + .055; // Wasserspiegel knapp über dem Bett
  return { pts: out, dist, len, cells, src: { x: S0.x, z: S0.z, y: poolBed + .1, dx: (out[3] || S0).x - S0.x, dz: (out[3] || S0).z - S0.z } };
})();
// Abstand zum Bach (über die Geländepunkte), für Bäume, Häuser und Bewuchs
function streamDist(x, z) { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? 99 : STREAM.dist[j * N + i]; }
function heightAt(x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -3;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
}
const surfaceAt = (x, z) => { const h = heightAt(x, z); return h < -.12 && seaAt(x, z) ? -.12 : h; }; // im Meer: Wasseroberfläche
const C = Object.fromEntries(Object.entries(theme.palette.terrain).map(([k, c]) => [k, new THREE.Color(c)]));
const tc = new THREE.Color(), tg = new THREE.Color();
function terrainColor(h, jit, k = -1) {
  tg.copy(C.g1).lerp(C.g2, jit);
  if (h < -.02 && (k < 0 || SEA[k])) return tc.copy(C.deep).lerp(C.wet, smooth(-1.4, -.02, h));
  tc.copy(C.wet).lerp(C.sand, smooth(-.02, .1, h));                         // nasser Sand an der Wasserlinie
  if (h < -.02) tc.lerp(C.bare, smooth(-.02, -.4, h) * .85);                // trockene Grube im Inland: Erde
  const sg = .3 + (jit - .5) * .14; tc.lerp(tg, smooth(sg, sg + .14, h));   // unregelmäßige Grenze Sand/Gras
  if (k >= 0) { // erdiger Boden unter Weg, Dorfplatz und Schreinplatz (Fugen zwischen den Platten)
    const x = -HALF + (k % N) * CELL, z = -HALF + Math.floor(k / N) * CELL;
    tc.lerp(C.bare, Math.max(smooth(.95, .5, sacredDist(x, z)), smooth(3.3, 2.9, Math.hypot(x, z)), smooth(2.6, 2.2, Math.hypot(x - SHRINE_AT.x, z - SHRINE_AT.z)), smooth(.75, .4, laneDist(x, z)) * .8) * .85);
  }
  if (k >= 0 && typeof STREAM !== 'undefined') { const d = STREAM.dist[k]; if (d < 1.2) { tc.lerp(C.streamBed, smooth(.55, .25, d) * .9); tc.lerp(C.streamGrass, smooth(1.2, .6, d) * (1 - smooth(.5, .25, d)) * .45); tg.copy(C.g1).lerp(C.g2, jit); } }
  if (k >= 0) { // Wiese: trockene Flecken und kahle Erdstellen
    const gw = smooth(.45, .6, h) * (1 - smooth(2.5, 2.9, h));
    tc.lerp(C.dry, smooth(.05, .35, DRY[k]) * .55 * gw);
    tc.lerp(C.bare, smooth(.3, .42, BARE[k]) * .75 * gw);
  }
  tc.lerp(C.rock, smooth(2.9 + jit * .5, 3.5 + jit * .5, h));
  tc.lerp(C.snow, smooth(4.9, 5.5, h));
  return tc;
}
// Vom Spieler geformtes Gelände: gespeichert als Abweichung von der erzeugten Insel (Punkt, Höhe in cm), hier wieder aufgetragen
const BASE_H = H.slice();
if (S.terrainN === N && Array.isArray(S.terrain)) for (let i = 0; i + 1 < S.terrain.length; i += 2) { const k = S.terrain[i] | 0, d = +S.terrain[i + 1] / 100; if (k >= 0 && k < N * N && isFinite(d)) H[k] = clamp(H[k] + d, -3, 8.5); }
// Meer: nur wo Gelände unter dem Meeresspiegel mit dem offenen Meer verbunden ist (Flutfüllung vom Inselrand).
// Eine Grube im Inland bleibt trocken, ein Graben bis zur Küste läuft voll. Im Bachbett steht Bachwasser: Das Meer
// dringt nur dort ein, wo der Bachspiegel unter dem Meeresspiegel liegt (Mündung), nicht gegen die Fließrichtung
// bergauf. SEA[k] = 1: Meer. Liefert die Punkte, deren Zustand sich geändert hat (neu färben).
const SEA_LV = -.02, SEA = new Uint8Array(N * N);
function updateSea() {
  const old = SEA.slice(), q = []; SEA.fill(0); const P = STREAM.pts, C4 = STREAM.cells;
  for (let c = 0; c < C4.length; c += 4) { const a = P[C4[c + 1] - 1], b = P[C4[c + 1]]; if (a.y + (b.y - a.y) * C4[c + 2] > SEA_LV) SEA[C4[c]] = 2; } // 2: Bach, kein Meer
  for (let k = 0; k < N * N; k++) { const i = k % N, j = (k / N) | 0; if ((i === 0 || j === 0 || i === N - 1 || j === N - 1) && H[k] < SEA_LV) { SEA[k] = 1; q.push(k); } }
  while (q.length) {
    const k = q.pop(), i = k % N, j = (k / N) | 0;
    if (i > 0 && !SEA[k - 1] && H[k - 1] < SEA_LV) { SEA[k - 1] = 1; q.push(k - 1); }
    if (i < N - 1 && !SEA[k + 1] && H[k + 1] < SEA_LV) { SEA[k + 1] = 1; q.push(k + 1); }
    if (j > 0 && !SEA[k - N] && H[k - N] < SEA_LV) { SEA[k - N] = 1; q.push(k - N); }
    if (j < N - 1 && !SEA[k + N] && H[k + N] < SEA_LV) { SEA[k + N] = 1; q.push(k + N); }
  }
  const changed = []; for (let k = 0; k < N * N; k++) { if (SEA[k] === 2) SEA[k] = 0; if (SEA[k] !== old[k]) changed.push(k); }
  return changed;
}
updateSea();
// Steht hier Meerwasser (tiefer als lv unter dem Spiegel und mit dem Meer verbunden)? Außerhalb der Insel immer.
function seaAt(x, z, lv = -.05) {
  const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL);
  return i < 0 || j < 0 || i >= N || j >= N || (SEA[j * N + i] === 1 && heightAt(x, z) < lv);
}
let terrainReset = false; // nach dem Zurücksetzen nichts mehr übernehmen, die Seite lädt neu
function resetTerrain() { terrainReset = true; S.terrain = []; S.terrainN = N; }
onSave(saveTerrain);
function saveTerrain() { if (terrainReset) return; const out = []; for (let k = 0; k < N * N; k++) { const d = Math.round((H[k] - BASE_H[k]) * 100); if (Math.abs(d) >= 2) out.push(k, d); } S.terrain = out; S.terrainN = N; }
const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
const tPos = tGeo.attributes.position;
const tCol = new THREE.BufferAttribute(new Float32Array(N * N * 3), 3);
tGeo.setAttribute('color', tCol);
for (let k = 0; k < N * N; k++) { tPos.setY(k, H[k]); const c = terrainColor(H[k], J[k], k); tCol.setXYZ(k, c.r, c.g, c.b); }
tGeo.computeVertexNormals();
// weich schattiert, dazu feines Rauschen in Weltkoordinaten: das Gelände wirkt nicht mehr grob aus großen Dreiecken
const NOISE_GLSL = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hsh(i), hsh(i + vec2(1., 0.)), f.x), mix(hsh(i + vec2(0., 1.)), hsh(i + vec2(1., 1.)), f.x), f.y); }`;
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
const terrainU = { uWet: { value: 0 }, uRain: { value: 0 }, uT: { value: 0 }, uDep: { value: null }, uSkyH: { value: null } };
terrainMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, terrainU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uWet, uRain, uT; uniform sampler2D uDep; uniform vec3 uSkyH;\n' + NOISE_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
      { float n = vns(vWP.xz * 1.3) * .45 + vns(vWP.xz * 4.3) * .33 + vns(vWP.xz * 12.) * .22; diffuseColor.rgb *= (.86 + n * .28) * (1. - .2 * uWet * step(.05, vWP.y)); } // nass: dunkler
      // Pfützen: Wasserspiegel in den Mulden, bei mehr Nässe höher (größere, zusammenfließende Pfützen)
      float pDep = texture2D(uDep, (vWP.xz + ${HALF.toFixed(1)}) / ${SIZE.toFixed(1)} * ${((N - 1) / N).toFixed(5)} + ${(.5 / N).toFixed(5)}).r * .3 + (vns(vWP.xz * 2.3) - .5) * .004;
      float pLev = mix(.2, .004, sqrt(uWet)), puddle = uWet > .02 ? smoothstep(pLev, pLev + .006, pDep) : 0.;
      float pRim = uWet > .02 ? smoothstep(pLev - .02, pLev, pDep) * (1. - puddle) : 0.;
      diffuseColor.rgb *= 1. - pRim * .3;
      if (puddle > 0.) {
        vec2 rp = vWP.xz * 5.; vec2 ri = floor(rp), rf = fract(rp) - .5; float rh = hsh(ri), rt = fract(uT * .8 + rh);
        float ring = smoothstep(.05, 0., abs(length(rf + (rh - .5) * .3) - rt * .45)) * (1. - rt) * uRain;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.07, .09, .1) + ring * .3, puddle * .85);
      }`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, .08, puddle);`)
    .replace('#include <opaque_fragment>', `{ float fres = .15 + .5 * pow(1. - max(dot(normal, normalize(vViewPosition)), 0.), 3.); outgoingLight = mix(outgoingLight, uSkyH * .6, fres * puddle); }
      #include <opaque_fragment>`);
};
const terrain = new THREE.Mesh(tGeo, terrainMat);
terrain.receiveShadow = true; terrain.castShadow = true; terrain.frustumCulled = false;
scene.add(terrain);

// Wasserband des Bachs: fließt sichtbar bergab, schäumt an steilen Stellen, wird zur Mündung breiter.
// Bei Schneeschmelze (und Regen) schwillt er an: höher, breiter, schneller, trüber, mehr Schaum (uSwell).
const streamU = { uT: { value: 0 }, uSwell: { value: 0 } };
const streamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: .15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
streamMat.onBeforeCompile = sh => {
  sh.uniforms.uT = streamU.uT; sh.uniforms.uSwell = streamU.uSwell;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float foam; attribute vec2 suv; varying float vFoam; varying vec2 vSU;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoam = foam; vSU = suv;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT, uSwell; varying float vFoam; varying vec2 vSU;\n' + NOISE_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float edge = smoothstep(.0, .2, vSU.x) * smoothstep(1., .8, vSU.x), fo = vFoam + uSwell * .3;
      vec2 q = vec2(vSU.x * 3., vSU.y * 1.6 - uT * (1.2 + fo * 3. + uSwell * 1.5));
      float n = vns(q * 2.) * .6 + vns(q * 5.) * .4;
      float fm = clamp(smoothstep(.55 - uSwell * .05, .85, n) * (.25 + fo * 1.4) + (1. - edge) * .35, 0., 1.);
      vec3 wc = mix(mix(vec3(.2, .55, .62), vec3(.32, .7, .74), n), mix(vec3(.36, .4, .33), vec3(.5, .5, .4), n), uSwell * .6); // Hochwasser: trüb
      diffuseColor.rgb = mix(wc, vec3(.92, .96, 1.), fm);
      diffuseColor.a = (.55 + .35 * edge + uSwell * .15) * smoothstep(0., .08, vSU.x) * smoothstep(1., .92, vSU.x) + fm * .2;`);
};
const streamMesh = (() => {
  const P = STREAM.pts, n = P.length, idx = [], uv = [];
  P.forEach((p, i) => { uv.push(0, p.s, 1, p.s); if (i) { const q = i * 2; idx.push(q - 2, q, q - 1, q - 1, q, q + 1); } }); // Umlaufsinn: Oberseite zeigt nach oben
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3)); g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('foam', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 1)); g.setIndex(idx);
  const o = new THREE.Mesh(g, streamMat); o.receiveShadow = true; o.renderOrder = 2; o.userData.noSnow = true; o.frustumCulled = false; scene.add(o); return o;
})();
let streamSwell = -1;
function layStream(sw) { // Lage des Wasserbands aus Bett und Hochwasser
  streamSwell = sw; const P = STREAM.pts, pos = streamMesh.geometry.attributes.position, foam = streamMesh.geometry.attributes.foam;
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], w = p.w * .78 * (1 + .9 * sw), y = p.y + .09 * sw;
    const slope = clamp((a.y - b.y) / (Math.hypot(b.x - a.x, b.z - a.z) || 1), 0, 2);
    pos.setXYZ(i * 2, p.x + p.nx * w, y, p.z + p.nz * w); pos.setXYZ(i * 2 + 1, p.x - p.nx * w, y, p.z - p.nz * w); foam.setX(i * 2, slope); foam.setX(i * 2 + 1, slope);
  });
  pos.needsUpdate = foam.needsUpdate = true; streamMesh.geometry.computeVertexNormals();
}
layStream(0);
// Nach dem Formen: Bach folgt dem Gelände. Heben oder senken beide Ufer, steigt oder sinkt das Bett mit; liegt ein Ufer
// tiefer als das Wasser, sinkt das Bett darunter. Ein einzeln gesenktes Ufer (z. B. der Mühlenplatz) zieht das Bett nicht mit; es fließt aber
// immer bergab, eine aufgeschüttete Stelle gräbt der Bach wieder durch. Liefert die geänderten Geländepunkte (neu färben).
function fitStream() {
  const P = STREAM.pts, changed = [];
  let prev = 1e9;
  for (const p of P) {
    const hl = heightAt(p.x + p.nx * p.bank, p.z + p.nz * p.bank), hr = heightAt(p.x - p.nx * p.bank, p.z - p.nz * p.bank);
    const dl = hl - p.gL0, dr = hr - p.gR0, d = dl > 0 && dr > 0 ? Math.min(dl, dr) : dl < 0 && dr < 0 ? Math.max(dl, dr) : 0; // nur wenn beide Ufer mitgehen
    const cap = (h, g0) => h < g0 && g0 > p.bed0 + .1 ? h - .1 : 1e9; // ein gesenktes Ufer, das vorher über dem Wasser lag
    p.bed = Math.min(p.bed0 + d, cap(hl, p.gL0), cap(hr, p.gR0), prev - .004); prev = p.bed; p.y = p.bed + .055; p.refL = hl; p.refR = hr; // Wasser bleibt unter dem tieferen Ufer
  }
  const C4 = STREAM.cells;
  for (let c = 0; c < C4.length; c += 4) {
    const k = C4[c], a = P[C4[c + 1] - 1], b = P[C4[c + 1]], t = C4[c + 2], bd = C4[c + 3];
    const left = (-HALF + (k % N) * CELL - a.x) * a.nx + (-HALF + Math.floor(k / N) * CELL - a.z) * a.nz > 0; // Böschung je Seite bis zu ihrem eigenen Ufer
    const bed = a.bed + (b.bed - a.bed) * t, w = a.w + (b.w - a.w) * t, ref = left ? a.refL + (b.refL - a.refL) * t : a.refR + (b.refR - a.refR) * t;
    const allowed = bed + Math.max(0, ref - bed) * smooth(w * .55, w + 1, bd);
    if (H[k] > allowed + .002) { H[k] = allowed; tPos.setY(k, allowed); changed.push(k); }
  }
  if (changed.length) { tPos.needsUpdate = true; markTerrainDirty(); }
  layStream(Math.max(0, streamSwell));
  return changed;
}
// Höhen als Textur für das Wasser (Tiefe: Farbe, Brandung, flache Wellen am Ufer)
const hTexData = new Uint8Array(N * N), hTex = new THREE.DataTexture(hTexData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
hTex.magFilter = hTex.minFilter = THREE.LinearFilter;
// Meeresmaske fürs Wasser, um einen Punkt verbreitert: am Ufer endet das Wasser unter dem Gelände, nicht davor
const seaTexData = new Uint8Array(N * N), seaTex = new THREE.DataTexture(seaTexData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
seaTex.magFilter = seaTex.minFilter = THREE.LinearFilter;
function updateHTex() {
  for (let k = 0; k < N * N; k++) hTexData[k] = clamp(Math.round((H[k] + 3) / 5 * 255), 0, 255); hTex.needsUpdate = true;
  for (let k = 0; k < N * N; k++) { const i = k % N, j = (k / N) | 0; seaTexData[k] = SEA[k] || i > 0 && SEA[k - 1] || i < N - 1 && SEA[k + 1] || j > 0 && SEA[k - N] || j < N - 1 && SEA[k + N] ? 255 : 0; }
  seaTex.needsUpdate = true;
}
updateHTex();
// Muldentiefe für Pfützen: wie weit liegt ein Geländepunkt unter dem Mittel seiner Umgebung (Radius etwa 2,3 Einheiten).
// Nur echte Mulden an Land bekommen Wasser; mit der Nässe steigt der Wasserspiegel, Pfützen wachsen und fließen ineinander.
const depData = new Uint8Array(N * N), depTex = new THREE.DataTexture(depData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
depTex.magFilter = depTex.minFilter = THREE.LinearFilter;
function updateDepth() {
  // Priority Flood: von Rand und Meer aus wird das Gelände „geflutet“; wo Wasser nicht abfließen kann, entsteht eine Mulde.
  // DEPTH = Wasserstand bis zum Überlaufen minus Geländehöhe. Kleine Unebenheiten (unter 2 cm) zählen nicht.
  // leichtes Relief (wenige Zentimeter, großflächig): echter Boden hat Senken, das glatte Gelände sonst kaum
  const Hm = new Float32Array(N * N); for (let k = 0; k < N * N; k++) { const x = -HALF + (k % N) * CELL, z = -HALF + ((k / N) | 0) * CELL; Hm[k] = H[k] + noise(x * .2 + 17, z * .2 - 4) * .09; } // großflächig: wenige, dafür größere Senken mit je einer Pfütze
  const filled = new Float32Array(N * N), done = new Uint8Array(N * N), heap = [], hv = [];
  const push = (k, v) => { let i = heap.length; heap.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= v) break; heap[i] = heap[p]; hv[i] = hv[p]; i = p; } heap[i] = k; hv[i] = v; };
  const pop = () => { const top = heap[0], lk = heap.pop(), lv = hv.pop(); if (heap.length) { let i = 0; while (true) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && hv[c + 1] < hv[c]) c++; if (hv[c] >= lv) break; heap[i] = heap[c]; hv[i] = hv[c]; i = c; } heap[i] = lk; hv[i] = lv; } return top; };
  for (let k = 0; k < N * N; k++) { const i = k % N, j = (k / N) | 0; if (i === 0 || j === 0 || i === N - 1 || j === N - 1 || H[k] < .02) { filled[k] = Hm[k]; done[k] = 1; push(k, Hm[k]); } }
  while (heap.length) {
    const k = pop(), i = k % N, j = (k / N) | 0, lv = filled[k];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const n = jj * N + ii; if (done[n]) continue; done[n] = 1; filled[n] = Math.max(Hm[n], lv); push(n, filled[n]);
    }
  }
  for (let k = 0; k < N * N; k++) { const d = filled[k] - Hm[k]; depData[k] = d > .015 && H[k] > .3 && H[k] < 3.3 ? clamp(Math.round(d / .3 * 255), 0, 255) : 0; }
  depTex.needsUpdate = true;
}
updateDepth(); terrainU.uDep.value = depTex; terrainU.uSkyH.value = sky.hor;
let terrainDirty = false, terrainT = 0;
const markTerrainDirty = () => { terrainDirty = true; }; // Normalen, Höhen- und Tiefenkarte gleich nachziehen
function updateTerrain(dt) {
  terrainU.uWet.value = weather.wet;
  const sw = Math.max(weather.flood, weather.wet * .3); streamU.uSwell.value = sw; if (Math.abs(sw - streamSwell) > .004) layStream(sw);
  terrainT -= dt; if (!terrainDirty || terrainT > 0) return; terrainT = .12; terrainDirty = false; tGeo.computeVertexNormals(); updateHTex(); updateDepth(); }

export { BARE, C, CELL, GARDEN_R, H, HALF, HOUSE_R, J, N, NOISE_GLSL, SACRED_SEG, SEG, SHRINE_AT, SIZE, STREAM, depData, fitStream, hTex, heightAt, laneDist, markTerrainDirty, resetTerrain, sacredDist, updateSea, streamDist, streamMat, seaAt, seaTex, streamU, surfaceAt, tCol, tPos, terrainColor, terrainU, tg, updateTerrain };
