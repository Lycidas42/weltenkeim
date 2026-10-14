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
const S = { v: 1, glaube: 15, holz: 6, temple: 1, hand: 1, houses: 2, pop: 6, w: { help: .34, play: .33, mischief: .33 }, creature: 'fox', name: 'Fenja', gender: 'w', handStyle: { skin: '#e9b48c', nails: '#f4ddd3', sleeve: '#33507f', trim: '#dba843' }, hour: 8, timePaused: false, jobs: { wood: 3, saw: 1 }, huts: { lumber: 1, forester: 1, sawyer: 1 }, logs: 0, paths: [], weather: 'heiter', weatherLocked: false, ts: Date.now() };
let loaded = null;
{ try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { loaded = null; } }
if (loaded && typeof loaded === 'object') {
  // Version 0.2.0 hat das Aussehen der Hand versehentlich in S.hand (die Ausbaustufe) geschrieben: hier reparieren
  const oldStyle = loaded.hand && typeof loaded.hand === 'object' ? loaded.hand : {};
  Object.assign(S, loaded, { w: Object.assign({}, S.w, loaded.w || {}), handStyle: Object.assign({}, S.handStyle, oldStyle, loaded.handStyle || {}),
    jobs: Object.assign({}, S.jobs, loaded.jobs || {}), huts: Object.assign({}, S.huts, loaded.huts || {}) });
  if (typeof S.hand !== 'number' || !isFinite(S.hand) || S.hand < 1) S.hand = 1;
  if (!loaded.gender && loaded.name === 'Ruun') S.name = 'Fenja'; // alter Standardname: die Kreatur heißt jetzt zu Beginn Fenja
  if (S.gender !== 'm') S.gender = 'w';
  if (typeof S.hour !== 'number' || !isFinite(S.hour)) S.hour = 8;
}
const prayYield = () => 1 + 0.6 * (S.temple - 1);
const passive = () => 0.06 * S.temple;
const MAX_POP = 40; // vorerst höchstens so viele Bewohner (Übersicht und Leistung auf dem Handy)
const cap = () => Math.min(MAX_POP, 4 + 3 * S.houses);
const houseCost = () => 12 + 6 * Math.max(0, S.houses - 2);
const templeCost = () => Math.round(30 * Math.pow(1.7, S.temple - 1));
const handCost = () => Math.round(40 * Math.pow(1.8, S.hand - 1));
const SOUL_COST = 15;
// Berufe: Spezialisten arbeiten von ihrer Hütte aus, jede Hütte hat Platz für `per` von ihnen. Hütten kosten Holz.
const ROLES = {
  lumber: { label: 'Holzfäller', hut: 'Holzfällerhütte', per: 4, cost: n => 14 + 8 * n },
  forester: { label: 'Förster', hut: 'Försterhütte', per: 3, cost: n => 12 + 6 * n },
  sawyer: { label: 'Säger', hut: 'Sägemühle', per: 2, cost: n => 24 + 12 * n },
};
// Arbeitsstätten: der Spieler weist ihnen Bewohner zu (0 oder mindestens `min`), sie verteilen sich auf die Berufe
const WORKS = {
  wood: { label: 'Wald', min: 3, desc: 'Holzfäller fällen Bäume und bringen die Stämme ins Lager. Förster pflanzen neue Bäume.', split: k => { const f = Math.max(1, Math.round(k / 3)); return { lumber: k - f, forester: f }; } },
  saw: { label: 'Sägemühle', min: 1, desc: 'Säger sägen aus Stämmen Bretter, das Baumaterial für Hütten und Häuser. Freie Bewohner tragen die Stämme aus dem Lager zur Säge und die Bretter zurück.', split: k => ({ sawyer: k }) },
};
for (const id in WORKS) if (typeof S.jobs[id] !== 'number' || !isFinite(S.jobs[id]) || S.jobs[id] < 0) S.jobs[id] = 0;
for (const r in ROLES) if (typeof S.huts[r] !== 'number' || !isFinite(S.huts[r]) || S.huts[r] < 1) S.huts[r] = 1;
if (typeof S.logs !== 'number' || !isFinite(S.logs) || S.logs < 0) S.logs = 0;
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
scene.fog = new THREE.Fog(0xd6e8e0, 42, 105);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
camera.position.set(13, 15, 19);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 7; controls.maxDistance = 58; controls.maxPolarAngle = 1.42; // flach genug, um Sonne, Mond und Sterne am Horizont zu sehen
controls.screenSpacePanning = false;

const hemi = new THREE.HemisphereLight(0xdff1ff, 0x6a5a3a, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
sun.position.set(18, 28, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); // tagsüber Sonne, nachts Mondlicht

/* ------------------------------------------------------------------ Tag und Nacht */
// Spielzeit S.hour (0–24): tagsüber dauert eine Stunde 20 s, nachts nur 7 s, damit die Nacht nicht zu lang wird.
const hourRate = h => (h >= 5.5 && h < 21.5 ? 1 / 20 : 1 / 7);
// Stützstellen: Stunde, Himmel oben/Mitte/Horizont (= Nebel), Licht (Sonne bzw. Mond) und Stärke, Himmelslicht oben/Boden und Stärke, Nacht 0–1
const DAY_KF = [
  [0, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
  [4.8, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
  [5.7, '#1a2552', '#3b3f6e', '#8a6a7a', '#ff9f6a', .2, '#6a78a8', '#2a2430', .5, .75],
  [6.5, '#4269a6', '#8fa9c8', '#f2b582', '#ffb27a', 1.1, '#bcd0e8', '#5a4a3a', .8, .2],
  [7.8, '#5ea9d4', '#a9d4e4', '#dfeee2', '#fff0d4', 2.3, '#dff1ff', '#6a5a3a', 1.15, 0],
  [17.4, '#5ea9d4', '#a9d4e4', '#e6efdc', '#ffeccc', 2.2, '#dff1ff', '#6a5a3a', 1.1, 0],
  [18.9, '#5274ab', '#c6a39a', '#f7b07c', '#ff9a58', 1.3, '#d0c0d8', '#5a4436', .8, .2],
  [20.1, '#1f2b5c', '#4a3f6e', '#9a5d6c', '#ff7a48', .25, '#6f76a8', '#2a2230', .6, .7],
  [21.2, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
  [24, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
].map(r => ({ h: r[0], top: new THREE.Color(r[1]), mid: new THREE.Color(r[2]), hor: new THREE.Color(r[3]), light: new THREE.Color(r[4]), li: r[5], hemiS: new THREE.Color(r[6]), hemiG: new THREE.Color(r[7]), hi: r[8], night: r[9] }));
const sky = { top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), light: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), li: 0, hi: 0, night: 0 };
function sampleSky(h) {
  let k = 0; while (k < DAY_KF.length - 2 && DAY_KF[k + 1].h <= h) k++;
  const a = DAY_KF[k], b = DAY_KF[k + 1], e = smooth(0, 1, (h - a.h) / (b.h - a.h));
  for (const c of ['top', 'mid', 'hor', 'light', 'hemiS', 'hemiG']) sky[c].lerpColors(a[c], b[c], e);
  for (const c of ['li', 'hi', 'night']) sky[c] = a[c] + (b[c] - a[c]) * e;
}
const glowTex = (() => { // weicher Lichtfleck, für Sonne, Mondschein, Laternen und Lichtkegel am Boden
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
// Himmelskuppel wandert mit der Kamera; darin Sterne, Sonne und Mond
const skyG = new THREE.Group(); scene.add(skyG);
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: sky.top }, mid: { value: sky.mid }, hor: { value: sky.hor }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 top, mid, hor, sunCol, sunDir; uniform float glow; varying vec3 vD;
    void main() {
      vec3 d = normalize(vD); float y = d.y;
      vec3 c = mix(hor, mid, smoothstep(-.02, .17, y)); c = mix(c, top, smoothstep(.17, .7, y));
      float s = max(dot(d, sunDir), 0.); c += sunCol * glow * (pow(s, 5.) * .5 + pow(s, 40.) * .6) * smoothstep(-.2, .04, y);
      gl_FragColor = vec4(c, 1.);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat); skyDome.renderOrder = -10; skyDome.frustumCulled = false; skyG.add(skyDome);
const STAR_N = 900, starPos = new Float32Array(STAR_N * 3), starAt = new Float32Array(STAR_N * 2);
for (let i = 0; i < STAR_N; i++) { // am Horizont dichter, dort ist der Himmel im Bild
  const y = Math.random() ** 1.7, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
  starPos.set([Math.cos(a) * r * 170, y * 170, Math.sin(a) * r * 170], i * 3); starAt.set([1.2 + Math.random() ** 3 * 2.4, Math.random() * 6.28], i * 2);
}
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('star', new THREE.BufferAttribute(starAt, 2));
const starMat = new THREE.ShaderMaterial({
  uniforms: { op: { value: 0 }, t: { value: 0 }, px: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute vec2 star; uniform float op, t, px; varying float vA;
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = star.x * px;
      vA = op * (.6 + .4 * sin(t * (.7 + star.y * .25) + star.y * 5.)) * smoothstep(0., .05, normalize(position).y); }`,
  fragmentShader: 'varying float vA; void main() { float a = vA * smoothstep(.5, .12, length(gl_PointCoord - .5)); if (a < .01) discard; gl_FragColor = vec4(1., .96, .86, a); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; stars.frustumCulled = false; skyG.add(stars);
const skySprite = (map, scale, additive) => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); o.scale.setScalar(scale); o.renderOrder = -8; skyG.add(o); return o; };
const sunTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  let gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(.12, 'rgba(255,240,200,1)'); gr.addColorStop(.16, 'rgba(255,220,150,.55)'); gr.addColorStop(.45, 'rgba(255,190,110,.14)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const moonTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#eef1f8'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,160,185,.35)';
  for (const [x, y, r] of [[44, 48, 14], [80, 40, 9], [74, 78, 18], [42, 86, 8], [96, 70, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const sunSprite = skySprite(sunTex, 30, true), moonHalo = skySprite(glowTex, 26, true), moonSprite = skySprite(moonTex, 6.5, false);
moonHalo.material.color.set(0x7f95d6);
const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), visSun = new THREE.Vector3(), visMoon = new THREE.Vector3();
// Am Himmel laufen Sonne und Mond flacher als ihr Licht einfällt: die Kamera sieht nur den Streifen über dem Horizont
function visualDir(d, out) {
  const el = Math.asin(clamp(d.y, -1, 1)), ve = el > 0 ? el * .2 + .04 * Math.min(1, el * 10) : el, hz = Math.hypot(d.x, d.z) || 1;
  return out.set(d.x / hz * Math.cos(ve), Math.sin(ve), d.z / hz * Math.cos(ve));
}
const lightDir = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);
// Wetter: jeden Morgen (5 Uhr) neu gewürfelt, mittags manchmal ein Umschwung. cover = Bewölkung, rain = Regen, wind = Grundwind.
const WEATHER = {
  klar: { cover: 0, rain: 0, wind: .22, p: .22, label: 'klar' },
  heiter: { cover: .3, rain: 0, wind: .38, p: .38, label: 'heiter' },
  bewoelkt: { cover: .72, rain: 0, wind: .58, p: .25, label: 'bewölkt' },
  regen: { cover: .97, rain: 1, wind: .85, p: .15, label: 'Regen' },
  // Schnee: vorerst nur von Hand (p = 0), später je nach Jahreszeit
  schnee: { cover: .88, rain: 0, snow: 1, wind: .3, p: 0, label: 'Schnee' },
};
if (!WEATHER[S.weather]) S.weather = 'heiter';
const weather = { cover: WEATHER[S.weather].cover, rain: WEATHER[S.weather].rain, snow: WEATHER[S.weather].snow || 0, snowCover: WEATHER[S.weather].snow || 0, wind: WEATHER[S.weather].wind, wet: WEATHER[S.weather].rain, dir: Math.random() * 6.28, lastH: S.hour };
function rollWeather() { let r = Math.random(); for (const k in WEATHER) { r -= WEATHER[k].p; if (r <= 0) return k; } return 'heiter'; }
function setWeather(k) { if (WEATHER[k]) S.weather = k; }
function updateWeather(dt, t) {
  const h = S.hour, lh = weather.lastH; weather.lastH = h;
  if (!S.weatherLocked) { // vom Spieler festgehaltenes Wetter bleibt
    if ((lh < 5 && h >= 5) || (lh > h && h >= 5)) setWeather(rollWeather());          // neuer Tag
    if (lh < 13 && h >= 13 && Math.random() < .3) setWeather(rollWeather());           // Umschwung am Mittag
  }
  const W = WEATHER[S.weather], k = Math.min(1, dt * .06);                            // Übergang über einige Sekunden
  weather.cover += (W.cover - weather.cover) * k; weather.rain += (W.rain - weather.rain) * k * 1.5; weather.wind += (W.wind - weather.wind) * k;
  weather.snow += ((W.snow || 0) - weather.snow) * Math.min(1, dt * .35);          // Schneefall setzt schnell ein und hört schnell auf
  // Schneedecke: wächst bei Schneefall in gut einer halben Minute, taut bei Sonne in etwa einer halben Minute, bei Wolken und nachts in einigen Minuten
  if (weather.snow > .3) weather.snowCover = Math.min(1, weather.snowCover + dt * weather.snow / 40);
  else weather.snowCover = Math.max(0, weather.snowCover - dt * ((1 - weather.cover) * (1 - sky.night) / 30 + weather.rain / 15 + 1 / 200));
  snowU.uSnow.value = weather.snowCover;
  weather.dir += (noise(t * .01, 9.1) * .5) * dt * .05;                               // Windrichtung dreht langsam
  // Nässe: in etwa einer halben Minute Regen voll, bei Sonne in gut einer Minute trocken
  if (weather.rain > .3) weather.wet = Math.min(1, weather.wet + dt * weather.rain / 30);
  else weather.wet = Math.max(0, weather.wet - dt * ((1 - weather.cover) * (1 - sky.night) / 70 + 1 / 500));
  terrainU.uWet.value = weather.wet;
}
// Schnee auf allem, was nach oben zeigt: wird in die Standard-Materialien eingeschleust (snowify), stärker auf flachen
// Flächen, fleckig an den Rändern, nur oberhalb des Meeres.
const snowU = { uSnow: { value: 0 } };
const SNOW_GLSL = `
  if (uSnow > .001) {
    vec3 snWN = normalize((vec4(normal, 0.) * viewMatrix).xyz), snWP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.)).xyz;
    float snN = fract(sin(dot(floor(snWP.xz * 6.), vec2(12.9898, 78.233))) * 43758.5453) * .25;
    float sn = smoothstep(.35 + .3 * (1. - uSnow) - snN * .3, .8, snWN.y) * smoothstep(.04, .12, snWP.y) * smoothstep(0., .6, uSnow + snN * .2 - .1);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.92, .95, 1.), sn); roughnessFactor = mix(roughnessFactor, .75, sn);
  }
`;
const snowSkip = new WeakSet(), snowDone = new WeakSet();
function snowify(m) {
  if (!m || !m.isMeshStandardMaterial || snowDone.has(m) || snowSkip.has(m)) return;
  snowDone.add(m); const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    sh.uniforms.uSnow = snowU.uSnow;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;').replace('#include <lights_physical_fragment>', SNOW_GLSL + '#include <lights_physical_fragment>');
  };
  m.customProgramCacheKey = () => prevKey() + '|schnee' + (prev ? prev.toString().length : 0);
  m.needsUpdate = true;
}
// Himmelsfarben je Wetter: strahlend blau, wenn klar; grau und trüb bei Bewölkung und Regen
const SKY_CLEAR = { top: new THREE.Color('#2f86d4'), mid: new THREE.Color('#86c3ec'), hor: new THREE.Color('#d3eaf3') };
const SKY_OV = { top: new THREE.Color('#87919b'), mid: new THREE.Color('#a3abb3'), hor: new THREE.Color('#bdc3c8') };
const SKY_OVN = { top: new THREE.Color('#0c0e12'), mid: new THREE.Color('#14171c'), hor: new THREE.Color('#1d2128') };
const SKY_N = { top: new THREE.Color('#000105'), mid: new THREE.Color('#03060f') };
const skyTmp = new THREE.Color();
function applyWeatherSky() {
  const cv = weather.cover, day = 1 - sky.night, clear = smooth(.35, 0, cv), ov = smooth(.3, .95, cv);
  sky.top.lerp(SKY_CLEAR.top, clear * day * .7); sky.mid.lerp(SKY_CLEAR.mid, clear * day * .55); sky.hor.lerp(SKY_CLEAR.hor, clear * day * .4);
  sky.top.lerp(SKY_N.top, clear * sky.night * .8); sky.mid.lerp(SKY_N.mid, clear * sky.night * .6);   // klare Nacht: fast schwarz
  for (const c of ['top', 'mid', 'hor']) sky[c].lerp(skyTmp.copy(SKY_OV[c]).lerp(SKY_OVN[c], sky.night), ov * .85);
  sky.light.lerp(WHITE, ov * .5); sky.li *= 1 - .62 * ov; sky.hi *= 1 + .12 * ov;
  sky.hemiS.lerp(skyTmp.set(0xb9c0c7).lerp(SKY_OVN.mid, sky.night), ov * .6);
}
// Zeitraffer bis zur Zielstunde (Tipp auf die Uhrzeit): Tag <-> Nacht in wenigen Sekunden
let skipTo = null;
const isDaytime = h => h >= 6 && h < 20;
function toggleDayNight() {
  const toNight = skipTo !== null ? skipTo < 12 : isDaytime(S.hour); // läuft schon ein Zeitraffer, kehrt ein zweiter Tipp ihn um
  skipTo = toNight ? 21.3 : 6.6;
  toast(toNight ? 'Die Nacht bricht herein.' : 'Ein neuer Tag beginnt.', 2.2);
}
function updateDay(dt, t) {
  if (skipTo !== null) { // vorwärts bis zur Zielstunde, höchstens 3 Spielstunden pro Sekunde
    const left = (skipTo - S.hour + 24) % 24, step = Math.min(left, dt * 3);
    S.hour = (S.hour + step) % 24; if (left - step < 1e-3) { S.hour = skipTo; skipTo = null; }
  } else if (!S.timePaused) S.hour = (S.hour + dt * hourRate(S.hour)) % 24;
  const h = S.hour; updateWeather(dt, t); sampleSky(h); applyWeatherSky();
  const ts = (h - 6.2) / 13.6 * Math.PI, tm = ((h - 19.6 + 24) % 24) / 10.8 * Math.PI; // Sonne 6:12–19:48, Mond 19:36–6:24
  sunDir.set(Math.cos(ts), Math.sin(ts) * .9, .4).normalize(); moonDir.set(-Math.cos(tm), Math.sin(tm) * .8, -.3).normalize();
  const sunUp = sunDir.y >= moonDir.y, body = sunUp ? sunDir : moonDir;
  // Licht fällt nie flacher als etwa 20°, sonst werden die Schatten endlos; am Horizont blendet es aus, damit der Wechsel Sonne/Mond nicht springt
  lightDir.copy(body); lightDir.y = Math.max(lightDir.y, .35); lightDir.normalize();
  sun.position.copy(lightDir).multiplyScalar(50); sun.color.copy(sky.light); sun.intensity = sky.li * smooth(0, .12, body.y);
  hemi.color.copy(sky.hemiS); hemi.groundColor.copy(sky.hemiG); hemi.intensity = sky.hi;
  scene.fog.color.copy(sky.hor); scene.fog.near = 42 - 18 * weather.rain; scene.fog.far = 105 - 30 * weather.rain; // Regen: diesig
  skyG.position.copy(camera.position);
  visualDir(sunDir, visSun); visualDir(moonDir, visMoon);
  skyMat.uniforms.sunDir.value.copy(visSun); skyMat.uniforms.sunCol.value.copy(sky.light);
  skyMat.uniforms.glow.value = smooth(-.25, .02, sunDir.y) * (.3 + .9 * (1 - Math.max(0, sunDir.y)) ** 3);
  sunSprite.position.copy(visSun).multiplyScalar(150); sunSprite.material.color.copy(sky.light).lerp(WHITE, .5);
  sunSprite.material.opacity = smooth(-.04, .02, visSun.y) * (1 - smooth(.4, .9, weather.cover));
  moonSprite.position.copy(visMoon).multiplyScalar(150); moonHalo.position.copy(moonSprite.position);
  moonSprite.material.opacity = smooth(-.03, .03, visMoon.y) * (.3 + .7 * sky.night) * (1 - smooth(.4, .9, weather.cover)); moonHalo.material.opacity = moonSprite.material.opacity * .45;
  starMat.uniforms.op.value = smooth(.35, .95, sky.night) * (1 - smooth(.15, .7, weather.cover)) * 1.15; starMat.uniforms.t.value = t;
}
// Tagesablauf der Bewohner
const LUNCH = [12, 13.3], BED = 20.6, WAKE = 5.5;
const workTime = () => S.hour >= WAKE && S.hour < BED && !(S.hour >= LUNCH[0] && S.hour < LUNCH[1]);
const dayPhase = h => h < WAKE || h >= 21 ? 'Nachtruhe' : h < 8 ? 'Morgen' : h < 12 ? 'Vormittag' : h < 13.5 ? 'Mittagspause' : h < 18 ? 'Nachmittag' : 'Abend';

/* ------------------------------------------------------------------ terrain */
const SIZE = 64, SEG = 167, N = SEG + 1, CELL = SIZE / SEG, HALF = SIZE / 2; // Insel etwa ein Drittel größer als anfangs (48)
// Lage des Schreins: auf einem sanften Hügel nordöstlich vor dem Dorf, mit dem Gebirge dahinter.
// Der Prozessionsweg führt vom Rand des Dorfplatzes (Inselmitte) den Hügel hinauf.
var SHRINE_AT = { x: 4.4, z: -7.8 };
var SACRED_SEG = (() => { const d = Math.hypot(SHRINE_AT.x, SHRINE_AT.z), ux = SHRINE_AT.x / d, uz = SHRINE_AT.z / d; return { ax: ux * 2.95, az: uz * 2.95, bx: SHRINE_AT.x - ux * 2.2, bz: SHRINE_AT.z - uz * 2.2, ux, uz, len: d - 5.15 }; })();
// Runddorf: ein Ringweg läuft um den Dorfplatz, die Häuser stehen gleichmäßig auf einem Kreis dahinter (Tür zum Platz),
// jeder Garten liegt genau hinter seinem Haus. RING_R = Ringweg, HOUSE_R = Häuser, GARDEN_R = Gärten.
var RING_R = 3.75, HOUSE_R = 5.7, GARDEN_R = 7.25;
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
  let src = 0; for (let k = 0; k < N * N; k++) if (H[k] > H[src]) src = k;
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
const C = { deep: new THREE.Color(0xb7a06a), wet: new THREE.Color(0xc8ad74), sand: new THREE.Color(0xecd9a0), g1: new THREE.Color(0x82b047), g2: new THREE.Color(0x5a8d36),
  dry: new THREE.Color(0xa6ad52), bare: new THREE.Color(0x8f7a54), rock: new THREE.Color(0x8e8476), snow: new THREE.Color(0xf2f1ea) };
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
  if (k >= 0 && typeof STREAM !== 'undefined') { const d = STREAM.dist[k]; if (d < 1.2) { tc.lerp(tg.set(0x8d8270), smooth(.55, .25, d) * .9); tc.lerp(tg.set(0x4f8a3a), smooth(1.2, .6, d) * (1 - smooth(.5, .25, d)) * .45); tg.copy(C.g1).lerp(C.g2, jit); } }
  if (k >= 0) { // Wiese: trockene Flecken und kahle Erdstellen
    const gw = smooth(.45, .6, h) * (1 - smooth(2.5, 2.9, h));
    tc.lerp(C.dry, smooth(.05, .35, DRY[k]) * .55 * gw);
    tc.lerp(C.bare, smooth(.3, .42, BARE[k]) * .75 * gw);
  }
  tc.lerp(C.rock, smooth(2.9 + jit * .5, 3.5 + jit * .5, h));
  tc.lerp(C.snow, smooth(4.9, 5.5, h));
  return tc;
}
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
function updateTerrain(dt) { terrainT -= dt; if (!terrainDirty || terrainT > 0) return; terrainT = .12; terrainDirty = false; tGeo.computeVertexNormals(); updateHTex(); updateDepth(); }
// Wasser: Wellen und Brandung im Vertex-Shader, Kräuselung durch Wind (Böen ziehen als Flecken übers Wasser),
// Farbe nach Tiefe (türkis im Flachen, tiefblau draußen), Schaum am Strand und bei starkem Wind Schaumkronen,
// Spiegelung des Himmels am flachen Blickwinkel, Sonnenglitzern über die Lichtberechnung.
const waterU = { uT: { value: 0 }, uWind: { value: .5 }, uH: { value: hTex }, uSkyH: { value: sky.hor } };
const WATER_GLSL = `uniform float uT, uWind; uniform sampler2D uH; varying vec3 vWP;
float hAt(vec2 xz) { vec2 uv = (xz + ${HALF.toFixed(1)}) / ${SIZE.toFixed(1)} * ${((N - 1) / N).toFixed(5)} + ${(.5 / N).toFixed(5)}; return texture2D(uH, uv).r * 5. - 3.; }
vec3 waves(vec2 p, float a) {
  vec3 r = vec3(0.); vec2 d; float ph;
  d = normalize(vec2(1., .35));  ph = 1.1 * dot(d, p) - 1.3 * uT; r.x += a * sin(ph); r.yz += a * 1.1 * cos(ph) * d;
  d = normalize(vec2(-.4, 1.));  ph = 1.7 * dot(d, p) - 1.7 * uT; r.x += a * .6 * sin(ph); r.yz += a * .6 * 1.7 * cos(ph) * d;
  d = normalize(vec2(.7, -.8));  ph = 2.6 * dot(d, p) - 2.3 * uT; r.x += a * .35 * sin(ph); r.yz += a * .35 * 2.6 * cos(ph) * d;
  return r;
}
float waveAmp(float depth) { return (.02 + .05 * uWind) * smoothstep(0., .7, depth); }
` + NOISE_GLSL;
const wGeo = new THREE.PlaneGeometry(150, 150, 220, 220).rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: .1, metalness: 0 });
waterMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, waterU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WATER_GLSL)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec2 wp = (modelMatrix * vec4(transformed, 1.)).xz; float depth = max(0., -.02 - hAt(wp));
        float surge = (.015 + .045 * uWind) * sin(depth * 14. - uT * (1.7 + 1.1 * uWind)) * (1. - smoothstep(0., .7, depth)) * smoothstep(0., .04, depth); // Brandung, bei Wind höher und schneller
        transformed.y += waves(wp, waveAmp(depth)).x + surge; }
      vWP = (modelMatrix * vec4(transformed, 1.)).xyz;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkyH;\n' + WATER_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float wDepth = max(0., -.02 - hAt(vWP.xz));
      float gust = vns(vWP.xz * .07 + vec2(uT * .06, uT * .035));
      vec3 wc = mix(vec3(.25, .72, .7), vec3(.03, .22, .38), smoothstep(0., 1.8, wDepth));
      float fn = vns(vWP.xz * 3. + uT * .3), shore = 1. - smoothstep(0., .22 + .2 * uWind, wDepth); // Schaumstreifen am Ufer, bei Wind breiter
      float lines = smoothstep(.62 - .12 * uWind, .95, sin(wDepth * 40. - uT * (1.9 + 1.4 * uWind) + fn * 3.) * .5 + .5) * shore;
      float caps = smoothstep(.74, .9, vns(vWP.xz * 1.7 + uT * .45)) * smoothstep(.55, 1., uWind * (.55 + .9 * gust)) * smoothstep(.5, 1.5, wDepth);
      float foam = clamp(shore * shore * .85 + lines * .75 + caps * .8, 0., 1.);
      diffuseColor.rgb = mix(wc, vec3(.93, .97, 1.), foam);
      diffuseColor.a = mix(.5 + .42 * smoothstep(0., 1.2, wDepth), .95, foam);`)
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      { vec3 w = waves(vWP.xz, waveAmp(wDepth));
        float rip = (.4 + 1.1 * uWind) * (.45 + 1.1 * gust) * smoothstep(0., .25, wDepth); // Kräuselung, in Böen stärker
        vec2 q = vWP.xz * 5. + vec2(uT * .9, uT * .55), q2 = vWP.xz * 12. - vec2(uT * 1.3, -uT * .8); float e = .06;
        float a0 = vns(q), b0 = vns(q2);
        vec2 g = vec2(vns(q + vec2(e, 0.)) - a0, vns(q + vec2(0., e)) - a0) / e * .05 + vec2(vns(q2 + vec2(e, 0.)) - b0, vns(q2 + vec2(0., e)) - b0) / e * .025;
        vec3 wn = normalize(vec3(-w.y - g.x * rip, 1., -w.z - g.y * rip));
        normal = normalize((viewMatrix * vec4(wn, 0.)).xyz); }`)
    .replace('#include <opaque_fragment>', `{ float fres = pow(1. - max(dot(normal, normalize(vViewPosition)), 0.), 4.);
        outgoingLight = mix(outgoingLight, uSkyH, fres * .35 * (1. - foam)); }
      #include <opaque_fragment>`);
};
const water = new THREE.Mesh(wGeo, waterMat);
water.position.y = -.03; water.receiveShadow = true; water.frustumCulled = false;
scene.add(water);

// Trampelpfade: jeder Geländepunkt zählt, wie lange dort gelaufen wurde (Sekunden, gedeckelt).
// Ab etwa 6 s färbt sich das Gras zu Erde, bei 30 s ist der Pfad voll ausgetreten. Ungenutzte Pfade wachsen langsam zu.
// Später lassen sich ausgetretene Pfade mit Stein zu Straßen ausbauen (dafür ist WEAR die Grundlage).
const WEAR = new Float32Array(N * N), WEAR_MAX = 40, wearDirty = new Set();
const PATH_C = new THREE.Color(0xa88a5c), PATH_C2 = new THREE.Color(0x957548);
if (S.pathsN !== N) S.paths = []; // gespeicherte Pfade passen nur zur gleichen Rastergröße
if (Array.isArray(S.paths)) for (let i = 0; i + 1 < S.paths.length; i += 2) { const k = S.paths[i] | 0; if (k >= 0 && k < N * N) WEAR[k] = Math.min(WEAR_MAX, +S.paths[i + 1] || 0); }
function vertexColor(k) {
  const c = terrainColor(H[k], J[k], k), w = WEAR[k];
  if (w > 6 && H[k] > .15 && H[k] < 3.4) c.lerp(tg.copy(PATH_C).lerp(PATH_C2, J[k]), smooth(6, 30, w) * .92);
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
function updateWear(dt) {
  wearT += dt; if (wearT < .5) return;
  // alle halbe Sekunde: Pfade langsam zuwachsen lassen (Halbwertszeit etwa 10 Minuten) und geänderte Punkte neu färben
  const decay = Math.pow(.5, wearT / 600); wearT = 0;
  for (let k = 0; k < WEAR.length; k++) if (WEAR[k] > 0) { WEAR[k] *= decay; if (WEAR[k] < 6.5 && WEAR[k] > 4) wearDirty.add(k); if (WEAR[k] < .05) WEAR[k] = 0; }
  if (!wearDirty.size) return;
  for (const k of wearDirty) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
  wearDirty.clear(); tCol.needsUpdate = true;
}
function savePaths() { const out = []; for (let k = 0; k < WEAR.length; k++) if (WEAR[k] > 3) out.push(k, Math.round(WEAR[k])); S.paths = out; S.pathsN = N; }
for (let k = 0; k < N * N; k++) if (WEAR[k] > 6) { const c = vertexColor(k); tCol.setXYZ(k, c.r, c.g, c.b); }
tCol.needsUpdate = true;
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
  tPos.needsUpdate = true; tCol.needsUpdate = true; terrainDirty = true;
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
  tPos.needsUpdate = true; tCol.needsUpdate = true; terrainDirty = true;
}

/* ------------------------------------------------------------------ assets */
const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => loader.load('assets/models/' + f, res, undefined, e => rej(new Error(f + ' konnte nicht geladen werden'))));
$('loadSt').textContent = 'Lade Modelle …';
// Ruun kann verschiedene Gestalten annehmen (S.creature). Modelle: Quaternius Animated Animal Pack (CC0).
// h = Zielhöhe in Welteinheiten, walk/run = Geschwindigkeit, ws = Zeitfaktor der Lauf-Animation,
// rest = Liegepose aus POSES (nur Tiere mit Quaternius-AnimalArmature), hd = Fell-Modell für das Charakter-Blatt,
// react = eigene Reaktionen auf Lob und Tadel (buildReactClips).
const CREATURES = {
  fox: { label: 'Fuchs', spirit: 'Fuchsgeist', file: 'Fox', hd: 'Fox_HD', react: true, h: 1.45, walk: 1.9, run: 3.4, ws: 1.1, rest: 'paw' },
  wolf: { label: 'Wolf', spirit: 'Wolfsgeist', file: 'Wolf', h: 1.75, walk: 2, run: 3.8, ws: 1, rest: 'paw' },
  stag: { label: 'Hirsch', spirit: 'Hirschgeist', file: 'Stag', h: 3.1, walk: 2, run: 3.8, ws: .9, rest: 'hoof' },
  bull: { label: 'Stier', spirit: 'Stiergeist', file: 'Bull', h: 1.95, walk: 1.7, run: 3.4, ws: .9, rest: 'hoof' },
  alpaca: { label: 'Alpaka', spirit: 'Alpakageist', file: 'Alpaca', h: 2.5, walk: 1.8, run: 3.4, ws: 1, rest: 'hoof' },
  // Katze aus Quaternius Animal Pack Vol.2: nur Idle/Walk, keine Augen – Augen werden am Kopfknochen ergänzt
  cat: { label: 'Katze', spirit: 'Katzengeist', file: 'Cat', h: 1.35, walk: 1.9, run: 3.6, ws: 1.2, head: 'Bone003', eyes: { fwd: .265, up: .05, side: .06, r: .034, iris: 0x8fd14f } },
};
if (!CREATURES[S.creature]) S.creature = 'fox';
const files = ['building_home_A_blue.gltf', 'building_home_B_blue.gltf', 'building_well_blue.gltf', 'building_windmill_blue.gltf', 'building_scaffolding.gltf',
  'tree_single_A_cut.gltf', `animals/${CREATURES[S.creature].file}.glb`, 'hand/GodHand.glb',
  'building_home_A_red.gltf', 'building_home_A_green.gltf', 'building_lumbermill_blue.gltf', 'resource_lumber.gltf', 'crate_A_big.gltf', 'sack.gltf', 'barrel.gltf'];
const [gHomeA, gHomeB, gWell, gMill, gScaff, gStump, gCreature, gHand, gHutRed, gHutGreen, gSawmill, gLogs, gCrate, gSack, gBarrel] = await Promise.all(files.map(load));
const shadowify = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function parts(g) { const out = []; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); out.push({ geo, mat: o.material }); } }); return out; }
/* ------------------------------------------------------------------ Pflanzen und Felsen (im Code erzeugt) */
// Hilfen: Geometrie ohne Index mit einer Farbe je Dreieck (Verläufe, dunklere Unterseiten, leichte Streuung), leicht verbeult
const COL = new THREE.Color(), COL2 = new THREE.Color();
const jit = (x, y, z) => .9 + .2 * (((Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453) % 1 + 1) % 1);
function paint(geo, fn, soft = false) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  if (soft) { // weich: Normalen der Grundform behalten (rund schattiert), Farbe je Ecke
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), n.getY(i), COL); col.set([COL.r, COL.g, COL.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  g.computeVertexNormals(); const n = g.attributes.normal;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    fn(x, y, z, (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3, COL);
    for (let k = 0; k < 3; k++) col.set([COL.r, COL.g, COL.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function lumpy(geo, amt, f = 2.2, seed = Math.random() * 50) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amt * noise(x * f + seed, z * f + y * f * 1.3 - seed); p.setXYZ(i, x * k, y * k, z * k); }
  return geo;
}
// Laub: von dunkel (unten) nach hell (oben), Unterseiten im Schatten
const fol = (y0, y1, dark, light) => (x, y, z, ny, c) => { c.set(dark).lerp(COL2.set(light), clamp(smooth(y0, y1, y) * .8 + (ny > .55 ? .2 : 0), 0, 1)); c.multiplyScalar((ny < -.25 ? .6 : ny < .2 ? .82 : 1) * jit(x, y, z)); };
// Laub weich: Helligkeit folgt der Normalen stufenlos (Unterseite dunkler), leichte Streuung
const folS = (y0, y1, dark, light) => (x, y, z, ny, c) => { c.set(dark).lerp(COL2.set(light), clamp(smooth(y0, y1, y) * .75 + smooth(.2, .9, ny) * .3, 0, 1)); c.multiplyScalar((.62 + .38 * smooth(-.8, .3, ny)) * (.95 + .1 * (jit(x, y, z) - .9) * 5)); };
const CROWN_DET = isMobile ? 1 : 2; // feinere Kronen am Desktop
const bark = (h, c0, c1) => (x, y, z, ny, c) => c.set(c0).lerp(COL2.set(c1), clamp(y / h, 0, 1)).multiplyScalar(jit(x, y, z));
const trunkGeo = (h, r0, r1, c0, c1, seg = 8) => paint(new THREE.CylinderGeometry(r1, r0, h, seg, 2).translate(0, h / 2, 0), bark(h, c0, c1));
const blob = (x, y, z, r, sy = 1, amt = .25, det = 1) => lumpy(new THREE.IcosahedronGeometry(r, det), amt, 3).scale(1, sy, 1).translate(x, y, z);
// Kanten bleiben trotzdem sichtbar, wo die Normalen je Dreieck berechnet sind (Felsen, Stämme); Laub ist weich schattiert
const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
const kindOf = (name, parts) => { const geo = mergeGeometries(parts), sc = new THREE.Group(); sc.add(new THREE.Mesh(geo, plantMat)); return { name, geo, scene: sc }; };
// Baumarten (Höhe etwa 1,1 im Modellraum, wie zuvor die KayKit-Bäume)
function spruce(slim) {
  const parts = [trunkGeo(.32, .055, .035, 0x4f3420, 0x6b4a2c)], n = slim ? 5 : 4;
  for (let k = 0; k < n; k++) {
    const r = (slim ? .27 : .37) * (1 - k / (n + .7)), h = slim ? .3 : .38, y = .15 + k * (slim ? .165 : .2);
    parts.push(paint(lumpy(new THREE.ConeGeometry(r, h, isMobile ? 9 : 14, 3), .07, 4).rotateY(k * .7).translate(rnd(.015), y + h / 2, rnd(.015)), folS(.1, 1.1, slim ? 0x22503e : 0x275a2e, slim ? 0x4d8a68 : 0x579b45), true));
  }
  return parts;
}
function oak() {
  const parts = [trunkGeo(.52, .075, .045, 0x4a3322, 0x6a4a30)];
  for (const [rz, ry] of [[.8, 0], [-.7, 1.4]]) parts.push(paint(new THREE.CylinderGeometry(.018, .03, .28, 5).translate(0, .14, 0).rotateZ(rz).rotateY(ry).translate(0, .36, 0), bark(.6, 0x4a3322, 0x6a4a30)));
  for (const [x, y, z, r] of [[0, .8, 0, .3], [.2, .7, .1, .22], [-.2, .72, -.06, .23], [.04, .96, -.1, .2], [-.06, .68, .2, .2], [.12, .84, -.18, .18]])
    parts.push(paint(blob(x, y, z, r, .9, .2, CROWN_DET), folS(.5, 1.12, 0x3a7a2c, 0x8dc24f), true));
  return parts;
}
function birch() {
  const h = .78, parts = [paint(new THREE.CylinderGeometry(.027, .042, h, 6, 6).translate(0, h / 2, 0), (x, y, z, ny, c) => c.set(Math.sin(y * 52 + x * 40) > .72 ? 0x3d3832 : 0xebe7dc).multiplyScalar(jit(x, y, z)))];
  for (const [x, y, z, r, sy] of [[0, .88, 0, .16, 1.5], [.1, .72, .05, .13, 1.3], [-.09, .78, -.05, .14, 1.4], [0, 1.02, .03, .11, 1.3]])
    parts.push(paint(blob(x, y, z, r, sy, .18, CROWN_DET), folS(.55, 1.15, 0x5f9a35, 0xb8da6c), true));
  return parts;
}
function fruit() {
  const parts = [trunkGeo(.36, .065, .045, 0x4e3524, 0x6e4c32)];
  for (const [x, y, z, r, sy] of [[0, .63, 0, .33, .8], [.18, .56, .1, .2, 1], [-.17, .6, -.08, .21, 1]]) parts.push(paint(blob(x, y, z, r, sy, .18, CROWN_DET), folS(.35, .9, 0x3f7f30, 0x86bd4c), true));
  for (let k = 0; k < 11; k++) { // Äpfel rundum, eher in der unteren Hälfte der Krone
    const a = k / 11 * Math.PI * 2 + rnd(.3), e = -.5 + Math.random() * .8, x = Math.cos(a) * Math.cos(e) * .35, y = .63 + Math.sin(e) * .28, z = Math.sin(a) * Math.cos(e) * .35;
    const red = Math.random() < .75; parts.push(paint(new THREE.IcosahedronGeometry(.036, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(red ? 0xc8322a : 0xe2a12f).lerp(COL2.set(0xffffff), ny > .6 ? .2 : 0)));
  }
  return parts;
}
const TK = [kindOf('Fichte', spruce(false)), kindOf('Tanne', spruce(true)), kindOf('Laubbaum', oak()), kindOf('Birke', birch()), kindOf('Obstbaum', fruit())];
const TREE_FOREST = [0, 1, 2]; // Arten, unter denen Farne wachsen
// Baumart je Ort: Nadelwald in der Höhe und in dunklen Hainen, Birkenhaine, sonst Laubwald; Obstbäume selten und nahe am Dorf
function treeKindAt(x, z) {
  const h = heightAt(x, z), n = noise(x * .09 + 40, z * .09 - 7), d = Math.hypot(x, z);
  if (d < 13.5 && Math.random() < .09) return 4;
  if (h > 1.9 || n > .25) return Math.random() < .6 ? 0 : 1;
  if (n < -.28) return Math.random() < .6 ? 3 : 2;
  return Math.random() < .7 ? 2 : Math.random() < .5 ? 0 : 3;
}
// Felsen: verbeulte, flach gedrückte Körper, grau mit hellerer Oberseite und Moos auf flachen Stellen
const rockGeo = (seed, det = 1) => paint(lumpy(new THREE.IcosahedronGeometry(1, det), .32, 1.4, seed).scale(1, .62, 1), (x, y, z, ny, c) => {
  c.set(0x76706a).lerp(COL2.set(0xa29c90), smooth(-.3, .6, y));
  if (ny > .8 && noise(x * 3 + seed, z * 3) > .05) c.lerp(COL2.set(0x5f7d3c), .4);
  c.multiplyScalar((ny < -.2 ? .7 : 1) * jit(x, y, z));
});
const ROCK_GEOS = [3, 17, 29, 41].map(sd => rockGeo(sd));
// Büsche: drei Sorten (schlicht, blühend, mit Beeren)
function bushGeo(v) {
  const parts = [], n = 4 + v;
  for (let k = 0; k < n; k++) parts.push(paint(blob(rnd(.13), .1 + Math.random() * .1, rnd(.13), .11 + Math.random() * .06, .85, .22, 1), folS(0, .32, v === 2 ? 0x2a5c27 : 0x2f6a2a, v === 2 ? 0x5e9443 : 0x6fa648), true));
  if (v) for (let k = 0; k < 12; k++) {
    const a = Math.random() * 6.28, e = Math.random() * 1.2, x = Math.cos(a) * Math.cos(e) * .2, y = .14 + Math.sin(e) * .14, z = Math.sin(a) * Math.cos(e) * .2;
    const c0 = v === 1 ? (k % 3 ? 0xf2a5c6 : 0xffffff) : (k % 2 ? 0xc0302b : 0x3b3f8f);
    parts.push(paint(new THREE.IcosahedronGeometry(v === 1 ? .022 : .018, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(c0)));
  }
  return mergeGeometries(parts);
}
const BUSH_GEOS = [0, 1, 2].map(bushGeo);
class Swarm {
  constructor(p, cap) { this.meshes = p.map(({ geo, mat }) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; }); }
  set(i, mat) { for (const m of this.meshes) m.setMatrixAt(i, mat); }
  commit(n) { for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; } }
}

/* ------------------------------------------------------------------ village */
const SB = 1.5, ST = 1.25;
const statics = [];
function place(gltf, x, z, ry = 0, s = SB) { const o = shadowify(gltf.scene.clone(true)); o.scale.setScalar(s); o.rotation.y = ry; scene.add(o); const e = { o, x, z }; statics.push(e); return e; }
// Dorfplatz in der Inselmitte (Dorflinde, Brunnen), Lager am Platz; der Schrein liegt auf dem Hügel (SHRINE_AT)
const SHRINE_POS = SHRINE_AT, PLAZA = { x: 0, z: 0, r: 2.95 }, LAGER = { x: 4.7, z: 1.4 }, WELL = { x: -2.05, z: 1.55 }, MILL_POS = { x: -10, z: 1.2 };
const SHRINE_ROT = Math.atan2(-SHRINE_POS.x, -SHRINE_POS.z); // Vorderseite (+z) zeigt zum Dorf
const shrinePt = (lx, lz) => ({ x: SHRINE_POS.x + lx * Math.cos(SHRINE_ROT) + lz * Math.sin(SHRINE_ROT), z: SHRINE_POS.z - lx * Math.sin(SHRINE_ROT) + lz * Math.cos(SHRINE_ROT) });
const PRAY = shrinePt(0, 2.5), CENTER = { x: -1.4, z: -3.6 };
const onSacred = (x, z, m = 0) => sacredDist(x, z) < .6 + m;
const LUNCH_AT = PLAZA; // Mittagspause im Schatten der Dorflinde
// Schrein des Weltenkeims, das Herz der Insel: dreistufiger Sockel mit Goldkanten, sechs Runensteine mit Blumengirlanden,
// Säule mit goldener Schale, darüber schwebt der leuchtende Keim mit einem Spross, umkreist von Lichtringen.
// Davor Opfergaben und Kerzen, dahinter zwei Banner. Jede Weihestufe (S.temple) lässt eine weitere Rune aufleuchten.
const staticLights = []; // { x, y, z, s } Lichter, die nachts einen Schein werfen (Kerzen, Feuerschalen, Laternen)
const shrine = (() => {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, flatShading: true }, o));
  const stoneL = M(0xd8d1c1), stone = M(0xbdb6a6), stoneD = M(0x8f897e), wood = M(0x5e3d24), cloth = M(0x2d4f8f, { side: THREE.DoubleSide });
  const gold = M(0xdcb24c, { metalness: .3, roughness: .35, emissive: 0x4a3608, emissiveIntensity: .7 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false });
  const add = (geo, m, x = 0, y = 0, z = 0, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
  const hex = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 6).rotateY(Math.PI / 6); // flache Seite nach vorn
  // drei Stufen mit Goldkante, Treppenstufen nach vorn
  for (const [r0, r1, y, m] of [[1.5, 1.6, 0, stoneL], [1.08, 1.16, .15, stone], [.68, .74, .3, stoneL]]) {
    add(hex(r0, r1, .15), m, 0, y + .075); add(new THREE.CylinderGeometry(r0 + .012, r0 + .012, .035, 6, 1, true).rotateY(Math.PI / 6), gold, 0, y + .135); // Goldkante nur am Rand
    add(new THREE.BoxGeometry(.8, .075, .18), m, 0, y + .0375, r1 * .866 + .07);
  }
  // Säule mit Goldbändern und Schale
  add(new THREE.CylinderGeometry(.15, .21, .52, 8), stoneL, 0, .45 + .26);
  for (const y of [.52, .9]) add(new THREE.CylinderGeometry(.19, .19, .035, 8), gold, 0, y);
  add(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.14, 0), new THREE.Vector2(.3, .1), new THREE.Vector2(.36, .19), new THREE.Vector2(.33, .2)], 12), gold, 0, .96);
  // Runensteine
  const runeOff = M(0x4a5b66, { roughness: .6 }), runeOn = M(0x9fdcff, { emissive: 0x4fb4ff, emissiveIntensity: 1.6, roughness: .4 });
  const runes = [], tops = [];
  for (let k = 0; k < 6; k++) {
    const a = (k + .5) / 6 * Math.PI * 2, R = 1.3, h = .62 + (k % 2) * .08, m = new THREE.Group();
    m.position.set(Math.sin(a) * R, .15, Math.cos(a) * R); m.rotation.set(rnd(.05), a, rnd(.05)); g.add(m);
    m.add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .14, h, 4, 1).translate(0, h / 2, 0), stoneD));
    add(new THREE.ConeGeometry(.085, .09, 4), gold, 0, h + .04, 0, m);
    const rg = mergeGeometries([new THREE.BoxGeometry(.035, .23, .02), new THREE.BoxGeometry(.025, .1, .02).rotateZ(.7).translate(.035, .06, 0), new THREE.BoxGeometry(.025, .1, .02).rotateZ(-.7).translate(-.035, .06, 0)]);
    const r = new THREE.Mesh(rg.translate(0, h * .5, 0), runeOff); r.position.z = .105; r.rotation.x = -.085; m.add(r); runes.push(r);
    tops.push(new THREE.Vector3(Math.sin(a) * R, .15 + h - .06, Math.cos(a) * R));
  }
  // Blumengirlanden zwischen den Runensteinen (durchhängend, bunte Blüten mit Blättern)
  const FL = [0xf6f3e8, 0xf2cf3a, 0xec86ad, 0x9c82dc, 0xdc4a3c], gp = [];
  for (let k = 0; k < 6; k++) {
    const A = tops[k], B = tops[(k + 1) % 6];
    for (let i = 1; i < 10; i++) {
      const u = i / 10, x = A.x + (B.x - A.x) * u, z = A.z + (B.z - A.z) * u, y = A.y + (B.y - A.y) * u - Math.sin(u * Math.PI) * .2;
      gp.push(paint(new THREE.IcosahedronGeometry(i % 2 ? .034 : .026, 0).translate(x, y, z), (px, py, pz, ny, c) => c.set(i % 2 ? FL[(k + i) % 5] : 0x4f8d3a)));
    }
  }
  add(mergeGeometries(gp), plantMat);
  // Opfergaben: Blumensträuße und Kerzen auf der zweiten Stufe
  for (const [x, z, sc] of [[-.62, .62, .42], [.62, .62, .42], [-.9, -.2, .36], [.9, -.2, .36]]) { const b = add(BUSH_GEOS[1], plantMat, x, .3, z); b.scale.setScalar(sc); }
  const flames = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 6 - .5) * 1.7, x = Math.sin(a) * .9, z = Math.cos(a) * .9, h = .07 + (k % 3) * .03;
    add(new THREE.CylinderGeometry(.022, .024, h, 6), M(0xf3ead6), x, .3 + h / 2, z);
    const f = add(new THREE.ConeGeometry(.018, .05, 5), flameM, x, .3 + h + .03, z); flames.push(f);
    staticLights.push({ x, y: .3 + h + .03, z, s: .2, local: true });
  }
  // zwei Banner hinter dem Schrein
  const banners = [];
  for (const sx of [-1, 1]) {
    const px = sx * 1.05, pz = -1.55;
    add(new THREE.CylinderGeometry(.025, .03, 1.75, 6), wood, px, .875, pz); add(new THREE.SphereGeometry(.05, 8, 6), gold, px, 1.78, pz);
    add(new THREE.BoxGeometry(.42, .03, .03), wood, px, 1.62, pz);
    const bg = paint(new THREE.PlaneGeometry(.36, .78, 2, 6).translate(0, -.39, 0), (x, y, z, ny, c) => c.set(Math.abs(x) > .14 || y < -.72 ? 0xdcb24c : y > -.5 && y < -.32 && Math.abs(x) < .06 ? 0xffe7a8 : 0x2d4f8f));
    const b = add(bg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9, flatShading: true }), px, 1.6, pz + .03); banners.push(b);
  }
  // der Keim: schwebt über der Schale, ein Spross bricht aus ihm hervor, zwei Lichtringe kreisen
  const core = new THREE.Group(); core.position.y = 1.55; g.add(core);
  const seed = add(new THREE.IcosahedronGeometry(.15, 0).scale(1, 1.35, 1), M(0xffe7a8, { emissive: 0xffb83d, emissiveIntensity: 1.1, roughness: .3 }), 0, 0, 0, core);
  const sproutM = M(0x9be06a, { emissive: 0x3f8a1e, emissiveIntensity: .6 });
  const sprout = new THREE.Group(); sprout.position.y = .17; core.add(sprout);
  add(new THREE.CylinderGeometry(.012, .016, .2, 5).translate(0, .1, 0), sproutM, 0, 0, 0, sprout);
  for (const sx of [-1, 1]) { const l = add(new THREE.SphereGeometry(.06, 6, 4).scale(1.4, .25, .7).translate(sx * .07, 0, 0), sproutM, 0, .19, 0, sprout); l.rotation.z = sx * -.45; }
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rings = [add(new THREE.TorusGeometry(.34, .011, 6, 48), ringM, 0, 0, 0, core), add(new THREE.TorusGeometry(.46, .008, 6, 56), ringM, 0, 0, 0, core)];
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc870, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 }));
  halo.scale.setScalar(1.3); core.add(halo);
  // Lichtpollen steigen aus der Schale auf
  const POL = 26, polGeo = new THREE.BufferGeometry(), polPos = new Float32Array(POL * 3), pol = [];
  for (let i = 0; i < POL; i++) pol.push({ a: Math.random() * 6.28, t: Math.random(), r: .1 + Math.random() * .25, sp: .25 + Math.random() * .25 });
  polGeo.setAttribute('position', new THREE.BufferAttribute(polPos, 3));
  const pollen = new THREE.Points(polGeo, new THREE.PointsMaterial({ color: 0xffe08a, size: .07, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex, toneMapped: false }));
  pollen.frustumCulled = false; g.add(pollen);
  g.traverse(o => { if (o.isMesh && o.material !== ringM && o.material !== flameM) { o.castShadow = true; o.receiveShadow = true; } });
  g.rotation.y = SHRINE_ROT; scene.add(g); statics.push({ o: g, x: SHRINE_POS.x, z: SHRINE_POS.z });
  staticLights.push({ x: 0, y: 1.55, z: 0, s: 4, local: true, gold: true });
  for (const L of staticLights) if (L.local) { const w = shrinePt(L.x, L.z); L.x = w.x; L.z = w.z; } // Schreinlichter in Weltkoordinaten
  return { g, seed, halo, runes, runeOn, runeOff, pulse: 0, core, sprout, rings, flames, banners, pol, polPos, pollen };
})();
// Prozessionsweg: Steinplatten, Steinlaternen zu beiden Seiten, Feuerschalen am Platz, Torbogen am Dorfrand
const sacredProps = (() => {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, flatShading: true }, o));
  const stoneD = M(0x9a9385), wood = M(0x6b3e26), gold = M(0xdcb24c, { metalness: .3, roughness: .35, emissive: 0x4a3608, emissiveIntensity: .7 });
  const glass = new THREE.MeshBasicMaterial({ color: 0xffd78a, toneMapped: false }), flameM = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
  // Steinplatten: auf dem Weg, rund um den Schrein und als Pflaster des Dorfplatzes
  const G = SACRED_SEG, px = -G.uz, pz = G.ux, rot = Math.atan2(G.ux, G.uz), at = (s0, u) => ({ x: G.ax + G.ux * s0 + px * u, z: G.az + G.uz * s0 + pz * u });
  const slabs = [];
  for (let s0 = .1; s0 < G.len + .05; s0 += .3) for (let u = -.45 + ((Math.round(s0 / .3) % 2) ? .07 : 0); u < .5; u += .3) { const q = at(s0, u); slabs.push({ x: q.x + rnd(.02), z: q.z + rnd(.02), r: rot + rnd(.12), s: .9 + Math.random() * .2 }); }
  const ring = (cx, cz, r0, r1) => { for (let r = r0; r < r1; r += .3) { const n = Math.round(r * Math.PI * 2 / .3); for (let k = 0; k < n; k++) { const a = (k + (Math.round(r / .3) % 2 ? .5 : 0)) / n * Math.PI * 2; slabs.push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, r: a + rnd(.1), s: .9 + Math.random() * .2 }); } } };
  ring(SHRINE_POS.x, SHRINE_POS.z, 1.72, 2.3); ring(PLAZA.x, PLAZA.z, .95, PLAZA.r);
  const slabGeo = paint(new THREE.BoxGeometry(.27, .05, .25, 1, 1, 1), (x, y, z, ny, c) => c.set(0xcfc8b8).multiplyScalar(ny > .5 ? 1 : .8));
  const slabMesh = new THREE.InstancedMesh(slabGeo, plantMat, slabs.length); slabMesh.receiveShadow = true; slabMesh.frustumCulled = false; scene.add(slabMesh);
  slabs.forEach((sl, i) => slabMesh.setColorAt(i, COL.setScalar(.85 + Math.random() * .22)));
  const group = (x, z, ry = rot) => { const o = new THREE.Group(); o.rotation.y = ry; scene.add(o); statics.push({ o, x, z }); return o; };
  const obstacles = []; // für die Wegfindung
  const add = (par, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = m !== glass && m !== flameM; par.add(o); return o; };
  // Steinlaternen
  for (const s0 of [.7, G.len * .5, G.len - .5]) for (const sx of [-1, 1]) {
    const { x, z } = at(s0, sx * .88), o = group(x, z); obstacles.push({ x, z, r: .14 });
    add(o, new THREE.BoxGeometry(.2, .06, .2), stoneD, 0, .03); add(o, new THREE.BoxGeometry(.09, .38, .09), stoneD, 0, .25);
    add(o, new THREE.BoxGeometry(.19, .16, .19), stoneD, 0, .52); add(o, new THREE.BoxGeometry(.12, .1, .2), glass, 0, .52); add(o, new THREE.BoxGeometry(.2, .1, .12), glass, 0, .52);
    add(o, new THREE.ConeGeometry(.17, .14, 4).rotateY(Math.PI / 4), stoneD, 0, .67);
    staticLights.push({ x, z, y: .52, s: .5 });
  }
  // Feuerschalen am Platz
  const fires = [];
  for (const sx of [-1, 1]) {
    const { x, z } = at(G.len - .1, sx * 1.25), o = group(x, z); obstacles.push({ x, z, r: .22 });
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = add(o, new THREE.CylinderGeometry(.018, .022, .5, 5), wood, Math.sin(a) * .1, .25, Math.cos(a) * .1); leg.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25); }
    add(o, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.08, 0), new THREE.Vector2(.18, .08), new THREE.Vector2(.2, .13)], 10), gold, 0, .48);
    const f1 = add(o, new THREE.ConeGeometry(.12, .3, 7), flameM, 0, .7), f2 = add(o, new THREE.ConeGeometry(.07, .22, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0, toneMapped: false }), 0, .66);
    fires.push(f1, f2); staticLights.push({ x, z, y: .7, s: 1.1, fire: true });
  }
  // Torbogen am Beginn des Wegs, mit Girlande und goldener Tafel
  { const { x: ox, z } = at(.15, 0), o = group(ox, z, rot + Math.PI); for (const sx of [-1, 1]) { const q = at(.15, sx * .8); obstacles.push({ x: q.x, z: q.z, r: .12 }); }
    for (const sx of [-1, 1]) { add(o, new THREE.CylinderGeometry(.06, .075, 1.4, 7), wood, sx * .8, .7); add(o, new THREE.CylinderGeometry(.1, .1, .08, 7), stoneD, sx * .8, .04); }
    add(o, new THREE.BoxGeometry(2.05, .09, .15), wood, 0, 1.43); add(o, new THREE.BoxGeometry(1.75, .07, .09), wood, 0, 1.16);
    for (const sx of [-1, 1]) { const tip = add(o, new THREE.BoxGeometry(.3, .07, .15), wood, sx * 1.12, 1.47); tip.rotation.z = sx * .35; }
    add(o, new THREE.BoxGeometry(.3, .2, .03), gold, 0, 1.29, .05);
    const gp = []; for (let i = 1; i < 14; i++) { const u = i / 14, x = -.75 + 1.5 * u, y = 1.1 - Math.sin(u * Math.PI) * .22; gp.push(paint(new THREE.IcosahedronGeometry(i % 2 ? .035 : .027, 0).translate(x, y, .05), (px, py, pz, ny, c) => c.set(i % 2 ? [0xf6f3e8, 0xf2cf3a, 0xec86ad][i % 3] : 0x4f8d3a))); }
    add(o, mergeGeometries(gp), plantMat);
    staticLights.push({ x: ox, z, y: 1.05, s: .3 });
  }
  for (const sx of [-1, 1]) { const q = shrinePt(sx * 1.05, -1.55); obstacles.push({ x: q.x, z: q.z, r: .08 }); } // Bannerstangen
  // Dorflinde in der Mitte des Platzes, mit runder Bank um den Stamm
  const tree = place(TK[2], PLAZA.x, PLAZA.z, .7, ST * 2.3);
  { const o = group(PLAZA.x, PLAZA.z, 0);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = add(o, new THREE.BoxGeometry(.3, .04, .14), wood, Math.sin(a) * .5, .17, Math.cos(a) * .5); b.rotation.y = a; if (k % 2 === 0) add(o, new THREE.BoxGeometry(.04, .17, .04), wood, Math.sin(a) * .5, .085, Math.cos(a) * .5); } }
  obstacles.push({ x: PLAZA.x, z: PLAZA.z, r: .62 });
  return { slabs, slabMesh, fires, obstacles, tree };
})();
// Glaubensfunken: steigen beim Gebet vom Bewohner zum Keim auf
const MOTE_N = 40, moteMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.04, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }), MOTE_N);
moteMesh.frustumCulled = false; moteMesh.count = 0; scene.add(moteMesh);
const motes = [], moteV = new THREE.Vector3();
function spawnMote(x, y, z) { if (motes.length >= MOTE_N) motes.shift(); motes.push({ a: new THREE.Vector3(x, y, z), t: 0, side: rnd(1) }); }
const doorP = {};
function updateLights(t) {
  const k = smooth(.2, .7, sky.night);
  haloMesh.material.opacity = k * .55; poolMesh.material.opacity = k * .7;
  const fl = 1 + Math.sin(t * 7.3) * .04 + Math.sin(t * 13.1) * .03; // Kerzenflackern
  for (const m of houseMats.values()) m.emissiveIntensity = k * 2.4 * fl;
  let n = 0, p = 0;
  if (k > 0) {
    for (const l of lights) {
      dummy.position.set(l.x, l.y, l.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(.42 * fl); dummy.updateMatrix(); haloMesh.setMatrixAt(n++, dummy.matrix);
      dummy.position.set(l.x, surfaceAt(l.x, l.z) + .02, l.z); dummy.quaternion.identity(); dummy.scale.setScalar(1.5); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
    for (const L of staticLights) {
      const gy = heightAt(L.x, L.z), y = L.local ? shrine.g.position.y + L.y : gy + L.y;
      if (!L.gold) { dummy.position.set(L.x, y, L.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(L.s * (L.fire ? 1.4 : 1) * fl); dummy.updateMatrix(); haloMesh.setMatrixAt(n++, dummy.matrix); }
      dummy.position.set(L.x, gy + .02, L.z); dummy.quaternion.identity(); dummy.scale.setScalar((L.gold ? 5.2 : L.s * 2.6 + .4) * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
    for (const hs of huts) { const d = hutDoor(hs, .45); dummy.position.set(d.x, heightAt(d.x, d.z) + .02, d.z); dummy.quaternion.identity(); dummy.scale.setScalar(2.2 * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix); }
    for (const hs of houses) {
      houseDoor(hs, .45, doorP); dummy.position.set(doorP.x, heightAt(doorP.x, doorP.z) + .02, doorP.z); dummy.quaternion.identity(); dummy.scale.setScalar(2.4 * fl); dummy.updateMatrix(); poolMesh.setMatrixAt(p++, dummy.matrix);
    }
  }
  haloMesh.count = n; poolMesh.count = p; haloMesh.instanceMatrix.needsUpdate = poolMesh.instanceMatrix.needsUpdate = true;
}
let slabT = 0;
function updateShrine(dt, t) {
  const S0 = shrine, top = S0.g.position.y + 1.55, lit = Math.min(6, S.temple);
  S0.runes.forEach((r, k) => { r.material = k < lit ? S0.runeOn : S0.runeOff; });
  S0.pulse = Math.max(0, S0.pulse - dt * 1.5);
  // der Keim schwebt, der Spross wiegt sich, die Lichtringe kreisen
  S0.core.position.y = 1.55 + Math.sin(t * 1.6) * .05; S0.seed.rotation.y = t * .6; S0.sprout.rotation.set(Math.sin(t * 1.3) * .12, t * .6, Math.sin(t * 1.7) * .1);
  S0.seed.material.emissiveIntensity = 1.1 + S0.pulse * 1.4 + Math.sin(t * 2.3) * .1;
  S0.rings[0].rotation.set(1.2 + Math.sin(t * .7) * .2, t * .9, 0); S0.rings[1].rotation.set(.4, -t * .6, .6 + Math.sin(t * .5) * .3);
  S0.rings.forEach(r => r.scale.setScalar(1 + S0.pulse * .25)); S0.rings[0].material.opacity = .55 + S0.pulse * .4;
  S0.halo.scale.setScalar(1.3 + S0.pulse * .6 + Math.sin(t * 2.3) * .05);
  S0.flames.forEach((f, k) => f.scale.set(1, .8 + Math.sin(t * 13 + k * 2.1) * .2 + Math.sin(t * 23 + k) * .1, 1));
  sacredProps.fires.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 9 + k) * .08, .85 + Math.sin(t * 11 + k * 1.7) * .15 + Math.sin(t * 19 + k) * .08, 1 + Math.cos(t * 8 + k) * .08); f.rotation.y = t * 2 + k; });
  S0.banners.forEach((b, k) => { b.rotation.set(Math.sin(t * 1.4 + k) * .08, Math.sin(t * .9 + k * 2) * .15, 0); });
  // Lichtpollen steigen in Spiralen auf
  S0.pol.forEach((q, i) => { q.t += dt * q.sp; if (q.t > 1) { q.t = 0; q.a = Math.random() * 6.28; } const a = q.a + q.t * 4, r = q.r * (1 - q.t * .5); S0.polPos.set([Math.cos(a) * r, 1.05 + q.t * 1.3, Math.sin(a) * r], i * 3); });
  S0.pollen.geometry.attributes.position.needsUpdate = true; S0.pollen.material.opacity = .5 + .4 * Math.sin(t * 1.3) ** 2;
  // Steinplatten folgen dem Gelände
  slabT -= dt; if (slabT <= 0) { slabT = .5; const P = sacredProps; P.slabs.forEach((sl, i) => { dummy.position.set(sl.x, heightAt(sl.x, sl.z) + .005, sl.z); dummy.rotation.set(0, sl.r, 0); dummy.scale.set(sl.s, 1, sl.s); dummy.updateMatrix(); P.slabMesh.setMatrixAt(i, dummy.matrix); }); P.slabMesh.instanceMatrix.needsUpdate = true; }
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i]; m.t += dt / 1.1;
    if (m.t >= 1) { motes.splice(i, 1); S0.pulse = Math.min(1, S0.pulse + .35); continue; }
  }
  motes.forEach((m, i) => {
    const k = m.t, e = k * k * (3 - 2 * k), dx = SHRINE_POS.x - m.a.x, dz = SHRINE_POS.z - m.a.z;
    // Bogen nach oben, leicht seitlich geschwungen
    moteV.set(m.a.x + dx * e + dz * m.side * .25 * Math.sin(k * Math.PI), m.a.y + (top - m.a.y) * e + Math.sin(k * Math.PI) * .45, m.a.z + dz * e - dx * m.side * .25 * Math.sin(k * Math.PI));
    dummy.position.copy(moteV); dummy.rotation.set(t * 3, t * 4, 0); dummy.scale.setScalar(1 - k * .5); dummy.updateMatrix(); moteMesh.setMatrixAt(i, dummy.matrix);
  });
  moteMesh.count = motes.length; moteMesh.instanceMatrix.needsUpdate = true;
}
// Gebet: knien, Arme zum Himmel heben (Funke steigt auf), tief verbeugen, aufrichten
const PRAY_T = 1.7;
function prayPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .35) { const e = sm(p / .35); return { arm: -1.2 - 1.65 * e, splay: .1 + .35 * e, tilt: -.18 * e }; }
  if (p < .5) return { arm: -2.85, splay: .45, tilt: -.18 };
  if (p < .75) { const e = sm((p - .5) / .25); return { arm: -2.85 + .95 * e, splay: .45 - .3 * e, tilt: -.18 + .93 * e }; }
  const e = sm((p - .75) / .25); return { arm: -1.9 + .7 * e, splay: .15 - .05 * e, tilt: .75 * (1 - e) };
}
place(gWell, WELL.x, WELL.z, 0.4, 1.3);
flattenAt(MILL_POS.x, MILL_POS.z, 1.8);
const mill = place(gMill, MILL_POS.x, MILL_POS.z, Math.atan2(-MILL_POS.x, -MILL_POS.z), 1.6); // Windmühle draußen am Feldrand
let millFan = null; mill.o.traverse(o => { if (/fan/i.test(o.name)) millFan = o; });

const sites = [];
// 20 Plätze im Abstand von 18° auf dem Hauskreis; Schreinweg und Lager bleiben frei. Gebaut wird von Süden (Kameraseite)
// aus abwechselnd nach beiden Seiten, so wächst das Dorf gleichmäßig um den Platz.
for (let k = 0; k < 20; k++) {
  const a = (k + .5) / 20 * Math.PI * 2, x = Math.cos(a) * HOUSE_R, z = Math.sin(a) * HOUSE_R, h = heightAt(x, z);
  if (h < .3 || streamDist(x, z) < 2 || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 4.6 || Math.hypot(x - LAGER.x, z - LAGER.z) < 3 || onSacred(x, z, 1.1)) continue;
  sites.push({ x, z, ry: Math.atan2(-x, -z), a, used: false }); // Tür (+z des Modells) zum Platz
}
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
sites.sort((p, q) => angDist(p.a, Math.PI / 2) - angDist(q.a, Math.PI / 2));
const houses = [];
// Nachts leuchten die Fenster: die Scheiben liegen im Texturatlas (8×4 Felder) in Spalte 6, Zeile 1
const winMask = (() => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 4; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 8, 4); g.fillStyle = '#fff'; g.fillRect(6, 1, 1, 1);
  const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; return t; })();
const houseMats = new Map();
const houseMat = m => { if (!houseMats.has(m)) { const c = m.clone(); c.emissive = new THREE.Color(0xffa94d); c.emissiveMap = winMask; c.emissiveIntensity = 0; houseMats.set(m, c); } return houseMats.get(m); };
// Tür (im Modell bei z = .32, Haus B etwas seitlich) in Weltkoordinaten, d = Abstand davor
function houseDoor(hs, d = .25, out = {}) {
  const lx = (hs.b ? .14 : 0) * SB, lz = .32 * SB + d, ry = hs.o.rotation.y;
  out.x = hs.x + lx * Math.cos(ry) + lz * Math.sin(ry); out.z = hs.z - lx * Math.sin(ry) + lz * Math.cos(ry); return out;
}
function freeSite() { return sites.find(s => !s.used && heightAt(s.x, s.z) > 0.25); }
// Was als Nächstes gebaut wird: zuerst Hütten für zugewiesene Spezialisten ohne Platz, dann Wohnhäuser
function nextBuild() {
  const want = wantRoles();
  for (const r in ROLES) if (want[r] > hutCap(r)) { const site = hutSite(r); if (site) return { role: r, label: ROLES[r].hut, cost: ROLES[r].cost(S.huts[r]), site }; }
  if (4 + 3 * houses.length >= MAX_POP) return null; // genug Häuser für die Höchstzahl an Bewohnern
  const site = freeSite(); return site ? { role: null, label: 'Haus', cost: houseCost(), site } : null;
}
// Hausgarten: Holzzaun, dunkle Beete mit Kohl, Möhren und Tomaten (eine Geometrie für alle Gärten)
const gardenGeo = (() => {
  const parts = [], W = 1.1, D = .74, woodC = 0x8a5f3a, B = (w, h, d, x, y, z, c) => parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), (px, py, pz, ny, cc) => cc.set(c).multiplyScalar(ny > .5 ? 1 : .82)));
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-D / 2, D / 2]) B(.035, .2, .035, x, .1, z, woodC);
  for (const z of [-D / 2, D / 2]) for (const y of [.08, .16]) B(W, .022, .018, 0, y, z, woodC);
  for (const x of [-W / 2, W / 2]) { B(.035, .2, .035, x, .1, 0, woodC); for (const y of [.08, .16]) B(.018, .022, D, x, y, 0, woodC); }
  B(W - .1, .04, D - .1, 0, .02, 0, 0x5c4330);
  for (let k = 0; k < 6; k++) { // Kohl
    const x = -.42 + k * .17; parts.push(paint(new THREE.IcosahedronGeometry(.055, 1).scale(1, .75, 1).translate(x, .07, -.2), (px, py, pz, ny, c) => c.set(0x77a84f).lerp(COL2.set(0xb7d98a), smooth(.03, .1, py) * .6)));
  }
  for (let k = 0; k < 8; k++) { const x = -.44 + k * .125; parts.push(paint(new THREE.ConeGeometry(.025, .09, 4).translate(x, .085, 0), (px, py, pz, ny, c) => c.set(0x4f9a3a))); parts.push(paint(new THREE.ConeGeometry(.015, .03, 4).rotateX(Math.PI).translate(x, .05, 0), (px, py, pz, ny, c) => c.set(0xe2802c))); }
  for (let k = 0; k < 5; k++) { // Tomatenstauden
    const x = -.38 + k * .19; parts.push(paint(new THREE.IcosahedronGeometry(.06, 0).scale(.8, 1.3, .8).translate(x, .1, .2), (px, py, pz, ny, c) => c.set(0x3f7f2e)));
    for (const [dx, dy] of [[.04, .1], [-.03, .14], [.01, .06]]) parts.push(paint(new THREE.IcosahedronGeometry(.017, 0).translate(x + dx, dy, .24), (px, py, pz, ny, c) => c.set(0xd8352a)));
  }
  return mergeGeometries(parts);
})();
function addHouse(site) {
  site.used = true; const b = houses.length % 2, h = place(b ? gHomeB : gHomeA, site.x, site.z, site.ry, SB); h.b = b;
  h.o.traverse(o => { if (o.isMesh) o.material = houseMat(o.material); });
  const back = GARDEN_R - HOUSE_R, gx = site.x - Math.sin(site.ry) * back, gz = site.z - Math.cos(site.ry) * back; // hinter dem Haus, nach außen
  if (heightAt(gx, gz) > .3 && !onSacred(gx, gz, .9) && Math.hypot(gx - SHRINE_POS.x, gz - SHRINE_POS.z) > 4) { const o = new THREE.Mesh(gardenGeo, plantMat); o.rotation.y = site.ry; o.castShadow = o.receiveShadow = true; scene.add(o); statics.push({ o, x: gx, z: gz }); h.garden = { x: gx, z: gz, ry: site.ry }; }
  houses.push(h); return h;
}
for (let i = 0; i < S.houses; i++) { const s = freeSite(); if (s) addHouse(s); }
S.houses = houses.length;
let construction = null;
const scaff = place(gScaff, 0, 0, 0, 0.95); scaff.o.visible = false;

/* ------------------------------------------------------------------ Lager und Werkstätten */
// Punkt im Modellraum (Einheiten des Modells) eines platzierten Gebäudes in Weltkoordinaten
function localPt(e, lx, lz, out = {}) { const k = e.o.scale.x, ry = e.o.rotation.y, x = lx * k, z = lz * k; out.x = e.x + x * Math.cos(ry) + z * Math.sin(ry); out.z = e.z - x * Math.sin(ry) + z * Math.cos(ry); return out; }
// Großes zentrales Lager: offene Halle; draußen wachsen Stammstapel und Bretterstapel mit dem Bestand
const lager = (() => {
  const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true });
  const stone = mat(0xa29c90), wood = mat(0x8a5a33), wood2 = mat(0x6e4526), roof = mat(0x3f6db3), plank = mat(0xd2a46c);
  const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const W = 2.3, D = 1.4, H = .95, B = .14;
  box(W + .2, B, D + .2, stone, 0, B / 2, 0);
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) box(.1, H, .1, wood, x, B + H / 2, z);
  box(W, H * .9, .05, wood2, 0, B + H * .45, -D / 2 + .02);                              // Rückwand
  for (const sx of [-1, 1]) box(.05, H * .9, D, wood2, sx * (W / 2 - .02), B + H * .45, 0); // Seitenwände
  for (const z of [-D / 2, D / 2]) box(W + .12, .08, .08, wood, 0, B + H, z);
  const run = D / 2 + .22, ang = .62, len = run / Math.cos(ang), top = B + H + .04;
  for (const sz of [-1, 1]) box(W + .44, .07, len, roof, 0, top + Math.tan(ang) * run / 2, sz * run / 2, sz * ang);
  box(W + .48, .09, .09, wood, 0, top + Math.tan(ang) * run + .02, 0);                   // First
  const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, Math.tan(ang) * D / 2)]);
  for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: .05, bevelEnabled: false }), wood2); o.rotation.y = Math.PI / 2; o.position.set(sx * (W / 2) - .025, top - .02, 0); g.add(o); }
  // Vorräte in der Halle
  const prop = (gl, x, z, ry, k) => { const o = gl.scene.clone(true); o.position.set(x, B, z); o.rotation.y = ry; o.scale.setScalar(k); g.add(o); return o; };
  prop(gCrate, -.8, -.38, .2, 1.6); prop(gCrate, -.42, -.42, -.1, 1.6); prop(gCrate, -.62, -.4, .4, 1.3).position.y = B + .32;
  prop(gSack, .1, -.4, .5, 1.8); prop(gSack, .3, -.35, -.3, 1.8); prop(gBarrel, .65, -.38, 0, 1.6); prop(gBarrel, .88, -.2, 0, 1.6); prop(gBarrel, .85, -.48, 0, 1.6);
  // Stammstapel (rechts außen) und Bretterstapel (links außen)
  const logs = [], planks = [];
  for (let k = 0; k < 5; k++) { const o = gLogs.scene.clone(true); o.position.set(W / 2 + .45 + (k % 2) * .05, (k >> 1) * .19, -.45 + (k % 3) * .42); o.rotation.y = Math.PI / 2; o.scale.setScalar(1.3); g.add(o); logs.push(o); }
  const pg = mergeGeometries([0, 1, 2, 3].map(k => new THREE.BoxGeometry(.62, .035, .13).translate((k % 2) * .02, .02 + k * .037, (k % 2 ? .07 : -.07))));
  for (let k = 0; k < 5; k++) { const o = new THREE.Mesh(pg, plank); o.position.set(-W / 2 - .45, (k >> 1) * .15, -.45 + (k % 3) * .42); o.rotation.y = Math.PI / 2; g.add(o); planks.push(o); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.rotation.y = Math.atan2(-LAGER.x, -LAGER.z + .4); // Front zum Dorfplatz
  scene.add(g); const e = { o: g, x: LAGER.x, z: LAGER.z, logs, planks };
  statics.push(e); return e;
})();
const lagerDrop = () => localPt(lager, rnd(.6), 1.05); // abladen vor der offenen Front
function updateLagerStock() {
  lager.logs.forEach((o, k) => { o.visible = S.logs > k * 6; });
  lager.planks.forEach((o, k) => { o.visible = S.holz > k * 12; });
}
// Hütten der Spezialisten; Tür und Arbeitsplatz im Modellraum
const HUT = {
  lumber: { gl: gHutRed, k: SB, door: { x: 0, z: .32 }, work: { x: -.5, z: .45 } },
  forester: { gl: gHutGreen, k: SB, door: { x: 0, z: .32 }, work: { x: .28, z: .6 } },
  sawyer: { gl: gSawmill, k: 1.2, door: { x: -.32, z: .62 }, work: { x: .3, z: .55 } },
};
const huts = [];
let worldReady = false; // erst wenn die Bäume stehen, können Hütten eine Lichtung schlagen
// Werkstätten haben eigene Bauplätze am Waldrand, so nehmen sie den Wohnhäusern keinen Platz weg
const hutSites = [];
for (let i = 0; i < 18; i++) {
  const a = .15 + i / 18 * Math.PI * 2, r = 11, x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
  const slope = Math.max(...[[.8, 0], [-.8, 0], [0, .8], [0, -.8]].map(([dx, dz]) => Math.abs(heightAt(x + dx, z + dz) - h)));
  if (h > .3 && h < 2.8 && slope < .55 && streamDist(x, z) > 2.2 && Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) > 5 && Math.hypot(x - MILL_POS.x, z - MILL_POS.z) > 3) hutSites.push({ x, z, ry: -a + Math.PI / 2 + Math.PI, used: false, a });
}
// die Sägemühle möglichst nah am Lager, Holzfäller und Förster der Reihe nach rundum
function hutSite(role) {
  const free = hutSites.filter(st => !st.used); if (!free.length) return null;
  if (role !== 'sawyer') return free[0];
  return free.reduce((b, st) => (Math.hypot(st.x - LAGER.x, st.z - LAGER.z) < Math.hypot(b.x - LAGER.x, b.z - LAGER.z) ? st : b));
}
// Lichtung: Bäume auf dem Bauplatz verschwinden
function clearAround(x, z, r) { if (!worldReady) return; for (const t of trees) if (!t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r) { if (t.reserved && t.reserved !== 'fox') t.reserved.tree = null; t.reserved = null; t.gone = true; } }
function addHut(role, site) {
  site.used = true; clearAround(site.x, site.z, 1.5); flattenAt(site.x, site.z, 1.9); const H = HUT[role], e = place(H.gl, site.x, site.z, site.ry, H.k);
  e.o.traverse(o => { if (o.isMesh) o.material = houseMat(o.material); });
  e.role = role; e.H = H; e.saw = role === 'sawyer' ? e.o.getObjectByName('building_lumbermill_saw_blue') : null; e.sawing = 0;
  e.logs = 0; e.planks = 0; // Vorrat an der Säge: Träger bringen Stämme und holen Bretter
  if (role === 'lumber') { const p = localPt(e, .62, -.12); place(gLogs, p.x, p.z, site.ry + Math.PI / 2, 1.25); e.pile = p; }
  if (role === 'forester') for (const [lx, lz] of [[-.5, .05], [-.62, -.22], [.52, .18]]) { const p = localPt(e, lx, lz); place(TK[Math.random() < .5 ? 0 : 2], p.x, p.z, Math.random() * 6, ST * .2); }
  huts.push(e); return e;
}
const hutDoor = (e, d = .25) => localPt(e, e.H.door.x, e.H.door.z + d / e.o.scale.x);
const hutWork = e => localPt(e, e.H.work.x, e.H.work.z);
for (const r in ROLES) for (let i = 0; i < S.huts[r]; i++) { const st = hutSite(r); if (st) addHut(r, st); }
for (const r in ROLES) S.huts[r] = Math.max(1, huts.filter(h => h.role === r).length);

/* ------------------------------------------------------------------ trees & rocks */
const treeMeshes = TK.map(k => { const m = new THREE.InstancedMesh(k.geo, plantMat, 480); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, COL.set(1, 1, 1)); scene.add(m); return m; });
const stumpSwarm = new Swarm(parts(gStump), 500);
const trees = [];
const treeNear = (x, z, r) => trees.some(t => !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r);
function addTree(x, z, g = 1) { if (trees.length >= 480) return null; const t = { x, z, type: treeKindAt(x, z), tint: .88 + Math.random() * .22, g, alive: true, gone: false, stumpT: 0, reserved: null, rot: Math.random() * 6.28, ph: Math.random() * 6.28 }; trees.push(t); return t; }
for (let tries = 0; tries < 4000 && trees.length < 165; tries++) {
  const x = rnd(HALF * .9), z = rnd(HALF * .9), h = heightAt(x, z);
  if (h < .45 || h > 3.0 || Math.hypot(x, z) < 8.5 || streamDist(x, z) < 1.1 || onSacred(x, z, .9) || laneDist(x, z) < 1 || sites.some(st => Math.hypot(st.x - x, st.z - z) < 2.6) || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 3.6 || Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 2.2 || treeNear(x, z, 1.0) || hutSites.some(st => st.used && Math.hypot(st.x - x, st.z - z) < 1.5)) continue;
  addTree(x, z, .75 + Math.random() * .25);
}
worldReady = true;
function chopTree(t) { t.alive = false; t.stumpT = 90; if (t.reserved) t.reserved = null; } // Stumpf verrottet, danach ist der Platz frei für einen Setzling
const freeSlot = t => !t.gone && !t.alive && !t.reserved;
// Bauplätze, Dorfplatz und Werkstätten bleiben frei von Felsen und Büschen
const keepFree = (x, z, r = 0) => Math.hypot(x, z) < 7 || streamDist(x, z) < 1 + r || laneDist(x, z) < 1 + r || onSacred(x, z, .8 + r) || Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) < 3.4 + r || Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 2.2 + r || hutSites.some(st => Math.hypot(st.x - x, st.z - z) < 2.2 + r) || sites.some(st => Math.hypot(st.x - x, st.z - z) < 1.4 + r) || Math.hypot(x - LAGER.x, z - LAGER.z) < 2.8 + r;
const rocks = [];
const rockMeshes = ROCK_GEOS.map(g => { const m = new THREE.InstancedMesh(g, plantMat, 60); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });
function addRock(x, z, s) { const h = heightAt(x, z); if (h < .05 || keepFree(x, z, s) || treeNear(x, z, s + .35)) return false; rocks.push({ x, z, v: rocks.length % ROCK_GEOS.length, s, r: Math.random() * 6.28, tx: rnd(.15), tz: rnd(.15), tint: .85 + Math.random() * .25 }); return true; }
for (let tries = 0; tries < 3000 && rocks.length < 24; tries++) addRock(rnd(HALF * .88), rnd(HALF * .88), .55 + Math.random() * .55); // große Findlinge
for (let tries = 0; tries < 3000 && rocks.length < 84; tries++) { // mittlere Felsen, gern in Gruppen um die großen
  const o = Math.random() < .55 ? rocks[Math.floor(Math.random() * 24)] : null, a = Math.random() * 6.28, r = o ? o.s + .4 + Math.random() * 1.2 : 0;
  addRock(o ? o.x + Math.cos(a) * r : rnd(HALF * .88), o ? o.z + Math.sin(a) * r : rnd(HALF * .88), .2 + Math.random() * .3);
}
{ const cnt = ROCK_GEOS.map(() => 0); for (const r of rocks) rockMeshes[r.v].setColorAt(cnt[r.v]++, COL.setScalar(r.tint)); }
// Büsche: gern am Waldrand, seltener auf offener Wiese
const bushes = [];
// kleine Büsche ohne eigenen Schatten (spart Rechenzeit)
const bushMeshes = BUSH_GEOS.map(g => { const m = new THREE.InstancedMesh(g, plantMat, 120); m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });
for (let tries = 0; tries < 6000 && bushes.length < 260; tries++) {
  const x = rnd(HALF * .88), z = rnd(HALF * .88), h = heightAt(x, z);
  if (h < .5 || h > 2.7 || keepFree(x, z) || treeNear(x, z, .6) || rocks.some(r => Math.hypot(r.x - x, r.z - z) < r.s + .3)) continue;
  if (Math.random() > (treeNear(x, z, 2.2) ? .8 : .22)) continue;
  bushes.push({ x, z, v: Math.random() < .55 ? 0 : Math.random() < .5 ? 1 : 2, s: .8 + Math.random() * .7, r: Math.random() * 6.28, tint: .85 + Math.random() * .3 });
}
{ const cnt = BUSH_GEOS.map(() => 0); for (const b of bushes) bushMeshes[b.v].setColorAt(cnt[b.v]++, COL.setScalar(b.tint)); }
// Bodenbewuchs: Grasbüschel, Blumen, Farne, Kiesel, Muscheln, Treibholz. Viele kleine Teile, instanziert.
// Höhe und Sichtbarkeit (nicht auf Pfaden, unter Gebäuden, Bäumen oder im Wasser) werden reihum aktualisiert.
const grassU = { uT: { value: 0 } };
function tuftGeo() {
  const pos = [], col = [], nor = [];
  for (let b = 0; b < 6; b++) {
    const a = Math.random() * 6.28, r = Math.random() * .06, x = Math.cos(a) * r, z = Math.sin(a) * r, w = .011 + Math.random() * .008, h = .07 + Math.random() * .08;
    const la = Math.random() * 6.28, lean = .02 + Math.random() * .035, ox = Math.cos(la), oz = Math.sin(la);
    pos.push(x + oz * w, 0, z - ox * w, x - oz * w, 0, z + ox * w, x + ox * lean, h, z + oz * lean);
    col.push(.5, .56, .42, .5, .56, .42, 1.06, 1.1, .92); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); // Normalen nach oben: Halme hell wie der Boden
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
grassMat.onBeforeCompile = sh => { // Wind: Halmspitzen wiegen sich, in Wellen über die Wiese
  sh.uniforms.uT = grassU.uT;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
    { vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]); float sw = sin(uT * 1.6 + ip.x * .45 + ip.y * .3) + .5 * sin(uT * 2.7 + ip.x * 1.3);
      transformed.x += sw * .18 * position.y; transformed.z += cos(uT * 1.3 + ip.y * .5) * .1 * position.y; }`);
  // beide Seiten der Halme wie der Boden beleuchten (sonst ist die Rückseite schwarz)
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);');
};
const flowerGeo = mergeGeometries([
  paint(new THREE.BoxGeometry(.005, .1, .005).translate(0, .05, 0), (x, y, z, ny, c) => c.set(0x4c8a35)),
  paint(new THREE.CircleGeometry(.026, 5).rotateX(-Math.PI / 2).translate(0, .1, 0), (x, y, z, ny, c) => c.set(0xffffff)),
  paint(new THREE.IcosahedronGeometry(.009, 0).translate(0, .104, 0), (x, y, z, ny, c) => c.set(0xf5c542)),
]);
// zweite Blütenform: Kelch (Tulpe/Glocke) mit Blatt
const bellGeo = mergeGeometries([
  paint(new THREE.BoxGeometry(.005, .11, .005).translate(0, .055, 0), (x, y, z, ny, c) => c.set(0x4c8a35)),
  paint(new THREE.ConeGeometry(.012, .05, 3).rotateZ(.9).translate(.018, .035, 0), (x, y, z, ny, c) => c.set(0x5c9a40)),
  paint(new THREE.CylinderGeometry(.022, .01, .045, 6, 1, true).translate(0, .125, 0), (x, y, z, ny, c) => c.set(0xffffff).multiplyScalar(.8 + .2 * smooth(.1, .15, y))),
]);
const fernGeo = mergeGeometries([0, 1, 2, 3, 4, 5].map(k => paint(new THREE.ConeGeometry(.02, .17, 3).rotateX(Math.PI / 2).translate(0, 0, .085).rotateX(-.55).rotateY(k * 1.05 + rnd(.2)), fol(-.02, .1, 0x2f6b2c, 0x6aa84a))));
const pebbleGeos = [5, 11].map(sd => rockGeo(sd, 0));
const shellGeo = paint(new THREE.SphereGeometry(.024, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .55, 1.25), (x, y, z, ny, c) => c.set(0xffffff).multiplyScalar(.8 + .25 * Math.abs(Math.sin(Math.atan2(z, x) * 5))));
const driftGeo = mergeGeometries([paint(new THREE.CylinderGeometry(.028, .036, .5, 6).rotateZ(Math.PI / 2), bark(.1, 0x8f8576, 0xb3aa9a)), paint(new THREE.CylinderGeometry(.012, .018, .2, 5).translate(0, .1, 0).rotateZ(-.9).translate(.08, 0, 0), bark(.1, 0x8f8576, 0xb3aa9a))]);
const cover = [];
function coverKind(geo, mat, items, o) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)); m.frustumCulled = false; m.receiveShadow = true; m.castShadow = !!o.shadow; m.count = items.length;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0); items.forEach((it, i) => { m.setMatrixAt(i, hide); m.setColorAt(i, COL.set(it.c ?? 0xffffff)); });
  scene.add(m); const k = { m, items, hmin: o.hmin, hmax: o.hmax, sink: o.sink || 0, lie: !!o.lie }; cover.push(k); return k;
}
{
  const BARE_AT = (x, z) => { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? 0 : BARE[j * N + i]; };
  const grassC = [0x86b54b, 0x76a842, 0x9cbc55, 0x6e9e3e];
  const grass = [];
  for (let tries = 0; tries < 120000 && grass.length < 12500; tries++) {
    const x = rnd(HALF * .92), z = rnd(HALF * .92), h = heightAt(x, z);
    if (h < .42 || h > 2.8) continue;
    const dens = (.3 + .7 * smooth(-.35, .45, noise(x * .22 + 5, z * .22))) * (1 - smooth(.3, .42, BARE_AT(x, z)));
    if (Math.random() > dens) continue;
    grass.push({ x, z, r: Math.random() * 6.28, s: .9 + Math.random() * .8, c: grassC[Math.floor(Math.random() * 4)] });
  }
  coverKind(tuftGeo(), grassMat, grass, { hmin: .38, hmax: 2.9 });
  const PAL = [0xf6f3e8, 0xf2cf3a, 0xec86ad, 0x9c82dc, 0xdc4a3c, 0x75a6e6, 0xf09a3e];
  const flowers = [];
  for (let c = 0; c < 140; c++) {
    let cx = 0, cz = 0, ok = false;
    for (let t = 0; t < 30 && !ok; t++) { cx = rnd(HALF * .85); cz = rnd(HALF * .85); const h = heightAt(cx, cz); ok = h > .5 && h < 2.2; }
    if (!ok) continue;
    const col = PAL[Math.floor(Math.random() * PAL.length)], n = 5 + Math.floor(Math.random() * 12);
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * .9; flowers.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, r: Math.random() * 6.28, s: .8 + Math.random() * .5, c: col }); }
  }
  // Blumenwiesen: einige dichte, bunte Flächen auf offenem Land, jede mit zwei, drei vorherrschenden Farben
  const bells = [];
  for (let m = 0, tries = 0; m < 7 && tries < 400; tries++) {
    const cx = rnd(HALF * .8), cz = rnd(HALF * .8), h = heightAt(cx, cz);
    if (h < .5 || h > 2 || Math.hypot(cx, cz) < 6 || onSacred(cx, cz, 2) || treeNear(cx, cz, 2.2)) continue;
    m++;
    const R = 2.2 + Math.random() * 1.8, main = [0, 1, 2].map(() => PAL[Math.floor(Math.random() * PAL.length)]);
    for (let k = 0; k < 260; k++) {
      const a = Math.random() * 6.28, r = Math.pow(Math.random(), .65) * R, x = cx + Math.cos(a) * r * (1 + .3 * Math.sin(a * 3)), z = cz + Math.sin(a) * r;
      const col = Math.random() < .8 ? main[k % 3] : PAL[Math.floor(Math.random() * PAL.length)];
      (Math.random() < .55 ? flowers : bells).push({ x, z, r: Math.random() * 6.28, s: .75 + Math.random() * .55, c: col });
    }
  }
  coverKind(flowerGeo, plantMat, flowers, { hmin: .45, hmax: 2.6 });
  coverKind(bellGeo, plantMat, bells, { hmin: .45, hmax: 2.6 });
  const ferns = [];
  for (const t of trees) if (TREE_FOREST.includes(t.type) && Math.random() < .55) for (let k = 0; k < 1 + (Math.random() < .4); k++) { const a = Math.random() * 6.28, r = .35 + Math.random() * .5; ferns.push({ x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r, r: Math.random() * 6.28, s: .8 + Math.random() * .6, c: 0xffffff }); }
  coverKind(fernGeo, plantMat, ferns, { hmin: .45, hmax: 2.9 });
  const pebbles = [[], []];
  for (let k = 0; k < 760; k++) {
    let x, z; const u = Math.random();
    if (u < .45 && rocks.length) { const o = rocks[Math.floor(Math.random() * rocks.length)], a = Math.random() * 6.28, r = o.s * (1.05 + Math.random() * .9); x = o.x + Math.cos(a) * r; z = o.z + Math.sin(a) * r; }
    else { x = rnd(HALF * .9); z = rnd(HALF * .9); const h = heightAt(x, z); if (!(h > -.05 && h < .45) && BARE_AT(x, z) < .3) { k--; continue; } }
    pebbles[k % 2].push({ x, z, r: Math.random() * 6.28, s: .05 + Math.random() * .08, c: COL.setScalar(.85 + Math.random() * .3).getHex() });
  }
  pebbles.forEach((pb, k) => coverKind(pebbleGeos[k], plantMat, pb, { hmin: -.08, hmax: 4.5, sink: .25 }));
  const shells = [], drift = [], SH = [0xfff6ec, 0xf6d3c6, 0xe9c9a0, 0xffe4ef];
  for (let tries = 0; tries < 8000 && shells.length < 170; tries++) { const x = rnd(HALF * .95), z = rnd(HALF * .95), h = heightAt(x, z); if (h > -.04 && h < .3) shells.push({ x, z, r: Math.random() * 6.28, s: .7 + Math.random() * .6, c: SH[Math.floor(Math.random() * 4)] }); }
  for (let tries = 0; tries < 8000 && drift.length < 18; tries++) { const x = rnd(HALF * .95), z = rnd(HALF * .95), h = heightAt(x, z); if (h > .02 && h < .22) drift.push({ x, z, r: Math.random() * 6.28, s: 1 + Math.random() * .7, c: 0xffffff }); }
  coverKind(shellGeo, plantMat, shells, { hmin: -.06, hmax: .4 });
  coverKind(driftGeo, plantMat, drift, { hmin: -.02, hmax: .35, sink: -.03, shadow: true });
}
// reihum ein Stück des Bewuchses neu setzen (Höhe nach Formen, Pfade, neue Gebäude); am Anfang alles
let coverK = 0, coverI = 0;
function refreshCover(budget) {
  while (budget > 0 && cover.length) {
    const K = cover[coverK], m = K.m, i0 = coverI, i1 = Math.min(K.items.length, i0 + budget);
    for (let i = i0; i < i1; i++) {
      const it = K.items[i], h = heightAt(it.x, it.z);
      const wi = Math.round((it.x + HALF) / CELL), wj = Math.round((it.z + HALF) / CELL), w = wi >= 0 && wj >= 0 && wi < N && wj < N ? WEAR[wj * N + wi] : 0;
      let vis = h > K.hmin && h < K.hmax && w < 7 && streamDist(it.x, it.z) > .45 && !onSacred(it.x, it.z, .15) && laneDist(it.x, it.z) > .45 && Math.hypot(it.x - SHRINE_POS.x, it.z - SHRINE_POS.z) > 2.35 && Math.hypot(it.x - PLAZA.x, it.z - PLAZA.z) > PLAZA.r;
      if (vis && navReady) { const c = navCell(it.x, it.z); vis = c >= 0 && !navV.g[c] || (K.hmin < 0 && navWater[c] === 1 && h > K.hmin); }
      if (!vis) { m.setMatrixAt(i, zero); continue; }
      dummy.position.set(it.x, h - K.sink * it.s, it.z); dummy.rotation.set(0, it.r, 0); dummy.scale.setScalar(it.s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    if (i1 > i0) { m.instanceMatrix.addUpdateRange(i0 * 16, (i1 - i0) * 16); m.instanceMatrix.needsUpdate = true; }
    budget -= i1 - i0; coverI = i1;
    if (coverI >= K.items.length) { coverI = 0; coverK = (coverK + 1) % cover.length; }
  }
}
let coverFirst = true; // beim ersten Frame alles setzen

/* ------------------------------------------------------------------ Wegfindung */
// Raster über die ganze Insel (NAV_C Einheiten je Feld). Belegt sind Gebäude (gedrehte Rechtecke aus den Modellmaßen),
// Felsen, Baumstämme und Wasser. Es gibt zwei Raster: eins für Bewohner und eins mit mehr Abstand für den Tiergeist.
// Das Raster wird jede Sekunde neu gestempelt (Bäume wachsen und fallen, Häuser entstehen, das Gelände wird geformt).
const NAV_C = .25, NAV_N = Math.round(SIZE / NAV_C), NAV_SZ = NAV_N * NAV_N;
const navV = { m: .12, g: new Uint8Array(NAV_SZ) }, navF = { m: .3, g: new Uint8Array(NAV_SZ) };
const navWater = new Uint8Array(NAV_SZ);
const navCell = (x, z) => { const i = Math.floor((x + HALF) / NAV_C), j = Math.floor((z + HALF) / NAV_C); return i < 0 || j < 0 || i >= NAV_N || j >= NAV_N ? -1 : j * NAV_N + i; };
const cellX = c => -HALF + (c % NAV_N + .5) * NAV_C, cellZ = c => -HALF + (Math.floor(c / NAV_N) + .5) * NAV_C;
// Grundrisse im Modellraum: Mitte (cx, cz) und halbe Ausdehnung (hx, hz)
const FOOT = { homeA: [0, -.04, .4, .43], homeB: [0, .01, .44, .55], sawmill: [0, .055, .69, .52] };
function navObstacles() {
  const rects = [], circles = [];
  const rect = (e, f) => { const k = e.o.scale.x, p = localPt(e, f[0], f[1]); rects.push({ x: p.x, z: p.z, ry: e.o.rotation.y, hx: f[2] * k, hz: f[3] * k }); };
  for (const h of houses) { rect(h, h.b ? FOOT.homeB : FOOT.homeA); if (h.garden) rects.push({ x: h.garden.x, z: h.garden.z, ry: h.garden.ry, hx: .58, hz: .4 }); }
  for (const h of huts) { rect(h, h.role === 'sawyer' ? FOOT.sawmill : FOOT.homeA); if (h.pile) circles.push({ x: h.pile.x, z: h.pile.z, r: .38 }); }
  rects.push({ x: lager.x, z: lager.z, ry: lager.o.rotation.y, hx: 2.0, hz: .86 });
  circles.push({ x: SHRINE_POS.x, z: SHRINE_POS.z, r: 1.62 }, { x: WELL.x, z: WELL.z, r: .45 }, { x: MILL_POS.x, z: MILL_POS.z, r: .8 }, ...sacredProps.obstacles);
  if (construction) circles.push({ x: construction.site.x, z: construction.site.z, r: .9 });
  for (const r of rocks) circles.push({ x: r.x, z: r.z, r: r.s * .95 });
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
function buildNav() {
  for (let c = 0; c < NAV_SZ; c++) navWater[c] = heightAt(cellX(c), cellZ(c)) < -.05 ? 1 : 0;
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

/* ------------------------------------------------------------------ clouds & effects */
// Wolken: Haufen aus verbeulten Kugeln, oben weiß, unten grau-blau, flache Unterseite. Wie viele und wie groß, hängt
// am Wetter; sie ziehen mit dem Wind, werfen Schatten und werden durchsichtig, wenn sie den Blick auf die Insel verdecken.
function cloudGeo(n) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const x = (k / (n - 1) - .5) * 2.6 + rnd(.25), r = .55 + Math.random() * .5 * (1 - Math.abs(x) / 2);
    parts.push(lumpy(new THREE.IcosahedronGeometry(r, 1), .14, 1.3).translate(x, r * .35 + Math.random() * .25, rnd(.45)));
  }
  const g = mergeGeometries(parts), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * .25); // flache Unterseite
  return paint(g, (x, y, z, ny, c) => c.set(0xc5cfdb).lerp(COL2.set(0xffffff), clamp(smooth(-.1, .9, y) * .8 + (ny > .4 ? .25 : 0), 0, 1)).multiplyScalar(.97 + .05 * jit(x, y, z)));
}
const CLOUD_GEOS = [5, 7, 9, 11].map(cloudGeo);
const CLOUD_N = 30, clouds = [], cloudCol = new THREE.Color();
for (let i = 0; i < CLOUD_N; i++) {
  const m = new THREE.Mesh(CLOUD_GEOS[i % 4], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
  m.castShadow = true; m.renderOrder = 3; scene.add(m);
  clouds.push({ m, x: rnd(52), z: rnd(52), y: 21 + Math.random() * 5, s: 2.2 + Math.random() * 2, rot: Math.random() * 6.28, rank: Math.random(), vis: 0 });
}
const cloudDummy = new THREE.Vector3(), segA = new THREE.Vector3(), segB = new THREE.Vector3();
function updateClouds(dt) {
  const cv = weather.cover, n = cv * CLOUD_N * 1.15, sp = (.4 + weather.wind * 1.6) * dt, dx = Math.cos(weather.dir), dz = Math.sin(weather.dir);
  cloudCol.set(0xffffff).lerp(skyTmp.set(0x8f969e), smooth(.5, 1, cv) * .7).lerp(skyTmp.set(0x6b7179), weather.rain * .45);
  segA.copy(camera.position); segB.copy(controls.target);
  clouds.forEach((c, i) => {
    c.x += dx * sp; c.z += dz * sp;
    // was hinausweht, kommt auf der anderen Seite wieder herein
    if (c.x * dx + c.z * dz > 54) { c.x -= dx * 108; c.z -= dz * 108; c.x += -dz * rnd(15); c.z += dx * rnd(15); }
    const want = c.rank * CLOUD_N < n ? 1 : 0; c.vis += (want - c.vis) * Math.min(1, dt * .5);
    const sc = c.s * (.7 + cv * .7);
    c.m.position.set(c.x, c.y, c.z); c.m.rotation.y = c.rot; c.m.scale.set(sc, sc * (.75 + cv * .35), sc);
    // Blick freihalten: nah an der Kamera oder auf der Linie Kamera → Insel durchsichtig
    cloudDummy.set(c.x, c.y, c.z);
    const near = smooth(sc * 1.2, sc * 3.2, cloudDummy.distanceTo(camera.position));
    const ab = segB.clone().sub(segA), u = clamp(cloudDummy.clone().sub(segA).dot(ab) / ab.lengthSq(), 0, 1), dLine = cloudDummy.distanceTo(segA.clone().addScaledVector(ab, u));
    const block = .22 + .78 * smooth(sc * .9, sc * 2.2, dLine);
    const above = .15 + .85 * smooth(c.y - 1, c.y - 6, camera.position.y); // Kamera auf Wolkenhöhe oder darüber: Wolken fast durchsichtig
    c.m.material.opacity = c.vis * Math.min(near, block, above) * (.9 - .1 * weather.rain);
    c.m.material.color.copy(cloudCol); c.m.visible = c.m.material.opacity > .01;
    c.m.castShadow = c.vis > .5;
  });
}
// Regen über der ganzen Insel (Wetter): kurze Striche, die um den Blickpunkt fallen
const WRAIN_N = 1600, wrainPos = new Float32Array(WRAIN_N * 6), wrain = [];
for (let i = 0; i < WRAIN_N; i++) wrain.push({ x: rnd(18), z: rnd(18), y: Math.random() * 14 });
const wrainGeo = new THREE.BufferGeometry(); wrainGeo.setAttribute('position', new THREE.BufferAttribute(wrainPos, 3));
const wrainLines = new THREE.LineSegments(wrainGeo, new THREE.LineBasicMaterial({ color: 0xc8dcef, transparent: true, opacity: 0, depthWrite: false }));
wrainLines.frustumCulled = false; scene.add(wrainLines);
function updateWeatherRain(dt) {
  const k = smooth(.2, .8, weather.rain); wrainLines.visible = k > .01; if (!wrainLines.visible) return;
  wrainLines.material.opacity = .45 * k;
  const cx = controls.target.x, cz = controls.target.z, wx = Math.cos(weather.dir) * weather.wind * .35, wz = Math.sin(weather.dir) * weather.wind * .35, n = Math.floor(WRAIN_N * k);
  for (let i = 0; i < WRAIN_N; i++) {
    const d = wrain[i];
    if (i >= n) { wrainPos.fill(0, i * 6, i * 6 + 6); continue; }
    d.y -= dt * 15; d.x += wx * dt * 15; d.z += wz * dt * 15;
    let ax = cx + d.x, az = cz + d.z; const g = surfaceAt(ax, az);
    if (d.y < g || Math.abs(d.x) > 18 || Math.abs(d.z) > 18) { d.x = rnd(18); d.z = rnd(18); d.y = g + 9 + Math.random() * 5; ax = cx + d.x; az = cz + d.z; }
    wrainPos.set([ax, d.y, az, ax - wx * .4, d.y + .45, az - wz * .4], i * 6);
  }
  wrainGeo.attributes.position.needsUpdate = true;
}
// Schneefall: weiche Flocken, die um den Blickpunkt trudeln
const SNOW_N = 2200, snowPos = new Float32Array(SNOW_N * 3), flakes = [];
for (let i = 0; i < SNOW_N; i++) flakes.push({ x: rnd(18), z: rnd(18), y: Math.random() * 12, ph: Math.random() * 6.28, sp: .8 + Math.random() * .6 });
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .17, map: glowTex, transparent: true, opacity: 0, depthWrite: false }));
snowPts.frustumCulled = false; snowPts.visible = false; scene.add(snowPts);
function updateSnowfall(dt, t) {
  const k = smooth(.15, .7, weather.snow); snowPts.visible = k > .01; if (!snowPts.visible) return;
  snowPts.material.opacity = .9 * k;
  const cx = controls.target.x, cz = controls.target.z, wx = Math.cos(weather.dir) * weather.wind * .6, wz = Math.sin(weather.dir) * weather.wind * .6, n = Math.floor(SNOW_N * k);
  for (let i = 0; i < SNOW_N; i++) {
    const f = flakes[i];
    if (i >= n) { snowPos.set([0, -50, 0], i * 3); continue; }
    f.y -= dt * f.sp * 1.2; f.x += (wx + Math.sin(t * 1.3 + f.ph) * .35) * dt; f.z += (wz + Math.cos(t * 1.1 + f.ph) * .35) * dt;
    let ax = cx + f.x, az = cz + f.z; const g = surfaceAt(ax, az);
    if (f.y < g || Math.abs(f.x) > 18 || Math.abs(f.z) > 18) { f.x = rnd(18); f.z = rnd(18); f.y = g + 8 + Math.random() * 5; ax = cx + f.x; az = cz + f.z; }
    snowPos.set([ax, f.y, az], i * 3);
  }
  snowGeo.attributes.position.needsUpdate = true;
}
// Pfützen: Wasserstand in den Mulden des Geländes (siehe Gelände-Shader und updateDepth). Hier nur die Werte je Frame.
function updatePuddles(dt, t) { terrainU.uWet.value = weather.wet; terrainU.uRain.value = smooth(.3, .9, weather.rain); terrainU.uT.value = t; }
/* ------------------------------------------------------------------ Wildtiere */
// Rehe und Hasen leben außerhalb des Dorfes, Fische im flachen Wasser rund um die Insel. Später sollen Jäger und Angler
// sie nutzen: `wild` (Rehe, Hasen) und `fish` stehen dafür bereit.
const wild = [], fish = [];
const animalMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true });
function makeDeer() {
  const g = new THREE.Group(), fur = animalMat(0x9a6a40), light = animalMat(0xd9c3a2), dark = animalMat(0x3a2a20), white = animalMat(0xf2ede4);
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.noSnow = true; par.add(o); return o; };
  add(new THREE.SphereGeometry(1, 10, 7).scale(.14, .13, .27), fur, 0, .42, 0);
  add(new THREE.SphereGeometry(1, 8, 5).scale(.115, .06, .22), light, 0, .35, .01);              // helle Unterseite
  add(new THREE.SphereGeometry(.045, 6, 4), white, 0, .45, -.27);                                 // weißer Spiegel
  const neck = new THREE.Group(); neck.position.set(0, .5, .2); g.add(neck);
  add(new THREE.CylinderGeometry(.04, .055, .2, 6).translate(0, .1, 0), fur, 0, 0, 0, neck).rotation.x = .45;
  const head = new THREE.Group(); head.position.set(0, .17, .09); neck.add(head);
  add(new THREE.SphereGeometry(1, 8, 6).scale(.045, .05, .1), fur, 0, 0, .04, head);
  add(new THREE.SphereGeometry(.018, 5, 4), dark, 0, -.01, .14, head);                         // Nase
  for (const sx of [-1, 1]) { const e = add(new THREE.ConeGeometry(.025, .09, 4), fur, sx * .04, .05, -.01, head); e.rotation.z = -sx * .7; }
  const legs = [];
  for (const [x, z] of [[.075, .17], [-.075, .17], [.075, -.17], [-.075, -.17]]) {
    const L = new THREE.Group(); L.position.set(x, .36, z); g.add(L);
    add(new THREE.CylinderGeometry(.022, .014, .34, 6).translate(0, -.17, 0), fur, 0, 0, 0, L); add(new THREE.CylinderGeometry(.015, .018, .035, 5), dark, 0, -.34, 0, L);
    legs.push(L);
  }
  g.scale.setScalar(.8); scene.add(g); return { g, legs, neck, head }; // etwas kleiner als ein Bewohner
}
function makeHare() {
  const g = new THREE.Group(), fur = animalMat(0x8f7b62), light = animalMat(0xcdbba0), white = animalMat(0xf4efe6), dark = animalMat(0x2a211b);
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.userData.noSnow = true; par.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  add(new THREE.SphereGeometry(1, 8, 6).scale(.065, .06, .1), fur, 0, .08, 0, body);
  add(new THREE.SphereGeometry(1, 6, 4).scale(.045, .045, .06), fur, 0, .055, -.06, body);      // Hinterläufe
  add(new THREE.SphereGeometry(.03, 6, 4), white, 0, .1, -.1, body);                              // Blume (Schwanz)
  const head = new THREE.Group(); head.position.set(0, .14, .08); body.add(head);
  add(new THREE.SphereGeometry(1, 7, 5).scale(.035, .035, .045), fur, 0, 0, 0, head);
  add(new THREE.SphereGeometry(.008, 4, 3), dark, 0, .005, .045, head);
  const ears = [];
  for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * .015, .03, -.01); head.add(e); add(new THREE.SphereGeometry(1, 5, 4).scale(.01, .055, .02).translate(0, .05, 0), light, 0, 0, 0, e); e.rotation.set(-.3, 0, sx * .2); ears.push(e); }
  g.scale.setScalar(.95); scene.add(g); return { g, body, head, ears };
}
// Lebensraum: offenes Land und Waldrand außerhalb des Dorfes
function wildSpot(x0, z0, r) {
  for (let k = 0; k < 30; k++) {
    const a = Math.random() * 6.28, d = r * (.3 + Math.random() * .7), x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d, h = heightAt(x, z);
    if (h > .5 && h < 2.8 && Math.hypot(x, z) > 9.5 && Math.hypot(x - SHRINE_POS.x, z - SHRINE_POS.z) > 3.5 && (!navReady || !blockedAt(navV, x, z))) return { x, z };
  }
  return null;
}
for (let k = 0; k < 20; k++) {
  const deer = k < 8, at = wildSpot(0, 0, 29); if (!at) continue;
  wild.push({ kind: deer ? 'reh' : 'hase', ...at, h: Math.random() * 6.28, state: 'idle', timer: Math.random() * 4, ph: Math.random() * 6.28, sp: 0, m: deer ? makeDeer() : makeHare(), threatT: 0 });
}
// Fische: kleine Schwärme im flachen Wasser, ab und zu springt einer (mit Spritzer und Wellenring)
const fishGeo = mergeGeometries([
  paint(new THREE.SphereGeometry(1, 8, 5).scale(.028, .035, .1), (x, y, z, ny, c) => c.set(y > .005 ? 0x4c6a78 : 0xc9d6dc)),
  paint(new THREE.ConeGeometry(.035, .06, 4).rotateX(-Math.PI / 2).scale(.3, 1, 1).translate(0, 0, -.12), (x, y, z, ny, c) => c.set(0x5b7987)),
]);
const FISH_N = 54, fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .2 }), FISH_N);
fishMesh.frustumCulled = false; fishMesh.userData.noSnow = true; scene.add(fishMesh);
const waterDepthAt = (x, z) => -.02 - heightAt(x, z);
{
  let tries = 0;
  for (let sch = 0; sch < 9 && tries < 3000; tries++) { // neun Schwärme
    const a = Math.random() * 6.28, r = 14 + Math.random() * 20, cx = Math.cos(a) * r, cz = Math.sin(a) * r, d = waterDepthAt(cx, cz);
    if (d < .35 || d > 1.6) continue;
    sch++; const hd = Math.random() * 6.28;
    for (let k = 0; k < 6; k++) fish.push({ x: cx + rnd(.6), z: cz + rnd(.6), h: hd + rnd(.4), sp: .35 + Math.random() * .2, ph: Math.random() * 6.28, jump: 0, s: .85 + Math.random() * .4 });
  }
}
const RIPPLE_N = 8, ripples = [], rippleMesh = new THREE.InstancedMesh(new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: .6, depthWrite: false }), RIPPLE_N);
rippleMesh.frustumCulled = false; rippleMesh.count = 0; rippleMesh.userData.noSnow = true; scene.add(rippleMesh);
const splash = (x, z) => { if (ripples.length >= RIPPLE_N) ripples.shift(); ripples.push({ x, z, t: 0 }); spawnChips(x, .05, z, Math.random() * 6.28); };
let fishJumpT = 3;
function updateFish(dt, t) {
  fishJumpT -= dt;
  if (fishJumpT <= 0) { // springen nur, wo Absprung und Landestelle tief genug sind (nicht am Ufer)
    fishJumpT = 2.5 + Math.random() * 5; const f = fish[Math.floor(Math.random() * fish.length)];
    if (f && !f.jump && waterDepthAt(f.x, f.z) > .8 && waterDepthAt(f.x + Math.sin(f.h) * 1.3, f.z + Math.cos(f.h) * 1.3) > .8) { f.jump = .001; splash(f.x, f.z); }
  }
  fish.forEach((f, i) => {
    if (f.jump > 0) { // Sprung: Bogen aus dem Wasser, Kopf voran
      f.jump += dt / .9; f.x += Math.sin(f.h) * dt * 1.4; f.z += Math.cos(f.h) * dt * 1.4;
      if (f.jump >= 1) { f.jump = 0; splash(f.x, f.z); }
    } else {
      f.h += Math.sin(t * .7 + f.ph) * dt * .6;
      const nx = f.x + Math.sin(f.h) * f.sp * dt, nz = f.z + Math.cos(f.h) * f.sp * dt, d = waterDepthAt(nx, nz);
      if (d < .35 || d > 1.8) { // zu flach: von der Insel weg drehen, zu tief: zur Insel hin; dabei weiterschwimmen
        const r = Math.hypot(f.x, f.z) || 1, want = d < .35 ? Math.atan2(f.x / r, f.z / r) : Math.atan2(-f.x / r, -f.z / r);
        const dh = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h)); f.h += clamp(dh, -dt * 3, dt * 3);
        if (waterDepthAt(f.x + Math.sin(f.h) * f.sp * dt, f.z + Math.cos(f.h) * f.sp * dt) >= .2) { f.x += Math.sin(f.h) * f.sp * dt * .6; f.z += Math.cos(f.h) * f.sp * dt * .6; }
      } else { f.x = nx; f.z = nz; }
    }
    const j = f.jump, y = j > 0 ? -.05 + Math.sin(j * Math.PI) * .55 : -.2 - .04 * Math.sin(t * 2 + f.ph);
    dummy.position.set(f.x, y, f.z); dummy.rotation.set(j > 0 ? -Math.cos(j * Math.PI) * 1.1 : 0, f.h, Math.sin(t * 9 + f.ph) * .15, 'YXZ'); dummy.scale.setScalar(f.s * 1.3); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
  });
  fishMesh.count = fish.length; fishMesh.instanceMatrix.needsUpdate = true;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt / 1.6; if (ripples[i].t >= 1) ripples.splice(i, 1); }
  ripples.forEach((r, i) => { dummy.position.set(r.x, .02, r.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.15 + r.t * .9); dummy.updateMatrix(); rippleMesh.setMatrixAt(i, dummy.matrix); });
  rippleMesh.count = ripples.length; rippleMesh.material.opacity = ripples.length ? .5 : 0; rippleMesh.instanceMatrix.needsUpdate = true;
}
// Rehe und Hasen: äsen bzw. sitzen, ziehen umher, fliehen vor Bewohnern, dem Tiergeist und der Hand
function updateWild(dt, t) {
  for (const a of wild) {
    const deer = a.kind === 'reh';
    a.threatT -= dt;
    if (a.threatT <= 0) { // Gefahr prüfen
      a.threatT = .3; let tx = 0, tz = 0, n = 0;
      const near = (x, z, r) => { const d = Math.hypot(a.x - x, a.z - z); if (d < r) { tx += (a.x - x) / (d || 1); tz += (a.z - z) / (d || 1); n++; } };
      // eher gelassen, damit man sie beobachten kann: nur wer sehr nahe kommt, scheucht sie auf
      for (const v of villagers) if (v.state !== 'sleep') near(v.x, v.z, deer ? 1.6 : 1.1);
      near(fox.x, fox.z, deer ? 2.8 : 2.2);
      if (hand.g.visible && (pressing || hand.vel.length() > 6)) near(hand.g.position.x, hand.g.position.z, 1.6); // die Hand nur beim Zugreifen oder schnellen Bewegen
      if (n && a.state !== 'flee') {
        const l = Math.hypot(tx, tz) || 1, run = deer ? 3.5 : 2.5, px = a.x + tx / l * run + rnd(1), pz = a.z + tz / l * run + rnd(1);
        a.state = 'flee'; setGoal(a, px, pz, navV); a.sp = deer ? 2.6 : 3; a.timer = 2;
      }
    }
    if (a.state === 'idle') { a.timer -= dt; if (a.timer <= 0) { const p = wildSpot(a.x, a.z, deer ? 7 : 4); if (p) { a.state = 'walk'; setGoal(a, p.x, p.z, navV); a.sp = deer ? .55 : 1.1; } else a.timer = 2; } }
    else { a.timer -= dt; if (followPath(a, a.sp * dt) || (a.state === 'flee' && a.timer <= 0)) { a.state = 'idle'; a.timer = 3 + Math.random() * 6; } }
    const y = heightAt(a.x, a.z), M = a.m, moving = a.state !== 'idle', fast = a.state === 'flee';
    if (deer) {
      const cyc = t * (fast ? 11 : 6) + a.ph, sw = moving ? Math.sin(cyc) * (fast ? .7 : .35) : 0;
      M.legs.forEach((L, k) => { L.rotation.x = (k === 0 || k === 3 ? sw : -sw); });
      const graze = !moving ? smooth(.2, .8, Math.sin(t * .4 + a.ph) * .5 + .5) : 0;   // Kopf zum Gras
      M.neck.rotation.x = graze * 1.5 - (fast ? .2 : 0); M.head.rotation.x = graze * -.4;
      M.g.position.set(a.x, y + (fast ? Math.abs(Math.sin(cyc)) * .12 : 0), a.z);
    } else {
      const hop = moving ? Math.abs(Math.sin(t * (fast ? 13 : 8) + a.ph)) : 0;
      M.body.position.y = hop * (fast ? .16 : .08); M.body.rotation.x = moving ? -Math.cos(t * (fast ? 13 : 8) + a.ph) * .25 : 0;
      M.ears.forEach((e, k) => { e.rotation.x = -.3 + (moving ? .4 : Math.max(0, Math.sin(t * 3 + a.ph + k)) ** 8 * .5); });
      M.head.rotation.y = !moving ? Math.sin(t * .8 + a.ph) * .4 : 0;
      M.g.position.set(a.x, y, a.z);
    }
    M.g.rotation.y = a.h;
  }
}
// Regenwolke des Wunders: eine dunkle Wolke aus denselben Formen
const rainCloud = new THREE.Mesh(CLOUD_GEOS[2], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, color: 0x8d98a4, transparent: true, opacity: .55, depthWrite: false })); // halb durchsichtig, damit man sieht, wo es regnet
rainCloud.castShadow = true; rainCloud.visible = false; rainCloud.scale.setScalar(1.6); scene.add(rainCloud);
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
// runder Stamm: Rinde und helle Schnittflächen an den Enden
const vWood = [
  vMesh(new THREE.CylinderGeometry(.037, .04, .27, 9, 1, true).rotateZ(Math.PI / 2).translate(0, .21, .13), 0x7a4f2c, .95),
  vMesh(mergeGeometries([-1, 1].map(sd => new THREE.CircleGeometry(.036, 9).rotateY(sd * Math.PI / 2).translate(sd * .135, .21, .13))), 0xd9b47c, .9),
];
const vAxe = [
  vMesh(new THREE.CylinderGeometry(.011, .013, .25, 6).translate(0, -.185, 0), 0x7a5230, .9),
  vMesh(mergeGeometries([
    new THREE.BoxGeometry(.016, .05, .06).translate(0, -.285, -.035),
    new THREE.BoxGeometry(.008, .07, .016).translate(0, -.285, -.068), // Schneide
    new THREE.BoxGeometry(.022, .034, .028).translate(0, -.285, .012),  // Nacken
  ]), 0x9aa3ab, .35),
];
// Laterne: Aufhänger im Ursprung, hängt nach unten; das Glas leuchtet
const vLantern = vMesh(mergeGeometries([
  new THREE.BoxGeometry(.008, .02, .008).translate(0, -.01, 0),
  new THREE.CylinderGeometry(.008, .03, .022, 6).translate(0, -.031, 0),
  new THREE.CylinderGeometry(.03, .03, .01, 6).translate(0, -.087, 0),
  ...[0, 1, 2].map(k => new THREE.BoxGeometry(.006, .046, .006).translate(Math.cos(k * 2.09) * .026, -.059, Math.sin(k * 2.09) * .026)),
]), 0x3b3530, .6);
const LANTERN_C = -.059;
const vLanternGlass = new THREE.InstancedMesh(new THREE.CylinderGeometry(.022, .022, .046, 6).translate(0, LANTERN_C, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), VCAP);
vLanternGlass.frustumCulled = false; vLanternGlass.count = 0; scene.add(vLanternGlass);
const vBread = vMesh(new THREE.CapsuleGeometry(.018, .03, 3, 6).rotateZ(Math.PI / 2).translate(0, -.14, .012), 0xc98b4c, .9);
// Spaten des Försters: wie die Axt im Schulterraum, Blatt unten
const vShovel = [
  vMesh(new THREE.CylinderGeometry(.01, .011, .27, 6).translate(0, -.175, 0), 0x7a5230, .9),
  vMesh(mergeGeometries([new THREE.BoxGeometry(.055, .075, .01).translate(0, -.34, 0), new THREE.BoxGeometry(.04, .012, .012).translate(0, -.04, 0)]), 0x8e979e, .4),
];
// Setzling mit Erdballen, hängt aufrecht an der Hand
const vSapling = [
  vMesh(mergeGeometries([new THREE.SphereGeometry(.026, 6, 4).translate(0, -.02, 0), new THREE.CylinderGeometry(.005, .007, .07, 5).translate(0, .03, 0)]), 0x6b4a2e, .95),
  vMesh(new THREE.ConeGeometry(.04, .09, 6).translate(0, .1, 0), 0x4f9a3c, .8),
];
const vPlanks = vMesh(mergeGeometries([0, 1, 2].map(k => new THREE.BoxGeometry(.3, .016, .065).translate(0, .19 + k * .018, .13 + (k - 1) * .012))), 0xd8aa70, .85);
// Hüte zeigen den Beruf: rote Mütze (Holzfäller), grüner Filzhut (Förster), braune Schiebermütze (Säger)
const vHats = {
  lumber: vMesh(mergeGeometries([new THREE.SphereGeometry(.084, 10, 6, 0, Math.PI * 2, 0, Math.PI * .52).translate(0, HEAD_Y + .006, 0), new THREE.CylinderGeometry(.086, .086, .025, 10).translate(0, HEAD_Y + .006, 0), new THREE.SphereGeometry(.022, 6, 4).translate(0, HEAD_Y + .09, 0)]), 0xb8392c, .95),
  forester: vMesh(mergeGeometries([new THREE.CylinderGeometry(.125, .125, .012, 12).translate(0, HEAD_Y + .035, 0), new THREE.CylinderGeometry(.06, .078, .075, 10).translate(0, HEAD_Y + .075, 0)]), 0x3f6b2a, .95),
  sawyer: vMesh(mergeGeometries([new THREE.SphereGeometry(.083, 10, 6, 0, Math.PI * 2, 0, Math.PI * .45).scale(1, .8, 1).translate(0, HEAD_Y + .02, -.004), new THREE.BoxGeometry(.1, .01, .05).translate(0, HEAD_Y + .03, .085)]), 0x6b4a2e, .95),
};
const vAll = [vParts.legL, vParts.legR, vParts.body, vParts.armL, vParts.armR, vParts.head, vParts.eyes, ...vParts.hair, vParts.beard, ...vWood, ...vAxe, vLantern, vLanternGlass, vBread, ...vShovel, ...vSapling, vPlanks, ...Object.values(vHats)];
// Lichtschein nachts: Lichthöfe um Laternen (zur Kamera gedreht) und warme Lichtflecken am Boden vor Türen und unter Laternen
const glowMat = c => new THREE.MeshBasicMaterial({ map: glowTex, color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
const haloMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(0xffb85c), VCAP + 64);
const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat(0xff9f45), VCAP + 128);
for (const m of [haloMesh, poolMesh]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 2; scene.add(m); }
// Lichtflecken am Boden addieren sich nicht (sonst wird eine Gruppe mit Laternen grell), es zählt der hellste
Object.assign(poolMesh.material, { polygonOffset: true, polygonOffsetFactor: -2, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, premultipliedAlpha: true });
const lights = []; // Laternen dieses Frames: { x, y, z }
const lV = new THREE.Vector3();
// Holzspäne beim Axthieb
const CHIP_N = 48, chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.03, .012, .022), new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: .9, flatShading: true }), CHIP_N);
chipMesh.frustumCulled = false; chipMesh.count = 0; scene.add(chipMesh);
const chips = [];
function spawnChips(x, y, z, h) {
  for (let k = 0; k < 5; k++) {
    if (chips.length >= CHIP_N) chips.shift();
    const a = h + Math.PI + rnd(1.3), sp = .8 + Math.random() * 1.2;
    chips.push({ x, y, z, vx: Math.sin(a) * sp, vy: 1 + Math.random() * 1.4, vz: Math.cos(a) * sp, r: Math.random() * 6, life: .7 });
  }
}
function updateChips(dt) {
  for (let i = chips.length - 1; i >= 0; i--) {
    const c = chips[i]; c.life -= dt;
    if (c.life <= 0) { chips.splice(i, 1); continue; }
    c.vy -= 6 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.r += dt * 14;
    const g = surfaceAt(c.x, c.z); if (c.y < g) { c.y = g; c.vx *= .5; c.vz *= .5; c.vy = 0; }
  }
  chips.forEach((c, i) => { dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.r, c.r * .7, 0); dummy.scale.setScalar(Math.min(1, c.life / .2)); dummy.updateMatrix(); chipMesh.setMatrixAt(i, dummy.matrix); });
  chipMesh.count = chips.length; chipMesh.instanceMatrix.needsUpdate = true;
}
// Spatenstich: anheben, mit Gewicht hineinstechen, Erde herauswerfen
const DIG_T = .9;
function digPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .4) { const e = sm(p / .4); return { arm: -.75 - .55 * e, tilt: .1 }; }
  if (p < .55) { const e = (p - .4) / .15; return { arm: -1.3 + .75 * e * e, tilt: .1 + .25 * e }; }
  const e = sm((p - .55) / .45); return { arm: -.55 - .2 * e, tilt: .35 - .25 * e };
}
// Ein Axthieb dauert CHOP_T Sekunden: ausholen, zuschlagen (Treffer bei CHOP_HIT), zurücknehmen
const CHOP_T = .8, CHOP_HIT = .72;
function chopPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .55) { const e = sm(p / .55); return { arm: -.9 - 2.1 * e, tilt: -.12 * e, bob: 0 }; }
  if (p < CHOP_HIT) { const e = ((p - .55) / (CHOP_HIT - .55)) ** 2; return { arm: -3 + 1.75 * e, tilt: -.12 + .4 * e, bob: -.012 * e }; }
  const e = sm((p - CHOP_HIT) / (1 - CHOP_HIT)); return { arm: -1.25 + .35 * e, tilt: .28 * (1 - e), bob: -.012 * (1 - e) };
}
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
reconcileJobs();

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
  // In der Grundpose vermessen: ein wiederverwendetes Modell kann noch liegen oder geduckt sein, und die
  // Begrenzungsbox von Skinned-Meshes hängt von der Pose ab. Sonst wird das Tier mal riesig, mal winzig.
  resetBones(model);
  model.scale.setScalar(1); model.rotation.set(0, 0, 0); model.position.set(0, 0, 0);
  const size = restBox(model).getSize(new THREE.Vector3());
  model.scale.setScalar(C.h / size.y);
  // Blickrichtung aus der Kopfposition ableiten, damit +Z vorne ist
  let box = restBox(model); const head = model.getObjectByName(C.head || 'Head'), c = box.getCenter(new THREE.Vector3());
  if (head) { const hp = head.getWorldPosition(new THREE.Vector3()); model.rotation.y = -Math.atan2(hp.x - c.x, hp.z - c.z); }
  box = restBox(model); model.position.y = -box.min.y;
  const dims = box.getSize(new THREE.Vector3());
  // Fell erst nach dem Vermessen anlegen: die Schichten sind Skinned-Meshes ohne berechnete Knochenmatrizen
  if (fur && !model.userData.fur) model.userData.fur = addFur(model);
  model.traverse(o => { if (o.userData.shell) o.castShadow = o.receiveShadow = false; }); // Fellschichten werfen keinen Schatten
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const [k, re] of Object.entries(ANIM_PAT)) { const clip = gltf.animations.find(a => re.test(a.name)); if (clip) acts[k] = mixer.clipAction(clip); }
  for (const [k, [f, ts]] of Object.entries(ANIM_FALLBACK)) if (!acts[k] && acts[f]) { acts[k] = mixer.clipAction(acts[f].getClip().clone()); acts[k].timeScale = ts; }
  if (acts.walk) acts.walk.timeScale = C.ws;
  if (C.rest && acts.idle) for (const [k, clip] of Object.entries(buildPoseClips(model, acts.idle.getClip(), C.rest))) acts[k] = mixer.clipAction(clip);
  if (C.react && acts.idle) for (const [k, clip] of Object.entries(buildReactClips(model, acts.idle.getClip()))) acts[k] = mixer.clipAction(clip);
  for (const k of ['hit', 'jump', 'lieDown', 'standUp', 'cast', 'praise', 'scold']) if (acts[k]) { acts[k].setLoop(THREE.LoopOnce); acts[k].clampWhenFinished = true; }
  // Augen in der Idle-Pose ausrichten, weil der Kopf dort anders steht als in der Ruhepose
  if (C.eyes && head && acts.idle && !model.userData.eyes) { model.userData.eyes = true; acts.idle.reset().play(); mixer.update(0); addEyes(model, head, C.eyes); acts.idle.stop(); }
  return { model, mixer, acts, cur: null, id, dims };
}
// Knochen auf ihre Werte beim Laden zurücksetzen. Nicht skeleton.pose(): das rechnet bei aus Blender
// exportierten Modellen die Skalierung des Armature-Knotens (×100) ein zweites Mal ein.
function resetBones(model) {
  model.traverse(o => {
    if (!o.isBone) return;
    const r = o.userData.rest || (o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
    o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s);
  });
  model.updateMatrixWorld(true);
}
// Begrenzungsbox in der aktuellen Knochenpose (nach resetBones also die Grundpose). Skinned-Meshes werden über
// ihre verformten Vertices vermessen, weil die rohe Geometrie je nach Export in einem anderen Raum liegt.
function restBox(model) {
  const box = new THREE.Box3(), b = new THREE.Box3(), v = new THREE.Vector3(); model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!o.isMesh || o.userData.shell) return;
    if (o.isSkinnedMesh) {
      o.skeleton.update(); const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) { o.getVertexPosition(i, v); box.expandByPoint(v.applyMatrix4(o.matrixWorld)); }
    } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); }
  });
  return box;
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
  resetBones(model);
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
// Eigene Reaktionen auf Lob und Tadel (bisher nur Fuchs, CREATURES.*.react):
// Lob = Schwanz hoch und wedeln, Ohren nach vorn, kleines Wippen; Tadel = Schwanz zwischen die Beine,
// Ohren angelegt, Kopf gesenkt und abgewandt, geduckt. Beides endet wieder in der Grundhaltung.
function buildReactClips(model, baseClip) {
  const ears = a => ({ Ear1L: [a, 0, 0], Ear1R: [a, 0, 0] });
  const up = { rot: { Tail1: [22, 0, 0], Tail2: [8, 0, 0], Neck1: [-6, 0, 0], Head: [-10, 0, 0], ...ears(14) }, pos: { Body: [0, .03, 0] } };
  const wag = (side, bob) => ({ rot: { ...up.rot, Tail2: [8, 18 * side, 0], Tail3: [0, 14 * side, 0], Tail5: [0, 11 * side, 0], Tail7: [0, 8 * side, 0], Head: [-10, -5 * side, 0] }, pos: { Body: [0, .03 + bob, 0] } });
  const praise = [{ t: 0, pose: NO_POSE }, { t: .22, pose: up }];
  for (let i = 0; i < 9; i++) praise.push({ t: .36 + i * .15, pose: wag(i % 2 ? -1 : 1, i % 2 ? 0 : .035) });
  praise.push({ t: praise[praise.length - 1].t + .3, pose: NO_POSE });
  const duck = (turn, sink) => ({ rot: { Back: [6, 0, 0], Tail1: [-58, 0, 0], Tail2: [-38, 0, 0], Tail3: [-22, 0, 0], Tail5: [-10, 0, 0], Neck1: [16, turn * .5, 0], Head: [12, turn, 0], ...ears(-55) }, pos: { Body: [0, -sink, 0] } });
  const scold = [{ t: 0, pose: NO_POSE }, { t: .32, pose: duck(26, .08) }, { t: 1.1, pose: duck(32, .09) }, { t: 1.8, pose: duck(24, .08) }, { t: 2.35, pose: NO_POSE }];
  return { praise: poseClip(model, baseClip, 'praise', praise), scold: poseClip(model, baseClip, 'scold', scold) };
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
// Porträt im Charakter-Blatt: eigene kleine 3D-Ansicht mit einer zweiten Instanz des Tiers (beim Fuchs das
// Fell-Modell), die jede Animation des Tiers in der Welt mitspielt. Eigener Renderer, die Weltkamera bleibt unberührt.
const portrait = { hand: null, renderer: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .05, 60), pivot: new THREE.Group(), rig: null, loading: null, cache: {}, look: new THREE.Vector3(), dist: 4 };
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
  if (!P.hand && !P.handLoading) P.handLoading = load('hand/GodHand.glb').then(g => { P.hand = makeHand(g); P.scene.add(P.hand.g); styleHand(P.hand); }).catch(() => {});
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
// Fürwörter nach dem gewählten Geschlecht der Kreatur (S.gender: 'w' oder 'm')
const pron = () => S.gender === 'm' ? { er: 'er', ihn: 'ihn', ihm: 'ihm' } : { er: 'sie', ihn: 'sie', ihm: 'ihr' };
const ACT_DESC = { help: 'einen Baum ins Lager gebracht', play: 'mit dem Dorf gespielt', mischief: 'einen Baum umgeworfen' };
const ACT_COL = { help: '#8fcf7b', play: '#f3c04d', mischief: '#ee8a72' };

/* ------------------------------------------------------------------ hand */
// Gotteshand (assets/models/hand/GodHand.glb, Quelle assets/source/GodHand.blend): Skinned-Mesh mit 18 Knochen.
// Finger zeigen nach -Z, Handfläche nach unten, Daumen nach +X. Gebeugt wird um die lokale X-Achse der Knochen
// (negativ = zur Handfläche), gespreizt um die lokale Z-Achse.
function makeHand(gltf) {
  const g = new THREE.Group(), model = gltf.scene, bones = {}, rest = {}, mats = {};
  model.rotation.x = .08; g.add(model); // Handfläche fast waagerecht
  model.traverse(o => {
    if (o.isBone) { bones[o.name] = o; rest[o.name] = o.quaternion.clone(); }
    if (o.isMesh) {
      o.castShadow = true; o.frustumCulled = false;
      for (const m of [].concat(o.material)) {
        mats[m.name] = m; m.metalness = m.name === 'Trim' ? .35 : 0;
        m.roughness = { Nails: .3, Trim: .35, Sleeve: .8, SleeveIn: 1 }[m.name] ?? .55;
        if (m.name === 'Skin') { m.emissive = new THREE.Color(0x3a1606); m.emissiveIntensity = .25; } // warmer Schimmer, damit die Hand nicht blass wirkt
      }
    }
  });
  g.visible = false;
  return { g, bones, rest, mats, pose: Object.assign({}, HAND_POSES.relax), curl: .1, pos: new THREE.Vector3(0, 3, 0), prev: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(0, 2, 0) };
}
// Handhaltungen: curl = Finger beugen (0 offen … 1 Faust), thumb = Daumen, spread = spreizen, point = Zeigefinger gestreckt
const HAND_POSES = {
  relax: { curl: .06, thumb: .12, spread: .3, point: 0 }, // offen, Finger fast gestreckt
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
  setBone(h, 'Thumb1', (-40 * P.thumb - 3) * D); setBone(h, 'Thumb2', (-55 * P.thumb - 4) * D);
}
// Aussehen aus dem Spielstand: Haut, Nägel, Ärmel, Saum (Materialnamen aus GodHand.blend)
function styleHand(h) { const st = S.handStyle, M = h.mats; if (M.Skin) M.Skin.color.set(st.skin); if (M.Nails) M.Nails.color.set(st.nails); if (M.Sleeve) M.Sleeve.color.set(st.sleeve); if (M.Trim) M.Trim.color.set(st.trim); }
const hand = makeHand(gHand); scene.add(hand.g); styleHand(hand);

// Gesten der Hand am Tiergeist: Streicheln (über den Rücken streichen) und Klaps (ausholen, zuschlagen)
const handAnim = { kind: null, t: 0, hit: null, hearts: 0 };
const HAND_DUR = { pet: 2.1, slap: .95 }, HAND_HIT = { pet: 2.05, slap: .62 }; // HIT: Reaktion, sobald die Hand weg ist
const BACK_Z = [-.3, -.15, 0, .15, .3]; // Messstellen entlang des Rückens (Anteile der Tierhöhe, + = Kopf)
function playHand(kind, onHit) {
  // ein laufendes oder stehendes Tier hält für die Geste inne (außer es trägt gerade Holz)
  if (fox.state === 'idle' || (fox.state === 'walk' && fox.next !== 'store')) {
    if (fox.tree) { fox.tree.reserved = null; fox.tree = null; } fox.act = null;
    foxIdle(HAND_DUR[kind] + .6); fox.idleA = 'idle'; foxAnim('idle');
  }
  const P = portrait;
  Object.assign(handAnim, { kind, t: 0, hit: onHit, hearts: 0, back: backProfile(), pback: P.rig ? backProfile(P.rig.model, P.pivot) : null });
}
// höchster Punkt nahe der Mittellinie an den Messstellen, im Raum des Tiers (foxPivot), damit die Hand auf dem
// Rücken aufliegt statt einzusinken
function backProfile(model = foxModel, space = foxPivot) {
  const h = CREATURES[fox.kind].h, out = BACK_Z.map(() => -1e9), v = new THREE.Vector3();
  if (!model) return out.map(() => h * .62);
  space.updateMatrixWorld(true);
  const fur = model.userData.fur ? FUR.len * 1.3 : 0;
  model.traverse(m => {
    if (!m.isSkinnedMesh || m.userData.shell) return;
    m.skeleton.update(); const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      m.getVertexPosition(i, v); space.worldToLocal(v.applyMatrix4(m.matrixWorld)); if (Math.abs(v.x) > .12 * h) continue;
      BACK_Z.forEach((z, k) => { if (Math.abs(v.z - z * h) < .07 * h && v.y > out[k]) out[k] = v.y; });
    }
  });
  return out.map(y => (y > -1e8 ? y : h * .62) + fur);
}
function backAt(back, z, h) { // Rückenhöhe an Längsposition z (linear zwischen den Messstellen)
  const f = clamp((z / h - BACK_Z[0]) / (BACK_Z[1] - BACK_Z[0]), 0, BACK_Z.length - 1.001), i = Math.floor(f);
  return back[i] + (back[i + 1] - back[i]) * (f - i);
}
function updateHandAnim(dt, t) {
  // Positionen im Raum des Tiers (schaut nach +Z), dann in die Welt übertragen
  const A = handAnim, C = CREATURES[fox.kind]; A.t += dt;
  const s = clamp(C.h / 2.2, .55, 1.2);
  const ease = x => x * x * (3 - 2 * x), seg = (a, b) => clamp((A.t - a) / (b - a), 0, 1);
  let along = 0, lift = 0, tilt = 0, pose = HAND_POSES.relax;
  if (A.kind === 'pet') {
    // herabsinken, drei Striche vom Nacken zum Rücken, wieder abheben
    const down = ease(seg(0, .45)), up = ease(seg(1.75, 2.1)), stroke = seg(.45, 1.75);
    along = .25 - (stroke * 3 % 1) * .5; lift = (1 - down) * 1.4 + up * 1.4 + Math.sin(stroke * 3 * Math.PI) ** 2 * .06;
    tilt = -.32; pose = { curl: .25 + Math.sin(A.t * 9) * .08, thumb: .2, spread: .3, point: 0 };
    if (stroke > 0 && A.hearts < 3 && A.t > .55 + A.hearts * .43) { A.hearts++; floatText(fox.x, foxPivot.position.y + C.h + .4, fox.z, '♥', 'love'); }
  } else {
    // ausholen, schnell zuschlagen, zurückziehen
    const raise = ease(seg(0, .3)), swat = seg(.3, .42), away = ease(seg(.55, .95));
    lift = raise * .7 - swat * swat * .62 + away * 1.2; along = -.1; tilt = raise * .5 - swat * .7; pose = A.t < .5 ? HAND_POSES.flat : HAND_POSES.relax;
  }
  if (A.hit && A.t >= HAND_HIT[A.kind]) { A.hit(); A.hit = null; }
  hand.g.visible = true; hand.g.scale.setScalar(s);
  // Handfläche liegt etwa 0,07 (Handmaß) über ihrem Ursprung auf: so knapp über dem Rücken
  hand.g.position.set(0, backAt(A.back, along * C.h, C.h) + .07 * s + lift, along * C.h); foxPivot.localToWorld(hand.g.position);
  hand.g.rotation.set(tilt, fox.h + Math.PI, 0, 'YXZ'); // Finger zeigen zum Kopf
  poseHand(hand, pose, dt, t, 18);
  // dieselbe Geste an der zweiten Hand im Porträt (Tier steht dort im Ursprung, Blick nach +Z)
  const P = portrait, ph = P.hand;
  if (ph && A.pback) {
    ph.g.visible = true; ph.g.scale.setScalar(s); ph.g.rotation.set(tilt, Math.PI, 0, 'YXZ');
    ph.g.position.set(0, backAt(A.pback, along * C.h, C.h) + .07 * s + lift, along * C.h); P.pivot.localToWorld(ph.g.position);
    poseHand(ph, pose, dt, t, 18);
  }
  if (A.t >= HAND_DUR[A.kind]) { A.kind = null; hand.g.visible = false; hand.g.scale.setScalar(1); hand.g.rotation.set(0, 0, 0); if (ph) ph.g.visible = false; }
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
let incomeAcc = 0, rate = 0;
function addGlaube(n, x, y, z) { S.glaube += n; incomeAcc += n; if (x !== undefined) floatText(x, y + .7, z, '+' + fmt1(n) + ' ✦', 'g'); }
function addHolz(n, x, y, z) { S.holz += n; if (x !== undefined) floatText(x, y + .7, z, '+' + n + ' Bretter', 'h'); }
function addLogs(n, x, y, z) { S.logs += n; if (x !== undefined) floatText(x, y + .7, z, `+${n} ${n === 1 ? 'Stamm' : 'Stämme'}`, 'h'); }

/* ------------------------------------------------------------------ Berufe */
// Zugewiesene Bewohner je Arbeitsstätte (0 oder mindestens min, höchstens so viele, wie es Bewohner gibt)
function effJobs() {
  const out = {}; let free = villagers.length;
  for (const id in WORKS) { let k = Math.min(S.jobs[id] | 0, free); if (k < WORKS[id].min) k = 0; out[id] = k; free -= k; }
  return out;
}
// gewünschte Spezialisten je Beruf (ohne Rücksicht auf Hüttenplätze)
function wantRoles() { const e = effJobs(), w = {}; for (const r in ROLES) w[r] = 0; for (const id in WORKS) { const sp = WORKS[id].split(e[id]); if (e[id]) for (const r in sp) w[r] += sp[r]; } return w; }
function hutCap(r) { return huts.filter(h => h.role === r).length * ROLES[r].per; }
function leaveJob(v) {
  if (v.tree) { if (v.tree.reserved === v) v.tree.reserved = null; v.tree = null; }
  // Last abgeben: ein Stamm geht zurück ins Lager, fertige Bretter zählen als Holz (außer er ist schon auf dem Weg dorthin)
  if (v.state === 'saw' && v.hut) v.hut.logs++; // angefangener Stamm bleibt an der Säge
  const keep = v.state === 'walk' && v.next === 'store';
  if (v.carry && !keep) { if (v.carry === 1) S.logs++; v.carry = 0; }
  if (['chop', 'plant', 'saw'].includes(v.state) || (v.state === 'walk' && !keep)) idle(v, .3);
  v.role = null; v.hut = null; v.saplings = 0;
}
// Bewohner auf Berufe verteilen: so viele wie gewünscht und Hüttenplätze frei sind, der Rest betet als Dorfbewohner
function reconcileJobs() {
  const want = wantRoles();
  for (const r in ROLES) {
    const n = Math.min(want[r], hutCap(r)), cur = villagers.filter(v => v.role === r);
    // Überzählige gehen zurück ins Dorf (zuerst die, die gerade nichts tragen)
    cur.sort((a, b) => (a.carry ? 1 : 0) - (b.carry ? 1 : 0));
    for (let k = n; k < cur.length; k++) leaveJob(cur[k]);
    let need = n - Math.min(n, cur.length);
    for (const v of villagers) {
      if (need <= 0) break;
      if (v.role || v.haul || v.state === 'grabbed' || v.state === 'falling') continue;
      const hs = huts.filter(h => h.role === r).sort((a, b) => villagers.filter(x => x.hut === a).length - villagers.filter(x => x.hut === b).length)[0];
      v.role = r; v.hut = hs; v.saplings = 0; need--;
      if (v.state === 'pray' || v.state === 'idle') idle(v, .2 + Math.random() * .6);
    }
  }
}
function roleCount(r) { return villagers.filter(v => v.role === r).length; }

/* ------------------------------------------------------------------ villager AI */
function walk(v, x, z, next) { v.state = 'walk'; v.next = next; setGoal(v, x, z, navV); }
function idle(v, t) { v.state = 'idle'; v.timer = t; }
function goLunch(v) { const a = Math.random() * Math.PI * 2, r = .85 + Math.random() * 1.6; walk(v, LUNCH_AT.x + Math.cos(a) * r, LUNCH_AT.z + Math.sin(a) * r, 'lunch'); }
function goHome(v) {
  const hs = houses[villagers.indexOf(v) % Math.max(1, houses.length)]; if (!hs) { idle(v, 2); return; }
  v.home = hs; const d = houseDoor(hs, .12 + Math.random() * .1); walk(v, d.x, d.z, 'sleep');
}
function goPray(v) { const a = Math.random() * Math.PI * 2, r = 1.95 + Math.random() * .9; walk(v, SHRINE_POS.x + Math.cos(a) * r, SHRINE_POS.z + Math.sin(a) * r, 'pray'); }
function findTree(x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < 24; i++) { const t = trees[Math.floor(Math.random() * trees.length)]; if (!t || !t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}
function chooseJob(v) {
  if (S.hour >= BED || S.hour < WAKE) { goHome(v); return; }           // Feierabend: heim in die Hütte
  if (S.hour >= LUNCH[0] && S.hour < LUNCH[1]) { goLunch(v); return; } // Mittagspause am Brunnen
  if (v.wish) { if (wish.kind && wish.by === v) { goBeg(v); return; } v.wish = false; }
  if (v.role && v.hut) { JOB[v.role](v); return; }
  if (haulJob(v)) return;
  // Dorfbewohner beten am Schrein, ab und zu ruhen sie sich aus
  if (Math.random() < .88) goPray(v); else { const p = homeSpot(); walk(v, p.x, p.z, 'rest'); }
}
// Träger: freie Dorfbewohner bringen Stämme aus dem Lager zur Sägemühle und Bretter zurück ins Lager.
// Was unterwegs ist, wird pro Mühle mitgezählt, so tragen immer nur so viele, wie gebraucht werden.
const MILL_BUF = 4;
function hauling(hs, kind) { let n = 0; for (const v of villagers) if (v.haul && v.haul.hut === hs && v.haul.kind === kind) n += v.haul.n; return n; }
function haulJob(v) {
  if (v.haul) { // angefangenen Auftrag fortsetzen (z. B. nach Mittagspause, Flucht oder Wurf)
    const H = v.haul;
    if (v.carry === 1) { const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + .2, 'dropLogs'); return true; }
    if (v.carry === 2) { const p = lagerDrop(); walk(v, p.x, p.z, 'deliver'); return true; }
    v.haul = null;
  }
  for (const hs of huts) {
    if (hs.role !== 'sawyer') continue;
    const out = hs.planks - hauling(hs, 'out');
    if (out >= 2) { v.haul = { hut: hs, kind: 'out', n: Math.min(4, out) }; const p = hutWork(hs); walk(v, p.x + rnd(.2), p.z + .25, 'pickPlanks'); return true; }
    const room = MILL_BUF - hs.logs - hauling(hs, 'in'), have = Math.floor(S.logs) - villagers.reduce((a, x) => a + (x.haul && x.haul.kind === 'in' && !x.carry ? x.haul.n : 0), 0);
    if (room >= 1 && have >= 1) { v.haul = { hut: hs, kind: 'in', n: Math.min(2, room, have) }; const p = lagerDrop(); walk(v, p.x, p.z, 'pickLogs'); return true; }
  }
  return false;
}
function atHut(v, next = 'rest') { const p = hutWork(v.hut); walk(v, p.x + rnd(.25), p.z + rnd(.25), next); }
// freier Platz für einen Setzling: leerer Baumplatz oder Stumpf nahe der Hütte, sonst ein neuer Platz am Waldrand
function plantSpot(x, z) {
  let best = null, bd = 1e9;
  for (const t of trees) if (freeSlot(t)) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
  if (best && bd < 14 * 14) return { tree: best };
  const alive = trees.filter(t => t.alive && !t.gone);
  for (let i = 0; i < 30 && alive.length; i++) {
    const o = alive[Math.floor(Math.random() * alive.length)], a = Math.random() * 6.28, r = 1.2 + Math.random() * 1.3, px = o.x + Math.cos(a) * r, pz = o.z + Math.sin(a) * r, h = heightAt(px, pz);
    if (h > .45 && h < 3 && Math.hypot(px, pz) > 8.5 && !treeNear(px, pz, 1) && !hutSites.some(st => st.used && Math.hypot(st.x - px, st.z - pz) < 1.5) && trees.length < 480) return { x: px, z: pz };
  }
  return best ? { tree: best } : null;
}
const JOB = {
  lumber(v) { // Baum suchen (nahe der eigenen Hütte), fällen, Stamm ins Lager
    const t = findTree(v.hut.x, v.hut.z);
    if (t) { t.reserved = v; v.tree = t; const a = Math.random() * 6.28; walk(v, t.x + Math.cos(a) * .4, t.z + Math.sin(a) * .4, 'tree'); } else atHut(v);
  },
  forester(v) { // Setzlinge an der Hütte holen, dann einen nach dem anderen pflanzen
    if (!(v.saplings > 0)) { atHut(v, 'fetchSap'); return; }
    const sp = plantSpot(v.hut.x, v.hut.z); if (!sp) { atHut(v); return; }
    v.plant = sp; const tx = sp.tree ? sp.tree.x : sp.x, tz = sp.tree ? sp.tree.z : sp.z, a = Math.random() * 6.28;
    if (sp.tree) { sp.tree.reserved = v; v.tree = sp.tree; }
    walk(v, tx + Math.cos(a) * .3, tz + Math.sin(a) * .3, 'plant');
  },
  sawyer(v) { // bleibt an der Säge und sägt, was die Träger bringen
    const p = hutWork(v.hut);
    if (Math.hypot(v.x - p.x, v.z - p.z) > .3) { walk(v, p.x, p.z, 'saw'); return; }
    startSaw(v);
  },
};
function startSaw(v) {
  const hs = v.hut, sw = localPt(hs, .28, .12); v.h = Math.atan2(sw.x - v.x, sw.z - v.z);
  if (hs.logs >= 1) { hs.logs--; v.carry = 1; v.state = 'saw'; v.timer = 2.4; } else idle(v, 1); // wartet auf Stämme
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
    case 'tree': if (v.tree && v.tree.alive) { v.state = 'chop'; v.timer = 2.4; v.cp = 0; v.h = Math.atan2(v.tree.x - v.x, v.tree.z - v.z); } else { if (v.tree) v.tree.reserved = null; v.tree = null; idle(v, .4); } break;
    case 'store': v.carry = 0; addLogs(1, v.x, v.y + .2, v.z); idle(v, .4); break;
    case 'saw': if (v.role === 'sawyer' && v.hut) startSaw(v); else idle(v, .4); break;
    case 'pickLogs': { // Träger nimmt Stämme im Lager
      const H = v.haul, n = H ? Math.min(H.n, Math.floor(S.logs)) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      S.logs -= n; H.n = n; v.carry = 1; const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + .2, 'dropLogs'); break;
    }
    case 'dropLogs': if (v.haul) { v.haul.hut.logs += v.haul.n; floatText(v.x, v.y + .6, v.z, `${v.haul.n} ${v.haul.n === 1 ? 'Stamm' : 'Stämme'} abgeladen`, 'h'); } v.carry = 0; v.haul = null; idle(v, .3); break;
    case 'pickPlanks': { // Träger holt Bretter an der Säge
      const H = v.haul, n = H ? Math.min(H.n, H.hut.planks) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      H.hut.planks -= n; H.n = n; v.carry = 2; const p = lagerDrop(); walk(v, p.x, p.z, 'deliver'); break;
    }
    case 'deliver': { const n = v.haul ? v.haul.n : 2; v.carry = 0; v.haul = null; addHolz(n, v.x, v.y + .2, v.z); idle(v, .4); break; }
    case 'fetchSap': v.saplings = 3; idle(v, .9); break;
    case 'plant':
      if (v.plant && (!v.plant.tree || v.plant.tree.reserved === v)) { v.state = 'plant'; v.timer = 3 * DIG_T; v.cp = 0; const pt = v.plant.tree || v.plant; v.h = Math.atan2(pt.x - v.x, pt.z - v.z); }
      else { v.plant = null; idle(v, .3); }
      break;
    case 'pray': v.state = 'pray'; v.timer = 2 * PRAY_T; v.h = Math.atan2(SHRINE_POS.x - v.x, SHRINE_POS.z - v.z); break;
    case 'beg': if (v.wish && wish.kind) { v.state = 'beg'; v.timer = 0; v.h = Math.atan2(wish.at.x - v.x, wish.at.z - v.z); } else idle(v, .3); break;
    case 'lunch': v.state = 'lunch'; v.until = LUNCH[1] + Math.random() * .4; v.h = Math.atan2(LUNCH_AT.x - v.x, LUNCH_AT.z - v.z); break;
    case 'sleep': // verschwindet in der Hütte, wacht morgens zu einer eigenen Zeit auf
      if (S.hour >= BED || S.hour < WAKE) { v.state = 'sleep'; v.wake = WAKE + Math.random() * .9; if (v.home) v.h = Math.atan2(v.home.x - v.x, v.home.z - v.z) + Math.PI; }
      else idle(v, .3);
      break;
    default: idle(v, .8 + Math.random() * 2.5);
  }
}
function updateVillager(v, dt, t) {
  if (v.haste > 0) v.haste -= dt;
  if (v.cheer > 0) v.cheer -= dt;
  const sp = .95 * (v.haste > 0 ? 2.3 : 1);
  switch (v.state) {
    case 'idle': v.timer -= dt; if (v.timer <= 0) chooseJob(v); break;
    case 'walk': addWear(v.x, v.z, dt); if (followPath(v, sp * dt)) arrive(v); break;
    case 'chop': {
      const k = dt * (v.haste > 0 ? 2 : 1), before = v.cp % 1; v.timer -= k; v.cp += k / CHOP_T;
      const tr = v.tree, now = v.cp % 1;
      if (tr && tr.alive && ((before < CHOP_HIT && now >= CHOP_HIT) || (now < before && before < CHOP_HIT))) { // Treffer
        tr.shake = 1; spawnChips(tr.x - Math.sin(v.h) * .08, surfaceAt(tr.x, tr.z) + .22, tr.z - Math.cos(v.h) * .08, v.h);
      }
    }
      if (v.timer <= 0) { const tr = v.tree; v.tree = null; if (tr && tr.alive) { chopTree(tr); fallTree(tr, v.x, v.z, 2.4); v.carry = 1; const p = lagerDrop(); walk(v, p.x, p.z, 'store'); } else idle(v, .4); } break;
    case 'pray': {
      const k = dt * (v.haste > 0 ? 2 : 1), before = ((2 * PRAY_T - v.timer) / PRAY_T) % 1; v.timer -= k;
      const now = ((2 * PRAY_T - v.timer) / PRAY_T) % 1;
      if (before < .4 && now >= .4 && v.timer > 0) spawnMote(v.x + Math.sin(v.h) * .05, v.y + .45, v.z + Math.cos(v.h) * .05); // Arme oben: Funke steigt auf
    }
      if (v.timer <= 0) { addGlaube(prayYield(), v.x, v.y, v.z); idle(v, 1 + Math.random() * 3); } break;
    case 'lunch': if (S.hour >= v.until || S.hour < LUNCH[0]) idle(v, Math.random() * 1.5); break;
    case 'beg': // kniet und fleht, ab und zu steigt ein Funke auf
      if (!v.wish || !wish.kind) { idle(v, .4); break; }
      v.timer += dt; if (v.timer > 1.6) { v.timer = 0; spawnMote(v.x, v.y + .45, v.z); } break;
    case 'saw': { // Stamm an der Kreissäge entlangschieben, Sägemehl fliegt
      const k = dt * (v.haste > 0 ? 2 : 1); v.timer -= k; if (v.hut) v.hut.sawing = .3;
      if (Math.random() < dt * 6 && v.hut) { const sw = localPt(v.hut, .28, .12); spawnChips(sw.x, heightAt(sw.x, sw.z) + .45, sw.z, v.h + Math.PI); }
      if (v.timer <= 0) { v.carry = 0; if (v.hut) { v.hut.planks += 2; floatText(v.x, v.y + .7, v.z, '+2 Bretter', 'h'); } idle(v, .2); }
      break;
    }
    case 'plant': {
      const k = dt * (v.haste > 0 ? 2 : 1), before = v.cp % 1; v.timer -= k; v.cp += k / DIG_T;
      const now = v.cp % 1; if ((before < .55 && now >= .55) || now < before) spawnChips(v.x + Math.sin(v.h) * .2, v.y + .03, v.z + Math.cos(v.h) * .2, v.h + Math.PI);
      if (v.timer <= 0) {
        const sp = v.plant; v.plant = null; v.saplings = Math.max(0, (v.saplings || 0) - 1);
        let t = null;
        if (sp && sp.tree && sp.tree.reserved === v) { t = sp.tree; t.reserved = null; Object.assign(t, { alive: true, g: .12, stumpT: 0, regrow: 0, type: treeKindAt(t.x, t.z) }); }
        else if (sp && !sp.tree && !treeNear(sp.x, sp.z, .9)) t = addTree(sp.x, sp.z, .12);
        if (v.tree) { if (v.tree.reserved === v) v.tree.reserved = null; v.tree = null; }
        if (t) floatText(t.x, heightAt(t.x, t.z) + .5, t.z, 'Gepflanzt', 's');
        idle(v, .4);
      }
      break;
    }
    case 'sleep': if (S.hour >= v.wake && S.hour < BED) idle(v, .2 + Math.random()); break;
    case 'flee': v.timer -= dt; if (moveFree(v, v.tx, v.tz, 2.2 * dt, navV) === true || v.timer <= 0) idle(v, .6); break;
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
function foxWalk(x, z, next) { fox.state = 'walk'; fox.next = next; setGoal(fox, x, z, navF); }
function foxFinish(a) {
  fox.last = a; fox.lastT = clock.elapsedTime; foxIdle(5 + Math.random() * 4); fox.act = null;
  toast(`${S.name} hat ${ACT_DESC[a]}. Lob oder Tadel?`, 4.5);
  $('btnFox').classList.add('pulse');
  renderFox();
}
function foxChoose() {
  // ab und zu hinlegen und ausruhen
  if (foxActs.lie && Math.random() < .25) { // zum Dösen erst dorthin, wo der ganze liegende Körper Platz hat
    const p = restSpot(); if (Math.hypot(p.x - fox.x, p.z - fox.z) > .15) { foxWalk(p.x, p.z, 'rest'); return; }
    fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); return;
  }
  const w = S.w, r = Math.random() * (w.help + w.play + w.mischief);
  let a = r < w.help ? 'help' : r < w.help + w.play ? 'play' : 'mischief';
  if (a !== 'play') {
    let best = null, bd = 1e9;
    for (const t of trees) { if (!t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - fox.x) ** 2 + (t.z - fox.z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) a = 'play'; else { fox.tree = best; best.reserved = 'fox'; const ang = Math.atan2(fox.x - best.x, fox.z - best.z); foxWalk(best.x + Math.sin(ang) * .9, best.z + Math.cos(ang) * .9, 'tree'); }
  }
  fox.act = a;
  if (a === 'play') { fox.pc = playSpot(); foxWalk(fox.pc.x - 1.6, fox.pc.z, 'play'); }
}
// Liegeplatz: rundum frei im Umkreis der halben Körperlänge (Gebäude, Bäume, Felsen, Wasser)
function restSpot() {
  if (!navReady) buildNav();
  const R = CREATURES[fox.kind].h * .5, room = (x, z) => { if (blockedAt(navV, x, z)) return false; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (blockedAt(navV, x + Math.cos(a) * R, z + Math.sin(a) * R) || blockedAt(navV, x + Math.cos(a) * R * .5, z + Math.sin(a) * R * .5)) return false; } return true; };
  if (room(fox.x, fox.z)) return { x: fox.x, z: fox.z };
  for (let r = .5; r < 8; r += .5) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = fox.x + Math.cos(a) * r, z = fox.z + Math.sin(a) * r; if (room(x, z)) return { x, z }; }
  return { x: fox.x, z: fox.z };
}
// freier Spielplatz: ein Kreis (Radius 1,6) nahe der Dorfmitte, auf dem nichts im Weg steht
function playSpot() {
  if (!navReady) buildNav();
  const free = (x, z) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (blockedAt(navF, x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6)) return false; } return true; };
  for (let r = 0; r < 9; r += .75) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + r, x = CENTER.x + Math.cos(a) * r, z = CENTER.z + Math.sin(a) * r; if (free(x, z)) return { x, z }; }
  return CENTER;
}
function updateFox(dt, t) {
  const C = CREATURES[fox.kind], spd = C.walk;
  // eine laufende Einmal-Animation (Lob/Tadel) nicht vom Zustand überschreiben lassen
  const anim = n => { if (fox.once <= 0) foxAnim(n); };
  if (fox.once > 0) fox.once -= dt;
  // Während einer Geste der Hand oder einer Einmal-Animation (Reaktion, Aufstehen, Wunder) bewegt sich das Tier
  // nicht und wechselt nicht die Pose; so gleitet es nie in einer falschen Haltung über den Boden.
  if (!handAnim.kind && fox.once <= 0) switch (fox.state) {
    case 'idle': anim(fox.idleA); fox.timer -= dt; if (fox.timer <= 0) foxChoose(); break;
    case 'rest': anim('lie'); fox.timer -= dt; if (fox.timer <= 0) { foxOnce('standUp'); foxIdle(.4); } break;
    case 'cast': fox.timer -= dt; if (fox.timer <= 0) foxIdle(1.5); break;
    case 'pickup': anim(fox.timer < .85 ? 'eat' : 'idle'); fox.timer -= dt; if (fox.timer <= 0) { fox.carry = true; const p = localPt(lager, -.4, 1.9); foxWalk(p.x, p.z, 'store'); } break;
    case 'walk': anim('walk'); if (followPath(fox, spd * dt)) {
      if (fox.next === 'tree') { if (fox.tree && fox.tree.alive) { fox.state = 'work'; fox.timer = fox.act === 'help' ? 1.8 : 1.1; fox.h = Math.atan2(fox.tree.x - fox.x, fox.tree.z - fox.z); } else { if (fox.tree) fox.tree.reserved = null; foxIdle(1); } }
      else if (fox.next === 'store') {
        // Baum ablegen: er liegt kurz vor dem Lager und wird zu Stämmen
        const C = CREATURES[fox.kind]; fallTree({ type: fox.carryType || 0, g: .55 * C.h / 1.45, x: fox.x + Math.sin(fox.h) * C.h * .25, z: fox.z + Math.cos(fox.h) * C.h * .25 }, fox.x + Math.cos(fox.h), fox.z - Math.sin(fox.h), 1.3, true);
        addLogs(4, fox.x, 1.2, fox.z); fox.carry = false; foxFinish('help');
      }
      else if (fox.next === 'rest') { fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); }
      else if (fox.next === 'play') { fox.state = 'play'; fox.playT = 0; fox.playA = Math.atan2(fox.z - fox.pc.z, fox.x - fox.pc.x); }
    } break;
    case 'work': anim('attack'); fox.timer -= dt; if (fox.timer <= 0) {
      const tr = fox.tree; fox.tree = null;
      if (tr && tr.alive) {
        chopTree(tr);
        if (fox.act === 'help') {
          // Baum kippt um, dann senkt der Tiergeist den Kopf und hebt ihn auf
          fallTree(tr, fox.x, fox.z, FALL_T + .85); fox.carryType = tr.type; fox.state = 'pickup'; fox.timer = FALL_T + .85;
        } else {
          fallTree(tr, fox.x, fox.z, 4.5);
          floatText(tr.x, surfaceAt(tr.x, tr.z) + 1.4, tr.z, 'Krach!', 'w');
          for (const v of villagers) { const dx = v.x - fox.x, dz = v.z - fox.z, d = Math.hypot(dx, dz); if (d < 4.5 && ['idle', 'walk', 'pray', 'chop', 'lunch', 'plant', 'beg'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 2; v.tx = v.x + dx / (d || 1) * 3; v.tz = v.z + dz / (d || 1) * 3; } }
          foxFinish('mischief');
        }
      } else foxIdle(1);
    } break;
    case 'play': {
      anim('run'); fox.playT += dt;
      // im Kreis um einen freien Platz; was im Weg steht, wird nicht durchlaufen
      fox.playA += dt * 1.9; const pc = fox.pc || CENTER, px = pc.x + Math.cos(fox.playA) * 1.6, pz = pc.z + Math.sin(fox.playA) * 1.6;
      moveFree(fox, px, pz, C.run * 1.6 * dt, navF);
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
  updateMouthTree();
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
  if (foxActs.cast) { fox.state = 'cast'; fox.timer = .1; foxOnce('cast'); } // Dauer regelt foxOnce else { fox.hop = .5; foxIdle(1.5); }
}
function reinforce(kind) {
  const t = clock.elapsedTime, a = fox.last;
  if (handAnim.kind) return; // eine Geste nach der anderen
  // die Hand führt die Geste aus; das Tier reagiert erst, wenn sie es wieder losgelassen hat
  playHand(kind, () => {
    const top = foxPivot.position.y + CREATURES[fox.kind].h + .5;
    if (kind === 'pet') {
      floatText(fox.x, top, fox.z, '♥', 'love');
      if (fox.state === 'rest') fox.timer += 4; else foxOnce(foxActs.praise ? 'praise' : 'idle2'); // liegend genießt es einfach weiter
    } else {
      floatText(fox.x, top, fox.z, '!', 'w');
      if (fox.state === 'rest') { foxOnce('standUp'); foxIdle(1); } else if (foxActs.scold) foxOnce('scold'); else { foxOnce('hit'); fox.hop = .5; }
    }
  });
  if (a && t - fox.lastT < 25) {
    S.w[a] = clamp(S.w[a] * (kind === 'pet' ? 1.6 : .5), .04, 10);
    const sum = S.w.help + S.w.play + S.w.mischief; for (const k in S.w) S.w[k] /= sum;
    toast(kind === 'pet' ? `${S.name} lernt: mehr ${ACT_LABEL[a]}.` : `${S.name} lernt: weniger ${ACT_LABEL[a]}.`);
    fox.last = null; $('btnFox').classList.remove('pulse');
  } else toast(kind === 'pet' ? `${S.name} schmiegt sich an deine Hand.` : `${S.name} duckt sich und weiß nicht, wofür.`);
  renderFox(); save();
}

/* ------------------------------------------------------------------ Bitten am Schrein */
// Braucht das Dorf ein Wunder, kniet ein freier Bewohner vor dem Schrein und bittet darum. Erfüllt der Spieler die Bitte
// rechtzeitig, danken die Bewohner mit Glauben (mehr, als das Wunder kostet). Später können kleinere Schreine im Wald
// eigene Bitten haben; dafür ist `wish.at` der Ort, an dem gebetet wird.
const ICON_RAIN = '<svg viewBox="0 0 24 24"><path d="M7 15a4.5 4.5 0 0 1 .6-8.96A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/></svg>';
const ICON_HASTE = '<svg viewBox="0 0 24 24"><path d="M3 12c4-1 7-4 9-8 1 4 4 6 9 7-5 1-8 3-9 7-2-4-5-5-9-6z"/></svg>';
const WISHES = {
  rain: { title: 'Bitte um Regen', text: 'Der Wald schwindet. Die Bewohner bitten dich um Regen für die Bäume.', thanks: 'den Regen', icon: ICON_RAIN,
    need: () => trees.filter(t => t.alive && !t.gone && t.g >= .7).length < 40 },
  haste: { title: 'Bitte um Eile', text: 'Im Lager stapeln sich die Stämme. Die Bewohner bitten dich um Eile für die Säger und Träger.', thanks: 'die Eile', icon: ICON_HASTE,
    need: () => S.logs >= 25 && roleCount('sawyer') > 0 },
};
const wish = { kind: null, t: 0, dur: 90, by: null, cool: 25, checkT: 0, at: SHRINE_POS };
const begSpot = () => shrinePt(rnd(.25), 1.95 + Math.random() * .15);
function goBeg(v) { const p = begSpot(); walk(v, p.x, p.z, 'beg'); }
function startWish(kind) {
  const free = villagers.filter(v => !v.role && !v.haul && !v.carry && ['idle', 'pray', 'walk'].includes(v.state));
  if (!free.length) return;
  free.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const v = free[0]; v.wish = true; goBeg(v);
  Object.assign(wish, { kind, t: wish.dur, by: v });
  toast(WISHES[kind].text, 5);
}
function endWish(cool) {
  const v = wish.by; if (v) { v.wish = false; if (v.state === 'beg') idle(v, .5); }
  wish.kind = null; wish.by = null; wish.cool = cool;
}
function updateWish(dt) {
  wish.cool -= dt;
  if (!wish.kind) {
    if ((wish.checkT -= dt) > 0) return; wish.checkT = 3;
    if (wish.cool > 0 || !workTime()) return;
    const kinds = Object.keys(WISHES).filter(k => WISHES[k].need());
    if (kinds.length) startWish(kinds[Math.floor(Math.random() * kinds.length)]);
    return;
  }
  wish.t -= dt;
  if (wish.t <= 0 || S.hour >= BED) { toast(`Die ${WISHES[wish.kind].title} blieb unerhört.`, 3.5); endWish(60); }
}
// ein Wunder wurde gewirkt: passt es zur Bitte, ist sie erfüllt
function wishDone(kind) {
  if (wish.kind !== kind) return;
  const reward = Math.round(25 + villagers.length * 1.2 + S.temple * 5), W = WISHES[kind];
  addGlaube(reward, wish.at.x, shrine.g.position.y + 2, wish.at.z);
  shrine.pulse = 1; for (let k = 0; k < 8; k++) { const q = shrinePt(rnd(1.5), 1.5 + rnd(.6)); spawnMote(q.x, shrine.g.position.y + .3, q.z); }
  for (const v of villagers) if (Math.hypot(v.x - wish.at.x, v.z - wish.at.z) < 7 && !['grabbed', 'falling', 'sleep'].includes(v.state)) v.cheer = 2.2 + Math.random() * .6;
  if (wish.by) floatText(wish.by.x, wish.by.y + .8, wish.by.z, 'Danke!', 's');
  toast(`Die Bewohner danken dir für ${W.thanks}: +${reward} Glaube.`, 4);
  endWish(100 + Math.random() * 60);
}
// Sprechblase über dem Schrein; Antippen wählt das passende Wunder
function placeWishUI() {
  const B = $('wish');
  B.hidden = !wish.kind || $('app').classList.contains('sheet-open');
  if (B.hidden) return;
  const W = WISHES[wish.kind];
  if (B.dataset.kind !== wish.kind) { B.dataset.kind = wish.kind; $('wishIc').innerHTML = W.icon; $('wishT').textContent = W.title; B.setAttribute('aria-label', `${W.title}: Tippen, um das Wunder zu wählen`); }
  $('wishBar').style.width = `${Math.max(0, wish.t / wish.dur * 100)}%`;
  const r = canvas.getBoundingClientRect(); toScreen(wish.at.x, shrine.g.position.y + 2.75, wish.at.z, tA);
  const bw = B.offsetWidth, bh = B.offsetHeight;
  B.style.transform = `translate(${clamp(tA.x - r.left - bw / 2, 8, r.width - bw - 8)}px, ${clamp(tA.y - r.top - bh, 120, r.height - bh - 120)}px)`;
}

/* ------------------------------------------------------------------ Wald-Warnung der Holzfäller */
// Gibt es im Umkreis einer bewohnten Holzfällerhütte kaum noch schlagreife Bäume, meldet sich der Holzfäller:
// Schild über der Hütte, Ring auf der Lichtung. Regen dort lässt den Wald nachwachsen und löst die Warnung auf.
const FOREST_R = 9, FOREST_LOW = 5;
const forestAlert = { hut: null, at: null, checkT: 0, cool: 20 };
const forestAround = h => trees.reduce((n, t) => n + (t.alive && !t.gone && t.g >= .7 && (t.x - h.x) ** 2 + (t.z - h.z) ** 2 < FOREST_R * FOREST_R ? 1 : 0), 0);
function forestSpot(h) { // Mitte der Stümpfe und leeren Plätze im Umkreis, sonst ein Stück hinter der Hütte
  let sx = 0, sz = 0, n = 0;
  for (const t of trees) if (!t.gone && !t.alive && (t.x - h.x) ** 2 + (t.z - h.z) ** 2 < FOREST_R * FOREST_R) { sx += t.x; sz += t.z; n++; }
  if (n) return { x: sx / n, z: sz / n };
  const d = Math.hypot(h.x, h.z) || 1; return { x: h.x + h.x / d * 3, z: h.z + h.z / d * 3 };
}
const alertRing = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0, depthWrite: false }));
alertRing.visible = false; scene.add(alertRing);
function updateForestAlert(dt, t) {
  const A = forestAlert;
  alertRing.visible = !!A.hut && tool === 'miracle';
  if (alertRing.visible) { alertRing.position.set(A.at.x, Math.max(heightAt(A.at.x, A.at.z), 0) + .12, A.at.z); alertRing.material.opacity = .35 + .25 * Math.sin(t * 3); alertRing.scale.setScalar(1 + .03 * Math.sin(t * 3)); }
  if ((A.checkT -= dt) > 0) return; A.checkT = 2; A.cool -= 2;
  if (A.hut) { if (!huts.includes(A.hut) || forestAround(A.hut) >= FOREST_LOW + 2) A.hut = null; return; }
  if (A.cool > 0) return;
  for (const h of huts) if (h.role === 'lumber' && villagers.some(v => v.hut === h) && forestAround(h) < FOREST_LOW) {
    A.hut = h; A.at = forestSpot(h); toast('Ein Holzfäller meldet: Sein Wald geht zur Neige. Regen dort lässt ihn nachwachsen.', 4.5); break;
  }
}
function forestHelped(x, z) { // nach einem Regen
  const A = forestAlert; if (!A.hut || Math.hypot(x - A.at.x, z - A.at.z) > 6) return;
  addGlaube(10, A.hut.x, heightAt(A.hut.x, A.hut.z) + 1.4, A.hut.z); floatText(A.hut.x, heightAt(A.hut.x, A.hut.z) + 2, A.hut.z, 'Danke!', 's');
  toast('Der Holzfäller dankt dir: Sein Wald wächst nach.', 3); A.hut = null; A.cool = 60;
}
function placeForestUI() {
  const B = $('forestAlert'), A = forestAlert;
  B.hidden = !A.hut || $('app').classList.contains('sheet-open');
  if (B.hidden) return;
  const r = canvas.getBoundingClientRect(); toScreen(A.hut.x, heightAt(A.hut.x, A.hut.z) + 2.2, A.hut.z, tA);
  const bw = B.offsetWidth, bh = B.offsetHeight, off = tA.x < r.left || tA.x > r.right || tA.y < r.top || tA.y > r.bottom;
  B.classList.toggle('edge', off); // außerhalb des Bildes: am Rand festhalten
  B.style.transform = `translate(${clamp(tA.x - r.left - bw / 2, 8, r.width - bw - 8)}px, ${clamp(tA.y - r.top - bh, 120, r.height - bh - 120)}px)`;
}

/* ------------------------------------------------------------------ miracles */
function castRain(x, z) {
  rain.t = 5.5; rain.x = x; rain.z = z; rainPts.visible = true; rainCloud.visible = true;
  const p = rainGeo.attributes.position;
  for (let i = 0; i < RAIN_N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4; p.setXYZ(i, x + Math.cos(a) * r, Math.random() * 7, z + Math.sin(a) * r); }
  let rev = 0;
  for (const t of trees) { if (t.gone || (t.x - x) ** 2 + (t.z - z) ** 2 > 25) continue; if (t.alive) t.g = Math.min(1, t.g + .5); else if (!t.reserved) { t.alive = true; t.g = .35; t.stumpT = 0; rev++; } }
  let n = 0; for (let k = 0; k < 60 && n < 6; k++) { const a = Math.random() * 6.28, r = Math.random() * 4.5, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, h = heightAt(tx, tz);
    if (h < .4 || h > 3.4 || Math.hypot(tx, tz) < 5.5 || treeNear(tx, tz, .8)) continue; if (addTree(tx, tz, .15)) n++; }
  floatText(x, surfaceAt(x, z) + 2, z, n ? `${n} neue Setzlinge` : 'Der Wald trinkt', 's');
  if (n + rev > 0 || trees.some(t => t.alive && !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < 25)) wishDone('rain');
  forestHelped(x, z);
}
function castHaste(x, z) {
  ringT = 1.4; ring.position.set(x, surfaceAt(x, z) + .15, z);
  let n = 0; for (const v of villagers) if ((v.x - x) ** 2 + (v.z - z) ** 2 < 36) { v.haste = 30; n++; }
  floatText(x, surfaceAt(x, z) + 1.6, z, n ? `${n} Bewohner beflügelt` : 'Niemand in Reichweite', 's');
  if (n) wishDone('haste');
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
const holdOff = new THREE.Vector3(); // Abstand Gehaltenes – Fingerpunkt am Boden beim Zupacken
// Am Handy verdeckt der Finger, was darunter liegt: Hand und Gehaltenes schweben dort ein Stück über dem Finger.
// Was angetippt wird (Bewohner, Baum, Tiergeist), zählt weiterhin genau unter dem Finger.
let ptrType = 'mouse';
const touchLift = () => ptrType === 'touch' ? 90 : 0;
const setHoldOff = (x, z) => { if (ptrType === 'touch') holdOff.set(0, 0, 0); else holdOff.set(x - hit.x, 0, z - hit.z); }
const heldTree = { on: false, flying: false, type: 0, g: 1, rot: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, tilt: 0 };
const heldObjs = TK.map(g => { const o = shadowify(g.scene.clone(true)); o.visible = false; scene.add(o); return o; });
const rootBall = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 7).scale(1, .55, 1), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1, flatShading: true }));
rootBall.castShadow = true; rootBall.visible = false; scene.add(rootBall);
// Baum unter dem Finger: Abstand zur Strecke Stammfuß–Krone auf dem Bildschirm, Toleranz wächst mit der Baumgröße
const TREE_H = 1.12, tA = new THREE.Vector2(), tB = new THREE.Vector2();
function toScreen(x, y, z, out) { const r = canvas.getBoundingClientRect(); tmpV.set(x, y, z).project(camera); return out.set((tmpV.x + 1) / 2 * r.width + r.left, (1 - tmpV.y) / 2 * r.height + r.top); }
function treeAt(cx, cy) {
  let best = null, bd = 1e9;
  for (const t of trees) {
    if (!t.alive || t.gone || t.g < .6) continue;
    const y = heightAt(t.x, t.z); toScreen(t.x, y, t.z, tA); toScreen(t.x, y + TREE_H * ST * t.g, t.z, tB);
    const ex = tB.x - tA.x, ey = tB.y - tA.y, L2 = ex * ex + ey * ey || 1, u = clamp(((cx - tA.x) * ex + (cy - tA.y) * ey) / L2, 0, 1);
    const d = Math.hypot(cx - tA.x - ex * u, cy - tA.y - ey * u), tol = Math.max(26, Math.sqrt(L2) * .38);
    if (d < tol && d / tol < bd) { bd = d / tol; best = t; }
  }
  return best;
}
function uprootTree(tr) {
  if (tr.reserved === 'fox') { fox.tree = null; if (fox.state === 'walk' || fox.state === 'work') foxIdle(1); }
  else if (tr.reserved) tr.reserved.tree = null;
  tr.reserved = null; tr.alive = false; tr.stumpT = 0; tr.regrow = 0;
  Object.assign(heldTree, { on: true, flying: false, type: tr.type, g: tr.g, rot: tr.rot, tilt: 0 });
  setHoldOff(tr.x, tr.z);
  floatText(tr.x, heightAt(tr.x, tr.z) + 2.2, tr.z, 'Ausgerissen!', 'w');
  for (const v of villagers) { const dx = v.x - tr.x, dz = v.z - tr.z, d = Math.hypot(dx, dz); if (d < 2.5 && ['idle', 'walk', 'chop', 'plant'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 1.5; v.tx = v.x + dx / (d || 1) * 2.5; v.tz = v.z + dz / (d || 1) * 2.5; } }
}
function throwTree() {
  const k = clamp(hand.vel.length(), 0, 12) / (hand.vel.length() || 1);
  heldTree.flying = true; heldTree.vel.set(hand.vel.x * k, hand.vel.y * .4 * k + 2, hand.vel.z * k); heldTree.spin = rnd(3);
}
// Gefällte Bäume kippen vom Fäller weg um, bleiben kurz liegen und verschwinden (Stumpf bleibt stehen).
const fallen = []; // { o, t, dir, x, z, s, life }
const FALL_T = .7;
function fallTree(tr, fromX, fromZ, life, lying = false) {
  if (fallen.length >= 12) { const f = fallen.shift(); scene.remove(f.o); }
  const o = shadowify(TK[tr.type || 0].scene.clone(true)); scene.add(o);
  fallen.push({ o, t: lying ? FALL_T : 0, dir: Math.atan2(tr.x - fromX, tr.z - fromZ), x: tr.x, z: tr.z, s: ST * (tr.g ?? 1), life });
}
const fallQ = new THREE.Quaternion(), fallE = new THREE.Euler();
function updateFallen(dt) {
  for (let i = fallen.length - 1; i >= 0; i--) {
    const f = fallen[i]; f.t += dt;
    if (f.t >= f.life) { scene.remove(f.o); fallen.splice(i, 1); continue; }
    const k = Math.min(1, f.t / FALL_T), tilt = k * k * Math.PI / 2 * .97 + (k >= 1 ? Math.sin(Math.min(1, (f.t - FALL_T) / .25) * Math.PI) * .06 : 0);
    f.o.position.set(f.x, heightAt(f.x, f.z), f.z); f.o.quaternion.setFromEuler(fallE.set(tilt, f.dir, 0, 'YXZ'));
    f.o.scale.setScalar(f.s * Math.min(1, (f.life - f.t) / .4)); // am Ende einsinken
  }
}
// Der Tiergeist trägt einen Baum quer im Maul (wie einen Stock); hängt an der Kopfposition des Modells.
const mouthTrees = TK.map(g => { const o = shadowify(g.scene.clone(true)); o.visible = false; scene.add(o); return o; });
const mouthQ = new THREE.Quaternion(), mouthZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), mouthV = new THREE.Vector3(), mouthF = new THREE.Vector3();
function updateMouthTree() {
  mouthTrees.forEach(o => o.visible = false);
  if (!fox.carry || !foxModel) return;
  const C = CREATURES[fox.kind], head = foxModel.userData.head || (foxModel.userData.head = foxModel.getObjectByName(C.head || 'Head'));
  if (!head) return;
  const o = mouthTrees[fox.carryType || 0], s = ST * .55 * C.h / 1.45;
  head.getWorldPosition(mouthV); mouthF.set(Math.sin(fox.h), 0, Math.cos(fox.h));
  mouthV.addScaledVector(mouthF, C.h * .17).y -= C.h * .07;          // vor den Kopf, auf Maulhöhe
  mouthQ.copy(foxPivot.quaternion).multiply(mouthZ);                   // Stamm quer zur Laufrichtung
  o.quaternion.copy(mouthQ); o.scale.setScalar(s);
  o.position.copy(mouthV).addScaledVector(mouthTmp.set(1, 0, 0).applyQuaternion(foxPivot.quaternion), -TREE_H * s * .3); // Krone zeigt nach +x: Fuß um ein Drittel zur Gegenseite, so liegt das untere Drittel des Stamms im Maul
  o.visible = true;
}
const mouthTmp = new THREE.Vector3();
function updateTrees(dt, t) {
  updateFallen(dt);
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
      else { const n = Math.max(1, Math.round(3 * heldTree.g)); addLogs(n, heldTree.pos.x, gy + .4, heldTree.pos.z); }
      return;
    }
  } else heldTree.pos.set(hand.g.position.x, hand.g.position.y - .95 * s, hand.g.position.z);
  o.visible = true; rootBall.visible = true;
  o.position.copy(heldTree.pos); o.rotation.set(Math.min(heldTree.tilt, 1.4) + Math.sin(t * 3) * .05, heldTree.rot, 0); o.scale.setScalar(s);
  rootBall.position.copy(heldTree.pos); rootBall.rotation.copy(o.rotation); rootBall.scale.setScalar(heldTree.g);
}

/* ------------------------------------------------------------------ Kreismenü und Einblendung am Tiergeist */
// Tippt die Hand auf den Tiergeist, öffnet sich um ihn ein Kreis aus Aktionen. Die Liste lässt sich erweitern;
// icon = SVG-Pfade im 24er-Raster wie bei den Werkzeugen.
const FOX_ACTIONS = [
  { id: 'pet', label: () => 'Streicheln', icon: '<path d="M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.6 4 4 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>', run: () => reinforce('pet') },
  { id: 'slap', label: () => 'Klaps', icon: '<path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0v5A6.5 6.5 0 0 1 12.5 21h-.6a6 6 0 0 1-4.7-2.3L4.4 15"/><path d="M3 6l2 1.5M2.5 10H5"/>', run: () => reinforce('slap') },
  { id: 'follow', label: () => follow ? 'Nicht folgen' : 'Folgen', pressed: () => follow, icon: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>', run: () => { follow = !follow; renderFollow(); } },
  { id: 'sheet', label: () => 'Charakter', icon: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3.5"/>', run: () => openSheet('sheetFox') },
];
let ringOpen = false, hoverFox = false;
const ringRadius = () => 40 + FOX_ACTIONS.length * 4.5; // reine Symbole: kleiner Kreis, wächst mit der Zahl der Aktionen
function openRing() {
  const R = $('ring'), n = FOX_ACTIONS.length, rad = ringRadius(); R.innerHTML = '';
  FOX_ACTIONS.forEach((a, i) => {
    const ang = -Math.PI / 2 + i * 2 * Math.PI / n, b = document.createElement('button');
    b.className = 'ra-' + a.id; b.style.setProperty('--x', `${Math.cos(ang) * rad}px`); b.style.setProperty('--y', `${Math.sin(ang) * rad}px`);
    if (a.pressed) b.setAttribute('aria-pressed', a.pressed());
    b.innerHTML = `<svg viewBox="0 0 24 24">${a.icon}</svg>`; b.title = a.label(); b.setAttribute('aria-label', a.label());
    b.addEventListener('click', e => { e.stopPropagation(); closeRing(); a.run(); });
    R.appendChild(b);
  });
  R.hidden = false; ringOpen = true; void R.offsetWidth; R.classList.add('open'); placeFoxUI(0);
}
function closeRing() { ringOpen = false; $('ring').classList.remove('open'); $('ring').hidden = true; }
addEventListener('keydown', e => { if (e.key === 'Escape' && ringOpen) closeRing(); });
// Tier unter dem Finger: Abstand zur Strecke Füße–Kopfhöhe auf dem Bildschirm, Toleranz wächst mit der Größe
function foxUnder(cx, cy) {
  const y = foxPivot.position.y, C = CREATURES[fox.kind]; toScreen(fox.x, y + C.h * .1, fox.z, tA); toScreen(fox.x, y + C.h * .85, fox.z, tB);
  const ex = tB.x - tA.x, ey = tB.y - tA.y, L2 = ex * ex + ey * ey || 1, u = clamp(((cx - tA.x) * ex + (cy - tA.y) * ey) / L2, 0, 1);
  return Math.hypot(cx - tA.x - ex * u, cy - tA.y - ey * u) < Math.max(36, Math.sqrt(L2) * .55);
}
// Kreismenü und Einblendung mitführen; die Einblendung zeigt Name, Tätigkeit und Neigungen,
// wenn das Menü offen ist oder die Hand über dem Tier schwebt, sonst nur eine offene Frage nach Lob/Tadel
let badgeT = 0;
function placeFoxUI(dt) {
  const C = CREATURES[fox.kind], r = canvas.getBoundingClientRect(), y = foxPivot.position.y;
  toScreen(fox.x, y + C.h * .5, fox.z, tA); let cx = tA.x - r.left, cy = tA.y - r.top;
  // Kreis vollständig im Bild halten (oben Statusleiste, unten Werkzeugleiste)
  if (ringOpen) { const m = ringRadius() + 28; cx = clamp(cx, m, r.width - m); cy = clamp(cy, m + 60, r.height - m - 110); }
  if (ringOpen) $('ring').style.transform = `translate(${cx}px, ${cy}px)`;
  const ask = fox.last && clock.elapsedTime - fox.lastT < 25, full = ringOpen || hoverFox, B = $('foxBadge');
  B.hidden = !(full || ask) || !$('sheetFox').hidden;
  if (B.hidden) return;
  if ((badgeT -= dt) <= 0 || !dt) {
    badgeT = .25;
    $('badgeName').textContent = full ? S.name : ''; $('badgeNow').textContent = full ? `${foxDoing()}.` : '';
    $('badgeAsk').textContent = ask ? (full ? `Hat ${ACT_DESC[fox.last]}: Lob oder Tadel?` : 'Lob oder Tadel?') : '';
    $('badgeBars').innerHTML = full ? ['help', 'play', 'mischief'].map(k => `<span>${ACT_LABEL[k]}</span><i><u style="width:${Math.round(S.w[k] * 100)}%;background:${ACT_COL[k]}"></u></i>`).join('') : '';
  }
  // über dem Kopf, bei offenem Menü über dem oberen Knopf; am Bildschirmrand halten
  toScreen(fox.x, y + C.h + .15, fox.z, tB);
  const top = Math.min(tB.y - r.top, ringOpen ? cy - ringRadius() - 28 : 1e9), bw = B.offsetWidth, bh = B.offsetHeight;
  const bx = clamp(cx - bw / 2, 8, r.width - bw - 8), by = clamp(top - bh - 6, 60, r.height - bh - 8);
  B.style.transform = `translate(${bx}px, ${by}px)`;
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
    if (foxUnder(cx, cy)) { openRing(); pressing = false; return; }
    let best = null, bd = 40;
    for (const v of villagers) { if (v.state === 'grabbed' || v.state === 'falling' || v.state === 'sleep') continue; const d = screenDist(v.x, v.y + .25, v.z, cx, cy); if (d < bd) { bd = d; best = v; } }
    if (best) { grabbed = best; setHoldOff(best.x, best.z); if (best.tree) { best.tree.reserved = null; best.tree = null; } if (best.carry) { best.carry = 0; } best.state = 'grabbed'; }
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
// Karte mit der Maus verschieben: im Blick-Werkzeug mit links ziehen, in jedem Werkzeug mit Leertaste oder Strg + links.
// OrbitControls tauscht bei gedrückter Strg-Taste Drehen und Verschieben, daher bei Strg die Belegung „Drehen“.
let spaceDown = false, ctrlDown = false;
function applyMouseButtons() {
  const left = spaceDown || tool === 'blick' ? THREE.MOUSE.PAN : ctrlDown ? THREE.MOUSE.ROTATE : -1;
  controls.mouseButtons = { LEFT: left, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  canvas.style.cursor = spaceDown || ctrlDown ? 'grab' : '';
}
function panKeys(e, down) {
  if (e.target.closest && e.target.closest('input, textarea')) return; // Leerzeichen im Namensfeld bleiben Leerzeichen
  if (e.code === 'Space') { e.preventDefault(); spaceDown = down; } // sonst scrollt die Seite oder ein Knopf wird ausgelöst
  if (e.key === 'Control') ctrlDown = down;
  applyMouseButtons();
}
addEventListener('keydown', e => panKeys(e, true));
addEventListener('keyup', e => panKeys(e, false));
addEventListener('blur', () => { spaceDown = ctrlDown = false; applyMouseButtons(); });
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, true);
  if (e.pointerType === 'mouse' && (spaceDown || e.ctrlKey)) return; // verschiebt nur die Karte, die Hand bleibt untätig
  if (pointers.size > 1) { if (primary !== null) { onToolUp(); primary = null; } return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (ringOpen) { closeRing(); return; } // Tippen daneben schließt das Kreismenü
  if (tool === 'blick') return;
  closeSheets();
  primary = e.pointerId; ptrType = e.pointerType; pointerXY.x = e.clientX; pointerXY.y = e.clientY; onToolDown(e.clientX, e.clientY);
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
  get blick() { return isMobile ? 'Ziehen dreht die Welt. Zwei Finger: verschieben und zoomen.' : 'Linke Maustaste verschiebt, rechte dreht, Mausrad zoomt. In jedem Werkzeug: Leertaste oder Strg + Ziehen verschiebt.'; },
  get hand() { return `Bewohner packen und werfen, Bäume packen und ausreißen. ${S.name} antippen für Streicheln, Klaps und mehr.`; },
  sculpt: 'Gedrückt halten, um Land zu heben oder zu senken.',
  miracle: 'Wunder wählen, dann auf die Welt tippen.'
};
function setTool(t) {
  tool = t; if (grabbed) onToolUp();
  document.querySelectorAll('.tools button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  $('ctxSculpt').hidden = t !== 'sculpt'; $('ctxMiracle').hidden = t !== 'miracle';
  $('hint').textContent = HINTS[t];
  applyMouseButtons();
  controls.touches = { ONE: t === 'blick' ? THREE.TOUCH.ROTATE : -1, TWO: THREE.TOUCH.DOLLY_PAN };
  if (t === 'blick') handShown = false;
}
document.querySelectorAll('.tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
document.querySelectorAll('#ctxSculpt button').forEach(b => b.addEventListener('click', () => { sculptDir = +b.dataset.dir; document.querySelectorAll('#ctxSculpt button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
function chooseMiracle(m) { miracle = m; document.querySelectorAll('#ctxMiracle button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === m))); }
document.querySelectorAll('#ctxMiracle button').forEach(b => b.addEventListener('click', () => chooseMiracle(b.dataset.m)));
$('forestAlert').addEventListener('click', () => {
  const A = forestAlert; if (!A.hut) return;
  setTool('miracle'); chooseMiracle('rain');
  // Kamera zur Lichtung schwenken (Blickwinkel bleibt)
  const dx = A.at.x - controls.target.x, dz = A.at.z - controls.target.z; controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; follow = false;
  toast('Tippe in den Ring, um dort Regen zu wirken.', 3);
});
$('wish').addEventListener('click', () => { if (!wish.kind) return; setTool('miracle'); chooseMiracle(wish.kind); toast(wish.kind === 'rain' ? 'Tippe auf den Wald, um Regen zu wirken.' : 'Tippe dorthin, wo die Bewohner arbeiten, um ihnen Eile zu schenken.', 3); });

/* ------------------------------------------------------------------ sheets */
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.hidden = true); $('app').classList.remove('sheet-open'); }
function openSheet(id) { const s = $(id), was = !s.hidden; closeSheets(); s.hidden = was; $('app').classList.toggle('sheet-open', !s.hidden); if (!s.hidden) { if (id === 'sheetShrine') renderShrine(); if (id === 'sheetWork') renderWork(); if (id === 'sheetFox') { renderFox(); showPortrait(); } } }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
$('btnShrine').addEventListener('click', () => openSheet('sheetShrine'));
$('btnWork').addEventListener('click', () => openSheet('sheetWork'));
$('btnStore').addEventListener('click', () => openSheet('sheetWork'));
// Arbeits-Panel: Aufbau einmal, danach nur Texte aktualisieren (sonst gehen Klicks verloren)
$('workItems').innerHTML = Object.entries(WORKS).map(([id, W]) => `<div class="work" data-work="${id}">
  <div class="whead"><div><h3>${W.label}</h3><p class="min">mindestens ${W.min} Bewohner</p></div>
    <div class="step" role="group" aria-label="Bewohner für ${W.label}"><button data-d="-1" aria-label="Weniger">−</button><b class="n">0</b><button data-d="1" aria-label="Mehr">+</button></div></div>
  <p class="wdesc">${W.desc}</p><ul class="roles"></ul><p class="wnote"></p></div>`).join('');
$('workItems').addEventListener('click', e => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const id = b.closest('[data-work]').dataset.work, W = WORKS[id], d = +b.dataset.d, eff = effJobs();
  let k = eff[id], used = 0; for (const x in eff) if (x !== id) used += eff[x];
  const free = villagers.length - used - k;
  if (d > 0) { const step = k === 0 ? W.min : 1; if (step > free) { toast(k === 0 ? `${W.label} braucht mindestens ${W.min} freie Bewohner.` : 'Keine freien Bewohner mehr.', 2.4); return; } k += step; }
  else k = k - 1 < W.min ? 0 : k - 1;
  S.jobs[id] = k; reconcileJobs(); renderWork(); save();
});
function renderWork() {
  const eff = effJobs(); let used = 0; for (const id in eff) used += eff[id];
  const free = villagers.length - used, carriers = villagers.filter(v => !v.role && v.haul).length;
  $('workFree').innerHTML = `<b>${free}</b> von ${villagers.length} Bewohnern sind frei${carriers ? ` · ${carriers} ${carriers === 1 ? 'trägt' : 'tragen'} gerade` : ''}`;
  const alive = trees.filter(t => t.alive && !t.gone), young = alive.filter(t => t.g < .7).length;
  for (const el of $('workItems').children) {
    const id = el.dataset.work, W = WORKS[id], k = eff[id], sp = W.split(k);
    el.querySelector('.n').textContent = k;
    el.querySelector('[data-d="-1"]').disabled = k === 0;
    el.querySelector('[data-d="1"]').disabled = free < (k === 0 ? W.min : 1);
    el.classList.toggle('off', k === 0);
    el.querySelector('.roles').innerHTML = Object.keys(sp).map(r => {
      const R = ROLES[r], n = roleCount(r), nh = huts.filter(h => h.role === r).length;
      return `<li><b>${n}</b> ${R.label} <span>· ${nh} ${R.hut}${nh === 1 ? '' : 'n'}, Platz für ${nh * R.per}</span></li>`;
    }).join('');
    const notes = [];
    for (const r in sp) { const wait = (k ? sp[r] : 0) - roleCount(r); if (wait > 0) notes.push(`${wait} ${ROLES[r].label} ${wait === 1 ? 'wartet' : 'warten'} auf eine neue ${ROLES[r].hut}${construction && construction.role === r ? ', sie wird gerade gebaut.' : ` (${ROLES[r].cost(S.huts[r])} Bretter).`}`); }
    if (id === 'wood') notes.push(`${alive.length - young} Bäume zum Fällen, ${young} wachsen noch.`);
    if (id === 'saw') { const ms = huts.filter(h => h.role === 'sawyer'); notes.push(`An der Säge: ${ms.reduce((a, h) => a + h.logs, 0)} Stämme, ${ms.reduce((a, h) => a + h.planks, 0)} Bretter. Im Lager: ${fmt(S.logs)} ${S.logs === 1 ? 'Stamm' : 'Stämme'}, ${fmt(S.holz)} Bretter.`); }
    el.querySelector('.wnote').textContent = notes.join(' ');
  }
}
// Uhrzeit-Menü: vorspulen zum Tag/zur Nacht, Tagesverlauf anhalten
const timeMenu = $('timeMenu');
function closeTimeMenu() { if (timeMenu.hidden) return; timeMenu.hidden = true; $('btnTime').setAttribute('aria-expanded', 'false'); }
function openTimeMenu() {
  const toNight = skipTo !== null ? skipTo < 12 : isDaytime(S.hour);
  $('tmSkipL').textContent = toNight ? 'Zur Nacht vorspulen' : 'Zum Morgen vorspulen'; timeMenu.dataset.to = toNight ? 'night' : 'day';
  $('tmPauseL').textContent = S.timePaused ? 'Zeit weiterlaufen lassen' : 'Zeit anhalten'; $('tmPause').setAttribute('aria-checked', String(!!S.timePaused));
  timeMenu.hidden = false; $('btnTime').setAttribute('aria-expanded', 'true');
  const r = $('btnTime').getBoundingClientRect(), w = timeMenu.offsetWidth;
  timeMenu.style.top = `${r.bottom + 6}px`; timeMenu.style.left = `${clamp(r.right - w, 16, innerWidth - w - 16)}px`;
}
$('btnTime').addEventListener('click', () => (timeMenu.hidden ? openTimeMenu() : closeTimeMenu()));
// Wetter-Menü: Wetter wählen und festhalten
const WX_ICON = {
  klar: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
  heiter: '<circle cx="9" cy="8.5" r="3.4"/><path d="M9 2.6v1.4M3.1 8.5h1.4M4.8 4.3l1 1M13.2 4.3l-1 1"/><path d="M8 19.5a3.5 3.5 0 0 1 .5-7 4.5 4.5 0 0 1 8.6 1.3 2.9 2.9 0 0 1-.1 5.7z"/>',
  bewoelkt: '<path d="M6.5 18a4 4 0 0 1 .6-7.95A5.2 5.2 0 0 1 17 10.8a3.6 3.6 0 0 1 .3 7.2z"/>',
  regen: '<path d="M6.5 14.5a4 4 0 0 1 .6-7.95A5.2 5.2 0 0 1 17 7.3a3.6 3.6 0 0 1 .3 7.2z"/><path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>',
  schnee: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5M4.6 10.2l2.2-.7-.5-2.3M17.7 16.5l-.5-2.3 2.2-.7M4.6 13.8l2.2.7-.5 2.3M17.7 7.5l-.5 2.3 2.2.7"/>',
};
const wxMenu = $('wxMenu');
$('wxOpts').innerHTML = Object.keys(WEATHER).map(k => `<button role="menuitemradio" data-wx="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[k]}</svg><span>${WEATHER[k].label[0].toUpperCase() + WEATHER[k].label.slice(1)}</span></button>`).join('');
function closeWxMenu() { if (wxMenu.hidden) return; wxMenu.hidden = true; $('btnWx').setAttribute('aria-expanded', 'false'); }
function openWxMenu() {
  wxMenu.querySelectorAll('[data-wx]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.wx === S.weather)));
  $('wxLockL').textContent = S.weatherLocked ? 'Wetter wechselt wieder' : 'Wetter festhalten'; $('wxLock').setAttribute('aria-checked', String(!!S.weatherLocked));
  wxMenu.hidden = false; $('btnWx').setAttribute('aria-expanded', 'true');
  const r = $('btnWx').getBoundingClientRect(), w = wxMenu.offsetWidth;
  wxMenu.style.top = `${r.bottom + 6}px`; wxMenu.style.left = `${clamp(r.right - w, 16, innerWidth - w - 16)}px`;
}
$('btnWx').addEventListener('click', () => (wxMenu.hidden ? openWxMenu() : closeWxMenu()));
$('wxOpts').addEventListener('click', e => { const b = e.target.closest('[data-wx]'); if (!b) return; setWeather(b.dataset.wx); toast({ regen: 'Es fängt an zu regnen.', schnee: 'Es fängt an zu schneien.' }[b.dataset.wx] || `Das Wetter wird ${WEATHER[b.dataset.wx].label}.`, 2); save(); closeWxMenu(); });
$('wxLock').addEventListener('click', () => { S.weatherLocked = !S.weatherLocked; toast(S.weatherLocked ? 'Das Wetter bleibt, wie es ist.' : 'Das Wetter wechselt wieder von selbst.', 2); save(); closeWxMenu(); });
addEventListener('pointerdown', e => { if (!wxMenu.hidden && !wxMenu.contains(e.target) && !$('btnWx').contains(e.target)) closeWxMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeWxMenu(); });
const windWord = w => w < .3 ? 'windstill' : w < .5 ? 'leichter Wind' : w < .72 ? 'windig' : 'stürmisch';
$('tmSkip').addEventListener('click', () => { toggleDayNight(); closeTimeMenu(); });
$('tmPause').addEventListener('click', () => { S.timePaused = !S.timePaused; toast(S.timePaused ? 'Die Zeit steht still.' : 'Die Zeit läuft weiter.', 2); save(); closeTimeMenu(); });
addEventListener('pointerdown', e => { if (!timeMenu.hidden && !timeMenu.contains(e.target) && !$('btnTime').contains(e.target)) closeTimeMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeTimeMenu(); });
$('btnFox').addEventListener('click', () => openSheet('sheetFox'));
$('btnInfo').addEventListener('click', () => openSheet('sheetInfo'));
// Folgen: die Kamera bleibt beim Tiergeist, bis der Chip oben oder der Knopf im Panel es beendet
let follow = false;
function renderFollow() { $('btnFollow').hidden = !follow; $('btnFocus').setAttribute('aria-pressed', follow); $('btnFocus').textContent = follow ? 'Folgen aus' : 'Folgen'; }
$('btnPet').addEventListener('click', () => reinforce('pet'));
$('btnSlap').addEventListener('click', () => reinforce('slap'));
$('btnFocus').addEventListener('click', () => { follow = !follow; renderFollow(); if (follow) closeSheets(); });
$('btnFollow').addEventListener('click', () => { follow = false; renderFollow(); });
let resetArmed = false;
$('btnReset').addEventListener('click', e => {
  if (!resetArmed) { resetArmed = true; e.target.textContent = 'Wirklich zurücksetzen?'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {} skipSave = true; location.reload();
});
let skipSave = false;

const SHRINE = [
  { id: 'temple', title: () => `Schrein weihen (Stufe ${S.temple + 1})`, desc: () => `Gebete bringen ${fmt1(prayYield() + .6)} statt ${fmt1(prayYield())} Glaube, der Schrein strahlt ${fmt1(passive() + .06)}/s aus.`, cost: templeCost, buy: () => { S.temple++; } },
  { id: 'soul', title: () => 'Seele rufen', desc: () => villagers.length < cap() ? 'Ein neuer Bewohner erscheint sofort am Schrein.' : cap() >= MAX_POP ? `Das Dorf hat seine volle Größe von ${MAX_POP} Seelen erreicht.` : 'Kein Platz. Aus Brettern entstehen neue Häuser, sobald genug im Lager sind.', cost: () => SOUL_COST, ok: () => villagers.length < cap(), buy: () => { const v = spawnVillager(PRAY.x, PRAY.z + .5); if (v) floatText(v.x, 1.8, v.z, 'Neue Seele', 's'); } },
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
  $('foxLast').textContent = fox.last && t - fox.lastT < 25 ? `Gerade eben hat ${S.name} ${ACT_DESC[fox.last]}. Deine Reaktion prägt ${pron().ihn}.` : `Warte auf die nächste Tat von ${S.name}, dann lobe oder tadle ${pron().ihn}.`;
  $('foxNow').textContent = `${S.name} ${foxDoing()}.`;
  renderForms();
}
// Buttons nur einmal anlegen und danach aktualisieren: renderFox läuft alle 0,25 s,
// ein Neuaufbau zwischen Drücken und Loslassen würde den Klick verschlucken.
// Gestalten mit Fell-Modell und eigenen Reaktionen bekommen einen Stern
const formLabel = id => CREATURES[id].label + (CREATURES[id].react ? ' ★' : '');
$('foxForms').innerHTML = Object.entries(CREATURES).map(([id, c]) => `<button data-form="${id}"${c.react ? ' class="feat"' : ''}>${formLabel(id)}</button>`).join('');
// kurze Beschreibung des aktuellen Zustands für das Panel
function foxDoing() {
  switch (fox.state) {
    case 'walk':
      if (fox.next === 'store') return 'trägt einen Baum im Maul zum Lager';
      if (fox.next === 'play') return 'läuft zum Dorfplatz, um zu spielen';
      return fox.act === 'help' ? 'läuft zu einem Baum, um Holz zu holen' : 'schleicht zu einem Baum und führt etwas im Schilde';
    case 'work': return fox.act === 'help' ? 'fällt einen Baum für das Dorf' : 'rüttelt mutwillig an einem Baum';
    case 'play': return 'tollt über den Dorfplatz';
    case 'rest': return 'hat sich hingelegt und döst';
    case 'cast': return 'wirkt mit dir ein Wunder';
    case 'pickup': return 'hebt den gefällten Baum auf';
    default: return fox.idleA === 'eat' ? 'schnuppert am Boden' : 'schaut sich um';
  }
}
// Name an allen Stellen der Oberfläche setzen
function renderGender() { for (const b of $('foxGender').children) b.setAttribute('aria-checked', String(b.dataset.g === S.gender)); }
$('foxGender').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b || b.dataset.g === S.gender) return; S.gender = b.dataset.g; renderGender(); renderFox(); toast(`${S.name} ist jetzt ${S.gender === 'w' ? 'weiblich' : 'männlich'}.`, 2); save(); });
renderGender();
function renderName() {
  $('btnFox').textContent = S.name; $('sheetFox').setAttribute('aria-label', S.name);
  if (document.activeElement !== $('foxName')) $('foxName').value = S.name;
  $('btnFollow').textContent = `Folgt ${S.name} ✕`;
  if (tool === 'hand') $('hint').textContent = HINTS.hand;
}
$('foxName').addEventListener('change', () => { S.name = $('foxName').value.trim().slice(0, 16) || 'Fenja'; renderName(); renderFox(); save(); });
$('foxName').addEventListener('keydown', e => { if (e.key === 'Enter') $('foxName').blur(); });
function renderForms() {
  for (const b of $('foxForms').children) {
    const id = b.dataset.form, label = creatureLoading === id ? 'Lädt …' : formLabel(id);
    b.setAttribute('aria-pressed', id === fox.kind); b.disabled = !!creatureLoading;
    if (b.textContent !== label) b.textContent = label;
  }
}
$('foxForms').addEventListener('click', e => { const b = e.target.closest('[data-form]'); if (b) setCreature(b.dataset.form); });

/* ------------------------------------------------------------------ offline progress */
{
  const away = Math.min((Date.now() - (S.ts || Date.now())) / 1000, 8 * 3600);
  if (loaded && away > 30) {
    const free = villagers.filter(v => !v.role).length, gRate = free * prayYield() * .45 / 22 + passive();
    const logIn = roleCount('lumber') / 16 * away * .5, sawn = Math.min(S.logs + logIn, roleCount('sawyer') / 10 * away * .5);
    const g = gRate * away * .5, h = Math.min(Math.floor(sawn) * 2, 400), l = Math.min(Math.floor(logIn - sawn + S.logs) - S.logs, 300);
    S.glaube += g; S.holz += h; S.logs = Math.max(0, S.logs + l);
    setTimeout(() => toast(`Während du fort warst: +${fmt(g)} Glaube${h > 0 ? `, +${fmt(h)} Bretter` : ''}${l > 0 ? `, +${fmt(l)} Stämme` : ''}.`, 5), 900);
  }
}
function save() { if (skipSave) return; savePaths(); S.ts = Date.now(); S.pop = villagers.length; S.houses = houses.length; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
const dummy = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
const vEuler = new THREE.Euler(), vTmp = new THREE.Matrix4(), vOut = new THREE.Matrix4();
let uiT = 0, secT = 0, birthT = 0, zzzT = 3, jobT = 0;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
setTool('hand'); renderName();

let snowScanT = 0;
function scanSnow() {
  snowSkip.add(waterMat); for (const m of vAll) snowSkip.add(m.material);
  hand.g.traverse(o => { if (o.material) [].concat(o.material).forEach(m => snowSkip.add(m)); });
  scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.isSkinnedMesh && !o.userData.shell && !o.userData.noSnow) [].concat(o.material).forEach(snowify); });
}
function frame() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;

  // tool action
  if (primary !== null || (handShown && tool !== 'blick')) pick(pointerXY.x, pointerXY.y - touchLift());
  if (pressing && tool === 'sculpt' && hitOk) sculpt(hit.x, hit.z, sculptDir, dt);

  // economy ticks
  S.glaube += passive() * dt; incomeAcc += passive() * dt;
  secT += dt; if (secT >= 1) { rate = rate * .85 + incomeAcc / secT * .15; incomeAcc = 0; secT = 0; }
  birthT += dt; if (birthT > 9) { birthT = 0; if (villagers.length < cap()) { const p = homeSpot(), v = spawnVillager(p.x, p.z); if (v) floatText(v.x, 1.6, v.z, 'Neue Seele', 's'); } }
  jobT -= dt; if (jobT <= 0) { jobT = 1; reconcileJobs(); }
  if (!construction) { const b = nextBuild(); if (b && S.holz >= b.cost) { S.holz -= b.cost; construction = { ...b, t: 0 }; b.site.used = true; scaff.x = b.site.x; scaff.z = b.site.z; scaff.o.rotation.y = b.site.ry; scaff.o.visible = true; } }
  if (construction) { construction.t += dt; if (construction.t > 9) {
    const c = construction; c.site.used = false; scaff.o.visible = false; construction = null;
    if (c.role) { const e = addHut(c.role, c.site); S.huts[c.role]++; reconcileJobs(); floatText(e.x, 2.2, e.z, c.label, 's'); toast(`Eine neue ${c.label} steht. Platz für ${ROLES[c.role].per} weitere ${ROLES[c.role].label}.`); }
    else { const hs = addHouse(c.site); S.houses = houses.length; floatText(hs.x, 2.2, hs.z, 'Neues Haus', 's'); toast(`Ein neues Haus steht. Platz für ${cap()} Seelen.`); }
    save();
  } }
  for (const h of huts) if (h.saw) { h.sawing = Math.max(0, h.sawing - dt); if (h.sawing > 0) h.saw.rotation.x += dt * 14; }

  navT -= dt; if (navT <= 0 || !navReady) { navT = 1; buildNav(); }
  navBudget = 30000;
  updateDay(dt, t);
  updateWish(dt); updateForestAlert(dt, t);
  zzzT -= dt;
  if (zzzT <= 0) { zzzT = 2.2 + Math.random() * 1.5; const sl = villagers.filter(v => v.state === 'sleep' && v.home); if (sl.length) { const hs = sl[Math.floor(Math.random() * sl.length)].home; floatText(hs.x + rnd(.2), heightAt(hs.x, hs.z) + 1.9, hs.z + rnd(.2), 'Zzz', 'w'); } }

  // villagers
  for (const v of villagers) updateVillager(v, dt, t);
  updateWear(dt);
  if (grabbed) { grabbed.x = hand.g.position.x; grabbed.z = hand.g.position.z + .05; grabbed.y = hand.g.position.y - .62; }
  for (const m of vAll) m.count = villagers.length;
  lights.length = 0;
  const lantern = sky.night > .3; // ab der Dämmerung trägt jeder eine Laterne
  villagers.forEach((v, i) => {
    const L = v.look;
    if (v.state === 'sleep') { for (const m of vAll) m.setMatrixAt(i, zero); return; } // schläft in der Hütte
    let bob = 0, tilt = 0, roll = 0, leg = 0, armA = 0, armB = 0, splay = .25, armRz = 0, bite = -1;
    v.kn = v.state === 'pray' || v.state === 'beg' ? Math.min(1, (v.kn || 0) + dt * 5) : Math.max(0, (v.kn || 0) - dt * 5); // knien
    v.st = v.state === 'lunch' ? Math.min(1, (v.st || 0) + dt * 4) : Math.max(0, (v.st || 0) - dt * 4); // sitzen
    if (v.state === 'walk' || v.state === 'flee') {
      const s = Math.sin(t * (v.haste > 0 || v.state === 'flee' ? 18 : 11) + v.ph);
      bob = Math.abs(s) * .03; leg = s * .6; armA = -s * .5; armB = s * .5;
      if (v.state === 'flee') { armA = armB = -2.6 + s * .4; }
    } else if (v.state === 'chop') { const c = chopPose((v.cp || 0) % 1); tilt = c.tilt; bob = c.bob; armA = armB = c.arm; splay = -.55; leg = .22; }
    else if (v.state === 'plant') { const c = digPose((v.cp || 0) % 1); tilt = c.tilt; armA = armB = c.arm; splay = -.5; leg = .3; }
    else if (v.state === 'saw') { const s = Math.sin(t * 9 + v.ph); armA = armB = -1.35 + s * .2; splay = -.25; tilt = .18 + s * .05; leg = .25; }
    else if (v.state === 'pray') { const c = prayPose(((2 * PRAY_T - v.timer) / PRAY_T) % 1); tilt = c.tilt * v.kn; armA = armB = -1.2 + (c.arm + 1.2) * v.kn; splay = c.splay; }
    else if (v.state === 'beg') { const s = Math.sin(t * 2.2 + v.ph); tilt = -.2 * v.kn; armA = -2.9 + s * .12; armB = -2.9 - s * .12; splay = .4 + s * .05; }
    else if (v.state === 'lunch') { // sitzt im Gras und beißt ab und zu vom Brot ab
      bite = Math.max(0, Math.sin(t * 1.4 + v.ph * 3)) ** 4 * v.st;
      tilt = -.14 + bite * .06; armA = -.7; armB = -.7 - 1.75 * bite; splay = .12; armRz = .5 * bite;
    }
    else if (v.state === 'grabbed' || v.state === 'falling') {
      const s = Math.sin(t * 16 + v.ph); roll = v.state === 'grabbed' ? Math.sin(t * 7 + v.ph) * .5 : t * 10;
      leg = s * .5; armA = -2.7 + s * .5; armB = -2.7 - s * .5; splay = .5;
    } else if (v.state === 'dizzy') { armA = armB = 0; splay = 1.2 + Math.sin(t * 6 + v.ph) * .2; }
    if (v.carry && v.state !== 'grabbed' && v.state !== 'falling' && v.state !== 'saw') { armA = armB = -1.1; splay = .12; }
    else if (v.cheer > 0 && ['idle', 'walk', 'pray', 'beg', 'lunch'].includes(v.state)) { const s = Math.sin(t * 13 + v.ph); armA = -2.8 + s * .3; armB = -2.8 - s * .3; splay = .55; bob += Math.abs(Math.sin(t * 9 + v.ph)) * .05; } // Jubel
    const vTool = v.role === 'lumber' ? vAxe : v.role === 'forester' ? vShovel : null, shoulder = vTool && v.state === 'walk' && !v.carry;
    const sapling = v.role === 'forester' && v.saplings > 0 && (v.state === 'walk' || v.state === 'idle');
    dummy.position.set(v.x, v.y + bob, v.z); dummy.rotation.set(tilt, v.h, roll, 'YXZ'); dummy.scale.set(VS * L.s * L.w, VS * L.s, VS * L.s * L.w); dummy.updateMatrix();
    const M = dummy.matrix;
    const part = (mesh, x, y, a, z, pz = 0) => { vEuler.set(a, 0, z); vTmp.makeRotationFromEuler(vEuler).setPosition(x, y, pz); mesh.setMatrixAt(i, vOut.multiplyMatrices(M, vTmp)); };
    // Laterne in der linken Hand (nicht beim Hacken, Beten, Tragen: dann steht sie neben dem Bewohner)
    const handLantern = lantern && !v.carry && ['walk', 'idle', 'flee', 'dizzy'].includes(v.state);
    if (handLantern || sapling) { armA = (handLantern ? -.5 : -.35) + (v.state === 'walk' ? Math.sin(t * 11 + v.ph) * .06 : 0); splay = Math.max(splay, .14); }
    let legA = leg, legB = -leg;
    if (v.st > 0) { // im Sitzen liegen die Beine vorne flach am Boden
      const sl = -1.5 - tilt; legA += (sl - legA) * v.st; legB += (sl - legB) * v.st;
      bob -= v.st * HIP_Y * VS * L.s * .92;
      dummy.position.y = v.y + bob; dummy.updateMatrix();
    }
    if (v.kn > 0) { // auf den Fersen sitzen: Beine liegen hinten flach am Boden, Körper sinkt ab
      const kl = 1.45 - tilt; legA += (kl - legA) * v.kn; legB += (kl - legB) * v.kn;
      bob -= v.kn * HIP_Y * VS * L.s * .8;
      dummy.position.y = v.y + bob; dummy.updateMatrix();
    }
    part(vParts.legL, .038, HIP_Y, legA, 0); part(vParts.legR, -.038, HIP_Y, legB, 0);
    part(vParts.armL, .085, SHO_Y, armA, splay); part(vParts.armR, -.085, SHO_Y, armB, -splay + armRz);
    if (bite >= 0) part(vBread, -.085, SHO_Y, armB, -splay + armRz); else vBread.setMatrixAt(i, zero);
    if (!lantern || v.state === 'grabbed' || v.state === 'falling') { vLantern.setMatrixAt(i, zero); vLanternGlass.setMatrixAt(i, zero); }
    else {
      if (handLantern) { // hängt senkrecht an der Hand, pendelt beim Gehen
        const ca = Math.cos(splay) * .13;
        part(vLantern, .085 + Math.sin(splay) * .13, SHO_Y - ca * Math.cos(armA), Math.sin(t * 5.5 + v.ph) * (v.state === 'walk' ? .25 : .05), 0, -ca * Math.sin(armA));
      } else if (v.carry) part(vLantern, .15, .19, Math.sin(t * 5.5 + v.ph) * .2, 0, .13); // hängt am Holzbündel
      else { // steht neben dem Bewohner am Boden
        const c = Math.cos(v.h), sn = Math.sin(v.h), ox = .24, oz = .06, s2 = VS * L.s;
        vTmp.makeRotationY(v.h).setPosition(v.x + ox * c + oz * sn, surfaceAt(v.x, v.z) + .095 * s2, v.z - ox * sn + oz * c); vOut.copy(vTmp.scale(lV.set(s2, s2, s2)));
        vLantern.setMatrixAt(i, vOut);
      }
      vLanternGlass.setMatrixAt(i, vOut);
      lV.set(0, LANTERN_C, 0).applyMatrix4(vOut); lights.push({ x: lV.x, y: lV.y, z: lV.z });
    }
    vParts.body.setMatrixAt(i, M); vParts.head.setMatrixAt(i, M); vParts.eyes.setMatrixAt(i, M);
    vParts.hair.forEach((m, k) => m.setMatrixAt(i, k === L.hair ? M : zero));
    vParts.beard.setMatrixAt(i, L.beard ? M : zero);
    vWood.forEach(m => m.setMatrixAt(i, v.carry === 1 ? M : zero)); vPlanks.setMatrixAt(i, v.carry === 2 ? M : zero);
    for (const r in vHats) vHats[r].setMatrixAt(i, v.role === r ? M : zero);
    // Werkzeug: beim Arbeiten in beiden Händen (Drehpunkt Schultermitte), unterwegs geschultert
    if (shoulder) part(vParts.armR, -.085, SHO_Y, -1.05, -.1); // hält den Stiel
    for (const set of [vAxe, vShovel]) {
      if (set !== vTool) { set.forEach(m => m.setMatrixAt(i, zero)); continue; }
      if (v.state === 'chop' || v.state === 'plant') set.forEach(m => part(m, 0, SHO_Y, armA, 0));
      else if (shoulder) {
        const a = 2.15, sh = .17; // Stiel liegt mit der Mitte auf der rechten Schulter, Kopf hinten oben
        // Drehpunkt so verschoben, dass die Stielmitte (y = -.17) auf der Schulter liegt; vorderes Ende in der rechten Hand
        set.forEach(m => part(m, -.07, SHO_Y + .02 + Math.cos(a) * sh, a, 0, Math.sin(a) * sh));
      } else set.forEach(m => m.setMatrixAt(i, zero));
    }
    // Setzling in der linken Hand (abends hält sie die Laterne)
    if (sapling && !handLantern) { const ca = Math.cos(splay) * .13; vSapling.forEach(m => part(m, .085 + Math.sin(splay) * .13, SHO_Y - ca * Math.cos(armA) - .02, 0, 0, -ca * Math.sin(armA))); }
    else vSapling.forEach(m => m.setMatrixAt(i, zero));
  });
  for (const m of vAll) m.instanceMatrix.needsUpdate = true;
  updateLights(t);
  updateChips(dt);
  updateShrine(dt, t);

  // trees
  const tc2 = TK.map(() => 0); let sc = 0;
  for (const tr of trees) {
    if (tr.gone) continue;
    const y = heightAt(tr.x, tr.z);
    if (y < .05) { tr.gone = true; if (tr.reserved && tr.reserved !== 'fox') tr.reserved.tree = null; tr.reserved = null; continue; }
    if (tr.alive) {
      if (tr.g < 1) tr.g = Math.min(1, tr.g + dt * .008 * (1 + 2 * weather.rain)); // Regen lässt Bäume schneller wachsen
      const s = ST * tr.g, pull = treeGrab && treeGrab.tr === tr ? treeGrab.prog : 0;
      if (tr.shake > 0) tr.shake = Math.max(0, tr.shake - dt * 3.5);
      const shk = tr.shake ? Math.sin(t * 45) * tr.shake * .045 : 0;
      dummy.position.set(tr.x, y + pull * .25, tr.z); dummy.rotation.set(Math.sin(t * 1.3 + tr.ph) * .03 + Math.sin(t * 31) * pull * .12 + shk, tr.rot, Math.sin(t * 27) * pull * .1); dummy.scale.setScalar(s); dummy.updateMatrix();
      const tm = treeMeshes[tr.type], ti = tc2[tr.type]++; tm.setMatrixAt(ti, dummy.matrix); tm.setColorAt(ti, COL.setScalar(tr.tint || 1));
    } else if (tr.stumpT > 0) {
      tr.stumpT -= dt;
      dummy.position.set(tr.x, y, tr.z); dummy.rotation.set(0, tr.rot, 0); dummy.scale.setScalar(ST); dummy.updateMatrix(); stumpSwarm.set(sc++, dummy.matrix);
    } else if (tr.regrow > 0) { tr.regrow -= dt; if (tr.regrow <= 0) { tr.alive = true; tr.g = .15; } }
    else if (!tr.reserved && Math.random() < dt / 900 * (1 + 3 * weather.rain)) { tr.alive = true; tr.g = .12; } // selten sät sich der Wald selbst aus, bei Regen öfter
  }
  treeMeshes.forEach((m, k) => { m.count = tc2[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }); stumpSwarm.commit(sc);
  const rc = ROCK_GEOS.map(() => 0);
  for (const r of rocks) { const y = heightAt(r.x, r.z); dummy.position.set(r.x, y - r.s * .28, r.z); dummy.rotation.set(r.tx, r.r, r.tz); dummy.scale.setScalar(r.s); dummy.updateMatrix(); rockMeshes[r.v].setMatrixAt(rc[r.v]++, dummy.matrix); }
  rockMeshes.forEach((m, k) => { m.count = rc[k]; m.instanceMatrix.needsUpdate = true; });
  const bc = BUSH_GEOS.map(() => 0);
  for (const b of bushes) { const y = heightAt(b.x, b.z); dummy.position.set(b.x, y, b.z); dummy.rotation.set(Math.sin(t * 1.1 + b.r * 3) * .03, b.r, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); bushMeshes[b.v].setMatrixAt(bc[b.v]++, dummy.matrix); }
  bushMeshes.forEach((m, k) => { m.count = bc[k]; m.instanceMatrix.needsUpdate = true; });
  refreshCover(coverFirst ? 1e6 : 450); coverFirst = false; grassU.uT.value = t;
  for (const s of statics) s.o.position.set(s.x, heightAt(s.x, s.z), s.z);
  if (millFan) millFan.rotation.z += dt * 1.4;

  updateFox(dt, t);
  updateWild(dt, t); updateFish(dt, t);
  updateTrees(dt, t);

  // hand
  if (handAnim.kind) updateHandAnim(dt, t);
  const showHand = !handAnim.kind && tool !== 'blick' && handShown && hitOk;
  if (!handAnim.kind) hand.g.visible = showHand;
  if (showHand) {
    // auf dem Bildschirm etwa gleich groß, egal wie weit gezoomt ist
    const hs = clamp(camera.position.distanceTo(hand.g.position) / 25, .42, 1.25); hand.g.scale.setScalar(hs);
    const lift = heldTree.on ? 1.3 + ST * heldTree.g * .95 : grabbed ? 1.0 : ((pressing && tool === 'sculpt') ? .75 : 1.5) * hs;
    if (treeGrab) {
      // am Stamm festhalten und zittern, je weiter der Baum nachgibt
      const tr = treeGrab.tr, j = treeGrab.prog * .05;
      hand.target.set(tr.x + rnd(j), heightAt(tr.x, tr.z) + .95 * tr.g * ST + treeGrab.prog * .25, tr.z + rnd(j));
    } else if (grabbed || heldTree.on) {
      // Gehaltenes (Bewohner, Baum) bleibt beim Zupacken, wo es war, und folgt dann der Fingerbewegung;
      // die Hand hängt senkrecht darüber
      const x = hit.x + holdOff.x, z = hit.z + holdOff.z;
      hand.target.set(x, Math.max(heightAt(x, z), 0) + lift, z);
    } else {
      // leere Hand: um 'lift' über dem Boden, aber auf der Sichtlinie durch den Zeiger, damit sie genau unter ihm liegt
      const d = ray.ray.direction, k = lift / Math.max(.2, -d.y);
      hand.target.set(hit.x, Math.max(hit.y, 0), hit.z).addScaledVector(d, -k);
    }
    // war die Hand unsichtbar (z. B. zwischen zwei Tipps am Handy), erscheint sie direkt am Ziel statt heranzufliegen
    if (!hand.shown) { hand.g.position.copy(hand.target); hand.vel.set(0, 0, 0); }
    hand.prev.copy(hand.g.position);
    hand.g.position.lerp(hand.target, 1 - Math.exp(-dt * 16));
    const v = tmpV.copy(hand.g.position).sub(hand.prev).divideScalar(Math.max(dt, 1e-3)); hand.vel.lerp(v, .35);
    const dx = controls.target.x - camera.position.x, dz = controls.target.z - camera.position.z;
    hand.g.rotation.y = Math.atan2(-dx, -dz);
    const pose = grabbed || heldTree.on ? HAND_POSES.hold : treeGrab ? HAND_POSES.claw : hoverFox && !pressing ? HAND_POSES.flat
      : pressing ? (tool === 'sculpt' ? (sculptDir > 0 ? HAND_POSES.flat : HAND_POSES.fist) : HAND_POSES.grab) : HAND_POSES.relax;
    poseHand(hand, pose, dt, t);
  }
  hand.shown = showHand;

  // effects
  if (rain.t > 0) {
    rain.t -= dt; const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) { let y = p.getY(i) - dt * 11; if (y < surfaceAt(p.getX(i), p.getZ(i))) y = 6.5; p.setY(i, y); }
    p.needsUpdate = true; rainCloud.position.set(rain.x, 6.6 + Math.sin(t) * .1, rain.z);
    rainPts.material.opacity = Math.min(.8, rain.t);
    if (rain.t <= 0) { rainPts.visible = false; rainCloud.visible = false; }
  }
  if (ringT > 0) { ringT -= dt; const k = 1 - ringT / 1.4; ring.scale.setScalar(.2 + k * .8); ring.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * .75; }
  updateClouds(dt); updateWeatherRain(dt); updateSnowfall(dt, t); updatePuddles(dt, t);
  if ((snowScanT -= dt) <= 0) { snowScanT = 2; scanSnow(); } // neue Gebäude und Bäume bekommen auch Schnee
  // Wind: wechselt langsam zwischen ruhig und böig, bei Regen frischt er auf
  streamU.uT.value = t; waterU.uT.value = t; waterU.uWind.value += (clamp(weather.wind + noise(t * .012, 3.7) * .35 + (rain.t > 0 ? .3 : 0), .06, 1) - waterU.uWind.value) * Math.min(1, dt * .5);
  updateTerrain(dt);

  // camera
  if (follow) { const k = 1 - Math.exp(-dt * 3), nx = controls.target.x + (fox.x - controls.target.x) * k, nz = controls.target.z + (fox.z - controls.target.z) * k;
    camera.position.x += nx - controls.target.x; camera.position.z += nz - controls.target.z; controls.target.x = nx; controls.target.z = nz; }
  const tr = Math.hypot(controls.target.x, controls.target.z);
  if (tr > 25) { const k = 25 / tr, ox = controls.target.x, oz = controls.target.z; controls.target.x *= k; controls.target.z *= k; camera.position.x += controls.target.x - ox; camera.position.z += controls.target.z - oz; }
  controls.target.y = 1;
  controls.update();

  // Tiergeist: Hand schwebt darüber (Maus) -> Einblendung; Kreismenü mitführen
  hoverFox = tool === 'hand' && handShown && primary === null && !grabbed && !heldTree.on && foxUnder(pointerXY.x, pointerXY.y);
  placeFoxUI(dt);
  placeWishUI(); placeForestUI();

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
    // Lager: alle Rohstoffe und was als Nächstes gebaut wird
    $('sLogs').textContent = fmt(S.logs); $('sPlanks').textContent = fmt(S.holz);
    { const nb = construction ? null : nextBuild(); $('sBuild').textContent = construction ? `${construction.label} im Bau` : nb ? `${nb.label} ab ${nb.cost} Brettern` : 'Dorf voll'; }
    updateLagerStock();
    if (!$('sheetWork').hidden) renderWork();
    $('vT').textContent = `${Math.floor(S.hour)}:${String(Math.floor(S.hour % 1 * 6) * 10).padStart(2, '0')}`; $('vTs').textContent = S.timePaused && skipTo === null ? 'angehalten' : dayPhase(S.hour); $('btnTime').classList.toggle('paused', !!S.timePaused);
    { // Sonne bzw. Mond auf dem kleinen Himmelsbogen in der Uhrzeit-Kachel
      const sunUp = sunDir.y >= moonDir.y, a = sunUp ? (S.hour - 6.2) / 13.6 * Math.PI : ((S.hour - 19.6 + 24) % 24) / 10.8 * Math.PI, k = clamp(a, 0, Math.PI);
      const dial = $('tDial'); dial.dataset.body = sunUp ? 'sun' : 'moon';
      $('tBody').setAttribute('transform', `translate(${(18 - 14 * Math.cos(k)).toFixed(1)} ${(17 - 13 * Math.sin(k)).toFixed(1)})`);
      $('btnTime').setAttribute('aria-label', `Uhrzeit ${$('vT').textContent}, ${$('vTs').textContent}. ${S.timePaused ? 'angehalten' : 'läuft'}. Tippen für Zeitmenü`);
    }
    { const k = S.weather; if ($('btnWx').dataset.wx !== k) { $('btnWx').dataset.wx = k; $('wxIc').innerHTML = WX_ICON[k]; $('vW').textContent = WEATHER[k].label[0].toUpperCase() + WEATHER[k].label.slice(1); }
      $('vWs').textContent = S.weatherLocked ? 'festgehalten' : windWord(waterU.uWind.value); $('btnWx').classList.toggle('paused', !!S.weatherLocked);
      $('btnWx').setAttribute('aria-label', `Wetter: ${$('vW').textContent}, ${$('vWs').textContent}. Tippen für Wettermenü`); }
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
// Debug-Zugang für Tests in der Konsole bzw. im Browser-Werkzeug (bewusst dauerhaft drin)
window.__wk = { S, villagers, trees, fox, setTool, STREAM, wild, fish, forestAlert, depData, snowU, wish, startWish, shrine, weather, setWeather, camera, controls, huts, houses, lager, rocks, bushes, cover, navV, navF, findPath, buildNav, waterU, heightAt, reconcileJobs, addWear };
requestAnimationFrame(frame);
}

start().catch(err => { const st = document.getElementById('loadSt'); if (st) st.textContent = 'Die Welt konnte nicht geladen werden. ' + String(err.message).slice(0, 160); console.error(err); });
