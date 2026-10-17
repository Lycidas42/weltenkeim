// Feuer an Gebäuden (Wunder Blitz): Flammen und Rauch, danach Ruß, der sich in einigen Spielstunden verliert

import * as THREE from 'three';
import { rnd } from '../core/util.js';
import { S, onSave } from '../core/state.js';
import { renderer, scene } from '../core/render.js';
import { theme } from '../assets/theme.js';
import { modelInfo } from '../assets/models.js';
import { heightAt } from '../world/terrain.js';
import { floatText } from '../ui/feedback.js';
import { houses, mill } from './houses.js';
import { huts, lager } from './huts.js';

// Ein Gebäude brennt BURN_T Sekunden, aber nicht nieder. Danach bleibt es rußig; der Ruß verliert sich in SOOT_H Spielstunden.
// Zustand am Gebäude: b.fire = { t (Brand in s), soot (Ruß in Spielstunden) }; brennende und rußige Gebäude in `fires`.
const BURN_T = 20, SOOT_H = 4;
const C = theme.palette.miracles;
const fires = [];
// Gebäude: Wohnhäuser, Hütten und Werkstätten, Lager, die Wassermühle (auch bevor sie eine Hütte ist)
function buildings() { const out = [...houses, ...huts, lager]; if (!huts.includes(mill)) out.push(mill); return out; }
// Grundriss in Weltmaß im Raum des Gebäudes: [Mitte x, Mitte z, halbe Breite, halbe Tiefe] (aus dem Theme, Lager im Code gebaut)
function footOf(b) {
  if (b === lager) return [0, 0, 1.25, .8];
  const f = (b.key && modelInfo(b.key).foot) || [0, 0, .4, .4], k = b.o.scale.x;
  return [f[0] * k, f[1] * k, f[2] * k, f[3] * k];
}
// Mitte des Grundrisses in Weltkoordinaten
function footCenter(b) { const [cx, cz] = footOf(b), ry = b.o.rotation.y; return { x: b.x + cx * Math.cos(ry) + cz * Math.sin(ry), z: b.z - cx * Math.sin(ry) + cz * Math.cos(ry) }; }
// Abstand eines Punktes zum Grundriss (0 = darin)
function footDist(b, x, z) {
  const [cx, cz, hx, hz] = footOf(b), ry = b.o.rotation.y, c = Math.cos(ry), s = Math.sin(ry), dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s - cx, lz = dx * s + dz * c - cz;
  return Math.hypot(Math.max(0, Math.abs(lx) - hx), Math.max(0, Math.abs(lz) - hz));
}
// Gebäude an einem Punkt (m = Rand), bei mehreren das mit der nächsten Mitte
function buildingAt(x, z, m = 0) {
  let best = null, bd = 1e9;
  for (const b of buildings()) { if (footDist(b, x, z) > m) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
  return best;
}
const burning = b => !!(b && b.fire && b.fire.t > 0);
// brennendes Gebäude in der Nähe eines Punktes (Bewohner meiden es)
function fireAt(x, z, m = 0) { for (const b of fires) if (b.fire.t > 0 && footDist(b, x, z) <= m) return b; return null; }

// Ruß: das Gebäude bekommt eigene Materialien, deren Farbe zum Ruß hin dunkelt; ohne Ruß wieder die gemeinsamen
const sootC = new THREE.Color(C.soot);
function setSoot(b, k) {
  if (k <= 0) { if (b.sootMats) { b.o.traverse(o => { if (o.isMesh && o.userData.mat0) { o.material.dispose(); o.material = o.userData.mat0; delete o.userData.mat0; delete o.userData.col0; } }); b.sootMats = false; } return; }
  if (!b.sootMats) { b.sootMats = true; b.o.traverse(o => { if (o.isMesh && !Array.isArray(o.material) && !o.userData.mat0) { o.userData.mat0 = o.material; o.material = o.material.clone(); o.userData.col0 = o.material.color.clone(); } }); }
  b.o.traverse(o => { if (o.isMesh && o.userData.mat0) { o.material.color.copy(o.userData.col0).lerp(sootC, k * .82); if (o.userData.mat0.emissive) o.material.emissiveIntensity = o.userData.mat0.emissiveIntensity * (1 - k); } });
}
// Höhe des Dachs (einmal je Gebäude gemessen)
const box = new THREE.Box3();
function roofOf(b) { if (b.roofH === undefined) { box.setFromObject(b.o); b.roofH = Math.max(.6, box.max.y - heightAt(b.x, b.z)); } return b.roofH; }
// Feuer legen: Brand neu, Ruß voll; wartende Waren einer Hütte verbrennen
function ignite(b) {
  if (!b.fire) { b.fire = { t: 0, soot: 0 }; fires.push(b); }
  b.fire.t = BURN_T; b.fire.soot = SOOT_H;
  let lost = 0;
  if (b.goods) for (const k in b.goods) { lost += b.goods[k] || 0; delete b.goods[k]; }
  if (b.planks) { lost += b.planks; b.planks = 0; }
  return lost;
}

// Flammen und Rauch: ein Partikelsystem für alle Brände (auch für den Blitzeinschlag und brennende Bäume).
// Vormultiplizierte Farben: Flammen leuchten additiv (Deckkraft 0), Rauch deckt normal ab (a.z = 1).
const FX_N = 420, fxPos = new Float32Array(FX_N * 3), fxCol = new Float32Array(FX_N * 3), fxA = new Float32Array(FX_N * 3), parts = [];
const fxGeo = new THREE.BufferGeometry();
fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 3)); fxGeo.setAttribute('a', new THREE.BufferAttribute(fxA, 3));
const fxU = { uVH: { value: 800 } };
const fxPts = new THREE.Points(fxGeo, new THREE.ShaderMaterial({ uniforms: fxU, transparent: true, depthWrite: false, vertexColors: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: `attribute vec3 a; varying vec2 vA; varying vec3 vC; uniform float uVH; void main() { vA = a.xz; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = a.y * projectionMatrix[1][1] * uVH * .5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec2 vA; varying vec3 vC; void main() { vec2 c = gl_PointCoord - .5; float d = dot(c, c); if (d > .25 || vA.x <= 0.) discard; float a = vA.x * (1. - d * 4.); gl_FragColor = vec4(vC * a, a * vA.y); }` }));
fxPts.frustumCulled = false; fxPts.userData.noSnow = true; fxPts.renderOrder = 5; scene.add(fxPts);
const FL = C.flame.map(c => new THREE.Color(c)), SMOKE = new THREE.Color(C.smoke), fc = new THREE.Color();
// kind: 'flame' (steigt schnell, glüht gelb → rot) oder 'smoke' (dunkel, wächst, treibt)
function spawnFx(kind, x, y, z, s = 1) {
  if (parts.length >= FX_N) parts.shift();
  const fl = kind === 'flame';
  parts.push({ fl, x, y, z, vx: rnd(.15), vy: fl ? .9 + Math.random() * .8 : .45 + Math.random() * .3, vz: rnd(.15), t: 0, life: fl ? .45 + Math.random() * .4 : 2.2 + Math.random() * 1.2, s });
}
// Stichflamme an einem Punkt (Blitzeinschlag, Baum verbrennt)
function burst(x, y, z, n = 14, r = .3) { for (let k = 0; k < n; k++) spawnFx(k % 3 ? 'flame' : 'smoke', x + rnd(r), y + Math.random() * r, z + rnd(r), 1.3); }
// ein Licht für das Feuer (immer in der Szene, sonst übersetzt Three.js die Shader neu)
const fireLight = new THREE.PointLight(0xff8a3a, 0, 7, 1.6); scene.add(fireLight);

// gespeicherte Brände erst beim ersten Bild herstellen (dann stehen alle Gebäude)
let restore = S.fires, lastH = S.hour;
onSave(() => { S.fires = fires.map(b => ({ x: Math.round(b.x * 100) / 100, z: Math.round(b.z * 100) / 100, t: Math.round(b.fire.t * 10) / 10, soot: Math.round(b.fire.soot * 1000) / 1000 })); });
function updateFire(dt, t) {
  if (restore) {
    for (const f of restore) { const b = buildingAt(f.x, f.z, .3); if (b && !b.fire) { b.fire = { t: Math.max(0, Math.min(BURN_T, f.t)), soot: Math.max(0, Math.min(SOOT_H, f.soot)) }; fires.push(b); } }
    restore = null;
  }
  const dh = Math.min(2, (S.hour - lastH + 24) % 24); lastH = S.hour; // vergangene Spielstunden (Zeitraffer eingeschlossen)
  let lit = null;
  for (let i = fires.length - 1; i >= 0; i--) {
    const b = fires[i], F = b.fire;
    if (F.t > 0) {
      F.t -= dt; lit = lit || b;
      const [cx, cz, hx, hz] = footOf(b), ry = b.o.rotation.y, c = Math.cos(ry), s = Math.sin(ry), y0 = heightAt(b.x, b.z), top = roofOf(b);
      const k = Math.min(1, (BURN_T - F.t) / 1.5, F.t / 2 + .15); // Feuer flammt auf und sinkt am Ende zusammen
      const spot = () => { const lx = cx + rnd(hx * .85), lz = cz + rnd(hz * .85); return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; };
      for (let n = Math.floor(dt * 90 * k + Math.random()); n > 0; n--) { const [x, z] = spot(); spawnFx('flame', x, y0 + top * (.4 + Math.random() * .55), z, 1.1 + hx * .7); }
      if (Math.random() < dt * 14 * k) { const [x, z] = spot(); spawnFx('smoke', x, y0 + top * .95, z, 1.1 + hx * .6); }
      setSoot(b, Math.min(1, (BURN_T - F.t) / 8));
      if (F.t <= 0) { F.t = 0; floatText(b.x, y0 + top + .4, b.z, 'Das Feuer erlischt', 'w'); }
    } else {
      F.soot -= dh;
      if (F.soot <= 0) { setSoot(b, 0); delete b.fire; fires.splice(i, 1); continue; }
      setSoot(b, F.soot / SOOT_H);
    }
  }
  if (lit) { fireLight.position.set(lit.x, heightAt(lit.x, lit.z) + roofOf(lit) + .4, lit.z); fireLight.intensity = (4 + Math.sin(t * 17) * 1.2 + Math.sin(t * 7.3) * .8) * Math.min(1, lit.fire.t / 2); }
  else fireLight.intensity = 0;
  // Partikel fortschreiben
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; if (q.t > q.life) { parts.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (!q.fl) { q.vx += dt * .12; q.vy *= 1 - dt * .2; } }
  for (let i = 0; i < FX_N; i++) {
    const q = parts[i]; if (!q) { fxA[i * 3] = 0; continue; }
    const u = q.t / q.life; fxPos.set([q.x, q.y, q.z], i * 3);
    if (q.fl) { fc.copy(FL[0]).lerp(FL[1], Math.min(1, u * 2)); if (u > .5) fc.lerp(FL[2], (u - .5) * 2); fxA[i * 3] = Math.min(1, u * 8) * (1 - u) * .9; fxA[i * 3 + 1] = q.s * (.32 - u * .18); fxA[i * 3 + 2] = 0; }
    else { fc.copy(SMOKE); fxA[i * 3] = Math.min(1, u * 5) * (1 - u) * .65; fxA[i * 3 + 1] = q.s * (.28 + u * .8); fxA[i * 3 + 2] = 1; }
    fxCol.set([fc.r, fc.g, fc.b], i * 3);
  }
  fxGeo.attributes.position.needsUpdate = fxGeo.attributes.color.needsUpdate = fxGeo.attributes.a.needsUpdate = true;
  fxU.uVH.value = renderer.domElement.height; fxPts.visible = parts.length > 0;
}

export { BURN_T, SOOT_H, buildingAt, buildings, burning, burst, fireAt, fires, footCenter, footDist, ignite, roofOf, spawnFx, updateFire };
