import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { constants } from "node:fs";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import { scanTokens } from "../lexer/scanner.js";
import { parseProgram } from "../parser/parser.js";
import { isBuiltinModuleSource, resolveBuiltinModule } from "../builtins/mintModules.js";
import type {
  SourceLocation
} from "../lexer/token.js";
import type {
  Declaration,
  FunctionDeclaration,
  ImportDeclaration,
  Program,
  StructDeclaration,
  TypeAliasDeclaration,
  TypeNode
} from "../parser/ast.js";

export type ExportKind = "type" | "value";

export interface FunctionType {
  params: TypeNode[];
  returnType: TypeNode;
}

export interface BuiltinNamespaceMember {
  name: string;
  kind: "function" | "value";
  params?: TypeNode[];
  returnType?: TypeNode;
  valueType?: TypeNode;
  nativeName: string;
  location: SourceLocation;
}

export interface BuiltinClassMethod {
  name: string;
  params: TypeNode[];
  returnType: TypeNode;
  /** When true the method takes no args and reads like a field: `obj.foo` instead of `obj.foo()`. */
  property?: boolean;
  location: SourceLocation;
}

export interface AstModuleExport {
  name: string;
  kind: ExportKind;
  builtin?: false;
  declaration: TypeAliasDeclaration | StructDeclaration | FunctionDeclaration;
}

export interface BuiltinModuleExport {
  name: string;
  kind: ExportKind;
  builtin: true;
  namespaceMembers?: Map<string, BuiltinNamespaceMember>;
  classMethods?: Map<string, BuiltinClassMethod>;
  functionType?: FunctionType;
  nativeName?: string;
  location: SourceLocation;
}

export type ModuleExport = AstModuleExport | BuiltinModuleExport;

export interface ResolvedImport {
  specifier: string;
  typeOnly: boolean;
  source: string;
  resolvedFilepath: string;
  export: ModuleExport;
}

export interface ResolvedModule {
  filepath: string;
  builtin?: boolean;
  builtinIncludes?: string[];
  builtinLinkLibraries?: Partial<Record<NodeJS.Platform, string[]>>;
  program: Program;
  imports: ResolvedImport[];
  exports: Map<string, ModuleExport>;
}

export interface ModuleGraph {
  entryFilepath: string;
  modules: Map<string, ResolvedModule>;
}

export interface ResolveModuleGraphOptions {
  sourceOverrides?: Map<string, string>;
}

type VisitState = "visiting" | "visited";

export async function resolveModuleGraph(
  entryFilepath: string,
  options: ResolveModuleGraphOptions = {}
): Promise<ModuleGraph> {
  const resolver = new ModuleGraphResolver(options);
  return resolver.resolve(entryFilepath);
}

class ModuleGraphResolver {
  private readonly modules = new Map<string, ResolvedModule>();
  private readonly states = new Map<string, VisitState>();
  private readonly stack: string[] = [];

  constructor(private readonly options: ResolveModuleGraphOptions) {}

  async resolve(entryFilepath: string): Promise<ModuleGraph> {
    const normalizedEntry = normalizeModuleFilepath(entryFilepath);
    await this.resolveModule(normalizedEntry);

    return {
      entryFilepath: normalizedEntry,
      modules: this.modules
    };
  }

  private async resolveModule(filepath: string): Promise<ResolvedModule> {
    const normalized = normalizeModuleFilepath(filepath);
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

    const builtinModule = resolveBuiltinModule(normalized);
    let resolvedModule: ResolvedModule;

    if (builtinModule) {
      resolvedModule = builtinModule;
    } else {
      const source = await this.readModuleSource(normalized);
      const program = parseProgram(scanTokens(source, normalized), normalized);
      const exports = collectExports(program);
      resolvedModule = {
        filepath: normalized,
        program,
        imports: [],
        exports
      };
    }

    this.modules.set(normalized, resolvedModule);

    if (resolvedModule.builtin) {
      this.stack.pop();
      this.states.set(normalized, "visited");
      return resolvedModule;
    }

    for (const importDeclaration of resolvedModule.program.body.filter(isImportDeclaration)) {
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
    const override = this.options.sourceOverrides?.get(resolve(filepath));
    if (override !== undefined) {
      return override;
    }

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

function exportFromDeclaration(declaration: Declaration): AstModuleExport | null {
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
  if (isBuiltinModuleSource(importSource)) {
    if (resolveBuiltinModule(importSource)) {
      return importSource;
    }

    throw new DoublemintDiagnostic({
      code: "DLM3008",
      severity: "error",
      message: `Unknown built-in module: ${importSource}.`
    });
  }

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

function normalizeModuleFilepath(filepath: string): string {
  return isBuiltinModuleSource(filepath) ? filepath : resolve(filepath);
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
