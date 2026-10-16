// Gedächtnis der Kreatur: was sie wann und warum entschieden hat (nur zur Laufzeit), was sie durch Lob und Tadel
// gelernt hat (Lernchronik), wie oft sie etwas getan hat (Erfahrung) und wie ihre Neigungen zu Tagesbeginn standen.
// Grundlage für „Warum?“ in der Welt und für den Charakterbogen (kreatur.md 3.11).

import { S } from '../core/state.js';
import { clock } from '../core/render.js';
import { CREATURES, fox } from './kinds.js';
import { ACT_LABEL } from './creature.js';

// Erfahrung je Tätigkeit (S.cXp); Text für den Charakterbogen
const XP = { tree: 'Bäume ins Lager gebracht', haul: 'Waren getragen', play: 'mit dem Dorf gespielt', mischief: 'Bäume umgeworfen', sweep: 'Plätze gefegt', plant: 'Setzlinge gepflanzt', forage: 'Pilze gefunden', pest: 'Hasen vom Feld verscheucht', plow: 'neue Felder gepflügt', rock: 'Felsen weggeschoben', transplant: 'junge Bäume umgesetzt', patrol: 'Wachen gelaufen', escort: 'Bewohner begleitet' };
const LEARN_MAX = 30, LOG_MAX = 10;
if (!S.cXp || typeof S.cXp !== 'object') S.cXp = {};
for (const k in XP) if (typeof S.cXp[k] !== 'number' || !isFinite(S.cXp[k]) || S.cXp[k] < 0) S.cXp[k] = 0;
if (!Array.isArray(S.cLearn)) S.cLearn = [];
S.cLearn = S.cLearn.filter(e => e && (e.kind === 'pet' || e.kind === 'slap')).slice(0, LEARN_MAX);
if (!S.cDay || typeof S.cDay.day !== 'number' || !S.cDay.d) S.cDay = null;

// Antriebe (kreatur.md 3.14): jeder für sich 0…1, Wert = Grundtypus der Gestalt + erzogene Abweichung (S.cTraits.dev).
// Die Abweichung bleibt beim Gestaltwechsel und schwindet langsam (Halbwertszeit etwa zehn Spieltage Spielzeit).
const DRIVES = ['help', 'play', 'mischief'];
const DRIFT_T = 3500 / Math.LN2;
const baseOf = () => CREATURES[fox.kind || S.creature].base;
const drive = k => Math.min(.97, Math.max(.03, baseOf()[k] + S.cTraits.dev[k]));
if (!S.cTraits || typeof S.cTraits !== 'object') S.cTraits = {};
if (!S.cTraits.dev || typeof S.cTraits.dev !== 'object') { // alter Spielstand: Anteile aus S.w in Abweichungen umrechnen
  const b = CREATURES[S.creature].base, w = S.w, sum = w ? (w.help || 0) + (w.play || 0) + (w.mischief || 0) : 0;
  S.cTraits.dev = {}; for (const k of DRIVES) S.cTraits.dev[k] = sum > 0 ? Math.min(.97, Math.max(.03, b[k] * 3 * (w[k] || 0) / sum)) - b[k] : 0;
}
for (const k of DRIVES) if (typeof S.cTraits.dev[k] !== 'number' || !isFinite(S.cTraits.dev[k])) S.cTraits.dev[k] = 0;
delete S.w;
// Lob hebt nur diesen Antrieb, Tadel senkt nur ihn; je näher am Rand, desto kleiner der Schritt. Liefert [vorher, nachher]
function train(k, up) {
  const v = drive(k), nv = up ? v + .15 * (1 - v) : v - .2 * v;
  S.cTraits.dev[k] = nv - baseOf()[k]; return [v, drive(k)];
}
// Ruhe ist, was die Antriebe übrig lassen: wenig Antrieb, viel Dösen
const restWeight = () => .35 + Math.max(0, 1.5 - DRIVES.reduce((s, k) => s + drive(k), 0)) * .7;
// Wahl aus eigenem Antrieb: 'rest' oder ein Antrieb, gewichtet mit seinem Wert
function pickDrive(canRest) {
  const r0 = canRest ? restWeight() : 0; let r = Math.random() * (r0 + DRIVES.reduce((s, k) => s + drive(k), 0)) - r0;
  if (r < 0) return 'rest';
  for (const k of DRIVES) if ((r -= drive(k)) < 0) return k;
  return 'help';
}

// Entscheidungen, neueste zuerst: { t, day, hour, act, kind, intent, reasons: [{ key, label, weight }], done }.
// Gründe sind eine offene Liste: Später kommen Hunger, Müdigkeit, Ausrichtung, Fähigkeiten usw. als weitere key dazu.
const mind = { log: [] };
const poss = () => S.gender === 'm' ? 'seine' : 'ihre';
const num = p => Math.round(p * 100);
// Gründe aus den Antrieben (Werte 0…100); fiel die Wahl nicht auf den stärksten, war es knapp oder eine Laune.
// a = 'rest': wenig Antrieb insgesamt oder einfach eine Pause
function leanReasons(a) {
  if (a === 'rest') {
    const sum = DRIVES.reduce((s, k) => s + drive(k), 0);
    return [sum < 1.1 ? { key: 'calm', label: `${poss()} Antriebe sind gering (zusammen ${num(sum)}), ${S.gender === 'm' ? 'er' : 'sie'} ruht gern`, weight: restWeight() }
      : { key: 'rest', label: 'zwischendurch braucht es Ruhe', weight: restWeight() }];
  }
  const top = DRIVES.reduce((x, y) => drive(x) >= drive(y) ? x : y), p = drive(a), tp = drive(top);
  const low = Math.min(...DRIVES.map(drive));
  if (tp - low < .08) return [{ key: 'even', label: `${poss()} Antriebe sind etwa gleich stark, diesmal ${ACT_LABEL[a]} (${num(p)})`, weight: p }];
  if (top === a) return [{ key: 'lean', label: `${ACT_LABEL[a]} ist ${S.gender === 'm' ? 'sein' : 'ihr'} stärkster Antrieb (${num(p)})`, weight: p }];
  if (p >= tp * .75) return [{ key: 'close', label: `${ACT_LABEL[a]} (${num(p)}) ist ${S.gender === 'm' ? 'ihm' : 'ihr'} fast so wichtig wie ${ACT_LABEL[top]} (${num(tp)})`, weight: p }];
  return [{ key: 'whim', label: `aus einer Laune heraus: ${ACT_LABEL[a]} liegt nur bei ${num(p)}, ${ACT_LABEL[top]} bei ${num(tp)}`, weight: p }];
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
// Antriebe zu Tagesbeginn merken (für ▲/▼ im Charakterbogen); Erzogenes schwindet langsam zum Grundtypus hin
function updateMind(dt = 0) {
  if (dt > 0) { const f = Math.exp(-dt / DRIFT_T); for (const k of DRIVES) S.cTraits.dev[k] *= f; }
  if (!S.cDay || S.cDay.day !== S.day) S.cDay = { day: S.day, d: Object.fromEntries(DRIVES.map(k => [k, drive(k)])) };
}
// Warum tut sie gerade, was sie tut? Erster Grund der jüngsten Entscheidung, solange sie noch nicht erledigt ist
const why = () => { const e = mind.log[0]; return e && !e.done && e.reasons[0] ? e.reasons[0].label : ''; };

export { DRIVES, XP, baseOf, drive, leanReasons, mind, noteChoice, noteDone, noteLearn, pickDrive, train, updateMind, why };
