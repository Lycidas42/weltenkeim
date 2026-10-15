// Gras und Blumen ein- und ausblenden (Sichtbarkeit, Wasser)

import { dummy, zero } from '../core/render.js';
import { CELL, HALF, N, heightAt, laneDist, streamDist } from './terrain.js';
import { WEAR } from './paths.js';
import { PLAZA, SHRINE_POS, onSacred } from '../village/layout.js';
import { cover, grassU } from './nature.js';
import { navCell, navReady, navV, navWater } from './nav.js';

// reihum ein Stück des Bewuchses neu setzen (Höhe nach Formen, Pfade, neue Gebäude); am Anfang alles
let coverK = 0, coverI = 0;
function refreshCover(budget) {
  while (budget > 0 && cover.length) {
    const K = cover[coverK], m = K.m, i0 = coverI, i1 = Math.min(K.items.length, i0 + budget);
    for (let i = i0; i < i1; i++) {
      const it = K.items[i], h = heightAt(it.x, it.z);
      const wi = Math.round((it.x + HALF) / CELL), wj = Math.round((it.z + HALF) / CELL), w = wi >= 0 && wj >= 0 && wi < N && wj < N ? WEAR[wj * N + wi] : 0;
      let vis = h > K.hmin && h < K.hmax && w < 7 && streamDist(it.x, it.z) > .45 && !onSacred(it.x, it.z, .15) && laneDist(it.x, it.z) > .45 && Math.hypot(it.x - SHRINE_POS.x, it.z - SHRINE_POS.z) > 2.35 && Math.hypot(it.x - PLAZA.x, it.z - PLAZA.z) > PLAZA.r;
      if (vis && navReady) { const c = navCell(it.x, it.z); vis = c >= 0 && !navV.g[c] || (K.hmin < 0 && navWater[c] === 1 && h > K.hmin); }
      if (!vis) { m.setMatrixAt(i, zero); continue; }
      dummy.position.set(it.x, h - K.sink * it.s, it.z); dummy.rotation.set(0, it.r, 0); dummy.scale.setScalar(it.s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    if (i1 > i0) { m.instanceMatrix.addUpdateRange(i0 * 16, (i1 - i0) * 16); m.instanceMatrix.needsUpdate = true; }
    budget -= i1 - i0; coverI = i1;
    if (coverI >= K.items.length) { coverI = 0; coverK = (coverK + 1) % cover.length; }
  }
}
let coverFirst = true;
function updateCover(t) { refreshCover(coverFirst ? 1e6 : 450); coverFirst = false; grassU.uT.value = t; } // beim ersten Frame alles setzen

export { updateCover };
