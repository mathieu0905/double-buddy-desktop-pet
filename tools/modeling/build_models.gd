extends SceneTree

const OUTPUT_DIR := "res://../../public/assets/3d"

var palette := {
	"skin": Color("f2ae7f"),
	"skin_light": Color("ffc69b"),
	"hair": Color("151616"),
	"ink": Color("202322"),
	"cream": Color("eee2c6"),
	"blue": Color("2877b5"),
	"royal": Color("174cce"),
	"gold": Color("e2b734"),
	"white": Color("f8f5e9"),
	"brown": Color("613c24"),
	"sole": Color("d8d2c4")
}

func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	for pet_id in ["lan", "bo"]:
		var model := build_character(pet_id)
		save_model(model, pet_id)
		model.queue_free()
	print("Generated articulated models in ", ProjectSettings.globalize_path(OUTPUT_DIR))
	quit()

func build_character(pet_id: String) -> Node3D:
	var root := Node3D.new()
	root.name = pet_id.capitalize()
	root.set_meta("pet_id", pet_id)
	root.set_meta("model_type", "articulated_humanoid")

	var skeleton := Skeleton3D.new()
	skeleton.name = "Skeleton3D"
	root.add_child(skeleton)
	var bones := create_skeleton(skeleton)
	build_body(root, skeleton, bones, pet_id)
	add_skin_probe(root, skeleton)
	add_animations(root, skeleton)
	set_owner_recursive(root, root)
	return root

func create_skeleton(skeleton: Skeleton3D) -> Dictionary:
	var definitions := [
		["hips", "", Vector3(0, 1.55, 0)],
		["spine", "hips", Vector3(0, 0.28, 0)],
		["chest", "spine", Vector3(0, 0.42, 0)],
		["neck", "chest", Vector3(0, 0.42, 0)],
		["head", "neck", Vector3(0, 0.15, 0)],
		["upper_arm_l", "chest", Vector3(-0.48, 0.25, 0)],
		["lower_arm_l", "upper_arm_l", Vector3(0, -0.56, 0)],
		["hand_l", "lower_arm_l", Vector3(0, -0.47, 0)],
		["upper_arm_r", "chest", Vector3(0.48, 0.25, 0)],
		["lower_arm_r", "upper_arm_r", Vector3(0, -0.56, 0)],
		["hand_r", "lower_arm_r", Vector3(0, -0.47, 0)],
		["upper_leg_l", "hips", Vector3(-0.25, -0.05, 0)],
		["lower_leg_l", "upper_leg_l", Vector3(0, -0.68, 0)],
		["foot_l", "lower_leg_l", Vector3(0, -0.58, 0.13)],
		["upper_leg_r", "hips", Vector3(0.25, -0.05, 0)],
		["lower_leg_r", "upper_leg_r", Vector3(0, -0.68, 0)],
		["foot_r", "lower_leg_r", Vector3(0, -0.58, 0.13)]
	]
	var result := {}
	for definition in definitions:
		var index := skeleton.add_bone(definition[0])
		result[definition[0]] = index
		if definition[1] != "":
			skeleton.set_bone_parent(index, result[definition[1]])
		skeleton.set_bone_rest(index, Transform3D(Basis.IDENTITY, definition[2]))
	return result

func build_body(root: Node3D, skeleton: Skeleton3D, _bones: Dictionary, pet_id: String) -> void:
	# Head and facial geometry.
	var head := attachment(skeleton, "head")
	add_sphere(head, "Head", Vector3(0, 0.41, 0), Vector3(0.72, 0.76, 0.62), palette.skin_light)
	add_sphere(head, "EarL", Vector3(-0.66, 0.39, 0), Vector3(0.16, 0.22, 0.11), palette.skin)
	add_sphere(head, "EarR", Vector3(0.66, 0.39, 0), Vector3(0.16, 0.22, 0.11), palette.skin)
	add_sphere(head, "HairCap", Vector3(0, 0.76, -0.05), Vector3(0.73, 0.46, 0.62), palette.hair)
	for x in [-0.48, -0.25, 0.0, 0.25, 0.48]:
		add_sphere(head, "Fringe", Vector3(x, 0.61 + 0.07 * cos(x * 5.0), 0.52), Vector3(0.19, 0.24, 0.12), palette.hair)
	add_eye(head, Vector3(-0.27, 0.42, 0.57), "L")
	add_eye(head, Vector3(0.27, 0.42, 0.57), "R")
	add_glasses(head)
	add_sphere(head, "Nose", Vector3(0, 0.25, 0.65), Vector3(0.055, 0.07, 0.045), palette.skin)
	if pet_id == "bo":
		add_box(head, "Smile", Vector3(0, 0.08, 0.61), Vector3(0.34, 0.11, 0.035), palette.white)
		add_box(head, "Mouth", Vector3(0, 0.045, 0.59), Vector3(0.39, 0.04, 0.03), palette.ink)
	else:
		for x in [-0.13, 0.0, 0.13]:
			add_sphere(head, "Smile", Vector3(x, 0.08 + abs(x) * 0.28, 0.62), Vector3(0.09, 0.025, 0.025), Color("8f4a3c"))

	# Torso and clothes.
	var chest := attachment(skeleton, "chest")
	if pet_id == "lan":
		add_capsule(chest, "FloralShirt", Vector3(0, -0.17, 0), 0.43, 0.92, Vector3(1.15, 1, 0.76), palette.cream)
		for p in [Vector3(-0.25,-0.05,0.36), Vector3(0.18,-0.2,0.36), Vector3(-0.06,-0.38,0.36), Vector3(0.29,0.08,0.33)]:
			add_sphere(chest, "Flower", p, Vector3(0.1, 0.1, 0.025), palette.blue)
		add_box(chest, "BagStrap", Vector3(0.05, -0.17, 0.4), Vector3(0.08, 1.02, 0.05), palette.ink, Vector3(0, 0, -0.48))
		add_box(chest, "CrossbodyBag", Vector3(-0.25, -0.52, 0.48), Vector3(0.46, 0.35, 0.18), palette.ink)
	else:
		add_capsule(chest, "GraduationGown", Vector3(0, -0.27, 0), 0.48, 1.12, Vector3(1.22, 1, 0.78), palette.ink)
		add_box(chest, "BlueTrimL", Vector3(-0.24, -0.25, 0.4), Vector3(0.09, 0.9, 0.045), palette.royal, Vector3(0, 0, -0.13))
		add_box(chest, "BlueTrimR", Vector3(0.24, -0.25, 0.4), Vector3(0.09, 0.9, 0.045), palette.royal, Vector3(0, 0, 0.13))
		add_box(chest, "GoldCollarL", Vector3(-0.12, 0.13, 0.42), Vector3(0.08, 0.4, 0.045), palette.gold, Vector3(0, 0, -0.62))
		add_box(chest, "GoldCollarR", Vector3(0.12, 0.13, 0.42), Vector3(0.08, 0.4, 0.045), palette.gold, Vector3(0, 0, 0.62))

	var hips := attachment(skeleton, "hips")
	if pet_id == "lan":
		add_box(hips, "Shorts", Vector3(0, -0.17, 0), Vector3(0.72, 0.48, 0.5), Color("303437"))
	else:
		add_box(hips, "Trousers", Vector3(0, -0.22, 0), Vector3(0.68, 0.55, 0.48), Color("181a1a"))

	# Fully articulated arms and legs.
	for side in ["l", "r"]:
		var sign_value := -1.0 if side == "l" else 1.0
		var upper_arm := attachment(skeleton, "upper_arm_" + side)
		var sleeve_color: Color = palette.cream if pet_id == "lan" else palette.ink
		add_capsule(upper_arm, "UpperArm", Vector3(0, -0.28, 0), 0.145 if pet_id == "lan" else 0.19, 0.62, Vector3.ONE, sleeve_color)
		if pet_id == "bo":
			add_box(upper_arm, "SleeveTrim", Vector3(0, -0.46, 0.16), Vector3(0.3, 0.08, 0.05), palette.royal)
		var lower_arm := attachment(skeleton, "lower_arm_" + side)
		add_capsule(lower_arm, "Forearm", Vector3(0, -0.24, 0), 0.13, 0.54, Vector3.ONE, palette.skin_light)
		var hand := attachment(skeleton, "hand_" + side)
		add_sphere(hand, "Hand", Vector3(0, -0.1, 0), Vector3(0.15, 0.19, 0.13), palette.skin_light)

		var upper_leg := attachment(skeleton, "upper_leg_" + side)
		add_capsule(upper_leg, "Thigh", Vector3(0, -0.34, 0), 0.17, 0.75, Vector3.ONE, Color("303437") if pet_id == "lan" else Color("181a1a"))
		var lower_leg := attachment(skeleton, "lower_leg_" + side)
		add_capsule(lower_leg, "Shin", Vector3(0, -0.29, 0), 0.14, 0.64, Vector3.ONE, palette.skin_light if pet_id == "lan" else Color("181a1a"))
		if pet_id == "lan":
			add_capsule(lower_leg, "Sock", Vector3(0, -0.47, 0), 0.145, 0.24, Vector3.ONE, palette.white)
			add_box(lower_leg, "SockStripe", Vector3(0, -0.42, 0.145), Vector3(0.27, 0.035, 0.03), palette.blue)
		var foot := attachment(skeleton, "foot_" + side)
		var shoe_color: Color = palette.white if pet_id == "lan" else palette.ink
		add_capsule(foot, "Shoe", Vector3(0, -0.12, 0.14), 0.17, 0.52, Vector3(1.0, 0.58, 1.45), shoe_color, Vector3(PI / 2.0, 0, 0))
		add_box(foot, "Sole", Vector3(0, -0.23, 0.18), Vector3(0.34, 0.07, 0.55), palette.sole if pet_id == "lan" else palette.white)

func add_eye(parent: Node3D, position: Vector3, suffix: String) -> void:
	add_sphere(parent, "EyeWhite" + suffix, position, Vector3(0.21, 0.18, 0.095), palette.white)
	add_sphere(parent, "Iris" + suffix, position + Vector3(0, -0.01, 0.09), Vector3(0.105, 0.115, 0.045), palette.brown)
	add_sphere(parent, "Pupil" + suffix, position + Vector3(0, -0.01, 0.125), Vector3(0.052, 0.064, 0.025), palette.ink)
	add_sphere(parent, "EyeGlint" + suffix, position + Vector3(-0.025, 0.035, 0.151), Vector3(0.018, 0.022, 0.012), palette.white)

func add_glasses(parent: Node3D) -> void:
	for x in [-0.28, 0.28]:
		var torus := TorusMesh.new()
		torus.inner_radius = 0.205
		torus.outer_radius = 0.245
		add_mesh(parent, "Glasses", torus, Vector3(x, 0.42, 0.69), Vector3.ONE, palette.ink, Vector3(PI / 2.0, 0, 0))
	add_box(parent, "GlassesBridge", Vector3(0, 0.42, 0.7), Vector3(0.13, 0.035, 0.035), palette.ink)

func attachment(skeleton: Skeleton3D, bone_name: String) -> Node3D:
	return ensure_visual_bone(skeleton, skeleton.find_bone(bone_name))

func ensure_visual_bone(skeleton: Skeleton3D, bone_index: int) -> Node3D:
	var root := skeleton.get_parent() as Node3D
	var rig := root.get_node_or_null("VisualRig") as Node3D
	if rig == null:
		rig = Node3D.new()
		rig.name = "VisualRig"
		root.add_child(rig)
	var bone_name := skeleton.get_bone_name(bone_index)
	var existing := rig.find_child(bone_name, true, false) as Node3D
	if existing != null:
		return existing
	var node := Node3D.new()
	node.name = bone_name
	node.unique_name_in_owner = true
	node.transform = skeleton.get_bone_rest(bone_index)
	var parent_index := skeleton.get_bone_parent(bone_index)
	if parent_index >= 0:
		ensure_visual_bone(skeleton, parent_index).add_child(node)
	else:
		rig.add_child(node)
	return node

func add_sphere(parent: Node3D, name_value: String, position: Vector3, scale_value: Vector3, color: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	return add_mesh(parent, name_value, mesh, position, scale_value, color)

func add_box(parent: Node3D, name_value: String, position: Vector3, size: Vector3, color: Color, rotation_value := Vector3.ZERO) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	return add_mesh(parent, name_value, mesh, position, Vector3.ONE, color, rotation_value)

func add_capsule(parent: Node3D, name_value: String, position: Vector3, radius: float, height: float, scale_value: Vector3, color: Color, rotation_value := Vector3.ZERO) -> MeshInstance3D:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = max(height, radius * 2.05)
	return add_mesh(parent, name_value, mesh, position, scale_value, color, rotation_value)

func add_mesh(parent: Node3D, name_value: String, mesh: PrimitiveMesh, position: Vector3, scale_value: Vector3, color: Color, rotation_value := Vector3.ZERO) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = name_value
	node.mesh = mesh
	node.position = position
	node.scale = scale_value
	node.rotation = rotation_value
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.76
	material.metallic = 0.0
	mesh.material = material
	parent.add_child(node)
	return node

func add_skin_probe(root: Node3D, skeleton: Skeleton3D) -> void:
	# A transparent weighted mesh preserves a standards-compliant glTF skin and
	# the full joint map, while the visible stylized pieces remain rigidly bound
	# to the same bones for clean chibi articulation.
	var vertices := PackedVector3Array()
	var bones := PackedInt32Array()
	var weights := PackedFloat32Array()
	for bone_index in skeleton.get_bone_count():
		var center := skeleton.get_bone_global_rest(bone_index).origin
		vertices.append(center + Vector3(-0.003, 0, 0))
		vertices.append(center + Vector3(0.003, 0, 0))
		vertices.append(center + Vector3(0, 0.006, 0))
		for _vertex in 3:
			bones.append_array(PackedInt32Array([bone_index, 0, 0, 0]))
			weights.append_array(PackedFloat32Array([1.0, 0.0, 0.0, 0.0]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_BONES] = bones
	arrays[Mesh.ARRAY_WEIGHTS] = weights
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var material := StandardMaterial3D.new()
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(1, 1, 1, 0)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.surface_set_material(0, material)
	var probe := MeshInstance3D.new()
	probe.name = "HumanoidSkin"
	probe.mesh = mesh
	probe.skin = skeleton.create_skin_from_rest_transforms()
	probe.skeleton = NodePath("../Skeleton3D")
	root.add_child(probe)

func add_animations(root: Node3D, _skeleton: Skeleton3D) -> void:
	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"
	root.add_child(player)
	var library := AnimationLibrary.new()
	library.add_animation("idle", make_idle())
	library.add_animation("walk", make_walk())
	library.add_animation("run", make_run())
	library.add_animation("wave", make_wave())
	library.add_animation("jump", make_jump())
	library.add_animation("dance", make_dance())
	player.add_animation_library("", library)

func make_idle() -> Animation:
	var anim := animation(2.0, true)
	rotation_keys(anim, "head", [0.0, 1.0, 2.0], [Vector3(0, -0.08, 0), Vector3(0, 0.08, 0), Vector3(0, -0.08, 0)])
	return anim

func make_walk() -> Animation:
	var anim := animation(1.0, true)
	rotation_keys(anim, "upper_leg_l", [0.0, 0.5, 1.0], [Vector3(0.55,0,0), Vector3(-0.55,0,0), Vector3(0.55,0,0)])
	rotation_keys(anim, "upper_leg_r", [0.0, 0.5, 1.0], [Vector3(-0.55,0,0), Vector3(0.55,0,0), Vector3(-0.55,0,0)])
	rotation_keys(anim, "upper_arm_l", [0.0, 0.5, 1.0], [Vector3(-0.35,0,0), Vector3(0.35,0,0), Vector3(-0.35,0,0)])
	rotation_keys(anim, "upper_arm_r", [0.0, 0.5, 1.0], [Vector3(0.35,0,0), Vector3(-0.35,0,0), Vector3(0.35,0,0)])
	return anim

func make_wave() -> Animation:
	var anim := animation(1.6, true)
	rotation_keys(anim, "upper_arm_r", [0.0, 0.3, 1.3, 1.6], [Vector3.ZERO, Vector3(0,0,-2.05), Vector3(0,0,-2.05), Vector3.ZERO])
	rotation_keys(anim, "lower_arm_r", [0.0, 0.3, 0.62, 0.94, 1.3, 1.6], [Vector3.ZERO, Vector3(0,0,-0.35), Vector3(0,0,0.48), Vector3(0,0,-0.35), Vector3(0,0,0.48), Vector3.ZERO])
	return anim

func make_run() -> Animation:
	var anim := animation(0.62, true)
	rotation_keys(anim, "upper_leg_l", [0.0, 0.31, 0.62], [Vector3(0.9,0,0), Vector3(-0.9,0,0), Vector3(0.9,0,0)])
	rotation_keys(anim, "upper_leg_r", [0.0, 0.31, 0.62], [Vector3(-0.9,0,0), Vector3(0.9,0,0), Vector3(-0.9,0,0)])
	rotation_keys(anim, "lower_leg_l", [0.0, 0.31, 0.62], [Vector3(-0.2,0,0), Vector3(0.85,0,0), Vector3(-0.2,0,0)])
	rotation_keys(anim, "lower_leg_r", [0.0, 0.31, 0.62], [Vector3(0.85,0,0), Vector3(-0.2,0,0), Vector3(0.85,0,0)])
	rotation_keys(anim, "upper_arm_l", [0.0, 0.31, 0.62], [Vector3(-0.75,0,0), Vector3(0.75,0,0), Vector3(-0.75,0,0)])
	rotation_keys(anim, "upper_arm_r", [0.0, 0.31, 0.62], [Vector3(0.75,0,0), Vector3(-0.75,0,0), Vector3(0.75,0,0)])
	return anim

func make_jump() -> Animation:
	var anim := animation(1.25, false)
	position_keys(anim, "hips", [0.0, 0.22, 0.62, 1.0, 1.25], [Vector3.ZERO, Vector3(0,-0.18,0), Vector3(0,0.75,0), Vector3(0,0.18,0), Vector3.ZERO])
	rotation_keys(anim, "upper_arm_l", [0.0, 0.62, 1.25], [Vector3.ZERO, Vector3(0,0,2.55), Vector3.ZERO])
	rotation_keys(anim, "upper_arm_r", [0.0, 0.62, 1.25], [Vector3.ZERO, Vector3(0,0,-2.55), Vector3.ZERO])
	return anim

func make_dance() -> Animation:
	var anim := animation(2.0, true)
	rotation_keys(anim, "chest", [0.0, 0.5, 1.0, 1.5, 2.0], [Vector3(0,0,-0.15), Vector3(0,0,0.18), Vector3(0,0,-0.18), Vector3(0,0,0.15), Vector3(0,0,-0.15)])
	rotation_keys(anim, "upper_arm_l", [0.0, 0.5, 1.0, 1.5, 2.0], [Vector3(0,0,1.2), Vector3(0,0,2.35), Vector3(0,0,1.1), Vector3(0,0,2.5), Vector3(0,0,1.2)])
	rotation_keys(anim, "upper_arm_r", [0.0, 0.5, 1.0, 1.5, 2.0], [Vector3(0,0,-2.35), Vector3(0,0,-1.1), Vector3(0,0,-2.5), Vector3(0,0,-1.2), Vector3(0,0,-2.35)])
	rotation_keys(anim, "upper_leg_l", [0.0, 1.0, 2.0], [Vector3(0.2,0,0), Vector3(-0.45,0,0.18), Vector3(0.2,0,0)])
	rotation_keys(anim, "upper_leg_r", [0.0, 1.0, 2.0], [Vector3(-0.45,0,-0.18), Vector3(0.2,0,0), Vector3(-0.45,0,-0.18)])
	return anim

func animation(length_value: float, looped: bool) -> Animation:
	var anim := Animation.new()
	anim.length = length_value
	anim.loop_mode = Animation.LOOP_LINEAR if looped else Animation.LOOP_NONE
	return anim

func rotation_keys(anim: Animation, bone: String, times: Array, rotations: Array) -> void:
	var track := anim.add_track(Animation.TYPE_ROTATION_3D)
	anim.track_set_path(track, NodePath("Skeleton3D:" + bone))
	var visual_track := anim.add_track(Animation.TYPE_ROTATION_3D)
	anim.track_set_path(visual_track, NodePath("%" + bone))
	for index in times.size():
		var rotation_value: Vector3 = rotations[index]
		var rotation_quaternion := Quaternion.from_euler(rotation_value)
		anim.rotation_track_insert_key(track, times[index], rotation_quaternion)
		anim.rotation_track_insert_key(visual_track, times[index], rotation_quaternion)

func position_keys(anim: Animation, bone: String, times: Array, positions: Array) -> void:
	var track := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(track, NodePath("Skeleton3D:" + bone))
	var visual_track := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(visual_track, NodePath("%" + bone))
	for index in times.size():
		anim.position_track_insert_key(track, times[index], positions[index])
		anim.position_track_insert_key(visual_track, times[index], positions[index])

func set_owner_recursive(node: Node, owner_node: Node) -> void:
	for child in node.get_children():
		child.owner = owner_node
		set_owner_recursive(child, owner_node)

func save_model(model: Node3D, pet_id: String) -> void:
	var packed := PackedScene.new()
	var pack_error := packed.pack(model)
	if pack_error != OK:
		push_error("Unable to pack model: " + error_string(pack_error))
		return
	ResourceSaver.save(packed, OUTPUT_DIR + "/" + pet_id + ".tscn")
	var state := GLTFState.new()
	var document := GLTFDocument.new()
	var append_error := document.append_from_scene(model, state)
	if append_error != OK:
		push_error("Unable to prepare GLB: " + error_string(append_error))
		return
	var write_error := document.write_to_filesystem(state, OUTPUT_DIR + "/" + pet_id + ".glb")
	if write_error != OK:
		push_error("Unable to write GLB: " + error_string(write_error))
