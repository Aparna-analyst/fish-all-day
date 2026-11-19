# blender -b -P tools/measure.py -- <rigged.glb> : where his parts are, in Blender's space (Z up, he faces -Y)
import bpy, sys
from mathutils import Vector
src = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.context.view_layer.update()
m = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature())
P = [m.matrix_world @ v.co for v in m.data.vertices]
lo = Vector((min(p.x for p in P), min(p.y for p in P), min(p.z for p in P))); hi = Vector((max(p.x for p in P), max(p.y for p in P), max(p.z for p in P)))
print('MESH', m.name, len(m.data.vertices), 'verts', len(m.data.polygons), 'faces', 'min', [round(x, 3) for x in lo], 'max', [round(x, 3) for x in hi], 'mats', [s.name for s in m.data.materials])
for b in arm.data.bones:
    n = b.name.split(':')[-1]
    if any(k in n for k in ('Hips', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightHand', 'LeftHandMiddle1', 'LeftHandThumb1')) and 'End' not in n or n == 'HeadTop_End':
        print('BONE', b.name, [round(x, 3) for x in (arm.matrix_world @ b.head_local)])
print('BONES', len(arm.data.bones), [b.name for b in arm.data.bones][:6])
