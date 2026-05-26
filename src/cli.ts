#!/usr/bin/env node
import { stdin } from "node:process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNativeExecutable } from "./core/nativeCompiler.js";
import { loadConfig } from "./core/config.js";
import { DoublemintDiagnostic } from "./diagnostics/diagnostic.js";
import { emitCppToDisk } from "./emitter/cppEmitter.js";
import { resolveModuleGraph } from "./resolver/moduleGraph.js";
import { checkModuleGraph } from "./semantic/checker.js";
import { buildBuiltinManifest } from "./builtins/mintModules.js";
import { formatSource } from "./format/formatter.js";

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "package.json"),
    resolve(here, "..", "..", "package.json"),
    resolve(here, "..", "..", "..", "package.json")
  ];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (pkg.name === "doublemint" && typeof pkg.version === "string") { return pkg.version; }
    } catch {
      // ignore
    }
  }
  return "0.0.0-unknown";
}

const args = parseCliArgs(process.argv.slice(2));

async function main(): Promise<void> {
  if (args.version) {
    console.log(`doublemint ${readVersion()}`);
    return;
  }

  if (!args.command || args.help) {
    printHelp();
    return;
  }

  if (args.command === "version") {
    console.log(`doublemint ${readVersion()}`);
    return;
  }

  if (args.command === "info") {
    printInfo();
    return;
  }

  if (args.command === "init") {
    runInit(args.entry);
    return;
  }

  if (args.command === "fmt") {
    runFmt(args.entry, { write: args.write, check: args.check });
    return;
  }

  if (!["check", "emit", "build", "version", "info", "init", "fmt"].includes(args.command)) {
    throw new DoublemintDiagnostic({
      code: "DLM0001",
      severity: "error",
      message: `Unknown command "${args.command}".`,
      hint: "Use check, emit, build, fmt, init, version, or info."
    });
  }

  if (args.stdinFilepath && args.command !== "check") {
    throw new DoublemintDiagnostic({
      code: "DLM0006",
      severity: "error",
      message: "Option \"--stdin-filepath\" is only supported by check."
    });
  }

  if (!args.entry && !args.stdinFilepath) {
    throw new DoublemintDiagnostic({
      code: "DLM0002",
      severity: "error",
      message: `Command "${args.command}" requires an entry .dlm file.`
    });
  }

  const config = await loadConfig(process.cwd());
  const entryPath = resolve(process.cwd(), args.stdinFilepath ?? args.entry!);
  const stdinSource = args.stdinFilepath ? await readStdin() : null;
  const graph = await resolveModuleGraph(
    entryPath,
    stdinSource === null
      ? {}
      : {
          sourceOverrides: new Map([[entryPath, stdinSource]])
        }
  );
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
    const buildConfig = args.cppOut
      ? { ...config, outDir: resolve(process.cwd(), args.cppOut) }
      : config;
    const result = await emitCppToDisk(graph, buildConfig);
    const nativeResult = await buildNativeExecutable(result, buildConfig, {
      outputPath: args.out ?? defaultOutputPath(args.entry!),
      compiler: args.compiler
    });
    console.log(
      `OK built ${nativeResult.outputPath} with ${nativeResult.compiler}. C++ files kept in ${buildConfig.outDir}.`
    );
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
  console.log(`doublemint ${readVersion()}

Usage:
  doublemint check <entry.dlm>
  doublemint check --stdin-filepath <entry.dlm>
  doublemint emit <entry.dlm>
  doublemint build <entry.dlm> --out <binary> [--compiler <clang++|g++>] [--cpp-out <dir>]
  doublemint fmt <entry.dlm> [--write | --check]
  doublemint init [dir]
  doublemint info
  doublemint version
  doublemint --help
`);
}

function runInit(target?: string): void {
  const dir = resolve(process.cwd(), target ?? ".");
  if (!existsSync(dir)) { mkdirSync(dir, { recursive: true }); }
  const projectName = basename(dir);
  const entryPath = join(dir, "main.dlm");
  if (existsSync(entryPath)) {
    console.log(`refusing to overwrite ${entryPath}`);
    return;
  }
  const template = `import { println } from "mint:io";

export function main(): void {
  let name: string = "${projectName}";
  println("hello from \${name}");
}
`;
  writeFileSync(entryPath, template, "utf8");
  console.log(`wrote ${entryPath}`);
  console.log("next: doublemint build " + entryPath + " --out " + join(dir, projectName) + (process.platform === "win32" ? ".exe" : ""));
}

function runFmt(target: string | undefined, opts: { write?: boolean; check?: boolean }): void {
  if (!target) {
    throw new DoublemintDiagnostic({
      code: "DLM0002",
      severity: "error",
      message: "Command \"fmt\" requires an entry .dlm file."
    });
  }
  if (opts.write && opts.check) {
    throw new DoublemintDiagnostic({
      code: "DLM0007",
      severity: "error",
      message: "Options \"--write\" and \"--check\" are mutually exclusive."
    });
  }
  const path = resolve(process.cwd(), target);
  const source = readFileSync(path, "utf8");
  const result = formatSource(source);

  if (opts.check) {
    if (result.changed) {
      console.error(`fmt: ${path} needs formatting`);
      process.exitCode = 1;
      return;
    }
    console.log(`OK ${path} already formatted.`);
    return;
  }

  if (opts.write) {
    if (result.changed) {
      writeFileSync(path, result.output, "utf8");
      console.log(`wrote ${path}`);
    } else {
      console.log(`unchanged ${path}`);
    }
    return;
  }

  process.stdout.write(result.output);
}

function printInfo(): void {
  const manifest = buildBuiltinManifest();
  console.log(`doublemint ${readVersion()}\n`);
  console.log("Builtin modules:");
  const modules = Object.keys(manifest.modules).sort();
  for (const moduleId of modules) {
    const entry = manifest.modules[moduleId]!;
    const exportNames = entry.exports.map((exp) => `${exp.name} (${exp.kind})`).join(", ");
    console.log(`  ${moduleId}  ->  ${exportNames}`);
  }
  console.log(`\n${modules.length} modules total.`);
}

interface CliArgs {
  command?: string;
  entry?: string;
  out?: string;
  compiler?: string;
  cppOut?: string;
  stdinFilepath?: string;
  write?: boolean;
  check?: boolean;
  help: boolean;
  version: boolean;
}

function parseCliArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv;
  const parsed: CliArgs = {
    command,
    help: command === "--help" || command === "-h",
    version: command === "--version" || command === "-v"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      parsed.version = true;
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

    if (arg === "--cpp-out") {
      parsed.cppOut = requireFlagValue(rest, index, "--cpp-out");
      index += 1;
      continue;
    }

    if (arg === "--write") {
      parsed.write = true;
      continue;
    }

    if (arg === "--check") {
      parsed.check = true;
      continue;
    }

    if (arg === "--stdin-filepath") {
      parsed.stdinFilepath = requireFlagValue(rest, index, "--stdin-filepath");
      index += 1;
      continue;
    }

    if (!arg.startsWith("--") && !parsed.entry) {
      parsed.entry = arg;
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

function readStdin(): Promise<string> {
  return new Promise((resolveRead, reject) => {
    let input = "";

    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      input += chunk;
    });
    stdin.on("end", () => resolveRead(input));
    stdin.on("error", reject);
  });
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
