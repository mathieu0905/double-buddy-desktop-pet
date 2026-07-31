import bpy, os, numpy as np
source=os.path.abspath('public/assets/3d/hunyuan3d21/white.glb'); output=os.path.abspath('.runtime/white-skin-fast.glb')
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=source)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups)
uv_layer=mesh.data.uv_layers.active.data
base=next(l.from_node.image for l in mesh.data.materials[0].node_tree.links if l.to_socket.name=='Base Color')
w,h=base.size; pixels=np.asarray(base.pixels[:],dtype=np.float32).reshape(h,w,4)
uvs=[None]*len(mesh.data.vertices)
for loop in mesh.data.loops:
    if uvs[loop.vertex_index] is None: uvs[loop.vertex_index]=loop.index
count=0
for v in mesh.data.vertices:
    li=uvs[v.index]
    if li is None: continue
    uv=uv_layer[li].uv; x=max(0,min(w-1,int(uv.x*(w-1)))); y=max(0,min(h-1,int((1-uv.y)*(h-1))))
    r,g,b=pixels[y,x,:3]
    if not (r>0.45 and g>0.25 and r-g>0.08 and g-b>0.08): continue
    arm=[(int(mesh.vertex_groups[g.group].name.split('_')[1]),g.weight) for g in v.groups if mesh.vertex_groups[g.group].name.startswith('bone_') and 6<=int(mesh.vertex_groups[g.group].name.split('_')[1])<=19]
    if not arm: continue
    bi,weight=max(arm,key=lambda t:t[1]); inf=min(1.0,weight)**1.3; side=1 if bi<=12 else -1
    v.co.x += side*0.42*inf; v.co.z += 0.24*inf; v.co.y -= 0.08*inf; count+=1
print('moved',count)
os.makedirs(os.path.dirname(output),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=False,export_skins=True,export_materials='EXPORT')
print(output)
