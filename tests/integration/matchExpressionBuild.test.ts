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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-matchexpr-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("match expression", () => {
  it("returns a value across enum and int discriminants", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      enum Day { Mon, Tue, Wed }

      export function name(d: Day): string {
        return match (d) {
          Day.Mon => "monday",
          Day.Tue => "tuesday",
          _ => "wednesday"
        };
      }

      export function size(n: int): string {
        let label: string = match (n) {
          0 => "zero",
          1 => "one",
          _ => "many"
        };
        return label;
      }

      export function main(): void {
        println(name(Day.Mon));
        println(name(Day.Wed));
        println(size(0));
        println(size(1));
        println(size(42));
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
    const outputPath = join(tempDir, "matchexpr.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "monday",
      "wednesday",
      "zero",
      "one",
      "many"
    ]);
  });

  it("rejects a match expression without a wildcard arm", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      export function pick(n: int): string {
        return match (n) {
          0 => "zero",
          1 => "one"
        };
      }
      export function main(): void {}
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/wildcard arm/);
  });

  it("rejects arms with mismatched types", async () => {
    const entry = join(tempDir, "bad2.dlm");
    await writeFile(
      entry,
      `
      export function pick(n: int): int {
        return match (n) {
          0 => 1,
          _ => "many"
        };
      }
      export function main(): void {}
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/same type/);
  });
});
