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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-lang-"));
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

describe.skipIf(!hasGpp)("language features", () => {
  it("short-circuits logical && and ||", async () => {
    const result = await buildAndRun(`
      import { println } from "mint:io";
      export function main(): void {
        let a: int = 5;
        let b: int = 10;
        if (a > 0 && b < 100) { println("both"); }
        if (a == 0 || b == 10) { println("either"); }
        if (a > 0 && b > 100) { println("nope"); } else { println("blocked"); }
      }
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("both");
    expect(result.stdout).toContain("either");
    expect(result.stdout).toContain("blocked");
    expect(result.stdout).not.toContain("nope");
  }, 30000);

  it("concatenates strings with +", async () => {
    const result = await buildAndRun(`
      import { println } from "mint:io";
      export function main(): void {
        let a: string = "Hello, ";
        let b: string = "world";
        let c: string = a + b + "!";
        println(c);
      }
    `);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("Hello, world!");
  }, 30000);

  it("evaluates ternary expressions inline", async () => {
    const result = await buildAndRun(`
      import { println } from "mint:io";
      export function main(): void {
        let n: int = 7;
        let parity: string = (n - n / 2 * 2) == 0 ? "even" : "odd";
        println(parity);
        let big: int = n > 100 ? 1 : 0;
        println(big);
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("odd");
    expect(lines[1]).toBe("0");
  }, 30000);

  it("expands template literal placeholders", async () => {
    const result = await buildAndRun(`
      import { println } from "mint:io";
      export function main(): void {
        let name: string = "Doublemint";
        let count: int = 42;
        let flag: bool = true;
        println("Hello \${name}, count=\${count}, active=\${flag}");
      }
    `);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("Hello Doublemint, count=42, active=true");
  }, 30000);

  it("supports multi-statement lambda bodies", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";
      export function main(): void {
        let counter: int = Async.createAtomic(0);
        Async.parallelFor(50, fn(i: int): void => {
          Async.atomicAdd(counter, 1);
          Async.atomicAdd(counter, 1);
        });
        println(Async.atomicLoad(counter));
        Async.destroyAtomic(counter);
      }
    `);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("100");
  }, 30000);
});
