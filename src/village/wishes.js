// Bitten am Schrein

import { $, clamp, rnd } from '../core/util.js';
import { S } from '../core/state.js';
import { canvas, tA, toScreen } from '../core/render.js';
import { addGlaube, floatText, toast } from '../ui/feedback.js';
import { BED, workTime } from '../world/sky.js';
import { shrinePt } from './layout.js';
import { trees } from '../world/trees.js';
import { shrine, spawnMote } from './shrine.js';
import { villagers } from './villagers.js';
import { goBeg, idle, wish } from './ai.js';
import { roleCount } from './jobs.js';

// Braucht das Dorf ein Wunder, kniet ein freier Bewohner vor dem Schrein und bittet darum. Erfüllt der Spieler die Bitte
// rechtzeitig, danken die Bewohner mit Glauben (mehr, als das Wunder kostet). Später können kleinere Schreine im Wald
// eigene Bitten haben; dafür ist `wish.at` der Ort, an dem gebetet wird.
const ICON_RAIN = '<svg viewBox="0 0 24 24"><path d="M7 15a4.5 4.5 0 0 1 .6-8.96A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/></svg>';
const ICON_HASTE = '<svg viewBox="0 0 24 24"><path d="M3 12c4-1 7-4 9-8 1 4 4 6 9 7-5 1-8 3-9 7-2-4-5-5-9-6z"/></svg>';
const WISHES = {
  rain: { title: 'Bitte um Regen', text: 'Der Wald schwindet. Die Bewohner bitten dich um Regen für die Bäume.', thanks: 'den Regen', icon: ICON_RAIN,
    need: () => trees.filter(t => t.alive && !t.gone && t.g >= .7).length < 40 },
  haste: { title: 'Bitte um Eile', text: 'Im Lager stapeln sich die Stämme. Die Bewohner bitten dich um Eile für die Säger und Träger.', thanks: 'die Eile', icon: ICON_HASTE,
    need: () => S.logs >= 25 && roleCount('sawyer') > 0 },
};
function startWish(kind) {
  const free = villagers.filter(v => !v.role && !v.haul && !v.carry && !v.gift && ['idle', 'pray', 'walk'].includes(v.state) && v.next !== 'lunch'); // nicht auf dem Weg zum Mittagessen oder mit einer Gabe
  if (!free.length) return;
  free.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const v = free[0]; v.wish = true; goBeg(v);
  Object.assign(wish, { kind, t: wish.dur, by: v });
  toast(WISHES[kind].text, 5);
}
function endWish(cool) {
  const v = wish.by; if (v) { v.wish = false; if (v.state === 'beg') idle(v, .5); }
  wish.kind = null; wish.by = null; wish.cool = cool;
}
function updateWish(dt) {
  wish.cool -= dt;
  if (!wish.kind) {
    if ((wish.checkT -= dt) > 0) return; wish.checkT = 3;
    if (wish.cool > 0 || !workTime()) return;
    const kinds = Object.keys(WISHES).filter(k => WISHES[k].need());
    if (kinds.length) startWish(kinds[Math.floor(Math.random() * kinds.length)]);
    return;
  }
  wish.t -= dt;
  if (wish.t <= 0 || S.hour >= BED) { toast(`Die ${WISHES[wish.kind].title} blieb unerhört.`, 3.5); endWish(60); }
}
// ein Wunder wurde gewirkt: passt es zur Bitte, ist sie erfüllt
function wishDone(kind) {
  if (wish.kind !== kind) return;
  const reward = Math.round(25 + villagers.length * 1.2 + S.temple * 5), W = WISHES[kind];
  addGlaube(reward, wish.at.x, shrine.g.position.y + 2, wish.at.z);
  shrine.pulse = 1; for (let k = 0; k < 8; k++) { const q = shrinePt(rnd(1.5), 1.5 + rnd(.6)); spawnMote(q.x, shrine.g.position.y + .3, q.z); }
  for (const v of villagers) if (Math.hypot(v.x - wish.at.x, v.z - wish.at.z) < 7 && !['grabbed', 'falling', 'sleep'].includes(v.state)) v.cheer = 2.2 + Math.random() * .6;
  if (wish.by) floatText(wish.by.x, wish.by.y + .8, wish.by.z, 'Danke!', 's');
  toast(`Die Bewohner danken dir für ${W.thanks}: +${reward} Glaube.`, 4);
  endWish(100 + Math.random() * 60);
}
// Sprechblase über dem Schrein; Antippen wählt das passende Wunder
function placeWishUI() {
  const B = $('wish');
  B.hidden = !wish.kind || $('app').classList.contains('sheet-open');
  if (B.hidden) return;
  const W = WISHES[wish.kind];
  if (B.dataset.kind !== wish.kind) { B.dataset.kind = wish.kind; $('wishIc').innerHTML = W.icon; $('wishT').textContent = W.title; B.setAttribute('aria-label', `${W.title}: Tippen, um das Wunder zu wählen`); }
  $('wishBar').style.width = `${Math.max(0, wish.t / wish.dur * 100)}%`;
  const r = canvas.getBoundingClientRect(); toScreen(wish.at.x, shrine.g.position.y + 2.75, wish.at.z, tA);
  const bw = B.offsetWidth, bh = B.offsetHeight;
  B.style.transform = `translate(${clamp(tA.x - r.left - bw / 2, 8, r.width - bw - 8)}px, ${clamp(tA.y - r.top - bh, 120, r.height - bh - 120)}px)`;
}

export { placeWishUI, startWish, updateWish, wishDone };
