// Wunder Bann, Wirbelsturm und Blitz (Issue #13): Leiste, Kosten, Wirkung, Brand mit Neuladen, Tod eines Bewohners.
// Aufruf: node dev/check.mjs wunder   (Screenshots wunder-*.png in dev/out/)
//
// Die Wunder werden meist direkt über __wk.castBan/castStorm/castBolt gewirkt; Kosten, zu wenig Glaube und die
// Wischgeste des Sturms laufen über tryMiracle bzw. echte Touch-Ereignisse (Chrome-DevTools-Protokoll).

export default async (page, wk) => {
  const fail = msg => { throw new Error(msg); };
  const log = msg => console.log('    ' + msg);
  const run = n => page.evaluate(n => window.__wk.step(n, 1 / 60, null), n); // rechnen ohne zu zeichnen
  // Kamera schräg von oben auf einen Punkt (wie dev/checks/emotes.mjs), d = Abstand
  const look = (x, z, d = 1) => wk.eval((w, [x, z, d]) => {
    const h = w.heightAt(x, z) + .3, ox = 2.5 * d, oy = 4.6 * d, oz = 5.2 * d, k = (h - 1) / oy;
    w.controls.target.set(x - ox * k, 1, z - oz * k); w.camera.position.set(x + ox, h + oy, z + oz); w.controls.update();
  }, [x, z, d]);
  const toastText = () => page.evaluate(() => document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '');
  const clearToast = () => page.evaluate(() => { const t = document.getElementById('toast'); t.classList.remove('show'); t.textContent = ''; });

  const setup = () => wk.eval(w => {
    w.S.hour = 9; w.S.timePaused = true; w.S.glaube = 5000; w.wish.cool = 9999; w.closeSheets();
    window.__hits = []; w.on('miracleHit', e => __hits.push(JSON.parse(JSON.stringify(e))));
    // Leistung: Wirbel, Flammen, Funken, fliegende Bäume und Asche sind vorab angelegte Instanzen bzw. Partikelsysteme.
    // Fügt eines der Wunder-Module während der Prüfung etwas zur Szene hinzu, fällt das auf (noAdds).
    const add = w.scene.add.bind(w.scene); window.__adds = []; w.scene.add = (...o) => { const st = new Error().stack || ''; if (/miracles\.js|fire\.js|death\.js|flingTree|updateFlying/.test(st)) window.__adds.push(st.split('\n').slice(1, 4).join(' | ')); return add(...o); };
  });
  await setup();
  const noAdds = async what => { const a = await page.evaluate(() => window.__adds.splice(0)); if (a.length) fail(`${what}: ${a.length} neue Objekte in der Szene (${a[0]})`); };

  // 1. Wunder-Leiste: fünf Wunder mit Kosten in einer Reihe (390 px)
  await wk.eval(w => { w.setTool('miracle'); w.chooseMiracle('rain'); });
  const bar = await page.evaluate(() => [...document.querySelectorAll('#ctxMiracle button')].map(b => { const r = b.getBoundingClientRect(); return { m: b.dataset.m, cost: b.querySelector('.cost')?.textContent, top: Math.round(r.top), left: r.left, right: r.right }; }));
  if (bar.length !== 5) fail(`Wunder-Leiste hat ${bar.length} Knöpfe statt 5`);
  if (bar.some(b => !/\d/.test(b.cost || ''))) fail('Ein Wunder-Knopf zeigt keine Kosten');
  if (new Set(bar.map(b => b.top)).size !== 1) fail(`Wunder-Knöpfe nicht in einer Reihe: ${bar.map(b => b.top).join(', ')}`);
  const vw = await page.evaluate(() => innerWidth);
  if (bar[0].left < 0 || bar[4].right > vw) fail(`Wunder-Leiste ragt aus dem Bild (${bar[0].left}–${bar[4].right} bei ${vw} px)`);
  log(`Leiste: ${bar.map(b => `${b.m} ${b.cost}`).join(' · ')}, ${Math.round(bar[0].left)}–${Math.round(bar[4].right)} px von ${vw}`);

  // 2. Zu wenig Glaube: Hinweis, kein Effekt (Bann, Sturm, Blitz)
  for (const m of ['ban', 'storm', 'bolt']) {
    await clearToast();
    const r = await wk.eval((w, m) => {
      w.S.glaube = 3; w.chooseMiracle(m);
      const a = w.wild.find(a => a.state !== 'dead'), v = w.villagers.find(v => !['sleep', 'mine'].includes(v.state));
      const p = m === 'ban' ? { x: a.x, z: a.z } : m === 'bolt' ? { x: v.x, z: v.z } : { x: 0, z: 0, path: [{ x: -4, z: 6 }, { x: 4, z: 6 }] };
      const n0 = w.villagers.length, ok = w.tryMiracle(p);
      return { ok, glaube: w.S.glaube, stun: m === 'ban' ? a.stun || 0 : 0, storm: w.storm.on, dying: w.villagers.filter(v => v.state === 'dying').length, n: w.villagers.length - n0 };
    }, m);
    const t = await toastText();
    if (r.ok || r.glaube !== 3 || r.stun > 0 || r.storm || r.dying) fail(`Zu wenig Glaube für ${m}: Wunder wurde trotzdem gewirkt (${JSON.stringify(r)})`);
    if (!/kostet \d+ Glaube/.test(t)) fail(`Zu wenig Glaube für ${m}: kein Hinweis (${t})`);
  }
  await wk.eval(w => { w.S.glaube = 5000; });
  log('zu wenig Glaube: Hinweis, kein Effekt');

  // 3. Bann: Landtiere im Umkreis gebannt, außerhalb nicht; Glaube sinkt um die Kosten; Kreatur zeigt ihre Geste
  const fox = () => wk.eval(w => { Object.assign(w.fox, { state: 'idle', timer: 5, tree: null, act: null }); });
  const foxCast = () => wk.eval(w => w.fox.state === 'cast' || w.fox.hop > 0);
  await fox();
  const ban = await wk.eval(w => {
    for (const a of w.wild) a.stun = 0;
    const R = w.MIRACLES.ban.r, cnt = a => w.wild.filter(b => b.state !== 'dead' && Math.hypot(b.x - a.x, b.z - a.z) < R).length;
    const a = w.wild.filter(a => a.state !== 'dead').sort((p, q) => cnt(q) - cnt(p))[0];
    const g0 = w.S.glaube; w.chooseMiracle('ban'); w.tryMiracle({ x: a.x, z: a.z });
    const inR = w.wild.filter(b => b.state !== 'dead' && Math.hypot(b.x - a.x, b.z - a.z) < R - .05), out = w.wild.filter(b => b.state !== 'dead' && Math.hypot(b.x - a.x, b.z - a.z) > R + .05);
    return { x: a.x, z: a.z, paid: g0 - w.S.glaube, cost: w.MIRACLES.ban.cost, inR: inR.length, inStun: inR.filter(b => b.stun > 0).length, out: out.length, outStun: out.filter(b => b.stun > 0).length };
  });
  if (ban.paid !== ban.cost) fail(`Bann: Glaube sank um ${ban.paid} statt ${ban.cost}`);
  if (!ban.inR || ban.inStun !== ban.inR) fail(`Bann: ${ban.inStun} von ${ban.inR} Tieren im Umkreis gebannt`);
  if (ban.outStun) fail(`Bann: ${ban.outStun} Tiere außerhalb gebannt`);
  if (!await foxCast()) fail('Kreatur zeigt beim Bann keine Geste');
  await look(ban.x, ban.z, 1.2); await run(30); await wk.shot('bann');
  log(`Bann: ${ban.inR} Tiere im Umkreis gebannt, ${ban.out} außerhalb frei, Kosten ${ban.paid}`);

  // 4. Hand auf lebendes Wild: bannt nicht, Hinweis; erlegtes Wild lässt sich aufheben
  await wk.eval(w => { w.setTool('hand'); for (const a of w.wild) a.stun = 0; });
  const hw = await wk.eval(w => { const a = w.wild.find(a => a.state !== 'dead' && Math.hypot(a.x - w.fox.x, a.z - w.fox.z) > 3 && w.villagers.every(v => Math.hypot(v.x - a.x, v.z - a.z) > 1.5)); window.__hw = a; Object.assign(a, { state: 'idle', timer: 20 }); a.path = null; return { x: a.x, z: a.z }; });
  await look(hw.x, hw.z); await run(2); await clearToast();
  const handWild = await wk.eval(w => {
    const a = window.__hw; Object.assign(a, { state: 'idle', timer: 20 });
    const s = w.toScreen(a.x, w.heightAt(a.x, a.z) + (a.kind === 'reh' ? .3 : .1), a.z, { set: (x, y) => ({ x, y }) });
    const h = w.helpAt(s.x, s.y); if (h) h.run();
    const live = { label: h ? h.label : null, stun: a.stun || 0 };
    a.state = 'dead'; a.timer = 40; const meat0 = w.S.meat, h2 = w.helpAt(s.x, s.y); if (h2) h2.run();
    return { live, dead: h2 ? h2.label : null, meat: w.S.meat - meat0, gone: !w.wild.includes(a) };
  });
  const ht = await toastText();
  if (handWild.live.stun > 0) fail('Hand-Tipp auf lebendes Wild bannt noch');
  if (!/Wunder/.test(ht)) fail(`Hand-Tipp auf lebendes Wild: kein Hinweis auf das Wunder (${ht})`);
  if (handWild.dead !== 'Aufheben' || handWild.meat <= 0 || !handWild.gone) fail(`Erlegtes Wild lässt sich nicht aufheben (${JSON.stringify(handWild)})`);
  log(`Hand: lebendes Wild → Hinweis „${ht.slice(0, 40)}…“, erlegtes Wild aufgehoben (+${handWild.meat} Fleisch)`);

  // 5. Jäger erlegt gebanntes Wild mit dem ersten Schuss (Jagdhütte bauen lassen, falls es keine gibt)
  await wk.eval(w => { w.setTool('miracle'); if (!w.villagers.some(v => v.role === 'hunter')) { w.S.jobs.jagd = 1; w.S.holz = Math.max(w.S.holz, 400); } });
  for (let n = 0; n < 40 && !(await wk.eval(w => w.villagers.some(v => v.role === 'hunter' && v.hut))); n++) await run(120);
  const hunter = await wk.eval(w => { const v = w.villagers.find(v => v.role === 'hunter' && v.hut); return v ? w.villagers.indexOf(v) : -1; });
  if (hunter < 0) fail('Kein Jäger für die Bann-Prüfung (Jagdhütte nicht gebaut)');
  const prey = await wk.eval((w, i) => {
    const v = w.villagers[i], a = w.wild.filter(a => a.state !== 'dead').sort((p, q) => Math.hypot(p.x - v.hut.x, p.z - v.hut.z) - Math.hypot(q.x - v.hut.x, q.z - v.hut.z))[0];
    for (const o of w.wild) o.stun = 0;
    w.arrows.length = 0; v.prey = null; v.state = 'idle'; v.timer = 0; v.carry = 0; v.drop = null;
    // Jäger in Pirschweite (etwa 8 Schritte) neben das Wild stellen, dort, wo er stehen kann
    for (let k = 0; k < 24; k++) { const g = k / 24 * 6.28, x = a.x + Math.cos(g) * 8, z = a.z + Math.sin(g) * 8; if (w.heightAt(x, z) > .3 && !w.buildingAt(x, z, .5)) { v.x = x; v.z = z; break; } }
    w.castBan(a.x, a.z); window.__prey = a;
    return { stun: a.stun };
  }, hunter);
  if (!(prey.stun > 0)) fail('Bann: Ziel-Wild für den Jäger nicht gebannt');
  // erster Pfeil, der auf ein gebanntes Tier fliegt (ein Pfeil fliegt etwa eine halbe Sekunde)
  let shot = null;
  for (let f = 0; f < 60 * 20 && !shot; f += 5) {
    await run(5);
    shot = await wk.eval(w => { const r = w.arrows.find(r => r.a.stun > 0 || r.a === window.__prey); return r ? { hit: r.hit, stun: r.a.stun > 0 } : null; });
  }
  if (!shot) fail('Kein Jäger hat innerhalb des Banns (20 s) auf gebanntes Wild geschossen: ' + JSON.stringify(await wk.eval(w => w.villagers.filter(v => v.role === 'hunter').map(v => ({ s: v.state, n: v.next, prey: v.prey ? { st: v.prey.state, stun: v.prey.stun, d: Math.hypot(v.prey.x - v.x, v.prey.z - v.z) } : null, isP: v.prey === window.__prey, x: v.x, z: v.z, tx: v.tx, tz: v.tz, path: v.path ? v.path.length : null, pi: v.pi })))));
  if (!shot.stun || !shot.hit) fail(`Erster Schuss auf gebanntes Wild: ${shot.stun ? 'gebannt' : 'Bann vorbei'}, ${shot.hit ? 'Treffer' : 'daneben'}`);
  for (let n = 0; n < 20 && await wk.eval(w => window.__prey.state !== 'dead'); n++) await run(5);
  if (await wk.eval(w => window.__prey.state !== 'dead')) fail('Gebanntes Wild nach dem Treffer nicht erlegt');
  await run(90);
  log('Jäger: erster Schuss auf gebanntes Wild trifft');

  // 6. Sturm-Geste: Tipp ohne Wischen kostet nichts, Wischen wirkt den Sturm (Touch über DevTools-Protokoll)
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const open = await wk.eval(w => { // freie Wiese: kein Gebäude, wenig Bäume, Land
    let best = null, bs = 1e9;
    for (let k = 0; k < 400; k++) { const a = Math.random() * 6.28, r = 6 + Math.random() * 10, x = Math.cos(a) * r, z = Math.sin(a) * r, h = w.heightAt(x, z);
      if (h < .5 || h > 2.6 || w.buildingAt(x, z, 2.5)) continue;
      const n = w.trees.filter(t => t.alive && !t.gone && Math.hypot(t.x - x, t.z - z) < 3).length; if (n < bs) { bs = n; best = { x, z }; } }
    return best;
  });
  await look(open.x, open.z, 1.3); await run(2);
  await wk.eval(w => { w.chooseMiracle('storm'); window.__ptr = 0; for (const t of ['pointerdown', 'pointermove', 'pointerup']) addEventListener(t, () => window.__ptr++, true); });
  const sp = await wk.eval((w, o) => w.toScreen(o.x, w.heightAt(o.x, o.z), o.z, { set: (x, y) => ({ x, y }) }), open);
  const deliver = async (act, n = 1) => { const c = await page.evaluate(() => window.__ptr); await act(); await page.waitForFunction(([c, n]) => window.__ptr >= c + n, [c, n], { polling: 5, timeout: 3000 }); };
  const g0 = 1000; await clearToast();
  await deliver(() => touch('touchStart', [[sp.x, sp.y]])); await run(3); await wk.eval(w => { w.S.glaube = 1000; }); await deliver(() => touch('touchEnd'));
  const tapT = await toastText(), tap = await wk.eval(w => ({ g: w.S.glaube, on: w.storm.on }));
  if (tap.g !== g0 || tap.on) fail(`Tipp ohne Wischen mit Sturm: Glaube ${g0} → ${tap.g}, Sturm ${tap.on}`);
  if (!/Wische/.test(tapT)) fail(`Tipp ohne Wischen: kein Hinweis zur Wischgeste (${tapT})`);
  await fox();
  await deliver(() => touch('touchStart', [[sp.x - 120, sp.y]]));
  for (let k = 1; k <= 12; k++) { await deliver(() => touch('touchMove', [[sp.x - 120 + k * 20, sp.y - k * 3]])); await run(2); }
  const drawn = await wk.eval(w => w.scene.children.some(o => o.isMesh && o.renderOrder === 8 && o.visible)); // Bahn beim Ziehen sichtbar
  await wk.eval(w => { w.S.glaube = 1000; }); await deliver(() => touch('touchEnd'));
  const sw = await wk.eval(w => ({ g: w.S.glaube, on: w.storm.on, len: w.storm.len, cost: w.MIRACLES.storm.cost }));
  if (!drawn) fail('Bahn wird beim Wischen nicht angezeigt');
  if (!sw.on || g0 - sw.g !== sw.cost) fail(`Wischen wirkt keinen Sturm (an: ${sw.on}, Glaube ${g0} → ${sw.g})`);
  if (!await foxCast()) fail('Kreatur zeigt beim Sturm keine Geste');
  log(`Geste: Tipp kostet nichts, Hinweis „${tapT.slice(0, 30)}…“; Wischen wirkt Sturm (Bahn ${sw.len.toFixed(1)}, ${sw.cost} Glaube)`);
  for (let n = 0; n < 20 && await wk.eval(w => w.storm.on); n++) await run(60);
  await clearToast();

  // 7. Sturm durch einen Waldstreifen: Bäume nahe der Bahn ausgerissen, landen als Holz; Bäume abseits stehen
  const forest = await wk.eval(w => {
    const alive = w.trees.filter(t => t.alive && !t.gone && t.g > .5), dens = t => alive.filter(o => Math.hypot(o.x - t.x, o.z - t.z) < 3.5).length;
    const c = alive.filter(t => !w.buildingAt(t.x, t.z, 3) && Math.hypot(t.x, t.z) > 10).sort((a, b) => dens(b) - dens(a))[0];
    return { x0: c.x - 5, z0: c.z, x1: c.x + 5, z1: c.z };
  });
  const segD = (t, f) => { const ex = f.x1 - f.x0, ez = f.z1 - f.z0, u = Math.max(0, Math.min(1, ((t.x - f.x0) * ex + (t.z - f.z0) * ez) / (ex * ex + ez * ez))); return Math.hypot(t.x - f.x0 - ex * u, t.z - f.z0 - ez * u); };
  const before = await wk.eval((w, f) => {
    window.__hits = []; w.S.logs0 = w.S.logs;
    return w.trees.map((t, i) => ({ i, x: t.x, z: t.z, alive: t.alive && !t.gone })).filter(t => t.alive);
  }, forest);
  const near = before.filter(t => segD(t, forest) < 1.2), far = before.filter(t => segD(t, forest) > 3);
  if (near.length < 3) fail(`Waldstreifen zu licht für die Prüfung (${near.length} Bäume an der Bahn)`);
  await wk.eval((w, f) => w.castStorm(f.x0, f.z0, f.x1, f.z1), forest);
  let flew = 0;
  for (let n = 0; n < 12; n++) {
    await run(30);
    const st = await wk.eval(w => ({ fly: w.flying.length, x: w.storm.x, z: w.storm.z }));
    flew = Math.max(flew, st.fly);
    if (n === 5) { await look(st.x, st.z, 1.5); await wk.shot('sturm'); }
  }
  for (let n = 0; n < 20 && await wk.eval(w => w.storm.on || w.flying.length > 0); n++) await run(30);
  const after = await wk.eval((w, ids) => ids.map(i => { const t = w.trees[i]; return { alive: t.alive && !t.gone, chopped: t.stumpT > 0 }; }), before.map(t => t.i));
  const idx = new Map(before.map((t, k) => [t.i, after[k]]));
  const nearUp = near.filter(t => !idx.get(t.i).alive).length, farGone = far.filter(t => { const a = idx.get(t.i); return !a.alive && !a.chopped; }).length;
  const sh = await wk.eval(w => ({ hit: __hits.find(h => h.kind === 'storm'), logs: w.S.logs - w.S.logs0, fly: w.flying.length }));
  if (nearUp !== near.length) fail(`Sturm: nur ${nearUp} von ${near.length} Bäumen an der Bahn ausgerissen`);
  if (farGone) fail(`Sturm: ${farGone} Bäume abseits der Bahn ausgerissen`);
  if (!flew) fail('Sturm: keine Bäume in der Luft gesehen');
  if (!sh.hit || sh.hit.trees < near.length || sh.hit.killed !== 0) fail(`Sturm: Meldung fehlt oder unvollständig (${JSON.stringify(sh.hit)})`);
  if (sh.logs < 1) fail(`Sturm: gelandete Bäume wurden nicht zu Holz (Stämme +${sh.logs})`);
  await noAdds('Sturm');
  log(`Sturm im Wald: ${nearUp}/${near.length} Bäume an der Bahn ausgerissen, ${far.length} abseits stehen, bis zu ${flew} zugleich in der Luft, +${sh.logs} Stämme; Meldung ${JSON.stringify(sh.hit)}`);

  // 8. Sturm durch eine Gruppe Bewohner: Bewohner auf der Bahn fliegen und landen, alle leben; im Umkreis Flucht mit Angst
  const grp = await wk.eval((w, o) => {
    const free = w.villagers.filter(v => ['idle', 'walk', 'pray'].includes(v.state) && !v.carry && !v.load), on = free.slice(0, 4), side = free.slice(4, 7);
    on.forEach((v, k) => { v.x = o.x - 1.5 + k; v.z = o.z + (k % 2 ? .3 : -.3); v.state = 'idle'; v.timer = 4; v.tree = null; });
    side.forEach((v, k) => { v.x = o.x - 1 + k; v.z = o.z + 3.2; v.state = 'idle'; v.timer = 4; v.tree = null; });
    window.__hits = []; window.__seen = {}; window.__grp = [...on, ...side];
    return { on: on.map(v => w.villagers.indexOf(v)), side: side.map(v => w.villagers.indexOf(v)), n: w.villagers.length };
  }, open);
  if (grp.on.length < 3 || grp.side.length < 2) fail('Zu wenige freie Bewohner für die Sturm-Prüfung');
  await look(open.x, open.z, 1.3);
  await wk.eval((w, o) => w.castStorm(o.x - 3.5, o.z, o.x + 3.5, o.z), open);
  const track = () => wk.eval((w, ids) => { for (const i of ids) { const v = w.villagers[i], s = (window.__seen[i] = window.__seen[i] || {}); s[v.state] = 1; if (v.emo) s['emo:' + v.emo.k] = 1; } }, [...grp.on, ...grp.side]);
  for (let n = 0; n < 40; n++) { await run(10); await track(); }
  const seen = await page.evaluate(() => window.__seen);
  for (const i of grp.on) if (!seen[i].falling || !seen[i].dizzy || !seen[i]['emo:dizzy']) fail(`Bewohner ${i} auf der Bahn: nicht hochgewirbelt oder nicht schwindelig (${Object.keys(seen[i]).join(', ')})`);
  for (const i of grp.side) if (!seen[i].flee || !seen[i]['emo:fear']) fail(`Bewohner ${i} im Umkreis flieht nicht mit Angst (${Object.keys(seen[i]).join(', ')})`);
  for (let n = 0; n < 10; n++) { await run(60); await track(); }
  const rest = await wk.eval((w, ids) => ({ alive: window.__grp.filter(v => w.villagers.includes(v)).length, st: ids.map(i => { const v = w.villagers[i]; return { s: v.state, x: v.x, y: v.y, z: v.z, idleT: v.timer }; }), hit: __hits.find(h => h.kind === 'storm') }), [...grp.on, ...grp.side]);
  if (rest.alive !== grp.on.length + grp.side.length) fail(`Sturm: nur ${rest.alive} von ${grp.on.length + grp.side.length} Bewohnern leben noch`);
  if (rest.st.some(s => ['falling', 'dizzy', 'flee', 'dying'].includes(s.s) || !isFinite(s.x + s.y + s.z))) fail(`Nach dem Sturm hängen Bewohner fest: ${JSON.stringify(rest.st.map(s => s.s))}`);
  if (!rest.hit || rest.hit.villagers < grp.on.length || rest.hit.killed !== 0) fail(`Sturm-Meldung für Bewohner fehlt (${JSON.stringify(rest.hit)})`);
  // gehen wieder ihrer Arbeit nach: in den nächsten Sekunden wechseln alle aus dem Leerlauf in eine Tätigkeit
  await wk.eval(() => { window.__busy = {}; });
  for (let n = 0; n < 12; n++) { await run(30); await wk.eval((w, ids) => { for (const i of ids) if (w.villagers[i].state !== 'idle') window.__busy[i] = 1; }, [...grp.on, ...grp.side]); }
  const busy = await page.evaluate(() => Object.keys(window.__busy).length);
  if (busy < grp.on.length + grp.side.length) fail(`Nach dem Sturm gehen nur ${busy} von ${grp.on.length + grp.side.length} Bewohnern wieder etwas nach`);
  log(`Sturm im Dorf: ${grp.on.length} herumgewirbelt und schwindelig, ${grp.side.length} fliehen mit Angst, alle leben und arbeiten weiter`);

  // 9. Blitz auf einen Baum: weg, kein Holz, dunkler Fleck
  await wk.eval(w => { window.__hits = []; });
  const bt = await wk.eval(w => {
    const t = w.trees.find(t => t.alive && !t.gone && t.g > .6 && !t.reserved && !w.buildingAt(t.x, t.z, 1) && w.villagers.every(v => Math.hypot(v.x - t.x, v.z - t.z) > 2) && w.wild.every(a => Math.hypot(a.x - t.x, a.z - t.z) > 1));
    const i = w.trees.indexOf(t), fly0 = w.flying.length; w.castBolt(t.x, t.z);
    return { i, x: t.x, z: t.z, alive: t.alive, gone: t.gone, fly: w.flying.length - fly0, scorch: w.scorches.some(s => Math.hypot(s.x - t.x, s.z - t.z) < .1), hit: __hits[0] };
  });
  await look(bt.x, bt.z, 1.1); await wk.shot('blitz');
  if (bt.alive || !bt.gone) fail('Blitz auf Baum: Baum steht noch');
  if (bt.fly) fail('Blitz auf Baum: Baum fliegt (soll verbrennen, kein Holz)');
  if (!bt.scorch) fail('Blitz auf Baum: kein dunkler Fleck');
  if (!bt.hit || bt.hit.trees !== 1) fail(`Blitz-Meldung für Baum fehlt (${JSON.stringify(bt.hit)})`);
  await run(120);
  const btLater = await wk.eval((w, i) => ({ gone: w.trees[i].gone, alive: w.trees[i].alive, stump: w.trees[i].stumpT, scorch: w.scorches.length }), bt.i);
  if (!btLater.gone || btLater.alive || btLater.stump > 0) fail('Blitz auf Baum: Baum kommt zurück oder hinterlässt einen Stumpf mit Holz');
  log('Blitz auf Baum: verbrannt, kein Holz, Fleck bleibt');

  // 10. Blitz direkt auf einen Bewohner (die Bitte am Schrein und ein Holzfäller): er stirbt, nichts zeigt mehr auf ihn
  const kill = async (pickSrc, label) => {
    const r = await wk.eval((w, src) => {
      const pick = (0, eval)('(' + src + ')'), v = pick(w); if (!v) return null;
      for (const k of ['bread', 'fish', 'veg', 'meat', 'milk', 'eggs']) { w.S['_' + k] = w.S[k]; w.S[k] = 0; } // kein Zuwachs während der Prüfung
      window.__victim = v; const n0 = w.villagers.length; window.__hits = [];
      w.castBolt(v.x, v.z);
      return { n0, state: v.state, role: v.role || null, hit: __hits[0] };
    }, pickSrc.toString());
    if (!r) fail(`Kein Bewohner für „${label}“`);
    if (r.state !== 'dying') fail(`Blitz direkt auf ${label}: Bewohner stirbt nicht (Zustand ${r.state})`);
    if (!r.hit || r.hit.killed !== 1) fail(`Blitz-Meldung ohne Toten (${JSON.stringify(r.hit)})`);
    const vx = await wk.eval(() => ({ x: window.__victim.x, z: window.__victim.z }));
    await look(vx.x, vx.z, .9); await run(40); if (label === 'Holzfäller') await wk.shot('tod');
    await run(80);
    const d = await wk.eval(w => {
      const v = window.__victim, refs = [];
      if (w.villagers.includes(v)) refs.push('villagers');
      if (w.wish.by === v) refs.push('wish.by'); if (w.food.state.giftBy === v) refs.push('giftBy');
      if (w.fox.loader === v) refs.push('fox.loader'); if (w.fox.riders && w.fox.riders.includes(v)) refs.push('fox.riders'); if (w.input.grabbed === v) refs.push('input.grabbed');
      if (w.trees.some(t => t.reserved === v)) refs.push('tree.reserved'); if (w.fields.some(f => f.by === v)) refs.push('field.by'); if (w.rocks.some(r => r.by === v)) refs.push('rock.by');
      for (const k of ['bread', 'fish', 'veg', 'meat', 'milk', 'eggs']) { w.S[k] = w.S['_' + k]; delete w.S['_' + k]; }
      return { n: w.villagers.length, refs, ash: w.ashes.length, pop: (w.S.pop) };
    });
    if (d.n !== r.n0 - 1) fail(`Blitz direkt auf ${label}: villagers.length ${r.n0} → ${d.n} (soll −1)`);
    if (d.refs.length) fail(`Nach dem Tod zeigt noch etwas auf ihn: ${d.refs.join(', ')}`);
    if (!d.ash) fail('Kein Häufchen Asche');
    return { ...r, ...d };
  };
  await wk.eval(w => { w.wish.cool = 0; w.S.hour = 10; for (const v of w.villagers) if (!v.role && !v.haul) { v.state = 'idle'; v.timer = 99; v.carry = 0; } w.startWish('haste'); });
  for (let n = 0; n < 30 && !(await wk.eval(w => w.wish.by && w.wish.by.state === 'beg')); n++) await run(60);
  const k1 = await kill(w => w.wish.by && w.wish.by.state === 'beg' ? w.wish.by : null, 'Bittenden');
  if (await wk.eval(w => w.wish.kind)) fail('Bitte läuft nach dem Tod des Bittenden weiter');
  for (let n = 0; n < 20 && !(await wk.eval(w => w.villagers.some(v => v.role === 'lumber' && ['chop', 'walk'].includes(v.state) && v.tree))); n++) await run(60);
  const k2 = await kill(w => w.villagers.find(v => v.role === 'lumber' && ['chop', 'walk'].includes(v.state) && v.tree) || w.villagers.find(v => v.role && w.onGround(v)), 'Holzfäller');
  if (k2.role !== null) log('  (Rolle nach dem Treffer: ' + k2.role + ')');
  log(`Tod: Bittender und Holzfäller gestorben (${k1.n0} → ${k2.n} Bewohner), keine Verweise mehr`);
  // einige Spielminuten weiterrechnen, dann Neuladen: die Toten sind nicht wieder da
  for (let n = 0; n < 10; n++) await run(120);
  const pop = await wk.eval(w => { w.reconcileJobs(); const bad = []; for (const h of w.huts) if (w.villagers.some(v => v.hut === h && !w.villagers.includes(v))) bad.push(h.role); window.dispatchEvent(new Event('wk-save')); return { n: w.villagers.length, pop: JSON.parse(localStorage.getItem('weltenkeim-save')).pop, bad }; });
  if (pop.pop !== pop.n) fail(`Gespeicherte Einwohnerzahl ${pop.pop} ≠ ${pop.n}`);

  // 11. Blitz auf ein Gebäude (Sägemühle): brennt sichtbar ~20 s, niemand arbeitet dort, Neuladen während des Brandes
  const bld = await wk.eval(w => {
    const b = w.huts.find(h => h.role === 'sawyer') || w.houses[0];
    window.__hits = []; window.__bld = b; w.castBolt(b.x, b.z);
    return { x: b.x, z: b.z, role: b.role || null, burning: w.burning(b), t: b.fire && b.fire.t, hit: __hits[0], goods: b.goods ? Object.keys(b.goods).length : 0 };
  });
  if (!bld.burning) fail('Blitz auf Gebäude: es brennt nicht');
  if (!bld.hit || bld.hit.buildings !== 1) fail(`Blitz-Meldung für Gebäude fehlt (${JSON.stringify(bld.hit)})`);
  await look(bld.x, bld.z, 1.4); await run(150); await wk.shot('brand');
  const working = ['saw', 'proc', 'chop', 'quarry', 'mine', 'tend', 'sow', 'harvest', 'plant', 'fish', 'aim'];
  const noWork = () => wk.eval((w, ws) => { const b = window.__bld; return w.villagers.filter(v => v.hut === b && ws.includes(v.state)).map(v => v.state); }, working);
  for (let n = 0; n < 6; n++) { await run(60); const nw = await noWork(); if (nw.length) fail(`Während des Brandes arbeitet jemand am Gebäude: ${nw.join(', ')}`); }
  await noAdds('Blitz und Brand');
  // Neuladen mitten im Brand
  const reload = async () => {
    await wk.eval(() => window.dispatchEvent(new Event('wk-save')));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__wk?.step === 'function', null, { timeout: 30000 });
    await page.evaluate(() => { window.__wkHold = true; });
    await setup(); await run(2);
  };
  const tBefore = await wk.eval(w => window.__bld.fire.t);
  await reload();
  const refind = () => wk.eval((w, b) => { const x = w.buildings().find(o => Math.hypot(o.x - b.x, o.z - b.z) < .05); window.__bld = x; return x && x.fire ? { t: x.fire.t, soot: x.fire.soot, burning: w.burning(x) } : null; }, bld);
  const r1 = await refind();
  if (!r1 || !r1.burning || Math.abs(r1.t - tBefore) > 1.5) fail(`Neuladen während des Brandes: Zustand falsch (${JSON.stringify(r1)}, vorher ${tBefore})`);
  for (let n = 0; n < 30 && await wk.eval(w => w.burning(window.__bld)); n++) { await run(60); const nw = await noWork(); if (nw.length) fail(`Während des Brandes (nach dem Neuladen) arbeitet jemand: ${nw.join(', ')}`); }
  const post = await wk.eval(w => { const b = window.__bld; return { burning: w.burning(b), soot: b.fire && b.fire.soot, inScene: !!b.o.parent, dark: (() => { let d = 0; b.o.traverse(o => { if (o.isMesh && o.userData.mat0) d++; }); return d; })() }; });
  if (post.burning) fail('Gebäude brennt nach 30 s noch');
  if (!post.inScene) fail('Gebäude ist nach dem Brand verschwunden');
  if (!(post.soot > 0) || !post.dark) fail('Gebäude ist nach dem Brand nicht rußig');
  await look(bld.x, bld.z, 1.4); await wk.shot('russ');
  await reload(); // Neuladen nach dem Brand: rußig, brennt nicht
  const r2 = await refind();
  if (!r2 || r2.burning || !(r2.soot > 0)) fail(`Neuladen nach dem Brand: Zustand falsch (${JSON.stringify(r2)})`);
  // einige Spielstunden später: wieder normal
  await wk.eval(w => { w.S.timePaused = false; });
  for (let h = 0; h < 6; h++) { await wk.eval(w => { w.S.hour = (w.S.hour + 1) % 24; }); await run(2); }
  const clean = await wk.eval(w => { const b = window.__bld; let d = 0; b.o.traverse(o => { if (o.isMesh && o.userData.mat0) d++; }); return { fire: !!b.fire, dark: d, saved: (() => { window.dispatchEvent(new Event('wk-save')); return JSON.parse(localStorage.getItem('weltenkeim-save')).fires.length; })() }; });
  if (clean.fire || clean.dark || clean.saved) fail(`Ruß nach einigen Spielstunden nicht verschwunden (${JSON.stringify(clean)})`);
  await wk.eval(w => { w.S.hour = 10; w.S.timePaused = true; });
  log(`Brand: ${bld.role || 'Haus'} brennt ~20 s (auch nach Neuladen), niemand arbeitet dort, danach rußig, nach einigen Spielstunden sauber`);

  // 12. Blitz knapp neben einen Bewohner: umgeworfen und schwindelig, danach wieder normal
  const nearV = await wk.eval(w => {
    // ein Punkt knapp neben einem Bewohner, an dem sonst nichts steht (kein Gebäude, Baum, Wild, anderer Bewohner)
    let v = null, p = null;
    for (const c of w.villagers) {
      if (!['idle', 'walk', 'pray', 'chop', 'plant', 'lunch', 'sow', 'harvest', 'tend'].includes(c.state)) continue;
      for (let k = 0; k < 16 && !p; k++) { const a = k / 16 * 6.28, x = c.x + Math.cos(a) * .8, z = c.z + Math.sin(a) * .8;
        if (w.heightAt(x, z) > .3 && !w.buildingAt(x, z, .1) && w.trees.every(t => !t.alive || t.gone || Math.hypot(t.x - x, t.z - z) > .7) && w.wild.every(a => Math.hypot(a.x - x, a.z - z) > .6) && w.villagers.every(o => Math.hypot(o.x - x, o.z - z) > .5)) p = { x, z }; }
      if (p) { v = c; break; }
    }
    if (!v) return null;
    window.__nv = v; window.__nvSeen = {}; const n0 = w.villagers.length; w.castBolt(p.x, p.z);
    return { n0, state: v.state };
  });
  if (!nearV) fail('Kein frei stehender Bewohner für „knapp daneben“');
  for (let n = 0; n < 40; n++) { await run(10); await wk.eval(() => { window.__nvSeen[window.__nv.state] = 1; }); }
  const nv = await wk.eval(w => ({ alive: w.villagers.includes(window.__nv), seen: Object.keys(window.__nvSeen), state: window.__nv.state, n: w.villagers.length }));
  if (!nv.alive || nv.n !== nearV.n0) fail('Blitz knapp daneben hat jemanden getötet');
  if (nearV.state !== 'falling' || !nv.seen.includes('dizzy')) fail(`Blitz knapp daneben: nicht umgeworfen/schwindelig (${nearV.state}, ${nv.seen.join(', ')})`);
  if (['falling', 'dizzy'].includes(nv.state)) fail(`Blitz knapp daneben: nach 7 s noch ${nv.state}`);
  log(`Blitz knapp daneben: umgeworfen, schwindelig, danach ${nv.state}`);

  // 13. Ein von der Hand gehaltener Bewohner wird nicht getroffen; Kreatur zeigt beim Blitz ihre Geste
  await fox();
  const held = await wk.eval(w => {
    const v = w.villagers.find(v => ['idle', 'walk', 'pray'].includes(v.state)); w.input.grabbed = v; v.state = 'grabbed';
    w.chooseMiracle('bolt'); w.S.glaube = 5000; const ok = w.tryMiracle({ x: v.x, z: v.z });
    const r = { ok, state: v.state, alive: w.villagers.includes(v), cast: w.fox.state === 'cast' || w.fox.hop > 0 };
    w.input.grabbed = null; v.state = 'falling'; v.vx = v.vz = v.vy = 0; return r;
  });
  if (held.state !== 'grabbed' || !held.alive) fail('Gehaltener Bewohner wurde vom Blitz getroffen');
  if (!held.cast) fail('Kreatur zeigt beim Blitz keine Geste');
  await run(120);
  await noAdds('Wunder');
  log('gehaltener Bewohner bleibt unversehrt; Kreatur zeigt bei Bann, Sturm und Blitz ihre Geste; keine neuen Objekte je Baum, Bewohner oder Flamme');
};
