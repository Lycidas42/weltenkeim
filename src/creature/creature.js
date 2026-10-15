// Kreatur: Modell, Animationen, Posen, Fell, Augen, was sie im Maul trägt

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from '../core/state.js';
import { camera, isMobile, scene } from '../core/render.js';
import { CREATURES, fox } from './kinds.js';
import { gCreature, gSack, load, shadowify } from '../assets/models.js';
import { TK } from '../models/nature.js';
import { ST } from '../village/layout.js';
import { TREE_H } from '../world/trees.js';

/* ------------------------------------------------------------------ creature (Ruun) */
const ANIM_PAT = { idle: /^Idle$/, idle2: /^Idle_2$/, eat: /^Eating$/, walk: /^Walk$/, run: /^Gallop$/, attack: /^Attack/, hit: /^Idle_HitReact/, jump: /^Jump/ };
// fehlt eine Animation, wird eine vorhandene mit anderem Tempo genutzt
const ANIM_FALLBACK = { idle2: ['idle', .7], eat: ['idle', .5], run: ['walk', 2.1], attack: ['walk', 2.8] };
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
async function loadCreature(id) {
  return creatureCache[id] || (creatureCache[id] = await load(`animals/${CREATURES[id].file}.glb`));
}
// Porträt im Charakter-Blatt: eigene kleine 3D-Ansicht mit einer zweiten Instanz des Tiers (beim Fuchs das
// Fell-Modell), die jede Animation des Tiers in der Welt mitspielt. Eigener Renderer, die Weltkamera bleibt unberührt.
const portrait = { hand: null, renderer: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .05, 60), pivot: new THREE.Group(), rig: null, loading: null, cache: {}, look: new THREE.Vector3(), dist: 4 };
useCreature(S.creature, gCreature);
const ACT_LABEL = { help: 'Helfen', play: 'Spielen', mischief: 'Unfug' };
// Fürwörter nach dem gewählten Geschlecht der Kreatur (S.gender: 'w' oder 'm')
const pron = () => S.gender === 'm' ? { er: 'er', ihn: 'ihn', ihm: 'ihm' } : { er: 'sie', ihn: 'sie', ihm: 'ihr' };
const ACT_DESC = { help: 'einen Baum ins Lager gebracht', play: 'mit dem Dorf gespielt', mischief: 'einen Baum umgeworfen' };
const ACT_COL = { help: '#8fcf7b', play: '#f3c04d', mischief: '#ee8a72' };
// Der Tiergeist trägt einen Baum quer im Maul (wie einen Stock); hängt an der Kopfposition des Modells.
const mouthTrees = TK.map(g => { const o = shadowify(g.scene.clone(true)); o.visible = false; scene.add(o); return o; });
const mouthQ = new THREE.Quaternion(), mouthZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), mouthV = new THREE.Vector3(), mouthF = new THREE.Vector3();
const mouthSack = shadowify(gSack.scene.clone(true)); mouthSack.visible = false; scene.add(mouthSack);
function updateMouthTree() {
  mouthTrees.forEach(o => o.visible = false); mouthSack.visible = false;
  if (fox.carryGoods && foxModel) { // Sack mit Waren im Maul
    const C = CREATURES[fox.kind], head = foxModel.userData.head || (foxModel.userData.head = foxModel.getObjectByName(C.head || 'Head'));
    if (head) { head.getWorldPosition(mouthV); const fh = foxPivot.rotation.y; mouthV.x += Math.sin(fh) * C.h * .17; mouthV.z += Math.cos(fh) * C.h * .17; mouthV.y -= C.h * .2; mouthSack.position.copy(mouthV); mouthSack.rotation.set(0, fh, 0); mouthSack.scale.setScalar(1.5 * C.h / 1.45); mouthSack.visible = true; }
    return;
  }
  if (!fox.carry || !foxModel) return;
  const C = CREATURES[fox.kind], head = foxModel.userData.head || (foxModel.userData.head = foxModel.getObjectByName(C.head || 'Head'));
  if (!head) return;
  const o = mouthTrees[fox.carryType || 0], s = ST * .55 * C.h / 1.45;
  head.getWorldPosition(mouthV); mouthF.set(Math.sin(foxPivot.rotation.y), 0, Math.cos(foxPivot.rotation.y));
  mouthV.addScaledVector(mouthF, C.h * .21).y -= C.h * .07;          // vor den Kopf, auf Maulhöhe
  // Krone auf die von der Kamera abgewandte Seite (mit etwas Trägheit, damit sie nicht hin und her springt)
  const side = mouthTmp.set(1, 0, 0).applyQuaternion(foxPivot.quaternion), dc = side.x * (camera.position.x - fox.x) + side.z * (camera.position.z - fox.z);
  if (Math.abs(dc) > 1) fox.crownSide = dc > 0 ? -1 : 1; const cs = fox.crownSide || 1;
  mouthQ.copy(foxPivot.quaternion); if (cs < 0) mouthQ.multiply(mouthFlip); mouthQ.multiply(mouthZ); // Stamm quer zur Laufrichtung
  o.quaternion.copy(mouthQ); o.scale.setScalar(s);
  o.position.copy(mouthV).addScaledVector(side, -TREE_H * s * .1 * cs); // Krone zeigt nach +x: das Maul packt den Stamm knapp über dem Wurzelende, die Krone liegt seitlich neben dem Kopf
  o.visible = true;
}
const mouthTmp = new THREE.Vector3(), mouthFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export { ACT_COL, ACT_DESC, ACT_LABEL, FUR, buildRig, foxActs, foxAnim, foxMixer, foxModel, foxOnce, foxPivot, loadCreature, mouthF, mouthTmp, mouthV, mouthZ, portrait, pron, rigPlay, updateFur, updateMouthTree, useCreature };
