import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { SourceLocation } from "../lexer/token.js";
import type {
  AssignmentExpression,
  Declaration,
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

type SymbolKind = "variable" | "function" | "type" | "struct";
type Mutability = "mutable" | "immutable";

interface SemanticSymbol {
  name: string;
  kind: SymbolKind;
  valueType?: TypeNode;
  functionType?: FunctionType;
  structDeclaration?: StructDeclaration;
  typeAlias?: TypeAliasDeclaration;
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

const builtInTypes = new Set(["void", "int", "float", "double", "string", "bool"]);
const numericTypes = new Set(["int", "float", "double", "number"]);

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
      case "ExternBlockDeclaration":
        for (const externDeclaration of declaration.declarations) {
          registerFunction(environment, externDeclaration);
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
    case "ExpressionStatement":
      inferExpressionType(environment, scope, statement.expression);
      break;
    default:
      assertNever(statement);
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
        expression.literalKind === "number" ? "number" : expression.literalKind === "bool" ? "bool" : "string",
        expression.location
      );
    case "BinaryExpression": {
      const left = inferExpressionType(environment, scope, expression.left);
      const right = inferExpressionType(environment, scope, expression.right);

      if (isEqualityOperator(expression.operator)) {
        if (
          !typesEqual(environment, left, right) &&
          !(isNumericType(environment, left) && isNumericType(environment, right))
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
    case "StructLiteral":
      return inferStructLiteralType(environment, scope, expression);
    case "CopyExpression":
      return inferExpressionType(environment, scope, expression.argument);
    case "CastExpression":
      assertKnownType(environment, expression.targetType);
      inferExpressionType(environment, scope, expression.expression);
      return expression.targetType;
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
  if (expression.callee.type !== "Identifier") {
    throw new DoublemintDiagnostic({
      code: "DLM4006",
      severity: "error",
      message: "Only direct function calls are supported.",
      location: expression.location
    });
  }

  if (expression.callee.name === "print") {
    if (expression.arguments.length !== 1) {
      throw new DoublemintDiagnostic({
        code: "DLM4017",
        severity: "error",
        message: `Function "print" expects 1 argument but got ${expression.arguments.length}.`,
        location: expression.location
      });
    }

    inferExpressionType(environment, scope, expression.arguments[0]!);
    return namedType("void", expression.location);
  }

  const callee = scope.lookup(expression.callee.name);

  if (!callee?.functionType) {
    throw new DoublemintDiagnostic({
      code: "DLM4007",
      severity: "error",
      message: `"${expression.callee.name}" is not a function.`,
      location: expression.callee.location
    });
  }

  if (callee.functionType.params.length !== expression.arguments.length) {
    throw new DoublemintDiagnostic({
      code: "DLM4008",
      severity: "error",
      message: `Function "${callee.name}" expects ${callee.functionType.params.length} arguments but got ${expression.arguments.length}.`,
      location: expression.location
    });
  }

  for (let index = 0; index < expression.arguments.length; index += 1) {
    const actualType = inferExpressionType(environment, scope, expression.arguments[index]!);
    const expectedType = callee.functionType.params[index]!;
    assertAssignable(environment, expectedType, actualType, expression.arguments[index]!.location);
  }

  return callee.functionType.returnType;
}

function inferMemberType(
  environment: ModuleEnvironment,
  scope: Scope,
  expression: MemberExpression
): TypeNode {
  const objectType = inferExpressionType(environment, scope, expression.object);
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

  if (builtInTypes.has(type.name) || type.name === "number") {
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

function isEqualityOperator(operator: string): boolean {
  return operator === "==" || operator === "!=";
}

function isOrderingOperator(operator: string): boolean {
  return operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
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
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
