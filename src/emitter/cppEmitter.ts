import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import type { DoublemintConfig } from "../core/config.js";
import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type {
  DestructuringDeclaration,
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
  deferCounter: number;
  stringViewVariables: Set<string>;
  nativeFunctions: Map<string, string>;
  nativeMembers: Map<string, string>;
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
    if (module.builtin) {
      continue;
    }

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
    "#include <functional>",
    "#include <optional>",
    "#include <string>",
    "#include <string_view>",
    "#include <tuple>",
    "#include <variant>",
    "#include <vector>",
    ""
  ];

  for (const include of builtinIncludes(module, graph)) {
    if (!lines.includes(`#include ${include}`)) {
      lines.push(`#include ${include}`);
    }
  }

  if (builtinIncludes(module, graph).length > 0) {
    lines.push("");
  }

  for (const importDeclaration of importsOf(module.program).filter(
    (importDeclaration) => !isBuiltinImport(module, importDeclaration)
  )) {
    lines.push(`#include "${headerIncludePath(module, importDeclaration, graph)}"`);
  }

  if (importsOf(module.program).some((importDeclaration) => !isBuiltinImport(module, importDeclaration))) {
    lines.push("");
  }

  const headerDeclarations = builtinHeaderDeclarations(module);
  if (headerDeclarations.length > 0) {
    lines.push(...headerDeclarations);
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

  for (const include of builtinIncludes(module, graph)) {
    if (!lines.includes(`#include ${include}`)) {
      lines.push(`#include ${include}`);
    }
  }

  if (moduleUsesDefer(module.program)) {
    lines.push("#include <utility>");
  }

  for (const declaration of module.program.body) {
    if (declaration.type === "ExternBlockDeclaration") {
      lines.push(`#include ${formatExternInclude(declaration.source)}`);
    }
  }

  if (
    lines.length > 0 &&
    (moduleUsesPrint(module.program) ||
      builtinIncludes(module, graph).length > 0 ||
      module.program.body.some((declaration) => declaration.type === "ExternBlockDeclaration"))
  ) {
    lines.push("");
  }

  lines.push(`#include "${basename(module)}.hpp"`);
  lines.push("");

  if (moduleUsesDefer(module.program)) {
    lines.push(deferHelper());
    lines.push("");
  }

  if (
    module.imports.some(
      (resolvedImport) => resolvedImport.source === "mint:io" && resolvedImport.specifier === "IO"
    )
  ) {
    lines.push(ioHelper());
    lines.push("");
  }

  const sourceHelpers = builtinSourceHelpers(module);
  if (sourceHelpers.length > 0) {
    lines.push(...sourceHelpers);
    lines.push("");
  }

  for (const declaration of functionDeclarations(module.program)) {
    if (declaration.extern) {
      continue;
    }

    lines.push(emitFunctionDefinition(declaration, module));
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

function emitFunctionDefinition(
  declaration: FunctionDeclaration,
  module: ResolvedModule
): string {
  const lines = [`${emitFunctionSignature(declaration)} {`];
  const context: EmitContext = {
    switchCounter: 0,
    deferCounter: 0,
    stringViewVariables: stringViewVariableNames(declaration),
    nativeFunctions: nativeFunctionMap(module),
    nativeMembers: nativeMemberMap(module)
  };

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
  if (type.type === "NamedType" && type.name === "string") {
    return "std::string_view";
  }

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
      return emitVariableDeclaration(statement, true, context);
    case "DestructuringDeclaration":
      return emitDestructuringDeclaration(statement, context);
    case "ReturnStatement":
      if (isVoidMain(declaration) && !statement.argument) {
        return "return 0;";
      }

      return statement.argument
        ? `return ${emitExpressionForExpectedType(statement.argument, declaration.returnType, context)};`
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
      return `${emitExpression(statement.expression, undefined, context)};`;
    case "DeferStatement":
      return emitDeferStatement(statement, context);
    default:
      assertNever(statement);
  }
}

function emitIfStatement(
  statement: Statement & { type: "IfStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const lines = [`if (${emitExpression(statement.condition, undefined, context)}) {`];

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
  const lines = [`while (${emitExpression(statement.condition, undefined, context)}) {`];

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
      ? emitVariableDeclaration(statement.init, false, context)
      : statement.init
        ? emitExpression(statement.init, undefined, context)
        : "";
  const condition = statement.condition ? emitExpression(statement.condition, undefined, context) : "";
  const increment = statement.increment ? emitExpression(statement.increment, undefined, context) : "";
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
  const lines = ["{", `  const auto ${tempName} = ${emitExpression(statement.discriminant, undefined, context)};`];

  for (let index = 0; index < statement.cases.length; index += 1) {
    const switchCase = statement.cases[index]!;
    const prefix = index === 0 ? "if" : "else if";
    lines.push(`  ${prefix} (${tempName} == ${emitExpression(switchCase.test, undefined, context)}) {`);

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

function emitDeferStatement(
  statement: Statement & { type: "DeferStatement" },
  context: EmitContext
): string {
  const name = `__dlm_defer_${context.deferCounter}`;
  context.deferCounter += 1;
  return `auto ${name} = __dlm_make_defer([&]() { ${emitExpression(statement.expression, undefined, context)}; });`;
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

function stringViewVariableNames(declaration: FunctionDeclaration): Set<string> {
  const mutatedNames = new Set<string>();
  const stringViewNames = new Set<string>();

  for (const statement of declaration.body) {
    collectAssignedRoots(statement, mutatedNames);
  }

  for (const statement of declaration.body) {
    collectStringViewDeclarations(statement, mutatedNames, stringViewNames);
  }

  return stringViewNames;
}

function collectStringViewDeclarations(
  statement: Statement,
  mutatedNames: Set<string>,
  stringViewNames: Set<string>
): void {
  switch (statement.type) {
    case "VariableDeclaration":
      if (
        statement.valueType.type === "NamedType" &&
        statement.valueType.name === "string" &&
        statement.init?.type === "Literal" &&
        statement.init.literalKind === "string" &&
        !mutatedNames.has(statement.id)
      ) {
        stringViewNames.add(statement.id);
      }
      break;
    case "DestructuringDeclaration":
    case "ReturnStatement":
    case "ExpressionStatement":
    case "DeferStatement":
      break;
    case "IfStatement":
      statement.thenBranch.forEach((nested) =>
        collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
      );
      statement.elseBranch.forEach((nested) =>
        collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
      );
      break;
    case "WhileStatement":
      statement.body.forEach((nested) =>
        collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
      );
      break;
    case "ForStatement":
      if (statement.init?.type === "VariableDeclaration") {
        collectStringViewDeclarations(statement.init, mutatedNames, stringViewNames);
      }
      statement.body.forEach((nested) =>
        collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
      );
      break;
    case "SwitchStatement":
      statement.cases.forEach((switchCase) =>
        switchCase.body.forEach((nested) =>
          collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
        )
      );
      statement.defaultBranch.forEach((nested) =>
        collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
      );
      break;
    default:
      assertNever(statement);
  }
}

function collectAssignedRoots(statement: Statement, roots: Set<string>): void {
  switch (statement.type) {
    case "VariableDeclaration":
      if (statement.init) {
        collectAssignedRootsFromExpression(statement.init, roots);
      }
      break;
    case "DestructuringDeclaration":
      collectAssignedRootsFromExpression(statement.init, roots);
      break;
    case "ReturnStatement":
      if (statement.argument) {
        collectAssignedRootsFromExpression(statement.argument, roots);
      }
      break;
    case "IfStatement":
      collectAssignedRootsFromExpression(statement.condition, roots);
      statement.thenBranch.forEach((nested) => collectAssignedRoots(nested, roots));
      statement.elseBranch.forEach((nested) => collectAssignedRoots(nested, roots));
      break;
    case "WhileStatement":
      collectAssignedRootsFromExpression(statement.condition, roots);
      statement.body.forEach((nested) => collectAssignedRoots(nested, roots));
      break;
    case "ForStatement":
      if (statement.init) {
        if (statement.init.type === "VariableDeclaration") {
          collectAssignedRoots(statement.init, roots);
        } else {
          collectAssignedRootsFromExpression(statement.init, roots);
        }
      }
      if (statement.condition) {
        collectAssignedRootsFromExpression(statement.condition, roots);
      }
      if (statement.increment) {
        collectAssignedRootsFromExpression(statement.increment, roots);
      }
      statement.body.forEach((nested) => collectAssignedRoots(nested, roots));
      break;
    case "SwitchStatement":
      collectAssignedRootsFromExpression(statement.discriminant, roots);
      statement.cases.forEach((switchCase) => {
        collectAssignedRootsFromExpression(switchCase.test, roots);
        switchCase.body.forEach((nested) => collectAssignedRoots(nested, roots));
      });
      statement.defaultBranch.forEach((nested) => collectAssignedRoots(nested, roots));
      break;
    case "ExpressionStatement":
      collectAssignedRootsFromExpression(statement.expression, roots);
      break;
    case "DeferStatement":
      collectAssignedRootsFromExpression(statement.expression, roots);
      break;
    default:
      assertNever(statement);
  }
}

function collectAssignedRootsFromExpression(expression: Expression, roots: Set<string>): void {
  switch (expression.type) {
    case "Identifier":
    case "Literal":
      break;
    case "AssignmentExpression": {
      const root = assignmentRootName(expression.left);
      if (root) {
        roots.add(root);
      }
      collectAssignedRootsFromExpression(expression.right, roots);
      break;
    }
    case "BinaryExpression":
      collectAssignedRootsFromExpression(expression.left, roots);
      collectAssignedRootsFromExpression(expression.right, roots);
      break;
    case "CallExpression":
      collectAssignedRootsFromExpression(expression.callee, roots);
      expression.arguments.forEach((argument) =>
        collectAssignedRootsFromExpression(argument, roots)
      );
      break;
    case "MemberExpression":
      collectAssignedRootsFromExpression(expression.object, roots);
      break;
    case "IndexExpression":
      collectAssignedRootsFromExpression(expression.object, roots);
      collectAssignedRootsFromExpression(expression.index, roots);
      break;
    case "ArrayLiteral":
    case "TupleLiteral":
      expression.elements.forEach((element) =>
        collectAssignedRootsFromExpression(element, roots)
      );
      break;
    case "StructLiteral":
      expression.fields.forEach((field) =>
        collectAssignedRootsFromExpression(field.value, roots)
      );
      break;
    case "LambdaExpression":
      collectAssignedRootsFromExpression(expression.body, roots);
      break;
    case "CopyExpression":
      collectAssignedRootsFromExpression(expression.argument, roots);
      break;
    case "CastExpression":
      collectAssignedRootsFromExpression(expression.expression, roots);
      break;
    case "NewExpression":
      for (const argument of expression.arguments) {
        collectAssignedRootsFromExpression(argument, roots);
      }
      break;
    default:
      assertNever(expression);
  }
}

function assignmentRootName(expression: Expression): string | null {
  if (expression.type === "Identifier") {
    return expression.name;
  }

  if (expression.type === "MemberExpression") {
    return assignmentRootName(expression.object);
  }

  if (expression.type === "IndexExpression") {
    return assignmentRootName(expression.object);
  }

  return null;
}

function emitVariableDeclaration(
  statement: VariableDeclaration,
  withSemicolon = true,
  context?: EmitContext
): string {
  const prefix = statement.kind === "const" ? "const " : "";
  const init = statement.init
    ? ` = ${emitExpressionForExpectedType(statement.init, statement.valueType, context)}`
    : "";
  const suffix = withSemicolon ? ";" : "";
  return `${prefix}${emitVariableType(statement, context)} ${statement.id}${init}${suffix}`;
}

function emitDestructuringDeclaration(
  statement: DestructuringDeclaration,
  context?: EmitContext
): string {
  const prefix = statement.kind === "const" ? "const " : "";
  return `${prefix}auto [${statement.ids.join(", ")}] = ${emitExpression(statement.init, undefined, context)};`;
}

function emitVariableType(statement: VariableDeclaration, context?: EmitContext): string {
  if (
    context?.stringViewVariables.has(statement.id) &&
    statement.valueType.type === "NamedType" &&
    statement.valueType.name === "string"
  ) {
    return "std::string_view";
  }

  return emitType(statement.valueType);
}

function emitExpression(
  expression: Expression,
  expectedType?: TypeNode,
  context?: EmitContext
): string {
  switch (expression.type) {
    case "Identifier":
      return expression.name;
    case "Literal":
      return emitLiteral(expression, expectedType);
    case "BinaryExpression":
      return `${emitExpression(expression.left, undefined, context)} ${expression.operator} ${emitExpression(expression.right, undefined, context)}`;
    case "AssignmentExpression":
      return `${emitExpression(expression.left, undefined, context)} = ${emitExpression(expression.right, undefined, context)}`;
    case "CallExpression":
      if (
        expression.callee.type === "Identifier" &&
        (expression.callee.name === "print" || expression.callee.name === "println")
      ) {
        return emitPrintCall(expression.callee.name, expression.arguments, context);
      }

      if (expression.callee.type === "Identifier") {
        const callee = context?.nativeFunctions.get(expression.callee.name) ?? expression.callee.name;
        return `${callee}(${expression.arguments.map((argument) => emitExpression(argument, undefined, context)).join(", ")})`;
      }

      return `${emitExpression(expression.callee, undefined, context)}(${expression.arguments.map((argument) => emitExpression(argument, undefined, context)).join(", ")})`;
    case "MemberExpression":
      if (expression.object.type === "Identifier") {
        const nativeMember = context?.nativeMembers.get(
          `${expression.object.name}.${expression.property}`
        );
        if (nativeMember) {
          return nativeMember;
        }
      }

      return `${emitExpression(expression.object, undefined, context)}.${expression.property}`;
    case "IndexExpression":
      if (expression.accessKind === "tuple") {
        return `std::get<${expression.tupleIndex}>(${emitExpression(expression.object, undefined, context)})`;
      }

      return `${emitExpression(expression.object, undefined, context)}[${emitExpression(expression.index, undefined, context)}]`;
    case "ArrayLiteral":
      return emitArrayLiteral(expression, expectedType, context);
    case "TupleLiteral":
      return emitTupleLiteral(expression, expectedType, context);
    case "StructLiteral":
      return emitStructLiteral(expression, context);
    case "LambdaExpression":
      return emitLambdaExpression(expression, context);
    case "CopyExpression":
      return emitExpression(expression.argument, undefined, context);
    case "CastExpression":
      return `static_cast<${emitType(expression.targetType)}>(${emitExpression(expression.expression, undefined, context)})`;
    case "NewExpression":
      return `${emitType(expression.targetType)}(${expression.arguments
        .map((argument) => emitExpression(argument, undefined, context))
        .join(", ")})`;
    default:
      assertNever(expression);
  }
}

function emitLambdaExpression(
  expression: Expression & { type: "LambdaExpression" },
  context?: EmitContext
): string {
  const params = expression.params
    .map((param) => `${emitParameterType(param.valueType)} ${param.id}`)
    .join(", ");
  return `[=](${params}) -> ${emitType(expression.returnType)} { return ${emitExpressionForExpectedType(
    expression.body,
    expression.returnType,
    context
  )}; }`;
}

function emitTupleLiteral(
  expression: Expression & { type: "TupleLiteral" },
  expectedType?: TypeNode,
  context?: EmitContext
): string {
  const elements = expression.elements
    .map((element, index) =>
      emitExpression(
        element,
        expectedType?.type === "TupleType" ? expectedType.elements[index] : undefined,
        context
      )
    )
    .join(", ");

  if (expectedType?.type === "TupleType") {
    return `${emitType(expectedType)}{${elements}}`;
  }

  return `std::make_tuple(${elements})`;
}

function emitStructLiteral(
  expression: Expression & { type: "StructLiteral" },
  context?: EmitContext
): string {
  const fields = expression.fields
    .map((field) => `.${field.id} = ${emitExpression(field.value, undefined, context)}`)
    .join(", ");
  return `${expression.typeName}{${fields}}`;
}

function emitArrayLiteral(
  expression: Expression & { type: "ArrayLiteral" },
  expectedType?: TypeNode,
  context?: EmitContext
): string {
  const elementType = expectedType?.type === "ArrayType" ? expectedType.elementType : undefined;
  const elements = expression.elements
    .map((element) => emitExpression(element, elementType, context))
    .join(", ");

  if (expectedType?.type === "ArrayType") {
    return `{${elements}}`;
  }

  return `std::vector{${elements}}`;
}

function emitExpressionForExpectedType(
  expression: Expression,
  expectedType: TypeNode,
  context?: EmitContext
): string {
  if (
    expectedType.type === "NamedType" &&
    expectedType.name === "string" &&
    !(expression.type === "Literal" && expression.literalKind === "string")
  ) {
    return `std::string(${emitExpression(expression, expectedType, context)})`;
  }

  return emitExpression(expression, expectedType, context);
}

function emitLiteral(
  expression: Expression & { type: "Literal" },
  expectedType?: TypeNode
): string {
  if (expression.literalKind === "null") {
    if (expectedType?.type === "OptionalType") {
      return "std::nullopt";
    }

    return "nullptr";
  }

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

  if (type.type === "GenericType") {
    return `${type.name}<${type.typeArgs.map(emitType).join(", ")}>`;
  }

  if (type.type === "FunctionType") {
    return `std::function<${emitType(type.returnType)}(${type.params.map(emitParameterType).join(", ")})>`;
  }

  if (type.type === "PointerType") {
    return `${emitType(type.pointee)}*`;
  }

  if (type.type === "ReferenceType") {
    return `${emitType(type.referent)}&`;
  }

  if (type.type === "ConstType") {
    return `const ${emitType(type.valueType)}`;
  }

  if (type.type === "OptionalType") {
    return `std::optional<${emitType(type.valueType)}>`;
  }

  if (type.type === "UnionType") {
    return `std::variant<${type.options.map(emitType).join(", ")}>`;
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
      declarations.push(
        ...declaration.declarations.filter(
          (externDeclaration): externDeclaration is FunctionDeclaration =>
            externDeclaration.type === "FunctionDeclaration"
        )
      );
    }
  }

  return declarations;
}

function moduleUsesDefer(program: Program): boolean {
  return functionDeclarations(program).some((declaration) =>
    declaration.body.some(statementUsesDefer)
  );
}

function statementUsesDefer(statement: Statement): boolean {
  switch (statement.type) {
    case "DeferStatement":
      return true;
    case "IfStatement":
      return (
        statement.thenBranch.some(statementUsesDefer) ||
        statement.elseBranch.some(statementUsesDefer)
      );
    case "WhileStatement":
      return statement.body.some(statementUsesDefer);
    case "ForStatement":
      return statement.body.some(statementUsesDefer);
    case "SwitchStatement":
      return (
        statement.cases.some((switchCase) => switchCase.body.some(statementUsesDefer)) ||
        statement.defaultBranch.some(statementUsesDefer)
      );
    case "VariableDeclaration":
    case "DestructuringDeclaration":
    case "ReturnStatement":
    case "ExpressionStatement":
      return false;
    default:
      assertNever(statement);
  }
}

function deferHelper(): string {
  return [
    "template <typename F>",
    "struct __dlm_defer_guard {",
    "  F fn;",
    "  ~__dlm_defer_guard() { fn(); }",
    "};",
    "",
    "template <typename F>",
    "__dlm_defer_guard<F> __dlm_make_defer(F fn) {",
    "  return __dlm_defer_guard<F>{std::move(fn)};",
    "}"
  ].join("\n");
}

function nativeFunctionMap(module: ResolvedModule): Map<string, string> {
  const names = new Map<string, string>();

  for (const declaration of module.program.body) {
    if (declaration.type !== "ExternBlockDeclaration") {
      continue;
    }

    for (const externDeclaration of declaration.declarations) {
      if (
        externDeclaration.type === "FunctionDeclaration" &&
        externDeclaration.nativeName
      ) {
        names.set(externDeclaration.id, externDeclaration.nativeName);
      }
    }
  }

  for (const resolvedImport of module.imports) {
    if (resolvedImport.export.builtin && resolvedImport.export.nativeName) {
      names.set(resolvedImport.specifier, resolvedImport.export.nativeName);
    }
  }

  return names;
}

function nativeMemberMap(module: ResolvedModule): Map<string, string> {
  const names = new Map<string, string>();

  for (const resolvedImport of module.imports) {
    const moduleExport = resolvedImport.export;
    if (!moduleExport.builtin || !moduleExport.namespaceMembers) {
      continue;
    }

    for (const member of moduleExport.namespaceMembers.values()) {
      names.set(`${resolvedImport.specifier}.${member.name}`, member.nativeName);
    }
  }

  return names;
}

function emitPrintCall(name: string, args: Expression[], context?: EmitContext): string {
  const parts = args.map((argument) => {
    const emitted = emitExpression(argument, undefined, context);
    return argument.type === "BinaryExpression" ? `(${emitted})` : emitted;
  });
  const output = parts.length > 0 ? `std::cout << ${parts.join(" << ")}` : "std::cout";
  return name === "println" || name === "print" ? `${output} << std::endl` : output;
}

function ioHelper(): string {
  return [
    "[[maybe_unused]] static std::string __doublemint_read_line(std::string_view prompt) {",
    "  std::cout << prompt;",
    "  std::string line;",
    "  std::getline(std::cin, line);",
    "  return line;",
    "}"
  ].join("\n");
}

function builtinHeaderDeclarations(module: ResolvedModule): string[] {
  const declarations: string[] = [];

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:collections")) {
    declarations.push(collectionsHeader());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:regex")) {
    declarations.push(regexHeader());
  }

  return declarations;
}

function builtinSourceHelpers(module: ResolvedModule): string[] {
  const helpers: string[] = [];

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:fs")) {
    helpers.push(fsHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:time")) {
    helpers.push(timeHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:os")) {
    helpers.push(osHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:json")) {
    helpers.push(jsonHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:log")) {
    helpers.push(logHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:crypto")) {
    helpers.push(cryptoHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:net")) {
    helpers.push(netHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:async")) {
    helpers.push(asyncHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:memory")) {
    helpers.push(memoryHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:simd")) {
    helpers.push(simdHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:db")) {
    helpers.push(dbHelper());
  }

  if (module.imports.some((resolvedImport) => resolvedImport.source === "mint:ui")) {
    helpers.push(uiHelper());
  }

  return helpers;
}

function collectionsHeader(): string {
  return [
    "template <typename T>",
    "class Queue {",
    "  std::queue<T> data_;",
    "public:",
    "  void push(T value) { data_.push(value); }",
    "  T pop() { if (data_.empty()) { throw std::runtime_error(\"Queue is empty\"); } T value = data_.front(); data_.pop(); return value; }",
    "  bool empty() const { return data_.empty(); }",
    "  int size() const { return static_cast<int>(data_.size()); }",
    "};",
    "",
    "template <typename T>",
    "class Set {",
    "  std::unordered_set<T> data_;",
    "public:",
    "  void add(T value) { data_.insert(value); }",
    "  bool has(T value) const { return data_.find(value) != data_.end(); }",
    "  int size() const { return static_cast<int>(data_.size()); }",
    "};",
    "",
    "template <typename T>",
    "class Stack {",
    "  std::stack<T> data_;",
    "public:",
    "  void push(T value) { data_.push(value); }",
    "  T pop() { if (data_.empty()) { throw std::runtime_error(\"Stack is empty\"); } T value = data_.top(); data_.pop(); return value; }",
    "  bool empty() const { return data_.empty(); }",
    "  int size() const { return static_cast<int>(data_.size()); }",
    "};"
  ].join("\n");
}

function regexHeader(): string {
  return [
    "class Regex {",
    "  std::regex pattern_;",
    "public:",
    "  explicit Regex(std::string_view pattern) : pattern_(std::string(pattern)) {}",
    "  bool test(std::string_view value) const { return std::regex_match(std::string(value), pattern_); }",
    "  std::string replace(std::string_view value, std::string_view replacement) const { return std::regex_replace(std::string(value), pattern_, std::string(replacement)); }",
    "};"
  ].join("\n");
}

function fsHelper(): string {
  return [
    "[[maybe_unused]] static std::string __doublemint_file_read_to_string(const std::string& path) {",
    "  std::ifstream input(path, std::ios::binary);",
    "  return std::string(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());",
    "}",
    "",
    "[[maybe_unused]] static std::vector<int> __doublemint_file_read_to_bytes(const std::string& path) {",
    "  std::ifstream input(path, std::ios::binary);",
    "  std::vector<int> bytes;",
    "  char byte;",
    "  while (input.get(byte)) { bytes.push_back(static_cast<unsigned char>(byte)); }",
    "  return bytes;",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_file_write_string(const std::string& path, const std::string& content) {",
    "  std::ofstream output(path, std::ios::binary | std::ios::trunc);",
    "  output << content;",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_file_append_string(const std::string& path, const std::string& content) {",
    "  std::ofstream output(path, std::ios::binary | std::ios::app);",
    "  output << content;",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_path_join(const std::string& left, const std::string& right) {",
    "  return (std::filesystem::path(left) / std::filesystem::path(right)).string();",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_path_basename(const std::string& path) {",
    "  return std::filesystem::path(path).filename().string();",
    "}"
  ].join("\n");
}

function timeHelper(): string {
  return [
    "[[maybe_unused]] static std::unordered_map<std::string, std::chrono::high_resolution_clock::time_point> __doublemint_profiler_marks;",
    "",
    "[[maybe_unused]] static int __doublemint_now_ms() {",
    "  auto now = std::chrono::time_point_cast<std::chrono::milliseconds>(std::chrono::system_clock::now());",
    "  return static_cast<int>(now.time_since_epoch().count());",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_profiler_start(const std::string& name) {",
    "  __doublemint_profiler_marks[name] = std::chrono::high_resolution_clock::now();",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_profiler_stop(const std::string& name) {",
    "  auto end = std::chrono::high_resolution_clock::now();",
    "  auto start = __doublemint_profiler_marks[name];",
    "  return static_cast<int>(std::chrono::duration_cast<std::chrono::microseconds>(end - start).count());",
    "}"
  ].join("\n");
}

function osHelper(): string {
  return [
    "[[maybe_unused]] static bool __doublemint_os_is_linux() {",
    "#ifdef __linux__",
    "  return true;",
    "#else",
    "  return false;",
    "#endif",
    "}",
    "",
    "[[maybe_unused]] static bool __doublemint_os_is_windows() {",
    "#ifdef _WIN32",
    "  return true;",
    "#else",
    "  return false;",
    "#endif",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_env_get(const std::string& key, const std::string& fallback) {",
    "  const char* value = std::getenv(key.c_str());",
    "  return value == nullptr ? fallback : std::string(value);",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_os_execute(const std::string& command) {",
    "#ifdef _WIN32",
    "  FILE* pipe = _popen(command.c_str(), \"r\");",
    "#else",
    "  FILE* pipe = popen(command.c_str(), \"r\");",
    "#endif",
    "  if (pipe == nullptr) { return \"\"; }",
    "  std::array<char, 256> buffer{};",
    "  std::string result;",
    "  while (fgets(buffer.data(), static_cast<int>(buffer.size()), pipe) != nullptr) { result += buffer.data(); }",
    "#ifdef _WIN32",
    "  _pclose(pipe);",
    "#else",
    "  pclose(pipe);",
    "#endif",
    "  return result;",
    "}"
  ].join("\n");
}

function jsonHelper(): string {
  return [
    "[[maybe_unused]] static std::string __doublemint_json_stringify(std::string_view value) {",
    "  std::ostringstream out;",
    "  out << '\"';",
    "  for (char ch : value) {",
    "    switch (ch) {",
    "      case '\"': out << \"\\\\\\\"\"; break;",
    "      case '\\\\': out << \"\\\\\\\\\"; break;",
    "      case '\\n': out << \"\\\\n\"; break;",
    "      case '\\r': out << \"\\\\r\"; break;",
    "      case '\\t': out << \"\\\\t\"; break;",
    "      default: out << ch; break;",
    "    }",
    "  }",
    "  out << '\"';",
    "  return out.str();",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_json_stringify_int(int value) {",
    "  return std::to_string(value);",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_json_stringify_bool(bool value) {",
    "  return value ? std::string(\"true\") : std::string(\"false\");",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_json_parse_int(std::string_view value) {",
    "  try { return std::stoi(std::string(value)); } catch (...) { return 0; }",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_json_parse_string(std::string_view value) {",
    "  if (value.size() < 2 || value.front() != '\"' || value.back() != '\"') { return std::string(value); }",
    "  std::string out;",
    "  out.reserve(value.size());",
    "  for (std::size_t index = 1; index + 1 < value.size(); ++index) {",
    "    char ch = value[index];",
    "    if (ch == '\\\\' && index + 2 < value.size()) {",
    "      char next = value[index + 1];",
    "      switch (next) {",
    "        case 'n': out += '\\n'; ++index; continue;",
    "        case 'r': out += '\\r'; ++index; continue;",
    "        case 't': out += '\\t'; ++index; continue;",
    "        case '\"': out += '\"'; ++index; continue;",
    "        case '\\\\': out += '\\\\'; ++index; continue;",
    "        default: break;",
    "      }",
    "    }",
    "    out += ch;",
    "  }",
    "  return out;",
    "}"
  ].join("\n");
}

function logHelper(): string {
  return [
    "[[maybe_unused]] static void __doublemint_log_emit(const char* level, std::string_view message) {",
    "  std::cout << '[' << level << \"] \" << message << std::endl;",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_log_info(std::string_view message) { __doublemint_log_emit(\"INFO\", message); }",
    "[[maybe_unused]] static void __doublemint_log_warn(std::string_view message) { __doublemint_log_emit(\"WARN\", message); }",
    "[[maybe_unused]] static void __doublemint_log_error(std::string_view message) { __doublemint_log_emit(\"ERROR\", message); }",
    "[[maybe_unused]] static void __doublemint_log_debug(std::string_view message) { __doublemint_log_emit(\"DEBUG\", message); }"
  ].join("\n");
}

function cryptoHelper(): string {
  return [
    "[[maybe_unused]] static int __doublemint_crypto_fnv1a(std::string_view value) {",
    "  std::uint32_t hash = 2166136261u;",
    "  for (unsigned char byte : value) {",
    "    hash ^= byte;",
    "    hash *= 16777619u;",
    "  }",
    "  return static_cast<int>(hash & 0x7fffffffu);",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_crypto_xor(std::string_view value, std::string_view key) {",
    "  if (key.empty()) { return std::string(value); }",
    "  std::string out(value.size(), '\\0');",
    "  for (std::size_t index = 0; index < value.size(); ++index) {",
    "    out[index] = static_cast<char>(value[index] ^ key[index % key.size()]);",
    "  }",
    "  return out;",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_crypto_to_hex(int value) {",
    "  std::ostringstream out;",
    "  out << std::hex << std::nouppercase << static_cast<std::uint32_t>(value);",
    "  return out.str();",
    "}"
  ].join("\n");
}

function netHelper(): string {
  return [
    "[[maybe_unused]] static std::string __doublemint_url_scheme(std::string_view url) {",
    "  auto position = url.find(\"://\");",
    "  return position == std::string_view::npos ? std::string() : std::string(url.substr(0, position));",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_url_host(std::string_view url) {",
    "  auto schemeEnd = url.find(\"://\");",
    "  std::size_t start = schemeEnd == std::string_view::npos ? 0 : schemeEnd + 3;",
    "  auto pathStart = url.find('/', start);",
    "  return std::string(url.substr(start, pathStart == std::string_view::npos ? std::string_view::npos : pathStart - start));",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_url_path(std::string_view url) {",
    "  auto schemeEnd = url.find(\"://\");",
    "  std::size_t start = schemeEnd == std::string_view::npos ? 0 : schemeEnd + 3;",
    "  auto pathStart = url.find('/', start);",
    "  return pathStart == std::string_view::npos ? std::string(\"/\") : std::string(url.substr(pathStart));",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_url_encode(std::string_view value) {",
    "  std::ostringstream out;",
    "  out << std::hex << std::uppercase;",
    "  for (unsigned char ch : value) {",
    "    bool safe = (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch == '-' || ch == '_' || ch == '.' || ch == '~';",
    "    if (safe) {",
    "      out << static_cast<char>(ch);",
    "    } else {",
    "      out << '%';",
    "      if (ch < 16) { out << '0'; }",
    "      out << static_cast<int>(ch);",
    "    }",
    "  }",
    "  return out.str();",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_http_build_get(std::string_view path, std::string_view host) {",
    "  std::ostringstream out;",
    "  out << \"GET \" << (path.empty() ? std::string_view(\"/\") : path) << \" HTTP/1.1\\r\\n\";",
    "  out << \"Host: \" << host << \"\\r\\n\";",
    "  out << \"Connection: close\\r\\n\\r\\n\";",
    "  return out.str();",
    "}"
  ].join("\n");
}

function asyncHelper(): string {
  return [
    "[[maybe_unused]] static void __doublemint_async_sleep_ms(int milliseconds) {",
    "  if (milliseconds <= 0) { return; }",
    "  std::this_thread::sleep_for(std::chrono::milliseconds(milliseconds));",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_async_parallel_sum(const std::vector<int>& values) {",
    "  if (values.empty()) { return 0; }",
    "  unsigned int threads = std::thread::hardware_concurrency();",
    "  if (threads < 2 || values.size() < threads * 4) {",
    "    return std::accumulate(values.begin(), values.end(), 0);",
    "  }",
    "  std::vector<std::thread> workers;",
    "  std::vector<int> partials(threads, 0);",
    "  std::size_t chunk = values.size() / threads;",
    "  for (unsigned int index = 0; index < threads; ++index) {",
    "    std::size_t begin = index * chunk;",
    "    std::size_t end = (index + 1 == threads) ? values.size() : begin + chunk;",
    "    workers.emplace_back([&, begin, end, index]() {",
    "      partials[index] = std::accumulate(values.begin() + static_cast<std::ptrdiff_t>(begin), values.begin() + static_cast<std::ptrdiff_t>(end), 0);",
    "    });",
    "  }",
    "  for (auto& worker : workers) { worker.join(); }",
    "  return std::accumulate(partials.begin(), partials.end(), 0);",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_async_hardware_threads() {",
    "  unsigned int threads = std::thread::hardware_concurrency();",
    "  return static_cast<int>(threads == 0 ? 1u : threads);",
    "}"
  ].join("\n");
}

function memoryHelper(): string {
  return [
    "[[maybe_unused]] static std::atomic<std::int64_t> __doublemint_memory_bytes{0};",
    "[[maybe_unused]] static std::atomic<std::int64_t> __doublemint_memory_peak{0};",
    "",
    "[[maybe_unused]] static void __doublemint_memory_record_alloc(int bytes) {",
    "  if (bytes <= 0) { return; }",
    "  std::int64_t current = __doublemint_memory_bytes.fetch_add(bytes) + bytes;",
    "  std::int64_t peak = __doublemint_memory_peak.load();",
    "  while (current > peak && !__doublemint_memory_peak.compare_exchange_weak(peak, current)) {}",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_memory_record_free(int bytes) {",
    "  if (bytes <= 0) { return; }",
    "  __doublemint_memory_bytes.fetch_sub(bytes);",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_memory_bytes_used() {",
    "  return static_cast<int>(__doublemint_memory_bytes.load());",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_memory_peak_bytes() {",
    "  return static_cast<int>(__doublemint_memory_peak.load());",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_memory_reset() {",
    "  __doublemint_memory_bytes.store(0);",
    "  __doublemint_memory_peak.store(0);",
    "}"
  ].join("\n");
}

function simdHelper(): string {
  return [
    "[[maybe_unused]] static std::vector<int> __doublemint_simd_add(const std::vector<int>& left, const std::vector<int>& right) {",
    "  std::size_t length = std::min(left.size(), right.size());",
    "  std::vector<int> out(length, 0);",
    "  for (std::size_t index = 0; index < length; ++index) {",
    "    out[index] = left[index] + right[index];",
    "  }",
    "  return out;",
    "}",
    "",
    "[[maybe_unused]] static std::vector<int> __doublemint_simd_scale(const std::vector<int>& values, int factor) {",
    "  std::vector<int> out(values.size(), 0);",
    "  for (std::size_t index = 0; index < values.size(); ++index) {",
    "    out[index] = values[index] * factor;",
    "  }",
    "  return out;",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_simd_dot(const std::vector<int>& left, const std::vector<int>& right) {",
    "  std::size_t length = std::min(left.size(), right.size());",
    "  int total = 0;",
    "  for (std::size_t index = 0; index < length; ++index) {",
    "    total += left[index] * right[index];",
    "  }",
    "  return total;",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_simd_sum(const std::vector<int>& values) {",
    "  return std::accumulate(values.begin(), values.end(), 0);",
    "}"
  ].join("\n");
}

function dbHelper(): string {
  return [
    "[[maybe_unused]] static std::unordered_map<std::string, std::string>& __doublemint_kv_store() {",
    "  static std::unordered_map<std::string, std::string> store;",
    "  return store;",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_kv_set(std::string_view key, std::string_view value) {",
    "  __doublemint_kv_store()[std::string(key)] = std::string(value);",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_kv_get(std::string_view key, std::string_view fallback) {",
    "  const auto& store = __doublemint_kv_store();",
    "  auto entry = store.find(std::string(key));",
    "  return entry == store.end() ? std::string(fallback) : entry->second;",
    "}",
    "",
    "[[maybe_unused]] static bool __doublemint_kv_has(std::string_view key) {",
    "  const auto& store = __doublemint_kv_store();",
    "  return store.find(std::string(key)) != store.end();",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_kv_remove(std::string_view key) {",
    "  __doublemint_kv_store().erase(std::string(key));",
    "}",
    "",
    "[[maybe_unused]] static int __doublemint_kv_size() {",
    "  return static_cast<int>(__doublemint_kv_store().size());",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_kv_clear() {",
    "  __doublemint_kv_store().clear();",
    "}"
  ].join("\n");
}

function uiHelper(): string {
  return [
    "[[maybe_unused]] static void __doublemint_term_clear() {",
    "  std::cout << \"\\x1b[2J\\x1b[H\";",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_term_move_cursor(int row, int column) {",
    "  std::cout << \"\\x1b[\" << row << ';' << column << 'H';",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_term_set_color(int code) {",
    "  std::cout << \"\\x1b[\" << code << 'm';",
    "}",
    "",
    "[[maybe_unused]] static void __doublemint_term_reset_color() {",
    "  std::cout << \"\\x1b[0m\";",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_term_bold(std::string_view value) {",
    "  std::ostringstream out;",
    "  out << \"\\x1b[1m\" << value << \"\\x1b[0m\";",
    "  return out.str();",
    "}",
    "",
    "[[maybe_unused]] static std::string __doublemint_term_colorize(std::string_view value, int code) {",
    "  std::ostringstream out;",
    "  out << \"\\x1b[\" << code << 'm' << value << \"\\x1b[0m\";",
    "  return out.str();",
    "}"
  ].join("\n");
}

function formatExternInclude(source: string): string {
  if (source.startsWith("<") && source.endsWith(">")) {
    return source;
  }

  if (source.startsWith(".") || source.includes("/") || source.includes("\\")) {
    return `"${source}"`;
  }

  return `<${source}>`;
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
    case "DestructuringDeclaration":
      return expressionUsesPrint(statement.init);
    case "DeferStatement":
      return expressionUsesPrint(statement.expression);
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
        (expression.callee.type === "Identifier" &&
          (expression.callee.name === "print" || expression.callee.name === "println")) ||
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
    case "LambdaExpression":
      return expressionUsesPrint(expression.body);
    case "CopyExpression":
      return expressionUsesPrint(expression.argument);
    case "CastExpression":
      return expressionUsesPrint(expression.expression);
    case "NewExpression":
      return expression.arguments.some(expressionUsesPrint);
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

function isBuiltinImport(
  module: ResolvedModule,
  importDeclaration: ImportDeclaration
): boolean {
  return module.imports.some(
    (candidate) => candidate.source === importDeclaration.source && candidate.export.builtin
  );
}

function builtinIncludes(module: ResolvedModule, graph: ModuleGraph): string[] {
  const includes = new Set<string>();

  for (const resolvedImport of module.imports) {
    const importedModule = graph.modules.get(resolvedImport.resolvedFilepath);
    for (const include of importedModule?.builtinIncludes ?? []) {
      includes.add(include);
    }
  }

  return [...includes];
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
