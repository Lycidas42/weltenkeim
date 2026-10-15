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
  for (const p of out) { const f = p.s / (len || 1); p.w = .22 + .4 * f; const depth = .14 + .1 * f; bed = Math.min(bed - .004, hAt(p.x, p.z) - depth); p.bed = bed; } // Bett immer bergab
  // Bett graben: Geländepunkte nahe am Lauf auf Bett-Höhe senken, Ufer weich auslaufen lassen
  const dist = new Float32Array(N * N).fill(99);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i; let bd = 99, bp = null;
    for (let q = 1; q < out.length; q++) {
      const a = out[q - 1], b = out[q]; if (Math.abs(x - a.x) > 2.5 && Math.abs(x - b.x) > 2.5) continue; if (Math.abs(z - a.z) > 2.5 && Math.abs(z - b.z) > 2.5) continue;
      const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1, t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1), d = Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
      if (d < bd) { bd = d; bp = { w: a.w + (b.w - a.w) * t, bed: a.bed + (b.bed - a.bed) * t }; }
    }
    dist[k] = bd;
    if (bp && bd < bp.w + 1) H[k] = Math.min(H[k], bp.bed + (H[k] - bp.bed) * smooth(bp.w * .55, bp.w + 1, bd));
  }
  for (const p of out) p.y = p.bed + .055; // Wasserspiegel knapp über dem Bett
  return { pts: out, dist, len };
})();
// Abstand zum Bach (über die Geländepunkte), für Bäume, Häuser und Bewuchs
function streamDist(x, z) { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? 99 : STREAM.dist[j * N + i]; }
function heightAt(x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -3;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
}
const surfaceAt = (x, z) => Math.max(heightAt(x, z), -0.12);
const C = Object.fromEntries(Object.entries(theme.palette.terrain).map(([k, c]) => [k, new THREE.Color(c)]));
const tc = new THREE.Color(), tg = new THREE.Color();
function terrainColor(h, jit, k = -1) {
  tg.copy(C.g1).lerp(C.g2, jit);
  if (h < -.02) return tc.copy(C.deep).lerp(C.wet, smooth(-1.4, -.02, h));
  tc.copy(C.wet).lerp(C.sand, smooth(-.02, .1, h));                         // nasser Sand an der Wasserlinie
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

// Wasserband des Bachs: fließt sichtbar bergab, schäumt an steilen Stellen, wird zur Mündung breiter
const streamU = { uT: { value: 0 } };
const streamMesh = (() => {
  const P = STREAM.pts, pos = [], uv = [], foam = [], idx = [];
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l, w = p.w * .78;
    const slope = clamp((a.y - b.y) / (Math.hypot(b.x - a.x, b.z - a.z) || 1), 0, 2);
    pos.push(p.x + nx * w, p.y, p.z + nz * w, p.x - nx * w, p.y, p.z - nz * w); uv.push(0, p.s, 1, p.s); foam.push(slope, slope);
    if (i) { const q = i * 2; idx.push(q - 2, q, q - 1, q - 1, q, q + 1); } // Umlaufsinn: Oberseite zeigt nach oben
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: .15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = streamU.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float foam; attribute vec2 suv; varying float vFoam; varying vec2 vSU;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoam = foam; vSU = suv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; varying float vFoam; varying vec2 vSU;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float edge = smoothstep(.0, .2, vSU.x) * smoothstep(1., .8, vSU.x);
        vec2 q = vec2(vSU.x * 3., vSU.y * 1.6 - uT * (1.2 + vFoam * 3.));
        float n = vns(q * 2.) * .6 + vns(q * 5.) * .4;
        float fm = clamp(smoothstep(.55, .85, n) * (.25 + vFoam * 1.4) + (1. - edge) * .35, 0., 1.);
        diffuseColor.rgb = mix(mix(vec3(.2, .55, .62), vec3(.32, .7, .74), n), vec3(.92, .96, 1.), fm);
        diffuseColor.a = (.55 + .35 * edge) * smoothstep(0., .08, vSU.x) * smoothstep(1., .92, vSU.x) + fm * .2;`);
  };
  const o = new THREE.Mesh(g, m); o.receiveShadow = true; o.renderOrder = 2; o.userData.noSnow = true; o.frustumCulled = false; scene.add(o); return o;
})();
// Höhen als Textur für das Wasser (Tiefe: Farbe, Brandung, flache Wellen am Ufer)
const hTexData = new Uint8Array(N * N), hTex = new THREE.DataTexture(hTexData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
hTex.magFilter = hTex.minFilter = THREE.LinearFilter;
function updateHTex() { for (let k = 0; k < N * N; k++) hTexData[k] = clamp(Math.round((H[k] + 3) / 5 * 255), 0, 255); hTex.needsUpdate = true; }
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
function updateTerrain(dt) { terrainU.uWet.value = weather.wet; terrainT -= dt; if (!terrainDirty || terrainT > 0) return; terrainT = .12; terrainDirty = false; tGeo.computeVertexNormals(); updateHTex(); updateDepth(); }

export { BARE, C, CELL, GARDEN_R, H, HALF, HOUSE_R, J, N, NOISE_GLSL, SACRED_SEG, SEG, SHRINE_AT, SIZE, STREAM, depData, hTex, heightAt, laneDist, markTerrainDirty, resetTerrain, sacredDist, streamDist, streamU, surfaceAt, tCol, tPos, terrainColor, terrainU, tg, updateTerrain };
