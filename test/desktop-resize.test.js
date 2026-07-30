import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("desktop pet exposes a direct pointer resize control", () => {
  const html = readFileSync(new URL("../public/desktop.html", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../public/desktop.js", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  assert.match(html, /id="resizeHandle"/);
  assert.match(renderer, /resizeHandle\.addEventListener\("pointermove"/);
  assert.match(renderer, /desktop\?\.setPetScale\?\./);
  assert.match(renderer, /window\.addEventListener\("blur", deselectPet\)/);
  assert.match(preload, /pet:set-scale/);
  assert.match(preload, /onPetSelected/);
});
