// Symbole über dem Kopf: zeigen, was ein Bewohner gerade erlebt (Jubel, Flucht, Schwindel, Bitte, Staunen)

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { camera, dummy, scene } from '../core/render.js';
import { theme } from '../assets/theme.js';
import { HEAD_Y, HIP_Y, VS, villagers } from './villagers.js';
import { wish } from './ai.js';
import { ICON_HASTE, ICON_RAIN } from './wishes.js';

// Die Bilder sind SVG-Pfade (Ansicht 24 × 24) und werden beim Laden in einen Atlas gezeichnet: helle Fläche mit
// dunkler Kontur wie die UI-Symbole. Alle Symbole zusammen sind eine InstancedMesh, also ein einziger Draw-Call.
const star = (cx, cy, r) => 'M' + [...Array(10)].map((_, k) => { const a = k * Math.PI / 5 - Math.PI / 2, q = k % 2 ? r * .45 : r; return `${(cx + Math.cos(a) * q).toFixed(2)} ${(cy + Math.sin(a) * q).toFixed(2)}`; }).join('L') + 'z';
const svgPaths = svg => [...svg.matchAll(/d="([^"]+)"/g)].map(m => m[1]); // dieselben Bilder wie in der Wunsch-Anzeige
const C = theme.palette.emotes;
// Wichtigkeit (Abschnitt 4.6): ein neues Symbol verdrängt ein älteres nur mit höherer Wichtigkeit.
// dur: Lebenszeit in s; gehaltene Symbole (Flucht, Schwindel, Bitte) bleiben stehen, solange der Zustand andauert.
const KINDS = {
  heart: { prio: 1, dur: 3, fill: C.heart, paths: ['M12 20.5C6 16.5 3 13.2 3 9.3 3 6.6 5 4.5 7.6 4.5c1.8 0 3.3 1 4.4 2.6 1.1-1.6 2.6-2.6 4.4-2.6C19 4.5 21 6.6 21 9.3c0 3.9-3 7.2-9 11.2z'] },
  wonder: { prio: 2, dur: 2.6, fill: C.wonder, paths: ['M10 3c.8 5.2 2 7.4 7 8.5-5 1.1-6.2 3.3-7 8.5-.8-5.2-2-7.4-7-8.5 5-1.1 6.2-3.3 7-8.5z', 'M18 2.5c.35 2.1.8 2.9 2.8 3.3-2 .4-2.45 1.2-2.8 3.3-.35-2.1-.8-2.9-2.8-3.3 2-.4 2.45-1.2 2.8-3.3z', 'M18.5 16c.3 1.6.6 2.2 2.1 2.5-1.5.3-1.8.9-2.1 2.5-.3-1.6-.6-2.2-2.1-2.5 1.5-.3 1.8-.9 2.1-2.5z'] },
  rain: { prio: 3, dur: 2, held: true, fill: C.wish, paths: svgPaths(ICON_RAIN) },
  haste: { prio: 3, dur: 2, held: true, fill: C.wish, paths: svgPaths(ICON_HASTE) },
  dizzy: { prio: 4, dur: 2.2, held: true, fill: C.dizzy, spin: 3, paths: [0, 1, 2].map(k => star(12 + Math.cos(k * 2.094 - 1.57) * 6.5, 12 + Math.sin(k * 2.094 - 1.57) * 6.5, 4.2)) },
  fear: { prio: 5, dur: 2.2, held: true, fill: C.fear, paths: ['M9.8 2.8h4.4l-.9 12.4h-2.6z', 'M12 17.1a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 1 1 0-4.2z'] },
};
const KEYS = Object.keys(KINDS), CELL = 128, COLS = 4, ROWS = Math.ceil(KEYS.length / COLS);
const atlas = document.createElement('canvas'); atlas.width = CELL * COLS; atlas.height = CELL * ROWS;
{
  const g = atlas.getContext('2d'), col = c => '#' + new THREE.Color(c).getHexString();
  g.lineCap = g.lineJoin = 'round';
  KEYS.forEach((k, i) => {
    const K = KINDS[k], ps = K.paths.map(d => new Path2D(d)); K.cell = i;
    g.save(); g.translate((i % COLS) * CELL + CELL * .06, Math.floor(i / COLS) * CELL + CELL * .06); g.scale(CELL * .88 / 24, CELL * .88 / 24);
    g.strokeStyle = col(C.line); g.lineWidth = 4.4; ps.forEach(p => g.stroke(p)); // Kontur
    g.fillStyle = g.strokeStyle = col(K.fill); ps.forEach(p => g.fill(p)); g.lineWidth = 1.6; ps.forEach(p => g.stroke(p)); // Fläche, Linien
    g.restore();
  });
}
const tex = new THREE.CanvasTexture(atlas); tex.anisotropy = 4;
const MAX = 8, SIZE = .3, LIFT = .25, RISE = .12, HOLD = .8, FADE = .6;
const geo = new THREE.PlaneGeometry(SIZE, SIZE);
const aCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1), aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
geo.setAttribute('aCell', aCell); geo.setAttribute('aAlpha', aAlpha);
// unbeleuchtet (auch nachts gut sichtbar), ohne Nebel und Schatten, über allem Durchsichtigen gezeichnet
const mat = new THREE.ShaderMaterial({
  uniforms: { map: { value: tex }, grid: { value: new THREE.Vector2(COLS, ROWS) } },
  vertexShader: `attribute float aCell, aAlpha; uniform vec2 grid; varying vec2 vUv; varying float vA;
    void main() { vA = aAlpha; vUv = (vec2(mod(aCell, grid.x), grid.y - 1. - floor(aCell / grid.x)) + uv) / grid;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vA;
    void main() { vec4 c = texture2D(map, vUv); c.a *= vA; if (c.a < .01) discard; gl_FragColor = c; }`,
  transparent: true, depthWrite: false,
});
const mesh = new THREE.InstancedMesh(geo, mat, MAX);
mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.userData.noSnow = true; mesh.userData.emotes = true;
scene.add(mesh);

// je Bewohner höchstens ein Symbol (v.emo); ein neues verdrängt das alte nur mit höherer Wichtigkeit
// oder wenn dessen Anlass vorbei ist (gehaltenes Symbol blendet schon aus, z. B. Bitte erfüllt → Herz)
function show(v, k, delay = 0) {
  if (v.emo && v.emo.k !== k && !v.emo.over && KINDS[v.emo.k].prio >= KINDS[k].prio) return false;
  if (v.emo && v.emo.k === k) { v.emo.t = Math.min(v.emo.t, HOLD); v.emo.over = false; return true; } // gleiches Symbol: auffrischen
  v.emo = { k, t: -delay };
  return true;
}
// Auslöser: nur vorhandene Ereignisse, abgelesen an Zustand und Jubel der Bewohner
function held(v) {
  if (v.state === 'flee') return 'fear';
  if (v.state === 'dizzy') return 'dizzy';
  if (v.state === 'beg' && wish.kind && KINDS[wish.kind]) return wish.kind;
  return null;
}
const shown = [], cand = [], pV = new THREE.Vector3(), qSpin = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
const headTop = v => v.y + VS * v.look.s * (HEAD_Y + .08 - (v.kn || 0) * HIP_Y * .8 - (v.st || 0) * HIP_Y * .92);
function updateEmotes(dt, t) {
  camera.updateMatrixWorld(); cand.length = 0;
  for (const v of villagers) {
    const prev = v.emoState, cheer = v.cheer > 0;
    v.emoState = v.state;
    if (v.state === 'sleep' || v.state === 'grabbed' || v.state === 'falling') { v.emo = null; v.emoCheer = cheer; continue; }
    const h = held(v);
    if (v.emo && KINDS[v.emo.k].held && h !== v.emo.k) v.emo.over = true;
    if (h) show(v, h);
    if (prev === 'falling' && v.state === 'idle') show(v, 'wonder'); // sanft auf den Füßen gelandet
    if (cheer && !v.emoCheer) show(v, 'heart', Math.random() * .5); // Jubel nach erfüllter Bitte, nicht alle im Gleichtakt
    v.emoCheer = cheer;
    const e = v.emo; if (!e) continue;
    e.t += dt;
    if (h === e.k) e.t = Math.min(e.t, HOLD); // bleibt stehen, solange der Zustand andauert
    if (e.t >= KINDS[e.k].dur) { v.emo = null; continue; }
    if (e.t < 0) continue;
    // nur Symbole im Bild; Bewohner nahe der Bildmitte zuerst
    pV.set(v.x, headTop(v) + LIFT, v.z).project(camera);
    if (pV.z > 1 || Math.abs(pV.x) > 1.1 || Math.abs(pV.y) > 1.1) continue;
    e.d = pV.x * pV.x + pV.y * pV.y; cand.push(v);
  }
  cand.sort((a, b) => a.emo.d - b.emo.d);
  shown.length = 0;
  for (let i = 0; i < Math.min(MAX, cand.length); i++) {
    const v = cand[i], e = v.emo, K = KINDS[e.k];
    const a = smooth(0, .2, e.t) * (1 - smooth(K.dur - FADE, K.dur, e.t)), s = .75 + .25 * smooth(0, .25, e.t);
    dummy.position.set(v.x, headTop(v) + LIFT - RISE / 2 + RISE * smooth(0, HOLD, e.t), v.z); // Mitte etwa 0,25 über dem Kopf
    dummy.quaternion.copy(camera.quaternion);
    if (K.spin) dummy.quaternion.multiply(qSpin.setFromAxisAngle(zAxis, -t * K.spin)); // Sternchen kreisen
    dummy.scale.setScalar(s); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix); aCell.setX(i, K.cell); aAlpha.setX(i, a);
    shown.push(v);
  }
  dummy.quaternion.identity(); dummy.scale.setScalar(1); // dummy wird auch anderswo genutzt
  mesh.count = shown.length;
  mesh.instanceMatrix.needsUpdate = aCell.needsUpdate = aAlpha.needsUpdate = true;
}
const emotes = { mesh, shown, KINDS, MAX };

export { emotes, updateEmotes };
