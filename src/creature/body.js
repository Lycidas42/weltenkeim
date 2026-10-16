// Der Körper der Kreatur als Werkzeug (kreatur.md 3.13): Ankerpunkte (Maul, Rücken, Schwanz), Bewegungen der Knochen
// über der laufenden Animation, Last auf dem Rücken, fliegende Waren, Staub und Funken.

import * as THREE from 'three';
import { renderer, scene } from '../core/render.js';
import { CREATURES, fox } from './kinds.js';
import { foxModel, foxPivot } from './creature.js';
import { model, shadowify } from '../assets/models.js';
import { surfaceAt } from '../world/terrain.js';

// Ankerpunkte: [Knochen, x, y, z]; Versatz in Einheiten der Tierhöhe im Raum des Tiers (+Z vorn, +Y oben).
// Die Werte je Gestalt stehen im Theme (anchors), dies ist der Rückfall für das Quaternius-Skelett.
const ANCH_DEF = { mouth: ['Head', 0, -.07, .21], back: ['Torso', 0, .12, 0], tail: ['Tail8', 0, -.01, -.07] };
const off = new THREE.Vector3();
function bone(name) {
  if (!foxModel) return null; const u = foxModel.userData, c = u.bones || (u.bones = {});
  return name in c ? c[name] : (c[name] = foxModel.getObjectByName(name) || null);
}
// Weltposition eines Ankers
function anchor(name, out) {
  const C = CREATURES[fox.kind], a = (C.anchors && C.anchors[name]) || ANCH_DEF[name], b = a && bone(a[0]);
  if (!b) { out.copy(foxPivot.position); out.y += C.h * .6; return out; }
  b.getWorldPosition(out);
  return out.add(off.set(a[1], a[2], a[3]).multiplyScalar(C.h).applyQuaternion(foxPivot.quaternion));
}

// Bewegungen über der Animation, in Ebenen mit weichem Ein- und Ausblenden. rot: { Knochen: [x, y, z] } in Grad im
// Raum des Tiers wie bei POSES (x: Nicken, positiv = vorn nach unten; y: Drehen; z: Kippen), wirkt samt Kindern.
const layers = {};
function over(name, rot, tw = 1, k = 6) { const L = layers[name] || (layers[name] = { rot: {}, w: 0 }); if (rot) L.rot = rot; L.tw = tw; L.k = k; }
function overOff(name) { if (layers[name]) layers[name].tw = 0; }
const D = Math.PI / 180, eu = new THREE.Euler(), qR = new THREE.Quaternion(), qP = new THREE.Quaternion(), qPi = new THREE.Quaternion(), qV = new THREE.Quaternion();
let touched = [];
function applyOver(dt) {
  if (!foxModel) return;
  // Was die Animation in diesem Bild nicht neu gesetzt hat, steht noch auf dem Wert mit Zusatz: auf die Basis zurück,
  // sonst summiert sich die Drehung Bild für Bild auf
  for (const b of touched) { const u = b.userData; if (u.ovOut && b.quaternion.equals(u.ovOut)) b.quaternion.copy(u.ovBase); }
  const sum = {};
  for (const L of Object.values(layers)) {
    L.w += (L.tw - L.w) * (1 - Math.exp(-dt * L.k)); if (L.w < .002 && !L.tw) { L.w = 0; continue; }
    for (const n in L.rot) { const r = L.rot[n], s = sum[n] || (sum[n] = [0, 0, 0]); s[0] += r[0] * L.w; s[1] += r[1] * L.w; s[2] += r[2] * L.w; }
  }
  const list = [], order = foxModel.userData.boneOrder || (foxModel.userData.boneOrder = (() => { const o = {}; let i = 0; foxModel.traverse(x => { if (x.isBone) o[x.name] = i++; }); return o; })());
  for (const n in sum) { const b = bone(n); if (b) list.push(b); }
  list.sort((a, b) => order[a.name] - order[b.name]); // Eltern zuerst
  qV.copy(foxPivot.quaternion);
  for (const b of list) {
    const u = b.userData, r = sum[b.name];
    (u.ovBase || (u.ovBase = new THREE.Quaternion())).copy(b.quaternion);
    b.parent.getWorldQuaternion(qP); qPi.copy(qP).invert();
    qR.setFromEuler(eu.set(r[0] * D, r[1] * D, r[2] * D, 'YXZ')); qR.premultiply(qV).multiply(qV.clone().invert()); // in Weltraum
    b.quaternion.premultiply(qP).premultiply(qR).premultiply(qPi);
    (u.ovOut || (u.ovOut = new THREE.Quaternion())).copy(b.quaternion);
  }
  touched = list;
}
function resetOver() { for (const k in layers) delete layers[k]; touched = []; }

// Last auf dem Rücken: Plätze links und rechts (wie Satteltaschen), darüber gestapelt. Versatz wie bei den Ankern.
const BACK_SLOTS = [[.13, -.02, .06], [-.13, -.02, .06], [.13, -.02, -.12], [-.13, -.02, -.12], [0, .08, -.03]];
const SACK = 1.9, CRATE = .95;
const backItems = BACK_SLOTS.map((_, i) => { const o = shadowify(model(i === 4 ? 'prop.crate' : 'prop.sack').scene.clone(true)); o.visible = false; scene.add(o); return o; });
const back = { n: 0, shake: 0 };
const bp = new THREE.Vector3(), bq = new THREE.Quaternion(), bTilt = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
function backSlot(i, out) {
  const C = CREATURES[fox.kind], s = BACK_SLOTS[i]; anchor('back', out);
  return out.add(off.set(s[0], s[1], s[2]).multiplyScalar(C.h).applyQuaternion(foxPivot.quaternion));
}
function itemScale(i) { const C = CREATURES[fox.kind]; return (i === 4 ? CRATE : SACK) * C.h / 1.45; }
// Flug einer Ware (vom Maul auf den Rücken, vom Rücken auf den Boden): { o, from, to (Funktion oder Vektor), t, dur, h, done }
const flyers = [];
function fly(o, from, to, dur, h, done, scale) { o.visible = true; flyers.push({ o, from: from.clone(), to, t: 0, dur, h, done, scale, spin: (Math.random() - .5) * 6 }); }
const fv = new THREE.Vector3();
function updateBack(dt, t) {
  back.shake = Math.max(0, back.shake - dt);
  for (let i = 0; i < backItems.length; i++) {
    const o = backItems[i]; if (o.userData.flying) continue;
    o.visible = !!foxModel && i < back.n; if (!o.visible) continue;
    backSlot(i, bp); o.position.copy(bp);
    // beim Abschütteln kippen die Säcke mit
    bTilt.setFromAxisAngle(Z, back.shake > 0 ? Math.sin(t * 28) * .35 : Math.sin(t * 9 + i) * .03);
    bq.copy(foxPivot.quaternion).multiply(bTilt); if (i < 4) bq.multiply(qV.setFromAxisAngle(Z, (i % 2 ? 1 : -1) * .35)); // Säcke lehnen seitlich an
    o.quaternion.copy(bq); o.scale.setScalar(itemScale(i));
  }
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt; const k = Math.min(1, f.t / f.dur), to = typeof f.to === 'function' ? f.to(fv) : f.to;
    f.o.position.lerpVectors(f.from, to, k); f.o.position.y += Math.sin(k * Math.PI) * f.h;
    f.o.rotation.set(k * f.spin, foxPivot.rotation.y, 0); if (f.scale) f.o.scale.setScalar(f.scale);
    if (k >= 1) { flyers.splice(i, 1); f.o.userData.flying = false; if (f.done) f.done(); }
  }
}
// eine Ware vom Maul in den nächsten freien Platz auf dem Rücken werfen
const mp = new THREE.Vector3();
function tossOnBack(done, from) {
  const i = back.n + flyers.filter(f => f.toBack).length; if (i >= backItems.length) { if (done) done(); return; }
  const o = backItems[i]; o.userData.flying = true; if (from) mp.copy(from); else anchor('mouth', mp);
  fly(o, mp, v => backSlot(i, v), .42, .55 * CREATURES[fox.kind].h, () => { back.n = Math.max(back.n, i + 1); if (done) done(); }, itemScale(i));
  flyers[flyers.length - 1].toBack = true;
}
// alles abschütteln: die Waren fallen seitlich zu Boden und verschwinden
const dropT = [];
function shakeOff() {
  back.shake = .9; const n = back.n; back.n = 0;
  for (let i = 0; i < n; i++) {
    const o = backItems[i]; backSlot(i, bp); o.userData.flying = true;
    const side = new THREE.Vector3(i % 2 ? -1 : 1, 0, -.3 - Math.random() * .3).applyQuaternion(foxPivot.quaternion).multiplyScalar(CREATURES[fox.kind].h * .45);
    const to = bp.clone().add(side); to.y = surfaceAt(to.x, to.z) + .05;
    fly(o, bp, to, .45 + i * .06, .25, () => { o.userData.flying = true; dropT.push({ o, t: .8 }); dust(to.x, to.y, to.z, 4, .5); }, itemScale(i));
  }
}
function updateDrops(dt) { for (let i = dropT.length - 1; i >= 0; i--) { const d = dropT[i]; d.t -= dt; d.o.scale.multiplyScalar(d.t < .3 ? .85 : 1); if (d.t <= 0) { d.o.visible = false; d.o.userData.flying = false; dropT.splice(i, 1); } } }

// Staub (erdfarben, weich) und Funken (golden, leuchtend) als Punkte mit eigener Größe und Deckkraft
function cloud(n, color, additive) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('a', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uVH: { value: 800 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute vec2 a; varying float vA; uniform float uVH; void main(){ vA = a.x; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = a.y * uVH / -mv.z; }',
    fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uC, vA * smoothstep(0.5, 0.15, d)); }',
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; scene.add(pts);
  return { n, geo, mat, pts, list: [] };
}
const DUST = cloud(90, 0xc9b48f, false), SPARK = cloud(160, 0xffd27a, true);
function puff(P, p) { if (P.list.length >= P.n) P.list.shift(); P.list.push(p); }
function dust(x, y, z, n = 3, s = .35) { for (let k = 0; k < n; k++) puff(DUST, { x: x + (Math.random() - .5) * .3, y, z: z + (Math.random() - .5) * .3, vx: (Math.random() - .5) * .6, vy: .3 + Math.random() * .4, vz: (Math.random() - .5) * .6, t: 0, life: .9 + Math.random() * .5, s: s * (.7 + Math.random() * .6), drag: 2 }); }
// Funke: zieht zu einem Ziel (to: Funktion oder Vektor) oder fliegt frei
function spark(x, y, z, o = {}) { puff(SPARK, { x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, t: 0, life: o.life || 1, s: o.s || .12, to: o.to, pull: o.pull || 0, drag: o.drag ?? .5 }); }
const tv = new THREE.Vector3();
function updateCloud(P, dt, vh, grow) {
  const pos = P.geo.attributes.position, a = P.geo.attributes.a;
  for (let i = P.list.length - 1; i >= 0; i--) {
    const p = P.list[i]; p.t += dt; if (p.t > p.life) { P.list.splice(i, 1); continue; }
    if (p.to) { const g = typeof p.to === 'function' ? p.to(tv) : p.to; p.vx += (g.x - p.x) * p.pull * dt; p.vy += (g.y - p.y) * p.pull * dt; p.vz += (g.z - p.z) * p.pull * dt; }
    const dr = Math.exp(-dt * p.drag); p.vx *= dr; p.vy *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (let i = 0; i < P.n; i++) {
    const p = P.list[i]; if (!p) { a.setX(i, 0); continue; }
    const u = p.t / p.life; pos.setXYZ(i, p.x, p.y, p.z); a.setXY(i, Math.min(1, u * 5) * (1 - u) * (grow ? .55 : 1), p.s * (grow ? 1 + u * 1.5 : 1));
  }
  pos.needsUpdate = a.needsUpdate = true; P.mat.uniforms.uVH.value = vh; P.pts.visible = P.list.length > 0;
}

// Leuchten des Fells (Aufladen eines Wunders): Eigenleuchten aller Materialien der Kreatur
const glowC = new THREE.Color(0xffc861);
const glowK = new THREE.Color();
function setGlow(k) {
  glowK.copy(glowC).multiplyScalar(k);
  if (!foxModel) return;
  // vorhandenes Eigenleuchten der Materialien (Farbe × Stärke) bleibt, das Gold kommt dazu
  foxModel.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) {
    if (!m.emissive) continue; const u = m.userData; if (!u.em0) { u.em0 = m.emissive.clone(); u.ei0 = m.emissiveIntensity; }
    if (k <= 0) { m.emissive.copy(u.em0); m.emissiveIntensity = u.ei0; } else { m.emissive.copy(u.em0).multiplyScalar(u.ei0).add(glowK); m.emissiveIntensity = 1; }
  } });
}

// Pfoten auf den Boden setzen: Das Tier steht auf einer geneigten Ebene (ai.js, groundFit), der Boden unter jeder
// Pfote liegt aber höher oder tiefer. Die Fußknochen (IK-Knochen des Quaternius-Skeletts, an denen Pfote und
// Unterbein hängen) werden um diesen Unterschied senkrecht zur Ebene verschoben, höchstens um ein Viertel der Tierhöhe.
const FEET = ['IKFrontLegL', 'IKFrontLegR', 'IKBackLegL', 'IKBackLegR'], FOOT_LIFT = .02;
const fw = new THREE.Vector3(), fl = new THREE.Vector3(), pInv = new THREE.Matrix4();
function plantFeet() {
  if (!foxModel) return; const C = CREATURES[fox.kind], lim = C.h * .25;
  foxPivot.updateMatrixWorld(); pInv.copy(foxPivot.matrixWorld).invert();
  for (const n of FEET) {
    const b = bone(n); if (!b) continue; const u = b.userData;
    if (u.ftOut && b.position.equals(u.ftOut)) b.position.copy(u.ftBase); // von der Animation nicht neu gesetzt: Basis
    (u.ftBase || (u.ftBase = new THREE.Vector3())).copy(b.position);
    b.getWorldPosition(fw);
    fl.set(fw.x, surfaceAt(fw.x, fw.z) + FOOT_LIFT, fw.z).applyMatrix4(pInv); // Boden unter der Pfote im Raum des Tiers
    const d = Math.max(-lim, Math.min(lim, fl.y)); if (Math.abs(d) < .005) { (u.ftOut || (u.ftOut = new THREE.Vector3())).copy(b.position); continue; }
    fw.addScaledVector(fl.set(0, d, 0).applyQuaternion(foxPivot.quaternion), 1); // um d entlang der Hochachse des Tiers
    b.parent.worldToLocal(b.position.copy(fw));
    (u.ftOut || (u.ftOut = new THREE.Vector3())).copy(b.position);
  }
}
function updateBody(dt, t) {
  const vh = renderer.domElement.height;
  applyOver(dt); plantFeet(); updateBack(dt, t); updateDrops(dt);
  updateCloud(DUST, dt, vh, true); updateCloud(SPARK, dt, vh, false);
}

export { anchor, back, backItems, bone, dust, over, overOff, resetOver, setGlow, shakeOff, spark, tossOnBack, updateBody };
