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
            'snout': (0.078, 0.30), 'ears': {'r': 0.088, 'h': 0.23, 'spread': 0.07}, 'tail': 'bushy', 'ruff': True, 'iris': 'c98a2a'},
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
TRIS = 7000

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
        'upperarm_l': [('x', -30)], 'upperarm_r': [('x', -30)], 'lowerarm_l': [('x', -50)], 'lowerarm_r': [('x', -50)],
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
    def on_ground():  # tiefsten Punkt des Körpers auf den Boden
        ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
        z = min((body.matrix_world @ v.co).z for v in me.vertices); ev.to_mesh_clear(); apply({}, {'pelvis': (0, 0, -z + 0.01)})
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
    def cone(base, tip, r, tip_r=.15):  # tip_r: Radius an der Spitze als Anteil (Ohren spitz, Schnauze stumpf)
        base, tip = Vector(base), Vector(tip); d = tip - base
        me = bpy.data.meshes.new('c'); o = bpy.data.objects.new('c', me); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * tip_r, depth=d.length); bm.to_mesh(me); bm.free()
        o.location = base + d / 2; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); parts.append(o)
    k = A.get('belly', 1.0)
    # Bauch endet über den Oberschenkeln, darunter ein schmales Becken: sonst wachsen Bauch und Beine zu einem Rock zusammen
    ellip((0, 0.01, 1.22), (0.21 * k, 0.18 * k, 0.26)); ellip((0, -0.01, 1.40), (0.20 * k, 0.16 * k, 0.14)); ellip((0, 0, 1.55), (0.09, 0.09, 0.08))  # Bauch, Brust, Hals
    ellip((0, 0.02, 0.99), (0.16 * k, 0.14 * k, 0.09))                                                                           # Becken
    hk, lk, gk = A.get('head', 1.0), A.get('limbs', 1.0), A.get('legs', 1.0)
    hp = lambda x, y, z: (x * hk, y * hk, 1.76 + (z - 1.76) * hk)   # Punkt am Kopf, mit der Kopfgröße skaliert
    ellip((0, 0.0, 1.76), (0.19 * hk, 0.17 * hk, 0.17 * hk)); ellip((0, -0.06, 1.70), (0.17 * hk, 0.12 * hk, 0.10 * hk))           # Kopf, Wangen
    sr, sl = A['snout']; cone(hp(0, -0.10, 1.715), hp(0, -0.10 - sl, 1.69), sr * hk, .42)                                      # Schnauze (Oberkiefer), stumpfes Ende
    cone(hp(0, -0.05, 1.70), hp(0, -0.10 - sl * .55, 1.69), sr * 1.5 * hk, .55)                                                # breiter Ansatz: Gesicht läuft dreieckig in die Schnauze
    if A.get('ruff'):                                                                                                           # Wangenfell, seitlich abstehend
        for s in (1, -1): ellip(hp(s * 0.125, -0.05, 1.665), (0.095 * hk, 0.08 * hk, 0.075 * hk), 20)
    cone(hp(0, -0.10, 1.655), hp(0, -0.10 - sl * .8, 1.648), sr * .62 * hk, .5)                                                # Unterkiefer: Maullinie dazwischen
    E = A['ears']
    for s in (1, -1):                                                                                                           # Ohren
        if E.get('round'): ellip(hp(s * 0.13, 0.02, 1.90), (E['round'] * hk, E['round'] * .6 * hk, E['round'] * hk), 20)
        else: cone(hp(s * 0.10, 0.01, 1.88), hp(s * (0.10 + E['spread']), 0.03, 1.88 + E['h']), E['r'] * hk)
    for s in ('l', 'r'):
        ua, la, hd = B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s]
        capsule(B['clavicle_' + s][1], ua[1], 0.065 * lk); capsule(la[0], la[1], 0.055 * lk)
        ellip(hd[0] + (hd[1] - hd[0]).normalized() * 0.06, (0.075 * lk, 0.06 * lk, 0.05 * lk))                                   # Pfote
        th, ca, ft = B['thigh_' + s], B['calf_' + s], B['foot_' + s]
        ofs = Vector((0.02 if s == 'l' else -0.02, 0, 0))   # Beine leicht nach außen, damit innen eine Lücke bleibt
        capsule(th[0] + ofs + Vector((0, 0, -0.02)), th[1] + ofs * .5, 0.082 * gk); capsule(ca[0] + ofs * .5, ca[1] + Vector((0, 0, 0.03)), 0.068 * gk)
        ellip(ft[0] + Vector((0, -0.07, -0.05)), (0.075 * gk, 0.13 * gk, 0.055 * gk))                                                           # Fuß
    for x, y, z, r in TAILS[A['tail']]: ellip((x, y, z), (r * .9, r, r), 20)

    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active; body.name = 'TMBody'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    r = body.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.018; bpy.ops.object.modifier_apply(modifier='rm')
    sm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); sm.iterations = 8; sm.use_only_smooth = True; bpy.ops.object.modifier_apply(modifier='sm')
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
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # 4. Farben als Vertexfarben mit weichen Übergängen (Masken in der T-Pose)
    FUR, LIGHT, DARK = srgb(A['fur']), srgb(A['light']), srgb(A['dark'])
    me = body.data; ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    for v in me.vertices:
        x, y, z = v.co; ax = abs(x)
        belly = smooth(1.15, .8, (x / .135) ** 2 + ((z - 1.22) / .27) ** 2) * smooth(-0.03, -0.11, y)
        muzzle = smooth(-0.12, -0.17, y) * smooth(1.70, 1.675, z) * smooth(1.58, 1.62, z)          # Unterseite der Schnauze, oben bleibt Fell
        cheek = smooth(1.0, .55, ((ax - .13) / .1) ** 2 + ((y + .07) / .1) ** 2 + ((z - 1.655) / .07) ** 2)  # Wangenfell
        throat = smooth(1.0, .6, (x / .11) ** 2 + ((z - 1.56) / .12) ** 2) * smooth(-0.0, -0.07, y)     # Kehle bis zum Unterkiefer
        tip = smooth(.6, .68, y) * smooth(.92, 1.0, z) if A['tail'] == 'bushy' else 0
        light = max(belly, muzzle, cheek, throat, tip)
        dark = max(smooth(.53, .58, ax) * smooth(1.25, 1.35, z), smooth(.2, .12, z), smooth(1.975, 2.03, z))
        c = [FUR[i] * (1 - light) + LIGHT[i] * light for i in range(3)]
        c = [c[i] * (1 - dark) + DARK[i] * dark for i in range(3)]
        ca.data[v.index].color = (*c, 1)
    mat = bpy.data.materials.new('Fell_' + kind); mat.use_nodes = True; nt = mat.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); p.inputs['Roughness'].default_value = .85
    cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], p.inputs['Base Color'])
    me.materials.clear(); me.materials.append(mat)

    # 5. Augen und Nase am Kopfknochen
    def bead(name, c, r, rgb, rough):
        m2 = bpy.data.materials.new(name); m2.use_nodes = True
        q = next(n for n in m2.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); q.inputs['Base Color'].default_value = (*srgb(rgb), 1); q.inputs['Roughness'].default_value = rough
        me2 = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me2); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1); bm.to_mesh(me2); bm.free()
        o.scale = r; o.location = c; me2.materials.append(m2); bpy.context.view_layer.update()
        w = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = 'Head'; o.matrix_world = w
        return o
    # Augen flach in die Kopfform gesetzt (nicht vorstehend), leicht mandelförmig; zum Schlafen skaliert das Spiel sie flach (Lider)
    iris = A.get('iris', '1d1714')
    extra = [bead('EyeL', hp(0.072, -0.148, 1.79), (0.026, 0.012, 0.032), iris, .3), bead('EyeR', hp(-0.072, -0.148, 1.79), (0.026, 0.012, 0.032), iris, .3),
             bead('EyePupilL', hp(0.071, -0.156, 1.79), (0.011, 0.006, 0.02), '120c08', .2), bead('EyePupilR', hp(-0.071, -0.156, 1.79), (0.011, 0.006, 0.02), '120c08', .2),
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
    for o in [arm, body, *extra]: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    out = out or os.path.join(REPO, 'assets', 'models', 'animals', A['file'])
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
                              export_yup=True, export_vertex_color='MATERIAL', export_optimize_animation_size=True)
    body.data.calc_loop_triangles()
    print('fertig', out, os.path.getsize(out), 'Bytes,', len(body.data.loop_triangles), 'Dreiecke')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
build(globals().get('TM_KIND') or (argv[0] if argv else 'fox'), globals().get('TM_OUT'))
