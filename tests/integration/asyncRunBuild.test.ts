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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-asyncrun-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("Async.run", () => {
  it("wraps a closure into a Future<T> and awaits the result", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";
      import { Async } from "mint:async";
      import { String } from "mint:string";

      export function main(): void {
        let f: Future<int> = Async.run(fn(): int => {
          return 21 * 2;
        });
        let v: int = await f;
        if (v == 42) { println("run ok"); }

        let s: string = await Async.run(fn(): string => {
          return "hello " + String.upper("mint");
        });
        println(s);
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
    const outputPath = join(tempDir, "asyncrun.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual(["run ok", "hello MINT"]);
  });
});
