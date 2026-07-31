import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import customPets from "../electron/custom-pets.cjs";

const { createCustomPetRecord, normalizeCustomPets } = customPets;

test("custom pet records use safe IDs and PNG filenames", () => {
  const pet = createCustomPetRecord("  新朋友  ", 123456);
  assert.match(pet.id, /^custom-[a-z0-9-]+$/);
  assert.equal(pet.name, "新朋友");
  assert.equal(pet.imageFile, `${pet.id}.png`);
});

test("custom pet loading rejects invalid and missing asset records", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "custom-pets-test-"));
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "custom-valid.png"), "png");
  const result = normalizeCustomPets([
    { id: "custom-valid", name: "有效", imageFile: "custom-valid.png" },
    { id: "../escape", name: "无效", imageFile: "../../secret" },
    { id: "custom-missing", name: "缺图", imageFile: "custom-missing.png" }
  ], directory);
  assert.deepEqual(result.map(({ id, name }) => ({ id, name })), [{ id: "custom-valid", name: "有效" }]);
});
