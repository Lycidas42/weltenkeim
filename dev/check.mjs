// Prüflauf: lädt Weltenkeim in Chromium ohne Bildschirm, rechnet Spielzeit vor und meldet Fehler.
//
// Aufruf (im Wurzelordner des Repos):
//   node dev/check.mjs                  Grundprüfung: frischer Start und jeder Spielstand aus dev/saves/
//   node dev/check.mjs bewohner         zusätzlich die Prüfung dev/checks/bewohner.mjs (mehrere Namen möglich)
// Optionen:
//   --steps 600       Bilder, die mit __wk.step vorgerechnet werden (Standard 600 = 10 s Spielzeit)
//   --url http://…    einen laufenden Server nutzen statt selbst einen zu starten
//   --headed          mit sichtbarem Fenster (nur lokal mit Bildschirm)
//
// Ablauf je Fall: Seite mit Handy-Maßen (390 × 844, Touch) laden, Service Worker blockiert; warten, bis window.__wk
// existiert (main.js setzt es erst, wenn alle Module und Modelle geladen sind); Screenshot „start“; vorrechnen;
// Screenshot „nach“; dann die gewählten Prüfungen. Fehler in der Konsole, fehlgeschlagene Requests (404) und
// unbehandelte Ausnahmen lassen den Lauf scheitern (Exit-Code 1). Screenshots landen in dev/out/ (nicht im Repo).
//
// Eigene Prüfung: Datei dev/checks/<name>.mjs mit
//   export default async (page, wk) => { … }
// page ist die Playwright-Seite, wk ein Helfer: wk.eval(fn, arg) führt fn(__wk, arg) im Spiel aus und gibt das
// (serialisierbare) Ergebnis zurück, wk.step(n) rechnet n Bilder (gezeichnet wird nur das letzte), wk.shot(name) speichert einen Screenshot.
// Scheitern = Ausnahme werfen (z. B. throw new Error('Bewohner bewegen sich nicht')).
// Der Takt des Browsers (requestAnimationFrame) ist während der Prüfungen angehalten, weil jedes echte Bild mit
// Software-WebGL Sekunden kostet; wer ihn braucht, ruft page.evaluate(() => __wkRelease()).
//
// Spielstände: jede Datei dev/saves/<name>.json enthält den Inhalt von localStorage['weltenkeim-save'] und wird
// als eigener Fall geprüft. Playwright wird nicht ins Repo installiert; das Skript nutzt das global installierte.

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEV = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DEV, '..');
const OUT = join(DEV, 'out');
const SAVE_KEY = 'weltenkeim-save';
const t0 = Date.now();

// Argumente
const args = process.argv.slice(2);
const opt = { steps: 600, url: null, headed: false, checks: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--steps') opt.steps = Number(args[++i]);
  else if (a === '--url') opt.url = args[++i];
  else if (a === '--headed') opt.headed = true;
  else if (a === '-h' || a === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n\n')[0].replace(/^\/\/ ?/gm, '')); process.exit(0); }
  else if (a.startsWith('--')) fail('Unbekannte Option: ' + a);
  else opt.checks.push(a);
}
if (!Number.isFinite(opt.steps) || opt.steps < 0) fail('--steps braucht eine Zahl ≥ 0');

function fail(msg) { console.error('✗ ' + msg); process.exit(2); }

// Playwright: zuerst normal auflösen, sonst aus dem globalen node_modules
async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) {}
  try {
    const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const p = createRequire(join(g, 'noop.js')).resolve('playwright');
    return await import(pathToFileURL(p).href);
  } catch (e) {}
  fail('Playwright nicht gefunden. Es wird nicht ins Repo installiert; global installieren mit\n  npm i -g playwright && npx playwright install chromium\n(In der Claude-Cloud-Umgebung ist es vorinstalliert.)');
}

// Eigene Prüfungen laden, bevor der Browser startet (Tippfehler fallen sofort auf)
const checks = [];
for (const name of opt.checks) {
  const f = join(DEV, 'checks', name + '.mjs');
  if (!existsSync(f)) {
    const have = existsSync(join(DEV, 'checks')) ? readdirSync(join(DEV, 'checks')).filter(n => n.endsWith('.mjs')).map(n => n.slice(0, -4)) : [];
    fail(`Prüfung „${name}“ gibt es nicht (dev/checks/${name}.mjs). Vorhanden: ${have.join(', ') || 'keine'}`);
  }
  const fn = (await import(pathToFileURL(f).href)).default;
  if (typeof fn !== 'function') fail(`dev/checks/${name}.mjs exportiert keine Funktion (export default async (page, wk) => …)`);
  checks.push({ name, fn });
}

// Fälle: frischer Start und jeder Spielstand aus dev/saves/
const cases = [{ name: 'frisch', save: null }];
const saveDir = join(DEV, 'saves');
if (existsSync(saveDir)) for (const f of readdirSync(saveDir).filter(n => n.endsWith('.json')).sort()) {
  const raw = readFileSync(join(saveDir, f), 'utf8');
  try { JSON.parse(raw); } catch (e) { fail(`dev/saves/${f} ist kein gültiges JSON: ${e.message}`); }
  cases.push({ name: 'stand-' + f.slice(0, -5), save: raw });
}

// Statischer Server (nur lesen, nur innerhalb des Repos)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
function startServer() {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(f));
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

const pw = await loadPlaywright();
const chromium = pw.chromium || pw.default?.chromium;
const server = opt.url ? null : await startServer();
const base = opt.url ? opt.url.replace(/\/?$/, '/') : `http://127.0.0.1:${server.address().port}/`;
mkdirSync(OUT, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ headless: !opt.headed, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
} catch (e) {
  fail('Chromium startet nicht: ' + e.message.split('\n')[0] + '\n(Browser installieren mit npx playwright install chromium)');
}

console.log(`Prüflauf Weltenkeim · ${base} · ${opt.steps} Bilder · Fälle: ${cases.map(c => c.name).join(', ')}${checks.length ? ' · Prüfungen: ' + checks.map(c => c.name).join(', ') : ''}`);

const results = [];
for (const c of cases) results.push(await runCase(c));
await browser.close();
server?.close();

// Zusammenfassung
const bad = results.filter(r => r.errors.length);
console.log('');
for (const r of results) {
  console.log(`${r.errors.length ? '✗' : '✓'} ${r.name} (${(r.ms / 1000).toFixed(1).replace('.', ',')} s)`);
  for (const e of r.errors) console.log('    ' + e.replace(/\n/g, '\n    '));
}
console.log(`\nScreenshots: ${OUT}`);
const secs = ((Date.now() - t0) / 1000).toFixed(1).replace('.', ',');
console.log(bad.length ? `\nFEHLER: ${bad.length} von ${results.length} Fällen gescheitert (${secs} s)` : `\nok – ${results.length} Fälle ohne Fehler (${secs} s)`);
process.exit(bad.length ? 1 : 0);

async function runCase(c) {
  const start = Date.now();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE' });
  // Spielstand vor dem ersten Skript setzen (frischer Start: Speicher leer)
  await ctx.addInitScript(([key, raw]) => {
    if (sessionStorage.getItem('wk-check-init')) return; // nur beim ersten Laden, nicht nach einem Neuladen im Spiel
    sessionStorage.setItem('wk-check-init', '1');
    localStorage.clear();
    if (raw) localStorage.setItem(key, raw);
  }, [SAVE_KEY, c.save]);
  // Den Takt des Browsers anhalten können: Jedes echte Bild kostet mit Software-WebGL Sekunden und bremst Screenshots.
  // Solange __wkHold gilt, sammelt requestAnimationFrame die Aufrufe; die Spielzeit läuft dann nur über __wk.step.
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), held = [];
    window.__wkHold = false;
    window.requestAnimationFrame = cb => window.__wkHold ? (held.push(cb), 0) : raf(cb);
    window.__wkRelease = () => { window.__wkHold = false; held.splice(0).forEach(raf); };
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !isFont(m.location()?.url || '')) errors.push('Konsole: ' + firstLines(m.text()) + where(m.location())); });
  page.on('pageerror', e => errors.push('Ausnahme: ' + firstLines(e.stack || e.message)));
  // net::ERR_ABORTED meldet Chromium ohne Bildschirm gelegentlich für Modelle, die trotzdem vollständig ankommen;
  // ein fehlendes Modell fällt über den HTTP-Status und den hängenden Ladebildschirm auf
  page.on('requestfailed', r => { const why = r.failure()?.errorText; if (!isFont(r.url()) && why !== 'net::ERR_ABORTED') errors.push(`Request fehlgeschlagen: ${short(r.url())} (${why})`); });
  page.on('response', r => { if (r.status() >= 400 && !isFont(r.url())) errors.push(`HTTP ${r.status()}: ${short(r.url())}`); });

  const wk = {
    eval: (fn, arg) => page.evaluate(([src, a]) => (0, eval)('(' + src + ')')(window.__wk, a), [fn.toString(), arg]),
    step: n => page.evaluate(n => window.__wk.step(n, 1 / 60, false), n), // nur das letzte Bild zeichnen
    shot: async name => { await page.evaluate(() => window.__wk.step(1)); await page.screenshot({ path: join(OUT, `${c.name}-${name}.png`) }); },
  };
  const phase = async (label, fn) => { try { await fn(); } catch (e) { errors.push(`${label}: ${firstLines(e.message.replace(/^page\.\w+: /, ''))}`); e.reported = true; throw e; } };

  try {
    await phase('Laden', () => page.goto(base + 'index.html', { waitUntil: 'load', timeout: 30000 }));
    await phase('Warten auf __wk', async () => {
      // boot.js schreibt einen Ladefehler in den Ladebildschirm; dann nicht weiter warten
      const ok = await page.waitForFunction(() => typeof window.__wk?.step === 'function' || /nicht geladen werden/.test(document.getElementById('loadSt')?.textContent || ''), null, { timeout: 30000 })
        .then(() => page.evaluate(() => !!window.__wk)).catch(() => false);
      if (!ok) throw new Error('window.__wk nicht da. Ladebildschirm: „' + (await page.locator('#loadSt').textContent().catch(() => '?')) + '“');
    });
    await page.evaluate(() => { window.__wkHold = true; });
    await page.waitForTimeout(900); // Ladebildschirm blendet aus (main.js: 0,6 s Übergang, läuft ohne requestAnimationFrame)
    await phase('Screenshot Start', () => wk.shot('start'));
    if (c.save) {
      const info = await wk.eval(w => ({ pop: w.S.pop, villagers: w.villagers.length }));
      if (info.villagers < 1) errors.push(`Spielstand: keine Bewohner nach dem Laden (S.pop = ${info.pop})`);
    }
    await phase(`Vorrechnen (${opt.steps} Bilder)`, () => wk.step(opt.steps));
    await phase('Screenshot nach dem Vorrechnen', () => wk.shot('nach'));
    for (const ch of checks) {
      try { await ch.fn(page, wk); console.log(`  ✓ ${c.name}: Prüfung ${ch.name}`); }
      catch (e) { errors.push(`Prüfung ${ch.name}: ${e.message.split('\n')[0]}`); }
    }
  } catch (e) { if (!e.reported) errors.push('Abbruch: ' + firstLines(e.message.replace(/^page\.\w+: /, ''))); }
  await ctx.close();
  return { name: c.name, errors: [...new Set(errors)], ms: Date.now() - start };
}

// Meldung und die ersten Fundstellen im Spielcode (Pfade relativ zum Server)
function firstLines(msg) {
  const [head, ...rest] = String(msg).split('\n');
  const at = rest.filter(l => /^\s*at /.test(l) && !l.includes('<anonymous>')).slice(0, 3).map(l => '  ' + l.trim().split(base).join(''));
  return [head, ...at].join('\n');
}
function short(u) { return u.startsWith(base) ? u.slice(base.length) : u; }
function where(l) { return l?.url ? ` (${short(l.url)}:${l.lineNumber})` : ''; }
// Google Fonts sind die einzige externe Abhängigkeit; ohne Netz fehlen sie, das Spiel läuft trotzdem
function isFont(u) { return /fonts\.(googleapis|gstatic)\.com/.test(u); }
