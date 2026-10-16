// Der Körper der Kreatur als Werkzeug (kreatur.md 3.13): Ankerpunkte (Maul, Rücken, Schwanz), Bewegungen der Knochen
// über der laufenden Animation, Last auf dem Rücken, fliegende Waren, Staub und Funken.

import * as THREE from 'three';
import { renderer, scene } from '../core/render.js';
import { S } from '../core/state.js';

if (!S.cGear || typeof S.cGear !== 'object') S.cGear = {}; // Ausrüstung der Kreatur: { basket, bags, cart } (kreatur.md 3.13 B)
import { CREATURES, fox } from './kinds.js';
import { foxModel, foxPivot } from './creature.js';
import { model, shadowify } from '../assets/models.js';
import { surfaceAt } from '../world/terrain.js';

// Ankerpunkte: [Knochen, x, y, z]; Versatz in Einheiten der Tierhöhe im Raum des Tiers (+Z vorn, +Y oben).
// Die Werte je Gestalt stehen im Theme (anchors), dies ist der Rückfall für das Quaternius-Skelett.
const ANCH_DEF = { mouth: ['Head', 0, -.07, .21], back: ['Torso', 0, .12, 0], chest: ['Torso3', 0, -.02, .02], girth: ['Torso', 0, -.12, 0], tail: ['Tail8', 0, -.01, -.07] };
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
// Jeder Platz hält einen Sack (oben eine Kiste) oder ein Bündel Stämme; welches, steht in back.kinds (Ware je Platz)
const barkB = new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: .95 }), cutB = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: .9 }), ropeB = new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 1 });
function logBundle() { // drei Stämme längs zum Körper, zweimal geschnürt
  const g = new THREE.Group();
  for (const [x, y] of [[-.026, 0], [.026, 0], [0, .044]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.027, .029, .26, 7), barkB); l.rotation.x = Math.PI / 2; l.position.set(x, y, 0); l.castShadow = true; g.add(l);
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(.027, 7), cutB); c.position.set(x, y, sz * .131); c.rotation.y = sz > 0 ? 0 : Math.PI; g.add(c); }
  }
  for (const z of [-.07, .07]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.06, .006, 4, 12), ropeB); r.position.set(0, .015, z); g.add(r); }
  return g;
}
const backItems = BACK_SLOTS.map((_, i) => {
  const o = new THREE.Group(), goods = shadowify(model(i === 4 ? 'prop.crate' : 'prop.sack').scene.clone(true)), logs = logBundle();
  if (i === 4) logs.scale.setScalar(SACK / CRATE); else logs.position.y = -.035; // an der Seite hängt das Bündel etwas tiefer
  o.add(goods, logs); o.userData.goods = goods; o.userData.logs = logs; o.visible = false; scene.add(o); return o;
});
function itemKind(i, kind) { const o = backItems[i]; o.userData.goods.visible = kind !== 'logs'; o.userData.logs.visible = kind === 'logs'; }
const back = { n: 0, shake: 0, kinds: [] };
const bp = new THREE.Vector3(), bq = new THREE.Quaternion(), bTilt = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
// Sitzplatz Nummer i für einen Reiter (bei zwei Plätzen vorn und hinten auf dem Rücken)
// Ausrüstung und Lasten richten sich nach der Körpergröße, nicht nach der Höhe (beim Hirsch zählt das Geweih mit)
const kh = C => C.h * (C.bodyS || 1);
function seat(i, n, out) { anchor('back', out); if (n > 1) out.add(off.set(0, 0, (i ? -.13 : .1) * kh(CREATURES[fox.kind])).applyQuaternion(foxPivot.quaternion)); out.y += .03; return out; }
function backSlot(i, out) {
  const C = CREATURES[fox.kind];
  if (gear.cart && cart.visible) { const c = CART_SLOTS[i]; return out.set(c[0], c[1], c[2]).multiplyScalar(kh(C) * .95).applyAxisAngle(Y, cartH).add(cart.position); } // im Karren
  const s = BACK_SLOTS[i]; anchor('back', out);
  return out.add(off.set(s[0] * (C.backW || 1), s[1], s[2]).multiplyScalar(kh(C)).applyQuaternion(foxPivot.quaternion));
}
function itemScale(i) { const C = CREATURES[fox.kind]; return (i === 4 ? CRATE : SACK) * kh(C) / 1.45; }
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
    if (gear.cart && cart.visible) bq.setFromAxisAngle(Y, cartH); else bq.copy(foxPivot.quaternion);
    bq.multiply(bTilt); if (i < 4 && !(gear.cart && cart.visible)) bq.multiply(qV.setFromAxisAngle(Z, (i % 2 ? 1 : -1) * .35)); // Säcke lehnen seitlich an
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
function tossOnBack(done, from, kind) {
  const i = back.n + flyers.filter(f => f.toBack).length; if (i >= backItems.length) { if (done) done(); return; }
  back.kinds[i] = kind; itemKind(i, kind);
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
// zusätzliche Verschiebung einzelner Pfoten im Raum des Tiers, in Tierhöhen (z. B. Graben: Vorderpfoten scharren)
const footExtra = {};
function plantFeet() {
  if (!foxModel) return; const C = CREATURES[fox.kind], lim = C.h * .25;
  foxPivot.updateMatrixWorld(); pInv.copy(foxPivot.matrixWorld).invert();
  for (const n of FEET) {
    const b = bone(n); if (!b) continue; const u = b.userData;
    if (u.ftOut && b.position.equals(u.ftOut)) b.position.copy(u.ftBase); // von der Animation nicht neu gesetzt: Basis
    (u.ftBase || (u.ftBase = new THREE.Vector3())).copy(b.position);
    b.getWorldPosition(fw);
    fl.set(fw.x, surfaceAt(fw.x, fw.z) + FOOT_LIFT, fw.z).applyMatrix4(pInv); // Boden unter der Pfote im Raum des Tiers
    const d = Math.max(-lim, Math.min(lim, fl.y)), e = footExtra[n];
    if (Math.abs(d) < .005 && !e) { (u.ftOut || (u.ftOut = new THREE.Vector3())).copy(b.position); continue; }
    fl.set(0, d, 0); if (e) fl.add(off.set(e[0], e[1], e[2]).multiplyScalar(C.h));
    fw.add(fl.applyQuaternion(foxPivot.quaternion)); // um d entlang der Hochachse des Tiers (plus Zusatz)
    b.parent.worldToLocal(b.position.copy(fw));
    (u.ftOut || (u.ftOut = new THREE.Vector3())).copy(b.position);
  }
}

// Ausrüstung (kreatur.md 3.13 B), in den Werkstätten gefertigt (S.cGear): Satteltaschen auf dem Rücken, Zuggeschirr mit
// Karren, Korb mit Henkel fürs Maul. Alles im Code gebaut.
const leather = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: .85 }), strapM = new THREE.MeshStandardMaterial({ color: 0x4f2f1c, roughness: .9 });
const wicker = new THREE.MeshStandardMaterial({ color: 0xb48a52, roughness: .95 }), woodM = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: .9 });
const metal = new THREE.MeshStandardMaterial({ color: 0x5b5650, roughness: .6, metalness: .3 });
function mk(geo, mat, x = 0, y = 0, z = 0, par) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (par) par.add(m); return m; }
// Satteltaschen: zwei Taschen mit Deckel, ein Gurt über den Rücken (Maße für ein Tier der Höhe 1, skaliert mit C.h)
const bags = new THREE.Group();
for (const sx of [-1, 1]) {
  mk(new THREE.BoxGeometry(.05, .13, .17), leather, sx * .15, -.06, -.03, bags);
  mk(new THREE.BoxGeometry(.055, .035, .175), strapM, sx * .15, .01, -.03, bags);
}
mk(new THREE.BoxGeometry(.31, .012, .05), strapM, 0, .045, -.03, bags); // Gurt über den Rücken
bags.visible = false; scene.add(bags);
// Geschirr: Brustgurt; Karren: Kasten auf zwei Rädern mit Deichsel, die am Geschirr hängt
const harness = new THREE.Group(); // Bauchgurt quer um den Körper
mk(new THREE.TorusGeometry(.13, .016, 6, 18), strapM, 0, 0, 0, harness);
harness.visible = false; scene.add(harness);
const cart = new THREE.Group(), cartBox = new THREE.Group(); cart.add(cartBox);
mk(new THREE.BoxGeometry(.5, .04, .55), woodM, 0, .22, 0, cartBox);
for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(.03, .12, .55), woodM, sx * .235, .3, 0, cartBox);
for (const sz of [-1, 1]) mk(new THREE.BoxGeometry(.5, .12, .03), woodM, 0, .3, sz * .26, cartBox);
const wheels = [-1, 1].map(sx => { const w = mk(new THREE.CylinderGeometry(.16, .16, .03, 14), woodM, sx * .29, .16, 0, cart); w.rotation.z = Math.PI / 2; mk(new THREE.CylinderGeometry(.04, .04, .035, 8), metal, 0, 0, 0, w); return w; });
const shafts = [-1, 1].map(sx => { const s = mk(new THREE.CylinderGeometry(.012, .012, 1, 5), woodM, 0, 0, 0); s.userData.sx = sx; scene.add(s); s.visible = false; return s; });
cart.visible = false; scene.add(cart);
// Pflug (Stier): Grindel mit Schar und zwei Sterzen; hängt wie der Karren am Geschirr
const plow = new THREE.Group();
mk(new THREE.BoxGeometry(.05, .05, .62), woodM, 0, .2, .02, plow).rotation.x = -.18;
mk(new THREE.BoxGeometry(.035, .2, .14), metal, 0, .08, -.2, plow).rotation.x = .55;
for (const sx of [-1, 1]) { const h = mk(new THREE.CylinderGeometry(.012, .012, .36, 5), woodM, sx * .08, .3, -.34, plow); h.rotation.x = -.9; h.rotation.z = sx * .15; }
plow.visible = false; scene.add(plow);
const CART_SLOTS = [[-.12, .3, .12], [.12, .3, .12], [-.12, .3, -.12], [.12, .3, -.12], [0, .42, 0]];
// Korb mit Henkel im Maul; darin Pilze
const basket = new THREE.Group();
mk(new THREE.CylinderGeometry(.075, .055, .08, 10, 1, true), wicker, 0, -.07, 0, basket).material = wicker.clone(); basket.children[0].material.side = THREE.DoubleSide;
mk(new THREE.CircleGeometry(.055, 10).rotateX(-Math.PI / 2), wicker, 0, -.11, 0, basket);
mk(new THREE.TorusGeometry(.07, .008, 5, 14, Math.PI), wicker, 0, -.03, 0, basket);
const shroomM = new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: .7 }), stemM = new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: .8 });
const shrooms = [[-.025, .01], [.02, -.02], [.025, .025]].map(([x, z]) => { const g = new THREE.Group(); mk(new THREE.CylinderGeometry(.008, .01, .03, 6), stemM, 0, 0, 0, g); mk(new THREE.SphereGeometry(.022, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), shroomM, 0, .012, 0, g); g.position.set(x, -.05, z); basket.add(g); return g; });
basket.visible = false; scene.add(basket);
// Stamm, den sie mit dem Kopf vor sich her rollt
const barkM = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: .95 }), cutM = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: .9 });
const log = new THREE.Group(), logRoll = new THREE.Group(); log.add(logRoll);
mk(new THREE.CylinderGeometry(.07, .075, .62, 9), barkM, 0, 0, 0, logRoll).rotation.z = Math.PI / 2;
for (const sx of [-1, 1]) mk(new THREE.CircleGeometry(.07, 9), cutM, sx * .311, 0, 0, logRoll).rotation.y = sx * Math.PI / 2;
log.visible = false; scene.add(log);
const gear = { cart: false, plow: false, basket: 0, log: false, roll: 0 }; // was gerade benutzt wird (ai.js setzt es)
const gp = new THREE.Vector3(), gq = new THREE.Quaternion(), cartPos = new THREE.Vector3(), cartFwd = new THREE.Vector3(), lastLog = new THREE.Vector3();
let cartH = 0, cartInit = false;
function updateGear(dt) {
  const C = CREATURES[fox.kind], k = kh(C), G = S.cGear || {}, on = !!foxModel;
  // Satteltaschen sitzen am Rückenanker
  // Satteltaschen: immer, wenn sie etwas auf dem Rücken trägt oder gerade beladen wird; gekauft trägt sie damit auch mehr
  bags.visible = on && (!!G.bags || back.n > 0 || ['toss', 'waitLoad', 'haulUp'].includes(fox.state) || (fox.state === 'walk' && !!fox.carryGoods && !gear.log && !gear.cart));
  if (bags.visible) { anchor('back', gp); bags.position.copy(gp); bags.quaternion.copy(foxPivot.quaternion); bags.scale.set(k * (C.backW || 1), k, k); }
  // Geschirr und Karren bzw. Pflug nur, wenn sie ihn gerade zieht
  const towed = on && (gear.cart ? cart : gear.plow ? plow : null);
  cart.visible = towed === cart; plow.visible = towed === plow; harness.visible = !!towed;
  for (const s of shafts) s.visible = !!towed;
  if (towed) {
    anchor('girth', gp); harness.position.copy(gp); harness.quaternion.copy(foxPivot.quaternion); harness.scale.set(k * (C.backW || 1), k, k);
    // der Karren folgt wie ein Anhänger: Er bleibt im festen Abstand hinter dem Geschirr und dreht sich zur Zugrichtung
    const len = k * (C.tow || .95), fx = Math.sin(fox.vh), fz = Math.cos(fox.vh); // Abstand Gurt – Karrenmitte: der Karren läuft hinter dem Hinterteil
    if (!cartInit) { cartPos.set(gp.x - fx * len, 0, gp.z - fz * len); cartInit = true; }
    cartFwd.set(gp.x - cartPos.x, 0, gp.z - cartPos.z); const d = cartFwd.length() || 1; cartFwd.multiplyScalar(1 / d);
    const before = cartPos.clone(); cartPos.set(gp.x - cartFwd.x * len, 0, gp.z - cartFwd.z * len);
    const moved = Math.hypot(cartPos.x - before.x, cartPos.z - before.z) * Math.sign(cartFwd.x * (cartPos.x - before.x) + cartFwd.z * (cartPos.z - before.z) || 1);
    cartH = Math.atan2(cartFwd.x, cartFwd.z); const gy = surfaceAt(cartPos.x, cartPos.z);
    towed.position.set(cartPos.x, gy, cartPos.z); towed.rotation.set(0, cartH, 0); towed.scale.setScalar(k * .95);
    if (towed === cart) for (const w of wheels) w.rotation.x += moved / (.16 * k * .95);
    gear.towX = cartPos.x; gear.towZ = cartPos.z; // wo der Pflug gerade furcht (ai.js)
    for (const s of shafts) { // Deichsel vom Karren zum Geschirr
      const a = (towed === cart ? new THREE.Vector3(s.userData.sx * .2, .3, .26) : new THREE.Vector3(s.userData.sx * .03, .24, .3)).multiplyScalar(k * .95).applyAxisAngle(Y, cartH).add(towed.position);
      const b = new THREE.Vector3(s.userData.sx * .15 * (C.backW || 1), -.03, 0).multiplyScalar(k).applyQuaternion(foxPivot.quaternion).add(gp); // außen am Gurt
      s.position.copy(a).add(b).multiplyScalar(.5); s.quaternion.setFromUnitVectors(Y, b.sub(a).normalize()); s.scale.set(k, a.distanceTo(s.position) * 2, k);
    }
  } else cartInit = false;
  // Korb im Maul, mit so vielen Pilzen, wie sie gefunden hat
  basket.visible = on && gear.basket > 0;
  if (basket.visible) { anchor('mouth', gp); basket.position.copy(gp); basket.quaternion.copy(foxPivot.quaternion); basket.scale.setScalar(k * 1.6); shrooms.forEach((m, i) => m.visible = i < gear.basket - 1); }
  // Stamm rollt vor dem Kopf am Boden
  log.visible = on && gear.log;
  if (log.visible) {
    anchor('mouth', gp); const fx = Math.sin(fox.vh), fz = Math.cos(fox.vh); gp.x += fx * k * .12; gp.z += fz * k * .12;
    const r = .075 * k * 1.4; gp.y = surfaceAt(gp.x, gp.z) + r;
    if (lastLog.lengthSq()) gear.roll += Math.hypot(gp.x - lastLog.x, gp.z - lastLog.z) / r; lastLog.copy(gp);
    log.position.copy(gp); log.rotation.set(0, fox.vh, 0); logRoll.rotation.x = gear.roll; log.scale.set(k * .6, k * 1.4, k * 1.4); // etwa so lang, wie das Tier breit ist: der Weg hält nur für den Körper Abstand zu Häusern
  } else lastLog.set(0, 0, 0);
}
const Y = new THREE.Vector3(0, 1, 0);
function updateBody(dt, t) {
  const vh = renderer.domElement.height;
  applyOver(dt); plantFeet(); updateGear(dt); updateBack(dt, t); updateDrops(dt);
  updateCloud(DUST, dt, vh, true); updateCloud(SPARK, dt, vh, false);
}

export { anchor, back, backItems, bone, dust, footExtra, gear, seat, over, overOff, resetOver, setGlow, shakeOff, spark, tossOnBack, updateBody };
