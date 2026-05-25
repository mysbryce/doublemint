import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(extensionRoot, "..", "..");
const sourceDist = join(repoRoot, "dist");
const bundledDist = join(extensionRoot, "server", "dist");

if (!existsSync(sourceDist)) {
  throw new Error(
    `Missing ${sourceDist}. Run "pnpm build" at repo root before packaging the VS Code extension.`
  );
}

rmSync(bundledDist, { recursive: true, force: true });
mkdirSync(dirname(bundledDist), { recursive: true });
cpSync(sourceDist, bundledDist, { recursive: true });
writeFileSync(
  join(bundledDist, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  "utf8"
);

console.log(`Bundled Doublemint CLI from ${sourceDist} to ${bundledDist}`);
