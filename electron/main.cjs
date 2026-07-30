const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require("electron");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const petWindows = new Map();
const dragSessions = new Map();
const wanderTimers = new Map();
let hubWindow;
let quitting = false;
let layout = { alwaysOnTop: true, wander: true, positions: {} };

const petNames = { lan: "阿蓝", bo: "小博" };

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
  const window = new BrowserWindow({
    width: 280,
    height: 370,
    minWidth: 280,
    minHeight: 370,
    maxWidth: 280,
    maxHeight: 370,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: layout.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    title: `${petNames[petId]} · 桌宠`,
    webPreferences: webPreferences()
  });

  window.setAlwaysOnTop(layout.alwaysOnTop, "floating");
  window.setVisibleOnAllWorkspaces(layout.alwaysOnTop, { visibleOnFullScreen: true });
  window.loadFile(path.join(__dirname, "..", "public", "desktop.html"), { query: { pet: petId } });

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
    petWindows.delete(petId);
  });

  petWindows.set(petId, window);
}

function positionPetWindow(window, petId, index) {
  const saved = layout.positions?.[petId];
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const display = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y });
    const area = display.workArea;
    const x = clamp(saved.x, area.x - 60, area.x + area.width - 220);
    const y = clamp(saved.y, area.y, area.y + area.height - 300);
    window.setPosition(x, y, false);
    return;
  }

  const area = screen.getPrimaryDisplay().workArea;
  const width = window.getBounds().width;
  const spacing = 206;
  const x = area.x + area.width - width - 22 - (1 - index) * spacing;
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
  const template = [
    { label: `摸摸 ${petNames[petId]}`, click: () => sendPetAction(window, "pet") },
    { type: "separator" },
    { label: "喂饭团", click: () => sendPetAction(window, "feed") },
    { label: "陪他玩", click: () => sendPetAction(window, "play") },
    { label: "聊聊天", click: () => sendPetAction(window, "talk") },
    { label: "让他休息", click: () => sendPetAction(window, "sleep") },
    { type: "separator" },
    { label: "自由散步", type: "checkbox", checked: layout.wander, click: (item) => toggleWander(item.checked) },
    { label: "保持在最上层", type: "checkbox", checked: layout.alwaysOnTop, click: (item) => setAlwaysOnTop(item.checked) },
    { label: "打开桌宠小屋…", click: createHubWindow },
    { type: "separator" },
    { label: "退出两只桌宠", click: () => { quitting = true; app.quit(); } }
  ];
  Menu.buildFromTemplate(template).popup({ window });
}

function sendPetAction(window, action) {
  if (!window.isDestroyed()) window.webContents.send("pet:action", action);
}

function startDrag(window) {
  stopDrag(window);
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
  const delay = 9_000 + Math.round(Math.random() * 8_000);
  const timer = setTimeout(() => {
    const window = petWindows.get(petId);
    if (window && !window.isDestroyed() && !dragSessions.has(window.id)) wander(window, petId);
    scheduleWander(petId);
  }, delay);
  wanderTimers.set(petId, timer);
}

function wander(window, petId) {
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const distance = 28 + Math.round(Math.random() * 28);
  const targetX = clamp(bounds.x + direction * distance, area.x - 40, area.x + area.width - bounds.width + 40);
  window.webContents.send("pet:wander", direction);
  window.setPosition(targetX, bounds.y, true);
  saveWindowPosition(window);
}

function toggleWander(enabled) {
  layout.wander = Boolean(enabled);
  saveLayout();
  for (const petId of petWindows.keys()) scheduleWander(petId);
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
    layout = { ...layout, ...JSON.parse(readFileSync(file, "utf8")), positions: { ...layout.positions, ...JSON.parse(readFileSync(file, "utf8")).positions } };
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
  ipcMain.on("pet:open-hub", createHubWindow);

  createPetWindow("lan", 0);
  createPetWindow("bo", 1);

  app.on("activate", () => {
    if (petWindows.size === 0) {
      createPetWindow("lan", 0);
      createPetWindow("bo", 1);
    }
  });
});

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { if (quitting || process.platform !== "darwin") app.quit(); });
