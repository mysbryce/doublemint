import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkModuleGraph,
  DoublemintDiagnostic,
  resolveModuleGraph
} from "../../src/index.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-semantic-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeModule(name: string, source: string): Promise<string> {
  const filepath = join(tempDir, name);
  await writeFile(filepath, source.trimStart(), "utf8");
  return filepath;
}

async function checkEntry(source: string): Promise<void> {
  const entry = await writeModule("main.dlm", source);
  checkModuleGraph(await resolveModuleGraph(entry));
}

describe("checkModuleGraph", () => {
  it("accepts typed variables, calls, copies, and struct fields", async () => {
    await writeModule(
      "types.dlm",
      `
      export type PlayerId = int;
      export struct PlayerProfile {
        id: PlayerId;
        level: int;
      }
      `
    );
    await writeModule(
      "math.dlm",
      `
      export function add(a: int, b: int): int {
        return a + b;
      }
      `
    );
    const entry = await writeModule(
      "main.dlm",
      `
      import type { PlayerProfile } from "./types";
      import { add } from "./math";

      export function main(profile: PlayerProfile): void {
        let saved: PlayerProfile = copy profile;
        saved.level = add(saved.level, 1);
      }
      `
    );

    const result = checkModuleGraph(await resolveModuleGraph(entry));

    expect(result.modulesChecked).toBe(3);
  });

  it("rejects unknown identifiers", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          missing();
        }
      `)
    ).rejects.toThrow(DoublemintDiagnostic);
  });

  it("rejects type mismatches", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let count: int = "nope";
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("rejects const mutation", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          const count: int = 1;
          count = 2;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4012"
    });
  });

  it("rejects parameter field mutation", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          level: int;
        }

        function main(profile: Profile): void {
          profile.level = 2;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4012"
    });
  });

  it("rejects function arity mismatches", async () => {
    await expect(
      checkEntry(`
        function add(a: int, b: int): int {
          return a + b;
        }

        function main(): void {
          let count: int = add(1);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4008"
    });
  });

  it("rejects unknown types", async () => {
    await expect(
      checkEntry(`
        function main(value: Missing): void {}
      `)
    ).rejects.toMatchObject({
      code: "DLM4013"
    });
  });
});
