# Slims the Lux3D props for the desk app and sizes them to his world (metres, Y up in three.js, Z up here in Blender).
#   blender -b -P tools/slim_props.py
# chair: seat at 0.23 m (what his sitting move was made on), floor at 0, faces glTF -Z like the old drawn chair
# cooler: long side 0.48 m along glTF Z, floor at 0 · can: 0.15 m tall, centred · fish: 0.30 m long, centred, nose +X
import bpy, bmesh, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
JOBS = [  # name, faces kept, texture px
    ('chair', 7000, 1024), ('cooler', 3500, 512), ('can', 1600, 512), ('fish', 3000, 512)]

def bounds(ob):
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(p[i] for p in pts) for i in range(3))); hi = Vector((max(p[i] for p in pts) for i in range(3))); return lo, hi

for name, faces, px in JOBS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f'{ROOT}/models/prop-{name}/model.glb')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o != ob: bpy.data.objects.remove(o)
    before = len(ob.data.polygons)
    lo, hi = bounds(ob); size = hi - lo; ctr = (lo + hi) / 2
    # Blender here: X right, Y back (glTF -Z), Z up
    if name == 'chair':
        bm = bmesh.new(); bm.from_mesh(ob.data); tree = BVHTree.FromBMesh(bm)
        hits = []
        for fy in (-0.15, 0.0, 0.1):                      # a few points across the seat, front to middle
            hit = tree.ray_cast(Vector((ctr.x, ctr.y + fy * size.y, hi.z + 1)), Vector((0, 0, -1)))
            if hit[0]: hits.append((fy, round(hit[0].z - lo.z, 4)))
        bm.free()
        print('chair seat hits (offset, height above floor):', hits)
        seat = min(h for _, h in hits if h > 0.05 * size.z)   # the cloth, not the floor between the legs
        s = 0.23 / seat
    elif name == 'cooler': s = 0.48 / max(size.x, size.y)
    elif name == 'can': s = 0.15 / size.z
    else: s = 0.30 / max(size.x, size.y)
    # to the origin: floor at 0 for chair/cooler, centred for can/fish
    ob.data.transform(Matrix.Translation(Vector((-ctr.x, -ctr.y, -(lo.z if name in ('chair', 'cooler') else ctr.z)))))
    ob.data.transform(Matrix.Scale(s, 4))
    if name == 'cooler' and size.x > size.y: ob.data.transform(Matrix.Rotation(math.pi / 2, 4, 'Z'))   # long side front to back
    # decimate
    m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = min(1, faces / before); bpy.ops.object.modifier_apply(modifier='d')
    # textures down to px
    for img in bpy.data.images:
        if img.size[0] > px: img.scale(px, px)
    lo2, hi2 = bounds(ob)
    out = f'{ROOT}/web/public/assets/props/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_image_format='JPEG', export_jpeg_quality=82,
                              export_apply=True, export_animations=False, export_yup=True)
    print(f'{name}: faces {before} -> {len(ob.data.polygons)}, scale {s:.3f}, size m {[round(x, 3) for x in (hi2 - lo2)]}, {os.path.getsize(out) / 1e6:.2f} MB')
