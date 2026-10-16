// Bewohner zeichnen

import * as THREE from 'three';
import { smooth } from '../core/util.js';
import { dummy, zero } from '../core/render.js';
import { sky } from '../world/sky.js';
import { PRAY_T, prayPose } from './shrine.js';
import { groundAt } from './huts.js';
import { smoothH } from '../world/nav.js';
import { HIP_Y, LANTERN_C, ROD_TIP, SHO_Y, VS, chopPose, digPose, vAll, vAxe, vBasket, vPick, vStone, vBowAim, vBowBack, vBowDraw, vBread, vEggBasket, vEggs, vFlourSack, vGame, vGrainSack, vHats, vLantern, vLanternGlass, vLoafBasket, vLoaves, vMilk, vParts, vPlanks, vQuiver, vRod, vSapling, vShovel, vVeg, vVegTop, vWood, villagers } from './villagers.js';
import { lV, lights } from './night.js';
import { LOAD_T, REEL_T } from './ai.js';
import { FOOD_COL } from './food.js';

// Jeder Bewohner besteht aus Teilen (Beine, Arme, Kopf, Werkzeug …), die hier je nach Tätigkeit gestellt werden
const vEuler = new THREE.Euler(), vTmp = new THREE.Matrix4(), vOut = new THREE.Matrix4(), mealC = new THREE.Color();
function renderVillagers(dt, t) {
  for (const m of vAll) m.count = villagers.length;
  lights.length = 0;
  const lantern = sky.night > .3; // ab der Dämmerung trägt jeder eine Laterne
  villagers.forEach((v, i) => {
    const L = v.look;
    if (v.state === 'sleep' || v.state === 'mine' || v.hidden) { for (const m of vAll) m.setMatrixAt(i, zero); return; } // schläft in der Hütte bzw. gehalten bei ausgeblendeter Hand
    let bob = 0, tilt = 0, roll = 0, leg = 0, armA = 0, armB = 0, splay = .25, armRz = 0, bite = -1;
    v.kn = v.state === 'pray' || v.state === 'beg' ? Math.min(1, (v.kn || 0) + dt * 5) : Math.max(0, (v.kn || 0) - dt * 5); // knien
    v.st = v.state === 'lunch' || v.state === 'ride' ? Math.min(1, (v.st || 0) + dt * 4) : Math.max(0, (v.st || 0) - dt * 4); // sitzen
    if (v.state === 'walk' || v.state === 'flee') {
      const s = Math.sin(t * (v.haste > 0 || v.state === 'flee' ? 18 : 11) + v.ph);
      bob = Math.abs(s) * .03; leg = s * .6; armA = -s * .5; armB = s * .5;
      if (v.state === 'flee') { armA = armB = -2.6 + s * .4; }
    } else if (v.state === 'chop' || v.state === 'quarry') { const c = chopPose((v.cp || 0) % 1); tilt = c.tilt; bob = c.bob; armA = armB = c.arm; splay = -.55; leg = .22; }
    else if (v.state === 'plant' || v.state === 'sow' || v.state === 'harvest') { const c = digPose((v.cp || 0) % 1); tilt = c.tilt + (v.state === 'plant' ? 0 : .25); armA = armB = c.arm; splay = v.state === 'plant' ? -.5 : .05; leg = .3; }
    else if (v.state === 'proc') { const s = Math.sin(t * (v.role === 'baker' ? 7 : 3) + v.ph); if (v.role === 'baker') { armA = armB = -1.15 + s * .25; tilt = .22; splay = .05; } else { armA = -1.9 + s * .12; armB = -1.7 - s * .12; splay = .2; tilt = -.04; } leg = .15; } // kneten bzw. Korn in den Trichter schütten
    else if (v.state === 'tend') { const s = Math.sin(t * 7 + v.ph); armA = -.5; armB = -1.1 + s * .35; splay = .15; tilt = .1; } // Futter streuen
    else if (v.state === 'saw') { const s = Math.sin(t * 9 + v.ph); armA = armB = -1.35 + s * .2; splay = -.25; tilt = .18 + s * .05; leg = .25; }
    else if (v.state === 'aim') { const draw = smooth(1.3, .5, v.timer); armA = -1.57; armB = -1.45; splay = .08; armRz = .55 + draw * .35; tilt = -.05; leg = .2; } // Bogen spannen
    else if (v.state === 'fish') { // auswerfen: Rute von hinten oben nach vorn, dann ruhig halten; beim Biss ruckt sie hoch
      const c = v.fp === 'cast' ? smooth(.9, .1, v.timer) : 1, jerk = v.fp === 'bite' ? Math.abs(Math.sin(v.timer * 14)) * .3 : Math.sin(t * 1.3 + v.ph) * .03;
      armB = -2.5 + c * 1.5 - jerk; armA = -.95; splay = .08; leg = .12;
      if (v.fp === 'reel') { const u = 1 - v.timer / REEL_T; armB = -1.05 - smooth(.6, 1, u) * .55 - (v.hooked ? Math.abs(Math.sin(t * 9)) * .08 : 0); armA = -1.05 + Math.sin(t * 15) * .28; splay = .14 + Math.cos(t * 15) * .06; tilt = -.06; } // Rute heben, linke Hand kurbelt
    }
    else if (v.state === 'pray') { const c = prayPose(((2 * PRAY_T - v.timer) / PRAY_T) % 1); tilt = c.tilt * v.kn; armA = armB = -1.2 + (c.arm + 1.2) * v.kn; splay = c.splay; }
    else if (v.state === 'beg') { const s = Math.sin(t * 2.2 + v.ph); tilt = -.2 * v.kn; armA = -2.9 + s * .12; armB = -2.9 - s * .12; splay = .4 + s * .05; }
    else if (v.state === 'lunch') { // sitzt im Gras und beißt ab und zu von seinem Essen ab (ohne Essen: leere Hände im Schoß)
      bite = v.meal ? Math.max(0, Math.sin(t * 1.4 + v.ph * 3)) ** 4 * v.st : 0;
      tilt = -.14 + bite * .06; armA = -.7; armB = -.7 - 1.75 * bite; splay = .12; armRz = .5 * bite;
    }
    else if (v.state === 'grabbed' || v.state === 'falling') {
      const s = Math.sin(t * 16 + v.ph); roll = v.state === 'grabbed' ? Math.sin(t * 7 + v.ph) * .5 : t * 10;
      leg = s * .5; armA = -2.7 + s * .5; armB = -2.7 - s * .5; splay = .5;
    } else if (v.state === 'loadFox') { // Ware vor dem Bauch, dann hoch über den Rücken der Kreatur heben
      const u = 1 - v.timer / LOAD_T, up = smooth(.15, .6, u) * (1 - smooth(.8, 1, u));
      armA = armB = -1.1 - up * 1.5; splay = .12; tilt = -.08 * up + .15 * (1 - up) * smooth(0, .15, u); leg = .15;
    } else if (v.state === 'dizzy') { armA = armB = 0; splay = 1.2 + Math.sin(t * 6 + v.ph) * .2; }
    if (v.carry && v.state !== 'grabbed' && v.state !== 'falling' && v.state !== 'saw' && v.state !== 'loadFox') { armA = armB = -1.1; splay = .12; }
    const rodOn = v.role === 'fisher' && !v.carry && !['grabbed', 'falling', 'sleep', 'lunch'].includes(v.state);
    if (rodOn && v.state !== 'fish') armB = -.85 + (v.state === 'walk' ? Math.sin(t * 11 + v.ph) * .05 : 0); // Rute schräg nach vorn oben
    if (v.stalk && v.state === 'walk') { tilt = .28; bob -= .02; } // geduckt anpirschen
    else if (v.state === 'ride') { const s = Math.sin(t * 9 + v.ph); armA = -2.6 + s * .35; armB = -2.6 - s * .35; splay = .5; } // jubelt auf dem Rücken
    else if (v.cheer > 0 && ['idle', 'walk', 'pray', 'beg', 'lunch'].includes(v.state)) { const s = Math.sin(t * 13 + v.ph); armA = -2.8 + s * .3; armB = -2.8 - s * .3; splay = .55; bob += Math.abs(Math.sin(t * 9 + v.ph)) * .05; } // Jubel
    const vTool = v.role === 'lumber' ? vAxe : v.role === 'forester' ? vShovel : v.role === 'mason' || v.role === 'miner' ? vPick : null, shoulder = vTool && v.state === 'walk' && !v.carry;
    const sapling = v.role === 'forester' && v.saplings > 0 && (v.state === 'walk' || v.state === 'idle');
    const vh = v.state === 'grabbed' || v.state === 'falling' ? (v.vh = v.h) : smoothH(v, dt);
    dummy.position.set(v.x, v.y + bob, v.z); dummy.rotation.set(tilt, vh, roll, 'YXZ'); dummy.scale.set(VS * L.s * L.w, VS * L.s, VS * L.s * L.w); dummy.updateMatrix();
    const M = dummy.matrix;
    const part = (mesh, x, y, a, z, pz = 0) => { vEuler.set(a, 0, z); vTmp.makeRotationFromEuler(vEuler).setPosition(x, y, pz); mesh.setMatrixAt(i, vOut.multiplyMatrices(M, vTmp)); };
    // Laterne in der linken Hand (nicht beim Hacken, Beten, Tragen: dann steht sie neben dem Bewohner)
    const handLantern = lantern && !v.carry && ['walk', 'idle', 'flee', 'dizzy'].includes(v.state);
    if (handLantern || sapling) { armA = (handLantern ? -.5 : -.35) + (v.state === 'walk' ? Math.sin(t * 11 + v.ph) * .06 : 0); splay = Math.max(splay, .14); }
    let legA = leg, legB = -leg;
    if (v.st > 0) { // im Sitzen liegen die Beine vorne flach am Boden
      const sl = -1.5 - tilt; legA += (sl - legA) * v.st; legB += (sl - legB) * v.st;
      bob -= v.st * HIP_Y * VS * L.s * .92;
      dummy.position.y = v.y + bob; dummy.updateMatrix();
    }
    if (v.kn > 0) { // auf den Fersen sitzen: Beine liegen hinten flach am Boden, Körper sinkt ab
      const kl = 1.45 - tilt; legA += (kl - legA) * v.kn; legB += (kl - legB) * v.kn;
      bob -= v.kn * HIP_Y * VS * L.s * .8;
      dummy.position.y = v.y + bob; dummy.updateMatrix();
    }
    part(vParts.legL, .038, HIP_Y, legA, 0); part(vParts.legR, -.038, HIP_Y, legB, 0);
    part(vParts.armL, .085, SHO_Y, armA, splay); part(vParts.armR, -.085, SHO_Y, armB, -splay + armRz);
    if (bite >= 0 && v.meal) {
      part(vBread, -.085, SHO_Y, armB, -splay + armRz);
      if (v.mealC !== v.meal) { v.mealC = v.meal; vBread.setColorAt(i, mealC.setHex(FOOD_COL[v.meal])); vBread.instanceColor.needsUpdate = true; }
    } else vBread.setMatrixAt(i, zero);
    if (!lantern || v.state === 'grabbed' || v.state === 'falling') { vLantern.setMatrixAt(i, zero); vLanternGlass.setMatrixAt(i, zero); }
    else {
      if (handLantern) { // hängt senkrecht an der Hand, pendelt beim Gehen
        const ca = Math.cos(splay) * .13;
        part(vLantern, .085 + Math.sin(splay) * .13, SHO_Y - ca * Math.cos(armA), Math.sin(t * 5.5 + v.ph) * (v.state === 'walk' ? .25 : .05), 0, -ca * Math.sin(armA));
      } else if (v.carry) part(vLantern, .15, .19, Math.sin(t * 5.5 + v.ph) * .2, 0, .13); // hängt am Holzbündel
      else { // steht neben dem Bewohner am Boden
        const c = Math.cos(vh), sn = Math.sin(vh), ox = .24, oz = .06, s2 = VS * L.s;
        vTmp.makeRotationY(vh).setPosition(v.x + ox * c + oz * sn, groundAt(v.x + ox * c + oz * sn, v.z - ox * sn + oz * c) + .095 * s2, v.z - ox * sn + oz * c); vOut.copy(vTmp.scale(lV.set(s2, s2, s2)));
        vLantern.setMatrixAt(i, vOut);
      }
      vLanternGlass.setMatrixAt(i, vOut);
      lV.set(0, LANTERN_C, 0).applyMatrix4(vOut); lights.push({ x: lV.x, y: lV.y, z: lV.z });
    }
    vParts.body.setMatrixAt(i, M); vParts.head.setMatrixAt(i, M); vParts.eyes.setMatrixAt(i, M);
    vParts.hair.forEach((m, k) => m.setMatrixAt(i, k === L.hair ? M : zero));
    vParts.beard.setMatrixAt(i, L.beard ? M : zero);
    vWood.forEach(m => m.setMatrixAt(i, v.carry === 1 ? M : zero)); vPlanks.setMatrixAt(i, v.carry === 2 ? M : zero);
    vGame.setMatrixAt(i, v.carry === 3 ? M : zero); vBasket.setMatrixAt(i, v.carry === 4 ? M : zero);
    vVeg.setMatrixAt(i, v.carry === 5 ? M : zero); vVegTop.setMatrixAt(i, v.carry === 5 ? M : zero); vMilk.setMatrixAt(i, v.carry === 6 ? M : zero);
    vEggBasket.setMatrixAt(i, v.carry === 7 ? M : zero); vEggs.setMatrixAt(i, v.carry === 7 ? M : zero);
    vGrainSack.setMatrixAt(i, v.carry === 8 ? M : zero); vFlourSack.setMatrixAt(i, v.carry === 9 ? M : zero); vLoafBasket.setMatrixAt(i, v.carry === 10 ? M : zero); vLoaves.setMatrixAt(i, v.carry === 10 ? M : zero); vStone.setMatrixAt(i, v.carry === 11 ? M : zero);
    // Jäger: Bogen und Köcher auf dem Rücken, zum Schuss nimmt er den Bogen in die linke Hand und spannt die Sehne
    const aiming = v.role === 'hunter' && v.state === 'aim', drawn = aiming && v.timer < .8;
    vBowBack.setMatrixAt(i, v.role === 'hunter' && !aiming ? M : zero);
    if (aiming && !drawn) part(vBowAim, .075, SHO_Y + .005, 0, -.12, .15); else vBowAim.setMatrixAt(i, zero);
    if (drawn) part(vBowDraw, .075, SHO_Y + .005, 0, -.12, .15); else vBowDraw.setMatrixAt(i, zero);
    vQuiver.setMatrixAt(i, v.role === 'hunter' ? M : zero);
    if (rodOn) { part(vRod, -.085, SHO_Y, armB, -splay + armRz); const tp = lV.copy(ROD_TIP).applyMatrix4(vOut); v.tip = v.tip || {}; v.tip.x = tp.x; v.tip.y = tp.y; v.tip.z = tp.z; } else vRod.setMatrixAt(i, zero);
    for (const r in vHats) vHats[r].setMatrixAt(i, v.role === r ? M : zero);
    // Werkzeug: beim Arbeiten in beiden Händen (Drehpunkt Schultermitte), unterwegs geschultert
    if (shoulder) part(vParts.armR, -.085, SHO_Y, -1.05, -.1); // hält den Stiel
    for (const set of [vAxe, vShovel, vPick]) {
      if (set !== vTool) { set.forEach(m => m.setMatrixAt(i, zero)); continue; }
      if (v.state === 'chop' || v.state === 'plant' || v.state === 'quarry') set.forEach(m => part(m, 0, SHO_Y, armA, 0));
      else if (shoulder) {
        const a = 2.15, sh = .17; // Stiel liegt mit der Mitte auf der rechten Schulter, Kopf hinten oben
        // Drehpunkt so verschoben, dass die Stielmitte (y = -.17) auf der Schulter liegt; vorderes Ende in der rechten Hand
        set.forEach(m => part(m, -.07, SHO_Y + .02 + Math.cos(a) * sh, a, 0, Math.sin(a) * sh));
      } else set.forEach(m => m.setMatrixAt(i, zero));
    }
    // Setzling in der linken Hand (abends hält sie die Laterne)
    if (sapling && !handLantern) { const ca = Math.cos(splay) * .13; vSapling.forEach(m => part(m, .085 + Math.sin(splay) * .13, SHO_Y - ca * Math.cos(armA) - .02, 0, 0, -ca * Math.sin(armA))); }
    else vSapling.forEach(m => m.setMatrixAt(i, zero));
  });
  for (const m of vAll) m.instanceMatrix.needsUpdate = true;
}

export { renderVillagers };
