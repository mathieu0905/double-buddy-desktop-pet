const PET_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "lan", name: "昂昂", image: "./assets/left-pet.png", model: "./assets/3d/hunyuan3d21/lan.glb", hunger: 86, mood: 92, energy: 78 }),
  Object.freeze({ id: "bo", name: "其其", image: "./assets/right-pet.png", model: "./assets/3d/hunyuan3d21/bo.glb", hunger: 82, mood: 96, energy: 88 }),
  Object.freeze({ id: "grad", name: "11", image: "./assets/grad-pet.png", model: "./assets/3d/hunyuan3d21/grad.glb", hunger: 88, mood: 90, energy: 84 }),
  Object.freeze({ id: "white", name: "🤏✌️", image: "./assets/white-shirt-pet.png", model: "./assets/3d/hunyuan3d21/white.glb", hunger: 84, mood: 91, energy: 86 }),
  Object.freeze({ id: "sunflower", name: "dyson", image: "./assets/left-one-pet.png", model: "./assets/3d/hunyuan3d21/sunflower.glb", hunger: 90, mood: 96, energy: 82 }),
  Object.freeze({ id: "center", name: "xx", image: "./assets/left-two-pet.png", model: "./assets/3d/hunyuan3d21/center.glb", hunger: 87, mood: 88, energy: 89 }),
  Object.freeze({ id: "jumper", name: "男🪣", image: "./assets/right-one-pet.png", model: "./assets/3d/hunyuan3d21/jumper.glb", hunger: 83, mood: 95, energy: 96 })
]);

const PET_IDS = Object.freeze(PET_DEFINITIONS.map(({ id }) => id));

function getPetDefinition(petId) {
  return PET_DEFINITIONS.find(({ id }) => id === petId) || PET_DEFINITIONS[0];
}

function normalizeVisiblePetIds(value) {
  if (!Array.isArray(value)) return [...PET_IDS];
  const selected = PET_IDS.filter((id) => value.includes(id));
  return selected.length > 0 ? selected : [PET_IDS[0]];
}

module.exports = { PET_DEFINITIONS, PET_IDS, getPetDefinition, normalizeVisiblePetIds };
