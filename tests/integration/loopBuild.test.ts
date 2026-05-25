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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-loop-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("loop statements", () => {
  it("compiles and runs while and for loops", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      function whileSum(): int {
        let total: int = 0;
        let i: int = 0;
        while (i < 4) {
          total = total + i;
          i = i + 1;
        }
        return total;
      }

      function forSum(): int {
        let total: int = 0;
        for (let i: int = 0; i < 4; i = i + 1) {
          total = total + i;
        }
        return total;
      }

      export function main(): void {
        print(whileSum());
        print(forSum());
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
    const outputPath = join(tempDir, "app.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim().replace(/\r\n/gu, "\n")).toBe(["6", "6"].join("\n"));
  }, 15000);
});
