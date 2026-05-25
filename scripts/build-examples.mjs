import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = resolve(repoRoot, "examples");
const buildRoot = resolve(repoRoot, "build", "examples");
const cliPath = resolve(repoRoot, "dist", "cli.js");

if (!existsSync(cliPath)) {
  run("pnpm", ["build"], repoRoot);
}

const entries = findEntries(examplesRoot);
const isWindows = process.platform === "win32";
const exeSuffix = isWindows ? ".exe" : "";
const failures = [];

for (const entry of entries) {
  const relPath = relative(examplesRoot, entry);
  const slug = relPath.replace(/main\.dlm$/u, "").replace(/[\\/]+$/u, "");
  const flatSlug = slug.length === 0 ? "main" : slug.replace(/[\\/]+/gu, "_");
  const outDir = resolve(buildRoot, slug || "main");
  const cppDir = resolve(outDir, "cpp");
  const exePath = resolve(outDir, `${flatSlug}${exeSuffix}`);

  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== building ${relPath} ===`);
  const result = spawnSync(
    process.execPath,
    [cliPath, "build", entry, "--out", exePath, "--cpp-out", cppDir],
    { cwd: repoRoot, stdio: "inherit" }
  );

  if (result.status !== 0) {
    failures.push({ entry: relPath, status: result.status });
  }
}

console.log("\n=== summary ===");
console.log(`built ${entries.length - failures.length}/${entries.length} examples`);
if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`  FAIL ${failure.entry} (status ${failure.status})`);
  }
  process.exit(1);
}

function findEntries(root) {
  const out = [];
  for (const item of readdirSync(root)) {
    const full = resolve(root, item);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...findEntries(full));
    } else if (stat.isFile() && item === "main.dlm") {
      out.push(full);
    }
  }
  return out;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
