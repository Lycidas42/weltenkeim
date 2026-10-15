// Tag und Nacht, Himmel, Sterne, Sonne und Mond, Wetter und Schnee

import * as THREE from 'three';
import { clamp, smooth } from '../core/util.js';
import { S } from '../core/state.js';
import { noise } from '../core/noise.js';
import { camera, hemi, renderer, scene, sun } from '../core/render.js';
import { toast } from '../ui/feedback.js';

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
const lightDir = new THREE.Vector3(), lightRaw = new THREE.Vector3(0, 1, 0), WHITE = new THREE.Color(1, 1, 1);
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
  lightDir.copy(body); lightDir.y = Math.max(lightDir.y, .35); lightDir.normalize(); lightRaw.copy(lightDir);
  // in kleinen Stufen nachführen: wandert das Licht in jedem Frame ein winziges Stück, flimmern die Schattenkanten
  { const Q = .6 * Math.PI / 180, az = Math.round(Math.atan2(lightDir.z, lightDir.x) / Q) * Q, el = Math.round(Math.asin(lightDir.y) / Q) * Q; lightDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)); }
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

export { BED, LUNCH, WAKE, WEATHER, dayPhase, glowTex, isDaytime, lightDir, lightRaw, moonDir, setWeather, skipTo, sky, skyTmp, snowSkip, snowU, snowify, sunDir, toggleDayNight, updateDay, weather, workTime };
