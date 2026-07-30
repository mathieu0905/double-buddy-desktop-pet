import test from "node:test";
import assert from "node:assert/strict";
import scaleHelpers from "../electron/pet-scale.cjs";

const {
  clampPetScale,
  petWindowSize,
  scaledPetBounds
} = scaleHelpers;

test("pet scale clamps invalid and out-of-range values", () => {
  assert.equal(clampPetScale(undefined), 1);
  assert.equal(clampPetScale(0.2), 0.7);
  assert.equal(clampPetScale(2), 1.6);
  assert.equal(clampPetScale(1.234), 1.23);
});

test("pet window size follows the selected scale", () => {
  assert.deepEqual(petWindowSize(1), { width: 280, height: 370 });
  assert.deepEqual(petWindowSize(1.5), { width: 420, height: 555 });
});

test("resizing keeps the pet centered and standing on the same baseline", () => {
  const next = scaledPetBounds(
    { x: 800, y: 500, width: 280, height: 370 },
    1.5,
    { x: 0, y: 0, width: 1440, height: 900 }
  );
  assert.deepEqual(next, { x: 730, y: 315, width: 420, height: 555 });
});
