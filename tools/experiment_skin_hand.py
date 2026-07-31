import bpy
import os

source = os.path.abspath('public/assets/3d/hunyuan3d21/white.glb')
output = os.path.abspath('.runtime/white-skin-hand.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.vertex_groups)
uv = mesh.data.uv_layers.active.data
base = next(link.from_node.image for link in mesh.data.materials[0].node_tree.links if link.to_socket.name == 'Base Color')
base_width, base_height = base.size
vertex_uv = [[] for _ in mesh.data.vertices]
for loop in mesh.data.loops:
    vertex_uv[loop.vertex_index].append(uv[loop.index].uv)
count = 0
for vertex in mesh.data.vertices:
    if not vertex_uv[vertex.index]:
        continue
    u = sum(value.x for value in vertex_uv[vertex.index]) / len(vertex_uv[vertex.index])
    v = sum(value.y for value in vertex_uv[vertex.index]) / len(vertex_uv[vertex.index])
    x = max(0, min(base_width - 1, int(u * (base_width - 1))))
    y = max(0, min(base_height - 1, int((1 - v) * (base_height - 1))))
    r, g, b, _ = base.pixels[(y * base_width + x) * 4:(y * base_width + x) * 4 + 4]
    skin = r > 0.25 and r > g * 1.12 and g > b * 1.12
    if not skin:
        continue
    arm_weights = []
    for group in vertex.groups:
        name = mesh.vertex_groups[group.group].name
        try:
            bone_index = int(name.split('_')[1])
        except ValueError:
            continue
        if 6 <= bone_index <= 19:
            arm_weights.append((bone_index, group.weight))
    if not arm_weights:
        continue
    bone_index, weight = max(arm_weights, key=lambda item: item[1])
    side = 1 if bone_index <= 12 else -1
    influence = min(1.0, weight) ** 1.3
    vertex.co.x += side * 0.17 * influence
    vertex.co.z += 0.12 * influence
    vertex.co.y -= 0.04 * influence
    count += 1
print('moved', count)
os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_skins=True, export_materials='EXPORT')
print(output)
