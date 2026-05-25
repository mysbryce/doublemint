import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkModuleGraph,
  emitCpp,
  resolveModuleGraph,
  type DoublemintConfig
} from "../../src/index.js";

let tempDir: string;

const config: DoublemintConfig = {
  rootDir: "src",
  outDir: "build/doublemint",
  cppStandard: "c++20",
  compiler: "clang++",
  includeDirs: [],
  warningsAsErrors: true,
  optimization: "O3"
};

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-emitter-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeModule(name: string, source: string): Promise<string> {
  const filepath = join(tempDir, name);
  await writeFile(filepath, source.trimStart(), "utf8");
  return filepath;
}

describe("emitCpp", () => {
  it("emits headers and sources for a checked module graph", async () => {
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

      export function processPlayer(profile: PlayerProfile): void {
        let x: float = 10.0;
        let dist: float = calculateDistance(x);
        let saved_profile: PlayerProfile = copy profile;
        saved_profile.level = saved_profile.level + 1;
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(result.artifacts).toHaveLength(6);
    expect(byPath.get("build/doublemint/types.hpp")).toContain(
      "using PlayerId = int;"
    );
    expect(byPath.get("build/doublemint/types.hpp")).toContain(
      "std::string username;"
    );
    expect(byPath.get("build/doublemint/main.hpp")).toContain(
      '#include "types.hpp"'
    );
    expect(byPath.get("build/doublemint/main.hpp")).toContain(
      "void processPlayer(const PlayerProfile& profile);"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "PlayerProfile saved_profile = profile;"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "saved_profile.level = saved_profile.level + 1;"
    );
    expect(byPath.get("build/doublemint/math_utils.cpp")).toContain(
      "#include <cmath>"
    );
    expect(byPath.get("build/doublemint/math_utils.cpp")).toMatch(
      /#include <cmath>\n\n#include "math_utils\.hpp"/u
    );
    expect(byPath.get("build/doublemint/math_utils.cpp")).toContain(
      "return static_cast<float>(sqrt(x));"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain("float x = 10.0f;");
  });

  it("emits valid C++ entrypoint for void main", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {}
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.hpp")).toContain("int main();");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("int main() {");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("return 0;");
  });

  it("emits builtin print calls through iostream", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
        print("mint");
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain("#include <iostream>");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'std::cout << "mint" << std::endl;'
    );
  });

  it("emits if else statements", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
        if (true) {
          print("yes");
        } else {
          print("no");
        }
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain("if (true) {");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("} else {");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'std::cout << "yes" << std::endl;'
    );
  });
});
