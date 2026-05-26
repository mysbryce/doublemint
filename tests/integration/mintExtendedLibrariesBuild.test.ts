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
  tempDir = await mkdtemp(join(tmpdir(), "doublemint-mint-extended-"));
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

async function buildAndRun(source: string): Promise<{ status: number; stdout: string; stderr: string }> {
  const entry = join(tempDir, "main.dlm");
  await writeFile(entry, source.trimStart(), "utf8");
  const outputPath = join(tempDir, "app.exe");
  const graph = await resolveModuleGraph(entry);
  checkModuleGraph(graph);
  const emitResult = await emitCppToDisk(graph, baseConfig());
  await buildNativeExecutable(emitResult, baseConfig(), { outputPath });
  const run = spawnSync(outputPath, [], { encoding: "utf8" });
  return { status: run.status ?? -1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

describe.skipIf(!hasGpp)("mint extended libraries", () => {
  it("encodes and decodes simple json values", async () => {
    const result = await buildAndRun(`
      import { Json } from "mint:json";
      import { println } from "mint:io";

      export function main(): void {
        println(Json.stringify("minty"));
        println(Json.stringifyInt(42));
        println(Json.stringifyBool(true));
        println(Json.parseInt("99"));
        println(Json.parseString("hello"));
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\"minty\"");
    expect(result.stdout).toContain("42");
    expect(result.stdout).toContain("true");
    expect(result.stdout).toContain("99");
    expect(result.stdout).toContain("hello");
  }, 15000);

  it("writes log lines tagged with severity", async () => {
    const result = await buildAndRun(`
      import { Log } from "mint:log";

      export function main(): void {
        Log.info("boot");
        Log.warn("slow");
        Log.error("dead");
        Log.debug("trace");
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[INFO] boot");
    expect(result.stdout).toContain("[WARN] slow");
    expect(result.stdout).toContain("[ERROR] dead");
    expect(result.stdout).toContain("[DEBUG] trace");
  }, 15000);

  it("hashes, ciphers and renders hex", async () => {
    const result = await buildAndRun(`
      import { Crypto } from "mint:crypto";
      import { println } from "mint:io";

      export function main(): void {
        let hash: int = Crypto.hashFnv1a("mint");
        let cipher: string = Crypto.xorCipher("mint", "k");
        let plain: string = Crypto.xorCipher(cipher, "k");
        println(hash);
        println(Crypto.toHex(hash));
        println(plain);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("mint");
    expect(result.stdout.trim().split(/\r?\n/u).length).toBe(3);
  }, 15000);

  it("computes SHA-256, MD5, and HMAC test vectors", async () => {
    const result = await buildAndRun(`
      import { Crypto } from "mint:crypto";
      import { println } from "mint:io";

      export function main(): void {
        println(Crypto.sha256(""));
        println(Crypto.sha256("abc"));
        println(Crypto.md5(""));
        println(Crypto.md5("abc"));
        println(Crypto.hmacSha256("key", "The quick brown fox jumps over the lazy dog"));
        println(Crypto.hmacMd5("key", "The quick brown fox jumps over the lazy dog"));
      }
    `);

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split(/\r?\n/u);
    expect(lines[0]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(lines[1]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(lines[2]).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(lines[3]).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(lines[4]).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
    expect(lines[5]).toBe("80070713463e7749b90c2dc24911e275");
  }, 30000);

  it("parses url components and builds http get request", async () => {
    const result = await buildAndRun(`
      import { Url, Http } from "mint:net";
      import { println } from "mint:io";

      export function main(): void {
        println(Url.scheme("https://example.com/x"));
        println(Url.host("https://example.com/x"));
        println(Url.path("https://example.com/x"));
        println(Url.encodeComponent("hello world"));
        println(Http.buildGet("/x", "example.com"));
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("https");
    expect(result.stdout).toContain("example.com");
    expect(result.stdout).toContain("/x");
    expect(result.stdout).toContain("hello%20world");
    expect(result.stdout).toContain("GET /x HTTP/1.1");
  }, 15000);

  it("runs parallel sum and sleeps", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";

      export function main(): void {
        let workload: int[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        Async.sleepMs(5);
        println(Async.parallelSum(workload));
        println(Async.parallelMax(workload));
        println(Async.parallelMin(workload));
        println(Async.hardwareThreads() >= 1);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("55");
    expect(result.stdout).toContain("10");
    expect(result.stdout).toContain("1");
  }, 15000);

  it("spawns threads, joins, and aggregates via atomics", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";

      export function main(): void {
        let counter: int = Async.createAtomic(0);
        let id1: int = Async.spawn(fn(): void => Async.atomicAdd(counter, 7));
        let id2: int = Async.spawn(fn(): void => Async.atomicAdd(counter, 35));
        Async.join(id1);
        Async.join(id2);
        println(Async.atomicLoad(counter));
        Async.destroyAtomic(counter);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("42");
  }, 20000);

  it("runs parallelFor closures concurrently against atomics", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";

      export function main(): void {
        let counter: int = Async.createAtomic(0);
        Async.parallelFor(1000, fn(i: int): void => Async.atomicAdd(counter, 1));
        println(Async.atomicLoad(counter));
        Async.destroyAtomic(counter);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("1000");
  }, 20000);

  it("sends and receives messages through a channel", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";

      export function main(): void {
        let channelId: int = Async.createChannel();
        let workerId: int = Async.spawn(fn(): void => Async.channelSend(channelId, "ping"));
        let received: string = Async.channelReceive(channelId);
        Async.join(workerId);
        println(received);
        Async.channelClose(channelId);
        Async.destroyChannel(channelId);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("ping");
  }, 20000);

  it("guards a shared counter with a mutex", async () => {
    const result = await buildAndRun(`
      import { Async } from "mint:async";
      import { println } from "mint:io";

      export function main(): void {
        let mutexId: int = Async.createMutex();
        Async.lock(mutexId);
        let acquired: bool = Async.tryLock(mutexId);
        Async.unlock(mutexId);
        let reacquired: bool = Async.tryLock(mutexId);
        Async.unlock(mutexId);
        Async.destroyMutex(mutexId);
        println(acquired);
        println(reacquired);
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual(["0", "1"]);
  }, 15000);

  it("tracks memory bytes via counters", async () => {
    const result = await buildAndRun(`
      import { Memory } from "mint:memory";
      import { println } from "mint:io";

      export function main(): void {
        Memory.reset();
        Memory.recordAlloc(1024);
        Memory.recordAlloc(2048);
        Memory.recordFree(512);
        println(Memory.bytesUsed());
        println(Memory.peakBytes());
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("2560");
    expect(result.stdout).toContain("3072");
  }, 15000);

  it("performs simd-style arithmetic over int arrays", async () => {
    const result = await buildAndRun(`
      import { Simd } from "mint:simd";
      import { println } from "mint:io";

      export function main(): void {
        let left: int[] = [1, 2, 3, 4];
        let right: int[] = [10, 20, 30, 40];
        let combined: int[] = Simd.addArrays(left, right);
        let scaled: int[] = Simd.scaleArray(left, 5);
        println(combined[0]);
        println(combined[3]);
        println(scaled[3]);
        println(Simd.dotProduct(left, right));
        println(Simd.sum(left));
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("11");
    expect(result.stdout).toContain("44");
    expect(result.stdout).toContain("20");
    expect(result.stdout).toContain("300");
    expect(result.stdout).toContain("10");
  }, 15000);

  it("stores and retrieves values from in-memory kv", async () => {
    const result = await buildAndRun(`
      import { KV } from "mint:db";
      import { println } from "mint:io";

      export function main(): void {
        KV.clear();
        KV.set("name", "doublemint");
        KV.set("draft", "yes");
        KV.remove("draft");
        println(KV.get("name", "missing"));
        println(KV.has("name"));
        println(KV.has("draft"));
        println(KV.get("absent", "fallback"));
        println(KV.size());
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("doublemint");
    expect(result.stdout).toContain("fallback");
    expect(result.stdout).toContain("1");
  }, 15000);

  it("emits ansi escapes for terminal styling", async () => {
    const result = await buildAndRun(`
      import { Terminal } from "mint:term";
      import { println } from "mint:io";

      export function main(): void {
        println(Terminal.bold("title"));
        println(Terminal.colorize("ok", 32));
      }
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[1mtitle[0m");
    expect(result.stdout).toContain("[32mok[0m");
  }, 15000);
});
