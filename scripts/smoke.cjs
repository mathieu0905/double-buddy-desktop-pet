const { app, BrowserWindow } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 280,
    height: 370,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(__dirname, "..", "public", "desktop.html"), { query: { pet: "lan" } });
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const state = await window.webContents.executeJavaScript(`({
    petName: document.querySelector("#petName")?.textContent,
    imageLoaded: document.querySelector("#petImage")?.complete,
    desktopBridge: window.desktopPet?.isDesktop
  })`);
  if (state.petName !== "阿蓝" || !state.imageLoaded || !state.desktopBridge) {
    throw new Error(`Desktop pet smoke check failed: ${JSON.stringify(state)}`);
  }

  const image = await window.webContents.capturePage();
  const outputDirectory = path.join(__dirname, "..", ".runtime");
  const outputPath = path.join(outputDirectory, "desktop-pet-smoke.png");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, image.toPNG());
  console.log(outputPath);
  app.quit();
});
