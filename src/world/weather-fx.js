// Wolken, Regen, Schneefall und Pfützen

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, smooth, rnd } from '../core/util.js';
import { camera, controls, scene } from '../core/render.js';
import { glowTex, lightDir, lightRaw, skyTmp, weather } from './sky.js';
import { surfaceAt, terrainU } from './terrain.js';
import { COL2, jit, lumpy, paint } from '../models/nature.js';

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
// Schatten hoher Dinge wirft ein unsichtbarer Stellvertreter (schreibt weder Farbe noch Tiefe). Das Licht springt in
// 0,6°-Stufen (gegen flimmernde Kanten); in 20 m Höhe wären das Schattensprünge von bis zu 2 m. Der Stellvertreter
// wird so verschoben, dass sein Schatten dort liegt, wo ihn das stufenlose Licht hinwerfen würde.
const shadowProxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function shadowProxy(geo) { const p = new THREE.Mesh(geo, shadowProxyMat); p.castShadow = true; p.visible = false; p.userData.noSnow = true; scene.add(p); return p; }
function placeProxy(p, src, s) { // s: Schattengröße 0..1 (wächst beim Aufziehen mit)
  const h = src.position.y, kx = lightRaw.x / lightRaw.y - lightDir.x / lightDir.y, kz = lightRaw.z / lightRaw.y - lightDir.z / lightDir.y;
  p.position.set(src.position.x - h * kx, h, src.position.z - h * kz); p.rotation.copy(src.rotation); p.scale.copy(src.scale).multiplyScalar(s); p.visible = s > .02;
}
const CLOUD_N = 30, clouds = [], cloudCol = new THREE.Color();
for (let i = 0; i < CLOUD_N; i++) {
  const m = new THREE.Mesh(CLOUD_GEOS[i % 4], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
  m.renderOrder = 3; scene.add(m);
  clouds.push({ m, sh: shadowProxy(CLOUD_GEOS[i % 4]), x: rnd(52), z: rnd(52), y: 21 + Math.random() * 5, s: 2.2 + Math.random() * 2, rot: Math.random() * 6.28, rank: Math.random(), vis: 0 });
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
    placeProxy(c.sh, c.m, smooth(.05, .95, c.vis)); // Schatten unabhängig davon, ob die Wolke zur Sicht durchsichtig ist
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

export { CLOUD_GEOS, clouds, placeProxy, shadowProxy, updateClouds, updatePuddles, updateSnowfall, updateWeatherRain };
