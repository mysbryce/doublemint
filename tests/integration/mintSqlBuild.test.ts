import { mkdtemp, rm, writeFile, access } from "node:fs/promises";
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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-sql-"));
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

async function buildAndRun(source: string): Promise<{ status: number; stdout: string }> {
  const entry = join(tempDir, "main.dlm");
  await writeFile(entry, source.trimStart(), "utf8");
  const outputPath = join(tempDir, "app.exe");
  const graph = await resolveModuleGraph(entry);
  checkModuleGraph(graph);
  const emitResult = await emitCppToDisk(graph, baseConfig());
  await buildNativeExecutable(emitResult, baseConfig(), { outputPath });
  await expect(access(outputPath)).resolves.toBeUndefined();
  const run = spawnSync(outputPath, [], { encoding: "utf8" });
  return { status: run.status ?? -1, stdout: run.stdout ?? "" };
}

describe.skipIf(!hasGpp)("mint:sql", () => {
  it("creates, inserts, and queries an in-memory SQLite database", async () => {
    const result = await buildAndRun(`
      import { Database, SqlResult } from "mint:sql";
      import { println } from "mint:io";
      export function main(): void {
        let db: Database = new Database();
        db.openMemory();
        db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
        db.execParams("INSERT INTO t (name) VALUES (?)", ["alpha"]);
        db.execParams("INSERT INTO t (name) VALUES (?)", ["beta"]);
        println(db.changes());
        let r: SqlResult = db.query("SELECT id, name FROM t ORDER BY id");
        while (r.hasNext()) {
          println(r.getInt("id"), "=", r.getString("name"));
          r.next();
        }
        r.close();
        db.close();
      }
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("1");
    expect(lines[1]).toBe("1=alpha");
    expect(lines[2]).toBe("2=beta");
  }, 180000);
});
