// Fußspuren im Schnee: Bewohner, Kreatur, Wild und Vieh hinterlassen Abdrücke, solange Schnee liegt

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { S } from '../core/state.js';
import { scene } from '../core/render.js';
import { weather } from '../world/sky.js';
import { heightAt, streamDist } from '../world/terrain.js';
import { CREATURES, fox } from '../creature/kinds.js';
import { stock } from '../farm/farm.js';
import { villagers } from '../village/villagers.js';
import { wild } from './land.js';

// Ein Abdruck ist ein kleines, weich auslaufendes Oval knapp über dem Gelände (Instanzen, Ringpuffer). Er verblasst mit
// der Zeit, schneller bei neuem Schneefall, und verschwindet mit der Schneedecke.
const TRACK_N = 2400, LIFE = 50;
const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const ageAttr = new THREE.InstancedBufferAttribute(new Float32Array(TRACK_N).fill(LIFE), 1);
geo.setAttribute('aAge', ageAttr);
const trackU = { uSnow: { value: 0 } };
const mat = new THREE.MeshStandardMaterial({ color: 0x8796b0, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
mat.onBeforeCompile = sh => {
  sh.uniforms.uSnow = trackU.uSnow;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAge; varying float vTA; varying vec2 vTU;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvTA = 1. - smoothstep(${(LIFE * .4).toFixed(1)}, ${LIFE.toFixed(1)}, aAge); vTU = uv;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vTA; varying vec2 vTU;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.a = .55 * vTA * smoothstep(.25, .6, uSnow) * smoothstep(.5, .28, length(vTU - .5));`);
};
const prints = new THREE.InstancedMesh(geo, mat, TRACK_N);
prints.userData.noSnow = true; prints.frustumCulled = false; prints.renderOrder = 1; prints.count = 0; scene.add(prints);
const dummy = new THREE.Object3D();
let next = 0;
function addPrint(x, z, h, w, l) {
  dummy.position.set(x, heightAt(x, z) + .012, z); dummy.rotation.set(0, h, 0); dummy.scale.set(w, 1, l); dummy.updateMatrix();
  prints.setMatrixAt(next, dummy.matrix); ageAttr.array[next] = 0;
  next = (next + 1) % TRACK_N; prints.count = Math.max(prints.count, next || TRACK_N);
  prints.instanceMatrix.needsUpdate = true; quiet = 0;
}
// Gangart je Art: Größe des Abdrucks (Breite, Länge), Schrittlänge, Abstand der Spuren links/rechts
const GAIT = {
  villager: { w: .04, l: .07, stride: .1, side: .03 },
  reh: { w: .025, l: .04, stride: .17, side: .035 },
  hase: { w: .022, l: .045, stride: .2, side: .02 },
  huhn: { w: .025, l: .03, stride: .05, side: .012 }, hahn: { w: .028, l: .034, stride: .055, side: .014 },
  stock: { w: .045, l: .055, stride: .16, side: .05 },
  creature: { w: 0, l: 0, stride: 1, side: 0 }, // Maße je nach Gestalt, siehe updateTracks
};
const walkers = new WeakMap();
function step(key, x, z, y, g) {
  let s = walkers.get(key);
  if (!s) { walkers.set(key, { x, z, acc: 0, side: 1 }); return; }
  const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz); s.x = x; s.z = z;
  if (d > .6 || d < 1e-5) return; // gesprungen (getragen, abgesetzt) oder steht still
  // nur auf dem Boden, wo Schnee liegt: nicht im Wasser, im Bach oder in der Luft
  const ground = heightAt(x, z); if (ground < .15 || y - ground > .12 || streamDist(x, z) < .5) { s.acc = 0; return; }
  s.acc += d; if (s.acc < g.stride) return; s.acc -= g.stride;
  const h = Math.atan2(dx, dz), nx = Math.cos(h) * g.side * s.side, nz = -Math.sin(h) * g.side * s.side; s.side = -s.side;
  addPrint(x + nx, z + nz, h, g.w, g.l);
}
let quiet = 1e9; // Zeit seit dem letzten Abdruck: sind alle verblasst, gibt es nichts zu tun
function updateTracks(dt) {
  trackU.uSnow.value = weather.snowCover;
  if ((quiet += dt) < LIFE * 1.5) { // bei Schneefall rieseln die Spuren schneller zu
    const k = dt * (1 + 3 * weather.snow); for (let i = 0; i < prints.count; i++) ageAttr.array[i] += k;
    ageAttr.needsUpdate = true;
  }
  if (weather.snowCover < .3) return;
  for (const v of villagers) step(v, v.x, v.z, v.y, GAIT.villager);
  for (const a of wild) step(a, a.x, a.z, heightAt(a.x, a.z), GAIT[a.kind] || GAIT.reh);
  for (const a of stock) if (a.m.g.visible) { const p = a.m.g.position; step(a, p.x, p.z, p.y, GAIT[a.kind] || GAIT.stock); }
  // Kreatur: Abdrücke wachsen mit ihrer Größe
  const ch = CREATURES[S.creature].h, cg = GAIT.creature;
  cg.w = .032 * ch; cg.l = .045 * ch; cg.stride = .14 * ch; cg.side = .045 * ch;
  step(fox, fox.x, fox.z, heightAt(fox.x, fox.z), cg);
}

export { updateTracks };
