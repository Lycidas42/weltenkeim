// Panels: Arbeit, Schrein, Kreatur, Info; Uhrzeit- und Wettermenü; Kamera folgt

import { $, clamp, fmt, fmt1 } from '../core/util.js';
import { MAX_POP, PROC, ROLES, S, SAVE_KEY, SOUL_COST, WORKS, cap, handCost, on, passive, prayYield, resText, save, stopSaving, templeCost } from '../core/state.js';
import { camera, clock, controls, isMobile } from '../core/render.js';
import { floatText, toast } from './feedback.js';
import { WEATHER, isDaytime, setWeather, skipTo, toggleDayNight } from '../world/sky.js';
import { resetTerrain } from '../world/terrain.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { input } from '../hand/pointer.js';
import { PRAY } from '../village/layout.js';
import { trees } from '../world/trees.js';
import { build } from '../village/houses.js';
import { farmSites, huts } from '../village/huts.js';
import { fields, stock } from '../farm/farm.js';
import { spawnVillager, villagers } from '../village/villagers.js';
import { ACT_COL, ACT_DESC, ACT_LABEL, loadCreature, pron, useCreature } from '../creature/creature.js';
import { showPortrait } from './portrait.js';
import { fish, wild } from '../wildlife/land.js';
import { effJobs, reconcileJobs, roleCount } from '../village/jobs.js';
import { reinforce } from '../creature/ai.js';

let creatureLoading = null;
async function setCreature(id) {
  if (!CREATURES[id] || id === fox.kind || creatureLoading) return;
  creatureLoading = id; renderForms();
  try {
    const g = await loadCreature(id);
    useCreature(id, g); S.creature = id; save(); if (!$('sheetFox').hidden) showPortrait();
    floatText(fox.x, CREATURES[id].h + .6, fox.z, `${S.name} wird ${CREATURES[id].label}`, 's');
  } catch (e) { toast('Diese Gestalt konnte nicht geladen werden. Bist du offline?'); }
  creatureLoading = null; renderForms(); renderFox();
}

const HINTS = {
  get blick() { return isMobile ? 'Ziehen dreht die Welt. Zwei Finger: verschieben und zoomen.' : 'Linke Maustaste verschiebt, rechte dreht, Mausrad zoomt. In jedem Werkzeug: Leertaste oder Strg + Ziehen verschiebt.'; },
  get hand() { return `Bewohner und Bäume: drücken und halten packt. Gepacktes bleibt in der Hand: Tippen setzt ab, schnelles Wischen wirft. Bei der Arbeit helfen: Felder säen, gießen, ernten, Tiere füttern, Fische greifen, Wild bannen, Hütten leeren. ${S.name} antippen für mehr.`; },
  sculpt: 'Gedrückt halten, um Land zu heben oder zu senken.',
  miracle: 'Wunder wählen, dann auf die Welt tippen.'
};

function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.hidden = true); $('app').classList.remove('sheet-open'); }
function openSheet(id) { const s = $(id), was = !s.hidden; closeSheets(); s.hidden = was; $('app').classList.toggle('sheet-open', !s.hidden); if (!s.hidden) { if (id === 'sheetShrine') renderShrine(); if (id === 'sheetWork') renderWork(); if (id === 'sheetFox') { renderFox(); showPortrait(); } } }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
$('btnShrine').addEventListener('click', () => openSheet('sheetShrine'));
$('btnWork').addEventListener('click', () => openSheet('sheetWork'));
$('btnStore').addEventListener('click', () => openSheet('sheetWork'));
// Arbeits-Panel: Aufbau einmal, danach nur Texte aktualisieren (sonst gehen Klicks verloren)
$('workItems').innerHTML = Object.entries(WORKS).map(([id, W]) => `<div class="work" data-work="${id}">
  <div class="whead"><div><h3>${W.label}</h3><p class="min">mindestens ${W.min} Bewohner</p></div>
    <div class="step" role="group" aria-label="Bewohner für ${W.label}"><button data-d="-1" aria-label="Weniger">−</button><b class="n">0</b><button data-d="1" aria-label="Mehr">+</button></div></div>
  <p class="wdesc">${W.desc}</p><ul class="roles"></ul><p class="wnote"></p></div>`).join('');
$('workItems').addEventListener('click', e => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const id = b.closest('[data-work]').dataset.work, W = WORKS[id], d = +b.dataset.d, eff = effJobs();
  let k = eff[id], used = 0; for (const x in eff) if (x !== id) used += eff[x];
  const free = villagers.length - used - k;
  if (d > 0) { const step = k === 0 ? W.min : 1; if (step > free) { toast(k === 0 ? `${W.label} braucht mindestens ${W.min} freie Bewohner.` : 'Keine freien Bewohner mehr.', 2.4); return; } k += step; }
  else k = k - 1 < W.min ? 0 : k - 1;
  S.jobs[id] = k; reconcileJobs(); renderWork(); save();
});
function renderWork() {
  const eff = effJobs(); let used = 0; for (const id in eff) used += eff[id];
  const free = villagers.length - used, carriers = villagers.filter(v => !v.role && v.haul).length;
  $('workFree').innerHTML = `<b>${free}</b> von ${villagers.length} Bewohnern sind frei${carriers ? ` · ${carriers} ${carriers === 1 ? 'trägt' : 'tragen'} gerade` : ''}`;
  const alive = trees.filter(t => t.alive && !t.gone), young = alive.filter(t => t.g < .7).length;
  for (const el of $('workItems').children) {
    const id = el.dataset.work, W = WORKS[id], k = eff[id], sp = W.split(k);
    el.querySelector('.n').textContent = k;
    el.querySelector('[data-d="-1"]').disabled = k === 0;
    el.querySelector('[data-d="1"]').disabled = free < (k === 0 ? W.min : 1);
    el.classList.toggle('off', k === 0);
    el.querySelector('.roles').innerHTML = Object.keys(sp).map(r => {
      const R = ROLES[r], n = roleCount(r), nh = huts.filter(h => h.role === r).length;
      return `<li><b>${n}</b> ${R.label} <span>· ${nh} ${R.hut}${nh === 1 ? '' : 'n'}, Platz für ${nh * R.per}</span></li>`;
    }).join('');
    const notes = [];
    for (const r in sp) { const wait = (k ? sp[r] : 0) - roleCount(r); if (wait > 0) notes.push(`${wait} ${ROLES[r].label} ${wait === 1 ? 'wartet' : 'warten'} auf eine neue ${ROLES[r].hut}${build.construction && build.construction.role === r ? ', sie wird gerade gebaut.' : ` (${ROLES[r].cost(S.huts[r])} Bretter).`}`); }
    if (id === 'wood') notes.push(`${alive.length - young} Bäume zum Fällen, ${young} wachsen noch.`);
    if (id === 'jagd') notes.push(`Auf der Insel: ${wild.filter(a => a.kind === 'reh' && a.state !== 'dead').length} Rehe, ${wild.filter(a => a.kind === 'hase' && a.state !== 'dead').length} Hasen. Im Lager: ${fmt(S.meat)} Fleisch.`);
    { const at = {}; for (const h of huts) if (sp[h.role] !== undefined) for (const g in h.goods) if (h.goods[g] > 0) at[g] = (at[g] || 0) + h.goods[g];
      const list = Object.keys(at).map(g => resText(g, at[g])); if (list.length) notes.push(`An den Hütten zum Abholen: ${list.join(', ')}.`); }
    if (id === 'hof') { const st = n => fields.filter(f => f.state === n).length, an = k => stock.filter(a => a.kind === k).length;
      notes.push(fields.length ? `Felder: ${st('reif')} reif, ${st('grow')} wachsen, ${st('leer')} leer. Weide: ${an('kuh')} Kühe, ${an('schwein')} Schweine, ${an('huhn')} Hühner, ${an('hahn')} Hahn.` : (farmSites.length ? 'Noch kein Bauernhof.' : 'Auf der Insel ist kein Platz für einen Bauernhof.'));
      notes.push(`Im Lager: ${resText('veg', S.veg)}, ${resText('grain', S.grain)}, ${fmt(S.milk)} Milch, ${resText('eggs', S.eggs)}.`); }
    if (id === 'muehle' || id === 'baeckerei') { const r = id === 'muehle' ? 'miller' : 'baker', P = PROC[r], hs = huts.filter(h => h.role === r);
      notes.push(`${id === 'muehle' ? 'In der Mühle' : 'In der Bäckerei'}: ${resText(P.inp, hs.reduce((a, h) => a + h.inp, 0))}. Im Lager: ${resText(P.inp, S[P.inp])}, ${resText(P.out, S[P.out])}.`);
      if (!S[P.inp] && !hs.some(h => h.inp)) notes.push(id === 'muehle' ? 'Korn wächst als Weizen auf den Feldern des Bauernhofs.' : 'Mehl kommt aus der Mühle.'); }
    if (id === 'fischerei') notes.push(`Fische vor der Küste: ${fish.length}. Im Lager: ${fmt(S.fish)} Fisch.`);
    if (id === 'saw') { const ms = huts.filter(h => h.role === 'sawyer'); notes.push(`An der Säge: ${ms.reduce((a, h) => a + h.logs, 0)} Stämme, ${ms.reduce((a, h) => a + h.planks, 0)} Bretter. Im Lager: ${fmt(S.logs)} ${S.logs === 1 ? 'Stamm' : 'Stämme'}, ${fmt(S.holz)} Bretter.`); }
    el.querySelector('.wnote').textContent = notes.join(' ');
  }
}
// Uhrzeit-Menü: vorspulen zum Tag/zur Nacht, Tagesverlauf anhalten
const timeMenu = $('timeMenu');
function closeTimeMenu() { if (timeMenu.hidden) return; timeMenu.hidden = true; $('btnTime').setAttribute('aria-expanded', 'false'); }
function openTimeMenu() {
  const toNight = skipTo !== null ? skipTo < 12 : isDaytime(S.hour);
  $('tmSkipL').textContent = toNight ? 'Zur Nacht vorspulen' : 'Zum Morgen vorspulen'; timeMenu.dataset.to = toNight ? 'night' : 'day';
  $('tmPauseL').textContent = S.timePaused ? 'Zeit weiterlaufen lassen' : 'Zeit anhalten'; $('tmPause').setAttribute('aria-checked', String(!!S.timePaused));
  timeMenu.hidden = false; $('btnTime').setAttribute('aria-expanded', 'true');
  const r = $('btnTime').getBoundingClientRect(), w = timeMenu.offsetWidth;
  timeMenu.style.top = `${r.bottom + 6}px`; timeMenu.style.left = `${clamp(r.right - w, 16, innerWidth - w - 16)}px`;
}
$('btnTime').addEventListener('click', () => (timeMenu.hidden ? openTimeMenu() : closeTimeMenu()));
// Wetter-Menü: Wetter wählen und festhalten
const WX_ICON = {
  klar: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
  heiter: '<circle cx="9" cy="8.5" r="3.4"/><path d="M9 2.6v1.4M3.1 8.5h1.4M4.8 4.3l1 1M13.2 4.3l-1 1"/><path d="M8 19.5a3.5 3.5 0 0 1 .5-7 4.5 4.5 0 0 1 8.6 1.3 2.9 2.9 0 0 1-.1 5.7z"/>',
  bewoelkt: '<path d="M6.5 18a4 4 0 0 1 .6-7.95A5.2 5.2 0 0 1 17 10.8a3.6 3.6 0 0 1 .3 7.2z"/>',
  regen: '<path d="M6.5 14.5a4 4 0 0 1 .6-7.95A5.2 5.2 0 0 1 17 7.3a3.6 3.6 0 0 1 .3 7.2z"/><path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>',
  schnee: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5M4.6 10.2l2.2-.7-.5-2.3M17.7 16.5l-.5-2.3 2.2-.7M4.6 13.8l2.2.7-.5 2.3M17.7 7.5l-.5 2.3 2.2.7"/>',
};
const wxMenu = $('wxMenu');
$('wxOpts').innerHTML = Object.keys(WEATHER).map(k => `<button role="menuitemradio" data-wx="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[k]}</svg><span>${WEATHER[k].label[0].toUpperCase() + WEATHER[k].label.slice(1)}</span></button>`).join('');
function closeWxMenu() { if (wxMenu.hidden) return; wxMenu.hidden = true; $('btnWx').setAttribute('aria-expanded', 'false'); }
function openWxMenu() {
  wxMenu.querySelectorAll('[data-wx]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.wx === S.weather)));
  $('wxLockL').textContent = S.weatherLocked ? 'Wetter wechselt wieder' : 'Wetter festhalten'; $('wxLock').setAttribute('aria-checked', String(!!S.weatherLocked));
  wxMenu.hidden = false; $('btnWx').setAttribute('aria-expanded', 'true');
  const r = $('btnWx').getBoundingClientRect(), w = wxMenu.offsetWidth;
  wxMenu.style.top = `${r.bottom + 6}px`; wxMenu.style.left = `${clamp(r.right - w, 16, innerWidth - w - 16)}px`;
}
$('btnWx').addEventListener('click', () => (wxMenu.hidden ? openWxMenu() : closeWxMenu()));
$('wxOpts').addEventListener('click', e => { const b = e.target.closest('[data-wx]'); if (!b) return; setWeather(b.dataset.wx); toast({ regen: 'Es fängt an zu regnen.', schnee: 'Es fängt an zu schneien.' }[b.dataset.wx] || `Das Wetter wird ${WEATHER[b.dataset.wx].label}.`, 2); save(); closeWxMenu(); });
$('wxLock').addEventListener('click', () => { S.weatherLocked = !S.weatherLocked; toast(S.weatherLocked ? 'Das Wetter bleibt, wie es ist.' : 'Das Wetter wechselt wieder von selbst.', 2); save(); closeWxMenu(); });
addEventListener('pointerdown', e => { if (!wxMenu.hidden && !wxMenu.contains(e.target) && !$('btnWx').contains(e.target)) closeWxMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeWxMenu(); });
const windWord = w => w < .3 ? 'windstill' : w < .5 ? 'leichter Wind' : w < .72 ? 'windig' : 'stürmisch';
$('tmSkip').addEventListener('click', () => { toggleDayNight(); closeTimeMenu(); });
$('tmPause').addEventListener('click', () => { S.timePaused = !S.timePaused; toast(S.timePaused ? 'Die Zeit steht still.' : 'Die Zeit läuft weiter.', 2); save(); closeTimeMenu(); });
addEventListener('pointerdown', e => { if (!timeMenu.hidden && !timeMenu.contains(e.target) && !$('btnTime').contains(e.target)) closeTimeMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeTimeMenu(); });
$('btnFox').addEventListener('click', () => openSheet('sheetFox'));
$('btnInfo').addEventListener('click', () => openSheet('sheetInfo'));
// Folgen: die Kamera bleibt beim Tiergeist, bis der Chip oben oder der Knopf im Panel es beendet
let follow = false;
function setFollow(on) { follow = on; renderFollow(); }
function renderFollow() { $('btnFollow').hidden = !follow; $('btnFocus').setAttribute('aria-pressed', follow); $('btnFocus').textContent = follow ? 'Folgen aus' : 'Folgen'; }
// Kamera: folgt dem Tiergeist, bleibt über der Insel
function updateCamera(dt) {
  if (follow) { const k = 1 - Math.exp(-dt * 3), nx = controls.target.x + (fox.x - controls.target.x) * k, nz = controls.target.z + (fox.z - controls.target.z) * k;
    camera.position.x += nx - controls.target.x; camera.position.z += nz - controls.target.z; controls.target.x = nx; controls.target.z = nz; }
  const tr = Math.hypot(controls.target.x, controls.target.z);
  if (tr > 25) { const k = 25 / tr, ox = controls.target.x, oz = controls.target.z; controls.target.x *= k; controls.target.z *= k; camera.position.x += controls.target.x - ox; camera.position.z += controls.target.z - oz; }
  controls.target.y = 1;
  controls.update();
}
$('btnPet').addEventListener('click', () => reinforce('pet'));
$('btnSlap').addEventListener('click', () => reinforce('slap'));
$('btnFocus').addEventListener('click', () => { setFollow(!follow); if (follow) closeSheets(); });
$('btnFollow').addEventListener('click', () => setFollow(false));
let resetArmed = false;
$('btnReset').addEventListener('click', e => {
  if (!resetArmed) { resetArmed = true; e.target.textContent = 'Wirklich zurücksetzen?'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {} stopSaving(); location.reload();
});
// Gelände auf den Auslieferungszustand zurücksetzen (alles andere bleibt): zweimal tippen, dann neu laden.
// Gebäude ebnen ihren Platz beim Laden wieder selbst ein.
for (const id of ['btnTerrainReset', 'btnTerrainReset2']) {
  let armed = 0;
  $(id).addEventListener('click', e => {
    const b = e.currentTarget;
    if (!armed) { armed = setTimeout(() => { armed = 0; b.classList.remove('armed'); b.textContent = id === 'btnTerrainReset' ? 'Insel zurücksetzen' : 'Gelände zurücksetzen'; }, 4000); b.classList.add('armed'); b.textContent = 'Wirklich? Alles Geformte geht verloren'; return; }
    clearTimeout(armed); resetTerrain(); save(); stopSaving(); location.reload();
  });
}

const SHRINE = [
  { id: 'temple', title: () => `Schrein weihen (Stufe ${S.temple + 1})`, desc: () => `Gebete bringen ${fmt1(prayYield() + .6)} statt ${fmt1(prayYield())} Glaube, der Schrein strahlt ${fmt1(passive() + .06)}/s aus.`, cost: templeCost, buy: () => { S.temple++; } },
  { id: 'soul', title: () => 'Seele rufen', desc: () => villagers.length < cap() ? 'Ein neuer Bewohner erscheint sofort am Schrein.' : cap() >= MAX_POP ? `Das Dorf hat seine volle Größe von ${MAX_POP} Seelen erreicht.` : 'Kein Platz. Aus Brettern entstehen neue Häuser, sobald genug im Lager sind.', cost: () => SOUL_COST, ok: () => villagers.length < cap(), buy: () => { const v = spawnVillager(PRAY.x, PRAY.z + .5); if (v) floatText(v.x, 1.8, v.z, 'Neue Seele', 's'); } },
  { id: 'hand', title: () => `Hand stärken (Stufe ${S.hand + 1})`, desc: () => 'Formen wirkt 35 % weiter und kräftiger.', cost: handCost, buy: () => { S.hand++; } }
];
function renderShrine() {
  $('shrineItems').innerHTML = SHRINE.map(it => { const c = it.cost(), ok = S.glaube >= c && (!it.ok || it.ok());
    return `<div class="item"><div><h3>${it.title()}</h3><p>${it.desc()}</p></div><button class="buy" data-buy="${it.id}" ${ok ? '' : 'disabled'}>${fmt(c)} ✦</button></div>`; }).join('');
  $('shrineItems').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { const it = SHRINE.find(x => x.id === b.dataset.buy), c = it.cost();
    if (S.glaube < c || (it.ok && !it.ok())) return; S.glaube -= c; it.buy(); renderShrine(); save(); }));
}
on('fox', () => renderFox());
function renderFox() {
  $('foxBars').innerHTML = ['help', 'play', 'mischief'].map(k => `<div class="bar"><span>${ACT_LABEL[k]}</span><div class="track"><div class="fill" style="width:${Math.round(S.w[k] * 100)}%;background:${ACT_COL[k]}"></div></div><span class="num">${Math.round(S.w[k] * 100)} %</span></div>`).join('');
  const t = clock.elapsedTime;
  $('foxLast').textContent = fox.last && t - fox.lastT < 25 ? `Gerade eben hat ${S.name} ${fox.lastDesc || ACT_DESC[fox.last]}. Deine Reaktion prägt ${pron().ihn}.` : `Warte auf die nächste Tat von ${S.name}, dann lobe oder tadle ${pron().ihn}.`;
  $('foxNow').textContent = `${S.name} ${foxDoing()}.`;
  renderForms();
}
// Buttons nur einmal anlegen und danach aktualisieren: renderFox läuft alle 0,25 s,
// ein Neuaufbau zwischen Drücken und Loslassen würde den Klick verschlucken.
// Gestalten mit Fell-Modell und eigenen Reaktionen bekommen einen Stern
const formLabel = id => CREATURES[id].label + (CREATURES[id].react ? ' ★' : '');
$('foxForms').innerHTML = Object.entries(CREATURES).map(([id, c]) => `<button data-form="${id}"${c.react ? ' class="feat"' : ''}>${formLabel(id)}</button>`).join('');
// kurze Beschreibung des aktuellen Zustands für das Panel
function foxDoing() {
  switch (fox.state) {
    case 'walk':
      if (fox.next === 'store') return 'trägt einen Baum im Maul zum Lager';
      if (fox.next === 'haulPick' && fox.haul) return `läuft zur ${ROLES[fox.haul.hut.role].hut}, um Waren ins Lager zu tragen`;
      if (fox.next === 'haulLager' && fox.haul) return `läuft zum Lager, um Nachschub für die ${ROLES[fox.haul.hut.role].hut} zu holen`;
      if (fox.next === 'haulDeliver' && fox.carryGoods && fox.haul) return `trägt ${Object.keys(fox.carryGoods).map(k => resText(k, fox.carryGoods[k])).join(', ')} zur ${ROLES[fox.haul.hut.role].hut}`;
      if (fox.next === 'haulStore' && fox.carryGoods) return `trägt ${Object.keys(fox.carryGoods).map(k => resText(k, fox.carryGoods[k])).join(', ')} zum Lager`;
      if (fox.next === 'play') return 'läuft zum Dorfplatz, um zu spielen';
      return fox.act === 'help' ? 'läuft zu einem Baum, um Holz zu holen' : 'schleicht zu einem Baum und führt etwas im Schilde';
    case 'work': return fox.act === 'help' ? 'fällt einen Baum für das Dorf' : 'rüttelt mutwillig an einem Baum';
    case 'play': return 'tollt über den Dorfplatz';
    case 'rest': return 'hat sich hingelegt und döst';
    case 'cast': return 'wirkt mit dir ein Wunder';
    case 'pickup': return 'hebt den gefällten Baum auf';
    case 'haulUp': return 'nimmt die Waren ins Maul';
    default: return fox.idleA === 'eat' ? 'schnuppert am Boden' : 'schaut sich um';
  }
}
// Name an allen Stellen der Oberfläche setzen
function renderGender() { for (const b of $('foxGender').children) b.setAttribute('aria-checked', String(b.dataset.g === S.gender)); }
$('foxGender').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b || b.dataset.g === S.gender) return; S.gender = b.dataset.g; renderGender(); renderFox(); toast(`${S.name} ist jetzt ${S.gender === 'w' ? 'weiblich' : 'männlich'}.`, 2); save(); });
renderGender();
function renderName() {
  $('btnFox').textContent = S.name; $('sheetFox').setAttribute('aria-label', S.name);
  if (document.activeElement !== $('foxName')) $('foxName').value = S.name;
  $('btnFollow').textContent = `Folgt ${S.name} ✕`;
  if (input.tool === 'hand') $('hint').textContent = HINTS.hand;
}
$('foxName').addEventListener('change', () => { S.name = $('foxName').value.trim().slice(0, 16) || 'Fenja'; renderName(); renderFox(); save(); });
$('foxName').addEventListener('keydown', e => { if (e.key === 'Enter') $('foxName').blur(); });
function renderForms() {
  for (const b of $('foxForms').children) {
    const id = b.dataset.form, label = creatureLoading === id ? 'Lädt …' : formLabel(id);
    b.setAttribute('aria-pressed', id === fox.kind); b.disabled = !!creatureLoading;
    if (b.textContent !== label) b.textContent = label;
  }
}
$('foxForms').addEventListener('click', e => { const b = e.target.closest('[data-form]'); if (b) setCreature(b.dataset.form); });

export { HINTS, SHRINE, WX_ICON, closeSheets, follow, foxDoing, openSheet, renderFox, renderName, renderWork, setCreature, setFollow, updateCamera, windWord };
