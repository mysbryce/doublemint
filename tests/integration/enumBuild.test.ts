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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-enum-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("enum declarations", () => {
  it("declares an enum, assigns variants, and compares equality", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      enum Color {
        Red,
        Green,
        Blue
      }

      export function describe(c: Color): string {
        if (c == Color.Red) { return "red"; }
        if (c == Color.Green) { return "green"; }
        return "blue";
      }

      export function main(): void {
        let c: Color = Color.Green;
        println(describe(c));
        if (c != Color.Red) { println("not red"); }
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
    const outputPath = join(tempDir, "enum.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().split(/\r?\n/u)).toEqual(["green", "not red"]);
  });

  it("rejects an unknown enum variant", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(
      entry,
      `
      enum Color { Red, Blue }
      export function main(): void {
        let c: Color = Color.Green;
      }
      `.trimStart(),
      "utf8"
    );
    const graph = await resolveModuleGraph(entry);
    expect(() => checkModuleGraph(graph)).toThrow(/no variant "Green"/);
  });
});
