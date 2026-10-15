// Renderer, Szene, Kamera, Steuerung und Licht; gemeinsame Hilfsobjekte

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { $ } from './util.js';

/* ------------------------------------------------------------------ renderer */
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

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
const dummy = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

export { camera, canvas, clock, controls, dummy, hemi, isMobile, renderer, scene, sun, tA, tB, tmpV, toScreen, zero };
