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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-forof-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("for-of loop", () => {
  it("iterates int[] and string[] with explicit and inferred binding types", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      export function main(): void {
        let xs: int[] = [1, 2, 3, 4, 5];
        let sum: int = 0;
        for (let x of xs) {
          sum += x;
        }
        if (sum == 15) { println("sum ok"); }

        for (let name: string of ["alpha", "beta", "gamma"]) {
          println(name);
        }
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
    const outputPath = join(tempDir, "forof.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual(["sum ok", "alpha", "beta", "gamma"]);
  });

  it("rejects for-of over a non-array", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      export function main(): void {
        let s: string = "hello";
        for (let c of s) {}
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/array iterable/);
  });
});
