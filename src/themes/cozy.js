// Theme „Gemütlich“: der Grund-Look von Weltenkeim – comichaft und niedlich.
// Gebäude und Requisiten: KayKit Medieval Hexagon Pack, Tiere der Kreatur: Quaternius Animated Animals,
// Gotteshand: eigenes Modell (assets/source/GodHand.blend). Vorgaben für neue Modelle: docs/assets.md.
//
// models: Schlüssel → Angaben zum Modell. Die Spiellogik kennt nur die Schlüssel.
//   file     Datei unter assets/models/ (glTF/GLB)
//   scale    Anpassung, falls das Modell nicht im Maßstab der Vorgaben gebaut ist (Standard 1)
//   anchors  Punkte im Modellraum { x, z }: door = vor der Tür, work = Arbeitsplatz neben dem Gebäude
//   foot     Grundriss für die Wegfindung im Modellraum: [Mitte x, Mitte z, halbe Breite, halbe Tiefe]
//   parts    Teile, die das Spiel bewegt: Knotenname oder RegExp (z. B. Säge, Windrad, Mühlrad)
//   sacks    Mehlsäcke neben der Mühle: [x, z, Drehung] im Modellraum
//   Kreaturen: hd = Fell-Modell (geplant für die Nahsicht), head = Kopfknochen, eyes = Augen am Kopfknochen ergänzen,
//   rest = Liegepose (nur Quaternius-Skelett „AnimalArmature“), react = eigene Lob-/Tadel-Animationen (Fuchs),
//   ws = Tempo der Laufanimation
//   Hand: materials = Rolle → Materialname im Modell und Oberfläche (Farben setzt der Spieler, S.handStyle)
// palette: Farben für im Code gebaute Dinge (Gelände, Himmel, Bewohner)
const HOME_A = [0, -.04, .4, .43], HOME_B = [0, .01, .44, .55];
export default {
  id: 'cozy',
  label: 'Gemütlich',
  models: {
    'house.a': { file: 'building_home_A_blue.gltf', anchors: { door: { x: 0, z: .32 } }, foot: HOME_A },
    'house.b': { file: 'building_home_B_blue.gltf', anchors: { door: { x: .14, z: .32 } }, foot: HOME_B },
    'well': { file: 'building_well_blue.gltf' },
    'scaffold': { file: 'building_scaffolding.gltf' },
    'tree.stump': { file: 'tree_single_A_cut.gltf' },
    'hut.lumber': { file: 'building_home_A_red.gltf', anchors: { door: { x: 0, z: .32 }, work: { x: -.5, z: .45 } }, foot: HOME_A },
    'hut.forester': { file: 'building_home_A_green.gltf', anchors: { door: { x: 0, z: .32 }, work: { x: .28, z: .6 } }, foot: HOME_A },
    'hut.sawyer': { file: 'building_lumbermill_blue.gltf', anchors: { door: { x: -.32, z: .62 }, work: { x: .3, z: .55 } }, foot: [0, .055, .69, .52], parts: { saw: 'building_lumbermill_saw_blue' } },
    'hut.hunter': { file: 'building_home_A_yellow.gltf', anchors: { door: { x: 0, z: .32 }, work: { x: -.5, z: .5 } }, foot: HOME_A },
    'hut.fisher': { file: 'building_home_B_yellow.gltf', anchors: { door: { x: .14, z: .32 }, work: { x: -.45, z: .6 } }, foot: HOME_B },
    'hut.farmer': { file: 'building_home_B_red.gltf', anchors: { door: { x: .14, z: .32 }, work: { x: .55, z: .62 } }, foot: HOME_B },
    'hut.miller': { file: 'building_windmill_blue.gltf', anchors: { door: { x: 0, z: .44 }, work: { x: .42, z: .62 } }, foot: [0, .015, .57, .4], parts: { fan: /fan/i }, sacks: [[-.42, .5, .3], [-.3, .62, -.4]] },
    // Wassermühle am Bach (erste Mühle): Rad an der Rückwand (−z), Achse quer zur Wand; der Bach läuft hinter dem Haus entlang
    'hut.watermill': { file: 'building_watermill_blue.gltf', anchors: { door: { x: .12, z: 1 }, work: { x: .8, z: .6 } }, foot: [0, .47, .56, .44], parts: { wheel: 'building_watermill_wheel_blue' }, sacks: [[.68, .32, .3], [.8, .45, -.4]] },
    'hut.baker': { file: 'building_home_B_green.gltf', anchors: { door: { x: .14, z: .32 }, work: { x: -.52, z: .56 } }, foot: HOME_B },
    'prop.logs': { file: 'resource_lumber.gltf' },
    'prop.crate': { file: 'crate_A_big.gltf' },
    'prop.sack': { file: 'sack.gltf' },
    'prop.barrel': { file: 'barrel.gltf' },
    'prop.target': { file: 'target.gltf' },
    'prop.arrows': { file: 'bucket_arrows.gltf' },
    'prop.wheelbarrow': { file: 'wheelbarrow.gltf' },
    'prop.bucket': { file: 'bucket_water.gltf' },
    'hand': { file: 'hand/GodHand.glb', materials: {
      skin: { name: 'Skin', roughness: .55, emissive: 0x3a1606, emissiveIntensity: .25 }, // warmer Schimmer, damit die Hand nicht blass wirkt
      nails: { name: 'Nails', roughness: .3 }, trim: { name: 'Trim', roughness: .35, metalness: .35 },
      sleeve: { name: 'Sleeve', roughness: .8 }, sleeveIn: { name: 'SleeveIn', roughness: 1 } } },
    // anchors: Ankerpunkte [Knochen, x, y, z] in Tierhöhen (kreatur.md 3.13): Maul, Rücken, Brust (Geschirr), Schwanzspitze;
    // backW: Breite des Rückens im Verhältnis zum Fuchs (Satteltaschen und Säcke liegen außen an); tow: Abstand Bauchgurt –
    // Karrenmitte in Tierhöhen
    'creature.fox': { file: 'animals/Fox.glb', hd: 'animals/Fox_HD.glb', head: 'Head', react: true, ws: 1.1, rest: 'paw',
      anchors: { mouth: ['Head', 0, -.07, .21], back: ['Torso', 0, .12, 0], chest: ['Torso3', 0, -.02, .02], girth: ['Torso', 0, -.12, 0], tail: ['Tail8', 0, -.01, -.07] } },
    'creature.wolf': { file: 'animals/Wolf.glb', head: 'Head', ws: 1, rest: 'paw', backW: 1.1,
      anchors: { mouth: ['Head', 0, -.06, .2], back: ['Torso', 0, .12, 0], chest: ['Torso3', 0, -.02, .02], girth: ['Torso', 0, -.12, 0], tail: ['Tail8', 0, -.01, -.07] } },
    // bodyS: Körpergröße im Verhältnis zur Höhe (beim Hirsch ist ein großer Teil der Höhe Geweih); horns: wo ein Baum quer liegt
    'creature.stag': { file: 'animals/Stag.glb', head: 'Head', ws: .9, rest: 'hoof', bodyS: .7, tow: .8, horns: ['Stag_Horns', 0, .14, -.05],
      anchors: { mouth: ['Head', 0, -.03, .09], back: ['Torso2', 0, .08, -.02], chest: ['Torso3', 0, -.02, .03], girth: ['Torso2', 0, -.05, 0], tail: ['Tail3', 0, 0, -.02], antlers: ['Stag_Horns', 0, .14, 0] } },
    'creature.bull': { file: 'animals/Bull.glb', head: 'Head', ws: .9, rest: 'hoof', backW: 1.45, horns: ['Head', 0, .1, .02],
      tow: .85,
      anchors: { mouth: ['Head', 0, -.1, .17], back: ['Torso2', 0, .2, -.05], chest: ['Torso3', 0, -.02, .06], girth: ['Torso2', 0, -.08, 0], tail: ['Tail7', 0, -.02, -.03] } },
    'creature.alpaca': { file: 'animals/Alpaca.glb', head: 'Head', ws: 1, rest: 'hoof' },
    // Katze (Quaternius Animal Pack Vol.2): nur Idle/Walk, keine Augen – Augen werden am Kopfknochen ergänzt
    'creature.cat': { file: 'animals/Cat.glb', head: 'Bone003', ws: 1.2, eyes: { fwd: .265, up: .05, side: .06, r: .034, iris: 0x8fd14f } },
  },
  palette: {
    // Tagesverlauf. Stützstellen: Stunde, Himmel oben/Mitte/Horizont (= Nebel), Licht (Sonne bzw. Mond) und Stärke,
    // Himmelslicht oben/Boden und Stärke, Nacht 0–1
    day: [
      [0, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
      [4.8, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
      [5.7, '#1a2552', '#3b3f6e', '#8a6a7a', '#ff9f6a', .2, '#6a78a8', '#2a2430', .5, .75],
      [6.5, '#4269a6', '#8fa9c8', '#f2b582', '#ffb27a', 1.1, '#bcd0e8', '#5a4a3a', .8, .2],
      [7.8, '#5ea9d4', '#a9d4e4', '#dfeee2', '#fff0d4', 2.3, '#dff1ff', '#6a5a3a', 1.15, 0],
      [17.4, '#5ea9d4', '#a9d4e4', '#e6efdc', '#ffeccc', 2.2, '#dff1ff', '#6a5a3a', 1.1, 0],
      [18.9, '#5274ab', '#c6a39a', '#f7b07c', '#ff9a58', 1.3, '#d0c0d8', '#5a4436', .8, .2],
      [20.1, '#1f2b5c', '#4a3f6e', '#9a5d6c', '#ff7a48', .25, '#6f76a8', '#2a2230', .6, .7],
      [21.2, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
      [24, '#050a1c', '#0c1631', '#1a2646', '#8fa6e6', .62, '#5a70b0', '#1b1924', .52, 1],
    ],
    // Himmel bei Bewölkung: klar, bedeckt, bedeckt in der Nacht, Nacht, Schneefall (fahles Grauweiß)
    sky: {
      clear: { top: '#2f86d4', mid: '#86c3ec', hor: '#d3eaf3' },
      overcast: { top: '#87919b', mid: '#a3abb3', hor: '#bdc3c8' },
      overcastNight: { top: '#0c0e12', mid: '#14171c', hor: '#1d2128' },
      night: { top: '#000105', mid: '#03060f' },
      snow: { top: '#a3abb4', mid: '#bec4ca', hor: '#d6dade' },
    },
    // Gelände: Ufer (tief, nass, Sand), Gras (zwei Töne), trocken, kahl, Fels, Schnee
    // Bachbett und Ufergras, Trampelpfade (zwei Töne). Zur Laufzeit änderbar: setTerrainColor (src/world/paths.js)
    terrain: { deep: 0xb7a06a, wet: 0xc8ad74, sand: 0xecd9a0, g1: 0x82b047, g2: 0x5a8d36, dry: 0xa6ad52, bare: 0x8f7a54, rock: 0x8e8476, snow: 0xf2f1ea,
      streamBed: 0x8d8270, streamGrass: 0x4f8a3a, path: 0xa88a5c, path2: 0x957548 },
    // Farbrollen der im Code gebauten Pflanzen und Felsen (src/core/colors.js): je Rolle eine Farbe oder eine Liste
    // (Verlauf dunkel → hell bzw. Auswahl). Zur Laufzeit lässt sich jede Rolle umfärben (Jahreszeiten).
    nature: {
      'leaf.spruce': [0x275a2e, 0x579b45], 'leaf.fir': [0x22503e, 0x4d8a68], 'leaf.oak': [0x3a7a2c, 0x8dc24f],
      'leaf.birch': [0x5f9a35, 0xb8da6c], 'leaf.fruit': [0x3f7f30, 0x86bd4c],
      'bark': [0x4a3322, 0x6a4a30], 'bark.spruce': [0x4f3420, 0x6b4a2c], 'bark.fruit': [0x4e3524, 0x6e4c32],
      'bark.birch': [0xebe7dc, 0x3d3832], // weiße Rinde, dunkle Streifen
      'fruit': [0xc8322a, 0xe2a12f], // Äpfel rot und gelb
      'rock': [0x76706a, 0xa29c90], 'moss': 0x5f7d3c,
      'bush': [0x2f6a2a, 0x6fa648], 'bush.dark': [0x2a5c27, 0x5e9443],
      'blossom': [0xf2a5c6, 0xffffff], 'berry': [0xc0302b, 0x3b3f8f],
      'grass': [0x86b54b, 0x76a842, 0x9cbc55, 0x6e9e3e], 'stem': [0x4c8a35, 0x5c9a40], 'fern': [0x2f6b2c, 0x6aa84a],
      'flower': [0xf6f3e8, 0xf2cf3a, 0xec86ad, 0x9c82dc, 0xdc4a3c, 0x75a6e6, 0xf09a3e], 'flower.eye': 0xf5c542,
      'shell': [0xfff6ec, 0xf6d3c6, 0xe9c9a0, 0xffe4ef], 'driftwood': [0x8f8576, 0xb3aa9a],
      // Blätter der Feldfrüchte und Gartenpflanzen (Einzelfarben im Code), Halme des Weizens (Farbe je Feld: grün bis golden)
      'crop': [0x3f7a2c, 0x86ad8a], 'wheat': [0x7fa04a, 0xd8b54a],
    },
    // Bewohner: Hautfarben, Haarfarben, Gewänder, Hosen
    villagers: {
      skins: [0xf7d9bf, 0xefc6a0, 0xe0ac82, 0xc98f60, 0xa8724a, 0x845535, 0x5f3b22],
      hairs: [0x1d1814, 0x3a2719, 0x5c3a20, 0x8b5a2b, 0xc89b55, 0xe6cb87, 0xa5422a, 0xb9b3a9],
      robes: [0xc2553d, 0x3d7cc2, 0xd9a441, 0x6b9b4a, 0x8c5fb3, 0xe07a5f, 0x4aa3a0, 0xd8d0c0],
      pants: [0x5b4636, 0x3e4a5c, 0x6a5a45, 0x4a3b30, 0x6b6156],
    },
    // Nahrung: Farbe des Essens in der Hand bei der Mittagspause und der Gabe auf dem Altar
    food: { bread: 0xc98b4c, fish: 0x8fb4c6, meat: 0xb4513f, veg: 0xe8873a, milk: 0xf2f0e8, eggs: 0xf1e2c4 },
    // Symbole über dem Kopf (src/village/emotes.js): Kontur und Fläche je Symbol
    emotes: { line: 0x2b2420, heart: 0xf0697a, wonder: 0xfff0a6, wish: 0xfffaf0, dizzy: 0xffd45a, fear: 0xfffaf0 },
  },
};
