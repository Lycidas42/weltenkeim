// Eingabe: Werkzeuge, Hilfe der Hand, Zeiger- und Tastaturereignisse, Hand bewegen

import * as THREE from 'three';
import { $, clamp, rnd } from '../core/util.js';
import { PROC, RES, ROLES, S, resText } from '../core/state.js';
import { camera, canvas, controls, tmpV } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { heightAt } from '../world/terrain.js';
import { SPRAY_N, spray } from '../world/water.js';
import { sculpt } from '../world/sculpt.js';
import { spawnChips } from '../world/particles.js';
import { treeKindAt } from '../models/nature.js';
import { heldTree, hit, hitOk, holdOff, input, pick, pointerXY, pointers, ray, screenDist, setHoldOff, touchLift } from './pointer.js';
import { ST } from '../village/layout.js';
import { trees } from '../world/trees.js';
import { FARM, farmPt, huts } from '../village/huts.js';
import { CROPS, farms, fieldAt } from '../farm/farm.js';
import { villagers } from '../village/villagers.js';
import { HAND_POSES, hand, poseHand } from './hand.js';
import { handAnim, updateHandAnim } from '../creature/gestures.js';
import { fish, removeAnimal, wild } from '../wildlife/land.js';
import { splash } from '../wildlife/sea.js';
import { JOB, hauling, idle, wish } from '../village/ai.js';
import { forestAlert } from '../village/forest-alert.js';
import { tryMiracle } from './miracles.js';
import { throwTree, treeAt } from './grab.js';
import { HINTS, closeSheets, setFollow } from '../ui/sheets.js';
import { closeRing, foxUnder, hoverFox, openRing, ringOpen } from '../ui/ring.js';

// Ernte mit der Hand Gottes: das Gemüse geht gleich ins Lager
function harvestByHand(f) {
  const C = CROPS[f.c], n = C.yield, y = heightAt(f.x, f.z);
  const r = C.res || 'veg'; S[r] += n; floatText(f.x, y + .5, f.z, `${C.label}: +${resText(r, n)}`, 'h');
  for (let k = 0; k < 6; k++) { const p = farmPt(f.F, f.lx + rnd(FARM.fw / 2), f.lz + rnd(FARM.fd / 2)); spawnChips(p.x, heightAt(p.x, p.z) + .1, p.z, Math.random() * 6.28); }
  if (f.by && f.by.field === f) { const v = f.by; v.field = null; if (v.state === 'harvest' || (v.state === 'walk' && v.next === 'harvest')) idle(v, .3); }
  f.by = null; f.state = 'leer'; f.g = 0; f.c = (f.c + 1) % CROPS.length;
}
// Die Hand hilft bei allem, was die Arbeiter tun: säen, gießen, ernten, Vieh füttern, Fische greifen, Wild bannen
// und erlegtes Wild aufheben, Setzlinge pflanzen, eine Ladung in Säge, Mühle oder Bäckerei verarbeiten und Waren ins Lager bringen.
// Erst bestimmen, was die Hand an dieser Stelle tun würde (Aktion, Schild, Handhaltung), dann ausführen.
// So zeigt die Hand schon beim Darüberfahren, was sie kann.
function handHelp(cx, cy) { const h = helpAt(cx, cy, true); if (!h) return false; h.run(); return true; }
function helpAt(cx, cy, picked = false) {
  if (!picked) pick(cx, cy);
  // Wildtiere (nach Bildschirmabstand): lebend bannen, erlegt aufheben
  let wa = null, wd = 38;
  for (const a of wild) { const d = screenDist(a.x, heightAt(a.x, a.z) + (a.kind === 'reh' ? .3 : .1), a.z, cx, cy); if (d < wd) { wd = d; wa = a; } }
  if (wa) {
    const y = heightAt(wa.x, wa.z);
    if (wa.state === 'dead') return { label: 'Aufheben', pose: 'claw', run() { const n = wa.kind === 'reh' ? 3 : 1; for (const v of villagers) if (v.prey === wa) { v.prey = null; if (v.state === 'walk' && v.next === 'pickup') idle(v, .3); } removeAnimal(wa); S.meat += n; floatText(wa.x, y + .6, wa.z, `+${resText('meat', n)}`, 'h'); } };
    if (wa.stun > 0) return { label: 'Gebannt', pose: 'point', run() { wa.stun = 15; } };
    return { label: 'Bannen', pose: 'point', run() {
      wa.stun = 15; wa.state = 'idle'; wa.timer = 1; floatText(wa.x, y + .7, wa.z, 'Gebannt', 's');
      // der nächste freie Jäger nimmt es ins Visier
      const hs = villagers.filter(v => v.role === 'hunter' && v.hut && !v.carry && ['idle', 'walk', 'aim'].includes(v.state) && !(v.prey && v.prey.state === 'dead'));
      hs.sort((a, b) => Math.hypot(a.x - wa.x, a.z - wa.z) - Math.hypot(b.x - wa.x, b.z - wa.z));
      if (hs[0]) { for (const v of villagers) if (v.prey === wa) v.prey = null; hs[0].prey = null; JOB.hunter(hs[0]); }
    } };
  }
  if (!hitOk) return null;
  // Felder: leer → säen, wachsend → gießen, reif → ernten
  const fl = fieldAt(hit.x, hit.z);
  if (fl) {
    const y = heightAt(fl.x, fl.z), C = CROPS[fl.c];
    const free = () => { if (fl.by && fl.by.field === fl) { const v = fl.by; v.field = null; fl.by = null; if (['sow', 'harvest'].includes(v.state) || (v.state === 'walk' && ['sow', 'harvest'].includes(v.next))) idle(v, .3); } }; // der Bauer muss nicht mehr hin
    if (fl.state === 'reif') return { label: `${C.label} ernten`, pose: 'claw', run() { free(); harvestByHand(fl); } };
    if (fl.state === 'leer') return { label: `${C.label} säen`, pose: 'pinch', run() { free(); fl.state = 'grow'; fl.g = 0; floatText(fl.x, y + .5, fl.z, `${C.label} gesät`, 's'); for (let k = 0; k < 10; k++) { const p = farmPt(fl.F, fl.lx + rnd(FARM.fw / 2), fl.lz + rnd(FARM.fd / 2)); spawnChips(p.x, heightAt(p.x, p.z) + .05, p.z, Math.random() * 6.28); } } };
    if (fl.water > 30) return { label: `${C.label} ${Math.floor(fl.g * 100)} %`, pose: 'relax', run() { toast(`${C.label}: zu ${Math.floor(fl.g * 100)} % gewachsen, gerade gegossen.`, 2); } };
    return { label: `${C.label} gießen`, pose: 'cup', run() { // Tropfen fallen aufs Feld, eine Weile wächst es doppelt so schnell
      fl.water = 60; floatText(fl.x, y + .5, fl.z, `${C.label} gegossen`, 's');
      for (let k = 0; k < 40; k++) { if (spray.length >= SPRAY_N) spray.shift(); const p = farmPt(fl.F, fl.lx + rnd(FARM.fw / 2), fl.lz + rnd(FARM.fd / 2)); spray.push({ x: p.x, y: heightAt(p.x, p.z) + .8 + Math.random() * .5, z: p.z, vx: 0, vy: -1 - Math.random(), vz: 0, t: 0, life: .7, s: Math.random() * .5 }); }
    } };
  }
  // Weide: Tiere füttern, Milch, Eier und Fleisch gleich ins Lager
  for (const F of farms) {
    const dx = hit.x - F.x, dz = hit.z - F.z, c = Math.cos(F.ry), sn = Math.sin(F.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c, P = FARM.pen;
    if (lx > P.x0 && lx < P.x1 && lz > P.z0 && lz < P.z1) return { label: 'Füttern', pose: 'cup', run() {
      F.feedT = 9; const g = { milk: Math.floor(F.milk), eggs: Math.floor(F.eggs), meat: Math.floor(F.pork) }; F.milk -= g.milk; F.eggs -= g.eggs; F.pork -= g.meat;
      const out = Object.keys(g).filter(k => g[k] > 0).map(k => { S[k] += g[k]; return resText(k, g[k]); });
      floatText(hit.x, hit.y + .6, hit.z, out.length ? `Gefüttert: +${out.join(', ')}` : 'Gefüttert', out.length ? 'h' : 's');
    } };
  }
  // Hütten und Werkstätten: wartende Waren ins Lager, sonst eine Ladung verarbeiten
  let hb = null, hd = 1e9;
  for (const h of huts) { const d = Math.hypot(hit.x - h.x, hit.z - h.z), sd = screenDist(h.x, heightAt(h.x, h.z) + .5, h.z, cx, cy); if ((d < 1.05 || sd < 42) && d < hd) { hd = d; hb = h; } }
  if (hb) {
    const y = heightAt(hb.x, hb.z) + 1.2, P = PROC[hb.role];
    let wait = 0; for (const k in hb.goods) wait += Math.max(0, Math.floor(hb.goods[k] - hauling(hb, 'pick', k)));
    if (hb.role === 'sawyer') wait += Math.max(0, hb.planks - hauling(hb, 'out'));
    if (wait > 0) return { label: 'Ins Lager bringen', pose: 'claw', run() {
      const out = [];
      for (const k in hb.goods) { const n = Math.floor(hb.goods[k] - hauling(hb, 'pick', k)); if (n > 0) { hb.goods[k] -= n; S[k] += n; out.push(resText(k, n)); } }
      if (hb.role === 'sawyer') { const n = hb.planks - hauling(hb, 'out'); if (n > 0) { hb.planks -= n; S.holz += n; out.push(`${n} Bretter`); } }
      floatText(hb.x, y, hb.z, `Ins Lager: ${out.join(', ')}`, 'h');
    } };
    if (P && hb.inp >= P.n) return { label: hb.role === 'miller' ? 'Mahlen' : 'Backen', pose: 'flat', run() { hb.inp -= P.n; hb.goods[P.out] = (hb.goods[P.out] || 0) + P.m; hb.busy = 1.5; floatText(hb.x, y, hb.z, `+${resText(P.out, P.m)} ${P.verb}`, 'h'); } };
    if (hb.role === 'sawyer' && hb.logs >= 1) return { label: 'Sägen', pose: 'flat', run() { hb.logs--; hb.planks += 2; hb.sawing = 1; floatText(hb.x, y, hb.z, '+2 Bretter gesägt', 'h'); } };
    return { label: null, pose: 'relax', run() { toast(P ? `${ROLES[hb.role].hut}: Es fehlt ${RES[P.inp][1]}.` : hb.role === 'sawyer' ? 'Sägemühle: Es fehlen Stämme.' : `${ROLES[hb.role].hut}: Gerade nichts abzuholen.`, 2); } };
  }
  // Wasser: einen Fisch greifen
  if (heightAt(hit.x, hit.z) < -.05) {
    let fi = -1, fd = 1.1 * 1.1; fish.forEach((f, i) => { const d = (f.x - hit.x) ** 2 + (f.z - hit.z) ** 2; if (d < fd && !f.jump) { fd = d; fi = i; } });
    if (fi < 0) return null;
    const f = fish[fi];
    return { label: 'Fisch greifen', pose: 'claw', run() { const i = fish.indexOf(f); if (i < 0) return; fish.splice(i, 1); splash(f.x, f.z); S.fish += 1; floatText(f.x, .6, f.z, `+${resText('fish', 1)}`, 'h'); } };
  }
  // Baumstumpf oder freier Baumplatz: Setzling pflanzen
  let tb = null, td = .5;
  for (const t of trees) { if (t.alive || t.gone || t.reserved) continue; const d = Math.hypot(t.x - hit.x, t.z - hit.z); if (d < td) { td = d; tb = t; } }
  if (tb) return { label: 'Pflanzen', pose: 'pinch', run() { Object.assign(tb, { alive: true, g: .12, stumpT: 0, regrow: 0, type: treeKindAt(tb.x, tb.z) }); floatText(tb.x, heightAt(tb.x, tb.z) + .5, tb.z, 'Gepflanzt', 's'); } };
  return null;
}
// Was die Hand unter dem Mauszeiger tun kann: Haltung und Schild (nur ohne Druck, alle paar Bildschirmbilder neu bestimmt)
let hoverHelp = null, hoverT = 0;
function updateHandHover(dt) {
  const tip = $('handTip'), on = input.tool === 'hand' && input.handShown && input.ptrType === 'mouse' && input.primary === null && !input.grabbed && !heldTree.on && !hoverFox && !ringOpen;
  if (!on) { hoverHelp = null; tip.hidden = true; return; }
  if ((hoverT -= dt) <= 0) {
    hoverT = .12;
    let best = null, bd = 40;
    for (const v of villagers) { if (v.state === 'grabbed' || v.state === 'falling' || v.state === 'sleep') continue; const d = screenDist(v.x, v.y + .25, v.z, pointerXY.x, pointerXY.y); if (d < bd) { bd = d; best = v; } }
    hoverHelp = best ? { label: 'Packen', pose: 'grab' } : helpAt(pointerXY.x, pointerXY.y);
    if (!hoverHelp && treeAt(pointerXY.x, pointerXY.y)) hoverHelp = { label: 'Ausreißen', pose: 'claw' };
    pick(pointerXY.x, pointerXY.y); // Trefferpunkt wieder auf den Zeiger (für die Hand)
    tip.hidden = !(hoverHelp && hoverHelp.label);
    if (!tip.hidden && tip.textContent !== hoverHelp.label) tip.textContent = hoverHelp.label;
  }
  if (!tip.hidden) { const r = canvas.getBoundingClientRect(); tip.style.transform = `translate(${Math.round(pointerXY.x - r.left + 18)}px, ${Math.round(pointerXY.y - r.top + 14)}px)`; }
}
// Zeiger: Bodenpunkt unter dem Finger bestimmen, beim Formen das Gelände verändern
function updatePointer(dt) {
  if (input.primary !== null || (input.handShown && input.tool !== 'blick')) pick(pointerXY.x, pointerXY.y - touchLift());
  if (input.pressing && input.tool === 'sculpt' && hitOk) sculpt(hit.x, hit.z, input.sculptDir, dt);
}
// Gehaltener Bewohner hängt unter der Hand
function carryGrabbed() { if (input.grabbed) { input.grabbed.x = hand.g.position.x; input.grabbed.z = hand.g.position.z + .05; input.grabbed.y = hand.g.position.y - .62; } }
// Hand: folgt dem Zeiger, hält, was sie gegriffen hat, und wechselt die Haltung je nach Werkzeug und Ziel
function updateHand(dt, t) {
  if (handAnim.kind) updateHandAnim(dt, t);
  const showHand = !handAnim.kind && input.tool !== 'blick' && input.handShown && hitOk;
  if (!handAnim.kind) hand.g.visible = showHand;
  if (showHand) {
    // auf dem Bildschirm etwa gleich groß, egal wie weit gezoomt ist
    const hs = clamp(camera.position.distanceTo(hand.g.position) / 25, .42, 1.25); hand.g.scale.setScalar(hs);
    const lift = heldTree.on ? 1.3 + ST * heldTree.g * .95 : input.grabbed ? 1.0 : ((input.pressing && input.tool === 'sculpt') ? .75 : 1.5) * hs;
    if (input.treeGrab) {
      // am Stamm festhalten und zittern, je weiter der Baum nachgibt
      const tr = input.treeGrab.tr, j = input.treeGrab.prog * .05;
      hand.target.set(tr.x + rnd(j), heightAt(tr.x, tr.z) + .95 * tr.g * ST + input.treeGrab.prog * .25, tr.z + rnd(j));
    } else if (input.grabbed || heldTree.on) {
      // Gehaltenes (Bewohner, Baum) bleibt beim Zupacken, wo es war, und folgt dann der Fingerbewegung;
      // die Hand hängt senkrecht darüber
      const x = hit.x + holdOff.x, z = hit.z + holdOff.z;
      hand.target.set(x, Math.max(heightAt(x, z), 0) + lift, z);
    } else {
      // leere Hand: um 'lift' über dem Boden, aber auf der Sichtlinie durch den Zeiger, damit sie genau unter ihm liegt
      const d = ray.ray.direction, k = lift / Math.max(.2, -d.y);
      hand.target.set(hit.x, Math.max(hit.y, 0), hit.z).addScaledVector(d, -k);
    }
    // war die Hand unsichtbar (z. B. zwischen zwei Tipps am Handy), erscheint sie direkt am Ziel statt heranzufliegen
    if (!hand.shown) { hand.g.position.copy(hand.target); hand.vel.set(0, 0, 0); }
    hand.prev.copy(hand.g.position);
    hand.g.position.lerp(hand.target, 1 - Math.exp(-dt * 16));
    const v = tmpV.copy(hand.g.position).sub(hand.prev).divideScalar(Math.max(dt, 1e-3)); hand.vel.lerp(v, .35);
    const dx = controls.target.x - camera.position.x, dz = controls.target.z - camera.position.z;
    hand.g.rotation.y = Math.atan2(-dx, -dz);
    const pose = input.grabbed || heldTree.on ? HAND_POSES.hold : input.treeGrab ? HAND_POSES.claw : hoverFox && !input.pressing ? HAND_POSES.flat : hoverHelp && !input.pressing ? HAND_POSES[hoverHelp.pose] || HAND_POSES.relax
      : input.pressing ? (input.tool === 'sculpt' ? (input.sculptDir > 0 ? HAND_POSES.flat : HAND_POSES.fist) : HAND_POSES.grab) : HAND_POSES.relax;
    poseHand(hand, pose, dt, t);
  }
  hand.shown = showHand; hand.pressing = input.pressing;
}
function onToolDown(cx, cy) {
  pick(cx, cy); input.handShown = hitOk;
  if (input.tool === 'hand') {
    if (foxUnder(cx, cy)) { openRing(); input.pressing = false; return; }
    let best = null, bd = 40;
    for (const v of villagers) { if (v.state === 'grabbed' || v.state === 'falling' || v.state === 'sleep') continue; const d = screenDist(v.x, v.y + .25, v.z, cx, cy); if (d < bd) { bd = d; best = v; } }
    if (best) { input.grabbed = best; setHoldOff(best.x, best.z); if (best.tree) { best.tree.reserved = null; best.tree = null; } if (best.carry) { best.carry = 0; best.drop = null; } best.state = 'grabbed'; }
    else if (!heldTree.on && !handHelp(cx, cy)) { const tr = treeAt(cx, cy); if (tr) input.treeGrab = { tr, prog: 0, lastY: cy }; }
  } else if (input.tool === 'miracle' && hitOk) { tryMiracle(hit); input.pressing = false; return; }
  input.pressing = true;
}
function onToolUp() {
  if (input.treeGrab) input.treeGrab = null; // losgelassen, bevor der Baum nachgab
  if (heldTree.on) throwTree();
  if (input.grabbed) { const v = input.grabbed; input.grabbed = null; v.state = 'falling'; const k = clamp(hand.vel.length(), 0, 14) / (hand.vel.length() || 1);
    v.vx = hand.vel.x * k; v.vz = hand.vel.z * k; v.vy = hand.vel.y * .4 * k + 2.5; }
  input.pressing = false;
}
// Karte mit der Maus verschieben: im Blick-Werkzeug mit links ziehen, in jedem Werkzeug mit Leertaste oder Strg + links.
// OrbitControls tauscht bei gedrückter Strg-Taste Drehen und Verschieben, daher bei Strg die Belegung „Drehen“.
let spaceDown = false, ctrlDown = false;
function applyMouseButtons() {
  const left = spaceDown || input.tool === 'blick' ? THREE.MOUSE.PAN : ctrlDown ? THREE.MOUSE.ROTATE : -1;
  controls.mouseButtons = { LEFT: left, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  canvas.style.cursor = spaceDown || ctrlDown ? 'grab' : '';
}
function panKeys(e, down) {
  if (e.target.closest && e.target.closest('input, textarea')) return; // Leerzeichen im Namensfeld bleiben Leerzeichen
  if (e.code === 'Space') { e.preventDefault(); spaceDown = down; } // sonst scrollt die Seite oder ein Knopf wird ausgelöst
  if (e.key === 'Control') ctrlDown = down;
  applyMouseButtons();
}
addEventListener('keydown', e => panKeys(e, true));
addEventListener('keyup', e => panKeys(e, false));
addEventListener('blur', () => { spaceDown = ctrlDown = false; applyMouseButtons(); });
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, true);
  if (e.pointerType === 'mouse' && (spaceDown || e.ctrlKey)) return; // verschiebt nur die Karte, die Hand bleibt untätig
  if (pointers.size > 1) { if (input.primary !== null) { onToolUp(); input.primary = null; } return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (ringOpen) { closeRing(); return; } // Tippen daneben schließt das Kreismenü
  if (input.tool === 'blick') return;
  closeSheets();
  input.primary = e.pointerId; input.ptrType = e.pointerType; pointerXY.x = e.clientX; pointerXY.y = e.clientY; onToolDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && input.tool !== 'blick') { pointerXY.x = e.clientX; pointerXY.y = e.clientY; input.handShown = true; if (input.primary === null) input.ptrType = 'mouse'; }
  if (e.pointerId === input.primary) { pointerXY.x = e.clientX; pointerXY.y = e.clientY; }
});
const endPtr = e => { pointers.delete(e.pointerId); if (e.pointerId === input.primary) { input.primary = null; onToolUp(); } };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && input.primary === null) input.handShown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
function setTool(t) {
  input.tool = t; if (input.grabbed) onToolUp();
  document.querySelectorAll('.tools button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  $('ctxSculpt').hidden = t !== 'sculpt'; $('ctxMiracle').hidden = t !== 'miracle';
  $('hint').textContent = HINTS[t];
  applyMouseButtons();
  controls.touches = { ONE: t === 'blick' ? THREE.TOUCH.ROTATE : -1, TWO: THREE.TOUCH.DOLLY_PAN };
  if (t === 'blick') input.handShown = false;
}
document.querySelectorAll('.tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
document.querySelectorAll('#ctxSculpt button[data-dir]').forEach(b => b.addEventListener('click', () => { input.sculptDir = +b.dataset.dir; document.querySelectorAll('#ctxSculpt button[data-dir]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
function chooseMiracle(m) { input.miracle = m; document.querySelectorAll('#ctxMiracle button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === m))); }
document.querySelectorAll('#ctxMiracle button').forEach(b => b.addEventListener('click', () => chooseMiracle(b.dataset.m)));
$('forestAlert').addEventListener('click', () => {
  const A = forestAlert; if (!A.hut) return;
  setTool('miracle'); chooseMiracle('rain');
  // Kamera zur Lichtung schwenken (Blickwinkel bleibt)
  const dx = A.at.x - controls.target.x, dz = A.at.z - controls.target.z; controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; setFollow(false);
  toast('Tippe in den Ring, um dort Regen zu wirken.', 3);
});
$('wish').addEventListener('click', () => { if (!wish.kind) return; setTool('miracle'); chooseMiracle(wish.kind); toast(wish.kind === 'rain' ? 'Tippe auf den Wald, um Regen zu wirken.' : 'Tippe dorthin, wo die Bewohner arbeiten, um ihnen Eile zu schenken.', 3); });

export { carryGrabbed, handHelp, harvestByHand, helpAt, setTool, updateHand, updateHandHover, updatePointer };
