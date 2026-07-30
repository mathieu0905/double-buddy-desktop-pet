import {
  PET_IDS,
  applyAction,
  applyElapsedDecay,
  createInitialState,
  moodLabel,
  normalizeState,
  renamePets
} from "../src/pet.js";

const STORAGE_KEY = "double-buddy.pet-state.v1";
const desktop = window.desktopPet;

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
  pet: { particles: ["♥", "♡", "✦"], animation: "bounce" }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  petCards: $$(".pet-card"),
  petTabs: $$(".pet-tab"),
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
  settingsButton: $("#settingsButton"),
  nameDialog: $("#nameDialog"),
  nameForm: $("#nameForm"),
  lanNameInput: $("#lanNameInput"),
  boNameInput: $("#boNameInput"),
  toast: $("#toast")
};

let state = loadState();
let speechTimer;
let toastTimer;
let isPinned = true;

init();

function init() {
  document.body.classList.toggle("browser-preview", !desktop?.isDesktop);
  if (!desktop?.isDesktop) $$(".desktop-only").forEach((element) => element.classList.add("hidden"));

  ui.petCards.forEach((card) => {
    card.addEventListener("click", () => interact(card.dataset.petId, "pet"));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        interact(card.dataset.petId, "pet");
      }
    });
  });

  ui.petTabs.forEach((tab) => tab.addEventListener("click", () => selectPet(tab.dataset.selectPet)));
  ui.actionButtons.forEach((button) => button.addEventListener("click", () => interact(state.selectedId, button.dataset.action)));
  ui.bondHeart.addEventListener("click", () => showToast(`他们的默契值是 ${Math.round(state.bond)} / 100`));

  ui.pinButton.addEventListener("click", togglePin);
  ui.snapButton.addEventListener("click", () => desktop?.snapToCorner?.());
  ui.minimizeButton.addEventListener("click", () => desktop?.minimize?.());
  ui.closeButton.addEventListener("click", () => {
    if (desktop?.isDesktop) desktop.close?.();
    else showToast("浏览器预览不能关闭窗口，请直接关闭标签页");
  });

  ui.settingsButton.addEventListener("click", openNameDialog);
  ui.nameForm.addEventListener("submit", saveNames);

  render();
  say("lan", "idle");

  window.setInterval(tick, 60_000);
  window.setInterval(randomIdleMoment, 15_000);
  window.addEventListener("beforeunload", saveState);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return applyElapsedDecay(normalizeState(saved));
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function selectPet(petId) {
  if (!PET_IDS.includes(petId)) return;
  state = { ...state, selectedId: petId };
  saveState();
  render();
  const name = state.pets[petId].name;
  showToast(`现在照顾 ${name}`);
}

function interact(petId, action) {
  state = applyAction(state, petId, action);
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

  for (const id of PET_IDS) {
    $$(`[data-name-for="${id}"]`).forEach((node) => { node.textContent = state.pets[id].name; });
  }

  setNeed(ui.hungerBar, ui.hungerValue, selected.hunger);
  setNeed(ui.moodBar, ui.moodValue, selected.mood);
  setNeed(ui.energyBar, ui.energyValue, selected.energy);
  ui.bondValue.textContent = Math.round(state.bond);

  const minutes = Math.max(0, Math.floor((Date.now() - state.createdAt) / 60_000));
  ui.dailyLine.textContent = `已经陪伴 ${formatDuration(minutes)} · 状态自动保存`;
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
  spawnParticles(card, meta.particles);

  const duration = action === "sleep" ? 7_000 : 760;
  window.setTimeout(() => card.classList.remove(meta.animation), duration);
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
  const choices = lines[petId]?.[category] || lines[petId].idle;
  const message = choices[Math.floor(Math.random() * choices.length)];
  ui.speakerName.textContent = state.pets[petId].name;
  ui.speechText.textContent = message;
  ui.speechBubble.classList.remove("hidden");
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => ui.speechBubble.classList.add("hidden"), 4_300);
}

function randomIdleMoment() {
  if (document.hidden || ui.nameDialog.open) return;
  const petId = PET_IDS[Math.floor(Math.random() * PET_IDS.length)];
  const card = $(`[data-pet-id="${petId}"]`);
  card.classList.add("idle-hop");
  window.setTimeout(() => card.classList.remove("idle-hop"), 800);
  if (Math.random() > 0.42) say(petId, "idle");
}

function tick() {
  state = applyElapsedDecay(state);
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
  ui.lanNameInput.value = state.pets.lan.name;
  ui.boNameInput.value = state.pets.bo.name;
  ui.nameDialog.showModal();
  window.setTimeout(() => ui.lanNameInput.select(), 50);
}

function saveNames(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  state = renamePets(state, { lan: ui.lanNameInput.value, bo: ui.boNameInput.value });
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
