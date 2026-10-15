// Lage des Dorfes: Schrein, Platz, Lager, Brunnen, Mühle; Platzieren von Modellen

import { scene } from '../core/render.js';
import { STREAM, SHRINE_AT, heightAt, sacredDist } from '../world/terrain.js';
import { S } from '../core/state.js';
import { model, modelInfo, shadowify } from '../assets/models.js';

const SB = 1.5, ST = 1.25;
const statics = [];
// Höhe aus dem Gelände am Ursprung, oder an einem eigenen Punkt (gx, gz), z. B. Mitte des Hauses der Wassermühle
function updateStatics() { for (const s of statics) s.o.position.set(s.x, heightAt(s.gx ?? s.x, s.gz ?? s.z), s.z); }
// Modell aufstellen: m = Schlüssel aus dem Theme (z. B. 'prop.sack') oder ein Modellobjekt mit .scene (im Code gebaute Bäume)
function place(m, x, z, ry = 0, s = SB) {
  const key = typeof m === 'string' ? m : null, g = key ? model(key) : m, o = shadowify(g.scene.clone(true));
  o.scale.setScalar(s * (key && modelInfo(key).scale || 1)); o.rotation.y = ry; scene.add(o);
  const e = { o, x, z, key }; statics.push(e); return e;
}
// Dorfplatz in der Inselmitte (Dorflinde, Brunnen), Lager am Platz; der Schrein liegt auf dem Hügel (SHRINE_AT)
const SHRINE_POS = SHRINE_AT, PLAZA = { x: 0, z: 0, r: 2.95 }, LAGER = { x: 4.7, z: 1.4 }, WELL = { x: -2.05, z: 1.55 };
const SHRINE_ROT = Math.atan2(-SHRINE_POS.x, -SHRINE_POS.z); // Vorderseite (+z) zeigt zum Dorf
const shrinePt = (lx, lz) => ({ x: SHRINE_POS.x + lx * Math.cos(SHRINE_ROT) + lz * Math.sin(SHRINE_ROT), z: SHRINE_POS.z - lx * Math.sin(SHRINE_ROT) + lz * Math.cos(SHRINE_ROT) });
const PRAY = shrinePt(0, 2.5), CENTER = { x: -1.4, z: -3.6 };
const onSacred = (x, z, m = 0) => sacredDist(x, z) < .6 + m;
const LUNCH_AT = PLAZA; // Mittagspause im Schatten der Dorflinde
// Wassermühle: am Bachufer außerhalb des Häuserrings, wo der Bach ruhig fließt und das Ufer knapp über dem Wasser liegt.
// Das Haus steht am Ufer, das Rad an seiner Rückwand taucht in den Bach. Der Platz wird einmal gewählt und gespeichert
// (S.millSite), damit die Mühle nicht wandert, wenn der Spieler das Gelände formt.
const MILL_K = 1.6;
const MILL = (() => {
  const P = STREAM.pts, len = STREAM.len, ok = q => q && P[q.i] && Math.abs(q.sd) === 1;
  if (!ok(S.millSite)) {
    let bs = 1e9; S.millSite = { i: Math.floor(P.length / 2), sd: 1 };
    for (let i = 2; i < P.length - 2; i++) {
      const p = P[i], a = P[i - 2], b = P[i + 2]; if (p.s < len * .2 || p.s > len * .85) continue;
      const slope = (a.y - b.y) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
      for (const sd of [1, -1]) {
        const hx = p.x + p.nx * sd * 1.1, hz = p.z + p.nz * sd * 1.1, r = Math.hypot(hx, hz), h = heightAt(hx, hz);
        if (r < 9.5 || h < .4 || sacredDist(hx, hz) < 2 || Math.hypot(hx - SHRINE_AT.x, hz - SHRINE_AT.z) < 5) continue;
        const score = Math.abs(r - 11) + slope * 25 + Math.abs(h - p.y - .17) * 3;
        if (score < bs) { bs = score; S.millSite = { i, sd }; }
      }
    }
  }
  const { i, sd } = S.millSite, p = P[i], nx = p.nx * sd, nz = p.nz * sd, ry = Math.atan2(nx, nz);
  const tx = P[i + 1].x - P[i - 1].x, tz = P[i + 1].z - P[i - 1].z; // Fließrichtung: unten am Rad läuft das Wasser mit
  return { x: p.x + nx * .2, z: p.z + nz * .2, ry, y: p.y + .17, hx: p.x + nx * 1.1, hz: p.z + nz * 1.1, k: MILL_K, dir: Math.sign(tx * Math.cos(ry) - tz * Math.sin(ry)) || 1 };
})();
const MILL_POS = { x: MILL.hx, z: MILL.hz }; // Mitte des Mühlenhauses (Abstände für Bäume, Hütten, Felder)

export { CENTER, LAGER, LUNCH_AT, MILL, MILL_POS, PLAZA, PRAY, SB, SHRINE_POS, SHRINE_ROT, ST, WELL, onSacred, place, shrinePt, statics, updateStatics };
