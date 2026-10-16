// Wunder als Ritual der Kreatur (kreatur.md 3.13 C), Prototyp am Fuchs: Sie setzt sich und lädt auf (das Fell
// leuchtet, ein Zeichen erscheint am Boden, Funken ziehen zu ihr), dann bäumt sie sich auf und zieht mit dem Schwanz
// einen Lichtbogen. Von der Schwanzspitze fliegt das Licht zum Ziel, dort wirkt das Wunder (Regen, Eile). Für sehr große
// Dinge (einen Felsen versetzen) wachsen stattdessen Lichtranken aus der Schwanzspitze, heben ihn an und setzen ihn ab.
// Der Stier (acts.rite 'stomp') lädt stehend auf, scharrt mit dem Huf und schnaubt; dann steigt er vorn hoch und stampft
// auf, eine Welle läuft über den Boden zum Ziel und steigt dort auf.

import * as THREE from 'three';
import { MIRACLES, S } from '../core/state.js';
import { scene } from '../core/render.js';
import { floatText, toast } from '../ui/feedback.js';
import { heightAt, surfaceAt } from '../world/terrain.js';
import { fields } from '../farm/farm.js';
import { trees } from '../world/trees.js';
import { CREATURES, fox } from './kinds.js';
import { foxAnim, foxOnce, foxPivot } from './creature.js';
import { anchor, dust, footExtra, over, overOff, setGlow, spark } from './body.js';
import { foxDrop, foxIdle, restSpot } from './ai.js';
import { masonYard } from '../village/ai.js';
import { followPath, navF, setGoal } from '../world/nav.js';
import { castHaste, castRain } from '../hand/miracles.js';
import { rocks } from '../world/nature.js';
import { buildNav, nearBuilding } from '../world/nav.js';
import { villagers } from '../village/villagers.js';
import { CENTER } from '../village/layout.js';
import { noteChoice, noteDone } from './mind.js';

const CHARGE_T = 2.6, GESTURE_T = 2.3, FLY_T = 1.1;
const R = { phase: null, t: 0, x: 0, z: 0, kind: 'rain' };
// Rituale: Wunder der Hand (Regen, Eile) und die Geisterkraft für Großes (Felsen versetzen, kostet ebenfalls Glaube)
const RITES = { rain: MIRACLES.rain, haste: MIRACLES.haste, move: { cost: 15, label: 'Felsen versetzen' }, bloom: { cost: 15, label: 'Waldblüte' } };
// Wald erblüht (Hirsch): Bäume im Umkreis wachsen weich nach, Stümpfe treiben aus
const blooms = [];
function bloom(x, z) {
  let n = 0;
  for (const t of trees) {
    if (t.gone || Math.hypot(t.x - x, t.z - z) > 5) continue;
    if (t.alive && t.g < 1) { blooms.push({ t, from: t.g, to: Math.min(1, t.g + .4), at: Math.random() * .8, k: 0 }); n++; }
    else if (!t.alive && !t.reserved) { t.alive = true; t.g = .05; t.stumpT = 0; t.regrow = 0; blooms.push({ t, from: .05, to: .35, at: Math.random() * .8, k: 0 }); n++; }
  }
  floatText(x, surfaceAt(x, z) + 2, z, n ? 'Der Wald erblüht' : 'Der Wald ist schon groß', 's');
}
function updateBlooms(dt) {
  for (let i = blooms.length - 1; i >= 0; i--) { const b = blooms[i]; if ((b.at -= dt) > 0) continue; b.k = Math.min(1, b.k + dt / 2.2); if (b.t.gone || !b.t.alive) { blooms.splice(i, 1); continue; } b.t.g = Math.max(b.t.g, b.from + (b.to - b.from) * (1 - (1 - b.k) ** 3)); if (b.k >= 1) blooms.splice(i, 1); }
}
function effect(kind, x, z) { if (kind === 'rain') castRain(x, z); else if (kind === 'haste') castHaste(x, z); else if (kind === 'bloom') bloom(x, z); }
// Heulen (Wolf): Ringe steigen vom Maul auf
const howlRings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(.3, .025, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.userData.t = 9; scene.add(m); return m; });
function updateHowl(dt, emit, from, C) {
  if (emit && (R.ringT = (R.ringT || 0) - dt) <= 0) { R.ringT = .35; const m = howlRings.find(r => r.userData.t > 1) || howlRings[0]; m.userData.t = 0; m.userData.o = from.clone(); }
  for (const m of howlRings) { const u = m.userData.t += dt; m.visible = u < 1; if (!m.visible) continue;
    m.position.copy(m.userData.o); m.position.y += u * C.h * .9; m.rotation.x = Math.PI / 2; m.scale.setScalar(.4 + u * 1.6 * C.h / 1.75); m.material.opacity = .7 * (1 - u); }
}

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
// Stoßwelle beim Aufstampfen
const shock = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
shock.visible = false; scene.add(shock);
const orbFrom = new THREE.Vector3(), orbTo = new THREE.Vector3(), tip = new THREE.Vector3(), body = new THREE.Vector3();

// Ziel: Regen auf ein Feld, das gerade wächst, sonst jungen Wald, sonst ein Stück vor ihr; Eile dorthin, wo die meisten
// Bewohner beisammen sind; Felsen: der nächste mittelgroße Felsen
function pickTarget(kind) {
  if (kind === 'bloom') { // wo die meisten jungen Bäume und Stümpfe beisammen sind
    const cand = trees.filter(t => !t.gone && (!t.alive || t.g < .8) && Math.hypot(t.x - fox.x, t.z - fox.z) < 20);
    let best = null, bn = 0; for (const t of cand) { const n = cand.filter(o => Math.hypot(o.x - t.x, o.z - t.z) < 5).length; if (n > bn) { bn = n; best = t; } }
    return best ? { x: best.x, z: best.z } : { x: fox.x + Math.sin(fox.h) * 6, z: fox.z + Math.cos(fox.h) * 6 };
  }
  if (kind === 'haste') {
    let best = null, bn = 0;
    for (const v of villagers) { if (v.state === 'sleep') continue; const n = villagers.filter(w => w.state !== 'sleep' && Math.hypot(w.x - v.x, w.z - v.z) < 5).length; if (n > bn) { bn = n; best = v; } }
    return best ? { x: best.x, z: best.z } : { x: CENTER.x, z: CENTER.z };
  }
  if (kind === 'move') {
    let best = null, bd = 1e9;
    const yard = masonYard(); // mit Steinmetz: Felsen, die noch nicht bei ihm liegen
    for (const r of rocks) { if (r.s < .25 || r.s > .8 || r.moving || (yard && r.atMason)) continue; const d = Math.hypot(r.x - fox.x, r.z - fox.z); if (d < bd && d < 16) { bd = d; best = r; } }
    return best ? { x: best.x, z: best.z, rock: best } : null;
  }
  let best = null, bd = 1e9;
  for (const f of fields) if (f.state === 'grow') { const d = Math.hypot(f.x - fox.x, f.z - fox.z); if (d < bd && d < 30) { bd = d; best = f; } }
  if (!best) for (const t of trees) if (t.alive && !t.gone && t.g < .7) { const d = Math.hypot(t.x - fox.x, t.z - fox.z); if (d < bd && d < 18) { bd = d; best = t; } }
  if (best) return { x: best.x, z: best.z };
  return { x: fox.x + Math.sin(fox.h) * 6, z: fox.z + Math.cos(fox.h) * 6 };
}
// Ritual beginnen; liefert einen Text, wenn es nicht geht
const C0 = () => CREATURES[fox.kind];
function startRitual(kind = 'rain', at = null) {
  if (!C0().acts.rites.includes(kind)) return `Das kann ein ${C0().label} nicht.`;
  if (R.phase) return 'Das Ritual läuft schon.';
  const m = RITES[kind]; if (S.glaube < m.cost) return `${m.label} kostet ${m.cost} Glaube.`;
  if (['grabbed', 'shrine'].includes(fox.state) || fox.next === 'shrine') return `${S.name} ist gerade beschäftigt.`;
  const p = at || pickTarget(kind); if (!p) return 'Kein passender Felsen in der Nähe.';
  foxDrop(); S.glaube -= m.cost;
  R.x = p.x; R.z = p.z; R.kind = kind; R.rock = p.rock || null; R.move = null;
  fox.state = 'ritual'; fox.h = Math.atan2(R.x - fox.x, R.z - fox.z); fox.once = 0;
  R.style = C0().acts.rite; R.stomp = R.style === 'stomp' || R.style === 'antler'; R.howl = R.style === 'howl'; R.t = 0; R.ringT = 0;
  // erst an einen Platz, an dem rundum Raum ist (Kopf und Hals ragen beim Aufladen weit vor, sonst stecken sie in Häusern)
  R.spot = restSpot(.85); if (Math.hypot(R.spot.x - fox.x, R.spot.z - fox.z) > .15) { R.phase = 'go'; setGoal(fox, R.spot.x, R.spot.z, navF); } else startCharge();
  noteChoice('help', 'miracle', kind === 'move' ? 'einen Felsen versetzen' : `${m.label} wirken`, [{ key: 'test', label: 'in der Testleiste gewählt', weight: 1 }]);
  return '';
}
function startCharge() {
  fox.h = Math.atan2(R.x - fox.x, R.z - fox.z); R.t = 0;
  if (R.stomp) R.phase = 'charge'; else { R.phase = 'sit'; foxOnce('sitDown'); }
}
function endRitual() {
  R.phase = null; overOff('ritual'); overOff('ritualTail'); overOff('stomp'); overOff('howl'); delete footExtra.IKFrontLegL; delete footExtra.IKFrontLegR; shock.visible = false; setGlow(0); rune.visible = false; vines.forEach(v => v.visible = false);
  if (R.move) { R.move.rock.lift = 0; R.move = null; }
  if (fox.state === 'ritual') foxIdle(1.5);
}
function updateRitual(dt, t) {
  if (blooms.length) updateBlooms(dt);
  if (!R.phase || !R.howl) for (const m of howlRings) if (m.visible) { m.userData.t += dt; m.material.opacity = .7 * Math.max(0, 1 - m.userData.t); m.visible = m.userData.t < 1; }
  if (!R.phase) { if (trailPts.length) updateTrail(tip, false, dt); return; }
  if (fox.state !== 'ritual') { endRitual(); return; } // unterbrochen (z. B. von der Hand gegriffen)
  const C = CREATURES[fox.kind]; R.t += dt;
  const g = surfaceAt(fox.x, fox.z);
  if (R.phase === 'go') { // zum freien Platz laufen, dann aufladen
    foxAnim('walk'); if (followPath(fox, C.walk * dt) || R.t > 12) startCharge();
  } else if (R.phase === 'sit') { // hinsetzen, dann aufladen
    if (R.t > .7) { R.phase = 'charge'; R.t = 0; foxAnim('sit'); fox.once = 0; }
  } else if (R.phase === 'charge') {
    const k = Math.min(1, R.t / CHARGE_T);
    if (R.stomp) { // scharren mit dem rechten Vorderhuf, Kopf gesenkt, schnauben
      foxAnim('idle'); const s = Math.sin(t * 9);
      footExtra.IKFrontLegR = [0, .05 * Math.max(0, s), .1 * s];
      if (Math.random() < dt * 10) dust(fox.x + Math.sin(fox.h) * C.h * .35, g + .03, fox.z + Math.cos(fox.h) * C.h * .35, 1, .4);
      if ((R.snort = (R.snort || 0) - dt) <= 0) { R.snort = .8; anchor('mouth', body); for (let i = 0; i < 3; i++) dust(body.x, body.y - .05, body.z, 1, .25); }
    } else foxAnim('sit');
    setGlow(.02 + .05 * k + Math.sin(t * 9) * .015 * k);
    rune.visible = true; rune.position.set(fox.x, g + .04, fox.z); rune.rotation.y = t * .6; rune.scale.setScalar(C.h * (1.2 + k * .6)); rune.material.opacity = Math.min(1, R.t * 1.5) * .85;
    // Ohren nach vorn, Blick zum Ziel hinauf; der Schwanz liegt um die Pfoten
    over('ritual', R.stomp ? { Neck1: [20, 0, 0], Head: [8, 0, 0] } : R.howl ? { Neck1: [-12 * k, 0, 0], Head: [-6 * k, 0, 0], Ear1L: [18, 0, 0], Ear1R: [18, 0, 0] } : { Ear1L: [18, 0, 0], Ear1R: [18, 0, 0], Head: [-10, 0, 0] }, 1, 4);
    if (Math.random() < dt * 40 * k + dt * 10) { // Funken steigen am Rand des Zeichens auf und ziehen zur Kreatur
      const a = Math.random() * Math.PI * 2, r = C.h * (.6 + k * .3);
      anchor(R.style === 'antler' ? 'antlers' : 'back', body); // beim Hirsch sammelt sich das Licht im Geweih
      spark(fox.x + Math.cos(a) * r, g + .1, fox.z + Math.sin(a) * r, { vy: .6, life: 1.1, s: .1 + Math.random() * .06, to: body, pull: 6, drag: 2 });
    }
    if (R.t >= CHARGE_T) { R.phase = 'gesture'; R.t = 0; R.fired = false; trailPts.length = 0; if (R.stomp) delete footExtra.IKFrontLegR; else if (!R.howl) foxOnce('cast'); }
  } else if (R.phase === 'gesture' && R.stomp) { // vorn hochsteigen, aufstampfen, eine Welle läuft zum Ziel
    const up = R.t < .55 ? Math.sin(R.t / .55 * Math.PI / 2) : 0;
    footExtra.IKFrontLegL = footExtra.IKFrontLegR = [0, .22 * up, .04 * up];
    over('stomp', { Back: [-14 * up, 0, 0], Neck1: [-10 * up, 0, 0] }, 1, 20);
    setGlow(.08 + Math.sin(t * 14) * .02); rune.material.opacity = .85 * Math.max(0, 1 - R.t / 1.2);
    if (!R.fired && R.t >= .55) { // Aufprall
      R.fired = true; R.fly = 0; overOff('ritual'); R.arc = R.style === 'antler';
      if (R.arc) { anchor('antlers', orbFrom); for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28; spark(orbFrom.x, orbFrom.y, orbFrom.z, { vx: Math.cos(a) * 1.5, vy: Math.random() * 1.5, vz: Math.sin(a) * 1.5, life: .9, s: .12 }); } } // das Geweih blitzt auf
      else { anchor('mouth', orbFrom); orbFrom.y = g; }
      shock.visible = true; shock.position.set(fox.x, g + .05, fox.z); R.shockT = 0;
      for (let i = 0; i < 28; i++) { const a = Math.random() * 6.28; dust(fox.x + Math.cos(a) * C.h * .5, g + .03, fox.z + Math.sin(a) * C.h * .5, 1, .55); }
      orbTo.set(R.x, surfaceAt(R.x, R.z) + (R.arc ? (R.kind === 'haste' ? 2.2 : R.kind === 'bloom' ? 3 : 5.5) : 0), R.z); orb.visible = true;
    }
    if (R.fired) {
      R.shockT += dt; shock.scale.setScalar(.3 + R.shockT * 5 * C.h); shock.material.opacity = Math.max(0, .9 - R.shockT * 1.2); if (R.shockT > .8) shock.visible = false;
      R.fly += dt; const k = Math.min(1, R.fly / (FLY_T * 1.3)), run = Math.min(1, k / .75), rise = Math.max(0, (k - .75) / .25);
      if (R.arc) { orb.position.lerpVectors(orbFrom, orbTo, k); orb.position.y += Math.sin(k * Math.PI) * 2.5; } // Hirsch: Bogen aus dem Geweih
      else { orb.position.lerpVectors(orbFrom, orbTo, run); orb.position.y = surfaceAt(orb.position.x, orb.position.z) + .3 + rise * rise * (R.kind === 'haste' ? 2 : 5); }
      orb.scale.setScalar(1 + Math.sin(t * 20) * .15);
      if (!R.arc && run < 1 && Math.random() < dt * 40) dust(orb.position.x, orb.position.y - .25, orb.position.z, 1, .5); // die Welle wirft Erde auf
      if (Math.random() < dt * 50) spark(orb.position.x, orb.position.y, orb.position.z, { vx: (Math.random() - .5) * .6, vy: Math.random() * .8, vz: (Math.random() - .5) * .6, life: .7, s: .11 });
      if (k >= 1) {
        orb.visible = false; for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 2; spark(orb.position.x, orb.position.y, orb.position.z, { vx: Math.cos(a) * e, vy: (Math.random() - .3) * e, vz: Math.sin(a) * e, life: 1, s: .13 }); }
        effect(R.kind, R.x, R.z);
        floatText(fox.x, foxPivot.position.y + C.h + .4, fox.z, `${S.name} wirkt ${RITES[R.kind].label}`, 's');
        noteDone('miracle', `${RITES[R.kind].label} gewirkt`); toast(`${S.name} hat ${RITES[R.kind].label} gewirkt.`);
        endRitual();
      }
    }
    if (R.t > 4) endRitual();
  } else if (R.phase === 'gesture') { // aufbäumen, Schwanz zieht von einer Seite über oben zur anderen
    const u = Math.min(1, R.t / (GESTURE_T * .75)), arc = Math.sin(u * Math.PI), sw = Math.cos(u * Math.PI); // sw: +1 … -1
    if (R.howl) { // Kopf in den Nacken, heulen; Ringe steigen auf
      const hu = Math.sin(Math.min(1, R.t / (GESTURE_T * .8)) * Math.PI);
      over('howl', { Neck1: [-42 * hu, 0, 0], Head: [-30 * hu, 0, 0], Ear1L: [-20 * hu, 0, 0], Ear1R: [-20 * hu, 0, 0] }, 1, 8);
      anchor('mouth', tip); updateHowl(dt, hu > .4, tip, C);
    } else over('ritualTail', { Tail1: [95 * arc + 15, 75 * sw, 0], Tail2: [25 * arc, 25 * sw, 0], Tail3: [15 * arc, 20 * sw, 0], Tail5: [8 * arc, 15 * sw, 0], Tail7: [0, 10 * sw, 0] }, 1, 12);
    setGlow(.08 + Math.sin(t * 14) * .02); rune.material.opacity = .85 * (1 - R.t / GESTURE_T); rune.rotation.y = t * 1.8;
    if (!R.howl) { anchor('tail', tip); updateTrail(tip, R.t > .25 && u < 1, dt); }
    if (Math.random() < dt * 30) spark(tip.x, tip.y, tip.z, { vx: (Math.random() - .5) * .8, vy: -.3 + Math.random() * .6, vz: (Math.random() - .5) * .8, life: .8, s: .09 });
    if (!R.fired && u >= .85) { // das Licht löst sich von der Schwanzspitze
      R.fired = true; R.fly = 0; overOff('ritual');
      if (R.kind === 'move') startMove(); // Lichtranken statt Licht
      else { orbFrom.copy(tip); orbTo.set(R.x, surfaceAt(R.x, R.z) + (R.kind === 'haste' ? 2.2 : 5.5), R.z); orb.visible = true; }
    }
    if (R.move) { if (updateMove(dt, t, C)) { endRitual(); } return; }
    if (R.fired) {
      R.fly += dt; const k = Math.min(1, R.fly / FLY_T);
      orb.position.lerpVectors(orbFrom, orbTo, k); orb.position.y += Math.sin(k * Math.PI) * 2.5; orb.scale.setScalar(1 + Math.sin(t * 20) * .15);
      if (Math.random() < dt * 60) spark(orb.position.x, orb.position.y, orb.position.z, { vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, vz: (Math.random() - .5) * .5, life: .7, s: .11 });
      if (k >= 1) {
        orb.visible = false; for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 2; spark(orbTo.x, orbTo.y, orbTo.z, { vx: Math.cos(a) * e, vy: (Math.random() - .3) * e, vz: Math.sin(a) * e, life: 1, s: .13 }); }
        effect(R.kind, R.x, R.z);
        floatText(fox.x, foxPivot.position.y + C.h + .4, fox.z, `${S.name} wirkt ${RITES[R.kind].label}`, 's');
        noteDone('miracle', `${RITES[R.kind].label} gewirkt`); toast(`${S.name} hat ${RITES[R.kind].label} gewirkt.`);
        endRitual();
      }
    }
    if (R.t > GESTURE_T + FLY_T + .5) endRitual();
  }
}
// Lichtranken: drei leuchtende Ranken von der Schwanzspitze zum Felsen, die sich winden. Der Felsen hebt sich, schwebt
// ein Stück vom Dorf weg und senkt sich wieder (die neue Lage wird gespeichert, S.rocks)
const vineMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
const vines = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), vineMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
const MOVE_T = { grow: .6, up: 1.1, go: 1.6, down: .7 }, rockTop = new THREE.Vector3();
function startMove() {
  const r = R.rock, dx = r.x - CENTER.x, dz = r.z - CENTER.z, l = Math.hypot(dx, dz) || 1, Y = masonYard(r.s);
  if (Y && Math.hypot(Y.x - r.x, Y.z - r.z) < 26) { const d = Math.hypot(Y.x - r.x, Y.z - r.z); R.move = { rock: r, from: { x: r.x, z: r.z }, to: { x: Y.x, z: Y.z }, t: 0, go: Math.max(MOVE_T.go, d * .2), yard: true }; return; } // zum Steinmetz schweben
  let to = null; // ein Stück vom Dorf weg, auf festem Boden, nicht in Gebäuden
  for (let d = 3.5; d < 7 && !to; d += .5) for (const a of [0, .4, -.4, .8, -.8]) { const c = Math.cos(a), s = Math.sin(a), x = r.x + (dx / l * c - dz / l * s) * d, z = r.z + (dx / l * s + dz / l * c) * d, h = heightAt(x, z); if (h > .3 && h < 3.2 && !nearBuilding(x, z, r.s + .3)) { to = { x, z }; break; } }
  if (!to) to = { x: r.x + dx / l * 3, z: r.z + dz / l * 3 };
  R.move = { rock: r, from: { x: r.x, z: r.z }, to, t: 0, go: MOVE_T.go };
}
function updateMove(dt, t, C) {
  const M = R.move, r = M.rock; M.t += dt; const T = MOVE_T, t1 = T.grow, t2 = t1 + T.up, t3 = t2 + M.go, t4 = t3 + T.down;
  const sm = x => x * x * (3 - 2 * x), up = 1.6 + r.s;
  if (M.t > t1 && M.t <= t2) r.lift = sm((M.t - t1) / T.up) * up;
  else if (M.t > t2 && M.t <= t3) { const k = sm((M.t - t2) / M.go); r.x = M.from.x + (M.to.x - M.from.x) * k; r.z = M.from.z + (M.to.z - M.from.z) * k; r.lift = up + Math.sin(k * Math.PI) * .4; }
  else if (M.t > t3) r.lift = (1 - sm(Math.min(1, (M.t - t3) / T.down))) * up;
  anchor('tail', tip); rockTop.set(r.x, heightAt(r.x, r.z) + (r.lift || 0) + r.s * .45, r.z);
  const grow = Math.min(1, M.t / T.grow), fade = M.t > t3 ? 1 - Math.min(1, (M.t - t3) / T.down) : 1;
  vines.forEach((v, i) => { // Ranke: Bogen mit Windung, wächst von der Schwanzspitze zum Felsen
    const ph = t * 3 + i * 2.1, mid = tip.clone().lerp(rockTop, .5); mid.y += 1.2 + Math.sin(ph) * .3; mid.x += Math.cos(ph + i) * .5; mid.z += Math.sin(ph * 1.3 + i) * .5;
    const end = tip.clone().lerp(rockTop, grow), m2 = tip.clone().lerp(mid, grow);
    v.geometry.dispose(); v.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(tip.clone(), m2, end), 18, .025 * C.h * (1.2 - i * .2), 5, false); v.visible = true;
  });
  vineMat.opacity = .8 * fade;
  if (Math.random() < dt * 40) spark(rockTop.x + (Math.random() - .5) * r.s, rockTop.y - r.s * .5, rockTop.z + (Math.random() - .5) * r.s, { vy: -.4, life: .8, s: .1 });
  if (M.t >= t4) {
    r.lift = 0; vines.forEach(v => v.visible = false); buildNav();
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28; spark(r.x + Math.cos(a) * r.s, heightAt(r.x, r.z) + .1, r.z + Math.sin(a) * r.s, { vx: Math.cos(a) * 1.2, vy: .5, vz: Math.sin(a) * 1.2, life: .8, s: .12 }); }
    if (M.yard) r.atMason = true;
    floatText(r.x, heightAt(r.x, r.z) + 1.4, r.z, M.yard ? 'Felsen beim Steinmetz' : 'Felsen versetzt', 's');
    noteDone('miracle', M.yard ? 'einen Felsen mit Lichtranken zum Steinmetz gebracht' : 'einen Felsen mit Lichtranken versetzt'); toast(`${S.name} hat einen Felsen ${M.yard ? 'zum Steinmetz gebracht' : 'versetzt'}.`);
    R.move = null; return true;
  }
  return false;
}
const ritual = R;

export { ritual, startRitual, updateRitual };
