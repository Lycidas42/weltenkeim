// Symbole über dem Kopf (Issue #3): Bitte, Herz, Flucht, Schwindel, Staunen, Höchstzahl, ein Draw-Call.
// Aufruf: node dev/check.mjs emotes   (Screenshots emotes-*.png in dev/out/)

export default async (page, wk) => {
  const fail = msg => { throw new Error(msg); };
  // Kamera schräg von oben auf einen Bewohner richten (sd = -1: von der anderen Seite). Das Ziel der Kamera liegt
  // immer auf Höhe 1 (updateCamera), also auf der Sichtlinie durch den Bewohner bis zu dieser Höhe verschieben.
  const look = (x, z, sd = 1) => wk.eval((w, [x, z, sd]) => {
    const h = w.heightAt(x, z) + .3, ox = 2.5 * sd, oy = 4.6, oz = 5.2 * sd, k = (h - 1) / oy;
    w.controls.target.set(x - ox * k, 1, z - oz * k); w.camera.position.set(x + ox, h + oy, z + oz); w.controls.update();
  }, [x, z, sd]);
  // Lage eines Bewohners: Symbol, Alter, ob gezeigt, Höhe des Symbols
  const info = i => wk.eval((w, i) => {
    const v = w.villagers[i], k = w.emotes.shown.indexOf(v), m = w.emotes.mesh;
    const y = k >= 0 && k < m.count ? m.instanceMatrix.array[k * 16 + 13] : null; // Höhe aus der Instanz-Matrix
    return { state: v.state, emo: v.emo ? v.emo.k : null, t: v.emo ? v.emo.t : null, shown: k >= 0, y, x: v.x, z: v.z };
  }, i);

  await wk.eval(w => { w.S.hour = 9; w.S.glaube = 9999; w.wish.cool = 0; });

  // 1. Bitte: bittender Bewohner zeigt das Symbol des Wunsches, solange er kniet
  const by = await wk.eval(w => {
    for (const v of w.villagers) if (v.role === undefined || v.role === null) { v.state = 'idle'; v.carry = 0; v.haul = null; }
    w.startWish('haste'); return w.wish.by ? w.villagers.indexOf(w.wish.by) : -1;
  });
  if (by < 0) fail('Bitte ließ sich nicht starten (kein freier Bewohner)');
  for (let n = 0; n < 40 && (await info(by)).state !== 'beg'; n++) await wk.step(60);
  let b = await info(by);
  if (b.state !== 'beg') fail(`Bittender Bewohner kniet nicht (Zustand ${b.state})`);
  await look(b.x, b.z);
  for (let n = 0; n < 6; n++) { // 6 s knien
    await wk.step(60); b = await info(by);
    if (b.state !== 'beg') break;
    if (b.emo !== 'haste' || !b.shown) fail(`Bittender Bewohner zeigt nicht das Eile-Symbol (${b.emo}, gezeigt: ${b.shown})`);
  }
  await wk.shot('bitte');

  // 2. erfüllte Bitte: jubelnde Bewohner zeigen ein Herz, das aufsteigt und nach 2 bis 4 s verschwindet
  await wk.eval((w, i) => { const v = w.villagers[i]; w.castHaste(v.x, v.z); }, by);
  if (await wk.eval(w => w.wish.kind)) fail('Bitte wurde durch Eile nicht erfüllt');
  const seen = {}; let hearts = 0, shotDone = false;
  for (let f = 0; f <= 300; f += 6) { // 5 s in Schritten von 0,1 s
    const st = await wk.eval(w => w.villagers.map((v, i) => [i, v.emo && v.emo.k === 'heart' && v.emo.t >= 0 ? v.emo.t : null]).filter(a => a[1] !== null));
    for (const [i] of st) { seen[i] = seen[i] || { first: f, last: f }; seen[i].last = f; }
    hearts = Math.max(hearts, await wk.eval(w => w.emotes.shown.filter(v => v.emo.k === 'heart').length));
    if (f === 60 && !shotDone) { await wk.shot('herz'); shotDone = true; }
    await wk.step(6);
  }
  const ids = Object.keys(seen);
  if (!ids.length || !hearts) fail('Nach erfüllter Bitte zeigt kein Bewohner ein Herz');
  if (!seen[by]) fail('Der Bewohner, der gebeten hat, zeigt kein Herz');
  for (const i of ids) { const life = (seen[i].last - seen[i].first) / 60; if (life < 2 || life > 4) fail(`Herz von Bewohner ${i} war ${life.toFixed(1)} s zu sehen (soll 2 bis 4 s)`); }
  // steigt auf: Höhe des Symbols früh und später vergleichen
  await wk.eval((w, i) => { w.villagers[i].emo = null; w.villagers[i].cheer = 0; w.villagers[i].emoCheer = false; w.villagers[i].state = 'idle'; w.villagers[i].timer = 5; }, by);
  await wk.eval((w, i) => { w.villagers[i].cheer = 2; }, by);
  { const m = await info(by); await look(m.x, m.z); }
  await wk.step(1); let h0 = await info(by); for (let n = 0; n < 40 && h0.t < .05; n++) { await wk.step(1); h0 = await info(by); }
  await wk.step(50); const h1 = await info(by);
  if (h0.emo !== 'heart' || h1.emo !== 'heart' || h0.y === null || h1.y === null) fail('Herz für Aufstiegs-Messung nicht sichtbar');
  if (!(h1.y > h0.y + .03)) fail(`Herz steigt nicht auf (${h0.y.toFixed(3)} → ${h1.y.toFixed(3)})`);
  console.log(`    Bitte und Herz: ${ids.length} Herzen ausgelöst, höchstens ${hearts} zugleich gezeigt`);
  await wk.step(300);

  // 3. Kreatur-Unfug in Dorfnähe: fliehende Bewohner zeigen ein Ausrufezeichen
  const mis = await wk.eval(w => {
    const v = w.villagers.find(v => ['idle', 'walk'].includes(v.state)); if (!v) return null;
    const tr = w.trees.filter(t => t.alive && !t.gone).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
    Object.assign(w.fox, { x: v.x + .8, z: v.z + .4, state: 'work', act: 'mischief', tree: tr, timer: 0 });
    return w.villagers.indexOf(v);
  });
  if (mis === null) fail('Kein Bewohner für den Unfug-Test');
  { const m = await info(mis); await look(m.x, m.z, -1); } // Tiergeist steht auf der Kameraseite
  await wk.step(3);
  const fleers = await wk.eval(w => w.villagers.filter(v => v.state === 'flee').map(v => v.emo && v.emo.k));
  if (!fleers.length) fail('Unfug des Tiergeists: niemand flieht');
  if (fleers.some(k => k !== 'fear')) fail(`Fliehende Bewohner ohne Ausrufezeichen: ${fleers.join(', ')}`);
  await wk.step(9); await wk.shot('flucht');
  console.log(`    Unfug: ${fleers.length} fliehen mit Ausrufezeichen`);
  await wk.step(300);

  // 4. hart geworfener Bewohner zeigt Sternchen, solange er schwindelig ist
  const dz = await wk.eval(w => { const v = w.villagers.find(v => ['idle', 'walk'].includes(v.state)); v.emo = null; Object.assign(v, { state: 'falling', vx: 0, vz: 0, vy: -13, y: v.y + 1.5 }); return w.villagers.indexOf(v); });
  { const m = await info(dz); await look(m.x, m.z); }
  for (let n = 0; n < 60 && (await info(dz)).state === 'falling'; n++) await wk.step(2);
  let d = await info(dz), dizzyFrames = 0;
  if (d.state !== 'dizzy') fail(`Harter Wurf: Bewohner ist nicht schwindelig (${d.state})`);
  while (d.state === 'dizzy') {
    if (d.emo !== 'dizzy' || !d.shown) fail(`Schwindeliger Bewohner zeigt keine Sternchen (${d.emo}, gezeigt: ${d.shown})`);
    if (++dizzyFrames === 30) await wk.shot('schwindel');
    await wk.step(3); d = await info(dz);
  }
  console.log(`    Schwindel: Sternchen ${(dizzyFrames * 3 / 60).toFixed(1)} s lang`);

  // 5. sanft abgesetzt: Staunen
  const wd = await wk.eval(w => { const v = w.villagers.find(v => ['idle', 'walk'].includes(v.state) && !v.emo); Object.assign(v, { state: 'falling', vx: 0, vz: 0, vy: -1, y: v.y + .3 }); return w.villagers.indexOf(v); });
  for (let n = 0; n < 60 && (await info(wd)).state === 'falling'; n++) await wk.step(1);
  await wk.step(2);
  const wo = await info(wd);
  if (wo.emo !== 'wonder') fail(`Sanfte Landung ohne Staunen (${wo.state}, ${wo.emo})`);
  await wk.step(300);

  // 6. viele gleichzeitige Fluchten: je Bewohner ein Symbol, höchstens 8 zugleich, Bildmitte zuerst; ein Draw-Call
  const cap = await wk.eval(w => {
    // 16 neue Bewohner dicht beieinander, alle fliehen zugleich (dazu alle übrigen)
    const c = w.villagers[0]; for (let k = 0; k < 16; k++) w.spawnVillager(c.x + (Math.random() - .5) * 2.5, c.z + (Math.random() - .5) * 2.5);
    for (const v of w.villagers) if (!['sleep', 'grabbed', 'falling'].includes(v.state)) Object.assign(v, { state: 'flee', timer: 2, tx: v.x + .5, tz: v.z + .3 });
    return { x: c.x, z: c.z };
  });
  await look(cap.x, cap.z);
  await wk.step(10);
  const r = await wk.eval(w => {
    const E = w.emotes, m = E.mesh, sc = [];
    w.scene.traverse(o => { if (o.userData.emotes) sc.push(o.isInstancedMesh); });
    const withEmo = w.villagers.filter(v => v.emo).length, uniq = new Set(E.shown).size;
    const shownD = Math.max(...E.shown.map(v => v.emo.d)), hiddenD = Math.min(Infinity, ...w.villagers.filter(v => v.emo && v.emo.t >= 0 && v.emo.d !== undefined && !E.shown.includes(v)).map(v => v.emo.d));
    // Draw-Calls: einmal mit, einmal ohne Symbole zeichnen
    w.renderer.render(w.scene, w.camera); const on = w.renderer.info.render.calls;
    m.visible = false; w.renderer.render(w.scene, w.camera); const off = w.renderer.info.render.calls; m.visible = true;
    return { count: m.count, shown: E.shown.length, uniq, withEmo, max: E.MAX, sc, shownD, hiddenD, calls: on - off };
  });
  if (r.sc.length !== 1 || !r.sc[0]) fail(`Symbole sind nicht genau eine InstancedMesh (${JSON.stringify(r.sc)})`);
  if (r.withEmo < 9) fail(`Test zu klein: nur ${r.withEmo} Bewohner mit Symbol`);
  if (r.count > 8 || r.count !== r.shown || r.max > 8) fail(`Zu viele Symbole: ${r.count} gezeigt (Höchstzahl ${r.max})`);
  if (r.count < 8) fail(`Nur ${r.count} Symbole gezeigt, obwohl ${r.withEmo} Bewohner eins haben`);
  if (r.uniq !== r.shown) fail('Ein Bewohner hat mehr als ein Symbol');
  if (r.shownD > r.hiddenD) fail('Nicht die Bewohner nahe der Bildmitte zuerst');
  if (r.calls !== 1) fail(`Symbole brauchen ${r.calls} Draw-Calls statt einem`);
  await wk.shot('viele');
  console.log(`    Viele Fluchten: ${r.withEmo} mit Symbol, ${r.count} gezeigt, ${r.calls} Draw-Call`);
  await wk.step(240);

  // 7. Nacht: Symbole bleiben sichtbar (Screenshot)
  await wk.eval(w => { w.S.hour = 20.25; });
  await wk.step(30);
  const nv = await wk.eval(w => {
    // vier wache Bewohner nebeneinander: Herz, Ausrufezeichen, Sternchen, Herz
    const vs = w.villagers.filter(v => !['sleep', 'grabbed', 'falling'].includes(v.state)).slice(0, 4); if (vs.length < 3) return null;
    const c = vs[0];
    vs.forEach((v, k) => {
      Object.assign(v, { x: c.x + (k - 1.5) * .55, z: c.z + (k % 2) * .3, state: 'idle', timer: 5, carry: 0, emo: null, cheer: 0, emoCheer: false }); v.y = w.heightAt(v.x, v.z);
      if (k === 1) Object.assign(v, { state: 'flee', timer: 1.5, tx: v.x + .2, tz: v.z + .1 }); else if (k === 2) Object.assign(v, { state: 'dizzy', timer: 3 }); else v.cheer = 2.5;
    });
    return { x: c.x, z: c.z };
  });
  if (!nv) fail('Nachts kein wacher Bewohner');
  await look(nv.x, nv.z); await wk.step(40);
  const night = await wk.eval(w => w.emotes.mesh.count);
  if (night < 3) fail(`Nachts nur ${night} Symbole statt 3 bis 4`);
  await wk.shot('nacht');
};
