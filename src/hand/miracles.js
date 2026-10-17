// Wunder: Regen, Eile, Bann, Wirbelsturm und Blitz

import * as THREE from 'three';
import { clamp, rnd, smooth } from '../core/util.js';
import { MIRACLES, ROLES, S, emit, save } from '../core/state.js';
import { camera, renderer, scene } from '../core/render.js';
import { theme } from '../assets/theme.js';
import { floatText, toast } from '../ui/feedback.js';
import { heightAt, streamDist, surfaceAt } from '../world/terrain.js';
import { input } from './pointer.js';
import { CLOUD_GEOS, placeProxy, shadowProxy } from '../world/weather-fx.js';
import { TREE_H, addTree, treeNear, trees } from '../world/trees.js';
import { FIELD_STAGES, fields } from '../farm/farm.js';
import { nearBuilding } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { houseDoor, mill } from '../village/houses.js';
import { lager } from '../village/huts.js';
import { hutDoor } from '../village/build.js';
import { BURN_T, buildingAt, burst, footDist, ignite, roofOf } from '../village/fire.js';
import { puffs } from '../village/workshops.js';
import { JOB, canStartle, flee, hurl } from '../village/ai.js';
import { wishDone } from '../village/wishes.js';
import { killVillager } from '../village/death.js';
import { killAnimal, startle, wild } from '../wildlife/land.js';
import { foxCast } from '../creature/ai.js';
import { forestHelped } from '../village/forest-alert.js';
import { ST } from '../village/layout.js';
import { flingTree, freeTree } from './grab.js';

// Regenwolke des Wunders: eine dunkle Wolke aus denselben Formen
const rainCloud = new THREE.Mesh(CLOUD_GEOS[2], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, color: 0x8d98a4, transparent: true, opacity: .55, depthWrite: false })); // halb durchsichtig, damit man sieht, wo es regnet
const rainCloudSh = shadowProxy(CLOUD_GEOS[2]); rainCloud.visible = false; rainCloud.scale.setScalar(1.6); scene.add(rainCloud);
const RAIN_N = 450;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 3), 3));
const rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbfe4ff, size: .09, transparent: true, opacity: .8 }));
rainPts.visible = false; rainPts.frustumCulled = false; scene.add(rainPts);
const rain = { t: 0, x: 0, z: 0 };
const RAIN_T = 5.5;
// geplantes Wachstum des Regenwunders: { tr | x,z | fl (Feld), at (Wartezeit), dur, to (Zuwachs bzw. Zielgröße), revive }
const sprouts = [];
function updateSprouts(dt) {
  for (let i = sprouts.length - 1; i >= 0; i--) {
    const s = sprouts[i]; s.at -= dt; if (s.at > 0) continue;
    if (s.fl) { // Feld: Fortschritt steigt gleitend bis zur nächsten Stufe (reif wird es in updateFarm)
      const f = s.fl; if (f.state !== 'grow') { sprouts.splice(i, 1); continue; }
      if (s.from === undefined) s.from = f.g;
      const k = Math.min(1, -s.at / s.dur); f.g = Math.max(f.g, s.from + (s.to - s.from) * (1 - (1 - k) ** 2));
      if (k >= 1) sprouts.splice(i, 1);
      continue;
    }
    if (!s.started) {
      s.started = true;
      if (s.tr) {
        const t = s.tr;
        if (t.gone || (s.revive ? t.alive || t.reserved : !t.alive)) { sprouts.splice(i, 1); continue; }
        if (s.revive) { t.alive = true; t.g = .02; t.stumpT = 0; t.regrow = 0; s.from = .02; } else { s.from = t.g; s.to = Math.min(1, t.g + s.to); }
      } else {
        if (treeNear(s.x, s.z, .8) || !(s.tr = addTree(s.x, s.z, .02))) { sprouts.splice(i, 1); continue; }
        s.from = .02;
      }
    }
    const t = s.tr; if (t.gone || !t.alive) { sprouts.splice(i, 1); continue; }
    const k = Math.min(1, -s.at / s.dur), e = 1 - (1 - k) ** 3; // sanft auslaufend
    t.g = Math.max(t.g, s.from + (s.to - s.from) * e);
    if (k >= 1) sprouts.splice(i, 1);
  }
}
const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf3c04d, transparent: true, opacity: 0, depthWrite: false }));
scene.add(ring); let ringT = 0;

function castRain(x, z) {
  rain.t = RAIN_T; rain.x = x; rain.z = z; rainPts.visible = true; rainCloud.visible = true;
  const p = rainGeo.attributes.position;
  for (let i = 0; i < RAIN_N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4; p.setXYZ(i, x + Math.cos(a) * r, Math.random() * 7, z + Math.sin(a) * r); }
  // Während des Regens wachsen Bäume nach und nach, Stümpfe treiben aus und neue Setzlinge sprießen einer nach dem anderen
  const when = () => .3 + Math.random() * (RAIN_T - 1.5);
  let rev = 0;
  for (const t of trees) { if (t.gone || (t.x - x) ** 2 + (t.z - z) ** 2 > 25) continue; if (t.alive) sprouts.push({ tr: t, at: when(), dur: 3, to: .5 }); else if (!t.reserved) { sprouts.push({ tr: t, at: when(), dur: 1.6, to: .35, revive: true }); rev++; } }
  const planned = [];
  let n = 0; for (let k = 0; k < 60 && n < 6; k++) { const a = Math.random() * 6.28, r = Math.random() * 4.5, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, h = heightAt(tx, tz);
    if (h < .4 || h > 3.4 || Math.hypot(tx, tz) < 8.5 || treeNear(tx, tz, .8) || planned.some(p => (p.x - tx) ** 2 + (p.z - tz) ** 2 < .64) || streamDist(tx, tz) < 1 || nearBuilding(tx, tz, .55)) continue;
    planned.push({ x: tx, z: tz }); sprouts.push({ x: tx, z: tz, at: when(), dur: 1.8, to: .15 }); n++; }
  floatText(x, surfaceAt(x, z) + 2, z, n ? `${n} neue Setzlinge` : 'Der Wald trinkt', 's');
  // Felder: wachsen während des Regens bis zur nächsten Stufe (Viertel), danach eine Weile schneller
  let wet = 0, up = 0; for (const f of fields) if ((f.x - x) ** 2 + (f.z - z) ** 2 < 36) {
    f.water = 150; wet++;
    if (f.state === 'grow') { let to = Math.min(1, (Math.floor(f.g * FIELD_STAGES) + 1) / FIELD_STAGES); if (to - f.g < .1) to = Math.min(1, to + 1 / FIELD_STAGES); sprouts.push({ fl: f, at: .4, dur: RAIN_T - 1, to }); up++; }
  }
  if (wet) floatText(x, surfaceAt(x, z) + 2.6, z, up ? `${up} ${up === 1 ? 'Feld wächst' : 'Felder wachsen'}` : `${wet} ${wet === 1 ? 'Feld trinkt' : 'Felder trinken'}`, 's');
  if (n + rev > 0 || trees.some(t => t.alive && !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < 25)) wishDone('rain');
  forestHelped(x, z);
}
function castHaste(x, z) {
  ringT = 1.4; ring.position.set(x, surfaceAt(x, z) + .15, z);
  let n = 0; for (const v of villagers) if ((v.x - x) ** 2 + (v.z - z) ** 2 < 36) { v.haste = 30; n++; }
  floatText(x, surfaceAt(x, z) + 1.6, z, n ? `${n} Bewohner beflügelt` : 'Niemand in Reichweite', 's');
  if (n) wishDone('haste');
}
const C = theme.palette.miracles;
// Bann: alles lebende Wild im Umkreis erstarrt (Funken steigen auf), die Jäger nehmen es ins Visier und treffen sicher
const banRing = new THREE.Mesh(new THREE.RingGeometry(MIRACLES.ban.r - .6, MIRACLES.ban.r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.ban, transparent: true, opacity: 0, depthWrite: false }));
scene.add(banRing); let banT = 0;
function castBan(x, z) {
  const B = MIRACLES.ban; banT = 1.6; banRing.position.set(x, surfaceAt(x, z) + .15, z);
  let n = 0;
  for (const a of wild) if (a.state !== 'dead' && (a.x - x) ** 2 + (a.z - z) ** 2 < B.r * B.r) { a.stun = B.t; a.state = 'idle'; a.timer = 1; n++; }
  floatText(x, surfaceAt(x, z) + 1.6, z, n ? `${n} ${n === 1 ? 'Tier' : 'Tiere'} gebannt` : 'Kein Wild in Reichweite', 's');
  // freie Jäger nehmen das gebannte Wild ins Visier (JOB.hunter wählt gebanntes zuerst)
  if (n) for (const v of villagers) if (v.role === 'hunter' && v.hut && !v.carry && ['idle', 'walk', 'aim'].includes(v.state) && !(v.prey && v.prey.state === 'dead') && !(v.prey && v.prey.stun > 0)) { v.prey = null; JOB.hunter(v); }
  return n;
}

// Wirbelsturm: Der Finger wischt eine Bahn (höchstens MIRACLES.storm.len), ein Wirbel zieht sie in einigen Sekunden
// entlang. Bäume nahe der Bahn reißt er aus, Bewohner wirbelt er durch die Luft (er tötet niemanden), im weiteren
// Umkreis fliehen Bewohner und Wild.
const STORM_MIN = 1.5, STORM_SCARE = 5.5;
const pathLen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; };
// Bahn auf die Höchstlänge kürzen
function clipPath(pts, max) {
  const out = [pts[0]]; let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    if (L + d >= max) { const k = (max - L) / (d || 1); out.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }); return out; }
    L += d; out.push(b);
  }
  return out;
}
// Bahn beim Wischen: ein flaches Band knapp über dem Boden
const TRAIL_N = 96, trailPos = new Float32Array(TRAIL_N * 2 * 3), trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: C.trail, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; trail.visible = false; trail.renderOrder = 8; trail.userData.noSnow = true; scene.add(trail);
let trailFade = 0;
function drawTrail(pts) {
  if (!pts || pts.length < 2) { if (trail.visible && !trailFade) trailFade = .5; return; }
  trailFade = 0; trail.visible = true; trail.material.opacity = .7;
  // gleichmäßig nachrechnen (höchstens TRAIL_N Punkte)
  const L = pathLen(pts), n = Math.min(TRAIL_N, Math.max(2, Math.ceil(L / .2) + 1)), q = [];
  for (let k = 0; k < n; k++) q.push(pointAt(pts, L * k / (n - 1)));
  for (let k = 0; k < TRAIL_N; k++) {
    const p = q[Math.min(k, n - 1)], a = q[Math.max(0, Math.min(k, n - 1) - 1)], b = q[Math.min(n - 1, Math.min(k, n - 1) + 1)];
    let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const w = k < n ? .13 * (k === n - 1 ? .3 : 1) : 0, y = Math.max(heightAt(p.x, p.z), 0) + .09;
    trailPos.set([p.x - dz * w, y, p.z + dx * w, p.x + dz * w, y, p.z - dx * w], k * 6);
  }
  trailGeo.attributes.position.needsUpdate = true;
}
// Abstand eines Punktes zur Bahn ab Strecke s0
function pathDist(pts, x, z, s0 = 0) {
  let best = 1e9, s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez); if (!L) continue;
    const u0 = Math.max(0, (s0 - s) / L); s += L; if (u0 >= 1) continue;
    const u = clamp(((x - a.x) * ex + (z - a.z) * ez) / (L * L), u0, 1); best = Math.min(best, Math.hypot(x - a.x - ex * u, z - a.z - ez * u));
  }
  return best;
}
// Punkt nach Strecke s entlang der Bahn (mit Richtung)
function pointAt(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= d || i === pts.length - 1) { const k = d ? clamp(s / d, 0, 1) : 0; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: d ? (b.x - a.x) / d : 1, dz: d ? (b.z - a.z) / d : 0 }; }
    s -= d;
  }
  return { x: pts[0].x, z: pts[0].z, dx: 1, dz: 0 };
}
// Wirbel: Trichter (ein Mesh) und ein Partikelsystem aus Staub und Blättern
const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.15, .2, 3.4, 20, 4, true).translate(0, 1.7, 0), new THREE.MeshBasicMaterial({ color: C.funnel, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
funnel.visible = false; funnel.userData.noSnow = true; scene.add(funnel);
const SW_N = 260, swPos = new Float32Array(SW_N * 3), swCol = new Float32Array(SW_N * 3), swA = new Float32Array(SW_N * 2), swP = [];
const swGeo = new THREE.BufferGeometry();
swGeo.setAttribute('position', new THREE.BufferAttribute(swPos, 3)); swGeo.setAttribute('color', new THREE.BufferAttribute(swCol, 3)); swGeo.setAttribute('a', new THREE.BufferAttribute(swA, 2));
const swU = { uVH: { value: 800 } };
const swPts = new THREE.Points(swGeo, new THREE.ShaderMaterial({ uniforms: swU, transparent: true, depthWrite: false, vertexColors: true,
  vertexShader: `attribute vec2 a; varying float vA; varying vec3 vC; uniform float uVH; void main() { vA = a.x; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = a.y * projectionMatrix[1][1] * uVH * .5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying vec3 vC; void main() { vec2 c = gl_PointCoord - .5; float d = dot(c, c); if (d > .25 || vA <= 0.) discard; gl_FragColor = vec4(vC, vA * (1. - d * 3.)); }` }));
swPts.frustumCulled = false; swPts.visible = false; swPts.userData.noSnow = true; scene.add(swPts);
{
  const col = new THREE.Color(), D = C.dust.map(c => new THREE.Color(c)), Lf = C.leaf.map(c => new THREE.Color(c));
  for (let i = 0; i < SW_N; i++) {
    const leaf = i % 4 === 0; col.copy(leaf ? Lf[0] : D[0]).lerp(leaf ? Lf[1] : D[1], Math.random());
    swP.push({ a: Math.random() * 6.28, h: Math.random(), sp: 5 + Math.random() * 5, up: .25 + Math.random() * .35, j: Math.random() * .35, leaf });
    swCol.set([col.r, col.g, col.b], i * 3);
  }
  swGeo.attributes.color.needsUpdate = true;
}
const storm = { on: false, path: null, len: 0, dur: 0, t: 0, x: 0, z: 0, id: 0, hits: null, scareT: 0 };
function castStorm(path) {
  const pts = clipPath(path.filter(p => p && isFinite(p.x) && isFinite(p.z)), MIRACLES.storm.len), L = pathLen(pts);
  if (pts.length < 2 || L < .01) return false;
  Object.assign(storm, { on: true, path: pts, len: L, dur: 3 + 3 * L / MIRACLES.storm.len, t: 0, x: pts[0].x, z: pts[0].z, id: storm.id + 1, hits: { kind: 'storm', trees: 0, villagers: 0, killed: 0, buildings: 0, wild: 0 }, scareT: 0 });
  funnel.visible = swPts.visible = true; drawTrail(null);
  floatText(pts[0].x, surfaceAt(pts[0].x, pts[0].z) + 2, pts[0].z, 'Wirbelsturm!', 'w');
  return true;
}
function updateStorm(dt, t) {
  const S0 = storm; S0.t += dt;
  const T = S0.t, run = T <= S0.dur, p = pointAt(S0.path, S0.len * Math.min(1, T / S0.dur));
  S0.x = p.x; S0.z = p.z;
  const I = smooth(0, .5, T) * (1 - smooth(S0.dur, S0.dur + .8, T)), W = MIRACLES.storm.w;
  if (run) {
    // Bäume nahe der Bahn: ausreißen und davonwirbeln (Drall um den Wirbel und mit ihm weiter)
    for (const tr of trees) {
      if (!tr.alive || tr.gone) continue;
      const dx = tr.x - p.x, dz = tr.z - p.z, d = Math.hypot(dx, dz); if (d > W) continue;
      const tx = -dz / (d || 1), tz = dx / (d || 1), sp = 3 + Math.random() * 2;
      if (flingTree(tr, p.dx * 3 + tx * sp + rnd(1), 7 + Math.random() * 3, p.dz * 3 + tz * sp + rnd(1))) { S0.hits.trees++; spawnDust(tr.x, tr.z); }
    }
    // Bewohner nahe der Bahn: hochgewirbelt, jeder höchstens einmal je Sturm
    for (const v of villagers) {
      if (v.stormId === S0.id) continue;
      const dx = v.x - p.x, dz = v.z - p.z, d = Math.hypot(dx, dz); if (d > W) continue;
      const tx = -dz / (d || 1), tz = dx / (d || 1), sp = 2.2 + Math.random();
      if (hurl(v, p.dx * 2 + tx * sp, 7 + Math.random() * 1.5, p.dz * 2 + tz * sp)) { v.stormId = S0.id; S0.hits.villagers++; }
    }
    // weiterer Umkreis: Bewohner und Wild fliehen; wer auf der restlichen Bahn steht, entkommt nicht mehr
    if ((S0.scareT -= dt) <= 0) {
      S0.scareT = .3;
      for (const v of villagers) { if (v.stormId === S0.id || v.state === 'flee') continue; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d > W && d < STORM_SCARE && pathDist(S0.path, v.x, v.z, S0.len * T / S0.dur) > W + .2) flee(v, p.x, p.z, 3.5, 2.4); }
      for (const a of wild) if (a.state !== 'flee' && Math.hypot(a.x - p.x, a.z - p.z) < STORM_SCARE + 1 && startle(a, p.x, p.z, 5)) S0.hits.wild++;
    }
  } else if (S0.hits) { // durchgezogen: melden, was er getroffen hat (für die spätere Waage)
    const H = S0.hits; S0.hits = null; emit('miracleHit', { ...H, x: S0.x, z: S0.z });
    if (H.trees || H.villagers) floatText(S0.x, surfaceAt(S0.x, S0.z) + 2.2, S0.z, [H.trees && `${H.trees} ${H.trees === 1 ? 'Baum' : 'Bäume'} entwurzelt`, H.villagers && `${H.villagers} Bewohner herumgewirbelt`].filter(Boolean).join(', '), 'w');
  }
  // Trichter und Partikel
  const y0 = Math.max(surfaceAt(S0.x, S0.z), 0);
  funnel.position.set(S0.x + Math.sin(T * 3.1) * .08, y0, S0.z + Math.cos(T * 2.7) * .08); funnel.rotation.y = -T * 9; funnel.material.opacity = .2 * I;
  funnel.scale.set(.6 + .4 * I, .5 + .5 * I, .6 + .4 * I);
  for (let i = 0; i < SW_N; i++) {
    const q = swP[i]; q.a += q.sp * dt; q.h += q.up * dt; if (q.h > 1) { q.h -= 1; q.j = Math.random() * .35; }
    const hy = q.h * 3.4 * (.5 + .5 * I), r = (.22 + q.h * 1.0 + q.j) * (.6 + .4 * I), lean = q.h * q.h * .25;
    swPos.set([S0.x + Math.cos(q.a) * r + Math.sin(T * 3.1) * lean, y0 + hy, S0.z + Math.sin(q.a) * r + Math.cos(T * 2.7) * lean], i * 3);
    swA[i * 2] = I * Math.min(1, q.h * 6) * (1 - q.h * .5) * (q.leaf ? 1 : .75); swA[i * 2 + 1] = q.leaf ? .13 : .2 + q.h * .25;
  }
  swGeo.attributes.position.needsUpdate = swGeo.attributes.a.needsUpdate = true; swU.uVH.value = renderer.domElement.height;
  if (Math.random() < dt * 12 * I) spawnDust(S0.x + rnd(.6), S0.z + rnd(.6));
  if (T > S0.dur + .8) { S0.on = false; funnel.visible = swPts.visible = false; }
}
// Staubwolke am Boden (Rauch der Werkstätten nutzt dieselben Wölkchen)
function spawnDust(x, z) { if (puffs.length < 120) puffs.push({ x, y: Math.max(heightAt(x, z), 0) + .1, z, t: 0, life: 1 + Math.random() * .8 }); }

// Blitz: ein Ziel per Tipp. Ein Lichtblitz erhellt kurz die Szene, die getroffene Stelle bleibt angesengt.
// Ein direkter Treffer tötet einen Bewohner, knapp daneben wirft er um; Gebäude brennen (nicht nieder), Bäume werden zu
// Asche, Wild wird erlegt. Bewohner im Umkreis fliehen. Gehaltene, getragene und schlafende Bewohner trifft er nicht.
const BOLT_HIT = .32, BOLT_NEAR = 1.4, BOLT_FEAR = 7, BOLT_T = .45;
const onGround = v => !['grabbed', 'ride', 'falling', 'sleep', 'mine', 'dying'].includes(v.state) && !v.hidden;
const boltMat = (op) => new THREE.MeshBasicMaterial({ color: C.bolt, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const BOLT_SEG = 14, boltCore = new THREE.Mesh(new THREE.BufferGeometry(), boltMat(1)), boltHalo = new THREE.Mesh(new THREE.BufferGeometry(), boltMat(.3));
for (const m of [boltCore, boltHalo]) { m.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BOLT_SEG + 1) * 6), 3)); const idx = []; for (let i = 0; i < BOLT_SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } m.geometry.setIndex(idx); m.frustumCulled = false; m.visible = false; m.renderOrder = 9; m.userData.noSnow = true; scene.add(m); }
const EXPO = renderer.toneMappingExposure, camR = new THREE.Vector3();
let boltT = 0;
function drawBolt(x, y, z) {
  camR.setFromMatrixColumn(camera.matrixWorld, 0); // quer zur Blickrichtung, damit der Strahl von vorn zu sehen ist
  const top = { x: x + rnd(2.5), y: y + 18, z: z + rnd(2.5) }, pts = [];
  for (let i = 0; i <= BOLT_SEG; i++) { const k = i / BOLT_SEG, j = i && i < BOLT_SEG ? (1 - k) * .9 + .15 : 0; pts.push([top.x + (x - top.x) * k + rnd(j), top.y + (y - top.y) * k, top.z + (z - top.z) * k + rnd(j)]); }
  for (const [m, w] of [[boltCore, .07], [boltHalo, .45]]) {
    const a = m.geometry.attributes.position;
    pts.forEach((p, i) => { const ww = w * (i === BOLT_SEG ? .4 : 1); a.setXYZ(i * 2, p[0] - camR.x * ww, p[1], p[2] - camR.z * ww); a.setXYZ(i * 2 + 1, p[0] + camR.x * ww, p[1], p[2] + camR.z * ww); });
    a.needsUpdate = true; m.geometry.computeBoundingSphere(); m.visible = true;
  }
  boltT = BOLT_T;
}
// angesengter Boden: dunkle, weiche Flecken (Instanzen), verlieren sich in einigen Spielstunden
const SCORCH_N = 24, scorchTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.55, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(0,0,0,${.15 + Math.random() * .3})`; g.beginPath(); const a = Math.random() * 6.28, r = 18 + Math.random() * 12; g.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 4 + Math.random() * 6, 0, 6.28); g.fill(); }
  return new THREE.CanvasTexture(cv);
})();
const scorchMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.scorch, map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SCORCH_N);
scorchMesh.count = 0; scorchMesh.frustumCulled = false; scorchMesh.renderOrder = 1; scorchMesh.userData.noSnow = true; scene.add(scorchMesh);
const scorches = []; // { x, z, r, rot, h (Spielstunden) }
const SCORCH_H = 5;
function scorch(x, z, r) { if (heightAt(x, z) < 0) return; if (scorches.length >= SCORCH_N) scorches.shift(); scorches.push({ x, z, r, rot: Math.random() * 6.28, h: SCORCH_H }); }
let lastH = S.hour;
function updateScorch() {
  const dh = Math.min(2, (S.hour - lastH + 24) % 24); lastH = S.hour;
  for (let i = scorches.length - 1; i >= 0; i--) { scorches[i].h -= dh; if (scorches[i].h <= 0) scorches.splice(i, 1); }
  scorches.forEach((q, i) => { const k = Math.min(1, q.h / 1.5); scorchDummy.position.set(q.x, heightAt(q.x, q.z) + .03, q.z); scorchDummy.rotation.set(0, q.rot, 0); scorchDummy.scale.setScalar(q.r * (.4 + .6 * k)); scorchDummy.updateMatrix(); scorchMesh.setMatrixAt(i, scorchDummy.matrix); });
  scorchMesh.count = scorches.length; scorchMesh.instanceMatrix.needsUpdate = true;
}
const scorchDummy = new THREE.Object3D();
// Name eines Gebäudes für den Hinweis
function buildingName(b) {
  if (b === lager) return 'Das Lager';
  if (b.role) return `${ROLES[b.role].m ? 'Der' : 'Die'} ${ROLES[b.role].hut}`;
  return b === mill ? 'Die Wassermühle' : 'Ein Haus';
}
function castBolt(x, z) {
  const H = { kind: 'bolt', x, z, trees: 0, villagers: 0, killed: 0, buildings: 0, wild: 0 };
  // Ziel: ein Bewohner am Boden, sonst Wild, ein Gebäude, ein Baum, sonst der Boden
  let vt = null, vd = BOLT_HIT;
  for (const v of villagers) if (onGround(v)) { const d = Math.hypot(v.x - x, v.z - z); if (d < vd) { vd = d; vt = v; } }
  let at = null, ad = .45;
  if (!vt) for (const a of wild) if (a.state !== 'dead') { const d = Math.hypot(a.x - x, a.z - z); if (d < ad) { ad = d; at = a; } }
  const b = !vt && !at ? buildingAt(x, z, .05) : null;
  let tr = null, td = .6;
  if (!vt && !at && !b) for (const t of trees) if (t.alive && !t.gone) { const d = Math.hypot(t.x - x, t.z - z); if (d < td) { td = d; tr = t; } }
  let y = surfaceAt(x, z);
  if (vt) { // direkter Treffer: der Bewohner stirbt
    x = vt.x; z = vt.z; y = vt.y; killVillager(vt); H.killed = 1;
    burst(x, y + .2, z, 10, .15); scorch(x, z, .6);
  } else if (at) { // Wild: erlegt, kann wie Jagdbeute aufgehoben werden
    x = at.x; z = at.z; y = heightAt(x, z); at.stun = 0; killAnimal(at); H.wild = 1;
    floatText(x, y + .7, z, 'Erlegt', 'w'); burst(x, y + .15, z, 6, .1); scorch(x, z, .5);
  } else if (b) { // Gebäude: brennt etwa BURN_T Sekunden, aber nicht nieder; drinnen und daneben fliehen alle
    y = heightAt(b.x, b.z) + roofOf(b); const lost = ignite(b); H.buildings = 1;
    for (const v of villagers) {
      if (v.state === 'sleep' && v.home === b) { const d = houseDoor(b, .35); v.x = d.x; v.z = d.z; v.state = 'idle'; } // geweckt, raus aus dem Haus
      if (v.state === 'mine' && v.hut === b) { const d = hutDoor(b, .3); v.x = d.x; v.z = d.z; v.state = 'idle'; }
      if ((v.hut === b && v.state !== 'walk') || footDist(b, v.x, v.z) < 1.8) flee(v, b.x, b.z, 3.5, 2.5);
    }
    burst(x, y, z, 16, .3);
    toast(`${buildingName(b)} brennt!${lost > 0 ? ' Die Waren davor verbrennen.' : ''} Das Feuer erlischt nach etwa ${BURN_T} Sekunden.`, 4);
    save();
  } else if (tr) { // Baum: verbrennt zu Asche, kein Holz, ein dunkler Fleck bleibt
    x = tr.x; z = tr.z; y = heightAt(x, z) + TREE_H * ST * tr.g * .8;
    freeTree(tr); tr.gone = true; H.trees = 1;
    burst(x, heightAt(x, z) + .5, z, 22, .35); for (let k = 0; k < 6; k++) spawnDust(x + rnd(.3), z + rnd(.3));
    floatText(x, y + .3, z, 'Zu Asche verbrannt', 'w'); scorch(x, z, .8);
  } else { burst(x, y + .05, z, 8, .15); scorch(x, z, .7); }
  drawBolt(x, y, z);
  // knapp daneben: umgeworfen und schwindelig; weiter weg: Angst
  for (const v of villagers) {
    if (v === vt || !canStartle(v)) continue;
    const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz);
    if (d < BOLT_NEAR) { const l = d || 1; if (hurl(v, dx / l * 2.4, 3.6, dz / l * 2.4)) H.villagers++; }
    else if (d < BOLT_FEAR) flee(v, x, z, 3, 2.2);
  }
  for (const a of wild) if (a !== at && Math.hypot(a.x - x, a.z - z) < 6) startle(a, x, z, 5);
  H.x = x; H.z = z; emit('miracleHit', H);
  return H;
}
function updateBolt(dt, t) {
  boltT = Math.max(0, boltT - dt);
  const k = boltT / BOLT_T, on = boltT > 0 && (k > .55 || Math.sin(t * 90) > -.2); // flackert kurz nach
  boltCore.visible = boltHalo.visible = on;
  boltCore.material.opacity = k; boltHalo.material.opacity = .3 * k;
  renderer.toneMappingExposure = EXPO * (1 + (on ? 1.6 * k * k : 0));
}

// Regenwolke regnet ab, Ring der Eile breitet sich aus; Bann, Sturm, Blitz
function updateMiracleFx(dt, t) {
  if (sprouts.length) updateSprouts(dt);
  if (banT > 0) { banT -= dt; const k = 1 - banT / 1.6; banRing.scale.setScalar(.15 + k * .85); banRing.material.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * .8; }
  if (storm.on) updateStorm(dt, t);
  if (trailFade > 0) { trailFade = Math.max(0, trailFade - dt); trail.material.opacity = .7 * trailFade / .5; if (!trailFade) trail.visible = false; }
  if (boltT > 0 || renderer.toneMappingExposure !== EXPO) updateBolt(dt, t);
  updateScorch();
  if (rain.t > 0) {
    rain.t -= dt; const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) { let y = p.getY(i) - dt * 11; if (y < surfaceAt(p.getX(i), p.getZ(i))) y = 6.5; p.setY(i, y); }
    p.needsUpdate = true; rainCloud.position.set(rain.x, 6.6 + Math.sin(t) * .1, rain.z); placeProxy(rainCloudSh, rainCloud, 1);
    rainPts.material.opacity = Math.min(.8, rain.t);
    if (rain.t <= 0) { rainPts.visible = false; rainCloud.visible = false; rainCloudSh.visible = false; }
  }
  if (ringT > 0) { ringT -= dt; const k = 1 - ringT / 1.4; ring.scale.setScalar(.2 + k * .8); ring.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * .75; }
}
// Wunder wirken: p = Bodenpunkt (x, z), beim Wirbelsturm { path } (die gewischte Bahn). Zu wenig Glaube: Hinweis, nichts
// geschieht. Gibt zurück, ob das Wunder gewirkt wurde.
function tryMiracle(p) {
  const kind = input.miracle, m = MIRACLES[kind];
  let path = null;
  if (kind === 'storm') {
    path = p && p.path && p.path.length ? clipPath(p.path, m.len) : null;
    if (!path || pathLen(path) < STORM_MIN) { toast('Wirbelsturm: Wische mit dem Finger eine Bahn über den Boden. Der Sturm zieht sie entlang.', 3.5); return false; }
    if (storm.on) { toast('Es zieht schon ein Wirbelsturm.', 2); return false; }
  }
  if (S.glaube < m.cost) { toast(`${m.label} kostet ${m.cost} Glaube. Deine Bewohner beten noch.`); return false; }
  S.glaube -= m.cost;
  let fx = p.x, fz = p.z;
  if (kind === 'rain') castRain(p.x, p.z);
  else if (kind === 'haste') castHaste(p.x, p.z);
  else if (kind === 'ban') castBan(p.x, p.z);
  else if (kind === 'bolt') { const H = castBolt(p.x, p.z); fx = H.x; fz = H.z; }
  else { castStorm(path); const q = pointAt(path, pathLen(path) / 2); fx = q.x; fz = q.z; }
  foxCast(fx, fz);
  return true;
}

export { STORM_MIN, castBan, castBolt, castHaste, castRain, castStorm, clipPath, drawTrail, onGround, pathLen, rain, scorches, storm, tryMiracle, updateMiracleFx };
