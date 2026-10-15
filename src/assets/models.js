// Modellverzeichnis: Die Spiellogik fragt Modelle nur über Schlüssel ab (z. B. 'hut.sawyer', 'prop.sack').
// Welche Datei dahintersteckt, mit welchem Maßstab, welchen Andockpunkten und benannten Teilen, legt das Theme fest.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import '../creature/kinds.js';
import { theme } from './theme.js';
import { $ } from '../core/util.js';
import { S } from '../core/state.js'; // stellt sicher, dass S.creature eine bekannte Gestalt ist

const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => loader.load('assets/models/' + f, res, undefined, () => rej(new Error(f + ' konnte nicht geladen werden'))));
function modelInfo(key) { const m = theme.models[key]; if (!m) throw new Error('Modell fehlt im Theme: ' + key); return m; }

// beim Start alle Modelle des Themes laden; von den Kreaturen nur die gewählte Gestalt (die anderen bei Bedarf)
$('loadSt').textContent = 'Lade Modelle …';
const loaded = {};
const startKeys = Object.keys(theme.models).filter(k => !k.startsWith('creature.')).concat('creature.' + S.creature);
await Promise.all(startKeys.map(async k => { loaded[k] = await load(modelInfo(k).file); }));

// geladenes Modell (glTF) zu einem Schlüssel
function model(key) { const g = loaded[key]; if (!g) throw new Error('Modell nicht geladen: ' + key); return g; }
// Modell nachladen, z. B. eine andere Gestalt der Kreatur; variant 'hd' = Fell-Modell fürs Porträt, falls vorhanden
const loadModel = (key, variant = 'file') => load(modelInfo(key)[variant] || modelInfo(key).file);
// Teil eines Modells finden, das das Spiel bewegt (Knotenname oder RegExp aus dem Theme)
function findPart(obj, key, part) {
  const n = modelInfo(key).parts?.[part]; if (!n) return null;
  if (typeof n === 'string') return obj.getObjectByName(n);
  let hit = null; obj.traverse(o => { if (!hit && n.test(o.name)) hit = o; }); return hit;
}
const shadowify = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function parts(g) { const out = []; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); out.push({ geo, mat: o.material }); } }); return out; }

export { findPart, load, loadModel, model, modelInfo, parts, shadowify };
