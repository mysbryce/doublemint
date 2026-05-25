import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const manifestPath = join(repoRoot, "ext", "doublemint-vscode", "builtin-manifest.json");
const runnerPath = join(repoRoot, "scripts", "print-manifest.mts");

if (!existsSync(tsxBin)) {
  throw new Error(`tsx not found at ${tsxBin}. Run "pnpm install" first.`);
}

const result = spawnSync(tsxBin, [runnerPath], { encoding: "utf8", shell: process.platform === "win32" });
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Failed to generate manifest: tsx exited with ${result.status}`);
}

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${result.stdout.trimEnd()}\n`, "utf8");
console.log(`Refreshed builtin manifest -> ${manifestPath}`);
