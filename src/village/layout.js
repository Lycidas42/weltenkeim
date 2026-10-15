// Lage des Dorfes: Schrein, Platz, Lager, Brunnen, Mühle; Platzieren von Modellen

import { scene } from '../core/render.js';
import { SHRINE_AT, heightAt, sacredDist } from '../world/terrain.js';
import { model, modelInfo, shadowify } from '../assets/models.js';

const SB = 1.5, ST = 1.25;
const statics = [];
function updateStatics() { for (const s of statics) s.o.position.set(s.x, heightAt(s.x, s.z), s.z); }
// Modell aufstellen: m = Schlüssel aus dem Theme (z. B. 'prop.sack') oder ein Modellobjekt mit .scene (im Code gebaute Bäume)
function place(m, x, z, ry = 0, s = SB) {
  const key = typeof m === 'string' ? m : null, g = key ? model(key) : m, o = shadowify(g.scene.clone(true));
  o.scale.setScalar(s * (key && modelInfo(key).scale || 1)); o.rotation.y = ry; scene.add(o);
  const e = { o, x, z, key }; statics.push(e); return e;
}
// Dorfplatz in der Inselmitte (Dorflinde, Brunnen), Lager am Platz; der Schrein liegt auf dem Hügel (SHRINE_AT)
const SHRINE_POS = SHRINE_AT, PLAZA = { x: 0, z: 0, r: 2.95 }, LAGER = { x: 4.7, z: 1.4 }, WELL = { x: -2.05, z: 1.55 }, MILL_POS = { x: -10, z: 1.2 };
const SHRINE_ROT = Math.atan2(-SHRINE_POS.x, -SHRINE_POS.z); // Vorderseite (+z) zeigt zum Dorf
const shrinePt = (lx, lz) => ({ x: SHRINE_POS.x + lx * Math.cos(SHRINE_ROT) + lz * Math.sin(SHRINE_ROT), z: SHRINE_POS.z - lx * Math.sin(SHRINE_ROT) + lz * Math.cos(SHRINE_ROT) });
const PRAY = shrinePt(0, 2.5), CENTER = { x: -1.4, z: -3.6 };
const onSacred = (x, z, m = 0) => sacredDist(x, z) < .6 + m;
const LUNCH_AT = PLAZA; // Mittagspause im Schatten der Dorflinde

export { CENTER, LAGER, LUNCH_AT, MILL_POS, PLAZA, PRAY, SB, SHRINE_POS, SHRINE_ROT, ST, WELL, onSacred, place, shrinePt, statics, updateStatics };
