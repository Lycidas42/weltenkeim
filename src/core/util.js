// Kleine Hilfen, die überall gebraucht werden. Zahlen in der Anzeige mit Komma (deutsch).

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const fmt = n => n < 1000 ? String(Math.floor(n)) : (n < 1e6 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : (n / 1e6).toFixed(2).replace('.', ',') + 'M');
const fmt1 = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
const rnd = s => (Math.random() * 2 - 1) * s;

export { $, clamp, smooth, fmt, fmt1, rnd };
