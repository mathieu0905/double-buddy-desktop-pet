const { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");
const { readJson, writeJsonAtomic } = require("./codex-job-store.cjs");

const MAX_JOB_MS = 15 * 60_000;

async function main(root) {
  mkdirSync(root, { recursive: true });
  if (!acquireWorkerLock(root)) return;
  try {
    for (;;) {
      const job = nextJob(root);
      if (!job) break;
      await processJob(job);
    }
  } finally {
    rmSync(path.join(root, ".worker-lock"), { recursive: true, force: true });
  }
}

function acquireWorkerLock(root) {
  const lockDirectory = path.join(root, ".worker-lock");
  try {
    mkdirSync(lockDirectory);
    writeFileSync(path.join(lockDirectory, "pid"), String(process.pid));
    return true;
  } catch {
    try {
      const pid = Number(readFileSync(path.join(lockDirectory, "pid"), "utf8"));
      process.kill(pid, 0);
      return false;
    } catch {
      rmSync(lockDirectory, { recursive: true, force: true });
      return acquireWorkerLock(root);
    }
  }
}

function nextJob(root) {
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !entry.name.startsWith("codex-")) continue;
    const directory = path.join(root, entry.name);
    const request = readJson(path.join(directory, "request.json"));
    const status = readJson(path.join(directory, "status.json"));
    if (!request || ["succeeded", "failed"].includes(status?.status)) continue;
    return { ...request, directory };
  }
  return null;
}

async function processJob(job) {
  writeStatus(job, { status: "running", startedAt: job.startedAt || Date.now(), finishedAt: null, message: "Codex 正在生成图片" });
  try {
    await runAppServerTurn(job);
    if (!existsSync(job.outputPath)) throw new Error("Codex 已完成，但没有生成 desktop-pet.png");
    writeStatus(job, { status: "succeeded", startedAt: job.startedAt, finishedAt: Date.now(), message: "图片生成完成，等待 App 添加角色" });
  } catch (error) {
    const message = String(error?.message || error || "Codex 生成失败").slice(-500);
    writeStatus(job, { status: "failed", startedAt: job.startedAt, finishedAt: Date.now(), message });
  }
}

async function runAppServerTurn(job) {
  const child = spawn(job.codexPath, ["app-server", "--listen", "stdio://"], {
    cwd: job.workDirectory,
    env: { ...process.env, PATH: [path.dirname(job.codexPath), process.env.PATH || ""].filter(Boolean).join(path.delimiter) },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = createAppServerClient(child);
  try {
    await client.request("initialize", {
      clientInfo: { name: "double_buddy_desktop_pet", title: "一起摸鱼", version: "1.0.0" }
    });
    client.notify("initialized", {});
    const threadResult = await client.request("thread/start", {
      cwd: job.workDirectory,
      sandbox: "workspace-write",
      approvalPolicy: "never",
      ephemeral: false,
      serviceName: "desktop-pet-image-generation"
    });
    const threadId = threadResult?.thread?.id;
    if (!threadId) throw new Error("Codex App Server 没有返回 thread id");
    const completion = client.waitFor("turn/completed", (params) => params?.threadId === threadId, MAX_JOB_MS);
    await client.request("turn/start", {
      threadId,
      input: [
        { type: "text", text: job.prompt, text_elements: [] },
        { type: "localImage", path: job.inputPath }
      ],
      cwd: job.workDirectory,
      approvalPolicy: "never",
      sandboxPolicy: {
        type: "workspaceWrite",
        writableRoots: [job.workDirectory],
        networkAccess: true,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false
      }
    });
    const completed = await completion;
    if (completed?.turn?.status !== "completed") {
      throw new Error(completed?.turn?.error?.message || `Codex turn 状态：${completed?.turn?.status || "未知"}`);
    }
  } finally {
    client.close();
  }
}

function createAppServerClient(child) {
  let nextId = 1;
  let stderr = "";
  const pending = new Map();
  const waiters = new Set();
  const lines = readline.createInterface({ input: child.stdout });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4_000); });
  lines.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined && !message.method && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "Codex App Server 请求失败"));
      else resolve(message.result);
      return;
    }
    if (message.id !== undefined && message.method) {
      child.stdin.write(`${JSON.stringify({ id: message.id, error: { code: -32601, message: "Background image worker cannot handle interactive requests" } })}\n`);
      return;
    }
    if (!message.method) return;
    for (const waiter of [...waiters]) {
      if (waiter.method === message.method && waiter.predicate(message.params)) {
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
        waiter.resolve(message.params);
      }
    }
  });
  child.on("exit", (code) => {
    const error = new Error(`Codex App Server 已退出（${code ?? "unknown"}）：${stderr.trim()}`);
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
    for (const waiter of waiters) waiter.reject(error);
    waiters.clear();
  });
  child.on("error", (cause) => {
    const error = new Error(`无法启动 Codex App Server：${cause.message}`);
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
    for (const waiter of waiters) waiter.reject(error);
    waiters.clear();
  });

  return {
    request(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Codex App Server 请求超时：${method}`));
        }, 30_000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
      });
    },
    notify(method, params) { child.stdin.write(`${JSON.stringify({ method, params })}\n`); },
    waitFor(method, predicate, timeout) {
      return new Promise((resolve, reject) => {
        const waiter = { method, predicate, resolve, reject };
        waiter.timer = setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error("Codex 图片生成超过 15 分钟"));
        }, timeout);
        waiters.add(waiter);
      });
    },
    close() {
      lines.close();
      if (!child.killed) child.kill();
    }
  };
}

function writeStatus(job, value) {
  writeJsonAtomic(path.join(job.directory, "status.json"), { id: job.id, name: job.name, provider: "codex", ...value });
}

if (require.main === module) {
  main(path.resolve(process.argv[2] || ".")).catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { acquireWorkerLock, createAppServerClient, main, nextJob, runAppServerTurn };
