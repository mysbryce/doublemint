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

  it("accepts extern opaque types, pointers, references, and native string literals", async () => {
    await expect(
      checkEntry(`
        extern "cstdio" {
          type FILE;
          function puts(text: const char*): int;
          function close(file: FILE&): int as "native_close";
        }

        function main(): void {
          puts("mint");
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("accepts null for native pointer handles and pointer equality checks", async () => {
    await expect(
      checkEntry(`
        extern "cstdio" {
          type FILE;
        }

        function main(): void {
          let file: FILE* = null;
          if (file == null) {
            print("missing");
          }
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("accepts defer cleanup calls", async () => {
    await expect(
      checkEntry(`
        function cleanup(): void {}

        function main(): void {
          defer cleanup();
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

  it("accepts arrays and index assignment", async () => {
    await expect(
      checkEntry(`
        function first(): int {
          let values: int[] = [1, 2, 3];
          values[0] = values[1];
          return values[0];
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects array literals with mismatched elements", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let values: int[] = [1, "two"];
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("rejects indexing non-array values", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let value: int = 1;
          value[0] = 2;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4018"
    });
  });

  it("rejects empty array literals without element inference", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let values: int[] = [];
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4020"
    });
  });

  it("accepts loops and comparison expressions", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let total: int = 0;
          while (total < 3) {
            total = total + 1;
          }
          for (let i: int = 0; i <= 3; i = i + 1) {
            total = total + i;
          }
          if (total != 0) {
            print(total);
          }
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects non-bool loop conditions", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          while (1) {
            print("bad");
          }
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("keeps for initializer locals scoped to the loop", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          for (let i: int = 0; i < 1; i = i + 1) {
            print(i);
          }
          print(i);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4003"
    });
  });

  it("accepts struct object literals", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          id: int;
          name: string;
        }

        function main(): void {
          let profile: Profile = Profile { id: 1, name: "mint" };
          print(profile.name);
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects struct object literals with missing fields", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          id: int;
          name: string;
        }

        function main(): void {
          let profile: Profile = Profile { id: 1 };
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4026"
    });
  });

  it("rejects struct object literals with unknown fields", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          id: int;
        }

        function main(): void {
          let profile: Profile = Profile { id: 1, missing: 2 };
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4024"
    });
  });

  it("rejects struct object literals with fields out of order", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          id: int;
          name: string;
        }

        function main(): void {
          let profile: Profile = Profile { name: "mint", id: 1 };
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4025"
    });
  });

  it("rejects struct object literals with mismatched field types", async () => {
    await expect(
      checkEntry(`
        struct Profile {
          id: int;
        }

        function main(): void {
          let profile: Profile = Profile { id: "bad" };
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("accepts tuple return values and tuple indexing", async () => {
    await expect(
      checkEntry(`
        function pair(): [int, string] {
          return (1, "mint");
        }

        function main(): void {
          let value: [int, string] = pair();
          print(value[0]);
          print(value[1]);
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("accepts tuple destructuring declarations", async () => {
    await expect(
      checkEntry(`
        function pair(): [int, string] {
          return (1, "mint");
        }

        function main(): void {
          let [count, label] = pair();
          count = count + 1;
          print(label);
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects destructuring non-tuple values", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          const [value] = 1;
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4029"
    });
  });

  it("rejects tuple destructuring arity mismatches", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          const [one] = (1, "mint");
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4030"
    });
  });

  it("rejects tuple literals with mismatched element types", async () => {
    await expect(
      checkEntry(`
        function pair(): [int, string] {
          return ("bad", 1);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("rejects tuple indexes out of range", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let value: [int, string] = (1, "mint");
          print(value[2]);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4028"
    });
  });

  it("rejects dynamic tuple indexes", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let value: [int, string] = (1, "mint");
          let index: int = 0;
          print(value[index]);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4027"
    });
  });

  it("accepts switch statements over comparable values", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let name: string = "mint";
          switch (name) {
            case "mint": {
              print("yes");
            }
            default: {
              print("no");
            }
          }
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects switch cases with mismatched types", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let value: int = 1;
          switch (value) {
            case "bad": {
              print("bad");
            }
          }
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("keeps switch case locals block-scoped", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          switch (1) {
            case 1: {
              let inside: int = 1;
            }
          }
          print(inside);
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4003"
    });
  });

  it("accepts lambdas stored in function-typed variables", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let inc: function(int): int = fn (value: int): int => value + 1;
          print(inc(2));
        }
      `)
    ).resolves.toBeUndefined();
  });

  it("rejects lambdas with mismatched body return types", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let bad: function(int): int = fn (value: int): int => "bad";
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });

  it("rejects function-typed calls with bad argument types", async () => {
    await expect(
      checkEntry(`
        function main(): void {
          let inc: function(int): int = fn (value: int): int => value + 1;
          inc("bad");
        }
      `)
    ).rejects.toMatchObject({
      code: "DLM4014"
    });
  });
});
