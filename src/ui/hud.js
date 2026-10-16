// Anzeige: Kopfleiste, Lager, Uhr, Wetter, Schilder über Feldern, Hütten, Wald und Häusern

import * as THREE from 'three';
import { $, clamp, fmt, fmt1 } from '../core/util.js';
import { MIRACLES, ROLES, S, cap } from '../core/state.js';
import { camera, canvas, tA, tmpV, toScreen } from '../core/render.js';
import { rate } from './feedback.js';
import { WEATHER, dayPhase, moonDir, skipTo, sunDir } from '../world/sky.js';
import { heightAt } from '../world/terrain.js';
import { waterU } from '../world/water.js';
import { fox } from '../creature/kinds.js';
import { input } from '../hand/pointer.js';
import { build, houses } from '../village/houses.js';
import { huts, updateLagerStock } from '../village/huts.js';
import { CROPS, fields } from '../farm/farm.js';
import { villagers } from '../village/villagers.js';
import { nextBuild } from '../village/economy.js';
import { alertRing, forestAlert } from '../village/forest-alert.js';
import { GROW_TEXT, SHRINE, WX_ICON, foodDays, renderFox, renderShrine, renderWork, windWord } from './sheets.js';
import { food } from '../village/food.js';

// Reifegrad über den Feldern, solange Hand oder Wunder gewählt sind: Frucht und Fortschrittsring, reife Felder golden
const fieldTagEls = [];
function placeFieldTags() {
  const box = $('fieldTags'), show = (input.tool === 'hand' || input.tool === 'miracle') && !document.querySelector('.sheet:not([hidden])'), r = canvas.getBoundingClientRect();
  fields.forEach((f, i) => {
    let el = fieldTagEls[i];
    if (!el) { el = document.createElement('div'); el.className = 'ftag'; el.innerHTML = '<i></i><span></span>'; box.appendChild(el); fieldTagEls[i] = el; el._k = ''; }
    const y = heightAt(f.x, f.z) + .45, dist = camera.position.distanceTo(tmpV.set(f.x, y, f.z));
    toScreen(f.x, y, f.z, tA); const on = show && dist < 34 && tmpV.set(f.x, y, f.z).project(camera).z < 1 && tA.x > r.left - 40 && tA.x < r.right + 40 && tA.y > r.top + 150 && tA.y < r.bottom - 120;
    el.hidden = !on; if (!on) return;
    const C = CROPS[f.c], pct = Math.floor(f.g * 100), wet = f.state === 'grow' && f.water > 0, k = f.state + C.label + pct + wet;
    if (el._k !== k) {
      el._k = k; el.className = 'ftag' + (f.state === 'reif' ? ' ripe' : f.state === 'leer' ? ' empty' : '');
      el.style.setProperty('--p', f.state === 'leer' ? 0 : pct);
      el.lastChild.innerHTML = f.state === 'reif' ? `${C.label} <small>reif · antippen</small>` : f.state === 'leer' ? `<small>leer, wird besät</small>` : `${C.label} <small>${pct} %${wet ? ' · Regen' : ''}</small>`;
    }
    el.style.transform = `translate(${Math.round(tA.x - r.left - el.offsetWidth / 2)}px, ${Math.round(tA.y - r.top - el.offsetHeight)}px)`;
  });
}
// Belegung über jeder Arbeitshütte (immer sichtbar): Ring und „belegt / Plätze“
const hutTagEls = [], hutBox = new THREE.Box3();
function placeHutTags() {
  const box = $('fieldTags'), show = !document.querySelector('.sheet:not([hidden])'), r = canvas.getBoundingClientRect();
  huts.forEach((h, i) => {
    let el = hutTagEls[i];
    if (!el) { el = document.createElement('div'); el.className = 'ftag htag'; el.innerHTML = '<i></i><span></span>'; box.appendChild(el); hutTagEls[i] = el; el._k = ''; }
    if (h.tagY === undefined) h.tagY = hutBox.setFromObject(h.o).max.y - heightAt(h.x, h.z) + .25; // über dem Dach
    const y = heightAt(h.x, h.z) + h.tagY, dist = camera.position.distanceTo(tmpV.set(h.x, y, h.z));
    toScreen(h.x, y, h.z, tA); const on = show && dist < 34 && tmpV.set(h.x, y, h.z).project(camera).z < 1 && tA.x > r.left - 40 && tA.x < r.right + 40 && tA.y > r.top + 150 && tA.y < r.bottom - 120;
    el.hidden = !on; if (!on) return;
    const R = ROLES[h.role], n = villagers.reduce((k, v) => k + (v.hut === h && v.role === h.role ? 1 : 0), 0), k = h.role + n;
    if (el._k !== k) {
      el._k = k; el.classList.toggle('empty', n === 0); el.classList.toggle('full', n >= R.per);
      el.style.setProperty('--p', Math.round(n / R.per * 100));
      el.lastChild.innerHTML = `${R.hut} <small>${n}/${R.per} ${n === 1 ? R.label : R.pl || R.label}</small>`;
    }
    el.style.transform = `translate(${Math.round(tA.x - r.left - el.offsetWidth / 2)}px, ${Math.round(tA.y - r.top - el.offsetHeight)}px)`;
  });
}
// Schild „Wartet auf Nahrung“ über dem neuesten Haus, solange freier Platz wegen Nahrungsmangel leer bleibt
function placeFoodSign() {
  const el = $('foodSign'), hs = houses[houses.length - 1];
  const on = food.growth === 'food' && !!hs && !$('app').classList.contains('sheet-open');
  if (!on) { el.hidden = true; return; }
  const r = canvas.getBoundingClientRect(), y = heightAt(hs.x, hs.z) + 1.8; toScreen(hs.x, y, hs.z, tA);
  el.hidden = !(tmpV.set(hs.x, y, hs.z).project(camera).z < 1 && tA.x > r.left && tA.x < r.right && tA.y > r.top + 150 && tA.y < r.bottom - 120);
  if (!el.hidden) el.style.transform = `translate(${Math.round(tA.x - r.left - el.offsetWidth / 2)}px, ${Math.round(tA.y - r.top - el.offsetHeight)}px)`;
}
function placeForestUI() {
  const B = $('forestAlert'), A = forestAlert;
  alertRing.visible = !!A.hut && input.tool === 'miracle';
  B.hidden = !A.hut || $('app').classList.contains('sheet-open');
  if (B.hidden) return;
  const r = canvas.getBoundingClientRect(); toScreen(A.hut.x, heightAt(A.hut.x, A.hut.z) + 2.2, A.hut.z, tA);
  const bw = B.offsetWidth, bh = B.offsetHeight, off = tA.x < r.left || tA.x > r.right || tA.y < r.top || tA.y > r.bottom;
  B.classList.toggle('edge', off); // außerhalb des Bildes: am Rand festhalten
  B.style.transform = `translate(${clamp(tA.x - r.left - bw / 2, 8, r.width - bw - 8)}px, ${clamp(tA.y - r.top - bh, 120, r.height - bh - 120)}px)`;
}

let uiT = 0;
function updateHud(dt, t) {
  uiT -= dt;
  if (uiT <= 0) {
    uiT = .25;
    $('vG').textContent = fmt(S.glaube); $('vGr').textContent = '+' + fmt1(rate) + '/s';
    // Lager: alle Rohstoffe und was als Nächstes gebaut wird
    $('sLogs').textContent = fmt(S.logs); $('sPlanks').textContent = fmt(S.holz); $('sMeat').textContent = fmt(S.meat); $('sFish').textContent = fmt(S.fish); $('sVeg').textContent = fmt(S.veg); $('sMilk').textContent = fmt(S.milk); $('sEggs').textContent = fmt(S.eggs); $('sGrain').textContent = fmt(S.grain); $('sFlour').textContent = fmt(S.flour); $('sBread').textContent = fmt(S.bread); $('sStone').textContent = fmt(S.stone);
    for (const [id, k, r] of [['sMeat', 'meat', 'hunter'], ['sFish', 'fish', 'fisher'], ['sVeg', 'veg', 'farmer'], ['sMilk', 'milk', 'farmer'], ['sEggs', 'eggs', 'farmer'], ['sGrain', 'grain', 'farmer'], ['sFlour', 'flour', 'miller'], ['sBread', 'bread', 'baker'], ['sStone', 'stone', 'mason']]) $(id).parentElement.hidden = !S[k] && !S.huts[r] && !(r === 'hunter' && S.huts.farmer) && !(r === 'mason' && S.huts.miner);
    { const nb = build.construction ? null : nextBuild(); $('sBuild').textContent = build.construction ? `${build.construction.label} im Bau` : nb ? `${nb.label} ab ${nb.cost} Brettern` : 'Dorf voll'; }
    { const fd = foodDays(); $('sFood').textContent = fd.text; $('sFood').classList.toggle('low', fd.low);
      $('sGrow').textContent = GROW_TEXT[food.growth].replace(/ \(.*\)$/, ''); $('sGrow').classList.toggle('low', food.growth === 'food'); }
    updateLagerStock();
    if (!$('sheetWork').hidden) renderWork();
    $('vD').textContent = `Tag ${fmt(S.day + 1)}`; // Spieltage seit Beginn, wie im Charakterbogen gezählt
    $('vT').textContent = `${Math.floor(S.hour)}:${String(Math.floor(S.hour % 1 * 6) * 10).padStart(2, '0')}`; $('vTs').textContent = S.timePaused && skipTo === null ? 'angehalten' : dayPhase(S.hour); $('btnTime').classList.toggle('paused', !!S.timePaused);
    { // Sonne bzw. Mond auf dem kleinen Himmelsbogen in der Uhrzeit-Kachel
      const sunUp = sunDir.y >= moonDir.y, a = sunUp ? (S.hour - 6.2) / 13.6 * Math.PI : ((S.hour - 19.6 + 24) % 24) / 10.8 * Math.PI, k = clamp(a, 0, Math.PI);
      const dial = $('tDial'); dial.dataset.body = sunUp ? 'sun' : 'moon';
      $('tBody').setAttribute('transform', `translate(${(18 - 14 * Math.cos(k)).toFixed(1)} ${(17 - 13 * Math.sin(k)).toFixed(1)})`);
      $('btnTime').setAttribute('aria-label', `${$('vD').textContent}, ${$('vT').textContent} Uhr, ${$('vTs').textContent}. ${S.timePaused ? 'angehalten' : 'läuft'}. Tippen für Zeitmenü`);
    }
    { const k = S.weather; if ($('btnWx').dataset.wx !== k) { $('btnWx').dataset.wx = k; $('wxIc').innerHTML = WX_ICON[k]; $('vW').textContent = WEATHER[k].label[0].toUpperCase() + WEATHER[k].label.slice(1); }
      $('vWs').textContent = S.weatherLocked ? 'festgehalten' : windWord(waterU.uWind.value); $('btnWx').classList.toggle('paused', !!S.weatherLocked);
      $('btnWx').setAttribute('aria-label', `Wetter: ${$('vW').textContent}, ${$('vWs').textContent}. Tippen für Wettermenü`); }
    $('vP').textContent = `${villagers.length}/${cap()}`; $('vPh').textContent = `${houses.length} ${houses.length === 1 ? 'Haus' : 'Häuser'}`;
    document.querySelectorAll('#ctxMiracle button').forEach(b => b.classList.toggle('poor', S.glaube < MIRACLES[b.dataset.m].cost));
    if (!$('sheetShrine').hidden && $('sheetShrine').dataset.grow !== food.growth) renderShrine(); // Text zu „Seele rufen“
    if (!$('sheetShrine').hidden) { const bs = $('shrineItems').querySelectorAll('[data-buy]'); bs.forEach(b => { const it = SHRINE.find(x => x.id === b.dataset.buy); b.disabled = !(S.glaube >= it.cost() && (!it.ok || it.ok())); }); }
    if (!$('sheetFox').hidden) renderFox();
    if (fox.last && t - fox.lastT > 25) { fox.last = null; $('btnFox').classList.remove('pulse'); }
  }
}

export { placeFieldTags, placeFoodSign, placeForestUI, placeHutTags, updateHud };
