// Gestalten der Kreatur und ihr Zustand

import { theme } from '../assets/theme.js';
import { S } from '../core/state.js';

// Ruun kann verschiedene Gestalten annehmen (S.creature). Modelle: Quaternius Animated Animal Pack (CC0).
// h = Zielhöhe in Welteinheiten, walk/run = Geschwindigkeit, ws = Zeitfaktor der Lauf-Animation,
// rest = Liegepose aus POSES (nur Tiere mit Quaternius-AnimalArmature), hd = Fell-Modell für das Charakter-Blatt,
// react = eigene Reaktionen auf Lob und Tadel (buildReactClips), off = vorerst nicht wählbar (noch zu unfertig).
const CREATURES = {
  fox: { label: 'Fuchs', spirit: 'Fuchsgeist', h: 1.45, walk: 1.9, run: 3.4 },
  wolf: { label: 'Wolf', spirit: 'Wolfsgeist', h: 1.75, walk: 2, run: 3.8 },
  stag: { label: 'Hirsch', spirit: 'Hirschgeist', h: 3.1, walk: 2, run: 3.8 },
  bull: { label: 'Stier', spirit: 'Stiergeist', h: 1.95, walk: 1.7, run: 3.4 },
  alpaca: { label: 'Alpaka', spirit: 'Alpakageist', h: 2.5, walk: 1.8, run: 3.4, off: true },
  cat: { label: 'Katze', spirit: 'Katzengeist', h: 1.35, walk: 1.9, run: 3.6, off: true },
};
// Aussehen aus dem Theme dazunehmen: Datei, Fell-Modell (hd), Kopfknochen, Augen, Liegepose, eigene Reaktionen, Lauftempo
for (const id in CREATURES) Object.assign(CREATURES[id], theme.models['creature.' + id]);
// Was jede Gestalt mit ihrem Körper tut (kreatur.md 3.13): tree = wie sie einen Baum bringt ('drag' im Maul schleifen,
// 'push' mit dem Kopf schieben, 'horns' quer auf den Hörnern tragen, 'mouth' quer im Maul), toss = Waren selbst aufladen, self/load = Tragkraft allein bzw.
// von einem Bewohner beladen, riders = Plätze für Reiter, rite = Geste beim Ritual ('tail' Schwanzbogen, 'stomp'
// Aufstampfen, 'antler' Geweih leuchtet und Aufstampfen, 'howl' Heulen), rites = welche Rituale, help = eigene Hilfen
// (Fuchs: geschickt und schlau, Stier: rohe Kraft, Hirsch: Wald und Wachstum, Wolf: Ausdauer und Rudel)
const ACTS = {
  fox: { tree: 'drag', toss: true, self: 3, load: 5, riders: 1, rite: 'tail', rites: ['rain', 'haste', 'move'], help: ['sweep', 'plant', 'forage', 'pest'] },
  stag: { tree: 'horns', toss: false, self: 0, load: 6, riders: 1, rite: 'antler', rites: ['rain', 'haste', 'bloom'], help: ['plant', 'transplant'] },
  wolf: { tree: 'drag', toss: true, self: 4, load: 6, riders: 1, rite: 'howl', rites: ['rain', 'haste'], help: ['pest', 'patrol', 'escort'] },
  bull: { tree: 'horns', toss: false, self: 0, load: 8, riders: 2, rite: 'stomp', rites: ['rain', 'haste'], help: ['plow', 'rock'] },
};
// Grundtypus (kreatur.md 3.14 D): Antriebe 0…1, von denen die Erziehung abweicht und zu denen der Charakter ohne
// Erziehung langsam zurückkehrt. Fuchs verspielt, Stier fleißig und ernst, Hirsch ruhig, Wolf pflichtbewusst.
const BASE = {
  fox: { help: .45, play: .65, mischief: .35 },
  stag: { help: .45, play: .2, mischief: .15 },
  wolf: { help: .65, play: .4, mischief: .15 },
  bull: { help: .7, play: .2, mischief: .15 },
  alpaca: { help: .45, play: .5, mischief: .2 },
  cat: { help: .3, play: .5, mischief: .5 },
};
for (const id in CREATURES) CREATURES[id].base = BASE[id];
const ACT_DEF = { tree: 'mouth', toss: true, self: 3, load: 5, riders: 1, rite: 'tail', rites: ['rain', 'haste'], help: [] };
for (const id in CREATURES) CREATURES[id].acts = Object.assign({}, ACT_DEF, ACTS[id]);
if (!CREATURES[S.creature] || CREATURES[S.creature].off) S.creature = 'fox'; // abgeschaltete Gestalt: zurück zum Fuchs
const fox = { x: -6, z: 4, h: 0, state: 'idle', timer: 4, next: null, tx: 0, tz: 0, tree: null, carry: false, act: null, last: null, lastT: -999, playT: 0, hop: 0, cur: null, idleA: 'idle', once: 0, kind: null };

export { CREATURES, fox };
