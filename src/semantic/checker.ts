import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { SourceLocation } from "../lexer/token.js";
import type {
  AssignmentExpression,
  Declaration,
  DestructuringDeclaration,
  EnumDeclaration,
  Expression,
  FunctionDeclaration,
  MemberExpression,
  Program,
  Statement,
  StructDeclaration,
  TypeAliasDeclaration,
  TypeNode,
  VariableDeclaration
} from "../parser/ast.js";
import type {
  ModuleExport,
  ModuleGraph,
  ResolvedImport,
  ResolvedModule
} from "../resolver/moduleGraph.js";

type SymbolKind = "variable" | "function" | "type" | "struct" | "enum" | "namespace";
type Mutability = "mutable" | "immutable";

interface SemanticSymbol {
  name: string;
  kind: SymbolKind;
  valueType?: TypeNode;
  functionType?: FunctionType;
  namespaceMembers?: Map<string, SemanticSymbol>;
  classMethods?: Map<string, SemanticSymbol>;
  nativeName?: string;
  structDeclaration?: StructDeclaration;
  enumDeclaration?: EnumDeclaration;
  typeAlias?: TypeAliasDeclaration;
  property?: boolean;
  mutability: Mutability;
  location: SourceLocation;
}

interface FunctionType {
  params: TypeNode[];
  returnType: TypeNode;
}

interface ModuleEnvironment {
  module: ResolvedModule;
  types: Map<string, SemanticSymbol>;
  values: Map<string, SemanticSymbol>;
}

const builtInTypes = new Set(["void", "int", "int64", "float", "double", "string", "bool", "char"]);
const numericTypes = new Set(["int", "int64", "float", "double", "number"]);

export interface SemanticCheckResult {
  modulesChecked: number;
}

export function checkModuleGraph(graph: ModuleGraph): SemanticCheckResult {
  const environments = buildModuleEnvironments(graph);

  for (const environment of environments.values()) {
    validateTypeDeclarations(environment);
  }

  for (const environment of environments.values()) {
    validateFunctionBodies(environment);
  }

  return {
    modulesChecked: environments.size
  };
}

function buildModuleEnvironments(graph: ModuleGraph): Map<string, ModuleEnvironment> {
  const environments = new Map<string, ModuleEnvironment>();

  for (const module of graph.modules.values()) {
    const environment: ModuleEnvironment = {
      module,
      types: new Map(),
      values: new Map()
    };

    environments.set(module.filepath, environment);
    registerImports(environment, module.imports);
    registerModuleDeclarations(environment, module.program);
  }

  return environments;
}

function registerImports(environment: ModuleEnvironment, imports: ResolvedImport[]): void {
  for (const resolvedImport of imports) {
    const importedSymbol = symbolFromExport(
      resolvedImport.specifier,
      resolvedImport.export
    );

    if (resolvedImport.typeOnly) {
      declareSymbol(environment.types, importedSymbol);
    } else {
      if (resolvedImport.export.builtin && resolvedImport.export.classMethods) {
        declareSymbol(environment.types, importedSymbol);
      }
      if (importedSymbol.kind === "enum") {
        declareSymbol(environment.types, importedSymbol);
      }
      declareSymbol(environment.values, importedSymbol);
    }
  }
}

function registerModuleDeclarations(
  environment: ModuleEnvironment,
  program: Program
): void {
  for (const declaration of program.body) {
    switch (declaration.type) {
      case "ImportDeclaration":
      case "ExternTypeDeclaration":
        break;
      case "TypeAliasDeclaration":
        declareSymbol(environment.types, {
          name: declaration.id,
          kind: "type",
          typeAlias: declaration,
          mutability: "immutable",
          location: declaration.location
        });
        break;
      case "StructDeclaration":
        declareSymbol(environment.types, {
          name: declaration.id,
          kind: "struct",
          structDeclaration: declaration,
          mutability: "immutable",
          location: declaration.location
        });
        break;
      case "EnumDeclaration":
        declareSymbol(environment.types, {
          name: declaration.id,
          kind: "enum",
          enumDeclaration: declaration,
          mutability: "immutable",
          location: declaration.location
        });
        declareSymbol(environment.values, {
          name: declaration.id,
          kind: "enum",
          enumDeclaration: declaration,
          mutability: "immutable",
          location: declaration.location
        });
        break;
      case "ExternBlockDeclaration":
        for (const externDeclaration of declaration.declarations) {
          if (externDeclaration.type === "ExternTypeDeclaration") {
            declareSymbol(environment.types, {
              name: externDeclaration.id,
              kind: "type",
              mutability: "immutable",
              location: externDeclaration.location
            });
          } else {
            registerFunction(environment, externDeclaration);
          }
        }
        break;
      case "FunctionDeclaration":
        registerFunction(environment, declaration);
        break;
      default:
        assertNever(declaration);
    }
  }
}

function registerFunction(
  environment: ModuleEnvironment,
  declaration: FunctionDeclaration
): void {
  declareSymbol(environment.values, {
    name: declaration.id,
    kind: "function",
    functionType: {
      params: declaration.params.map((param) => param.valueType),
      returnType: declaration.returnType
    },
    mutability: "immutable",
    location: declaration.location
  });
}

function symbolFromExport(name: string, moduleExport: ModuleExport): SemanticSymbol {
  if (moduleExport.builtin) {
    if (moduleExport.namespaceMembers) {
      return {
        name,
        kind: "namespace",
        namespaceMembers: new Map(
          [...moduleExport.namespaceMembers.entries()].map(([memberName, member]) => [
            memberName,
            {
              name: memberName,
              kind: member.kind === "function" ? "function" : "variable",
              functionType:
                member.kind === "function"
                  ? {
                      params: member.params ?? [],
                      returnType: member.returnType!
                    }
                  : undefined,
              valueType: member.kind === "value" ? member.valueType : undefined,
              nativeName: member.nativeName,
              mutability: "immutable",
              location: member.location
            }
          ])
        ),
        mutability: "immutable",
        location: moduleExport.location
      };
    }

    if (moduleExport.functionType) {
      return {
        name,
        kind: "function",
        functionType: moduleExport.functionType,
        nativeName: moduleExport.nativeName,
        mutability: "immutable",
        location: moduleExport.location
      };
    }

    if (moduleExport.classMethods) {
      return {
        name,
        kind: "type",
        classMethods: new Map(
          [...moduleExport.classMethods.entries()].map(([methodName, builtinMethod]) => [
            methodName,
            {
              name: methodName,
              kind: "function",
              functionType: {
                params: builtinMethod.params,
                returnType: builtinMethod.returnType
              },
              property: builtinMethod.property === true,
              mutability: "immutable",
              location: builtinMethod.location
            }
          ])
        ),
        mutability: "immutable",
        location: moduleExport.location
      };
    }

    throw new DoublemintDiagnostic({
      code: "DLM4001",
      severity: "error",
      message: `Unsupported builtin import symbol "${name}".`,
      location: moduleExport.location
    });
  }

  const declaration = moduleExport.declaration;

  if (moduleExport.kind === "value" && declaration.type === "FunctionDeclaration") {
    return {
      name,
      kind: "function",
      functionType: {
        params: declaration.params.map((param) => param.valueType),
        returnType: declaration.returnType
      },
      mutability: "immutable",
      location: declaration.location
    };
  }

  if (declaration.type === "StructDeclaration") {
    return {
      name,
      kind: "struct",
      structDeclaration: declaration,
      mutability: "immutable",
      location: declaration.location
    };
  }

  if (declaration.type === "EnumDeclaration") {
    return {
      name,
      kind: "enum",
      enumDeclaration: declaration,
      mutability: "immutable",
      location: declaration.location
    };
  }

  if (declaration.type === "TypeAliasDeclaration") {
    return {
      name,
      kind: "type",
      typeAlias: declaration,
      mutability: "immutable",
      location: declaration.location
    };
  }

  throw new DoublemintDiagnostic({
    code: "DLM4001",
    severity: "error",
    message: `Unsupported import symbol "${name}".`,
    location: declaration.location
  });
}

function validateTypeDeclarations(environment: ModuleEnvironment): void {
  for (const symbol of environment.types.values()) {
    if (symbol.typeAlias) {
      assertKnownType(environment, symbol.typeAlias.valueType);
    }

    if (symbol.structDeclaration) {
      const seenFields = new Set<string>();

      for (const field of symbol.structDeclaration.fields) {
        if (seenFields.has(field.id)) {
          throw new DoublemintDiagnostic({
            code: "DLM4002",
            severity: "error",
            message: `Duplicate struct field "${field.id}".`,
            location: field.location
          });
        }

        seenFields.add(field.id);
        assertKnownType(environment, field.valueType);
      }
    }
  }

  for (const symbol of environment.values.values()) {
    if (symbol.functionType) {
      for (const paramType of symbol.functionType.params) {
        assertKnownType(environment, paramType);
      }

      assertKnownType(environment, symbol.functionType.returnType);
    }
  }
}

function validateFunctionBodies(environment: ModuleEnvironment): void {
  for (const declaration of environment.module.program.body) {
    if (declaration.type === "FunctionDeclaration" && !declaration.extern) {
      validateFunction(environment, declaration);
    }
  }
}

function validateFunction(
  environment: ModuleEnvironment,
  declaration: FunctionDeclaration
): void {
  const scope = new Scope(environment.values);

  for (const param of declaration.params) {
    assertKnownType(environment, param.valueType);
    scope.declare({
      name: param.id,
      kind: "variable",
      valueType: param.valueType,
      mutability: "immutable",
      location: param.location
    });
  }

  for (const statement of declaration.body) {
    validateStatement(environment, scope, declaration.returnType, statement);
  }
}

function validateStatement(
  environment: ModuleEnvironment,
  scope: Scope,
  returnType: TypeNode,
  statement: Statement
): void {
  switch (statement.type) {
    case "VariableDeclaration":
      validateVariableDeclaration(environment, scope, statement);
      break;
    case "DestructuringDeclaration":
      validateDestructuringDeclaration(environment, scope, statement);
      break;
    case "ReturnStatement": {
      const actualType = statement.argument
        ? inferExpressionType(environment, scope, statement.argument)
        : namedType("void", statement.location);
      assertAssignable(environment, returnType, actualType, statement.location);
      break;
    }
    case "IfStatement": {
      const conditionType = inferExpressionType(environment, scope, statement.condition);
      assertAssignable(environment, namedType("bool", statement.condition.location), conditionType, statement.condition.location);

      const thenScope = scope.createChild();
      for (const nestedStatement of statement.thenBranch) {
        validateStatement(environment, thenScope, returnType, nestedStatement);
      }

      const elseScope = scope.createChild();
      for (const nestedStatement of statement.elseBranch) {
        validateStatement(environment, elseScope, returnType, nestedStatement);
      }
      break;
    }
    case "WhileStatement": {
      const conditionType = inferExpressionType(environment, scope, statement.condition);
      assertAssignable(
        environment,
        namedType("bool", statement.condition.location),
        conditionType,
        statement.condition.location
      );

      const bodyScope = scope.createChild();
      for (const nestedStatement of statement.body) {
        validateStatement(environment, bodyScope, returnType, nestedStatement);
      }
      break;
    }
    case "ForStatement": {
      const loopScope = scope.createChild();

      if (statement.init) {
        if (statement.init.type === "VariableDeclaration") {
          validateVariableDeclaration(environment, loopScope, statement.init);
        } else {
          inferExpressionType(environment, loopScope, statement.init);
        }
      }

      if (statement.condition) {
        const conditionType = inferExpressionType(environment, loopScope, statement.condition);
        assertAssignable(
          environment,
          namedType("bool", statement.condition.location),
          conditionType,
          statement.condition.location
        );
      }

      if (statement.increment) {
        inferExpressionType(environment, loopScope, statement.increment);
      }

      const bodyScope = loopScope.createChild();
      for (const nestedStatement of statement.body) {
        validateStatement(environment, bodyScope, returnType, nestedStatement);
      }
      break;
    }
    case "SwitchStatement": {
      const discriminantType = inferExpressionType(environment, scope, statement.discriminant);

      for (const switchCase of statement.cases) {
        const testType = inferExpressionType(environment, scope, switchCase.test);
        assertAssignable(environment, discriminantType, testType, switchCase.test.location);

        const caseScope = scope.createChild();
        for (const nestedStatement of switchCase.body) {
          validateStatement(environment, caseScope, returnType, nestedStatement);
        }
      }

      const defaultScope = scope.createChild();
      for (const nestedStatement of statement.defaultBranch) {
        validateStatement(environment, defaultScope, returnType, nestedStatement);
      }
      break;
    }
    case "MatchStatement": {
      const discriminantType = inferExpressionType(environment, scope, statement.discriminant);
      let hasWildcard = false;
      for (const arm of statement.arms) {
        if (arm.pattern.kind === "wildcard") {
          if (hasWildcard) {
            throw new DoublemintDiagnostic({
              code: "DLM4071",
              severity: "error",
              message: "Match has more than one wildcard arm.",
              location: arm.location
            });
          }
          hasWildcard = true;
        } else {
          const patternType = inferExpressionType(environment, scope, arm.pattern.expression);
          assertAssignable(environment, discriminantType, patternType, arm.pattern.location);
        }
        const armScope = scope.createChild();
        for (const nestedStatement of arm.body) {
          validateStatement(environment, armScope, returnType, nestedStatement);
        }
      }
      break;
    }
    case "ExpressionStatement":
      inferExpressionType(environment, scope, statement.expression);
      break;
    case "DeferStatement":
      inferExpressionType(environment, scope, statement.expression);
      break;
    default:
      assertNever(statement);
  }
}

function validateDestructuringDeclaration(
  environment: ModuleEnvironment,
  scope: Scope,
  declaration: DestructuringDeclaration
): void {
  const initType = inferExpressionType(environment, scope, declaration.init);
  const tupleType = resolveTupleType(environment, initType);

  if (!tupleType) {
    throw new DoublemintDiagnostic({
      code: "DLM4029",
      severity: "error",
      message: `Cannot destructure non-tuple type "${typeToString(initType)}".`,
      location: declaration.location
    });
  }

  if (declaration.ids.length !== tupleType.elements.length) {
    throw new DoublemintDiagnostic({
      code: "DLM4030",
      severity: "error",
      message: `Tuple destructuring expects ${tupleType.elements.length} bindings but got ${declaration.ids.length}.`,
      location: declaration.location
    });
  }

  for (let index = 0; index < declaration.ids.length; index += 1) {
    const valueType = tupleType.elements[index]!;
    assertKnownType(environment, valueType);
    scope.declare({
      name: declaration.ids[index]!,
      kind: "variable",
      valueType,
      mutability: declaration.kind === "let" ? "mutable" : "immutable",
      location: declaration.location
    });
  }
}

function validateVariableDeclaration(
  environment: ModuleEnvironment,
  scope: Scope,
  declaration: VariableDeclaration
): void {
  assertKnownType(environment, declaration.valueType);

  if (declaration.init) {
    const initType = inferExpressionType(environment, scope, declaration.init);
    assertAssignable(environment, declaration.valueType, initType, declaration.location);
  }

  scope.declare({
    name: declaration.id,
    kind: "variable",
    valueType: declaration.valueType,
    mutability: declaration.kind === "let" ? "mutable" : "immutable",
    location: declaration.location
  });
}

function inferExpressionType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression
): TypeNode {
  switch (expression.type) {
    case "Identifier": {
      const symbol = scope.lookup(expression.name);

      if (!symbol) {
        throw new DoublemintDiagnostic({
          code: "DLM4003",
          severity: "error",
          message: `Unknown identifier "${expression.name}".`,
          location: expression.location
        });
      }

      if (symbol.valueType) {
        return symbol.valueType;
      }

      if (symbol.functionType) {
        throw new DoublemintDiagnostic({
          code: "DLM4016",
          severity: "error",
          message: `Function "${expression.name}" must be called before its return value can be used.`,
          location: expression.location
        });
      }

      throw new DoublemintDiagnostic({
        code: "DLM4004",
        severity: "error",
        message: `Identifier "${expression.name}" is not a value.`,
        location: expression.location
      });
    }
    case "Literal":
      return namedType(
        expression.literalKind === "number"
          ? "number"
          : expression.literalKind === "bool"
            ? "bool"
            : expression.literalKind === "null"
              ? "null"
              : "string",
        expression.location
      );
    case "BinaryExpression": {
      const left = inferExpressionType(environment, scope, expression.left);
      const right = inferExpressionType(environment, scope, expression.right);

      if (isEqualityOperator(expression.operator)) {
        if (
          !typesEqual(environment, left, right) &&
          !(isNumericType(environment, left) && isNumericType(environment, right)) &&
          !isNullComparable(environment, left, right)
        ) {
          throw new DoublemintDiagnostic({
            code: "DLM4021",
            severity: "error",
            message: `Operator "${expression.operator}" requires comparable operands.`,
            location: expression.location
          });
        }

        return namedType("bool", expression.location);
      }

      if (expression.operator === "+" &&
          canonicalTypeName(environment, left) === "string" &&
          canonicalTypeName(environment, right) === "string") {
        expression.stringConcat = true;
        return namedType("string", expression.location);
      }

      if (
        (expression.operator === "&&" || expression.operator === "||") &&
        canonicalTypeName(environment, left) === "bool" &&
        canonicalTypeName(environment, right) === "bool"
      ) {
        return namedType("bool", expression.location);
      }

      if (!isNumericType(environment, left) || !isNumericType(environment, right)) {
        throw new DoublemintDiagnostic({
          code: "DLM4005",
          severity: "error",
          message: `Operator "${expression.operator}" requires numeric operands.`,
          location: expression.location
        });
      }

      if (isOrderingOperator(expression.operator)) {
        return namedType("bool", expression.location);
      }

      return widerNumericType(environment, left, right, expression.location);
    }
    case "AssignmentExpression":
      return inferAssignmentType(environment, scope, expression);
    case "CallExpression":
      return inferCallType(environment, scope, expression);
    case "MemberExpression":
      return inferMemberType(environment, scope, expression);
    case "IndexExpression":
      return inferIndexType(environment, scope, expression);
    case "ArrayLiteral":
      return inferArrayLiteralType(environment, scope, expression);
    case "TupleLiteral":
      return inferTupleLiteralType(environment, scope, expression);
    case "StructLiteral":
      return inferStructLiteralType(environment, scope, expression);
    case "LambdaExpression":
      return inferLambdaType(environment, scope, expression);
    case "CopyExpression":
      return inferExpressionType(environment, scope, expression.argument);
    case "CastExpression":
      assertKnownType(environment, expression.targetType);
      inferExpressionType(environment, scope, expression.expression);
      return expression.targetType;
    case "NewExpression":
      assertKnownType(environment, expression.targetType);
      for (const argument of expression.arguments) {
        inferExpressionType(environment, scope, argument);
      }
      return expression.targetType;
    case "TemplateLiteral": {
      for (const part of expression.parts) {
        if (part.kind === "identifier") {
          const symbol = scope.lookup(part.name);
          if (!symbol || symbol.kind === "namespace") {
            throw new DoublemintDiagnostic({
              code: "DLM4034",
              severity: "error",
              message: `Unknown identifier "${part.name}" in template literal.`,
              location: expression.location
            });
          }
        }
      }
      return namedType("string", expression.location);
    }
    case "ConditionalExpression": {
      const condType = inferExpressionType(environment, scope, expression.condition);
      if (canonicalTypeName(environment, condType) !== "bool") {
        throw new DoublemintDiagnostic({
          code: "DLM4032",
          severity: "error",
          message: "Ternary condition must be bool.",
          location: expression.condition.location
        });
      }
      const thenType = inferExpressionType(environment, scope, expression.thenBranch);
      const elseType = inferExpressionType(environment, scope, expression.elseBranch);
      if (!typesEqual(environment, thenType, elseType)) {
        throw new DoublemintDiagnostic({
          code: "DLM4033",
          severity: "error",
          message: "Ternary branches must have the same type.",
          location: expression.location
        });
      }
      return thenType;
    }
    default:
      assertNever(expression);
  }
}

function inferAssignmentType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: AssignmentExpression
): TypeNode {
  const leftType = inferExpressionType(environment, scope, expression.left);
  const rightType = inferExpressionType(environment, scope, expression.right);

  assertMutableAssignmentTarget(scope, expression.left);
  assertAssignable(environment, leftType, rightType, expression.location);
  return leftType;
}

function inferCallType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "CallExpression" }
): TypeNode {
  if (
    expression.callee.type === "Identifier" &&
    (expression.callee.name === "print" || expression.callee.name === "println")
  ) {
    if (expression.arguments.length < 1) {
      throw new DoublemintDiagnostic({
        code: "DLM4017",
        severity: "error",
        message: `Function "${expression.callee.name}" expects at least 1 argument but got ${expression.arguments.length}.`,
        location: expression.location
      });
    }

    for (const argument of expression.arguments) {
      inferExpressionType(environment, scope, argument);
    }
    return namedType("void", expression.location);
  }

  if (expression.callee.type === "Identifier") {
    const callee = scope.lookup(expression.callee.name);

    if (callee?.functionType) {
      const subs = validateCallArguments(
        environment,
        scope,
        callee.name,
        callee.functionType.params,
        expression.arguments,
        expression.location
      );

      return applyGenericSubstitution(callee.functionType.returnType, subs);
    }
  }

  if (expression.callee.type === "MemberExpression") {
    const memberExpr = expression.callee;
    const isNamespaceCall =
      memberExpr.object.type === "Identifier" &&
      scope.lookup(memberExpr.object.name)?.kind === "namespace";
    if (!isNamespaceCall) {
      const objectType = inferExpressionType(environment, scope, memberExpr.object);
      const classMethod = resolveClassMethod(environment, objectType, memberExpr.property);
      if (classMethod && classMethod.type === "FunctionType") {
        memberExpr.autoInvoke = false;
        const subs = validateCallArguments(
          environment,
          scope,
          memberExpr.property,
          classMethod.params,
          expression.arguments,
          expression.location
        );
        return applyGenericSubstitution(classMethod.returnType, subs);
      }
      const extension = resolvePrimitiveExtension(environment, scope, objectType, memberExpr.property);
      if (extension) {
        memberExpr.autoInvoke = false;
        memberExpr.primitiveExtensionNative = extension.nativeName;
        const subs = validateCallArguments(
          environment,
          scope,
          memberExpr.property,
          extension.remainingParams,
          expression.arguments,
          expression.location
        );
        return applyGenericSubstitution(extension.returnType, subs);
      }
    }
  }

  const calleeType = inferExpressionType(environment, scope, expression.callee);
  for (const typeArg of expression.typeArgs ?? []) {
    assertKnownType(environment, typeArg);
  }

  if (calleeType.type !== "FunctionType") {
    throw new DoublemintDiagnostic({
      code: "DLM4007",
      severity: "error",
      message: `"${callableName(expression.callee)}" is not a function.`,
      location: expression.callee.location
    });
  }

  const subs = validateCallArguments(
    environment,
    scope,
    callableName(expression.callee),
    calleeType.params,
    expression.arguments,
    expression.location
  );
  return applyGenericSubstitution(calleeType.returnType, subs);
}

function validateCallArguments(
  environment: ModuleEnvironment,
  scope: Scope,
  name: string,
  params: TypeNode[],
  args: Expression[],
  location: SourceLocation
): Map<string, TypeNode> {
  if (params.length !== args.length) {
    throw new DoublemintDiagnostic({
      code: "DLM4008",
      severity: "error",
      message: `Function "${name}" expects ${params.length} arguments but got ${args.length}.`,
      location
    });
  }

  const substitutions = new Map<string, TypeNode>();
  for (let index = 0; index < args.length; index += 1) {
    const actualType = inferExpressionType(environment, scope, args[index]!);
    const declared = params[index]!;
    collectGenericSubstitutions(declared, actualType, substitutions);
    const expectedType = applyGenericSubstitution(declared, substitutions);
    assertAssignable(environment, expectedType, actualType, args[index]!.location);
  }
  return substitutions;
}

function isGenericPlaceholder(name: string): boolean {
  return /^[A-Z][0-9]*$/u.test(name) && name !== "PI";
}

function collectGenericSubstitutions(declared: TypeNode, actual: TypeNode, out: Map<string, TypeNode>): void {
  if (declared.type === "NamedType" && isGenericPlaceholder(declared.name)) {
    if (!out.has(declared.name)) { out.set(declared.name, actual); }
    return;
  }
  if (declared.type === "ArrayType" && actual.type === "ArrayType") {
    collectGenericSubstitutions(declared.elementType, actual.elementType, out);
    return;
  }
  if (declared.type === "FunctionType" && actual.type === "FunctionType") {
    for (let index = 0; index < declared.params.length && index < actual.params.length; index += 1) {
      collectGenericSubstitutions(declared.params[index]!, actual.params[index]!, out);
    }
    collectGenericSubstitutions(declared.returnType, actual.returnType, out);
    return;
  }
  if (declared.type === "GenericType" && actual.type === "GenericType") {
    for (let index = 0; index < declared.typeArgs.length && index < actual.typeArgs.length; index += 1) {
      collectGenericSubstitutions(declared.typeArgs[index]!, actual.typeArgs[index]!, out);
    }
    return;
  }
  if (declared.type === "OptionalType" && actual.type === "OptionalType") {
    collectGenericSubstitutions(declared.valueType, actual.valueType, out);
    return;
  }
}

function applyGenericSubstitution(type: TypeNode, subs: Map<string, TypeNode>): TypeNode {
  if (subs.size === 0) { return type; }
  if (type.type === "NamedType" && subs.has(type.name)) {
    return subs.get(type.name)!;
  }
  if (type.type === "ArrayType") {
    return { ...type, elementType: applyGenericSubstitution(type.elementType, subs) };
  }
  if (type.type === "FunctionType") {
    return {
      ...type,
      params: type.params.map((p) => applyGenericSubstitution(p, subs)),
      returnType: applyGenericSubstitution(type.returnType, subs)
    };
  }
  if (type.type === "GenericType") {
    return { ...type, typeArgs: type.typeArgs.map((a) => applyGenericSubstitution(a, subs)) };
  }
  if (type.type === "OptionalType") {
    return { ...type, valueType: applyGenericSubstitution(type.valueType, subs) };
  }
  return type;
}

function callableName(expression: Expression): string {
  return expression.type === "Identifier" ? expression.name : "<expression>";
}

function inferMemberType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: MemberExpression
): TypeNode {
  if (expression.object.type === "Identifier") {
    const looked = scope.lookup(expression.object.name);
    if (looked?.kind === "enum" && looked.enumDeclaration) {
      const variant = looked.enumDeclaration.variants.find((v) => v === expression.property);
      if (!variant) {
        throw new DoublemintDiagnostic({
          code: "DLM4070",
          severity: "error",
          message: `Enum "${expression.object.name}" has no variant "${expression.property}".`,
          location: expression.location
        });
      }
      return {
        type: "NamedType",
        name: looked.enumDeclaration.id,
        location: expression.location
      };
    }
    const namespace = looked;
    if (namespace?.kind === "namespace") {
      const member = namespace.namespaceMembers?.get(expression.property);
      if (!member) {
        throw new DoublemintDiagnostic({
          code: "DLM4030",
          severity: "error",
          message: `Namespace "${expression.object.name}" has no member "${expression.property}".`,
          location: expression.location
        });
      }

      if (member.functionType) {
        return {
          type: "FunctionType",
          params: member.functionType.params,
          returnType: member.functionType.returnType,
          location: expression.location
        };
      }

      if (member.valueType) {
        return member.valueType;
      }
    }
  }

  const objectType = inferExpressionType(environment, scope, expression.object);
  const classProperty = resolveClassProperty(environment, objectType, expression.property);
  if (classProperty) {
    expression.autoInvoke = true;
    return substituteTypeParameter(classProperty, objectType);
  }
  const classMethod = resolveClassMethod(environment, objectType, expression.property);
  if (classMethod) {
    return classMethod;
  }

  const struct = resolveStruct(environment, objectType);

  if (!struct) {
    throw new DoublemintDiagnostic({
      code: "DLM4009",
      severity: "error",
      message: `Type "${typeToString(objectType)}" has no fields.`,
      location: expression.location
    });
  }

  const field = struct.fields.find((candidate) => candidate.id === expression.property);

  if (!field) {
    throw new DoublemintDiagnostic({
      code: "DLM4010",
      severity: "error",
      message: `Struct "${struct.id}" has no field "${expression.property}".`,
      location: expression.location
    });
  }

  return field.valueType;
}

function inferIndexType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "IndexExpression" }
): TypeNode {
  const objectType = inferExpressionType(environment, scope, expression.object);
  const indexType = inferExpressionType(environment, scope, expression.index);

  if (objectType.type === "TupleType") {
    const tupleIndex = constantTupleIndex(expression.index);

    if (tupleIndex === null) {
      throw new DoublemintDiagnostic({
        code: "DLM4027",
        severity: "error",
        message: "Tuple index must be a numeric literal.",
        location: expression.index.location
      });
    }

    const elementType = objectType.elements[tupleIndex];
    if (!elementType) {
      throw new DoublemintDiagnostic({
        code: "DLM4028",
        severity: "error",
        message: `Tuple index ${tupleIndex} is out of range.`,
        location: expression.index.location
      });
    }

    expression.accessKind = "tuple";
    expression.tupleIndex = tupleIndex;
    return elementType;
  }

  if (objectType.type === "NamedType" && objectType.name === "HeaderMap") {
    if (canonicalTypeName(environment, indexType) !== "string") {
      throw new DoublemintDiagnostic({
        code: "DLM4031",
        severity: "error",
        message: "HeaderMap index must be a string.",
        location: expression.index.location
      });
    }
    expression.accessKind = "array";
    return namedType("string", expression.location);
  }

  if (objectType.type !== "ArrayType") {
    throw new DoublemintDiagnostic({
      code: "DLM4018",
      severity: "error",
      message: `Type "${typeToString(objectType)}" is not indexable.`,
      location: expression.location
    });
  }

  if (!isNumericType(environment, indexType)) {
    throw new DoublemintDiagnostic({
      code: "DLM4019",
      severity: "error",
      message: "Array index must be numeric.",
      location: expression.index.location
    });
  }

  expression.accessKind = "array";
  return objectType.elementType;
}

function inferArrayLiteralType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "ArrayLiteral" }
): TypeNode {
  if (expression.elements.length === 0) {
    throw new DoublemintDiagnostic({
      code: "DLM4020",
      severity: "error",
      message: "Empty array literals need an annotated element type.",
      location: expression.location
    });
  }

  const elementType = inferExpressionType(environment, scope, expression.elements[0]!);

  for (const element of expression.elements.slice(1)) {
    const actualType = inferExpressionType(environment, scope, element);
    assertAssignable(environment, elementType, actualType, element.location);
  }

  return {
    type: "ArrayType",
    elementType,
    location: expression.location
  };
}

function inferTupleLiteralType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "TupleLiteral" }
): TypeNode {
  return {
    type: "TupleType",
    elements: expression.elements.map((element) =>
      inferExpressionType(environment, scope, element)
    ),
    location: expression.location
  };
}

function inferStructLiteralType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "StructLiteral" }
): TypeNode {
  const literalType = namedType(expression.typeName, expression.location);
  assertKnownType(environment, literalType);
  const struct = resolveStruct(environment, literalType);

  if (!struct) {
    throw new DoublemintDiagnostic({
      code: "DLM4022",
      severity: "error",
      message: `Type "${expression.typeName}" is not a struct.`,
      location: expression.location
    });
  }

  const seenFields = new Set<string>();

  for (let index = 0; index < expression.fields.length; index += 1) {
    const field = expression.fields[index]!;

    if (seenFields.has(field.id)) {
      throw new DoublemintDiagnostic({
        code: "DLM4023",
        severity: "error",
        message: `Duplicate struct literal field "${field.id}".`,
        location: field.location
      });
    }

    const expectedField = struct.fields.find((candidate) => candidate.id === field.id);
    if (!expectedField) {
      throw new DoublemintDiagnostic({
        code: "DLM4024",
        severity: "error",
        message: `Struct "${struct.id}" has no field "${field.id}".`,
        location: field.location
      });
    }

    if (struct.fields[index]?.id !== field.id) {
      throw new DoublemintDiagnostic({
        code: "DLM4025",
        severity: "error",
        message: `Struct literal field "${field.id}" must follow declaration order.`,
        location: field.location
      });
    }

    const actualType = inferExpressionType(environment, scope, field.value);
    assertAssignable(environment, expectedField.valueType, actualType, field.location);
    seenFields.add(field.id);
  }

  for (const field of struct.fields) {
    if (!seenFields.has(field.id)) {
      throw new DoublemintDiagnostic({
        code: "DLM4026",
        severity: "error",
        message: `Missing struct literal field "${field.id}".`,
        location: expression.location
      });
    }
  }

  return literalType;
}

function inferLambdaType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: Expression & { type: "LambdaExpression" }
): TypeNode {
  assertKnownType(environment, expression.returnType);
  const lambdaScope = scope.createChild();

  for (const param of expression.params) {
    assertKnownType(environment, param.valueType);
    lambdaScope.declare({
      name: param.id,
      kind: "variable",
      valueType: param.valueType,
      mutability: "immutable",
      location: param.location
    });
  }

  if (expression.blockBody) {
    for (const statement of expression.blockBody) {
      validateStatement(environment, lambdaScope, expression.returnType, statement);
    }
  } else {
    const bodyType = inferExpressionType(environment, lambdaScope, expression.body);
    const returnsVoid =
      expression.returnType.type === "NamedType" && expression.returnType.name === "void";
    if (!returnsVoid) {
      assertAssignable(environment, expression.returnType, bodyType, expression.body.location);
    }
  }

  return {
    type: "FunctionType",
    params: expression.params.map((param) => param.valueType),
    returnType: expression.returnType,
    location: expression.location
  };
}

function assertMutableAssignmentTarget(scope: Scope, expression: Expression): void {
  const root = assignmentRoot(expression);

  if (!root) {
    throw new DoublemintDiagnostic({
      code: "DLM4011",
      severity: "error",
      message: "Assignment target must be an identifier or field access.",
      location: expression.location
    });
  }

  const symbol = scope.lookup(root.name);

  if (!symbol) {
    throw new DoublemintDiagnostic({
      code: "DLM4003",
      severity: "error",
      message: `Unknown identifier "${root.name}".`,
      location: root.location
    });
  }

  if (symbol.mutability !== "mutable") {
    throw new DoublemintDiagnostic({
      code: "DLM4012",
      severity: "error",
      message: `Cannot assign to immutable "${root.name}".`,
      location: root.location
    });
  }
}

function assignmentRoot(expression: Expression): { name: string; location: SourceLocation } | null {
  if (expression.type === "Identifier") {
    return {
      name: expression.name,
      location: expression.location
    };
  }

  if (expression.type === "MemberExpression") {
    return assignmentRoot(expression.object);
  }

  if (expression.type === "IndexExpression") {
    return assignmentRoot(expression.object);
  }

  return null;
}

function assertKnownType(environment: ModuleEnvironment, type: TypeNode): void {
  if (type.type === "TupleType") {
    for (const element of type.elements) {
      assertKnownType(environment, element);
    }
    return;
  }

  if (type.type === "ArrayType") {
    assertKnownType(environment, type.elementType);
    return;
  }

  if (type.type === "GenericType") {
    for (const typeArg of type.typeArgs) {
      assertKnownType(environment, typeArg);
    }

    if (builtInTypes.has(type.name) || type.location.filepath !== environment.module.filepath) {
      return;
    }

    if (!environment.types.has(type.name)) {
      throw new DoublemintDiagnostic({
        code: "DLM4013",
        severity: "error",
        message: `Unknown type "${type.name}".`,
        location: type.location
      });
    }

    return;
  }

  if (type.type === "FunctionType") {
    for (const param of type.params) {
      assertKnownType(environment, param);
    }
    assertKnownType(environment, type.returnType);
    return;
  }

  if (type.type === "PointerType") {
    assertKnownType(environment, type.pointee);
    return;
  }

  if (type.type === "ReferenceType") {
    assertKnownType(environment, type.referent);
    return;
  }

  if (type.type === "ConstType") {
    assertKnownType(environment, type.valueType);
    return;
  }

  if (type.type === "OptionalType") {
    assertKnownType(environment, type.valueType);
    return;
  }

  if (type.type === "UnionType") {
    for (const option of type.options) {
      assertKnownType(environment, option);
    }
    return;
  }

  if (builtInTypes.has(type.name) || type.name === "number" || type.name === "null") {
    return;
  }

  if (type.location.filepath !== environment.module.filepath) {
    return;
  }

  if (!environment.types.has(type.name)) {
    throw new DoublemintDiagnostic({
      code: "DLM4013",
      severity: "error",
      message: `Unknown type "${type.name}".`,
      location: type.location
    });
  }
}

function assertAssignable(
  environment: ModuleEnvironment,
  expected: TypeNode,
  actual: TypeNode,
  location: SourceLocation
): void {
  assertKnownType(environment, expected);
  assertKnownType(environment, actual);

  if (typesEqual(environment, expected, actual)) {
    return;
  }

  if (expected.type === "ArrayType" && actual.type === "ArrayType") {
    assertAssignable(environment, expected.elementType, actual.elementType, location);
    return;
  }

  if (expected.type === "TupleType" && actual.type === "TupleType") {
    if (expected.elements.length === actual.elements.length) {
      for (let index = 0; index < expected.elements.length; index += 1) {
        assertAssignable(
          environment,
          expected.elements[index]!,
          actual.elements[index]!,
          location
        );
      }
      return;
    }
  }

  if (expected.type === "FunctionType" && actual.type === "FunctionType") {
    if (expected.params.length === actual.params.length) {
      for (let index = 0; index < expected.params.length; index += 1) {
        assertAssignable(
          environment,
          expected.params[index]!,
          actual.params[index]!,
          location
        );
      }
      assertAssignable(environment, expected.returnType, actual.returnType, location);
      return;
    }
  }

  if (expected.type === "OptionalType") {
    if (canonicalTypeName(environment, actual) === "null") {
      return;
    }

    if (actual.type === "OptionalType") {
      assertAssignable(environment, expected.valueType, actual.valueType, location);
      return;
    }

    assertAssignable(environment, expected.valueType, actual, location);
    return;
  }

  if (expected.type === "UnionType") {
    for (const option of expected.options) {
      try {
        assertAssignable(environment, option, actual, location);
        return;
      } catch (error) {
        if (!(error instanceof DoublemintDiagnostic)) {
          throw error;
        }
      }
    }
  }

  if (isConstCharPointer(environment, expected) && canonicalTypeName(environment, actual) === "string") {
    return;
  }

  if (expected.type === "PointerType" && canonicalTypeName(environment, actual) === "null") {
    return;
  }

  if (expected.type === "PointerType" && actual.type === "PointerType") {
    assertAssignable(environment, expected.pointee, actual.pointee, location);
    return;
  }

  if (expected.type === "ReferenceType" && actual.type === "ReferenceType") {
    assertAssignable(environment, expected.referent, actual.referent, location);
    return;
  }

  if (expected.type === "ConstType") {
    assertAssignable(environment, expected.valueType, actual, location);
    return;
  }

  if (actual.type === "ConstType") {
    assertAssignable(environment, expected, actual.valueType, location);
    return;
  }

  if (isNumericType(environment, expected) && isNumericType(environment, actual)) {
    return;
  }

  throw new DoublemintDiagnostic({
    code: "DLM4014",
    severity: "error",
    message: `Type "${typeToString(actual)}" is not assignable to "${typeToString(expected)}".`,
    location
  });
}

function typesEqual(environment: ModuleEnvironment, left: TypeNode, right: TypeNode): boolean {
  return canonicalTypeName(environment, left) === canonicalTypeName(environment, right);
}

function canonicalTypeName(environment: ModuleEnvironment, type: TypeNode): string {
  if (type.type === "TupleType") {
    return `[${type.elements.map((element) => canonicalTypeName(environment, element)).join(",")}]`;
  }

  if (type.type === "ArrayType") {
    return `${canonicalTypeName(environment, type.elementType)}[]`;
  }

  if (type.type === "GenericType") {
    return `${type.name}<${type.typeArgs.map((typeArg) => canonicalTypeName(environment, typeArg)).join(",")}>`;
  }

  if (type.type === "FunctionType") {
    return `function(${type.params
      .map((param) => canonicalTypeName(environment, param))
      .join(",")}):${canonicalTypeName(environment, type.returnType)}`;
  }

  if (type.type === "PointerType") {
    return `${canonicalTypeName(environment, type.pointee)}*`;
  }

  if (type.type === "ReferenceType") {
    return `${canonicalTypeName(environment, type.referent)}&`;
  }

  if (type.type === "ConstType") {
    return `const ${canonicalTypeName(environment, type.valueType)}`;
  }

  if (type.type === "OptionalType") {
    return `${canonicalTypeName(environment, type.valueType)}?`;
  }

  if (type.type === "UnionType") {
    return type.options.map((option) => canonicalTypeName(environment, option)).join("|");
  }

  if (type.name === "number") {
    return "number";
  }

  const symbol = environment.types.get(type.name);
  if (symbol?.typeAlias) {
    return canonicalTypeName(environment, symbol.typeAlias.valueType);
  }

  return type.name;
}

function isNumericType(environment: ModuleEnvironment, type: TypeNode): boolean {
  return numericTypes.has(canonicalTypeName(environment, type));
}

function isNullComparable(
  environment: ModuleEnvironment,
  left: TypeNode,
  right: TypeNode
): boolean {
  return (
    (left.type === "PointerType" && canonicalTypeName(environment, right) === "null") ||
    (right.type === "PointerType" && canonicalTypeName(environment, left) === "null") ||
    (left.type === "OptionalType" && canonicalTypeName(environment, right) === "null") ||
    (right.type === "OptionalType" && canonicalTypeName(environment, left) === "null")
  );
}

function isConstCharPointer(environment: ModuleEnvironment, type: TypeNode): boolean {
  return canonicalTypeName(environment, type) === "const char*";
}

function isEqualityOperator(operator: string): boolean {
  return operator === "==" || operator === "!=";
}

function isOrderingOperator(operator: string): boolean {
  return operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
}

function constantTupleIndex(expression: Expression): number | null {
  const value = expression.type === "Literal" ? expression.value : null;

  if (
    expression.type !== "Literal" ||
    expression.literalKind !== "number" ||
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function widerNumericType(
  environment: ModuleEnvironment,
  left: TypeNode,
  right: TypeNode,
  location: SourceLocation
): TypeNode {
  const leftName = canonicalTypeName(environment, left);
  const rightName = canonicalTypeName(environment, right);

  if (leftName === "double" || rightName === "double") {
    return namedType("double", location);
  }

  if (leftName === "float" || rightName === "float") {
    return namedType("float", location);
  }

  if (leftName === "number" || rightName === "number") {
    return namedType("number", location);
  }

  if (leftName === "int64" || rightName === "int64") {
    return namedType("int64", location);
  }

  return namedType("int", location);
}

function resolveStruct(
  environment: ModuleEnvironment,
  type: TypeNode
): StructDeclaration | null {
  if (type.type !== "NamedType") {
    return null;
  }

  const symbol = environment.types.get(type.name);
  if (symbol?.structDeclaration) {
    return symbol.structDeclaration;
  }

  if (symbol?.typeAlias) {
    return resolveStruct(environment, symbol.typeAlias.valueType);
  }

  return null;
}

function resolveClassMethod(
  environment: ModuleEnvironment,
  type: TypeNode,
  methodName: string
): TypeNode | null {
  const baseName =
    type.type === "GenericType" ? type.name : type.type === "NamedType" ? type.name : null;
  if (!baseName) {
    return null;
  }

  const symbol = environment.types.get(baseName);
  const method = symbol?.classMethods?.get(methodName);
  if (!method?.functionType) {
    return null;
  }

  return {
    type: "FunctionType",
    params: method.functionType.params.map((param) => substituteTypeParameter(param, type)),
    returnType: substituteTypeParameter(method.functionType.returnType, type),
    location: method.location
  };
}

interface PrimitiveExtensionMatch {
  nativeName: string;
  remainingParams: TypeNode[];
  returnType: TypeNode;
}

function resolvePrimitiveExtension(
  environment: ModuleEnvironment,
  scope: Scope,
  receiverType: TypeNode,
  methodName: string
): PrimitiveExtensionMatch | null {
  for (const namespaceSymbol of scope.allNamespaceSymbols()) {
    const member = namespaceSymbol.namespaceMembers?.get(methodName);
    if (!member?.functionType || !member.nativeName) { continue; }
    const params = member.functionType.params;
    if (params.length < 1) { continue; }
    const firstParam = params[0]!;
    const subs = new Map<string, TypeNode>();
    collectGenericSubstitutions(firstParam, receiverType, subs);
    const substituted = applyGenericSubstitution(firstParam, subs);
    if (!typesEqual(environment, substituted, receiverType)) { continue; }
    return {
      nativeName: member.nativeName,
      remainingParams: params.slice(1).map((p) => applyGenericSubstitution(p, subs)),
      returnType: applyGenericSubstitution(member.functionType.returnType, subs)
    };
  }
  return null;
}

function resolveClassProperty(
  environment: ModuleEnvironment,
  type: TypeNode,
  methodName: string
): TypeNode | null {
  const baseName =
    type.type === "GenericType" ? type.name : type.type === "NamedType" ? type.name : null;
  if (!baseName) {
    return null;
  }

  const symbol = environment.types.get(baseName);
  const method = symbol?.classMethods?.get(methodName);
  if (!method?.functionType || method.property !== true) {
    return null;
  }

  return method.functionType.returnType;
}

function substituteTypeParameter(type: TypeNode, ownerType: TypeNode): TypeNode {
  if (
    type.type === "NamedType" &&
    type.name === "T" &&
    ownerType.type === "GenericType" &&
    ownerType.typeArgs[0]
  ) {
    return ownerType.typeArgs[0]!;
  }

  if (type.type === "ArrayType") {
    return {
      ...type,
      elementType: substituteTypeParameter(type.elementType, ownerType)
    };
  }

  return type;
}

function resolveTupleType(
  environment: ModuleEnvironment,
  type: TypeNode
): (TypeNode & { type: "TupleType" }) | null {
  if (type.type === "TupleType") {
    return type;
  }

  if (type.type === "NamedType") {
    const symbol = environment.types.get(type.name);
    if (symbol?.typeAlias) {
      return resolveTupleType(environment, symbol.typeAlias.valueType);
    }
  }

  return null;
}

function namedType(name: string, location: SourceLocation): TypeNode {
  return {
    type: "NamedType",
    name,
    location
  };
}

function typeToString(type: TypeNode): string {
  if (type.type === "TupleType") {
    return `[${type.elements.map(typeToString).join(", ")}]`;
  }

  if (type.type === "ArrayType") {
    return `${typeToString(type.elementType)}[]`;
  }

  if (type.type === "GenericType") {
    return `${type.name}<${type.typeArgs.map(typeToString).join(", ")}>`;
  }

  if (type.type === "FunctionType") {
    return `function(${type.params.map(typeToString).join(", ")}): ${typeToString(type.returnType)}`;
  }

  if (type.type === "PointerType") {
    return `${typeToString(type.pointee)}*`;
  }

  if (type.type === "ReferenceType") {
    return `${typeToString(type.referent)}&`;
  }

  if (type.type === "ConstType") {
    return `const ${typeToString(type.valueType)}`;
  }

  if (type.type === "OptionalType") {
    return `${typeToString(type.valueType)}?`;
  }

  if (type.type === "UnionType") {
    return type.options.map(typeToString).join(" | ");
  }

  return type.name;
}

function declareSymbol(target: Map<string, SemanticSymbol>, symbol: SemanticSymbol): void {
  if (target.has(symbol.name)) {
    throw new DoublemintDiagnostic({
      code: "DLM4015",
      severity: "error",
      message: `Duplicate symbol "${symbol.name}".`,
      location: symbol.location
    });
  }

  target.set(symbol.name, symbol);
}

class Scope {
  private readonly locals = new Map<string, SemanticSymbol>();

  constructor(
    private readonly globals: Map<string, SemanticSymbol>,
    private readonly parent?: Scope
  ) {}

  declare(symbol: SemanticSymbol): void {
    declareSymbol(this.locals, symbol);
  }

  lookup(name: string): SemanticSymbol | undefined {
    return this.locals.get(name) ?? this.parent?.lookup(name) ?? this.globals.get(name);
  }

  createChild(): Scope {
    return new Scope(this.globals, this);
  }

  *allNamespaceSymbols(): Iterable<SemanticSymbol> {
    const seen = new Set<string>();
    let current: Scope | undefined = this;
    while (current !== undefined) {
      for (const symbol of current.locals.values()) {
        if (symbol.kind === "namespace" && !seen.has(symbol.name)) {
          seen.add(symbol.name);
          yield symbol;
        }
      }
      current = current.parent;
    }
    for (const symbol of this.globals.values()) {
      if (symbol.kind === "namespace" && !seen.has(symbol.name)) {
        seen.add(symbol.name);
        yield symbol;
      }
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
