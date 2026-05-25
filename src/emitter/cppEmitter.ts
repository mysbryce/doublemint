import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import type { DoublemintConfig } from "../core/config.js";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type {
  Expression,
  FunctionDeclaration,
  ImportDeclaration,
  Program,
  Statement,
  StructDeclaration,
  TypeAliasDeclaration,
  TypeNode,
  VariableDeclaration
} from "../parser/ast.js";
import type { ModuleGraph, ResolvedModule } from "../resolver/moduleGraph.js";

export interface CppArtifact {
  filepath: string;
  content: string;
}

export interface EmitResult {
  artifacts: CppArtifact[];
}

export async function emitCppToDisk(
  graph: ModuleGraph,
  config: DoublemintConfig
): Promise<EmitResult> {
  const result = emitCpp(graph, config);

  for (const artifact of result.artifacts) {
    await mkdir(dirname(artifact.filepath), { recursive: true });
    await writeFile(artifact.filepath, artifact.content, "utf8");
  }

  return result;
}

export function emitCpp(graph: ModuleGraph, config: DoublemintConfig): EmitResult {
  const artifacts: CppArtifact[] = [];

  for (const module of graph.modules.values()) {
    artifacts.push(emitHeader(graph, module, config));
    artifacts.push(emitSource(graph, module, config));
  }

  return { artifacts };
}

function emitHeader(
  graph: ModuleGraph,
  module: ResolvedModule,
  config: DoublemintConfig
): CppArtifact {
  const guard = includeGuard(module);
  const lines: string[] = [
    "#pragma once",
    "",
    "#include <string>",
    "#include <tuple>",
    ""
  ];

  for (const importDeclaration of importsOf(module.program)) {
    lines.push(`#include "${headerIncludePath(module, importDeclaration, graph)}"`);
  }

  if (importsOf(module.program).length > 0) {
    lines.push("");
  }

  for (const declaration of module.program.body) {
    if (declaration.type === "TypeAliasDeclaration") {
      lines.push(emitTypeAlias(declaration));
      lines.push("");
    }

    if (declaration.type === "StructDeclaration") {
      lines.push(emitStruct(declaration));
      lines.push("");
    }
  }

  for (const declaration of functionDeclarations(module.program)) {
    if (!declaration.extern) {
      lines.push(`${emitFunctionSignature(declaration)};`);
    }
  }

  return {
    filepath: `${moduleOutputPath(module, config)}.hpp`,
    content: withTrailingNewline([`// ${guard}`, ...trimBlankTail(lines)].join("\n"))
  };
}

function emitSource(
  graph: ModuleGraph,
  module: ResolvedModule,
  config: DoublemintConfig
): CppArtifact {
  const lines: string[] = [
    `#include "${basename(module)}.hpp"`,
    ""
  ];

  for (const declaration of module.program.body) {
    if (declaration.type === "ExternBlockDeclaration") {
      lines.push(`#include <${declaration.source}>`);
    }
  }

  if (module.program.body.some((declaration) => declaration.type === "ExternBlockDeclaration")) {
    lines.push("");
  }

  for (const declaration of functionDeclarations(module.program)) {
    if (declaration.extern) {
      continue;
    }

    lines.push(emitFunctionDefinition(declaration));
    lines.push("");
  }

  return {
    filepath: `${moduleOutputPath(module, config)}.cpp`,
    content: withTrailingNewline(trimBlankTail(lines).join("\n"))
  };
}

function emitTypeAlias(declaration: TypeAliasDeclaration): string {
  return `using ${declaration.id} = ${emitType(declaration.valueType)};`;
}

function emitStruct(declaration: StructDeclaration): string {
  const lines = [`struct ${declaration.id} {`];

  for (const field of declaration.fields) {
    lines.push(`  ${emitType(field.valueType)} ${field.id};`);
  }

  lines.push("};");
  return lines.join("\n");
}

function emitFunctionDefinition(declaration: FunctionDeclaration): string {
  const lines = [`${emitFunctionSignature(declaration)} {`];

  for (const statement of declaration.body) {
    lines.push(`  ${emitStatement(statement)}`);
  }

  lines.push("}");
  return lines.join("\n");
}

function emitFunctionSignature(declaration: FunctionDeclaration): string {
  const params = declaration.params
    .map((param) => `${emitParameterType(param.valueType)} ${param.id}`)
    .join(", ");
  return `${emitType(declaration.returnType)} ${declaration.id}(${params})`;
}

function emitParameterType(type: TypeNode): string {
  if (type.type === "NamedType" && shouldPassByConstReference(type.name)) {
    return `const ${emitType(type)}&`;
  }

  return emitType(type);
}

function emitStatement(statement: Statement): string {
  switch (statement.type) {
    case "VariableDeclaration":
      return emitVariableDeclaration(statement);
    case "ReturnStatement":
      return statement.argument ? `return ${emitExpression(statement.argument)};` : "return;";
    case "ExpressionStatement":
      return `${emitExpression(statement.expression)};`;
    default:
      assertNever(statement);
  }
}

function emitVariableDeclaration(statement: VariableDeclaration): string {
  const prefix = statement.kind === "const" ? "const " : "";
  const init = statement.init ? ` = ${emitExpression(statement.init)}` : "";
  return `${prefix}${emitType(statement.valueType)} ${statement.id}${init};`;
}

function emitExpression(expression: Expression): string {
  switch (expression.type) {
    case "Identifier":
      return expression.name;
    case "Literal":
      return expression.raw;
    case "BinaryExpression":
      return `${emitExpression(expression.left)} ${expression.operator} ${emitExpression(expression.right)}`;
    case "AssignmentExpression":
      return `${emitExpression(expression.left)} = ${emitExpression(expression.right)}`;
    case "CallExpression":
      return `${emitExpression(expression.callee)}(${expression.arguments.map(emitExpression).join(", ")})`;
    case "MemberExpression":
      return `${emitExpression(expression.object)}.${expression.property}`;
    case "CopyExpression":
      return emitExpression(expression.argument);
    case "CastExpression":
      return `static_cast<${emitType(expression.targetType)}>(${emitExpression(expression.expression)})`;
    default:
      assertNever(expression);
  }
}

function emitType(type: TypeNode): string {
  if (type.type === "TupleType") {
    return `std::tuple<${type.elements.map(emitType).join(", ")}>`;
  }

  switch (type.name) {
    case "string":
      return "std::string";
    default:
      return type.name;
  }
}

function importsOf(program: Program): ImportDeclaration[] {
  return program.body.filter(
    (declaration): declaration is ImportDeclaration => declaration.type === "ImportDeclaration"
  );
}

function functionDeclarations(program: Program): FunctionDeclaration[] {
  const declarations: FunctionDeclaration[] = [];

  for (const declaration of program.body) {
    if (declaration.type === "FunctionDeclaration") {
      declarations.push(declaration);
    }

    if (declaration.type === "ExternBlockDeclaration") {
      declarations.push(...declaration.declarations);
    }
  }

  return declarations;
}

function headerIncludePath(
  module: ResolvedModule,
  importDeclaration: ImportDeclaration,
  graph: ModuleGraph
): string {
  const match = module.imports.find(
    (candidate) => candidate.source === importDeclaration.source
  );

  if (!match) {
    throw new DoublemintDiagnostic({
      code: "DLM5001",
      severity: "error",
      message: `Cannot find resolved import "${importDeclaration.source}".`,
      location: importDeclaration.location
    });
  }

  const fromHeader = `${moduleOutputPath(module, outputRelativeConfig(graph))}.hpp`;
  const toHeader = `${moduleOutputPath(
    graph.modules.get(match.resolvedFilepath)!,
    outputRelativeConfig(graph)
  )}.hpp`;
  return normalizeSlashes(relative(dirname(fromHeader), toHeader));
}

function moduleOutputPath(module: ResolvedModule, config: Pick<DoublemintConfig, "outDir">): string {
  return `${config.outDir}/${basename(module)}`;
}

function outputRelativeConfig(_graph: ModuleGraph): Pick<DoublemintConfig, "outDir"> {
  return { outDir: "." };
}

function basename(module: ResolvedModule): string {
  return module.filepath.split(/[\\/]/u).pop()!.replace(/\.dlm$/u, "");
}

function includeGuard(module: ResolvedModule): string {
  return `Generated from ${module.filepath}`;
}

function shouldPassByConstReference(typeName: string): boolean {
  return !["void", "int", "float", "double", "string", "bool"].includes(typeName);
}

function trimBlankTail(lines: string[]): string[] {
  const copy = [...lines];

  while (copy.at(-1) === "") {
    copy.pop();
  }

  return copy;
}

function withTrailingNewline(content: string): string {
  return `${content}\n`;
}

function normalizeSlashes(path: string): string {
  return path.replace(/\\/gu, "/");
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
