// Werkstätten: Ofen, Rauch, Säge, Mühle

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd } from '../core/util.js';
import { renderer, scene } from '../core/render.js';
import { sky, weather } from '../world/sky.js';
import { heightAt, streamU } from '../world/terrain.js';
import { waterU } from '../world/water.js';
import { jit, paint, plantMat } from '../models/nature.js';
import { MILL, SB, statics } from './layout.js';
import { mill, millWheel } from './houses.js';
import { huts, localPt } from './huts.js';

// Bäckerei: gemauerter Backofen mit Kuppel neben dem Haus, Glut im Ofenloch, Schornstein; dazu ein Tisch mit Broten
function buildOven(e) {
  const g = new THREE.Group(), parts = [], B = (geo, c) => parts.push(paint(geo, typeof c === 'function' ? c : (x, y, z, ny, cc) => cc.set(c).multiplyScalar(.9 + .2 * jit(x, y, z) - .1)));
  B(new THREE.BoxGeometry(.62, .22, .62).translate(0, .11, 0), 0x9a9288);
  B(new THREE.SphereGeometry(.29, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .9, 1).translate(0, .22, 0), 0xb8865a);
  B(new THREE.BoxGeometry(.2, .16, .08).translate(0, .3, .27), 0x8d8378); // Ofenmund
  B(new THREE.CylinderGeometry(.05, .06, .26, 6).translate(.12, .52, -.12), 0x8d8378); // Schornstein
  B(new THREE.BoxGeometry(.5, .04, .26).translate(-.62, .3, .1), 0x8a5f3a); for (const x of [-.82, -.42]) B(new THREE.BoxGeometry(.04, .28, .22).translate(x, .14, .1), 0x6a4428); // Tisch
  for (let k = 0; k < 4; k++) B(new THREE.SphereGeometry(.05, 7, 5).scale(1.4, .7, 1).translate(-.78 + k * .11, .345, .1 + (k % 2) * .05), 0xc98a3e); // Brote
  const m = new THREE.Mesh(mergeGeometries(parts), plantMat); m.castShadow = m.receiveShadow = true; g.add(m);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(.15, .1), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .25 })); glow.position.set(0, .29, .312); glow.userData.noSnow = true; g.add(glow);
  const p = localPt(e, -.95, .05); g.position.set(p.x, 0, p.z); g.rotation.y = e.o.rotation.y; scene.add(g); statics.push({ o: g, x: p.x, z: p.z });
  e.oven = { x: p.x, z: p.z, glow, chim: localPt(e, -.95 + .12 / SB, .05 - .12 / SB) };
}
// Rauch aus dem Schornstein: graue Wölkchen, die aufsteigen, größer werden und vergehen
const PUFF_N = 120, puffPos = new Float32Array(PUFF_N * 3), puffA = new Float32Array(PUFF_N * 2), puffs = [];
const puffGeo = new THREE.BufferGeometry(); puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3)); puffGeo.setAttribute('a', new THREE.BufferAttribute(puffA, 2));
const puffU = { uVH: { value: 800 }, uL: { value: 1 } };
const puffPts = new THREE.Points(puffGeo, new THREE.ShaderMaterial({ uniforms: puffU, transparent: true, depthWrite: false,
  vertexShader: `attribute vec2 a; varying float vA; uniform float uVH; void main() { vA = a.x; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = a.y * projectionMatrix[1][1] * uVH * .5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; uniform float uL; void main() { vec2 c = gl_PointCoord - .5; float d = dot(c, c); if (d > .25 || vA <= 0.) discard; gl_FragColor = vec4(vec3(.78, .77, .75) * uL, vA * (1. - d * 4.) * .55); }` }));
puffPts.frustumCulled = false; puffPts.userData.noSnow = true; scene.add(puffPts);
function updateWorkshops(dt, t) {
  for (const h of huts) if (h.saw) { h.sawing = Math.max(0, h.sawing - dt); if (h.sawing > 0) h.saw.rotation.x += dt * 14; }
  for (const hs of huts) {
    hs.busy = Math.max(0, (hs.busy || 0) - dt);
    if (hs.role === 'miller' && hs.fan) hs.fan.rotation.z += dt * (hs.busy > 0 ? 3.6 : .7) * (.6 + .6 * waterU.uWind.value); // mahlt: Flügel drehen schnell
    if (hs.role === 'baker' && hs.oven) {
      const O = hs.oven; O.glow.material.opacity = hs.busy > 0 ? .75 + Math.sin(t * 11) * .15 : .2;
      if (hs.busy > 0 && Math.random() < dt * 5) { if (puffs.length >= PUFF_N) puffs.shift(); puffs.push({ x: O.chim.x + rnd(.03), y: heightAt(O.x, O.z) + .68, z: O.chim.z + rnd(.03), t: 0, life: 2.2 + Math.random() }); }
    }
  }
  if (millWheel) millWheel.rotation.z += dt * MILL.dir * (1.1 + 1.8 * streamU.uSwell.value); // Mühlrad dreht mit der Strömung, bei Hochwasser schneller
  const wx = Math.cos(weather.dir) * waterU.uWind.value * .5, wz = Math.sin(weather.dir) * waterU.uWind.value * .5;
  for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.t += dt; if (q.t > q.life) { puffs.splice(i, 1); continue; } q.y += dt * .35; q.x += wx * dt * q.t; q.z += wz * dt * q.t; }
  for (let i = 0; i < PUFF_N; i++) { const q = puffs[i]; if (!q) { puffA[i * 2] = 0; continue; } puffPos.set([q.x, q.y, q.z], i * 3); const u = q.t / q.life; puffA[i * 2] = Math.min(1, u * 6) * (1 - u); puffA[i * 2 + 1] = .12 + u * .35; }
  puffGeo.attributes.position.needsUpdate = true; puffGeo.attributes.a.needsUpdate = true; puffU.uVH.value = renderer.domElement.height; puffU.uL.value = .35 + .65 * (1 - sky.night); puffPts.visible = puffs.length > 0;
}

export { buildOven, puffs, updateWorkshops };
