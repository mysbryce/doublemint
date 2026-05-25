#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./core/config.js";
import { DoublemintDiagnostic } from "./diagnostics/diagnostic.js";
import { resolveModuleGraph } from "./resolver/moduleGraph.js";

const command = process.argv[2];
const entry = process.argv[3];

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (!["check", "emit", "build"].includes(command)) {
    throw new DoublemintDiagnostic({
      code: "DLM0001",
      severity: "error",
      message: `Unknown command "${command}".`,
      hint: "Use check, emit, or build."
    });
  }

  if (!entry) {
    throw new DoublemintDiagnostic({
      code: "DLM0002",
      severity: "error",
      message: `Command "${command}" requires an entry .dlm file.`
    });
  }

  const config = await loadConfig(process.cwd());
  const entryPath = resolve(process.cwd(), entry);
  const graph = await resolveModuleGraph(entryPath);

  if (command === "check") {
    console.log(
      `OK ${graph.modules.size} modules resolved using ${config.cppStandard}.`
    );
    return;
  }

  throw new DoublemintDiagnostic({
    code: "DLM0003",
    severity: "error",
    message: `Command "${command}" is scaffolded but not implemented yet.`,
    hint: "Use check while parser, resolver, semantic checker, and emitter are built."
  });
}

function printHelp(): void {
  console.log(`doublemint

Usage:
  doublemint check <entry.dlm>
  doublemint emit <entry.dlm>
  doublemint build <entry.dlm>
`);
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
