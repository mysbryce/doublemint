import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DoublemintDiagnostic, resolveModuleGraph } from "../../src/index.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-resolver-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeModule(name: string, source: string): Promise<string> {
  const filepath = join(tempDir, name);
  await writeFile(filepath, source.trimStart(), "utf8");
  return filepath;
}

describe("resolveModuleGraph", () => {
  it("resolves a strict multi-file graph", async () => {
    await writeModule(
      "types.dlm",
      `
      export type PlayerId = int;
      export struct PlayerProfile {
        id: PlayerId;
        username: string;
      }
      `
    );
    await writeModule(
      "math_utils.dlm",
      `
      extern "cmath" {
        function sqrt(num: double): double;
      }

      export function calculateDistance(x: float): float {
        return sqrt(x) as float;
      }
      `
    );
    const entry = await writeModule(
      "main.dlm",
      `
      import type { PlayerProfile } from "./types";
      import { calculateDistance } from "./math_utils";

      export function main(profile: PlayerProfile): void {
        let dist: float = calculateDistance(4.0);
        let saved: PlayerProfile = copy profile;
      }
      `
    );

    const graph = await resolveModuleGraph(entry);

    expect(graph.modules.size).toBe(3);
    expect(graph.modules.get(entry)?.imports).toMatchObject([
      { specifier: "PlayerProfile", typeOnly: true },
      { specifier: "calculateDistance", typeOnly: false }
    ]);
  });

  it("rejects missing module files", async () => {
    const entry = await writeModule(
      "main.dlm",
      'import { nope } from "./missing";'
    );

    await expect(resolveModuleGraph(entry)).rejects.toThrow(DoublemintDiagnostic);
  });

  it("rejects circular imports", async () => {
    const a = await writeModule(
      "a.dlm",
      `
      import { b } from "./b";
      export function a(): void {}
      `
    );
    await writeModule(
      "b.dlm",
      `
      import { a } from "./a";
      export function b(): void {}
      `
    );

    await expect(resolveModuleGraph(a)).rejects.toMatchObject({
      code: "DLM3001"
    });
  });

  it("rejects duplicate exports in one module", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export type Thing = int;
      export struct Thing {
        id: int;
      }
      `
    );

    await expect(resolveModuleGraph(entry)).rejects.toMatchObject({
      code: "DLM3006"
    });
  });

  it("rejects value imports of type-only exports", async () => {
    await writeModule("types.dlm", "export type PlayerId = int;");
    const entry = await writeModule(
      "main.dlm",
      'import { PlayerId } from "./types";'
    );

    await expect(resolveModuleGraph(entry)).rejects.toMatchObject({
      code: "DLM3004"
    });
  });
});
