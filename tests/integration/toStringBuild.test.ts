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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-tostring-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("numeric toString()", () => {
  it("renders int, int64, and float", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";

      export function main(): void {
        let n: int = 42;
        println("n=" + n.toString());

        let pi: float = 3.14;
        println("pi=" + pi.toString());

        let big: int64 = 1000;
        println("big=" + big.toString());
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
    const outputPath = join(tempDir, "tostring.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    const lines = run.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("n=42");
    expect(lines[1]).toMatch(/^pi=3\.14/u);
    expect(lines[2]).toBe("big=1000");
  });
});
