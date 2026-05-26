import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { DoublemintConfig } from "./config.js";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { EmitResult } from "../emitter/cppEmitter.js";

export interface NativeBuildOptions {
  outputPath: string;
  compiler?: string;
}

export interface NativeBuildResult {
  compiler: string;
  outputPath: string;
  args: string[];
}

export async function buildNativeExecutable(
  emitResult: EmitResult,
  config: DoublemintConfig,
  options: NativeBuildOptions
): Promise<NativeBuildResult> {
  const cxx = selectCompiler(options.compiler ?? config.compiler);
  const cc = selectCCompiler(cxx);
  const outputPath = resolve(options.outputPath);
  const cppFiles = emitResult.artifacts
    .filter((artifact) => artifact.filepath.endsWith(".cpp"))
    .map((artifact) => artifact.filepath);
  const nativeSources = (config.nativeSources ?? []).map((source) =>
    isAbsolute(source) ? source : resolve(source)
  );

  const cFiles = emitResult.nativeSources.filter((file) => file.toLowerCase().endsWith(".c"));
  const cppFromVendor = emitResult.nativeSources.filter((file) => !file.toLowerCase().endsWith(".c"));
  const allCpp = [...cppFromVendor, ...nativeSources, ...cppFiles];

  const objDir = join(dirname(outputPath), ".doublemint-obj");
  await mkdir(objDir, { recursive: true });

  const includeFlags = [
    ...config.includeDirs.map((includeDir) => `-I${includeDir}`),
    ...Array.from(new Set(cppFiles.map((filepath) => `-I${dirname(filepath)}`))),
    ...emitResult.includeDirs.map((includeDir) => `-I${includeDir}`)
  ];
  const defineFlags = emitResult.defines.map((define) => `-D${define}`);
  const extraFlags = emitResult.compileFlags;

  const objects: string[] = [];

  for (const source of cFiles) {
    const obj = objectPathFor(objDir, source);
    const args = [
      "-std=c11",
      `-${config.optimization}`,
      ...includeFlags,
      ...defineFlags,
      ...extraFlags,
      "-c",
      source,
      "-o",
      obj
    ];
    if (process.env.DOUBLEMINT_DEBUG_COMPILE) {
      console.error(`[doublemint] ${cc}:`, source);
    }
    await runCompiler(cc, args);
    objects.push(obj);
  }

  for (const source of allCpp) {
    const obj = objectPathFor(objDir, source);
    const args = [
      `-std=${config.cppStandard}`,
      `-${config.optimization}`,
      "-Wall",
      "-Wextra",
      ...(config.warningsAsErrors ? ["-Werror"] : []),
      ...includeFlags,
      ...defineFlags,
      ...extraFlags,
      "-c",
      source,
      "-o",
      obj
    ];
    if (process.env.DOUBLEMINT_DEBUG_COMPILE) {
      console.error(`[doublemint] ${cxx}:`, source);
    }
    await runCompiler(cxx, args);
    objects.push(obj);
  }

  const linkArgs = [
    `-std=${config.cppStandard}`,
    `-${config.optimization}`,
    ...objects,
    ...(config.libraryDirs ?? []).map((libraryDir) => `-L${libraryDir}`),
    ...(config.linkLibraries ?? []).map((library) => `-l${library}`),
    ...emitResult.linkLibraries.map((library) => `-l${library}`),
    ...(config.linkerFlags ?? []),
    "-o",
    outputPath
  ];

  await mkdir(dirname(outputPath), { recursive: true });
  if (process.env.DOUBLEMINT_DEBUG_COMPILE) {
    console.error(`[doublemint] link with ${cxx}, objects=${objects.length}`);
  }
  await linkWithFrontendOrCollect2(cxx, linkArgs);

  return {
    compiler: cxx,
    outputPath,
    args: linkArgs
  };
}

/**
 * MSYS2 UCRT64 g++ on Windows has a bug where it spawns collect2 with
 * COMPILER_PATH/LIBRARY_PATH set, and collect2 then exits silently with
 * code 5 instead of forwarding ld's diagnostics. This wrapper tries the
 * normal frontend invocation first; if that opaque exit-5 is what comes
 * back, it falls back to spawning collect2 directly (with the env vars
 * cleared) using the command shape `g++ -###` would have used.
 */
async function linkWithFrontendOrCollect2(cxx: string, args: string[]): Promise<void> {
  if (process.platform !== "win32") {
    await runCompiler(cxx, args);
    return;
  }
  try {
    await runCompiler(cxx, args);
    return;
  } catch (error) {
    const message = String((error as { message?: string }).message ?? "");
    const matchesFrontendBug = /collect2\.exe:\s*error:\s*ld returned 5 exit status/iu.test(message);
    if (!matchesFrontendBug) { throw error; }
    if (process.env.DOUBLEMINT_DEBUG_COMPILE) {
      console.error("[doublemint] frontend ld-5 bug detected; falling back to collect2 direct");
    }
  }

  const expansion = spawnSync(cxx, ["-###", ...args], {
    shell: true,
    encoding: "utf8"
  });
  if (!expansion.stderr) {
    throw new DoublemintDiagnostic({
      code: "DLM6003",
      severity: "error",
      message: `Cannot expand "${cxx} -###" for collect2 fallback.`
    });
  }
  const collectLine = expansion.stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /collect2\.exe/iu.test(line));
  if (!collectLine) {
    throw new DoublemintDiagnostic({
      code: "DLM6004",
      severity: "error",
      message: `${cxx} -### did not print a collect2 line.`
    });
  }
  const tokens = parseShellTokens(collectLine);
  if (tokens.length < 2) {
    throw new DoublemintDiagnostic({
      code: "DLM6005",
      severity: "error",
      message: "Failed to parse collect2 tokens from frontend expansion."
    });
  }
  const collect2 = tokens[0];
  const collect2Args = tokens.slice(1);
  const sanitizedEnv: NodeJS.ProcessEnv = { ...process.env };
  delete sanitizedEnv["COMPILER_PATH"];
  delete sanitizedEnv["LIBRARY_PATH"];
  delete sanitizedEnv["COLLECT_GCC"];
  delete sanitizedEnv["COLLECT_LTO_WRAPPER"];
  delete sanitizedEnv["COLLECT_GCC_OPTIONS"];
  if (process.env.DOUBLEMINT_DEBUG_COMPILE) {
    console.error("[doublemint] invoking collect2 directly with sanitized env");
  }
  await runCompilerWithEnv(collect2, collect2Args, sanitizedEnv);
}

function parseShellTokens(line: string): string[] {
  const tokens: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === "\\" && index + 1 < line.length) {
      const next = line[index + 1];
      if (next === '"' || next === "\\") {
        buf += next;
        index += 1;
        continue;
      }
    }
    if (!inQuote && (ch === " " || ch === "\t")) {
      if (buf.length > 0) { tokens.push(buf); buf = ""; }
      continue;
    }
    buf += ch;
  }
  if (buf.length > 0) { tokens.push(buf); }
  return tokens;
}

function runCompilerWithEnv(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      windowsVerbatimArguments: false
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(
        new DoublemintDiagnostic({
          code: "DLM6001",
          severity: "error",
          message: `Failed to start native compiler "${command}": ${error.message}`
        })
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      const output = [...stdout, ...stderr].map((chunk) => chunk.toString()).join("");
      reject(
        new DoublemintDiagnostic({
          code: "DLM6002",
          severity: "error",
          message: `Native compiler "${command}" exited with code ${code}.\n${output.trim()}`
        })
      );
    });
  });
}

function objectPathFor(objDir: string, source: string): string {
  const base = source.replace(/\\/gu, "/").split("/").pop() ?? "src";
  const hash = createHash("md5").update(source).digest("hex").slice(0, 8);
  return join(objDir, `${base}.${hash}.o`);
}

export function selectCompiler(preferred: string): string {
  if (commandExists(preferred)) {
    return preferred;
  }

  for (const fallback of ["clang++", "g++", "c++"]) {
    if (fallback !== preferred && commandExists(fallback)) {
      return fallback;
    }
  }

  return preferred;
}

function selectCCompiler(cxxCompiler: string): string {
  const mapping: Record<string, string> = {
    "g++": "gcc",
    "clang++": "clang",
    "c++": "cc"
  };
  const preferred = mapping[cxxCompiler] ?? cxxCompiler.replace(/\+\+$/u, "");
  if (commandExists(preferred)) {
    return preferred;
  }
  for (const fallback of ["gcc", "clang", "cc"]) {
    if (fallback !== preferred && commandExists(fallback)) {
      return fallback;
    }
  }
  return preferred;
}

function commandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where.exe" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(lookup, args, {
    shell: process.platform !== "win32",
    stdio: "ignore"
  });

  return result.status === 0;
}

function runCompiler(command: string, args: string[]): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const useShell = process.platform === "win32" && !command.toLowerCase().endsWith(".exe");
    const child = spawn(command, args, {
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(
        new DoublemintDiagnostic({
          code: "DLM6001",
          severity: "error",
          message: `Failed to start native compiler "${command}": ${error.message}`
        })
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      const output = [...stdout, ...stderr].map((chunk) => chunk.toString()).join("");
      reject(
        new DoublemintDiagnostic({
          code: "DLM6002",
          severity: "error",
          message: `Native compiler "${command}" exited with code ${code}.\n${output.trim()}`
        })
      );
    });
  });
}
