// Zielen: Baum und Kreatur nur dort treffen, wo sie im Bild zu sehen sind – aus vielen zufälligen Kamerastellungen
// (nah, flach, steil, Bäume dicht neben oder hinter der Kamera).
// - Bäume: treeAt trifft keinen Baum, dessen sichtbarer Stamm weit vom Finger entfernt ist. Früher wurden Bäume seitlich
//   neben der Kamera auf riesige Bildschirmlagen projiziert, ihre Strecke zog sich quer durchs Bild (Druck ins Leere
//   packte einen Baum). Ausgenommen sind Bäume dicht vor der Kamera, deren Krone das Bild füllt.
// - Kreatur: foxUnder trifft Kopf, Rücken und Schwanz, auch von oben, und kaum Punkte daneben. Früher zählte nur eine
//   senkrechte Strecke, mit voller Hand wurde dann abgesetzt statt das Kreismenü geöffnet.

export default async (page, wk) => {
  const r = await wk.eval(w => {
    const t = w.controls.target, cv = w.renderer.domElement, rect = cv.getBoundingClientRect(), save = [t.x, t.z, w.camera.position.clone()];
    let s = 7; const R = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const look = (tx, tz, d, pol, az) => { t.x = tx; t.z = tz; w.camera.position.set(tx + d * Math.sin(pol) * Math.sin(az), t.y + d * Math.cos(pol), tz + d * Math.sin(pol) * Math.cos(az)); w.camera.lookAt(t.x, t.y, t.z); w.camera.updateMatrixWorld(); };
    // Punkt auf den Bildschirm, null wenn nicht vor der Kamera im Tiefenbereich
    const proj = (x, y, z) => {
      const v = w.camera.matrixWorldInverse.elements, p = w.camera.projectionMatrix.elements;
      const ex = v[0] * x + v[4] * y + v[8] * z + v[12], ey = v[1] * x + v[5] * y + v[9] * z + v[13], ez = v[2] * x + v[6] * y + v[10] * z + v[14];
      const cw = -ez; if (cw <= 0) return null; const nz = (p[10] * ez + p[14]) / cw; if (nz < -1 || nz > 1) return null;
      return { x: ((p[0] * ex + p[8] * ez) / cw + 1) / 2 * rect.width + rect.left, y: (1 - (p[5] * ey + p[9] * ez) / cw) / 2 * rect.height + rect.top };
    };
    const onScr = q => q && q.x > -20 && q.x < innerWidth + 20 && q.y > -20 && q.y < innerHeight + 20;

    // Bäume
    const tree = { hits: 0, bad: [] };
    for (let n = 0; n < 200; n++) {
      look((R() - .5) * 30, (R() - .5) * 30, 3 + R() * 25, .35 + R() * 1.12, R() * 6.283);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 9; j++) {
        const cx = (i + .5) / 5 * innerWidth, cy = 70 + (j + .5) / 9 * (innerHeight - 190), tr = w.treeAt(cx, cy); if (!tr) continue;
        tree.hits++; const y0 = w.heightAt(tr.x, tr.z); let d = Infinity;
        for (let k = 0; k <= 12; k++) { const q = proj(tr.x, y0 + k / 12 * 3.6 * tr.g, tr.z); if (onScr(q)) d = Math.min(d, Math.hypot(q.x - cx, q.y - cy)); }
        const dist = w.camera.position.distanceTo({ x: tr.x, y: y0, z: tr.z });
        // gar nichts vom Stamm im Bild, oder weit daneben bei einem Baum, dessen Krone nicht bis zum Finger reicht
        if ((d === Infinity && dist > 5) || (d > 90 && dist > 10)) tree.bad.push({ cx: Math.round(cx), cy: Math.round(cy), d: d === Infinity ? 'außerhalb' : Math.round(d), dist: +dist.toFixed(1) });
      }
    }

    // Kreatur: Punkte auf ihrem Modell (Schwanz bis Ohren) und Punkte daneben
    let G = null; const fox = { hit: 0, all: 0, top: [0, 0], fp: 0, fpAll: 0 };
    for (let n = 0; n < 50; n++) {
      w.fox.h = w.fox.vh = R() * 6.283; const pol = .15 + R() * 1.25;
      look(w.fox.x, w.fox.z, 5 + R() * 12, pol, R() * 6.283); w.step(1, 1 / 60, null); look(w.fox.x, w.fox.z, w.camera.position.distanceTo(t), pol, Math.atan2(w.camera.position.x - t.x, w.camera.position.z - t.z));
      if (!G) w.scene.traverse(o => { if (!G && o.type === 'Group' && o.children.length === 2 && Math.abs(o.position.x - w.fox.x) < 1e-3 && Math.abs(o.position.z - w.fox.z) < 1e-3) G = o; });
      if (!G) return { error: 'Modell der Kreatur nicht gefunden' };
      G.updateMatrixWorld(true); const v = new G.position.constructor(), pts = [];
      G.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i); if (m.isSkinnedMesh) m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); const q = proj(v.x, v.y, v.z); if (q) pts.push(q); } });
      pts.forEach((q, i) => { if (i % 5) return; const h = w.foxUnder(q.x, q.y); fox.all++; fox.hit += h; if (pol < .6) { fox.top[0]++; fox.top[1] += h; } });
      const mx = pts.reduce((a, q) => a + q.x, 0) / pts.length, my = pts.reduce((a, q) => a + q.y, 0) / pts.length;
      for (let k = 0; k < 30; k++) { const a = R() * 6.283, rad = 40 + R() * 200, x = mx + Math.cos(a) * rad, y = my + Math.sin(a) * rad; if (Math.min(...pts.map(q => Math.hypot(q.x - x, q.y - y))) < 45) continue; fox.fpAll++; fox.fp += w.foxUnder(x, y); }
    }
    t.x = save[0]; t.z = save[1]; w.camera.position.copy(save[2]);
    return { tree, fox };
  });
  if (r.error) throw new Error(r.error);
  const { tree, fox } = r, rate = fox.hit / fox.all, top = fox.top[1] / (fox.top[0] || 1), fp = fox.fp / (fox.fpAll || 1);
  console.log(`  Zielen: ${tree.hits} Baumtreffer, ${tree.bad.length} ins Leere; Kreatur ${(rate * 100).toFixed(0)} % des Körpers getroffen (von oben ${(top * 100).toFixed(0)} %), daneben ${(fp * 100).toFixed(1)} %`);
  const fails = [];
  if (tree.bad.length) fails.push(`${tree.bad.length} Baumtreffer weit vom sichtbaren Stamm, z. B. ${JSON.stringify(tree.bad.slice(0, 3))}`);
  if (rate < .9) fails.push(`Kreatur: nur ${(rate * 100).toFixed(0)} % der Punkte auf ihrem Körper treffen (mindestens 90 %)`);
  if (top < .9) fails.push(`Kreatur von oben: nur ${(top * 100).toFixed(0)} % getroffen (mindestens 90 %)`);
  if (fp > .05) fails.push(`Kreatur: ${(fp * 100).toFixed(1)} % der Punkte daneben treffen (höchstens 5 %)`);
  await wk.step(10, 1 / 60, null);
  if (fails.length) throw new Error(fails.join('\n'));
};
