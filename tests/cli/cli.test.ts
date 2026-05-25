import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = join(repoRoot, "src", "cli.ts");
const tsxBin = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);
const hasGpp = spawnSync("where.exe", ["g++"], { shell: true }).status === 0;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-cli-"));
  await writeFile(
    join(tempDir, "doublemint.config.json"),
    JSON.stringify(
      {
        rootDir: ".",
        outDir: "build/doublemint",
        cppStandard: "c++20",
        compiler: "g++",
        includeDirs: [],
        warningsAsErrors: true,
        optimization: "O3"
      },
      null,
      2
    ),
    "utf8"
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function runCli(args: string[]) {
  return spawnSync(tsxBin, [cliPath, ...args], {
    cwd: tempDir,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
}

function runCliWithInput(args: string[], input: string) {
  return spawnSync(tsxBin, [cliPath, ...args], {
    cwd: tempDir,
    encoding: "utf8",
    input,
    shell: process.platform === "win32"
  });
}

describe("doublemint CLI", () => {
  it("checks a valid entrypoint", async () => {
    await writeFile(join(tempDir, "main.dlm"), "export function main(): void {}\n", "utf8");

    const result = runCli(["check", "main.dlm"]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("OK 1 modules checked using c++20.");
    expect(result.stderr).toBe("");
  }, 15000);

  it("emits C++ files", async () => {
    await writeFile(join(tempDir, "main.dlm"), "export function main(): void {}\n", "utf8");

    const result = runCli(["emit", "main.dlm"]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("OK 2 C++ files emitted to build/doublemint.");
    await expect(access(join(tempDir, "build", "doublemint", "main.hpp"))).resolves.toBeUndefined();
    await expect(access(join(tempDir, "build", "doublemint", "main.cpp"))).resolves.toBeUndefined();
  }, 15000);

  it("prints diagnostic code frames on invalid source", async () => {
    await writeFile(
      join(tempDir, "bad.dlm"),
      "function main(): void {\n  let x = 1;\n}\n",
      "utf8"
    );

    const result = runCli(["check", "bad.dlm"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ERROR DLM2032");
    expect(result.stderr).toContain("  |   let x = 1;");
    expect(result.stderr).toContain("  |         ^");
  }, 15000);

  it("checks unsaved source from stdin using the original filepath", async () => {
    await writeFile(join(tempDir, "main.dlm"), "export function main(): void {}\n", "utf8");

    const result = runCliWithInput(
      ["check", "--stdin-filepath", "main.dlm"],
      "function main(): void {\n  let x = 1;\n}\n"
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ERROR DLM2032");
    expect(result.stderr).toContain("main.dlm:2:9");
    expect(result.stderr).toContain("  |   let x = 1;");
  }, 15000);

  it.skipIf(!hasGpp)("builds and runs a native executable", async () => {
    await writeFile(join(tempDir, "main.dlm"), "export function main(): void {}\n", "utf8");

    const result = runCli([
      "build",
      "main.dlm",
      "--out",
      "build/app.exe",
      "--cpp-out",
      "build/raw"
    ]);
    const run = spawnSync(join(tempDir, "build", "app.exe"), [], {
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK built");
    expect(result.stdout).toContain("with g++");
    expect(result.stdout).toContain(resolve(tempDir, "build", "raw"));
    await expect(access(join(tempDir, "build", "raw", "main.hpp"))).resolves.toBeUndefined();
    await expect(access(join(tempDir, "build", "raw", "main.cpp"))).resolves.toBeUndefined();
    expect(run.status).toBe(0);
  }, 15000);
});
