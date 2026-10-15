// Zufall mit Startwert und Perlin-Rauschen für Gelände, Wald und Wind

/* ------------------------------------------------------------------ noise */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const srand = mulberry32(7);
const PERM = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const GR = Array.from({ length: 256 }, () => { const a = srand() * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });
const grad = (ix, iy, x, y) => { const g = GR[PERM[(PERM[ix & 255] + iy) & 255]]; return g[0] * x + g[1] * y; };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = grad(ix, iy, fx, fy), b = grad(ix + 1, iy, fx - 1, fy), c = grad(ix, iy + 1, fx, fy - 1), d = grad(ix + 1, iy + 1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
}
const fbm = (x, y) => { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= .5; } return s; };

export { fbm, noise };
