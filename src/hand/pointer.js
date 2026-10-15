// Zeiger: Bodenpunkt unter dem Finger, Zustand der Bedienung, was die Hand hält

import * as THREE from 'three';
import { camera, canvas, scene, tmpV } from '../core/render.js';
import { heightAt } from '../world/terrain.js';
import { shadowify } from '../assets/models.js';
import { TK } from '../models/nature.js';

// Zustand der Bedienung: Werkzeug, gedrückter Zeiger, gehaltener Bewohner, gepackter Baum, Gerätetyp, gewähltes Wunder,
// Bildschirmpunkt der Hand beim Halten (hold), laufendes Absetzen (drop), Gehaltenes ausgeblendet (heldHidden)
const input = { tool: 'hand', primary: null, pressing: false, grabbed: null, handShown: false, treeGrab: null, ptrType: 'mouse', miracle: 'rain', sculptDir: 1, hold: { x: 0, y: 0 }, drop: null, heldHidden: false };

const holdOff = new THREE.Vector3(); // Abstand Gehaltenes – Fingerpunkt am Boden beim Zupacken
// Am Handy verdeckt der Finger, was darunter liegt: Hand und Gehaltenes schweben dort ein Stück über dem Finger.
// Was angetippt wird (Bewohner, Baum, Tiergeist), zählt weiterhin genau unter dem Finger.
const touchLift = () => input.ptrType === 'touch' ? 90 : 0;
const setHoldOff = (x, z) => { if (input.ptrType === 'touch') holdOff.set(0, 0, 0); else holdOff.set(x - hit.x, 0, z - hit.z); }
const heldTree = { on: false, flying: false, type: 0, g: 1, rot: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, tilt: 0 };
const heldObjs = TK.map(g => { const o = shadowify(g.scene.clone(true)); o.visible = false; scene.add(o); return o; });
const rootBall = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 7).scale(1, .55, 1), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1, flatShading: true }));
// Was die Hand gerade hält: 'villager', 'tree' oder null (ein geworfener Baum im Flug zählt nicht mehr)
const heldKind = () => input.grabbed ? 'villager' : heldTree.on && !heldTree.flying ? 'tree' : null;
rootBall.castShadow = true; rootBall.visible = false; scene.add(rootBall);

// Bodenpunkt unter dem Zeiger (Strahl gegen Gelände und Wasser)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pointers = new Map(); const pointerXY = { x: 0, y: 0 };
const hit = new THREE.Vector3(); let hitOk = false;
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let t = 0, prev = 0;
  for (let i = 0; i < 600; i++) { const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    if (py < Math.max(heightAt(px, pz), 0)) { let a = prev, b = t; for (let k = 0; k < 10; k++) { const m = (a + b) / 2, mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my < Math.max(heightAt(mx, mz), 0)) b = m; else a = m; }
      hit.set(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b); hitOk = true; return true; }
    prev = t; t += .15 + t * .01; if (t > 220) break; }
  hitOk = false; return false;
}
function screenDist(x, y, z, cx, cy) { const r = canvas.getBoundingClientRect(); tmpV.set(x, y, z).project(camera); return Math.hypot((tmpV.x + 1) / 2 * r.width + r.left - cx, (1 - tmpV.y) / 2 * r.height + r.top - cy); }

export { heldKind, heldObjs, heldTree, hit, hitOk, holdOff, input, pick, pointerXY, pointers, ray, rootBall, screenDist, setHoldOff, touchLift };
