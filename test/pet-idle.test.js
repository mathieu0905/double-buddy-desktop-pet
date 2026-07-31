import test from "node:test";
import assert from "node:assert/strict";
import idle from "../electron/pet-idle.cjs";

const {
  ACTIVITY_DELAY,
  REST_DELAY,
  foldedPosition,
  nextActivityDelay,
  nextRestDelay,
  occasionalAction
} = idle;

test("autonomous activity stays deliberately infrequent", () => {
  assert.equal(nextRestDelay(() => 0), REST_DELAY.min);
  assert.equal(nextRestDelay(() => 1), REST_DELAY.max);
  assert.equal(nextActivityDelay(1, () => 0), ACTIVITY_DELAY.min);
  assert.equal(nextActivityDelay(1, () => 1), ACTIVITY_DELAY.max);
  assert.equal(nextActivityDelay(7, () => 0), 472_500);
  assert.ok(ACTIVITY_DELAY.min >= 90_000);
});

test("resting pets tuck into their nearest screen edge", () => {
  const area = { x: 0, y: 0, width: 1440, height: 900 };
  assert.deepEqual(
    foldedPosition({ x: 80, y: 522, width: 280, height: 370 }, area, 0),
    { x: -213, y: 522, side: "left" }
  );
  assert.deepEqual(
    foldedPosition({ x: 1080, y: 522, width: 280, height: 370 }, area, 1),
    { x: 1373, y: 468, side: "right" }
  );
});

test("quiet walking is the most common occasional action", () => {
  assert.equal(occasionalAction(() => 0.2), "walk");
  assert.equal(occasionalAction(() => 0.5), "stretch");
  assert.equal(occasionalAction(() => 0.62), "wave");
  assert.equal(occasionalAction(() => 0.78), "jump");
  assert.equal(occasionalAction(() => 0.88), "dance");
  assert.equal(occasionalAction(() => 0.98), "run");
});
