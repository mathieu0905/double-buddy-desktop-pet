const { execFile } = require("node:child_process");
const { mkdtemp, readFile, readdir, rm, stat } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const DEFAULT_API_BASE = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;

function normalizeApiBase(value) {
  const candidate = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  let url;
  try { url = new URL(candidate); } catch { throw new Error("API Base 不是有效的网址"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("API Base 必须使用 http 或 https");
  return url.toString().replace(/\/+$/, "");
}

function buildPetPrompt(name) {
  return [
    `Transform the person in the reference photo into an original full-body chibi desktop pet named ${String(name || "新朋友").trim() || "新朋友"}.`,
    "Preserve their recognizable face, hairstyle, glasses, clothing colors, and distinctive accessories.",
    "Use a polished cute 2D game-character illustration style with clean outlines, soft shading, a friendly neutral standing pose, and the entire body visible from head to shoes.",
    "Center one character only. No text, logo, border, frame, props, extra people, cropped limbs, or floor shadow.",
    "Return a portrait PNG with a transparent background suitable for a floating desktop pet."
  ].join(" ");
}

function mimeTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

async function validateInputImage(filePath) {
  const details = await stat(filePath);
  if (!details.isFile()) throw new Error("请选择一个图片文件");
  if (details.size <= 0 || details.size > MAX_INPUT_BYTES) throw new Error("图片大小需要在 20 MB 以内");
}

async function generateWithApi({ imagePath, apiBase, apiKey, model, name, fetchImpl = fetch }) {
  await validateInputImage(imagePath);
  if (!String(apiKey || "").trim()) throw new Error("请填写 API Key");

  const imageBytes = await readFile(imagePath);
  const form = new FormData();
  form.append("model", String(model || DEFAULT_IMAGE_MODEL).trim());
  form.append("prompt", buildPetPrompt(name));
  form.append("image[]", new Blob([imageBytes], { type: mimeTypeFor(imagePath) }), path.basename(imagePath));
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  form.append("output_format", "png");
  form.append("background", "transparent");

  const response = await fetchImpl(`${normalizeApiBase(apiBase)}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${String(apiKey).trim()}` },
    body: form,
    signal: AbortSignal.timeout(8 * 60_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `图片生成失败（HTTP ${response.status}）`;
    throw new Error(String(message).slice(0, 500));
  }

  const result = payload?.data?.[0];
  if (result?.b64_json) return Buffer.from(result.b64_json, "base64");
  if (result?.url) return downloadGeneratedImage(result.url, fetchImpl);
  throw new Error("API 没有返回可用的图片数据");
}

async function downloadGeneratedImage(value, fetchImpl) {
  let url;
  try { url = new URL(value); } catch { throw new Error("API 返回了无效的图片地址"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("API 返回的图片地址不安全");
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`下载生成图片失败（HTTP ${response.status}）`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_OUTPUT_BYTES) throw new Error("生成图片超过 30 MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > MAX_OUTPUT_BYTES) throw new Error("生成图片大小异常");
  return bytes;
}

async function generateWithCodex({ imagePath, codexPath, name, workRoot }) {
  await validateInputImage(imagePath);
  if (!codexPath) throw new Error("没有找到 Codex CLI，请先安装并运行 codex login");
  const processOptions = {
    env: codexProcessEnvironment(codexPath),
    timeout: 20_000,
    maxBuffer: 1024 * 1024
  };

  try {
    await execFileAsync(codexPath, ["login", "status"], processOptions);
  } catch (error) {
    const detail = String(error?.stderr || error?.message || "").trim();
    if (/not logged in|not authenticated|login required/i.test(detail)) {
      throw new Error("Codex 尚未登录，请先在终端运行 codex login");
    }
    throw new Error(`Codex CLI 无法启动：${detail || "未知错误"}`);
  }

  const workDir = await mkdtemp(path.join(workRoot || tmpdir(), "pet-imagegen-"));
  const outputPath = path.join(workDir, "desktop-pet.png");
  const prompt = [
    "$imagegen",
    buildPetPrompt(name),
    `Use the attached photo as the identity reference. Save the final PNG exactly to ${outputPath}.`,
    "Do not modify any other files."
  ].join("\n");

  try {
    try {
      await execFileAsync(codexPath, [
        "exec", "--ephemeral", "--sandbox", "workspace-write", "--skip-git-repo-check",
        "-C", workDir, "-i", imagePath, prompt
      ], { ...processOptions, timeout: 8 * 60_000, maxBuffer: 12 * 1024 * 1024 });
    } catch (error) {
      const detail = String(error?.stderr || error?.message || "Codex 图片生成失败").trim();
      throw new Error(detail.slice(-800));
    }

    const candidates = await findPngFiles(workDir);
    const generatedPath = candidates.includes(outputPath) ? outputPath : candidates[0];
    if (!generatedPath) throw new Error("Codex 已结束，但没有找到生成的 PNG 文件");
    const bytes = await readFile(generatedPath);
    if (bytes.length <= 0 || bytes.length > MAX_OUTPUT_BYTES) throw new Error("Codex 生成图片大小异常");
    return bytes;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function codexProcessEnvironment(codexPath) {
  const executableDirectory = path.dirname(codexPath);
  const inheritedPath = String(process.env.PATH || "");
  return {
    ...process.env,
    PATH: [executableDirectory, inheritedPath].filter(Boolean).join(path.delimiter)
  };
}

async function findPngFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await findPngFiles(target));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") results.push(target);
  }
  return results;
}

module.exports = {
  DEFAULT_API_BASE,
  DEFAULT_IMAGE_MODEL,
  buildPetPrompt,
  codexProcessEnvironment,
  generateWithApi,
  generateWithCodex,
  normalizeApiBase,
  validateInputImage
};
