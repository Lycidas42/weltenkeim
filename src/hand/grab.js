// Bäume greifen, ausreißen und werfen

import { clamp, rnd } from '../core/util.js';
import { segToScreen, tA, tB } from '../core/render.js';
import { addLogs, floatText } from '../ui/feedback.js';
import { heightAt } from '../world/terrain.js';
import { fox } from '../creature/kinds.js';
import { heldObjs, heldTree, input, pointerXY, rootBall, setHoldOff } from './pointer.js';
import { ST } from '../village/layout.js';
import { TREE_H, trees, updateFallen } from '../world/trees.js';
import { villagers } from '../village/villagers.js';
import { hand } from './hand.js';
import { foxIdle } from '../creature/ai.js';

// Mit der Hand einen Baum packen und halten oder nach oben ziehen: er wackelt, reißt samt Wurzeln aus,
// liegt dann in der Hand und wird beim Loslassen geworfen. Bei der Landung wird er zu Holz; an der Stelle
// wächst später ein neuer Baum.

// Baum unter dem Finger: Abstand zur sichtbaren Strecke Stammfuß–Krone auf dem Bildschirm, Toleranz wächst mit der
// Baumgröße, aber höchstens etwa eine Kronenbreite (sonst packt ein Baum dicht vor der Kamera fast das ganze Bild)
function treeAt(cx, cy) {
  let best = null, bd = 1e9;
  for (const t of trees) {
    if (!t.alive || t.gone || t.g < .6) continue;
    const y = heightAt(t.x, t.z); if (!segToScreen(t.x, y, t.z, t.x, y + TREE_H * ST * t.g, t.z, tA, tB)) continue;
    const ex = tB.x - tA.x, ey = tB.y - tA.y, L2 = ex * ex + ey * ey || 1, u = clamp(((cx - tA.x) * ex + (cy - tA.y) * ey) / L2, 0, 1);
    const d = Math.hypot(cx - tA.x - ex * u, cy - tA.y - ey * u), tol = clamp(Math.sqrt(L2) * .38, 26, 110);
    if (d < tol && d / tol < bd) { bd = d / tol; best = t; }
  }
  return best;
}
function uprootTree(tr) {
  if (tr.reserved === 'fox') { fox.tree = null; if (fox.state === 'walk' || fox.state === 'work') foxIdle(1); }
  else if (tr.reserved) tr.reserved.tree = null;
  tr.reserved = null; tr.alive = false; tr.stumpT = 0; tr.regrow = 0;
  Object.assign(heldTree, { on: true, flying: false, type: tr.type, g: tr.g, rot: tr.rot, tilt: 0 });
  setHoldOff(tr.x, tr.z);
  floatText(tr.x, heightAt(tr.x, tr.z) + 2.2, tr.z, 'Ausgerissen!', 'w');
  for (const v of villagers) { const dx = v.x - tr.x, dz = v.z - tr.z, d = Math.hypot(dx, dz); if (d < 2.5 && ['idle', 'walk', 'chop', 'plant'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 1.5; v.tx = v.x + dx / (d || 1) * 2.5; v.tz = v.z + dz / (d || 1) * 2.5; } }
}
function throwTree() {
  const k = clamp(hand.vel.length(), 0, 12) / (hand.vel.length() || 1);
  heldTree.flying = true; heldTree.vel.set(hand.vel.x * k, hand.vel.y * .4 * k + 2, hand.vel.z * k); heldTree.spin = rnd(3);
}
function updateTrees(dt, t) {
  updateFallen(dt);
  if (input.treeGrab) {
    if (!input.treeGrab.tr.alive) input.treeGrab = null;
    else {
      // halten zieht langsam, nach oben wischen schneller
      input.treeGrab.prog += dt * .4 + Math.max(0, input.treeGrab.lastY - pointerXY.y) / 160; input.treeGrab.lastY = pointerXY.y;
      if (input.treeGrab.prog >= 1) { const tr = input.treeGrab.tr; input.treeGrab = null; uprootTree(tr); }
    }
  }
  const o = heldObjs[heldTree.type];
  heldObjs.forEach(x => x.visible = false); rootBall.visible = false;
  if (!heldTree.on || (!heldTree.flying && input.heldHidden)) return;
  const s = ST * heldTree.g;
  if (heldTree.flying) {
    heldTree.vel.y -= 16 * dt; heldTree.pos.addScaledVector(heldTree.vel, dt); heldTree.tilt += heldTree.spin * dt + dt * 2.5;
    const gy = heightAt(heldTree.pos.x, heldTree.pos.z);
    if (heldTree.pos.y < Math.max(gy, 0) && heldTree.vel.y < 0) {
      heldTree.on = false; heldTree.flying = false;
      if (gy < -.1) floatText(heldTree.pos.x, .6, heldTree.pos.z, 'Platsch!', 'w');
      else { const n = Math.max(1, Math.round(3 * heldTree.g)); addLogs(n, heldTree.pos.x, gy + .4, heldTree.pos.z); }
      return;
    }
  } else heldTree.pos.set(hand.g.position.x, hand.g.position.y - .95 * s, hand.g.position.z);
  o.visible = true; rootBall.visible = true;
  o.position.copy(heldTree.pos); o.rotation.set(Math.min(heldTree.tilt, 1.4) + Math.sin(t * 3) * .05, heldTree.rot, 0); o.scale.setScalar(s);
  rootBall.position.copy(heldTree.pos); rootBall.rotation.copy(o.rotation); rootBall.scale.setScalar(heldTree.g);
}

export { throwTree, treeAt, updateTrees, uprootTree };
