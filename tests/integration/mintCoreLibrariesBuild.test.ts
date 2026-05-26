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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-mint-core-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("mint core libraries", () => {
  it("compiles and runs fs, time, os, regex, and collections", async () => {
    const entry = join(tempDir, "main.dlm");
    const testFile = join(tempDir, "data.txt").replace(/\\/gu, "/");
    await writeFile(
      entry,
      `
      import { File } from "mint:fs";
      import { Time, Profiler } from "mint:time";
      import { OS, Env } from "mint:os";
      import { Regex } from "mint:regex";
      import { Queue, Set, Stack } from "mint:collections";
      import { println } from "mint:io";

      export function main(): void {
        File.writeString("${testFile}", "mint");
        File.appendString("${testFile}", "y");
        let content: string = File.readToString("${testFile}");
        let bytes: int[] = File.readToBytes("${testFile}");

        Profiler.start("work");
        let elapsed: int = Profiler.stop("work");
        let now: int = Time.nowInMs();
        let token: string = Env.get("DOUBLEMINT_TEST_ENV", "fallback");
        let platform: bool = OS.isWindows() == true;

        let color: Regex = new Regex("^#?[a-fA-F0-9]{6}$");
        let valid: bool = color.test("#FF5733");

        let queue: Queue<string> = new Queue<string>();
        queue.push(content);
        let next: string = queue.pop();
        let ids: Set<int> = new Set<int>();
        ids.add(7);
        ids.add(7);
        let stack: Stack<int> = new Stack<int>();
        stack.push(3);

        println(next, bytes[0], valid, ids.size(), stack.pop(), platform, token, elapsed >= 0, now > 0);
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
    expect(run.stdout).toContain("minty");
    expect(run.stdout).toContain("fallback");
  }, 30000);
});
