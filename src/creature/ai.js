// Verhalten der Kreatur: helfen, spielen, Unfug, tragen, ruhen; Lob und Tadel

import * as THREE from 'three';
import { $, clamp } from '../core/util.js';
import { PROC, ROLES, S, emit, resText, save } from '../core/state.js';
import { clock, scene } from '../core/render.js';
import { addGlaube, addLogs, floatText, toast } from '../ui/feedback.js';
import { surfaceAt } from '../world/terrain.js';
import { CREATURES, fox } from './kinds.js';
import { CENTER, LAGER } from '../village/layout.js';
import { FALL_T, chopTree, fallTree, trees } from '../world/trees.js';
import { huts, lager, lagerDrop, localPt } from '../village/huts.js';
import { hutWork } from '../village/build.js';
import { blockedAt, buildNav, followPath, moveFree, navF, navReady, navV, setGoal } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { ACT_DESC, ACT_LABEL, foxActs, foxAnim, foxMixer, foxOnce, foxPivot, updateMouthTree } from './creature.js';
import { HAND_DUR, handAnim, playHand } from './gestures.js';
import { MILL_BUF, hauling } from '../village/ai.js';
import { leanReasons, noteChoice, noteDone, noteLearn, share, updateMind } from './mind.js';

function foxIdle(t) { fox.state = 'idle'; fox.timer = t; fox.idleA = ['idle', 'idle', 'idle2', 'eat'][Math.floor(Math.random() * 4)]; }
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
  if (fox.haul || fox.carryGoods) { if (fox.carryGoods) for (const k in fox.carryGoods) S[k] += fox.carryGoods[k]; fox.haul = null; fox.carryGoods = null; } // abgebrochenes Tragen: Waren gehen ins Lager
  // ab und zu hinlegen und ausruhen
  if (foxActs.lie && Math.random() < .25) { // zum Dösen erst dorthin, wo der ganze liegende Körper Platz hat
    const p = restSpot(); if (Math.hypot(p.x - fox.x, p.z - fox.z) > .15) { foxWalk(p.x, p.z, 'rest'); return; }
    noteChoice('rest', 'rest', 'ausruhen', [{ key: 'rest', label: 'zwischendurch braucht es Ruhe', weight: .25 }]);
    fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); return;
  }
  // Wahl nach den Neigungen; die Gründe kommen ins Gedächtnis (mind.js), damit der Spieler nachvollziehen kann, warum
  const w = S.w, r = Math.random() * (w.help + w.play + w.mischief);
  let a = r < w.help ? 'help' : r < w.help + w.play ? 'play' : 'mischief';
  const why = leanReasons(a);
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
  if (a === 'play') { fox.pc = playSpot(); foxWalk(fox.pc.x - 1.6, fox.pc.z, 'play'); noteChoice('play', 'play', 'mit dem Dorf spielen', why); }
  else noteChoice(a, a === 'help' ? 'tree' : 'mischief', a === 'help' ? 'Holz fürs Dorf holen' : 'einen Baum umwerfen', why);
}
// Tragen: Hütte mit wartenden Waren suchen, bis zu 3 Stück auf einmal (die meisten zuerst), ins Lager bringen
const FOX_CARRY = 3;
function foxHaul() {
  let best = null, bs = 0;
  for (const h of huts) {
    const take = {}; let n = 0;
    const avail = Object.keys(h.goods).map(k => [k, Math.floor(h.goods[k] - hauling(h, 'pick', k))]).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]);
    for (const [k, a] of avail) { const t = Math.min(a, FOX_CARRY - n); if (t > 0) { take[k] = t; n += t; } }
    if (n < 2) continue;
    const score = n * 10 - Math.hypot(h.x - fox.x, h.z - fox.z); if (score > bs || !best) { bs = score; best = { hut: h, take, n }; }
  }
  // oder Nachschub aus dem Lager zu einer Werkstatt (Stämme zur Säge, Korn zur Mühle, Mehl zur Bäckerei)
  let sup = null, ss = 0;
  for (const h of huts) {
    const P = PROC[h.role], res = h.role === 'sawyer' ? 'logs' : P && P.inp; if (!res) continue;
    const have = h.role === 'sawyer' ? h.logs : h.inp, room = (h.role === 'sawyer' ? MILL_BUF : P.buf) - have - hauling(h, h.role === 'sawyer' ? 'in' : 'feed');
    const n = Math.min(FOX_CARRY, room, Math.floor(S[res])); if (n < 2) continue;
    const score = n * 10 + (have === 0 ? 15 : 0) - Math.hypot(h.x - LAGER.x, h.z - LAGER.z) * .5; if (score > ss || !sup) { ss = score; sup = { hut: h, res, n }; }
  }
  if (sup && (!best || ss > bs)) { fox.haul = { hut: sup.hut, supply: sup.res, n: sup.n }; const p = lagerDrop(); foxWalk(p.x, p.z, 'haulLager'); return true; }
  if (!best) return false;
  fox.haul = best; const p = hutWork(best.hut); foxWalk(p.x, p.z, 'haulPick'); return true;
}
// Liegeplatz: rundum frei im Umkreis der halben Körperlänge (Gebäude, Bäume, Felsen, Wasser)
function restSpot() {
  if (!navReady) buildNav();
  const R = CREATURES[fox.kind].h * .5, room = (x, z) => { if (blockedAt(navV, x, z)) return false; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (blockedAt(navV, x + Math.cos(a) * R, z + Math.sin(a) * R) || blockedAt(navV, x + Math.cos(a) * R * .5, z + Math.sin(a) * R * .5)) return false; } return true; };
  if (room(fox.x, fox.z)) return { x: fox.x, z: fox.z };
  for (let r = .5; r < 8; r += .5) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = fox.x + Math.cos(a) * r, z = fox.z + Math.sin(a) * r; if (room(x, z)) return { x, z }; }
  return { x: fox.x, z: fox.z };
}
// freier Spielplatz: ein Kreis (Radius 1,6) nahe der Dorfmitte, auf dem nichts im Weg steht
function playSpot() {
  if (!navReady) buildNav();
  const free = (x, z) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (blockedAt(navF, x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6)) return false; } return true; };
  for (let r = 0; r < 9; r += .75) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + r, x = CENTER.x + Math.cos(a) * r, z = CENTER.z + Math.sin(a) * r; if (free(x, z)) return { x, z }; }
  return CENTER;
}
function updateFox(dt, t) {
  updateMind();
  const C = CREATURES[fox.kind], spd = C.walk;
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
        addLogs(4, fox.x, 1.2, fox.z); fox.carry = false; foxFinish('help', 'tree');
      }
      else if (fox.next === 'haulPick') { // Waren aufnehmen (so viele noch da sind)
        const H = fox.haul, g = {}; let n = 0;
        if (H && huts.includes(H.hut)) for (const k in H.take) { const t = Math.min(H.take[k], Math.floor(H.hut.goods[k] || 0)); if (t > 0) { H.hut.goods[k] -= t; g[k] = t; n += t; } }
        if (!n) { fox.haul = null; foxIdle(1); } else { fox.carryGoods = g; fox.state = 'haulUp'; fox.timer = 1.1; fox.h = Math.atan2(H.hut.x - fox.x, H.hut.z - fox.z); }
      }
      else if (fox.next === 'haulLager') { // Nachschub im Lager aufnehmen
        const H = fox.haul, n = H ? Math.min(H.n, Math.floor(S[H.supply])) : 0;
        if (!n || !huts.includes(H.hut)) { fox.haul = null; foxIdle(1); } else { S[H.supply] -= n; fox.carryGoods = { [H.supply]: n }; fox.state = 'haulUp'; fox.timer = 1.1; fox.h = Math.atan2(LAGER.x - fox.x, LAGER.z - fox.z); }
      }
      else if (fox.next === 'haulDeliver') { // in der Werkstatt abladen
        const H = fox.haul, g = fox.carryGoods || {}, k = Object.keys(g)[0], n = k ? g[k] : 0;
        if (H && huts.includes(H.hut) && n) { if (H.hut.role === 'sawyer') H.hut.logs += n; else H.hut.inp += n; } else if (k) S[k] += n; // Werkstatt weg: zurück ins Lager
        floatText(fox.x, foxPivot.position.y + CREATURES[fox.kind].h, fox.z, `${resText(k, n)} abgeladen`, 'h');
        fox.carryGoods = null; fox.haul = null; fox.desc = `${resText(k, n)} zur ${H ? ROLES[H.hut.role].hut : 'Werkstatt'} getragen`; foxFinish('help', 'haul');
      }
      else if (fox.next === 'haulStore') { // im Lager abladen
        const g = fox.carryGoods || {}, out = [];
        for (const k in g) { if (k === 'logs') S.logs += g[k]; else S[k] += g[k]; out.push(resText(k, g[k])); }
        floatText(fox.x, foxPivot.position.y + CREATURES[fox.kind].h, fox.z, `+${out.join(', ')}`, 'h');
        fox.carryGoods = null; fox.haul = null; fox.desc = `${out.join(', ')} ins Lager getragen`; foxFinish('help', 'haul');
      }
      else if (fox.next === 'rest') { fox.state = 'rest'; fox.timer = 8 + Math.random() * 8; foxOnce('lieDown'); }
      else if (fox.next === 'play') { fox.state = 'play'; fox.playT = 0; fox.playA = Math.atan2(fox.z - fox.pc.z, fox.x - fox.pc.x); }
    } break;
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
      // im Kreis um einen freien Platz; was im Weg steht, wird nicht durchlaufen
      fox.playA += dt * 1.9; const pc = fox.pc || CENTER, px = pc.x + Math.cos(fox.playA) * 1.6, pz = pc.z + Math.sin(fox.playA) * 1.6;
      moveFree(fox, px, pz, C.run * 1.6 * dt, navF);
      if (Math.floor(fox.playT) !== Math.floor(fox.playT - dt)) addGlaube(1.5, fox.x, 1.4, fox.z);
      if (fox.playT > 5) foxFinish('play', 'play');
    } break;
  }
  if (fox.hop > 0) fox.hop = Math.max(0, fox.hop - dt);
  if (glowT > 0) {
    glowT = Math.max(0, glowT - dt); const k = 1 - glowT / GLOW_T, a = Math.sin(Math.min(1, k * 1.3) * Math.PI);
    foxGlow.intensity = a * 6; foxRing.material.opacity = a * .7; foxRing.scale.setScalar(.4 + k * 1.6 * C.h);
    foxRing.position.set(fox.x, surfaceAt(fox.x, fox.z) + .08, fox.z);
  }
  foxPivot.position.set(fox.x, surfaceAt(fox.x, fox.z) + Math.sin(Math.min(1, fox.hop / .5) * Math.PI) * .7, fox.z);
  // Das Modell dreht sich weich in die Laufrichtung (gleich schnell bei jeder Bildrate, höchstens etwa 260° pro Sekunde),
  // statt an jeder Ecke des Weges sprunghaft umzuschwenken
  if (fox.vh === undefined) fox.vh = fox.h;
  const dvh = Math.atan2(Math.sin(fox.h - fox.vh), Math.cos(fox.h - fox.vh));
  fox.vh += Math.sign(dvh) * Math.min(Math.abs(dvh) * (1 - Math.exp(-dt * 7)), dt * 4.5);
  foxPivot.rotation.y = fox.vh;
  foxMixer.update(dt);
  updateMouthTree();
}
// Ruun wirkt mit: bäumt sich auf, wenn der Spieler ein Wunder wirkt (sofern er gerade frei ist)
const GLOW_T = 2.3; let glowT = 0;
const foxGlow = new THREE.PointLight(0xffd27a, 0, 9, 1.6); foxGlow.position.y = 1.4; foxPivot.add(foxGlow); // immer in der Szene, sonst kompiliert Three.js die Shader neu
const foxRing = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
scene.add(foxRing);
function foxCast(x, z) {
  if (!['idle', 'rest', 'walk'].includes(fox.state) || (fox.state === 'walk' && ['store', 'haulStore', 'haulDeliver'].includes(fox.next))) return;
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; } fox.act = null;
  fox.h = Math.atan2(x - fox.x, z - fox.z); glowT = GLOW_T;
  if (foxActs.cast) { fox.state = 'cast'; fox.timer = .1; foxOnce('cast'); } // Dauer regelt foxOnce else { fox.hop = .5; foxIdle(1.5); }
}
function reinforce(kind) {
  const t = clock.elapsedTime, a = fox.last;
  if (handAnim.kind) return; // eine Geste nach der anderen
  // ein laufendes oder stehendes Tier hält für die Geste inne (außer es trägt gerade Holz)
  if (fox.state === 'idle' || (fox.state === 'walk' && fox.next !== 'store')) {
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
    const from = share(a);
    S.w[a] = clamp(S.w[a] * (kind === 'pet' ? 1.6 : .5), .04, 10);
    const sum = S.w.help + S.w.play + S.w.mischief; for (const k in S.w) S.w[k] /= sum;
    const to = share(a), pc = p => `${Math.round(p * 100)} %`;
    noteLearn(kind, a, fox.lastDesc, from, to); learned = `${ACT_LABEL[a]} ${pc(from)} → ${pc(to)}`;
    toast(`${kind === 'pet' ? 'Lob' : 'Tadel'}, weil ${S.name} ${fox.lastDesc} hat. ${S.name} lernt: ${kind === 'pet' ? 'mehr' : 'weniger'} ${ACT_LABEL[a]} (${pc(from)} → ${pc(to)}).`);
    fox.last = null; $('btnFox').classList.remove('pulse');
  } else {
    noteLearn(kind, null, null, null, null);
    toast(kind === 'pet' ? `${S.name} schmiegt sich an deine Hand.` : `${S.name} duckt sich und weiß nicht, wofür.`);
  }
  emit('fox'); save();
}

export { foxCast, foxHaul, foxIdle, reinforce, updateFox };
