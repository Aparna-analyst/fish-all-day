# Make the web character from Lux3D's rigged model and its move files (each file holds the mesh, the skeleton and
# up to ten moves): weld, slim to a triangle budget, shrink the textures, gather every move onto one skeleton, name them.
# blender -b -P tools/build_character.py -- <out.glb> <target_tris> <tex_px> <moves-a.glb> <a1,a2,...> [<moves-b.glb> <b1,b2,...>]
# In each file the moves come back as animation_1..N in the order they were asked for.
import bpy, sys, os, re

argv = sys.argv[sys.argv.index('--') + 1:]
out, target, tex_px = argv[0], int(argv[1]), int(argv[2])
pairs = [(argv[i], argv[i + 1].split(',')) for i in range(3, len(argv), 2)]
bpy.ops.wm.read_factory_settings(use_empty=True)

kept, arm, meshes = [], None, []
for k, (src, names) in enumerate(pairs):
    before_objs, before_acts = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=src)
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    acts = sorted([a for a in bpy.data.actions if a not in before_acts], key=lambda a: int(re.search(r'animation_(\d+)', a.name).group(1)))
    for a, n in zip(acts, names):
        a.name = n; a.use_fake_user = True; kept.append(a)
        print('ACTION', n, round((a.frame_range[1] - a.frame_range[0]) / bpy.context.scene.render.fps, 2), 's')
    if k == 0:
        arm = next(o for o in new_objs if o.type == 'ARMATURE')
        meshes = [o for o in new_objs if o.type == 'MESH' and o.find_armature()]
        for o in [o for o in new_objs if o.type == 'MESH' and o not in meshes]:
            bpy.data.objects.remove(o, do_unlink=True)      # the importer's own bone markers
    else:
        for o in new_objs:                                  # only the moves are wanted from the later files
            bpy.data.objects.remove(o, do_unlink=True)

for m in meshes:
    bpy.ops.object.select_all(action='DESELECT'); m.select_set(True); bpy.context.view_layer.objects.active = m
    before = sum(len(p.vertices) - 2 for p in m.data.polygons)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)              # the importer splits the surface along texture seams: weld first
    bpy.ops.object.mode_set(mode='OBJECT')
    tris = sum(len(p.vertices) - 2 for p in m.data.polygons)
    if tris > target:
        mod = m.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris
        m.modifiers.move(len(m.modifiers) - 1, 0)
        bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.shade_smooth()
    print('MESH', m.name, before, '->', sum(len(p.vertices) - 2 for p in m.data.polygons), 'tris')

for img in bpy.data.images:
    if img.size[0] > tex_px:
        img.scale(tex_px, tex_px)

# every move on its own track of the one skeleton, so the exporter writes each as its own clip
if arm.animation_data:
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
else:
    arm.animation_data_create()
for a in kept:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name
    tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
for a in list(bpy.data.actions):
    if a not in kept:
        bpy.data.actions.remove(a)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_image_format='JPEG', export_jpeg_quality=85, export_apply=True, export_skins=True)
print('EXPORTED', out, round(os.path.getsize(out) / 1e6, 2), 'MB', len(kept), 'moves')
