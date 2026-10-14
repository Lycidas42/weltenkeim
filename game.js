// Weltenkeim – Gottspiel-Prototyp (Three.js)
// Aufbau: Terrain (prozedural, formbar), Dorf (KayKit-Modelle), Bewohner (instanziert), Ruun (Tiergeist in wählbarer Gestalt, lernt aus Lob/Tadel),
// Hand-Werkzeuge, Wunder, Idle-Ökonomie mit Offline-Fortschritt. Spielstand lokal (localStorage, Schlüssel SAVE_KEY).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const fmt = n => n < 1000 ? String(Math.floor(n)) : (n < 1e6 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : (n / 1e6).toFixed(2).replace('.', ',') + 'M');
const fmt1 = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
const rnd = s => (Math.random() * 2 - 1) * s;

async function start() {
/* ------------------------------------------------------------------ state */
const SAVE_KEY = 'weltenkeim-save';
const S = { v: 1, glaube: 15, holz: 6, temple: 1, hand: 1, houses: 2, pop: 6, w: { help: .34, play: .33, mischief: .33 }, creature: 'fox', name: 'Ruun', hand: { skin: '#e9b48c', nails: '#f4ddd3' }, ts: Date.now() };
let loaded = null;
{ try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { loaded = null; } }
if (loaded && typeof loaded === 'object') Object.assign(S, loaded, { w: Object.assign({}, S.w, loaded.w || {}), hand: Object.assign({}, S.hand, loaded.hand || {}) });
const prayYield = () => 1 + 0.6 * (S.temple - 1);
const passive = () => 0.06 * S.temple;
const cap = () => 4 + 3 * S.houses;
const houseCost = () => 12 + 6 * Math.max(0, S.houses - 2);
const templeCost = () => Math.round(30 * Math.pow(1.7, S.temple - 1));
const handCost = () => Math.round(40 * Math.pow(1.8, S.hand - 1));
const SOUL_COST = 15;
const MIRACLES = { rain: { cost: 20, label: 'Regen' }, haste: { cost: 12, label: 'Eile' } };

/* ------------------------------------------------------------------ noise */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const srand = mulberry32(7);
const PERM = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const GR = Array.from({ length: 256 }, () => { const a = srand() * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });
const grad = (ix, iy, x, y) => { const g = GR[PERM[(PERM[ix & 255] + iy) & 255]]; return g[0] * x + g[1] * y; };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = grad(ix, iy, fx, fy), b = grad(ix + 1, iy, fx - 1, fy), c = grad(ix, iy + 1, fx, fy - 1), d = grad(ix + 1, iy + 1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
}
const fbm = (x, y) => { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= .5; } return s; };

/* ------------------------------------------------------------------ renderer */
const canvas = $('c');
const isMobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
{ const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5ea9d4'); gr.addColorStop(.55, '#a9d4e4'); gr.addColorStop(1, '#e6efdc'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex; }
scene.fog = new THREE.Fog(0xd6e8e0, 42, 105);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
camera.position.set(13, 15, 19);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 7; controls.maxDistance = 48; controls.maxPolarAngle = 1.32;
controls.screenSpacePanning = false;

scene.add(new THREE.HemisphereLight(0xdff1ff, 0x6a5a3a, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
sun.position.set(18, 28, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 80 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun);

/* ------------------------------------------------------------------ terrain */
const SIZE = 48, SEG = 127, N = SEG + 1, CELL = SIZE / SEG, HALF = SIZE / 2;
const H = new Float32Array(N * N), J = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i;
  const d = Math.hypot(x, z) / HALF + fbm(x * .05 + 9, z * .05 - 4) * .28;
  const n = fbm(x * .07 + 3.1, z * .07 - 1.7);
  const mask = smooth(0.92, 0.5, d);
  let h = mask * (1.5 + n * 2.6 + Math.max(0, n) * 5.2) + (1 - mask) * -2.4;
  const vb = smooth(8.5, 4.5, Math.hypot(x, z));
  h = h * (1 - vb) + 1.25 * vb;
  H[k] = h; J[k] = clamp(.5 + noise(x * .35, z * .35) * .8, 0, 1);
}
function heightAt(x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -3;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
}
const surfaceAt = (x, z) => Math.max(heightAt(x, z), -0.12);
const C = { deep: new THREE.Color(0xb39c68), sand: new THREE.Color(0xe3cf92), g1: new THREE.Color(0x82b047), g2: new THREE.Color(0x5a8d36), rock: new THREE.Color(0x8e8476), snow: new THREE.Color(0xf2f1ea) };
const tc = new THREE.Color(), tg = new THREE.Color();
function terrainColor(h, jit) {
  tg.copy(C.g1).lerp(C.g2, jit);
  if (h < 0.05) return tc.copy(C.deep).lerp(C.sand, smooth(-1.6, 0.05, h));
  tc.copy(C.sand).lerp(tg, smooth(0.22, 0.5, h));
  tc.lerp(C.rock, smooth(2.9 + jit * .5, 3.5 + jit * .5, h));
  tc.lerp(C.snow, smooth(4.9, 5.5, h));
  return tc;
}
const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
const tPos = tGeo.attributes.position;
const tCol = new THREE.BufferAttribute(new Float32Array(N * N * 3), 3);
tGeo.setAttribute('color', tCol);
for (let k = 0; k < N * N; k++) { tPos.setY(k, H[k]); const c = terrainColor(H[k], J[k]); tCol.setXYZ(k, c.r, c.g, c.b); }
const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 }));
terrain.receiveShadow = true; terrain.castShadow = true; terrain.frustumCulled = false;
scene.add(terrain);

const wGeo = new THREE.PlaneGeometry(150, 150, 60, 60).rotateX(-Math.PI / 2);
const wBase = Float32Array.from(wGeo.attributes.position.array);
const water = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: 0x3aa6b8, transparent: true, opacity: .8, roughness: .2, metalness: .05, flatShading: true }));
water.receiveShadow = true;
scene.add(water);

function sculpt(px, pz, dir, dt) {
  const pw = 1 + 0.35 * (S.hand - 1), R = 2.6 * pw, str = 2.6 * pw * dt * dir;
  const i0 = Math.max(1, Math.floor((px - R + HALF) / CELL)), i1 = Math.min(SEG - 1, Math.ceil((px + R + HALF) / CELL));
  const j0 = Math.max(1, Math.floor((pz - R + HALF) / CELL)), j1 = Math.min(SEG - 1, Math.ceil((pz + R + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - px, z - pz) / R;
    if (d >= 1) continue;
    const k = j * N + i, h = clamp(H[k] + str * (1 + Math.cos(Math.PI * d)) / 2, -3, 8.5);
    H[k] = h; tPos.setY(k, h); const c = terrainColor(h, J[k]); tCol.setXYZ(k, c.r, c.g, c.b);
  }
  tPos.needsUpdate = true; tCol.needsUpdate = true;
}

/* ------------------------------------------------------------------ assets */
const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => loader.load('assets/models/' + f, res, undefined, e => rej(new Error(f + ' konnte nicht geladen werden'))));
$('loadSt').textContent = 'Lade Modelle …';
// Ruun kann verschiedene Gestalten annehmen (S.creature). Modelle: Quaternius Animated Animal Pack (CC0).
// h = Zielhöhe in Welteinheiten, walk/run = Geschwindigkeit, ws = Zeitfaktor der Lauf-Animation,
// rest = Liegepose aus POSES (nur Tiere mit Quaternius-AnimalArmature), hd = Fell-Modell für die Nahansicht.
const CREATURES = {
  fox: { label: 'Fuchs', spirit: 'Fuchsgeist', file: 'Fox', hd: 'Fox_HD', h: 1.45, walk: 1.9, run: 3.4, ws: 1.1, rest: 'paw' },
  wolf: { label: 'Wolf', spirit: 'Wolfsgeist', file: 'Wolf', h: 1.75, walk: 2, run: 3.8, ws: 1, rest: 'paw' },
  stag: { label: 'Hirsch', spirit: 'Hirschgeist', file: 'Stag', h: 3.1, walk: 2, run: 3.8, ws: .9, rest: 'hoof' },
  bull: { label: 'Stier', spirit: 'Stiergeist', file: 'Bull', h: 1.95, walk: 1.7, run: 3.4, ws: .9, rest: 'hoof' },
  alpaca: { label: 'Alpaka', spirit: 'Alpakageist', file: 'Alpaca', h: 2.5, walk: 1.8, run: 3.4, ws: 1, rest: 'hoof' },
  // Katze aus Quaternius Animal Pack Vol.2: nur Idle/Walk, keine Augen – Augen werden am Kopfknochen ergänzt
  cat: { label: 'Katze', spirit: 'Katzengeist', file: 'Cat', h: 1.35, walk: 1.9, run: 3.6, ws: 1.2, head: 'Bone003', eyes: { fwd: .265, up: .05, side: .06, r: .034, iris: 0x8fd14f } },
};
if (!CREATURES[S.creature]) S.creature = 'fox';
const files = ['building_home_A_blue.gltf', 'building_home_B_blue.gltf', 'building_church_blue.gltf', 'building_well_blue.gltf', 'building_windmill_blue.gltf', 'building_scaffolding.gltf',
  'tree_single_A.gltf', 'tree_single_B.gltf', 'tree_single_A_cut.gltf', 'rock_single_A.gltf', 'rock_single_C.gltf', 'cloud_big.gltf', `animals/${CREATURES[S.creature].file}.glb`, 'hand/GodHand.glb', 'hand/GodHand.glb'];
const [gHomeA, gHomeB, gChurch, gWell, gMill, gScaff, gTreeA, gTreeB, gStump, gRockA, gRockC, gCloud, gCreature, gHand, gHand2] = await Promise.all(files.map(load));
const shadowify = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function parts(g) { const out = []; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); out.push({ geo, mat: o.material }); } }); return out; }
class Swarm {
  constructor(p, cap) { this.meshes = p.map(({ geo, mat }) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; }); }
  set(i, mat) { for (const m of this.meshes) m.setMatrixAt(i, mat); }
  commit(n) { for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; } }
}

/* ------------------------------------------------------------------ village */
const SB = 1.5, ST = 1.25;
const statics = [];
function place(gltf, x, z, ry = 0, s = SB) { const o = shadowify(gltf.scene.clone(true)); o.scale.setScalar(s); o.rotation.y = ry; scene.add(o); const e = { o, x, z }; statics.push(e); return e; }
const CHURCH = { x: 0, z: -2.6 }, WELL = { x: 1.4, z: 1.1 }, PRAY = { x: 0, z: -1.2 }, CENTER = { x: 0, z: 0.4 };
place(gChurch, CHURCH.x, CHURCH.z, 0, 1.7);
place(gWell, WELL.x, WELL.z, 0.4, 1.3);
const mill = place(gMill, -3.8, -1.2, 0.5, 1.6);
let millFan = null; mill.o.traverse(o => { if (/fan/i.test(o.name)) millFan = o; });

const sites = [];
for (const [r, n, off] of [[4.4, 8, .3], [6.2, 10, 0], [7.9, 12, .2]]) for (let i = 0; i < n; i++) {
  const a = off + i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.hypot(x - CHURCH.x, z - CHURCH.z) < 2.6 || Math.hypot(x + 3.8, z + 1.2) < 2.2 || Math.hypot(x - WELL.x, z - WELL.z) < 1.6) continue;
  sites.push({ x, z, ry: -a + Math.PI / 2 + Math.PI, used: false });
}
const houses = [];
function freeSite() { return sites.find(s => !s.used && heightAt(s.x, s.z) > 0.25); }
function addHouse(site) { site.used = true; const h = place(houses.length % 2 ? gHomeB : gHomeA, site.x, site.z, site.ry, SB); houses.push(h); return h; }
for (let i = 0; i < S.houses; i++) { const s = freeSite(); if (s) addHouse(s); }
S.houses = houses.length;
let construction = null;
const scaff = place(gScaff, 0, 0, 0, 0.95); scaff.o.visible = false;

/* ------------------------------------------------------------------ trees & rocks */
const treeSwarms = [new Swarm(parts(gTreeA), 500), new Swarm(parts(gTreeB), 500)];
const stumpSwarm = new Swarm(parts(gStump), 500);
const trees = [];
const treeNear = (x, z, r) => trees.some(t => !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r);
function addTree(x, z, g = 1) { if (trees.length >= 480) return null; const t = { x, z, type: Math.random() < .5 ? 0 : 1, g, alive: true, gone: false, stumpT: 0, reserved: null, rot: Math.random() * 6.28, ph: Math.random() * 6.28 }; trees.push(t); return t; }
for (let tries = 0; tries < 4000 && trees.length < 95; tries++) {
  const x = rnd(HALF * .9), z = rnd(HALF * .9), h = heightAt(x, z);
  if (h < .45 || h > 3.0 || Math.hypot(x, z) < 8.5 || treeNear(x, z, 1.0)) continue;
  addTree(x, z, .75 + Math.random() * .25);
}
function chopTree(t) { t.alive = false; t.stumpT = 45; if (t.reserved) t.reserved = null; }
const rockSwarms = [new Swarm(parts(gRockA), 40), new Swarm(parts(gRockC), 40)];
const rocks = [];
for (let tries = 0; tries < 2000 && rocks.length < 34; tries++) {
  const x = rnd(HALF * .9), z = rnd(HALF * .9), h = heightAt(x, z);
  if (h < .2 || Math.hypot(x, z) < 7) continue;
  rocks.push({ x, z, type: rocks.length % 2, s: 1.6 + Math.random() * 2.2, r: Math.random() * 6.28 });
}

/* ------------------------------------------------------------------ clouds & effects */
const clouds = [];
for (let i = 0; i < 4; i++) { const c = gCloud.scene.clone(true); c.scale.setScalar(2.6 + Math.random()); c.position.set(rnd(30), 19 + Math.random() * 3, rnd(22)); scene.add(c); clouds.push(c); }
const rainCloud = gCloud.scene.clone(true);
rainCloud.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0x8d98a4); } });
rainCloud.visible = false; rainCloud.scale.setScalar(1.2); scene.add(rainCloud);
const RAIN_N = 450;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 3), 3));
const rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbfe4ff, size: .09, transparent: true, opacity: .8 }));
rainPts.visible = false; rainPts.frustumCulled = false; scene.add(rainPts);
const rain = { t: 0, x: 0, z: 0 };
const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf3c04d, transparent: true, opacity: 0, depthWrite: false }));
scene.add(ring); let ringT = 0;

/* ------------------------------------------------------------------ villagers */
// Jeder Bewohner besteht aus instanzierten Einzelteilen (Beine, Rumpf, Arme, Kopf, Augen, Frisur, Bart).
// Aussehen (Haut, Haar, Frisur, Kleidung, Größe) wird pro Platz deterministisch gewürfelt, bleibt also nach dem Neuladen gleich.
const VCAP = 300, VS = 1.15;
const SKINS = [0xf7d9bf, 0xefc6a0, 0xe0ac82, 0xc98f60, 0xa8724a, 0x845535, 0x5f3b22];
const HAIRS = [0x1d1814, 0x3a2719, 0x5c3a20, 0x8b5a2b, 0xc89b55, 0xe6cb87, 0xa5422a, 0xb9b3a9];
const ROBES = [0xc2553d, 0x3d7cc2, 0xd9a441, 0x6b9b4a, 0x8c5fb3, 0xe07a5f, 0x4aa3a0, 0xd8d0c0];
const PANTS = [0x5b4636, 0x3e4a5c, 0x6a5a45, 0x4a3b30, 0x6b6156];
const HIP_Y = .1, SHO_Y = .245, HEAD_Y = .33;
const vMesh = (geo, color, rough = .85) => {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true }), VCAP);
  m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m);
  if (color === 0xffffff) { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < VCAP; i++) m.setColorAt(i, w); }
  return m;
};
const hairCap = () => new THREE.SphereGeometry(.078, 10, 6, 0, Math.PI * 2, 0, Math.PI * .56).rotateX(-.62).translate(0, HEAD_Y + .006, -.006);
const vParts = {
  legL: vMesh(new THREE.CylinderGeometry(.03, .026, HIP_Y, 6).translate(0, -HIP_Y / 2, 0), 0xffffff),
  legR: vMesh(new THREE.CylinderGeometry(.03, .026, HIP_Y, 6).translate(0, -HIP_Y / 2, 0), 0xffffff),
  body: vMesh(mergeGeometries([
    new THREE.CylinderGeometry(.06, .1, .17, 8).translate(0, .175, 0),
    new THREE.SphereGeometry(.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .5, 1).translate(0, .26, 0),
  ]), 0xffffff),
  armL: vMesh(new THREE.CylinderGeometry(.022, .019, .13, 6).translate(0, -.065, 0), 0xffffff),
  armR: vMesh(new THREE.CylinderGeometry(.022, .019, .13, 6).translate(0, -.065, 0), 0xffffff),
  head: vMesh(mergeGeometries([
    new THREE.SphereGeometry(.07, 10, 8).translate(0, HEAD_Y, 0),
    new THREE.SphereGeometry(.014, 5, 4).translate(0, HEAD_Y - .008, .07),
    new THREE.CylinderGeometry(.025, .03, .03, 6).translate(0, HEAD_Y - .075, 0),
  ]), 0xffffff, .7),
  eyes: vMesh(mergeGeometries([
    new THREE.SphereGeometry(.011, 5, 4).translate(-.025, HEAD_Y + .012, .062),
    new THREE.SphereGeometry(.011, 5, 4).translate(.025, HEAD_Y + .012, .062),
  ]), 0x1a1410, .4),
  hair: [
    // kurz
    vMesh(hairCap(), 0xffffff, .95),
    // lang, über den Rücken
    vMesh(mergeGeometries([hairCap(), new THREE.CylinderGeometry(.068, .058, .12, 8, 1, false, Math.PI * .6, Math.PI * .8).translate(0, HEAD_Y - .045, -.008)]), 0xffffff, .95),
    // Dutt
    vMesh(mergeGeometries([hairCap(), new THREE.SphereGeometry(.036, 7, 5).translate(0, HEAD_Y + .07, -.045)]), 0xffffff, .95),
    // Pferdeschwanz
    vMesh(mergeGeometries([hairCap(), new THREE.CylinderGeometry(.022, .012, .11, 6).rotateX(.35).translate(0, HEAD_Y - .02, -.09)]), 0xffffff, .95),
  ],
  beard: vMesh(new THREE.SphereGeometry(.076, 8, 5, Math.PI * .1, Math.PI * .8, Math.PI * .5, Math.PI * .38).translate(0, HEAD_Y + .004, .004), 0xffffff, .95),
};
const vWood = vMesh(new THREE.BoxGeometry(.26, .07, .07).translate(0, .21, .13), 0x8a5a33, .9);
const vAll = [vParts.legL, vParts.legR, vParts.body, vParts.armL, vParts.armR, vParts.head, vParts.eyes, ...vParts.hair, vParts.beard, vWood];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dressVillager(i) {
  const r = mulberry(i * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const skin = new THREE.Color(pick(SKINS)).offsetHSL(0, 0, (r() - .5) * .04);
  const old = r() < .15, hairC = new THREE.Color(old ? pick([0xb9b3a9, 0xdedad2, 0x8f8a84]) : pick(HAIRS)).offsetHSL(0, 0, (r() - .5) * .05);
  const robe = new THREE.Color(pick(ROBES)), pants = new THREE.Color(pick(PANTS));
  const look = { hair: r() < .08 ? -1 : Math.floor(r() * vParts.hair.length), beard: r() < .25, s: .9 + r() * .2, w: .92 + r() * .16 };
  for (const m of [vParts.legL, vParts.legR]) m.setColorAt(i, pants);
  for (const m of [vParts.body, vParts.armL, vParts.armR]) m.setColorAt(i, robe);
  vParts.head.setColorAt(i, skin);
  for (const m of [...vParts.hair, vParts.beard]) m.setColorAt(i, hairC);
  for (const m of vAll) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return look;
}
const villagers = [];
function spawnVillager(x, z) {
  if (villagers.length >= VCAP) return null;
  const v = { x, z, y: surfaceAt(x, z), h: Math.random() * 6.28, state: 'idle', timer: .3 + Math.random() * 2, tx: x, tz: z, next: null, carry: 0, tree: null, vx: 0, vy: 0, vz: 0, haste: 0, ph: Math.random() * 6.28 };
  v.look = dressVillager(villagers.length);
  villagers.push(v);
  return v;
}
const homeSpot = () => { const h = houses[Math.floor(Math.random() * houses.length)] || { x: 0, z: 0 }; return { x: h.x + rnd(1), z: h.z + rnd(1) }; };
for (let i = 0; i < Math.min(S.pop, cap()); i++) { const p = homeSpot(); spawnVillager(p.x, p.z); }

/* ------------------------------------------------------------------ creature (Ruun) */
const ANIM_PAT = { idle: /^Idle$/, idle2: /^Idle_2$/, eat: /^Eating$/, walk: /^Walk$/, run: /^Gallop$/, attack: /^Attack/, hit: /^Idle_HitReact/, jump: /^Jump/ };
// fehlt eine Animation, wird eine vorhandene mit anderem Tempo genutzt
const ANIM_FALLBACK = { idle2: ['idle', .7], eat: ['idle', .5], run: ['walk', 2.1], attack: ['walk', 2.8] };
const fox = { x: -6, z: 4, h: 0, state: 'idle', timer: 4, next: null, tx: 0, tz: 0, tree: null, carry: false, act: null, last: null, lastT: -999, playT: 0, hop: 0, cur: null, idleA: 'idle', once: 0, kind: null };
const foxPivot = new THREE.Group(); scene.add(foxPivot);
const creatureCache = { [S.creature]: gCreature };
let foxModel = null, foxMixer = null, foxActs = {};
// Modell eines Tiers aufbereiten: skalieren, nach +Z ausrichten, Animationen (inkl. Posen) und ggf. Fell/Augen.
// Liefert ein „Rig“ { model, mixer, acts, cur }; genutzt für die Welt und für das Porträt im Panel.
function buildRig(id, gltf, fur = false) {
  const C = CREATURES[id], model = shadowify(gltf.scene);
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; for (const m of [].concat(o.material)) { m.metalness = 0; m.roughness = Math.max(m.roughness, .75); } } });
  model.scale.setScalar(1); model.rotation.set(0, 0, 0); model.position.set(0, 0, 0); model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(C.h / size.y); model.updateMatrixWorld(true);
  // Blickrichtung aus der Kopfposition ableiten, damit +Z vorne ist
  const head = model.getObjectByName(C.head || 'Head'), box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3());
  if (head) { const hp = head.getWorldPosition(new THREE.Vector3()); model.rotation.y = -Math.atan2(hp.x - c.x, hp.z - c.z); }
  model.position.y = -box.min.y;
  const dims = box.getSize(new THREE.Vector3());
  // Fell erst nach dem Vermessen anlegen: die Schichten sind Skinned-Meshes ohne berechnete Knochenmatrizen
  if (fur && !model.userData.fur) model.userData.fur = addFur(model);
  model.traverse(o => { if (o.userData.shell) o.castShadow = o.receiveShadow = false; }); // Fellschichten werfen keinen Schatten
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const [k, re] of Object.entries(ANIM_PAT)) { const clip = gltf.animations.find(a => re.test(a.name)); if (clip) acts[k] = mixer.clipAction(clip); }
  for (const [k, [f, ts]] of Object.entries(ANIM_FALLBACK)) if (!acts[k] && acts[f]) { acts[k] = mixer.clipAction(acts[f].getClip().clone()); acts[k].timeScale = ts; }
  if (acts.walk) acts.walk.timeScale = C.ws;
  if (C.rest && acts.idle) for (const [k, clip] of Object.entries(buildPoseClips(model, acts.idle.getClip(), C.rest))) acts[k] = mixer.clipAction(clip);
  for (const k of ['hit', 'jump', 'lieDown', 'standUp', 'cast']) if (acts[k]) { acts[k].setLoop(THREE.LoopOnce); acts[k].clampWhenFinished = true; }
  // Augen in der Idle-Pose ausrichten, weil der Kopf dort anders steht als in der Ruhepose
  if (C.eyes && head && acts.idle && !model.userData.eyes) { model.userData.eyes = true; acts.idle.reset().play(); mixer.update(0); addEyes(model, head, C.eyes); acts.idle.stop(); }
  return { model, mixer, acts, cur: null, id, dims };
}
// Animation auf einem Rig weich überblenden; restart spielt eine laufende Animation von vorn
function rigPlay(rig, name, restart = false) {
  if (!rig) return; const a = rig.acts[name]; if (!a) return;
  if (rig.cur === name) { if (restart) a.reset().play(); return; }
  a.reset().fadeIn(.25).play(); if (rig.cur && rig.acts[rig.cur]) rig.acts[rig.cur].fadeOut(.25); rig.cur = name;
}
function useCreature(id, gltf) {
  if (foxModel) { foxPivot.remove(foxModel); foxMixer.stopAllAction(); }
  const rig = buildRig(id, gltf);
  foxModel = rig.model; foxMixer = rig.mixer; foxActs = rig.acts;
  foxPivot.add(foxModel);
  fox.kind = id; fox.cur = null; fox.once = 0;
  foxAnim('idle');
}
// Zusätzliche Posen für das Quaternius-Skelett (AnimalArmature), im Code gebaut.
// rot: Winkel in Grad im Raum des Tiers (x: Nicken, positiv = vorn nach unten; y: Drehen; z: Kippen),
// wirkt auf den Knochen samt Kindern. pos: Verschiebung in Fuchs-Einheiten, skaliert über die Beckenhöhe.
// Füße und Unterbeine hängen an den IK-Knochen, die deshalb mitbewegt werden.
const POSES = {
  // Hinlegen wie ein Hund (Sphinx-Haltung, Vorderpfoten nach vorn)
  paw: {
    rot: { Back: [8, 0, 0], FrontShoulderL: [-65, 0, 0], FrontShoulderR: [-65, 0, 0], FrontLowerLegL: [-15, 0, 0], FrontLowerLegR: [-15, 0, 0], BackLegL: [-75, 0, -12], BackLegR: [-75, 0, 12], BackLowerLegL: [-45, 0, 0], BackLowerLegR: [-45, 0, 0], Neck1: [-22, 0, 0], Head: [10, 0, 0], Tail1: [-28, 0, 0], Tail2: [-10, 15, 0], Tail3: [0, 20, 0], Tail5: [0, 25, 0], Tail7: [0, 25, 0] },
    pos: { Body: [0, -.47, 0], IKBackLegL: [.04, 0, .25], IKBackLegR: [-.04, 0, .25], IKFrontLegL: [.02, 0, .45], IKFrontLegR: [-.02, 0, .45] },
  },
  // Hinlegen wie Huftiere (Beine untergeschlagen)
  hoof: {
    rot: { Back: [-4, 0, 0], FrontUpperLegL: [-70, 0, 0], FrontUpperLegR: [-70, 0, 0], FrontLowerLegL: [150, 0, 0], FrontLowerLegR: [150, 0, 0], BackLegL: [-70, 0, 0], BackLegR: [-70, 0, 0], BackLowerLegL: [-45, 0, 0], BackLowerLegR: [-45, 0, 0], Neck1: [-8, 0, 0], Head: [6, 0, 0] },
    pos: { Body: [0, -.47, 0], IKBackLegL: [.04, 0, .25], IKBackLegR: [-.04, 0, .25], IKFrontLegL: [.03, 0, -.3], IKFrontLegR: [-.03, 0, -.3] },
  },
  // Aufbäumen zum Wunderwirken, Blick zum Himmel
  rear: {
    rot: { Back: [-55, 0, 0], FrontShoulderL: [-10, 0, 0], FrontShoulderR: [-10, 0, 0], FrontLowerLegL: [60, 0, 0], FrontLowerLegR: [60, 0, 0], Neck1: [10, 0, 0], Head: [-20, 0, 0], BackLegL: [15, 0, 0], BackLegR: [15, 0, 0], Tail1: [-20, 0, 0] },
    pos: { Body: [0, 0, -.1], IKFrontLegL: [0, .75, -.35], IKFrontLegR: [0, .75, -.35] },
  },
};
const FOX_HIP = 1.07; // Beckenhöhe des Fuchses, auf die sich pos bezieht
const NO_POSE = { rot: {}, pos: {} };
const withPose = (p, rot = {}) => ({ rot: Object.assign({}, p.rot, rot), pos: p.pos });
// keys: [{ t, pose }] -> AnimationClip, ausgehend von der ersten Frame der Basis-Animation
function poseClip(model, baseClip, name, keys) {
  model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  const mixer = new THREE.AnimationMixer(model), act = mixer.clipAction(baseClip); act.play(); mixer.update(0);
  model.updateMatrixWorld(true);
  const space = model.parent ? model.parent.matrixWorld.clone().invert() : new THREE.Matrix4(), spaceQ = new THREE.Quaternion().setFromRotationMatrix(space);
  const bones = []; model.traverse(o => { if (o.isBone) bones.push(o); });
  const hip = model.getObjectByName('Back'), k = hip ? hip.getWorldPosition(new THREE.Vector3()).applyMatrix4(space).y / FOX_HIP : 1;
  const base = bones.map(b => {
    const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(spaceQ);
    const toLocal = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().multiplyMatrices(space, b.parent.matrixWorld).invert());
    return { b, q: b.quaternion.clone(), p: b.position.clone(), pw, pwInv: pw.clone().invert(), toLocal };
  });
  act.stop(); mixer.uncacheRoot(model);
  const times = keys.map(x => x.t), D = Math.PI / 180, R = new THREE.Quaternion(), e = new THREE.Euler(), tracks = [];
  for (const B of base) {
    const n = B.b.name, qv = [], pv = []; let moved = false;
    for (const { pose } of keys) {
      const r = pose.rot[n], d = pose.pos[n];
      const q = r ? B.pwInv.clone().multiply(R.setFromEuler(e.set(r[0] * D, r[1] * D, r[2] * D, 'YXZ'))).multiply(B.pw).multiply(B.q) : B.q;
      qv.push(q.x, q.y, q.z, q.w);
      const p = B.p.clone(); if (d) { moved = true; p.add(new THREE.Vector3(d[0] * k, d[1] * k, d[2] * k).applyMatrix3(B.toLocal)); }
      pv.push(p.x, p.y, p.z);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', times, qv));
    if (moved) tracks.push(new THREE.VectorKeyframeTrack(n + '.position', times, pv));
  }
  return new THREE.AnimationClip(name, times[times.length - 1], tracks);
}
// Hinlegen, Liegen (mit leichtem Kopfdrehen), Aufstehen und Wunderwirken für ein Tier bauen
function buildPoseClips(model, baseClip, rest) {
  const L = POSES[rest], R = POSES.rear;
  return {
    lieDown: poseClip(model, baseClip, 'lieDown', [{ t: 0, pose: NO_POSE }, { t: .9, pose: L }]),
    lie: poseClip(model, baseClip, 'lie', [{ t: 0, pose: L }, { t: 2.5, pose: withPose(L, { Head: [L.rot.Head[0] + 4, 14, 0] }) }, { t: 4, pose: withPose(L, { Head: [L.rot.Head[0] - 2, -10, 0] }) }, { t: 6, pose: L }]),
    standUp: poseClip(model, baseClip, 'standUp', [{ t: 0, pose: L }, { t: .7, pose: NO_POSE }]),
    cast: poseClip(model, baseClip, 'cast', [{ t: 0, pose: NO_POSE }, { t: .55, pose: R }, { t: 1.1, pose: withPose(R, { Head: [-28, 8, 0] }) }, { t: 1.7, pose: withPose(R, { Head: [-28, -8, 0] }) }, { t: 2.3, pose: NO_POSE }]),
  };
}
// Fell (Shell-Fur) für Modelle mit Fellmaske _FUR (z. B. Fox_HD.glb aus assets/source/Fox_HD.blend).
// Jede Schicht ist dieselbe Skinned-Geometrie, im Vertex-Shader entlang der Normalen nach außen geschoben;
// der Fragment-Shader lässt nur Haarquerschnitte stehen, die nach außen dünner werden.
const FUR = { len: .045, den: 520, grav: .35, shells: isMobile ? 16 : 24 };
function furShellMaterial(h, uni) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni, { uH: { value: h } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _fur;\nuniform float uLen, uH, uTime;\nuniform vec3 uGrav;\nvarying float vFur;\nvarying vec2 vUv2;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vFur = _fur; vUv2 = uv;
        vec3 sway = vec3(sin(uTime * 1.7 + position.x * 9.0), 0.0, cos(uTime * 1.3 + position.z * 7.0)) * 0.12;
        transformed += normalize(objectNormal) * uLen * _fur * 2.0 * uH + (uGrav + sway) * uH * uH * uLen * 2.0 * _fur;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDen, uH;\nvarying float vFur;\nvarying vec2 vUv2;\nfloat h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vFur < 0.02) discard;
        vec2 g = vUv2 * uDen, id = floor(g), f = fract(g) - 0.5;
        float r = h21(id), len = mix(0.55, 1.0, r);
        if (uH > len) discard;
        if (length(f + (vec2(h21(id + 7.1), h21(id + 3.7)) - 0.5) * 0.3) > (1.0 - uH / len) * 0.62) discard;
        diffuseColor.rgb *= mix(0.72, 1.06, uH) * mix(0.92, 1.08, r);`);
  };
  m.customProgramCacheKey = () => 'furShell';
  return m;
}
function furBaseMaterial() {
  // wo kein Fell ist (Augen, Nase), glänzt die Oberfläche
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _fur;\nvarying float vFur;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFur = _fur;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFur;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.18, roughnessFactor, smoothstep(0.0, 0.03, vFur));');
  };
  m.customProgramCacheKey = () => 'furBase';
  return m;
}
function addFur(model) {
  const parts = []; model.traverse(o => { if (o.isSkinnedMesh && o.geometry.attributes._fur) parts.push(o); });
  if (!parts.length) return null;
  // Materialfarben als Vertex-Farbe in eine Geometrie legen: ein Draw-Call pro Schicht
  const tint = { Main_Light: new THREE.Color(0xf1ebde) }, sk = parts[0];
  const geo = mergeGeometries(parts.map(o => {
    const g = o.geometry.clone(), c = tint[o.material.name] || o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }));
  for (const o of parts) o.visible = false;
  const uni = { uLen: { value: 0 }, uDen: { value: FUR.den }, uGrav: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const mk = (mat, shell) => {
    const m = new THREE.SkinnedMesh(geo, mat); m.position.copy(sk.position); m.quaternion.copy(sk.quaternion); m.scale.copy(sk.scale);
    m.bind(sk.skeleton, sk.bindMatrix); m.frustumCulled = false; m.userData.shell = shell; sk.parent.add(m); return m;
  };
  const base = mk(furBaseMaterial(), false);
  for (let i = 1; i <= FUR.shells; i++) mk(furShellMaterial(i / FUR.shells, uni), true);
  return { base, uni };
}
const furInv = new THREE.Matrix4();
function updateFur(f, t) {
  // Länge und Schwerkraft in die Koordinaten der (skalierten) Mesh umrechnen
  f.uni.uLen.value = FUR.len / f.base.matrixWorld.getMaxScaleOnAxis(); f.uni.uTime.value = t;
  furInv.copy(f.base.matrixWorld).invert(); f.uni.uGrav.value.set(0, -1, 0).transformDirection(furInv).multiplyScalar(FUR.grav * 1.5);
}
// Augen (Lederhaut, Iris, Pupille) in Modellkoordinaten setzen und an den Kopfknochen hängen
function addEyes(model, head, e) {
  model.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3()), white = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: .4 });
  const iris = new THREE.MeshStandardMaterial({ color: e.iris, roughness: .3, emissive: e.iris, emissiveIntensity: .25 }), pupil = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(e.r, 12, 8), white));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(e.r * .86, 12, 8).translate(0, 0, e.r * .24), iris));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(e.r * .62, 10, 6).scale(.4, 1, 1).translate(0, 0, e.r * .5), pupil));
    g.position.set(hp.x + sx * e.side, hp.y + e.up, hp.z + e.fwd); g.rotation.y = sx * .35;
    g.updateMatrixWorld(true); head.attach(g); // ohne Elternteil ist g.matrixWorld = Modellraum
  }
}
function foxAnim(name) {
  if (fox.cur === name) return; const a = foxActs[name]; if (!a) return;
  a.reset().fadeIn(.25).play(); if (fox.cur && foxActs[fox.cur]) foxActs[fox.cur].fadeOut(.25); fox.cur = name;
  rigPlay(portrait.rig, name);
}
// einmalige Reaktion (Treffer, Freudensprung), danach übernimmt wieder der Zustand
function foxOnce(name) { const a = foxActs[name]; if (!a) return; if (fox.cur === name) a.reset().play(); else foxAnim(name); fox.once = a.getClip().duration / a.timeScale; rigPlay(portrait.rig, name, true); }
let creatureLoading = null;
async function setCreature(id) {
  if (!CREATURES[id] || id === fox.kind || creatureLoading) return;
  creatureLoading = id; renderForms();
  try {
    const g = await loadCreature(id);
    useCreature(id, g); S.creature = id; save(); if (!$('sheetFox').hidden) showPortrait();
    floatText(fox.x, CREATURES[id].h + .6, fox.z, `${S.name} wird ${CREATURES[id].label}`, 's');
  } catch (e) { toast('Diese Gestalt konnte nicht geladen werden. Bist du offline?'); }
  creatureLoading = null; renderForms(); renderFox();
}
async function loadCreature(id) {
  return creatureCache[id] || (creatureCache[id] = await load(`animals/${CREATURES[id].file}.glb`));
}
// Porträt im Panel: eigene kleine 3D-Ansicht mit einer zweiten Instanz des Tiers (beim Fuchs das Fell-Modell),
// die jede Animation des Tiers in der Welt mitspielt. Eigener Renderer, damit die Weltkamera unberührt bleibt.
const portrait = { renderer: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .05, 60), pivot: new THREE.Group(), rig: null, loading: null, cache: {}, hand: null, look: new THREE.Vector3(), dist: 4 };
{
  const P = portrait;
  P.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x4d6b3c, 1.4));
  const key = new THREE.DirectionalLight(0xfff0d6, 2.2); key.position.set(2.5, 4, 3); P.scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 1.1); rim.position.set(-3, 2.5, -3); P.scene.add(rim);
  P.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b8a46, roughness: 1 }));
  P.scene.add(P.ground, P.pivot);
}
async function showPortrait() {
  const P = portrait, id = fox.kind, C = CREATURES[id];
  if ((P.rig && P.rig.id === id) || P.loading === id) return;
  if (!P.hand) { P.hand = makeHand(gHand2); P.scene.add(P.hand.g); styleHand(P.hand); }
  if (!P.renderer) {
    P.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    P.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); $('foxPortrait').appendChild(P.renderer.domElement);
    P.renderer.setSize($('foxPortrait').clientWidth || 300, $('foxPortrait').clientHeight || 150);
  }
  P.loading = id;
  try {
    const g = P.cache[id] || (P.cache[id] = await load(`animals/${C.hd || C.file}.glb`));
    if (P.loading !== id || fox.kind !== id) return;
    if (P.rig) P.pivot.remove(P.rig.model);
    P.rig = buildRig(id, g, !!C.hd); P.pivot.add(P.rig.model);
    // Kamera schräg von vorn, Bildausschnitt an die Größe des Tiers anpassen
    const size = P.rig.dims;
    P.ground.scale.setScalar(Math.max(size.x, size.z) * .75);
    P.look.set(0, size.y * .45, 0); P.dist = Math.max(size.y, size.z * .8) * 1.75;
    rigPlay(P.rig, fox.cur || 'idle');
  } catch (e) { console.warn("Porträt:", e); } // ohne Porträt bleibt das Panel nutzbar
  finally { if (P.loading === id) P.loading = null; }
}
function renderPortrait(dt, t) {
  const P = portrait; if (!P.rig || !P.renderer) return;
  const el = $('foxPortrait'), w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  const sz = P.renderer.getSize(tmpV2); if (sz.x !== w || sz.y !== h) P.renderer.setSize(w, h);
  P.cam.aspect = w / h; P.cam.updateProjectionMatrix();
  const az = .55 + Math.sin(t * .15) * .12; // ganz langsames Schwenken
  P.cam.position.set(Math.sin(az) * P.dist, P.look.y + P.dist * .25, Math.cos(az) * P.dist); P.cam.lookAt(P.look);
  P.pivot.position.y = Math.sin(Math.min(1, fox.hop / .5) * Math.PI) * .3 * CREATURES[P.rig.id].h / 1.45;
  P.rig.mixer.update(dt);
  if (P.rig.model.userData.fur) updateFur(P.rig.model.userData.fur, t);
  P.renderer.render(P.scene, P.cam);
}
const tmpV2 = new THREE.Vector2();
useCreature(S.creature, gCreature);
const ACT_LABEL = { help: 'Helfen', play: 'Spielen', mischief: 'Unfug' };
const ACT_DESC = { help: 'Holz zum Brunnen gebracht', play: 'mit dem Dorf gespielt', mischief: 'einen Baum umgeworfen' };
const ACT_COL = { help: '#8fcf7b', play: '#f3c04d', mischief: '#ee8a72' };

/* ------------------------------------------------------------------ hand */
// Gotteshand (assets/models/hand/GodHand.glb, Quelle assets/source/GodHand.blend): Skinned-Mesh mit 18 Knochen.
// Finger zeigen nach -Z, Handfläche nach unten, Daumen nach +X. Gebeugt wird um die lokale X-Achse der Knochen
// (negativ = zur Handfläche), gespreizt um die lokale Z-Achse.
function makeHand(gltf) {
  const g = new THREE.Group(), model = gltf.scene, bones = {}, rest = {}, mats = {};
  model.rotation.x = .18; g.add(model);
  model.traverse(o => {
    if (o.isBone) { bones[o.name] = o; rest[o.name] = o.quaternion.clone(); }
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; for (const m of [].concat(o.material)) { mats[m.name] = m; m.roughness = m.name === 'Nails' ? .3 : .55; m.metalness = 0; m.emissive = new THREE.Color(m.name === 'Nails' ? 0x000000 : 0x3a1606); m.emissiveIntensity = .25; } }
  });
  g.visible = false;
  return { g, bones, rest, mats, pose: Object.assign({}, HAND_POSES.relax), curl: .1, pos: new THREE.Vector3(0, 3, 0), prev: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(0, 2, 0) };
}
// Handhaltungen: curl = Finger beugen (0 offen … 1 Faust), thumb = Daumen, spread = spreizen, point = Zeigefinger gestreckt
const HAND_POSES = {
  relax: { curl: .2, thumb: .2, spread: .35, point: 0 },
  grab: { curl: .55, thumb: .55, spread: .1, point: 0 },
  hold: { curl: .82, thumb: .85, spread: 0, point: 0 },
  fist: { curl: 1, thumb: 1, spread: 0, point: 0 },
  flat: { curl: 0, thumb: 0, spread: .12, point: 0 },
  claw: { curl: .68, thumb: .7, spread: .45, point: 0 },
  point: { curl: 1, thumb: .85, spread: 0, point: 1 },
};
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'], SPREAD = [9, 2, -4, -11], hE = new THREE.Euler(), hQ = new THREE.Quaternion();
function setBone(h, n, x, z = 0) { const b = h.bones[n]; if (!b) return; b.quaternion.copy(h.rest[n]).multiply(hQ.setFromEuler(hE.set(x, 0, z))); }
// Haltung weich ansteuern und auf die Knochen übertragen; t sorgt für leichtes Fingerspiel
function poseHand(h, target, dt, t, speed = 14) {
  const k = 1 - Math.exp(-dt * speed), P = h.pose, D = Math.PI / 180;
  for (const key in P) P[key] += (target[key] - P[key]) * k;
  FINGERS.forEach((f, i) => {
    const c = f === 'Index' ? P.curl * (1 - P.point) : P.curl, w = Math.sin(t * 2 + i * 1.3) * .025;
    setBone(h, f + '1', (-75 * c - 4) * D + w, SPREAD[i] * P.spread * D);
    setBone(h, f + '2', (-92 * c - 6) * D + w);
    setBone(h, f + '3', (-62 * c - 4) * D);
  });
  setBone(h, 'Thumb0', -22 * P.thumb * D);
  setBone(h, 'Thumb1', (-35 * P.thumb - 3) * D); setBone(h, 'Thumb2', (-45 * P.thumb - 4) * D); setBone(h, 'Thumb3', -40 * P.thumb * D);
}
function styleHand(h) { if (h.mats.Skin) h.mats.Skin.color.set(S.hand.skin); if (h.mats.Nails) h.mats.Nails.color.set(S.hand.nails); }
const hand = makeHand(gHand); scene.add(hand.g); styleHand(hand);

// Gesten der Hand am Tiergeist: Streicheln (über den Rücken streichen) und Klaps (ausholen, zuschlagen)
const handAnim = { kind: null, t: 0, hit: null, hearts: 0 };
const HAND_DUR = { pet: 2.1, slap: .95 }, HAND_HIT = { pet: .55, slap: .42 };
function playHand(kind, onHit) { Object.assign(handAnim, { kind, t: 0, hit: onHit, hearts: 0 }); }
function updateHandAnim(dt, t) {
  // im Porträt steht das Tier im Ursprung und schaut nach +Z
  const A = handAnim, C = CREATURES[fox.kind], hand = portrait.hand; A.t += dt;
  const back = portrait.pivot.position.y + C.h * .62, s = clamp(C.h / 2.4, .5, 1);
  const ease = x => x * x * (3 - 2 * x), seg = (a, b) => clamp((A.t - a) / (b - a), 0, 1);
  let along = 0, lift = 0, tilt = 0, pose = HAND_POSES.relax;
  if (A.kind === 'pet') {
    // herabsinken, drei Striche vom Nacken zum Rücken, wieder abheben
    const down = ease(seg(0, .45)), up = ease(seg(1.75, 2.1)), stroke = seg(.45, 1.75);
    along = .25 - (stroke * 3 % 1) * .5; lift = (1 - down) * 1.4 + up * 1.4 + Math.sin(stroke * 3 * Math.PI) ** 2 * .06;
    tilt = -.15; pose = { curl: .25 + Math.sin(A.t * 9) * .08, thumb: .2, spread: .3, point: 0 };
    if (stroke > 0 && A.hearts < 3 && A.t > .55 + A.hearts * .43) { A.hearts++; floatText(fox.x, foxPivot.position.y + C.h + .4, fox.z, '♥', 'love'); }
  } else {
    // ausholen, schnell zuschlagen, zurückziehen
    const raise = ease(seg(0, .3)), swat = seg(.3, .42), away = ease(seg(.55, .95));
    lift = raise * .7 - swat * swat * .62 + away * 1.2; along = -.1; tilt = raise * .5 - swat * .7; pose = A.t < .5 ? HAND_POSES.flat : HAND_POSES.relax;
  }
  if (A.hit && A.t >= HAND_HIT[A.kind]) { A.hit(); A.hit = null; }
  hand.g.visible = true; hand.g.scale.setScalar(s);
  hand.g.position.set(0, back + .12 * s + lift, along * C.h);
  hand.g.rotation.set(tilt, Math.PI, 0, 'YXZ'); // Finger zeigen zum Kopf
  poseHand(hand, pose, dt, t, 18);
  if (A.t >= HAND_DUR[A.kind]) { A.kind = null; hand.g.visible = false; hand.g.scale.setScalar(1); hand.g.rotation.set(0, 0, 0); }
}

/* ------------------------------------------------------------------ UI helpers */
const fxLayer = $('fx'); const floats = [];
const tmpV = new THREE.Vector3();
function floatText(x, y, z, text, cls = 'w') {
  if (floats.length > 28) { floats[0].el.remove(); floats.shift(); }
  const el = document.createElement('div'); el.className = 'ft ' + cls; el.textContent = text; fxLayer.appendChild(el);
  floats.push({ el, p: new THREE.Vector3(x, y, z), t: 0 });
}
let toastTimer = 0;
function toast(msg, dur = 3.2) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); toastTimer = dur; }
let incomeAcc = 0, rate = 0, holzAcc = 0;
function addGlaube(n, x, y, z) { S.glaube += n; incomeAcc += n; if (x !== undefined) floatText(x, y + .7, z, '+' + fmt1(n) + ' ✦', 'g'); }
function addHolz(n, x, y, z) { S.holz += n; if (x !== undefined) floatText(x, y + .7, z, '+' + n + ' Holz', 'h'); }

/* ------------------------------------------------------------------ villager AI */
function walk(v, x, z, next) { v.state = 'walk'; v.tx = x; v.tz = z; v.next = next; }
function idle(v, t) { v.state = 'idle'; v.timer = t; }
function goPray(v) { const a = .2 * Math.PI + Math.random() * .6 * Math.PI, r = .5 + Math.random() * 1.5; walk(v, PRAY.x + Math.cos(a) * r, PRAY.z + Math.sin(a) * r, 'pray'); }
function findTree(x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < 10; i++) { const t = trees[Math.floor(Math.random() * trees.length)]; if (!t || !t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}
function chooseJob(v) {
  const r = Math.random();
  if (r < .55) { const t = findTree(v.x, v.z); if (t) { t.reserved = v; v.tree = t; const a = Math.random() * 6.28; walk(v, t.x + Math.cos(a) * .45, t.z + Math.sin(a) * .45, 'tree'); return; } }
  if (r < .92) goPray(v); else { const p = homeSpot(); walk(v, p.x, p.z, 'rest'); }
}
function stepTo(o, tx, tz, d) {
  const dx = tx - o.x, dz = tz - o.z, dist = Math.hypot(dx, dz);
  if (dist <= d + .02) { o.x = tx; o.z = tz; return true; }
  o.x += dx / dist * d; o.z += dz / dist * d;
  const th = Math.atan2(dx, dz); let dh = th - o.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); o.h += dh * Math.min(1, .2 + d * 3);
  return false;
}
function arrive(v) {
  switch (v.next) {
    case 'tree': if (v.tree && v.tree.alive) { v.state = 'chop'; v.timer = 2.4; v.h = Math.atan2(v.tree.x - v.x, v.tree.z - v.z); } else { if (v.tree) v.tree.reserved = null; v.tree = null; idle(v, .4); } break;
    case 'store': v.carry = 0; addHolz(1); holzAcc++; if (Math.random() < .6) goPray(v); else idle(v, 1); break;
    case 'pray': v.state = 'pray'; v.timer = 3.4; v.h = Math.atan2(CHURCH.x - v.x, CHURCH.z - v.z); break;
    default: idle(v, .8 + Math.random() * 2.5);
  }
}
function updateVillager(v, dt, t) {
  if (v.haste > 0) v.haste -= dt;
  const sp = .95 * (v.haste > 0 ? 2.3 : 1);
  switch (v.state) {
    case 'idle': v.timer -= dt; if (v.timer <= 0) chooseJob(v); break;
    case 'walk': if (stepTo(v, v.tx, v.tz, sp * dt)) arrive(v); break;
    case 'chop': v.timer -= dt * (v.haste > 0 ? 2 : 1); if (v.timer <= 0) { const tr = v.tree; v.tree = null; if (tr && tr.alive) { chopTree(tr); v.carry = 1; walk(v, WELL.x + rnd(.7), WELL.z + .3 + rnd(.5), 'store'); } else idle(v, .4); } break;
    case 'pray': v.timer -= dt * (v.haste > 0 ? 2 : 1); if (v.timer <= 0) { addGlaube(prayYield(), v.x, v.y, v.z); idle(v, 1 + Math.random() * 3); } break;
    case 'flee': v.timer -= dt; if (stepTo(v, v.tx, v.tz, 2.2 * dt) || v.timer <= 0) idle(v, .6); break;
    case 'dizzy': v.timer -= dt; v.h += dt * 9; if (v.timer <= 0) idle(v, .3); break;
    case 'grabbed': return;
    case 'falling': {
      v.vy -= 16 * dt; v.x = clamp(v.x + v.vx * dt, -HALF * .95, HALF * .95); v.z = clamp(v.z + v.vz * dt, -HALF * .95, HALF * .95); v.y += v.vy * dt;
      const g = surfaceAt(v.x, v.z);
      if (v.y <= g && v.vy < 0) {
        v.y = g; const spd = Math.hypot(v.vx, v.vy, v.vz); v.vx = v.vz = v.vy = 0;
        if (heightAt(v.x, v.z) < -.1) { floatText(v.x, v.y + .6, v.z, 'Platsch!', 'w'); walk(v, v.x * .55, v.z * .55, 'rest'); }
        else if (spd > 7.5) { floatText(v.x, v.y + .6, v.z, 'Uff!', 'w'); v.state = 'dizzy'; v.timer = 1.8; addGlaube(1, v.x, v.y + .3, v.z); }
        else idle(v, .5);
      }
      return;
    }
  }
  v.y = surfaceAt(v.x, v.z);
}

/* ------------------------------------------------------------------ fox AI */
function foxIdle(t) { fox.state = 'idle'; fox.timer = t; fox.idleA = ['idle', 'idle', 'idle2', 'eat'][Math.floor(Math.random() * 4)]; }
function foxWalk(x, z, next) { fox.state = 'walk'; fox.tx = x; fox.tz = z; fox.next = next; }
function foxFinish(a) {
  fox.last = a; fox.lastT = clock.elapsedTime; foxIdle(5 + Math.random() * 4); fox.act = null;
  toast(`${S.name} hat ${ACT_DESC[a]}. Lob oder Tadel?`, 4.5);
  $('btnFox').classList.add('pulse');
  renderFox();
}
function foxChoose() {
  // ab und zu hinlegen und ausruhen
  if (foxActs.lie && Math.random() < .25) { fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); return; }
  const w = S.w, r = Math.random() * (w.help + w.play + w.mischief);
  let a = r < w.help ? 'help' : r < w.help + w.play ? 'play' : 'mischief';
  if (a !== 'play') {
    let best = null, bd = 1e9;
    for (const t of trees) { if (!t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - fox.x) ** 2 + (t.z - fox.z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) a = 'play'; else { fox.tree = best; best.reserved = 'fox'; const ang = Math.atan2(fox.x - best.x, fox.z - best.z); foxWalk(best.x + Math.sin(ang) * .9, best.z + Math.cos(ang) * .9, 'tree'); }
  }
  fox.act = a;
  if (a === 'play') foxWalk(CENTER.x - 1.8, CENTER.z, 'play');
}
function updateFox(dt, t) {
  const C = CREATURES[fox.kind], spd = C.walk;
  // eine laufende Einmal-Animation (Lob/Tadel) nicht vom Zustand überschreiben lassen
  const anim = n => { if (fox.once <= 0) foxAnim(n); };
  if (fox.once > 0) fox.once -= dt;
  switch (fox.state) {
    case 'idle': anim(fox.idleA); fox.timer -= dt; if (fox.timer <= 0) foxChoose(); break;
    case 'rest': anim('lie'); fox.timer -= dt; if (fox.timer <= 0) { foxOnce('standUp'); foxIdle(.6); } break;
    case 'cast': fox.timer -= dt; if (fox.timer <= 0) foxIdle(1.5); break;
    case 'walk': anim('walk'); if (stepTo(fox, fox.tx, fox.tz, spd * dt)) {
      if (fox.next === 'tree') { if (fox.tree && fox.tree.alive) { fox.state = 'work'; fox.timer = fox.act === 'help' ? 1.8 : 1.1; fox.h = Math.atan2(fox.tree.x - fox.x, fox.tree.z - fox.z); } else { if (fox.tree) fox.tree.reserved = null; foxIdle(1); } }
      else if (fox.next === 'store') { addHolz(6, fox.x, 1.2, fox.z); fox.carry = false; foxFinish('help'); }
      else if (fox.next === 'play') { fox.state = 'play'; fox.playT = 0; }
    } break;
    case 'work': anim('attack'); fox.timer -= dt; if (fox.timer <= 0) {
      const tr = fox.tree; fox.tree = null;
      if (tr && tr.alive) {
        chopTree(tr);
        if (fox.act === 'help') { fox.carry = true; foxWalk(WELL.x - .9, WELL.z + .6, 'store'); }
        else {
          floatText(tr.x, surfaceAt(tr.x, tr.z) + 1.4, tr.z, 'Krach!', 'w');
          for (const v of villagers) { const dx = v.x - fox.x, dz = v.z - fox.z, d = Math.hypot(dx, dz); if (d < 4.5 && ['idle', 'walk', 'pray', 'chop'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 2; v.tx = v.x + dx / (d || 1) * 3; v.tz = v.z + dz / (d || 1) * 3; } }
          foxFinish('mischief');
        }
      } else foxIdle(1);
    } break;
    case 'play': {
      anim('run'); fox.playT += dt;
      const a = fox.playT * 1.9, px = CENTER.x + Math.cos(a) * 1.8, pz = CENTER.z + Math.sin(a) * 1.8;
      stepTo(fox, px, pz, C.run * 1.6 * dt);
      if (Math.floor(fox.playT) !== Math.floor(fox.playT - dt)) addGlaube(1.5, fox.x, 1.4, fox.z);
      if (fox.playT > 5) foxFinish('play');
    } break;
  }
  if (fox.hop > 0) fox.hop = Math.max(0, fox.hop - dt);
  if (glowT > 0) {
    glowT = Math.max(0, glowT - dt); const k = 1 - glowT / GLOW_T, a = Math.sin(Math.min(1, k * 1.3) * Math.PI);
    foxGlow.intensity = a * 6; foxRing.material.opacity = a * .7; foxRing.scale.setScalar(.4 + k * 1.6 * C.h);
    foxRing.position.set(fox.x, surfaceAt(fox.x, fox.z) + .08, fox.z);
  }
  foxPivot.position.set(fox.x, surfaceAt(fox.x, fox.z) + Math.sin(Math.min(1, fox.hop / .5) * Math.PI) * .7, fox.z);
  foxPivot.rotation.y = fox.h;
  foxMixer.update(dt);
}
// Ruun wirkt mit: bäumt sich auf, wenn der Spieler ein Wunder wirkt (sofern er gerade frei ist)
const GLOW_T = 2.3; let glowT = 0;
const foxGlow = new THREE.PointLight(0xffd27a, 0, 9, 1.6); foxGlow.position.y = 1.4; foxPivot.add(foxGlow); // immer in der Szene, sonst kompiliert Three.js die Shader neu
const foxRing = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
scene.add(foxRing);
function foxCast(x, z) {
  if (!['idle', 'rest', 'walk'].includes(fox.state) || (fox.state === 'walk' && fox.next === 'store')) return;
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; } fox.act = null;
  fox.h = Math.atan2(x - fox.x, z - fox.z); glowT = GLOW_T;
  if (foxActs.cast) { fox.state = 'cast'; fox.timer = foxActs.cast.getClip().duration; foxOnce('cast'); } else { fox.hop = .5; foxIdle(1.5); }
}
function reinforce(kind) {
  const t = clock.elapsedTime, a = fox.last;
  if (handAnim.kind) return; // eine Geste nach der anderen
  // die Hand führt die Geste aus, das Tier reagiert bei der Berührung
  playHand(kind, () => {
    if (fox.state === 'rest') foxIdle(2); // aus dem Liegen aufspringen
    const top = foxPivot.position.y + CREATURES[fox.kind].h + .5;
    if (kind === 'pet') { foxOnce('idle2'); floatText(fox.x, top, fox.z, '♥', 'love'); } else { foxOnce('hit'); fox.hop = .5; floatText(fox.x, top, fox.z, '!', 'w'); }
  });
  if (a && t - fox.lastT < 25) {
    S.w[a] = clamp(S.w[a] * (kind === 'pet' ? 1.6 : .5), .04, 10);
    const sum = S.w.help + S.w.play + S.w.mischief; for (const k in S.w) S.w[k] /= sum;
    toast(kind === 'pet' ? `${S.name} lernt: mehr ${ACT_LABEL[a]}.` : `${S.name} lernt: weniger ${ACT_LABEL[a]}.`);
    fox.last = null; $('btnFox').classList.remove('pulse');
  } else toast(kind === 'pet' ? `${S.name} schmiegt sich an deine Hand.` : `${S.name} duckt sich und weiß nicht, wofür.`);
  renderFox(); save();
}

/* ------------------------------------------------------------------ miracles */
function castRain(x, z) {
  rain.t = 5.5; rain.x = x; rain.z = z; rainPts.visible = true; rainCloud.visible = true;
  const p = rainGeo.attributes.position;
  for (let i = 0; i < RAIN_N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4; p.setXYZ(i, x + Math.cos(a) * r, Math.random() * 7, z + Math.sin(a) * r); }
  for (const t of trees) { if (t.gone || (t.x - x) ** 2 + (t.z - z) ** 2 > 25) continue; if (t.alive) t.g = Math.min(1, t.g + .5); else { t.alive = true; t.g = .35; t.stumpT = 0; } }
  let n = 0; for (let k = 0; k < 60 && n < 6; k++) { const a = Math.random() * 6.28, r = Math.random() * 4.5, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, h = heightAt(tx, tz);
    if (h < .4 || h > 3.4 || Math.hypot(tx, tz) < 5.5 || treeNear(tx, tz, .8)) continue; if (addTree(tx, tz, .15)) n++; }
  floatText(x, surfaceAt(x, z) + 2, z, n ? `${n} neue Setzlinge` : 'Der Wald trinkt', 's');
}
function castHaste(x, z) {
  ringT = 1.4; ring.position.set(x, surfaceAt(x, z) + .15, z);
  let n = 0; for (const v of villagers) if ((v.x - x) ** 2 + (v.z - z) ** 2 < 36) { v.haste = 30; n++; }
  floatText(x, surfaceAt(x, z) + 1.6, z, n ? `${n} Bewohner beflügelt` : 'Niemand in Reichweite', 's');
}
let miracle = 'rain', sculptDir = 1;
function tryMiracle(p) {
  const m = MIRACLES[miracle];
  if (S.glaube < m.cost) { toast(`${m.label} kostet ${m.cost} Glaube. Deine Bewohner beten noch.`); return; }
  S.glaube -= m.cost;
  if (miracle === 'rain') castRain(p.x, p.z); else castHaste(p.x, p.z);
  foxCast(p.x, p.z);
}

/* ------------------------------------------------------------------ Bäume ausreißen */
// Mit der Hand einen Baum packen und halten oder nach oben ziehen: er wackelt, reißt samt Wurzeln aus,
// liegt dann in der Hand und wird beim Loslassen geworfen. Bei der Landung wird er zu Holz; an der Stelle
// wächst später ein neuer Baum.
let treeGrab = null;
const heldTree = { on: false, flying: false, type: 0, g: 1, rot: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, tilt: 0 };
const heldObjs = [gTreeA, gTreeB].map(g => { const o = shadowify(g.scene.clone(true)); o.visible = false; scene.add(o); return o; });
const rootBall = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 7).scale(1, .55, 1), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1, flatShading: true }));
rootBall.castShadow = true; rootBall.visible = false; scene.add(rootBall);
function treeAt(cx, cy) {
  let best = null, bd = 46;
  for (const t of trees) {
    if (!t.alive || t.gone || t.g < .6) continue;
    const d = screenDist(t.x, heightAt(t.x, t.z) + .8 * t.g * ST, t.z, cx, cy); if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function uprootTree(tr) {
  if (tr.reserved === 'fox') { fox.tree = null; if (fox.state === 'walk' || fox.state === 'work') foxIdle(1); }
  else if (tr.reserved) tr.reserved.tree = null;
  tr.reserved = null; tr.alive = false; tr.stumpT = 0; tr.regrow = 50 + Math.random() * 30;
  Object.assign(heldTree, { on: true, flying: false, type: tr.type, g: tr.g, rot: tr.rot, tilt: 0 });
  floatText(tr.x, heightAt(tr.x, tr.z) + 2.2, tr.z, 'Ausgerissen!', 'w');
  for (const v of villagers) { const dx = v.x - tr.x, dz = v.z - tr.z, d = Math.hypot(dx, dz); if (d < 2.5 && ['idle', 'walk', 'chop'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 1.5; v.tx = v.x + dx / (d || 1) * 2.5; v.tz = v.z + dz / (d || 1) * 2.5; } }
}
function throwTree() {
  const k = clamp(hand.vel.length(), 0, 12) / (hand.vel.length() || 1);
  heldTree.flying = true; heldTree.vel.set(hand.vel.x * k, hand.vel.y * .4 * k + 2, hand.vel.z * k); heldTree.spin = rnd(3);
}
function updateTrees(dt, t) {
  if (treeGrab) {
    if (!treeGrab.tr.alive) treeGrab = null;
    else {
      // halten zieht langsam, nach oben wischen schneller
      treeGrab.prog += dt * .4 + Math.max(0, treeGrab.lastY - pointerXY.y) / 160; treeGrab.lastY = pointerXY.y;
      if (treeGrab.prog >= 1) { const tr = treeGrab.tr; treeGrab = null; uprootTree(tr); }
    }
  }
  const o = heldObjs[heldTree.type];
  heldObjs.forEach(x => x.visible = false); rootBall.visible = false;
  if (!heldTree.on) return;
  const s = ST * heldTree.g;
  if (heldTree.flying) {
    heldTree.vel.y -= 16 * dt; heldTree.pos.addScaledVector(heldTree.vel, dt); heldTree.tilt += heldTree.spin * dt + dt * 2.5;
    const gy = heightAt(heldTree.pos.x, heldTree.pos.z);
    if (heldTree.pos.y < Math.max(gy, 0) && heldTree.vel.y < 0) {
      heldTree.on = false; heldTree.flying = false;
      if (gy < -.1) floatText(heldTree.pos.x, .6, heldTree.pos.z, 'Platsch!', 'w');
      else { const n = Math.max(1, Math.round(3 * heldTree.g)); addHolz(n, heldTree.pos.x, gy + .4, heldTree.pos.z); }
      return;
    }
  } else heldTree.pos.set(hand.g.position.x, hand.g.position.y - .95 * s, hand.g.position.z);
  o.visible = true; rootBall.visible = true;
  o.position.copy(heldTree.pos); o.rotation.set(Math.min(heldTree.tilt, 1.4) + Math.sin(t * 3) * .05, heldTree.rot, 0); o.scale.setScalar(s);
  rootBall.position.copy(heldTree.pos); rootBall.rotation.copy(o.rotation); rootBall.scale.setScalar(heldTree.g);
}

/* ------------------------------------------------------------------ input */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let tool = 'hand', primary = null, pressing = false, grabbed = null, handShown = false;
const pointers = new Map(); const pointerXY = { x: 0, y: 0 };
const hit = new THREE.Vector3(); let hitOk = false;
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let t = 0, prev = 0;
  for (let i = 0; i < 600; i++) { const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    if (py < Math.max(heightAt(px, pz), 0)) { let a = prev, b = t; for (let k = 0; k < 10; k++) { const m = (a + b) / 2, mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my < Math.max(heightAt(mx, mz), 0)) b = m; else a = m; }
      hit.set(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b); hitOk = true; return true; }
    prev = t; t += .15 + t * .01; if (t > 220) break; }
  hitOk = false; return false;
}
function screenDist(x, y, z, cx, cy) { const r = canvas.getBoundingClientRect(); tmpV.set(x, y, z).project(camera); return Math.hypot((tmpV.x + 1) / 2 * r.width + r.left - cx, (1 - tmpV.y) / 2 * r.height + r.top - cy); }
function onToolDown(cx, cy) {
  pick(cx, cy); handShown = hitOk;
  if (tool === 'hand') {
    if (screenDist(fox.x, surfaceAt(fox.x, fox.z) + CREATURES[fox.kind].h * .45, fox.z, cx, cy) < 60) { openSheet('sheetFox'); pressing = false; return; }
    let best = null, bd = 40;
    for (const v of villagers) { if (v.state === 'grabbed' || v.state === 'falling') continue; const d = screenDist(v.x, v.y + .25, v.z, cx, cy); if (d < bd) { bd = d; best = v; } }
    if (best) { grabbed = best; if (best.tree) { best.tree.reserved = null; best.tree = null; } if (best.carry) { best.carry = 0; } best.state = 'grabbed'; }
    else if (!heldTree.on) { const tr = treeAt(cx, cy); if (tr) treeGrab = { tr, prog: 0, lastY: cy }; }
  } else if (tool === 'miracle' && hitOk) { tryMiracle(hit); pressing = false; return; }
  pressing = true;
}
function onToolUp() {
  if (treeGrab) treeGrab = null; // losgelassen, bevor der Baum nachgab
  if (heldTree.on) throwTree();
  if (grabbed) { const v = grabbed; grabbed = null; v.state = 'falling'; const k = clamp(hand.vel.length(), 0, 14) / (hand.vel.length() || 1);
    v.vx = hand.vel.x * k; v.vz = hand.vel.z * k; v.vy = hand.vel.y * .4 * k + 2.5; }
  pressing = false;
}
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, true);
  if (pointers.size > 1) { if (primary !== null) { onToolUp(); primary = null; } return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (tool === 'blick') return;
  closeSheets();
  primary = e.pointerId; pointerXY.x = e.clientX; pointerXY.y = e.clientY; onToolDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && tool !== 'blick') { pointerXY.x = e.clientX; pointerXY.y = e.clientY; handShown = true; }
  if (e.pointerId === primary) { pointerXY.x = e.clientX; pointerXY.y = e.clientY; }
});
const endPtr = e => { pointers.delete(e.pointerId); if (e.pointerId === primary) { primary = null; onToolUp(); } };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && primary === null) handShown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

const HINTS = {
  blick: 'Ziehen dreht die Welt. Zwei Finger oder Mausrad: verschieben und zoomen.',
  get hand() { return `Bewohner packen und werfen, Bäume packen und ausreißen. ${S.name} antippen, um ihn zu erziehen.`; },
  sculpt: 'Gedrückt halten, um Land zu heben oder zu senken.',
  miracle: 'Wunder wählen, dann auf die Welt tippen.'
};
function setTool(t) {
  tool = t; if (grabbed) onToolUp();
  document.querySelectorAll('.tools button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  $('ctxSculpt').hidden = t !== 'sculpt'; $('ctxMiracle').hidden = t !== 'miracle';
  $('hint').textContent = HINTS[t];
  controls.mouseButtons = { LEFT: t === 'blick' ? THREE.MOUSE.ROTATE : -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: t === 'blick' ? THREE.TOUCH.ROTATE : -1, TWO: THREE.TOUCH.DOLLY_PAN };
  if (t === 'blick') handShown = false;
}
document.querySelectorAll('.tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
document.querySelectorAll('#ctxSculpt button').forEach(b => b.addEventListener('click', () => { sculptDir = +b.dataset.dir; document.querySelectorAll('#ctxSculpt button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
document.querySelectorAll('#ctxMiracle button').forEach(b => b.addEventListener('click', () => { miracle = b.dataset.m; document.querySelectorAll('#ctxMiracle button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));

/* ------------------------------------------------------------------ sheets */
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.hidden = true); $('app').classList.remove('sheet-open'); }
function openSheet(id) { const s = $(id), was = !s.hidden; closeSheets(); s.hidden = was; $('app').classList.toggle('sheet-open', !s.hidden); if (!s.hidden) { if (id === 'sheetShrine') renderShrine(); if (id === 'sheetFox') { renderFox(); showPortrait(); } } }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
$('btnShrine').addEventListener('click', () => openSheet('sheetShrine'));
$('btnFox').addEventListener('click', () => openSheet('sheetFox'));
$('btnInfo').addEventListener('click', () => openSheet('sheetInfo'));
$('btnPet').addEventListener('click', () => reinforce('pet'));
$('btnSlap').addEventListener('click', () => reinforce('slap'));
// Folgen: die Kamera bleibt beim Tiergeist, bis der Chip oben oder der Knopf im Panel es beendet
let follow = false;
function renderFollow() { $('btnFollow').hidden = !follow; $('btnFocus').setAttribute('aria-pressed', follow); $('btnFocus').textContent = follow ? 'Folgen aus' : 'Folgen'; }
$('btnFocus').addEventListener('click', () => { follow = !follow; renderFollow(); if (follow) closeSheets(); });
$('btnFollow').addEventListener('click', () => { follow = false; renderFollow(); });
let resetArmed = false;
$('btnReset').addEventListener('click', e => {
  if (!resetArmed) { resetArmed = true; e.target.textContent = 'Wirklich zurücksetzen?'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {} skipSave = true; location.reload();
});
let skipSave = false;

const SHRINE = [
  { id: 'temple', title: () => `Tempel weihen (Stufe ${S.temple + 1})`, desc: () => `Gebete bringen ${fmt1(prayYield() + .6)} statt ${fmt1(prayYield())} Glaube, der Tempel strahlt ${fmt1(passive() + .06)}/s aus.`, cost: templeCost, buy: () => { S.temple++; } },
  { id: 'soul', title: () => 'Seele rufen', desc: () => villagers.length < cap() ? 'Ein neuer Bewohner erscheint sofort am Tempel.' : 'Kein Platz. Deine Bewohner bauen aus Holz neue Häuser.', cost: () => SOUL_COST, ok: () => villagers.length < cap(), buy: () => { const v = spawnVillager(PRAY.x, PRAY.z + .5); if (v) floatText(v.x, 1.8, v.z, 'Neue Seele', 's'); } },
  { id: 'hand', title: () => `Hand stärken (Stufe ${S.hand + 1})`, desc: () => 'Formen wirkt 35 % weiter und kräftiger.', cost: handCost, buy: () => { S.hand++; } }
];
function renderShrine() {
  $('shrineItems').innerHTML = SHRINE.map(it => { const c = it.cost(), ok = S.glaube >= c && (!it.ok || it.ok());
    return `<div class="item"><div><h3>${it.title()}</h3><p>${it.desc()}</p></div><button class="buy" data-buy="${it.id}" ${ok ? '' : 'disabled'}>${fmt(c)} ✦</button></div>`; }).join('');
  $('shrineItems').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { const it = SHRINE.find(x => x.id === b.dataset.buy), c = it.cost();
    if (S.glaube < c || (it.ok && !it.ok())) return; S.glaube -= c; it.buy(); renderShrine(); save(); }));
}
function renderFox() {
  $('foxBars').innerHTML = ['help', 'play', 'mischief'].map(k => `<div class="bar"><span>${ACT_LABEL[k]}</span><div class="track"><div class="fill" style="width:${Math.round(S.w[k] * 100)}%;background:${ACT_COL[k]}"></div></div><span class="num">${Math.round(S.w[k] * 100)} %</span></div>`).join('');
  const t = clock.elapsedTime;
  $('foxLast').textContent = fox.last && t - fox.lastT < 25 ? `Gerade eben hat ${S.name} ${ACT_DESC[fox.last]}. Deine Reaktion prägt ihn.` : `Warte auf die nächste Tat von ${S.name}, dann lobe oder tadle ihn.`;
  $('foxNow').textContent = `${S.name} ${foxDoing()}.`;
  renderForms();
}
// Buttons nur einmal anlegen und danach aktualisieren: renderFox läuft alle 0,25 s,
// ein Neuaufbau zwischen Drücken und Loslassen würde den Klick verschlucken.
$('foxForms').innerHTML = Object.entries(CREATURES).map(([id, c]) => `<button data-form="${id}">${c.label}</button>`).join('');
// kurze Beschreibung des aktuellen Zustands für das Panel
function foxDoing() {
  switch (fox.state) {
    case 'walk':
      if (fox.next === 'store') return 'trägt Holz zum Brunnen';
      if (fox.next === 'play') return 'läuft zum Dorfplatz, um zu spielen';
      return fox.act === 'help' ? 'läuft zu einem Baum, um Holz zu holen' : 'schleicht zu einem Baum und führt etwas im Schilde';
    case 'work': return fox.act === 'help' ? 'fällt einen Baum für das Dorf' : 'rüttelt mutwillig an einem Baum';
    case 'play': return 'tollt über den Dorfplatz';
    case 'rest': return 'hat sich hingelegt und döst';
    case 'cast': return 'wirkt mit dir ein Wunder';
    default: return fox.idleA === 'eat' ? 'schnuppert am Boden' : 'schaut sich um';
  }
}
// Name an allen Stellen der Oberfläche setzen
function renderName() {
  $('btnFox').textContent = S.name; $('sheetFox').setAttribute('aria-label', S.name);
  if (document.activeElement !== $('foxName')) $('foxName').value = S.name;
  $('btnFollow').textContent = `Folgt ${S.name} ✕`;
  if (tool === 'hand') $('hint').textContent = HINTS.hand;
}
$('foxName').addEventListener('change', () => { S.name = $('foxName').value.trim().slice(0, 16) || 'Ruun'; renderName(); renderFox(); save(); });
$('foxName').addEventListener('keydown', e => { if (e.key === 'Enter') $('foxName').blur(); });
function renderForms() {
  for (const b of $('foxForms').children) {
    const id = b.dataset.form, label = creatureLoading === id ? 'Lädt …' : CREATURES[id].label;
    b.setAttribute('aria-pressed', id === fox.kind); b.disabled = !!creatureLoading;
    if (b.textContent !== label) b.textContent = label;
  }
}
$('foxForms').addEventListener('click', e => { const b = e.target.closest('[data-form]'); if (b) setCreature(b.dataset.form); });

/* ------------------------------------------------------------------ offline progress */
{
  const away = Math.min((Date.now() - (S.ts || Date.now())) / 1000, 8 * 3600);
  if (loaded && away > 30) {
    const pop = villagers.length, gRate = pop * prayYield() * .45 / 22 + passive(), hRate = pop * .55 / 22;
    const g = gRate * away * .5, h = Math.min(hRate * away * .5, 400);
    S.glaube += g; S.holz += h;
    setTimeout(() => toast(`Während du fort warst: +${fmt(g)} Glaube, +${fmt(h)} Holz.`, 5), 900);
  }
}
function save() { if (skipSave) return; S.ts = Date.now(); S.pop = villagers.length; S.houses = houses.length; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
const dummy = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
const vEuler = new THREE.Euler(), vTmp = new THREE.Matrix4(), vOut = new THREE.Matrix4();
let uiT = 0, secT = 0, birthT = 0;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
setTool('hand'); renderName();

function frame() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;

  // tool action
  if (primary !== null || (handShown && tool !== 'blick')) pick(pointerXY.x, pointerXY.y);
  if (pressing && tool === 'sculpt' && hitOk) sculpt(hit.x, hit.z, sculptDir, dt);

  // economy ticks
  S.glaube += passive() * dt; incomeAcc += passive() * dt;
  secT += dt; if (secT >= 1) { rate = rate * .85 + incomeAcc / secT * .15; incomeAcc = 0; secT = 0; }
  birthT += dt; if (birthT > 9) { birthT = 0; if (villagers.length < cap()) { const p = homeSpot(), v = spawnVillager(p.x, p.z); if (v) floatText(v.x, 1.6, v.z, 'Neue Seele', 's'); } }
  if (!construction && S.holz >= houseCost()) { const site = freeSite(); if (site) { S.holz -= houseCost(); construction = { site, t: 0 }; site.used = true; scaff.x = site.x; scaff.z = site.z; scaff.o.rotation.y = site.ry; scaff.o.visible = true; } }
  if (construction) { construction.t += dt; if (construction.t > 9) { construction.site.used = false; const hs = addHouse(construction.site); S.houses = houses.length; scaff.o.visible = false; construction = null; floatText(hs.x, 2.2, hs.z, 'Neues Haus', 's'); toast(`Ein neues Haus steht. Platz für ${cap()} Seelen.`); save(); } }

  // villagers
  for (const v of villagers) updateVillager(v, dt, t);
  if (grabbed) { grabbed.x = hand.g.position.x; grabbed.z = hand.g.position.z + .05; grabbed.y = hand.g.position.y - .62; }
  for (const m of vAll) m.count = villagers.length;
  villagers.forEach((v, i) => {
    const L = v.look;
    let bob = 0, tilt = 0, roll = 0, leg = 0, armA = 0, armB = 0, splay = .25;
    if (v.state === 'walk' || v.state === 'flee') {
      const s = Math.sin(t * (v.haste > 0 || v.state === 'flee' ? 18 : 11) + v.ph);
      bob = Math.abs(s) * .03; leg = s * .6; armA = -s * .5; armB = s * .5;
      if (v.state === 'flee') { armA = armB = -2.6 + s * .4; }
    } else if (v.state === 'chop') { const c = Math.max(0, Math.sin(t * 9 + v.ph)); tilt = c * .3; armA = armB = -2.5 + c * 1.6; splay = .1; }
    else if (v.state === 'pray') { tilt = .35 + Math.sin(t * 2 + v.ph) * .08; armA = armB = -1.35; splay = -.12; }
    else if (v.state === 'grabbed' || v.state === 'falling') {
      const s = Math.sin(t * 16 + v.ph); roll = v.state === 'grabbed' ? Math.sin(t * 7 + v.ph) * .5 : t * 10;
      leg = s * .5; armA = -2.7 + s * .5; armB = -2.7 - s * .5; splay = .5;
    } else if (v.state === 'dizzy') { armA = armB = 0; splay = 1.2 + Math.sin(t * 6 + v.ph) * .2; }
    if (v.carry && v.state !== 'grabbed' && v.state !== 'falling') { armA = armB = -1.1; splay = .12; }
    dummy.position.set(v.x, v.y + bob, v.z); dummy.rotation.set(tilt, v.h, roll, 'YXZ'); dummy.scale.set(VS * L.s * L.w, VS * L.s, VS * L.s * L.w); dummy.updateMatrix();
    const M = dummy.matrix;
    const part = (mesh, x, y, a, z) => { vEuler.set(a, 0, z); vTmp.makeRotationFromEuler(vEuler).setPosition(x, y, 0); mesh.setMatrixAt(i, vOut.multiplyMatrices(M, vTmp)); };
    part(vParts.legL, .038, HIP_Y, leg, 0); part(vParts.legR, -.038, HIP_Y, -leg, 0);
    part(vParts.armL, .085, SHO_Y, armA, splay); part(vParts.armR, -.085, SHO_Y, armB, -splay);
    vParts.body.setMatrixAt(i, M); vParts.head.setMatrixAt(i, M); vParts.eyes.setMatrixAt(i, M);
    vParts.hair.forEach((m, k) => m.setMatrixAt(i, k === L.hair ? M : zero));
    vParts.beard.setMatrixAt(i, L.beard ? M : zero);
    vWood.setMatrixAt(i, v.carry ? M : zero);
  });
  for (const m of vAll) m.instanceMatrix.needsUpdate = true;

  // trees
  const tc2 = [0, 0]; let sc = 0;
  for (const tr of trees) {
    if (tr.gone) continue;
    const y = heightAt(tr.x, tr.z);
    if (y < .05) { tr.gone = true; if (tr.reserved && tr.reserved !== 'fox') tr.reserved.tree = null; tr.reserved = null; continue; }
    if (tr.alive) {
      if (tr.g < 1) tr.g = Math.min(1, tr.g + dt * .008);
      const s = ST * tr.g, pull = treeGrab && treeGrab.tr === tr ? treeGrab.prog : 0;
      dummy.position.set(tr.x, y + pull * .25, tr.z); dummy.rotation.set(Math.sin(t * 1.3 + tr.ph) * .03 + Math.sin(t * 31) * pull * .12, tr.rot, Math.sin(t * 27) * pull * .1); dummy.scale.setScalar(s); dummy.updateMatrix();
      treeSwarms[tr.type].set(tc2[tr.type]++, dummy.matrix);
    } else if (tr.stumpT > 0) {
      tr.stumpT -= dt;
      dummy.position.set(tr.x, y, tr.z); dummy.rotation.set(0, tr.rot, 0); dummy.scale.setScalar(ST); dummy.updateMatrix(); stumpSwarm.set(sc++, dummy.matrix);
      if (tr.stumpT <= 0) { tr.alive = true; tr.g = .2; }
    } else if (tr.regrow > 0) { tr.regrow -= dt; if (tr.regrow <= 0) { tr.alive = true; tr.g = .15; } }
  }
  treeSwarms[0].commit(tc2[0]); treeSwarms[1].commit(tc2[1]); stumpSwarm.commit(sc);
  const rc = [0, 0];
  for (const r of rocks) { const y = heightAt(r.x, r.z); dummy.position.set(r.x, y - .02, r.z); dummy.rotation.set(0, r.r, 0); dummy.scale.setScalar(r.s); dummy.updateMatrix(); rockSwarms[r.type].set(rc[r.type]++, dummy.matrix); }
  rockSwarms[0].commit(rc[0]); rockSwarms[1].commit(rc[1]);
  for (const s of statics) s.o.position.set(s.x, heightAt(s.x, s.z), s.z);
  if (millFan) millFan.rotation.z += dt * 1.4;

  updateFox(dt, t);
  updateTrees(dt, t);

  // hand
  if (handAnim.kind) updateHandAnim(dt, t);
  const showHand = tool !== 'blick' && handShown && hitOk;
  hand.g.visible = showHand;
  if (showHand) {
    const lift = heldTree.on ? 1.3 + ST * heldTree.g * .95 : grabbed ? 1.0 : (pressing && tool === 'sculpt') ? .75 : 1.5;
    if (treeGrab) {
      // am Stamm festhalten und zittern, je weiter der Baum nachgibt
      const tr = treeGrab.tr, j = treeGrab.prog * .05;
      hand.target.set(tr.x + rnd(j), heightAt(tr.x, tr.z) + .95 * tr.g * ST + treeGrab.prog * .25, tr.z + rnd(j));
    } else hand.target.set(hit.x, Math.max(hit.y, 0) + lift, hit.z);
    hand.prev.copy(hand.g.position);
    hand.g.position.lerp(hand.target, 1 - Math.exp(-dt * 16));
    const v = tmpV.copy(hand.g.position).sub(hand.prev).divideScalar(Math.max(dt, 1e-3)); hand.vel.lerp(v, .35);
    const dx = controls.target.x - camera.position.x, dz = controls.target.z - camera.position.z;
    hand.g.rotation.y = Math.atan2(-dx, -dz);
    const pose = grabbed || heldTree.on ? HAND_POSES.hold : treeGrab ? HAND_POSES.claw
      : pressing ? (tool === 'sculpt' ? (sculptDir > 0 ? HAND_POSES.flat : HAND_POSES.fist) : HAND_POSES.grab) : HAND_POSES.relax;
    poseHand(hand, pose, dt, t);
  }

  // effects
  if (rain.t > 0) {
    rain.t -= dt; const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) { let y = p.getY(i) - dt * 11; if (y < surfaceAt(p.getX(i), p.getZ(i))) y = 6.5; p.setY(i, y); }
    p.needsUpdate = true; rainCloud.position.set(rain.x, 6.6 + Math.sin(t) * .1, rain.z);
    rainPts.material.opacity = Math.min(.8, rain.t);
    if (rain.t <= 0) { rainPts.visible = false; rainCloud.visible = false; }
  }
  if (ringT > 0) { ringT -= dt; const k = 1 - ringT / 1.4; ring.scale.setScalar(.2 + k * .8); ring.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * .75; }
  for (const c of clouds) { c.position.x += dt * .4; if (c.position.x > 36) c.position.x = -36; }
  { const p = wGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = wBase[i * 3], z = wBase[i * 3 + 2]; p.setY(i, Math.sin(x * .45 + t * 1.1) * .05 + Math.cos(z * .5 + t * .9) * .05 - .02); } p.needsUpdate = true; }

  // camera
  if (follow) { const k = 1 - Math.exp(-dt * 3), nx = controls.target.x + (fox.x - controls.target.x) * k, nz = controls.target.z + (fox.z - controls.target.z) * k;
    camera.position.x += nx - controls.target.x; camera.position.z += nz - controls.target.z; controls.target.x = nx; controls.target.z = nz; }
  const tr = Math.hypot(controls.target.x, controls.target.z);
  if (tr > 18) { const k = 18 / tr, ox = controls.target.x, oz = controls.target.z; controls.target.x *= k; controls.target.z *= k; camera.position.x += controls.target.x - ox; camera.position.z += controls.target.z - oz; }
  controls.target.y = 1;
  controls.update();

  // floating texts
  const rect = canvas.getBoundingClientRect();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    if (f.t > 1.5) { f.el.remove(); floats.splice(i, 1); continue; }
    tmpV.copy(f.p).project(camera);
    if (tmpV.z > 1) { f.el.style.opacity = 0; continue; }
    const sx = (tmpV.x + 1) / 2 * rect.width, sy = (1 - tmpV.y) / 2 * rect.height - f.t * 34;
    f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`; f.el.style.opacity = String(Math.min(1, (1.5 - f.t) * 2.5));
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }

  // HUD
  uiT -= dt;
  if (uiT <= 0) {
    uiT = .25;
    $('vG').textContent = fmt(S.glaube); $('vGr').textContent = '+' + fmt1(rate) + '/s';
    $('vH').textContent = fmt(S.holz); $('vHn').textContent = construction ? 'Haus im Bau' : (freeSite() ? `Haus ab ${houseCost()}` : 'Dorf voll');
    $('vP').textContent = `${villagers.length}/${cap()}`; $('vPh').textContent = `${houses.length} ${houses.length === 1 ? 'Haus' : 'Häuser'}`;
    document.querySelectorAll('#ctxMiracle button').forEach(b => b.classList.toggle('poor', S.glaube < MIRACLES[b.dataset.m].cost));
    if (!$('sheetShrine').hidden) { const bs = $('shrineItems').querySelectorAll('[data-buy]'); bs.forEach(b => { const it = SHRINE.find(x => x.id === b.dataset.buy); b.disabled = !(S.glaube >= it.cost() && (!it.ok || it.ok())); }); }
    if (!$('sheetFox').hidden) renderFox();
    if (fox.last && t - fox.lastT > 25) { fox.last = null; $('btnFox').classList.remove('pulse'); }
  }

  renderer.render(scene, camera);
  if (!$('sheetFox').hidden) renderPortrait(dt, t);
  requestAnimationFrame(frame);
}
$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 800);
window.__wk = { S, villagers, trees, fox, setTool };
requestAnimationFrame(frame);
}

start().catch(err => { const st = document.getElementById('loadSt'); if (st) st.textContent = 'Die Welt konnte nicht geladen werden. ' + String(err.message).slice(0, 160); console.error(err); });
