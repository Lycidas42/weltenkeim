// Beispielprüfung: Bewohner existieren und bewegen sich.
// Aufruf: node dev/check.mjs bewohner

export default async (page, wk) => {
  const pos = () => wk.eval(w => w.villagers.map(v => [v.x, v.z]));
  const a = await pos();
  if (!a.length) throw new Error('keine Bewohner im Spiel');
  await wk.step(300); // 5 s Spielzeit
  const b = await pos();
  const moved = a.filter((p, i) => b[i] && Math.hypot(b[i][0] - p[0], b[i][1] - p[1]) > 0.05).length;
  if (!moved) throw new Error(`${a.length} Bewohner, aber keiner hat sich in 300 Bildern bewegt`);
  if (b.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) throw new Error('Bewohner mit ungültiger Position (NaN)');
  await wk.shot('bewohner');
};
