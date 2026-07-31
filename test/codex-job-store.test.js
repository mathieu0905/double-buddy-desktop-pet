import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import store from "../electron/codex-job-store.cjs";
import worker from "../electron/codex-worker.cjs";

const { acknowledgeCodexJob, createCodexJob, readCodexJobs, writeJsonAtomic } = store;
const { main: runWorker } = worker;

test("Codex jobs persist independently from the Electron process", () => {
  const root = mkdtempSync(path.join(tmpdir(), "codex-job-store-test-"));
  const input = path.join(root, "person.jpg");
  writeFileSync(input, "photo");
  const created = createCodexJob({ root, name: "后台角色", imagePath: input, codexPath: "/bin/codex", prompt: "$imagegen" });
  let [job] = readCodexJobs(root);

  assert.equal(job.id, created.id);
  assert.equal(job.status, "queued");
  assert.equal(existsSync(job.inputPath), true);

  writeJsonAtomic(path.join(job.directory, "status.json"), { status: "running", message: "Codex 正在生成图片", startedAt: job.startedAt });
  [job] = readCodexJobs(root);
  assert.equal(job.status, "running");

  acknowledgeCodexJob(job.directory, { acknowledgedAt: Date.now(), petId: "custom-test" });
  [job] = readCodexJobs(root);
  assert.equal(job.acknowledgement.petId, "custom-test");
});

test("detached worker completes a job through the App Server JSONL protocol", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "codex-worker-test-"));
  const input = path.join(root, "person.jpg");
  const fakeCodex = path.join(root, "fake-codex");
  writeFileSync(input, "photo");
  writeFileSync(fakeCodex, `#!/usr/bin/env node
const readline = require("node:readline");
const { writeFileSync } = require("node:fs");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") process.stdout.write(JSON.stringify({ id: message.id, result: { userAgent: "fake" } }) + "\\n");
  if (message.method === "thread/start") process.stdout.write(JSON.stringify({ id: message.id, result: { thread: { id: "thread-test" } } }) + "\\n");
  if (message.method === "turn/start") {
    writeFileSync("desktop-pet.png", "png");
    process.stdout.write(JSON.stringify({ id: message.id, result: { turn: { id: "turn-test" } } }) + "\\n");
    process.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "thread-test", turn: { id: "turn-test", status: "completed" } } }) + "\\n");
  }
});
`);
  chmodSync(fakeCodex, 0o755);
  createCodexJob({ root, name: "协议角色", imagePath: input, codexPath: fakeCodex, prompt: "$imagegen" });

  await runWorker(root);
  const [job] = readCodexJobs(root);
  assert.equal(job.status, "succeeded");
  assert.equal(existsSync(job.outputPath), true);
});

test("Codex worker survives the process that launched it", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "codex-detached-worker-test-"));
  const input = path.join(root, "person.jpg");
  const fakeCodex = path.join(root, "fake-codex");
  const workerPath = fileURLToPath(new URL("../electron/codex-worker.cjs", import.meta.url));
  writeFileSync(input, "photo");
  writeFileSync(fakeCodex, `#!/usr/bin/env node
const readline = require("node:readline");
const { writeFileSync } = require("node:fs");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") process.stdout.write(JSON.stringify({ id: message.id, result: { userAgent: "fake" } }) + "\\n");
  if (message.method === "thread/start") process.stdout.write(JSON.stringify({ id: message.id, result: { thread: { id: "thread-detached" } } }) + "\\n");
  if (message.method === "turn/start") setTimeout(() => {
    writeFileSync("desktop-pet.png", "png");
    process.stdout.write(JSON.stringify({ id: message.id, result: { turn: { id: "turn-detached" } } }) + "\\n");
    process.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "thread-detached", turn: { id: "turn-detached", status: "completed" } } }) + "\\n");
  }, 250);
});
`);
  chmodSync(fakeCodex, 0o755);
  createCodexJob({ root, name: "重启不中断", imagePath: input, codexPath: fakeCodex, prompt: "$imagegen" });
  const launcher = `const {spawn}=require("node:child_process");const child=spawn(process.execPath,[${JSON.stringify(workerPath)},${JSON.stringify(root)}],{detached:true,stdio:"ignore"});child.unref();`;
  assert.equal(spawnSync(process.execPath, ["-e", launcher]).status, 0);

  const deadline = Date.now() + 5_000;
  let job;
  while (Date.now() < deadline) {
    [job] = readCodexJobs(root);
    if (job?.status === "succeeded") break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(job?.status, "succeeded");
});
