import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import generation from "../electron/pet-generation.cjs";

const { buildPetPrompt, codexProcessEnvironment, generateWithApi, normalizeApiBase } = generation;

test("API base normalization accepts HTTP endpoints and rejects unsafe schemes", () => {
  assert.equal(normalizeApiBase("https://example.com/v1/"), "https://example.com/v1");
  assert.throws(() => normalizeApiBase("file:///tmp/api"), /http/);
});

test("pet prompt requires a single full-body transparent character", () => {
  const prompt = buildPetPrompt("测试角色");
  assert.match(prompt, /测试角色/);
  assert.match(prompt, /full-body/);
  assert.match(prompt, /transparent background/);
  assert.match(prompt, /one character only/);
});

test("Codex process environment can launch an NVM-installed Node entry point", () => {
  const codexPath = path.join("/Users/example/.nvm/versions/node/v22/bin", "codex");
  const environment = codexProcessEnvironment(codexPath);

  assert.equal(environment.PATH.split(path.delimiter)[0], path.dirname(codexPath));
});

test("compatible API generation sends the reference image and decodes base64 output", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "pet-generation-test-"));
  const imagePath = path.join(directory, "person.png");
  writeFileSync(imagePath, Buffer.from("fake image"));
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("generated png").toString("base64") }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const bytes = await generateWithApi({
    imagePath,
    apiBase: "https://example.com/v1",
    apiKey: "secret-test-key",
    model: "image-model",
    name: "小新",
    fetchImpl
  });

  assert.equal(request.url, "https://example.com/v1/images/edits");
  assert.equal(request.options.headers.Authorization, "Bearer secret-test-key");
  assert.equal(request.options.body.get("model"), "image-model");
  assert.equal(request.options.body.get("background"), "transparent");
  assert.equal(bytes.toString(), "generated png");
});
