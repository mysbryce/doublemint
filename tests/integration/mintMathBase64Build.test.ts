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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-math-"));
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

describe.skipIf(!hasGpp)("mint:math complete", () => {
  it("exposes trig, log, floor/ceil/abs/clamp/min/max", async () => {
    const result = await buildAndRun(`
      import { Math } from "mint:math";
      import { println } from "mint:io";
      export function main(): void {
        println(Math.cos(0.0));
        println(Math.floorToInt(3.7));
        println(Math.ceilToInt(3.2));
        println(Math.absInt(0 - 42));
        println(Math.minInt(3, 5));
        println(Math.maxInt(3, 5));
        println(Math.clampInt(15, 0, 10));
        println(Math.log10(100.0));
        println(Math.signInt(0 - 3));
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("1");
    expect(lines[1]).toBe("3");
    expect(lines[2]).toBe("4");
    expect(lines[3]).toBe("42");
    expect(lines[4]).toBe("3");
    expect(lines[5]).toBe("5");
    expect(lines[6]).toBe("10");
    expect(lines[7]).toBe("2");
    expect(lines[8]).toBe("-1");
  }, 30000);
});

describe.skipIf(!hasGpp)("mint:base64", () => {
  it("round-trips encode and decode", async () => {
    const result = await buildAndRun(`
      import { Base64 } from "mint:base64";
      import { println } from "mint:io";
      export function main(): void {
        let enc: string = Base64.encode("Hello, world!");
        println(enc);
        println(Base64.decode(enc));
        let bytes: int[] = [72, 105];
        let encBytes: string = Base64.encodeBytes(bytes);
        println(encBytes);
        let decoded: int[] = Base64.decodeBytes(encBytes);
        println(decoded[0]);
        println(decoded[1]);
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("SGVsbG8sIHdvcmxkIQ==");
    expect(lines[1]).toBe("Hello, world!");
    expect(lines[2]).toBe("SGk=");
    expect(lines[3]).toBe("72");
    expect(lines[4]).toBe("105");
  }, 30000);
});
