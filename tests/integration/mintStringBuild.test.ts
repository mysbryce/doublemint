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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-string-"));
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

describe.skipIf(!hasGpp)("mint:string", () => {
  it("trims, casefolds, splits, replaces, and searches", async () => {
    const result = await buildAndRun(`
      import { String } from "mint:string";
      import { println } from "mint:io";
      export function main(): void {
        println(String.upper("hi"));
        println(String.lower("HI"));
        let t: string = String.trim("  hi  ");
        println("[" + t + "]");
        let parts: string[] = String.split("a,b,c", ",");
        println(parts[0]);
        println(parts[2]);
        println(String.join(parts, "-"));
        println(String.replace("foo bar foo", "foo", "x"));
        println(String.contains("doublemint", "mint"));
        println(String.startsWith("doublemint", "double"));
        println(String.endsWith("doublemint", "mint"));
        println(String.indexOf("doublemint", "mint"));
        println(String.lastIndexOf("ababab", "ab"));
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("HI");
    expect(lines[1]).toBe("hi");
    expect(lines[2]).toBe("[hi]");
    expect(lines[3]).toBe("a");
    expect(lines[4]).toBe("c");
    expect(lines[5]).toBe("a-b-c");
    expect(lines[6]).toBe("x bar x");
    expect(lines[7]).toBe("1");
    expect(lines[8]).toBe("1");
    expect(lines[9]).toBe("1");
    expect(lines[10]).toBe("6");
    expect(lines[11]).toBe("4");
  }, 30000);

  it("substrings, lengths, repeats, pads, reverses, and number-converts", async () => {
    const result = await buildAndRun(`
      import { String } from "mint:string";
      import { println } from "mint:io";
      export function main(): void {
        println(String.substring("doublemint", 6, 10));
        println(String.length("doublemint"));
        println(String.repeat("ab", 3));
        println(String.padLeft("7", 4, "0"));
        println(String.padRight("7", 4, "."));
        println(String.reverse("hello"));
        println(String.fromInt(42));
        println(String.toInt("100"));
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("mint");
    expect(lines[1]).toBe("10");
    expect(lines[2]).toBe("ababab");
    expect(lines[3]).toBe("0007");
    expect(lines[4]).toBe("7...");
    expect(lines[5]).toBe("olleh");
    expect(lines[6]).toBe("42");
    expect(lines[7]).toBe("100");
  }, 30000);
});
