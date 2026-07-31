import bpy
import os

source = os.path.abspath('public/assets/3d/hunyuan3d21/white.glb')
output = os.path.abspath('.runtime/white-arm-debug.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.vertex_groups)
for material in list(mesh.data.materials):
    mesh.data.materials.pop(index=0)
for color in ((0.8, 0.05, 0.03, 1), (0.05, 0.1, 0.8, 1), (0.05, 0.7, 0.1, 1)):
    material = bpy.data.materials.new('debug')
    material.diffuse_color = color
    mesh.data.materials.append(material)
for poly in mesh.data.polygons:
    scores = [0.0] * len(mesh.vertex_groups)
    for vertex_index in poly.vertices:
        for group in mesh.data.vertices[vertex_index].groups:
            scores[group.group] += group.weight
    dominant = max(range(len(scores)), key=scores.__getitem__)
    name = mesh.vertex_groups[dominant].name
    arm = int(name.split('_')[1]) in {6,7,8,9,10,11,12,13,14,15,16,17,18,19}
    poly.material_index = 0 if arm else 2
os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_skins=True, export_materials='EXPORT')
print(output)
