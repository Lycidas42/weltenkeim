# Baut die Gotteshand (assets/models/hand/GodHand.glb) in Blender 5.2 komplett neu auf.
# Aufruf in Blender: exec(open(r'<Pfad>/build_godhand.py', encoding='utf-8').read())
# Koordinaten (Blender): Finger zeigen nach +Y, Handfläche nach -Z, Daumen nach +X, Handteller-Mitte im Ursprung.
import bpy, bmesh, os
from mathutils import Vector, Matrix

REPO = r'C:\Entwicklung\Git\weltenkeim'
P = dict(
    F=1.3,              # Dicke der Finger (Faktor auf die Radien; sichtbar sind etwa 87 % davon)
    palm=0.5,           # Handteller
    palmY=-0.06, palmSY=0.76,  # Mitte und Länge des Handtellers
    wrist=0.22, forearm=0.24,
    voxel=0.021,
)
FINGERS = {  # Ansatz, Richtung, Gliedlängen, Radien
    'Index':  (Vector(( 0.225, 0.17, 0.0)),  Vector(( 0.16, 1, 0)), (0.21, 0.145, 0.115), (0.060, 0.055, 0.049)),
    'Middle': (Vector(( 0.076, 0.2, 0.0)), Vector(( 0.05, 1, 0)), (0.23, 0.16, 0.125), (0.062, 0.057, 0.050)),
    'Ring':   (Vector((-0.076, 0.185, 0.0)), Vector((-0.06, 1, 0)), (0.215, 0.15, 0.115), (0.059, 0.054, 0.048)),
    'Pinky':  (Vector((-0.215, 0.14, -0.005)), Vector((-0.2, 1, 0)), (0.165, 0.115, 0.095), (0.052, 0.048, 0.043)),
    'Thumb':  (Vector(( 0.24, -0.11, -0.03)), Vector(( 0.78, 0.6, -0.2)), (0.19, 0.16), (0.076, 0.066)),
}
WRIST, ELBOW = Vector((0, -0.34, 0.02)), Vector((0, -0.92, 0.36))
THUMB_UP = Vector((0.75, -0.25, 0.65))

sc = bpy.data.scenes.get('GodHand') or bpy.data.scenes.new('GodHand')
bpy.context.window.scene = sc
for o in list(sc.objects):
    if o.type in ('META', 'MESH', 'ARMATURE'): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.metaballs): bpy.data.metaballs.remove(m)

# --- Form aus Metaballs. Jeder Finger ist eine eigene Metaball-Gruppe (eigener Objektname): Gruppen verschmelzen
# nicht miteinander, also entsteht keine Haut zwischen den Fingern. Erst das Voxel-Remesh vereint alles dort,
# wo es sich wirklich überlappt (Knöchel am Handteller).
def group(name):
    mb = bpy.data.metaballs.new(name); mb.resolution = 0.014; mb.render_resolution = 0.014; mb.threshold = 0.6
    o = bpy.data.objects.new(name, mb); sc.collection.objects.link(o); return o
def ball(mb, pos, r, typ='BALL', size=None, rot=None, stiff=2.0):
    e = mb.elements.new(); e.type = typ; e.co = pos; e.radius = r; e.stiffness = stiff
    if size: e.size_x, e.size_y, e.size_z = size
    if rot: e.rotation = rot
def capsule(mb, a, b, r, stiff=2.4):
    ball(mb, (a + b) / 2, r, 'CAPSULE', ((b - a).length / 2, 1, 1), rot=Vector((1, 0, 0)).rotation_difference(b - a), stiff=stiff)
groups = [group('HandMB')]; core = groups[0].data
ball(core, Vector((0, P['palmY'], 0)), P['palm'], 'ELLIPSOID', (0.92, P['palmSY'], 0.34), stiff=2.2)
ball(core, Vector((0.18, -0.14, -0.035)), 0.25, 'ELLIPSOID', (0.8, 1.0, 0.6), stiff=1.6)
capsule(core, Vector((0, -0.24, 0.0)), WRIST, P['wrist'], stiff=2.0); capsule(core, WRIST, ELBOW, P['forearm'], stiff=2.2)
J = {}
order = ['Index', 'Middle', 'Ring', 'Pinky']
for name, (base, d, lens, rads) in FINGERS.items():
    # der Daumen gehört zum Handteller (weicher Übergang zum Ballen), die übrigen Finger sind eigene Gruppen
    mb = core if name == 'Thumb' else (groups.append(group('Finger' + name)) or groups[-1].data)
    d = d.normalized(); p = base.copy(); pts = [p.copy()]
    for L in lens: p = p + d * L; pts.append(p.copy())
    J[name] = pts
    for i in range(len(lens)): capsule(mb, pts[i], pts[i + 1], rads[i] * P['F'])
    ball(mb, pts[0] - d * 0.04, rads[0] * P['F'] * 1.05, 'BALL', stiff=2.0)  # Knöchel, reicht in den Handteller
    ball(mb, pts[-1] - d * 0.012, rads[-1] * P['F'] * 0.98, 'BALL', stiff=2.4)
bpy.context.view_layer.update()

# --- Mesh: Gruppen umwandeln, zusammenfügen, per Voxel-Remesh vereinen
for o in sc.objects: o.select_set(False)
for g in groups: g.select_set(True)
bpy.context.view_layer.objects.active = groups[0]
bpy.ops.object.convert(target='MESH')
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in sc.objects: o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join()
hand = bpy.context.view_layer.objects.active; hand.name = 'GodHand'; hand.data.name = 'GodHand'
hand.data.remesh_voxel_size = P['voxel']; hand.data.use_remesh_fix_poles = True; hand.data.use_remesh_preserve_volume = True
bpy.ops.object.voxel_remesh()
sm = hand.modifiers.new('Glatt', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 4
bpy.ops.object.modifier_apply(modifier='Glatt')
# lose Splitter entfernen, die die Aussparungen übrig lassen können (nur das größte Stück bleibt)
bm = bmesh.new(); bm.from_mesh(hand.data); bm.verts.ensure_lookup_table(); seen, islands = set(), []
for v in bm.verts:
    if v.index in seen: continue
    isl, st = [], [v]
    while st:
        x = st.pop()
        if x.index in seen: continue
        seen.add(x.index); isl.append(x); st.extend(e.other_vert(x) for e in x.link_edges)
    islands.append(isl)
islands.sort(key=len, reverse=True)
small = [isl for isl in islands[1:] if len(isl) < 0.03 * len(bm.verts)]
for isl in small: bmesh.ops.delete(bm, geom=isl, context='VERTS')
print('Splitter entfernt:', len(small), '| getrennte große Teile (Fehler!):', len(islands) - 1 - len(small))
bm.to_mesh(hand.data); bm.free()
for p in hand.data.polygons: p.use_smooth = True

# --- Skelett (Beugen um lokale X-Achse, negativ = zur Handfläche)
arm = bpy.data.armatures.new('HandRig'); ao = bpy.data.objects.new('HandRig', arm); sc.collection.objects.link(ao)
for o in sc.objects: o.select_set(False)
bpy.context.view_layer.objects.active = ao; ao.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); eb = arm.edit_bones
def bone(name, head, tail, parent=None, up=Vector((0, 0, 1))):
    b = eb.new(name); b.head = head; b.tail = tail
    if parent: b.parent = eb[parent]
    b.align_roll(up); return b
bone('Wrist', ELBOW, WRIST); bone('Hand', WRIST, Vector((0, 0.08, 0)), 'Wrist')
for f in order:
    p = J[f]; bone(f + '1', p[0], p[1], 'Hand'); bone(f + '2', p[1], p[2], f + '1'); bone(f + '3', p[2], p[3], f + '2')
p = J['Thumb']
bone('Thumb0', Vector((0.06, -0.26, -0.02)), p[0], 'Hand', THUMB_UP); bone('Thumb1', p[0], p[1], 'Thumb0', THUMB_UP); bone('Thumb2', p[1], p[2], 'Thumb1', THUMB_UP)
for b in eb:
    if b.parent and (b.head - b.parent.tail).length < 1e-4: b.use_connect = True
bpy.ops.object.mode_set(mode='OBJECT')
for o in sc.objects: o.select_set(False)
hand.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# --- Materialien (Namen werden im Spiel für die Gestaltung genutzt)
def mat(name, col, rough, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = col; bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = col; return m
M = [mat('Skin', (0.93, 0.70, 0.55, 1), 0.55), mat('Nails', (0.97, 0.86, 0.82, 1), 0.3), mat('Sleeve', (0.20, 0.30, 0.52, 1), 0.8),
     mat('Trim', (0.86, 0.66, 0.26, 1), 0.35, 0.6), mat('SleeveIn', (0.03, 0.04, 0.07, 1), 1)]
hand.data.materials.clear()
for m in M: hand.data.materials.append(m)
inv = hand.matrix_world.inverted(); parts = []
def add_part(name, bm, mi, group):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    for m in M: o.data.materials.append(m)
    for poly in me.polygons: poly.use_smooth = mi != 4; poly.material_index = mi
    vg = o.vertex_groups.new(name=group); vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE'); parts.append(o)

# --- Nägel auf dem letzten Glied
W = {'Thumb': 0.09, 'Index': 0.074, 'Middle': 0.076, 'Ring': 0.072, 'Pinky': 0.064}
for f, pts in J.items():
    d = (pts[-1] - pts[-2]).normalized()
    upv = THUMB_UP.copy() if f == 'Thumb' else Vector((0, 0, 1)); upv = (upv - d * upv.dot(d)).normalized()
    q = pts[-1] - d * 0.06
    ok, loc, nor, idx = hand.ray_cast(inv @ (q + upv * 0.5), inv.to_3x3() @ (-upv))
    if not ok: print('kein Treffer für Nagel', f); continue
    loc = hand.matrix_world @ loc; side = d.cross(upv).normalized()
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc - upv * 0.006 + d * 0.004) @ Matrix((side, d, upv)).transposed().to_4x4() @ Matrix.Diagonal((W[f] / 2, 0.095 / 2, 0.016, 1)), verts=bm.verts)
    add_part('Nail_' + f, bm, 1, f + ('2' if f == 'Thumb' else '3'))

# --- Ärmel mit Saum
ax = (ELBOW - WRIST).normalized(); c = ELBOW - ax * 0.12; side = ax.cross(Vector((0, 0, 1))).normalized()
ok, loc, nor, idx = hand.ray_cast(inv @ (c + side * 1.0), inv.to_3x3() @ (-side)); r = ((hand.matrix_world @ loc) - c).length if ok else 0.15
rot = Vector((0, 0, 1)).rotation_difference(ax).to_matrix().to_4x4(); mid = ELBOW - ax * 0.06
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=r * 1.12, radius2=r * 1.32, depth=0.34)
bmesh.ops.transform(bm, matrix=Matrix.Translation(mid) @ rot, verts=bm.verts); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.035); add_part('Sleeve', bm, 2, 'Wrist')
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=32, radius1=r * 1.16, radius2=r * 1.16, depth=0.05)
bmesh.ops.transform(bm, matrix=Matrix.Translation(mid - ax * 0.165) @ rot, verts=bm.verts)
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.03); add_part('Trim', bm, 3, 'Wrist')
for o in sc.objects: o.select_set(False)
for o in parts: o.select_set(True)
hand.select_set(True); bpy.context.view_layer.objects.active = hand; bpy.ops.object.join()

# --- Unterarm im Ärmel abschneiden, dunkle Scheibe an die Schnittstelle
bm = bmesh.new(); bm.from_mesh(hand.data); cut = ELBOW - ax * 0.07
kill = [f for f in bm.faces if f.material_index == 0 and all((v.co - cut).dot(ax) > 0 for v in f.verts)]
bmesh.ops.delete(bm, geom=kill, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
ret = bmesh.ops.create_circle(bm, cap_ends=True, segments=28, radius=r * 1.28)
bmesh.ops.transform(bm, matrix=Matrix.Translation(cut + ax * 0.005) @ rot, verts=ret['verts'])
deform = bm.verts.layers.deform.verify(); gi = hand.vertex_groups['Wrist'].index
for f in bm.faces:
    if all(v in ret['verts'] for v in f.verts): f.material_index = 4; f.smooth = False
for v in ret['verts']: v[deform][gi] = 1.0
bm.normal_update(); bm.to_mesh(hand.data); bm.free()
for m in list(bpy.data.meshes):
    if m.users == 0: bpy.data.meshes.remove(m)

# --- Export (nur Hand und Skelett dieser Szene)
for s in bpy.data.scenes:
    for o in s.objects:
        for vl in s.view_layers:
            try: o.select_set(False, view_layer=vl)
            except Exception: pass
hand.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
out = os.path.join(REPO, 'assets', 'models', 'hand', 'GodHand.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, use_active_scene=True, export_animations=False, export_skins=True,
    export_yup=True, export_normals=True, export_texcoords=False, export_vertex_color='NONE', export_extras=False)
unw = sum(1 for v in hand.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('GodHand gebaut: tris', sum(len(q.vertices) - 2 for q in hand.data.polygons), 'ohne Gewicht', unw, 'Datei', os.path.getsize(out))
