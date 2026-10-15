// Farbrollen: Flächen der im Code gebauten Pflanzen und Felsen tragen eine Rolle (Laub der Eiche, Rinde, Fels, Gras …).
// Die Grundfarben jeder Rolle stehen in der Palette des Themes (palette.nature). Zur Laufzeit lässt sich jede Rolle
// fließend zu einer anderen Farbe hin umfärben, ohne die Formen neu zu bauen (Jahreszeiten, Ereignisse):
// Hell-Dunkel-Verlauf und Streuung der Bemalung bleiben dabei erhalten, nur der Farbton wandert zur Zielfarbe.
import * as THREE from 'three';
import { theme } from '../assets/theme.js';

const MAX_SLOTS = 32;
const NATURE = theme.palette.nature;
const SLOTS = ['keine', ...Object.keys(NATURE)]; // Rolle 0: keine Umfärbung (alles ohne Rolle)
if (SLOTS.length > MAX_SLOTS) throw new Error('Zu viele Farbrollen im Theme');
const lum = c => .299 * c.r + .587 * c.g + .114 * c.b;
const slotU = {
  uSlotCol: { value: Array.from({ length: MAX_SLOTS }, () => new THREE.Color()) },
  uSlotMix: { value: new Float32Array(MAX_SLOTS) },
  uSlotLum: { value: new Float32Array(MAX_SLOTS).fill(1) },
};
// Bezugshelligkeit je Rolle: Mittel ihrer Grundfarben (damit die Zielfarbe im Mittel gleich hell erscheint)
SLOTS.forEach((name, i) => {
  if (!i) return;
  const cs = [].concat(NATURE[name]).map(c => new THREE.Color(c));
  slotU.uSlotLum.value[i] = Math.max(.02, cs.reduce((a, c) => a + lum(c), 0) / cs.length);
  slotU.uSlotCol.value[i].copy(cs[cs.length - 1]);
});

// Nummer einer Rolle (für das Attribut „slot“ der Geometrie)
function slotId(name) { const i = SLOTS.indexOf(name); if (i < 0) throw new Error('Unbekannte Farbrolle: ' + name); return i; }
// Grundfarbe einer Rolle aus der Palette (k-te, wenn die Rolle mehrere hat)
const natureColor = (name, k = 0) => { const v = NATURE[name]; if (v === undefined) throw new Error('Unbekannte Farbrolle: ' + name); return Array.isArray(v) ? v[k % v.length] : v; };
const natureColors = name => [].concat(NATURE[name]);
// Rolle umfärben: amount 0 = Grundfarbe, 1 = ganz die Zielfarbe
function setSlot(name, color, amount = 1) { const i = slotId(name); slotU.uSlotCol.value[i].set(color); slotU.uSlotMix.value[i] = amount; }
const slotState = name => { const i = slotId(name); return { color: slotU.uSlotCol.value[i].getHex(), amount: slotU.uSlotMix.value[i] }; };

// Material um die Farbrollen erweitern (eigener onBeforeCompile bleibt erhalten). Geometrie ohne Attribut „slot“
// bekommt Rolle 0 (ausdrücklich gesetzt, sonst könnte ein Restwert anderer Zeichenaufrufe gelten).
function slotMaterial(mat) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.defaultAttributeValues = { ...(mat.defaultAttributeValues || {}), slot: [0] };
  mat.onBeforeCompile = (sh, renderer) => {
    prev.call(mat, sh, renderer);
    Object.assign(sh.uniforms, slotU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float slot;\nvarying float vSlot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlot = slot;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vSlot;\nuniform vec3 uSlotCol[${MAX_SLOTS}];\nuniform float uSlotMix[${MAX_SLOTS}];\nuniform float uSlotLum[${MAX_SLOTS}];`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { int s = int(vSlot + .5); float m = uSlotMix[s];
        if (m > 0.) diffuseColor.rgb = mix(diffuseColor.rgb, uSlotCol[s] * (dot(diffuseColor.rgb, vec3(.299, .587, .114)) / uSlotLum[s]), m); }`);
  };
  mat.customProgramCacheKey = () => 'farbrollen|' + key;
  return mat;
}

export { SLOTS, natureColor, natureColors, setSlot, slotId, slotMaterial, slotState };
