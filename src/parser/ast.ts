import type { SourceLocation } from "../lexer/token.js";

export interface Program {
  type: "Program";
  sourceFile: string;
  body: Declaration[];
}

export type Declaration =
  | ImportDeclaration
  | TypeAliasDeclaration
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
  declarations: FunctionDeclaration[];
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
  location: SourceLocation;
}

export interface Parameter {
  type: "Parameter";
  id: string;
  valueType: TypeNode;
  location: SourceLocation;
}

export type TypeNode = NamedTypeNode | TupleTypeNode;

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

export type Statement =
  | VariableDeclaration
  | ReturnStatement
  | ExpressionStatement;

export interface VariableDeclaration {
  type: "VariableDeclaration";
  kind: "let" | "const";
  id: string;
  valueType: TypeNode;
  init: Expression | null;
  location: SourceLocation;
}

export interface ReturnStatement {
  type: "ReturnStatement";
  argument: Expression | null;
  location: SourceLocation;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
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
  | CopyExpression
  | CastExpression;

export interface IdentifierExpression {
  type: "Identifier";
  name: string;
  location: SourceLocation;
}

export interface LiteralExpression {
  type: "Literal";
  value: string | number;
  raw: string;
  literalKind: "string" | "number";
  location: SourceLocation;
}

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: "+" | "-" | "*" | "/";
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
