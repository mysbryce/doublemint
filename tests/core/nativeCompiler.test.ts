import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildNativeExecutable,
  type DoublemintConfig,
  type EmitResult
} from "../../src/index.js";

let tempDir: string;

const hasGpp = spawnSync("where.exe", ["g++"], { shell: true }).status === 0;

const config: DoublemintConfig = {
  rootDir: "src",
  outDir: "build/doublemint",
  cppStandard: "c++20",
  compiler: "g++",
  includeDirs: [],
  warningsAsErrors: true,
  optimization: "O3"
};

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-native-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe.skipIf(!hasGpp)("buildNativeExecutable", () => {
  it("compiles emitted C++ into a native executable", async () => {
    const cppPath = join(tempDir, "main.cpp");
    const outputPath = join(tempDir, "app.exe");
    await writeFile(cppPath, "int main() { return 0; }\n", "utf8");
    const emitResult: EmitResult = {
      artifacts: [
        {
          filepath: cppPath,
          content: "int main() { return 0; }\n"
        }
      ]
    };

    const result = await buildNativeExecutable(emitResult, config, {
      outputPath,
      compiler: "g++"
    });

    expect(result.compiler).toBe("g++");
    expect(result.outputPath).toBe(outputPath);
    expect(result.args).toContain("-std=c++20");
  });
});
