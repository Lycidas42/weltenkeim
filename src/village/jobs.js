// Berufe verteilen

import { PROC, ROLES, S, WORKS } from '../core/state.js';
import { huts } from './huts.js';
import { villagers } from './villagers.js';
import { idle, putDown } from './ai.js';

// Zugewiesene Bewohner je Arbeitsstätte (0 oder mindestens min, höchstens so viele, wie es Bewohner gibt)
function effJobs() {
  const out = {}; let free = villagers.length;
  for (const id in WORKS) { let k = Math.min(S.jobs[id] | 0, free); if (k < WORKS[id].min) k = 0; out[id] = k; free -= k; }
  return out;
}
// gewünschte Spezialisten je Beruf (ohne Rücksicht auf Hüttenplätze)
function wantRoles() { const e = effJobs(), w = {}; for (const r in ROLES) w[r] = 0; for (const id in WORKS) { const sp = WORKS[id].split(e[id]); if (e[id]) for (const r in sp) w[r] += sp[r]; } return w; }
function hutCap(r) { return huts.filter(h => h.role === r).length * ROLES[r].per; }
function leaveJob(v) {
  if (v.tree) { if (v.tree.reserved === v) v.tree.reserved = null; v.tree = null; }
  // Last abgeben: ein Stamm geht zurück ins Lager, fertige Bretter zählen als Holz (außer er ist schon auf dem Weg dorthin)
  if (v.state === 'saw' && v.hut) v.hut.logs++; // angefangener Stamm bleibt an der Säge
  if (v.state === 'proc' && v.hut && PROC[v.role]) v.hut.inp += PROC[v.role].n; // angefangenes Korn/Mehl bleibt in der Werkstatt
  const keep = v.state === 'walk' && v.next === 'dropHut';
  if (v.carry && !keep) { if (v.drop) putDown(v, true); else if (v.carry === 1 && v.state !== 'saw') S.logs++; v.carry = 0; }
  if (v.field) { if (v.field.by === v) v.field.by = null; v.field = null; }
  if (['chop', 'plant', 'saw', 'sow', 'harvest', 'tend', 'proc'].includes(v.state) || (v.state === 'walk' && !keep)) idle(v, .3);
  v.role = null; v.hut = null; v.saplings = 0; v.prey = null; v.catch = 0; if (v.state === 'aim' || v.state === 'fish') idle(v, .3);
}
// Bewohner auf Berufe verteilen: so viele wie gewünscht und Hüttenplätze frei sind, der Rest betet als Dorfbewohner
function reconcileJobs() {
  const want = wantRoles();
  for (const r in ROLES) {
    const n = Math.min(want[r], hutCap(r)), cur = villagers.filter(v => v.role === r);
    // Überzählige gehen zurück ins Dorf (zuerst die, die gerade nichts tragen)
    cur.sort((a, b) => (a.carry ? 1 : 0) - (b.carry ? 1 : 0));
    for (let k = n; k < cur.length; k++) leaveJob(cur[k]);
    let need = n - Math.min(n, cur.length);
    for (const v of villagers) {
      if (need <= 0) break;
      if (v.role || v.haul || v.state === 'grabbed' || v.state === 'falling') continue;
      const hs = huts.filter(h => h.role === r).sort((a, b) => villagers.filter(x => x.hut === a).length - villagers.filter(x => x.hut === b).length)[0];
      v.role = r; v.hut = hs; v.saplings = 0; need--;
      if (v.state === 'pray' || v.state === 'idle') idle(v, .2 + Math.random() * .6);
    }
  }
}
function roleCount(r) { return villagers.filter(v => v.role === r).length; }

export { effJobs, hutCap, reconcileJobs, roleCount, wantRoles };
