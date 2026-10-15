// Kreismenü und Einblendung an der Kreatur

import { $, clamp } from '../core/util.js';
import { S } from '../core/state.js';
import { behindCam, canvas, clock, tA, tB, toScreen } from '../core/render.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { heldTree, input, pointerXY } from '../hand/pointer.js';
import { ACT_COL, ACT_DESC, ACT_LABEL, foxPivot } from '../creature/creature.js';
import { reinforce } from '../creature/ai.js';
import { follow, foxDoing, openSheet, setFollow } from './sheets.js';

// Tippt die Hand auf den Tiergeist, öffnet sich um ihn ein Kreis aus Aktionen. Die Liste lässt sich erweitern;
// icon = SVG-Pfade im 24er-Raster wie bei den Werkzeugen.
const FOX_ACTIONS = [
  { id: 'pet', label: () => 'Streicheln', icon: '<path d="M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.6 4 4 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>', run: () => reinforce('pet') },
  { id: 'slap', label: () => 'Klaps', icon: '<path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0v5A6.5 6.5 0 0 1 12.5 21h-.6a6 6 0 0 1-4.7-2.3L4.4 15"/><path d="M3 6l2 1.5M2.5 10H5"/>', run: () => reinforce('slap') },
  { id: 'follow', label: () => follow ? 'Nicht folgen' : 'Folgen', pressed: () => follow, icon: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>', run: () => setFollow(!follow) },
  { id: 'sheet', label: () => 'Charakter', icon: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3.5"/>', run: () => openSheet('sheetFox') },
];
let ringOpen = false, hoverFox = false;
const ringRadius = () => 40 + FOX_ACTIONS.length * 4.5; // reine Symbole: kleiner Kreis, wächst mit der Zahl der Aktionen
function openRing() {
  const R = $('ring'), n = FOX_ACTIONS.length, rad = ringRadius(); R.innerHTML = '';
  FOX_ACTIONS.forEach((a, i) => {
    const ang = -Math.PI / 2 + i * 2 * Math.PI / n, b = document.createElement('button');
    b.className = 'ra-' + a.id; b.style.setProperty('--x', `${Math.cos(ang) * rad}px`); b.style.setProperty('--y', `${Math.sin(ang) * rad}px`);
    if (a.pressed) b.setAttribute('aria-pressed', a.pressed());
    b.innerHTML = `<svg viewBox="0 0 24 24">${a.icon}</svg>`; b.title = a.label(); b.setAttribute('aria-label', a.label());
    b.addEventListener('click', e => { e.stopPropagation(); closeRing(); a.run(); });
    R.appendChild(b);
  });
  R.hidden = false; ringOpen = true; void R.offsetWidth; R.classList.add('open'); placeFoxUI(0);
}
function closeRing() { ringOpen = false; $('ring').classList.remove('open'); $('ring').hidden = true; }
addEventListener('keydown', e => { if (e.key === 'Escape' && ringOpen) closeRing(); });
// Tier unter dem Finger: Abstand zur Strecke Füße–Kopfhöhe auf dem Bildschirm, Toleranz wächst mit der Größe
function foxUnder(cx, cy) {
  const y = foxPivot.position.y, C = CREATURES[fox.kind]; toScreen(fox.x, y + C.h * .1, fox.z, tA); if (behindCam()) return false;
  toScreen(fox.x, y + C.h * .85, fox.z, tB); if (behindCam()) return false;
  const ex = tB.x - tA.x, ey = tB.y - tA.y, L2 = ex * ex + ey * ey || 1, u = clamp(((cx - tA.x) * ex + (cy - tA.y) * ey) / L2, 0, 1);
  return Math.hypot(cx - tA.x - ex * u, cy - tA.y - ey * u) < Math.max(36, Math.sqrt(L2) * .55);
}
// Kreismenü und Einblendung mitführen; die Einblendung zeigt Name, Tätigkeit und Neigungen,
// wenn das Menü offen ist oder die Hand über dem Tier schwebt, sonst nur eine offene Frage nach Lob/Tadel
let badgeT = 0;
function placeFoxUI(dt) {
  hoverFox = input.tool === 'hand' && input.handShown && input.primary === null && !input.grabbed && !heldTree.on && foxUnder(pointerXY.x, pointerXY.y);
  const C = CREATURES[fox.kind], r = canvas.getBoundingClientRect(), y = foxPivot.position.y;
  toScreen(fox.x, y + C.h * .5, fox.z, tA); let cx = tA.x - r.left, cy = tA.y - r.top;
  // Kreis vollständig im Bild halten (oben Statusleiste, unten Werkzeugleiste)
  if (ringOpen) { const m = ringRadius() + 28; cx = clamp(cx, m, r.width - m); cy = clamp(cy, m + 60, r.height - m - 110); }
  if (ringOpen) $('ring').style.transform = `translate(${cx}px, ${cy}px)`;
  const ask = fox.last && clock.elapsedTime - fox.lastT < 25, full = ringOpen || hoverFox, B = $('foxBadge');
  B.hidden = !(full || ask) || !$('sheetFox').hidden;
  if (B.hidden) return;
  if ((badgeT -= dt) <= 0 || !dt) {
    badgeT = .25;
    $('badgeName').textContent = full ? S.name : ''; $('badgeNow').textContent = full ? `${foxDoing()}.` : '';
    $('badgeAsk').textContent = ask ? (full ? `Hat ${fox.lastDesc || ACT_DESC[fox.last]}: Lob oder Tadel?` : 'Lob oder Tadel?') : '';
    $('badgeBars').innerHTML = full ? ['help', 'play', 'mischief'].map(k => `<span>${ACT_LABEL[k]}</span><i><u style="width:${Math.round(S.w[k] * 100)}%;background:${ACT_COL[k]}"></u></i>`).join('') : '';
  }
  // über dem Kopf, bei offenem Menü über dem oberen Knopf; am Bildschirmrand halten
  toScreen(fox.x, y + C.h + .15, fox.z, tB);
  const top = Math.min(tB.y - r.top, ringOpen ? cy - ringRadius() - 28 : 1e9), bw = B.offsetWidth, bh = B.offsetHeight;
  const bx = clamp(cx - bw / 2, 8, r.width - bw - 8), by = clamp(top - bh - 6, 60, r.height - bh - 8);
  B.style.transform = `translate(${bx}px, ${by}px)`;
}

export { closeRing, foxUnder, hoverFox, openRing, placeFoxUI, ringOpen };
