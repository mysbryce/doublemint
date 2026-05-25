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
  | ExternBlockDeclaration
  | FunctionDeclaration;

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
  | ConstTypeNode;

export interface NamedTypeNode {
  type: "NamedType";
  name: string;
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

export type Statement =
  | VariableDeclaration
  | DestructuringDeclaration
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | SwitchStatement
  | DeferStatement
  | ExpressionStatement;

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
  | CastExpression;

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

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface AssignmentExpression {
  type: "AssignmentExpression";
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface CallExpression {
  type: "CallExpression";
  callee: Expression;
  arguments: Expression[];
  location: SourceLocation;
}

export interface MemberExpression {
  type: "MemberExpression";
  object: Expression;
  property: string;
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
  body: Expression;
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
