import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import petRegistry from "../electron/pets.cjs";

const { PET_DEFINITIONS, PET_IDS, getPetDefinition, normalizeVisiblePetIds } = petRegistry;

test("desktop app registers seven distinct pets", () => {
  assert.equal(PET_DEFINITIONS.length, 7);
  assert.equal(new Set(PET_IDS).size, 7);
  assert.equal(getPetDefinition("lan").name, "昂昂");
  assert.equal(getPetDefinition("bo").name, "其其");
  assert.equal(getPetDefinition("grad").name, "11");
  assert.equal(getPetDefinition("white").name, "🤏✌️");
  assert.equal(getPetDefinition("sunflower").name, "dyson");
  assert.equal(getPetDefinition("center").name, "xx");
  assert.equal(getPetDefinition("jumper").name, "男🪣");
  assert.equal(PET_DEFINITIONS.some((pet) => "model" in pet), false);
});

test("every desktop pet has an available image asset", () => {
  for (const pet of PET_DEFINITIONS) {
    const asset = path.join(process.cwd(), "public", pet.image.replace(/^\.\//, ""));
    assert.equal(existsSync(asset), true, `${pet.id} is missing ${asset}`);
  }
});

test("visible pet selection is ordered, filtered, and never empty", () => {
  assert.deepEqual(normalizeVisiblePetIds(["center", "unknown", "lan", "center"]), ["lan", "center"]);
  assert.deepEqual(normalizeVisiblePetIds([]), ["lan"]);
  assert.deepEqual(normalizeVisiblePetIds(null), PET_IDS);
});
