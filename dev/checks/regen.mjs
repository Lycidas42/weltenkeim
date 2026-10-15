// Regenwunder: Setzlinge sprießen nach und nach statt alle auf einmal und wachsen dann
export default async (page, wk) => {
  const spot = await wk.eval(w => { const t = w.trees.find(t => t.alive && !t.gone && Math.hypot(t.x, t.z) > 12 && w.heightAt(t.x, t.z) > .6); return { x: t.x + 1.5, z: t.z + 1.5 }; });
  const count = () => wk.eval(w => w.trees.length);
  const n0 = await count();
  await wk.eval((w, p) => w.castRain(p.x, p.z), spot);
  const seq = [await count() - n0];
  for (let i = 0; i < 8; i++) { await wk.step(45); seq.push(await count() - n0); }
  const sizes = await wk.eval((w, n0) => w.trees.slice(n0).map(t => +t.g.toFixed(3)), n0);
  console.log('neue Setzlinge über die Zeit:', seq.join(' '), 'Größen:', sizes.join(' '));
  if (seq[0] !== 0) throw new Error('Setzlinge erscheinen sofort');
  if (seq.at(-1) > 1 && new Set(seq).size < 3) throw new Error('Setzlinge erscheinen nicht nach und nach');
  if (sizes.some(g => g < .14)) throw new Error('Setzlinge sind nicht gewachsen');
};
