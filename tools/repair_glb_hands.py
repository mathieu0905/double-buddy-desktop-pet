"""Repair the distal hand geometry in the seven Hunyuan/UniRig GLBs.

The generated meshes have generic bones and the final hand bone often shares a
few vertices with the pocket/shorts.  We keep the original topology and apply
a conservative, weight-aware corrective offset to only the terminal hand bone.
This makes the hand readable at rest while preserving the existing skin.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import bpy
from mathutils import Vector


def descendants(bone):
    result = []
    stack = list(bone.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def longest_path(start):
    if not start.children:
        return [start]
    child = max(start.children, key=lambda item: len(descendants(item)))
    return [start, *longest_path(child)]


def repair_file(source: Path, destination: Path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.vertex_groups)
    bones = armature.data.bones
    chest = bones.get("bone_3")
    if chest is None:
        raise RuntimeError(f"{source.name}: missing chest bone_3")

    # The head branch is the one ending highest in the model.  The other two
    # branches are the left/right arms, regardless of 22- or 28-bone output.
    branches = [longest_path(child) for child in chest.children]
    arms = sorted(branches, key=lambda branch: branch[-1].head_local.z)[:2]
    if len(arms) != 2:
        raise RuntimeError(f"{source.name}: could not identify two arm branches")

    chest_x = chest.head_local.x
    for branch in arms:
        terminal = branch[-1]
        group = mesh.vertex_groups.get(terminal.name)
        if group is None:
            continue
        side = 1 if terminal.head_local.x >= chest_x else -1
        arm_length = max(0.05, (terminal.tail_local - branch[0].head_local).length)
        outward = min(0.18, max(0.08, arm_length * 0.34))
        upward = min(0.12, max(0.045, arm_length * 0.22))
        forward = min(0.045, max(0.015, arm_length * 0.07))
        for vertex in mesh.data.vertices:
            try:
                weight = group.weight(vertex.index)
            except RuntimeError:
                continue
            influence = weight * weight
            if influence < 0.02:
                continue
            vertex.co.x += side * outward * influence
            vertex.co.z += upward * influence
            vertex.co.y -= forward * influence

    mesh["hand_geometry_repaired"] = True
    mesh["hand_repair_method"] = "terminal-bone-weighted-correction"
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        export_animations=False,
        export_skins=True,
        export_materials="EXPORT",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="public/assets/3d/hunyuan3d21")
    parser.add_argument("--output-dir", default="public/assets/3d/hunyuan3d21/repaired")
    args = parser.parse_args()
    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)
    for source in sorted(source_dir.glob("*.glb")):
        destination = output_dir / source.name
        repair_file(source.resolve(), destination.resolve())
        print(destination)


if __name__ == "__main__":
    main()
