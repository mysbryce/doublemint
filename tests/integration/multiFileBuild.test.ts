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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-integration-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeModule(name: string, source: string): Promise<string> {
  const filepath = join(tempDir, name);
  await writeFile(filepath, source.trimStart(), "utf8");
  return filepath;
}

describe.skipIf(!hasGpp)("multi-file production pipeline", () => {
  it("checks, emits, compiles, and runs a multi-module project", async () => {
    await writeModule(
      "types.dlm",
      `
      export type PlayerId = int;

      export struct PlayerProfile {
        id: PlayerId;
        username: string;
        level: int;
      }
      `
    );
    await writeModule(
      "math_utils.dlm",
      `
      extern "cmath" {
        function sqrt(num: double): double;
      }

      export function calculateDistance(x1: float, y1: float, x2: float, y2: float): float {
        let dx: double = (x2 - x1);
        let dy: double = (y2 - y1);
        return sqrt((dx * dx) + (dy * dy)) as float;
      }
      `
    );
    const entry = await writeModule(
      "main.dlm",
      `
      import type { PlayerProfile } from "./types";
      import { calculateDistance } from "./math_utils";

      function processPlayer(profile: PlayerProfile): int {
        let saved_profile: PlayerProfile = copy profile;
        saved_profile.level = saved_profile.level + 1;
        return saved_profile.level;
      }

      export function main(): void {
        calculateDistance(0.0, 0.0, 3.0, 4.0);
      }
      `
    );
    const config: DoublemintConfig = {
      rootDir: tempDir,
      outDir: join(tempDir, "build"),
      cppStandard: "c++20",
      compiler: "g++",
      includeDirs: [],
      warningsAsErrors: true,
      optimization: "O3"
    };
    const outputPath = join(tempDir, "app.exe");

    const graph = await resolveModuleGraph(entry);
    const semanticResult = checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    const nativeResult = await buildNativeExecutable(emitResult, config, {
      outputPath
    });
    const run = spawnSync(outputPath, [], { stdio: "pipe" });

    expect(semanticResult.modulesChecked).toBe(3);
    expect(emitResult.artifacts).toHaveLength(6);
    expect(nativeResult.compiler).toBe("g++");
    expect(run.status).toBe(0);
  });
});
