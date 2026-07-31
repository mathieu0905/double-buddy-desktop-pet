const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

function normalizeCustomPets(value, assetDirectory) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();
  const result = [];
  for (const item of value) {
    const id = String(item?.id || "");
    const name = String(item?.name || "").trim().slice(0, 20);
    const imageFile = path.basename(String(item?.imageFile || ""));
    if (!/^custom-[a-z0-9-]+$/.test(id) || !name || !/^custom-[a-z0-9-]+\.png$/.test(imageFile)) continue;
    if (usedIds.has(id) || !existsSync(path.join(assetDirectory, imageFile))) continue;
    usedIds.add(id);
    result.push({ id, name, imageFile, custom: true, hunger: 90, mood: 95, energy: 90 });
  }
  return result;
}

function loadCustomPets(filePath, assetDirectory) {
  try { return normalizeCustomPets(JSON.parse(readFileSync(filePath, "utf8")), assetDirectory); }
  catch { return []; }
}

function saveCustomPets(filePath, pets) {
  writeFileSync(filePath, JSON.stringify(pets.map(({ id, name, imageFile }) => ({ id, name, imageFile })), null, 2));
}

function createCustomPetRecord(name, now = Date.now()) {
  const suffix = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const id = `custom-${suffix}`;
  return {
    id,
    name: String(name || "新朋友").trim().slice(0, 20) || "新朋友",
    imageFile: `${id}.png`,
    custom: true,
    hunger: 90,
    mood: 95,
    energy: 90
  };
}

module.exports = { createCustomPetRecord, loadCustomPets, normalizeCustomPets, saveCustomPets };
