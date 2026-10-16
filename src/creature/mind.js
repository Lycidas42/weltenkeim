// Gedächtnis der Kreatur: was sie wann und warum entschieden hat (nur zur Laufzeit), was sie durch Lob und Tadel
// gelernt hat (Lernchronik), wie oft sie etwas getan hat (Erfahrung) und wie ihre Neigungen zu Tagesbeginn standen.
// Grundlage für „Warum?“ in der Welt und für den Charakterbogen (kreatur.md 3.11).

import { S } from '../core/state.js';
import { clock } from '../core/render.js';
import { ACT_LABEL } from './creature.js';

// Erfahrung je Tätigkeit (S.cXp); Text für den Charakterbogen
const XP = { tree: 'Bäume ins Lager gebracht', haul: 'Waren getragen', play: 'mit dem Dorf gespielt', mischief: 'Bäume umgeworfen', sweep: 'Plätze gefegt', plant: 'Setzlinge gepflanzt', forage: 'Pilze gefunden', pest: 'Hasen vom Feld verscheucht', plow: 'neue Felder gepflügt', rock: 'Felsen weggeschoben' };
const LEARN_MAX = 30, LOG_MAX = 10;
if (!S.cXp || typeof S.cXp !== 'object') S.cXp = {};
for (const k in XP) if (typeof S.cXp[k] !== 'number' || !isFinite(S.cXp[k]) || S.cXp[k] < 0) S.cXp[k] = 0;
if (!Array.isArray(S.cLearn)) S.cLearn = [];
S.cLearn = S.cLearn.filter(e => e && (e.kind === 'pet' || e.kind === 'slap')).slice(0, LEARN_MAX);
if (!S.cDay || typeof S.cDay.day !== 'number' || !S.cDay.w) S.cDay = null;

// Entscheidungen, neueste zuerst: { t, day, hour, act, kind, intent, reasons: [{ key, label, weight }], done }.
// Gründe sind eine offene Liste: Später kommen Hunger, Müdigkeit, Ausrichtung, Fähigkeiten usw. als weitere key dazu.
const mind = { log: [] };
const poss = () => S.gender === 'm' ? 'seine' : 'ihre';
const share = a => S.w[a] / (S.w.help + S.w.play + S.w.mischief);
const pct = p => `${Math.round(p * 100)} %`;
// Gründe aus den Neigungen: Anteil der gewählten Tätigkeit; fiel die Wahl nicht auf die stärkste Neigung,
// war es knapp oder eine Laune
function leanReasons(a) {
  const top = Object.keys(S.w).reduce((x, y) => S.w[x] >= S.w[y] ? x : y), p = share(a), tp = share(top);
  const low = Math.min(...Object.keys(S.w).map(share));
  if (tp - low < .08) return [{ key: 'even', label: `${poss()} Neigungen sind etwa gleich stark, diesmal ${ACT_LABEL[a]} (${pct(p)})`, weight: p }];
  if (top === a) return [{ key: 'lean', label: `${ACT_LABEL[a]} ist ${poss()} stärkste Neigung (${pct(p)})`, weight: p }];
  if (p >= tp * .75) return [{ key: 'close', label: `${ACT_LABEL[a]} (${pct(p)}) ist ${S.gender === 'm' ? 'ihm' : 'ihr'} fast so wichtig wie ${ACT_LABEL[top]} (${pct(tp)})`, weight: p }];
  return [{ key: 'whim', label: `aus einer Laune heraus: ${ACT_LABEL[a]} liegt nur bei ${pct(p)}, ${ACT_LABEL[top]} bei ${pct(tp)}`, weight: p }];
}
function noteChoice(act, kind, intent, reasons) {
  const e = { t: clock.elapsedTime, day: S.day, hour: S.hour, act, kind, intent, reasons, done: null };
  mind.log.unshift(e); if (mind.log.length > LOG_MAX) mind.log.length = LOG_MAX;
  return e;
}
// Tat vollbracht: Erfahrung zählen, Ergebnis an der Entscheidung vermerken
function noteDone(kind, desc) {
  if (kind in XP) S.cXp[kind]++;
  const e = mind.log[0]; if (e && e.kind === kind && !e.done) e.done = desc;
}
// Lob oder Tadel: act = Tätigkeit, auf die es sich bezog (null: ohne Tat), from/to = Anteil vorher/nachher (0…1)
function noteLearn(kind, act, desc, from, to) {
  const r = (x, k) => x === null ? null : Math.round(x * k) / k; // kurz halten im Spielstand
  S.cLearn.unshift({ day: S.day, hour: r(S.hour, 100), kind, act, desc, from: r(from, 1000), to: r(to, 1000) });
  if (S.cLearn.length > LEARN_MAX) S.cLearn.length = LEARN_MAX;
}
// Neigungen zu Tagesbeginn merken (für ▲/▼ im Charakterbogen)
function updateMind() { if (!S.cDay || S.cDay.day !== S.day) S.cDay = { day: S.day, w: { ...S.w } }; }
// Warum tut sie gerade, was sie tut? Erster Grund der jüngsten Entscheidung, solange sie noch nicht erledigt ist
const why = () => { const e = mind.log[0]; return e && !e.done && e.reasons[0] ? e.reasons[0].label : ''; };

export { XP, leanReasons, mind, noteChoice, noteDone, noteLearn, share, updateMind, why };
