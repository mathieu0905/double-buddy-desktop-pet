import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAction,
  applyElapsedDecay,
  createInitialState,
  intimacyBetween,
  moodLabel,
  normalizeState,
  renamePets
} from "../src/pet.js";

test("initial state creates all seven distinct pets", () => {
  const state = createInitialState(1_000);
  assert.equal(state.selectedId, "lan");
  assert.equal(Object.keys(state.pets).length, 7);
  assert.equal(state.pets.lan.name, "昂昂");
  assert.equal(state.pets.bo.name, "其其");
  assert.notEqual(state.pets.lan, state.pets.bo);
});

test("feeding only updates the selected pet and clamps values", () => {
  const state = createInitialState(1_000);
  state.pets.lan.hunger = 94;
  const next = applyAction(state, "lan", "feed", 1_000);
  assert.equal(next.pets.lan.hunger, 100);
  assert.equal(next.pets.bo.hunger, 82);
  assert.equal(next.bond, 73);
});

test("playing improves mood while consuming hunger and energy", () => {
  const state = createInitialState(1_000);
  const next = applyAction(state, "bo", "play", 1_000);
  assert.equal(next.pets.bo.mood, 100);
  assert.equal(next.pets.bo.hunger, 76);
  assert.equal(next.pets.bo.energy, 78);
  assert.equal(next.bond, 75);
});

test("elapsed time decays needs and caps offline decay at one day", () => {
  const start = 1_000;
  const state = createInitialState(start);
  const next = applyElapsedDecay(state, start + 48 * 60 * 60 * 1_000);
  assert.equal(next.pets.lan.hunger, 6);
  assert.ok(next.pets.lan.energy < 27);
  assert.equal(next.lastUpdatedAt, start + 48 * 60 * 60 * 1_000);
});

test("corrupt persisted state is normalized safely", () => {
  const next = normalizeState({ selectedId: "ghost", bond: 900, pets: { lan: { name: "", hunger: -8 } } }, 2_000);
  assert.equal(next.selectedId, "lan");
  assert.equal(next.bond, 100);
  assert.equal(next.pets.lan.name, "昂昂");
  assert.equal(next.pets.lan.hunger, 0);
  assert.equal(next.pets.bo.name, "其其");
});

test("renaming trims names and retains fallback for empty input", () => {
  const state = createInitialState(1_000);
  const next = renamePets(state, { lan: "  花花  ", bo: "" }, 2_000);
  assert.equal(next.pets.lan.name, "花花");
  assert.equal(next.pets.bo.name, "其其");
});

test("runtime-created pets participate in state and interactions", () => {
  const definitions = [
    { id: "lan", name: "昂昂", hunger: 86, mood: 92, energy: 78 },
    { id: "custom-friend", name: "新朋友", hunger: 80, mood: 85, energy: 90 }
  ];
  const state = createInitialState(1_000, definitions);
  const next = applyAction(state, "custom-friend", "pet", 1_000, definitions);
  assert.equal(Object.keys(next.pets).length, 2);
  assert.equal(next.selectedId, "custom-friend");
  assert.equal(next.pets["custom-friend"].mood, 90);
  assert.equal(intimacyBetween(next, "lan", "custom-friend"), 35);
});

test("every pair of characters has a normalized intimacy value", () => {
  const state = createInitialState(1_000);
  assert.equal(Object.keys(state.relationships).length, 21);
  assert.equal(intimacyBetween(state, "lan", "bo"), 72);
  const normalized = normalizeState({ ...state, relationships: { "bo:lan": 999, "grad:lan": -4 } }, 2_000);
  assert.equal(intimacyBetween(normalized, "bo", "lan"), 100);
  assert.equal(intimacyBetween(normalized, "lan", "grad"), 0);
});

test("mood labels prioritize urgent energy and hunger states", () => {
  assert.equal(moodLabel({ hunger: 90, mood: 90, energy: 10 }), "困到睁不开眼");
  assert.equal(moodLabel({ hunger: 10, mood: 90, energy: 90 }), "肚子咕咕叫");
  assert.equal(moodLabel({ hunger: 90, mood: 90, energy: 90 }), "心情超好");
});
