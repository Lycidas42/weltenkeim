// Modelle laden (glTF)

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { $ } from '../core/util.js';
import { S } from '../core/state.js';
import { CREATURES } from '../creature/kinds.js';

const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => loader.load('assets/models/' + f, res, undefined, e => rej(new Error(f + ' konnte nicht geladen werden'))));
$('loadSt').textContent = 'Lade Modelle …';
const files = ['building_home_A_blue.gltf', 'building_home_B_blue.gltf', 'building_well_blue.gltf', 'building_windmill_blue.gltf', 'building_scaffolding.gltf',
  'tree_single_A_cut.gltf', `animals/${CREATURES[S.creature].file}.glb`, 'hand/GodHand.glb',
  'building_home_A_red.gltf', 'building_home_A_green.gltf', 'building_lumbermill_blue.gltf', 'resource_lumber.gltf', 'crate_A_big.gltf', 'sack.gltf', 'barrel.gltf',
  'building_home_A_yellow.gltf', 'building_home_B_yellow.gltf', 'target.gltf', 'bucket_arrows.gltf', 'building_home_B_red.gltf', 'wheelbarrow.gltf', 'bucket_water.gltf', 'building_home_B_green.gltf'];
const [gHomeA, gHomeB, gWell, gMill, gScaff, gStump, gCreature, gHand, gHutRed, gHutGreen, gSawmill, gLogs, gCrate, gSack, gBarrel, gHutYellowA, gHutYellowB, gTarget, gArrows, gFarmHouse, gWheelbarrow, gBucket, gBakery] = await Promise.all(files.map(load));
const shadowify = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function parts(g) { const out = []; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); out.push({ geo, mat: o.material }); } }); return out; }

export { gArrows, gBakery, gBarrel, gBucket, gCrate, gCreature, gFarmHouse, gHand, gHomeA, gHomeB, gHutGreen, gHutRed, gHutYellowA, gHutYellowB, gLogs, gMill, gSack, gSawmill, gScaff, gStump, gTarget, gWell, gWheelbarrow, load, parts, shadowify };
