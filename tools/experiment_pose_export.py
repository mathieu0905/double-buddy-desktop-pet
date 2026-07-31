import bpy
import os

source = os.path.abspath('public/assets/3d/hunyuan3d21/white.glb')
output = os.path.abspath('.runtime/white-pose-experiment.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
armature = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')

# The Hunyuan/UniRig files use generic chains.  The two arm chains start at
# bone_6 and bone_13; this is only a disposable experiment for choosing a
# sensible neutral pose before writing the batch repair tool.
for name, sign in (('bone_6', 1), ('bone_13', -1)):
    bone = armature.pose.bones.get(name)
    if not bone:
        continue
    bone.rotation_mode = 'XYZ'
    bone.rotation_euler[2] = sign * 0.9
    for child_name in (f'bone_{int(name.split("_")[1]) + 1}', f'bone_{int(name.split("_")[1]) + 2}'):
        child = armature.pose.bones.get(child_name)
        if child:
            child.rotation_mode = 'XYZ'
            child.rotation_euler[2] = -sign * 0.35

os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format='GLB',
    export_animations=False,
    export_skins=True,
    export_materials='EXPORT',
)
print(output)
