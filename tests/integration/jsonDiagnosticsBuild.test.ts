import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-jsondiag-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("--json diagnostics", () => {
  it("emits ok: true on valid source", async () => {
    const entry = join(tempDir, "ok.dlm");
    await writeFile(
      entry,
      `
      import { println } from "mint:io";
      export function main(): void {
        println("hi");
      }
      `.trimStart(),
      "utf8"
    );
    const result = spawnSync("node", ["dist/cli.js", "check", entry, "--json"], {
      encoding: "utf8",
      cwd: process.cwd()
    });
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout.trim());
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.diagnostics)).toBe(true);
    expect(json.diagnostics.length).toBe(0);
    expect(typeof json.modulesChecked).toBe("number");
  });

  it("emits ok: false with structured diagnostic on bad source", async () => {
    const entry = join(tempDir, "bad.dlm");
    await writeFile(entry, "let x: int = \"hi\";\n", "utf8");
    const result = spawnSync("node", ["dist/cli.js", "check", entry, "--json"], {
      encoding: "utf8",
      cwd: process.cwd()
    });
    expect(result.status).toBe(1);
    const json = JSON.parse(result.stdout.trim());
    expect(json.ok).toBe(false);
    expect(json.diagnostics.length).toBe(1);
    expect(json.diagnostics[0]).toMatchObject({
      severity: "error",
      filepath: expect.stringContaining("bad.dlm"),
      line: expect.any(Number),
      column: expect.any(Number)
    });
    expect(json.diagnostics[0].code).toMatch(/^DLM\d+$/u);
  });
});
