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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-array-"));
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

describe.skipIf(!hasGpp)("mint:array", () => {
  it("maps, filters, reduces with generic lambdas", async () => {
    const result = await buildAndRun(`
      import { Array } from "mint:array";
      import { println } from "mint:io";
      export function main(): void {
        let xs: int[] = [1, 2, 3, 4, 5];
        let doubled: int[] = xs.map(fn(x: int): int => x * 2);
        println(doubled[0]);
        println(doubled[4]);
        let evens: int[] = xs.filter(fn(x: int): bool => x > 2);
        println(evens.length());
        let sum: int = xs.reduce(0, fn(acc: int, x: int): int => acc + x);
        println(sum);
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("2");
    expect(lines[1]).toBe("10");
    expect(lines[2]).toBe("3");
    expect(lines[3]).toBe("15");
  }, 30000);

  it("finds, tests any/all, and sorts", async () => {
    const result = await buildAndRun(`
      import { Array } from "mint:array";
      import { println } from "mint:io";
      export function main(): void {
        let xs: int[] = [3, 1, 4, 1, 5, 9, 2, 6];
        println(xs.findIndex(fn(x: int): bool => x > 5));
        println(xs.any(fn(x: int): bool => x == 9));
        println(xs.all(fn(x: int): bool => x > 0));
        let sorted: int[] = xs.sort();
        println(sorted[0]);
        println(sorted[7]);
        println(xs.indexOf(5));
        println(xs.contains(9));
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("5");
    expect(lines[1]).toBe("1");
    expect(lines[2]).toBe("1");
    expect(lines[3]).toBe("1");
    expect(lines[4]).toBe("9");
    expect(lines[5]).toBe("4");
    expect(lines[6]).toBe("1");
  }, 30000);
});
