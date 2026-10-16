// Gesicht der Kreatur (kreatur.md Leitbild „Sie lebt sichtbar“, kreatur-modelle.md 5): Lider, Blick, Brauen, Ohren,
// Maul und Kopf, gesteuert über einen Ausdruck. Arbeitet über den Animationen: Nach foxMixer.update setzt updateFace
// die Gesichtsteile neu (Knochen ohne eigene Spur von ihrer Ruhelage aus, Kopf und Nacken zusätzlich zur Animation).
// Teile im Modell (Bauskript assets/source/build_tiermensch.py): Augen „Eye“/„EyeRim“/„EyePupil“ + L/R am Kopfknochen,
// Brauen „BrowL/R“, Knochen ear_l/ear_r, jaw, neck_01, Head. Fehlt etwas, bleibt der Teil einfach unbewegt.

import * as THREE from 'three';
import { camera, isMobile } from '../core/render.js';
import { CREATURES, fox } from './kinds.js';
import { foxModel, foxPivot } from './creature.js';
import { hand } from '../hand/hand.js';
import { input } from '../hand/pointer.js';

// Ausdrücke. Lider: up/lo 0 offen … 1 zu (oben bis knapp unter die Mitte, unten bis zur Mitte); slant = Schräge des
// oberen Lids (+ innen tiefer: Ärger, − innen höher: Trauer); brow = Brauen hoch/tief, tilt = Brauen innen hoch (+) oder
// tief (−); ears = Ohren vor (+) / zurück (−), splay = zur Seite, swivel = Öffnung nach außen drehen (Bogenmaß);
// jaw = Maul 0…1; pitch = Kopf senken (+) / heben (−), roll = Kopf schief; pupil = Pupillenbreite; away = Blick abwenden.
const EXPR = {
  neutral: { label: 'Ruhig', up: .1, lo: .04, slant: 0, brow: 0, tilt: 0, ears: .08, splay: .05, swivel: 0, jaw: 0, pitch: 0, roll: 0, pupil: 1 },
  curious: { label: 'Neugierig', up: 0, lo: 0, slant: 0, brow: .9, tilt: .15, ears: .38, splay: 0, swivel: -.25, jaw: .12, pitch: -.04, roll: .24, pupil: 1.35 },
  happy: { label: 'Fröhlich', up: .06, lo: .5, slant: 0, brow: .4, tilt: 0, ears: .12, splay: .14, swivel: 0, jaw: .2, pitch: -.08, roll: .08, pupil: 1.1 },
  playful: { label: 'Übermütig', up: 0, lo: .3, slant: -.05, brow: .7, tilt: .1, ears: .32, splay: .1, swivel: -.1, jaw: .4, pitch: 0, roll: -.18, pupil: 1.4 },
  proud: { label: 'Stolz', up: .32, lo: .22, slant: .05, brow: .25, tilt: 0, ears: .28, splay: 0, swivel: 0, jaw: 0, pitch: -.2, roll: 0, pupil: 1 },
  tired: { label: 'Müde', up: .62, lo: .15, slant: -.12, brow: -.2, tilt: .15, ears: -.15, splay: .4, swivel: .1, jaw: 0, pitch: .09, roll: .05, pupil: 1 },
  sad: { label: 'Traurig', up: .38, lo: .06, slant: -.5, brow: .35, tilt: .5, ears: -.35, splay: .55, swivel: .35, jaw: .05, pitch: .12, roll: 0, pupil: 1.25 },
  sulky: { label: 'Beleidigt', up: .45, lo: .22, slant: .28, brow: -.45, tilt: -.3, ears: -.3, splay: .6, swivel: .6, jaw: 0, pitch: .06, roll: -.06, pupil: 1, away: 1 },
  angry: { label: 'Wütend', up: .34, lo: .2, slant: .55, brow: -.85, tilt: -.55, ears: -.6, splay: .3, swivel: .55, jaw: .35, pitch: .12, roll: 0, pupil: .75 },
  afraid: { label: 'Ängstlich', up: 0, lo: 0, slant: -.35, brow: 1, tilt: .55, ears: -.85, splay: .2, swivel: .2, jaw: .18, pitch: .08, roll: 0, pupil: 1.5 },
  asleep: { label: 'Schläft', up: 1, lo: .85, slant: 0, brow: -.1, tilt: 0, ears: -.25, splay: .45, swivel: .2, jaw: 0, pitch: .1, roll: 0, pupil: 1 },
};
const KEYS = ['up', 'lo', 'slant', 'brow', 'tilt', 'ears', 'splay', 'swivel', 'jaw', 'pitch', 'roll', 'pupil', 'away'];
const face = { expr: 'neutral', test: null, cur: {}, look: { yaw: 0, pitch: 0, tx: 0, ty: 0, gx: 0, gy: 0, target: null, t: 0 }, blink: { t: 2, d: 0 } };
for (const k of KEYS) face.cur[k] = EXPR.neutral[k] || 0;

// Lider im Shader: In Augenkoordinaten (Einheitskugel des Auges, x nach außen gespiegelt, y hoch) wird alles oberhalb
// der oberen und unterhalb der unteren Lidlinie in Fellfarbe gezeichnet, mit dunklem Lidrand. So ragen die Lider nie
// über das Auge hinaus und können jede Schräge und Biegung annehmen. Gilt für Lederhaut/Iris, Pupille und Augenrand.
const LID_COL = new THREE.Color('#c96a33'), LASH_COL = new THREE.Color('#2a1a14');
function lidMaterial(src, eye) {
  const m = src.clone();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, eye.uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWkW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWkW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWkW; uniform mat4 uEyeInv; uniform vec4 uLid; uniform float uSide; uniform vec3 uLidCol, uLashCol;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 e = (uEyeInv * vec4(vWkW, 1.0)).xyz; float xo = e.x * uSide, x2 = min(e.x * e.x, 1.0);
        // uLid: x = oberes Lid (0 offen … 1 zu), y = unteres, z = Schräge, w = Biegung des unteren Lids
        float yU = mix(1.45, -0.12, uLid.x) + uLid.z * xo + 0.18 * (1.0 - x2) * (1.0 - uLid.x);
        float yL = mix(-1.45, 0.02, uLid.y) + uLid.w * (1.0 - x2);
        float dU = e.y - yU, dL = yL - e.y;
        if (dU > 0.0 || dL > 0.0) diffuseColor.rgb = mix(uLashCol, uLidCol, smoothstep(0.0, 0.22, max(dU, dL)));`);
  };
  m.customProgramCacheKey = () => 'wkLid';
  return m;
}
// Teile eines Modells einmal suchen und vorbereiten
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ex = new THREE.Vector3(), _ey = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _r = new THREE.Quaternion(), _m = new THREE.Matrix4();
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
function bind(model) {
  const F = model.userData.face = { ok: false }, get = n => model.getObjectByName(n);
  F.head = get('Head'); F.neck = get('neck_01'); F.jaw = get('jaw');
  F.ears = [get('ear_l'), get('ear_r')];
  F.eyes = [];
  for (const [k, side] of [['L', 1], ['R', -1]]) {
    const eye = get('Eye' + k); if (!eye) continue;
    const E = { side, eye, rim: get('EyeRim' + k), pupil: get('EyePupil' + k), brow: get('Brow' + k) };
    E.uni = { uEyeInv: { value: new THREE.Matrix4() }, uLid: { value: new THREE.Vector4() }, uSide: { value: side }, uLidCol: { value: LID_COL }, uLashCol: { value: LASH_COL } };
    for (const o of [E.eye, E.rim, E.pupil]) if (o && o.isMesh) o.material = lidMaterial(o.material, E);
    for (const o of [E.pupil, E.brow]) if (o) o.userData.faceRest = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    F.eyes.push(E);
  }
  F.ok = !!(F.head && F.eyes.length);
  return F;
}
// Drehung um eine Achse im Raum der Figur (Modell blickt nach +Z, +X ist ihre linke Seite) auf einen Knochen oder ein Teil
// anwenden, zusätzlich zur aktuellen lokalen Drehung
function rotModel(o, axis, ang) {
  if (!ang) return;
  foxModel.getWorldQuaternion(_q); _v.copy(axis).applyQuaternion(_q);           // Achse in Weltkoordinaten
  o.parent.getWorldQuaternion(_p);
  _r.setFromAxisAngle(_v, ang); o.quaternion.premultiply(_p.clone().invert().multiply(_r).multiply(_p));
}
const restQ = o => { const r = o && o.userData.rest; if (r) o.quaternion.copy(r.q); return !!r; };

// Wohin schauen: im Gesichtstest zur Kamera, sonst zur Hand (wenn sie nah ist), sonst geradeaus mit kleinen Blicksprüngen
function lookTarget(out) {
  if (face.test) return out.copy(camera.position);
  if (input.tool === 'hand' && hand.g.visible && hand.g.position.distanceTo(foxPivot.position) < 14) return out.copy(hand.g.position);
  return null;
}
function smoothTo(cur, tgt, dt, k) { return cur + (tgt - cur) * (1 - Math.exp(-dt * k)); }

// Ausdruck setzen: Name aus EXPR (Test: face.test hat Vorrang)
function setExpr(name) { if (EXPR[name]) face.expr = name; }
function setFaceTest(name) { face.test = name && EXPR[name] ? name : null; }

function updateFace(dt, t) {
  const C = fox.kind && CREATURES[fox.kind]; if (!foxModel || !C || C.body !== 'biped') return false;
  const F = foxModel.userData.face || bind(foxModel); if (!F.ok) return false;
  // schlafend: Augen zu, sonst der gewählte Ausdruck
  const name = face.test || (fox.state === 'rest' && fox.cur === 'lie' ? 'asleep' : face.expr), X = EXPR[name];
  for (const k of KEYS) face.cur[k] = smoothTo(face.cur[k], X[k] || 0, dt, k === 'up' || k === 'lo' ? 9 : 6);
  const c = face.cur;
  // Blinzeln: alle 2–6 s kurz, ab und zu doppelt
  const B = face.blink; B.t -= dt; if (B.t <= 0) { B.d = .15; B.t = 2 + Math.random() * 4; if (Math.random() < .15) B.t = .3; }
  let blink = 0; if (B.d > 0) { B.d -= dt; blink = Math.sin(Math.max(0, B.d) / .15 * Math.PI); }
  foxModel.updateMatrixWorld(true);
  updateFaceFur(F);

  // Kopf und Nacken: zum Ziel drehen (über der Animation), dazu Neigung und Schieflage aus dem Ausdruck
  const L = face.look, lying = fox.state === 'rest' || fox.state === 'cast';
  const tgt = !lying && lookTarget(_v2);
  if (tgt && F.head) {
    F.head.getWorldPosition(_v); _m.copy(foxModel.matrixWorld).invert();
    const a = _v2.clone().applyMatrix4(_m), h = _v.applyMatrix4(_m), d = a.sub(h);
    L.tx = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -1.1, 1.1); L.ty = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -.5, .55);
  } else { L.tx = 0; L.ty = 0; }
  if (c.away > .05) L.tx = THREE.MathUtils.clamp(-Math.sign(L.tx || 1) * .9, -1.1, 1.1) * c.away + L.tx * (1 - c.away); // beleidigt: wegschauen
  L.yaw = smoothTo(L.yaw, L.tx, dt, 4); L.pitch = smoothTo(L.pitch, L.ty, dt, 4);
  if (F.neck) { rotModel(F.neck, AX.y, L.yaw * .4); rotModel(F.neck, AX.x, L.pitch * .35 + c.pitch * .4); }
  if (F.head) { rotModel(F.head, AX.y, L.yaw * .6); rotModel(F.head, AX.x, L.pitch * .65 + c.pitch * .6); rotModel(F.head, AX.z, c.roll); }

  // Ohren: vor/zurück, zur Seite, Öffnung drehen; dazu ab und zu ein Zucken
  F.ears.forEach((e, i) => {
    if (!restQ(e)) return; const s = i ? -1 : 1;
    e.quaternion.multiply(_r.setFromAxisAngle(AX.y, -c.swivel * s));   // um die eigene Längsachse
    rotModel(e, AX.z, -c.splay * s); rotModel(e, AX.x, c.ears + (face.twitch && face.twitch.i === i ? -face.twitch.a : 0));
  });
  if (face.twitch) { face.twitch.t -= dt; face.twitch.a = Math.sin(Math.max(0, face.twitch.t) / .2 * Math.PI) * .45; if (face.twitch.t <= 0) face.twitch = null; }
  else if (Math.random() < dt / 4.5) face.twitch = { i: Math.random() < .5 ? 0 : 1, t: .2, a: 0 };
  // Maul
  if (restQ(F.jaw)) rotModel(F.jaw, AX.x, c.jaw * .2);

  // Augen: Lider, Pupillen (Blick plus kleine Sprünge), Brauen
  if ((L.t -= dt) <= 0) { L.t = .4 + Math.random() * 1.6; L.gx = (Math.random() - .5) * .5; L.gy = (Math.random() - .5) * .35; }
  const gx = THREE.MathUtils.clamp((L.tx - L.yaw) * 1.4 + L.gx * .4, -1, 1), gy = THREE.MathUtils.clamp(-(L.ty - L.pitch) * 1.4 + L.gy * .4, -1, 1);
  for (const E of F.eyes) {
    E.eye.updateMatrixWorld(); E.uni.uEyeInv.value.copy(E.eye.matrixWorld).invert();
    const up = Math.max(c.up, blink), lo = Math.max(c.lo, blink * .85);
    E.uni.uLid.value.set(up, lo, c.slant * (1 - up * .6), lo * .9); // unteres Lid nach oben gewölbt: Lachaugen
    const ex = _ex.setFromMatrixColumn(E.eye.matrixWorld, 0), ey = _ey.setFromMatrixColumn(E.eye.matrixWorld, 1); // Halbachsen des Auges in Weltmaßen
    if (E.pupil) {
      const r = E.pupil.userData.faceRest; E.pupil.position.copy(r.p); E.pupil.scale.copy(r.s); E.pupil.scale.x *= c.pupil;
      E.pupil.updateMatrixWorld(); E.pupil.getWorldPosition(_w).addScaledVector(ex, gx * .42).addScaledVector(ey, gy * .3);
      E.pupil.position.copy(E.pupil.parent.worldToLocal(_w));
    }
    if (E.brow) {
      const r = E.brow.userData.faceRest; E.brow.position.copy(r.p); E.brow.quaternion.copy(r.q);
      E.brow.updateMatrixWorld(); E.brow.getWorldPosition(_w).addScaledVector(ey.normalize(), c.brow * .012 * (C.h / 2.3));
      E.brow.position.copy(E.brow.parent.worldToLocal(_w));
      rotModel(E.brow, AX.z, c.tilt * .5 * E.side);
    }
  }
  return true;
}
// Schalenfell im Gesicht (kreatur-modelle.md 5, erste Stufe): nur die Dreiecke mit Fellmaske _fur (aus dem Bauskript,
// lang an den Wangen, kurz auf der Schnauze, frei an Augen und Nase), als Schichten entlang der Normalen nach außen
// geschoben. Die Haare hängen an der Ruhelage der Haut (Attribut position), so bleiben sie über alle Schichten Strähnen,
// auch wenn sich der Kopf bewegt. Nur nah an der Kamera sichtbar.
const FACE_FUR = { shells: isMobile ? 7 : 14, len: .03, den: 210, near: 11 };
function faceFurMaterial(src, h, uni) {
  const m = src.clone();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni, { uH: { value: h } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float _fur; uniform float uLen, uH; varying float vFur; varying vec3 vBase;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vFur = _fur; vBase = position;
        // nach außen, leicht nach hinten gekämmt (Modell blickt nach +Z) und mit dem Gewicht ein wenig nach unten
        transformed += (normalize(objectNormal) + vec3(0.0, -0.4 * uH, -1.1 * uH)) * uLen * _fur * uH;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uDen, uH; varying float vFur; varying vec3 vBase;
        float h31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vFur < 0.03) discard;
        vec3 g = vBase * uDen, id = floor(g), f = fract(g) - 0.5 + (vec3(h31(id + 1.7), h31(id + 4.3), h31(id + 8.9)) - 0.5) * 0.35;
        float r = h31(id), len = mix(0.72, 1.0, r); // gleichmäßige Längen: sonst stehen einzelne Strähnen struppig ab
        if (uH > len || length(f) > (1.0 - pow(uH / len, 1.5)) * 0.74) discard; // an der Wurzel dick, spitz zum Ende
        diffuseColor.rgb *= mix(0.74, 1.08, uH / len) * mix(0.93, 1.07, r);`);
  };
  m.customProgramCacheKey = () => 'wkFaceFur';
  return m;
}
function addFaceFur(model) {
  let sk = null; model.traverse(o => { if (o.isSkinnedMesh && o.geometry.attributes._fur) sk = o; });
  if (!sk) return null;
  // nur Dreiecke mit Fell: eigene Indexliste über denselben Attributen
  const g0 = sk.geometry, fa = g0.attributes._fur, idx = g0.index, keep = [];
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2); if (fa.getX(a) > .03 || fa.getX(b) > .03 || fa.getX(c) > .03) keep.push(a, b, c); }
  const geo = new THREE.BufferGeometry(); for (const k in g0.attributes) geo.setAttribute(k, g0.attributes[k]); geo.setIndex(keep);
  const uni = { uLen: { value: 0 }, uDen: { value: FACE_FUR.den } }, shells = [];
  for (let i = 1; i <= FACE_FUR.shells; i++) {
    const m = new THREE.SkinnedMesh(geo, faceFurMaterial(sk.material, i / FACE_FUR.shells, uni));
    m.position.copy(sk.position); m.quaternion.copy(sk.quaternion); m.scale.copy(sk.scale); m.bind(sk.skeleton, sk.bindMatrix);
    m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.userData.shell = true; m.visible = false; sk.parent.add(m); shells.push(m);
  }
  return { sk, uni, shells, tris: keep.length / 3, on: false };
}
function updateFaceFur(F) {
  if (F.fur === undefined) F.fur = addFaceFur(foxModel);
  const f = F.fur; if (!f) return;
  const on = camera.position.distanceTo(foxPivot.position) < FACE_FUR.near;
  if (on !== f.on) { f.on = on; for (const m of f.shells) m.visible = on; }
  if (on) f.uni.uLen.value = FACE_FUR.len / f.sk.matrixWorld.getMaxScaleOnAxis(); // Weltlänge in Maße der Haut umrechnen
}

// Mitte des Gesichts (für die Gesichtskamera): zwischen den Augen, etwas darunter
function facePoint(out) {
  const F = foxModel && foxModel.userData.face; if (!F || !F.ok) return null;
  out.set(0, 0, 0); for (const E of F.eyes) out.add(E.eye.getWorldPosition(_w)); out.multiplyScalar(1 / F.eyes.length);
  out.y -= .06; return out;
}

export { EXPR, FACE_FUR, face, facePoint, setExpr, setFaceTest, updateFace };
