# Stills of the Lux3D props for review: blender -b -P tools/render_props.py -- <out dir> <glb...>
import bpy, sys, math, os
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]; out, files = args[0], args[1:]
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = 720; sc.render.film_transparent = False
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.93, 0.91, 0.87, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    bpy.ops.import_scene.gltf(filepath=f)
    obs = [o for o in sc.objects if o.type == 'MESH']
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in obs:
        for c in o.bound_box: p = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    ctr, size = (lo + hi) / 2, max(hi - lo)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.35
    d = Vector((math.sin(math.radians(35)), -math.cos(math.radians(35)), 0.55)).normalized()
    cam.location = ctr + d * size * 4; cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for rot, e in (((math.radians(50), 0, math.radians(30)), 3.5), ((math.radians(60), 0, math.radians(-120)), 1.2)):
        s = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); s.data.energy = e; s.rotation_euler = rot; sc.collection.objects.link(s)
    sc.render.filepath = os.path.join(out, os.path.basename(os.path.dirname(f)) + '.png'); bpy.ops.render.render(write_still=True)
    print('rendered', sc.render.filepath, 'size', [round(x, 3) for x in (hi - lo)])
