// Wunder als Ritual der Kreatur (kreatur.md 3.13 C), Prototyp am Fuchs: Sie setzt sich und lädt auf (das Fell
// leuchtet, ein Zeichen erscheint am Boden, Funken ziehen zu ihr), dann bäumt sie sich auf und zieht mit dem Schwanz
// einen Lichtbogen. Von der Schwanzspitze fliegt das Licht zum Ziel, dort wirkt das Wunder (Regen).

import * as THREE from 'three';
import { MIRACLES, S } from '../core/state.js';
import { scene } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { surfaceAt } from '../world/terrain.js';
import { fields } from '../farm/farm.js';
import { trees } from '../world/trees.js';
import { CREATURES, fox } from './kinds.js';
import { foxAnim, foxOnce, foxPivot } from './creature.js';
import { anchor, over, overOff, setGlow, spark } from './body.js';
import { foxDrop, foxIdle } from './ai.js';
import { castRain } from '../hand/miracles.js';
import { noteChoice, noteDone } from './mind.js';

const CHARGE_T = 2.6, GESTURE_T = 2.3, FLY_T = 1.1;
const R = { phase: null, t: 0, x: 0, z: 0, kind: 'rain' };

// Zeichen am Boden: Kreise mit Runen, auf eine Leinwand gemalt
function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128); g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) { // Runen zwischen den Ringen
    g.save(); g.rotate(i / 8 * Math.PI * 2); g.translate(0, -107); g.lineWidth = 3; g.beginPath();
    const k = i % 3; if (k === 0) { g.moveTo(-6, -6); g.lineTo(0, 6); g.lineTo(6, -6); } else if (k === 1) { g.moveTo(0, -7); g.lineTo(0, 7); g.moveTo(-5, 0); g.lineTo(5, -4); } else { g.arc(0, 0, 5, 0, Math.PI * 1.5); }
    g.stroke(); g.restore();
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2, b = (i + 2) / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92); g.lineTo(Math.cos(b) * 92, Math.sin(b) * 92); g.lineWidth = 2; g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rune = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeTexture(), color: 0xffc861, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
rune.visible = false; scene.add(rune);

// Lichtbogen hinter der Schwanzspitze: ein Band aus den letzten Positionen, das nach hinten ausblendet
const TRAIL_N = 40, trailPos = new Float32Array(TRAIL_N * 2 * 3), trailCol = new Float32Array(TRAIL_N * 2 * 3), trailPts = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; trail.visible = false; scene.add(trail);
const TC = new THREE.Color(0xffd27a);
function updateTrail(tip, add, dt) {
  for (const p of trailPts) p.a -= dt * .9;
  while (trailPts.length && trailPts[0].a <= 0) trailPts.shift();
  if (add) { trailPts.push({ p: tip.clone(), a: 1 }); if (trailPts.length > TRAIL_N) trailPts.shift(); }
  const n = trailPts.length, w = .09 * CREATURES[fox.kind].h;
  for (let i = 0; i < TRAIL_N; i++) {
    const q = trailPts[Math.min(i, n - 1)], k = q ? Math.max(0, q.a) * (i / Math.max(1, n - 1)) : 0;
    if (!q) { trailPos.fill(0, i * 6, i * 6 + 6); continue; }
    const wk = w * (.35 + .65 * k); trailPos.set([q.p.x, q.p.y - wk, q.p.z, q.p.x, q.p.y + wk, q.p.z], i * 6);
    const c = k * k; trailCol.set([TC.r * c, TC.g * c, TC.b * c, TC.r * c, TC.g * c, TC.b * c], i * 6);
  }
  trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true; trail.visible = n > 1;
}

// Licht, das zum Ziel fliegt
const orb = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
orb.visible = false; scene.add(orb);
const orbFrom = new THREE.Vector3(), orbTo = new THREE.Vector3(), tip = new THREE.Vector3(), body = new THREE.Vector3();

// Ziel: ein Feld, das gerade wächst, sonst junger Wald in der Nähe, sonst ein Stück vor ihr
function pickTarget() {
  let best = null, bd = 1e9;
  for (const f of fields) if (f.state === 'grow') { const d = Math.hypot(f.x - fox.x, f.z - fox.z); if (d < bd && d < 30) { bd = d; best = f; } }
  if (!best) for (const t of trees) if (t.alive && !t.gone && t.g < .7) { const d = Math.hypot(t.x - fox.x, t.z - fox.z); if (d < bd && d < 18) { bd = d; best = t; } }
  if (best) return { x: best.x, z: best.z };
  return { x: fox.x + Math.sin(fox.h) * 6, z: fox.z + Math.cos(fox.h) * 6 };
}
// Ritual beginnen; liefert einen Text, wenn es nicht geht
function startRitual(kind = 'rain', at = null) {
  if (R.phase) return 'Das Ritual läuft schon.';
  const m = MIRACLES[kind]; if (S.glaube < m.cost) return `${m.label} kostet ${m.cost} Glaube.`;
  if (['grabbed', 'shrine'].includes(fox.state) || fox.next === 'shrine') return `${S.name} ist gerade beschäftigt.`;
  foxDrop(); S.glaube -= m.cost;
  const p = at || pickTarget(); R.x = p.x; R.z = p.z; R.kind = kind;
  fox.state = 'ritual'; fox.h = Math.atan2(R.x - fox.x, R.z - fox.z); fox.once = 0;
  R.phase = 'sit'; R.t = 0; foxOnce('sitDown');
  noteChoice('help', 'miracle', `${m.label} wirken`, [{ key: 'test', label: 'in der Testleiste gewählt', weight: 1 }]);
  return '';
}
function endRitual() {
  R.phase = null; overOff('ritual'); overOff('ritualTail'); setGlow(0); rune.visible = false;
  if (fox.state === 'ritual') foxIdle(1.5);
}
function updateRitual(dt, t) {
  if (!R.phase) { if (trailPts.length) updateTrail(tip, false, dt); return; }
  if (fox.state !== 'ritual') { endRitual(); return; } // unterbrochen (z. B. von der Hand gegriffen)
  const C = CREATURES[fox.kind]; R.t += dt;
  const g = surfaceAt(fox.x, fox.z);
  if (R.phase === 'sit') { // hinsetzen, dann aufladen
    if (R.t > .7) { R.phase = 'charge'; R.t = 0; foxAnim('sit'); fox.once = 0; }
  } else if (R.phase === 'charge') {
    const k = Math.min(1, R.t / CHARGE_T);
    foxAnim('sit');
    setGlow(.02 + .05 * k + Math.sin(t * 9) * .015 * k);
    rune.visible = true; rune.position.set(fox.x, g + .04, fox.z); rune.rotation.y = t * .6; rune.scale.setScalar(C.h * (1.2 + k * .6)); rune.material.opacity = Math.min(1, R.t * 1.5) * .85;
    // Ohren nach vorn, Blick zum Ziel hinauf; der Schwanz liegt um die Pfoten
    over('ritual', { Ear1L: [18, 0, 0], Ear1R: [18, 0, 0], Head: [-10, 0, 0] }, 1, 4);
    if (Math.random() < dt * 40 * k + dt * 10) { // Funken steigen am Rand des Zeichens auf und ziehen zur Kreatur
      const a = Math.random() * Math.PI * 2, r = C.h * (.6 + k * .3);
      anchor('back', body);
      spark(fox.x + Math.cos(a) * r, g + .1, fox.z + Math.sin(a) * r, { vy: .6, life: 1.1, s: .1 + Math.random() * .06, to: body, pull: 6, drag: 2 });
    }
    if (R.t >= CHARGE_T) { R.phase = 'gesture'; R.t = 0; R.fired = false; foxOnce('cast'); trailPts.length = 0; }
  } else if (R.phase === 'gesture') { // aufbäumen, Schwanz zieht von einer Seite über oben zur anderen
    const u = Math.min(1, R.t / (GESTURE_T * .75)), arc = Math.sin(u * Math.PI), sw = Math.cos(u * Math.PI); // sw: +1 … -1
    over('ritualTail', { Tail1: [95 * arc + 15, 75 * sw, 0], Tail2: [25 * arc, 25 * sw, 0], Tail3: [15 * arc, 20 * sw, 0], Tail5: [8 * arc, 15 * sw, 0], Tail7: [0, 10 * sw, 0] }, 1, 12);
    setGlow(.08 + Math.sin(t * 14) * .02); rune.material.opacity = .85 * (1 - R.t / GESTURE_T); rune.rotation.y = t * 1.8;
    anchor('tail', tip); updateTrail(tip, R.t > .25 && u < 1, dt);
    if (Math.random() < dt * 30) spark(tip.x, tip.y, tip.z, { vx: (Math.random() - .5) * .8, vy: -.3 + Math.random() * .6, vz: (Math.random() - .5) * .8, life: .8, s: .09 });
    if (!R.fired && u >= .85) { // das Licht löst sich von der Schwanzspitze
      R.fired = true; R.fly = 0; orbFrom.copy(tip); orbTo.set(R.x, surfaceAt(R.x, R.z) + 5.5, R.z); orb.visible = true;
      overOff('ritual');
    }
    if (R.fired) {
      R.fly += dt; const k = Math.min(1, R.fly / FLY_T);
      orb.position.lerpVectors(orbFrom, orbTo, k); orb.position.y += Math.sin(k * Math.PI) * 2.5; orb.scale.setScalar(1 + Math.sin(t * 20) * .15);
      if (Math.random() < dt * 60) spark(orb.position.x, orb.position.y, orb.position.z, { vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, vz: (Math.random() - .5) * .5, life: .7, s: .11 });
      if (k >= 1) {
        orb.visible = false; for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 2; spark(orbTo.x, orbTo.y, orbTo.z, { vx: Math.cos(a) * e, vy: (Math.random() - .3) * e, vz: Math.sin(a) * e, life: 1, s: .13 }); }
        if (R.kind === 'rain') castRain(R.x, R.z);
        floatText(fox.x, foxPivot.position.y + C.h + .4, fox.z, `${S.name} wirkt ${MIRACLES[R.kind].label}`, 's');
        noteDone('miracle', `${MIRACLES[R.kind].label} gewirkt`); toast(`${S.name} hat ${MIRACLES[R.kind].label} gewirkt.`);
        endRitual();
      }
    }
    if (R.t > GESTURE_T + FLY_T + .5) endRitual();
  }
}
const ritual = R;

export { ritual, startRitual, updateRitual };
