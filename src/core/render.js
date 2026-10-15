// Renderer, Szene, Kamera, Steuerung und Licht; gemeinsame Hilfsobjekte

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { $ } from './util.js';

const canvas = $('c');
const isMobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6e8e0, 42, 105);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
camera.position.set(13, 15, 19);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 7; controls.maxDistance = 58; controls.maxPolarAngle = 1.42; // flach genug, um Sonne, Mond und Sterne am Horizont zu sehen
controls.screenSpacePanning = false;

const hemi = new THREE.HemisphereLight(0xdff1ff, 0x6a5a3a, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 2.3);
sun.position.set(18, 28, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); // tagsüber Sonne, nachts Mondlicht
const tmpV = new THREE.Vector3();
const tA = new THREE.Vector2(), tB = new THREE.Vector2();
function toScreen(x, y, z, out) { const r = canvas.getBoundingClientRect(); tmpV.set(x, y, z).project(camera); return out.set((tmpV.x + 1) / 2 * r.width + r.left, (1 - tmpV.y) / 2 * r.height + r.top); }
// Strecke a–b (z. B. Stammfuß–Krone) auf den Bildschirm: nur das Stück, das im Bild liegt (mit etwas Rand), landet in
// outA/outB. Liegt nichts davon im Bild, false. Punkte hinter oder seitlich dicht neben der Kamera würden sonst auf
// riesige Bildschirmlagen projiziert, und ihre Strecke zöge sich quer durchs Bild (Druck ins Leere packt einen Baum).
const cA = new THREE.Vector4(), cB = new THREE.Vector4(), SEG_M = 1.25;
function segToScreen(ax, ay, az, bx, by, bz, outA, outB) {
  cA.set(ax, ay, az, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  cB.set(bx, by, bz, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  let t0 = 0, t1 = 1;
  for (const [kx, ky, kz, kw] of SEG_PLANES) {
    const fa = kx * cA.x + ky * cA.y + kz * cA.z + kw * cA.w, fb = kx * cB.x + ky * cB.y + kz * cB.z + kw * cB.w;
    if (fa < 0 && fb < 0) return false;
    if (fa < 0) t0 = Math.max(t0, fa / (fa - fb)); else if (fb < 0) t1 = Math.min(t1, fa / (fa - fb));
  }
  if (t0 > t1) return false;
  const r = canvas.getBoundingClientRect(), put = (t, out) => {
    const w = cA.w + (cB.w - cA.w) * t, x = (cA.x + (cB.x - cA.x) * t) / w, y = (cA.y + (cB.y - cA.y) * t) / w;
    out.set((x + 1) / 2 * r.width + r.left, (1 - y) / 2 * r.height + r.top);
  };
  put(t0, outA); put(t1, outB); return true;
}
// Ebenen im Clip-Raum (k · c ≥ 0 heißt innen): links, rechts, unten, oben mit Rand SEG_M, vorn (Nahebene), hinten
const SEG_PLANES = [[1, 0, 0, SEG_M], [-1, 0, 0, SEG_M], [0, 1, 0, SEG_M], [0, -1, 0, SEG_M], [0, 0, 1, 1], [0, 0, -1, 1]];

const clock = new THREE.Clock();
const dummy = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

export { camera, canvas, clock, controls, dummy, hemi, isMobile, renderer, scene, segToScreen, sun, tA, tB, tmpV, toScreen, zero };
