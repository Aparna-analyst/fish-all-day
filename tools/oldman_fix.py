# The old fisherman, put right in Blender and made ready for the web, in one pass:
#   his face and hands repainted from pictures redrawn by Aholo's image tool (tools/retouch.py lays them back on),
#   the lumps eased out of his hat and fingers (the lures on the hat are left alone),
#   slimmed to a triangle budget with every Lux3D move gathered onto the one skeleton and named.
# blender -b -P tools/oldman_fix.py -- <polish-dir> <out.glb> <tris> <tex_px> <moves-a.glb> <a1,...> [<moves-b.glb> <b1,...>]
import bpy, bmesh, colorsys, os, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import retouch as T

argv = sys.argv[sys.argv.index('--') + 1:]
pol, out, target, tex_px = argv[0], argv[1], int(argv[2]), int(argv[3])
pairs = [(argv[i], argv[i + 1].split(',')) for i in range(4, len(argv), 2)]
bpy.ops.wm.read_factory_settings(use_empty=True)

kept, arm, mesh = [], None, None
for k, (src, names) in enumerate(pairs):
    before_objs, before_acts = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=src)
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    acts = sorted([a for a in bpy.data.actions if a not in before_acts], key=lambda a: int(re.search(r'animation_(\d+)', a.name).group(1)))
    for a, n in zip(acts, names): a.name = n; a.use_fake_user = True; kept.append(a)
    if k == 0:
        arm = next(o for o in new_objs if o.type == 'ARMATURE')
        mesh = next(o for o in new_objs if o.type == 'MESH' and o.find_armature())
        for o in [o for o in new_objs if o.type == 'MESH' and o is not mesh]: bpy.data.objects.remove(o, do_unlink=True)
    else:
        for o in new_objs: bpy.data.objects.remove(o, do_unlink=True)
T.rest(arm)

def edit(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); return bm
def keep(o, bm):
    bm.to_mesh(o.data); bm.free(); o.data.update()

# weld the seams the importer split, so easing does not tear the surface
bm = edit(mesh); n0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); print('WELD', n0, '->', len(bm.verts)); keep(mesh, bm)

# the colour of the body's texture under each point, so the hat's lures can be told from the hat
img = next(n.image for n in mesh.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
W, H = img.size; px = np.empty(W * H * 4, 'f'); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
def colour(bm, v, uvl):
    u, w = v.link_loops[0][uvl].uv if v.link_loops else (0, 0)
    return px[min(H - 1, max(0, int(w * H))), min(W - 1, max(0, int(u * W))), :3]

bm = edit(mesh); mw = mesh.matrix_world; uvl = bm.loops.layers.uv.active
def hat(p): return p.z > 0.06 and abs(p.x) < 0.06
def hand(p): return abs(p.x) > 0.064
hat_v = []
for v in bm.verts:
    p = mw @ v.co
    if hat(p) and not v.is_boundary:
        h, s, val = colorsys.rgb_to_hsv(*colour(bm, v, uvl))
        if s < 0.62 and val < 0.85 and 0.09 < h < 0.3: hat_v.append(v)      # olive cloth, not the red and yellow lures
for _ in range(10): bmesh.ops.smooth_vert(bm, verts=hat_v, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
hand_v = [v for v in bm.verts if hand(mw @ v.co) and not v.is_boundary]
for _ in range(3): bmesh.ops.smooth_vert(bm, verts=hand_v, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
print('EASE hat', len(hat_v), 'points (10 passes), hands', len(hand_v), 'points (3 passes)')
keep(mesh, bm)

# the repaint: face first, then the backs and palms of both hands
for part in ('face', 'hand_l', 'hand_r', 'palm_l', 'palm_r'):
    after = os.path.join(pol, part + '-after.png')
    if os.path.exists(after):
        print('PAINT', T.project(mesh, part, T.VIEWS['oldman'][part], os.path.join(pol, part + '-before.png'), after, os.path.join(pol, part + '-texture.png')))

# slim: the face and hands keep their share because decimation is weighted by nothing but shape; keep the budget generous
tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
if tris > target:
    bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
    mod = mesh.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris; mesh.modifiers.move(len(mesh.modifiers) - 1, 0)
    bpy.ops.object.modifier_apply(modifier='dec')
bpy.ops.object.shade_smooth()
print('MESH', tris, '->', sum(len(p.vertices) - 2 for p in mesh.data.polygons), 'tris', len(mesh.data.materials), 'materials')
for im in bpy.data.images:
    if im.size[0] > tex_px: im.scale(tex_px, tex_px)

if arm.animation_data:
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(tr)
else:
    arm.animation_data_create()
for a in kept:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
for a in list(bpy.data.actions):
    if a not in kept: bpy.data.actions.remove(a)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_image_format='JPEG', export_jpeg_quality=88, export_apply=True, export_skins=True)
print('EXPORTED', out, round(os.path.getsize(out) / 1e6, 2), 'MB', len(kept), 'moves')
