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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-forof-dest-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("for-of with tuple destructure", () => {
  it("binds each tuple element to a name on every iteration", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      function makePair(n: int, name: string): [int, string] {
        return (n, name);
      }

      export function main(): void {
        let p1: [int, string] = makePair(1, "alpha");
        let p2: [int, string] = makePair(2, "beta");
        let p3: [int, string] = makePair(3, "gamma");
        let pairs: [int, string][] = [p1, p2, p3];
        for (let [n, name] of pairs) {
          println(n.toString() + " " + name);
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
    const outputPath = join(tempDir, "destfor.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "1 alpha",
      "2 beta",
      "3 gamma"
    ]);
  });

  it("rejects an arity mismatch in the destructure binding", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      function makePair(n: int, name: string): [int, string] {
        return (n, name);
      }
      export function main(): void {
        let p1: [int, string] = makePair(1, "alpha");
        let pairs: [int, string][] = [p1];
        for (let [n, name, extra] of pairs) {}
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/expects 2 bindings, got 3/);
  });
});
