// Halten als Zustand (Issue #6): packen, halten, absetzen, fallen lassen, werfen – per Touch und per Maus.
// Aufruf: node dev/check.mjs halten
//
// Touch-Gesten laufen über das Chrome-DevTools-Protokoll (Input.dispatchTouchEvent), die Maus über page.mouse.
// Zwischen den Ereignissen rechnet wk.step Bilder, damit die Hand der Bewegung folgt (Spielzeit, nicht Echtzeit).

export default async (page, wk) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // eigene Schritte ohne Zeichnen (wk.step zeichnet das letzte Bild, das kostet mit Software-WebGL Sekunden)
  wk = { ...wk, step: n => page.evaluate(n => window.__wk.step(n, 1 / 60, null), n) };
  const hold = () => wk.eval(w => w.holdState());
  const fail = msg => { throw new Error(msg); };
  let tm = Date.now(); const mark = l => { if (process.env.WK_DEBUG) console.log(`    ${l}: ${Date.now() - tm} ms`); tm = Date.now(); };
  const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;

  // Ereignisse mitschreiben; Kamera etwas näher, Kreatur weit weg, Tag, kein Menü offen
  const setup = () => wk.eval(w => {
    window.__ev = [];
    w.on('handDrop', e => __ev.push({ type: 'drop', kind: e.kind, x: e.x, z: e.z, soft: e.soft }));
    w.on('handThrow', e => __ev.push({ type: 'throw', kind: e.kind, x: e.x, z: e.z }));
    w.closeSheets(); w.setTool('hand');
  });
  await setup();
  const lastEv = () => page.evaluate(() => __ev[__ev.length - 1] || null);

  const lookAt = (x, z) => wk.eval((w, [x, z]) => { const t = w.controls.target, dx = x - t.x, dz = z - t.z; t.x += dx; t.z += dz; w.camera.position.x += dx; w.camera.position.z += dz; }, [x, z]);
  // Bildschirmpunkt eines Weltpunkts; auf der Leinwand und frei von Oberfläche (Statusleiste, Werkzeuge)?
  const scr = (x, y, z) => wk.eval((w, [x, y, z]) => w.toScreen(x, y, z, { set: (a, b) => ({ x: a, y: b }) }), [x, y, z]);
  const onCanvas = p => page.evaluate(([x, y]) => x > 20 && x < innerWidth - 20 && y > 20 && y < innerHeight - 20 && document.elementFromPoint(x, y)?.id === 'c', [p.x, p.y]);
  // Bewohner, der frei auf dem Bildschirm steht (kein anderer Bewohner, keine Kreatur in der Nähe)
  async function freeVillager(again = false) {
    const list = await wk.eval(w => {
      const o = { set: (a, b) => ({ x: a, y: b }) }, fx = w.toScreen(w.fox.x, w.heightAt(w.fox.x, w.fox.z) + .4, w.fox.z, o);
      const pts = w.villagers.map((v, i) => ({ i, st: v.state, ...w.toScreen(v.x, v.y + .25, v.z, o) }));
      return pts.filter(p => !['sleep', 'falling', 'grabbed'].includes(p.st) && Math.hypot(p.x - fx.x, p.y - fx.y) > 90);
    });
    for (const p of list) if (p.y > 330 && p.y < 640 && await onCanvas(p)) return p;
    if (!again) { // keiner im Bild: Kamera auf einen wachen Bewohner richten
      const v = await wk.eval(w => w.villagers.find(v => !['sleep', 'falling', 'grabbed'].includes(v.state) && Math.hypot(v.x - w.fox.x, v.z - w.fox.z) > 3));
      if (v) { await lookAt(v.x, v.z); await wk.step(30); return freeVillager(true); }
    }
    fail('kein frei stehender Bewohner auf dem Bildschirm: ' + JSON.stringify(await wk.eval(w => w.villagers.map(v => v.state))));
  }
  // Landpunkt (Weltkoordinaten und Bildschirm) um die Bildmitte, abseits der Kreatur, der Gebäude und von avoid
  async function landPoint(avoid) {
    const cands = await wk.eval(w => {
      const o = { set: (a, b) => ({ x: a, y: b }) }, out = [], fx = w.toScreen(w.fox.x, w.heightAt(w.fox.x, w.fox.z) + .4, w.fox.z, o), t = w.controls.target;
      for (let r = 1; r < 9; r += 1.5) for (let a = 0; a < 6.28; a += .8) {
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r, y = w.heightAt(x, z); if (y < .2 || w.nearBuilding(x, z, .8)) continue;
        const s = w.toScreen(x, y, z, o); if (Math.hypot(s.x - fx.x, s.y - fx.y) > 110 && s.y > 330 && s.y < innerHeight - 200) out.push({ x, z, sx: s.x, sy: s.y });
      }
      return out;
    });
    for (const c of cands) if ((!avoid || Math.hypot(c.sx - avoid.x, c.sy - avoid.y) > 80) && await onCanvas({ x: c.sx, y: c.sy })) return c;
    fail('kein freier Landpunkt auf dem Bildschirm');
  }
  async function tap(p, n = 3) { await touch('touchStart', [[p.x, p.y]]); await wk.step(n); await touch('touchEnd'); await wk.step(2); }
  async function grabVillager() {
    const p = await freeVillager(); await tap(p);
    const h = await hold(); if (h.kind !== 'villager') fail(`Bewohner bei (${Math.round(p.x)}, ${Math.round(p.y)}) nicht gepackt (Hand: ${h.kind})`);
    return grabbedIndex();
  }
  const grabbedIndex = () => wk.eval(w => w.villagers.indexOf(w.input.grabbed));
  const vil = i => wk.eval((w, i) => { const v = w.villagers[i]; return { x: v.x, y: v.y, z: v.z, state: v.state, hidden: !!v.hidden }; }, i);

  mark('vor 1');
  // 1. Packen, Finger anheben: bleibt in der Hand, die Hand steht still
  let vi = await grabVillager();
  const h0 = await hold(); await wk.step(240); let h1 = await hold();
  if (h1.kind !== 'villager' || (await vil(vi)).state !== 'grabbed') fail('Bewohner nach 4 s nicht mehr in der Hand');
  if (Math.hypot(h1.hand.x - h0.hand.x, h1.hand.z - h0.hand.z) > .05) fail('Hand bewegt sich ohne Finger');
  // langsam ziehen: die Hand geht wie die leere Hand unter den Finger (90 px darüber) und bleibt nach dem Anheben dort
  await touch('touchStart', [[150, 640]]); await wk.step(2);
  for (let k = 1; k <= 15; k++) { await touch('touchMove', [[150 + k * 4, 640 - k * 3]]); await wk.step(3); }
  await wk.step(10); await touch('touchEnd'); await wk.step(30);
  const h1b = await hold();
  if (h1b.kind !== 'villager') fail('langsames Ziehen hat den Bewohner losgelassen');
  if (!near(h1b.screen, { x: 210, y: 595 - 90 }, 2)) fail(`Hand folgt dem ziehenden Finger nicht (${Math.round(h1b.screen.x)}, ${Math.round(h1b.screen.y)})`);
  await wk.step(60); h1 = await hold();

  mark('vor 2');
  // 2. Zwei Finger zoomen: nichts fällt, die Hand bleibt am selben Bildschirmpunkt und gleitet über die Welt
  const cam0 = await wk.eval(w => w.camera.position.distanceTo(w.controls.target));
  await touch('touchStart', [[150, 400], [240, 400]]); await wk.step(2);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[150 + k * 8, 400], [240 - k * 8, 400]]); await wk.step(2); }
  await touch('touchEnd'); await wk.step(60);
  const cam1 = await wk.eval(w => w.camera.position.distanceTo(w.controls.target)), h2 = await hold();
  if (Math.abs(cam1 - cam0) < .3) fail(`Zwei-Finger-Geste hat nicht gezoomt (${cam0.toFixed(1)} → ${cam1.toFixed(1)})`);
  if (h2.kind !== 'villager') fail('Zwei-Finger-Geste hat den Bewohner fallen lassen');
  if (!near(h2.screen, h1.screen, 1)) fail('Haltepunkt auf dem Bildschirm hat sich beim Zoomen verschoben');
  const hs = await wk.eval(w => { const p = w.hand.g.position; return w.toScreen(p.x, Math.max(w.heightAt(p.x, p.z), 0), p.z, { set: (a, b) => ({ x: a, y: b }) }); });
  if (!near(hs, h2.screen, 6)) fail(`Hand steht nicht am Haltepunkt (${Math.round(hs.x)}, ${Math.round(hs.y)} statt ${Math.round(h2.screen.x)}, ${Math.round(h2.screen.y)})`);
  if (!h2.badge) fail('Symbol am Hand-Knopf fehlt beim Halten');
  await wk.shot('halten-zoom');

  mark('vor 3');
  // 3. Werkzeugwechsel zu Wunder und zurück: Gehaltenes bleibt, ist im Wunder-Werkzeug ausgeblendet, Symbol bleibt
  await page.click('.tools button[data-tool="miracle"]'); await wk.step(5);
  let h = await hold(), v = await vil(vi);
  if (h.kind !== 'villager' || !h.hidden || !v.hidden || h.hand.visible || !h.badge) fail(`Wunder-Werkzeug: ${JSON.stringify({ kind: h.kind, hidden: h.hidden, vHidden: v.hidden, hand: h.hand.visible, badge: h.badge })}`);
  await wk.shot('halten-wunder');
  await page.click('.tools button[data-tool="hand"]'); await wk.step(5);
  h = await hold(); v = await vil(vi);
  if (h.kind !== 'villager' || h.hidden || v.hidden || !h.hand.visible) fail('zurück im Hand-Werkzeug ist das Gehaltene nicht wieder da');

  mark('vor 4');
  // 4. Tipp auf den Boden: steht dort auf den Füßen, nicht schwindelig, arbeitet weiter
  let lp = await landPoint(h.screen);
  await tap({ x: lp.sx, y: lp.sy }, 2); await wk.step(60);
  v = await vil(vi); let ev = await lastEv();
  if ((await hold()).kind) fail('Tipp auf den Boden hat nicht abgesetzt');
  if (!ev || ev.type !== 'drop' || !ev.soft || ev.kind !== 'villager') fail('kein Ereignis handDrop (soft) beim Absetzen');
  if (Math.hypot(v.x - lp.x, v.z - lp.z) > .6) fail(`Bewohner steht nicht am Tipp-Punkt (${v.x.toFixed(1)}, ${v.z.toFixed(1)} statt ${lp.x.toFixed(1)}, ${lp.z.toFixed(1)})`);
  if (['falling', 'dizzy', 'grabbed'].includes(v.state)) fail(`nach dem Absetzen im Zustand ${v.state}`);
  const states = new Set();
  for (let k = 0; k < 8; k++) { await wk.step(30); states.add((await vil(vi)).state); }
  if (states.has('dizzy')) fail('nach sanftem Absetzen schwindelig');
  if (![...states].some(s => s !== 'idle')) fail('Bewohner nimmt nach dem Absetzen nichts wieder auf');

  mark('vor 5');
  // 5. Schnelles Wischen und Loslassen: fliegt, landet, ist nach hartem Wurf schwindelig
  vi = await grabVillager(); await wk.step(10);
  h = await hold();
  const c = await wk.eval(w => w.toScreen(w.controls.target.x, 1, w.controls.target.z, { set: (a, b) => ({ x: a, y: b }) }));
  const dir = { x: c.x - h.screen.x, y: c.y - h.screen.y }, dl = Math.hypot(dir.x, dir.y) || 1;
  const st = { x: 195, y: 560 };
  await touch('touchStart', [[st.x, st.y]]); await wk.step(1);
  for (let k = 1; k <= 5; k++) { await touch('touchMove', [[st.x + dir.x / dl * 35 * k, st.y + dir.y / dl * 35 * k]]); await wk.step(1); }
  await touch('touchEnd'); await wk.step(1);
  v = await vil(vi); ev = await lastEv();
  if (v.state !== 'falling' || !ev || ev.type !== 'throw') fail(`schnelles Wischen hat nicht geworfen (Zustand ${v.state}, Ereignis ${ev?.type})`);
  let landed = null;
  for (let k = 0; k < 30 && !landed; k++) { await wk.step(10); const s = (await vil(vi)).state; if (s !== 'falling') landed = s; }
  if (!landed) fail('geworfener Bewohner landet nicht');
  if (landed !== 'dizzy' && !(await wk.eval((w, i) => w.heightAt(w.villagers[i].x, w.villagers[i].z) < -.1, vi))) fail(`nach hartem Wurf nicht schwindelig (Zustand ${landed})`);

  mark('vor 6');
  // 6. Tipp in den Himmel: fällt senkrecht unter der Hand herunter
  await wk.step(120);
  vi = await grabVillager(); await wk.step(10);
  await wk.eval(w => { // Kamera flach stellen, damit oben Himmel zu sehen ist
    const t = w.controls.target, d = w.camera.position.distanceTo(t), az = Math.atan2(w.camera.position.x - t.x, w.camera.position.z - t.z), pol = 1.4;
    w.camera.position.set(t.x + d * Math.sin(pol) * Math.sin(az), t.y + d * Math.cos(pol), t.z + d * Math.sin(pol) * Math.cos(az));
  });
  await wk.step(30);
  // Horizont: Bildschirmhöhe eines weit entfernten Punkts auf Meereshöhe in Blickrichtung; darüber ist Himmel
  const hz = await wk.eval(w => { const c = w.camera.position, t = w.controls.target, dx = t.x - c.x, dz = t.z - c.z, l = Math.hypot(dx, dz); return w.toScreen(c.x + dx / l * 400, 0, c.z + dz / l * 400, { set: (a, b) => ({ x: a, y: b }) }); });
  let sky = null;
  for (const y of [hz.y - 40, hz.y - 80, hz.y - 25]) { const q = { x: 300, y }; if (y > 0 && await onCanvas(q)) { sky = q; break; } }
  if (!sky) fail(`kein Himmel auf dem Bildschirm (Horizont bei y = ${Math.round(hz.y)})`);
  const before = await vil(vi), hb = await hold(), pt = await wk.eval(w => w.input.ptrType);
  await tap(sky, 2);
  ev = await lastEv(); v = await vil(vi);
  if ((await hold()).kind || !ev || ev.type !== 'drop' || ev.soft) fail(`Tipp in den Himmel: nicht fallen gelassen (${JSON.stringify(ev)})`);
  for (let k = 0; k < 20 && (await vil(vi)).state === 'falling'; k++) await wk.step(10);
  v = await vil(vi);
  if (Math.hypot(v.x - before.x, v.z - before.z) > .15) fail(`fällt nicht senkrecht (versetzt um ${Math.hypot(v.x - before.x, v.z - before.z).toFixed(2)}; ${JSON.stringify({ before, v, hb, pt, sky, vi })})`);
  await wk.eval(w => { const t = w.controls.target; w.camera.position.set(t.x, t.y + 18, t.z + 14); });
  await wk.step(30);

  mark('vor 7');
  // 7. Kreatur mit voller Hand antippen: Kreismenü, nichts fällt
  vi = await grabVillager(); await wk.step(10);
  await wk.eval(w => { const t = w.controls.target; w.fox.x = t.x + 1.5; w.fox.z = t.z + 1; w.fox.state = 'idle'; });
  await wk.step(2);
  const fp = await wk.eval(w => w.toScreen(w.fox.x, w.heightAt(w.fox.x, w.fox.z) + .45, w.fox.z, { set: (a, b) => ({ x: a, y: b }) }));
  await tap(fp, 2);
  const ring = await page.evaluate(() => !document.getElementById('ring').hidden);
  if (!ring) fail(`Kreismenü öffnet sich mit voller Hand nicht (Tipp ${Math.round(fp.x)}, ${Math.round(fp.y)} auf ${await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.className, [fp.x, fp.y])}, Kreatur ${JSON.stringify(await wk.eval(w => ({ x: w.fox.x, z: w.fox.z, st: w.fox.state, t: [w.controls.target.x, w.controls.target.z] })))})`);
  if ((await hold()).kind !== 'villager') fail('Antippen der Kreatur hat das Gehaltene losgelassen');
  await tap({ x: 60, y: 700 }, 2); // schließt das Kreismenü
  if ((await hold()).kind !== 'villager') fail('Schließen des Kreismenüs hat das Gehaltene losgelassen');
  lp = await landPoint(fp); await tap({ x: lp.sx, y: lp.sy }, 2); await wk.step(60);

  mark('vor 8');
  // 8. Baum ausreißen, loslassen, Kamera bewegen, absetzen: wird zu Stämmen; Werfen geht wie heute
  async function uproot() {
    // Kamera auf einen großen Baum abseits der Bewohner richten
    const tr = await wk.eval(w => w.trees.find(t => t.alive && !t.gone && t.g >= .8 && !t.reserved && Math.hypot(t.x, t.z) < 22 && w.villagers.every(v => Math.hypot(v.x - t.x, v.z - t.z) > 2.5)));
    if (tr) { await lookAt(tr.x, tr.z); await wk.step(40); }
    const ts = await wk.eval(w => {
      const o = { set: (a, b) => ({ x: a, y: b }) }, vs = w.villagers.map(v => w.toScreen(v.x, v.y + .25, v.z, o));
      return w.trees.map((t, i) => ({ i, t, s: w.toScreen(t.x, w.heightAt(t.x, t.z) + .8 * t.g, t.z, o) }))
        .filter(({ t, s }) => t.alive && !t.gone && t.g >= .8 && s.y > 130 && s.y < innerHeight - 170 && s.x > 30 && s.x < innerWidth - 30 && vs.every(q => Math.hypot(q.x - s.x, q.y - s.y) > 60))
        .map(({ i, s }) => ({ i, x: s.x, y: s.y }));
    });
    if (process.env.WK_DEBUG) console.log('    Bäume auf dem Bildschirm:', ts.length);
    for (const p of ts.slice(0, 6)) {
      if (!await onCanvas(p)) continue;
      await touch('touchStart', [[p.x, p.y]]); await wk.step(2);
      if (process.env.WK_DEBUG) console.log('Baum', p, await wk.eval(w => ({ tg: !!w.input.treeGrab, h: w.holdState().kind, ring: !document.getElementById('ring').hidden })));
      if (!(await wk.eval(w => !!w.input.treeGrab))) { await touch('touchEnd'); await wk.step(2); if ((await hold()).kind) await tap({ x: (await landPoint()).sx, y: (await landPoint()).sy }, 2), await wk.step(60); continue; }
      await wk.step(170); await touch('touchEnd'); await wk.step(5);
      if ((await hold()).kind === 'tree') return;
    }
    fail('keinen Baum ausreißen können');
  }
  await uproot(); await wk.step(120);
  if ((await hold()).kind !== 'tree') fail('ausgerissener Baum nicht mehr in der Hand');
  await wk.eval(w => { w.controls.target.x += 3; w.camera.position.x += 3; }); await wk.step(30); // Kamera verschieben
  if ((await hold()).kind !== 'tree') fail('Kamerabewegung hat den Baum fallen lassen');
  const logs0 = await wk.eval(w => w.S.logs);
  lp = await landPoint((await hold()).screen); await tap({ x: lp.sx, y: lp.sy }, 2); await wk.step(90);
  ev = await lastEv();
  if ((await hold()).kind || !ev || ev.kind !== 'tree' || !ev.soft) fail('Baum nicht abgesetzt');
  if ((await wk.eval(w => w.S.logs)) <= logs0) fail('abgesetzter Baum wird nicht zu Stämmen');
  await uproot(); await wk.step(10);
  await touch('touchStart', [[195, 560]]); await wk.step(1);
  for (let k = 1; k <= 5; k++) { await touch('touchMove', [[195, 560 - 35 * k]]); await wk.step(1); }
  await touch('touchEnd'); await wk.step(1);
  ev = await lastEv();
  if (!ev || ev.type !== 'throw' || ev.kind !== 'tree' || !(await wk.eval(w => w.heldTree.flying))) fail('Baum nicht geworfen');
  for (let k = 0; k < 30 && await wk.eval(w => w.heldTree.on); k++) await wk.step(10);
  if (await wk.eval(w => w.heldTree.on)) fail('geworfener Baum landet nicht');

  mark('vor 9');
  // 9. Maus: Klick packt, Schild „Absetzen“, Klick setzt ab, schnelles Ziehen wirft
  const click = async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await wk.step(2); await page.mouse.up(); await wk.step(2); };
  let p = await freeVillager(); await click(p); vi = await grabbedIndex();
  if ((await hold()).kind !== 'villager') fail('Maus: Klick packt den Bewohner nicht');
  lp = await landPoint((await hold()).screen);
  await page.mouse.move(lp.sx, lp.sy); await wk.step(12);
  const hm = await hold(); // volle Hand folgt dem Mauszeiger wie die leere
  if (!near(hm.screen, { x: lp.sx, y: lp.sy }, 1)) fail('Maus: volle Hand folgt dem Zeiger nicht');
  const tip = await page.evaluate(() => { const t = document.getElementById('handTip'); return t.hidden ? null : t.textContent; });
  if (tip !== 'Absetzen') fail(`Maus: Schild unter dem Zeiger zeigt „${tip}“ statt „Absetzen“`);
  await click({ x: lp.sx, y: lp.sy }); await wk.step(60);
  v = await vil(vi); ev = await lastEv();
  if ((await hold()).kind || !ev?.soft || Math.hypot(v.x - lp.x, v.z - lp.z) > .6) fail('Maus: Klick setzt nicht am Zeiger ab');
  p = await freeVillager(); await click(p); vi = await grabbedIndex(); await wk.step(10);
  await page.mouse.move(195, 560); await page.mouse.down(); await wk.step(1);
  for (let k = 1; k <= 5; k++) { await page.mouse.move(195, 560 - 35 * k); await wk.step(1); }
  await page.mouse.up(); await wk.step(1);
  ev = await lastEv();
  if ((await vil(vi)).state !== 'falling' || ev?.type !== 'throw') fail('Maus: schnelles Ziehen wirft nicht');
  await wk.step(120);

  mark('vor 10');
  // 10. Mit voller Hand auf ein reifes Feld tippen: nicht geerntet, dort abgesetzt
  if (!(await wk.eval(w => w.fields.length))) { // kein Hof: Spielstand mit Hof speichern und neu laden
    await wk.eval(w => { w.S.huts.farmer = Math.max(1, w.S.huts.farmer); w.S.jobs.hof = 0; });
    await page.evaluate(() => dispatchEvent(new Event('wk-save')));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__wk?.step === 'function', null, { timeout: 30000 });
    await page.evaluate(() => { window.__wkHold = true; });
    await setup(); await wk.step(60);
  }
  vi = await grabVillager(); await wk.step(10);
  const fl0 = await wk.eval(w => w.fields[0] ? { x: w.fields[0].x, z: w.fields[0].z } : null);
  if (process.env.WK_DEBUG) console.log('    Felder:', await wk.eval(w => w.fields.length));
  if (fl0) { await lookAt(fl0.x, fl0.z); await wk.step(40); }
  const field = await wk.eval(w => {
    const o = { set: (a, b) => ({ x: a, y: b }) };
    for (let i = 0; i < w.fields.length; i++) { const f = w.fields[i], s = w.toScreen(f.x, w.heightAt(f.x, f.z), f.z, o); if (s.x > 30 && s.x < innerWidth - 30 && s.y > 130 && s.y < innerHeight - 160) { f.state = 'reif'; f.g = 1; f.by = null; return { i, x: f.x, z: f.z, sx: s.x, sy: s.y }; } }
    return null;
  });
  if (field) {
    await tap({ x: field.sx, y: field.sy }, 2); await wk.step(60);
    const f = await wk.eval((w, i) => w.fields[i].state, field.i); v = await vil(vi);
    if (f !== 'reif') fail(`reifes Feld mit voller Hand geerntet (Zustand ${f})`);
    if (Math.hypot(v.x - field.x, v.z - field.z) > 1.2 || (await hold()).kind) fail('Bewohner nicht auf dem Feld abgesetzt');
  } else fail('kein Feld auf dem Bildschirm');
  mark('Ende');
};
