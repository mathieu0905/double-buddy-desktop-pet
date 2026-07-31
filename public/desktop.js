import { createPetRenderer } from "./pet-renderer.js";

const params = new URLSearchParams(location.search);
const petId = params.get("pet") || "lan";
const desktop = window.desktopPet;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.6;
const STORAGE_KEY = "double-buddy.pet-state.v1";
const EXTRA_STORAGE_KEY = "double-buddy.extra-pet-state.v1";
const HUB_PET_IDS = new Set(["lan", "bo"]);
const FALLBACK_IMAGES = { lan: "./assets/left-pet.png", bo: "./assets/right-pet.png" };
const config = {
  name: params.get("name") || (petId === "bo" ? "其其" : "昂昂"),
  image: params.get("image") || FALLBACK_IMAGES[petId] || "",
  model: params.get("model") || "",
  rotation: numberParam("rotation", 0),
  hunger: numberParam("hunger", petId === "bo" ? 82 : 86),
  mood: numberParam("mood", petId === "bo" ? 96 : 92),
  energy: numberParam("energy", petId === "bo" ? 88 : 78)
};

const linesByPet = {
  lan: {
    pet: ["再摸一下也不是不行。", "今天发型没乱吧？", "好耶，充电成功。"],
    feed: ["这个饭团很有眼光。", "吃饱了，才有力气摸鱼。"],
    play: ["球来了——接住！", "下一局我可认真了。"],
    talk: ["我在听，你慢慢说。", "今天也辛苦啦。"],
  sleep: ["那我眯五分钟……", "呼——先暂停营业。"],
  "pull-out": ["终于把手从兜里拿出来了。", "活动一下手腕。"],
    idle: ["今天也一起摸鱼吧。", "忙完记得起来走一走。", "其其怎么又这么精神？"]
  },
  bo: {
    pet: ["哈哈，再来一下！", "收到你的摸摸啦。", "现在元气值爆表！"],
    feed: ["饭团满分，我宣布的。", "毕业之后也要好好吃饭！"],
    play: ["这一球我可不会让！", "来来来，决胜局！"],
    talk: ["讲吧，我保证认真听。", "先笑一个，办法总会有的。"],
  sleep: ["只睡五分钟，真的。", "毕业袍可以当小被子。"],
  "pull-out": ["兜里没有第二个我。", "拿出来活动一下。"],
    idle: ["今天有什么新任务？", "毕业快乐是永久状态！", "累了就歇一会儿吧。"]
  }
};

const lines = linesByPet[petId] || {
  pet: ["收到摸摸啦！", "再来一下也可以。", "今天也很开心。"],
  feed: ["饭团真香！", "吃饱啦，谢谢你。"],
  play: ["来活动一下！", "下一局继续！"],
  talk: ["我在听呢。", "今天也一起加油。"],
  sleep: ["那我休息一会儿。", "晚安，待会见。"],
  "pull-out": ["手手出兜，活动一下。", "终于拿出来啦。"],
  idle: ["今天也一起摸鱼吧。", "需要我的时候叫我。", "大家都在，真热闹。"]
};

const effects = {
  pet: { hunger: 0, mood: 5, energy: 0, bond: 1 },
  feed: { hunger: 18, mood: 3, energy: 1, bond: 1 },
  play: { hunger: -6, mood: 15, energy: -10, bond: 3 },
  talk: { hunger: -1, mood: 9, energy: -1, bond: 2 },
  sleep: { hunger: -2, mood: 2, energy: 20, bond: 1 },
  "pull-out": { hunger: 0, mood: 4, energy: -1, bond: 1 }
};

const ui = {
  root: document.querySelector("#desktopPet"),
  hitbox: document.querySelector("#petHitbox"),
  hideHandle: document.querySelector("#hideHandle"),
  resizeHandle: document.querySelector("#resizeHandle"),
  rotateHandle: document.querySelector("#rotateHandle"),
  quickActions: document.querySelector("#quickActions"),
  quickPanel: document.querySelector("#quickPanel"),
  quickPanelTitle: document.querySelector("#quickPanelTitle"),
  quickPanelGrid: document.querySelector("#quickPanelGrid"),
  closeQuickPanel: document.querySelector("#closeQuickPanel"),
  model: document.querySelector("#petModel"),
  image: document.querySelector("#petImage"),
  name: document.querySelector("#petName"),
  moodText: document.querySelector("#moodText"),
  speech: document.querySelector("#speech"),
  speaker: document.querySelector("#speaker"),
  speechText: document.querySelector("#speechText"),
  hunger: document.querySelector("#hunger"),
  mood: document.querySelector("#mood"),
  energy: document.querySelector("#energy"),
  zzz: document.querySelector("#zzz"),
  particles: document.querySelector("#particles")
};

let state = loadState();
let lastBondIncrease = 0;
let pressedAt = null;
let speechTimer;
let autonomousMotionTimer;
let wheelDelta = 0;
let currentScale = 1;
let currentRotation = normalizeRotation(config.rotation);
let resizeSession = null;
let rotationSession = null;
let modelRenderer = null;
let imageHitCanvas = null;
let imageHitContext = null;
let pointerOverPet = false;
let mouseIgnored = true;

applyScale(params.get("scale"));
applyRotation(currentRotation);

ui.image.addEventListener("load", prepareImageHitMap);
if (config.image) ui.image.src = config.image;
else desktop?.getCustomPetImage?.(petId).then((source) => {
  if (source) ui.image.src = source;
});
if (config.model) {
  ui.hitbox.classList.add("has-model");
  modelRenderer = createPetRenderer({
    container: ui.model,
    modelUrl: config.model,
    rotation: currentRotation,
    onReady: () => ui.hitbox.classList.add("model-ready"),
    onError: (error) => {
      console.error("Unable to load pet model", error);
      modelRenderer?.destroy();
      modelRenderer = null;
    }
  });
}
ui.image.alt = `${state.name}桌面宠物`;
ui.name.textContent = state.name;
ui.speaker.textContent = state.name;
render();

window.addEventListener("mousemove", updatePointerPassThrough);
ui.hitbox.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !isPointOnPet(event.clientX, event.clientY)) return;
  selectPet();
  stopAutonomousMotion();
  pressedAt = { x: event.screenX, y: event.screenY, time: Date.now() };
  ui.hitbox.setPointerCapture?.(event.pointerId);
  desktop?.startDrag?.();
});
ui.hitbox.addEventListener("pointerup", (event) => {
  desktop?.stopDrag?.();
  const press = pressedAt;
  pressedAt = null;
  if (!press) return;
  const moved = Math.hypot(event.screenX - press.x, event.screenY - press.y);
  if (moved < 7 && Date.now() - press.time < 420) interact("pet");
});
ui.hitbox.addEventListener("pointercancel", () => { pressedAt = null; desktop?.stopDrag?.(); });
ui.hitbox.addEventListener("dblclick", (event) => {
  if (isPointOnPet(event.clientX, event.clientY)) desktop?.openHub?.();
});
ui.hitbox.addEventListener("contextmenu", (event) => {
  if (!isPointOnPet(event.clientX, event.clientY)) return;
  event.preventDefault();
  desktop?.stopDrag?.();
  desktop?.showPetMenu?.(petId);
});
ui.hitbox.addEventListener("wheel", (event) => {
  if (!isPointOnPet(event.clientX, event.clientY)) return;
  event.preventDefault();
  selectPet();
  wheelDelta += event.deltaY;
  if (Math.abs(wheelDelta) < 35) return;
  desktop?.adjustPetScale?.(wheelDelta < 0 ? 0.1 : -0.1);
  wheelDelta = 0;
}, { passive: false });
ui.hideHandle.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
});
ui.hideHandle.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const hidden = await desktop?.hidePet?.();
  if (!hidden) showNotice("至少需要保留一个角色");
});
ui.resizeHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  selectPet();
  stopAutonomousMotion();
  resizeSession = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, scale: currentScale, lastScale: currentScale };
  ui.resizeHandle.setPointerCapture?.(event.pointerId);
  desktop?.setIgnoreMouse?.(false);
});
ui.resizeHandle.addEventListener("pointermove", (event) => {
  if (!resizeSession || resizeSession.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const distance = (event.screenX - resizeSession.x) - (event.screenY - resizeSession.y);
  const scale = Math.round((resizeSession.scale + distance / 220) * 20) / 20;
  if (Math.abs(scale - resizeSession.lastScale) < 0.001) return;
  resizeSession.lastScale = scale;
  desktop?.setPetScale?.(scale);
});
ui.resizeHandle.addEventListener("pointerup", finishResize);
ui.resizeHandle.addEventListener("pointercancel", finishResize);
ui.rotateHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  selectPet();
  stopAutonomousMotion();
  rotationSession = { pointerId: event.pointerId, x: event.screenX, rotation: currentRotation, lastRotation: currentRotation };
  ui.rotateHandle.setPointerCapture?.(event.pointerId);
  desktop?.setIgnoreMouse?.(false);
});
ui.rotateHandle.addEventListener("pointermove", (event) => {
  if (!rotationSession || rotationSession.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const rotation = normalizeRotation(rotationSession.rotation + (event.screenX - rotationSession.x) * 0.8);
  if (Math.abs(rotation - rotationSession.lastRotation) < 0.1) return;
  rotationSession.lastRotation = rotation;
  desktop?.setPetRotation?.(rotation);
});
ui.rotateHandle.addEventListener("pointerup", finishRotation);
ui.rotateHandle.addEventListener("pointercancel", finishRotation);
ui.quickActions.addEventListener("pointerdown", stopControlPointerEvent);
ui.quickActions.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-pet-action]");
  if (actionButton) {
    hideQuickControls();
    interact(actionButton.dataset.petAction);
    return;
  }
  const panelButton = event.target.closest("[data-quick-panel]");
  if (panelButton) openQuickPanel(panelButton.dataset.quickPanel);
});
ui.quickPanel.addEventListener("pointerdown", stopControlPointerEvent);
ui.quickPanel.addEventListener("click", async (event) => {
  const motionButton = event.target.closest("[data-pet-motion]");
  if (motionButton) {
    hideQuickControls();
    await desktop?.performPetMotion?.(motionButton.dataset.petMotion);
    return;
  }
  const pairButton = event.target.closest("[data-pair-action]");
  if (pairButton) {
    await openPartnerPicker(pairButton.dataset.pairAction, pairButton.dataset.actionLabel);
    return;
  }
  const partnerButton = event.target.closest("[data-partner-id]");
  if (partnerButton) {
    hideQuickControls();
    await desktop?.performPairInteraction?.(partnerButton.dataset.partnerId, partnerButton.dataset.pairWith);
  }
});
ui.closeQuickPanel.addEventListener("click", closeQuickPanel);
document.body.addEventListener("pointerdown", (event) => {
  if (!ui.hitbox.contains(event.target)) deselectPet();
});
document.body.addEventListener("mouseleave", () => {
  pointerOverPet = false;
  if (!pressedAt && !resizeSession && !rotationSession) setMouseIgnored(true);
});
window.addEventListener("blur", deselectPet);

desktop?.onPetAction?.((action) => {
  hideQuickControls();
  interact(action);
});
desktop?.onPetWander?.((detail) => {
  hideQuickControls();
  const direction = typeof detail === "number" ? detail : detail?.direction;
  const duration = typeof detail === "object" ? detail.duration : 850;
  const action = typeof detail === "object" ? detail.action || "walk" : "walk";
  stopAutonomousMotion();
  modelRenderer?.play(action, { direction });
  void ui.hitbox.offsetWidth;
  ui.hitbox.style.setProperty("--motion-duration", `${duration}ms`);
  ui.hitbox.classList.add(`motion-${action}`, direction < 0 ? "direction-left" : "direction-right");
  if (action === "dance") spawnParticles(["♪", "♫", "✦"]);
  if (action === "jump") spawnParticles(["✦", "·", "✧"]);
  if (action === "stretch") spawnParticles(["☼", "✦", "·"]);
  if (action === "wave") spawnParticles(["👋", "✦", "·"]);
  if (action === "pull-out") spawnParticles(["✋", "✦", "·"]);
  if (action === "kiss") spawnParticles(["♥", "♡", "💕"]);
  if (action === "hug") spawnParticles(["🫂", "♡", "♥"]);
  if (action === "fight") spawnParticles(["💥", "⚡", "✦"]);
  autonomousMotionTimer = window.setTimeout(stopAutonomousMotion, duration);
});
desktop?.onPetScale?.((scale) => {
  applyScale(scale);
  showScaleFeedback(scale);
});
desktop?.onPetRotation?.((rotation) => {
  currentRotation = applyRotation(rotation);
  modelRenderer?.setRotation(currentRotation);
  showRotationFeedback(currentRotation);
});
desktop?.onPetSelected?.((selected) => {
  ui.hitbox.classList.toggle("is-selected", selected);
});

window.setInterval(() => {
  if (document.hidden || Math.random() < 0.4) return;
  say("idle");
}, 18_000);

window.setInterval(() => {
  state.hunger = clamp(state.hunger - 0.3);
  state.energy = clamp(state.energy - 0.2);
  saveState();
  render();
}, 60_000);

window.addEventListener("storage", (event) => {
  const expectedKey = HUB_PET_IDS.has(petId) ? STORAGE_KEY : EXTRA_STORAGE_KEY;
  if (event.key !== expectedKey) return;
  state = loadState();
  ui.name.textContent = state.name;
  ui.speaker.textContent = state.name;
  render();
});

function interact(action) {
  const effect = effects[action];
  if (!effect) return;
  state = {
    ...state,
    hunger: clamp(state.hunger + effect.hunger),
    mood: clamp(state.mood + effect.mood),
    energy: clamp(state.energy + effect.energy)
  };
  lastBondIncrease = effect.bond;
  saveState();
  render();
  react(action);
  say(action);
}

function stopAutonomousMotion() {
  clearTimeout(autonomousMotionTimer);
  ui.hitbox.classList.remove("motion-walk", "motion-run", "motion-dance", "motion-jump", "motion-stretch", "motion-wave", "motion-kiss", "motion-hug", "motion-fight", "motion-sleep", "direction-left", "direction-right");
  modelRenderer?.play("idle");
}

function applyScale(value) {
  const numeric = Number(value);
  const scale = Number.isFinite(numeric) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, numeric)) : 1;
  currentScale = scale;
  document.documentElement.style.setProperty("--pet-scale", String(scale));
  return scale;
}

function applyRotation(value) {
  const rotation = normalizeRotation(value);
  currentRotation = rotation;
  // 3D pets turn around their model axis; image pets rotate in the desktop plane.
  ui.image.style.rotate = `${rotation}deg`;
  return rotation;
}

function prepareImageHitMap() {
  if (!ui.image.naturalWidth || !ui.image.naturalHeight) return;
  const scale = Math.min(1, 512 / Math.max(ui.image.naturalWidth, ui.image.naturalHeight));
  imageHitCanvas = document.createElement("canvas");
  imageHitCanvas.width = Math.max(1, Math.round(ui.image.naturalWidth * scale));
  imageHitCanvas.height = Math.max(1, Math.round(ui.image.naturalHeight * scale));
  imageHitContext = imageHitCanvas.getContext("2d", { willReadFrequently: true });
  try {
    imageHitContext.drawImage(ui.image, 0, 0, imageHitCanvas.width, imageHitCanvas.height);
  } catch {
    imageHitCanvas = null;
    imageHitContext = null;
  }
}

function isPointOnPet(clientX, clientY) {
  if (modelRenderer && ui.hitbox.classList.contains("model-ready")) {
    const rect = ui.model.getBoundingClientRect();
    return modelRenderer.hitTest(clientX - rect.left, clientY - rect.top);
  }
  const rect = ui.image.getBoundingClientRect();
  const width = ui.image.offsetWidth;
  const height = ui.image.offsetHeight;
  if (!width || !height) return false;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = -currentRotation * Math.PI / 180;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const localX = Math.cos(angle) * dx - Math.sin(angle) * dy + width / 2;
  const localY = Math.sin(angle) * dx + Math.cos(angle) * dy + height / 2;
  if (localX < 0 || localY < 0 || localX >= width || localY >= height) return false;
  if (!imageHitContext || !imageHitCanvas) {
    const nx = (localX / width - 0.5) / 0.48;
    const ny = (localY / height - 0.5) / 0.5;
    return nx * nx + ny * ny <= 1;
  }
  try {
    const x = Math.min(imageHitCanvas.width - 1, Math.floor(localX / width * imageHitCanvas.width));
    const y = Math.min(imageHitCanvas.height - 1, Math.floor(localY / height * imageHitCanvas.height));
    return imageHitContext.getImageData(x, y, 1, 1).data[3] >= 28;
  } catch {
    return true;
  }
}

function isPointOnVisibleControl(clientX, clientY) {
  if (!ui.hitbox.classList.contains("is-selected")) return false;
  return [ui.hideHandle, ui.resizeHandle, ui.rotateHandle, ui.quickActions, ui.quickPanel].some((control) => {
    if (getComputedStyle(control).display === "none") return false;
    const rect = control.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  });
}

function updatePointerPassThrough(event) {
  if (pressedAt || resizeSession || rotationSession) return setMouseIgnored(false);
  const onPet = isPointOnPet(event.clientX, event.clientY);
  const interactive = onPet || isPointOnVisibleControl(event.clientX, event.clientY);
  setMouseIgnored(!interactive);
  if (onPet && !pointerOverPet) desktop?.unfoldPet?.();
  pointerOverPet = onPet;
}

function setMouseIgnored(ignored) {
  if (mouseIgnored === ignored) return;
  mouseIgnored = ignored;
  desktop?.setIgnoreMouse?.(ignored);
}

function selectPet() {
  ui.hitbox.classList.add("is-selected");
  desktop?.selectPet?.();
}

function deselectPet() {
  if (resizeSession || rotationSession) return;
  hideQuickControls();
}

function hideQuickControls() {
  ui.hitbox.classList.remove("is-selected");
  closeQuickPanel();
}

function stopControlPointerEvent(event) {
  event.stopPropagation();
}

function openQuickPanel(kind) {
  selectPet();
  ui.quickPanel.classList.add("is-open");
  ui.quickPanelTitle.textContent = kind === "pair" ? "双人互动" : "动作";
  if (kind === "pair") {
    ui.quickPanelGrid.innerHTML = [
      ["kiss", "亲一下", "♥"],
      ["hug", "抱一下", "🫂"],
      ["fight", "打架", "💥"],
      ["sleep", "一起躺平", "☾"]
    ].map(([action, label, icon]) => `<button type="button" data-pair-action="${action}" data-action-label="${label}"><span>${icon}</span>${label}</button>`).join("");
    return;
  }
  ui.quickPanelGrid.innerHTML = [
    ["walk", "走一走", "↝"],
    ["run", "跑一圈", "»"],
    ["dance", "跳个舞", "♪"],
    ["jump", "跳起来", "↑"],
    ["stretch", "伸懒腰", "☼"],
    ["wave", "挥挥手", "👋"],
    ["pull-out", "手出兜", "✋"]
  ].map(([action, label, icon]) => `<button type="button" data-pet-motion="${action}"><span>${icon}</span>${label}</button>`).join("");
}

async function openPartnerPicker(action, actionLabel) {
  const definitions = await desktop?.getPetDefinitions?.() || [];
  const partners = definitions.filter((pet) => pet.id !== petId && pet.visible);
  ui.quickPanelTitle.textContent = `${actionLabel} · 选择角色`;
  if (!partners.length) {
    ui.quickPanelGrid.innerHTML = '<p class="quick-panel-empty">先在桌宠小屋显示另一个角色</p>';
    return;
  }
  ui.quickPanelGrid.innerHTML = partners.map((pet) => (
    `<button type="button" data-partner-id="${escapeAttribute(pet.id)}" data-pair-with="${action}"><span>♡</span>${escapeHtml(pet.name)}</button>`
  )).join("");
}

function closeQuickPanel() {
  ui.quickPanel.classList.remove("is-open");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function finishResize(event) {
  if (!resizeSession || resizeSession.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  resizeSession = null;
  desktop?.setIgnoreMouse?.(true);
}

function finishRotation(event) {
  if (!rotationSession || rotationSession.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  rotationSession = null;
  desktop?.setIgnoreMouse?.(true);
}

function showScaleFeedback(value) {
  const scale = applyScale(value);
  ui.speaker.textContent = state.name;
  ui.speechText.textContent = `现在是 ${Math.round(scale * 100)}% 大小`;
  ui.speech.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speech.classList.add("hidden"), 1_800);
}

function showRotationFeedback(value) {
  const rotation = normalizeRotation(value);
  ui.speaker.textContent = state.name;
  ui.speechText.textContent = Math.abs(rotation) < 0.1 ? "已经转回正面" : `当前视角 ${Math.round(rotation)}°`;
  ui.speech.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speech.classList.add("hidden"), 1_500);
}

function showNotice(message) {
  ui.speaker.textContent = state.name;
  ui.speechText.textContent = message;
  ui.speech.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speech.classList.add("hidden"), 2_200);
}

function react(action) {
  ui.hitbox.classList.remove("react-bounce", "react-wiggle", "react-sleep");
  void ui.hitbox.offsetWidth;
  const className = action === "play" ? "react-wiggle" : action === "sleep" ? "react-sleep" : "react-bounce";
  modelRenderer?.play(action === "play" ? "dance" : action === "sleep" ? "sleep" : action === "talk" ? "wave" : action === "pull-out" ? "pullOut" : "idle");
  ui.hitbox.classList.add(className);
  ui.zzz.classList.toggle("hidden", action !== "sleep");
  const symbols = action === "feed" ? ["🍙", "♡", "✦"] : action === "play" ? ["🏐", "✦", "·"] : action === "sleep" ? ["☾", "z", "✦"] : action === "pull-out" ? ["✋", "✦", "·"] : ["♥", "♡", "✦"];
  spawnParticles(symbols);
  window.setTimeout(() => {
    ui.hitbox.classList.remove(className);
    ui.zzz.classList.add("hidden");
  }, action === "sleep" ? 6_000 : 760);
}

function say(category) {
  const options = lines[category] || lines.idle;
  ui.speechText.textContent = options[Math.floor(Math.random() * options.length)];
  ui.speech.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speech.classList.add("hidden"), 4_200);
}

function render() {
  ui.hunger.textContent = Math.round(state.hunger);
  ui.mood.textContent = Math.round(state.mood);
  ui.energy.textContent = Math.round(state.energy);
  ui.moodText.textContent = state.energy < 20 ? "困到睁不开眼" : state.hunger < 25 ? "肚子咕咕叫" : state.mood > 87 ? "心情超好" : "悠闲自在";
}

function spawnParticles(symbols) {
  for (let index = 0; index < 7; index += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = symbols[index % symbols.length];
    particle.style.left = `${95 + Math.random() * 90}px`;
    particle.style.top = `${145 + Math.random() * 40}px`;
    particle.style.setProperty("--x", `${(Math.random() - 0.5) * 75}px`);
    particle.style.animationDelay = `${index * 40}ms`;
    ui.particles.append(particle);
    window.setTimeout(() => particle.remove(), 1_400);
  }
}

function loadState() {
  try {
    const key = HUB_PET_IDS.has(petId) ? STORAGE_KEY : EXTRA_STORAGE_KEY;
    const saved = JSON.parse(localStorage.getItem(key));
    return { ...config, ...saved?.pets?.[petId] };
  } catch {
    return { ...config };
  }
}

function saveState() {
  if (!HUB_PET_IDS.has(petId)) {
    let extraStore;
    try { extraStore = JSON.parse(localStorage.getItem(EXTRA_STORAGE_KEY)); } catch {}
    extraStore = extraStore && typeof extraStore === "object" ? extraStore : { pets: {} };
    extraStore.pets = { ...extraStore.pets, [petId]: state };
    localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify(extraStore));
    lastBondIncrease = 0;
    return;
  }

  let store;
  try { store = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
  const now = Date.now();
  store = store && typeof store === "object" ? store : {
    selectedId: petId,
    bond: 72,
    createdAt: now,
    lastUpdatedAt: now,
    pets: {
      lan: { name: "阿蓝", hunger: 86, mood: 92, energy: 78 },
      bo: { name: "小博", hunger: 82, mood: 96, energy: 88 }
    }
  };
  store.selectedId = petId;
  store.lastUpdatedAt = now;
  store.bond = clamp((Number(store.bond) || 72) + lastBondIncrease);
  store.pets = { ...store.pets, [petId]: state };
  lastBondIncrease = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

function normalizeRotation(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric + 180) % 360 + 360) % 360 - 180;
}

function numberParam(name, fallback) {
  const raw = params.get(name);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
