const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, safeStorage, screen, shell } = require("electron");
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");
const {
  BASE_PET_WINDOW,
  MIN_PET_SCALE,
  MAX_PET_SCALE,
  PET_SCALE_STEP,
  clampPetScale,
  petWindowSize,
  scaledPetBounds
} = require("./pet-scale.cjs");
const {
  EDGE_TRANSITION_MS,
  foldedPosition,
  nextActivityDelay,
  nextRestDelay,
  occasionalAction
} = require("./pet-idle.cjs");
const { PET_DEFINITIONS, PET_IDS, getPetDefinition } = require("./pets.cjs");
const { createCustomPetRecord, loadCustomPets, saveCustomPets } = require("./custom-pets.cjs");
const { acknowledgeCodexJob, createCodexJob, readCodexJobs, writeJsonAtomic } = require("./codex-job-store.cjs");
const { DEFAULT_API_BASE, DEFAULT_IMAGE_MODEL, buildPetPrompt, generateWithApi } = require("./pet-generation.cjs");

const petWindows = new Map();
const dragSessions = new Map();
const wanderTimers = new Map();
const movementTimers = new Map();
const foldedPets = new Map();
let relationshipTimer;
const AUTO_PAIR_INTIMACY = 70;
let hubWindow;
let customPets = [];
let generationInProgress = false;
let generationJobs = [];
let cachedCodexBinary;
const selectedCreatorImages = new Map();
const appStartedAt = Date.now();
let localUpdateTimer;
let codexJobPollTimer;
let quitting = false;
let layout = { alwaysOnTop: true, wander: true, visiblePetIds: [...PET_IDS], positions: {}, scales: {}, rotations: {} };

function preloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function webPreferences() {
  return {
    preload: preloadPath(),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    backgroundThrottling: false
  };
}

function allPetDefinitions() {
  return [...PET_DEFINITIONS, ...customPets];
}

function publicPetDefinitions() {
  return allPetDefinitions().map((definition) => {
    const visible = layout.visiblePetIds.includes(definition.id);
    if (definition.image) return { ...definition, visible };
    const bytes = readFileSync(path.join(customPetAssetsPath(), definition.imageFile));
    return { ...definition, image: `data:image/png;base64,${bytes.toString("base64")}`, visible };
  });
}

function broadcastPetVisibility() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send("pet:visibility-changed", [...layout.visiblePetIds]);
  }
}

function allPetIds() {
  return allPetDefinitions().map(({ id }) => id);
}

function getRuntimePetDefinition(petId) {
  return allPetDefinitions().find(({ id }) => id === petId) || getPetDefinition(petId);
}

function normalizeRuntimeVisiblePetIds(value) {
  const ids = allPetIds();
  if (!Array.isArray(value)) return ids;
  const selected = ids.filter((id) => value.includes(id));
  return selected.length > 0 ? selected : [ids[0]];
}

function createPetWindow(petId, index) {
  const definition = getRuntimePetDefinition(petId);
  const scale = clampPetScale(layout.scales?.[petId]);
  const size = petWindowSize(scale);
  const window = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: Math.round(BASE_PET_WINDOW.width * MIN_PET_SCALE),
    minHeight: Math.round(BASE_PET_WINDOW.height * MIN_PET_SCALE),
    maxWidth: Math.round(BASE_PET_WINDOW.width * MAX_PET_SCALE),
    maxHeight: Math.round(BASE_PET_WINDOW.height * MAX_PET_SCALE),
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: layout.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    title: `${definition.name} · 桌宠`,
    webPreferences: webPreferences()
  });

  window.setAlwaysOnTop(layout.alwaysOnTop, "floating");
  window.setVisibleOnAllWorkspaces(layout.alwaysOnTop, { visibleOnFullScreen: true });
  window.loadFile(path.join(__dirname, "..", "public", "desktop.html"), {
    query: {
      pet: definition.id,
      scale: String(scale),
      name: definition.name,
      image: definition.image || "",
      model: definition.model || "",
      rotation: String(layout.rotations?.[definition.id] || 0),
      hunger: String(definition.hunger),
      mood: String(definition.mood),
      energy: String(definition.energy)
    }
  });

  window.once("ready-to-show", () => {
    positionPetWindow(window, petId, index);
    window.setIgnoreMouseEvents(true, { forward: true });
    window.showInactive();
    scheduleWander(petId);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.on("closed", () => {
    stopDrag(window);
    clearTimeout(wanderTimers.get(petId));
    clearInterval(movementTimers.get(petId));
    movementTimers.delete(petId);
    foldedPets.delete(petId);
    petWindows.delete(petId);
  });
  window.on("blur", () => {
    if (!window.isDestroyed()) window.webContents.send("pet:selected", false);
  });

  petWindows.set(petId, window);
}

function positionPetWindow(window, petId, index) {
  const saved = layout.positions?.[petId];
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const display = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y });
    const area = display.workArea;
    const bounds = window.getBounds();
    const x = clamp(saved.x, area.x - 60, area.x + area.width - bounds.width + 60);
    const y = clamp(saved.y, area.y - 10, area.y + area.height - bounds.height + 70);
    window.setPosition(x, y, false);
    return;
  }

  const area = screen.getPrimaryDisplay().workArea;
  const width = window.getBounds().width;
  const availableWidth = Math.max(0, area.width - width - 44);
  const visibleCount = normalizeRuntimeVisiblePetIds(layout.visiblePetIds).length;
  const spacing = visibleCount > 1 ? Math.min(190, availableWidth / (visibleCount - 1)) : 0;
  const x = area.x + area.width - width - 22 - (visibleCount - 1 - index) * spacing;
  const y = area.y + area.height - window.getBounds().height - 8;
  window.setPosition(Math.round(x), Math.round(y), false);
}

function createHubWindow() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.show();
    hubWindow.focus();
    return hubWindow;
  }

  const window = new BrowserWindow({
    width: 700,
    height: 590,
    minWidth: 560,
    minHeight: 530,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: layout.alwaysOnTop,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "一起摸鱼 · 桌宠小屋",
    show: false,
    webPreferences: webPreferences()
  });
  hubWindow = window;

  window.setAlwaysOnTop(layout.alwaysOnTop, "floating");
  window.loadFile(path.join(__dirname, "..", "public", "index.html"));
  window.once("ready-to-show", () => {
    snapToCorner(window);
    window.show();
  });
  window.on("closed", () => {
    selectedCreatorImages.delete(window.webContents.id);
    if (hubWindow === window) hubWindow = undefined;
  });
  return window;
}

function openCreatorInHub() {
  const window = createHubWindow();
  const openCreator = () => {
    if (!window.isDestroyed()) window.webContents.send("hub:open-creator");
  };
  if (window.webContents.isLoadingMainFrame()) window.webContents.once("did-finish-load", openCreator);
  else openCreator();
}

function showPetMenu(window, petId) {
  const definition = getRuntimePetDefinition(petId);
  const scale = clampPetScale(layout.scales?.[petId]);
  const rotation = normalizePetRotation(layout.rotations?.[petId]);
  const scaleOptions = [0.7, 0.85, 1, 1.25, 1.6];
  const interactionPartners = allPetDefinitions().filter((pet) => pet.id !== petId && layout.visiblePetIds.includes(pet.id) && petWindows.has(pet.id));
  const partnerMenu = (action) => interactionPartners.map((pet) => ({
    label: `和 ${pet.name}`,
    click: () => pairInteraction(petId, pet.id, action)
  }));
  const template = [
    { label: `摸摸 ${definition.name}`, click: () => sendPetAction(window, "pet") },
    {
      label: `隐藏 ${definition.name}`,
      enabled: layout.visiblePetIds.length > 1,
      click: () => setPetVisible(petId, false)
    },
    { type: "separator" },
    { label: "喂饭团", click: () => sendPetAction(window, "feed") },
    { label: "陪他玩", click: () => sendPetAction(window, "play") },
    { label: "聊聊天", click: () => sendPetAction(window, "talk") },
    { label: "让他休息", click: () => sendPetAction(window, "sleep") },
    {
      label: "动作表演",
      submenu: [
        { label: "走一走", click: () => wander(window, petId, "walk") },
        { label: "跑一圈", click: () => wander(window, petId, "run") },
        { label: "跳个舞", click: () => wander(window, petId, "dance") },
        { label: "跳起来", click: () => wander(window, petId, "jump") },
        { label: "伸个懒腰", click: () => wander(window, petId, "stretch") },
        { label: "挥挥手", click: () => wander(window, petId, "wave") },
        { label: "把手从兜里拿出来", click: () => sendPetAction(window, "pull-out") }
      ]
    },
    {
      label: "双人互动",
      enabled: interactionPartners.length > 0,
      submenu: [
        { label: "亲一下", submenu: partnerMenu("kiss") },
        { label: "抱一下", submenu: partnerMenu("hug") },
        { label: "打架", submenu: partnerMenu("fight") },
        { label: "一起躺平", submenu: partnerMenu("sleep") }
      ]
    },
    {
      label: `角色大小（${Math.round(scale * 100)}%）`,
      submenu: [
        { label: "缩小一点", enabled: scale > MIN_PET_SCALE, click: () => adjustPetScale(window, petId, -PET_SCALE_STEP) },
        { label: "放大一点", enabled: scale < MAX_PET_SCALE, click: () => adjustPetScale(window, petId, PET_SCALE_STEP) },
        { type: "separator" },
        ...scaleOptions.map((option) => ({
          label: `${Math.round(option * 100)}%${option === 1 ? "（默认）" : ""}`,
          type: "radio",
          checked: Math.abs(scale - option) < 0.01,
          click: () => setPetScale(window, petId, option)
        }))
      ]
    },
    {
      label: `旋转角色（${Math.round(rotation)}°）`,
      submenu: [
        { label: "向左转 15°", click: () => setPetRotation(window, petId, rotation - 15) },
        { label: "向右转 15°", click: () => setPetRotation(window, petId, rotation + 15) },
        { label: "转到背面", click: () => setPetRotation(window, petId, 180) },
        { type: "separator" },
        { label: "恢复正面", click: () => setPetRotation(window, petId, 0) }
      ]
    },
    {
      label: "管理显示角色",
      submenu: allPetDefinitions().map((pet) => ({
        label: pet.name,
        type: "checkbox",
        checked: layout.visiblePetIds.includes(pet.id),
        enabled: !layout.visiblePetIds.includes(pet.id) || layout.visiblePetIds.length > 1,
        click: (item) => setPetVisible(pet.id, item.checked)
      }))
    },
    { type: "separator" },
    { label: "偶尔活动并靠边休息", type: "checkbox", checked: layout.wander, click: (item) => toggleWander(item.checked) },
    { label: "保持在最上层", type: "checkbox", checked: layout.alwaysOnTop, click: (item) => setAlwaysOnTop(item.checked) },
    { label: "用照片创建新角色…", click: openCreatorInHub },
    { label: "打开桌宠小屋…", click: createHubWindow },
    { type: "separator" },
    { label: "退出全部桌宠", click: () => { quitting = true; app.quit(); } }
  ];
  Menu.buildFromTemplate(template).popup({ window });
}

const DIRECT_MOTIONS = new Set(["walk", "run", "dance", "jump", "stretch", "wave", "pull-out"]);
const DIRECT_PAIR_ACTIONS = new Set(["kiss", "hug", "fight", "sleep"]);

function petIdForWindow(window) {
  return [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
}

function performPetMotion(window, action) {
  const petId = petIdForWindow(window);
  if (!petId || !DIRECT_MOTIONS.has(action)) return false;
  if (action === "pull-out") sendPetAction(window, action);
  else wander(window, petId, action);
  return true;
}

function performPairInteraction(window, companionId, action) {
  const petId = petIdForWindow(window);
  if (!petId || petId === companionId || !DIRECT_PAIR_ACTIONS.has(action)) return false;
  if (!layout.visiblePetIds.includes(companionId) || !petWindows.has(companionId)) return false;
  pairInteraction(petId, companionId, action);
  return true;
}

function relationshipKey(firstId, secondId) {
  return [String(firstId), String(secondId)].sort().join(":");
}

function defaultRelationship(firstId, secondId) {
  const key = relationshipKey(firstId, secondId);
  if (key === relationshipKey("lan", "bo")) return 72;
  return PET_IDS.includes(firstId) && PET_IDS.includes(secondId) ? 50 : 35;
}

function relationshipValue(firstId, secondId) {
  return clamp(Number(layout.relationships?.[relationshipKey(firstId, secondId)] ?? defaultRelationship(firstId, secondId)), 0, 100);
}

function syncRelationships(value) {
  if (!value || typeof value !== "object") return layout.relationships || {};
  layout.relationships = Object.fromEntries(Object.entries(value)
    .filter(([key, score]) => key.includes(":") && Number.isFinite(Number(score)))
    .map(([key, score]) => [key, clamp(Number(score), 0, 100)]));
  saveLayout();
  scheduleRelationshipInteraction();
  return layout.relationships;
}

function changeRelationship(firstId, secondId, delta) {
  const key = relationshipKey(firstId, secondId);
  const next = clamp(relationshipValue(firstId, secondId) + Number(delta || 0), 0, 100);
  layout.relationships = { ...layout.relationships, [key]: next };
  saveLayout();
  if (hubWindow && !hubWindow.isDestroyed()) hubWindow.webContents.send("pet:relationships-changed", layout.relationships);
}

function automaticPairAction(intimacy) {
  if (intimacy >= 90) return Math.random() < 0.55 ? "hug" : "kiss";
  if (intimacy >= 80) return Math.random() < 0.7 ? "kiss" : "hug";
  return "kiss";
}

function scheduleRelationshipInteraction() {
  clearTimeout(relationshipTimer);
  if (!layout.wander) return;
  relationshipTimer = setTimeout(() => {
    const pairs = [];
    const ids = layout.visiblePetIds.filter((id) => petWindows.has(id));
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) {
        const intimacy = relationshipValue(ids[first], ids[second]);
        if (intimacy >= AUTO_PAIR_INTIMACY) pairs.push({ firstId: ids[first], secondId: ids[second], intimacy });
      }
    }
    if (pairs.length) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      pairInteraction(pair.firstId, pair.secondId, automaticPairAction(pair.intimacy), { automatic: true });
    }
    scheduleRelationshipInteraction();
  }, 180_000 + Math.round(Math.random() * 240_000));
}

function adjustPetScale(window, petId, delta) {
  return setPetScale(window, petId, clampPetScale(layout.scales?.[petId]) + Number(delta || 0));
}

function setPetScale(window, petId, requestedScale) {
  if (!window || window.isDestroyed()) return 1;
  unfoldPet(window, petId, { animate: false });
  const scale = clampPetScale(requestedScale);
  stopMovement(window);
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  window.setBounds(scaledPetBounds(window.getBounds(), scale, area), false);
  layout.scales[petId] = scale;
  saveWindowPosition(window);
  saveLayout();
  window.webContents.send("pet:scale", scale);
  return scale;
}

function normalizePetRotation(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const wrapped = ((numeric + 180) % 360 + 360) % 360 - 180;
  return Math.round(wrapped * 10) / 10;
}

function setPetRotation(window, petId, requestedRotation) {
  if (!window || window.isDestroyed()) return 0;
  const rotation = normalizePetRotation(requestedRotation);
  layout.rotations[petId] = rotation;
  saveLayout();
  window.webContents.send("pet:rotation", rotation);
  return rotation;
}

function sendPetAction(window, action) {
  if (!window.isDestroyed()) window.webContents.send("pet:action", action);
}

function startDrag(window) {
  stopDrag(window);
  stopMovement(window);
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (petId) unfoldPet(window, petId, { animate: false });
  const cursor = screen.getCursorScreenPoint();
  const [originX, originY] = window.getPosition();
  const session = {
    timer: setInterval(() => {
      if (window.isDestroyed()) return stopDrag(window);
      const point = screen.getCursorScreenPoint();
      window.setPosition(originX + point.x - cursor.x, originY + point.y - cursor.y, false);
    }, 16)
  };
  dragSessions.set(window.id, session);
}

function stopDrag(window) {
  const session = dragSessions.get(window.id);
  if (session) clearInterval(session.timer);
  dragSessions.delete(window.id);
  if (!window.isDestroyed()) {
    saveWindowPosition(window);
    const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
    if (petId) scheduleWander(petId);
  }
}

function saveWindowPosition(window) {
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (!petId || foldedPets.has(petId)) return;
  const [x, y] = window.getPosition();
  layout.positions[petId] = { x, y };
  saveLayout();
}

function scheduleWander(petId) {
  clearTimeout(wanderTimers.get(petId));
  if (!layout.wander) return;
  const delay = foldedPets.has(petId)
    ? nextActivityDelay(layout.visiblePetIds.length)
    : nextRestDelay();
  const timer = setTimeout(() => {
    const window = petWindows.get(petId);
    if (!window || window.isDestroyed() || dragSessions.has(window.id)) return scheduleWander(petId);
    if (!foldedPets.has(petId)) {
      foldPet(window, petId);
      scheduleWander(petId);
      return;
    }
    unfoldPet(window, petId, {
      animate: true,
      onComplete: () => {
        if (window.isDestroyed() || dragSessions.has(window.id)) return;
        wander(window, petId, occasionalAction());
        scheduleWander(petId);
      }
    });
  }, delay);
  wanderTimers.set(petId, timer);
}

function wander(window, petId, requestedAction) {
  unfoldPet(window, petId, { animate: false });
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const leftEdge = area.x - 40;
  const rightEdge = area.x + area.width - bounds.width + 40;
  const preferredDirection = Math.random() > 0.5 ? 1 : -1;
  const direction = bounds.x < leftEdge + 120 ? 1 : bounds.x > rightEdge - 120 ? -1 : preferredDirection;
  const roll = Math.random();
  const action = ["walk", "run", "dance", "jump", "stretch", "wave"].includes(requestedAction)
    ? requestedAction
    : roll < 0.42 ? "walk" : roll < 0.68 ? "run" : roll < 0.86 ? "dance" : "jump";
  const distance = action === "run"
    ? 190 + Math.round(Math.random() * 130)
    : action === "walk"
      ? 100 + Math.round(Math.random() * 100)
      : action === "jump"
        ? 38 + Math.round(Math.random() * 42)
        : 0;
  const targetX = clamp(bounds.x + direction * distance, leftEdge, rightEdge);
  const duration = action === "run"
    ? 1_450 + Math.round(Math.random() * 650)
    : action === "dance"
      ? 3_000 + Math.round(Math.random() * 900)
      : action === "jump"
        ? 1_250 + Math.round(Math.random() * 450)
        : action === "stretch"
          ? 2_300 + Math.round(Math.random() * 500)
          : action === "wave"
            ? 1_700 + Math.round(Math.random() * 400)
        : 2_600 + Math.round(Math.random() * 1_600);
  const startedAt = Date.now();

  stopMovement(window);
  window.webContents.send("pet:wander", { action, direction, duration });

  const timer = setInterval(() => {
    if (window.isDestroyed() || dragSessions.has(window.id)) return stopMovement(window);
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const danceOffset = action === "dance" ? Math.sin(progress * Math.PI * 6) * 20 : 0;
    const jumpOffset = action === "jump" ? Math.sin(progress * Math.PI) * 48 : 0;
    const nextX = action === "dance" ? bounds.x + danceOffset : bounds.x + (targetX - bounds.x) * eased;
    const nextY = Math.max(area.y - 10, bounds.y - jumpOffset);
    window.setPosition(Math.round(clamp(nextX, leftEdge, rightEdge)), Math.round(nextY), false);
    if (progress >= 1) {
      stopMovement(window);
      saveWindowPosition(window);
    }
  }, 16);
  movementTimers.set(petId, timer);
}

function pairInteraction(petId, companionId, action, { automatic = false } = {}) {
  const first = petWindows.get(petId);
  if (!first || first.isDestroyed()) return;
  const second = petWindows.get(companionId);
  if (!companionId || companionId === petId || !layout.visiblePetIds.includes(companionId) || !second || second.isDestroyed()) return;

  if (!automatic) changeRelationship(petId, companionId, action === "fight" ? -2 : action === "hug" ? 5 : 3);

  unfoldPet(first, petId, { animate: false });
  unfoldPet(second, companionId, { animate: false });
  const firstBounds = first.getBounds();
  stopDrag(first);
  stopDrag(second);
  stopMovement(first);
  stopMovement(second);
  clearTimeout(wanderTimers.get(petId));
  clearTimeout(wanderTimers.get(companionId));

  const area = screen.getDisplayMatching(firstBounds).workArea;
  const secondBounds = second.getBounds();
  const interaction = {
    kiss: { overlap: 112, duration: 2_800 },
    hug: { overlap: 138, duration: 4_200 },
    fight: { overlap: 64, duration: 4_000 },
    sleep: { overlap: 46, duration: 6_000 }
  }[action] || { overlap: 46, duration: 3_000 };
  const overlap = interaction.overlap;
  const combinedWidth = firstBounds.width + secondBounds.width - overlap;
  const desiredCenter = (firstBounds.x + firstBounds.width / 2 + secondBounds.x + secondBounds.width / 2) / 2;
  const leftX = clamp(Math.round(desiredCenter - combinedWidth / 2), area.x, area.x + area.width - combinedWidth);
  const baseline = Math.min(
    area.y + area.height - Math.max(firstBounds.height, secondBounds.height) - 8,
    Math.max(firstBounds.y, secondBounds.y)
  );
  let arrivals = 0;
  const beginInteraction = () => {
    arrivals += 1;
    if (arrivals !== 2 || first.isDestroyed() || second.isDestroyed()) return;
    saveWindowPosition(first);
    saveWindowPosition(second);
    first.webContents.send("pet:wander", { direction: 1, duration: interaction.duration, action });
    second.webContents.send("pet:wander", { direction: -1, duration: interaction.duration, action });
  };
  movePetWindow(first, petId, { x: leftX, y: baseline }, 650, beginInteraction);
  movePetWindow(second, companionId, { x: leftX + firstBounds.width - overlap, y: baseline }, 650, beginInteraction);

  const resumeAfter = 650 + interaction.duration + 350;
  setTimeout(() => {
    scheduleWander(petId);
    scheduleWander(companionId);
    scheduleRelationshipInteraction();
  }, resumeAfter);
}

function stopMovement(window) {
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (!petId) return;
  clearInterval(movementTimers.get(petId));
  movementTimers.delete(petId);
}

function movePetWindow(window, petId, target, duration, onComplete) {
  if (!window || window.isDestroyed()) return;
  stopMovement(window);
  const origin = window.getBounds();
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (window.isDestroyed() || dragSessions.has(window.id)) return stopMovement(window);
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    window.setPosition(
      Math.round(origin.x + (target.x - origin.x) * eased),
      Math.round(origin.y + (target.y - origin.y) * eased),
      false
    );
    if (progress >= 1) {
      stopMovement(window);
      onComplete?.();
    }
  }, 16);
  movementTimers.set(petId, timer);
}

function foldPet(window, petId) {
  if (!layout.wander || foldedPets.has(petId) || !window || window.isDestroyed()) return false;
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const slot = Math.max(0, allPetIds().indexOf(petId));
  const target = foldedPosition(bounds, area, slot);
  foldedPets.set(petId, { x: bounds.x, y: bounds.y, side: target.side });
  movePetWindow(window, petId, target, EDGE_TRANSITION_MS);
  return true;
}

function unfoldPet(window, petId, { animate = true, onComplete } = {}) {
  const resting = foldedPets.get(petId);
  if (!resting || !window || window.isDestroyed()) {
    onComplete?.();
    return false;
  }
  foldedPets.delete(petId);
  if (!animate) {
    stopMovement(window);
    window.setPosition(resting.x, resting.y, false);
    onComplete?.();
    return true;
  }
  movePetWindow(window, petId, resting, EDGE_TRANSITION_MS, onComplete);
  return true;
}

function revealPet(window) {
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (!petId) return false;
  clearTimeout(wanderTimers.get(petId));
  const revealed = unfoldPet(window, petId, {
    animate: true,
    onComplete: () => scheduleWander(petId)
  });
  if (!revealed) scheduleWander(petId);
  return revealed;
}

function toggleWander(enabled) {
  layout.wander = Boolean(enabled);
  saveLayout();
  for (const [petId, window] of petWindows) {
    if (!layout.wander) {
      clearTimeout(wanderTimers.get(petId));
      stopMovement(window);
      unfoldPet(window, petId, { animate: false });
    } else {
      scheduleWander(petId);
    }
  }
  scheduleRelationshipInteraction();
}

function setAlwaysOnTop(enabled) {
  layout.alwaysOnTop = Boolean(enabled);
  saveLayout();
  for (const window of [...petWindows.values(), hubWindow].filter(Boolean)) {
    if (window.isDestroyed()) continue;
    window.setAlwaysOnTop(layout.alwaysOnTop, "floating");
    window.setVisibleOnAllWorkspaces(layout.alwaysOnTop, { visibleOnFullScreen: layout.alwaysOnTop });
  }
  return layout.alwaysOnTop;
}

function setPetVisible(petId, visible) {
  const ids = allPetIds();
  if (!ids.includes(petId)) return false;
  const selected = new Set(normalizeRuntimeVisiblePetIds(layout.visiblePetIds));
  if (visible) selected.add(petId);
  else if (selected.size > 1) selected.delete(petId);
  else return false;

  layout.visiblePetIds = ids.filter((id) => selected.has(id));
  saveLayout();

  const existing = petWindows.get(petId);
  if (visible && (!existing || existing.isDestroyed())) {
    createPetWindow(petId, layout.visiblePetIds.indexOf(petId));
  } else if (!visible && existing && !existing.isDestroyed()) {
    existing.close();
  }
  broadcastPetVisibility();
  return layout.visiblePetIds.includes(petId);
}

function snapToCorner(window) {
  if (!window || window.isDestroyed()) return;
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  const bounds = window.getBounds();
  window.setPosition(area.x + area.width - bounds.width - 16, area.y + area.height - bounds.height - 16, true);
}

function loadLayout() {
  const file = layoutPath();
  if (!existsSync(file)) return;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    layout = {
      ...layout,
      ...saved,
      visiblePetIds: normalizeRuntimeVisiblePetIds(saved.visiblePetIds),
      positions: { ...layout.positions, ...saved.positions },
      scales: { ...layout.scales, ...saved.scales },
      rotations: { ...layout.rotations, ...saved.rotations }
    };
  } catch {}
}

function saveLayout() {
  try { writeFileSync(layoutPath(), JSON.stringify(layout, null, 2)); } catch {}
}

function layoutPath() {
  return path.join(app.getPath("userData"), "desktop-pet-layout.json");
}

function customPetsPath() {
  return path.join(app.getPath("userData"), "custom-pets.json");
}

function customPetAssetsPath() {
  return path.join(app.getPath("userData"), "custom-pets");
}

function creatorSettingsPath() {
  return path.join(app.getPath("userData"), "pet-creator-settings.json");
}

function codexJobsPath() {
  return path.join(app.getPath("userData"), "generation-jobs");
}

function localBuildSignalPath() {
  return path.join(app.getPath("userData"), "local-build-ready.json");
}

function startLocalBuildWatcher() {
  localUpdateTimer = setInterval(() => {
    if (quitting || generationInProgress) return;
    let signal;
    try { signal = JSON.parse(readFileSync(localBuildSignalPath(), "utf8")); }
    catch { return; }
    if (!Number.isFinite(signal?.builtAt) || signal.builtAt <= appStartedAt) return;
    const appPath = path.resolve(String(signal?.appPath || ""));
    const executable = path.join(appPath, "Contents", "MacOS", "一起摸鱼");
    if (path.basename(appPath) !== "一起摸鱼.app" || !existsSync(executable)) return;

    quitting = true;
    clearInterval(localUpdateTimer);
    app.relaunch({ execPath: executable });
    app.exit(0);
  }, 1_500);
}

function loadCreatorSettings() {
  try { return JSON.parse(readFileSync(creatorSettingsPath(), "utf8")); }
  catch { return {}; }
}

function savedApiKey() {
  const encrypted = loadCreatorSettings().encryptedApiKey;
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return "";
  try { return safeStorage.decryptString(Buffer.from(encrypted, "base64")); }
  catch { return ""; }
}

function saveCreatorSettings({ apiBase, model, apiKey }) {
  const settings = { apiBase, model };
  if (apiKey && safeStorage.isEncryptionAvailable()) {
    settings.encryptedApiKey = safeStorage.encryptString(apiKey).toString("base64");
  }
  writeFileSync(creatorSettingsPath(), JSON.stringify(settings, null, 2));
}

function findCodexBinary() {
  if (cachedCodexBinary && existsSync(cachedCodexBinary)) return cachedCodexBinary;
  const candidates = [
    process.env.CODEX_BINARY,
    ...String(process.env.PATH || "").split(path.delimiter).map((directory) => path.join(directory, "codex")),
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex"
  ].filter(Boolean);
  const directMatch = candidates.find((candidate) => existsSync(candidate));
  if (directMatch) {
    cachedCodexBinary = directMatch;
    return directMatch;
  }

  // Finder-launched apps do not inherit the user's interactive shell PATH.
  // Ask the login shell so NVM, fnm, Volta and similar managers can expose Codex.
  try {
    const output = execFileSync("/bin/zsh", ["-lic", "command -v codex"], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const shellMatch = output.split(/\r?\n/).map((line) => line.trim()).findLast((line) => path.isAbsolute(line) && existsSync(line));
    if (shellMatch) {
      cachedCodexBinary = shellMatch;
      return shellMatch;
    }
  } catch {}
  return "";
}

async function chooseCreatorImage(event) {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner, {
    title: "选择人物照片",
    properties: ["openFile"],
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return selectCreatorImage(event, result.filePaths[0]);
}

function selectCreatorImage(event, filePath) {
  const resolvedPath = path.resolve(String(filePath || ""));
  const extension = path.extname(resolvedPath).toLowerCase();
  if (!existsSync(resolvedPath) || ![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    throw new Error("请拖入 PNG、JPG、JPEG 或 WebP 图片");
  }
  selectedCreatorImages.set(event.sender.id, resolvedPath);
  return { name: path.basename(resolvedPath) };
}

async function generateCustomPet(event, options) {
  if (generationInProgress) throw new Error("已有角色正在生成，请稍候");
  const imagePath = selectedCreatorImages.get(event.sender.id);
  if (!imagePath) throw new Error("请先选择一张人物照片");
  const name = String(options?.name || "").trim().slice(0, 20);
  if (!name) throw new Error("请填写角色名字");
  const provider = options?.provider === "api" ? "api" : "codex";
  generationInProgress = true;

  try {
    if (provider !== "api") throw new Error("Codex 任务必须交给后台工作进程");
    const apiBase = String(options?.apiBase || DEFAULT_API_BASE).trim();
    const model = String(options?.model || DEFAULT_IMAGE_MODEL).trim();
    const apiKey = String(options?.apiKey || "").trim() || savedApiKey();
    const bytes = await generateWithApi({ imagePath, apiBase, apiKey, model, name });
    if (options?.remember) saveCreatorSettings({ apiBase, model, apiKey });
    return addGeneratedPet(bytes, name);
  } finally {
    generationInProgress = false;
  }
}

function startCustomPetGeneration(event, options) {
  const imagePath = selectedCreatorImages.get(event.sender.id);
  if (!imagePath) throw new Error("请先选择一张图片");
  const name = String(options?.name || "").trim().slice(0, 20);
  if (!name) throw new Error("请填写角色名字");
  const provider = ["direct", "api"].includes(options?.provider) ? options.provider : "codex";

  if (provider === "direct") {
    const bytes = readFileSync(imagePath);
    const pet = addGeneratedPet(bytes, name);
    return { imported: true, name: pet.name, petId: pet.id };
  }

  if (provider === "codex") {
    const codexPath = findCodexBinary();
    if (!codexPath) throw new Error("没有找到 Codex CLI，请先安装并运行 codex login");
    const durable = createCodexJob({
      root: codexJobsPath(),
      name,
      imagePath,
      codexPath,
      prompt: [
        "$imagegen",
        buildPetPrompt(name),
        "Use the attached photo as the identity reference.",
        "Save the final PNG exactly as desktop-pet.png in the current working directory.",
        "Do not modify any other files."
      ].join("\n")
    });
    syncDurableCodexJobs();
    ensureCodexWorker();
    return { started: true, jobId: durable.id, name };
  }

  if (generationInProgress) throw new Error("已有 API 角色正在生成，请等待完成通知");
  const job = {
    id: `generation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    provider,
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    message: "正在生成 Q 版桌宠"
  };
  generationJobs = [job, ...generationJobs].slice(0, 20);
  broadcastGenerationJobs();

  void generateCustomPet(event, options).then((pet) => {
    Object.assign(job, { status: "succeeded", finishedAt: Date.now(), message: "已生成并添加到桌面" });
    publishGenerationResult({ ok: true, jobId: job.id, name: pet.name, message: `${pet.name} 已生成并添加到桌面` });
  }).catch((error) => {
    const message = String(error?.message || "生成失败，请检查配置后重试").slice(0, 240);
    Object.assign(job, { status: "failed", finishedAt: Date.now(), message });
    publishGenerationResult({ ok: false, jobId: job.id, name, message });
  });
  return { started: true, jobId: job.id, name };
}

function addGeneratedPet(bytes, name) {
  const image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new Error("生成结果不是有效图片");
  const pet = createCustomPetRecord(name);
  mkdirSync(customPetAssetsPath(), { recursive: true });
  writeFileSync(path.join(customPetAssetsPath(), pet.imageFile), image.toPNG());
  customPets.push(pet);
  saveCustomPets(customPetsPath(), customPets);
  layout.visiblePetIds = [...normalizeRuntimeVisiblePetIds(layout.visiblePetIds), pet.id];
  saveLayout();
  createPetWindow(pet.id, layout.visiblePetIds.indexOf(pet.id));
  return { id: pet.id, name: pet.name };
}

function ensureCodexWorker() {
  const lockPidPath = path.join(codexJobsPath(), ".worker-lock", "pid");
  try {
    const pid = Number(readFileSync(lockPidPath, "utf8"));
    process.kill(pid, 0);
    return;
  } catch {}
  const supportDirectory = path.join(app.getPath("userData"), "worker-runtime");
  mkdirSync(supportDirectory, { recursive: true });
  for (const fileName of ["codex-worker.cjs", "codex-job-store.cjs"]) {
    writeFileSync(path.join(supportDirectory, fileName), readFileSync(path.join(__dirname, fileName)));
  }
  const codexPath = findCodexBinary();
  const nodePath = codexPath ? path.join(path.dirname(codexPath), "node") : "";
  const workerRuntime = nodePath && existsSync(nodePath) ? nodePath : process.execPath;
  const worker = spawn(workerRuntime, [path.join(supportDirectory, "codex-worker.cjs"), codexJobsPath()], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
  });
  worker.unref();
}

function syncDurableCodexJobs() {
  const durableJobs = readCodexJobs(codexJobsPath());
  const volatileJobs = generationJobs.filter((job) => job.provider !== "codex");
  generationJobs = [...durableJobs.map(({ directory, inputPath, outputPath, acknowledgement, ...job }) => job), ...volatileJobs]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 20);

  for (const job of durableJobs) {
    if (!["succeeded", "failed"].includes(job.status) || job.acknowledgement) continue;
    let result = { ok: job.status === "succeeded", jobId: job.id, name: job.name, message: job.message };
    try {
      if (job.status === "succeeded") {
        const pet = addGeneratedPet(readFileSync(job.outputPath), job.name);
        result = { ok: true, jobId: job.id, name: pet.name, message: `${pet.name} 已生成并添加到桌面` };
        acknowledgeCodexJob(job.directory, { acknowledgedAt: Date.now(), petId: pet.id });
      } else {
        acknowledgeCodexJob(job.directory, { acknowledgedAt: Date.now(), error: job.message });
      }
    } catch (error) {
      const message = String(error?.message || "生成图片无法添加到桌面").slice(0, 240);
      writeJsonAtomic(path.join(job.directory, "status.json"), { ...job, status: "failed", finishedAt: Date.now(), message });
      acknowledgeCodexJob(job.directory, { acknowledgedAt: Date.now(), error: message });
      result = { ok: false, jobId: job.id, name: job.name, message };
    } finally {
      rmSync(job.inputPath, { force: true });
      if (result.ok) rmSync(job.outputPath, { force: true });
    }
    publishGenerationResult(result);
  }
  broadcastGenerationJobs();
  if (durableJobs.some((job) => ["queued", "running"].includes(job.status))) ensureCodexWorker();
}

function publishGenerationResult(result) {
  broadcastGenerationJobs();
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send("creator:generation-finished", result);
  }
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: result.ok ? "桌宠生成完成" : "桌宠生成失败",
    body: result.message,
    silent: false
  });
  if (!result.ok) notification.on("click", openCreatorInHub);
  notification.show();
}

function publicGenerationJobs() {
  return generationJobs.map(({ id, name, provider, status, startedAt, finishedAt, message }) => ({
    id, name, provider, status, startedAt, finishedAt, message
  }));
}

function broadcastGenerationJobs() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send("creator:generation-jobs", publicGenerationJobs());
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

app.whenReady().then(() => {
  mkdirSync(customPetAssetsPath(), { recursive: true });
  customPets = loadCustomPets(customPetsPath(), customPetAssetsPath());
  loadLayout();
  mkdirSync(codexJobsPath(), { recursive: true });
  syncDurableCodexJobs();
  codexJobPollTimer = setInterval(syncDurableCodexJobs, 1_500);
  startLocalBuildWatcher();
  if (process.platform === "darwin") app.dock?.hide();

  ipcMain.on("window:minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.on("window:snap", (event) => snapToCorner(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("window:set-always-on-top", (_event, value) => setAlwaysOnTop(value));
  ipcMain.on("pet:set-ignore-mouse", (event, ignore) => BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(Boolean(ignore), { forward: true }));
  ipcMain.on("pet:start-drag", (event) => startDrag(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.on("pet:stop-drag", (event) => stopDrag(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.on("pet:menu", (event, petId) => showPetMenu(BrowserWindow.fromWebContents(event.sender), petId));
  ipcMain.handle("pet:perform-motion", (event, action) => performPetMotion(BrowserWindow.fromWebContents(event.sender), action));
  ipcMain.handle("pet:perform-pair", (event, companionId, action) => performPairInteraction(BrowserWindow.fromWebContents(event.sender), companionId, action));
  ipcMain.handle("pet:adjust-scale", (event, delta) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
    return petId ? adjustPetScale(window, petId, delta) : 1;
  });
  ipcMain.handle("pet:set-scale", (event, requestedScale) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
    return petId ? setPetScale(window, petId, requestedScale) : 1;
  });
  ipcMain.handle("pet:set-rotation", (event, requestedRotation) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
    return petId ? setPetRotation(window, petId, requestedRotation) : 0;
  });
  ipcMain.handle("pet:unfold", (event) => revealPet(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("pet:sync-relationships", (_event, relationships) => syncRelationships(relationships));
  ipcMain.handle("pet:hide", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
    if (!petId || layout.visiblePetIds.length <= 1) return false;
    setImmediate(() => setPetVisible(petId, false));
    return true;
  });
  ipcMain.on("pet:selected", (event) => {
    const selectedWindow = BrowserWindow.fromWebContents(event.sender);
    for (const window of petWindows.values()) {
      if (!window.isDestroyed()) window.webContents.send("pet:selected", window === selectedWindow);
    }
  });
  ipcMain.on("pet:open-hub", createHubWindow);
  ipcMain.on("creator:open", openCreatorInHub);
  ipcMain.handle("pet:get-definitions", publicPetDefinitions);
  ipcMain.handle("pet:set-visible", (_event, petId, visible) => {
    setPetVisible(String(petId), Boolean(visible));
    return [...layout.visiblePetIds];
  });
  ipcMain.handle("pet:get-custom-image", (_event, petId) => {
    const pet = customPets.find(({ id }) => id === petId);
    if (!pet) return null;
    const bytes = readFileSync(path.join(customPetAssetsPath(), pet.imageFile));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  });
  ipcMain.handle("creator:choose-image", chooseCreatorImage);
  ipcMain.handle("creator:select-dropped-image", selectCreatorImage);
  ipcMain.handle("creator:get-config", () => {
    const settings = loadCreatorSettings();
    return {
      apiBase: settings.apiBase || DEFAULT_API_BASE,
      model: settings.model || DEFAULT_IMAGE_MODEL,
      hasSavedApiKey: Boolean(savedApiKey()),
      codexAvailable: Boolean(findCodexBinary())
    };
  });
  ipcMain.handle("creator:get-jobs", publicGenerationJobs);
  ipcMain.handle("creator:generate", startCustomPetGeneration);

  layout.visiblePetIds.forEach((id, index) => createPetWindow(id, index));
  scheduleRelationshipInteraction();

  app.on("activate", () => {
    if (petWindows.size === 0) {
      layout.visiblePetIds.forEach((id, index) => createPetWindow(id, index));
    }
  });
});

app.on("before-quit", () => {
  quitting = true;
  clearInterval(localUpdateTimer);
  clearInterval(codexJobPollTimer);
  clearTimeout(relationshipTimer);
});
app.on("window-all-closed", () => { if (quitting || process.platform !== "darwin") app.quit(); });
