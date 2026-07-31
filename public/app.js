import {
  PET_DEFINITIONS,
  PET_IDS,
  applyAction,
  applyElapsedDecay,
  createInitialState,
  intimacyBetween,
  moodLabel,
  normalizeState,
  renamePets
} from "../src/pet.js";
import { createPetRenderer } from "./pet-renderer.js";

const STORAGE_KEY = "double-buddy.pet-state.v1";
const desktop = window.desktopPet;

const genericLines = {
  pet: ["收到摸摸啦！", "再来一下也可以。", "今天也很开心。"],
  feed: ["好吃！能量补满啦。", "谢谢投喂。", "吃饱就有精神了。"],
  play: ["再玩一会儿吧！", "这一局很有意思。", "好耶，一起活动一下！"],
  talk: ["我在听，你慢慢说。", "今天也辛苦啦。", "我们一直都在。"],
  sleep: ["先眯一会儿。", "晚安，待会儿见。", "补充精力中……"],
  pullOut: ["终于把手从兜里拿出来了。", "兜里没有第二个我。", "活动一下手腕。"],
  idle: ["今天也一起摸鱼吧。", "小屋里真热闹。", "大家都在这里呢。"]
};

const lines = {
  lan: {
    pet: ["再摸一下也不是不行。", "今天发型没乱吧？", "好耶，充电成功。"],
    feed: ["这个饭团很有眼光。", "吃饱了，才有力气摸鱼。", "给小博也留一口！"],
    play: ["球来了——接住！", "热身结束，下一局认真打。", "小博，敢不敢再来一球？"],
    talk: ["我在听，你慢慢说。", "今天也辛苦啦。", "不着急，我们一起想办法。"],
    sleep: ["那我眯五分钟……", "晚安，记得给我盖好。", "呼——先暂停营业。"],
    idle: ["今天也一起摸鱼吧。", "窗外的天气看起来不错。", "小博怎么又这么精神？"]
  },
  bo: {
    pet: ["哈哈，再来一下！", "收到你的摸摸啦。", "现在元气值爆表！"],
    feed: ["毕业之后也要好好吃饭！", "饭团满分，我宣布的。", "阿蓝，你那份吃不完给我。"],
    play: ["这一球我可不会让！", "来来来，决胜局！", "运动一下，论文都写快了。"],
    talk: ["讲吧，我保证认真听。", "这件事包在我们身上。", "先笑一个，办法总会有的。"],
    sleep: ["只睡五分钟，真的。", "毕业袍可以当小被子。", "晚安，明天继续加油。"],
    idle: ["今天有什么新任务？", "阿蓝，要不要打一局？", "毕业快乐是永久状态！"]
  }
};

const actionMeta = {
  feed: { particles: ["🍙", "✦", "♡"], animation: "bounce" },
  play: { particles: ["🏐", "✦", "·"], animation: "wiggle" },
  talk: { particles: ["♡", "♪", "✦"], animation: "bounce" },
  sleep: { particles: ["☾", "✦", "z"], animation: "sleeping" },
  pet: { particles: ["♥", "♡", "✦"], animation: "bounce" },
  pullOut: { particles: ["✋", "✦", "·"], animation: "bounce" }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  petRoster: $("#petRoster"),
  petTabsContainer: $("#petTabs"),
  petCards: [],
  petTabs: [],
  actionButtons: $$(".action-button"),
  speechBubble: $("#speechBubble"),
  speakerName: $("#speakerName"),
  speechText: $("#speechText"),
  particleLayer: $("#particleLayer"),
  bondHeart: $("#bondHeart"),
  bondValue: $("#bondValue"),
  hungerBar: $("#hungerBar"),
  moodBar: $("#moodBar"),
  energyBar: $("#energyBar"),
  hungerValue: $("#hungerValue"),
  moodValue: $("#moodValue"),
  energyValue: $("#energyValue"),
  dailyLine: $("#dailyLine"),
  pinButton: $("#pinButton"),
  snapButton: $("#snapButton"),
  minimizeButton: $("#minimizeButton"),
  closeButton: $("#closeButton"),
  createPetButton: $("#createPetButton"),
  generationTasksButton: $("#generationTasksButton"),
  generationTaskBadge: $("#generationTaskBadge"),
  settingsButton: $("#settingsButton"),
  petDetailDialog: $("#petDetailDialog"),
  closePetDetailButton: $("#closePetDetailButton"),
  petDetailName: $("#petDetailName"),
  petDetailPortrait: $("#petDetailPortrait"),
  petDetailModel: $("#petDetailModel"),
  petDetailImage: $("#petDetailImage"),
  petDetailPresence: $("#petDetailPresence"),
  petDetailMood: $("#petDetailMood"),
  petDetailHungerBar: $("#petDetailHungerBar"),
  petDetailMoodBar: $("#petDetailMoodBar"),
  petDetailEnergyBar: $("#petDetailEnergyBar"),
  petDetailHungerValue: $("#petDetailHungerValue"),
  petDetailMoodValue: $("#petDetailMoodValue"),
  petDetailEnergyValue: $("#petDetailEnergyValue"),
  relationshipList: $("#relationshipList"),
  generationTasksDialog: $("#generationTasksDialog"),
  closeGenerationTasksButton: $("#closeGenerationTasksButton"),
  generationTaskList: $("#generationTaskList"),
  generationTaskEmpty: $("#generationTaskEmpty"),
  creatorDialog: $("#creatorDialog"),
  creatorForm: $("#creatorForm"),
  closeCreatorButton: $("#closeCreatorButton"),
  creatorDropZone: $("#creatorDropZone"),
  chooseCreatorImageButton: $("#chooseCreatorImageButton"),
  creatorFileName: $("#creatorFileName"),
  creatorPetName: $("#creatorPetName"),
  creatorApiFields: $("#creatorApiFields"),
  creatorApiBase: $("#creatorApiBase"),
  creatorApiKey: $("#creatorApiKey"),
  creatorModel: $("#creatorModel"),
  creatorRememberApi: $("#creatorRememberApi"),
  creatorCodexAvailability: $("#creatorCodexAvailability"),
  creatorNotice: $("#creatorNotice"),
  creatorGenerateButton: $("#creatorGenerateButton"),
  creatorStatus: $("#creatorStatus"),
  nameDialog: $("#nameDialog"),
  nameForm: $("#nameForm"),
  nameFields: $("#nameFields"),
  toast: $("#toast")
};

let petDefinitions = [...PET_DEFINITIONS];
let petIds = [...PET_IDS];
let visiblePetIds = new Set(petIds);
let state;
let detailPetId;
let speechTimer;
let toastTimer;
let isPinned = true;
let creatorHasImage = false;
const petRenderers = new Map();
const petRotations = new Map();
let detailRenderer = null;
let detailRendererId = null;

void init();

async function init() {
  document.body.classList.toggle("browser-preview", !desktop?.isDesktop);
  if (!desktop?.isDesktop) $$(".desktop-only").forEach((element) => element.classList.add("hidden"));

  await refreshPetDefinitions();
  state = loadState();
  desktop?.syncRelationships?.(state.relationships);
  renderPetRoster();
  bindPetRoster();
  bindStaticControls();
  render();
  say(state.selectedId, "idle");

  window.setInterval(tick, 60_000);
  window.setInterval(randomIdleMoment, 15_000);
  window.addEventListener("beforeunload", saveState);
}

function bindPetRoster() {
  ui.petCards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.rotationDrag === "true") {
        delete card.dataset.rotationDrag;
        return;
      }
      openPetDetails(card.dataset.petId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPetDetails(card.dataset.petId);
      }
    });
    bindRotationDrag(card, () => card.dataset.petId, () => petRenderers.get(card.dataset.petId), card);
  });

  $$('[data-toggle-visibility]', ui.petRoster).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void togglePetVisibility(button.dataset.toggleVisibility);
    });
  });

  ui.petTabs.forEach((tab) => tab.addEventListener("click", () => selectPet(tab.dataset.selectPet)));
}

function bindStaticControls() {
  ui.actionButtons.forEach((button) => button.addEventListener("click", () => interact(state.selectedId, button.dataset.action)));
  ui.bondHeart.addEventListener("click", () => showToast(`他们的默契值是 ${Math.round(state.bond)} / 100`));
  ui.closePetDetailButton.addEventListener("click", () => ui.petDetailDialog.close());
  ui.petDetailDialog.addEventListener("close", destroyDetailRenderer);
  bindRotationDrag(
    ui.petDetailPortrait,
    () => detailPetId,
    () => detailRenderer,
    ui.petDetailPortrait
  );
  $$('[data-detail-action]').forEach((button) => {
    button.addEventListener("click", () => {
      if (!detailPetId) return;
      interact(detailPetId, button.dataset.detailAction);
      renderPetDetails();
    });
  });

  ui.pinButton.addEventListener("click", togglePin);
  ui.snapButton.addEventListener("click", () => desktop?.snapToCorner?.());
  ui.minimizeButton.addEventListener("click", () => desktop?.minimize?.());
  ui.closeButton.addEventListener("click", () => {
    if (desktop?.isDesktop) desktop.close?.();
    else showToast("浏览器预览不能关闭窗口，请直接关闭标签页");
  });

  ui.settingsButton.addEventListener("click", openNameDialog);
  ui.generationTasksButton.addEventListener("click", openGenerationTasks);
  ui.closeGenerationTasksButton.addEventListener("click", () => ui.generationTasksDialog.close());
  ui.createPetButton.addEventListener("click", () => {
    if (desktop?.isDesktop) openCreatorDialog();
    else showToast("照片生成桌宠仅在 App 中可用");
  });
  ui.closeCreatorButton.addEventListener("click", () => ui.creatorDialog.close());
  ui.chooseCreatorImageButton.addEventListener("click", chooseCreatorImage);
  ui.creatorForm.addEventListener("submit", submitCreatorForm);
  $$('input[name="creatorProvider"]').forEach((radio) => radio.addEventListener("change", updateCreatorProvider));
  setupCreatorDropZone();
  desktop?.onOpenCreator?.(openCreatorDialog);
  desktop?.onCreatorGenerationFinished?.(async (result) => {
    if (result.ok) {
      await refreshPetDefinitions();
      state = normalizeState(state, Date.now(), petDefinitions);
      renderPetRoster();
      bindPetRoster();
      render();
    }
    showToast(result.message);
  });
  desktop?.onGenerationJobs?.(renderGenerationJobs);
  desktop?.onPetVisibilityChanged?.(updatePetVisibility);
  desktop?.onPetRelationshipsChanged?.((relationships) => {
    state = { ...state, relationships: { ...state.relationships, ...relationships } };
    saveState();
    if (ui.petDetailDialog.open && detailPetId) renderPetDetails();
  });
  desktop?.getGenerationJobs?.().then(renderGenerationJobs);
  ui.nameForm.addEventListener("submit", saveNames);

}

async function refreshPetDefinitions() {
  try {
    const runtimeDefinitions = await desktop?.getPetDefinitions?.();
    if (Array.isArray(runtimeDefinitions) && runtimeDefinitions.length > 0) {
      petDefinitions = runtimeDefinitions;
      petIds = runtimeDefinitions.map(({ id }) => id);
      visiblePetIds = new Set(runtimeDefinitions.filter(({ visible }) => visible !== false).map(({ id }) => id));
    }
  } catch {}
}

function renderPetRoster() {
  destroyPetCardRenderers();
  ui.petRoster.replaceChildren(...petDefinitions.map(createPetCard));
  ui.petTabsContainer.replaceChildren(...petDefinitions.map(createPetTab));
  ui.nameFields.replaceChildren(...petDefinitions.map(createNameField));
  ui.petCards = $$(".pet-card", ui.petRoster);
  ui.petTabs = $$(".pet-tab", ui.petTabsContainer);
  mountPetCardRenderers();
}

function createPetCard(definition) {
  const card = document.createElement("article");
  card.className = "pet-card";
  card.dataset.petId = definition.id;
  card.tabIndex = 0;
  card.setAttribute("aria-label", `${definition.name}，点击摸摸头`);
  card.innerHTML = `
    <div class="pet-aura"></div>
    <div class="pet-card-model" aria-hidden="true"></div>
    <img class="pet-image" alt="" draggable="false" />
    <span class="pet-rotate-hint">↻ 拖动</span>
    <div class="pet-shadow"></div>
    <div class="status-chip">
      <button class="visibility-toggle" type="button" data-toggle-visibility="${definition.id}"></button>
      <strong data-name-for="${definition.id}"></strong>
      <span data-mood-for="${definition.id}"></span>
    </div>`;
  const image = $(".pet-image", card);
  image.src = definition.image;
  image.alt = `${definition.name}的卡通桌宠形象`;
  updateVisibilityButton($(".visibility-toggle", card), definition.id);
  return card;
}

function mountPetCardRenderers() {
  for (const card of ui.petCards) {
    const definition = petDefinitions.find(({ id }) => id === card.dataset.petId);
    if (!definition?.model) continue;
    const container = $(".pet-card-model", card);
    card.classList.add("has-model");
    const renderer = createPetRenderer({
      container,
      modelUrl: definition.model,
      rotation: petRotations.get(definition.id) || 0,
      onReady: () => card.classList.add("model-ready"),
      onError: (error) => {
        console.error(`Unable to load hub model for ${definition.id}`, error);
        renderer.destroy();
        petRenderers.delete(definition.id);
        card.classList.remove("has-model", "model-ready");
      }
    });
    petRenderers.set(definition.id, renderer);
  }
}

function destroyPetCardRenderers() {
  for (const renderer of petRenderers.values()) renderer.destroy();
  petRenderers.clear();
}

function bindRotationDrag(element, getPetId, getRenderer, stateElement) {
  let session = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button") || !getRenderer()) return;
    const petId = getPetId();
    if (!petId) return;
    session = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: petRotations.get(petId) || 0,
      moved: false
    };
    element.setPointerCapture(event.pointerId);
    stateElement.classList.add("rotating");
  });

  element.addEventListener("pointermove", (event) => {
    if (!session || event.pointerId !== session.pointerId) return;
    const delta = event.clientX - session.startX;
    if (Math.abs(delta) >= 3) session.moved = true;
    const petId = getPetId();
    const rotation = session.startRotation + delta * 0.8;
    petRotations.set(petId, rotation);
    getRenderer()?.setRotation(rotation);
    if (detailPetId === petId) detailRenderer?.setRotation(rotation);
    petRenderers.get(petId)?.setRotation(rotation);
  });

  const finish = (event) => {
    if (!session || event.pointerId !== session.pointerId) return;
    if (session.moved && stateElement.classList.contains("pet-card")) {
      stateElement.dataset.rotationDrag = "true";
      window.setTimeout(() => { delete stateElement.dataset.rotationDrag; }, 0);
    }
    session = null;
    stateElement.classList.remove("rotating");
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);
}

function createPetTab(definition) {
  const tab = document.createElement("button");
  tab.className = "pet-tab";
  tab.dataset.selectPet = definition.id;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.innerHTML = `<img alt="" /><span data-name-for="${definition.id}"></span>`;
  $("img", tab).src = definition.image;
  return tab;
}

function createNameField(definition) {
  const label = document.createElement("label");
  label.textContent = `${definition.name}的新名字`;
  const input = document.createElement("input");
  input.dataset.nameInput = definition.id;
  input.maxLength = 8;
  input.autocomplete = "off";
  label.append(input);
  return label;
}

function updateVisibilityButton(button, petId) {
  const visible = visiblePetIds.has(petId);
  const name = state?.pets?.[petId]?.name || petDefinitions.find(({ id }) => id === petId)?.name || "角色";
  button.classList.toggle("checked", visible);
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", `${visible ? "隐藏" : "显示"}${name}`);
  button.title = visible ? "已显示在桌面，点击隐藏" : "未显示在桌面，点击显示";
}

function updatePetVisibility(ids) {
  if (!Array.isArray(ids)) return;
  visiblePetIds = new Set(ids);
  $$('[data-toggle-visibility]', ui.petRoster).forEach((button) => {
    updateVisibilityButton(button, button.dataset.toggleVisibility);
  });
  if (ui.petDetailDialog.open && detailPetId) renderPetDetails();
}

async function togglePetVisibility(petId) {
  if (!desktop?.isDesktop) return showToast("桌面显示开关仅在 App 中可用");
  const shouldShow = !visiblePetIds.has(petId);
  const ids = await desktop.setPetVisible?.(petId, shouldShow);
  updatePetVisibility(ids);
  if (!shouldShow && visiblePetIds.has(petId)) showToast("至少需要保留一个桌面角色");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return applyElapsedDecay(normalizeState(saved, Date.now(), petDefinitions), Date.now(), petDefinitions);
  } catch {
    return createInitialState(Date.now(), petDefinitions);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function selectPet(petId) {
  if (!petIds.includes(petId)) return;
  state = { ...state, selectedId: petId };
  saveState();
  render();
  const name = state.pets[petId].name;
  showToast(`现在照顾 ${name}`);
}

function openPetDetails(petId) {
  if (!petIds.includes(petId)) return;
  detailPetId = petId;
  state = { ...state, selectedId: petId };
  saveState();
  render();
  if (!ui.petDetailDialog.open) ui.petDetailDialog.showModal();
  renderPetDetails();
}

function renderPetDetails() {
  if (!detailPetId || !state.pets[detailPetId]) return;
  const definition = petDefinitions.find(({ id }) => id === detailPetId);
  if (!definition) return;
  const pet = state.pets[detailPetId];
  const visible = visiblePetIds.has(detailPetId);

  ui.petDetailName.textContent = pet.name;
  ui.petDetailImage.src = definition.image;
  ui.petDetailImage.alt = `${pet.name}的角色形象`;
  mountDetailRenderer(definition);
  ui.petDetailPresence.textContent = visible ? "● 正在桌面陪伴" : "○ 暂时没有显示在桌面";
  ui.petDetailPresence.classList.toggle("visible", visible);
  ui.petDetailMood.textContent = moodLabel(pet);
  setNeed(ui.petDetailHungerBar, ui.petDetailHungerValue, pet.hunger);
  setNeed(ui.petDetailMoodBar, ui.petDetailMoodValue, pet.mood);
  setNeed(ui.petDetailEnergyBar, ui.petDetailEnergyValue, pet.energy);
  renderRelationships(detailPetId);
}

function mountDetailRenderer(definition) {
  if (detailRendererId === definition.id && detailRenderer) return;
  destroyDetailRenderer();
  ui.petDetailPortrait.classList.toggle("has-model", Boolean(definition.model));
  if (!definition.model) return;
  detailRendererId = definition.id;
  detailRenderer = createPetRenderer({
    container: ui.petDetailModel,
    modelUrl: definition.model,
    rotation: petRotations.get(definition.id) || 0,
    onReady: () => ui.petDetailPortrait.classList.add("model-ready"),
    onError: (error) => {
      console.error(`Unable to load detail model for ${definition.id}`, error);
      destroyDetailRenderer();
    }
  });
}

function destroyDetailRenderer() {
  detailRenderer?.destroy();
  detailRenderer = null;
  detailRendererId = null;
  ui.petDetailPortrait.classList.remove("has-model", "model-ready", "rotating");
}

function renderRelationships(petId) {
  ui.relationshipList.replaceChildren();
  for (const definition of petDefinitions.filter(({ id }) => id !== petId)) {
    const button = document.createElement("button");
    button.className = "relationship-card";
    button.type = "button";
    const image = document.createElement("img");
    image.src = definition.image;
    image.alt = "";
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = state.pets[definition.id]?.name || definition.name;
    const intimacy = Math.round(intimacyBetween(state, petId, definition.id));
    const score = document.createElement("span");
    score.className = "relationship-intimacy";
    const label = document.createElement("small");
    label.textContent = `♥ 亲密值 ${intimacy}`;
    const track = document.createElement("i");
    const fill = document.createElement("b");
    fill.style.width = `${intimacy}%`;
    track.append(fill);
    score.append(label, track);
    text.append(name, score);
    button.append(image, text);
    button.addEventListener("click", () => openPetDetails(definition.id));
    ui.relationshipList.append(button);
  }
}

function interact(petId, action) {
  state = applyAction(state, petId, action, Date.now(), petDefinitions);
  saveState();
  render();
  animatePet(petId, action);
  say(petId, action);
}

function render() {
  const selected = state.pets[state.selectedId];

  ui.petCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.petId === state.selectedId);
    const id = card.dataset.petId;
    const pet = state.pets[id];
    const moodElement = document.querySelector(`[data-mood-for="${id}"]`);
    if (moodElement) moodElement.textContent = moodLabel(pet);
  });

  ui.petTabs.forEach((tab) => {
    const active = tab.dataset.selectPet === state.selectedId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  for (const id of petIds) {
    $$(`[data-name-for="${id}"]`).forEach((node) => { node.textContent = state.pets[id].name; });
  }
  $$('[data-toggle-visibility]', ui.petRoster).forEach((button) => {
    updateVisibilityButton(button, button.dataset.toggleVisibility);
  });

  setNeed(ui.hungerBar, ui.hungerValue, selected.hunger);
  setNeed(ui.moodBar, ui.moodValue, selected.mood);
  setNeed(ui.energyBar, ui.energyValue, selected.energy);
  ui.bondValue.textContent = Math.round(state.bond);

  const minutes = Math.max(0, Math.floor((Date.now() - state.createdAt) / 60_000));
  ui.dailyLine.textContent = `已经陪伴 ${formatDuration(minutes)} · 状态自动保存`;
  if (ui.petDetailDialog.open && detailPetId) renderPetDetails();
}

function setNeed(bar, label, value) {
  const rounded = Math.round(value);
  bar.style.width = `${rounded}%`;
  bar.style.background = rounded < 25 ? "#c47c70" : rounded < 50 ? "#c2a76e" : "#8ea68f";
  label.textContent = rounded;
}

function animatePet(petId, action) {
  const card = $(`[data-pet-id="${petId}"]`);
  const meta = actionMeta[action];
  if (!card || !meta) return;

  card.classList.remove("bounce", "wiggle", "sleeping", "idle-hop");
  void card.offsetWidth;
  card.classList.add(meta.animation);
  const motion = action === "play" ? "dance"
    : action === "talk" || action === "pet" ? "wave"
      : action === "sleep" ? "sleep"
        : action === "pullOut" ? "pullOut"
        : "jump";
  petRenderers.get(petId)?.play(motion);
  if (detailPetId === petId) detailRenderer?.play(motion);
  spawnParticles(card, meta.particles);

  const duration = action === "sleep" ? 7_000 : 760;
  window.setTimeout(() => {
    card.classList.remove(meta.animation);
    if (action === "sleep") {
      petRenderers.get(petId)?.play("idle");
      if (detailPetId === petId) detailRenderer?.play("idle");
    }
  }, duration);
}

function spawnParticles(card, symbols) {
  const sceneRect = ui.particleLayer.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const centerX = cardRect.left - sceneRect.left + cardRect.width / 2;
  const centerY = cardRect.top - sceneRect.top + cardRect.height * 0.44;

  for (let index = 0; index < 7; index += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = symbols[index % symbols.length];
    particle.style.left = `${centerX + (Math.random() - 0.5) * 80}px`;
    particle.style.top = `${centerY + Math.random() * 35}px`;
    particle.style.setProperty("--x", `${(Math.random() - 0.5) * 90}px`);
    particle.style.animationDelay = `${index * 45}ms`;
    ui.particleLayer.append(particle);
    window.setTimeout(() => particle.remove(), 1_450);
  }
}

function say(petId, category = "idle") {
  const choices = lines[petId]?.[category] || genericLines[category] || genericLines.idle;
  const message = choices[Math.floor(Math.random() * choices.length)];
  ui.speakerName.textContent = state.pets[petId].name;
  ui.speechText.textContent = message;
  ui.speechBubble.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speechBubble.classList.add("hidden"), 4_300);
}

function randomIdleMoment() {
  if (document.hidden || ui.nameDialog.open) return;
  const petId = petIds[Math.floor(Math.random() * petIds.length)];
  const card = $(`[data-pet-id="${petId}"]`);
  if (!card) return;
  card.classList.add("idle-hop");
  window.setTimeout(() => card.classList.remove("idle-hop"), 800);
  if (Math.random() > 0.42) say(petId, "idle");
}

function tick() {
  state = applyElapsedDecay(state, Date.now(), petDefinitions);
  saveState();
  render();
}

async function togglePin() {
  isPinned = !isPinned;
  const actual = await desktop?.setAlwaysOnTop?.(isPinned);
  if (typeof actual === "boolean") isPinned = actual;
  ui.pinButton.classList.toggle("active", isPinned);
  ui.pinButton.title = isPinned ? "取消置顶" : "保持置顶";
  showToast(isPinned ? "桌宠会一直陪在最上层" : "已取消窗口置顶");
}

function openNameDialog() {
  for (const input of $$('[data-name-input]', ui.nameFields)) {
    input.value = state.pets[input.dataset.nameInput].name;
  }
  ui.nameDialog.showModal();
  window.setTimeout(() => $('[data-name-input]', ui.nameFields)?.select(), 50);
}

async function openGenerationTasks() {
  const jobs = await desktop?.getGenerationJobs?.() || [];
  renderGenerationJobs(jobs);
  if (!ui.generationTasksDialog.open) ui.generationTasksDialog.showModal();
}

function renderGenerationJobs(jobs) {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const runningCount = safeJobs.filter((job) => ["queued", "running"].includes(job.status)).length;
  ui.generationTaskBadge.textContent = String(runningCount);
  ui.generationTaskBadge.classList.toggle("hidden", runningCount === 0);
  ui.generationTaskList.replaceChildren();
  ui.generationTaskEmpty.classList.toggle("hidden", safeJobs.length > 0);

  const statusLabels = { queued: "排队中", running: "生成中", succeeded: "已完成", failed: "失败" };
  for (const job of safeJobs) {
    const row = document.createElement("article");
    row.className = `generation-task ${job.status}`;
    const dot = document.createElement("i");
    dot.className = "generation-task-dot";
    const main = document.createElement("div");
    main.className = "generation-task-main";
    const name = document.createElement("strong");
    name.textContent = job.name;
    const message = document.createElement("span");
    message.textContent = job.message;
    main.append(name, message);
    const meta = document.createElement("div");
    meta.className = "generation-task-meta";
    const status = document.createElement("b");
    status.textContent = statusLabels[job.status] || job.status;
    const detail = document.createElement("span");
    const provider = job.provider === "api" ? "API" : "Codex";
    const time = new Date(job.startedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    detail.textContent = `${provider} · ${time}`;
    meta.append(status, detail);
    row.append(dot, main, meta);
    ui.generationTaskList.append(row);
  }
}

async function openCreatorDialog() {
  if (!desktop?.isDesktop) return;
  const config = await desktop.getCreatorConfig?.();
  ui.creatorApiBase.value = config?.apiBase || "https://api.openai.com/v1";
  ui.creatorModel.value = config?.model || "gpt-image-1.5";
  ui.creatorApiKey.placeholder = config?.hasSavedApiKey ? "已安全保存；留空继续使用" : "sk-…";
  ui.creatorCodexAvailability.textContent = config?.codexAvailable
    ? "已检测到 Codex CLI。"
    : "未检测到 Codex CLI，可改用兼容 API。";
  clearCreatorStatus();
  if (!ui.creatorDialog.open) ui.creatorDialog.showModal();
}

async function chooseCreatorImage() {
  const selected = await desktop?.chooseCreatorImage?.();
  applyCreatorImage(selected);
}

function setupCreatorDropZone() {
  for (const eventName of ["dragenter", "dragover"]) {
    ui.creatorDropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      ui.creatorDropZone.classList.add("drag-over");
    });
  }
  ui.creatorDropZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    if (ui.creatorDropZone.contains(event.relatedTarget)) return;
    ui.creatorDropZone.classList.remove("drag-over");
  });
  ui.creatorDropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    ui.creatorDropZone.classList.remove("drag-over");
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length !== 1) return showCreatorStatus("请一次拖入一张图片。", true);
    try { applyCreatorImage(await desktop?.selectDroppedCreatorImage?.(files[0])); }
    catch (error) { showCreatorStatus(error?.message || "无法读取这张图片。", true); }
  });
  window.addEventListener("dragover", (event) => { if (ui.creatorDialog.open) event.preventDefault(); });
  window.addEventListener("drop", (event) => { if (ui.creatorDialog.open) event.preventDefault(); });
}

function applyCreatorImage(selected) {
  if (!selected) return;
  creatorHasImage = true;
  ui.creatorFileName.textContent = selected.name;
  clearCreatorStatus();
}

function updateCreatorProvider() {
  const provider = $('input[name="creatorProvider"]:checked')?.value || "codex";
  ui.creatorApiFields.classList.toggle("hidden", provider !== "api");
  ui.creatorCodexAvailability.classList.toggle("hidden", provider !== "codex");
  ui.creatorNotice.textContent = provider === "direct"
    ? "PNG 透明背景效果最好；JPG、JPEG 和 WebP 也可以直接导入，不会调用 AI。"
    : "请确认你有权使用照片中人物的肖像。任务会在后台生成，完成后发送系统通知。";
  ui.creatorGenerateButton.textContent = creatorSubmitLabel(provider);
  clearCreatorStatus();
}

async function submitCreatorForm(event) {
  event.preventDefault();
  if (!creatorHasImage) return showCreatorStatus("请先选择一张图片。", true);
  if (!ui.creatorPetName.value.trim()) return showCreatorStatus("请填写角色名字。", true);
  setCreatorBusy(true);
  try {
    const result = await desktop.generateCustomPet({
      name: ui.creatorPetName.value.trim(),
      provider: $('input[name="creatorProvider"]:checked')?.value || "codex",
      apiBase: ui.creatorApiBase.value.trim(),
      apiKey: ui.creatorApiKey.value,
      model: ui.creatorModel.value.trim(),
      remember: ui.creatorRememberApi.checked
    });
    if (result.imported) {
      await refreshPetDefinitions();
      state = normalizeState(state, Date.now(), petDefinitions);
      renderPetRoster();
      bindPetRoster();
      render();
    }
    ui.creatorApiKey.value = "";
    ui.creatorDialog.close();
    showToast(result.imported
      ? `${result.name} 已直接添加到桌面`
      : `${result.name} 已转入后台，完成后会通知你`);
  } catch (error) {
    showCreatorStatus(error?.message || "生成失败，请检查配置后重试。", true);
  } finally {
    setCreatorBusy(false);
  }
}

function setCreatorBusy(busy) {
  ui.creatorGenerateButton.disabled = busy;
  ui.chooseCreatorImageButton.disabled = busy;
  const provider = $('input[name="creatorProvider"]:checked')?.value || "codex";
  ui.creatorGenerateButton.textContent = busy ? (provider === "direct" ? "正在导入…" : "正在提交…") : creatorSubmitLabel(provider);
}

function creatorSubmitLabel(provider) {
  return provider === "direct" ? "直接添加到桌面" : "开始后台生成";
}

function showCreatorStatus(message, error) {
  ui.creatorStatus.textContent = message;
  ui.creatorStatus.classList.remove("hidden");
  ui.creatorStatus.classList.toggle("error", error);
}

function clearCreatorStatus() {
  ui.creatorStatus.classList.add("hidden");
  ui.creatorStatus.classList.remove("error");
}

function saveNames(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const names = Object.fromEntries(
    $$('[data-name-input]', ui.nameFields).map((input) => [input.dataset.nameInput, input.value])
  );
  state = renamePets(state, names, Date.now(), petDefinitions);
  saveState();
  render();
  ui.nameDialog.close();
  showToast("新名字记住啦");
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.add("hidden"), 2_200);
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} 小时 ${rest} 分`;
}
