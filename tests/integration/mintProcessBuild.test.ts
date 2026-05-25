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
const isWindows = process.platform === "win32";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-mint-process-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const baseConfig = (): DoublemintConfig => ({
  rootDir: tempDir,
  outDir: join(tempDir, "build"),
  cppStandard: "c++20",
  compiler: "g++",
  includeDirs: [],
  warningsAsErrors: true,
  optimization: "O2"
});

async function buildAndRun(source: string): Promise<{ status: number; stdout: string; stderr: string }> {
  const entry = join(tempDir, "main.dlm");
  await writeFile(entry, source.trimStart(), "utf8");
  const outputPath = join(tempDir, "app.exe");
  const graph = await resolveModuleGraph(entry);
  checkModuleGraph(graph);
  const emitResult = await emitCppToDisk(graph, baseConfig());
  await buildNativeExecutable(emitResult, baseConfig(), { outputPath });
  const run = spawnSync(outputPath, [], { encoding: "utf8" });
  return { status: run.status ?? -1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

describe.skipIf(!hasGpp || !isWindows)("mint:process on Windows", () => {
  it("opens explorer.exe and AOB-scans its MZ header", async () => {
    const result = await buildAndRun(`
      import { Process } from "mint:process";
      import { println } from "mint:io";

      export function main(): void {
        let handle: int64 = Process.openByName("explorer.exe");
        if (handle == 0) {
          println("NO_EXPLORER");
          return;
        }
        let base: int64 = Process.findModule(handle, "explorer.exe");
        let size: int = Process.moduleSize(handle, "explorer.exe");
        let hit: int64 = Process.aobScanModule(handle, "explorer.exe", "4D 5A");
        let baseOk: bool = base != 0;
        let sizeOk: bool = size > 0;
        let hitOk: bool = hit == base;
        if (baseOk) {
          if (sizeOk) {
            if (hitOk) {
              println("OK");
            } else {
              println("FAIL_HIT");
            }
          } else {
            println("FAIL_SIZE");
          }
        } else {
          println("FAIL_BASE");
        }
        Process.close(handle);
      }
    `);

    expect(result.status).toBe(0);
    const ok = result.stdout.includes("OK") || result.stdout.includes("NO_EXPLORER");
    expect(ok).toBe(true);
  }, 30000);

  it("returns 0 for an unknown process and stays safe", async () => {
    const result = await buildAndRun(`
      import { Process } from "mint:process";
      import { println } from "mint:io";

      export function main(): void {
        let handle: int64 = Process.openByName("definitely_not_a_real_proc_xyz.exe");
        println(handle);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("0");
  }, 20000);
});
