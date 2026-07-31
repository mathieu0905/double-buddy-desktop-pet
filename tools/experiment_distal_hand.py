import bpy
import os

source = os.path.abspath('public/assets/3d/hunyuan3d21/white.glb')
output = os.path.abspath('.runtime/white-distal-hand.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.vertex_groups)
for name, side in (('bone_12', 1), ('bone_19', -1)):
    group = mesh.vertex_groups.get(name)
    if not group:
        continue
    for vertex in mesh.data.vertices:
        try:
            weight = group.weight(vertex.index)
        except RuntimeError:
            continue
        vertex.co.x += side * 0.32 * weight
        vertex.co.z += 0.25 * weight
        vertex.co.y -= 0.06 * weight
os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_skins=True, export_materials='EXPORT')
print(output)
