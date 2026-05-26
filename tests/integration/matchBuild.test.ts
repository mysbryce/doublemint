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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-match-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("match statement", () => {
  it("dispatches on int literals, enum variants, and a wildcard arm", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      enum Day { Mon, Tue, Wed, Fri }

      export function classify(n: int): string {
        match (n) {
          0 => { return "zero"; },
          1 => { return "one"; },
          _ => { return "many"; }
        }
        return "unreachable";
      }

      export function main(): void {
        println(classify(0));
        println(classify(1));
        println(classify(99));

        let d: Day = Day.Wed;
        match (d) {
          Day.Mon => println("monday"),
          Day.Tue => println("tuesday"),
          Day.Wed => {
            println("wednesday");
            println("midweek");
          }
          _ => println("other")
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
    const outputPath = join(tempDir, "match.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "zero",
      "one",
      "many",
      "wednesday",
      "midweek"
    ]);
  });

  it("rejects more than one wildcard arm", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      export function main(): void {
        let n: int = 5;
        match (n) {
          1 => { return; },
          _ => { return; },
          _ => { return; }
        }
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/more than one wildcard/);
  });
});
