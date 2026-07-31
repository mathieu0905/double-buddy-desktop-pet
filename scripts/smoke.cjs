const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

app.whenReady().then(async () => {
  const smokeDefinitions = (await import("../src/pet.js")).PET_DEFINITIONS;
  let smokeVisibleIds = smokeDefinitions.map(({ id }) => id);
  ipcMain.handle("pet:get-definitions", () => smokeDefinitions.map((definition) => ({
    ...definition,
    visible: smokeVisibleIds.includes(definition.id)
  })));
  ipcMain.handle("pet:set-visible", (_event, petId, visible) => {
    if (visible && !smokeVisibleIds.includes(petId)) smokeVisibleIds.push(petId);
    if (!visible && smokeVisibleIds.length > 1) smokeVisibleIds = smokeVisibleIds.filter((id) => id !== petId);
    return smokeVisibleIds;
  });
  ipcMain.handle("pet:sync-relationships", (_event, relationships) => relationships || {});
  ipcMain.handle("pet:perform-motion", () => true);
  ipcMain.on("pet:selected", (event) => event.sender.send("pet:selected", true));
  ipcMain.on("pet:set-ignore-mouse", () => {});
  ipcMain.handle("creator:get-jobs", () => [
    { id: "smoke-running", name: "测试角色", provider: "codex", status: "running", startedAt: Date.now(), finishedAt: null, message: "正在生成 Q 版桌宠" },
    { id: "smoke-done", name: "旧任务", provider: "api", status: "succeeded", startedAt: Date.now() - 60_000, finishedAt: Date.now(), message: "已生成并添加到桌面" }
  ]);
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
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) console.error(`[desktop:${level}] ${message}`);
  });

  const smokePet = smokeDefinitions.find(({ id }) => id === (process.env.SMOKE_PET || "lan")) || smokeDefinitions[0];
  await window.loadFile(path.join(__dirname, "..", "public", "desktop.html"), { query: {
    pet: smokePet.id,
    name: smokePet.name,
    image: smokePet.image,
    model: smokePet.model,
    hunger: String(smokePet.hunger),
    mood: String(smokePet.mood),
    energy: String(smokePet.energy)
  } });
  await new Promise((resolve) => setTimeout(resolve, 3_000));

  const state = await window.webContents.executeJavaScript(`({
    petName: document.querySelector("#petName")?.textContent,
    imageLoaded: document.querySelector("#petImage")?.complete,
    modelReady: document.querySelector("#petHitbox")?.classList.contains("model-ready"),
    modelCanvas: Boolean(document.querySelector("#petModel canvas")),
    desktopBridge: window.desktopPet?.isDesktop
  })`);
  if (!state.petName || !state.imageLoaded || !state.modelReady || !state.modelCanvas || !state.desktopBridge) {
    throw new Error(`Desktop pet smoke check failed: ${JSON.stringify(state)}`);
  }

  window.show();
  window.focus();
  const quickActionState = await window.webContents.executeJavaScript(`(() => {
    const hitbox = document.querySelector("#petHitbox");
    hitbox.classList.add("is-selected");
    document.querySelector('[data-quick-panel="motion"]').click();
    return {
      toolbarVisible: getComputedStyle(document.querySelector("#quickActions")).display !== "none",
      panelVisible: getComputedStyle(document.querySelector("#quickPanel")).display !== "none",
      primaryActions: document.querySelectorAll("[data-pet-action]").length,
      motions: document.querySelectorAll("[data-pet-motion]").length
    };
  })()`);
  if (!quickActionState.toolbarVisible || !quickActionState.panelVisible
    || quickActionState.primaryActions !== 4 || quickActionState.motions !== 7) {
    throw new Error(`Desktop quick actions smoke check failed: ${JSON.stringify(quickActionState)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 180));
  const quickActionsStillOpen = await window.webContents.executeJavaScript(
    `document.querySelector("#petHitbox").classList.contains("is-selected") && document.querySelector("#quickPanel").classList.contains("is-open")`
  );
  if (!quickActionsStillOpen) throw new Error("Desktop quick actions closed unexpectedly");
  const quickActionImage = await window.webContents.capturePage();
  const outputDirectory = path.join(__dirname, "..", ".runtime");
  const quickActionOutputPath = path.join(outputDirectory, "desktop-pet-quick-actions-smoke.png");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(quickActionOutputPath, quickActionImage.toPNG());
  console.log(quickActionOutputPath);
  const quickActionsHiddenDuringMotion = await window.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-pet-motion="dance"]').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    return getComputedStyle(document.querySelector("#quickActions")).display === "none"
      && getComputedStyle(document.querySelector("#quickPanel")).display === "none";
  })()`);
  if (!quickActionsHiddenDuringMotion) throw new Error("Desktop quick actions remained visible during motion");
  window.hide();

  const image = await window.webContents.capturePage();
  const outputPath = path.join(outputDirectory, "desktop-pet-smoke.png");
  await writeFile(outputPath, image.toPNG());
  console.log(outputPath);

  if (process.env.SMOKE_ACTION) {
    window.show();
    window.webContents.send("pet:action", process.env.SMOKE_ACTION);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const actionImage = await window.webContents.capturePage();
    const actionOutputPath = path.join(outputDirectory, `desktop-pet-${process.env.SMOKE_ACTION}-smoke.png`);
    await writeFile(actionOutputPath, actionImage.toPNG());
    console.log(actionOutputPath);
  }

  window.webContents.send("pet:wander", { direction: 1, duration: 3_200, action: "dance" });
  await new Promise((resolve) => setTimeout(resolve, 700));
  const danceImage = await window.webContents.capturePage();
  const danceOutputPath = path.join(outputDirectory, "desktop-pet-dance-smoke.png");
  await writeFile(danceOutputPath, danceImage.toPNG());
  console.log(danceOutputPath);

  window.webContents.send("pet:rotation", 65);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const rotationImage = await window.webContents.capturePage();
  const rotationOutputPath = path.join(outputDirectory, "desktop-pet-rotation-smoke.png");
  await writeFile(rotationOutputPath, rotationImage.toPNG());
  console.log(rotationOutputPath);

  for (const action of ["kiss", "hug", "fight"]) {
    const duration = action === "kiss" ? 2_800 : action === "hug" ? 4_200 : 4_000;
    window.webContents.send("pet:wander", { direction: 1, duration, action });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const interactionImage = await window.webContents.capturePage();
    const interactionOutputPath = path.join(outputDirectory, `desktop-pet-${action}-smoke.png`);
    await writeFile(interactionOutputPath, interactionImage.toPNG());
    console.log(interactionOutputPath);
  }

  for (const action of ["stretch", "wave"]) {
    const duration = action === "stretch" ? 2_600 : 1_800;
    window.webContents.send("pet:wander", { direction: 1, duration, action });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const actionImage = await window.webContents.capturePage();
    const actionOutputPath = path.join(outputDirectory, `desktop-pet-${action}-smoke.png`);
    await writeFile(actionOutputPath, actionImage.toPNG());
    console.log(actionOutputPath);
  }

  const hub = new BrowserWindow({
    width: 700,
    height: 590,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await hub.loadFile(path.join(__dirname, "..", "public", "index.html"));
  await new Promise((resolve) => setTimeout(resolve, 4_500));
  const hubState = await hub.webContents.executeJavaScript(`({
    cards: document.querySelectorAll(".pet-card").length,
    tabs: document.querySelectorAll(".pet-tab").length,
    toggles: document.querySelectorAll(".visibility-toggle").length,
    checkedToggles: document.querySelectorAll(".visibility-toggle.checked").length,
    loadedImages: [...document.querySelectorAll(".pet-card img")].filter((image) => image.complete && image.naturalWidth > 0).length,
    modelCanvases: document.querySelectorAll(".pet-card-model canvas").length,
    readyModels: document.querySelectorAll(".pet-card.model-ready").length
  })`);
  if (hubState.cards !== 7 || hubState.tabs !== 7 || hubState.toggles !== 7 || hubState.checkedToggles !== 7
    || hubState.loadedImages !== 7 || hubState.modelCanvases !== 7 || hubState.readyModels !== 7) {
    throw new Error(`All-pets hub smoke check failed: ${JSON.stringify(hubState)}`);
  }
  const visibilityState = await hub.webContents.executeJavaScript(`(async () => {
    document.querySelector(".visibility-toggle").click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    return document.querySelectorAll(".visibility-toggle.checked").length;
  })()`);
  if (visibilityState !== 6) throw new Error(`Pet visibility toggle smoke check failed: ${visibilityState}`);
  const hubImage = await hub.webContents.capturePage();
  const hubOutputPath = path.join(outputDirectory, "all-pets-hub-smoke.png");
  await writeFile(hubOutputPath, hubImage.toPNG());
  console.log(hubOutputPath);
  const detailState = await hub.webContents.executeJavaScript(`(async () => {
    document.querySelectorAll(".pet-card")[1].click();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const dialog = document.querySelector("#petDetailDialog");
    return {
      open: dialog.open,
      name: document.querySelector("#petDetailName").textContent,
      relationships: document.querySelectorAll(".relationship-card").length,
      actions: document.querySelectorAll("[data-detail-action]").length,
      modelReady: document.querySelector("#petDetailPortrait").classList.contains("model-ready"),
      modelCanvas: Boolean(document.querySelector("#petDetailModel canvas"))
    };
  })()`);
  if (!detailState.open || detailState.relationships !== 6 || detailState.actions !== 6 || !detailState.modelReady || !detailState.modelCanvas) {
    throw new Error(`Pet detail smoke check failed: ${JSON.stringify(detailState)}`);
  }
  const detailImage = await hub.webContents.capturePage();
  const detailOutputPath = path.join(outputDirectory, "pet-detail-smoke.png");
  await writeFile(detailOutputPath, detailImage.toPNG());
  console.log(detailOutputPath);
  const creatorState = await hub.webContents.executeJavaScript(`(() => {
    document.querySelector("#petDetailDialog").close();
    const dialog = document.querySelector("#creatorDialog");
    dialog.showModal();
    const bounds = dialog.getBoundingClientRect();
    return { open: dialog.open, width: bounds.width, height: bounds.height };
  })()`);
  if (!creatorState.open || creatorState.width < 400 || creatorState.height > 570) {
    throw new Error(`Integrated creator smoke check failed: ${JSON.stringify(creatorState)}`);
  }
  const creatorImage = await hub.webContents.capturePage();
  const creatorOutputPath = path.join(outputDirectory, "integrated-creator-smoke.png");
  await writeFile(creatorOutputPath, creatorImage.toPNG());
  console.log(creatorOutputPath);
  const taskState = await hub.webContents.executeJavaScript(`(async () => {
    document.querySelector("#creatorDialog").close();
    document.querySelector("#generationTasksButton").click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      open: document.querySelector("#generationTasksDialog").open,
      tasks: document.querySelectorAll(".generation-task").length
    };
  })()`);
  if (!taskState.open || taskState.tasks !== 2) {
    throw new Error(`Generation tasks smoke check failed: ${JSON.stringify(taskState)}`);
  }
  const taskImage = await hub.webContents.capturePage();
  const taskOutputPath = path.join(outputDirectory, "generation-tasks-smoke.png");
  await writeFile(taskOutputPath, taskImage.toPNG());
  console.log(taskOutputPath);
  app.quit();
});
