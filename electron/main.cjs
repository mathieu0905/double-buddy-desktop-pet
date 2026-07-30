const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require("electron");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
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
const { PET_DEFINITIONS, PET_IDS, getPetDefinition, normalizeVisiblePetIds } = require("./pets.cjs");

const petWindows = new Map();
const dragSessions = new Map();
const wanderTimers = new Map();
const movementTimers = new Map();
let hubWindow;
let quitting = false;
let layout = { alwaysOnTop: true, wander: true, visiblePetIds: [...PET_IDS], positions: {}, scales: {} };

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

function createPetWindow(petId, index) {
  const definition = getPetDefinition(petId);
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
      image: definition.image,
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
  const visibleCount = normalizeVisiblePetIds(layout.visiblePetIds).length;
  const spacing = visibleCount > 1 ? Math.min(190, availableWidth / (visibleCount - 1)) : 0;
  const x = area.x + area.width - width - 22 - (visibleCount - 1 - index) * spacing;
  const y = area.y + area.height - window.getBounds().height - 8;
  window.setPosition(Math.round(x), Math.round(y), false);
}

function createHubWindow() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.show();
    hubWindow.focus();
    return;
  }

  hubWindow = new BrowserWindow({
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

  hubWindow.setAlwaysOnTop(layout.alwaysOnTop, "floating");
  hubWindow.loadFile(path.join(__dirname, "..", "public", "index.html"));
  hubWindow.once("ready-to-show", () => {
    snapToCorner(hubWindow);
    hubWindow.show();
  });
  hubWindow.on("closed", () => { hubWindow = undefined; });
}

function showPetMenu(window, petId) {
  const definition = getPetDefinition(petId);
  const scale = clampPetScale(layout.scales?.[petId]);
  const scaleOptions = [0.7, 0.85, 1, 1.25, 1.6];
  const template = [
    { label: `摸摸 ${definition.name}`, click: () => sendPetAction(window, "pet") },
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
        { label: "跳起来", click: () => wander(window, petId, "jump") }
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
      label: "显示角色",
      submenu: PET_DEFINITIONS.map((pet) => ({
        label: pet.name,
        type: "checkbox",
        checked: layout.visiblePetIds.includes(pet.id),
        enabled: !layout.visiblePetIds.includes(pet.id) || layout.visiblePetIds.length > 1,
        click: (item) => setPetVisible(pet.id, item.checked)
      }))
    },
    { type: "separator" },
    { label: "自由活动（走路 / 跑步 / 跳舞 / 跳跃）", type: "checkbox", checked: layout.wander, click: (item) => toggleWander(item.checked) },
    { label: "保持在最上层", type: "checkbox", checked: layout.alwaysOnTop, click: (item) => setAlwaysOnTop(item.checked) },
    { label: "打开桌宠小屋…", click: createHubWindow },
    { type: "separator" },
    { label: "退出全部桌宠", click: () => { quitting = true; app.quit(); } }
  ];
  Menu.buildFromTemplate(template).popup({ window });
}

function adjustPetScale(window, petId, delta) {
  return setPetScale(window, petId, clampPetScale(layout.scales?.[petId]) + Number(delta || 0));
}

function setPetScale(window, petId, requestedScale) {
  if (!window || window.isDestroyed()) return 1;
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

function sendPetAction(window, action) {
  if (!window.isDestroyed()) window.webContents.send("pet:action", action);
}

function startDrag(window) {
  stopDrag(window);
  stopMovement(window);
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
  if (!window.isDestroyed()) saveWindowPosition(window);
}

function saveWindowPosition(window) {
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (!petId) return;
  const [x, y] = window.getPosition();
  layout.positions[petId] = { x, y };
  saveLayout();
}

function scheduleWander(petId) {
  clearTimeout(wanderTimers.get(petId));
  if (!layout.wander) return;
  const delay = 4_000 + Math.round(Math.random() * 5_000);
  const timer = setTimeout(() => {
    const window = petWindows.get(petId);
    if (window && !window.isDestroyed() && !dragSessions.has(window.id)) wander(window, petId);
    scheduleWander(petId);
  }, delay);
  wanderTimers.set(petId, timer);
}

function wander(window, petId, requestedAction) {
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const leftEdge = area.x - 40;
  const rightEdge = area.x + area.width - bounds.width + 40;
  const preferredDirection = Math.random() > 0.5 ? 1 : -1;
  const direction = bounds.x < leftEdge + 120 ? 1 : bounds.x > rightEdge - 120 ? -1 : preferredDirection;
  const roll = Math.random();
  const action = ["walk", "run", "dance", "jump"].includes(requestedAction)
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

function stopMovement(window) {
  const petId = [...petWindows.entries()].find(([, candidate]) => candidate === window)?.[0];
  if (!petId) return;
  clearInterval(movementTimers.get(petId));
  movementTimers.delete(petId);
}

function toggleWander(enabled) {
  layout.wander = Boolean(enabled);
  saveLayout();
  for (const [petId, window] of petWindows) {
    if (!layout.wander) stopMovement(window);
    scheduleWander(petId);
  }
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
  if (!PET_IDS.includes(petId)) return false;
  const selected = new Set(normalizeVisiblePetIds(layout.visiblePetIds));
  if (visible) selected.add(petId);
  else if (selected.size > 1) selected.delete(petId);
  else return false;

  layout.visiblePetIds = PET_IDS.filter((id) => selected.has(id));
  saveLayout();

  const existing = petWindows.get(petId);
  if (visible && (!existing || existing.isDestroyed())) {
    createPetWindow(petId, layout.visiblePetIds.indexOf(petId));
  } else if (!visible && existing && !existing.isDestroyed()) {
    existing.close();
  }
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
      visiblePetIds: normalizeVisiblePetIds(saved.visiblePetIds),
      positions: { ...layout.positions, ...saved.positions },
      scales: { ...layout.scales, ...saved.scales }
    };
  } catch {}
}

function saveLayout() {
  try { writeFileSync(layoutPath(), JSON.stringify(layout, null, 2)); } catch {}
}

function layoutPath() {
  return path.join(app.getPath("userData"), "desktop-pet-layout.json");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

app.whenReady().then(() => {
  loadLayout();
  if (process.platform === "darwin") app.dock?.hide();

  ipcMain.on("window:minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.on("window:snap", (event) => snapToCorner(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle("window:set-always-on-top", (_event, value) => setAlwaysOnTop(value));
  ipcMain.on("pet:set-ignore-mouse", (event, ignore) => BrowserWindow.fromWebContents(event.sender)?.setIgnoreMouseEvents(Boolean(ignore), { forward: true }));
  ipcMain.on("pet:start-drag", (event) => startDrag(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.on("pet:stop-drag", (event) => stopDrag(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.on("pet:menu", (event, petId) => showPetMenu(BrowserWindow.fromWebContents(event.sender), petId));
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
  ipcMain.on("pet:selected", (event) => {
    const selectedWindow = BrowserWindow.fromWebContents(event.sender);
    for (const window of petWindows.values()) {
      if (!window.isDestroyed()) window.webContents.send("pet:selected", window === selectedWindow);
    }
  });
  ipcMain.on("pet:open-hub", createHubWindow);

  layout.visiblePetIds.forEach((id, index) => createPetWindow(id, index));

  app.on("activate", () => {
    if (petWindows.size === 0) {
      layout.visiblePetIds.forEach((id, index) => createPetWindow(id, index));
    }
  });
});

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { if (quitting || process.platform !== "darwin") app.quit(); });
