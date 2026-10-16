// Test (Branch claude/vierbeiner-test): Animationen und Handlungen des Vierbeiners einzeln ansehen. Im Charakterbogen
// „Testen“ schaltet die Nahsicht ein und zeigt unten eine Leiste: oben alle Animationen des Rigs (die Kreatur hält an,
// fox.state = 'test'), darunter die Handlungen aus kreatur.md 3.13 (Baum schleifen, selbst aufladen, beladen lassen,
// Schwanz fegt, Ritual). „Weiter“ lässt sie wieder normal laufen.

import { $ } from '../core/util.js';
import { S, emit, on } from '../core/state.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { foxActs, foxMixer } from '../creature/creature.js';
import { foxDo, foxDrop, foxIdle } from '../creature/ai.js';
import { resetOver } from '../creature/body.js';
import { startRitual } from '../creature/ritual.js';
import { closeSheets, setObserve } from './sheets.js';

const LABEL = { idle: 'Stehen', idle2: 'Stehen 2', eat: 'Fressen', walk: 'Gehen', run: 'Rennen', attack: 'Angriff', hit: 'Getroffen', jump: 'Springen',
  lieDown: 'Hinlegen', lie: 'Liegen', standUp: 'Aufstehen', sitDown: 'Aufladen beginnen', sit: 'Aufladen', cast: 'Aufbäumen', praise: 'Freuen (Lob)', scold: 'Ducken (Tadel)' };
// Handlungen nach den drei Stufen (kreatur.md 3.13): Körper, Bewohner, Magie
// Gezeigt wird nur, was die gewählte Gestalt kann (kinds.js, acts)
const ACTS = [['tree', 'Baum bringen'], ['self', 'Selbst aufladen'], ['push', 'Stamm rollen'], ['plant', 'Graben und pflanzen'], ['sweep', 'Schwanz fegt'],
  ['forage', 'Pilze suchen'], ['pest', 'Hasen verjagen'], ['plow', 'Pflügen'], ['rock', 'Felsen schieben'], ['villager', 'Bewohner belädt'], ['ride', 'Reiten'],
  ['rain', 'Ritual: Regen'], ['haste', 'Ritual: Eile'], ['move', 'Lichtranken: Felsen']];
function canDo(k) { const A = CREATURES[fox.kind].acts; return ['tree', 'push', 'villager', 'ride'].includes(k) || (k === 'self' && A.toss) || A.help.includes(k) || A.rites.includes(k); }
const GEAR = [['basket', 'Korb'], ['bags', 'Satteltaschen'], ['cart', 'Karren']];

function mark(list, key, val) { for (const b of $(list).children) b.setAttribute('aria-pressed', String(b.dataset[key] === val)); }
function anim(name) {
  const a = foxActs[name]; if (!a) return false;
  foxDrop(); resetOver(); fox.state = 'test'; fox.once = 0;
  foxMixer.stopAllAction(); a.reset().play(); fox.cur = name;
  $('quadTestNow').textContent = LABEL[name] || name; mark('quadTestList', 'a', name); mark('quadTestActs', 'h', null);
  return true;
}
function act(kind) {
  if (fox.state === 'test') { foxMixer.stopAllAction(); fox.cur = null; foxIdle(0); }
  let msg;
  if (['rain', 'haste', 'move'].includes(kind)) {
    const fill = S.glaube < 30; if (fill) S.glaube = 30; // für den Test genug Glaube
    msg = startRitual(kind) || (fill ? 'Glaube für den Test aufgefüllt.' : '');
  } else msg = foxDo(kind);
  $('quadTestNow').textContent = msg || ACTS.find(x => x[0] === kind)[1];
  mark('quadTestList', 'a', null); mark('quadTestActs', 'h', msg ? null : kind);
}
function startTest() {
  closeSheets(); setObserve(true); $('foxCard').hidden = true;
  $('quadTestList').innerHTML = Object.keys(foxActs).map(k => `<button data-a="${k}" aria-pressed="false">${LABEL[k] || k}</button>`).join('');
  $('quadTestActs').innerHTML = ACTS.filter(([k]) => canDo(k)).map(([k, l]) => `<button data-h="${k}" aria-pressed="false">${l}</button>`).join('');
  $('quadTest').hidden = false; anim('idle');
}
function stopTest() {
  $('quadTest').hidden = true; if (fox.state === 'test') { foxMixer.stopAllAction(); fox.cur = null; foxIdle(1); }
  mark('quadTestActs', 'h', null); setObserve(true);
}
// Ausrüstung im Test an- und ablegen (sonst in den Werkstätten gegen Bretter, Charakterbogen)
function renderGear() { $('quadTestGear').innerHTML = GEAR.map(([k, l]) => `<button data-g="${k}" aria-pressed="${!!S.cGear[k]}">${l}</button>`).join(''); }
$('quadTestGear').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; S.cGear[b.dataset.g] = !S.cGear[b.dataset.g]; renderGear(); emit('fox'); });
renderGear(); on('fox', renderGear);

$('btnQuadTest').addEventListener('click', startTest);
$('quadTestEnd').addEventListener('click', stopTest);
$('quadTestList').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) anim(b.dataset.a); });
$('quadTestActs').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) act(b.dataset.h); });

export { act, anim, startTest, stopTest };
