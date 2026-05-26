import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildNativeExecutable,
  checkModuleGraph,
  emitCppToDisk,
  resolveModuleGraph,
  type DoublemintConfig
} from "../../src/index.js";

let tempDir: string;

const hasGpp = spawnSync("where.exe", ["g++"], { shell: true }).status === 0;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-compound-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("compound assignment", () => {
  it("evaluates +=, -=, *=, /= against an int", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      export function main(): void {
        let n: int = 10;
        n += 5;
        n -= 3;
        n *= 2;
        n /= 4;
        if (n == 6) { println("ok"); }

        let acc: int = 0;
        for (let i: int = 1; i <= 5; i = i + 1) {
          acc += i;
        }
        if (acc == 15) { println("sum=15"); }
      }
      `.trimStart(),
      "utf8"
    );

    const config: DoublemintConfig = {
      rootDir: tempDir,
      outDir: join(tempDir, "build"),
      cppStandard: "c++20",
      compiler: "g++",
      includeDirs: [],
      warningsAsErrors: true,
      optimization: "O3"
    };
    const outputPath = join(tempDir, "compound.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual(["ok", "sum=15"]);
  });

  it("rejects compound assignment on a string", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      export function main(): void {
        let s: string = "hi";
        s += "!";
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/numeric operands/);
  });
});
