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

  it("rejects duplicate local names", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let count: int = 1;
          let count: int = 2;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4015"
    });
  });

  it("rejects duplicate parameter names", async () => {
    await expect(
      checkEntry(`
        function add(value: int, value: int): int {
          return value;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4015"
    });
  });

  it("rejects return type mismatches", async () => {
    await expect(
      checkEntry(`
        function answer(): int {
          return "nope";
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("rejects missing struct fields", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          level: int;
        }

        function main(): void {
          let profile: Profile;
          profile.missing = 1;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4010"
    });
  });

  it("rejects calls to non-functions", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let count: int = 1;
          count();
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4007"
    });
  });

  it("rejects assigning through call results", async () => {
    await expect(
      checkEntry(`
        function count(): int {
          return 1;
        }

        function main(): void {
          count() = 2;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4011"
    });
  });

  it("rejects using a function as a value without calling it", async () => {
    await expect(
      checkEntry(`
        function count(): int {
          return 1;
        }

        function main(): void {
          let value: int = count;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4016"
    });
  });

  it("accepts builtin print calls", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          print("mint");
          print(1);
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects builtin print arity mismatches", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          print();
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4017"
    });
  });

  it("accepts if else statements with bool conditions", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          if (true) {
            print("yes");
          } else {
            print("no");
          }
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects non-bool if conditions", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          if (1) {
            print("bad");
          }
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("keeps if branch locals block-scoped", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          if (true) {
            let inside: int = 1;
          }
          print(inside);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4003"
    });
  });
});
