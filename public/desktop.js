const params = new URLSearchParams(location.search);
const petId = params.get("pet") === "bo" ? "bo" : "lan";
const desktop = window.desktopPet;
const STORAGE_KEY = "double-buddy.pet-state.v1";
const config = {
  lan: { name: "阿蓝", image: "./assets/left-pet.png", hunger: 86, mood: 92, energy: 78 },
  bo: { name: "小博", image: "./assets/right-pet.png", hunger: 82, mood: 96, energy: 88 }
}[petId];

const lines = {
  lan: {
    pet: ["再摸一下也不是不行。", "今天发型没乱吧？", "好耶，充电成功。"],
    feed: ["这个饭团很有眼光。", "吃饱了，才有力气摸鱼。"],
    play: ["球来了——接住！", "下一局我可认真了。"],
    talk: ["我在听，你慢慢说。", "今天也辛苦啦。"],
    sleep: ["那我眯五分钟……", "呼——先暂停营业。"],
    idle: ["今天也一起摸鱼吧。", "忙完记得起来走一走。", "小博怎么又这么精神？"]
  },
  bo: {
    pet: ["哈哈，再来一下！", "收到你的摸摸啦。", "现在元气值爆表！"],
    feed: ["饭团满分，我宣布的。", "毕业之后也要好好吃饭！"],
    play: ["这一球我可不会让！", "来来来，决胜局！"],
    talk: ["讲吧，我保证认真听。", "先笑一个，办法总会有的。"],
    sleep: ["只睡五分钟，真的。", "毕业袍可以当小被子。"],
    idle: ["今天有什么新任务？", "毕业快乐是永久状态！", "累了就歇一会儿吧。"]
  }
}[petId];

const effects = {
  pet: { hunger: 0, mood: 5, energy: 0, bond: 1 },
  feed: { hunger: 18, mood: 3, energy: 1, bond: 1 },
  play: { hunger: -6, mood: 15, energy: -10, bond: 3 },
  talk: { hunger: -1, mood: 9, energy: -1, bond: 2 },
  sleep: { hunger: -2, mood: 2, energy: 20, bond: 1 }
};

const ui = {
  root: document.querySelector("#desktopPet"),
  hitbox: document.querySelector("#petHitbox"),
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

ui.image.src = config.image;
ui.image.alt = `${state.name}桌面宠物`;
ui.name.textContent = state.name;
ui.speaker.textContent = state.name;
render();

ui.hitbox.addEventListener("pointerenter", () => desktop?.setIgnoreMouse?.(false));
ui.hitbox.addEventListener("pointerleave", () => { if (!pressedAt) desktop?.setIgnoreMouse?.(true); });
ui.hitbox.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
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
ui.hitbox.addEventListener("dblclick", () => desktop?.openHub?.());
ui.hitbox.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  desktop?.stopDrag?.();
  desktop?.showPetMenu?.(petId);
});
document.body.addEventListener("mouseleave", () => { if (!pressedAt) desktop?.setIgnoreMouse?.(true); });

desktop?.onPetAction?.((action) => interact(action));
desktop?.onPetWander?.((direction) => {
  ui.hitbox.classList.remove("walk-left", "walk-right");
  void ui.hitbox.offsetWidth;
  ui.hitbox.classList.add(direction < 0 ? "walk-left" : "walk-right");
  window.setTimeout(() => ui.hitbox.classList.remove("walk-left", "walk-right"), 850);
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
  if (event.key !== STORAGE_KEY) return;
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

function react(action) {
  ui.hitbox.classList.remove("react-bounce", "react-wiggle", "react-sleep");
  void ui.hitbox.offsetWidth;
  const className = action === "play" ? "react-wiggle" : action === "sleep" ? "react-sleep" : "react-bounce";
  ui.hitbox.classList.add(className);
  ui.zzz.classList.toggle("hidden", action !== "sleep");
  const symbols = action === "feed" ? ["🍙", "♡", "✦"] : action === "play" ? ["🏐", "✦", "·"] : action === "sleep" ? ["☾", "z", "✦"] : ["♥", "♡", "✦"];
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...config, ...saved?.pets?.[petId] };
  } catch {
    return { ...config };
  }
}

function saveState() {
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
