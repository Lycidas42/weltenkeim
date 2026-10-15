// Test (Branch claude/zweibeiner-test, kreatur.md 3.12): alle Gestalten gleichzeitig auf der Insel. Neben der gewählten
// Kreatur laufen die übrigen Gestalten als einfache Statisten umher (gehen, stehen, ab und zu eine Geste). Sie lernen
// nichts und arbeiten nicht. Umschalten im Schrein-Panel: „Nur gewählte Gestalt“ / „Alle Gestalten“ (S.testParade).

import * as THREE from 'three';
import { $ } from '../core/util.js';
import { S, save } from '../core/state.js';
import { scene } from '../core/render.js';
import { loadModel } from '../assets/models.js';
import { surfaceAt } from '../world/terrain.js';
import { blockedAt, buildNav, followPath, navF, navReady, setGoal } from '../world/nav.js';
import { CREATURES, fox } from './kinds.js';
import { buildRig, rigPlay } from './creature.js';

const GESTURES = ['praise', 'eat', 'interact', 'cast', 'idle2'];
const parade = { list: [], loading: false };
const rnd = (a, b) => a + Math.random() * (b - a);
// freier Punkt auf der Insel nahe der Mitte
function freeSpot(r0 = 4, r1 = 13) {
  if (!navReady) buildNav();
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = rnd(r0, r1), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!blockedAt(navF, x, z) && surfaceAt(x, z) > .15) return { x, z };
  }
  return { x: 0, z: 6 };
}
async function spawn(id) {
  const g = await loadModel('creature.' + id), rig = buildRig(id, g), p = freeSpot();
  const pivot = new THREE.Group(); pivot.add(rig.model); scene.add(pivot);
  const tail = (CREATURES[id].tail || []).map(n => rig.model.getObjectByName(n)).filter(Boolean);
  const e = { id, rig, pivot, tail, x: p.x, z: p.z, h: Math.random() * 6.28, vh: 0, state: 'idle', timer: rnd(.5, 3) };
  e.vh = e.h; rigPlay(rig, 'idle'); parade.list.push(e);
}
async function setParade(on) {
  S.testParade = !!on; save(); renderParade();
  if (!on) { for (const e of parade.list) { scene.remove(e.pivot); e.rig.mixer.stopAllAction(); } parade.list.length = 0; return; }
  if (parade.loading || parade.list.length) return;
  parade.loading = true; renderParade();
  for (const id of Object.keys(CREATURES)) { try { await spawn(id); } catch (err) { console.warn('Statist', id, err); } }
  parade.loading = false; renderParade();
}
const swayQ = new THREE.Quaternion(), swayAx = new THREE.Vector3(0, 0, 1);
function updateParade(dt, t) {
  for (const e of parade.list) {
    e.pivot.visible = e.id !== fox.kind; // die gewählte Gestalt läuft schon als Kreatur herum
    if (!e.pivot.visible) continue;
    const C = CREATURES[e.id], A = e.rig.acts;
    if (e.state === 'walk') {
      rigPlay(e.rig, 'walk');
      if (followPath(e, C.walk * dt)) { e.state = 'idle'; e.timer = rnd(1.5, 5); rigPlay(e.rig, 'idle'); }
    } else if ((e.timer -= dt) <= 0) {
      if (e.state === 'idle' && Math.random() < .35) { // eine Geste, die das Modell hat
        const ks = GESTURES.filter(n => A[n]), k = ks[Math.floor(Math.random() * ks.length)];
        if (k) { e.state = 'gesture'; rigPlay(e.rig, k, true); e.timer = Math.min(4, A[k].getClip().duration / Math.abs(A[k].timeScale || 1)); continue; }
      }
      const p = freeSpot(2, 14); setGoal(e, p.x, p.z, navF); e.state = 'walk';
    }
    e.pivot.position.set(e.x, surfaceAt(e.x, e.z), e.z);
    const d = Math.atan2(Math.sin(e.h - e.vh), Math.cos(e.h - e.vh)); e.vh += Math.sign(d) * Math.min(Math.abs(d) * (1 - Math.exp(-dt * 7)), dt * 4.5);
    e.pivot.rotation.y = e.vh;
    e.rig.mixer.update(dt);
    if (e.tail.length) { const m = e.state === 'walk'; e.tail.forEach((b, i) => { const r = b.userData.rest; if (r) b.quaternion.copy(r.q).multiply(swayQ.setFromAxisAngle(swayAx, Math.sin(t * (m ? 7 : 2.2) - i * .7) * (m ? .22 : .12))); }); }
  }
}
// Schalter im Schrein-Panel
function renderParade() {
  const el = $('paradeMode'); if (!el) return;
  for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.p === (S.testParade ? '1' : '0')));
  el.lastElementChild.textContent = parade.loading ? 'Lädt …' : 'Alle Gestalten';
}
$('paradeMode')?.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) setParade(b.dataset.p === '1'); });
renderParade();
if (S.testParade) setParade(true);

export { parade, setParade, updateParade };
