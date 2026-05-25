import { describe, expect, it } from "vitest";
import {
  DoublemintDiagnostic,
  parseProgram,
  scanTokens,
  checkModuleGraph,
  resolveModuleGraph
} from "../../src/index.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("DoublemintDiagnostic", () => {
  it("formats parser errors with source snippets from token locations", () => {
    try {
      parseProgram(scanTokens("function main(): void {\n  let x = 1;\n}", "main.dlm"), "main.dlm");
      throw new Error("Expected parser diagnostic.");
    } catch (error) {
      expect(error).toBeInstanceOf(DoublemintDiagnostic);
      expect((error as DoublemintDiagnostic).format()).toContain("  |   let x = 1;");
      expect((error as DoublemintDiagnostic).format()).toContain("  |         ^");
    }
  });

  it("formats semantic errors with source snippets from AST locations", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "doublemint-diagnostics-"));

    try {
      const entry = join(tempDir, "main.dlm");
      await writeFile(
        entry,
        `
        function main(): void {
          const count: int = 1;
          count = 2;
        }
        `.trimStart(),
        "utf8"
      );

      try {
        checkModuleGraph(await resolveModuleGraph(entry));
        throw new Error("Expected semantic diagnostic.");
      } catch (error) {
        expect(error).toBeInstanceOf(DoublemintDiagnostic);
        expect((error as DoublemintDiagnostic).format()).toContain(
          "  |           count = 2;"
        );
        expect((error as DoublemintDiagnostic).format()).toContain("  |           ^");
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
