// Wachstum des Dorfes: neue Seelen, Bauaufträge, Fortschritt in der Abwesenheit

import { fmt } from '../core/util.js';
import { MAX_POP, ROLES, S, cap, houseCost, loaded, passive, prayYield, save } from '../core/state.js';
import { floatText, toast } from '../ui/feedback.js';
import { addHouse, build, freeSite, houses, scaff } from './houses.js';
import { hutSite } from './huts.js';
import { addHut } from './build.js';
import { homeSpot, spawnVillager, villagers } from './villagers.js';
import { hutCap, reconcileJobs, roleCount, wantRoles } from './jobs.js';

// Was als Nächstes gebaut wird: zuerst Hütten für zugewiesene Spezialisten ohne Platz, dann Wohnhäuser
function nextBuild() {
  const want = wantRoles();
  for (const r in ROLES) if (want[r] > hutCap(r)) { const site = hutSite(r); if (site) return { role: r, label: ROLES[r].hut, cost: ROLES[r].cost(S.huts[r]), site }; }
  if (4 + 3 * houses.length >= MAX_POP) return null; // genug Häuser für die Höchstzahl an Bewohnern
  const site = freeSite(); return site ? { role: null, label: 'Haus', cost: houseCost(), site } : null;
}
reconcileJobs();
// Wachstum des Dorfes: neue Seelen, Berufe abgleichen, Bauaufträge vergeben und fertigstellen
let birthT = 0, jobT = 0;
function updateVillage(dt) {
  birthT += dt; if (birthT > 9) { birthT = 0; if (villagers.length < cap()) { const p = homeSpot(), v = spawnVillager(p.x, p.z); if (v) floatText(v.x, 1.6, v.z, 'Neue Seele', 's'); } }
  jobT -= dt; if (jobT <= 0) { jobT = 1; reconcileJobs(); }
  if (!build.construction) { const b = nextBuild(); if (b && S.holz >= b.cost) { S.holz -= b.cost; build.construction = { ...b, t: 0 }; b.site.used = true; scaff.x = b.site.x; scaff.z = b.site.z; scaff.o.rotation.y = b.site.ry; scaff.o.visible = true; } }
  if (build.construction) { build.construction.t += dt; if (build.construction.t > 9) {
    const c = build.construction; c.site.used = false; scaff.o.visible = false; build.construction = null;
    if (c.role) { const e = addHut(c.role, c.site); S.huts[c.role]++; reconcileJobs(); floatText(e.x, 2.2, e.z, c.label, 's'); toast(`Eine neue ${c.label} steht. Platz für ${ROLES[c.role].per} weitere ${ROLES[c.role].label}.`); }
    else { const hs = addHouse(c.site); S.houses = houses.length; floatText(hs.x, 2.2, hs.z, 'Neues Haus', 's'); toast(`Ein neues Haus steht. Platz für ${cap()} Seelen.`); }
    save();
  } }
}

{
  const away = Math.min((Date.now() - (S.ts || Date.now())) / 1000, 8 * 3600);
  if (loaded && away > 30) {
    const free = villagers.filter(v => !v.role).length, gRate = free * prayYield() * .45 / 22 + passive();
    const logIn = roleCount('lumber') / 16 * away * .5, sawn = Math.min(S.logs + logIn, roleCount('sawyer') / 10 * away * .5);
    const g = gRate * away * .5, h = Math.min(Math.floor(sawn) * 2, 400), l = Math.min(Math.floor(logIn - sawn + S.logs) - S.logs, 300);
    S.glaube += g; S.holz += h; S.logs = Math.max(0, S.logs + l);
    setTimeout(() => toast(`Während du fort warst: +${fmt(g)} Glaube${h > 0 ? `, +${fmt(h)} Bretter` : ''}${l > 0 ? `, +${fmt(l)} Stämme` : ''}.`, 5), 900);
  }
}

export { nextBuild, updateVillage };
