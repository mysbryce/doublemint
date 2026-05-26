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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-stream-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("Process streaming pipes", () => {
  it("reads lines from a child process over popen", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";
      import { Process } from "mint:process";
      import { String } from "mint:string";

      export function main(): void {
        let h: int = Process.streamOpen("echo alpha & echo beta & echo gamma", "r");
        if (h < 0) {
          println("open failed");
          return;
        }
        while (!Process.streamEof(h)) {
          let line: string = Process.streamReadLine(h);
          if (String.length(line) > 0) {
            println("got: " + line);
          }
        }
        Process.streamClose(h);
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
    const outputPath = join(tempDir, "stream.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    const lines = run.stdout.trim().split(/\r?\n/u);
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^got: alpha/u);
    expect(lines[1]).toMatch(/^got: beta/u);
    expect(lines[2]).toMatch(/^got: gamma/u);
  });
});
