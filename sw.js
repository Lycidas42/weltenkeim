// Weltenkeim Service Worker
// Strategie wie bei Kernwacht: eigene Dateien "network first" (online immer die neueste Version),
// offline aus dem Cache. Schriften "cache first".
// Bei jeder Veröffentlichung VERSION erhöhen (Schema 0.x.y), damit alte Caches verschwinden.
const VERSION = '0.2.3';
const CACHE = 'wk-' + VERSION;
const APP = [
  './',
  './index.html',
  './game.js',
  './manifest.webmanifest',
  './vendor/three-0.170.0/build/three.module.js',
  './vendor/three-0.170.0/examples/jsm/controls/OrbitControls.js',
  './vendor/three-0.170.0/examples/jsm/loaders/GLTFLoader.js',
  './vendor/three-0.170.0/examples/jsm/utils/BufferGeometryUtils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/models/animals/Fox.glb',
  './assets/models/animals/Wolf.glb',
  './assets/models/animals/Stag.glb',
  './assets/models/animals/Bull.glb',
  './assets/models/animals/Alpaca.glb',
  './assets/models/animals/Cat.glb',
  './assets/models/animals/Fox_HD.glb',
  './assets/models/hand/GodHand.glb',
  './assets/models/building_home_A_blue.bin',
  './assets/models/building_home_A_blue.gltf',
  './assets/models/building_home_B_blue.bin',
  './assets/models/building_home_B_blue.gltf',
  './assets/models/building_scaffolding.bin',
  './assets/models/building_scaffolding.gltf',
  './assets/models/building_well_blue.bin',
  './assets/models/building_well_blue.gltf',
  './assets/models/building_windmill_blue.bin',
  './assets/models/building_windmill_blue.gltf',
  './assets/models/cloud_big.bin',
  './assets/models/cloud_big.gltf',
  './assets/models/hexagons_medieval.png',
  './assets/models/rock_single_A.bin',
  './assets/models/rock_single_A.gltf',
  './assets/models/rock_single_C.bin',
  './assets/models/rock_single_C.gltf',
  './assets/models/tree_single_A.bin',
  './assets/models/tree_single_A.gltf',
  './assets/models/tree_single_A_cut.bin',
  './assets/models/tree_single_A_cut.gltf',
  './assets/models/tree_single_B.bin',
  './assets/models/tree_single_B.gltf',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'wk-fonts').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: einmal laden, dann aus dem Cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('wk-fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; })))
    );
    return;
  }
  if (url.origin !== location.origin) return;

  // Eigene Dateien: Netz zuerst, Cache als Rückfall
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
