import { createInterface } from "node:readline";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildNativeExecutable } from "../core/nativeCompiler.js";
import { loadConfig } from "../core/config.js";
import { emitCppToDisk } from "../emitter/cppEmitter.js";
import { resolveModuleGraph } from "../resolver/moduleGraph.js";
import { checkModuleGraph } from "../semantic/checker.js";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";

interface ReplState {
  imports: string[];
  decls: string[];
}

const HELP = `doublemint repl — commands:
  :help       show this help
  :show       print accumulated imports and declarations
  :reset      clear imports and declarations
  :exit|:quit leave the repl

input rules:
  lines starting with "import "          -> remembered as imports
  lines starting with "let " or "const " -> remembered as persistent declarations
  anything else                          -> appended as statements in main(); end with ;`;

export async function runRepl(): Promise<void> {
  const state: ReplState = { imports: [], decls: [] };
  const cwd = process.cwd();
  const baseConfig = await loadConfig(cwd);

  console.log("doublemint repl. type :help for commands, :exit to quit.");
  process.stdout.write(">> ");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  const pending: string[] = [];
  let processing = false;
  let inputEnded = false;
  let resolveClose: (() => void) | null = null;

  const closed = new Promise<void>((res) => { resolveClose = res; });

  const drain = async (): Promise<void> => {
    if (processing) { return; }
    processing = true;
    try {
      while (pending.length > 0) {
        const rawLine = pending.shift()!;
        const keepGoing = await handleLine(state, baseConfig, rawLine);
        if (!keepGoing) {
          rl.close();
          return;
        }
        process.stdout.write(">> ");
      }
    } finally {
      processing = false;
      if (inputEnded && pending.length === 0) {
        resolveClose?.();
      }
    }
  };

  rl.on("line", (line: string) => {
    pending.push(line);
    void drain();
  });
  rl.on("close", () => {
    inputEnded = true;
    if (!processing && pending.length === 0) {
      resolveClose?.();
    }
  });

  await closed;
}

async function handleLine(
  state: ReplState,
  baseConfig: Awaited<ReturnType<typeof loadConfig>>,
  rawLine: string
): Promise<boolean> {
  const line = rawLine.trim();
  if (line === "") { return true; }

  if (line === ":exit" || line === ":quit") { return false; }
  if (line === ":help") {
    console.log(HELP);
    return true;
  }
  if (line === ":reset") {
    state.imports.length = 0;
    state.decls.length = 0;
    console.log("repl state cleared.");
    return true;
  }
  if (line === ":show") {
    console.log("imports:");
    for (const i of state.imports) { console.log(`  ${i}`); }
    console.log("decls:");
    for (const d of state.decls) { console.log(`  ${d}`); }
    return true;
  }
  if (line.startsWith(":")) {
    console.error(`unknown repl command: ${line}`);
    return true;
  }

  if (line.startsWith("import ")) {
    const stmt = line.endsWith(";") ? line : `${line};`;
    state.imports.push(stmt);
    console.log(`+ import (${state.imports.length} total)`);
    return true;
  }

  if (line.startsWith("let ") || line.startsWith("const ")) {
    const stmt = line.endsWith(";") ? line : `${line};`;
    state.decls.push(stmt);
    console.log(`+ decl (${state.decls.length} total)`);
    return true;
  }

  const stmt = line.endsWith(";") || line.endsWith("}") ? line : `${line};`;
  try {
    await evaluate(state, stmt, baseConfig);
  } catch (error: unknown) {
    if (error instanceof DoublemintDiagnostic) {
      console.error(error.format());
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
  }
  return true;
}

async function evaluate(state: ReplState, stmt: string, baseConfig: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  const workDir = mkdtempSync(join(tmpdir(), "doublemint-repl-"));
  const entryPath = join(workDir, "main.dlm");
  const program = buildProgram(state, stmt);
  writeFileSync(entryPath, program, "utf8");

  const config = {
    ...baseConfig,
    rootDir: workDir,
    outDir: join(workDir, "cpp"),
    warningsAsErrors: false
  };
  const outputPath = join(workDir, process.platform === "win32" ? "repl.exe" : "repl");

  try {
    const graph = await resolveModuleGraph(entryPath);
    checkModuleGraph(graph);
    const emitResult = await emitCppToDisk(graph, config);
    await buildNativeExecutable(emitResult, config, { outputPath });
    const run = spawnSync(outputPath, [], { encoding: "utf8" });
    if (run.stdout) { process.stdout.write(run.stdout); }
    if (run.stderr) { process.stderr.write(run.stderr); }
    if (run.status !== 0) {
      console.error(`(exit ${run.status})`);
    }
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function buildProgram(state: ReplState, stmt: string): string {
  const importLines = state.imports.join("\n");
  const declLines = state.decls.map((d) => `  ${d}`).join("\n");
  const body = `${declLines}${declLines ? "\n" : ""}  ${stmt}`;
  return `${importLines}${importLines ? "\n\n" : ""}export function main(): void {\n${body}\n}\n`;
}
