import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MOTIONS = Object.freeze({
  idle: { duration: Infinity, loop: true },
  walk: { duration: 1.1, loop: true },
  run: { duration: 0.72, loop: true },
  dance: { duration: 3.2, loop: true },
  jump: { duration: 1.25, loop: false },
  stretch: { duration: 2.6, loop: false },
  wave: { duration: 1.8, loop: false },
  pullOut: { duration: 2.4, loop: false },
  sleep: { duration: Infinity, loop: true },
  kiss: { duration: 2.8, loop: false },
  hug: { duration: 4.2, loop: false },
  fight: { duration: 4, loop: false }
});

export function createPetRenderer({ container, modelUrl, rotation = 0, onReady, onError }) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.7, 1.7, 2.35, -2.35, 0.01, 40);
  camera.position.set(0, 0.15, 8);
  camera.lookAt(0, 0.15, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x81968a, 2.8));
  const key = new THREE.DirectionalLight(0xfff4df, 3.6);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc6dcff, 1.6);
  rim.position.set(4, 3, -2);
  scene.add(rim);

  const renderStartedAt = performance.now();
  let elapsedTime = 0;
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  const hitRaycaster = new THREE.Raycaster();
  const hitPointer = new THREE.Vector2();
  let model;
  let rig;
  let fitScale = 1;
  let baseRootX = 0;
  let baseRootY = 0;
  const facingRotation = modelUrl.includes("/hunyuan3d21/") ? 0 : Math.PI;
  let viewRotation = normalizeDegrees(rotation);
  let ready = false;
  let motion = "idle";
  let motionStartedAt = 0;
  let motionDirection = 1;

  new GLTFLoader().load(modelUrl, (gltf) => {
    model = gltf.scene;
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material.side = THREE.DoubleSide;
        node.material.needsUpdate = true;
      }
    });
    const alignment = alignModelToSkeleton(model);
    modelRoot.add(model);
    fitModel(modelRoot);
    fitScale = modelRoot.scale.x;
    baseRootX = modelRoot.position.x;
    baseRootY = modelRoot.position.y;
    modelRoot.rotation.y = facingRotation + THREE.MathUtils.degToRad(viewRotation);
    rig = createProceduralRig(model);
    ready = true;
    resize();
    play("idle", { immediate: true });
    onReady?.({
      animations: gltf.animations.map((clip) => clip.name),
      bones: rig?.boneCount || 0,
      procedural: Boolean(rig),
      alignmentDegrees: THREE.MathUtils.radToDeg(alignment)
    });
  }, undefined, (error) => onError?.(error));

  function fitModel(object) {
    object.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(object);
    const size = initial.getSize(new THREE.Vector3());
    const scale = 3.72 / Math.max(size.y, 0.001);
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(object);
    const center = fitted.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.y += -2.02 - fitted.min.y;
    object.position.z -= center.z;
  }

  function play(nextMotion, options = {}) {
    if (!ready) return;
    motion = MOTIONS[nextMotion] ? nextMotion : "idle";
    motionStartedAt = elapsedTime;
    motionDirection = Number(options.direction) < 0 ? -1 : 1;
    if (options.immediate) updateMotion(0);
  }

  function updateMotion(elapsed) {
    if (!rig || !modelRoot) return;
    const config = MOTIONS[motion] || MOTIONS.idle;
    const localTime = Math.max(0, elapsed - motionStartedAt);
    if (!config.loop && localTime >= config.duration) {
      motion = "idle";
      motionStartedAt = elapsed;
      return updateMotion(elapsed);
    }

    rig.reset();
    modelRoot.position.x = baseRootX;
    modelRoot.position.y = baseRootY;
    modelRoot.rotation.set(0, facingRotation + THREE.MathUtils.degToRad(viewRotation), 0);
    modelRoot.scale.setScalar(fitScale);
    const turn = motionDirection;

    if (motion === "walk") {
      const phase = localTime * Math.PI * 2 / config.duration;
      const stride = Math.sin(phase);
      rig.rotatePair(rig.legs, 0, 0, 0.46 * stride);
      rig.rotatePair(rig.arms, 0, 0, -0.34 * stride);
      rig.bendLimbs(rig.legs, 0.24, phase);
      rig.rotate(rig.spine, 0, 0, 0.035 * Math.sin(phase * 2));
      modelRoot.position.y += 0.045 * Math.abs(Math.sin(phase));
    } else if (motion === "run") {
      const phase = localTime * Math.PI * 2 / config.duration;
      const stride = Math.sin(phase);
      rig.rotatePair(rig.legs, 0, 0, 0.78 * stride);
      rig.rotatePair(rig.arms, 0, 0, -0.66 * stride);
      rig.bendLimbs(rig.legs, 0.48, phase);
      rig.rotate(rig.chest, 0.08, 0, 0.055 * Math.sin(phase));
      modelRoot.position.y += 0.1 * Math.abs(Math.sin(phase));
    } else if (motion === "dance") {
      const phase = localTime * Math.PI * 2 / 1.05;
      rig.rotateSide(rig.arms[0], 0, 0, -0.58 + 0.2 * Math.sin(phase));
      rig.rotateSide(rig.arms[1], 0, 0, 0.58 - 0.2 * Math.sin(phase));
      rig.rotate(rig.chest, 0, 0.14 * Math.sin(phase), 0.08 * Math.sin(phase * 0.5));
      rig.rotate(rig.pelvis, 0, 0, -0.07 * Math.sin(phase));
      rig.rotatePair(rig.legs, 0, 0, 0.12 * Math.sin(phase + Math.PI / 2));
      modelRoot.position.y += 0.07 * Math.abs(Math.sin(phase));
    } else if (motion === "jump") {
      const progress = Math.min(1, localTime / config.duration);
      const lift = Math.sin(Math.PI * progress);
      const crouch = Math.max(0, 1 - Math.abs(progress - 0.13) / 0.13);
      const landing = Math.max(0, 1 - Math.abs(progress - 0.88) / 0.12);
      rig.rotateSide(rig.legs[0], 0, 0, -0.28 * crouch + 0.16 * lift);
      rig.rotateSide(rig.legs[1], 0, 0, 0.28 * crouch - 0.16 * lift);
      rig.rotateSide(rig.arms[0], 0, 0, -0.78 * lift);
      rig.rotateSide(rig.arms[1], 0, 0, 0.78 * lift);
      modelRoot.position.y += 0.58 * lift - 0.08 * crouch - 0.07 * landing;
      modelRoot.scale.set(fitScale * (1 + 0.045 * landing), fitScale * (1 - 0.055 * landing), fitScale);
    } else if (motion === "stretch") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = Math.sin(Math.PI * progress);
      const sway = Math.sin(progress * Math.PI * 2);
      rig.rotatePair(rig.arms, -0.42 * envelope, 0, 0.24 * envelope);
      rig.rotate(rig.chest, -0.07 * envelope, 0.04 * sway, 0.05 * sway);
      rig.rotate(rig.head, -0.05 * envelope, 0.05 * sway, 0);
      rig.rotatePair(rig.legs, 0, 0, 0.05 * sway);
      modelRoot.position.y += 0.06 * envelope;
      modelRoot.rotation.z = 0.022 * sway;
    } else if (motion === "wave") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = Math.sin(Math.PI * progress);
      const wave = Math.sin(progress * Math.PI * 6);
      const arm = rig.arms[1] || rig.arms[0];
      rig.rotateSide(arm, 0, 0, 0.92 * envelope);
      rig.rotate(arm?.[1], 0, 0, 0.5 * wave * envelope);
      rig.rotate(rig.chest, 0, 0.08 * wave * envelope, -0.06 * envelope);
      rig.rotate(rig.head, 0, 0.08 * wave * envelope, 0.035 * envelope);
      modelRoot.rotation.z = 0.025 * wave * envelope;
    } else if (motion === "pullOut") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = smoothStep(Math.min(1, progress / 0.62));
      const arm = rig.pocketArm || rig.arms[0];
      const side = rig.pocketArmSide || 1;
      rig.rotateSide(arm, 0, 0, -side * 1.9 * envelope);
      rig.rotate(arm?.[1], -side * 0.18 * envelope, 0, side * 0.72 * envelope);
      rig.rotate(arm?.[2], 0, 0, side * 0.34 * envelope);
      rig.translateBone(arm?.[arm.length - 1], side * 0.28 * envelope, 0.22 * envelope, 0.12 * envelope);
      rig.rotate(rig.chest, 0, side * 0.12 * envelope, -side * 0.07 * envelope);
    } else if (motion === "sleep") {
      const breathe = Math.sin(localTime * Math.PI * 0.8);
      modelRoot.rotation.z = -0.16 * turn;
      modelRoot.position.y -= 0.08;
      modelRoot.scale.set(fitScale * (1 + breathe * 0.006), fitScale * (1 - breathe * 0.012), fitScale);
      rig.rotate(rig.chest, 0.04 * breathe, 0, -0.08);
      rig.rotatePair(rig.arms, 0, 0, 0.18);
    } else if (motion === "kiss") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = Math.sin(Math.PI * progress);
      modelRoot.rotation.y = facingRotation + turn * Math.PI * 0.5 * envelope;
      modelRoot.position.x += turn * 0.3 * envelope;
      modelRoot.rotation.z = -turn * 0.07 * envelope;
      rig.rotate(rig.chest, 0, turn * 0.2 * envelope, -turn * 0.1 * envelope);
      rig.rotate(rig.head, 0, turn * 0.3 * envelope, turn * 0.09 * envelope);
      rig.rotatePair(rig.arms, 0.1 * envelope, 0, 0.22 * envelope);
    } else if (motion === "hug") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = Math.sin(Math.PI * progress);
      const squeeze = Math.max(0, Math.sin(Math.PI * Math.min(1, progress * 1.35)));
      modelRoot.rotation.y = facingRotation + turn * Math.PI * 0.5 * envelope;
      modelRoot.position.x += turn * 0.38 * squeeze;
      rig.rotate(rig.chest, 0.08 * squeeze, turn * 0.14 * envelope, -turn * 0.06 * envelope);
      rig.rotatePair(rig.arms, 0.32 * squeeze, 0, 0.82 * squeeze);
      rig.rotate(rig.head, 0, turn * 0.18 * squeeze, turn * 0.05 * squeeze);
    } else if (motion === "fight") {
      const progress = Math.min(1, localTime / config.duration);
      const envelope = Math.sin(Math.PI * progress);
      const phase = progress * Math.PI * 10;
      const punch = Math.sin(phase);
      const strike = Math.pow(Math.abs(punch), 3) * envelope;
      modelRoot.rotation.y = facingRotation + turn * Math.PI * 0.5 * envelope;
      modelRoot.position.x += turn * (0.12 * envelope + 0.06 * punch);
      modelRoot.position.y += 0.035 * Math.abs(Math.sin(phase * 0.5)) * envelope;
      rig.rotate(rig.chest, 0, -turn * 0.2 * punch * envelope, turn * 0.08 * punch * envelope);
      const punchingArm = punch >= 0 ? rig.arms[1] : rig.arms[0];
      rig.rotateSide(punchingArm, -1.05 * strike, turn * 0.3 * strike, turn * 0.24 * strike);
      rig.rotate(rig.head, 0, turn * 0.12 * punch * envelope, -turn * 0.08 * punch * envelope);
    } else {
      const breathe = Math.sin(localTime * Math.PI * 1.15);
      const sway = Math.sin(localTime * 0.7);
      const weight = Math.sin(localTime * 0.35);
      rig.rotate(rig.chest, 0.035 * breathe, 0.045 * sway, 0.025 * breathe + 0.02 * weight);
      rig.rotate(rig.head, -0.025 * breathe, 0.035 * Math.sin(localTime * 0.55), 0.02 * weight);
      rig.rotatePair(rig.arms, 0, 0, 0.035 * breathe + 0.025 * weight);
      rig.rotatePair(rig.legs, 0, 0, 0.012 * weight);
      modelRoot.position.x += 0.012 * weight;
      modelRoot.position.y += 0.018 * breathe;
      modelRoot.rotation.z = 0.012 * weight;
    }
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = 2.35;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  renderer.setAnimationLoop((timestamp) => {
    elapsedTime = Math.max(0, (timestamp - renderStartedAt) / 1_000);
    updateMotion(elapsedTime);
    renderer.render(scene, camera);
  });

  return {
    play,
    hitTest(x, y) {
      if (!ready || !model || container.clientWidth <= 0 || container.clientHeight <= 0) return false;
      hitPointer.set(
        x / container.clientWidth * 2 - 1,
        -(y / container.clientHeight) * 2 + 1
      );
      modelRoot.updateMatrixWorld(true);
      hitRaycaster.setFromCamera(hitPointer, camera);
      return hitRaycaster.intersectObject(modelRoot, true).some(({ object }) => object?.isMesh || object?.isSkinnedMesh);
    },
    setRotation(value) {
      viewRotation = normalizeDegrees(value);
    },
    destroy() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
        else disposeMaterial(node.material);
      });
      renderer.dispose();
      container.replaceChildren();
    }
  };
}

function alignModelToSkeleton(model) {
  let skeleton;
  model.traverse((node) => {
    if (!skeleton && node.isSkinnedMesh) skeleton = node.skeleton;
  });
  if (!skeleton?.bones?.length) return 0;

  model.updateMatrixWorld(true);
  const bones = skeleton.bones;
  const boneSet = new Set(bones);
  const root = bones
    .filter((bone) => !boneSet.has(bone.parent))
    .sort((a, b) => descendantCount(b, boneSet) - descendantCount(a, boneSet))[0];
  if (!root) return 0;

  const rootPosition = root.getWorldPosition(new THREE.Vector3());
  const positions = bones.map((bone) => ({ bone, point: bone.getWorldPosition(new THREE.Vector3()) }));
  const minX = Math.min(...positions.map(({ point }) => point.x));
  const maxX = Math.max(...positions.map(({ point }) => point.x));
  const width = Math.max(0.001, maxX - minX);
  const central = positions
    .filter(({ point }) => point.y > rootPosition.y && Math.abs(point.x - rootPosition.x) < Math.max(width * 0.22, 0.025))
    .sort((a, b) => b.point.y - a.point.y)[0];
  if (!central) return 0;

  const up = central.point.clone().sub(rootPosition).normalize();
  if (up.lengthSq() < 0.5) return 0;
  const correction = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
  model.quaternion.premultiply(correction);
  model.updateMatrixWorld(true);
  return correction.angleTo(new THREE.Quaternion());
}

function createProceduralRig(model) {
  let skeleton;
  model.traverse((node) => {
    if (!skeleton && node.isSkinnedMesh) skeleton = node.skeleton;
  });
  if (!skeleton?.bones?.length) return null;

  model.updateMatrixWorld(true);
  const bones = skeleton.bones;
  const boneSet = new Set(bones);
  const roots = bones.filter((bone) => !boneSet.has(bone.parent));
  const pelvis = roots.sort((a, b) => descendantCount(b, boneSet) - descendantCount(a, boneSet))[0];
  const world = new Map(bones.map((bone) => [bone, bone.getWorldPosition(new THREE.Vector3())]));
  const height = Math.max(0.001, ...[...world.values()].map((p) => p.y)) - Math.min(...[...world.values()].map((p) => p.y));
  const boneChildren = (bone) => bone?.children?.filter((child) => boneSet.has(child)) || [];
  const pelvisChildren = boneChildren(pelvis);
  const spineStart = pelvisChildren
    .filter((bone) => world.get(bone).y >= world.get(pelvis).y)
    .sort((a, b) => Math.abs(world.get(a).x - world.get(pelvis).x) - Math.abs(world.get(b).x - world.get(pelvis).x))[0]
    || pelvisChildren[0];

  const chestCandidates = bones.filter((bone) => {
    const point = world.get(bone);
    return boneChildren(bone).length >= 3
      && point.y > world.get(pelvis).y
      && Math.abs(point.x - world.get(pelvis).x) < height * 0.24;
  });
  const chest = chestCandidates.sort((a, b) => world.get(b).y - world.get(a).y)[0] || spineStart;
  const spinePath = pathBetween(pelvis, chest, boneSet).slice(1);

  const legStarts = pelvisChildren.filter((bone) => bone !== spineStart && !isAncestor(bone, chest));
  const legs = legStarts.map((bone) => longestPath(bone, boneSet, world)).sort((a, b) => branchX(a, world) - branchX(b, world));

  const upperBranches = boneChildren(chest).map((bone) => longestPath(bone, boneSet, world));
  const headBranch = upperBranches.slice().sort((a, b) => branchSpreadX(a, world, chest) - branchSpreadX(b, world, chest))[0] || [];
  const arms = upperBranches.filter((branch) => branch !== headBranch).sort((a, b) => branchX(a, world) - branchX(b, world)).slice(0, 2);

  const base = new Map(bones.map((bone) => [bone, {
    quaternion: bone.quaternion.clone(),
    position: bone.position.clone(),
    scale: bone.scale.clone()
  }]));
  const euler = new THREE.Euler();
  const offset = new THREE.Quaternion();

  function reset() {
    for (const bone of bones) {
      const pose = base.get(bone);
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.quaternion);
      bone.scale.copy(pose.scale);
    }
  }

  function rotate(bone, x = 0, y = 0, z = 0) {
    if (!bone) return;
    euler.set(x, y, z, "XYZ");
    offset.setFromEuler(euler);
    bone.quaternion.copy(base.get(bone).quaternion).multiply(offset);
  }

  function rotateSide(branch, x = 0, y = 0, z = 0) {
    rotate(branch?.[0], x, y, z);
  }

  function translateBone(bone, x = 0, y = 0, z = 0) {
    if (!bone) return;
    const pose = base.get(bone);
    if (!pose) return;
    bone.position.copy(pose.position).add(new THREE.Vector3(x, y, z));
  }

  function handTarget(branch, outward = 0.62, up = 0.2, forward = 0.1) {
    const root = branch?.[0];
    const chestPoint = chest?.getWorldPosition(new THREE.Vector3()) || root?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3();
    const side = Math.sign(branchX(branch, world) - world.get(chest).x) || 1;
    const target = chestPoint.clone().add(new THREE.Vector3(side * outward, up, forward));
    return target;
  }

  function poseBranch(branch, targetWorld, bend = 0) {
    const root = branch?.[0];
    const end = branch?.[branch.length - 1];
    if (!root || !end || !targetWorld) return;
    const rootWorld = root.getWorldPosition(new THREE.Vector3());
    const currentVector = end.getWorldPosition(new THREE.Vector3()).sub(rootWorld);
    const targetVector = targetWorld.clone().sub(rootWorld);
    if (currentVector.lengthSq() < 1e-8 || targetVector.lengthSq() < 1e-8) return;
    const worldDelta = new THREE.Quaternion().setFromUnitVectors(currentVector.normalize(), targetVector.normalize());
    const parentWorld = root.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
    const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
    root.quaternion.copy(base.get(root).quaternion).premultiply(localDelta);
    if (bend && branch.length > 2) {
      const middle = branch[Math.floor(branch.length * 0.42)];
      rotate(middle, 0, 0, bend);
    }
  }

  function rotatePair(branches, x = 0, y = 0, z = 0) {
    rotateSide(branches?.[0], x, y, z);
    rotateSide(branches?.[1], x, y, -z);
  }

  function bendLimbs(branches, amount, phase) {
    rotate(branches?.[0]?.[1], 0, 0, Math.max(0, Math.sin(phase)) * amount);
    rotate(branches?.[1]?.[1], 0, 0, -Math.max(0, -Math.sin(phase)) * amount);
  }

  return {
    boneCount: bones.length,
    pelvis,
    spine: spinePath[Math.max(0, spinePath.length - 2)] || spineStart,
    chest,
    head: headBranch[0],
    arms,
    pocketArm: arms.slice().sort((a, b) => branchEndY(a, world) - branchEndY(b, world))[0],
    pocketArmSide: Math.sign(branchX(arms.slice().sort((a, b) => branchEndY(a, world) - branchEndY(b, world))[0], world) - world.get(chest).x) || 1,
    legs,
    reset,
    rotate,
    rotateSide,
    rotatePair,
    bendLimbs,
    handTarget,
    poseBranch,
    translateBone
  };
}

function longestPath(start, boneSet, world) {
  if (!start) return [];
  const children = start.children.filter((child) => boneSet.has(child));
  if (!children.length) return [start];
  const next = children.sort((a, b) => {
    const da = world.get(a).distanceTo(world.get(start));
    const db = world.get(b).distanceTo(world.get(start));
    return db - da;
  })[0];
  return [start, ...longestPath(next, boneSet, world)];
}

function pathBetween(root, target, boneSet) {
  const path = [];
  let node = target;
  while (node && boneSet.has(node)) {
    path.unshift(node);
    if (node === root) return path;
    node = node.parent;
  }
  return [root, target].filter(Boolean);
}

function isAncestor(ancestor, node) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function descendantCount(bone, boneSet) {
  return bone.children.reduce((count, child) => count + (boneSet.has(child) ? 1 + descendantCount(child, boneSet) : 0), 0);
}

function branchX(branch, world) {
  if (!branch?.length) return 0;
  return world.get(branch[branch.length - 1]).x;
}

function branchEndY(branch, world) {
  if (!branch?.length) return 0;
  return world.get(branch[branch.length - 1]).y;
}

function branchSpreadX(branch, world, origin) {
  const x = world.get(origin).x;
  return Math.max(0, ...branch.map((bone) => Math.abs(world.get(bone).x - x)));
}

function disposeMaterial(material) {
  if (!material) return;
  for (const value of Object.values(material)) value?.isTexture && value.dispose();
  material.dispose?.();
}

function normalizeDegrees(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric + 180) % 360 + 360) % 360 - 180;
}

function smoothStep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
