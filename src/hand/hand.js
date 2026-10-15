// Gotteshand: Modell, Haltungen, Aussehen

import * as THREE from 'three';
import { S } from '../core/state.js';
import { scene } from '../core/render.js';
import { gHand } from '../assets/models.js';

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
  pinch: { curl: .62, thumb: .75, spread: .05, point: .35 }, // Finger zum Streuen
  cup: { curl: .3, thumb: .25, spread: 0, point: 0 },        // hohle Hand
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

export { HAND_POSES, hand, makeHand, poseHand, styleHand };
