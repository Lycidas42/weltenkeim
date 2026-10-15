# Bereitet Figuren aus dem KayKit Adventurers Pack (Kay Lousberg, CC0) für Weltenkeim auf: Zubehör an den Händen
# entfernen, nur benötigte Animationen behalten, als GLB nach assets/models/animals/ exportieren. Siehe docs/kreatur-modelle.md 4.2.
# Quelle der GLBs: github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (Characters/gltf), lokal in dev/assets-raw/kaykit/.
#
# Aufruf in Blender: exec(open(p, encoding='utf-8').read(), {'__file__': p, 'KK_NAMES': ['Barbarian', 'Rogue', 'Knight']})

import bpy, os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(REPO, 'dev', 'assets-raw', 'kaykit')
# Zubehör (hängt an handslot.l/.r) – wird nicht exportiert
DROP = ('1H_', '2H_', 'Spellbook', 'Knife', 'Throwable', 'Mug', 'Shield', 'Badge_Shield', 'Icosphere')
ANIMS = ['Idle', 'Unarmed_Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Chop', 'PickUp', 'Interact', 'Use_Item', 'Hit_A', 'Hit_B',
         'Spellcast_Shoot', 'Cheer', 'Lie_Down', 'Lie_Idle', 'Lie_StandUp', 'Throw', 'Sit_Floor_Down', 'Sit_Floor_Idle', 'Sit_Floor_StandUp']

def prep(name):
    sc = bpy.data.scenes.get('KayKit') or bpy.data.scenes.new('KayKit'); bpy.context.window.scene = sc
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    objs = list(sc.objects); arm = next(o for o in objs if o.type == 'ARMATURE')
    keep = [o for o in objs if o.type == 'ARMATURE' or (o.type == 'MESH' and not any(d in o.name for d in DROP)) or o.type == 'EMPTY']
    ad = arm.animation_data
    for t in list(ad.nla_tracks):
        if t.name not in ANIMS: ad.nla_tracks.remove(t)
        else: t.mute = True
    ad.action = None
    for s in bpy.data.scenes:
        for vl in s.view_layers:
            for o in s.objects:
                try: o.select_set(False, view_layer=vl)
                except Exception: pass
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    out = os.path.join(REPO, 'assets', 'models', 'animals', name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_skins=True, export_yup=True, export_optimize_animation_size=True)
    print(name, [o.name for o in keep if o.type == 'MESH'], os.path.getsize(out), 'Bytes')

for n in globals().get('KK_NAMES') or ['Mage']: prep(n)
