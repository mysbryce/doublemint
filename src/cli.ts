#!/usr/bin/env node
import { resolve } from "node:path";
import { buildNativeExecutable } from "./core/nativeCompiler.js";
import { loadConfig } from "./core/config.js";
import { DoublemintDiagnostic } from "./diagnostics/diagnostic.js";
import { emitCppToDisk } from "./emitter/cppEmitter.js";
import { resolveModuleGraph } from "./resolver/moduleGraph.js";
import { checkModuleGraph } from "./semantic/checker.js";

const args = parseCliArgs(process.argv.slice(2));

async function main(): Promise<void> {
  if (!args.command || args.help) {
    printHelp();
    return;
  }

  if (!["check", "emit", "build"].includes(args.command)) {
    throw new DoublemintDiagnostic({
      code: "DLM0001",
      severity: "error",
      message: `Unknown command "${args.command}".`,
      hint: "Use check, emit, or build."
    });
  }

  if (!args.entry) {
    throw new DoublemintDiagnostic({
      code: "DLM0002",
      severity: "error",
      message: `Command "${args.command}" requires an entry .dlm file.`
    });
  }

  const config = await loadConfig(process.cwd());
  const entryPath = resolve(process.cwd(), args.entry);
  const graph = await resolveModuleGraph(entryPath);
  const semanticResult = checkModuleGraph(graph);

  if (args.command === "check") {
    console.log(
      `OK ${semanticResult.modulesChecked} modules checked using ${config.cppStandard}.`
    );
    return;
  }

  if (args.command === "emit") {
    const result = await emitCppToDisk(graph, config);
    console.log(`OK ${result.artifacts.length} C++ files emitted to ${config.outDir}.`);
    return;
  }

  if (args.command === "build") {
    const result = await emitCppToDisk(graph, config);
    const nativeResult = await buildNativeExecutable(result, config, {
      outputPath: args.out ?? defaultOutputPath(args.entry),
      compiler: args.compiler
    });
    console.log(`OK built ${nativeResult.outputPath} with ${nativeResult.compiler}.`);
    return;
  }

  throw new DoublemintDiagnostic({
    code: "DLM0003",
    severity: "error",
    message: `Command "${args.command}" is scaffolded but not implemented yet.`,
    hint: "Use check while parser, resolver, semantic checker, and emitter are built."
  });
}

function printHelp(): void {
  console.log(`doublemint

Usage:
  doublemint check <entry.dlm>
  doublemint emit <entry.dlm>
  doublemint build <entry.dlm> --out <binary> [--compiler <clang++|g++>]
`);
}

interface CliArgs {
  command?: string;
  entry?: string;
  out?: string;
  compiler?: string;
  help: boolean;
}

function parseCliArgs(argv: string[]): CliArgs {
  const [command, entry, ...rest] = argv;
  const parsed: CliArgs = {
    command,
    entry,
    help: command === "--help" || command === "-h"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--out") {
      parsed.out = requireFlagValue(rest, index, "--out");
      index += 1;
      continue;
    }

    if (arg === "--compiler") {
      parsed.compiler = requireFlagValue(rest, index, "--compiler");
      index += 1;
      continue;
    }

    throw new DoublemintDiagnostic({
      code: "DLM0004",
      severity: "error",
      message: `Unknown option "${arg}".`
    });
  }

  return parsed;
}

function requireFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new DoublemintDiagnostic({
      code: "DLM0005",
      severity: "error",
      message: `Option "${flag}" requires a value.`
    });
  }

  return value;
}

function defaultOutputPath(entry: string): string {
  return resolve("build", entry.replace(/\.dlm$/u, ""));
}

main().catch((error: unknown) => {
  if (error instanceof DoublemintDiagnostic) {
    console.error(error.format());
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
