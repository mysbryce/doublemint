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

  const responseFile = join(objDir, "link.rsp");
  writeFileSync(
    responseFile,
    objects.map((obj) => `"${obj.replace(/\\/gu, "/")}"`).join("\n"),
    "utf8"
  );

  const linkArgs = [
    `-std=${config.cppStandard}`,
    `-${config.optimization}`,
    `@${responseFile}`,
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
  await runCompiler(cxx, linkArgs);

  return {
    compiler: cxx,
    outputPath,
    args: linkArgs
  };
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
    const child = spawn(command, args, {
      shell: process.platform === "win32",
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
