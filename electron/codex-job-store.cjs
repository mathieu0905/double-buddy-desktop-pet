const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } = require("node:fs");
const path = require("node:path");

function createCodexJob({ root, name, imagePath, codexPath, prompt, now = Date.now() }) {
  const id = `codex-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const directory = path.join(root, id);
  const extension = [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(imagePath).toLowerCase())
    ? path.extname(imagePath).toLowerCase()
    : ".jpg";
  const inputPath = path.join(directory, `input${extension}`);
  const outputPath = path.join(directory, "desktop-pet.png");
  mkdirSync(directory, { recursive: true });
  copyFileSync(imagePath, inputPath);
  const request = {
    id,
    name,
    provider: "codex",
    status: "queued",
    startedAt: now,
    finishedAt: null,
    message: "等待 Codex 后台工作进程",
    codexPath,
    inputPath,
    outputPath,
    workDirectory: directory,
    prompt
  };
  writeJsonAtomic(path.join(directory, "request.json"), request);
  return publicJob(request);
}

function readCodexJobs(root) {
  if (!existsSync(root)) return [];
  const jobs = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("codex-")) continue;
    const directory = path.join(root, entry.name);
    const request = readJson(path.join(directory, "request.json"));
    if (!request?.id) continue;
    const status = readJson(path.join(directory, "status.json")) || {};
    const acknowledgement = readJson(path.join(directory, "acknowledged.json")) || null;
    jobs.push({ ...publicJob({ ...request, ...status }), directory, inputPath: request.inputPath, outputPath: request.outputPath, acknowledgement });
  }
  return jobs.sort((a, b) => b.startedAt - a.startedAt);
}

function acknowledgeCodexJob(directory, value) {
  writeJsonAtomic(path.join(directory, "acknowledged.json"), value);
}

function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, JSON.stringify(value, null, 2));
  renameSync(temporaryPath, filePath);
}

function readJson(filePath) {
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function publicJob(value) {
  return {
    id: String(value.id),
    name: String(value.name || "新朋友"),
    provider: "codex",
    status: ["queued", "running", "succeeded", "failed"].includes(value.status) ? value.status : "queued",
    startedAt: Number(value.startedAt) || Date.now(),
    finishedAt: Number(value.finishedAt) || null,
    message: String(value.message || "等待 Codex 后台工作进程").slice(0, 500)
  };
}

module.exports = { acknowledgeCodexJob, createCodexJob, publicJob, readCodexJobs, readJson, writeJsonAtomic };
