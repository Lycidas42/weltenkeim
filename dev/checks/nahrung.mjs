// Prüfung Nahrung (Issue #8): Startvorrat, Mittagessen aus dem Lager, Hunger, abwechslungsreiche Versorgung,
// Wachstum nur mit Vorrat, „Seele rufen“, Häuser trotz Mangel, Gabe am Schrein, Anzeige, Spielstand.
// Aufruf: node dev/check.mjs nahrung
//
// Schnell gehalten: Spielzeit über S.hour vorstellen, Bewohner an den Ort des Geschehens setzen und mit großen
// Schritten (0,05 s) rechnen, ohne zu zeichnen (gezeichnet wird nur für Screenshots).

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAVES = join(dirname(fileURLToPath(import.meta.url)), '..', 'saves');

export default async (page, wk) => {
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
  const run = (fn, arg) => wk.eval(fn, arg);
  const step = async n => { const e = await run((w, n) => { try { w.step(n, .05, null); } catch (e) { return e.stack; } }, n); if (e) throw new Error(e.replace(/\n/g, ' | ')); };
  // bis cond(w) gilt, höchstens max Bilder zu 0,05 s
  const until = async (cond, max, msg) => {
    for (let i = 0; i < max; i += 40) { if (await run(cond)) return; await step(40); }
    ok(await run(cond), msg);
  };
  const FOODS = ['bread', 'fish', 'meat', 'veg', 'milk', 'eggs'];
  // Lager setzen; Waren unterwegs und an den Hütten verwerfen, damit nichts nachgeliefert wird
  const setStock = st => run((w, st) => {
    for (const k of ['bread', 'fish', 'meat', 'veg', 'milk', 'eggs']) w.S[k] = st[k] || 0;
    for (const h of w.huts) { for (const g in h.goods) h.goods[g] = 0; }
    for (const v of w.villagers) { v.carry = 0; v.drop = null; v.haul = null; }
    w.fox.carryGoods = null; w.fox.haul = null;
  }, st);
  const stock = () => run(w => Object.fromEntries(['bread', 'fish', 'meat', 'veg', 'milk', 'eggs'].map(k => [k, w.S[k]])));
  // nächster Tag: über Mitternacht, dann zur gewünschten Stunde
  const nextDay = async h => { await run(w => { w.S.hour = 23.95; }); await step(1); await run(w => { w.S.hour = .2; }); await step(1); await run((w, h) => { w.S.hour = h; }, h); };
  // alle Bewohner (bzw. die freien) an einen Ort setzen und sofort neu entscheiden lassen
  const gather = (x, z, free) => run((w, [x, z, free]) => {
    w.wish.kind = null; w.wish.by = null; w.wish.cool = 1e9; // keine Bitten am Schrein während der Prüfung
    for (const v of w.villagers) v.wish = false;
    for (const v of w.villagers) {
      if (free && v.role) continue;
      if (v.tree) { if (v.tree.reserved === v) v.tree.reserved = null; v.tree = null; }
      if (v.field && v.field.by === v) v.field.by = null; v.field = null; v.prey = null;
      v.x = x + (Math.random() - .5) * 2; v.z = z + (Math.random() - .5) * 2; v.state = 'idle'; v.timer = 0; v.path = null;
    }
  }, [x, z, !!free]);
  // Kamera auf (x, z) richten, aus Richtung a (Winkel um die Hochachse) und Abstand d
  const view = (x, z, d = 9, a = .55) => run((w, [x, z, d, a]) => { w.controls.target.set(x, 1, z); w.camera.position.set(x + Math.sin(a) * d, 1 + d * .75, z + Math.cos(a) * d); w.controls.update(); w.camera.updateMatrixWorld(); }, [x, z, d, a]);
  // Kamera auf einen Punkt in der Höhe y richten (das Spiel hält controls.target.y auf 1: Ziel auf der Sichtlinie darunter)
  const viewAt = (x, y, z, d, a, pitch = .55) => run((w, [x, y, z, d, a, p]) => {
    const dx = Math.sin(a) * Math.cos(p), dy = Math.sin(p), dz = Math.cos(a) * Math.cos(p), k = (y - 1) / dy;
    w.controls.target.set(x - dx * k, 1, z - dz * k); w.camera.position.set(x + dx * d, y + dy * d, z + dz * d); w.controls.update(); w.camera.updateMatrixWorld();
  }, [x, y, z, d, a, pitch]);
  const noToast = () => page.evaluate(() => document.getElementById('toast').classList.remove('show'));
  const portionsOf = st => FOODS.reduce((a, k) => a + (st[k] || 0) * (k === 'milk' || k === 'eggs' ? .5 : 1), 0);

  // 1. Startvorrat nur für neue Spiele
  const start = await run(w => w.food.start);
  const shot = name => start.fresh ? wk.shot(name) : null; // Bilder nur vom frischen Spiel
  if (start.fresh) ok(start.bread === 12 && start.fish === 10 && start.veg === 8 && !start.meat && !start.milk && !start.eggs, `Startvorrat falsch: ${JSON.stringify(start)}`);
  else { // alter Spielstand: Lager wie in einer der Dateien aus dev/saves/, kein Startvorrat dazu
    const saves = readdirSync(SAVES).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(SAVES, f), 'utf8')));
    ok(saves.some(sv => FOODS.every(k => (sv[k] || 0) === start[k])), `Alter Spielstand hat einen Startvorrat bekommen: ${JSON.stringify(start)}`);
  }

  // 2. Mittagessen mit Vorrat: pro Bewohner eine Portion, die meistvorhandene Sorte zuerst
  await run(w => { w.S.hour = 12; w.S.timePaused = false; });
  const st0 = { bread: await run(w => w.villagers.length), fish: 4, veg: 3, meat: 2, milk: 4, eggs: 2 }; // genug für alle, sechs Sorten
  await setStock(st0);
  await run(w => w.villagers.forEach(v => { v.ateDay = -1; }));
  await gather(0, 2.2);
  try { await until(w => w.villagers.every(v => v.ateDay === w.S.day), 900, 'Nicht alle Bewohner haben mittags gegessen'); }
  catch (e) { throw new Error(e.message + ' ' + JSON.stringify(await run(w => ({ h: w.S.hour, d: w.S.day, v: w.villagers.filter(v => v.ateDay !== w.S.day).map(v => [v.state, v.next, v.x.toFixed(1), v.z.toFixed(1), v.ateDay]) })))); }
  const n = await run(w => w.villagers.length);
  { // erwartetes Lager nachrechnen: jede Portion von der Sorte mit dem meisten Bestand (Milch, Eier: 2 Stück)
    const exp = { meat: 0, eggs: 0, ...st0 };
    for (let i = 0; i < n; i++) { let b = null; for (const k of FOODS) { const need = k === 'milk' || k === 'eggs' ? 2 : 1; if (exp[k] >= need && (!b || exp[k] > exp[b])) b = k; } if (b) exp[b] -= b === 'milk' || b === 'eggs' ? 2 : 1; }
    const got = await stock();
    ok(FOODS.every(k => got[k] === exp[k]), `Lager nach dem Mittagessen ${JSON.stringify(got)}, erwartet ${JSON.stringify(exp)} (${n} Bewohner)`);
    ok(portionsOf(st0) - portionsOf(got) === Math.min(n, portionsOf(st0)), `Verbrauch ${portionsOf(st0) - portionsOf(got)} Portionen bei ${n} Bewohnern`);
  }
  const fed = await run(w => w.food.villagers());
  ok(fed.every(f => f.food === 'satt' && f.meal), 'Nach dem Essen sind nicht alle satt');
  await step(20);
  { const p = await run(w => { const v = w.villagers.find(v => v.state === 'lunch') || w.villagers[0]; return { x: v.x, z: v.z }; }); await view(p.x, p.z, 1.5); await noToast(); await shot('nahrung-mittag'); }

  // 3. Ohne Vorrat: leere Hände, hungrig, Gebet −30 %, Hinweis genau einmal
  await nextDay(12); await setStock({}); await gather(0, 2.2);
  await until(w => w.villagers.every(v => v.ateDay === w.S.day), 900, 'Ohne Vorrat: nicht alle zur Mittagspause gekommen');
  const hungry = await run(w => w.food.villagers());
  ok(hungry.every(f => f.food === 'hungrig' && !f.meal && f.pray === .7 && f.work === 1), `Ohne Vorrat nicht hungrig: ${JSON.stringify(hungry[0])}`);
  const prayGain = () => run(w => { // ein Gebet zu Ende bringen, alle anderen ruhen kurz
    const [v, ...rest] = w.villagers; rest.forEach(o => { o.state = 'dizzy'; o.timer = 5; }); w.wish.kind = null;
    v.state = 'pray'; v.timer = .001; v.haste = 0; const g0 = w.S.glaube; w.step(1, 1 / 60, null);
    const pass = .06 * w.S.temple / 60, base = 1 + .6 * (w.S.temple - 1); return (w.S.glaube - g0 - pass) / base;
  });
  { const r = await prayGain(); ok(Math.abs(r - .7) < .01, `Gebet hungrig bringt ${r} statt 0,7 × Glaube`); }
  ok(await run(w => w.food.state.hints.hunger === 1 && w.S.foodHints.hunger === true), 'Hinweis zum Hunger nicht genau einmal');
  await run(w => { const v = w.villagers[0]; v.ateDay = -1; w.food.eatLunch(v); }); // noch einmal hungrig
  ok(await run(w => w.food.state.hints.hunger === 1), 'Hinweis zum Hunger erscheint mehrfach');

  // 4. Drei Tage, drei Sorten: abwechslungsreich, Gebet +20 %, Arbeit +10 %
  for (const k of ['bread', 'fish', 'veg']) {
    await nextDay(12.5); await setStock({ [k]: 200 });
    await run(w => w.villagers.forEach(v => { v.ateDay = -1; w.food.eatLunch(v); }));
  }
  await step(2);
  const varied = await run(w => ({ varied: w.food.state.varied, list: w.food.villagers(), meals: w.S.meals }));
  ok(varied.varied, `Nach drei Tagen mit drei Sorten nicht abwechslungsreich: ${JSON.stringify(varied.meals)}`);
  ok(varied.list.every(f => f.food === 'satt' && f.work === 1.1 && f.pray === 1.2), `Bonus fehlt: ${JSON.stringify(varied.list[0])}`);
  { const r = await prayGain(); ok(Math.abs(r - 1.2) < .01, `Gebet gut versorgt bringt ${r} statt 1,2 × Glaube`); }

  // 5. Wachstum mit Vorrat für ≥ 2 Tage: ein Bewohner kommt dazu, 3 Portionen weniger
  await run(w => { w.S.hour = 9; w.S.houses = w.houses.length + 2; w.S.holz = 0; }); // Platz für 6 weitere, nichts bauen
  { const n0 = await run(w => w.villagers.length); await setStock({ bread: 2 * n0 + 10 });
    await run((w, n0) => { w.__n0 = n0; }, n0);
    await until(w => w.villagers.length > w.__n0, 260, 'Mit Vorrat für 2 Tage kommt kein neuer Bewohner');
    const got = await stock(), n1 = await run(w => w.villagers.length);
    ok(n1 === n0 + 1 && got.bread === 2 * n0 + 10 - 3, `Wachstum: ${n0} → ${n1} Bewohner, Brot ${2 * n0 + 10} → ${got.bread} (erwartet −3)`);
    ok((await page.textContent('#sGrow')).startsWith('Wachstum: Das Dorf wächst'), 'Lager-Panel zeigt nicht „Das Dorf wächst“');
  }

  // 6. Vorrat < 2 Tage: niemand kommt, Anzeige, Schild, Toast einmal
  { const n0 = await run(w => w.villagers.length); await setStock({ bread: 2 * n0 - 1 });
    await step(190); // länger als ein Wachstumstakt (9 s)
    ok(await run(w => w.villagers.length) === n0, 'Trotz zu wenig Nahrung kommt ein Bewohner dazu');
    ok(await run(w => w.food.state.growth) === 'food', 'Wachstumszustand nicht „food“');
    const s = await page.textContent('#sGrow'); ok(s.startsWith('Wachstum stockt: zu wenig Nahrung'), `Lager-Panel: „${s}“`);
    await run(w => w.openSheet('sheetWork')); await step(6);
    const wf = await page.textContent('#workFood'); ok(wf.includes('Wachstum stockt: zu wenig Nahrung (Vorrat reicht für weniger als 2 Tage)'), `Arbeit-Panel: „${wf}“`);
    await noToast(); await shot('nahrung-lager');
    await run(w => w.closeSheets());
    const hs = await run(w => { const h = w.houses[w.houses.length - 1]; return { x: h.x, z: h.z }; });
    await view(hs.x, hs.z, 10); await step(6);
    ok(!(await page.locator('#foodSign').isHidden()), 'Schild „Wartet auf Nahrung“ fehlt über dem Haus');
    ok((await page.textContent('#foodSign')).includes('Wartet auf Nahrung'), 'Schild ohne Text');
    await noToast(); await shot('nahrung-schild');
    ok(await run(w => w.food.state.hints.stall <= 1 && w.S.foodHints.stall === true), 'Toast zum Stocken nicht genau einmal');
    if (start.fresh) ok(await run(w => w.food.state.hints.stall === 1), 'Toast zum Stocken fehlt');
  }

  // 7. „Seele rufen“ geht trotzdem, ohne Nahrung zu verbrauchen; das Schrein-Panel erklärt es
  { await run(w => { w.S.glaube = 500; w.openSheet('sheetShrine'); }); await step(6);
    const txt = await page.textContent('#shrineItems'); ok(txt.includes('Das Dorf wächst gerade nicht von selbst, es fehlt Nahrung. Eine gerufene Seele kommt trotzdem.'), 'Schrein-Panel erklärt das Stocken nicht');
    const [n0, p0] = await run(w => [w.villagers.length, w.food.portions()]);
    await page.click('[data-buy="soul"]');
    const [n1, p1] = await run(w => [w.villagers.length, w.food.portions()]);
    ok(n1 === n0 + 1 && p1 === p0, `Seele rufen: ${n0} → ${n1} Bewohner, Portionen ${p0} → ${p1}`);
    await run(w => w.closeSheets()); }

  // 8. Häuser entstehen auch bei Nahrungsmangel
  { await run(w => { w.S.houses = w.houses.length; w.S.holz = 2000; w.__h0 = w.houses.length; });
    await until(w => w.houses.length > w.__h0 || w.houses.length * 3 + 4 >= 40, 560, 'Bei Nahrungsmangel wird kein Haus gebaut');
    ok(await run(w => w.food.state.growth !== 'ok'), 'Wachstum sollte weiter ohne Nahrung stehen'); }

  // 9. Gabe am Schrein: nachmittags, abwechslungsreich, einmal je Tag, liegt bis zum Abend auf dem Altar
  { await setStock({ bread: 60, fish: 20 }); await run(w => { w.S.hour = 14; w.S.holz = 0; w.S.offer = null; w.wish.kind = null; w.__g0 = w.food.state.gifts; });
    ok(await run(w => w.food.state.varied), 'Für die Gabe nicht mehr abwechslungsreich');
    const lg = await run(w => ({ x: w.lager.x, z: w.lager.z })); await gather(lg.x, lg.z + 1.4, true);
    const g0 = await run(w => w.S.glaube);
    await until(w => w.S.offer && w.S.offer.d === w.S.day, 900, 'Keine Gabe am Schrein bis zum späten Nachmittag');
    await step(1);
    const g = await run(w => ({ offer: w.S.offer, gifts: w.food.state.gifts - w.__g0, vis: w.food.state.altar.visible, glaube: w.S.glaube }));
    ok(g.gifts === 1 && g.vis && g.glaube - g0 >= 8, `Gabe: ${JSON.stringify(g)}, Glaube ${g0} → ${g.glaube}`);
    const sp = await run(w => { const p = new w.camera.position.constructor(); w.food.state.altar.getWorldPosition(p); return { x: p.x, y: p.y, z: p.z, a: w.shrine.g.rotation.y }; });
    await viewAt(sp.x, sp.y, sp.z, 3.4, sp.a); await step(4); await noToast(); await shot('nahrung-gabe');
    await run(w => { w.S.hour = Math.min(w.S.hour, 16); }); await step(300);
    ok(await run(w => w.food.state.gifts - w.__g0 === 1), 'Mehr als eine Gabe am selben Tag');
    await run(w => { w.S.hour = 18.2; }); await step(2);
    ok(await run(w => !w.food.state.altar.visible), 'Gabe liegt abends noch auf dem Altar'); }

  // 10. Anzeige „Vorrat reicht für etwa X Tage“, hervorgehoben unter einem Tag
  { const nn = await run(w => w.villagers.length), X = String(Math.floor((2 * nn - 1) / nn * 10) / 10).replace('.', ','); await setStock({ bread: 2 * nn - 1 }); await step(6); // weniger als 2 Tage: kein Wachstum dazwischen
    const txt = await page.textContent('#sFood');
    ok(txt === `Vorrat reicht für etwa ${X} ${X === '1' ? 'Tag' : 'Tage'}`, `Lager-Panel: „${txt}“, erwartet etwa ${X} Tage`);
    await setStock({ bread: 1 }); await step(6);
    ok(await page.locator('#sFood.low').count() === 1, 'Vorrat unter einem Tag nicht hervorgehoben'); }

  // 11. Spielstand: gegessene Sorten, letzte Gabe und Hinweise überstehen das Neuladen
  { const before = await run(w => ({ meals: w.S.meals, offer: w.S.offer, hints: w.S.foodHints, day: w.S.day }));
    await page.evaluate(() => dispatchEvent(new Event('wk-save')));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__wk?.step === 'function', null, { timeout: 30000 });
    await page.evaluate(() => { window.__wkHold = true; });
    const after = await run(w => ({ meals: w.S.meals, offer: w.S.offer, hints: w.S.foodHints, day: w.S.day, start: w.food.start }));
    ok(JSON.stringify(after.meals) === JSON.stringify(before.meals) && JSON.stringify(after.offer) === JSON.stringify(before.offer) && JSON.stringify(after.hints) === JSON.stringify(before.hints) && after.day === before.day, `Neuladen: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    ok(!after.start.fresh && after.start.bread === 1, `Neuladen gibt Startvorrat: ${JSON.stringify(after.start)}`);
    ok(await run(w => w.food.state.varied), 'Nach dem Neuladen nicht mehr abwechslungsreich'); }
};
