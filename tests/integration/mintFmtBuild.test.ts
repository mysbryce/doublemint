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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-fmt-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("mint:fmt", () => {
  it("renders padded / hex / oct / bin / precision / thousands strings", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";
      import { Fmt } from "mint:fmt";

      export function main(): void {
        println(Fmt.padLeft("42", 6, "0"));
        println(Fmt.padRight("mint", 8, "."));
        println(Fmt.repeat("=", 10));
        println(Fmt.hex(255));
        println(Fmt.hexUpper(255));
        println(Fmt.octal(8));
        println(Fmt.binary(10));
        println(Fmt.precision(3.14159, 2));
        println(Fmt.withThousands(1234567, ","));
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
    const outputPath = join(tempDir, "fmt.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual([
      "000042",
      "mint....",
      "==========",
      "ff",
      "FF",
      "10",
      "1010",
      "3.14",
      "1,234,567"
    ]);
  });
});
