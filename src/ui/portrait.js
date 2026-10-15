// Porträt der Kreatur im Charakter-Blatt

import * as THREE from 'three';
import { $ } from '../core/util.js';
import { tmpV } from '../core/render.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { gSack, load } from '../assets/models.js';
import { TK } from '../models/nature.js';
import { ST } from '../village/layout.js';
import { TREE_H } from '../world/trees.js';
import { makeHand, styleHand } from '../hand/hand.js';
import { buildRig, mouthF, mouthTmp, mouthV, mouthZ, portrait, rigPlay, updateFur } from '../creature/creature.js';

{
  const P = portrait;
  P.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x4d6b3c, 1.4));
  const key = new THREE.DirectionalLight(0xfff0d6, 2.2); key.position.set(2.5, 4, 3); P.scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 1.1); rim.position.set(-3, 2.5, -3); P.scene.add(rim);
  P.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b8a46, roughness: 1 }));
  P.scene.add(P.ground, P.pivot);
}
async function showPortrait() {
  const P = portrait, id = fox.kind, C = CREATURES[id];
  if ((P.rig && P.rig.id === id) || P.loading === id) return;
  if (!P.hand && !P.handLoading) P.handLoading = load('hand/GodHand.glb').then(g => { P.hand = makeHand(g); P.scene.add(P.hand.g); styleHand(P.hand); }).catch(() => {});
  if (!P.renderer) {
    P.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    P.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); $('foxPortrait').appendChild(P.renderer.domElement);
    P.renderer.setSize($('foxPortrait').clientWidth || 300, $('foxPortrait').clientHeight || 150);
  }
  P.loading = id;
  try {
    const g = P.cache[id] || (P.cache[id] = await load(`animals/${C.hd || C.file}.glb`));
    if (P.loading !== id || fox.kind !== id) return;
    if (P.rig) P.pivot.remove(P.rig.model);
    P.rig = buildRig(id, g, !!C.hd); P.pivot.add(P.rig.model);
    // Kamera schräg von vorn, Bildausschnitt an die Größe des Tiers anpassen
    const size = P.rig.dims;
    P.ground.scale.setScalar(Math.max(size.x, size.z) * .75);
    P.look.set(0, size.y * .45, 0); P.dist = Math.max(size.y, size.z * .8) * 1.75;
    rigPlay(P.rig, fox.cur || 'idle');
  } catch (e) { console.warn("Porträt:", e); } // ohne Porträt bleibt das Panel nutzbar
  finally { if (P.loading === id) P.loading = null; }
}
function renderPortrait(dt, t) {
  const P = portrait; if (!P.rig || !P.renderer) return;
  const el = $('foxPortrait'), w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  const sz = P.renderer.getSize(tmpV2); if (sz.x !== w || sz.y !== h) P.renderer.setSize(w, h);
  P.cam.aspect = w / h; P.cam.updateProjectionMatrix();
  const az = .55 + Math.sin(t * .15) * .12; // ganz langsames Schwenken
  P.cam.position.set(Math.sin(az) * P.dist, P.look.y + P.dist * .25, Math.cos(az) * P.dist); P.cam.lookAt(P.look);
  P.pivot.position.y = Math.sin(Math.min(1, fox.hop / .5) * Math.PI) * .3 * CREATURES[P.rig.id].h / 1.45;
  P.rig.mixer.update(dt);
  if (P.rig.model.userData.fur) updateFur(P.rig.model.userData.fur, t);
  portraitMouthTree();
  P.renderer.render(P.scene, P.cam);
}
// Stamm im Maul auch im Porträt (wie in der Welt, das Tier blickt hier nach +z)
function portraitMouthTree() {
  const P = portrait;
  if (!P.mouth) { P.mouth = TK.map(g => { const o = g.scene.clone(true); o.visible = false; P.scene.add(o); return o; }); P.sack = gSack.scene.clone(true); P.sack.visible = false; P.scene.add(P.sack); }
  P.mouth.forEach(o => o.visible = false); P.sack.visible = false;
  if (!(fox.carry || fox.carryGoods) || !P.rig) return;
  const C = CREATURES[P.rig.id], m = P.rig.model, head = m.userData.head || (m.userData.head = m.getObjectByName(C.head || 'Head'));
  if (!head) return;
  if (fox.carryGoods) { P.scene.updateMatrixWorld(true); head.getWorldPosition(mouthV); const h = Math.atan2(mouthV.x, mouthV.z); mouthV.x += Math.sin(h) * C.h * .17; mouthV.z += Math.cos(h) * C.h * .17; mouthV.y -= C.h * .2; P.sack.position.copy(mouthV); P.sack.rotation.set(0, h, 0); P.sack.scale.setScalar(1.5 * C.h / 1.45); P.sack.visible = true; return; }
  const o = P.mouth[fox.carryType || 0], s = ST * .55 * C.h / 1.45;
  P.scene.updateMatrixWorld(true); head.getWorldPosition(mouthV);
  const h = Math.atan2(mouthV.x, mouthV.z); // Blickrichtung: von der Mitte des Tiers zum Kopf
  mouthF.set(Math.sin(h), 0, Math.cos(h)); mouthV.addScaledVector(mouthF, C.h * .21).y -= C.h * .07;
  const side = mouthTmp.set(Math.cos(h), 0, -Math.sin(h)), cs = side.x * P.cam.position.x + side.z * P.cam.position.z > 0 ? -1 : 1; // Krone von der Kamera weg
  o.quaternion.setFromAxisAngle(tmpV.set(0, 1, 0), h + (cs < 0 ? Math.PI : 0)).multiply(mouthZ); o.scale.setScalar(s);
  o.position.copy(mouthV).addScaledVector(side, -TREE_H * s * .1 * cs); o.visible = true;
}
const tmpV2 = new THREE.Vector2();

export { renderPortrait, showPortrait };
