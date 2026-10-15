// Kreatur erleben (kreatur.md 3.11): Gedächtnis mit Gründen, Lernchronik und Erfahrung, Charakterbogen, Nahsicht,
// Gesten an der Kreatur (Tipp, Streicheln, Wischen) und Wahl der Gestalt am Schrein.

export default async (page, wk) => {
  const fails = [], fail = m => fails.push(m);

  // 1. Gedächtnis: Entscheidungen mit Gründen, vollbrachte Taten zählen als Erfahrung
  const mem = await wk.eval(w => {
    const xp0 = Object.values(w.S.cXp).reduce((a, b) => a + b, 0);
    for (let i = 0; i < 60 && w.mind.log.filter(e => e.done).length < 2; i++) w.step(300, 1 / 30, null);
    return { xp0, xp: Object.values(w.S.cXp).reduce((a, b) => a + b, 0), log: w.mind.log.map(e => ({ kind: e.kind, intent: e.intent, reasons: e.reasons.map(r => r.label), done: e.done })) };
  });
  if (!mem.log.length) fail('Gedächtnis: keine Entscheidung festgehalten');
  if (mem.log.some(e => !e.intent || !e.reasons.length || e.reasons.some(r => !r))) fail(`Gedächtnis: Entscheidung ohne Absicht oder Grund: ${JSON.stringify(mem.log[0])}`);
  if (mem.log.filter(e => e.done).length && mem.xp <= mem.xp0) fail(`Erfahrung zählt nicht mit (${mem.xp0} → ${mem.xp})`);

  // 2. Charakterbogen: Neigungen, Erfahrung, Lernchronik, Entscheidungen; kein Porträt mehr, keine Gestaltwahl
  const sheet = await wk.eval(w => {
    w.openSheet('sheetFox'); w.step(2, 1 / 60, null);
    const q = s => document.querySelector(s);
    const r = { bars: q('#foxBars').children.length, xp: q('#foxXp').querySelectorAll('dt').length, learn: q('#foxLearn').children.length, log: q('#foxLog').children.length,
      portrait: !!q('#foxPortrait'), forms: !!q('#sheetFox #foxForms'), form: q('#foxForm').textContent };
    w.closeSheets(); return r;
  });
  if (sheet.bars !== 3 || sheet.xp !== 4 || !sheet.learn || !sheet.log) fail(`Charakterbogen unvollständig: ${JSON.stringify(sheet)}`);
  if (sheet.portrait || sheet.forms) fail('Charakterbogen: Porträt oder Gestaltwahl noch im Bogen');
  if (!/Gestalt:/.test(sheet.form)) fail('Charakterbogen nennt die Gestalt nicht');

  // 3. Nahsicht: Tipp auf den Namen fährt nah heran und zeigt die Karte; × beendet sie
  const near = await wk.eval(w => {
    const $ = id => document.getElementById(id); $('btnFox').click();
    for (let i = 0; i < 90; i++) w.step(1, 1 / 60, null);
    const r = { d: w.camera.position.distanceTo(w.controls.target), card: !$('foxCard').hidden, fox: Math.hypot(w.fox.x - w.controls.target.x, w.fox.z - w.controls.target.z) };
    $('btnFox').click(); r.sheet = !$('sheetFox').hidden; w.closeSheets();
    $('btnCardEnd').click(); r.after = !$('foxCard').hidden; return r;
  });
  if (!near.card || near.d > 11 || near.fox > 2.5) fail(`Nahsicht: ${JSON.stringify(near)}`);
  if (!near.sheet) fail('Nahsicht: zweiter Tipp auf den Namen öffnet den Bogen nicht');
  if (near.after) fail('Nahsicht: × schließt die Karte nicht');

  // 4. Gesten mit leerer Hand: Tipp = Kreismenü, Streichen = Lob, Wischen = Tadel
  const g = await wk.eval(w => {
    const cv = w.renderer.domElement, t = w.controls.target, $ = id => document.getElementById(id), o = { set: (a, b) => ({ x: a, y: b }) };
    let id = 40; const ev = (type, x, y) => { try { cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true })); } catch (e) {} };
    const setup = (last, desc) => { w.fox.state = 'idle'; w.fox.timer = 99; t.x = w.fox.x; t.z = w.fox.z; w.camera.position.set(t.x + 3, t.y + 7, t.z + 6); w.step(3, 1 / 60, null);
      w.fox.last = last; w.fox.lastT = 1e9; w.fox.lastDesc = desc; id++; return w.toScreen(w.fox.x, w.heightAt(w.fox.x, w.fox.z) + .6, w.fox.z, o); };
    w.setTool('hand'); w.closeSheets(); const r = {};
    let q = setup(null, null); ev('pointerdown', q.x, q.y); w.step(4, 1 / 60, null); ev('pointerup', q.x, q.y); w.step(1, 1 / 60, null);
    r.tap = !$('ring').hidden; dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    q = setup('help', 'einen Baum ins Lager gebracht'); ev('pointerdown', q.x - 45, q.y);
    for (let i = 1; i <= 36; i++) { ev('pointermove', q.x - 45 + i * 2.5, q.y + Math.sin(i / 4) * 3); w.step(1, 1 / 60, null); }
    ev('pointerup', q.x + 45, q.y); w.step(1, 1 / 60, null); r.pet = `${w.S.cLearn[0]?.kind}/${w.S.cLearn[0]?.act}`; r.petRing = !$('ring').hidden;
    w.step(160, 1 / 60, null);
    q = setup('mischief', 'einen Baum umgeworfen'); ev('pointerdown', q.x, q.y); ev('pointermove', q.x + 60, q.y + 10); w.step(1, 1 / 60, null);
    ev('pointermove', q.x + 140, q.y + 25); w.step(1, 1 / 60, null); ev('pointerup', q.x + 140, q.y + 25); w.step(1, 1 / 60, null);
    r.slap = `${w.S.cLearn[0]?.kind}/${w.S.cLearn[0]?.act}`; r.slapRing = !$('ring').hidden;
    w.step(100, 1 / 60, null);
    const last = w.S.cLearn[0]; r.chron = last && last.from !== null && last.to < last.from;
    return r;
  });
  if (!g.tap) fail('Tipp auf die Kreatur öffnet das Kreismenü nicht');
  if (g.pet !== 'pet/help' || g.petRing) fail(`Streicheln lobt nicht: ${JSON.stringify(g)}`);
  if (g.slap !== 'slap/mischief' || g.slapRing) fail(`Wischen tadelt nicht: ${JSON.stringify(g)}`);
  if (!g.chron) fail('Lernchronik: Tadel senkt den Anteil nicht (from/to)');

  // 5. Gestalt am Schrein: Kreatur läuft zum Schrein und verwandelt sich; danach wieder zurück
  const form = await wk.eval(async w => {
    const pick = id => [...document.getElementById('foxForms').children].find(b => b.dataset.form === id).click();
    const go = async id => { w.openSheet('sheetShrine'); pick(id); let n = 0; while (w.fox.morph && n++ < 200) w.step(30, 1 / 30, null);
      for (let k = 0; k < 50 && w.fox.kind !== id; k++) { await new Promise(r => setTimeout(r, 100)); w.step(1, 1 / 60, null); } return w.fox.kind; };
    const from = w.fox.kind, to = from === 'wolf' ? 'cat' : 'wolf', got = await go(to), log = w.mind.log[0];
    const back = await go(from);
    return { got, to, back, from, saved: w.S.creature, log: log && log.kind };
  });
  if (form.got !== form.to || form.log !== 'shrine') fail(`Gestalt am Schrein: ${JSON.stringify(form)}`);
  if (form.back !== form.from) fail(`Gestalt zurück: ${JSON.stringify(form)}`);

  if (fails.length) throw new Error(fails.join('\n'));
};
