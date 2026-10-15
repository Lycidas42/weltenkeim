// Eingabe: Werkzeuge, Hilfe der Hand, Zeiger- und Tastaturereignisse, Hand bewegen

import * as THREE from 'three';
import { $, clamp, rnd } from '../core/util.js';
import { PROC, RES, ROLES, S, emit, resText } from '../core/state.js';
import { camera, canvas, controls, tmpV } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { heightAt, seaAt } from '../world/terrain.js';
import { sculpt } from '../world/sculpt.js';
import { spawnChips } from '../world/particles.js';
import { treeKindAt } from '../models/nature.js';
import { heldKind, heldTree, hit, hitOk, holdOff, input, pick, pointerXY, pointers, ray, screenDist, setHoldOff, touchLift } from './pointer.js';
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
import { reinforce } from '../creature/ai.js';

// Ernte mit der Hand Gottes: das Gemüse geht gleich ins Lager
function harvestByHand(f) {
  const C = CROPS[f.c], n = C.yield, y = heightAt(f.x, f.z);
  const r = C.res || 'veg'; S[r] += n; floatText(f.x, y + .5, f.z, `${C.label}: +${resText(r, n)}`, 'h');
  for (let k = 0; k < 6; k++) { const p = farmPt(f.F, f.lx + rnd(FARM.fw / 2), f.lz + rnd(FARM.fd / 2)); spawnChips(p.x, heightAt(p.x, p.z) + .1, p.z, Math.random() * 6.28); }
  if (f.by && f.by.field === f) { const v = f.by; v.field = null; if (v.state === 'harvest' || (v.state === 'walk' && v.next === 'harvest')) idle(v, .3); }
  f.by = null; f.state = 'leer'; f.g = 0; f.c = (f.c + 1) % CROPS.length;
}
// Die Hand hilft bei allem, was die Arbeiter tun: säen, ernten, Vieh füttern, Fische greifen, Wild bannen
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
  // Felder: leer → säen, reif → ernten (wachsen lässt sie nur das Wunder Regen)
  const fl = fieldAt(hit.x, hit.z);
  if (fl) {
    const y = heightAt(fl.x, fl.z), C = CROPS[fl.c];
    const free = () => { if (fl.by && fl.by.field === fl) { const v = fl.by; v.field = null; fl.by = null; if (['sow', 'harvest'].includes(v.state) || (v.state === 'walk' && ['sow', 'harvest'].includes(v.next))) idle(v, .3); } }; // der Bauer muss nicht mehr hin
    if (fl.state === 'reif') return { label: `${C.label} ernten`, pose: 'claw', run() { free(); harvestByHand(fl); } };
    if (fl.state === 'leer') return { label: `${C.label} säen`, pose: 'pinch', run() { free(); fl.state = 'grow'; fl.g = 0; floatText(fl.x, y + .5, fl.z, `${C.label} gesät`, 's'); for (let k = 0; k < 10; k++) { const p = farmPt(fl.F, fl.lx + rnd(FARM.fw / 2), fl.lz + rnd(FARM.fd / 2)); spawnChips(p.x, heightAt(p.x, p.z) + .05, p.z, Math.random() * 6.28); } } };
    // wachsendes Feld: die Hand kann nichts tun, schneller wächst es nur durch das Wunder Regen
    return { label: `${C.label} ${Math.floor(fl.g * 100)} %`, pose: 'relax', run() { toast(`${C.label}: zu ${Math.floor(fl.g * 100)} % gewachsen. Schneller wächst es nur mit dem Wunder Regen.`, 2.5); } };
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
  if (seaAt(hit.x, hit.z)) {
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
  const tip = $('handTip');
  if (heldKind()) { // volle Hand: ein Klick setzt ab (bzw. lässt fallen, wenn kein Boden unter dem Zeiger ist)
    hoverHelp = null;
    const show = input.tool === 'hand' && input.ptrType === 'mouse' && input.primary === null && !input.drop && !ringOpen;
    if (show && (hoverT -= dt) <= 0) { hoverT = .12; const label = foxUnder(pointerXY.x, pointerXY.y) ? '' : pick(pointerXY.x, pointerXY.y) ? 'Absetzen' : 'Fallen lassen'; if (tip.textContent !== label) tip.textContent = label; }
    tip.hidden = !show || !tip.textContent;
    if (!tip.hidden) { const r = canvas.getBoundingClientRect(); tip.style.transform = `translate(${Math.round(pointerXY.x - r.left + 18)}px, ${Math.round(pointerXY.y - r.top + 14)}px)`; }
    return;
  }
  const on = input.tool === 'hand' && input.handShown && input.ptrType === 'mouse' && input.primary === null && !input.grabbed && !heldTree.on && !hoverFox && !ringOpen;
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
// Die Hand ist dort, wo der Zeiger ist – leer wie voll: am Rechner folgt sie dem Mauszeiger, am Handy dem ziehenden
// Finger und bleibt nach dem Anheben dort stehen. Beim Halten merkt sie sich diesen Bildschirmpunkt (input.hold) und
// gleitet bei Kamerabewegung mit über die Welt. Ein Tipp (bzw. Klick) ohne Ziehen setzt ab.
// Packen: Drücken und kurz halten (GRAB_T) oder gleich ziehen; ein kurzer Tipp packt nicht (später: Auswählen).
const TAP_PX = 10, TAP_T = .3, THROW_PX = 700, GRAB_T = .25; // Tipp: kaum bewegt und kurz; Wurf: Wischen schneller als 700 px/s
// mode: 'move' (mit voller Hand angesetzt) oder 'direct'; cand: Bewohner unter dem Finger, der gleich gepackt wird;
// fox: Druck begann auf der Kreatur (Weg in px, Anteil der Bewegungen über ihr) – Geste wird beim Loslassen erkannt
const press = { mode: null, x0: 0, y0: 0, t: 0, moved: false, trail: [], cand: null, fox: null };
// Gesten an der Kreatur (kreatur.md 3.11 B): Tipp = Kreismenü, langsam darüberstreichen = Lob, schnell wischen = Tadel
const PET_T = .4, PET_PX = 40, PET_ON = .6;
const carrying = () => heldKind() && (input.tool === 'hand' || input.tool === 'blick');
function updatePointer(dt) {
  if (input.primary !== null) { // Spur des Fingers in Spielzeit, für Tipp und Wischgeschwindigkeit
    press.t += dt; press.trail.push({ x: pointerXY.x, y: pointerXY.y, t: press.t });
    while (press.trail.length > 2 && press.trail[1].t < press.t - .1) press.trail.shift();
  }
  if (carrying()) {
    const follow = !input.drop && input.tool === 'hand' && (input.ptrType === 'mouse' || press.mode === 'direct' || (press.mode === 'move' && press.moved));
    if (follow) { input.hold.x = pointerXY.x; input.hold.y = pointerXY.y - touchLift(); }
    if (press.mode !== 'direct') holdOff.multiplyScalar(Math.exp(-dt * 5)); // Maus: Gepacktes rutscht nach dem Zupacken unter den Zeiger
    if (!input.drop) pick(input.hold.x, input.hold.y);
  } else if (input.primary !== null || (input.handShown && input.tool !== 'blick')) pick(pointerXY.x, pointerXY.y - touchLift());
  if (input.pressing && input.tool === 'sculpt' && hitOk) sculpt(hit.x, hit.z, input.sculptDir, dt);
  if (press.cand) { // Bewohner unter dem Finger zuckt, bis er gepackt wird
    const v = press.cand;
    if (['grabbed', 'falling', 'sleep'].includes(v.state)) press.cand = null;
    else if (press.t >= GRAB_T || press.moved) { press.cand = null; grab(v); }
    else v.h += Math.sin(press.t * 45) * dt * 5;
  }
}
function grab(v) {
  input.grabbed = v; setHoldOff(v.x, v.z); v.state = 'grabbed';
  if (v.tree) { v.tree.reserved = null; v.tree = null; } if (v.carry) { v.carry = 0; v.drop = null; }
}
// Gehaltener Bewohner hängt unter der Hand
function carryGrabbed() {
  input.heldHidden = !carrying() || !!handAnim.kind; // im Wunder- und Formen-Werkzeug (und während einer Geste) ausgeblendet
  if (input.grabbed) { input.grabbed.hidden = input.heldHidden; input.grabbed.x = hand.g.position.x; input.grabbed.z = hand.g.position.z + .05; input.grabbed.y = hand.g.position.y - .62; } }
// Hand: folgt dem Zeiger, hält, was sie gegriffen hat, und wechselt die Haltung je nach Werkzeug und Ziel
function updateHand(dt, t) {
  if (handAnim.kind) updateHandAnim(dt, t);
  updateHeldBadge();
  const held = carrying(), showHand = !handAnim.kind && (held || (input.tool !== 'blick' && input.handShown && hitOk));
  if (!handAnim.kind) hand.g.visible = showHand;
  if (showHand) {
    // auf dem Bildschirm etwa gleich groß, egal wie weit gezoomt ist
    const hs = clamp(camera.position.distanceTo(hand.g.position) / 25, .42, 1.25); hand.g.scale.setScalar(hs);
    const lift = heldTree.on ? 1.3 + ST * heldTree.g * .95 : input.grabbed ? 1.0 : ((input.pressing && input.tool === 'sculpt') ? .75 : 1.5) * hs;
    if (input.treeGrab) {
      // am Stamm festhalten und zittern, je weiter der Baum nachgibt
      const tr = input.treeGrab.tr, j = input.treeGrab.prog * .05;
      hand.target.set(tr.x + rnd(j), heightAt(tr.x, tr.z) + .95 * tr.g * ST + input.treeGrab.prog * .25, tr.z + rnd(j));
    } else if (input.drop) {
      // Absetzen: zum Punkt gleiten und so weit senken, dass das Gehaltene knapp über dem Boden hängt, dann loslassen
      const D = input.drop, low = input.grabbed ? .7 : .3 + ST * heldTree.g * .95; D.t += dt;
      hand.target.set(D.x, Math.max(heightAt(D.x, D.z), 0) + low, D.z);
      if (hand.shown && (hand.g.position.distanceTo(hand.target) < .06 || D.t > 1.2)) letGo('drop');
    } else if (held) {
      // Gehaltenes (Bewohner, Baum) bleibt beim Zupacken, wo es war, und folgt dann der Fingerbewegung;
      // die Hand hängt senkrecht darüber. Zeigt der Haltepunkt in den Himmel, bleibt die Hand stehen.
      const x = hit.x + holdOff.x, z = hit.z + holdOff.z;
      if (hitOk) hand.target.set(x, Math.max(heightAt(x, z), 0) + lift, z);
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
    const pose = held ? HAND_POSES.hold : input.treeGrab ? HAND_POSES.claw : hoverFox && !input.pressing ? HAND_POSES.flat : hoverHelp && !input.pressing ? HAND_POSES[hoverHelp.pose] || HAND_POSES.relax
      : input.pressing ? (input.tool === 'sculpt' ? (input.sculptDir > 0 ? HAND_POSES.flat : HAND_POSES.fist) : HAND_POSES.grab) : HAND_POSES.relax;
    poseHand(hand, pose, dt, t);
  }
  hand.shown = showHand; hand.pressing = input.pressing;
}
function onToolDown(cx, cy) {
  if (input.tool === 'hand' && heldKind()) { // volle Hand: ziehen bewegt sie, Tipp setzt ab, Kreatur öffnet das Kreismenü
    if (foxUnder(cx, cy)) { openRing(); input.pressing = false; return; }
    press.mode = 'move'; input.pressing = true; return;
  }
  press.mode = 'direct';
  pick(cx, cy); input.handShown = hitOk;
  if (input.tool === 'hand') {
    if (foxUnder(cx, cy)) { press.fox = { dist: 0, n: 1, on: 1, x: cx, y: cy }; input.pressing = false; return; }
    let best = null, bd = 40;
    for (const v of villagers) { if (v.state === 'grabbed' || v.state === 'falling' || v.state === 'sleep') continue; const d = screenDist(v.x, v.y + .25, v.z, cx, cy); if (d < bd) { bd = d; best = v; } }
    if (best) press.cand = best; // gepackt wird nach kurzem Halten oder beim Ziehen (updatePointer)
    else if (!heldTree.on && !handHelp(cx, cy)) { const tr = treeAt(cx, cy); if (tr) input.treeGrab = { tr, prog: 0, lastY: cy }; }
  } else if (input.tool === 'miracle' && hitOk) { tryMiracle(hit); input.pressing = false; return; }
  input.pressing = true;
}
// Finger angehoben: kurzer Tipp mit voller Hand setzt dort ab, schnelles Wischen wirft, sonst hält die Hand weiter
function onToolUp() {
  if (press.fox) { // Druck auf der Kreatur: Wischen tadelt, Streichen lobt, Tippen öffnet das Kreismenü
    const F = press.fox; press.fox = null; input.pressing = false; press.mode = null;
    if (swipeSpeed() > THROW_PX) reinforce('slap');
    else if (F.dist >= PET_PX && press.t >= PET_T && F.on / F.n >= PET_ON) reinforce('pet');
    else if (F.dist < TAP_PX * 2) openRing();
    return;
  }
  if (input.treeGrab) input.treeGrab = null; // losgelassen, bevor der Baum nachgab
  if (press.cand) { const v = press.cand; press.cand = null; floatText(v.x, v.y + .75, v.z, 'Halten zum Aufnehmen', 's'); } // kurzer Tipp auf einen Bewohner
  if (input.tool === 'hand' && heldKind() && press.mode) {
    if (press.mode === 'move' && !press.moved && press.t < TAP_T) setDownAt(press.x0, press.y0);
    else if (swipeSpeed() > THROW_PX) letGo('throw');
  }
  input.pressing = false; press.mode = null;
}
// Zweiter Finger (Zoomen, Verschieben): der Druck endet, ohne dass etwas fällt
function cancelPress() {
  if (input.treeGrab) input.treeGrab = null; press.cand = null; press.fox = null;
  input.pressing = false; press.mode = null;
}
function swipeSpeed() {
  const T = press.trail; if (T.length < 2) return 0;
  const a = T[0], b = T[T.length - 1]; return Math.hypot(b.x - a.x, b.y - a.y) / Math.max(b.t - a.t, 1 / 60);
}
// Absetzen per Tipp: zählt der Punkt unter dem Finger; ohne Bodenpunkt (Himmel) fällt das Gehaltene senkrecht herunter
function setDownAt(cx, cy) {
  if (!pick(cx, cy)) { letGo('fall'); return; }
  input.drop = { x: hit.x, z: hit.z, t: 0 };
}
// Loslassen: 'drop' = sanft abgesetzt, 'fall' = ohne Schwung fallen lassen, 'throw' = mit der Geschwindigkeit der Hand
function letGo(how) {
  const kind = heldKind(); if (!kind) return;
  const n = hand.vel.length(), k = how === 'throw' ? clamp(n, 0, 14) / (n || 1) : 0;
  let what, x, z;
  if (kind === 'villager') {
    const v = what = input.grabbed; input.grabbed = null; v.hidden = false; v.state = 'falling'; x = v.x; z = v.z;
    v.vx = hand.vel.x * k; v.vz = hand.vel.z * k; v.vy = how === 'throw' ? hand.vel.y * .4 * k + 2.5 : 0;
  } else {
    what = heldTree.type; x = heldTree.pos.x; z = heldTree.pos.z;
    if (how === 'throw') throwTree(); else { heldTree.flying = true; heldTree.vel.set(0, 0, 0); heldTree.spin = 0; }
  }
  if (input.drop) { // abgesetzt wird genau am Zielpunkt (auch wenn die Hand ihn noch nicht ganz erreicht hat)
    x = input.drop.x; z = input.drop.z; input.drop = null;
    if (kind === 'villager') { what.x = x; what.z = z; } else { heldTree.pos.x = x; heldTree.pos.z = z; }
  }
  holdOff.set(0, 0, 0);
  if (how === 'throw') emit('handThrow', { kind, what, x, z, vx: hand.vel.x * k, vz: hand.vel.z * k });
  else emit('handDrop', { kind, what, x, z, soft: how === 'drop' });
}
// Symbol am Werkzeugknopf „Hand“: zeigt, was gehalten wird
const HELD_ICON = {
  villager: { label: 'Hand hält einen Bewohner', svg: '<circle cx="12" cy="6.5" r="3.2"/><path d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21z"/>' },
  tree: { label: 'Hand hält einen Baum', svg: '<path d="M12 2.5l6.5 10h-4l3.5 5H6l3.5-5h-4z"/><path d="M12 17.5V22"/>' },
};
let badgeKind = null;
function updateHeldBadge() {
  const kind = heldKind(); if (kind === badgeKind) return; badgeKind = kind;
  const B = $('heldBadge'), btn = B.closest('button'); B.hidden = !kind;
  if (kind) B.innerHTML = `<svg viewBox="0 0 24 24">${HELD_ICON[kind].svg}</svg>`;
  btn.title = kind ? HELD_ICON[kind].label : ''; btn.setAttribute('aria-label', kind ? `Hand (${HELD_ICON[kind].label.slice(10)})` : 'Hand');
}
// Haltezustand für Prüfungen (__wk.holdState)
function holdState() {
  const p = hand.g.position;
  return { kind: heldKind(), hand: { x: p.x, y: p.y, z: p.z, visible: hand.g.visible }, screen: { x: input.hold.x, y: input.hold.y }, dropping: !!input.drop, hidden: input.heldHidden, pressing: input.pressing, badge: !$('heldBadge').hidden };
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
  if (pointers.size > 1) { if (input.primary !== null) { cancelPress(); input.primary = null; } return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (ringOpen) { closeRing(); return; } // Tippen daneben schließt das Kreismenü
  if (input.tool === 'blick') return;
  closeSheets();
  if (input.drop) return; // die Hand setzt gerade ab
  input.primary = e.pointerId; input.ptrType = e.pointerType; pointerXY.x = e.clientX; pointerXY.y = e.clientY;
  Object.assign(press, { x0: e.clientX, y0: e.clientY, t: 0, moved: false, trail: [], fox: null });
  onToolDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && input.tool !== 'blick') { pointerXY.x = e.clientX; pointerXY.y = e.clientY; input.handShown = true; if (input.primary === null) input.ptrType = 'mouse'; }
  if (e.pointerId === input.primary) {
    pointerXY.x = e.clientX; pointerXY.y = e.clientY;
    if (press.fox) { const F = press.fox; F.dist += Math.hypot(e.clientX - F.x, e.clientY - F.y); F.x = e.clientX; F.y = e.clientY; F.n++; F.on += foxUnder(e.clientX, e.clientY); }
    if (!press.moved && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > TAP_PX) press.moved = true;
  }
});
const endPtr = e => { pointers.delete(e.pointerId); if (e.pointerId === input.primary) { input.primary = null; onToolUp(); } };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && input.primary === null) input.handShown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
function setTool(t) {
  if (input.drop && t !== 'hand') letGo('drop'); // ein begonnenes Absetzen wird abgeschlossen
  input.tool = t; // Werkzeugwechsel lässt nichts fallen
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

export { carryGrabbed, handHelp, harvestByHand, helpAt, holdState, setTool, updateHand, updateHandHover, updatePointer };
