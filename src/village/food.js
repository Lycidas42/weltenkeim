// Nahrung: Mittagessen aus dem Lager, Versorgung der Bewohner, Wachstum nur mit Vorrat, Gaben am Schrein (nahrung.md 1–3)

import * as THREE from 'three';
import { theme } from '../assets/theme.js';
import { S, cap } from '../core/state.js';
import { toast } from '../ui/feedback.js';
import { shrine } from './shrine.js';
import { villagers } from './villagers.js';

// Portion: Brot, Fisch, Fleisch, Gemüse je 1 Stück, Milch und Eier zählen halb. Korn und Mehl sind keine Mahlzeit.
const MEAL = { bread: 1, fish: 1, meat: 1, veg: 1, milk: .5, eggs: .5 };
const GROW_DAYS = 2, SOUL_FOOD = 3, VARIED_DAYS = 3, VARIED_KINDS = 3, GIFT_GLAUBE = 8, GIFT_HOURS = [14, 17.5], EVENING = 18;
const FOOD_COL = theme.palette.food;
// Laufzeit: Versorgung des Dorfes und Wachstumszustand ('ok', 'food' = stockt wegen Nahrung, 'full' = kein Platz)
const food = { varied: false, growth: 'ok', giftBy: null, gifts: 0, altar: null, hints: { hunger: 0, stall: 0 } }; // gifts, hints: Zähler für Prüfungen

const portions = () => { let n = 0; for (const k in MEAL) n += S[k] * MEAL[k]; return n; };
const days = () => portions() / Math.max(1, villagers.length); // wie viele Tage der Vorrat für alle reicht
// Sorte für die nächste Portion: die, von der am meisten im Lager liegt (Milch und Eier brauchen 2 Stück)
function pickMeal() { let best = null; for (const k in MEAL) if (S[k] >= 1 / MEAL[k] && (!best || S[k] > S[best])) best = k; return best; }
function takePortion() { const k = pickMeal(); if (k) S[k] -= 1 / MEAL[k]; return k; }
function takePortions(n) { for (let i = 0; i < n; i++) takePortion(); }
function updateVaried() { const kinds = new Set(); for (const m of S.meals) if (m.d > S.day - VARIED_DAYS) m.k.forEach(k => kinds.add(k)); food.varied = kinds.size >= VARIED_KINDS; }
// Mittagspause: einmal am Tag eine Portion; satt oder hungrig gilt bis zur nächsten Mittagspause
function eatLunch(v) {
  if (v.ateDay === S.day) return;
  v.ateDay = S.day;
  const k = takePortion(); v.meal = k; v.food = k ? 'satt' : 'hungrig';
  if (k) {
    let m = S.meals.find(m => m.d === S.day); if (!m) S.meals.push(m = { d: S.day, k: [] });
    if (!m.k.includes(k)) m.k.push(k);
    S.meals = S.meals.filter(m => m.d > S.day - VARIED_DAYS); updateVaried();
  } else if (!S.foodHints.hunger) {
    S.foodHints.hunger = true; food.hints.hunger++;
    toast('Die Bewohner hatten mittags nichts zu essen und beten weniger. Eine Fischerhütte, die Jagd oder ein Bauernhof füllen das Lager.', 6);
  }
}
// Wirkung der Versorgung: satt und abwechslungsreich arbeitet schneller und betet mehr, hungrig betet weniger
const workMul = v => v.food === 'satt' && food.varied ? 1.1 : 1;
const prayMul = v => v.food === 'hungrig' ? .7 : v.food === 'satt' && food.varied ? 1.2 : 1;
// Wachstum von selbst nur mit freiem Platz und Vorrat für 2 Tage
function growthState() { return villagers.length >= cap() ? 'full' : portions() >= Math.max(SOUL_FOOD, GROW_DAYS * villagers.length) ? 'ok' : 'food'; }
function noteStall() {
  if (S.foodHints.stall) return; S.foodHints.stall = true; food.hints.stall++;
  toast('Das Dorf wächst nicht weiter: Der Vorrat reicht für weniger als 2 Tage. Baue eine Fischerhütte, geh auf die Jagd oder bau einen Bauernhof – oder rufe eine Seele am Schrein.', 7);
}
// Gabe: nachmittags bringt ein freier Bewohner eine Portion zum Schrein (höchstens eine je Tag, nur gut versorgt)
const giftDue = () => food.varied && !food.giftBy && (!S.offer || S.offer.d !== S.day) && S.hour >= GIFT_HOURS[0] && S.hour < GIFT_HOURS[1] && !!pickMeal();
// Gabe auf dem Altar: Schale aus hellem Holz auf der obersten Stufe vor der Säule, darin drei Stücke in der Farbe der Sorte
const gift = (() => {
  const g = new THREE.Group(); g.position.set(0, .45, .48); g.scale.setScalar(1.3); g.visible = false; shrine.g.add(g);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.16, .1, .07, 10).translate(0, .035, 0), new THREE.MeshStandardMaterial({ color: 0xb58a55, roughness: .85, flatShading: true }));
  const mat = new THREE.MeshStandardMaterial({ color: FOOD_COL.bread, roughness: .8, flatShading: true });
  const geo = new THREE.SphereGeometry(.07, 7, 5).scale(1.3, .75, 1);
  for (const [x, z, r] of [[-.05, .02, .3], [.06, .03, -.4], [0, -.06, 1.2]]) { const o = new THREE.Mesh(geo, mat); o.position.set(x, .09, z); o.rotation.y = r; g.add(o); }
  g.add(bowl); g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return { g, mat };
})();
food.altar = gift.g;
// Tageszähler, Versorgung, Wachstumszustand und Gabe auf dem Altar fortschreiben
let lastH = S.hour, checkT = 0;
function updateFood(dt) {
  if (S.hour < lastH - 12) { S.day++; updateVaried(); } // Mitternacht (auch beim Vorspulen)
  lastH = S.hour;
  if ((checkT -= dt) <= 0) { checkT = .5; food.growth = growthState(); updateVaried(); }
  if (food.giftBy && !villagers.includes(food.giftBy)) food.giftBy = null;
  const on = !!S.offer && S.offer.d === S.day && S.hour < EVENING; // liegt bis zum Abend auf dem Altar
  gift.g.visible = on; if (on) gift.mat.color.setHex(FOOD_COL[S.offer.k] || FOOD_COL.bread);
}
updateVaried();

export { FOOD_COL, GIFT_GLAUBE, GROW_DAYS, MEAL, SOUL_FOOD, days, eatLunch, food, giftDue, growthState, noteStall, pickMeal, portions, prayMul, takePortion, takePortions, updateFood, workMul };
