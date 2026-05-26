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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-trycatch-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("try / catch / throw", () => {
  it("catches a thrown string and runs the catch block", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      function risky(n: int): int {
        if (n < 0) {
          throw "negative not allowed";
        }
        return n * 2;
      }

      export function main(): void {
        try {
          let v: int = risky(5);
          println("got " + v.toString());
        } catch (err: string) {
          println("caught: " + err);
        }

        try {
          let v: int = risky(-1);
          println("unreached " + v.toString());
        } catch (err: string) {
          println("caught: " + err);
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
    const outputPath = join(tempDir, "trycatch.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "got 10",
      "caught: negative not allowed"
    ]);
  });

  it("rejects throw with a non-string argument", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      export function main(): void {
        throw 42;
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/string argument/);
  });
});
