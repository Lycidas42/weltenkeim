// Gesten der Hand an der Kreatur: Streicheln und Klaps

import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { floatText } from '../ui/feedback.js';
import { CREATURES, fox } from './kinds.js';
import { HAND_POSES, hand, poseHand } from '../hand/hand.js';
import { FUR, foxModel, foxPivot, portrait } from './creature.js';

// Gesten der Hand am Tiergeist: Streicheln (über den Rücken streichen) und Klaps (ausholen, zuschlagen)
const handAnim = { kind: null, t: 0, hit: null, hearts: 0 };
const HAND_DUR = { pet: 2.1, slap: .95 }, HAND_HIT = { pet: 2.05, slap: .62 }; // HIT: Reaktion, sobald die Hand weg ist
const BACK_Z = [-.3, -.15, 0, .15, .3]; // Messstellen entlang des Rückens (Anteile der Tierhöhe, + = Kopf)
function playHand(kind, onHit) {
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

export { HAND_DUR, handAnim, playHand, updateHandAnim };
