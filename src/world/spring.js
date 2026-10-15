// Quelle des Bachs: Wasser tritt an einer kleinen Felsgruppe aus und quillt in einem flachen Quelltopf auf

import * as THREE from 'three';
import { scene } from '../core/render.js';
import { STREAM, heightAt, streamMat } from './terrain.js';
import { ROCK_GEOS, plantMat } from '../models/nature.js';

const SRC = STREAM.src, len = Math.hypot(SRC.dx, SRC.dz) || 1, fx = SRC.dx / len, fz = SRC.dz / len; // Fließrichtung
// Quelltopf: runde Wasserfläche mit dem Material des Bachs. Die Strömung läuft von der Mitte nach außen, in der Mitte schäumt
// es (aufquellendes Wasser), zum Rand wird das Wasser durchsichtig.
{
  // Rand unregelmäßig (Weg der Strömung je Richtung verschieden lang), sonst entstehen gleichmäßige Ringe
  const R = .55, n = 24, pos = [SRC.x, SRC.y, SRC.z], uv = [.5, 0], foam = [.55], idx = [], reach = k => .35 + .6 * Math.abs(Math.sin(k * 2.399 + 1.3));
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, r = R * (.9 + .1 * Math.sin(i * 1.7)); pos.push(SRC.x + Math.cos(a) * r, SRC.y, SRC.z + Math.sin(a) * r); uv.push(0, reach(i % n)); foam.push(.05);
    if (i) idx.push(0, i + 1, i);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1)); g.setIndex(idx); g.computeVertexNormals();
  const o = new THREE.Mesh(g, streamMat); o.receiveShadow = true; o.renderOrder = 2; o.userData.noSnow = true; scene.add(o);
}
// Felsen bergauf hinter dem Topf, halb im Hang
for (const [back, side, s, r] of [[.75, 0, .5, .4], [.55, .55, .36, 1.9], [.6, -.5, .32, 3.1], [.25, -.72, .2, 4.4]]) {
  const x = SRC.x - fx * back - fz * side, z = SRC.z - fz * back + fx * side;
  const o = new THREE.Mesh(ROCK_GEOS[Math.round(r) % ROCK_GEOS.length], plantMat);
  o.position.set(x, heightAt(x, z) - s * .2, z); o.rotation.y = r; o.scale.setScalar(s); o.castShadow = o.receiveShadow = true; scene.add(o);
}
