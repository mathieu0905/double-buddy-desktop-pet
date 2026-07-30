export const PET_IDS = ["lan", "bo"];

export const DEFAULT_PETS = Object.freeze({
  lan: Object.freeze({ name: "阿蓝", hunger: 86, mood: 92, energy: 78 }),
  bo: Object.freeze({ name: "小博", hunger: 82, mood: 96, energy: 88 })
});

const ACTION_EFFECTS = Object.freeze({
  feed: { hunger: 18, mood: 3, energy: 1, bond: 1 },
  play: { hunger: -6, mood: 15, energy: -10, bond: 3 },
  talk: { hunger: -1, mood: 9, energy: -1, bond: 2 },
  sleep: { hunger: -2, mood: 2, energy: 20, bond: 1 },
  pet: { hunger: 0, mood: 5, energy: 0, bond: 1 }
});

export function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function createInitialState(now = Date.now()) {
  return {
    selectedId: "lan",
    bond: 72,
    createdAt: now,
    lastUpdatedAt: now,
    pets: {
      lan: { ...DEFAULT_PETS.lan },
      bo: { ...DEFAULT_PETS.bo }
    }
  };
}

export function normalizeState(candidate, now = Date.now()) {
  const initial = createInitialState(now);
  if (!candidate || typeof candidate !== "object") return initial;

  const pets = {};
  for (const id of PET_IDS) {
    const source = candidate.pets?.[id] || {};
    const defaults = DEFAULT_PETS[id];
    pets[id] = {
      name: sanitizeName(source.name, defaults.name),
      hunger: clamp(source.hunger ?? defaults.hunger),
      mood: clamp(source.mood ?? defaults.mood),
      energy: clamp(source.energy ?? defaults.energy)
    };
  }

  return {
    selectedId: PET_IDS.includes(candidate.selectedId) ? candidate.selectedId : "lan",
    bond: clamp(candidate.bond ?? initial.bond),
    createdAt: finiteTimestamp(candidate.createdAt, now),
    lastUpdatedAt: finiteTimestamp(candidate.lastUpdatedAt, now),
    pets
  };
}

export function applyElapsedDecay(input, now = Date.now()) {
  const state = normalizeState(input, now);
  const elapsedMinutes = clamp((now - state.lastUpdatedAt) / 60_000, 0, 24 * 60);
  if (elapsedMinutes < 1) return { ...state, lastUpdatedAt: now };

  const hungerLoss = elapsedMinutes / 18;
  const energyLoss = elapsedMinutes / 28;
  const pets = {};

  for (const id of PET_IDS) {
    const pet = state.pets[id];
    const nextHunger = clamp(pet.hunger - hungerLoss);
    const nextEnergy = clamp(pet.energy - energyLoss);
    const discomfort = nextHunger < 25 || nextEnergy < 18 ? elapsedMinutes / 30 : 0;
    pets[id] = {
      ...pet,
      hunger: roundOne(nextHunger),
      mood: roundOne(clamp(pet.mood - discomfort)),
      energy: roundOne(nextEnergy)
    };
  }

  return { ...state, pets, lastUpdatedAt: now };
}

export function applyAction(input, petId, action, now = Date.now()) {
  const state = applyElapsedDecay(input, now);
  if (!PET_IDS.includes(petId)) throw new Error(`Unknown pet: ${petId}`);
  const effect = ACTION_EFFECTS[action];
  if (!effect) throw new Error(`Unknown action: ${action}`);

  const pet = state.pets[petId];
  const nextPet = {
    ...pet,
    hunger: roundOne(clamp(pet.hunger + effect.hunger)),
    mood: roundOne(clamp(pet.mood + effect.mood)),
    energy: roundOne(clamp(pet.energy + effect.energy))
  };

  return {
    ...state,
    selectedId: petId,
    bond: roundOne(clamp(state.bond + effect.bond)),
    lastUpdatedAt: now,
    pets: { ...state.pets, [petId]: nextPet }
  };
}

export function renamePets(input, names, now = Date.now()) {
  const state = normalizeState(input, now);
  const pets = { ...state.pets };
  for (const id of PET_IDS) {
    pets[id] = {
      ...pets[id],
      name: sanitizeName(names?.[id], pets[id].name)
    };
  }
  return { ...state, pets, lastUpdatedAt: now };
}

export function moodLabel(pet) {
  if (pet.energy <= 18) return "困到睁不开眼";
  if (pet.hunger <= 22) return "肚子咕咕叫";
  if (pet.mood >= 88) return "心情超好";
  if (pet.mood >= 65) return "悠闲自在";
  if (pet.mood >= 38) return "想要陪陪";
  return "有一点委屈";
}

function sanitizeName(value, fallback) {
  const result = String(value ?? "").trim().slice(0, 8);
  return result || fallback;
}

function finiteTimestamp(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
