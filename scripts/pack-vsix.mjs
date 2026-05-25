import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = resolve(repoRoot, "ext", "doublemint-vscode");
const outputPath = resolve(repoRoot, "build", "doublemint-vscode-0.1.0.vsix");

run("pnpm", ["build"], repoRoot);
mkdirSync(dirname(outputPath), { recursive: true });
run("pnpm", ["dlx", "@vscode/vsce", "package", "--out", outputPath], extensionRoot);

console.log(`VSIX packed: ${outputPath}`);

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

