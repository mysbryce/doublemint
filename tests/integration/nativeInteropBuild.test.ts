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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-native-interop-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("native C/C++ interop", () => {
  it("compiles and runs extern free functions with const char pointers", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
      extern "cstdio" {
        function puts(text: const char*): int;
      }

      export function main(): void {
        puts("mint");
      }
      `.trimStart(),
      "utf8"
    );
    const config: DoublemintConfig = {
      rootDir: tempDir,
      outDir: join(tempDir, "build"),
      cppStandard: "c++20",
      compiler: "g++",
      includeDirs: [tempDir],
      warningsAsErrors: true,
      optimization: "O3"
    };
    const outputPath = join(tempDir, "app.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe("mint");
  }, 15000);

  it("compiles and links configured native C++ sources", async () => {
    const entry = join(tempDir, "main.dlm");
    const nativeHeader = join(tempDir, "native_math.hpp");
    const nativeSource = join(tempDir, "native_math.cpp");

    await writeFile(nativeHeader, "int native_add(int left, int right);\n", "utf8");
    await writeFile(
      nativeSource,
      '#include "native_math.hpp"\nint native_add(int left, int right) { return left + right; }\n',
      "utf8"
    );
    await writeFile(
      entry,
      `
      extern "./native_math.hpp" {
        function native_add(left: int, right: int): int;
      }

      export function main(): void {
        print(native_add(2, 3));
      }
      `.trimStart(),
      "utf8"
    );

    const config: DoublemintConfig = {
      rootDir: tempDir,
      outDir: join(tempDir, "build"),
      cppStandard: "c++20",
      compiler: "g++",
      includeDirs: [tempDir],
      nativeSources: [nativeSource],
      warningsAsErrors: true,
      optimization: "O3"
    };
    const outputPath = join(tempDir, "native-source.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe("5");
  }, 15000);
});
