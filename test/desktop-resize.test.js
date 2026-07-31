import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("desktop pet exposes a direct pointer resize control", () => {
  const html = readFileSync(new URL("../public/desktop.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  assert.match(html, /id="resizeHandle"/);
  assert.match(html, /id="rotateHandle"/);
  assert.match(html, /id="hideHandle"/);
  assert.match(renderer, /resizeHandle\.addEventListener\("pointermove"/);
  assert.match(renderer, /desktop\?\.setPetScale\?\./);
  assert.match(renderer, /desktop\?\.setPetRotation\?\./);
  assert.match(renderer, /ui\.image\.style\.rotate/);
  assert.match(renderer, /window\.addEventListener\("blur", deselectPet\)/);
  assert.match(preload, /pet:set-scale/);
  assert.match(preload, /pet:set-rotation/);
  assert.match(preload, /pet:unfold/);
  assert.match(preload, /pet:sync-relationships/);
  assert.match(preload, /pet:relationships-changed/);
  assert.match(preload, /pet:hide/);
  assert.match(preload, /onPetSelected/);
  assert.match(preload, /creator:generate/);
  assert.match(preload, /creator:generation-finished/);
  assert.match(preload, /creator:open/);
  assert.match(preload, /pet:get-definitions/);
  assert.match(preload, /pet:set-visible/);
  assert.match(preload, /pet:visibility-changed/);
  assert.match(preload, /getPathForFile/);
});

test("selected desktop pets expose one-click actions without nested context menus", () => {
  const html = readFileSync(new URL("../public/desktop.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

  assert.match(html, /id="quickActions"/);
  assert.match(html, /data-pet-action="feed"/);
  assert.match(html, /data-quick-panel="motion"/);
  assert.match(html, /data-quick-panel="pair"/);
  assert.match(renderer, /function openQuickPanel/);
  assert.match(renderer, /function openPartnerPicker/);
  assert.match(renderer, /function hideQuickControls/);
  assert.match(renderer, /motionButton\) \{\s*hideQuickControls\(\)/);
  assert.match(renderer, /partnerButton\) \{\s*hideQuickControls\(\)/);
  assert.match(renderer, /desktop\?\.performPetMotion/);
  assert.match(renderer, /desktop\?\.performPairInteraction/);
  assert.match(preload, /pet:perform-motion/);
  assert.match(preload, /pet:perform-pair/);
  assert.match(main, /DIRECT_MOTIONS/);
  assert.match(main, /DIRECT_PAIR_ACTIONS/);
});

test("desktop pets rest at the edge and move only occasionally", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");

  assert.match(main, /function foldPet/);
  assert.match(main, /nextActivityDelay/);
  assert.match(main, /occasionalAction/);
  assert.match(renderer, /desktop\?\.unfoldPet\?\.\(\)/);
});

test("selected image and 3D pets both expose mouse rotation", () => {
  const styles = readFileSync(new URL("../public/desktop.css", import.meta.url), "utf8");

  assert.match(styles, /\.pet-hitbox\.is-selected \.rotate-handle \{ display: block; \}/);
  assert.doesNotMatch(styles, /is-selected\.has-model \.rotate-handle/);
});

test("desktop interaction follows the visible character without a selection box", () => {
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/desktop.css", import.meta.url), "utf8");
  const petRenderer = readFileSync(new URL("../src/pet-renderer.js", import.meta.url), "utf8");

  assert.match(renderer, /imageHitContext\.getImageData/);
  assert.match(renderer, /modelRenderer\.hitTest/);
  assert.match(renderer, /setMouseIgnored\(!interactive\)/);
  assert.doesNotMatch(styles, /\.pet-hitbox\.is-selected::after/);
  assert.match(petRenderer, /hitRaycaster\.intersectObject/);
});

test("creator accepts a photo by drag and drop", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="creatorDropZone"/);
  assert.match(renderer, /addEventListener\("drop"/);
  assert.match(renderer, /selectDroppedCreatorImage/);
});

test("creator can import an existing Q-style image without AI generation", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

  assert.match(html, /value="direct"/);
  assert.match(html, /直接导入 Q 图/);
  assert.match(renderer, /result\.imported/);
  assert.match(main, /provider === "direct"/);
  assert.match(main, /addGeneratedPet\(bytes, name\)/);
});

test("custom desktop pets load their own image instead of a built-in fallback", () => {
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");

  assert.match(renderer, /FALLBACK_IMAGES\[petId\] \|\| ""/);
  assert.match(renderer, /getCustomPetImage\?\.\(petId\)/);
  assert.doesNotMatch(renderer, /params\.get\("image"\) \|\| \(petId === "bo"/);
});

test("creator opens inside the existing hub instead of a separate window", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(main, /hub:open-creator/);
  assert.doesNotMatch(main, /function createCreatorWindow/);
  assert.match(html, /id="creatorDialog"/);
});

test("desktop app discovers Codex through the user's login shell", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

  assert.match(main, /\["-lic", "command -v codex"\]/);
  assert.match(main, /cachedCodexBinary/);
});

test("a completed local build signals the running app to relaunch", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const packageScript = readFileSync(new URL("../scripts/package-mac.cjs", import.meta.url), "utf8");

  assert.match(main, /local-build-ready\.json/);
  assert.match(main, /app\.relaunch/);
  assert.match(packageScript, /builtAt: Date\.now\(\)/);
});

test("desktop pets expose procedural 3D and paired interactions", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/desktop.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");

  assert.match(html, /id="petModel"/);
  assert.match(renderer, /createPetRenderer/);
  assert.match(main, /function pairInteraction/);
  assert.match(main, /AUTO_PAIR_INTIMACY/);
  assert.match(main, /scheduleRelationshipInteraction/);
  assert.match(main, /automaticPairAction/);
  assert.match(main, /pairInteraction\(petId, pet\.id, action\)/);
  assert.match(main, /亲一下/);
  assert.match(main, /抱一下/);
  assert.match(main, /打架/);
  assert.match(main, /伸个懒腰/);
  assert.match(main, /挥挥手/);
  assert.match(main, /把手从兜里拿出来/);
  assert.match(main, /一起躺平/);
  assert.match(main, /kiss: \{ overlap: 112, duration: 2_800 \}/);
  assert.match(main, /hug: \{ overlap: 138, duration: 4_200 \}/);
  assert.match(main, /fight: \{ overlap: 64, duration: 4_000 \}/);
  assert.match(renderer, /motion-hug/);
  assert.match(renderer, /motion-fight/);
  assert.match(renderer, /motion-stretch/);
  assert.match(renderer, /motion-wave/);
  assert.match(renderer, /pullOut/);
});

test("pet house renders rotatable 3D characters with image fallback", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(html, /id="petDetailModel"/);
  assert.match(renderer, /createPetRenderer/);
  assert.match(renderer, /mountPetCardRenderers/);
  assert.match(renderer, /bindRotationDrag/);
  assert.match(renderer, /setRotation/);
  assert.match(styles, /\.pet-card-model/);
  assert.match(styles, /\.pet-detail-model/);
});

test("pet generation runs in the background and sends a system notification", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const creator = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(main, /void generateCustomPet\(event, options\)\.then/);
  assert.match(main, /new Notification/);
  assert.match(creator, /已转入后台/);
});

test("hub exposes live background generation jobs", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  assert.match(html, /id="generationTasksButton"/);
  assert.match(html, /id="generationTaskList"/);
  assert.match(renderer, /renderGenerationJobs/);
  assert.match(preload, /creator:get-jobs/);
  assert.match(preload, /creator:generation-jobs/);
});

test("Codex generation uses a detached App Server protocol worker", () => {
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../electron/codex-worker.cjs", import.meta.url), "utf8");

  assert.match(main, /ELECTRON_RUN_AS_NODE/);
  assert.match(main, /detached: true/);
  assert.match(worker, /"app-server", "--listen", "stdio:\/\/"/);
  assert.match(worker, /request\("thread\/start"/);
  assert.match(worker, /request\("turn\/start"/);
});

test("hub exposes one circular desktop visibility toggle per pet", () => {
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(renderer, /visibility-toggle/);
  assert.match(renderer, /data-toggle-visibility/);
  assert.match(styles, /\.visibility-toggle\.checked::after/);
});

test("clicking a hub character opens details with relationships and actions", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="petDetailDialog"/);
  assert.match(html, /id="relationshipList"/);
  assert.match(html, /data-detail-action="pet"/);
  assert.match(renderer, /openPetDetails/);
  assert.match(renderer, /intimacyBetween/);
  assert.match(renderer, /亲密值/);
});
