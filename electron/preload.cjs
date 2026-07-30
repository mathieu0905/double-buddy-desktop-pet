const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  snapToCorner: () => ipcRenderer.send("window:snap"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:set-always-on-top", Boolean(value)),
  setIgnoreMouse: (value) => ipcRenderer.send("pet:set-ignore-mouse", Boolean(value)),
  startDrag: () => ipcRenderer.send("pet:start-drag"),
  stopDrag: () => ipcRenderer.send("pet:stop-drag"),
  showPetMenu: (petId) => ipcRenderer.send("pet:menu", petId),
  openHub: () => ipcRenderer.send("pet:open-hub"),
  onPetAction: (callback) => ipcRenderer.on("pet:action", (_event, action) => callback(action)),
  onPetWander: (callback) => ipcRenderer.on("pet:wander", (_event, direction) => callback(direction))
});
