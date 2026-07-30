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
  adjustPetScale: (delta) => ipcRenderer.invoke("pet:adjust-scale", Number(delta)),
  setPetScale: (scale) => ipcRenderer.invoke("pet:set-scale", Number(scale)),
  selectPet: () => ipcRenderer.send("pet:selected"),
  openHub: () => ipcRenderer.send("pet:open-hub"),
  onPetAction: (callback) => ipcRenderer.on("pet:action", (_event, action) => callback(action)),
  onPetWander: (callback) => ipcRenderer.on("pet:wander", (_event, direction) => callback(direction)),
  onPetScale: (callback) => ipcRenderer.on("pet:scale", (_event, scale) => callback(scale)),
  onPetSelected: (callback) => ipcRenderer.on("pet:selected", (_event, selected) => callback(Boolean(selected)))
});
