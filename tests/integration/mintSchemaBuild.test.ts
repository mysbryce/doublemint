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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-mint-schema-"));
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

describe.skipIf(!hasGpp)("mint:schema", () => {
  it("accepts JSON that matches the rules and reads back typed fields", async () => {
    const result = await buildAndRun(`
      import { Schema, ValidationResult } from "mint:schema";
      import { println } from "mint:io";

      export function main(): void {
        let s: Schema = new Schema();
        s.required("name", "string");
        s.required("age", "int");
        s.optional("nickname", "string");
        let r: ValidationResult = s.validate("{\\"name\\":\\"alice\\",\\"age\\":30}");
        if (r.ok) {
          println(r.getString("name"));
          println(r.getInt("age"));
          println(r.has("nickname"));
        } else {
          println(r.error);
        }
      }
    `);

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("alice");
    expect(lines[1]).toBe("30");
    expect(lines[2]).toBe("0");
  }, 30000);

  it("rejects missing required field, type mismatch, and nested errors", async () => {
    const result = await buildAndRun(`
      import { Schema, ValidationResult } from "mint:schema";
      import { println } from "mint:io";

      export function main(): void {
        let addr: Schema = new Schema();
        addr.required("city", "string");

        let s: Schema = new Schema();
        s.required("name", "string");
        s.required("age", "int");
        s.requiredArray("tags", "string");
        s.requiredObject("address", addr);

        println(s.validate("{\\"age\\":30,\\"tags\\":[],\\"address\\":{\\"city\\":\\"x\\"}}").error);
        println(s.validate("{\\"name\\":42,\\"age\\":30,\\"tags\\":[],\\"address\\":{\\"city\\":\\"x\\"}}").error);
        println(s.validate("{\\"name\\":\\"y\\",\\"age\\":30,\\"tags\\":[1],\\"address\\":{\\"city\\":\\"x\\"}}").error);
        println(s.validate("{\\"name\\":\\"y\\",\\"age\\":30,\\"tags\\":[],\\"address\\":{}}").error);
      }
    `);

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toContain("name: missing");
    expect(lines[1]).toContain("name: expected string");
    expect(lines[2]).toContain("tags[0]");
    expect(lines[3]).toContain("address.city");
  }, 30000);
});
