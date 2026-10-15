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
            'snout': (0.085, 0.23), 'ears': {'r': 0.075, 'h': 0.20, 'spread': 0.06}, 'tail': 'bushy'},
    # weitere Arten hier ergänzen, z. B. Bär (kurze runde Ohren, kurzer Schwanz), Hase (lange Ohren), Waschbär (Maske)
}
# Animationen im GLB (Namen wie in der Bibliothek); Zuordnung zu den Spielzuständen steht im Theme (anims)
ANIMS = ['Idle_Loop', 'Idle_FoldArms_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Walk_Carry_Loop', 'TreeChopping_Loop', 'PickUp_Table',
         'Hit_Chest', 'Spell_Simple_Shoot', 'Yes', 'Idle_No_Loop', 'LayToIdle',
         'Farm_Harvest', 'Farm_PlantSeed', 'Farm_Watering', 'Interact', 'OverhandThrow']
TRIS = 7000

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92) if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

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
    def cone(base, tip, r):
        base, tip = Vector(base), Vector(tip); d = tip - base
        me = bpy.data.meshes.new('c'); o = bpy.data.objects.new('c', me); sc.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * .15, depth=d.length); bm.to_mesh(me); bm.free()
        o.location = base + d / 2; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); parts.append(o)
    ellip((0, 0.01, 1.18), (0.21, 0.18, 0.30)); ellip((0, -0.01, 1.40), (0.20, 0.16, 0.14)); ellip((0, 0, 1.55), (0.09, 0.09, 0.08))  # Bauch, Brust, Hals
    ellip((0, 0.0, 1.76), (0.19, 0.17, 0.17)); ellip((0, -0.06, 1.70), (0.17, 0.12, 0.10))                                        # Kopf, Wangen
    sr, sl = A['snout']; cone((0, -0.10, 1.71), (0, -0.10 - sl, 1.69), sr)                                                       # Schnauze
    E = A['ears']
    for s in (1, -1): cone((s * 0.10, 0.01, 1.88), (s * (0.10 + E['spread']), 0.03, 1.88 + E['h']), E['r'])                     # Ohren
    for s in ('l', 'r'):
        ua, la, hd = B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s]
        capsule(B['clavicle_' + s][1], ua[1], 0.065); capsule(la[0], la[1], 0.055)
        ellip(hd[0] + (hd[1] - hd[0]).normalized() * 0.06, (0.075, 0.06, 0.05))                                                 # Pfote
        th, ca, ft = B['thigh_' + s], B['calf_' + s], B['foot_' + s]
        capsule(th[0] + Vector((0, 0, -0.04)), th[1], 0.095); capsule(ca[0], ca[1] + Vector((0, 0, 0.03)), 0.072)
        ellip(ft[0] + Vector((0, -0.07, -0.05)), (0.075, 0.13, 0.055))                                                           # Fuß
    TAIL = [(0, 0.17, 0.98, .07), (0, 0.27, 0.90, .10), (0, 0.38, 0.86, .13), (0, 0.50, 0.88, .15), (0, 0.61, 0.95, .14), (0, 0.69, 1.05, .11), (0, 0.73, 1.15, .07)]
    for x, y, z, r in TAIL: ellip((x, y, z), (r * .9, r, r), 20)

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
        muzzle = smooth(-0.13, -0.2, y) * smooth(1.765, 1.7, z) * smooth(1.58, 1.63, z)
        cheek = smooth(1.0, .6, ((ax - .1) / .07) ** 2 + ((y + .12) / .07) ** 2 + ((z - 1.69) / .06) ** 2)
        tip = smooth(.6, .68, y) * smooth(.92, 1.0, z)
        light = max(belly, muzzle, cheek, tip)
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
    extra = [bead('EyeL', (0.075, -0.155, 1.80), (0.03, 0.02, 0.038), '1d1714', .25), bead('EyeR', (-0.075, -0.155, 1.80), (0.03, 0.02, 0.038), '1d1714', .25),
             bead('Nose', (0, -0.10 - sl - 0.005, 1.70), (0.035, 0.03, 0.028), A['dark'], .5)]

    # 6. Animationen aus UAL1 und UAL2 als NLA-Spuren
    have = {a.name for a in bpy.data.actions}
    for f in (UAL1, UAL2):
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
        for o in [o for o in bpy.data.objects if o not in before]: bpy.data.objects.remove(o, do_unlink=True)
    ad = arm.animation_data or arm.animation_data_create(); ad.action = None
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
