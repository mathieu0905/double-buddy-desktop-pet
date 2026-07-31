export const PET_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "lan", name: "昂昂", image: "./assets/left-pet.png", model: "./assets/3d/hunyuan3d21/lan.glb", hunger: 86, mood: 92, energy: 78 }),
  Object.freeze({ id: "bo", name: "其其", image: "./assets/right-pet.png", model: "./assets/3d/hunyuan3d21/bo.glb", hunger: 82, mood: 96, energy: 88 }),
  Object.freeze({ id: "grad", name: "11", image: "./assets/grad-pet.png", model: "./assets/3d/hunyuan3d21/grad.glb", hunger: 88, mood: 90, energy: 84 }),
  Object.freeze({ id: "white", name: "🤏✌️", image: "./assets/white-shirt-pet.png", model: "./assets/3d/hunyuan3d21/white.glb", hunger: 84, mood: 91, energy: 86 }),
  Object.freeze({ id: "sunflower", name: "dyson", image: "./assets/left-one-pet.png", model: "./assets/3d/hunyuan3d21/sunflower.glb", hunger: 90, mood: 96, energy: 82 }),
  Object.freeze({ id: "center", name: "xx", image: "./assets/left-two-pet.png", model: "./assets/3d/hunyuan3d21/center.glb", hunger: 87, mood: 88, energy: 89 }),
  Object.freeze({ id: "jumper", name: "男🪣", image: "./assets/right-one-pet.png", model: "./assets/3d/hunyuan3d21/jumper.glb", hunger: 83, mood: 95, energy: 96 })
]);

export const PET_IDS = Object.freeze(PET_DEFINITIONS.map(({ id }) => id));

export const DEFAULT_PETS = Object.freeze(Object.fromEntries(
  PET_DEFINITIONS.map(({ id, name, hunger, mood, energy }) => [
    id,
    Object.freeze({ name, hunger, mood, energy })
  ])
));

const ACTION_EFFECTS = Object.freeze({
  feed: { hunger: 18, mood: 3, energy: 1, bond: 1 },
  play: { hunger: -6, mood: 15, energy: -10, bond: 3 },
  talk: { hunger: -1, mood: 9, energy: -1, bond: 2 },
  sleep: { hunger: -2, mood: 2, energy: 20, bond: 1 },
  pullOut: { hunger: 0, mood: 4, energy: -1, bond: 1 },
  pet: { hunger: 0, mood: 5, energy: 0, bond: 1 }
});

export function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function createInitialState(now = Date.now(), definitions = PET_DEFINITIONS) {
  const defaults = definitionsToDefaults(definitions);
  const ids = Object.keys(defaults);
  return {
    selectedId: ids[0] || "lan",
    bond: 72,
    createdAt: now,
    lastUpdatedAt: now,
    pets: Object.fromEntries(ids.map((id) => [id, { ...defaults[id] }])),
    relationships: createRelationships(ids)
  };
}

export function normalizeState(candidate, now = Date.now(), definitions = PET_DEFINITIONS) {
  const defaultsById = definitionsToDefaults(definitions);
  const ids = Object.keys(defaultsById);
  const initial = createInitialState(now, definitions);
  if (!candidate || typeof candidate !== "object") return initial;

  const pets = {};
  for (const id of ids) {
    const source = candidate.pets?.[id] || {};
    const defaults = defaultsById[id];
    pets[id] = {
      name: sanitizeName(source.name, defaults.name),
      hunger: clamp(source.hunger ?? defaults.hunger),
      mood: clamp(source.mood ?? defaults.mood),
      energy: clamp(source.energy ?? defaults.energy)
    };
  }

  return {
    selectedId: ids.includes(candidate.selectedId) ? candidate.selectedId : initial.selectedId,
    bond: clamp(candidate.bond ?? initial.bond),
    createdAt: finiteTimestamp(candidate.createdAt, now),
    lastUpdatedAt: finiteTimestamp(candidate.lastUpdatedAt, now),
    pets,
    relationships: createRelationships(ids, candidate.relationships)
  };
}

export function applyElapsedDecay(input, now = Date.now(), definitions = PET_DEFINITIONS) {
  const state = normalizeState(input, now, definitions);
  const elapsedMinutes = clamp((now - state.lastUpdatedAt) / 60_000, 0, 24 * 60);
  if (elapsedMinutes < 1) return { ...state, lastUpdatedAt: now };

  const hungerLoss = elapsedMinutes / 18;
  const energyLoss = elapsedMinutes / 28;
  const pets = {};

  for (const id of Object.keys(state.pets)) {
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

export function applyAction(input, petId, action, now = Date.now(), definitions = PET_DEFINITIONS) {
  const state = applyElapsedDecay(input, now, definitions);
  if (!state.pets[petId]) throw new Error(`Unknown pet: ${petId}`);
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

export function renamePets(input, names, now = Date.now(), definitions = PET_DEFINITIONS) {
  const state = normalizeState(input, now, definitions);
  const pets = { ...state.pets };
  for (const id of Object.keys(pets)) {
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

export function relationshipKey(firstId, secondId) {
  return [String(firstId), String(secondId)].sort().join(":");
}

export function intimacyBetween(state, firstId, secondId) {
  if (firstId === secondId) return 100;
  return clamp(state?.relationships?.[relationshipKey(firstId, secondId)] ?? 0);
}

function sanitizeName(value, fallback) {
  const result = String(value ?? "").trim().slice(0, 8);
  return result || fallback;
}

function definitionsToDefaults(definitions) {
  const valid = Array.isArray(definitions) && definitions.length > 0 ? definitions : PET_DEFINITIONS;
  return Object.fromEntries(valid.map(({ id, name, hunger, mood, energy }) => [
    id,
    {
      name: sanitizeName(name, "新朋友"),
      hunger: clamp(hunger ?? 85),
      mood: clamp(mood ?? 90),
      energy: clamp(energy ?? 85)
    }
  ]));
}

function createRelationships(ids, candidate = {}) {
  const relationships = {};
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      const key = relationshipKey(ids[first], ids[second]);
      const bothBuiltIn = PET_IDS.includes(ids[first]) && PET_IDS.includes(ids[second]);
      const fallback = key === relationshipKey("lan", "bo") ? 72 : bothBuiltIn ? 50 : 35;
      relationships[key] = clamp(candidate?.[key] ?? fallback);
    }
  }
  return relationships;
}

function finiteTimestamp(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
