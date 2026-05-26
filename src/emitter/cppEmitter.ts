import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
import { RUNTIME_HEADERS, RUNTIME_SOURCES } from "../runtime/embedded.js";

export interface CppArtifact {
  filepath: string;
  content: string;
}

export interface EmitResult {
  artifacts: CppArtifact[];
  linkLibraries: string[];
  nativeSources: string[];
  includeDirs: string[];
  defines: string[];
  compileFlags: string[];
}

interface EmitContext {
  switchCounter: number;
  deferCounter: number;
  stringViewVariables: Set<string>;
  nativeFunctions: Map<string, string>;
  nativeMembers: Map<string, string>;
  enumNames: Set<string>;
  usesTemplateLiteral?: boolean;
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
  const linkLibraries = new Set<string>();
  const nativeSources = new Set<string>();
  const includeDirs = new Set<string>();
  const defines = new Set<string>();
  const compileFlags = new Set<string>();
  const platform = process.platform;
  const vendorRoot = resolveVendorRoot();

  for (const module of graph.modules.values()) {
    const libs = module.builtinLinkLibraries?.[platform];
    if (libs) {
      for (const lib of libs) {
        linkLibraries.add(lib);
      }
    }

    const native = module.builtinNative;
    if (native) {
      for (const dir of native.vendorDirs ?? []) {
        includeDirs.add(resolve(vendorRoot, dir));
      }
      for (const group of native.sources ?? []) {
        if (group.platforms && !group.platforms.includes(platform)) { continue; }
        const groupDir = resolve(vendorRoot, group.vendorDir);
        for (const pattern of group.patterns) {
          for (const filepath of expandVendorPattern(groupDir, pattern)) {
            nativeSources.add(filepath);
          }
        }
      }
      for (const define of native.defines?.[platform] ?? []) {
        defines.add(define);
      }
      for (const lib of native.linkLibraries?.[platform] ?? []) {
        linkLibraries.add(lib);
      }
      for (const flag of native.compileFlags?.[platform] ?? []) {
        compileFlags.add(flag);
      }
    }

    if (module.builtin) {
      continue;
    }

    artifacts.push(emitHeader(graph, module, config));
    artifacts.push(emitSource(graph, module, config));
  }

  return {
    artifacts,
    linkLibraries: [...linkLibraries],
    nativeSources: [...nativeSources],
    includeDirs: [...includeDirs],
    defines: [...defines],
    compileFlags: [...compileFlags]
  };
}

function resolveVendorRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "runtime", "vendor"),
    resolve(here, "..", "src", "runtime", "vendor"),
    resolve(here, "..", "..", "src", "runtime", "vendor"),
    resolve(here, "..", "..", "..", "src", "runtime", "vendor"),
    resolve(here, "runtime", "vendor")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) { return candidate; }
  }
  return candidates[0];
}

function expandVendorPattern(rootDir: string, pattern: string): string[] {
  const parts = pattern.split(/[/\\]/u).filter((segment) => segment.length > 0);
  if (parts.length === 0) { return []; }
  const lastSegment = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const targetDir = dirParts.length > 0 ? join(rootDir, ...dirParts) : rootDir;
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) { return []; }

  if (!lastSegment.includes("*")) {
    const candidate = join(targetDir, lastSegment);
    return existsSync(candidate) && statSync(candidate).isFile() ? [candidate] : [];
  }

  const regex = new RegExp(
    `^${lastSegment.replace(/\./gu, "\\.").replace(/\*/gu, ".*")}$`,
    "u"
  );
  return readdirSync(targetDir)
    .filter((name) => regex.test(name))
    .map((name) => join(targetDir, name))
    .filter((p) => statSync(p).isFile());
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
    "#include <cstdint>",
    "#include <functional>",
    "#include <optional>",
    "#include <sstream>",
    "#include <string>",
    "#include <string_view>",
    "#include <tuple>",
    "#include <type_traits>",
    "#include <variant>",
    "#include <vector>",
    "",
    "#ifndef __DOUBLEMINT_TEMPLATE_TO_STRING_DEFINED__",
    "#define __DOUBLEMINT_TEMPLATE_TO_STRING_DEFINED__",
    "template <typename T>",
    "inline std::string __doublemint_template_to_string(const T& value) {",
    "  if constexpr (std::is_convertible_v<T, std::string_view>) {",
    "    return std::string(value);",
    "  } else if constexpr (std::is_same_v<T, bool>) {",
    "    return value ? std::string(\"true\") : std::string(\"false\");",
    "  } else if constexpr (std::is_arithmetic_v<T>) {",
    "    return std::to_string(value);",
    "  } else {",
    "    std::ostringstream s; s << value; return s.str();",
    "  }",
    "}",
    "#endif",
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

    if (declaration.type === "EnumDeclaration") {
      lines.push(emitEnum(declaration));
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

function emitEnum(declaration: { id: string; variants: string[] }): string {
  return `enum class ${declaration.id} {\n  ${declaration.variants.join(",\n  ")}\n};`;
}

function enumNameSet(module: ResolvedModule): Set<string> {
  const names = new Set<string>();
  for (const declaration of module.program.body) {
    if (declaration.type === "EnumDeclaration") {
      names.add(declaration.id);
    }
  }
  for (const resolvedImport of module.imports) {
    if (resolvedImport.export.builtin) { continue; }
    const exported = resolvedImport.export.declaration;
    if (exported.type === "EnumDeclaration") {
      names.add(resolvedImport.specifier);
    }
  }
  return names;
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
    nativeMembers: nativeMemberMap(module),
    enumNames: enumNameSet(module)
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
    case "MatchStatement":
      return emitMatchStatement(statement, declaration, context);
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

function emitMatchStatement(
  statement: Statement & { type: "MatchStatement" },
  declaration: FunctionDeclaration,
  context: EmitContext
): string {
  const tempName = `__dlm_match_${context.switchCounter}`;
  context.switchCounter += 1;
  const lines = ["{", `  const auto ${tempName} = ${emitExpression(statement.discriminant, undefined, context)};`];

  const exprArms = statement.arms.filter((arm) => arm.pattern.kind === "expression");
  const wildcardArm = statement.arms.find((arm) => arm.pattern.kind === "wildcard");

  for (let index = 0; index < exprArms.length; index += 1) {
    const arm = exprArms[index]!;
    const pattern = arm.pattern as { kind: "expression"; expression: Expression };
    const prefix = index === 0 ? "if" : "else if";
    lines.push(`  ${prefix} (${tempName} == ${emitExpression(pattern.expression, undefined, context)}) {`);

    for (const nestedStatement of arm.body) {
      lines.push(`    ${emitStatement(nestedStatement, declaration, context)}`);
    }

    lines.push("  }");
  }

  if (wildcardArm) {
    lines.push(exprArms.length > 0 ? "  else {" : "  if (true) {");
    for (const nestedStatement of wildcardArm.body) {
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
    case "MatchStatement":
      statement.arms.forEach((arm) =>
        arm.body.forEach((nested) =>
          collectStringViewDeclarations(nested, mutatedNames, stringViewNames)
        )
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
    case "MatchStatement":
      collectAssignedRootsFromExpression(statement.discriminant, roots);
      statement.arms.forEach((arm) => {
        if (arm.pattern.kind === "expression") {
          collectAssignedRootsFromExpression(arm.pattern.expression, roots);
        }
        arm.body.forEach((nested) => collectAssignedRoots(nested, roots));
      });
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
    case "UnaryExpression":
      collectAssignedRootsFromExpression(expression.argument, roots);
      break;
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
    case "ConditionalExpression":
      collectAssignedRootsFromExpression(expression.condition, roots);
      collectAssignedRootsFromExpression(expression.thenBranch, roots);
      collectAssignedRootsFromExpression(expression.elseBranch, roots);
      break;
    case "MatchExpression":
      collectAssignedRootsFromExpression(expression.discriminant, roots);
      expression.arms.forEach((arm) => {
        if (arm.pattern.kind === "expression") {
          collectAssignedRootsFromExpression(arm.pattern.expression, roots);
        }
        collectAssignedRootsFromExpression(arm.expression, roots);
      });
      break;
    case "TemplateLiteral":
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
    case "UnaryExpression":
      return `(${expression.operator}(${emitExpression(expression.argument, undefined, context)}))`;
    case "BinaryExpression":
      if (expression.stringConcat) {
        return `(std::string(${emitExpression(expression.left, undefined, context)}) + std::string(${emitExpression(expression.right, undefined, context)}))`;
      }
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

      if (
        expression.callee.type === "MemberExpression" &&
        expression.callee.primitiveExtensionNative
      ) {
        const receiver = emitExpression(expression.callee.object, undefined, context);
        const args = expression.arguments.map((argument) => emitExpression(argument, undefined, context));
        return `${expression.callee.primitiveExtensionNative}(${[receiver, ...args].join(", ")})`;
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
        if (context?.enumNames.has(expression.object.name)) {
          return `${expression.object.name}::${expression.property}`;
        }
      }

      return `${emitExpression(expression.object, undefined, context)}.${expression.property}${expression.autoInvoke ? "()" : ""}`;
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
    case "ConditionalExpression":
      return `(${emitExpression(expression.condition, undefined, context)} ? ${emitExpression(expression.thenBranch, expectedType, context)} : ${emitExpression(expression.elseBranch, expectedType, context)})`;
    case "MatchExpression":
      return emitMatchExpression(expression, expectedType, context);
    case "TemplateLiteral": {
      const pieces = expression.parts.map((part) => {
        if (part.kind === "string") {
          return `std::string(${JSON.stringify(part.value)})`;
        }
        return `__doublemint_template_to_string(${part.name})`;
      });
      if (context) { context.usesTemplateLiteral = true; }
      return `(${pieces.join(" + ")})`;
    }
    default:
      assertNever(expression);
  }
}

function emitMatchExpression(
  expression: Expression & { type: "MatchExpression" },
  expectedType: TypeNode | undefined,
  context: EmitContext | undefined
): string {
  const discriminant = emitExpression(expression.discriminant, undefined, context);
  const exprArms = expression.arms.filter((arm) => arm.pattern.kind === "expression");
  const wildcardArm = expression.arms.find((arm) => arm.pattern.kind === "wildcard");

  const pieces: string[] = [];
  for (let index = 0; index < exprArms.length; index += 1) {
    const arm = exprArms[index]!;
    const pattern = arm.pattern as { kind: "expression"; expression: Expression };
    const patternCpp = emitExpression(pattern.expression, undefined, context);
    const valueCpp = emitExpression(arm.expression, expectedType, context);
    pieces.push(`(__dlm_match_v == ${patternCpp}) ? ${valueCpp} :`);
  }
  const wildcardCpp = wildcardArm ? emitExpression(wildcardArm.expression, expectedType, context) : "";
  return `([&]() { const auto __dlm_match_v = ${discriminant}; return ${pieces.join(" ")} ${wildcardCpp}; })()`;
}

function emitLambdaExpression(
  expression: Expression & { type: "LambdaExpression" },
  context?: EmitContext
): string {
  const params = expression.params
    .map((param) => `[[maybe_unused]] ${emitParameterType(param.valueType)} ${param.id}`)
    .join(", ");
  if (expression.blockBody) {
    const fakeDecl: FunctionDeclaration = {
      type: "FunctionDeclaration",
      id: "__lambda",
      params: expression.params,
      returnType: expression.returnType,
      body: expression.blockBody,
      exported: false,
      extern: false,
      location: expression.location
    };
    const innerContext: EmitContext = context ?? {
      switchCounter: 0,
      deferCounter: 0,
      stringViewVariables: new Set<string>(),
      nativeFunctions: new Map<string, string>(),
      nativeMembers: new Map<string, string>(),
      enumNames: new Set<string>()
    };
    const stmts = expression.blockBody
      .map((statement) => emitStatement(statement, fakeDecl, innerContext))
      .join("\n  ");
    return `[=](${params}) -> ${emitType(expression.returnType)} {\n  ${stmts}\n}`;
  }
  const bodyExpression = emitExpressionForExpectedType(
    expression.body,
    expression.returnType,
    context
  );
  const isVoidReturn =
    expression.returnType.type === "NamedType" && expression.returnType.name === "void";
  const bodyStatement = isVoidReturn ? `${bodyExpression};` : `return ${bodyExpression};`;
  return `[=](${params}) -> ${emitType(expression.returnType)} { ${bodyStatement} }`;
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

  if (
    expression.elements.length > 0 &&
    expression.elements.every(
      (element) => element.type === "Literal" && element.literalKind === "string"
    )
  ) {
    return `std::vector<std::string_view>{${elements}}`;
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
    case "int64":
      return "std::int64_t";
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
    case "MatchStatement":
      return statement.arms.some((arm) => arm.body.some(statementUsesDefer));
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

const RUNTIME_HEADER_MODULES: Record<string, string> = {
  "mint:collections": "collections",
  "mint:regex": "regex",
  "mint:schema": "schema",
  "mint:http": "http",
  "mint:sql": "sql"
};

const RUNTIME_SOURCE_MODULES: Record<string, string> = {
  "mint:fs": "fs",
  "mint:time": "time",
  "mint:os": "os",
  "mint:json": "json",
  "mint:log": "log",
  "mint:crypto": "crypto",
  "mint:net": "net",
  "mint:async": "async",
  "mint:memory": "memory",
  "mint:simd": "simd",
  "mint:db": "db",
  "mint:term": "term",
  "mint:process": "process",
  "mint:schema": "schema",
  "mint:http": "http",
  "mint:string": "string",
  "mint:array": "array",
  "mint:math": "math",
  "mint:base64": "base64",
  "mint:sql": "sql",
  "mint:test": "test"
};

function lookupRuntime(map: Record<string, string>, key: string): string {
  const snippet = map[key];
  if (snippet === undefined) {
    throw new Error(`Missing runtime snippet for "${key}". Run "pnpm runtime:embed".`);
  }
  return snippet;
}

function ioHelper(): string {
  return lookupRuntime(RUNTIME_SOURCES, "io");
}

function builtinHeaderDeclarations(module: ResolvedModule): string[] {
  const declarations: string[] = [];
  const visited = new Set<string>();
  for (const resolvedImport of module.imports) {
    const key = RUNTIME_HEADER_MODULES[resolvedImport.source];
    if (key && !visited.has(key)) {
      visited.add(key);
      declarations.push(lookupRuntime(RUNTIME_HEADERS, key));
    }
  }
  return declarations;
}

function builtinSourceHelpers(module: ResolvedModule): string[] {
  const helpers: string[] = [];
  const visited = new Set<string>();
  for (const resolvedImport of module.imports) {
    const key = RUNTIME_SOURCE_MODULES[resolvedImport.source];
    if (key && !visited.has(key)) {
      visited.add(key);
      helpers.push(lookupRuntime(RUNTIME_SOURCES, key));
    }
  }
  return helpers;
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
    case "MatchStatement":
      return (
        expressionUsesPrint(statement.discriminant) ||
        statement.arms.some(
          (arm) =>
            (arm.pattern.kind === "expression" && expressionUsesPrint(arm.pattern.expression)) ||
            arm.body.some(statementUsesPrint)
        )
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
    case "UnaryExpression":
      return expressionUsesPrint(expression.argument);
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
    case "ConditionalExpression":
      return expressionUsesPrint(expression.condition) ||
        expressionUsesPrint(expression.thenBranch) ||
        expressionUsesPrint(expression.elseBranch);
    case "MatchExpression":
      return (
        expressionUsesPrint(expression.discriminant) ||
        expression.arms.some(
          (arm) =>
            (arm.pattern.kind === "expression" && expressionUsesPrint(arm.pattern.expression)) ||
            expressionUsesPrint(arm.expression)
        )
      );
    case "TemplateLiteral":
      return false;
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
  return !["void", "int", "int64", "float", "double", "string", "bool"].includes(typeName);
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
