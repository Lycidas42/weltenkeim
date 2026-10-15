// Gestalten der Kreatur und ihr Zustand

import { S } from '../core/state.js';

// Ruun kann verschiedene Gestalten annehmen (S.creature). Modelle: Quaternius Animated Animal Pack (CC0).
// h = Zielhöhe in Welteinheiten, walk/run = Geschwindigkeit, ws = Zeitfaktor der Lauf-Animation,
// rest = Liegepose aus POSES (nur Tiere mit Quaternius-AnimalArmature), hd = Fell-Modell für das Charakter-Blatt,
// react = eigene Reaktionen auf Lob und Tadel (buildReactClips).
const CREATURES = {
  fox: { label: 'Fuchs', spirit: 'Fuchsgeist', file: 'Fox', hd: 'Fox_HD', react: true, h: 1.45, walk: 1.9, run: 3.4, ws: 1.1, rest: 'paw' },
  wolf: { label: 'Wolf', spirit: 'Wolfsgeist', file: 'Wolf', h: 1.75, walk: 2, run: 3.8, ws: 1, rest: 'paw' },
  stag: { label: 'Hirsch', spirit: 'Hirschgeist', file: 'Stag', h: 3.1, walk: 2, run: 3.8, ws: .9, rest: 'hoof' },
  bull: { label: 'Stier', spirit: 'Stiergeist', file: 'Bull', h: 1.95, walk: 1.7, run: 3.4, ws: .9, rest: 'hoof' },
  alpaca: { label: 'Alpaka', spirit: 'Alpakageist', file: 'Alpaca', h: 2.5, walk: 1.8, run: 3.4, ws: 1, rest: 'hoof' },
  // Katze aus Quaternius Animal Pack Vol.2: nur Idle/Walk, keine Augen – Augen werden am Kopfknochen ergänzt
  cat: { label: 'Katze', spirit: 'Katzengeist', file: 'Cat', h: 1.35, walk: 1.9, run: 3.6, ws: 1.2, head: 'Bone003', eyes: { fwd: .265, up: .05, side: .06, r: .034, iris: 0x8fd14f } },
};
if (!CREATURES[S.creature]) S.creature = 'fox';
const fox = { x: -6, z: 4, h: 0, state: 'idle', timer: 4, next: null, tx: 0, tz: 0, tree: null, carry: false, act: null, last: null, lastT: -999, playT: 0, hop: 0, cur: null, idleA: 'idle', once: 0, kind: null };

export { CREATURES, fox };
