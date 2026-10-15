// Hütten errichten

import * as THREE from 'three';
import { rnd } from '../core/util.js';
import { RES, ROLES, S } from '../core/state.js';
import { scene } from '../core/render.js';
import { heightAt } from '../world/terrain.js';
import { flattenAt } from '../world/sculpt.js';
import { findPart, modelInfo } from '../assets/models.js';
import { TK } from '../models/nature.js';
import { ST, place } from './layout.js';
import { clearAround } from '../world/trees.js';
import { houseMat } from './houses.js';
import { HUT, hutSite, huts, jetties, localPt } from './huts.js';
import { buildFarm } from '../farm/farm.js';
import { buildOven } from './workshops.js';

function addHut(role, site) {
  site.used = true; if (!site.existing) { clearAround(site.x, site.z, 1.5); flattenAt(site.x, site.z, 1.9); }
  const H = HUT[role], e = site.existing || place(H.key, site.x, site.z, site.ry, H.k);
  e.o.traverse(o => { if (o.isMesh) o.material = houseMat(o.material); });
  e.role = role; e.H = H; e.saw = findPart(e.o, e.key, 'saw'); e.sawing = 0;
  e.logs = 0; e.planks = 0; // Vorrat an der Säge: Träger bringen Stämme und holen Bretter
  e.goods = {}; // abgelegte Waren der Spezialisten (Stämme, Fleisch, Fisch, Gemüse ...), Träger bringen sie ins Lager
  if (role === 'farmer') buildFarm(e, site.farm);
  e.inp = 0; e.busy = 0;
  if (role === 'miller') { e.fan = findPart(e.o, e.key, 'fan'); for (const [lx, lz, ry] of modelInfo(e.key).sacks || []) { const q = localPt(e, lx, lz); place('prop.sack', q.x, q.z, ry, 1.8); } }
  if (role === 'baker') buildOven(e);
  if (role === 'lumber') { const p = localPt(e, .62, -.12); place('prop.logs', p.x, p.z, site.ry + Math.PI / 2, 1.25); e.pile = p; }
  if (role === 'forester') for (const [lx, lz] of [[-.5, .05], [-.62, -.22], [.52, .18]]) { const p = localPt(e, lx, lz); place(TK[Math.random() < .5 ? 0 : 2], p.x, p.z, Math.random() * 6, ST * .2); }
  if (role === 'hunter') { const p = localPt(e, .7, .35); place('prop.target', p.x, p.z, site.ry, 1.6); e.pile = p; const q = localPt(e, -.55, .15); place('prop.arrows', q.x, q.z, site.ry, 1.6); }
  if (role === 'fisher') { // Steg aus Planken auf Pfählen, vom Ufer ins Meer
    const sh = site.shore, d = site.dir, x0 = sh.x - d.x * .6, z0 = sh.z - d.z * .6, len = 3.4, y = Math.max(heightAt(sh.x, sh.z), .05) + .14;
    const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: .9, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: .9, flatShading: true });
    for (let t = 0; t < len; t += .17) { const b = new THREE.Mesh(new THREE.BoxGeometry(.58, .035, .14), wood); b.position.set(rnd(.015), 0, t); b.rotation.y = rnd(.04); g.add(b); }
    for (let t = .3; t < len; t += 1) for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, 1.4, 6), dark); pl.position.set(sx * .27, -.68, t); g.add(pl); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    g.position.set(x0, y, z0); g.rotation.y = Math.atan2(d.x, d.z); scene.add(g);
    e.jetty = { x: x0, z: z0, dx: d.x, dz: d.z, len, y: y + .02, end: { x: x0 + d.x * (len - .25), z: z0 + d.z * (len - .25) }, bob: { x: x0 + d.x * (len + 1.7), z: z0 + d.z * (len + 1.7) } };
    jetties.push(e.jetty);
  }
  huts.push(e); return e;
}
const hutDoor = (e, d = .25) => localPt(e, e.H.door.x, e.H.door.z + d / e.o.scale.x);
const hutWork = e => localPt(e, e.H.work.x, e.H.work.z);
for (const r in ROLES) for (let i = 0; i < S.huts[r]; i++) { const st = hutSite(r); if (st) addHut(r, st); }
for (const r in ROLES) S.huts[r] = huts.filter(h => h.role === r).length;
huts.forEach((h, i) => { h.inp = Math.max(0, S.hutInp[i] | 0); }); // Vorrat in Mühle und Bäckerei
huts.forEach((h, i) => { const g = S.hutGoods[i]; if (g && typeof g === 'object') for (const k in g) if (RES[k] && isFinite(g[k]) && g[k] > 0) h.goods[k] = Math.floor(g[k]); });

export { addHut, hutDoor, hutWork };
