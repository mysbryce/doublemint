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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-prefix-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("prefix ++ / --", () => {
  it("increments / decrements before yielding the value", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      export function main(): void {
        let n: int = 5;
        ++n;
        ++n;
        if (n == 7) { println("inc"); }

        let m: int = 5;
        --m;
        --m;
        if (m == 3) { println("dec"); }

        let x: int = 0;
        let y: int = ++x;
        if (y == 1) { println("prefix returns new"); }
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
    const outputPath = join(tempDir, "prefix.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "inc",
      "dec",
      "prefix returns new"
    ]);
  });
});
