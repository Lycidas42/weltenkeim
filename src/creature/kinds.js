// Gestalten der Kreatur und ihr Zustand

import { theme } from '../assets/theme.js';
import { S } from '../core/state.js';

// Ruun kann verschiedene Gestalten annehmen (S.creature). Modelle: Quaternius Animated Animal Pack (CC0).
// h = Zielhöhe in Welteinheiten, walk/run = Geschwindigkeit, ws = Zeitfaktor der Lauf-Animation,
// rest = Liegepose aus POSES (nur Tiere mit Quaternius-AnimalArmature), hd = Fell-Modell für das Charakter-Blatt,
// react = eigene Reaktionen auf Lob und Tadel (buildReactClips).
const CREATURES = {
  fox: { label: 'Fuchs', spirit: 'Fuchsgeist', h: 1.45, walk: 1.9, run: 3.4 },
  wolf: { label: 'Wolf', spirit: 'Wolfsgeist', h: 1.75, walk: 2, run: 3.8 },
  stag: { label: 'Hirsch', spirit: 'Hirschgeist', h: 3.1, walk: 2, run: 3.8 },
  bull: { label: 'Stier', spirit: 'Stiergeist', h: 1.95, walk: 1.7, run: 3.4 },
  alpaca: { label: 'Alpaka', spirit: 'Alpakageist', h: 2.5, walk: 1.8, run: 3.4 },
  cat: { label: 'Katze', spirit: 'Katzengeist', h: 1.35, walk: 1.9, run: 3.6 },
  // Zweibeiner zum Ausprobieren (kreatur.md 3.12)
  foxfolk: { label: 'Fuchsmensch', spirit: 'Fuchsgeist', h: 2.3, walk: 1.9, run: 3.4 },
  mage: { label: 'Mensch (Test)', spirit: 'Menschengeist', h: 2.1, walk: 1.8, run: 3.4 },
};
// Aussehen aus dem Theme dazunehmen: Datei, Fell-Modell (hd), Kopfknochen, Augen, Liegepose, eigene Reaktionen, Lauftempo
for (const id in CREATURES) Object.assign(CREATURES[id], theme.models['creature.' + id]);
if (!CREATURES[S.creature]) S.creature = 'fox';
const fox = { x: -6, z: 4, h: 0, state: 'idle', timer: 4, next: null, tx: 0, tz: 0, tree: null, carry: false, act: null, last: null, lastT: -999, playT: 0, hop: 0, cur: null, idleA: 'idle', once: 0, kind: null };

export { CREATURES, fox };
