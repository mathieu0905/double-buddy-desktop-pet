extends SceneTree

const MODEL_DIR := "res://../../public/assets/3d"

func _initialize() -> void:
	var world := Node3D.new()
	root.add_child.call_deferred(world)
	await process_frame

	var lan: Node3D = load(MODEL_DIR + "/lan.tscn").instantiate()
	var bo: Node3D = load(MODEL_DIR + "/bo.tscn").instantiate()
	lan.position = Vector3(-1.15, 0, 0)
	bo.position = Vector3(1.15, 0, 0)
	world.add_child(lan)
	world.add_child(bo)
	lan.get_node("AnimationPlayer").play("dance")
	lan.get_node("AnimationPlayer").seek(0.52, true)
	bo.get_node("AnimationPlayer").play("wave")
	bo.get_node("AnimationPlayer").seek(0.72, true)

	var camera := Camera3D.new()
	camera.position = Vector3(0, 2.0, 10.0)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 4.6
	world.add_child(camera)
	camera.look_at(Vector3(0, 2.0, 0))
	camera.current = true

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-35, -28, 0)
	key.light_energy = 1.25
	key.shadow_enabled = true
	world.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(25, 155, 0)
	fill.light_color = Color("bdd7ff")
	fill.light_energy = 0.55
	world.add_child(fill)

	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("e9eee7")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.WHITE
	env.ambient_light_energy = 0.62
	environment.environment = env
	world.add_child(environment)

	await process_frame
	await process_frame
	await process_frame
	var image := root.get_texture().get_image()
	var path := ProjectSettings.globalize_path(MODEL_DIR + "/preview.png")
	var error := image.save_png(path)
	print("Preview saved: ", path, " (", error_string(error), ")")
	quit()
