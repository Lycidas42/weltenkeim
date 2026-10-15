// Rückmeldungen im Spiel: schwebende Texte, Hinweise unten, Glaube und Holz gutschreiben

import * as THREE from 'three';
import { $, fmt1 } from '../core/util.js';
import { S, passive } from '../core/state.js';
import { camera, canvas, tmpV } from '../core/render.js';

/* ------------------------------------------------------------------ UI helpers */
const fxLayer = $('fx'); const floats = [];
function floatText(x, y, z, text, cls = 'w') {
  if (floats.length > 28) { floats[0].el.remove(); floats.shift(); }
  const el = document.createElement('div'); el.className = 'ft ' + cls; el.textContent = text; fxLayer.appendChild(el);
  floats.push({ el, p: new THREE.Vector3(x, y, z), t: 0 });
}
let toastTimer = 0;
function toast(msg, dur = 3.2) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); toastTimer = dur; }
let incomeAcc = 0, rate = 0, secT = 0;
// Glaube fließt auch ohne Gebete (Tempelstufe); die Rate in der Anzeige ist ein gleitender Mittelwert
function updateIncome(dt) {
  S.glaube += passive() * dt; incomeAcc += passive() * dt;
  secT += dt; if (secT >= 1) { rate = rate * .85 + incomeAcc / secT * .15; incomeAcc = 0; secT = 0; }
}
// Schwebende Texte steigen auf und verblassen, der Hinweis unten blendet nach seiner Zeit aus
function updateFloats(dt) {
  const rect = canvas.getBoundingClientRect();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    if (f.t > 1.5) { f.el.remove(); floats.splice(i, 1); continue; }
    tmpV.copy(f.p).project(camera);
    if (tmpV.z > 1) { f.el.style.opacity = 0; continue; }
    const sx = (tmpV.x + 1) / 2 * rect.width, sy = (1 - tmpV.y) / 2 * rect.height - f.t * 34;
    f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`; f.el.style.opacity = String(Math.min(1, (1.5 - f.t) * 2.5));
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
}
function addGlaube(n, x, y, z) { S.glaube += n; incomeAcc += n; if (x !== undefined) floatText(x, y + .7, z, '+' + fmt1(n) + ' ✦', 'g'); }
function addHolz(n, x, y, z) { S.holz += n; if (x !== undefined) floatText(x, y + .7, z, '+' + n + ' Bretter', 'h'); }
function addLogs(n, x, y, z) { S.logs += n; if (x !== undefined) floatText(x, y + .7, z, `+${n} ${n === 1 ? 'Stamm' : 'Stämme'}`, 'h'); }

export { addGlaube, addHolz, addLogs, floatText, rate, toast, updateFloats, updateIncome };
