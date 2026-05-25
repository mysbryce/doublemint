import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
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
  const compiler = selectCompiler(options.compiler ?? config.compiler);
  const outputPath = resolve(options.outputPath);
  const cppFiles = emitResult.artifacts
    .filter((artifact) => artifact.filepath.endsWith(".cpp"))
    .map((artifact) => artifact.filepath);
  const args = [
    `-std=${config.cppStandard}`,
    `-${config.optimization}`,
    "-Wall",
    "-Wextra",
    ...(config.warningsAsErrors ? ["-Werror"] : []),
    ...config.includeDirs.map((includeDir) => `-I${includeDir}`),
    ...Array.from(new Set(cppFiles.map((filepath) => `-I${dirname(filepath)}`))),
    ...cppFiles,
    ...(config.libraryDirs ?? []).map((libraryDir) => `-L${libraryDir}`),
    ...(config.linkLibraries ?? []).map((library) => `-l${library}`),
    ...(config.linkerFlags ?? []),
    "-o",
    outputPath
  ];

  await mkdir(dirname(outputPath), { recursive: true });
  await runCompiler(compiler, args);

  return {
    compiler,
    outputPath,
    args
  };
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
