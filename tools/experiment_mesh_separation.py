import bpy
import os

source = os.path.abspath('public/assets/3d/hunyuan3d21/white.glb')
output = os.path.abspath('.runtime/white-mesh-experiment.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
armature = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.vertex_groups)

for prefix, side in ((6, 1), (13, -1)):
    names = [f'bone_{prefix + i}' for i in range(3, 7) if armature.pose.bones.get(f'bone_{prefix + i}')]
    groups = {name: mesh.vertex_groups.get(name) for name in names}
    for vertex in mesh.data.vertices:
        weight = 0.0
        for group in groups.values():
            if group:
                try:
                    weight += group.weight(vertex.index)
                except RuntimeError:
                    pass
        weight = min(1.0, weight)
        if weight:
            vertex.co.x += side * 0.18 * weight
            vertex.co.z += 0.15 * weight
            vertex.co.y -= 0.04 * weight

os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_skins=True, export_materials='EXPORT')
print(output)
