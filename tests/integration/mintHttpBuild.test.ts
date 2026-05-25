import { mkdtemp, rm, writeFile, access } from "node:fs/promises";
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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-mint-http-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const baseConfig = (): DoublemintConfig => ({
  rootDir: tempDir,
  outDir: join(tempDir, "build"),
  cppStandard: "c++20",
  compiler: "g++",
  includeDirs: [],
  warningsAsErrors: true,
  optimization: "O2"
});

describe.skipIf(!hasGpp)("mint:http server", () => {
  it("compiles a routed Elysia-style server with cpp-httplib", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
import { Http } from "mint:http";

export function main(): void {
  let app: int = Http.create();
  Http.get(app, "/", fn(ctx: int64): void => Http.text(ctx, "ok"));
  Http.get(app, "/user/:id", fn(ctx: int64): void => Http.json(ctx, Http.param(ctx, "id")));
  Http.post(app, "/echo", fn(ctx: int64): void => Http.text(ctx, Http.body(ctx)));
  Http.get(app, "/agent", fn(ctx: int64): void => Http.text(ctx, Http.header(ctx, "X-Mint")));
  Http.get(app, "/search", fn(ctx: int64): void => Http.text(ctx, Http.query(ctx, "q")));
  Http.listen(app, "127.0.0.1", 0);
}
`,
      "utf8"
    );
    const outputPath = join(tempDir, "app.exe");
    const graph = await resolveModuleGraph(entry);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, baseConfig());
    const result = await buildNativeExecutable(emitResult, baseConfig(), { outputPath });

    expect(result.outputPath).toBe(outputPath);
    if (process.platform === "win32") {
      expect(emitResult.linkLibraries).toContain("ws2_32");
      expect(result.args).toContain("-lws2_32");
    }
    await expect(access(outputPath)).resolves.toBeUndefined();
  }, 120000);
});
