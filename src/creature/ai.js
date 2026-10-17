// Verhalten der Kreatur: helfen, spielen, Unfug, tragen, ruhen; Lob und Tadel

import * as THREE from 'three';
import { $, clamp } from '../core/util.js';
import { PROC, ROLES, S, emit, resText, save } from '../core/state.js';
import { clock, scene } from '../core/render.js';
import { addGlaube, addLogs, floatText, toast } from '../ui/feedback.js';
import { streamDist, surfaceAt } from '../world/terrain.js';
import { CREATURES, fox } from './kinds.js';
import { CENTER, LAGER, PLAZA, SHRINE_POS, shrinePt } from '../village/layout.js';
import { FALL_T, addTree, chopTree, fallTree, treeNear, trees } from '../world/trees.js';
import { FARM, farmPt, huts, lager, lagerDrop, localPt } from '../village/huts.js';
import { hutWork } from '../village/build.js';
import { blockedAt, buildNav, followPath, moveFree, navF, navReady, navV, nearBuilding, setGoal } from '../world/nav.js';
import { bushes, rocks } from '../world/nature.js';
import { ROW2, addNewField, farms, fields, newFieldSlot, setReveal } from '../farm/farm.js';
import { scareAway, wild } from '../wildlife/land.js';
import { villagers } from '../village/villagers.js';
import { sites } from '../village/houses.js';
import { ACT_DESC, ACT_LABEL, foxActs, foxAnim, foxMixer, foxOnce, foxPivot, growK, updateMouthTree } from './creature.js';
import { HAND_DUR, handAnim, playHand } from './gestures.js';
import { MILL_BUF, dropLoad, dropRide, hauling, helpLoad, masonYard, startRide } from '../village/ai.js';
import { addWear } from '../world/paths.js';
import { anchor, back, dust, footExtra, gear, over, overOff, seat, shakeOff, tossOnBack, updateBody } from './body.js';
import { leanReasons, noteChoice, noteDone, noteLearn, pickDrive, train, updateMind } from './mind.js';

function foxIdle(t) { dismount(); fox.state = 'idle'; fox.timer = t; fox.idleA = ['idle', 'idle', 'idle2', 'eat'][Math.floor(Math.random() * 4)]; }
function foxWalk(x, z, next) { fox.state = 'walk'; fox.next = next; setGoal(fox, x, z, navF); }
// Tat vollbracht: a = Neigung (help/play/mischief), kind = Tätigkeit für Erfahrung und Gedächtnis (tree/haul/play/mischief)
function foxFinish(a, kind) {
  fox.last = a; fox.lastT = clock.elapsedTime; foxIdle(5 + Math.random() * 4); fox.act = null;
  fox.lastDesc = fox.desc || ACT_DESC[a]; fox.desc = null; noteDone(kind, fox.lastDesc);
  toast(`${S.name} hat ${fox.lastDesc}. Lob oder Tadel?`, 4.5);
  $('btnFox').classList.add('pulse');
  emit('fox');
}
function foxChoose() {
  if (fox.plowRun && fox.plowRun.field) { fox.plowRun.field.reveal = 1; setReveal(fox.plowRun.field); } fox.plowRun = null;
  gear.basket = 0; gear.log = false; gear.cart = false; gear.plow = false; fox.forage = null; fox.dig = null; fox.mouthSack = false; // Reste einer unterbrochenen Tätigkeit
  if (fox.haul || fox.carryGoods) { if (fox.carryGoods) for (const k in fox.carryGoods) S[k] += fox.carryGoods[k]; fox.haul = null; fox.carryGoods = null; back.n = 0; fox.mouthSack = false; } // abgebrochenes Tragen: Waren gehen ins Lager
  // Wahl nach den Antrieben, Ruhe ist der Rest (kreatur.md 3.14); die Gründe kommen ins Gedächtnis (mind.js), damit der
  // Spieler nachvollziehen kann, warum
  let a = pickDrive(true);
  const why = leanReasons(a);
  if (a === 'rest') {
    if (!foxActs.lie) { noteChoice('rest', 'rest', 'eine Weile stehen und schauen', why); foxIdle(6 + Math.random() * 6); return; }
    // zum Dösen erst dorthin, wo der ganze liegende Körper Platz hat
    noteChoice('rest', 'rest', 'ausruhen', why);
    const p = restSpot(); if (Math.hypot(p.x - fox.x, p.z - fox.z) > .15) { foxWalk(p.x, p.z, 'rest'); return; }
    fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); return;
  }
  if (a === 'help') { // Hilfen mit dem eigenen Körper, je nach Gestalt (kreatur.md 3.13 A, D)
    const H = CREATURES[fox.kind].acts.help, can = k => H.includes(k), r2 = Math.random();
    const hare = can('pest') && wild.find(h => h.state === 'nibble');
    if (hare && Math.random() < .8) { foxChaseGo(hare, why); return; } // ein Hase knabbert am Feld: verscheuchen
    if (can('sweep') && r2 < .1) { foxSweepGo(why); return; } // den Platz am Schrein fegen
    if (can('plant') && r2 < .22 && foxPlantGo(why)) return; // einen Setzling eingraben
    if (can('forage') && r2 < .36 && foxForageGo(why)) return; // Pilze suchen
    if (can('plow') && r2 < .3 && foxPlowGo(why)) return; // ein neues Feld pflügen
    if (can('transplant') && r2 > .22 && r2 < .4 && foxTransplantGo(why)) return; // einen jungen Baum umsetzen
    const night = S.hour >= 20 || S.hour < 6;
    if (can('patrol') && (night ? r2 < .6 : r2 > .9) && foxPatrolGo(why)) return; // Wache um das Dorf
    if (can('escort') && r2 > .6 && r2 < .8 && foxEscortGo(why)) return; // einen Bewohner begleiten
    if (can('rock') && (r2 > .9 || (r2 > .72 && masonYard())) && foxRockGo(why)) return; // einen Felsen wegschieben, mit Steinmetz öfter (er braucht Felsen)
  }
  if (a === 'help' && Math.random() < .55 && foxHaul()) { // Waren von einer Hütte ins Lager tragen
    const H = fox.haul, hut = ROLES[H.hut.role].hut;
    noteChoice('help', 'haul', H.supply ? `Nachschub zur ${hut} tragen` : `Waren der ${hut} ins Lager tragen`,
      [...why, { key: 'goods', label: H.supply ? `die ${hut} braucht Nachschub` : `an der ${hut} warten Waren`, weight: 1 }]);
    fox.act = 'help'; return;
  }
  if (a !== 'play') {
    let best = null, bd = 1e9;
    for (const t of trees) { if (!t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - fox.x) ** 2 + (t.z - fox.z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) { a = 'play'; why.push({ key: 'noTree', label: 'kein großer Baum frei, also lieber spielen', weight: 1 }); }
    else { fox.tree = best; best.reserved = 'fox'; const ang = Math.atan2(fox.x - best.x, fox.z - best.z); foxWalk(best.x + Math.sin(ang) * .9, best.z + Math.cos(ang) * .9, 'tree'); }
  }
  fox.act = a;
  if (a === 'play') { fox.pc = playSpot(); foxWalk(fox.pc.x - (fox.pc.r || 1.6), fox.pc.z, 'play'); noteChoice('play', 'play', 'mit dem Dorf spielen', why); }
  else noteChoice(a, a === 'help' ? 'tree' : 'mischief', a === 'help' ? 'Holz fürs Dorf holen' : 'einen Baum umwerfen', why);
}
// Tragen: Hütte mit wartenden Waren suchen, bis zu 3 Stück auf einmal (die meisten zuerst), ins Lager bringen
// Allein trägt sie 3 Stück (eins nach dem anderen ins Maul und auf den Rücken geworfen), belädt sie ein Bewohner, 5.
// Wie viel sie trägt, steht je Gestalt in kinds.js (acts.self, acts.load); Satteltaschen +2, Karren +5
const FOX_CARRY = 3;
const selfCap = () => { const A = CREATURES[fox.kind].acts; return A.toss ? A.self + (S.cGear.bags ? 2 : 0) : 0; };
const loadCap = () => { const A = CREATURES[fox.kind].acts; return A.load + (S.cGear.cart ? 5 : 0); };
function foxHaul() {
  let best = null, bs = 0;
  for (const h of huts) {
    const take = {}; let n = 0;
    const avail = Object.keys(h.goods).map(k => [k, Math.floor(h.goods[k] - hauling(h, 'pick', k))]).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]);
    for (const [k, a] of avail) { const t = Math.min(a, loadCap() - n); if (t > 0) { take[k] = t; n += t; } }
    if (n < 2) continue;
    const score = n * 10 - Math.hypot(h.x - fox.x, h.z - fox.z); if (score > bs || !best) { bs = score; best = { hut: h, take, n }; }
  }
  // oder Nachschub aus dem Lager zu einer Werkstatt (Stämme zur Säge, Korn zur Mühle, Mehl zur Bäckerei)
  let sup = null, ss = 0;
  for (const h of huts) {
    const P = PROC[h.role], res = h.role === 'sawyer' ? 'logs' : P && P.inp; if (!res) continue;
    const have = h.role === 'sawyer' ? h.logs : h.inp, room = (h.role === 'sawyer' ? MILL_BUF : P.buf) - have - hauling(h, h.role === 'sawyer' ? 'in' : 'feed');
    if (res !== 'logs' && !CREATURES[fox.kind].acts.toss) continue; // Säcke kann sie nicht selbst aufladen
    const n = Math.min(FOX_CARRY, room, Math.floor(S[res])); if (n < 2) continue;
    const score = n * 10 + (have === 0 ? 15 : 0) - Math.hypot(h.x - LAGER.x, h.z - LAGER.z) * .5; if (score > ss || !sup) { ss = score; sup = { hut: h, res, n }; }
  }
  if (sup && (!best || ss > bs)) { fox.haul = { hut: sup.hut, supply: sup.res, n: sup.n }; const p = lagerDrop(); foxWalk(p.x, p.z, 'haulLager'); return true; }
  if (!best) return false;
  fox.haul = best; const p = hutWork(best.hut); foxWalk(p.x, p.z, 'haulPick'); return true;
}
// Hirsch: einen jungen Baum aus dichtem Wald ausgraben und an einer freien Stelle am Waldrand wieder einsetzen
function foxTransplantGo(why = []) {
  const near = (t, r) => trees.filter(o => o !== t && o.alive && !o.gone && Math.hypot(o.x - t.x, o.z - t.z) < r).length;
  const t = trees.filter(t => t.alive && !t.gone && !t.reserved && t.g > .12 && t.g < .55 && Math.hypot(t.x - fox.x, t.z - fox.z) < 20 && near(t, 1.6) >= 2)
    .sort((a, b) => Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z))[0];
  if (!t) return false; if (!navReady) buildNav(); const P = plantSpot(); if (!P) return false;
  t.reserved = 'fox'; fox.trans = { t, to: P }; fox.act = 'help';
  const a = Math.atan2(fox.x - t.x, fox.z - t.z); foxWalk(t.x + Math.sin(a) * .9, t.z + Math.cos(a) * .9, 'uproot');
  noteChoice('help', 'transplant', 'einen jungen Baum umsetzen', [...why, { key: 'forest', label: 'im dichten Wald hat der junge Baum keinen Platz', weight: .6 }]); return true;
}
// Wolf: nachts eine Runde um das Dorf, an jedem Punkt wachen; Wild in der Nähe flieht
function foxPatrolGo(why = []) {
  if (!navReady) buildNav();
  const pts = sites.filter(s => s.used).map(s => { const a = Math.atan2(s.z - CENTER.z, s.x - CENTER.x); return { a, x: s.x + Math.cos(a) * 2.6, z: s.z + Math.sin(a) * 2.6 }; })
    .filter(p => !blockedAt(navF, p.x, p.z)).sort((p, q) => p.a - q.a);
  if (pts.length < 2) return false;
  const step = Math.max(1, Math.floor(pts.length / 4)), route = pts.filter((_, i) => i % step === 0).slice(0, 4);
  fox.patrol = { pts: route, i: 0 }; fox.act = 'help'; foxWalk(route[0].x, route[0].z, 'patrolPt');
  noteChoice('help', 'patrol', 'Wache um das Dorf laufen', [...why, { key: 'night', label: S.hour >= 20 || S.hour < 6 ? 'es ist Nacht, das Dorf schläft' : 'ein Wolf schaut nach dem Rechten', weight: .6 }]); return true;
}
// Wolf: einen Bewohner auf dem Weg begleiten; im Rudel geht es schneller (Eile)
function foxEscortGo(why = []) {
  const v = villagers.filter(v => v.state === 'walk' && !v.load && Math.hypot(v.x - fox.x, v.z - fox.z) < 16).sort((a, b) => Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z))[0];
  if (!v) return false;
  fox.esc = { v, t: 10, met: false }; fox.state = 'escort'; fox.act = 'help'; fox.chaseT = 0;
  noteChoice('help', 'escort', 'einen Bewohner begleiten', [...why, { key: 'pack', label: 'im Rudel geht es leichter', weight: .6 }]); return true;
}
// Wer belädt die Kreatur? Am liebsten jemand aus der Hütte, der gerade nichts trägt; sonst ein freier Bewohner in der Nähe.
// any: im Test notfalls irgendwer, der wach ist
function loadHelper(hut, any = false) {
  let best = null, bd = 1e9;
  for (const v of villagers) {
    const free = !v.carry && !v.haul && !v.load && !v.gift && (v.state === 'idle' || v.state === 'proc' || (v.state === 'walk' && !['sleep', 'lunch', 'pray', 'gift', 'giftPick'].includes(v.next)));
    if (!free && !(any && !['sleep', 'grabbed', 'falling', 'loadFox', 'dying'].includes(v.state))) continue;
    const d = Math.hypot(v.x - fox.x, v.z - fox.z) - (v.hut === hut ? 6 : 0); if (d < bd && d < (any ? 40 : 10)) { bd = d; best = v; }
  }
  return best;
}
// Ein Bewohner belädt die Kreatur: Sie legt sich vor die Hütte, er hebt Stück für Stück auf ihren Rücken
const vHand = new THREE.Vector3();
function startLoad(v, units, take) {
  const C = CREATURES[fox.kind], sx = Math.cos(fox.h), sz = -Math.sin(fox.h), r = C.h * .5, withCart = !!S.cGear.cart;
  fox.state = 'waitLoad'; fox.timer = 25; fox.loadDone = false; fox.loader = v; fox.signalT = 1.4; // wedelt: „lad auf“
  gear.cart = withCart; if (!withCart) foxOnce('lieDown');
  const bx = withCart ? fox.x - Math.sin(fox.h) * C.h * 1.15 : fox.x, bz = withCart ? fox.z - Math.cos(fox.h) * C.h * 1.15 : fox.z; // wo die Last hinkommt
  helpLoad(v, {
    x: bx + sx * r * (withCart ? 1.1 : 1), z: bz + sz * r * (withCart ? 1.1 : 1), fx: bx, fz: bz, n: units.length, res: units[0],
    onItem: () => { const k = units.shift(); if (k && take(k)) { fox.carryGoods[k] = (fox.carryGoods[k] || 0) + 1; tossOnBack(null, vHand.set(v.x, v.y + .5, v.z), k); } },
    onDone: () => { fox.loadDone = true; fox.loader = null; }, onAbort: () => { fox.loadDone = true; fox.loader = null; },
  });
}
// Allein: Ware ins Maul, mit einem Kopfwurf auf den Rücken, bis alles oben liegt
const TOSS_T = 1.25;
function startToss(units, take) { fox.state = 'toss'; fox.timer = TOSS_T; fox.units = units; fox.unitTake = take; }
// aufgeladen: los zum Ziel (nichts bekommen: aufgeben)
function haulOn() {
  const g = fox.carryGoods || {}, n = Object.values(g).reduce((a, b) => a + b, 0);
  if (!n) { fox.carryGoods = null; fox.haul = null; back.n = 0; foxIdle(1); return; }
  fox.state = 'haulUp'; fox.timer = .35;
}
// Fegen: zum Schrein laufen und den Platz davor mit dem Schwanz fegen
function foxSweepGo(why = []) {
  const p = shrinePt((Math.random() - .5) * 1.2, 2.9); fox.act = 'help'; foxWalk(p.x, p.z, 'sweep');
  noteChoice('help', 'sweep', 'den Platz am Schrein fegen', [...why, { key: 'shrine', label: 'vor dem Schrein liegt Laub', weight: .5 }]);
}
const sw = new THREE.Vector3();
// Pfoten: einen Setzling an den Waldrand pflanzen. Platz wie beim Regenwunder: nicht im Dorf, am Bach, auf Wegen
function plantSpot() {
  const big = trees.filter(t => t.alive && !t.gone && t.g > .5 && Math.hypot(t.x - fox.x, t.z - fox.z) < 22);
  for (let k = 0; k < 50 && big.length; k++) {
    const t = big[Math.floor(Math.random() * big.length)], a = Math.random() * 6.28, r = 1.4 + Math.random() * 1.4, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r, h = surfaceAt(x, z);
    if (h < .4 || h > 3.4 || Math.hypot(x, z) < 8.5 || treeNear(x, z, .9) || streamDist(x, z) < 1 || nearBuilding(x, z, .6) || blockedAt(navV, x, z)) continue;
    return { x, z };
  }
  return null;
}
function foxPlantGo(why = []) {
  if (!navReady) buildNav(); const P = plantSpot(); if (!P) return false;
  const a = Math.atan2(fox.x - P.x, fox.z - P.z); fox.dig = P; fox.act = 'help'; foxWalk(P.x + Math.sin(a) * .75, P.z + Math.cos(a) * .75, 'dig');
  noteChoice('help', 'plant', 'einen Setzling eingraben', [...why, { key: 'forest', label: 'am Waldrand ist Platz für einen Baum', weight: .5 }]); return true;
}
// Finden und bringen: an Büschen im Wald nach Pilzen schnuppern (mit Korb an bis zu 3 Büschen)
function pickBush() {
  const near = bushes.filter(b => !(fox.forage && fox.forage.seen.includes(b)) && Math.hypot(b.x - fox.x, b.z - fox.z) < 14 && Math.hypot(b.x, b.z) > 8 && treeNear(b.x, b.z, 2.5));
  const b = near[Math.floor(Math.random() * near.length)]; if (b && fox.forage) fox.forage.seen.push(b); return b || null;
}
function foxForageGo(why = []) {
  fox.forage = { left: S.cGear.basket ? 3 : 1, found: 0, seen: [] }; const b = pickBush(); if (!b) { fox.forage = null; return false; }
  if (S.cGear.basket) gear.basket = 1; // leerer Korb im Maul
  const a = Math.atan2(fox.x - b.x, fox.z - b.z); fox.bush = b; fox.act = 'help'; foxWalk(b.x + Math.sin(a) * .9, b.z + Math.cos(a) * .9, 'sniff');
  noteChoice('help', 'forage', S.cGear.basket ? 'mit dem Korb Pilze suchen' : 'nach Pilzen schnuppern', [...why, { key: 'nose', label: 'Füchse finden, was andere übersehen', weight: .5 }]); return true;
}
// Schädlinge: einem Hasen nachrennen, der am Feld knabbert
function foxChaseGo(h, why = []) {
  fox.prey = h; fox.state = 'chase'; fox.timer = 20; fox.act = 'help'; fox.chaseT = 0;
  noteChoice('help', 'pest', 'den Hasen vom Feld jagen', [...why, { key: 'pest', label: 'ein Hase knabbert am Feld', weight: 1 }]);
}
// Reiten: ein freier Bewohner in der Nähe steigt beim Spielen auf den Rücken
// so viele, wie Plätze da sind (Stier: zwei)
function mount(force) {
  const n = CREATURES[fox.kind].acts.riders, list = villagers.filter(v => !v.carry && !v.load && !v.haul && (v.state === 'idle' || v.state === 'walk' || (force && !['sleep', 'grabbed', 'falling', 'ride', 'dying'].includes(v.state))))
    .map(v => ({ v, d: Math.hypot(v.x - fox.x, v.z - fox.z) })).filter(e => e.d < (force ? 40 : 10)).sort((a, b) => a.d - b.d).slice(0, n);
  if (!list.length) return; fox.riders = list.map(e => e.v); fox.rider = fox.riders[0];
  fox.riders.forEach((v, i) => startRide(v, out => { seat(i, n, out); return fox.vh; }));
  floatText(fox.x, foxPivot.position.y + CREATURES[fox.kind].h + .3, fox.z, 'Juhu!', 's');
}
function dismount() {
  if (!fox.riders) return; const L = fox.riders; fox.riders = null; fox.rider = null;
  L.forEach((v, i) => { const s = i ? -1 : 1; dropRide(v, fox.x + Math.cos(fox.vh || 0) * .8 * s, fox.z - Math.sin(fox.vh || 0) * .8 * s); });
}
// Pflügen (Stier): ein neues Feld in der zweiten Reihe eines Hofs anlegen (höchstens 8 Felder je Hof). Er pflügt von
// der äußeren Kante zum Hof hin; das Feld entsteht hinter dem Pflug. Felsen auf dem Platz verhindern das (Felsen schieben)
function foxPlowGo(why = []) {
  const C = CREATURES[fox.kind], rockOn = (x, z) => rocks.some(r => Math.hypot(r.x - x, r.z - z) < r.s + .35);
  const F = farms.filter(F => newFieldSlot(F, rockOn)).sort((a, b) => Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z))[0];
  if (!F) { // kein freier Platz: liegt auf einem Feldplatz ein Felsen, schiebt er ihn zuerst weg (werkstaetten.md 2)
    for (const G of farms) { const sl = newFieldSlot(G); if (!sl) continue; const c = farmPt(G, sl.lx, sl.lz);
      const r = rocks.filter(r => Math.hypot(r.x - c.x, r.z - c.z) < r.s + 1.6).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
      if (r && foxRockGo([...why, { key: 'field', label: 'ein Felsen liegt dort, wo ein neues Feld hin soll', weight: .7 }], r, c)) return true; }
    return false;
  }
  const slot = newFieldSlot(F, rockOn), z0 = slot.lz - FARM.fd / 2 - .25; // Kopf an der äußeren Kante
  fox.plowRun = { F, lx: slot.lx, z: z0 - C.h * .45, phase: 'align', field: null };
  const p = farmPt(F, slot.lx, fox.plowRun.z - C.h * .4); fox.act = 'help'; foxWalk(p.x, p.z, 'plow');
  noteChoice('help', 'plow', 'ein neues Feld pflügen', [...why, { key: 'field', label: 'der Hof hat Platz für ein weiteres Feld', weight: .6 }]); return true;
}
// Felsen wegschieben (Stier): mit dem Kopf ein Stück vom Dorf weg
function foxRockGo(why = [], only = null, from = null) {
  if (!navReady) buildNav(); const C = CREATURES[fox.kind];
  if (!only && foxRockToMason(why)) return true;
  // Felsen mittlerer Größe in der Nähe, nächster zuerst; schieben vom Dorf weg. Der Platz dahinter muss erreichbar sein
  const list = only ? [only] : rocks.filter(r => r.s > .25 && r.s < .8 && Math.hypot(r.x - fox.x, r.z - fox.z) < 16).sort((a, b) => Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z));
  let r = null, dx = 0, dz = 0, gap = 0;
  for (const c of list) {
    const o = from || CENTER; let ux = c.x - o.x, uz = c.z - o.z; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; // vom Dorf (bzw. vom Feldplatz) weg
    const g = c.s * .85 + C.h * .48, bx = c.x - ux * g, bz = c.z - uz * g; // Felsen liegt an der Stirn an (Kopf eingezogen)
    if (blockedAt(navF, bx, bz) || blockedAt(navF, bx - ux * C.h * .5, bz - uz * C.h * .5)) continue;
    r = c; dx = ux; dz = uz; gap = g; break;
  }
  if (!r) return false;
  fox.rockJob = { r, dx, dz, gap, left: only ? Math.max(1.5, 1.8 + r.s - Math.hypot(r.x - from.x, r.z - from.z)) : 3 }; // vom Feldplatz: bis er ihn frei gibt
  fox.act = 'help'; foxWalk(r.x - dx * gap, r.z - dz * gap, 'shove');
  noteChoice('help', 'rock', 'einen Felsen wegschieben', [...why, { key: 'strong', label: 'ein Stier ist stark genug dafür', weight: .5 }]); return true;
}
// Gibt es eine Steinmetzhütte, schiebt der Stier einen Felsen den ganzen Weg bis neben die Hütte (werkstaetten.md 1 E):
// erst hinter den Felsen, dann folgt er dem Weg, der Felsen bleibt vor der Stirn
function foxRockToMason(why) {
  const C = CREATURES[fox.kind], list = rocks.filter(r => r.s > .25 && r.s < .8 && !r.atMason && !r.moving && !(r.by && villagers.includes(r.by) && r.by.rock === r) && Math.hypot(r.x - fox.x, r.z - fox.z) < 18)
    .sort((a, b) => Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z));
  for (const r of list) {
    const Y = masonYard(r.s); if (!Y || Math.hypot(Y.x - r.x, Y.z - r.z) > 24 || Math.hypot(Y.x - r.x, Y.z - r.z) < 1.5) continue;
    let ux = Y.x - r.x, uz = Y.z - r.z; const l = Math.hypot(ux, uz); ux /= l; uz /= l;
    const g = r.s * .85 + C.h * .48, bx = r.x - ux * g, bz = r.z - uz * g;
    if (blockedAt(navF, bx, bz)) continue;
    fox.rockJob = { r, dx: ux, dz: uz, gap: g, left: 0, to: { x: Y.x, z: Y.z }, hut: Y.hut, stuck: 0 };
    fox.act = 'help'; foxWalk(bx, bz, 'shove');
    noteChoice('help', 'rock', 'einen Felsen zum Steinmetz schieben', [...why, { key: 'mason', label: 'der Steinmetz braucht Felsen', weight: .6 }, { key: 'strong', label: 'ein Stier ist stark genug dafür', weight: .5 }]);
    return true;
  }
  return false;
}
// abgeschüttelt: Waren in die Werkstatt bzw. ins Lager
function unload() {
  gear.cart = false; gear.log = false;
  if (fox.unload === 'haulDeliver') {
    const H = fox.haul, g = fox.carryGoods || {}, k = Object.keys(g)[0], n = k ? g[k] : 0;
    if (H && huts.includes(H.hut) && n) { if (H.hut.role === 'sawyer') H.hut.logs += n; else H.hut.inp += n; } else if (k) S[k] += n; // Werkstatt weg: zurück ins Lager
    floatText(fox.x, foxPivot.position.y + CREATURES[fox.kind].h, fox.z, `${resText(k, n)} abgeladen`, 'h');
    fox.carryGoods = null; fox.haul = null; fox.desc = `${resText(k, n)} zur ${H ? ROLES[H.hut.role].hut : 'Werkstatt'} ${fox.pushed ? 'gerollt' : 'getragen'}`; fox.pushed = false; foxFinish('help', 'haul');
  } else {
    const g = fox.carryGoods || {}, out = [];
    for (const k in g) { if (k === 'logs') S.logs += g[k]; else S[k] += g[k]; out.push(resText(k, g[k])); }
    floatText(fox.x, foxPivot.position.y + CREATURES[fox.kind].h, fox.z, `+${out.join(', ')}`, 'h');
    fox.carryGoods = null; fox.haul = null; fox.desc = `${out.join(', ')} ins Lager getragen`; foxFinish('help', 'haul');
  }
}
// Liegeplatz: rundum frei im Umkreis der halben Körperlänge (Gebäude, Bäume, Felsen, Wasser)
function restSpot(k = .5) { // k: freier Umkreis in Tierhöhen (Liegen .5, Aufladen mit erhobenem Kopf mehr)
  if (!navReady) buildNav();
  // Platz: rundum frei (Gebäude, Bäume, Felsen, Wasser) und möglichst eben, sonst liegt das Tier schief am Hang
  const R = CREATURES[fox.kind].h * k, room = (x, z) => { if (blockedAt(navV, x, z)) return false; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (blockedAt(navV, x + Math.cos(a) * R, z + Math.sin(a) * R) || blockedAt(navV, x + Math.cos(a) * R * .5, z + Math.sin(a) * R * .5)) return false; } return true; };
  const slope = (x, z) => Math.abs(surfaceAt(x + R, z) - surfaceAt(x - R, z)) + Math.abs(surfaceAt(x, z + R) - surfaceAt(x, z - R));
  let best = null, bs = 1e9;
  for (let r = 0; r < 8 && !(best && bs < R * .25); r += .5) for (let k = 0; k < (r ? 16 : 1); k++) {
    const a = k / 16 * Math.PI * 2, x = fox.x + Math.cos(a) * r, z = fox.z + Math.sin(a) * r; if (!room(x, z)) continue;
    const sc = slope(x, z) + r * .05; if (sc < bs) { bs = sc; best = { x, z }; } // lieber eben, aber nicht weit weg
  }
  return best || { x: fox.x, z: fox.z };
}
// freier Spielplatz: ein Kreis (Radius 1,6) nahe der Dorfmitte, auf dem nichts im Weg steht
// Spielen: um die Dorflinde herum
const PLAY_R = 1.65; // der Brunnen steht etwa 2,6 von der Linde entfernt
function playSpot() {
  if (!navReady) buildNav();
  if (PLAZA) return { x: PLAZA.x, z: PLAZA.z, r: PLAY_R };
  const free = (x, z) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (blockedAt(navF, x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6)) return false; } return true; };
  for (let r = 0; r < 9; r += .75) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + r, x = CENTER.x + Math.cos(a) * r, z = CENTER.z + Math.sin(a) * r; if (free(x, z)) return { x, z }; }
  return CENTER;
}
function updateFox(dt, t) {
  updateMind(dt);
  const C = CREATURES[fox.kind], drag = fox.carry && (C.acts.tree === 'drag' || C.acts.tree === 'push'), spd = C.walk * (drag ? .7 : fox.carry && C.acts.tree === 'horns' ? .85 : gear.log ? .75 : gear.cart ? .8 : 1);
  // eine laufende Einmal-Animation (Lob/Tadel) nicht vom Zustand überschreiben lassen
  const anim = n => { if (fox.once <= 0) foxAnim(n); };
  if (fox.once > 0) fox.once -= dt;
  // Während einer Geste der Hand oder einer Einmal-Animation (Reaktion, Aufstehen, Wunder) bewegt sich das Tier
  // nicht und wechselt nicht die Pose; so gleitet es nie in einer falschen Haltung über den Boden.
  if (!handAnim.kind && fox.once <= 0) switch (fox.state) {
    case 'idle': anim(fox.idleA); fox.timer -= dt; if (fox.timer <= 0) foxChoose(); break;
    case 'rest': anim('lie'); fox.timer -= dt; if (fox.timer <= 0) { foxOnce('standUp'); foxIdle(.4); } break;
    case 'cast': fox.timer -= dt; if (fox.timer <= 0) foxIdle(1.5); break;
    case 'haulUp': anim(fox.timer > .4 ? 'eat' : 'idle'); fox.timer -= dt; if (fox.timer <= 0) { if (fox.haul && fox.haul.supply) { const p = hutWork(fox.haul.hut); foxWalk(p.x, p.z, 'haulDeliver'); } else { const p = localPt(lager, .2, 1.9); foxWalk(p.x, p.z, 'haulStore'); } } break;
    case 'pickup': anim(fox.timer < .85 ? 'eat' : 'idle'); fox.timer -= dt; if (fox.timer <= 0) { fox.carry = true; const p = localPt(lager, -.4, 1.9); foxWalk(p.x, p.z, 'store'); } break;
    case 'walk': anim('walk'); if (followPath(fox, spd * dt)) {
      if (fox.next === 'tree') { if (fox.tree && fox.tree.alive) { fox.state = 'work'; fox.timer = fox.act === 'help' ? 1.8 : 1.1; fox.h = Math.atan2(fox.tree.x - fox.x, fox.tree.z - fox.z); } else { if (fox.tree) fox.tree.reserved = null; foxIdle(1); } }
      else if (fox.next === 'store') {
        // Baum ablegen: er liegt kurz vor dem Lager und wird zu Stämmen
        const C = CREATURES[fox.kind]; fallTree({ type: fox.carryType || 0, g: .55 * C.h / 1.45, x: fox.x + Math.sin(fox.h) * C.h * .25, z: fox.z + Math.cos(fox.h) * C.h * .25 }, fox.x + Math.cos(fox.h), fox.z - Math.sin(fox.h), 1.3, true);
        addLogs(Math.max(2, Math.round(4 * growK())), fox.x, 1.2, fox.z); fox.carry = false; foxFinish('help', 'tree'); // kleiner Baum, weniger Holz
      }
      else if (fox.next === 'haulPick') { // Waren aufnehmen: ein Bewohner der Hütte belädt sie, sonst wirft sie sie selbst auf den Rücken
        const H = fox.haul;
        if (!H || !huts.includes(H.hut)) { fox.haul = null; foxIdle(1); }
        else {
          fox.h = Math.atan2(H.hut.x - fox.x, H.hut.z - fox.z);
          const helper = fox.haulMode === 'self' ? null : loadHelper(H.hut, fox.haulMode === 'any' || !CREATURES[fox.kind].acts.toss), cap = helper ? loadCap() : selfCap(), units = [];
          for (const k in H.take) for (let i = 0; i < H.take[k] && units.length < cap; i++) units.push(k);
          const take = k => { if ((H.hut.goods[k] || 0) < 1) return false; H.hut.goods[k]--; return true; };
          fox.carryGoods = {}; fox.haulMode = null;
          if (helper) startLoad(helper, units, take); else startToss(units, take);
        }
      }
      else if (fox.next === 'haulLager') { // Nachschub im Lager aufnehmen (selbst aufladen)
        const H = fox.haul, n = H ? Math.min(H.n, Math.floor(S[H.supply])) : 0;
        if (!n || !huts.includes(H.hut)) { fox.haul = null; foxIdle(1); }
        else if (H.supply === 'logs') { S.logs -= n; fox.carryGoods = { logs: n }; gear.log = true; fox.pushed = true; gear.roll = 0; fox.state = 'haulUp'; fox.timer = .35; } // Stämme rollt sie mit dem Kopf (ein Stamm steht für alle)
        else { fox.h = Math.atan2(LAGER.x - fox.x, LAGER.z - fox.z); fox.carryGoods = {}; startToss(Array(n).fill(H.supply), k => { if (S[k] < 1) return false; S[k]--; return true; }); }
      }
      else if (fox.next === 'haulDeliver' && gear.log) { fox.state = 'nudge'; fox.timer = .8; fox.unload = fox.next; } // den Stamm an die Säge stupsen
      else if (fox.next === 'haulDeliver' || fox.next === 'haulStore') { fox.state = 'shake'; fox.timer = 1.1; fox.unload = fox.next; shakeOff(); } // abschütteln bzw. Karren auskippen, dann abrechnen
      else if (fox.next === 'sweep') { fox.state = 'sweep'; fox.timer = 4.5; fox.sweepT = 0; }
      else if (fox.next === 'plow') { if (fox.plowRun) { fox.state = 'plow'; fox.plowRun.x = fox.plowRun.x0; gear.plow = true; } else foxIdle(1); }
      else if (fox.next === 'shove') { const J = fox.rockJob; if (J) { fox.state = 'shove'; fox.h = Math.atan2(J.dx, J.dz); fox.timer = .6; } else foxIdle(1); }
      else if (fox.next === 'uproot') { const T = fox.trans; if (T && !T.t.gone && T.t.alive) { fox.state = 'uproot'; fox.timer = 1.4; fox.h = Math.atan2(T.t.x - fox.x, T.t.z - fox.z); } else { if (T) T.t.reserved = null; fox.trans = null; foxIdle(1); } }
      else if (fox.next === 'replant') { // den Baum wieder einsetzen
        const T = fox.trans; fox.carry = false; const g = fox.carryG || .2; fox.carryG = 0;
        if (T) { const nt = addTree(T.to.x, T.to.z, g); for (let i = 0; i < 8; i++) dust(T.to.x, surfaceAt(T.to.x, T.to.z) + .03, T.to.z, 1, .4); if (nt) floatText(T.to.x, surfaceAt(T.to.x, T.to.z) + 1, T.to.z, 'Baum umgesetzt', 's'); }
        fox.trans = null; fox.desc = 'einen jungen Baum umgesetzt'; foxFinish('help', 'transplant');
      }
      else if (fox.next === 'patrolPt') { fox.state = 'watch'; fox.timer = 1.8; }
      else if (fox.next === 'dig') { if (fox.dig) { fox.state = 'dig'; fox.timer = 2.8; fox.h = Math.atan2(fox.dig.x - fox.x, fox.dig.z - fox.z); } else foxIdle(1); }
      else if (fox.next === 'sniff') { fox.state = 'sniff'; fox.timer = 1.8; if (fox.bush) fox.h = Math.atan2(fox.bush.x - fox.x, fox.bush.z - fox.z); }
      else if (fox.next === 'forageStore') {
        const n = fox.forage ? fox.forage.found : 0; S.veg += n; gear.basket = 0; fox.mouthSack = false; fox.forage = null;
        floatText(fox.x, foxPivot.position.y + C.h, fox.z, `+${n} ${n === 1 ? 'Pilz' : 'Pilze'} (Gemüse)`, 'h');
        fox.desc = `${n} ${n === 1 ? 'Pilz' : 'Pilze'} gefunden und ins Lager gebracht`; foxFinish('help', 'forage');
      }
      else if (fox.next === 'shrine') { // am Schrein angekommen: im Licht die neue Gestalt annehmen
        fox.h = Math.atan2(SHRINE_POS.x - fox.x, SHRINE_POS.z - fox.z); glowT = GLOW_T; fox.state = 'cast'; fox.timer = GLOW_T; if (foxActs.cast) foxOnce('cast'); else fox.hop = .5;
        const id = fox.morph; fox.morph = null; noteDone('shrine', `am Schrein die Gestalt ${CREATURES[id].label} angenommen`); emit('foxTransform', id);
      }
      else if (fox.next === 'rest') { fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); }
      else if (fox.next === 'play') { fox.state = 'play'; fox.playT = 0; fox.playDir = Math.random() < .5 ? 1 : -1; fox.jumpT = .8; fox.playA = Math.atan2(fox.z - fox.pc.z, fox.x - fox.pc.x); if (fox.wantRider || Math.random() < .5) mount(fox.wantRider); fox.wantRider = false; }
    } break;
    case 'toss': { // Ware ins Maul nehmen (Fressen-Bewegung), mit einem Kopfwurf auf den Rücken
      anim(fox.timer > .55 ? 'eat' : 'idle'); const before = fox.timer; fox.timer -= dt;
      if (before > .9 && fox.timer <= .9) { const k = fox.units[0]; if (k && fox.unitTake(k)) fox.mouthSack = true; else fox.units.length = 0; }
      if (before > .45 && fox.timer <= .45 && fox.mouthSack) { fox.mouthSack = false; const k = fox.units.shift(); fox.carryGoods[k] = (fox.carryGoods[k] || 0) + 1; tossOnBack(null, null, k); }
      if (fox.timer <= 0) { if (fox.units.length) fox.timer = TOSS_T; else haulOn(); }
      break;
    }
    case 'waitLoad': // liegt (bzw. steht im Geschirr), bis der Bewohner fertig ist
      anim(gear.cart ? 'idle' : 'lie'); fox.timer -= dt;
      if (fox.loadDone || fox.timer <= 0) { if (fox.loader) dropLoad(fox.loader); fox.loader = null; if (!gear.cart) foxOnce('standUp'); haulOn(); }
      break;
    case 'plow': { // erst an den Anfang der Furche, dann zum Hof hin pflügen; das Feld wächst hinter dem Pflug
      const P = fox.plowRun, F = P.F, a = farmPt(F, P.lx, ROW2 - 1), b = farmPt(F, P.lx, ROW2 + 1);
      const dirH = Math.atan2(b.x - a.x, b.z - a.z), s0 = farmPt(F, P.lx, P.z);
      if (P.phase === 'align') { // ohne Wegsuche die letzten Schritte zum Anfang (der Platz liegt am Rand des Hofs)
        anim('walk'); fox.h = Math.atan2(s0.x - fox.x, s0.z - fox.z);
        if (moveFree(fox, s0.x, s0.z, C.walk * dt, navV) === true || Math.hypot(s0.x - fox.x, s0.z - fox.z) < .05) {
          P.phase = 'run'; fox.h = fox.vh = dirH; gear.plow = true; P.field = addNewField(F, P.lx); floatText(fox.x, foxPivot.position.y + C.h, fox.z, 'Neues Feld!', 's');
        } else if ((P.alignT = (P.alignT || 0) + dt) > 4) { fox.x = s0.x; fox.z = s0.z; } // hängt fest: hinsetzen
        break;
      }
      anim('walk'); P.z += dt * .7; const p = farmPt(F, P.lx, P.z); fox.x = p.x; fox.z = p.z; fox.h = dirH;
      if (gear.towX !== undefined && P.field) { // wie weit der Pflug das Feld schon gefurcht hat
        const dx = gear.towX - F.x, dz = gear.towZ - F.z, lz = dx * Math.sin(F.ry) + dz * Math.cos(F.ry);
        P.field.reveal = Math.max(P.field.reveal, Math.min(1, (lz - (ROW2 - FARM.fd / 2)) / FARM.fd)); setReveal(P.field);
        if (Math.random() < dt * 14) dust(gear.towX, surfaceAt(gear.towX, gear.towZ) + .03, gear.towZ, 1, .4);
      }
      if (P.field && P.field.reveal >= 1) { gear.plow = false; fox.plowRun = null; fox.desc = 'ein neues Feld angelegt'; foxFinish('help', 'plow'); }
      break;
    }
    case 'shove': { // anlaufen, dann mit gesenktem Kopf schieben; der Felsen rutscht vor ihr her
      const J = fox.rockJob, r = J && J.r; if (!r) { foxIdle(1); break; }
      fox.timer -= dt; anim(fox.timer > 0 ? 'attack' : 'walk');
      if (fox.timer <= 0 && J.to) { fox.state = 'shoveTo'; r.moving = true; buildNav(); setGoal(fox, J.to.x - J.dx * J.gap * .3, J.to.z - J.dz * J.gap * .3, navF); break; }
      if (fox.timer <= 0) {
        const st = Math.min(J.left, dt * .7); J.left -= st; fox.x += J.dx * st; fox.z += J.dz * st;
        r.x = fox.x + J.dx * J.gap; r.z = fox.z + J.dz * J.gap;
        if (Math.random() < dt * 14) dust(r.x - J.dx * r.s, surfaceAt(r.x, r.z) + .03, r.z - J.dz * r.s, 1, .45);
        if (J.left <= 0) { buildNav(); fox.rockJob = null; floatText(r.x, surfaceAt(r.x, r.z) + 1.2, r.z, 'Felsen weggeschoben', 's'); fox.desc = 'einen Felsen weggeschoben'; foxFinish('help', 'rock'); }
      }
      break;
    }
    case 'shoveTo': { // den Felsen vor der Stirn den Weg entlang zum Steinmetz schieben
      const J = fox.rockJob, r = J && J.r; if (!r || !rocks.includes(r)) { if (r) r.moving = false; fox.rockJob = null; foxIdle(1); break; }
      anim('walk'); const x0 = fox.x, z0 = fox.z, done = followPath(fox, C.walk * .55 * dt);
      const vh = fox.vh ?? fox.h; r.x = fox.x + Math.sin(vh) * J.gap; r.z = fox.z + Math.cos(vh) * J.gap; r.r += (Math.hypot(fox.x - x0, fox.z - z0) / Math.max(.2, r.s)) * .6; // er rollt ein wenig
      if (Math.random() < dt * 14) dust(r.x - Math.sin(vh) * r.s, surfaceAt(r.x, r.z) + .03, r.z - Math.cos(vh) * r.s, 1, .45);
      J.stuck = Math.hypot(fox.x - x0, fox.z - z0) < dt * .05 ? J.stuck + dt : 0;
      if (done || Math.hypot(r.x - J.to.x, r.z - J.to.z) < .45 || J.stuck > 4) {
        r.moving = false; const there = Math.hypot(r.x - J.to.x, r.z - J.to.z) < 1.6; r.atMason = there; fox.rockJob = null; buildNav();
        floatText(r.x, surfaceAt(r.x, r.z) + 1.2, r.z, there ? 'Felsen beim Steinmetz' : 'Felsen weggeschoben', 's');
        fox.desc = there ? 'einen Felsen zum Steinmetz geschoben' : 'einen Felsen weggeschoben'; foxFinish('help', 'rock');
      }
      break;
    }
    case 'uproot': { // mit dem Huf lockern, dann den jungen Baum ins Geweih heben
      anim('eat'); fox.timer -= dt; const T = fox.trans;
      if (Math.random() < dt * 12 && T) dust(T.t.x, surfaceAt(T.t.x, T.t.z) + .03, T.t.z, 1, .35);
      if (fox.timer <= 0) {
        if (!T || T.t.gone) { fox.trans = null; foxIdle(1); break; }
        fox.carryType = T.t.type; fox.carryG = Math.max(.15, T.t.g); T.t.gone = true; T.t.reserved = null; fox.carry = true;
        const a = Math.atan2(fox.x - T.to.x, fox.z - T.to.z), C2 = CREATURES[fox.kind]; foxWalk(T.to.x + Math.sin(a) * C2.h * .35, T.to.z + Math.cos(a) * C2.h * .35, 'replant');
      }
      break;
    }
    case 'watch': { // stehen bleiben, lauschen, sich umsehen; Wild in der Nähe flieht
      anim('idle'); fox.timer -= dt;
      if (fox.timer <= 0) {
        for (const a of wild) if (a.state !== 'dead' && Math.hypot(a.x - fox.x, a.z - fox.z) < 7) scareAway(a, fox.x, fox.z);
        const P = fox.patrol; if (P && ++P.i < P.pts.length) { const p = P.pts[P.i]; foxWalk(p.x, p.z, 'patrolPt'); break; }
        const night = S.hour >= 20 || S.hour < 6; if (night) { addGlaube(2, fox.x, 1.4, fox.z); floatText(fox.x, foxPivot.position.y + C.h + .2, fox.z, 'Das Dorf schläft ruhig', 's'); }
        fox.patrol = null; fox.desc = 'Wache um das Dorf gelaufen'; foxFinish('help', 'patrol');
      }
      break;
    }
    case 'escort': { // neben dem Bewohner herlaufen
      const E = fox.esc, v = E && E.v; E.t -= dt;
      if (!v || !villagers.includes(v) || E.t <= 0 || ['sleep', 'grabbed', 'falling', 'ride', 'dying'].includes(v.state)) { fox.esc = null; fox.desc = 'einen Bewohner begleitet'; foxFinish('help', 'escort'); break; }
      const sx = Math.cos(v.vh ?? v.h), sz = -Math.sin(v.vh ?? v.h), tx = v.x + sx * .9, tz = v.z + sz * .9, d = Math.hypot(tx - fox.x, tz - fox.z);
      if (d > .4) { anim(d > 2 ? 'run' : 'walk'); if ((fox.chaseT = (fox.chaseT || 0) - dt) <= 0) { fox.chaseT = .4; setGoal(fox, tx, tz, navF); } followPath(fox, (d > 2 ? C.run : C.walk * 1.4) * dt); }
      else { anim(v.state === 'walk' ? 'walk' : 'idle'); fox.h = v.vh ?? v.h; }
      if (!E.met && d < 1.6) { E.met = true; v.haste = Math.max(v.haste || 0, 20); v.cheer = 1.2; floatText(v.x, v.y + 1, v.z, 'Gemeinsam schneller', 's'); fox.signalT = 1; }
      break;
    }
    case 'nudge': fox.timer -= dt; anim('idle'); if (fox.timer <= 0) { gear.log = false; unload(); } break; // Stamm an die Säge gestupst
    case 'dig': { // mit den Vorderpfoten ein Loch scharren, Erde fliegt; dann den Samen hineinschieben
      anim('idle'); fox.timer -= dt; const P = fox.dig;
      if (Math.random() < dt * 16) dust(P.x + (Math.random() - .5) * .2, surfaceAt(P.x, P.z) + .03, P.z + (Math.random() - .5) * .2, 1, .3);
      if (fox.timer <= 0) {
        if (!treeNear(P.x, P.z, .7) && addTree(P.x, P.z, .06)) floatText(P.x, surfaceAt(P.x, P.z) + .8, P.z, 'Setzling gepflanzt', 's');
        fox.dig = null; fox.desc = 'einen Setzling eingegraben'; foxFinish('help', 'plant');
      }
      break;
    }
    case 'sniff': { // am Busch schnuppern; vielleicht Pilze
      anim('eat'); fox.timer -= dt;
      if (fox.timer <= 0) {
        const F = fox.forage, n = Math.random() < .75 ? (S.cGear.basket ? 1 + Math.floor(Math.random() * 2) : 1) : 0;
        F.found += n; F.left--;
        if (n) { fox.signalT = 1.2; floatText(fox.x, foxPivot.position.y + C.h + .2, fox.z, n > 1 ? `${n} Pilze!` : 'Ein Pilz!', 's'); }
        if (S.cGear.basket) gear.basket = 1 + Math.min(3, F.found); else if (F.found) fox.mouthSack = true;
        const next = F.left > 0 && (S.cGear.basket || !F.found) && pickBush();
        if (next) { const a = Math.atan2(fox.x - next.x, fox.z - next.z); fox.bush = next; foxWalk(next.x + Math.sin(a) * .9, next.z + Math.cos(a) * .9, 'sniff'); }
        else if (F.found) { const p = localPt(lager, .2, 1.9); foxWalk(p.x, p.z, 'forageStore'); }
        else { gear.basket = 0; fox.forage = null; fox.desc = 'nach Pilzen gesucht, aber keine gefunden'; foxFinish('help', 'forage'); }
      }
      break;
    }
    case 'chase': { // einem Hasen nachrennen, bis er die Flucht ergreift
      anim('run'); fox.timer -= dt; const h = fox.prey;
      if (!h || !wild.includes(h) || h.state === 'dead' || fox.timer <= 0) { fox.prey = null; foxIdle(1); break; }
      if ((fox.chaseT = (fox.chaseT || 0) - dt) <= 0) { fox.chaseT = .5; setGoal(fox, h.x, h.z, navF); } // Weg um Häuser und Zäune herum, laufend neu
      followPath(fox, C.run * 1.15 * dt);
      const hd = Math.hypot(h.x - fox.x, h.z - fox.z);
      if (hd < 4.5 || (h.state !== 'nibble' && !h.field && hd < 7)) { // Felder sind eingezäunt: vom Zaun aus reicht es, der Hase flieht
        scareAway(h, fox.x, fox.z); fox.prey = null; fox.signalT = 1.4;
        floatText(fox.x, foxPivot.position.y + C.h + .2, fox.z, 'Husch!', 'w');
        fox.desc = 'einen Hasen vom Feld verscheucht'; foxFinish('help', 'pest');
      }
      break;
    }
    case 'shake': fox.timer -= dt; anim('idle'); if (fox.timer <= 0) unload(); break;
    case 'sweep': { // mit dem Schwanz den Platz fegen, Staub fliegt
      anim('idle'); fox.timer -= dt; fox.sweepT += dt;
      if (Math.random() < dt * 14) { anchor('tail', sw); dust(sw.x, surfaceAt(sw.x, sw.z) + .05, sw.z, 1, .4); }
      if (fox.timer <= 0) { addGlaube(2, fox.x, 1.4, fox.z); fox.desc = 'den Platz am Schrein gefegt'; foxFinish('help', 'sweep'); }
      break;
    }
    case 'work': anim('attack'); fox.timer -= dt; if (fox.timer <= 0) {
      const tr = fox.tree; fox.tree = null;
      if (tr && tr.alive) {
        chopTree(tr);
        if (fox.act === 'help') {
          // Baum kippt um, dann senkt der Tiergeist den Kopf und hebt ihn auf
          fallTree(tr, fox.x, fox.z, FALL_T + .85); fox.carryType = tr.type; fox.state = 'pickup'; fox.timer = FALL_T + .85;
        } else {
          fallTree(tr, fox.x, fox.z, 4.5);
          floatText(tr.x, surfaceAt(tr.x, tr.z) + 1.4, tr.z, 'Krach!', 'w');
          for (const v of villagers) { const dx = v.x - fox.x, dz = v.z - fox.z, d = Math.hypot(dx, dz); if (d < 4.5 && ['idle', 'walk', 'pray', 'chop', 'lunch', 'plant', 'beg'].includes(v.state)) { if (v.tree) { v.tree.reserved = null; v.tree = null; } v.state = 'flee'; v.timer = 2; v.tx = v.x + dx / (d || 1) * 3; v.tz = v.z + dz / (d || 1) * 3; } }
          foxFinish('mischief', 'mischief');
        }
      } else foxIdle(1);
    } break;
    case 'play': {
      anim('run'); fox.playT += dt;
      // tollt im Kreis um die Linde: mal schneller, mal langsamer, springt ab und zu hoch und kehrt dabei manchmal um.
      // Die Blickrichtung folgt immer der Laufrichtung (Tangente am Kreis).
      const pc = fox.pc || CENTER, R = pc.r || 1.6, dir = fox.playDir || (fox.playDir = 1);
      const sp = C.run * (1.05 + .35 * Math.sin(fox.playT * 2.3)) / R; fox.playA += dir * sp * dt;
      fox.x = pc.x + Math.cos(fox.playA) * R; fox.z = pc.z + Math.sin(fox.playA) * R;
      fox.h = Math.atan2(-Math.sin(fox.playA) * dir, Math.cos(fox.playA) * dir);
      if ((fox.jumpT = (fox.jumpT ?? 1) - dt) <= 0 && fox.hop <= 0) { // Freudensprung
        fox.hop = .5; fox.jumpT = 1 + Math.random() * 1.4;
        if (Math.random() < .3) fox.playDir = -dir; // im Sprung herumwirbeln und andersherum weiter
      }
      if (Math.floor(fox.playT) !== Math.floor(fox.playT - dt)) addGlaube(1.5, fox.x, 1.4, fox.z);
      if (fox.playT > 7) { if (fox.riders) fox.desc = fox.riders.length > 1 ? 'zwei Bewohner auf dem Rücken reiten lassen' : 'einen Bewohner auf dem Rücken reiten lassen'; foxFinish('play', 'play'); }
    } break;
  }
  if (fox.hop > 0) fox.hop = Math.max(0, fox.hop - dt);
  if (glowT > 0) {
    glowT = Math.max(0, glowT - dt); const k = 1 - glowT / GLOW_T, a = Math.sin(Math.min(1, k * 1.3) * Math.PI);
    foxGlow.intensity = a * 6; foxRing.material.opacity = a * .7; foxRing.scale.setScalar(.4 + k * 1.6 * C.h);
    foxRing.position.set(fox.x, surfaceAt(fox.x, fox.z) + .08, fox.z);
  }
  const gy = groundFit(dt, C);
  foxPivot.position.set(fox.x, gy + Math.sin(Math.min(1, fox.hop / .5) * Math.PI) * .7, fox.z);
  // Das Modell dreht sich weich in die Laufrichtung (gleich schnell bei jeder Bildrate, höchstens etwa 260° pro Sekunde),
  // statt an jeder Ecke des Weges sprunghaft umzuschwenken
  if (fox.vh === undefined) fox.vh = fox.h;
  const dvh = Math.atan2(Math.sin(fox.h - fox.vh), Math.cos(fox.h - fox.vh));
  fox.vh += Math.sign(dvh) * Math.min(Math.abs(dvh) * (1 - Math.exp(-dt * 7)), dt * 4.5);
  foxPivot.rotation.set(fox.pitch, fox.vh, fox.roll, 'YXZ'); // erst drehen, dann am Hang neigen
  foxMixer.update(dt);
  // Bewegungen über der Animation (body.js): Kopf tief beim Schleifen, Kopfwurf, Schwanz fegt, Abschütteln
  over('drag', { Neck1: [24, 0, 0], Head: [4, 0, 0] }, drag ? 1 : 0, 4);
  over('flick', { Neck1: [-30, 0, 0], Head: [-24, 0, 0] }, fox.state === 'toss' && fox.timer < .6 && fox.timer > .2 ? 1 : 0, 16);
  over('push', { Neck1: [26, 0, 0], Head: [-4, 0, 0] }, gear.log && fox.state === 'walk' ? 1 : 0, 5); // Kopf tief am Stamm
  over('horns', { Neck1: [32, 0, 0], Head: [38, 0, 0] }, (fox.state === 'shove' && fox.timer <= 0) || fox.state === 'shoveTo' ? 1 : 0, 6); // Kopf eingezogen, Stirn und Hörner gegen den Felsen
  over('pull', { Neck1: [12, 0, 0], Back: [3, 0, 0] }, gear.plow || gear.cart ? 1 : 0, 4); // legt sich ins Geschirr
  over('sniff', { Neck1: [18, 0, 0], Head: [10, 0, 0], Ear1L: [14, 0, 0], Ear1R: [14, 0, 0] }, fox.state === 'sniff' ? 1 : 0, 5);
  const dg = Math.sin(t * 15), digOn = fox.state === 'dig';
  over('dig', { Back: [8, 0, 0], Neck1: [24, 0, 0], Head: [12, 0, 0] }, digOn ? 1 : 0, 6);
  if (digOn) { footExtra.IKFrontLegL = [0, .07 * Math.max(0, dg), .08 * dg]; footExtra.IKFrontLegR = [0, .07 * Math.max(0, -dg), -.08 * dg]; } // abwechselnd scharren
  else if (fox.digFeet) { delete footExtra.IKFrontLegL; delete footExtra.IKFrontLegR; } // nur zurücknehmen, was das Graben gesetzt hat (das Ritual nutzt sie auch)
  fox.digFeet = digOn;
  if ((fox.signalT = Math.max(0, (fox.signalT || 0) - dt)) > 0) { const w = Math.sin(t * 17); over('wag', { Tail1: [26, 0, 0], Tail2: [4, w * 26, 0], Tail3: [0, w * 22, 0], Tail5: [0, w * 18, 0] }, 1, 12); } else overOff('wag'); // Zeichen geben
  const sws = Math.sin(t * 6.5);
  if (fox.state === 'sweep') over('sweep', { Tail1: [-36, sws * 48, 0], Tail2: [-6, sws * 22, 0], Tail3: [0, sws * 18, 0], Tail5: [0, sws * 14, 0], Neck1: [4, -sws * 10, 0] }, 1, 8); else overOff('sweep');
  const sh = Math.sin(t * 32);
  if (fox.state === 'shake') over('shake', { Back: [0, 0, sh * 14], Torso2: [0, 0, -sh * 10], Neck1: [0, 0, sh * 14], Head: [0, 0, -sh * 10] }, 1, 20); else overOff('shake');
  updateBody(dt, t);
  updateMouthTree();
  if (drag && fox.state === 'walk' && fox.dragTip) { // die Krone schleift: Spur und Staub
    addWear(fox.dragTip.x, fox.dragTip.z, dt * .5);
    if (Math.random() < dt * 9) dust(fox.dragTip.x, surfaceAt(fox.dragTip.x, fox.dragTip.z) + .05, fox.dragTip.z, 1, .45);
  }
}
// Am Hang (z. B. auf dem Hügel des Schreins) dem Boden folgen: Höhe unter Brust und Hüfte bzw. links und rechts messen,
// das Tier danach neigen (weich, höchstens etwa 18°) und so hoch setzen, dass weder Kopf noch Hinterteil im Boden stecken
function groundFit(dt, C) {
  const fx = Math.sin(fox.vh ?? fox.h), fz = Math.cos(fox.vh ?? fox.h), lf = C.h * .55, lb = C.h * .45, w = C.h * .18;
  const hc = surfaceAt(fox.x, fox.z), hf = surfaceAt(fox.x + fx * lf, fox.z + fz * lf), hb = surfaceAt(fox.x - fx * lb, fox.z - fz * lb);
  const hl = surfaceAt(fox.x + fz * w, fox.z - fx * w), hr = surfaceAt(fox.x - fz * w, fox.z + fx * w);
  const lim = .32, k = 1 - Math.exp(-dt * 8); // steiler neigt sie sich nicht, den Rest gleichen die Pfoten aus (body.js)
  const pitch = clamp(-Math.atan2(hf - hb, lf + lb), -lim, lim), roll = clamp(Math.atan2(hl - hr, 2 * w) * .6, -.25, .25);
  fox.pitch = (fox.pitch || 0) + (pitch - (fox.pitch || 0)) * k; fox.roll = (fox.roll || 0) + (roll - (fox.roll || 0)) * k;
  return Math.max(hc, hb + (hf - hb) * lb / (lf + lb)); // Höhe der Linie Hüfte–Brust über dem Mittelpunkt
}
// Ruun wirkt mit: bäumt sich auf, wenn der Spieler ein Wunder wirkt (sofern er gerade frei ist)
const GLOW_T = 2.3; let glowT = 0;
const foxGlow = new THREE.PointLight(0xffd27a, 0, 9, 1.6); foxGlow.position.y = 1.4; foxPivot.add(foxGlow); // immer in der Szene, sonst kompiliert Three.js die Shader neu
const foxRing = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
scene.add(foxRing);
function foxCast(x, z) {
  if (!['idle', 'rest', 'walk'].includes(fox.state) || (fox.state === 'walk' && ['store', 'haulStore', 'haulDeliver', 'shrine'].includes(fox.next))) return;
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; } fox.act = null;
  fox.h = Math.atan2(x - fox.x, z - fox.z); glowT = GLOW_T;
  if (foxActs.cast) { fox.state = 'cast'; fox.timer = .1; foxOnce('cast'); } // Dauer regelt foxOnce else { fox.hop = .5; foxIdle(1.5); }
}
function reinforce(kind) {
  const t = clock.elapsedTime, a = fox.last;
  if (handAnim.kind) return; // eine Geste nach der anderen
  // ein laufendes oder stehendes Tier hält für die Geste inne (außer es trägt gerade Holz)
  if (fox.state === 'idle' || (fox.state === 'walk' && fox.next !== 'store' && fox.next !== 'shrine')) {
    if (fox.tree) { fox.tree.reserved = null; fox.tree = null; } fox.act = null;
    foxIdle(HAND_DUR[kind] + .6); fox.idleA = 'idle'; foxAnim('idle');
  }
  // die Hand führt die Geste aus; das Tier reagiert erst, wenn sie es wieder losgelassen hat.
  // Was sich dabei geändert hat (z. B. „Helfen 34 % → 45 %“), steht danach kurz über dem Tier.
  let learned = '';
  playHand(kind, () => {
    const top = foxPivot.position.y + CREATURES[fox.kind].h + .5;
    if (learned) floatText(fox.x, top + .45, fox.z, learned, 's');
    if (kind === 'pet') {
      floatText(fox.x, top, fox.z, '♥', 'love');
      if (fox.state === 'rest') fox.timer += 4; else foxOnce(foxActs.praise ? 'praise' : 'idle2'); // liegend genießt es einfach weiter
    } else {
      floatText(fox.x, top, fox.z, '!', 'w');
      if (fox.state === 'rest') { foxOnce('standUp'); foxIdle(1); } else if (foxActs.scold) foxOnce('scold'); else { foxOnce('hit'); fox.hop = .5; }
    }
  });
  if (a && t - fox.lastT < 25) {
    const [from, to] = train(a, kind === 'pet'), pc = p => Math.round(p * 100); // nur dieser Antrieb, die anderen bleiben
    noteLearn(kind, a, fox.lastDesc, from, to); learned = `${ACT_LABEL[a]} ${pc(from)} → ${pc(to)}`;
    toast(`${kind === 'pet' ? 'Lob' : 'Tadel'}, weil ${S.name} ${fox.lastDesc} hat. ${S.name} lernt: ${kind === 'pet' ? 'mehr' : 'weniger'} ${ACT_LABEL[a]} (${pc(from)} → ${pc(to)}).`);
    fox.last = null; $('btnFox').classList.remove('pulse');
  } else {
    noteLearn(kind, null, null, null, null);
    toast(kind === 'pet' ? `${S.name} schmiegt sich an deine Hand.` : `${S.name} duckt sich und weiß nicht, wofür.`);
  }
  emit('fox'); save();
}

// Neue Gestalt, am Schrein gewählt (kreatur.md 3.11 D): Was sie gerade tut, bricht sie ab, läuft zum Schrein und
// verwandelt sich dort im Licht (die Oberfläche lädt das Modell, Ereignis 'foxTransform')
function foxToShrine(id) {
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; }
  if (fox.carry) { fox.carry = false; addLogs(4, fox.x, 1.2, fox.z); } // getragener Baum: das Holz landet trotzdem im Lager
  if (fox.carryGoods) for (const k in fox.carryGoods) S[k] += fox.carryGoods[k];
  fox.haul = null; fox.carryGoods = null; fox.act = null; fox.once = 0; fox.morph = id;
  const p = shrinePt(0, 3.4); foxWalk(p.x, p.z, 'shrine');
  noteChoice('shrine', 'shrine', `am Schrein die Gestalt ${CREATURES[id].label} annehmen`, [{ key: 'player', label: 'du hast es am Schrein so gewählt', weight: 1 }]);
}

// Zum Ausprobieren in der Konsole (__wk.foxDo; auf dem Branch claude/vierbeiner-test auch die Testleiste): eine Handlung sofort beginnen. 'tree' Baum schleifen, 'self' Waren selbst aufladen,
// 'villager' von einem Bewohner beladen lassen, 'sweep' Schwanz fegt. Liefert einen Text, wenn es nicht geht.
function foxDo(kind) {
  foxDrop(); fox.once = 0;
  const why = [{ key: 'test', label: 'in der Testleiste gewählt', weight: 1 }];
  const A = CREATURES[fox.kind].acts;
  if (kind === 'self' && !A.toss) return `Ein ${CREATURES[fox.kind].label} kann Waren nicht selbst aufladen.`;
  if (kind === 'plow') return farms.length ? (foxPlowGo(why) ? '' : 'Kein Platz mehr für ein neues Feld (höchstens 8 je Hof, Felsen räumen).') : 'Noch kein Hof.';
  if (kind === 'rock') return foxRockGo(why) ? '' : 'Kein Felsen in der Nähe.';
  if (kind === 'transplant') return foxTransplantGo(why) ? '' : 'Kein junger Baum in dichtem Wald.';
  if (kind === 'patrol') return foxPatrolGo(why) ? '' : 'Noch keine Häuser.';
  if (kind === 'escort') { if (foxEscortGo(why)) return ''; const v = villagers.find(v => v.state === 'idle'); if (v) { v.timer = 0; } return 'Gerade läuft niemand, gleich noch einmal versuchen.'; }
  if (kind === 'sweep') { foxSweepGo(why); return ''; }
  if (kind === 'plant') return foxPlantGo(why) ? '' : 'Kein Platz am Waldrand gefunden.';
  if (kind === 'forage') return foxForageGo(why) ? '' : 'Kein Busch am Wald in der Nähe.';
  if (kind === 'ride') { fox.pc = playSpot(); fox.act = 'play'; fox.wantRider = true; foxWalk(fox.pc.x - (fox.pc.r || 1.6), fox.pc.z, 'play'); noteChoice('play', 'play', 'mit einem Bewohner auf dem Rücken spielen', why); return ''; }
  if (kind === 'pest') { // ein Hase soll knabbern: der nächste Hase setzt sich an ein wachsendes Feld (sonst irgendeins)
    let h = wild.find(a => a.state === 'nibble');
    if (!h) { const fl = fields.find(f => f.state === 'grow') || fields[0], hs = wild.filter(a => a.kind === 'hase' && a.state !== 'dead'); if (!fl || !hs.length) return 'Kein Feld oder kein Hase da.';
      h = hs.sort((a, b) => Math.hypot(a.x - fl.x, a.z - fl.z) - Math.hypot(b.x - fl.x, b.z - fl.z))[0]; h.x = fl.x + .4; h.z = fl.z + .4; h.state = 'nibble'; h.timer = 40; h.field = fl; fl.pest = h; h.path = null; }
    foxChaseGo(h, why); return '';
  }
  if (kind === 'push') { // Stämme mit dem Kopf zur Säge rollen
    const saw = huts.find(h => h.role === 'sawyer'); if (!saw) return 'Keine Sägemühle da.';
    if (S.logs < 3) S.logs += 4; fox.haul = { hut: saw, supply: 'logs', n: 3 }; fox.act = 'help'; const p = lagerDrop(); foxWalk(p.x, p.z, 'haulLager');
    noteChoice('help', 'haul', 'Stämme zur Sägemühle rollen', why); return '';
  }
  if (kind === 'tree') {
    let best = null, bd = 1e9;
    for (const t of trees) { if (!t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - fox.x) ** 2 + (t.z - fox.z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) return 'Kein großer Baum frei.';
    fox.tree = best; best.reserved = 'fox'; fox.act = 'help'; const ang = Math.atan2(fox.x - best.x, fox.z - best.z);
    foxWalk(best.x + Math.sin(ang) * .9, best.z + Math.cos(ang) * .9, 'tree'); noteChoice('help', 'tree', 'Holz fürs Dorf holen', why); return '';
  }
  // Waren: liegen nirgends welche, legt der Test an der nächsten Hütte mit Warenfach welche hin
  if (!huts.some(h => Object.keys(h.goods).some(k => h.goods[k] - hauling(h, 'pick', k) >= 2))) { // reservierte Waren der Träger zählen nicht
    const h = huts.filter(h => h.goods).sort((a, b) => (Object.keys(b.goods).length - Object.keys(a.goods).length) || Math.hypot(a.x - fox.x, a.z - fox.z) - Math.hypot(b.x - fox.x, b.z - fox.z))[0];
    if (!h) return 'Keine Hütte mit Waren.'; const k = Object.keys(h.goods)[0] || 'veg'; h.goods[k] = (h.goods[k] || 0) + 8;
  }
  if (!foxHaulGoods()) return 'Keine Waren an den Hütten.';
  fox.haulMode = kind === 'self' ? 'self' : 'any';
  noteChoice('help', 'haul', 'Waren ins Lager tragen', why);
  return '';
}
// nur Waren von Hütten (kein Nachschub aus dem Lager)
function foxHaulGoods() {
  let best = null, bs = -1e9;
  for (const h of huts) {
    const take = {}; let n = 0;
    for (const [k, a] of Object.keys(h.goods).map(k => [k, Math.floor(h.goods[k] - hauling(h, 'pick', k))]).filter(([, a]) => a > 0)) { const t = Math.min(a, loadCap() - n); if (t > 0) { take[k] = t; n += t; } }
    if (n < 1) continue; const sc = n * 10 - Math.hypot(h.x - fox.x, h.z - fox.z); if (sc > bs) { bs = sc; best = { hut: h, take, n }; }
  }
  if (!best) return false; fox.haul = best; fox.act = 'help'; const p = hutWork(best.hut); foxWalk(p.x, p.z, 'haulPick'); return true;
}
// was sie gerade tut, abbrechen (Baum, Waren, Bewohner beim Beladen); was sie trug, kommt ins Lager
function foxDrop() {
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; }
  if (fox.carry) { fox.carry = false; addLogs(4, fox.x, 1.2, fox.z); }
  if (fox.carryGoods) for (const k in fox.carryGoods) S[k] += fox.carryGoods[k];
  if (fox.loader) { dropLoad(fox.loader); fox.loader = null; }
  fox.haul = null; fox.carryGoods = null; fox.mouthSack = false; back.n = 0; fox.act = null;
  if (fox.plowRun && fox.plowRun.field) { fox.plowRun.field.reveal = 1; setReveal(fox.plowRun.field); } // abgebrochen: das angefangene Feld bleibt fertig liegen
  if (fox.trans) { if (fox.carry && fox.carryG) { addTree(fox.x + Math.cos(fox.vh || 0) * .8, fox.z - Math.sin(fox.vh || 0) * .8, fox.carryG); fox.carry = false; } else if (fox.trans.t) fox.trans.t.reserved = null; } // umzusetzenden Baum gleich hier einsetzen
  fox.trans = null; fox.carryG = 0; fox.patrol = null; fox.esc = null;
  gear.cart = false; gear.plow = false; gear.log = false; gear.basket = 0; fox.forage = null; fox.plowRun = null; if (fox.rockJob && fox.rockJob.r) fox.rockJob.r.moving = false; fox.rockJob = null; fox.dig = null; fox.prey = null; dismount();
}
export { foxCast, foxDo, foxDrop, foxHaul, restSpot, foxToShrine, foxIdle, reinforce, updateFox };
