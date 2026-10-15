// Meer: Wellen-Shader, Gischt am Ufer

import * as THREE from 'three';
import { clamp, rnd, smooth } from '../core/util.js';
import { noise } from '../core/noise.js';
import { renderer, scene } from '../core/render.js';
import { sky, weather } from './sky.js';
import { HALF, N, NOISE_GLSL, SIZE, hTex, heightAt, seaAt, seaTex, streamU } from './terrain.js';

// Wasser: Wellen und Brandung im Vertex-Shader, Kräuselung durch Wind (Böen ziehen als Flecken übers Wasser),
// Farbe nach Tiefe (türkis im Flachen, tiefblau draußen), Schaum am Strand und bei starkem Wind Schaumkronen,
// Spiegelung des Himmels am flachen Blickwinkel, Sonnenglitzern über die Lichtberechnung.
const waterU = { uT: { value: 0 }, uWind: { value: .5 }, uDir: { value: 0 }, uH: { value: hTex }, uSea: { value: seaTex }, uSkyH: { value: sky.hor } };
const WATER_GLSL = NOISE_GLSL + `
uniform float uT, uWind, uDir; uniform sampler2D uH, uSea; varying vec3 vWP;
vec2 hUV(vec2 xz) { return (xz + ${HALF.toFixed(1)}) / ${SIZE.toFixed(1)} * ${((N - 1) / N).toFixed(5)} + ${(.5 / N).toFixed(5)}; }
float hAt(vec2 xz) { return texture2D(uH, hUV(xz)).r * 5. - 3.; }
// Wellen: fünf Züge verschiedener Länge und Richtung, ausgerichtet nach dem Wind. Langsam wandernde Rauschfelder
// heben und senken die Höhe stellenweise (Wellengruppen), so sieht nicht jede Welle gleich aus.
vec2 rot2(vec2 d, float a) { float c = cos(a), s = sin(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }
vec3 waves(vec2 p, float a) {
  vec3 r = vec3(0.); vec2 d0 = vec2(cos(uDir), sin(uDir)), d; float ph, A, k;
  float g1 = .35 + 1.3 * vns(p * .045 + vec2(uT * .035, -uT * .02)), g2 = .35 + 1.3 * vns(p * .08 + 7.3 - uT * .03), g3 = .4 + 1.2 * vns(p * .15 + 3.1 + uT * .05);
  d = d0;               k = 1.05; A = a * .62 * g1; ph = k * dot(d, p) - 1.3 * uT;              r.x += A * sin(ph); r.yz += A * k * cos(ph) * d;
  d = rot2(d0, .55);    k = 1.6;  A = a * .38 * g2; ph = k * dot(d, p) - 1.65 * uT + 1.7;       r.x += A * sin(ph); r.yz += A * k * cos(ph) * d;
  d = rot2(d0, -.75);   k = 2.35; A = a * .24 * g1 * g3; ph = k * dot(d, p) - 2.05 * uT + 4.1;  r.x += A * sin(ph); r.yz += A * k * cos(ph) * d;
  d = rot2(d0, 2.);     k = 3.5;  A = a * .12 * g3; ph = k * dot(d, p) - 2.6 * uT + .6;         r.x += A * sin(ph); r.yz += A * k * cos(ph) * d;
  d = rot2(d0, -2.6);   k = .62;  A = a * .3 * g2;  ph = k * dot(d, p) - .95 * uT + 2.9;        r.x += A * sin(ph); r.yz += A * k * cos(ph) * d; // lange Dünung
  return r;
}
float waveAmp(float depth) { return (.018 + .075 * uWind * uWind + .02 * uWind) * smoothstep(0., .7, depth); }
`;
const wGeo = new THREE.PlaneGeometry(150, 150, 220, 220).rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: .1, metalness: 0 });
waterMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, waterU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WATER_GLSL)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec2 wp = (modelMatrix * vec4(transformed, 1.)).xz; float depth = max(0., -.02 - hAt(wp));
        float surge = (.015 + .045 * uWind) * sin(depth * 14. - uT * (1.7 + 1.1 * uWind)) * (1. - smoothstep(0., .7, depth)) * smoothstep(0., .04, depth); // Brandung, bei Wind höher und schneller
        transformed.y += waves(wp, waveAmp(depth)).x + surge; }
      vWP = (modelMatrix * vec4(transformed, 1.)).xyz;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkyH;\n' + WATER_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 su = hUV(vWP.xz); if (su.x > 0. && su.y > 0. && su.x < 1. && su.y < 1. && texture2D(uSea, su).r < .5) discard; } // Gruben im Inland: kein Meer
      float wDepth = max(0., -.02 - hAt(vWP.xz));
      float gust = vns(vWP.xz * .07 + vec2(uT * .06, uT * .035));
      vec3 wc = mix(vec3(.25, .72, .7), vec3(.03, .22, .38), smoothstep(0., 1.8, wDepth));
      float fn = vns(vWP.xz * 3. + uT * .3), shore = 1. - smoothstep(0., .22 + .2 * uWind, wDepth); // Schaumstreifen am Ufer, bei Wind breiter
      float lines = smoothstep(.62 - .12 * uWind, .95, sin(wDepth * 40. - uT * (1.9 + 1.4 * uWind) + fn * 3.) * .5 + .5) * shore;
      // Schaumkronen: wo eine Welle oben auf dem Kamm steht und genug Wind weht; zerfasert durch Rauschen
      float wA = waveAmp(wDepth); vec3 w0 = waves(vWP.xz, wA);
      float crest = smoothstep(.5, .95, w0.x / max(wA * 1.25, 1e-4)) * smoothstep(.38, .9, uWind * (.55 + .9 * gust)) * smoothstep(.3, .7, vns(vWP.xz * 5. + uT * .6) * .6 + vns(vWP.xz * 13. - uT * .4) * .4) * smoothstep(.4, 1.2, wDepth);
      float caps = smoothstep(.8, .92, vns(vWP.xz * 1.7 + uT * .45)) * smoothstep(.65, 1., uWind * (.55 + .9 * gust)) * smoothstep(.5, 1.5, wDepth);
      float foam = clamp(shore * shore * .85 + lines * .75 + caps * .5 + crest * .95, 0., 1.);
      diffuseColor.rgb = mix(wc, vec3(.93, .97, 1.), foam);
      diffuseColor.a = mix(.5 + .42 * smoothstep(0., 1.2, wDepth), .95, foam);`)
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      { vec3 w = w0;
        float rip = (.4 + 1.1 * uWind) * (.45 + 1.1 * gust) * smoothstep(0., .25, wDepth); // Kräuselung, in Böen stärker
        vec2 q = vWP.xz * 5. + vec2(uT * .9, uT * .55), q2 = vWP.xz * 12. - vec2(uT * 1.3, -uT * .8); float e = .06;
        float a0 = vns(q), b0 = vns(q2);
        vec2 g = vec2(vns(q + vec2(e, 0.)) - a0, vns(q + vec2(0., e)) - a0) / e * .05 + vec2(vns(q2 + vec2(e, 0.)) - b0, vns(q2 + vec2(0., e)) - b0) / e * .025;
        vec3 wn = normalize(vec3(-w.y - g.x * rip, 1., -w.z - g.y * rip));
        normal = normalize((viewMatrix * vec4(wn, 0.)).xyz); }`)
    .replace('#include <opaque_fragment>', `{ float fres = pow(1. - max(dot(normal, normalize(vViewPosition)), 0.), 4.);
        outgoingLight = mix(outgoingLight, uSkyH, fres * .35 * (1. - foam)); }
      #include <opaque_fragment>`);
};
const water = new THREE.Mesh(wGeo, waterMat);
// Gischt: an der Uferlinie spritzen bei Wind Tröpfchen hoch und fallen zurück (eigene Punkte mit Größe und Deckkraft je Tropfen)
const SPRAY_N = 700, sprayPos = new Float32Array(SPRAY_N * 3), sprayA = new Float32Array(SPRAY_N), spray = [];
const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3)); sprayGeo.setAttribute('a', new THREE.BufferAttribute(sprayA, 1));
const sprayU = { uVH: { value: 800 }, uL: { value: 1 } };
const sprayMat = new THREE.ShaderMaterial({ uniforms: sprayU, transparent: true, depthWrite: false,
  vertexShader: `attribute float a; varying float vA; uniform float uVH; void main() { vA = a; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = (.05 + .07 * a) * projectionMatrix[1][1] * uVH * .5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; uniform float uL; void main() { vec2 c = gl_PointCoord - .5; float d = dot(c, c); if (d > .25 || vA <= 0.) discard; gl_FragColor = vec4(vec3(.94, .97, 1.) * uL, vA * (1. - d * 4.) * .8); }` });
const sprayPts = new THREE.Points(sprayGeo, sprayMat); sprayPts.frustumCulled = false; sprayPts.userData.noSnow = true; scene.add(sprayPts);
const shoreLine = []; // Punkte an der Wasserlinie mit Richtung aufs Meer
function scanShore() {
  shoreLine.length = 0;
  for (let k = 0; k < 720; k++) {
    const a = k / 720 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a); let r = 6, last = heightAt(dx * r, dz * r);
    for (; r < HALF - .5; r += .15) { const h = heightAt(dx * r, dz * r); if (last >= 0 && h < 0 && seaAt(dx * r, dz * r, 0)) { shoreLine.push({ x: dx * r, z: dz * r, dx, dz }); } last = h; }
  }
}
let sprayAcc = 0, shoreT = 0;
function updateSpray(dt, t) {
  if ((shoreT -= dt) <= 0) { shoreT = 10; scanShore(); } // das Ufer kann sich durch Formen ändern
  const w = waterU.uWind.value, rate = smooth(.3, 1, w) * 420;
  sprayAcc += rate * dt;
  while (sprayAcc >= 1 && shoreLine.length) {
    sprayAcc--; const S0 = shoreLine[Math.floor(Math.random() * shoreLine.length)];
    // Brandung kommt in Wellen: nur wo gerade eine Welle bricht (gleiche Welle wie im Wasser-Shader, grob)
    if (Math.sin(.3 * 14 - t * (1.7 + 1.1 * w) + (S0.x + S0.z) * .25) < .2) continue;
    const n = 4 + Math.floor(Math.random() * 6), out = .1 + Math.random() * .35, wx = Math.cos(weather.dir) * w * .8, wz = Math.sin(weather.dir) * w * .8;
    for (let k = 0; k < n; k++) {
      if (spray.length >= SPRAY_N) spray.shift();
      const ax = S0.x + S0.dx * out + rnd(.25), az = S0.z + S0.dz * out + rnd(.25), up = (.9 + Math.random() * 1.4) * (.6 + w * .7);
      spray.push({ x: ax, y: .02, z: az, vx: -S0.dx * (.2 + Math.random() * .5) + wx + rnd(.3), vy: up, vz: -S0.dz * (.2 + Math.random() * .5) + wz + rnd(.3), t: 0, life: .6 + Math.random() * .7, s: Math.random() });
    }
  }
  for (let i = spray.length - 1; i >= 0; i--) { const p = spray[i]; p.t += dt; if (p.t > p.life) { spray.splice(i, 1); continue; } p.vy -= 4.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < -.05) p.t = p.life; }
  for (let i = 0; i < SPRAY_N; i++) {
    const p = spray[i]; if (!p) { sprayA[i] = 0; continue; }
    sprayPos[i * 3] = p.x; sprayPos[i * 3 + 1] = p.y; sprayPos[i * 3 + 2] = p.z; sprayA[i] = (1 - p.t / p.life) * (.5 + .5 * p.s);
  }
  sprayGeo.attributes.position.needsUpdate = true; sprayGeo.attributes.a.needsUpdate = true;
  sprayU.uVH.value = renderer.domElement.height; sprayU.uL.value = .3 + .7 * (1 - sky.night);
  sprayPts.visible = spray.length > 0;
}
// Wellen und Wind: wechselt langsam zwischen ruhig und böig, bei Regen (auch dem Wunder) frischt er auf
function updateWater(dt, t, storm) {
  streamU.uT.value = t; waterU.uT.value = t; waterU.uDir.value = weather.dir; updateSpray(dt, t); waterU.uWind.value += (clamp(weather.wind + noise(t * .012, 3.7) * .35 + (storm ? .3 : 0), .06, 1) - waterU.uWind.value) * Math.min(1, dt * .5);
}
water.position.y = -.03; water.receiveShadow = true; water.frustumCulled = false;
scene.add(water);

export { SPRAY_N, shoreLine, spray, updateWater, waterMat, waterU };
