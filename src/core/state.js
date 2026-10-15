// Spielstand S (laden, prüfen, speichern über Hooks), Ereignisse für die Oberfläche, Kosten und Tabellen der Wirtschaft

import { fmt } from './util.js';

const SAVE_KEY = 'weltenkeim-save';
const S = { v: 1, theme: 'cozy', glaube: 15, holz: 6, temple: 1, hand: 1, houses: 2, pop: 6, w: { help: .34, play: .33, mischief: .33 }, creature: 'fox', name: 'Fenja', gender: 'w', handStyle: { skin: '#e9b48c', nails: '#f4ddd3', sleeve: '#33507f', trim: '#dba843' }, hour: 8, timePaused: false, jobs: { wood: 3, saw: 1, jagd: 0, fischerei: 0, hof: 0, muehle: 0, baeckerei: 0 }, huts: { lumber: 1, forester: 1, sawyer: 1, hunter: 0, fisher: 0, farmer: 0, miller: 0, baker: 0 }, logs: 0, meat: 0, fish: 0, veg: 0, milk: 0, eggs: 0, grain: 0, flour: 0, bread: 0, fields: [], hutGoods: [], hutInp: [], paths: [], terrain: [], terrainN: 0, millSite: null, streamFix: 0, weather: 'heiter', weatherLocked: false, ts: Date.now() };
let loaded = null;
{ try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { loaded = null; } }
if (loaded && typeof loaded === 'object') {
  // Version 0.2.0 hat das Aussehen der Hand versehentlich in S.hand (die Ausbaustufe) geschrieben: hier reparieren
  const oldStyle = loaded.hand && typeof loaded.hand === 'object' ? loaded.hand : {};
  Object.assign(S, loaded, { w: Object.assign({}, S.w, loaded.w || {}), handStyle: Object.assign({}, S.handStyle, oldStyle, loaded.handStyle || {}),
    jobs: Object.assign({}, S.jobs, loaded.jobs || {}), huts: Object.assign({}, S.huts, loaded.huts || {}) });
  if (typeof S.hand !== 'number' || !isFinite(S.hand) || S.hand < 1) S.hand = 1;
  if (!loaded.gender && loaded.name === 'Ruun') S.name = 'Fenja'; // alter Standardname: die Kreatur heißt jetzt zu Beginn Fenja
  if (S.gender !== 'm') S.gender = 'w';
  if (typeof S.hour !== 'number' || !isFinite(S.hour)) S.hour = 8;
}
// Speichern: jeder Bereich trägt seinen Teil über einen Hook bei (onSave), dann wird S als Ganzes geschrieben
const saveHooks = [];
const onSave = fn => saveHooks.push(fn);
let skipSave = false;
const stopSaving = () => { skipSave = true; }; // vor einem Neuladen, das den Spielstand verwirft
function save() { if (skipSave) return; for (const fn of saveHooks) fn(); S.ts = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
// Ereignisse für Rückmeldungen an die Oberfläche (die Spiellogik kennt die Panels nicht)
const handlers = {};
const on = (name, fn) => (handlers[name] || (handlers[name] = [])).push(fn);
const emit = (name, ...args) => (handlers[name] || []).forEach(fn => fn(...args));
const prayYield = () => 1 + 0.6 * (S.temple - 1);
const passive = () => 0.06 * S.temple;
const MAX_POP = 40; // vorerst höchstens so viele Bewohner (Übersicht und Leistung auf dem Handy)
const cap = () => Math.min(MAX_POP, 4 + 3 * S.houses);
const houseCost = () => 12 + 6 * Math.max(0, S.houses - 2);
const templeCost = () => Math.round(30 * Math.pow(1.7, S.temple - 1));
const handCost = () => Math.round(40 * Math.pow(1.8, S.hand - 1));
const SOUL_COST = 15;
// Berufe: Spezialisten arbeiten von ihrer Hütte aus, jede Hütte hat Platz für `per` von ihnen. Hütten kosten Holz.
// per: Arbeitsplätze je Hütte; pl/huts: Mehrzahl (fehlt pl, ist sie gleich der Einzahl); m: Hütte ist männlich (der Bauernhof)
const ROLES = {
  lumber: { label: 'Holzfäller', hut: 'Holzfällerhütte', huts: 'Holzfällerhütten', per: 4, cost: n => 14 + 8 * n },
  forester: { label: 'Förster', hut: 'Försterhütte', huts: 'Försterhütten', per: 3, cost: n => 12 + 6 * n },
  sawyer: { label: 'Säger', hut: 'Sägemühle', huts: 'Sägemühlen', per: 2, cost: n => 24 + 12 * n },
  hunter: { label: 'Jäger', hut: 'Jagdhütte', huts: 'Jagdhütten', per: 2, cost: n => 16 + 8 * n, opt: true },
  fisher: { label: 'Fischer', hut: 'Fischerhütte', huts: 'Fischerhütten', per: 2, cost: n => 16 + 8 * n, opt: true },
  farmer: { label: 'Bauer', pl: 'Bauern', hut: 'Bauernhof', huts: 'Bauernhöfe', m: true, per: 3, cost: n => 30 + 14 * n, opt: true },
  miller: { label: 'Müller', hut: 'Mühle', huts: 'Mühlen', per: 2, cost: n => 26 + 12 * n, opt: true },
  baker: { label: 'Bäcker', hut: 'Bäckerei', huts: 'Bäckereien', per: 2, cost: n => 22 + 10 * n, opt: true },
};
// Arbeitsstätten: der Spieler weist ihnen Bewohner zu (0 oder mindestens `min`), sie verteilen sich auf die Berufe
const WORKS = {
  wood: { label: 'Wald', min: 3, desc: 'Holzfäller fällen Bäume und bringen die Stämme ins Lager. Förster pflanzen neue Bäume.', split: k => { const f = Math.max(1, Math.round(k / 3)); return { lumber: k - f, forester: f }; } },
  jagd: { label: 'Jagd', min: 1, desc: 'Jäger pirschen sich mit Pfeil und Bogen an Rehe und Hasen heran und bringen das Wild als Fleisch ins Lager. Das Wild wächst nach.', split: k => ({ hunter: k }) },
  fischerei: { label: 'Fischerei', min: 1, desc: 'Fischer angeln vom Steg ihrer Hütte an der Küste und bringen den Fang ins Lager. Die Fische wachsen nach.', split: k => ({ fisher: k }) },
  hof: { label: 'Bauernhof', min: 1, desc: 'Bauern säen Gemüse auf den Feldern rund um den Hof, ernten, was reif ist, und versorgen Kühe, Schweine und Hühner. Regen lässt die Felder schneller wachsen. Reife Felder kannst du auch selbst mit der Hand abernten.', split: k => ({ farmer: k }) },
  muehle: { label: 'Mühle', min: 1, desc: 'Müller mahlen in der Windmühle Korn zu Mehl. Träger bringen das Korn aus dem Lager zur Mühle und das Mehl zurück ins Lager.', split: k => ({ miller: k }) },
  baeckerei: { label: 'Bäckerei', min: 1, desc: 'Bäcker backen im Steinofen aus Mehl Brot. Träger bringen das Mehl aus dem Lager und das Brot zurück ins Lager.', split: k => ({ baker: k }) },
  saw: { label: 'Sägemühle', min: 1, desc: 'Säger sägen aus Stämmen Bretter, das Baumaterial für Hütten und Häuser. Freie Bewohner tragen die Stämme aus dem Lager zur Säge und die Bretter zurück.', split: k => ({ sawyer: k }) },
};
for (const id in WORKS) if (typeof S.jobs[id] !== 'number' || !isFinite(S.jobs[id]) || S.jobs[id] < 0) S.jobs[id] = 0;
for (const r in ROLES) if (typeof S.huts[r] !== 'number' || !isFinite(S.huts[r]) || S.huts[r] < (ROLES[r].opt ? 0 : 1)) S.huts[r] = ROLES[r].opt ? 0 : 1; // Jagd- und Fischerhütte erst bei Bedarf
for (const k of ['meat', 'fish', 'veg', 'milk', 'eggs', 'grain', 'flour', 'bread']) if (typeof S[k] !== 'number' || !isFinite(S[k]) || S[k] < 0) S[k] = 0;
if (typeof S.logs !== 'number' || !isFinite(S.logs) || S.logs < 0) S.logs = 0;
if (!Array.isArray(S.fields)) S.fields = [];
if (!Array.isArray(S.hutGoods)) S.hutGoods = [];
if (!Array.isArray(S.hutInp)) S.hutInp = [];
// Waren: Name im Spielstand (S[key]) und Bezeichnung (Einzahl, Mehrzahl); carry = was ein Bewohner davon trägt
const RES = { logs: ['Stamm', 'Stämme', 1, 2], meat: ['Fleisch', 'Fleisch', 3, 3], fish: ['Fisch', 'Fisch', 4, 4], veg: ['Gemüse', 'Gemüse', 5, 6], milk: ['Milch', 'Milch', 6, 4], eggs: ['Ei', 'Eier', 7, 6], grain: ['Korn', 'Korn', 8, 6], flour: ['Mehl', 'Mehl', 9, 4], bread: ['Brot', 'Brote', 10, 6] };
// Verarbeitung: Träger bringen `inp` aus dem Lager in den Vorrat der Werkstatt (bis `buf`), der Arbeiter macht aus `n` davon `m` Stück `out`
const PROC = { miller: { inp: 'grain', n: 2, out: 'flour', m: 2, t: 4.5, buf: 6, verb: 'gemahlen' }, baker: { inp: 'flour', n: 2, out: 'bread', m: 3, t: 6, buf: 6, verb: 'gebacken' } };
const resText = (k, n) => `${fmt(n)} ${n === 1 ? RES[k][0] : RES[k][1]}`;
const MIRACLES = { rain: { cost: 20, label: 'Regen' }, haste: { cost: 12, label: 'Eile' } };

export { MAX_POP, MIRACLES, PROC, RES, ROLES, S, SAVE_KEY, SOUL_COST, WORKS, cap, emit, handCost, houseCost, loaded, on, onSave, passive, prayYield, resText, save, stopSaving, templeCost };
