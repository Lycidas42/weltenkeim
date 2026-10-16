// Modellverzeichnis: Die Spiellogik fragt Modelle nur über Schlüssel ab (z. B. 'hut.sawyer', 'prop.sack').
// Welche Datei dahintersteckt, mit welchem Maßstab, welchen Andockpunkten und benannten Teilen, legt das Theme fest.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import '../creature/kinds.js';
import { theme } from './theme.js';
import { $ } from '../core/util.js';
import { S } from '../core/state.js'; // stellt sicher, dass S.creature eine bekannte Gestalt ist

const loader = new GLTFLoader();
const load1 = f => new Promise((res, rej) => loader.load('assets/models/' + f, res, undefined, () => rej(new Error(f + ' konnte nicht geladen werden'))));
// bei schwacher Verbindung (z. B. Handy im WLAN nach geleertem Cache) bricht schon mal eine Datei ab: bis zu dreimal nachladen
const retry = async fn => { for (let t = 0; ; t++) { try { return await fn(); } catch (e) { if (t >= 3) throw e; await new Promise(r => setTimeout(r, 600 * (t + 1))); } } };
const load = async f => fixTextures(await retry(() => load1(f)));
// Farbbild (Textur) eines Materials, das beim Laden abgebrochen ist: Das Modell kommt dann ohne Farbe (weiß). Gleiche
// Bilder werden geteilt (alle KayKit-Gebäude nutzen denselben Farbatlas); fehlt eins, wird es nachgeladen.
const texByUri = {}, texLoader = new THREE.TextureLoader();
async function fixTextures(g) {
  const json = g.parser.json, jobs = [];
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const mi = g.parser.associations.get(m)?.materials, tex = mi !== undefined && json.materials[mi]?.pbrMetallicRoughness?.baseColorTexture;
      if (!tex) continue;
      const src = json.textures[tex.index]?.source, uri = src !== undefined && json.images[src]?.uri; if (!uri) continue;
      if (m.map && m.map.image) { texByUri[uri] = texByUri[uri] || Promise.resolve(m.map); continue; }
      jobs.push((async () => {
        const t = await (texByUri[uri] = texByUri[uri] || retry(() => texLoader.loadAsync('assets/models/' + uri)).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t; }));
        m.map = t; m.needsUpdate = true;
      })());
    }
  });
  await Promise.all(jobs); return g;
}
function modelInfo(key) { const m = theme.models[key]; if (!m) throw new Error('Modell fehlt im Theme: ' + key); return m; }

// beim Start alle Modelle des Themes laden; von den Kreaturen nur die gewählte Gestalt (die anderen bei Bedarf)
$('loadSt').textContent = 'Lade Modelle …';
const loaded = {};
const startKeys = Object.keys(theme.models).filter(k => !k.startsWith('creature.')).concat('creature.' + S.creature);
await Promise.all(startKeys.map(async k => { loaded[k] = await load(modelInfo(k).file); }));

// geladenes Modell (glTF) zu einem Schlüssel
function model(key) { const g = loaded[key]; if (!g) throw new Error('Modell nicht geladen: ' + key); return g; }
// Modell nachladen, z. B. eine andere Gestalt der Kreatur; variant 'hd' = Fell-Modell (für die geplante Nahsicht, kreatur.md 3.11), falls vorhanden
const loadModel = (key, variant = 'file') => load(modelInfo(key)[variant] || modelInfo(key).file);
// Teil eines Modells finden, das das Spiel bewegt (Knotenname oder RegExp aus dem Theme)
function findPart(obj, key, part) {
  const n = modelInfo(key).parts?.[part]; if (!n) return null;
  if (typeof n === 'string') return obj.getObjectByName(n);
  let hit = null; obj.traverse(o => { if (!hit && n.test(o.name)) hit = o; }); return hit;
}
const shadowify = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function parts(g) { const out = []; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); out.push({ geo, mat: o.material }); } }); return out; }

export { findPart, fixTextures, load, loadModel, model, modelInfo, parts, shadowify };
