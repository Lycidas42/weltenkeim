// Test (Branch claude/zweibeiner-test): Animationen der Kreatur einzeln ansehen. Im Charakterbogen „Animationen testen“
// hält die Kreatur an (fox.state = 'test', ihr Verhalten ruht), schaltet die Nahsicht ein und zeigt unten eine Leiste
// mit allen Animationen des Modells; „Weiter“ lässt sie wieder normal laufen.

import { $ } from '../core/util.js';
import { fox } from '../creature/kinds.js';
import { foxMixer, loadCreature } from '../creature/creature.js';
import { foxIdle } from '../creature/ai.js';
import { closeSheets, setObserve } from './sheets.js';

// bekannte Namen auf Deutsch (sonst der Name aus der Datei)
const LABEL = { Idle_Loop: 'Stehen', Idle_FoldArms_Loop: 'Arme verschränken', Walk_Loop: 'Gehen', Jog_Fwd_Loop: 'Laufen', Walk_Carry_Loop: 'Gehen mit Last',
  TreeChopping_Loop: 'Holz hacken', PickUp_Table: 'Vom Tisch nehmen', Hit_Chest: 'Getroffen', Spell_Simple_Shoot: 'Zaubern', Yes: 'Ja', Idle_No_Loop: 'Nein',
  LayToIdle: 'Vom Liegen aufstehen', Farm_Harvest: 'Ernten', Farm_PlantSeed: 'Säen', Farm_Watering: 'Gießen', Interact: 'Hantieren', OverhandThrow: 'Werfen',
  Curl_Down: 'Einrollen', Curl_Idle: 'Eingerollt schlafen', Lift_Ground: 'Vom Boden aufheben', Hold_Idle: 'Last halten' };
let clips = [];
async function anims() { clips = (await loadCreature(fox.kind)).animations; return clips.map(c => c.name); }
function anim(name) {
  const clip = clips.find(c => c.name === name); if (!clip) return false;
  fox.state = 'test'; foxMixer.stopAllAction(); foxMixer.clipAction(clip).reset().play(); fox.cur = 'test:' + name; fox.once = 0;
  $('animTestNow').textContent = LABEL[name] || name;
  for (const b of $('animTestList').children) b.setAttribute('aria-pressed', String(b.dataset.a === name));
  return true;
}
async function startTest() {
  if (fox.tree) { fox.tree.reserved = null; fox.tree = null; }
  fox.carry = false; fox.carryGoods = null; fox.haul = null; fox.act = null; fox.state = 'test';
  closeSheets(); setObserve(true); $('foxCard').hidden = true;
  const names = await anims();
  $('animTestList').innerHTML = names.map(n => `<button data-a="${n}" aria-pressed="false">${LABEL[n] || n}</button>`).join('');
  $('animTest').hidden = false; anim(names.includes('Idle_Loop') ? 'Idle_Loop' : names[0]);
}
function stopTest() {
  $('animTest').hidden = true; foxMixer.stopAllAction(); fox.cur = null; foxIdle(1); setObserve(true);
}
$('btnAnimTest').addEventListener('click', startTest);
$('animTestEnd').addEventListener('click', stopTest);
$('animTestList').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) anim(b.dataset.a); });

export { anim, anims, startTest, stopTest };
