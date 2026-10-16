# Baut einen aufrechten Tiermenschen (z. B. „Fuchsmensch“) für Weltenkeim in Blender 5.2 und exportiert ihn als GLB.
# Ablauf und Hintergrund: docs/kreatur-modelle.md. Skelett und Animationen: Quaternius Universal Animation Library 1+2
# (CC0, Standard-Version, als Zip nach dev/assets-raw/ legen und dort entpacken, siehe Anleitung).
#
# Aufruf in Blender (Skripting-Tab oder per MCP), p = Pfad zu dieser Datei:
#   exec(open(p, encoding='utf-8').read(), {'__file__': p, 'TM_KIND': 'fox'})
#   optional 'TM_OUT': Zielpfad, z. B. zum Ausprobieren nach dev/out/
# oder ohne Oberfläche (im Repo):  blender -b -P assets/source/build_tiermensch.py -- fox
# Ergebnis: assets/models/animals/<Datei> aus ART[...]['file']; die Szene „Tiermensch“ bleibt zum Nacharbeiten offen.
#
# Koordinaten: Blender, Figur blickt nach −Y (im GLB +Z), Höhe etwa 2 m in T-Pose. Formen werden aus Ellipsoiden,
# Kapseln und Kegeln um die Knochen der Schaufensterpuppe gelegt, verschmolzen (Voxel-Remesh), geglättet und reduziert.

import bpy, bmesh, os, sys
from mathutils import Vector

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(REPO, 'dev', 'assets-raw')
UAL1 = os.path.join(RAW, 'Universal_Animation_Library_Standard_', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb')
UAL2 = os.path.join(RAW, 'Universal_Animation_Library_2_Standard_', 'Universal Animation Library 2[Standard]', 'Unreal-Godot', 'UAL2_Standard.glb')
MANNEQUIN = os.path.join(RAW, 'Universal_Animation_Library_2_Standard_', 'Universal Animation Library 2[Standard]', 'Female Mannequin', 'Unreal-Godot', 'Mannequin_F.glb')

# Arten: Farben (sRGB-Hex) und Formen. light = Bauch/Schnauze/Schwanzspitze, dark = Pfoten/Ohrspitzen/Nase.
ART = {
    'fox': {'file': 'Foxfolk.glb', 'fur': 'c96a33', 'light': 'f6ecdc', 'dark': '3d2c25',
            'snout': (0.078, 0.30), 'ears': {'r': 0.10, 'h': 0.24, 'spread': 0.085}, 'tail': 'bushy', 'ruff': True, 'iris': 'c98a2a', 'brow': 'e9c79a', 'cup': '4a3328', 'tear': True},
    'bear': {'file': 'Bearfolk.glb', 'fur': '6a4530', 'light': 'c9a27a', 'dark': '2e2019', 'belly': 1.25, 'limbs': 1.4, 'legs': 1.12, 'head': 1.18,
             'snout': (0.10, 0.12), 'ears': {'round': 0.065}, 'tail': 'stub'},
    # weitere Arten: Hase (lange Ohren), Waschbär (Maske) …
}
# Schwänze: Kugeln (x, y, z, r) entlang der Kurve hinter dem Becken
TAILS = {'bushy': [(0, 0.17, 0.98, .07), (0, 0.27, 0.90, .10), (0, 0.38, 0.86, .13), (0, 0.50, 0.88, .15), (0, 0.61, 0.95, .14), (0, 0.69, 1.05, .11), (0, 0.73, 1.15, .07)],
         'stub': [(0, 0.17, 0.97, .08), (0, 0.23, 0.96, .075)]}
# Animationen im GLB (Namen wie in der Bibliothek); Zuordnung zu den Spielzuständen steht im Theme (anims)
ANIMS = ['Idle_Loop', 'Idle_FoldArms_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Walk_Carry_Loop', 'TreeChopping_Loop', 'PickUp_Table',
         'Hit_Chest', 'Spell_Simple_Shoot', 'Yes', 'Idle_No_Loop', 'LayToIdle',
         'Farm_Harvest', 'Farm_PlantSeed', 'Farm_Watering', 'Interact', 'OverhandThrow',
         'Curl_Down', 'Curl_Idle', 'Lift_Ground', 'Hold_Idle']  # die letzten vier baut das Skript selbst (posen())
# Detailstufe: Zieldreiecke nach dem Reduzieren und Voxelgröße beim Verschmelzen (kleiner = schärfere Formen).
# Hoch für die Arbeit am Gesicht; eine leichte Fassung fürs Handy z. B. mit TM_TRIS=7000, TM_VOXEL=0.018 erzeugen.
TRIS = globals().get('TM_TRIS', 40000)
VOXEL = globals().get('TM_VOXEL', 0.009)
# Wangenbüschel (Ansatz, Spitze, Radius; linke Seite), werden Teil der Körperform
RUFF = [((0.10, -0.06, 1.70), (0.155, 0.0, 1.69), 0.022), ((0.105, -0.05, 1.68), (0.175, 0.02, 1.655), 0.025),
        ((0.10, -0.05, 1.66), (0.175, 0.03, 1.62), 0.026), ((0.095, -0.05, 1.64), (0.16, 0.03, 1.59), 0.024),
        ((0.085, -0.06, 1.62), (0.13, 0.0, 1.57), 0.02), ((0.07, -0.08, 1.61), (0.10, -0.04, 1.56), 0.017)]
JAW_Z = 1.66  # Höhe der Maullinie unter der Schnauze (vor der Kopfskalierung); Unterkiefer und Mundraum sitzen daran

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92) if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

# Eigene Bewegungen, als Posen auf dem UAL-Skelett gebaut (Drehungen in Grad um die Achsen des Skeletts, aufrecht,
# Blick −Y; Kinder werden vor den Eltern gedreht, die Eltern nehmen sie mit): Einrollen zum Schlafen wie ein Fuchs,
# Aufheben vom Boden mit beiden Händen und Halten der Last vor dem Bauch.
CURL = {'spine_01': [('x', 18)], 'spine_02': [('x', 18)], 'spine_03': [('x', 14)], 'neck_01': [('x', 10)], 'Head': [('x', 12)],
        'thigh_l': [('x', -105)], 'thigh_r': [('x', -105)], 'calf_l': [('x', 135)], 'calf_r': [('x', 135)],
        # er rollt auf die linke Seite: der linke (untere) Arm liegt vor der Brust statt unter dem Körper
        'upperarm_l': [('x', -85), ('y', 65)], 'upperarm_r': [('x', -30)], 'lowerarm_l': [('x', -40), ('y', 55)], 'lowerarm_r': [('x', -50)],
        'tail_01': [('x', 30), ('z', 30)], 'tail_02': [('z', 55)], 'tail_03': [('z', 60)], 'tail_04': [('z', 55)]}
BEND = {'spine_01': [('x', 34)], 'spine_02': [('x', 28)], 'spine_03': [('x', 14)], 'neck_01': [('x', -10)], 'Head': [('x', -14)],
        'thigh_l': [('x', -72)], 'thigh_r': [('x', -72)], 'calf_l': [('x', 112)], 'calf_r': [('x', 112)], 'foot_l': [('x', -40)], 'foot_r': [('x', -40)],
        'upperarm_l': [('x', -78), ('y', -14)], 'upperarm_r': [('x', -78), ('y', 14)], 'lowerarm_l': [('x', -8)], 'lowerarm_r': [('x', -8)]}
HOLD = {'upperarm_l': [('x', -28), ('y', -8)], 'upperarm_r': [('x', -28), ('y', 8)], 'lowerarm_l': [('x', -48)], 'lowerarm_r': [('x', -48)]}

def posen(arm, body):
    import math
    from mathutils import Matrix
    ad = arm.animation_data; AX = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}
    def depth(b):
        d = 0
        while b.parent: b = b.parent; d += 1
        return d
    def base():  # Grundhaltung: erstes Bild von Idle_Loop; Knochen ohne Spur in Idle_Loop (Schwanz) auf Ruhe
        for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
        a = bpy.data.actions['Idle_Loop']; ad.action = a; ad.action_slot = a.slots[0]; bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
        vals = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy()) for pb in arm.pose.bones}; ad.action = None
        for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion, pb.location = vals.get(pb.name, ((1, 0, 0, 0), (0, 0, 0)))
        bpy.context.view_layer.update()
    def apply(rot, move=None):
        for n in sorted(rot, key=lambda n: -depth(arm.pose.bones[n])):
            pb = arm.pose.bones[n]; bpy.context.view_layer.update(); R = Matrix.Identity(4)
            for ax, deg in rot[n]: R = Matrix.Rotation(math.radians(deg), 4, AX[ax]) @ R
            h = pb.head.copy(); pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
        for n, v in (move or {}).items(): pb = arm.pose.bones[n]; pb.matrix = Matrix.Translation(Vector(v)) @ pb.matrix; bpy.context.view_layer.update()
    # Rumpf auf den Boden: tiefster Punkt der Vertices, die vor allem an Becken, Rücken, Beinen oder Kopf hängen
    # (nicht an Armen, Händen, Schwanz – sonst ruht er auf der Hand und schwebt)
    TORSO = ('pelvis', 'spine', 'thigh', 'calf', 'neck', 'Head')
    def on_ground():
        ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh(); zs = []
        for v, vr in zip(body.data.vertices, me.vertices):
            if v.groups and body.vertex_groups[max(v.groups, key=lambda e: e.weight).group].name.startswith(TORSO): zs.append((body.matrix_world @ vr.co).z)
        ev.to_mesh_clear(); apply({}, {'pelvis': (0, 0, -min(zs) + 0.01)})
    def curl(breath=0):
        base(); c = dict(CURL); c['spine_02'] = [('x', 18 + breath)]; apply(c); apply({'pelvis': [('y', 90)]}); on_ground()
    bend = lambda: (base(), apply(BEND, {'pelvis': (0, 0.1, -0.42)}))
    hold = lambda: (base(), apply(HOLD))
    def make(name, steps):
        a = bpy.data.actions.get(name)
        if a: bpy.data.actions.remove(a)
        a = bpy.data.actions.new(name); a.use_fake_user = True
        for f, fn in steps:
            ad.action = None; fn(); ad.action = a
            for pb in arm.pose.bones: pb.keyframe_insert('rotation_quaternion', frame=f); pb.keyframe_insert('location', frame=f)
        ad.action = None
    make('Curl_Down', [(0, base), (24, curl)])
    make('Curl_Idle', [(0, curl), (45, lambda: curl(3)), (90, curl)])
    make('Lift_Ground', [(0, base), (14, bend), (22, bend), (40, hold)])
    make('Hold_Idle', [(0, hold), (30, hold)])
    base()

def build(kind='fox', out=None):
    A = ART[kind]
    sc = bpy.data.scenes.get('Tiermensch') or bpy.data.scenes.new('Tiermensch')
    bpy.context.window.scene = sc
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)

    # 1. Skelett der Schaufensterpuppe (UAL2) übernehmen, Puppe selbst weg
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=MANNEQUIN)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE'); arm.name = 'TMRig'
    if arm.parent: m = arm.matrix_world.copy(); arm.parent = None; arm.matrix_world = m
    for o in new:
        if o is not arm: bpy.data.objects.remove(o, do_unlink=True)  # Puppe, Hilfsobjekte
    if arm.animation_data: arm.animation_data_clear()
    arm.location = (0, 0, 0); bpy.context.view_layer.update()
    mw = arm.matrix_world
    B = {b.name: (mw @ b.head_local, mw @ b.tail_local) for b in arm.data.bones}

    # 2. Körper aus Grundformen
    parts = []
    def ellip(c, r, seg=32):
        me = bpy.data.meshes.new('p'); o = bpy.data.objects.new('p', me); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1); bm.to_mesh(me); bm.free()
        o.scale = r; o.location = c; parts.append(o)
    def capsule(a, b, r):
        a, b = Vector(a), Vector(b); d = b - a; n = max(3, int(d.length / (r * .6)))
        for i in range(n + 1): ellip(a + d * (i / n), (r, r, r), 16)
    def cone(base, tip, r, tip_r=.15, flat=1.0):  # tip_r: Radius an der Spitze als Anteil (Ohren spitz, Schnauze stumpf); flat: Tiefe als Anteil (Ohren flach)
        base, tip = Vector(base), Vector(tip); d = tip - base
        me = bpy.data.meshes.new('c'); o = bpy.data.objects.new('c', me); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * tip_r, depth=d.length)
        if flat != 1.0: bmesh.ops.scale(bm, vec=(1, flat, 1), verts=bm.verts)
        bm.to_mesh(me); bm.free()
        o.location = base + d / 2; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); parts.append(o)
    k = A.get('belly', 1.0)
    # Bauch endet über den Oberschenkeln, darunter ein schmales Becken: sonst wachsen Bauch und Beine zu einem Rock zusammen
    ellip((0, 0.01, 1.22), (0.21 * k, 0.18 * k, 0.26)); ellip((0, -0.01, 1.40), (0.20 * k, 0.16 * k, 0.14)); ellip((0, 0, 1.55), (0.09, 0.09, 0.08))  # Bauch, Brust, Hals
    ellip((0, 0.02, 0.99), (0.16 * k, 0.14 * k, 0.09))                                                                           # Becken
    hk, lk, gk = A.get('head', 1.0), A.get('limbs', 1.0), A.get('legs', 1.0)
    hp = lambda x, y, z: (x * hk, y * hk, 1.76 + (z - 1.76) * hk)   # Punkt am Kopf, mit der Kopfgröße skaliert
    ellip(hp(0, 0.01, 1.785), (0.20 * hk, 0.165 * hk, 0.15 * hk)); ellip((0, -0.06, 1.70), (0.105 * hk, 0.12 * hk, 0.09 * hk))     # Kopf (oben breit), Wangen schmaler: Dreieck zur Schnauze
    # Schnauze als flacher Keil (breiter als hoch): an der Stirn fast so breit wie der Augenabstand, spitz zur Nase.
    # Als runder Kegel sah sie von oben wie ein Rohr zwischen den Augen aus.
    sr, sl = A['snout']; cone(hp(0, -0.09, 1.715), hp(0, -0.10 - sl, 1.69), sr * 1.6 * hk, .27, .55)                           # Oberkiefer, stumpfes Ende
    cone(hp(0, -0.05, 1.71), hp(0, -0.10 - sl * .6, 1.69), sr * 1.85 * hk, .45, .65)                                           # breiter Ansatz: Gesicht läuft dreieckig in die Schnauze
    # Augen liegen in Höhlen (Schritt 2b) unter einem leichten Stirnwulst, der sie überschattet
    EY = A.get('eye', {'x': 0.074, 'y': -0.127, 'z': 1.795, 'slant': 20})
    for s_ in (1, -1): ellip(hp(s_ * 0.077, -0.122, 1.827), (0.047 * hk, 0.036 * hk, 0.019 * hk), 20)
    if A.get('ruff'):                                                                                                           # Wangenfell, seitlich abstehend
        for s in (1, -1):
            ellip(hp(s * 0.075, -0.075, 1.67), (0.05 * hk, 0.07 * hk, 0.055 * hk), 20)
            # Büschel als Teil der Form nur ohne Schalenfell (sonst wirken sie von der Seite wie abstehende Finger)
            if not A.get('facefur', True):
                for b, t, r in RUFF: cone(hp(b[0] * s, b[1], b[2]), hp(t[0] * s, t[1], t[2]), r * hk, .12, .45)
    E = A['ears']
    for s in (1, -1):                                                                                                           # Ohren
        if E.get('round'): ellip(hp(s * 0.13, 0.02, 1.90), (E['round'] * hk, E['round'] * .6 * hk, E['round'] * hk), 20)
        else: cone(hp(s * 0.10, 0.01, 1.88), hp(s * (0.10 + E['spread']), 0.03, 1.88 + E['h']), E['r'] * hk, .15, .55)  # flach wie ein echtes Ohr: Drehen sieht man
    # Gliedmaßen als Profile entlang der Knochen statt Röhren: prof = [(t, Breite, Tiefe, Versatz)] von a nach b,
    # Versatz in Blickrichtung (−y vorn, +y hinten); dazwischen dicht überlappende Ellipsoide, die das Verschmelzen glättet
    def loft(a, b, prof, side_ax='x'):
        a, b = Vector(a), Vector(b); L = (b - a).length; n = max(6, int(L / 0.022))
        for i in range(n + 1):
            t = i / n; k = next(j for j in range(len(prof) - 1) if prof[j][0] <= t <= prof[j + 1][0] or j == len(prof) - 2)
            (t0, w0, d0, o0), (t1, w1, d1, o1) = prof[k], prof[k + 1]; u = smooth(0, 1, (t - t0) / max(1e-6, t1 - t0))
            w, dp, o = w0 + (w1 - w0) * u, d0 + (d1 - d0) * u, o0 + (o1 - o0) * u
            c = a + (b - a) * t + Vector((0, o, 0)); r = max(w, dp)
            ellip(c, (w, dp, r) if side_ax == 'x' else (r, dp, w), 16)
    for s in ('l', 'r'):
        sx = 1 if s == 'l' else -1
        ua, la, hd = B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s]
        # Arme: kräftige Schulter, schmaler zum Ellbogen, Unterarm mit Fellbausch, schlankes Handgelenk (Arme liegen in der T-Pose waagrecht: Breite = Höhe z)
        loft(B['clavicle_' + s][1], ua[1], [(0, .085 * lk, .085 * lk, 0), (.45, .075 * lk, .072 * lk, 0.005), (1, .06 * lk, .058 * lk, 0.01)], 'z')
        loft(la[0], la[1], [(0, .06 * lk, .058 * lk, 0.01), (.3, .066 * lk, .062 * lk, 0.012), (.8, .05 * lk, .046 * lk, 0.004), (1, .043 * lk, .04 * lk, 0)], 'z')
        ellip(ua[1] + Vector((0, 0.035, 0)), (0.04 * lk, 0.045 * lk, 0.05 * lk), 16)                                            # Fellbausch am Ellbogen
        # Pfote: flacher Handteller und kurze Finger an den Fingerknochen (bewegen sich mit den Animationen)
        ellip(hd[0] + Vector((sx * 0.06, 0.005, 0)), (0.065 * lk, 0.05 * lk, 0.032 * lk), 20)
        for fg in ('index', 'middle', 'ring', 'pinky'):
            f1, f3 = B[f'{fg}_01_{s}'], B[f'{fg}_03_{s}']; capsule(f1[0] - Vector((sx * 0.02, 0, 0)), f3[1] - Vector((sx * 0.012, 0, 0)), 0.017 * lk)
        capsule(B[f'thumb_01_{s}'][0], B[f'thumb_03_{s}'][0], 0.018 * lk)
        th, ca, ft = B['thigh_' + s], B['calf_' + s], B['foot_' + s]
        ofs = Vector((0.022 * sx, 0, 0))   # Beine leicht nach außen, damit innen eine Lücke bleibt
        # Beine wie beim Fuchs: kräftiger, fellbauschiger Oberschenkel, schlankes Knie, Wade hinten, dünner Lauf mit Sprunggelenk
        loft(th[0] + ofs + Vector((0, 0, -0.02)), th[1] + ofs * .5, [(0, .104 * gk, .13 * gk, 0.02), (.35, .1 * gk, .125 * gk, 0.016), (.8, .072 * gk, .078 * gk, 0.002), (1, .062 * gk, .064 * gk, -0.006)])
        loft(ca[0] + ofs * .5, ca[1] + Vector((0, 0, 0.02)), [(0, .06 * gk, .062 * gk, -0.004), (.25, .062 * gk, .07 * gk, 0.016), (.6, .046 * gk, .048 * gk, 0.006), (1, .04 * gk, .042 * gk, 0)])
        ellip(ca[1] + Vector((0, 0.035, 0.035)), (0.036 * gk, 0.04 * gk, 0.04 * gk), 16)                                          # Sprunggelenk (Ferse)
        # Hinterpfote: lang, vorn auf den Zehen, mit vier Zehenballen
        ellip((ft[0].x, -0.07, 0.045), (0.06 * gk, 0.135 * gk, 0.044 * gk), 20)
        for zx, zy in ((-0.032, -0.165), (-0.011, -0.183), (0.011, -0.183), (0.032, -0.165)): ellip((ft[0].x + zx * gk, zy, 0.03), (0.021 * gk, 0.03 * gk, 0.026 * gk), 12)
    for x, y, z, r in TAILS[A['tail']]: ellip((x, y, z), (r * .9, r, r), 20)

    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active; body.name = 'TMBody'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    r = body.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = VOXEL; bpy.ops.object.modifier_apply(modifier='rm')
    # kleine abgetrennte Inseln (z. B. dünne Büschelspitzen) entfernen: an ihnen scheitert sonst die automatische Gewichtung
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table(); seen = set(); isl = []
    for v0 in bm.verts:
        if v0.index in seen: continue
        stack, comp = [v0], []; seen.add(v0.index)
        while stack:
            v = stack.pop(); comp.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in seen: seen.add(w.index); stack.append(w)
        isl.append(comp)
    isl.sort(key=len); small = [v for c in isl[:-1] for v in c]
    if small: bmesh.ops.delete(bm, geom=small, context='VERTS'); print('Inseln entfernt:', len(isl) - 1)
    bm.to_mesh(body.data); bm.free()
    sm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); sm.iterations = 8; sm.use_only_smooth = True; bpy.ops.object.modifier_apply(modifier='sm')
    # 2b. Augenhöhlen: je ein schräges Ellipsoid aus dem Kopf schneiden; das Auge sitzt darin zurückgesetzt
    import math
    for s_ in (1, -1):
        me2 = bpy.data.meshes.new('cut'); cut = bpy.data.objects.new('cut', me2); sc.collection.objects.link(cut)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1); bm.to_mesh(me2); bm.free()
        cut.location = hp(EY['x'] * s_, EY['y'] - 0.012, EY['z']); cut.rotation_euler = (0, -math.radians(EY['slant'] * s_), 0)
        cut.scale = (0.039 * hk, 0.022, 0.029 * hk); bpy.context.view_layer.update()
        bo = body.modifiers.new('eye', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cut; bo.solver = 'EXACT'
        bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='eye'); bpy.data.objects.remove(cut, do_unlink=True)
    body.data.calc_loop_triangles(); n = len(body.data.loop_triangles)
    d = body.modifiers.new('dc', 'DECIMATE'); d.ratio = min(1, TRIS / n); bpy.ops.object.modifier_apply(modifier='dc')
    bpy.ops.object.shade_smooth()

    # 3. Schwanzknochen am Becken, dann automatische Gewichte
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT'); eb = arm.data.edit_bones; inv = arm.matrix_world.inverted()
    pts = [Vector(p) for p in [(0, 0.12, 0.99), (0, 0.30, 0.88), (0, 0.48, 0.87), (0, 0.63, 0.96), (0, 0.74, 1.16)]]
    parent = eb['pelvis']
    for i in range(4):
        b = eb.new(f'tail_0{i + 1}'); b.head = inv @ pts[i]; b.tail = inv @ pts[i + 1]; b.parent = parent; b.use_connect = i > 0; parent = b
    # Gesicht: Ohren (aufstellen, anlegen, zucken) und Unterkiefer (Maul öffnen) bewegt das Spiel im Code (creature/face.js)
    for s, nm in ((1, 'ear_l'), (-1, 'ear_r')):
        b = eb.new(nm); b.parent = eb['Head']
        if E.get('round'): b.head, b.tail = inv @ Vector(hp(s * 0.12, 0.02, 1.86)), inv @ Vector(hp(s * 0.14, 0.02, 1.96))
        else: b.head, b.tail = inv @ Vector(hp(s * 0.10, 0.01, 1.88)), inv @ Vector(hp(s * (0.10 + E['spread']), 0.03, 1.88 + E['h']))
    b = eb.new('jaw'); b.parent = eb['Head']; b.head, b.tail = inv @ Vector(hp(0, -0.07, JAW_Z)), inv @ Vector(hp(0, -0.10 - sl * .8, JAW_Z - 0.01))
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    for nm in ('ear_l', 'ear_r', 'jaw'): arm.data.bones[nm].use_deform = False  # nicht automatisch: sie liegen im Kopf und zögen Stirn und Schnauze an sich
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for nm in ('ear_l', 'ear_r', 'jaw'): arm.data.bones[nm].use_deform = True; body.vertex_groups.get(nm) or body.vertex_groups.new(name=nm)
    # Punkte, an denen die automatische Gewichtung gescheitert ist (im feinen Netz z. B. an Augenhöhlen und Stirnwulst),
    # bekommen den nächsten Knochen; sonst bleiben sie in der Grundpose stehen und das Gesicht reißt bei jeder Bewegung auf
    from mathutils.geometry import intersect_point_line
    segs = [(b.name, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones if b.use_deform and not b.name.startswith(('ear_', 'jaw'))]
    fixed = 0
    for v in body.data.vertices:
        if sum(e.weight for e in v.groups) >= 0.5: continue
        def dist(sg):
            p_, t = intersect_point_line(v.co, sg[1], sg[2]); t = max(0.0, min(1.0, t)); return (v.co - (sg[1] + (sg[2] - sg[1]) * t)).length
        body.vertex_groups[min(segs, key=dist)[0]].add([v.index], 1.0, 'ADD'); fixed += 1
    print('ohne Gewicht, nachgetragen:', fixed)
    # Gewichte glätten und auf 4 Knochen je Punkt begrenzen (so viele nutzt das Spiel): sonst ziehen die Schultern
    # beim Tragen die Haut am oberen Rücken zu einem Buckel hoch
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.6, repeat=4)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Ohren und Unterkiefer gezielt gewichten (die automatischen Gewichte teilen sie nicht sauber vom Kopf):
    # Anteil w an den neuen Knochen, der Rest bleibt in den alten Gruppen (anteilig verkleinert)
    # (jaw bleibt leer: der Unterkiefer ist ein eigenes Teil, Schritt 5)
    def take(vg_name, wfn):
        g = body.vertex_groups[vg_name]
        for v in body.data.vertices:
            w = wfn(v.co)
            if w <= 0.001: continue
            for e in v.groups:
                if e.group != g.index: e.weight *= (1 - w)
            g.add([v.index], w, 'REPLACE')
    for s, nm in ((1, 'ear_l'), (-1, 'ear_r')):
        bn = arm.data.bones[nm]; a, b = arm.matrix_world @ bn.head_local, arm.matrix_world @ bn.tail_local; ax = (b - a).normalized()
        def ear(co, a=a, ax=ax, s=s):
            t = (co - a).dot(ax); r = ((co - a) - ax * t).length
            return smooth(-0.015, 0.03, t) * smooth(0.13, 0.08, r) * (1 if co.x * s > 0.04 else 0)
        take(nm, ear)

    # 4. Farben als Vertexfarben mit weichen Übergängen (Masken in der T-Pose)
    FUR, LIGHT, DARK, CUP = srgb(A['fur']), srgb(A['light']), srgb(A['dark']), srgb(A.get('cup', A['dark']))
    me = body.data; ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    fur = me.attributes.new('_FUR', 'FLOAT', 'POINT') if A.get('facefur', True) else None
    ca = me.color_attributes['Col']; fur = me.attributes['_FUR'] if fur is not None else None  # nach dem Anlegen neu holen (Verweise werden ungültig)
    for v in me.vertices:
        x, y, z = v.co; ax = abs(x)
        belly = smooth(1.15, .8, (x / .135) ** 2 + ((z - 1.22) / .27) ** 2) * smooth(-0.03, -0.11, y)
        muzzle = smooth(-0.12, -0.17, y) * smooth(1.70, 1.675, z) * smooth(1.58, 1.62, z)          # Unterseite der Schnauze, oben bleibt Fell
        cheek = smooth(1.0, .55, ((ax - .085) / .075) ** 2 + ((y + .09) / .1) ** 2 + ((z - 1.665) / .065) ** 2)  # Wangenfell
        throat = smooth(1.0, .6, (x / .11) ** 2 + ((z - 1.56) / .12) ** 2) * smooth(-0.0, -0.07, y)     # Kehle bis zum Unterkiefer
        tip = smooth(.6, .68, y) * smooth(.92, 1.0, z) if A['tail'] == 'bushy' else 0
        cup = back = 0
        if not E.get('round'):  # Ohren wie beim Rotfuchs: innen dunkle Muschel (helle Haarbüschel kommen extra), Rücken dunkel
            t = (z - 1.88) / E['h']; ex = 0.10 + E['spread'] * t; yc = 0.01 + 0.02 * t; rr = E['r'] * (1 - t * .85)
            ear = smooth(-0.04, 0.06, t) * (1 if ax > 0.05 else 0)
            cup = ear * smooth(.85, .6, t) * smooth(rr * .8, rr * .45, abs(ax - ex)) * smooth(yc - 0.004, yc - 0.018, y)
            back = ear * smooth(yc + 0.002, yc + 0.016, y) * smooth(0.05, 0.25, t)
        ruff = smooth(.085, .11, ax) * smooth(1.55, 1.58, z) * smooth(1.72, 1.70, z) * smooth(0.08, 0.04, y) if A.get('ruff') else 0  # Wangenbüschel hell
        light = max(belly, muzzle, cheek, throat, tip, ruff)
        brow = 0
        if A.get('brow'):  # heller Fleck über dem inneren Augenwinkel (wie beim Rotfuchs), gilt auch fürs Schalenfell
            bx_, by_, bz_ = hp(EY['x'] * .78, EY['y'], EY['z'] + 0.034)
            brow = smooth(1.0, .45, ((ax - bx_) / 0.026) ** 2 + ((z - bz_) / 0.014) ** 2) * smooth(-0.10, -0.12, y)
        tear = 0
        if A.get('tear'):  # dunkle Tränenlinie vom inneren Augenwinkel zur Schnauze
            p0, p1 = Vector(hp(0.052, -0.155, 1.776)), Vector(hp(0.03, -0.235, 1.712)); q = Vector((ax, y, z)); d = p1 - p0
            u = max(0.0, min(1.0, (q - p0).dot(d) / d.length_squared)); tear = smooth(.011, .005, (q - p0 - d * u).length) * (1 - u * .5)
        sock = 0
        for s_ in (1, -1):  # Augenhöhle leicht abgedunkelt (Schatten unter dem Stirnwulst)
            ex_, ey_, ez_ = hp(EY['x'] * s_, EY['y'], EY['z'])
            sock = max(sock, smooth(1.6, 1.0, ((x - ex_) / 0.04) ** 2 + ((z - ez_) / 0.03) ** 2) * smooth(-0.11, -0.13, y))
        # Strümpfe wie beim Rotfuchs: schwarzbraun mit weichem Verlauf, Arme ab dem Ellbogen, Beine ab dem Knie
        stock = max(smooth(.36, .5, ax) * smooth(1.25, 1.33, z) * smooth(1.62, 1.55, z), smooth(.62, .4, z) * smooth(.004, .02, ax))
        dark = max(tear * .85, sock * .45, stock * .92, smooth(1.975, 2.03, z))
        c = [FUR[i] * (1 - light) + LIGHT[i] * light for i in range(3)]
        c = [c[i] * (1 - dark) + DARK[i] * dark for i in range(3)]
        c = [c[i] * (1 - back * .8) + DARK[i] * back * .8 for i in range(3)]
        c = [c[i] * (1 - cup) + CUP[i] * cup for i in range(3)]
        if brow: BR = srgb(A['brow']); c = [c[i] * (1 - brow * .75) + BR[i] * brow * .75 for i in range(3)]
        ca.data[v.index].color = (*c, 1)
        # Fellmaske fürs Schalenfell der Nahsicht (0 = kein Fell, 1 = lang): erst nur das Gesicht
        if fur is not None:
            f_ = smooth(1.56, 1.62, z) * (0.3 if (z > 1.88 and ax > 0.06) else 1.0)
            f_ *= 1.0 if (ax > 0.08 and z < 1.73) else (0.35 if y < -0.13 else 0.6)            # Wangen lang, Schnauze kurz, Stirn mittel
            for s_ in (1, -1):
                ex_, ey_, ez_ = hp(EY['x'] * s_, EY['y'], EY['z']); f_ *= smooth(1.0, 2.2, ((x - ex_) / 0.04) ** 2 + ((z - ez_) / 0.032) ** 2 + ((y - ey_) / 0.06) ** 2)
            f_ *= smooth(-0.10 - sl * .97, -0.10 - sl * .85, y)                                                    # Nasenspitze frei
            fur.data[v.index].value = f_
    mat = bpy.data.materials.new('Fell_' + kind); mat.use_nodes = True; nt = mat.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); p.inputs['Roughness'].default_value = .85
    cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], p.inputs['Base Color'])
    me.materials.clear(); me.materials.append(mat)

    # 5. Augen und Nase am Kopfknochen
    # Kegelteil (Kiefer, Mundraum, Zunge, Zähne) zwischen zwei Punkten, flat = Höhe als Anteil der Breite
    def part(name, base, tip, r, tip_r, flat, rgb, rough, bone='Head'):
        base, tip = Vector(base), Vector(tip); d = tip - base
        m2 = bpy.data.materials.new(name); m2.use_nodes = True
        q = next(n for n in m2.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); q.inputs['Base Color'].default_value = (*srgb(rgb), 1); q.inputs['Roughness'].default_value = rough
        me2 = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me2); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * tip_r, depth=d.length)
        if flat != 1: bmesh.ops.scale(bm, vec=(1, flat, 1), verts=bm.verts)
        bm.to_mesh(me2); bm.free()
        for f in me2.polygons: f.use_smooth = True
        o.location = base + d / 2; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        me2.materials.append(m2); bpy.context.view_layer.update()
        w = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bone; o.matrix_world = w
        return o
    def bead(name, c, r, rgb, rough, bone='Head', roll=0):  # roll: Neigung in der Gesichtsebene (Grad, + = außen hoch für die linke Seite)
        m2 = bpy.data.materials.new(name); m2.use_nodes = True
        q = next(n for n in m2.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); q.inputs['Base Color'].default_value = (*srgb(rgb), 1); q.inputs['Roughness'].default_value = rough
        me2 = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me2); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1); bm.to_mesh(me2); bm.free()
        o.scale = r; o.location = c; o.rotation_euler = (0, -roll * 3.14159 / 180, 0); me2.materials.append(m2); bpy.context.view_layer.update()
        w = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bone; o.matrix_world = w
        return o
    # Haarbüschel innen in den Ohren: flache helle Kegel vom Ohrgrund nach oben, am Ohrknochen (bewegen sich mit)
    def tuft(name, base, tip, r, bone, tip_r=.05, mat=None):
        base, tip = Vector(base), Vector(tip); d = tip - base
        me2 = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me2); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r * tip_r, depth=d.length); bmesh.ops.scale(bm, vec=(1, .35, 1), verts=bm.verts); bm.to_mesh(me2); bm.free()
        for f in me2.polygons: f.use_smooth = True
        o.location = base + d / 2; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        me2.materials.append(mat or tuft_mat); bpy.context.view_layer.update()
        w = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bone; o.matrix_world = w
        return o
    tufts = []
    tuft_mat = bpy.data.materials.new('Haar_' + kind); tuft_mat.use_nodes = True
    q = next(n for n in tuft_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); q.inputs['Base Color'].default_value = (*srgb(A['light']), 1); q.inputs['Roughness'].default_value = .9
    if not E.get('round'):
        ax_pt = lambda s, t, dy=0, dx=0: hp(s * (0.10 + E['spread'] * t) + s * dx, 0.01 + 0.02 * t - E['r'] * .55 * (1 - t * .85) * .85 + dy, 1.88 + E['h'] * t)
        for s, nm in ((1, 'ear_l'), (-1, 'ear_r')):
            for i, (dx, t0, t1, rr) in enumerate([(-0.038, -0.02, 0.50, 0.024), (0.0, 0.0, 0.62, 0.026), (0.036, -0.02, 0.46, 0.022), (-0.02, 0.06, 0.40, 0.018), (0.022, 0.06, 0.42, 0.018)]):
                tufts.append(tuft(f'EarTuft{nm[-1].upper()}{i}', ax_pt(s, t0, 0, dx), ax_pt(s, t1, -0.006, dx * .5), rr * hk, nm))
    iris = A.get('iris', '1d1714')
    # Mandelaugen wie beim Rotfuchs: breiter als hoch, außen schräg nach oben, dunkler Rand, schmale senkrechte Pupille.
    # Lider zeichnet das Spiel im Shader auf das Auge (creature/face.js), damit sie nie über den Augenrand ragen.
    extra = []
    for s, k in ((1, 'L'), (-1, 'R')):
        ex, ey, ez, sl_ = EY['x'] * s, EY['y'], EY['z'], EY['slant'] * s
        extra += [bead('EyeRim' + k, hp(ex, ey + 0.003, ez), (0.037, 0.011, 0.026), A['dark'], .5, roll=sl_),
                  bead('Eye' + k, hp(ex, ey, ez), (0.031, 0.012, 0.0205), iris, .3, roll=sl_),
                  bead('EyePupil' + k, hp(ex * .985, ey - 0.008, ez), (0.0075, 0.006, 0.016), '120c08', .2, roll=sl_ * .3),
]  # Brauen keine eigenen Teile mehr (wirkten aufgeklebt): heller Fleck im Fell, siehe Farben
    extra += [
             # Unterkiefer am Kieferknochen (öffnet sich im Spiel), dahinter der dunkle Mundraum am Kopf
             # Unterkiefer als Keil unter der Schnauze, vorn schmal; dazwischen der dunkle Mundraum, auf dem Kiefer die Zunge,
             # oben zwei kleine Eckzähne: geöffnet sieht man ein Maul statt eines Klotzes
             part('Jaw', hp(0, -0.10, JAW_Z - 0.026), hp(0, -0.10 - sl * .8, JAW_Z - 0.004), sr * .95 * hk, .42, .5, A['light'], .8, 'jaw'),
             part('Tongue', hp(0, -0.12, JAW_Z - 0.008), hp(0, -0.10 - sl * .74, JAW_Z + 0.004), sr * .55 * hk, .55, .3, 'c4636a', .5, 'jaw'),
             part('Mouth', hp(0, -0.11, JAW_Z - 0.012), hp(0, -0.10 - sl * .87, JAW_Z + 0.008), sr * .7 * hk, .35, .35, '3a1c1a', .7),
             *[part('Fang' + k, hp(sx * 0.02, -0.10 - sl * .8, JAW_Z + 0.014), hp(sx * 0.02, -0.10 - sl * .79, JAW_Z - 0.006), 0.0055 * hk, .1, 1, 'f2ede2', .3) for sx, k in ((1, 'L'), (-1, 'R'))],
             bead('Nose', hp(0, -0.10 - sl + 0.012, 1.695), (0.03 * hk, 0.026 * hk, 0.024 * hk), A['dark'], .5)]  # sitzt auf der Schnauzenspitze

    # 6. Animationen aus UAL1 und UAL2 als NLA-Spuren
    have = {a.name for a in bpy.data.actions}
    for f in (UAL1, UAL2):
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
        for o in [o for o in bpy.data.objects if o not in before]: bpy.data.objects.remove(o, do_unlink=True)
    ad = arm.animation_data or arm.animation_data_create(); ad.action = None
    posen(arm, body)
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    for nme in ANIMS:
        a = bpy.data.actions.get(nme)
        if not a: print('fehlt:', nme); continue
        t = ad.nla_tracks.new(); t.name = nme; s = t.strips.new(nme, int(a.frame_range[0]), a)
        if len(a.slots): s.action_slot = a.slots[0]
        t.mute = True

    # 7. Export: nur Skelett, Körper, Augen, Nase
    for s in bpy.data.scenes:
        for vl in s.view_layers:
            for o in s.objects:
                try: o.select_set(False, view_layer=vl)
                except Exception: pass
    for o in [arm, body, *extra, *tufts]: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    out = out or os.path.join(REPO, 'assets', 'models', 'animals', A['file'])
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
                              export_yup=True, export_vertex_color='MATERIAL', export_optimize_animation_size=True, export_attributes=True)
    body.data.calc_loop_triangles()
    print('fertig', out, os.path.getsize(out), 'Bytes,', len(body.data.loop_triangles), 'Dreiecke')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
build(globals().get('TM_KIND') or (argv[0] if argv else 'fox'), globals().get('TM_OUT'))
