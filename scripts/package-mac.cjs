const { mkdirSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "release");
const appPath = path.join(outputDirectory, "一起摸鱼-darwin-arm64", "一起摸鱼.app");
const packager = path.join(projectRoot, "node_modules", ".bin", "electron-packager");
const args = [
  ".", "一起摸鱼",
  "--platform=darwin",
  "--arch=arm64",
  `--out=${outputDirectory}`,
  "--overwrite",
  `--icon=${path.join(projectRoot, "build", "icon.icns")}`,
  "--ignore=^/(sites-web|phd-simulator|phd-simulator-node_modules-dataless-backup-20260728|release|\\.git|\\.runtime|tools)(/|$)",
  "--ignore=\\.tar\\.gz$",
  "--ignore=^/test(/|$)"
];

const result = spawnSync(packager, args, { cwd: projectRoot, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const signal = JSON.stringify({ appPath, builtAt: Date.now() });
for (const appName of ["一起摸鱼", "double-buddy-desktop-pet"]) {
  const userData = path.join(homedir(), "Library", "Application Support", appName);
  mkdirSync(userData, { recursive: true });
  writeFileSync(path.join(userData, "local-build-ready.json"), signal);
}

console.log("Local build complete. A running app with local-update support will restart automatically.");
