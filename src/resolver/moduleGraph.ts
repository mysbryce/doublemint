import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { constants } from "node:fs";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import { scanTokens } from "../lexer/scanner.js";
import { parseProgram } from "../parser/parser.js";
import type {
  Declaration,
  FunctionDeclaration,
  ImportDeclaration,
  Program,
  StructDeclaration,
  TypeAliasDeclaration
} from "../parser/ast.js";

export type ExportKind = "type" | "value";

export interface ModuleExport {
  name: string;
  kind: ExportKind;
  declaration: TypeAliasDeclaration | StructDeclaration | FunctionDeclaration;
}

export interface ResolvedImport {
  specifier: string;
  typeOnly: boolean;
  source: string;
  resolvedFilepath: string;
  export: ModuleExport;
}

export interface ResolvedModule {
  filepath: string;
  program: Program;
  imports: ResolvedImport[];
  exports: Map<string, ModuleExport>;
}

export interface ModuleGraph {
  entryFilepath: string;
  modules: Map<string, ResolvedModule>;
}

type VisitState = "visiting" | "visited";

export async function resolveModuleGraph(entryFilepath: string): Promise<ModuleGraph> {
  const resolver = new ModuleGraphResolver();
  return resolver.resolve(entryFilepath);
}

class ModuleGraphResolver {
  private readonly modules = new Map<string, ResolvedModule>();
  private readonly states = new Map<string, VisitState>();
  private readonly stack: string[] = [];

  async resolve(entryFilepath: string): Promise<ModuleGraph> {
    const normalizedEntry = resolve(entryFilepath);
    await this.resolveModule(normalizedEntry);

    return {
      entryFilepath: normalizedEntry,
      modules: this.modules
    };
  }

  private async resolveModule(filepath: string): Promise<ResolvedModule> {
    const normalized = resolve(filepath);
    const state = this.states.get(normalized);

    if (state === "visited") {
      return this.modules.get(normalized)!;
    }

    if (state === "visiting") {
      throw new DoublemintDiagnostic({
        code: "DLM3001",
        severity: "error",
        message: `Circular import detected: ${this.formatCycle(normalized)}.`
      });
    }

    this.states.set(normalized, "visiting");
    this.stack.push(normalized);

    const source = await this.readModuleSource(normalized);
    const program = parseProgram(scanTokens(source, normalized), normalized);
    const exports = collectExports(program);
    const resolvedModule: ResolvedModule = {
      filepath: normalized,
      program,
      imports: [],
      exports
    };

    this.modules.set(normalized, resolvedModule);

    for (const importDeclaration of program.body.filter(isImportDeclaration)) {
      const importFilepath = await resolveImportFilepath(
        normalized,
        importDeclaration.source
      );
      const importedModule = await this.resolveModule(importFilepath);

      for (const specifier of importDeclaration.specifiers) {
        const importedExport = importedModule.exports.get(specifier);

        if (!importedExport) {
          throw new DoublemintDiagnostic({
            code: "DLM3002",
            severity: "error",
            message: `Module "${importDeclaration.source}" does not export "${specifier}".`,
            location: importDeclaration.location
          });
        }

        if (importDeclaration.typeOnly && importedExport.kind !== "type") {
          throw new DoublemintDiagnostic({
            code: "DLM3003",
            severity: "error",
            message: `Cannot import value export "${specifier}" with import type.`,
            location: importDeclaration.location
          });
        }

        if (!importDeclaration.typeOnly && importedExport.kind !== "value") {
          throw new DoublemintDiagnostic({
            code: "DLM3004",
            severity: "error",
            message: `Use import type for type-only export "${specifier}".`,
            location: importDeclaration.location
          });
        }

        resolvedModule.imports.push({
          specifier,
          typeOnly: importDeclaration.typeOnly,
          source: importDeclaration.source,
          resolvedFilepath: importFilepath,
          export: importedExport
        });
      }
    }

    this.stack.pop();
    this.states.set(normalized, "visited");
    return resolvedModule;
  }

  private async readModuleSource(filepath: string): Promise<string> {
    try {
      return await readFile(filepath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new DoublemintDiagnostic({
          code: "DLM3005",
          severity: "error",
          message: `Module file not found: ${filepath}.`
        });
      }

      throw error;
    }
  }

  private formatCycle(filepath: string): string {
    const cycleStart = this.stack.indexOf(filepath);
    const cycle = [...this.stack.slice(cycleStart), filepath];
    return cycle.join(" -> ");
  }
}

function collectExports(program: Program): Map<string, ModuleExport> {
  const exports = new Map<string, ModuleExport>();

  for (const declaration of program.body) {
    const moduleExport = exportFromDeclaration(declaration);

    if (!moduleExport) {
      continue;
    }

    const existing = exports.get(moduleExport.name);
    if (existing) {
      throw new DoublemintDiagnostic({
        code: "DLM3006",
        severity: "error",
        message: `Duplicate export "${moduleExport.name}".`,
        location: moduleExport.declaration.location
      });
    }

    exports.set(moduleExport.name, moduleExport);
  }

  return exports;
}

function exportFromDeclaration(declaration: Declaration): ModuleExport | null {
  if (declaration.type === "TypeAliasDeclaration" && declaration.exported) {
    return {
      name: declaration.id,
      kind: "type",
      declaration
    };
  }

  if (declaration.type === "StructDeclaration" && declaration.exported) {
    return {
      name: declaration.id,
      kind: "type",
      declaration
    };
  }

  if (
    declaration.type === "FunctionDeclaration" &&
    declaration.exported &&
    !declaration.extern
  ) {
    return {
      name: declaration.id,
      kind: "value",
      declaration
    };
  }

  return null;
}

async function resolveImportFilepath(
  importerFilepath: string,
  importSource: string
): Promise<string> {
  if (!importSource.startsWith(".")) {
    throw new DoublemintDiagnostic({
      code: "DLM3007",
      severity: "error",
      message: `Only relative .dlm imports are supported: ${importSource}.`
    });
  }

  const importerDirectory = dirname(importerFilepath);
  const basePath = resolve(importerDirectory, importSource);
  const candidates = extname(basePath) ? [basePath] : [`${basePath}.dlm`];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  throw new DoublemintDiagnostic({
    code: "DLM3005",
    severity: "error",
    message: `Module file not found for import "${importSource}" from ${importerFilepath}.`
  });
}

function isImportDeclaration(declaration: Declaration): declaration is ImportDeclaration {
  return declaration.type === "ImportDeclaration";
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
