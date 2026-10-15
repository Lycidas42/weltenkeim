// Weltenkeim Service Worker
// Strategie wie bei Kernwacht: eigene Dateien "network first" (online immer die neueste Version),
// offline aus dem Cache. Schriften "cache first".
// Bei jeder Veröffentlichung VERSION erhöhen (Schema 0.x.y), damit alte Caches verschwinden.
const VERSION = '0.2.8';
const CACHE = 'wk-' + VERSION;
const APP = [
  './',
  './index.html',
  './src/boot.js',
  './src/main.js',
  './src/assets/models.js',
  './src/assets/theme.js',
  './src/core/colors.js',
  './src/core/noise.js',
  './src/core/render.js',
  './src/core/state.js',
  './src/core/util.js',
  './src/creature/ai.js',
  './src/creature/creature.js',
  './src/creature/gestures.js',
  './src/creature/kinds.js',
  './src/farm/farm.js',
  './src/hand/grab.js',
  './src/hand/hand.js',
  './src/hand/input.js',
  './src/hand/miracles.js',
  './src/hand/pointer.js',
  './src/models/nature.js',
  './src/ui/feedback.js',
  './src/ui/hud.js',
  './src/ui/portrait.js',
  './src/ui/ring.js',
  './src/ui/sheets.js',
  './src/village/ai.js',
  './src/village/build.js',
  './src/village/economy.js',
  './src/village/forest-alert.js',
  './src/village/houses.js',
  './src/village/huts.js',
  './src/village/jobs.js',
  './src/village/layout.js',
  './src/village/night.js',
  './src/village/render.js',
  './src/village/shrine.js',
  './src/village/villagers.js',
  './src/village/wishes.js',
  './src/village/workshops.js',
  './src/wildlife/birds.js',
  './src/wildlife/land.js',
  './src/wildlife/sea.js',
  './src/wildlife/tracks.js',
  './src/world/cover.js',
  './src/world/nature.js',
  './src/world/nav.js',
  './src/world/particles.js',
  './src/world/paths.js',
  './src/world/sculpt.js',
  './src/world/sky.js',
  './src/world/spring.js',
  './src/world/terrain.js',
  './src/world/trees.js',
  './src/world/water.js',
  './src/world/weather-fx.js',
  './src/themes/cozy.js',
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
  './assets/models/building_home_A_red.bin',
  './assets/models/building_home_A_red.gltf',
  './assets/models/building_home_A_green.bin',
  './assets/models/building_home_A_green.gltf',
  './assets/models/building_lumbermill_blue.bin',
  './assets/models/building_lumbermill_blue.gltf',
  './assets/models/resource_lumber.bin',
  './assets/models/resource_lumber.gltf',
  './assets/models/crate_A_big.bin',
  './assets/models/crate_A_big.gltf',
  './assets/models/sack.bin',
  './assets/models/sack.gltf',
  './assets/models/barrel.bin',
  './assets/models/barrel.gltf',
  './assets/models/bucket_arrows.bin',
  './assets/models/bucket_arrows.gltf',
  './assets/models/target.bin',
  './assets/models/target.gltf',
  './assets/models/building_home_B_red.bin',
  './assets/models/building_home_B_red.gltf',
  './assets/models/building_home_B_green.bin',
  './assets/models/building_home_B_green.gltf',
  './assets/models/wheelbarrow.bin',
  './assets/models/wheelbarrow.gltf',
  './assets/models/bucket_water.bin',
  './assets/models/bucket_water.gltf',
  './assets/models/building_home_B_yellow.bin',
  './assets/models/building_home_B_yellow.gltf',
  './assets/models/building_home_A_yellow.bin',
  './assets/models/building_home_A_yellow.gltf',
  './assets/models/building_windmill_blue.bin',
  './assets/models/building_windmill_blue.gltf',
  './assets/models/hexagons_medieval.png',
  './assets/models/tree_single_A_cut.bin',
  './assets/models/tree_single_A_cut.gltf',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

// Die Seite fragt nach der Version, um zu erkennen, ob sie veraltet ist (Hinweis „Neu laden“)
self.addEventListener('message', e => { if (e.data && e.data.type === 'version' && e.source) e.source.postMessage({ type: 'version', v: VERSION }); });

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
