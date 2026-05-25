import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
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
  const compiler = options.compiler ?? config.compiler;
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
    "-o",
    outputPath
  ];

  await runCompiler(compiler, args);

  return {
    compiler,
    outputPath,
    args
  };
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
