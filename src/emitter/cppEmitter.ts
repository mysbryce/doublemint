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

interface EmitContext {
  switchCounter: number;
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
    "#include <vector>",
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
  const lines: string[] = [];

  if (moduleUsesPrint(module.program)) {
    lines.push("#include <iostream>");
  }

  for (const declaration of module.program.body) {
    if (declaration.type === "ExternBlockDeclaration") {
      lines.push(`#include <${declaration.source}>`);
    }
  }

  if (
    lines.length > 0 &&
    (moduleUsesPrint(module.program) ||
      module.program.body.some((declaration) => declaration.type === "ExternBlockDeclaration"))
  ) {
    lines.push("");
  }

  lines.push(`#include "${basename(module)}.hpp"`);
  lines.push("");

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
  const context: EmitContext = { switchCounter: 0 };

  for (const statement of declaration.body) {
    lines.push(`  ${emitStatement(statement, declaration, context)}`);
  }

  if (isVoidMain(declaration) && !hasReturnStatement(declaration)) {
    lines.push("  return 0;");
  }

  lines.push("}");
  return lines.join("\n");
}

function emitFunctionSignature(declaration: FunctionDeclaration): string {
  const params = declaration.params
    .map((param) => `${emitParameterType(param.valueType)} ${param.id}`)
    .join(", ");
  return `${emitFunctionReturnType(declaration)} ${declaration.id}(${params})`;
}

function emitParameterType(type: TypeNode): string {
  if (type.type === "NamedType" && shouldPassByConstReference(type.name)) {
    return `const ${emitType(type)}&`;
  }

  return emitType(type);
}

function emitStatement(
  statement: Statement,
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  switch (statement.type) {
    case "VariableDeclaration":
      return emitVariableDeclaration(statement);
    case "ReturnStatement":
      if (isVoidMain(declaration) && !statement.argument) {
        return "return 0;";
      }

      return statement.argument
        ? `return ${emitExpressionForExpectedType(statement.argument, declaration.returnType)};`
        : "return;";
    case "IfStatement":
      return emitIfStatement(statement, declaration, context);
    case "WhileStatement":
      return emitWhileStatement(statement, declaration, context);
    case "ForStatement":
      return emitForStatement(statement, declaration, context);
    case "SwitchStatement":
      return emitSwitchStatement(statement, declaration, context);
    case "ExpressionStatement":
      return `${emitExpression(statement.expression)};`;
    default:
      assertNever(statement);
  }
}

function emitIfStatement(
  statement: Statement & { type: "IfStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const lines = [`if (${emitExpression(statement.condition)}) {`];

  for (const nestedStatement of statement.thenBranch) {
    lines.push(`  ${emitStatement(nestedStatement, declaration, context)}`);
  }

  if (statement.elseBranch.length === 0) {
    lines.push("}");
    return lines.join("\n  ");
  }

  lines.push("} else {");
  for (const nestedStatement of statement.elseBranch) {
    lines.push(`  ${emitStatement(nestedStatement, declaration, context)}`);
  }
  lines.push("}");
  return lines.join("\n  ");
}

function emitWhileStatement(
  statement: Statement & { type: "WhileStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const lines = [`while (${emitExpression(statement.condition)}) {`];

  for (const nestedStatement of statement.body) {
    lines.push(`  ${emitStatement(nestedStatement, declaration, context)}`);
  }

  lines.push("}");
  return lines.join("\n  ");
}

function emitForStatement(
  statement: Statement & { type: "ForStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const init =
    statement.init?.type === "VariableDeclaration"
      ? emitVariableDeclaration(statement.init, false)
      : statement.init
        ? emitExpression(statement.init)
        : "";
  const condition = statement.condition ? emitExpression(statement.condition) : "";
  const increment = statement.increment ? emitExpression(statement.increment) : "";
  const lines = [`for (${init}; ${condition}; ${increment}) {`];

  for (const nestedStatement of statement.body) {
    lines.push(`  ${emitStatement(nestedStatement, declaration, context)}`);
  }

  lines.push("}");
  return lines.join("\n  ");
}

function emitSwitchStatement(
  statement: Statement & { type: "SwitchStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const tempName = `__dlm_switch_${context.switchCounter}`;
  context.switchCounter += 1;
  const lines = ["{", `  const auto ${tempName} = ${emitExpression(statement.discriminant)};`];

  for (let index = 0; index < statement.cases.length; index += 1) {
    const switchCase = statement.cases[index]!;
    const prefix = index === 0 ? "if" : "else if";
    lines.push(`  ${prefix} (${tempName} == ${emitExpression(switchCase.test)}) {`);

    for (const nestedStatement of switchCase.body) {
      lines.push(`    ${emitStatement(nestedStatement, declaration, context)}`);
    }

    lines.push("  }");
  }

  if (statement.defaultBranch.length > 0) {
    lines.push(statement.cases.length > 0 ? "  else {" : "  if (true) {");
    for (const nestedStatement of statement.defaultBranch) {
      lines.push(`    ${emitStatement(nestedStatement, declaration, context)}`);
    }
    lines.push("  }");
  }

  lines.push("}");
  return lines.join("\n  ");
}

function emitFunctionReturnType(declaration: FunctionDeclaration): string {
  if (isVoidMain(declaration)) {
    return "int";
  }

  return emitType(declaration.returnType);
}

function isVoidMain(declaration: FunctionDeclaration): boolean {
  return (
    declaration.id === "main" &&
    declaration.params.length === 0 &&
    declaration.returnType.type === "NamedType" &&
    declaration.returnType.name === "void"
  );
}

function hasReturnStatement(declaration: FunctionDeclaration): boolean {
  return declaration.body.some((statement) => statement.type === "ReturnStatement");
}

function emitVariableDeclaration(
  statement: VariableDeclaration,
  withSemicolon = true
): string {
  const prefix = statement.kind === "const" ? "const " : "";
  const init = statement.init
    ? ` = ${emitExpressionForExpectedType(statement.init, statement.valueType)}`
    : "";
  const suffix = withSemicolon ? ";" : "";
  return `${prefix}${emitType(statement.valueType)} ${statement.id}${init}${suffix}`;
}

function emitExpression(expression: Expression, expectedType?: TypeNode): string {
  switch (expression.type) {
    case "Identifier":
      return expression.name;
    case "Literal":
      return emitLiteral(expression, expectedType);
    case "BinaryExpression":
      return `${emitExpression(expression.left)} ${expression.operator} ${emitExpression(expression.right)}`;
    case "AssignmentExpression":
      return `${emitExpression(expression.left)} = ${emitExpression(expression.right)}`;
    case "CallExpression":
      if (expression.callee.type === "Identifier" && expression.callee.name === "print") {
        return `std::cout << ${emitExpression(expression.arguments[0]!)} << std::endl`;
      }

      return `${emitExpression(expression.callee)}(${expression.arguments.map((argument) => emitExpression(argument)).join(", ")})`;
    case "MemberExpression":
      return `${emitExpression(expression.object)}.${expression.property}`;
    case "IndexExpression":
      if (expression.accessKind === "tuple") {
        return `std::get<${expression.tupleIndex}>(${emitExpression(expression.object)})`;
      }

      return `${emitExpression(expression.object)}[${emitExpression(expression.index)}]`;
    case "ArrayLiteral":
      return emitArrayLiteral(expression, expectedType);
    case "TupleLiteral":
      return emitTupleLiteral(expression, expectedType);
    case "StructLiteral":
      return emitStructLiteral(expression);
    case "CopyExpression":
      return emitExpression(expression.argument);
    case "CastExpression":
      return `static_cast<${emitType(expression.targetType)}>(${emitExpression(expression.expression)})`;
    default:
      assertNever(expression);
  }
}

function emitTupleLiteral(
  expression: Expression & { type: "TupleLiteral" },
  expectedType?: TypeNode
): string {
  const elements = expression.elements
    .map((element, index) =>
      emitExpression(
        element,
        expectedType?.type === "TupleType" ? expectedType.elements[index] : undefined
      )
    )
    .join(", ");

  if (expectedType?.type === "TupleType") {
    return `${emitType(expectedType)}{${elements}}`;
  }

  return `std::make_tuple(${elements})`;
}

function emitStructLiteral(expression: Expression & { type: "StructLiteral" }): string {
  const fields = expression.fields
    .map((field) => `.${field.id} = ${emitExpression(field.value)}`)
    .join(", ");
  return `${expression.typeName}{${fields}}`;
}

function emitArrayLiteral(
  expression: Expression & { type: "ArrayLiteral" },
  expectedType?: TypeNode
): string {
  const elementType = expectedType?.type === "ArrayType" ? expectedType.elementType : undefined;
  const elements = expression.elements
    .map((element) => emitExpression(element, elementType))
    .join(", ");

  if (expectedType?.type === "ArrayType") {
    return `{${elements}}`;
  }

  return `std::vector{${elements}}`;
}

function emitExpressionForExpectedType(expression: Expression, expectedType: TypeNode): string {
  return emitExpression(expression, expectedType);
}

function emitLiteral(
  expression: Expression & { type: "Literal" },
  expectedType?: TypeNode
): string {
  if (
    expression.literalKind === "number" &&
    expectedType?.type === "NamedType" &&
    expectedType.name === "float" &&
    expression.raw.includes(".") &&
    !/[fF]$/u.test(expression.raw)
  ) {
    return `${expression.raw}f`;
  }

  return expression.raw;
}

function emitType(type: TypeNode): string {
  if (type.type === "TupleType") {
    return `std::tuple<${type.elements.map(emitType).join(", ")}>`;
  }

  if (type.type === "ArrayType") {
    return `std::vector<${emitType(type.elementType)}>`;
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

function moduleUsesPrint(program: Program): boolean {
  return functionDeclarations(program).some((declaration) =>
    declaration.body.some(statementUsesPrint)
  );
}

function statementUsesPrint(statement: Statement): boolean {
  switch (statement.type) {
    case "VariableDeclaration":
      return statement.init ? expressionUsesPrint(statement.init) : false;
    case "ReturnStatement":
      return statement.argument ? expressionUsesPrint(statement.argument) : false;
    case "IfStatement":
      return (
        expressionUsesPrint(statement.condition) ||
        statement.thenBranch.some(statementUsesPrint) ||
        statement.elseBranch.some(statementUsesPrint)
      );
    case "WhileStatement":
      return (
        expressionUsesPrint(statement.condition) ||
        statement.body.some(statementUsesPrint)
      );
    case "ForStatement":
      return (
        (statement.init
          ? statement.init.type === "VariableDeclaration"
            ? statement.init.init
              ? expressionUsesPrint(statement.init.init)
              : false
            : expressionUsesPrint(statement.init)
          : false) ||
        (statement.condition ? expressionUsesPrint(statement.condition) : false) ||
        (statement.increment ? expressionUsesPrint(statement.increment) : false) ||
        statement.body.some(statementUsesPrint)
      );
    case "SwitchStatement":
      return (
        expressionUsesPrint(statement.discriminant) ||
        statement.cases.some(
          (switchCase) =>
            expressionUsesPrint(switchCase.test) ||
            switchCase.body.some(statementUsesPrint)
        ) ||
        statement.defaultBranch.some(statementUsesPrint)
      );
    case "ExpressionStatement":
      return expressionUsesPrint(statement.expression);
    default:
      assertNever(statement);
  }
}

function expressionUsesPrint(expression: Expression): boolean {
  switch (expression.type) {
    case "Identifier":
    case "Literal":
      return false;
    case "BinaryExpression":
      return expressionUsesPrint(expression.left) || expressionUsesPrint(expression.right);
    case "AssignmentExpression":
      return expressionUsesPrint(expression.left) || expressionUsesPrint(expression.right);
    case "CallExpression":
      return (
        (expression.callee.type === "Identifier" && expression.callee.name === "print") ||
        expressionUsesPrint(expression.callee) ||
        expression.arguments.some(expressionUsesPrint)
      );
    case "MemberExpression":
      return expressionUsesPrint(expression.object);
    case "IndexExpression":
      return expressionUsesPrint(expression.object) || expressionUsesPrint(expression.index);
    case "ArrayLiteral":
      return expression.elements.some(expressionUsesPrint);
    case "TupleLiteral":
      return expression.elements.some(expressionUsesPrint);
    case "StructLiteral":
      return expression.fields.some((field) => expressionUsesPrint(field.value));
    case "CopyExpression":
      return expressionUsesPrint(expression.argument);
    case "CastExpression":
      return expressionUsesPrint(expression.expression);
    default:
      assertNever(expression);
  }
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
