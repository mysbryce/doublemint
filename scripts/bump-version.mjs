#!/usr/bin/env node
// Doublemint versioning policy
// -----------------------------
// While pre-1.0 we live on `0.0.1-dev-<n>` where <n> is the count of
// shipped feature bumps. Each bump:
//   1. Increments <n> in package.json + ext/doublemint-vscode/package.json
//   2. Creates patch-notes/0.0.1-dev-<n>.md
//   3. Is committed by hand with a clear message
// Once every planned phase ships, the next bump moves us to 0.0.1 proper.
//
// Usage:
//   node scripts/bump-version.mjs "<title>"
// Example:
//   node scripts/bump-version.mjs "Phase 2 step 1 — mint:string"

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPkgPath = join(repoRoot, "package.json");
const extPkgPath = join(repoRoot, "ext", "doublemint-vscode", "package.json");
const notesDir = join(repoRoot, "patch-notes");

const title = (process.argv[2] ?? "").trim();
if (!title) {
  console.error("Usage: node scripts/bump-version.mjs \"<title>\"");
  process.exit(1);
}

const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
const current = rootPkg.version;
const match = /^0\.0\.1-dev-(\d+)$/u.exec(current);
if (!match) {
  console.error(`Refusing to bump: package.json version "${current}" is not in 0.0.1-dev-<n> format.`);
  process.exit(1);
}

const nextN = Number(match[1]) + 1;
const nextVersion = `0.0.1-dev-${nextN}`;

rootPkg.version = nextVersion;
writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`, "utf8");

if (existsSync(extPkgPath)) {
  const extPkg = JSON.parse(readFileSync(extPkgPath, "utf8"));
  extPkg.version = nextVersion;
  writeFileSync(extPkgPath, `${JSON.stringify(extPkg, null, 2)}\n`, "utf8");
}

mkdirSync(notesDir, { recursive: true });
const notePath = join(notesDir, `${nextVersion}.md`);
if (!existsSync(notePath)) {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    notePath,
    `# ${nextVersion} — ${title}\n\n_Released ${today}_\n\n## Highlights\n\n- TODO: describe the bump.\n\n## Files touched\n\n- TODO\n\n## Tests / examples\n\n- TODO\n`,
    "utf8"
  );
}

console.log(`Bumped to ${nextVersion}.`);
console.log(`Patch notes draft at ${notePath} — fill it in before committing.`);
