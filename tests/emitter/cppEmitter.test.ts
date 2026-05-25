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

  it("emits extern opaque types, native aliases, pointers, references, and local includes", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      extern "./native.hpp" {
        type FILE;
        function puts_alias(text: const char*): int as "std::puts";
        function close_ref(file: FILE&): int as "native_close";
      }

      export function main(): void {
        puts_alias("mint");
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain('#include "./native.hpp"');
    expect(byPath.get("build/doublemint/main.cpp")).toContain('std::puts("mint");');
    expect(byPath.get("build/doublemint/main.hpp")).toContain("int main();");
  });

  it("emits null literals as nullptr", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      extern "cstdio" {
        type FILE;
      }

      export function main(): void {
        let file: FILE* = null;
        if (file != null) {
          print("open");
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

    expect(byPath.get("build/doublemint/main.cpp")).toContain("FILE* file = nullptr;");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("if (file != nullptr) {");
  });

  it("emits defer statements as scope guards", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      function cleanup(): void {
        print("cleanup");
      }

      export function main(): void {
        defer cleanup();
        print("body");
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain("#include <utility>");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("struct __dlm_defer_guard");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "auto __dlm_defer_0 = __dlm_make_defer([&]() { cleanup(); });"
    );
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

  it("emits arrays as std::vector and index access", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function first(): int {
        let values: int[] = [1, 2, 3];
        values[0] = values[1];
        return values[0];
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.hpp")).toContain("#include <vector>");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::vector<int> values = {1, 2, 3};"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain("values[0] = values[1];");
    expect(byPath.get("build/doublemint/main.cpp")).toContain("return values[0];");
  });

  it("emits while and for loops", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
        let total: int = 0;
        while (total < 3) {
          total = total + 1;
        }
        for (let i: int = 0; i <= 3; i = i + 1) {
          total = total + i;
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

    expect(byPath.get("build/doublemint/main.cpp")).toContain("while (total < 3) {");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "for (int i = 0; i <= 3; i = i + 1) {"
    );
  });

  it("emits struct object literals", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      struct Profile {
        id: int;
        name: string;
      }

      export function main(): void {
        let profile: Profile = Profile { id: 1, name: "mint" };
        print(profile.name);
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'Profile profile = Profile{.id = 1, .name = "mint"};'
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::cout << profile.name << std::endl;"
    );
  });

  it("emits tuple literals and tuple access", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      function pair(): [int, string] {
        return (1, "mint");
      }

      export function main(): void {
        let value: [int, string] = pair();
        print(value[0]);
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'return std::tuple<int, std::string>{1, "mint"};'
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::cout << std::get<0>(value) << std::endl;"
    );
  });

  it("emits tuple destructuring as structured bindings", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      function pair(): [int, string] {
        return (1, "mint");
      }

      export function main(): void {
        const [count, label] = pair();
        print(label);
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "const auto [count, label] = pair();"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::cout << label << std::endl;"
    );
  });

  it("emits safe string literals as string_view and mutated strings as string", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
        const label: string = "mint";
        let name: string = "seed";
        name = "sprout";
        print(label);
        print(name);
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.hpp")).toContain("#include <string_view>");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'const std::string_view label = "mint";'
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'std::string name = "seed";'
    );
  });

  it("emits string parameters and function-typed string parameters as string_view", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      function echo(value: string): string {
        return value;
      }

      export function main(): void {
        let call_echo: function(string): string = fn (value: string): string => value;
        print(echo("mint"));
        print(call_echo("gum"));
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.hpp")).toContain(
      "std::string echo(std::string_view value);"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "return std::string(value);"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::function<std::string(std::string_view)> call_echo"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "[=](std::string_view value) -> std::string"
    );
  });

  it("emits switch statements as if else chains", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
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
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "const auto __dlm_switch_0 = name;"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      'if (__dlm_switch_0 == "mint") {'
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain("else {");
  });

  it("emits lambda expressions and function types", async () => {
    const entry = await writeModule(
      "main.dlm",
      `
      export function main(): void {
        let inc: function(int): int = fn (value: int): int => value + 1;
        print(inc(2));
      }
      `
    );
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);

    const result = emitCpp(graph, config);
    const byPath = new Map(
      result.artifacts.map((artifact) => [artifact.filepath, artifact.content])
    );

    expect(byPath.get("build/doublemint/main.hpp")).toContain("#include <functional>");
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::function<int(int)> inc = [=](int value) -> int { return value + 1; };"
    );
    expect(byPath.get("build/doublemint/main.cpp")).toContain(
      "std::cout << inc(2) << std::endl;"
    );
  });
});
