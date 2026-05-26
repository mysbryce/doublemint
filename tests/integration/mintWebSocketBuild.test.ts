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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-ws-"));
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

describe.skipIf(!hasGpp)("mint:http WebSocket", () => {
  it("compiles a server that registers WebSocket open/message/close handlers", async () => {
    const entry = join(tempDir, "main.dlm");
    await writeFile(
      entry,
      `
import { Http, Context, WebSocket } from "mint:http";

export function main(): void {
  let app: Http = new Http();
  app.get("/", fn(ctx: Context): void => ctx.text("hi"));
  app.ws("/ws",
    fn(ws: WebSocket): void => ws.send("hello"),
    fn(ws: WebSocket, msg: string): void => ws.send("echo: " + msg),
    fn(ws: WebSocket): void => ws.close()
  );
  app.listen("127.0.0.1", 0);
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
    await expect(access(outputPath)).resolves.toBeUndefined();
  }, 120000);
});
