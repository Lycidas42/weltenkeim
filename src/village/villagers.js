// Bewohner: Teile, Werkzeuge, Aussehen, Entstehen

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { theme } from '../assets/theme.js';
import { rnd } from '../core/util.js';
import { S, cap, onSave } from '../core/state.js';
import { scene } from '../core/render.js';
import { surfaceAt } from '../world/terrain.js';
import { houses } from './houses.js';

// Jeder Bewohner besteht aus instanzierten Einzelteilen (Beine, Rumpf, Arme, Kopf, Augen, Frisur, Bart).
// Aussehen (Haut, Haar, Frisur, Kleidung, Größe) wird pro Platz deterministisch gewürfelt, bleibt also nach dem Neuladen gleich.
const VCAP = 300, VS = 1.15;
const { skins: SKINS, hairs: HAIRS, robes: ROBES, pants: PANTS } = theme.palette.villagers;
const HIP_Y = .1, SHO_Y = .245, HEAD_Y = .33;
const vMesh = (geo, color, rough = .85) => {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true }), VCAP);
  m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m);
  if (color === 0xffffff) { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < VCAP; i++) m.setColorAt(i, w); }
  return m;
};
const hairCap = () => new THREE.SphereGeometry(.078, 10, 6, 0, Math.PI * 2, 0, Math.PI * .56).rotateX(-.62).translate(0, HEAD_Y + .006, -.006);
const vParts = {
  legL: vMesh(new THREE.CylinderGeometry(.03, .026, HIP_Y, 6).translate(0, -HIP_Y / 2, 0), 0xffffff),
  legR: vMesh(new THREE.CylinderGeometry(.03, .026, HIP_Y, 6).translate(0, -HIP_Y / 2, 0), 0xffffff),
  body: vMesh(mergeGeometries([
    new THREE.CylinderGeometry(.06, .1, .17, 8).translate(0, .175, 0),
    new THREE.SphereGeometry(.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .5, 1).translate(0, .26, 0),
  ]), 0xffffff),
  armL: vMesh(new THREE.CylinderGeometry(.022, .019, .13, 6).translate(0, -.065, 0), 0xffffff),
  armR: vMesh(new THREE.CylinderGeometry(.022, .019, .13, 6).translate(0, -.065, 0), 0xffffff),
  head: vMesh(mergeGeometries([
    new THREE.SphereGeometry(.07, 10, 8).translate(0, HEAD_Y, 0),
    new THREE.SphereGeometry(.014, 5, 4).translate(0, HEAD_Y - .008, .07),
    new THREE.CylinderGeometry(.025, .03, .03, 6).translate(0, HEAD_Y - .075, 0),
  ]), 0xffffff, .7),
  eyes: vMesh(mergeGeometries([
    new THREE.SphereGeometry(.011, 5, 4).translate(-.025, HEAD_Y + .012, .062),
    new THREE.SphereGeometry(.011, 5, 4).translate(.025, HEAD_Y + .012, .062),
  ]), 0x1a1410, .4),
  hair: [
    // kurz
    vMesh(hairCap(), 0xffffff, .95),
    // lang, über den Rücken
    vMesh(mergeGeometries([hairCap(), new THREE.CylinderGeometry(.068, .058, .12, 8, 1, false, Math.PI * .6, Math.PI * .8).translate(0, HEAD_Y - .045, -.008)]), 0xffffff, .95),
    // Dutt
    vMesh(mergeGeometries([hairCap(), new THREE.SphereGeometry(.036, 7, 5).translate(0, HEAD_Y + .07, -.045)]), 0xffffff, .95),
    // Pferdeschwanz
    vMesh(mergeGeometries([hairCap(), new THREE.CylinderGeometry(.022, .012, .11, 6).rotateX(.35).translate(0, HEAD_Y - .02, -.09)]), 0xffffff, .95),
  ],
  beard: vMesh(new THREE.SphereGeometry(.076, 8, 5, Math.PI * .1, Math.PI * .8, Math.PI * .5, Math.PI * .38).translate(0, HEAD_Y + .004, .004), 0xffffff, .95),
};
// runder Stamm: Rinde und helle Schnittflächen an den Enden
const vWood = [
  vMesh(new THREE.CylinderGeometry(.037, .04, .27, 9, 1, true).rotateZ(Math.PI / 2).translate(0, .21, .13), 0x7a4f2c, .95),
  vMesh(mergeGeometries([-1, 1].map(sd => new THREE.CircleGeometry(.036, 9).rotateY(sd * Math.PI / 2).translate(sd * .135, .21, .13))), 0xd9b47c, .9),
];
const vAxe = [
  vMesh(new THREE.CylinderGeometry(.011, .013, .25, 6).translate(0, -.185, 0), 0x7a5230, .9),
  vMesh(mergeGeometries([
    new THREE.BoxGeometry(.016, .05, .06).translate(0, -.285, -.035),
    new THREE.BoxGeometry(.008, .07, .016).translate(0, -.285, -.068), // Schneide
    new THREE.BoxGeometry(.022, .034, .028).translate(0, -.285, .012),  // Nacken
  ]), 0x9aa3ab, .35),
];
// Laterne: Aufhänger im Ursprung, hängt nach unten; das Glas leuchtet
const vLantern = vMesh(mergeGeometries([
  new THREE.BoxGeometry(.008, .02, .008).translate(0, -.01, 0),
  new THREE.CylinderGeometry(.008, .03, .022, 6).translate(0, -.031, 0),
  new THREE.CylinderGeometry(.03, .03, .01, 6).translate(0, -.087, 0),
  ...[0, 1, 2].map(k => new THREE.BoxGeometry(.006, .046, .006).translate(Math.cos(k * 2.09) * .026, -.059, Math.sin(k * 2.09) * .026)),
]), 0x3b3530, .6);
const LANTERN_C = -.059;
const vLanternGlass = new THREE.InstancedMesh(new THREE.CylinderGeometry(.022, .022, .046, 6).translate(0, LANTERN_C, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), VCAP);
vLanternGlass.frustumCulled = false; vLanternGlass.count = 0; scene.add(vLanternGlass);
const vBread = vMesh(new THREE.CapsuleGeometry(.018, .03, 3, 6).rotateZ(Math.PI / 2).translate(0, -.14, .012), 0xc98b4c, .9);
// Spaten des Försters: wie die Axt im Schulterraum, Blatt unten
const vShovel = [
  vMesh(new THREE.CylinderGeometry(.01, .011, .27, 6).translate(0, -.175, 0), 0x7a5230, .9),
  vMesh(mergeGeometries([new THREE.BoxGeometry(.055, .075, .01).translate(0, -.34, 0), new THREE.BoxGeometry(.04, .012, .012).translate(0, -.04, 0)]), 0x8e979e, .4),
];
// Setzling mit Erdballen, hängt aufrecht an der Hand
const vSapling = [
  vMesh(mergeGeometries([new THREE.SphereGeometry(.026, 6, 4).translate(0, -.02, 0), new THREE.CylinderGeometry(.005, .007, .07, 5).translate(0, .03, 0)]), 0x6b4a2e, .95),
  vMesh(new THREE.ConeGeometry(.04, .09, 6).translate(0, .1, 0), 0x4f9a3c, .8),
];
const vPlanks = vMesh(mergeGeometries([0, 1, 2].map(k => new THREE.BoxGeometry(.3, .016, .065).translate(0, .19 + k * .018, .13 + (k - 1) * .012))), 0xd8aa70, .85);
// Hüte zeigen den Beruf: rote Mütze (Holzfäller), grüner Filzhut (Förster), braune Schiebermütze (Säger)
const vHats = {
  lumber: vMesh(mergeGeometries([new THREE.SphereGeometry(.084, 10, 6, 0, Math.PI * 2, 0, Math.PI * .52).translate(0, HEAD_Y + .006, 0), new THREE.CylinderGeometry(.086, .086, .025, 10).translate(0, HEAD_Y + .006, 0), new THREE.SphereGeometry(.022, 6, 4).translate(0, HEAD_Y + .09, 0)]), 0xb8392c, .95),
  forester: vMesh(mergeGeometries([new THREE.CylinderGeometry(.125, .125, .012, 12).translate(0, HEAD_Y + .035, 0), new THREE.CylinderGeometry(.06, .078, .075, 10).translate(0, HEAD_Y + .075, 0)]), 0x3f6b2a, .95),
  hunter: vMesh(mergeGeometries([new THREE.ConeGeometry(.09, .1, 8).translate(0, HEAD_Y + .09, -.005), new THREE.CylinderGeometry(.1, .1, .012, 10).translate(0, HEAD_Y + .04, 0), new THREE.BoxGeometry(.012, .09, .02).rotateX(-.5).translate(.07, HEAD_Y + .1, -.04)]), 0x2f4a2a, .95),
  fisher: vMesh(mergeGeometries([new THREE.SphereGeometry(.085, 10, 6, 0, Math.PI * 2, 0, Math.PI * .5).translate(0, HEAD_Y + .01, 0), new THREE.CylinderGeometry(.075, .13, .03, 12).translate(0, HEAD_Y + .01, -.015)]), 0xe8c42f, .7),
  miller: vMesh(mergeGeometries([new THREE.CylinderGeometry(.088, .082, .05, 10).translate(0, HEAD_Y + .05, 0), new THREE.SphereGeometry(.09, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .45, 1).translate(0, HEAD_Y + .07, 0)]), 0xf0ece2, .95),
  baker: vMesh(mergeGeometries([new THREE.CylinderGeometry(.08, .08, .05, 10).translate(0, HEAD_Y + .05, 0), new THREE.CylinderGeometry(.1, .075, .1, 10).translate(0, HEAD_Y + .12, 0), new THREE.SphereGeometry(.1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .5, 1).translate(0, HEAD_Y + .17, 0)]), 0xfbfbf8, .9),
  farmer: vMesh(mergeGeometries([new THREE.CylinderGeometry(.14, .14, .012, 14).translate(0, HEAD_Y + .04, 0), new THREE.CylinderGeometry(.062, .074, .065, 10).translate(0, HEAD_Y + .075, 0)]), 0xe3c77a, .95),
  sawyer: vMesh(mergeGeometries([new THREE.SphereGeometry(.083, 10, 6, 0, Math.PI * 2, 0, Math.PI * .45).scale(1, .8, 1).translate(0, HEAD_Y + .02, -.004), new THREE.BoxGeometry(.1, .01, .05).translate(0, HEAD_Y + .03, .085)]), 0x6b4a2e, .95),
};
// Bogen (Bogenarm entlang der Hand, Sehne), Köcher auf dem Rücken, Angel, Fang und Wild zum Tragen
// Bogen: Griff im Ursprung, Sehne senkrecht dahinter. Auf dem Rücken getragen, zum Schuss in die linke Hand genommen.
const bowArc = () => new THREE.TorusGeometry(.2, .007, 4, 16, 1.4).rotateZ(-.7).translate(-.2, 0, 0).rotateY(-Math.PI / 2);
const bowStr = () => new THREE.CylinderGeometry(.0025, .0025, .258, 3).translate(0, 0, -.047);
const bowSeg = (a, b) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); return new THREE.CylinderGeometry(.0025, .0025, L, 3).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); };
const vBowBack = vMesh(mergeGeometries([bowArc(), bowStr()]).rotateY(Math.PI).rotateZ(.75).translate(-.02, .21, -.125), 0x6b4527, .8);
const vBowAim = vMesh(mergeGeometries([bowArc(), bowStr()]), 0x6b4527, .8);
const vBowDraw = vMesh(mergeGeometries([bowArc(), bowSeg(new THREE.Vector3(0, .129, -.047), new THREE.Vector3(0, 0, -.2)), bowSeg(new THREE.Vector3(0, -.129, -.047), new THREE.Vector3(0, 0, -.2))]), 0x6b4527, .8);
const vQuiver = vMesh(mergeGeometries([new THREE.CylinderGeometry(.028, .024, .16, 6).rotateX(.35).translate(.03, .2, -.08), ...[0, 1, 2].map(k => new THREE.ConeGeometry(.01, .04, 4).translate(.02 + k * .012, .3, -.12))]), 0x5a3a22, .9);
// Angel: liegt in der rechten Hand und zeigt bei vorgestrecktem Arm schräg nach vorn oben (Spitze: ROD_TIP im Armraum)
const vRod = vMesh(new THREE.CylinderGeometry(.004, .008, .62, 4).translate(0, .31, 0).rotateX(1.96).translate(0, -.13, 0), 0x8a6440, .8);
const ROD_TIP = new THREE.Vector3(0, -.13 + .62 * Math.cos(1.96), .62 * Math.sin(1.96));
const vGame = vMesh(new THREE.SphereGeometry(1, 7, 5).scale(.09, .06, .16).translate(0, .25, -.02), 0x8d6a46, .95);
// Gemüsekiste, Milchkanne, Eierkorb
const vVeg = vMesh(new THREE.BoxGeometry(.17, .07, .12).translate(0, .2, .13), 0x9a6a3c, .95);
const vVegTop = vMesh(mergeGeometries([[-.05, -.02, 0xe2802c], [0, .02, 0], [.05, -.01, 0], [-.02, .03, 0], [.03, -.03, 0]].map(([x, z]) => new THREE.SphereGeometry(.03, 6, 4).translate(x, .245, .13 + z))), 0xe58a2e, .7);
const vMilk = vMesh(mergeGeometries([new THREE.CylinderGeometry(.042, .05, .13, 8).translate(0, .21, .13), new THREE.CylinderGeometry(.025, .03, .03, 8).translate(0, .29, .13)]), 0xd9dee2, .4);
const vEggBasket = vMesh(new THREE.CylinderGeometry(.075, .06, .06, 8).translate(0, .2, .13), 0xb08a55, .95);
// Kornsack, Mehlsack, Brotkorb
const sackGeo = () => mergeGeometries([new THREE.SphereGeometry(1, 8, 6).scale(.075, .07, .06).translate(0, .21, .13), new THREE.CylinderGeometry(.018, .03, .04, 6).translate(0, .28, .13)]);
const vGrainSack = vMesh(sackGeo(), 0xb99a62, .95), vFlourSack = vMesh(sackGeo(), 0xeee6d6, .95);
const vLoafBasket = vMesh(new THREE.CylinderGeometry(.08, .062, .055, 8).translate(0, .2, .13), 0x9b7446, .95);
const vLoaves = vMesh(mergeGeometries([[-.03, 0], [.03, .015], [0, -.03]].map(([x, z]) => new THREE.SphereGeometry(.03, 7, 5).scale(1.4, .75, 1).translate(x, .24, .13 + z))), 0xc98a3e, .8);
const vEggs = vMesh(mergeGeometries([[-.03, 0], [.03, .01], [0, -.03], [0, .03]].map(([x, z]) => new THREE.SphereGeometry(.022, 6, 4).scale(1, 1.3, 1).translate(x, .24, .13 + z))), 0xf3ead8, .6);
const vBasket = vMesh(mergeGeometries([new THREE.CylinderGeometry(.08, .065, .09, 8).translate(0, .2, .13), ...[0, 1].map(k => new THREE.ConeGeometry(.02, .06, 3).rotateZ(Math.PI / 2).translate(-.03 + k * .06, .26, .13))]), 0xa98a5c, .95);
const vAll = [vParts.legL, vParts.legR, vParts.body, vParts.armL, vParts.armR, vParts.head, vParts.eyes, ...vParts.hair, vParts.beard, ...vWood, ...vAxe, vLantern, vLanternGlass, vBread, ...vShovel, ...vSapling, vPlanks, ...Object.values(vHats), vBowBack, vBowAim, vBowDraw, vQuiver, vRod, vGame, vBasket, vVeg, vVegTop, vMilk, vEggBasket, vEggs, vGrainSack, vFlourSack, vLoafBasket, vLoaves];
// Spatenstich: anheben, mit Gewicht hineinstechen, Erde herauswerfen
const DIG_T = .9;
function digPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .4) { const e = sm(p / .4); return { arm: -.75 - .55 * e, tilt: .1 }; }
  if (p < .55) { const e = (p - .4) / .15; return { arm: -1.3 + .75 * e * e, tilt: .1 + .25 * e }; }
  const e = sm((p - .55) / .45); return { arm: -.55 - .2 * e, tilt: .35 - .25 * e };
}
// Ein Axthieb dauert CHOP_T Sekunden: ausholen, zuschlagen (Treffer bei CHOP_HIT), zurücknehmen
const CHOP_T = .8, CHOP_HIT = .72;
function chopPose(p) {
  const sm = x => x * x * (3 - 2 * x);
  if (p < .55) { const e = sm(p / .55); return { arm: -.9 - 2.1 * e, tilt: -.12 * e, bob: 0 }; }
  if (p < CHOP_HIT) { const e = ((p - .55) / (CHOP_HIT - .55)) ** 2; return { arm: -3 + 1.75 * e, tilt: -.12 + .4 * e, bob: -.012 * e }; }
  const e = sm((p - CHOP_HIT) / (1 - CHOP_HIT)); return { arm: -1.25 + .35 * e, tilt: .28 * (1 - e), bob: -.012 * (1 - e) };
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dressVillager(i) {
  const r = mulberry(i * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const skin = new THREE.Color(pick(SKINS)).offsetHSL(0, 0, (r() - .5) * .04);
  const old = r() < .15, hairC = new THREE.Color(old ? pick([0xb9b3a9, 0xdedad2, 0x8f8a84]) : pick(HAIRS)).offsetHSL(0, 0, (r() - .5) * .05);
  const robe = new THREE.Color(pick(ROBES)), pants = new THREE.Color(pick(PANTS));
  const look = { hair: r() < .08 ? -1 : Math.floor(r() * vParts.hair.length), beard: r() < .25, s: .9 + r() * .2, w: .92 + r() * .16 };
  for (const m of [vParts.legL, vParts.legR]) m.setColorAt(i, pants);
  for (const m of [vParts.body, vParts.armL, vParts.armR]) m.setColorAt(i, robe);
  vParts.head.setColorAt(i, skin);
  for (const m of [...vParts.hair, vParts.beard]) m.setColorAt(i, hairC);
  for (const m of vAll) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return look;
}
const villagers = [];
onSave(() => { S.pop = villagers.length; });
function spawnVillager(x, z) {
  if (villagers.length >= VCAP) return null;
  const v = { x, z, y: surfaceAt(x, z), h: Math.random() * 6.28, state: 'idle', timer: .3 + Math.random() * 2, tx: x, tz: z, next: null, carry: 0, tree: null, vx: 0, vy: 0, vz: 0, haste: 0, ph: Math.random() * 6.28 };
  v.look = dressVillager(villagers.length);
  villagers.push(v);
  return v;
}
const homeSpot = () => { const h = houses[Math.floor(Math.random() * houses.length)] || { x: 0, z: 0 }; return { x: h.x + rnd(1), z: h.z + rnd(1) }; };
for (let i = 0; i < Math.min(S.pop, cap()); i++) { const p = homeSpot(); spawnVillager(p.x, p.z); }

export { CHOP_HIT, CHOP_T, DIG_T, HEAD_Y, HIP_Y, LANTERN_C, ROD_TIP, SHO_Y, VCAP, VS, chopPose, digPose, homeSpot, spawnVillager, vAll, vAxe, vBasket, vBowAim, vBowBack, vBowDraw, vBread, vEggBasket, vEggs, vFlourSack, vGame, vGrainSack, vHats, vLantern, vLanternGlass, vLoafBasket, vLoaves, vMilk, vParts, vPlanks, vQuiver, vRod, vSapling, vShovel, vVeg, vVegTop, vWood, villagers };
