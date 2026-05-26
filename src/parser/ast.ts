import type { SourceLocation } from "../lexer/token.js";

export interface Program {
  type: "Program";
  sourceFile: string;
  body: Declaration[];
}

export type Declaration =
  | ImportDeclaration
  | TypeAliasDeclaration
  | ExternTypeDeclaration
  | StructDeclaration
  | EnumDeclaration
  | ExternBlockDeclaration
  | FunctionDeclaration;

export interface EnumDeclaration {
  type: "EnumDeclaration";
  exported: boolean;
  id: string;
  variants: string[];
  location: SourceLocation;
}

export interface ImportDeclaration {
  type: "ImportDeclaration";
  typeOnly: boolean;
  specifiers: string[];
  source: string;
  location: SourceLocation;
}

export interface TypeAliasDeclaration {
  type: "TypeAliasDeclaration";
  exported: boolean;
  id: string;
  valueType: TypeNode;
  location: SourceLocation;
}

export interface StructDeclaration {
  type: "StructDeclaration";
  exported: boolean;
  id: string;
  fields: StructField[];
  location: SourceLocation;
}

export interface StructField {
  type: "StructField";
  id: string;
  valueType: TypeNode;
  location: SourceLocation;
}

export interface ExternBlockDeclaration {
  type: "ExternBlockDeclaration";
  source: string;
  declarations: (ExternTypeDeclaration | FunctionDeclaration)[];
  location: SourceLocation;
}

export interface ExternTypeDeclaration {
  type: "ExternTypeDeclaration";
  id: string;
  location: SourceLocation;
}

export interface FunctionDeclaration {
  type: "FunctionDeclaration";
  exported: boolean;
  id: string;
  params: Parameter[];
  returnType: TypeNode;
  body: Statement[];
  extern: boolean;
  async?: boolean;
  nativeName?: string;
  location: SourceLocation;
}

export interface Parameter {
  type: "Parameter";
  id: string;
  valueType: TypeNode;
  location: SourceLocation;
}

export type TypeNode =
  | NamedTypeNode
  | TupleTypeNode
  | ArrayTypeNode
  | FunctionTypeNode
  | PointerTypeNode
  | ReferenceTypeNode
  | ConstTypeNode
  | GenericTypeNode
  | OptionalTypeNode
  | UnionTypeNode;

export interface NamedTypeNode {
  type: "NamedType";
  name: string;
  location: SourceLocation;
}

export interface GenericTypeNode {
  type: "GenericType";
  name: string;
  typeArgs: TypeNode[];
  location: SourceLocation;
}

export interface TupleTypeNode {
  type: "TupleType";
  elements: TypeNode[];
  location: SourceLocation;
}

export interface ArrayTypeNode {
  type: "ArrayType";
  elementType: TypeNode;
  location: SourceLocation;
}

export interface FunctionTypeNode {
  type: "FunctionType";
  params: TypeNode[];
  returnType: TypeNode;
  location: SourceLocation;
}

export interface PointerTypeNode {
  type: "PointerType";
  pointee: TypeNode;
  location: SourceLocation;
}

export interface ReferenceTypeNode {
  type: "ReferenceType";
  referent: TypeNode;
  location: SourceLocation;
}

export interface ConstTypeNode {
  type: "ConstType";
  valueType: TypeNode;
  location: SourceLocation;
}

export interface OptionalTypeNode {
  type: "OptionalType";
  valueType: TypeNode;
  location: SourceLocation;
}

export interface UnionTypeNode {
  type: "UnionType";
  options: TypeNode[];
  location: SourceLocation;
}

export type Statement =
  | VariableDeclaration
  | DestructuringDeclaration
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ForOfStatement
  | SwitchStatement
  | MatchStatement
  | DeferStatement
  | ExpressionStatement;

export interface ForOfStatement {
  type: "ForOfStatement";
  binding: { kind: "let" | "const"; id: string; valueType: TypeNode | null; location: SourceLocation };
  iterable: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface MatchStatement {
  type: "MatchStatement";
  discriminant: Expression;
  arms: MatchArm[];
  location: SourceLocation;
}

export interface MatchArm {
  type: "MatchArm";
  pattern: MatchPattern;
  guard?: Expression;
  body: Statement[];
  location: SourceLocation;
}

export type MatchPattern =
  | { kind: "wildcard"; location: SourceLocation }
  | { kind: "expression"; expression: Expression; location: SourceLocation };

export interface VariableDeclaration {
  type: "VariableDeclaration";
  kind: "let" | "const";
  id: string;
  valueType: TypeNode;
  init: Expression | null;
  location: SourceLocation;
}

export interface DestructuringDeclaration {
  type: "DestructuringDeclaration";
  kind: "let" | "const";
  ids: string[];
  init: Expression;
  location: SourceLocation;
}

export interface ReturnStatement {
  type: "ReturnStatement";
  argument: Expression | null;
  location: SourceLocation;
}

export interface IfStatement {
  type: "IfStatement";
  condition: Expression;
  thenBranch: Statement[];
  elseBranch: Statement[];
  location: SourceLocation;
}

export interface WhileStatement {
  type: "WhileStatement";
  condition: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ForStatement {
  type: "ForStatement";
  init: VariableDeclaration | Expression | null;
  condition: Expression | null;
  increment: Expression | null;
  body: Statement[];
  location: SourceLocation;
}

export interface SwitchStatement {
  type: "SwitchStatement";
  discriminant: Expression;
  cases: SwitchCase[];
  defaultBranch: Statement[];
  location: SourceLocation;
}

export interface SwitchCase {
  type: "SwitchCase";
  test: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
  location: SourceLocation;
}

export interface DeferStatement {
  type: "DeferStatement";
  expression: Expression;
  location: SourceLocation;
}

export type Expression =
  | IdentifierExpression
  | LiteralExpression
  | UnaryExpression
  | AwaitExpression
  | BinaryExpression
  | AssignmentExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ArrayLiteralExpression
  | TupleLiteralExpression
  | StructLiteralExpression
  | LambdaExpression
  | CopyExpression
  | CastExpression
  | NewExpression
  | ConditionalExpression
  | MatchExpression
  | TemplateLiteralExpression;

export interface MatchExpression {
  type: "MatchExpression";
  discriminant: Expression;
  arms: MatchExpressionArm[];
  location: SourceLocation;
}

export interface MatchExpressionArm {
  type: "MatchExpressionArm";
  pattern: MatchPattern;
  guard?: Expression;
  expression: Expression;
  location: SourceLocation;
}

export interface IdentifierExpression {
  type: "Identifier";
  name: string;
  location: SourceLocation;
}

export interface LiteralExpression {
  type: "Literal";
  value: string | number | boolean | null;
  raw: string;
  literalKind: "string" | "number" | "bool" | "null";
  location: SourceLocation;
}

export interface AwaitExpression {
  type: "AwaitExpression";
  argument: Expression;
  location: SourceLocation;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: "-" | "!" | "++" | "--" | "~";
  argument: Expression;
  postfix?: boolean;
  location: SourceLocation;
}

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||" | "&" | "|" | "^" | "<<" | ">>";
  left: Expression;
  right: Expression;
  /** Set by the checker when both operands are strings, so the emitter can wrap them in std::string. */
  stringConcat?: boolean;
  location: SourceLocation;
}

export interface AssignmentExpression {
  type: "AssignmentExpression";
  operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=";
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface CallExpression {
  type: "CallExpression";
  callee: Expression;
  arguments: Expression[];
  typeArgs?: TypeNode[];
  location: SourceLocation;
}

export interface MemberExpression {
  type: "MemberExpression";
  object: Expression;
  property: string;
  /** When true (set by the checker), the emitter should call the underlying 0-arg method automatically. */
  autoInvoke?: boolean;
  /** When set (by the checker), a primitive value is calling a namespace function via `value.method(args)` sugar. */
  primitiveExtensionNative?: string;
  location: SourceLocation;
}

export interface IndexExpression {
  type: "IndexExpression";
  object: Expression;
  index: Expression;
  accessKind?: "array" | "tuple";
  tupleIndex?: number;
  location: SourceLocation;
}

export interface ArrayLiteralExpression {
  type: "ArrayLiteral";
  elements: Expression[];
  location: SourceLocation;
}

export interface TupleLiteralExpression {
  type: "TupleLiteral";
  elements: Expression[];
  location: SourceLocation;
}

export interface StructLiteralExpression {
  type: "StructLiteral";
  typeName: string;
  fields: StructLiteralField[];
  location: SourceLocation;
}

export interface StructLiteralField {
  type: "StructLiteralField";
  id: string;
  value: Expression;
  location: SourceLocation;
}

export interface LambdaExpression {
  type: "LambdaExpression";
  params: Parameter[];
  returnType: TypeNode;
  /** Single-expression body. Used when blockBody is undefined. */
  body: Expression;
  /** Multi-statement block body. When set, the emitter uses it and ignores `body`. */
  blockBody?: Statement[];
  location: SourceLocation;
}

export interface CopyExpression {
  type: "CopyExpression";
  argument: Expression;
  location: SourceLocation;
}

export interface CastExpression {
  type: "CastExpression";
  expression: Expression;
  targetType: TypeNode;
  location: SourceLocation;
}

export interface NewExpression {
  type: "NewExpression";
  targetType: TypeNode;
  arguments: Expression[];
  location: SourceLocation;
}

export interface ConditionalExpression {
  type: "ConditionalExpression";
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
  location: SourceLocation;
}

export interface TemplateLiteralExpression {
  type: "TemplateLiteral";
  parts: TemplatePart[];
  location: SourceLocation;
}

export type TemplatePart =
  | { kind: "string"; value: string }
  | { kind: "identifier"; name: string };
