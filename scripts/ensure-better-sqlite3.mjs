import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const moduleName = "better-sqlite3";
const nodeExecutable = process.execPath;
const nodeRoot = path.resolve(nodeExecutable, "..", "..");
const nodeHeadersDir = path.join(nodeRoot, "include", "node");
const localNpmCacheDir = path.join(process.cwd(), ".npm-cache");
const nodeGypBinsDir = path.join(
  process.cwd(),
  "node_modules",
  moduleName,
  "build",
  "node_gyp_bins",
);
const require = createRequire(import.meta.url);

function canLoadModule() {
  try {
    awaitImport();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function awaitImport() {
  const Database = require(moduleName);
  const database = new Database(":memory:");
  database.close();
}

function isAbiMismatch(error) {
  return (
    error instanceof Error &&
    error.message.includes("compiled against a different Node.js version")
  );
}

function rebuildModule() {
  const args = ["rebuild", moduleName];

  if (existsSync(nodeHeadersDir)) {
    args.push(`--nodedir=${nodeRoot}`);
  }

  rmSync(nodeGypBinsDir, { recursive: true, force: true });
  mkdirSync(localNpmCacheDir, { recursive: true });

  const result = spawnSync("npm", args, {
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: localNpmCacheDir,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const result = canLoadModule();

if (result.ok) {
  process.exit(0);
}

if (isAbiMismatch(result.error)) {
  console.warn(
    `[prepare-native] ${moduleName} ABI mismatch detected for Node ${process.version}; rebuilding...`,
  );
  rebuildModule();
  process.exit(0);
}

throw result.error;
