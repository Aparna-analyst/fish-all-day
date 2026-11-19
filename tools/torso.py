# blender -b -P tools/torso.py -- <rigged.glb> : how wide and deep his body is at each height (arms left out), in Blender space
import bpy, sys
src = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.context.view_layer.update()
m = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature())
P = [m.matrix_world @ v.co for v in m.data.vertices]
for z0 in [i * 0.008 for i in range(-8, 11)]:
    S = [p for p in P if z0 <= p.z < z0 + 0.008 and abs(p.x) < 0.052]
    if S: print('SLICE z %.3f  x %.3f..%.3f  y(front) %.3f..%.3f  n %d' % (z0, min(p.x for p in S), max(p.x for p in S), min(p.y for p in S), max(p.y for p in S), len(S)))
for n in ('Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm'):
    b = arm.data.bones['mixamorig:' + n]; print('BONE', n, [round(x, 4) for x in arm.matrix_world @ b.head_local], [round(x, 4) for x in arm.matrix_world @ b.tail_local])
