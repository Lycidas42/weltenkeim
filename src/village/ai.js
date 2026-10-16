// Verhalten der Bewohner: Arbeit, Tragen, Jagen, Fischen, Essen, Schlafen, Beten, Gaben zum Schrein

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rnd, smooth } from '../core/util.js';
import { PROC, RES, S, prayYield, resText } from '../core/state.js';
import { scene } from '../core/render.js';
import { addGlaube, addHolz, addLogs, floatText } from '../ui/feedback.js';
import { BED, LUNCH, WAKE } from '../world/sky.js';
import { HALF, heightAt, seaAt, streamDist, surfaceAt } from '../world/terrain.js';
import { addWear } from '../world/paths.js';
import { spawnChips } from '../world/particles.js';
import { fox } from '../creature/kinds.js';
import { treeKindAt } from '../models/nature.js';
import { LUNCH_AT, SHRINE_POS, shrinePt } from './layout.js';
import { addTree, chopTree, fallTree, freeSlot, treeNear, trees } from '../world/trees.js';
import { PRAY_T, spawnMote } from './shrine.js';
import { houseDoor, houses } from './houses.js';
import { FARM, farmPt, groundAt, hutSites, huts, lagerDrop, localPt } from './huts.js';
import { CROPS, fieldFront } from '../farm/farm.js';
import { hutDoor, hutWork } from './build.js';
import { followPath, moveFree, navV, nearBuilding, setGoal } from '../world/nav.js';
import { CHOP_HIT, CHOP_T, DIG_T, homeSpot, villagers } from './villagers.js';
import { GIFT_GLAUBE, MEAL, eatLunch, food, giftDue, prayMul, takePortion, workMul } from './food.js';
import { fish, killAnimal, removeAnimal, wild } from '../wildlife/land.js';
import { removeRock, rocks } from '../world/nature.js';
import { fishGeo, fishMesh, splash } from '../wildlife/sea.js';

function walk(v, x, z, next) { v.state = 'walk'; v.next = next; v.stalk = next === 'aim'; setGoal(v, x, z, navV); }
function idle(v, t) { v.state = 'idle'; v.timer = t; }
function goLunch(v) { const a = Math.random() * Math.PI * 2, r = .85 + Math.random() * 1.6; walk(v, LUNCH_AT.x + Math.cos(a) * r, LUNCH_AT.z + Math.sin(a) * r, 'lunch'); }
function goHome(v) {
  const hs = houses[villagers.indexOf(v) % Math.max(1, houses.length)]; if (!hs) { idle(v, 2); return; }
  v.home = hs; const d = houseDoor(hs, .12 + Math.random() * .1); walk(v, d.x, d.z, 'sleep');
}
// Gabe: Portion im Lager holen, zum Schrein tragen und auf den Altar legen (v.gift: true = holt sie noch, sonst die Sorte)
function goGift(v) {
  if (!v.gift) { v.gift = true; food.giftBy = v; }
  if (v.gift === true) { const p = lagerDrop(); walk(v, p.x, p.z, 'giftPick'); return; }
  if (!v.carry) { endGift(v); idle(v, .3); return; } // unterwegs fallen gelassen (Hand)
  const p = shrinePt(rnd(.25), 1.95 + Math.random() * .15); walk(v, p.x, p.z, 'gift');
}
function endGift(v) { if (!v.gift) return; if (food.giftBy === v) food.giftBy = null; if (v.gift !== true && v.carry) { S[v.gift] += 1 / MEAL[v.gift]; v.carry = 0; } v.gift = null; }
function goPray(v) { const a = Math.random() * Math.PI * 2, r = 1.95 + Math.random() * .9; walk(v, SHRINE_POS.x + Math.cos(a) * r, SHRINE_POS.z + Math.sin(a) * r, 'pray'); }
function findTree(x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < 24; i++) { const t = trees[Math.floor(Math.random() * trees.length)]; if (!t || !t.alive || t.gone || t.reserved || t.g < .7) continue; const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}
function chooseJob(v) {
  if (S.hour >= BED || S.hour < WAKE) { endGift(v); goHome(v); return; } // Feierabend: heim in die Hütte
  if (S.hour >= LUNCH[0] && S.hour < LUNCH[1]) { goLunch(v); return; } // Mittagspause am Brunnen
  if (v.wish) { if (wish.kind && wish.by === v) { goBeg(v); return; } v.wish = false; }
  if (v.gift || (!v.role && !v.haul && !v.carry && giftDue())) { goGift(v); return; } // Gabe zum Schrein bringen
  if (v.drop && v.carry) { walkDrop(v); return; } // Ware erst an der Hütte ablegen
  if (v.role && v.hut) { JOB[v.role](v); return; }
  if (haulJob(v)) return;
  // Dorfbewohner beten am Schrein, ab und zu ruhen sie sich aus
  if (Math.random() < .88) goPray(v); else { const p = homeSpot(); walk(v, p.x, p.z, 'rest'); }
}
// Träger: freie Dorfbewohner bringen Stämme aus dem Lager zur Sägemühle und Bretter zurück ins Lager.
// Was unterwegs ist, wird pro Mühle mitgezählt, so tragen immer nur so viele, wie gebraucht werden.
const MILL_BUF = 4;
function hauling(hs, kind, res) { let n = 0; for (const v of villagers) if (v.haul && v.haul.hut === hs && v.haul.kind === kind && (!res || v.haul.res === res)) n += v.haul.n;
  if (kind === 'pick' && fox.haul && fox.haul.take && fox.haul.hut === hs && fox.state === 'walk' && fox.next === 'haulPick') n += res ? fox.haul.take[res] || 0 : 0; // die Kreatur ist schon unterwegs
  if ((kind === 'in' || kind === 'feed') && fox.haul && fox.haul.supply && fox.haul.hut === hs && (fox.state === 'haulUp' || (fox.state === 'walk' && ['haulLager', 'haulDeliver'].includes(fox.next)))) n += fox.carryGoods ? fox.carryGoods[fox.haul.supply] || 0 : fox.haul.n;
  return n; }
// Spezialisten legen ihre Ware an der eigenen Hütte ab (Holzfäller, Jäger, Fischer, Bauer); Träger bringen sie ins Lager
function walkDrop(v, goods) {
  if (goods) { v.drop = goods; v.dropAt = v.hut; }
  const H = v.dropAt && huts.includes(v.dropAt) ? v.dropAt : null, p = H ? hutWork(H) : lagerDrop(); v.dropAt = H;
  walk(v, p.x + rnd(.2), p.z + rnd(.2), 'dropHut');
}
function putDown(v, quiet) {
  const H = v.dropAt, g = v.drop || {}, out = [];
  for (const k in g) if (g[k] > 0) { if (H) H.goods[k] = (H.goods[k] || 0) + g[k]; else S[k] += g[k]; out.push(resText(k, g[k])); }
  if (!quiet && out.length) floatText(v.x, v.y + .8, v.z, H ? `${out.join(', ')} abgelegt` : `+${out.join(', ')}`, 'h');
  v.carry = 0; v.drop = null; v.dropAt = null;
}
function haulJob(v) {
  if (v.haul) { // angefangenen Auftrag fortsetzen (z. B. nach Mittagspause, Flucht oder Wurf)
    const H = v.haul;
    if (H.kind === 'in' && v.carry === 1) { const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + .2, 'dropLogs'); return true; }
    if (H.kind === 'feed' && v.carry) { const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + rnd(.2), 'dropFeed'); return true; }
    if (H.kind !== 'in' && H.kind !== 'feed' && v.carry) { const p = lagerDrop(); walk(v, p.x, p.z, 'deliver'); return true; }
    v.haul = null;
  }
  for (const hs of huts) {
    if (hs.role !== 'sawyer') continue;
    const out = hs.planks - hauling(hs, 'out');
    if (out >= 2) { v.haul = { hut: hs, kind: 'out', n: Math.min(4, out) }; const p = hutWork(hs); walk(v, p.x + rnd(.2), p.z + .25, 'pickPlanks'); return true; }
    const room = MILL_BUF - hs.logs - hauling(hs, 'in'), have = Math.floor(S.logs) - villagers.reduce((a, x) => a + (x.haul && x.haul.kind === 'in' && !x.carry ? x.haul.n : 0), 0);
    if (room >= 1 && have >= 1) { v.haul = { hut: hs, kind: 'in', n: Math.min(2, room, have) }; const p = lagerDrop(); walk(v, p.x, p.z, 'pickLogs'); return true; }
  }
  // Mühle und Bäckerei beliefern (abwechselnd mit dem Abholen, damit beides vorankommt)
  const feed = () => {
    for (const hs of huts) {
      const P = PROC[hs.role]; if (!P) continue;
      const room = P.buf - hs.inp - hauling(hs, 'feed'), have = Math.floor(S[P.inp]) - villagers.reduce((a, x) => a + (x.haul && x.haul.kind === 'feed' && x.haul.res === P.inp && !x.carry ? x.haul.n : 0), 0);
      if (room >= 1 && have >= 1) { v.haul = { hut: hs, kind: 'feed', res: P.inp, n: Math.min(RES[P.inp][3], room, have) }; const p = lagerDrop(); walk(v, p.x, p.z, 'pickFeed'); return true; }
    }
    return false;
  };
  if (Math.random() < .5 && feed()) return true;
  // Waren an den Hütten abholen: die größte, nächste Menge zuerst
  let best = null, bd = 1e9;
  for (const hs of huts) for (const res in hs.goods) {
    const left = hs.goods[res] - hauling(hs, 'pick', res); if (left < (res === 'logs' ? 2 : 1)) continue;
    const d = Math.hypot(hs.x - v.x, hs.z - v.z) - left * 1.5; if (d < bd) { bd = d; best = { hut: hs, kind: 'pick', res, n: Math.min(RES[res][3], left) }; }
  }
  if (best) { v.haul = best; const p = hutWork(best.hut); walk(v, p.x + rnd(.2), p.z + rnd(.2), 'pickGoods'); return true; }
  return feed();
}
// Steinmetz: nächster freier Felsen nahe der Hütte; er steht an der Seite zur Hütte hin
function findRock(v) {
  let best = null, bd = 22 * 22;
  for (const r of rocks) { if (r.s < .2 || (r.by && r.by !== v && villagers.includes(r.by) && r.by.rock === r) || heightAt(r.x, r.z) < .1) continue; const d = (r.x - v.hut.x) ** 2 + (r.z - v.hut.z) ** 2; if (d < bd) { bd = d; best = r; } }
  return best;
}
const QUARRY_T = 2.4, ROCK_MIN = .2, ROCK_STEP = .045;
function atHut(v, next = 'rest') { const p = hutWork(v.hut); walk(v, p.x + rnd(.25), p.z + rnd(.25), next); }
// freier Platz für einen Setzling: leerer Baumplatz oder Stumpf nahe der Hütte, sonst ein neuer Platz am Waldrand
function plantSpot(x, z) {
  let best = null, bd = 1e9;
  for (const t of trees) if (freeSlot(t)) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd && !nearBuilding(t.x, t.z, .4)) { bd = d; best = t; } }
  if (best && bd < 14 * 14) return { tree: best };
  const alive = trees.filter(t => t.alive && !t.gone);
  for (let i = 0; i < 30 && alive.length; i++) {
    const o = alive[Math.floor(Math.random() * alive.length)], a = Math.random() * 6.28, r = 1.2 + Math.random() * 1.3, px = o.x + Math.cos(a) * r, pz = o.z + Math.sin(a) * r, h = heightAt(px, pz);
    if (h > .45 && h < 3 && Math.hypot(px, pz) > 8.5 && !treeNear(px, pz, 1) && !nearBuilding(px, pz, .55) && streamDist(px, pz) > 1 && !hutSites.some(st => st.used && Math.hypot(st.x - px, st.z - pz) < 1.5) && trees.length < 480) return { x: px, z: pz };
  }
  return best ? { tree: best } : null;
}
const JOB = {
  lumber(v) { // Baum suchen (nahe der eigenen Hütte), fällen, Stamm ins Lager
    const t = findTree(v.hut.x, v.hut.z);
    if (t) { t.reserved = v; v.tree = t; const a = Math.random() * 6.28; walk(v, t.x + Math.cos(a) * .4, t.z + Math.sin(a) * .4, 'tree'); } else atHut(v);
  },
  forester(v) { // Setzlinge an der Hütte holen, dann einen nach dem anderen pflanzen
    if (!(v.saplings > 0)) { atHut(v, 'fetchSap'); return; }
    const sp = plantSpot(v.hut.x, v.hut.z); if (!sp) { atHut(v); return; }
    v.plant = sp; const tx = sp.tree ? sp.tree.x : sp.x, tz = sp.tree ? sp.tree.z : sp.z, a = Math.random() * 6.28;
    if (sp.tree) { sp.tree.reserved = v; v.tree = sp.tree; }
    walk(v, tx + Math.cos(a) * .3, tz + Math.sin(a) * .3, 'plant');
  },
  hunter(v) { // Wild suchen, anpirschen, zielen, schießen; Beute holen und ins Lager bringen
    if (v.prey && v.prey.state === 'dead' && wild.includes(v.prey)) { walk(v, v.prey.x + rnd(.2), v.prey.z + rnd(.2), 'pickup'); return; }
    let best = null, bd = 26 * 26;
    for (const a of wild) { if (a.state === 'dead' || villagers.some(o => o !== v && o.prey === a)) continue; const d = (a.x - v.hut.x) ** 2 + (a.z - v.hut.z) ** 2 - (a.stun > 0 ? 1e4 : 0); if (d < bd) { bd = d; best = a; } }
    if (!best) { atHut(v); return; }
    v.prey = best; const dx = v.x - best.x, dz = v.z - best.z, d = Math.hypot(dx, dz) || 1, r = best.kind === 'reh' ? 4.6 : 3.6;
    walk(v, best.x + dx / d * r, best.z + dz / d * r, 'aim'); v.stalk = true;
  },
  fisher(v) { // zum Stegende, angeln, nach drei Fischen den Fang ins Lager bringen
    const J = v.hut && v.hut.jetty; if (!J) { atHut(v); return; }
    if (Math.hypot(v.x - J.end.x, v.z - J.end.z) > .3) { walk(v, J.end.x, J.end.z, 'fishspot'); return; }
    startFishing(v);
  },
  farmer(v) { // reife Felder ernten, leere besäen, sonst das Vieh füttern und Milch, Eier, Fleisch holen
    const F = v.hut.farm; if (!F) { atHut(v); return; }
    const free = f => (f.reveal ?? 1) >= 1 && (!f.by || f.by === v || f.by.field !== f || f.by.role !== 'farmer' || !villagers.includes(f.by));
    const f = F.fields.find(f => f.state === 'reif' && free(f)) || F.fields.find(f => f.state === 'leer' && free(f));
    if (f) { f.by = v; v.field = f; const p = fieldFront(f); walk(v, p.x, p.z, f.state === 'reif' ? 'harvest' : 'sow'); return; }
    if (F.milk >= 1 || F.eggs >= 2 || F.pork >= 1 || Math.random() < .3) { const p = farmPt(F, FARM.trough[0] + rnd(.3), FARM.pen.z1 + .35); walk(v, p.x, p.z, 'tend'); return; }
    atHut(v);
  },
  miller(v) { procJob(v); }, // mahlt, was die Träger an Korn bringen
  baker(v) { procJob(v); },  // backt aus dem gebrachten Mehl Brot
  mason(v) { // Felsen in der Nähe suchen, Steine abschlagen (der Felsen wird kleiner), je zwei an der Hütte ablegen
    if (v.stones > 0 && !(v.rock && rocks.includes(v.rock))) { v.carry = 11; walkDrop(v, { stone: v.stones }); v.stones = 0; return; }
    const r = v.rock && rocks.includes(v.rock) ? v.rock : findRock(v); if (!r) { atHut(v); return; }
    r.by = v; v.rock = r; const dx = v.hut.x - r.x, dz = v.hut.z - r.z, d = Math.hypot(dx, dz) || 1, a = Math.atan2(dz, dx) + rnd(.6), R = r.s * .95 + .2;
    walk(v, r.x + Math.cos(a) * R, r.z + Math.sin(a) * R, 'quarry');
  },
  miner(v) { // in den Stollen, eine Weile drinnen hacken, mit Steinen herauskommen und sie vor der Mine ablegen
    const p = hutDoor(v.hut, .05); if (Math.hypot(v.x - p.x, v.z - p.z) > .3) { walk(v, p.x, p.z, 'mine'); return; }
    v.state = 'mine'; v.timer = 7 + Math.random() * 3;
  },
  sawyer(v) { // bleibt an der Säge und sägt, was die Träger bringen
    const p = hutWork(v.hut);
    if (Math.hypot(v.x - p.x, v.z - p.z) > .3) { walk(v, p.x, p.z, 'saw'); return; }
    startSaw(v);
  },
};
// Pfeile im Flug
const arrows = [], arrowGeo = mergeGeometries([new THREE.CylinderGeometry(.005, .005, .3, 4).rotateX(Math.PI / 2), new THREE.ConeGeometry(.012, .04, 4).rotateX(Math.PI / 2).translate(0, 0, .17)]);
const arrowMat = new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: .8 });
function shoot(v) {
  const a = v.prey; if (!a || !wild.includes(a) || a.state === 'dead') { v.prey = null; idle(v, .5); return; }
  const o = new THREE.Mesh(arrowGeo, arrowMat); o.userData.noSnow = true; scene.add(o);
  const hit = a.stun > 0 || Math.random() < (a.kind === 'reh' ? .55 : .65), tx = a.x + (hit ? 0 : rnd(.8)), tz = a.z + (hit ? 0 : rnd(.8));
  arrows.push({ o, v, a, hit, x0: v.x + Math.sin(v.h) * .1, z0: v.z + Math.cos(v.h) * .1, y0: v.y + .32, x1: tx, z1: tz, y1: heightAt(tx, tz) + (a.kind === 'reh' ? .35 : .1), t: 0, dur: Math.hypot(tx - v.x, tz - v.z) / 9, stuck: 0 });
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const r = arrows[i];
    if (r.stuck > 0) { r.stuck -= dt; if (r.stuck <= 0) { scene.remove(r.o); arrows.splice(i, 1); } continue; }
    r.t = Math.min(1, r.t + dt / r.dur); const k = r.t, arc = Math.sin(k * Math.PI) * .25;
    const x = r.x0 + (r.x1 - r.x0) * k, z = r.z0 + (r.z1 - r.z0) * k, y = r.y0 + (r.y1 - r.y0) * k + arc;
    r.o.position.set(x, y, z); r.o.lookAt(r.x1, r.y1 + (k < .5 ? arc : -arc * .5), r.z1);
    if (r.t >= 1) {
      r.stuck = 4;
      if (r.hit && wild.includes(r.a) && r.a.state !== 'dead') { killAnimal(r.a); floatText(r.a.x, heightAt(r.a.x, r.a.z) + .7, r.a.z, 'Treffer!', 'w'); scene.remove(r.o); r.stuck = 0; arrows.splice(i, 1); }
      else { r.a.threatT = 0; r.a.state = 'idle'; r.a.timer = 0; if (r.v.prey === r.a) r.v.prey = null; floatText(r.x1, r.y1 + .5, r.z1, 'Daneben', 'w'); }
    }
  }
}
// Angeln: auswerfen, warten, Biss, einholen; ein Fisch in der Nähe der Pose beißt eher (und fehlt dann im Meer)
function startFishing(v) { const J = v.hut.jetty; v.state = 'fish'; v.fp = 'cast'; v.timer = .9; v.h = Math.atan2(J.dx, J.dz); }
function fishStep(v, dt) {
  const J = v.hut && v.hut.jetty; if (!J) { idle(v, .5); return; }
  v.timer -= dt * workMul(v);
  if (v.timer > 0) return;
  if (v.fp === 'cast') { v.fp = 'wait'; v.timer = 3 + Math.random() * 6; return; }
  if (v.fp === 'wait') { v.fp = 'bite'; v.timer = .9; return; }
  if (v.fp === 'bite') { // Anhieb: hängt ein Fisch dran? Dann die Schnur einholen (Rolle kurbeln)
    let near = -1, nd = 8 * 8; fish.forEach((f, i) => { const d = (f.x - J.bob.x) ** 2 + (f.z - J.bob.z) ** 2; if (d < nd && !f.jump) { nd = d; near = i; } });
    v.hooked = near >= 0 || Math.random() < .35;
    if (near >= 0 && v.hooked) fish.splice(near, 1);
    if (v.hooked) splash(J.bob.x, J.bob.z);
    v.fp = 'reel'; v.timer = REEL_T; return;
  }
  // eingeholt: Fisch in den Korb oder leerer Haken
  if (v.hooked) { v.catch = (v.catch || 0) + 1; floatText(v.x, v.y + .7, v.z, 'Fisch!', 'h'); } else floatText(v.x, v.y + .7, v.z, 'Nichts', 'w');
  v.hooked = false;
  if (v.catch >= 3) { v.catch = 0; v.carry = 4; walkDrop(v, { fish: 3 }); return; }
  v.fp = 'cast'; v.timer = .9;
}
const REEL_T = 2.2;
const lines = [], LINE_N = 12;
function updateFishingLines(t) {
  const fishers = villagers.filter(v => v.state === 'fish' && v.hut && v.hut.jetty && !(v.fp === 'cast' && v.timer > .45));
  while (lines.length < fishers.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: .7 })); l.frustumCulled = false; scene.add(l);
    const b = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8352a, roughness: .5 })); b.userData.noSnow = true; scene.add(b);
    const f = new THREE.Mesh(fishGeo, fishMesh.material); f.userData.noSnow = true; f.scale.setScalar(1.3); scene.add(f); // Fisch am Haken
    lines.push({ l, b, f });
  }
  lines.forEach((L, k) => {
    const v = fishers[k]; L.l.visible = L.b.visible = !!v; L.f.visible = false; if (!v) return;
    const J = v.hut.jetty, dip = v.fp === 'bite' ? -.05 - Math.abs(Math.sin(t * 18)) * .04 : Math.sin(t * 2 + v.ph) * .015;
    if (!v.tip) { L.l.visible = L.b.visible = false; return; }
    const tipx = v.tip.x, tipz = v.tip.z, tipy = v.tip.y, arr = L.l.geometry.attributes.position.array;
    let bx = J.bob.x, bz = J.bob.z, by = -.02 + dip, sag = v.fp === 'bite' ? .03 : .22;
    if (v.fp === 'cast') { // Pose fliegt im Bogen hinaus
      const u = smooth(.45, 0, v.timer); bx = tipx + (J.bob.x - tipx) * u; bz = tipz + (J.bob.z - tipz) * u; by = tipy + (-.02 - tipy) * u + Math.sin(u * Math.PI) * .7; sag = .02;
    } else if (v.fp === 'reel') { // einholen: Pose (und Fisch) kommen heran, zum Schluss aus dem Wasser bis unter die Rutenspitze
      const u = 1 - v.timer / REEL_T, e = smooth(0, 1, u), lift = smooth(.72, 1, u);
      bx = J.bob.x + (tipx - J.bob.x) * e * .97; bz = J.bob.z + (tipz - J.bob.z) * e * .97; by = -.02 + (tipy - .32 - -.02) * lift + (v.hooked && lift < .05 ? Math.sin(t * 22) * .03 : 0); sag = .02;
      if (v.hooked) { // zappelt am Haken
        L.f.visible = true; L.f.position.set(bx, by - (lift > 0 ? .13 : .03), bz);
        L.f.rotation.set(lift > 0 ? Math.PI / 2 : 0, v.h + Math.sin(t * 17) * .5, lift > 0 ? Math.sin(t * 23) * .4 : Math.sin(t * 20) * .3, 'YXZ');
      }
    }
    for (let k = 0; k < LINE_N; k++) { const u = k / (LINE_N - 1); arr[k * 3] = tipx + (bx - tipx) * u; arr[k * 3 + 1] = tipy + (by - tipy) * u - Math.sin(u * Math.PI) * sag * (1 - u * .5); arr[k * 3 + 2] = tipz + (bz - tipz) * u; }
    L.l.geometry.attributes.position.needsUpdate = true;
    L.b.position.set(bx, by, bz);
  });
}
function procJob(v) { const p = hutWork(v.hut); if (Math.hypot(v.x - p.x, v.z - p.z) > .3) { walk(v, p.x, p.z, 'proc'); return; } startProc(v); }
function startProc(v) {
  const hs = v.hut, P = PROC[v.role], q = v.role === 'baker' && hs.oven ? hs.oven : hs; v.h = Math.atan2(q.x - v.x, q.z - v.z);
  if (hs.inp >= P.n) { hs.inp -= P.n; v.state = 'proc'; v.timer = P.t; } else idle(v, 1.5); // wartet auf Nachschub
}
function startSaw(v) {
  const hs = v.hut, sw = localPt(hs, .28, .12); v.h = Math.atan2(sw.x - v.x, sw.z - v.z);
  if (hs.logs >= 1) { hs.logs--; v.carry = 1; v.state = 'saw'; v.timer = 2.4; } else idle(v, 1); // wartet auf Stämme
}
// Ein Bewohner belädt die Kreatur (kreatur.md 3.13 B): geht neben sie und hebt die Waren nacheinander auf ihren Rücken.
// job = { x, z (wo er steht), fx, fz (wo die Kreatur liegt), n, res, onItem(), onDone(), onAbort() }
const LOAD_T = 1.1, rideP = new THREE.Vector3();
function helpLoad(v, job) {
  if (v.tree) { v.tree.reserved = null; v.tree = null; }
  v.load = job; walk(v, job.x, job.z, 'loadFox');
}
// Ein Bewohner reitet auf der Kreatur (kreatur.md 3.13 B): seat(out) liefert den Sitzplatz (Weltposition) und gibt die
// Blickrichtung zurück; done() ruft die Kreatur, wenn der Ritt vorbei ist (dropRide setzt ihn daneben ab)
function startRide(v, seat) {
  if (v.tree) { v.tree.reserved = null; v.tree = null; }
  v.state = 'ride'; v.seat = seat; v.cheer = 1.5;
}
function dropRide(v, x, z) { if (v.state !== 'ride') return; v.seat = null; v.x = x; v.z = z; v.cheer = 2; idle(v, .6); }
// abgebrochen (gegriffen, geflohen, eingeschlafen): die Kreatur wartet nicht länger
function dropLoad(v) { const j = v.load; if (!j) return; v.load = null; v.carry = 0; if (j.onAbort) j.onAbort(); }
function arrive(v) {
  switch (v.next) {
    case 'loadFox': if (v.load) { v.state = 'loadFox'; v.timer = LOAD_T; v.carry = RES[v.load.res] ? RES[v.load.res][2] : 8; v.h = Math.atan2(v.load.fx - v.x, v.load.fz - v.z); } else idle(v, .3); break;
    case 'tree': if (v.tree && v.tree.alive) { v.state = 'chop'; v.timer = 2.4; v.cp = 0; v.h = Math.atan2(v.tree.x - v.x, v.tree.z - v.z); } else { if (v.tree) v.tree.reserved = null; v.tree = null; idle(v, .4); } break;
    case 'store': v.carry = 0; addLogs(1, v.x, v.y + .2, v.z); idle(v, .4); break;
    case 'saw': if (v.role === 'sawyer' && v.hut) startSaw(v); else idle(v, .4); break;
    case 'quarry': { const r = v.rock; if (v.role === 'mason' && r && rocks.includes(r) && r.by === v) { v.state = 'quarry'; v.timer = QUARRY_T; v.cp = 0; v.h = Math.atan2(r.x - v.x, r.z - v.z); } else { if (r && r.by === v) r.by = null; v.rock = null; idle(v, .4); } break; }
    case 'mine': if (v.role === 'miner' && v.hut) { v.state = 'mine'; v.timer = 7 + Math.random() * 3; } else idle(v, .4); break;
    case 'aim': { // in Schussweite: zielen (ist das Tier weitergezogen, neu anpirschen)
      const a = v.prey; v.stalk = false;
      if (!a || !wild.includes(a) || a.state === 'dead' || Math.hypot(a.x - v.x, a.z - v.z) > 7) { v.prey = a && a.state === 'dead' ? a : null; idle(v, .3); break; }
      v.state = 'aim'; v.timer = 1.3; v.h = Math.atan2(a.x - v.x, a.z - v.z); break;
    }
    case 'pickup': { const a = v.prey; if (a && a.state === 'dead' && wild.includes(a)) { const n = a.kind === 'reh' ? 3 : 1; removeAnimal(a); v.carry = 3; walkDrop(v, { meat: n }); } else idle(v, .3); v.prey = null; break; }
    case 'dropHut': putDown(v); idle(v, .4); break;
    case 'pickFeed': { // Träger holt Korn oder Mehl im Lager
      const H = v.haul, n = H ? Math.min(H.n, Math.floor(S[H.res])) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      S[H.res] -= n; H.n = n; v.carry = RES[H.res][2]; const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + rnd(.2), 'dropFeed'); break;
    }
    case 'dropFeed': if (v.haul) { v.haul.hut.inp += v.haul.n; floatText(v.x, v.y + .6, v.z, `${resText(v.haul.res, v.haul.n)} abgeladen`, 'h'); } v.carry = 0; v.haul = null; idle(v, .3); break;
    case 'proc': if (PROC[v.role] && v.hut) startProc(v); else idle(v, .4); break;
    case 'pickGoods': { // Träger nimmt Ware an einer Hütte auf
      const H = v.haul, n = H ? Math.min(H.n, Math.floor(H.hut.goods[H.res] || 0)) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      H.hut.goods[H.res] -= n; H.n = n; v.carry = RES[H.res][2]; const p = lagerDrop(); walk(v, p.x, p.z, 'deliver'); break;
    }
    case 'sow': case 'harvest': { const f = v.field; if (f && f.by === v && f.state === (v.next === 'sow' ? 'leer' : 'reif')) { v.state = v.next; v.timer = (v.next === 'sow' ? 3 : 2.4) * DIG_T; v.cp = 0; v.h = Math.atan2(f.x - v.x, f.z - v.z); } else { if (f && f.by === v) f.by = null; v.field = null; idle(v, .3); } break; }
    case 'tend': if (v.hut && v.hut.farm) { v.state = 'tend'; v.timer = 3.5; v.hut.farm.feedT = 9; const T = farmPt(v.hut.farm, FARM.trough[0], FARM.trough[1]); v.h = Math.atan2(T.x - v.x, T.z - v.z); } else idle(v, .3); break;
    case 'fishspot': if (v.role === 'fisher' && v.hut && v.hut.jetty) startFishing(v); else idle(v, .3); break;
    case 'pickLogs': { // Träger nimmt Stämme im Lager
      const H = v.haul, n = H ? Math.min(H.n, Math.floor(S.logs)) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      S.logs -= n; H.n = n; v.carry = 1; const p = hutWork(H.hut); walk(v, p.x + rnd(.2), p.z + .2, 'dropLogs'); break;
    }
    case 'dropLogs': if (v.haul) { v.haul.hut.logs += v.haul.n; floatText(v.x, v.y + .6, v.z, `${v.haul.n} ${v.haul.n === 1 ? 'Stamm' : 'Stämme'} abgeladen`, 'h'); } v.carry = 0; v.haul = null; idle(v, .3); break;
    case 'pickPlanks': { // Träger holt Bretter an der Säge
      const H = v.haul, n = H ? Math.min(H.n, H.hut.planks) : 0;
      if (!n) { v.haul = null; idle(v, .5); break; }
      H.hut.planks -= n; H.n = n; v.carry = 2; const p = lagerDrop(); walk(v, p.x, p.z, 'deliver'); break;
    }
    case 'deliver': { const H = v.haul, n = H ? H.n : 2; v.carry = 0; v.haul = null;
      if (H && H.res === 'logs') addLogs(n, v.x, v.y + .2, v.z); else if (H && H.res) { S[H.res] += n; floatText(v.x, v.y + .9, v.z, `+${resText(H.res, n)}`, 'h'); } else addHolz(n, v.x, v.y + .2, v.z);
      idle(v, .4); break; }
    case 'fetchSap': v.saplings = 3; idle(v, .9); break;
    case 'plant':
      if (v.plant && (!v.plant.tree || v.plant.tree.reserved === v)) { v.state = 'plant'; v.timer = 3 * DIG_T; v.cp = 0; const pt = v.plant.tree || v.plant; v.h = Math.atan2(pt.x - v.x, pt.z - v.z); }
      else { v.plant = null; idle(v, .3); }
      break;
    case 'pray': v.state = 'pray'; v.timer = 2 * PRAY_T; v.h = Math.atan2(SHRINE_POS.x - v.x, SHRINE_POS.z - v.z); break;
    case 'beg': if (v.wish && wish.kind) { v.state = 'beg'; v.timer = 0; v.h = Math.atan2(wish.at.x - v.x, wish.at.z - v.z); } else idle(v, .3); break;
    case 'giftPick': { const k = v.gift === true && takePortion(); if (!k) { endGift(v); idle(v, .4); break; } v.gift = k; v.carry = RES[k][2]; goGift(v); break; }
    case 'gift': { // auf den Altar legen, einmalig Glaube
      const k = v.gift; if (!k || k === true || !v.carry) { endGift(v); idle(v, .3); break; }
      v.carry = 0; v.gift = null; food.giftBy = null; food.gifts++; S.offer = { d: S.day, k };
      v.h = Math.atan2(SHRINE_POS.x - v.x, SHRINE_POS.z - v.z); floatText(v.x, v.y + 1.05, v.z, 'Gabe', 's'); addGlaube(GIFT_GLAUBE, v.x, v.y, v.z); spawnMote(v.x, v.y + .45, v.z);
      idle(v, 1.2); break;
    }
    case 'lunch': eatLunch(v); v.state = 'lunch'; v.until = LUNCH[1] + Math.random() * .4; v.h = Math.atan2(LUNCH_AT.x - v.x, LUNCH_AT.z - v.z); break;
    case 'sleep': // verschwindet in der Hütte, wacht morgens zu einer eigenen Zeit auf
      if (S.hour >= BED || S.hour < WAKE) { v.state = 'sleep'; v.wake = WAKE + Math.random() * .9; if (v.home) v.h = Math.atan2(v.home.x - v.x, v.home.z - v.z) + Math.PI; }
      else idle(v, .3);
      break;
    default: idle(v, .8 + Math.random() * 2.5);
  }
}
function updateVillager(v, dt, t) {
  if (v.load && !(v.state === 'loadFox' || (v.state === 'walk' && v.next === 'loadFox'))) dropLoad(v);
  if (v.haste > 0) v.haste -= dt;
  if (v.cheer > 0) v.cheer -= dt;
  const sp = .95 * (v.haste > 0 ? 2.3 : 1) * (v.stalk && v.state === 'walk' && v.next === 'aim' ? .55 : 1); // anpirschen: langsamer
  switch (v.state) {
    case 'idle': v.timer -= dt; if (v.timer <= 0) chooseJob(v); break;
    case 'walk':
      if (v.next === 'aim' && v.prey) { // Jäger: in Schussweite stehen bleiben, sonst den Weg ab und zu zur ziehenden Beute neu legen
        const d = Math.hypot(v.prey.x - v.x, v.prey.z - v.z);
        if (d < (v.prey.kind === 'reh' ? 5.2 : 4.2)) { arrive(v); break; }
        if ((v.aimT = (v.aimT || 0) - dt) <= 0) { v.aimT = 2; const dx = v.x - v.prey.x, dz = v.z - v.prey.z, l = Math.hypot(dx, dz) || 1; setGoal(v, v.prey.x + dx / l * 4, v.prey.z + dz / l * 4, navV); }
      }
      addWear(v.x, v.z, dt); if (followPath(v, sp * dt)) arrive(v); break;
    case 'chop': {
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v), before = v.cp % 1; v.timer -= k; v.cp += k / CHOP_T;
      const tr = v.tree, now = v.cp % 1;
      if (tr && tr.alive && ((before < CHOP_HIT && now >= CHOP_HIT) || (now < before && before < CHOP_HIT))) { // Treffer
        tr.shake = 1; spawnChips(tr.x - Math.sin(v.h) * .08, surfaceAt(tr.x, tr.z) + .22, tr.z - Math.cos(v.h) * .08, v.h);
      }
    }
      if (v.timer <= 0) { const tr = v.tree; v.tree = null; if (tr && tr.alive) { chopTree(tr); fallTree(tr, v.x, v.z, 2.4); v.carry = 1; walkDrop(v, { logs: 1 }); } else idle(v, .4); } break;
    case 'quarry': { // mit der Spitzhacke auf den Felsen, Splitter fliegen; jede Runde ein Stein, der Felsen wird kleiner
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v), before = v.cp % 1, r = v.rock; v.timer -= k; v.cp += k / CHOP_T;
      const now = v.cp % 1;
      if (r && ((before < CHOP_HIT && now >= CHOP_HIT) || (now < before && before < CHOP_HIT))) spawnChips(v.x + Math.sin(v.h) * .3, surfaceAt(v.x, v.z) + .15, v.z + Math.cos(v.h) * .3, v.h, 0xa7a29a);
      if (v.timer > 0) break;
      if (!r || !rocks.includes(r)) { v.rock = null; idle(v, .3); break; }
      r.s -= ROCK_STEP; v.stones = (v.stones || 0) + 1;
      { const d = Math.hypot(r.x - v.x, r.z - v.z), want = r.s * .95 + .2; if (d > want + .05) { const k2 = (d - want) / d; v.x += (r.x - v.x) * k2; v.z += (r.z - v.z) * k2; } } // der Felsen wird kleiner: nachrücken
      if (r.s < ROCK_MIN) { removeRock(r); v.rock = null; floatText(r.x, heightAt(r.x, r.z) + .6, r.z, 'Felsen abgebaut', 's'); }
      if (v.stones >= 2 || !v.rock) { if (v.rock && v.rock.by === v) v.rock.by = null; v.rock = null; v.carry = 11; walkDrop(v, { stone: v.stones }); v.stones = 0; }
      else { v.timer = QUARRY_T; v.cp = 0; }
      break;
    }
    case 'mine': { // im Stollen (unsichtbar); ab und zu staubt es am Eingang
      v.timer -= dt * (v.haste > 0 ? 2 : 1) * workMul(v);
      if (Math.random() < dt * .8) { const p = hutDoor(v.hut, -.1); spawnChips(p.x, surfaceAt(p.x, p.z) + .2, p.z, v.hut.o.rotation.y + Math.PI, 0x8f8a82); }
      if (v.timer <= 0) { const p = hutDoor(v.hut, .1); v.x = p.x; v.z = p.z; v.carry = 11; walkDrop(v, { stone: 2 }); }
      break;
    }
    case 'pray': {
      const k = dt * (v.haste > 0 ? 2 : 1), before = ((2 * PRAY_T - v.timer) / PRAY_T) % 1; v.timer -= k;
      const now = ((2 * PRAY_T - v.timer) / PRAY_T) % 1;
      if (before < .4 && now >= .4 && v.timer > 0) spawnMote(v.x + Math.sin(v.h) * .05, v.y + .45, v.z + Math.cos(v.h) * .05); // Arme oben: Funke steigt auf
    }
      if (v.timer <= 0) { addGlaube(prayYield() * prayMul(v), v.x, v.y, v.z); idle(v, 1 + Math.random() * 3); } break;
    case 'lunch': if (S.hour >= v.until || S.hour < LUNCH[0]) idle(v, Math.random() * 1.5); break;
    case 'aim': { const a = v.prey; if (a && wild.includes(a) && a.state !== 'dead') v.h = Math.atan2(a.x - v.x, a.z - v.z); v.timer -= dt; if (v.timer <= 0) { shoot(v); idle(v, .9); } break; }
    case 'fish': fishStep(v, dt); break;
    case 'beg': // kniet und fleht, ab und zu steigt ein Funke auf
      if (!v.wish || !wish.kind) { idle(v, .4); break; }
      v.timer += dt; if (v.timer > 1.6) { v.timer = 0; spawnMote(v.x, v.y + .45, v.z); } break;
    case 'saw': { // Stamm an der Kreissäge entlangschieben, Sägemehl fliegt
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v); v.timer -= k; if (v.hut) v.hut.sawing = .3;
      if (Math.random() < dt * 6 && v.hut) { const sw = localPt(v.hut, .28, .12); spawnChips(sw.x, heightAt(sw.x, sw.z) + .45, sw.z, v.h + Math.PI); }
      if (v.timer <= 0) { v.carry = 0; if (v.hut) { v.hut.planks += 2; floatText(v.x, v.y + .7, v.z, '+2 Bretter', 'h'); } idle(v, .2); }
      break;
    }
    case 'plant': {
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v), before = v.cp % 1; v.timer -= k; v.cp += k / DIG_T;
      const now = v.cp % 1; if ((before < .55 && now >= .55) || now < before) spawnChips(v.x + Math.sin(v.h) * .2, v.y + .03, v.z + Math.cos(v.h) * .2, v.h + Math.PI);
      if (v.timer <= 0) {
        const sp = v.plant; v.plant = null; v.saplings = Math.max(0, (v.saplings || 0) - 1);
        let t = null;
        if (sp && sp.tree && sp.tree.reserved === v) { t = sp.tree; t.reserved = null; Object.assign(t, { alive: true, g: .12, stumpT: 0, regrow: 0, type: treeKindAt(t.x, t.z) }); }
        else if (sp && !sp.tree && !treeNear(sp.x, sp.z, .9) && !nearBuilding(sp.x, sp.z, .5)) t = addTree(sp.x, sp.z, .12);
        if (v.tree) { if (v.tree.reserved === v) v.tree.reserved = null; v.tree = null; }
        if (t) floatText(t.x, heightAt(t.x, t.z) + .5, t.z, 'Gepflanzt', 's');
        idle(v, .4);
      }
      break;
    }
    case 'sow': case 'harvest': { // in gebückter Haltung säen oder ernten, Erde fliegt
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v), before = v.cp % 1; v.timer -= k; v.cp += k / DIG_T;
      const now = v.cp % 1; if ((before < .55 && now >= .55) || now < before) spawnChips(v.x + Math.sin(v.h) * .25, v.y + .03, v.z + Math.cos(v.h) * .25, v.h + Math.PI);
      if (v.timer > 0) break;
      const f = v.field; v.field = null;
      if (!f || f.by !== v) { idle(v, .3); break; }
      f.by = null;
      if (v.state === 'sow' && f.state === 'leer') { f.state = 'grow'; f.g = 0; floatText(f.x, heightAt(f.x, f.z) + .5, f.z, `${CROPS[f.c].label} gesät`, 's'); idle(v, .4); }
      else if (v.state === 'harvest' && f.state === 'reif') { const n = CROPS[f.c].yield; floatText(f.x, heightAt(f.x, f.z) + .5, f.z, `${CROPS[f.c].label} geerntet`, 's'); f.state = 'leer'; f.g = 0; const r = CROPS[f.c].res || 'veg'; f.c = (f.c + 1) % CROPS.length; v.carry = RES[r][2]; walkDrop(v, { [r]: n }); }
      else idle(v, .3);
      break;
    }
    case 'tend': { // Futter in den Trog streuen, dann Milch, Eier und ab und zu Fleisch mitnehmen
      v.timer -= dt * workMul(v); if (v.timer > 0) break;
      const F = v.hut && v.hut.farm; if (!F) { idle(v, .3); break; }
      const g = { milk: Math.floor(F.milk), eggs: Math.floor(F.eggs), meat: Math.floor(F.pork) }; F.milk -= g.milk; F.eggs -= g.eggs; F.pork -= g.meat;
      if (g.milk + g.eggs + g.meat > 0) { v.carry = g.milk ? 6 : g.eggs ? 7 : 3; walkDrop(v, g); } else idle(v, 1);
      break;
    }
    case 'proc': { // mahlen bzw. backen
      const k = dt * (v.haste > 0 ? 2 : 1) * workMul(v), P = PROC[v.role]; v.timer -= k; if (v.hut) v.hut.busy = .5;
      if (!P || !v.hut) { idle(v, .3); break; }
      if (v.role === 'miller' && Math.random() < dt * 3) { const q = localPt(v.hut, .2, .5); spawnChips(q.x, heightAt(q.x, q.z) + .25, q.z, Math.random() * 6.28); } // Mehlstaub
      if (v.timer <= 0) { v.hut.goods[P.out] = (v.hut.goods[P.out] || 0) + P.m; floatText(v.x, v.y + .7, v.z, `+${resText(P.out, P.m)}`, 'h'); idle(v, .3); }
      break;
    }
    case 'sleep': if (S.hour >= v.wake && S.hour < BED) idle(v, .2 + Math.random()); break;
    case 'loadFox': { // anheben, über den Rücken schwingen, ablegen; dann das nächste Stück
      const j = v.load; if (!j) { idle(v, .3); break; }
      v.h = Math.atan2(j.fx - v.x, j.fz - v.z); v.timer -= dt;
      if (v.timer < LOAD_T * .35 && v.carry) { v.carry = 0; j.onItem(); }
      if (v.timer <= 0) { if (--j.n > 0) { v.timer = LOAD_T; v.carry = RES[j.res] ? RES[j.res][2] : 8; } else { v.load = null; j.onDone(); idle(v, .5); } }
      break;
    }
    case 'flee': v.timer -= dt; if (moveFree(v, v.tx, v.tz, 2.2 * dt, navV) === true || v.timer <= 0) idle(v, .6); break;
    case 'dizzy': v.timer -= dt; v.h += dt * 9; if (v.timer <= 0) idle(v, .3); break;
    case 'grabbed': return;
    case 'ride': { if (!v.seat) { idle(v, .3); break; } const p = rideP; v.h = v.seat(p); v.x = p.x; v.y = p.y; v.z = p.z; return; }
    case 'falling': {
      v.vy -= 16 * dt; v.x = clamp(v.x + v.vx * dt, -HALF * .95, HALF * .95); v.z = clamp(v.z + v.vz * dt, -HALF * .95, HALF * .95); v.y += v.vy * dt;
      const g = surfaceAt(v.x, v.z);
      if (v.y <= g && v.vy < 0) {
        v.y = g; const spd = Math.hypot(v.vx, v.vy, v.vz); v.vx = v.vz = v.vy = 0;
        if (seaAt(v.x, v.z, -.1)) { floatText(v.x, v.y + .6, v.z, 'Platsch!', 'w'); walk(v, v.x * .55, v.z * .55, 'rest'); }
        else if (spd > 7.5) { floatText(v.x, v.y + .6, v.z, 'Uff!', 'w'); v.state = 'dizzy'; v.timer = 1.8; addGlaube(1, v.x, v.y + .3, v.z); }
        else idle(v, .5);
      }
      return;
    }
  }
  v.y = groundAt(v.x, v.z); // auf dem Steg der Fischer auf Deckhöhe
}

// Nachts steigt ab und zu ein „Zzz“ über einem Haus auf, in dem jemand schläft
let zzzT = 3;
function updateSleepers(dt) {
  zzzT -= dt;
  if (zzzT <= 0) { zzzT = 2.2 + Math.random() * 1.5; const sl = villagers.filter(v => v.state === 'sleep' && v.home); if (sl.length) { const hs = sl[Math.floor(Math.random() * sl.length)].home; floatText(hs.x + rnd(.2), heightAt(hs.x, hs.z) + 1.9, hs.z + rnd(.2), 'Zzz', 'w'); } }
}
const wish = { kind: null, t: 0, dur: 90, by: null, cool: 25, checkT: 0, at: SHRINE_POS };
const begSpot = () => shrinePt(rnd(.25), 1.95 + Math.random() * .15);
function goBeg(v) { const p = begSpot(); walk(v, p.x, p.z, 'beg'); }

export { JOB, LOAD_T, MILL_BUF, REEL_T, arrows, dropLoad, dropRide, goBeg, hauling, helpLoad, idle, startRide, putDown, startFishing, updateArrows, updateFishingLines, updateSleepers, updateVillager, wish };
