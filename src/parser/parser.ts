import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { Token, TokenKind } from "../lexer/token.js";
import type {
  Declaration,
  ExternBlockDeclaration,
  Expression,
  FunctionDeclaration,
  ImportDeclaration,
  Parameter,
  Program,
  Statement,
  StructDeclaration,
  StructField,
  TypeAliasDeclaration,
  TypeNode,
  VariableDeclaration
} from "./ast.js";

export function parseProgram(tokens: Token[], sourceFile: string): Program {
  return new Parser(tokens, sourceFile).parseProgram();
}

class Parser {
  private current = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly sourceFile: string
  ) {}

  parseProgram(): Program {
    const body: Declaration[] = [];

    while (!this.isAtEnd()) {
      body.push(this.declaration());
    }

    return {
      type: "Program",
      sourceFile: this.sourceFile,
      body
    };
  }

  private declaration(): Declaration {
    const exported = this.match("EXPORT");

    if (this.match("IMPORT")) {
      if (exported) {
        throw this.error(this.previous(), "DLM2001", "Imports cannot be exported.");
      }

      return this.importDeclaration();
    }

    if (this.match("TYPE")) {
      return this.typeAliasDeclaration(exported);
    }

    if (this.match("STRUCT")) {
      return this.structDeclaration(exported);
    }

    if (this.match("EXTERN")) {
      if (exported) {
        throw this.error(this.previous(), "DLM2002", "Extern blocks cannot be exported.");
      }

      return this.externBlockDeclaration();
    }

    if (this.match("FUNCTION")) {
      return this.functionDeclaration(exported, false);
    }

    throw this.error(
      this.peek(),
      "DLM2003",
      `Expected declaration but found ${this.peek().kind}.`
    );
  }

  private importDeclaration(): ImportDeclaration {
    const importToken = this.previous();
    const typeOnly = this.match("TYPE");
    this.consume("LEFT_BRACE", "DLM2004", "Expected '{' after import.");
    const specifiers = this.identifierList("import specifier");
    this.consume("RIGHT_BRACE", "DLM2005", "Expected '}' after import specifiers.");
    this.consume("FROM", "DLM2006", "Expected 'from' after import specifiers.");
    const source = this.consume(
      "STRING_LITERAL",
      "DLM2007",
      "Expected import source string."
    );
    this.consume("SEMICOLON", "DLM2008", "Expected ';' after import.");

    return {
      type: "ImportDeclaration",
      typeOnly,
      specifiers,
      source: unquote(source.lexeme),
      location: importToken.location
    };
  }

  private typeAliasDeclaration(exported: boolean): TypeAliasDeclaration {
    const typeToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2009", "Expected type alias name.");
    this.consume("EQUAL", "DLM2010", "Expected '=' after type alias name.");
    const valueType = this.typeNode();
    this.consume("SEMICOLON", "DLM2011", "Expected ';' after type alias.");

    return {
      type: "TypeAliasDeclaration",
      exported,
      id: id.lexeme,
      valueType,
      location: typeToken.location
    };
  }

  private structDeclaration(exported: boolean): StructDeclaration {
    const structToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2012", "Expected struct name.");
    this.consume("LEFT_BRACE", "DLM2013", "Expected '{' before struct fields.");
    const fields: StructField[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      fields.push(this.structField());
    }

    this.consume("RIGHT_BRACE", "DLM2014", "Expected '}' after struct fields.");

    return {
      type: "StructDeclaration",
      exported,
      id: id.lexeme,
      fields,
      location: structToken.location
    };
  }

  private structField(): StructField {
    const id = this.consume("IDENTIFIER", "DLM2015", "Expected struct field name.");
    this.consume("COLON", "DLM2016", "Expected ':' after struct field name.");
    const valueType = this.typeNode();
    this.consume("SEMICOLON", "DLM2017", "Expected ';' after struct field.");

    return {
      type: "StructField",
      id: id.lexeme,
      valueType,
      location: id.location
    };
  }

  private externBlockDeclaration(): ExternBlockDeclaration {
    const externToken = this.previous();
    const source = this.consume("STRING_LITERAL", "DLM2018", "Expected extern source.");
    this.consume("LEFT_BRACE", "DLM2019", "Expected '{' before extern declarations.");
    const declarations: FunctionDeclaration[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      this.consume("FUNCTION", "DLM2020", "Expected function declaration in extern block.");
      declarations.push(this.functionDeclaration(false, true));
    }

    this.consume("RIGHT_BRACE", "DLM2021", "Expected '}' after extern block.");

    return {
      type: "ExternBlockDeclaration",
      source: unquote(source.lexeme),
      declarations,
      location: externToken.location
    };
  }

  private functionDeclaration(
    exported: boolean,
    extern: boolean
  ): FunctionDeclaration {
    const functionToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2022", "Expected function name.");
    this.consume("LEFT_PAREN", "DLM2023", "Expected '(' after function name.");
    const params = this.parameters();
    this.consume("RIGHT_PAREN", "DLM2024", "Expected ')' after parameters.");
    this.consume("COLON", "DLM2025", "Expected ':' before function return type.");
    const returnType = this.typeNode();

    if (extern) {
      this.consume("SEMICOLON", "DLM2026", "Expected ';' after extern function.");
      return {
        type: "FunctionDeclaration",
        exported,
        id: id.lexeme,
        params,
        returnType,
        body: [],
        extern,
        location: functionToken.location
      };
    }

    const body = this.block();
    return {
      type: "FunctionDeclaration",
      exported,
      id: id.lexeme,
      params,
      returnType,
      body,
      extern,
      location: functionToken.location
    };
  }

  private parameters(): Parameter[] {
    const params: Parameter[] = [];

    if (this.check("RIGHT_PAREN")) {
      return params;
    }

    do {
      const id = this.consume("IDENTIFIER", "DLM2027", "Expected parameter name.");
      this.consume("COLON", "DLM2028", "Expected ':' after parameter name.");
      params.push({
        type: "Parameter",
        id: id.lexeme,
        valueType: this.typeNode(),
        location: id.location
      });
    } while (this.match("COMMA"));

    return params;
  }

  private block(): Statement[] {
    this.consume("LEFT_BRACE", "DLM2029", "Expected '{' before function body.");
    const statements: Statement[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      statements.push(this.statement());
    }

    this.consume("RIGHT_BRACE", "DLM2030", "Expected '}' after function body.");
    return statements;
  }

  private statement(): Statement {
    if (this.match("LET")) {
      return this.variableDeclaration("let");
    }

    if (this.match("CONST")) {
      return this.variableDeclaration("const");
    }

    if (this.match("RETURN")) {
      return this.returnStatement();
    }

    if (this.match("IF")) {
      return this.ifStatement();
    }

    if (this.match("WHILE")) {
      return this.whileStatement();
    }

    if (this.match("FOR")) {
      return this.forStatement();
    }

    return this.expressionStatement();
  }

  private variableDeclaration(kind: "let" | "const"): VariableDeclaration {
    const declarationToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2031", `Expected ${kind} variable name.`);
    this.consume("COLON", "DLM2032", `Expected ':' after ${kind} variable name.`);
    const valueType = this.typeNode();
    const init = this.match("EQUAL") ? this.expression() : null;
    this.consume("SEMICOLON", "DLM2033", `Expected ';' after ${kind} declaration.`);

    return {
      type: "VariableDeclaration",
      kind,
      id: id.lexeme,
      valueType,
      init,
      location: declarationToken.location
    };
  }

  private returnStatement(): Statement {
    const returnToken = this.previous();
    const argument = this.check("SEMICOLON") ? null : this.expression();
    this.consume("SEMICOLON", "DLM2034", "Expected ';' after return statement.");

    return {
      type: "ReturnStatement",
      argument,
      location: returnToken.location
    };
  }

  private ifStatement(): Statement {
    const ifToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2043", "Expected '(' after if.");
    const condition = this.expression();
    this.consume("RIGHT_PAREN", "DLM2044", "Expected ')' after if condition.");
    const thenBranch = this.block();
    const elseBranch = this.match("ELSE") ? this.block() : [];

    return {
      type: "IfStatement",
      condition,
      thenBranch,
      elseBranch,
      location: ifToken.location
    };
  }

  private whileStatement(): Statement {
    const whileToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2048", "Expected '(' after while.");
    const condition = this.expression();
    this.consume("RIGHT_PAREN", "DLM2049", "Expected ')' after while condition.");
    const body = this.block();

    return {
      type: "WhileStatement",
      condition,
      body,
      location: whileToken.location
    };
  }

  private forStatement(): Statement {
    const forToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2050", "Expected '(' after for.");
    const init = this.forInit();
    const condition = this.check("SEMICOLON") ? null : this.expression();
    this.consume("SEMICOLON", "DLM2051", "Expected ';' after for condition.");
    const increment = this.check("RIGHT_PAREN") ? null : this.expression();
    this.consume("RIGHT_PAREN", "DLM2052", "Expected ')' after for clauses.");
    const body = this.block();

    return {
      type: "ForStatement",
      init,
      condition,
      increment,
      body,
      location: forToken.location
    };
  }

  private forInit(): VariableDeclaration | Expression | null {
    if (this.match("SEMICOLON")) {
      return null;
    }

    if (this.match("LET")) {
      return this.variableDeclaration("let");
    }

    if (this.match("CONST")) {
      return this.variableDeclaration("const");
    }

    const init = this.expression();
    this.consume("SEMICOLON", "DLM2053", "Expected ';' after for initializer.");
    return init;
  }

  private expressionStatement(): Statement {
    const expression = this.expression();
    this.consume("SEMICOLON", "DLM2035", "Expected ';' after expression.");

    return {
      type: "ExpressionStatement",
      expression,
      location: expression.location
    };
  }

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    const expression = this.equality();

    if (this.match("EQUAL")) {
      return {
        type: "AssignmentExpression",
        left: expression,
        right: this.assignment(),
        location: expression.location
      };
    }

    return expression;
  }

  private equality(): Expression {
    let expression = this.comparison();

    while (this.match("EQUAL_EQUAL", "BANG_EQUAL")) {
      const operator = this.previous();
      expression = {
        type: "BinaryExpression",
        operator: operator.lexeme as "==" | "!=",
        left: expression,
        right: this.comparison(),
        location: expression.location
      };
    }

    return expression;
  }

  private comparison(): Expression {
    let expression = this.cast();

    while (this.match("LESS", "LESS_EQUAL", "GREATER", "GREATER_EQUAL")) {
      const operator = this.previous();
      expression = {
        type: "BinaryExpression",
        operator: operator.lexeme as "<" | "<=" | ">" | ">=",
        left: expression,
        right: this.cast(),
        location: expression.location
      };
    }

    return expression;
  }

  private cast(): Expression {
    let expression = this.term();

    while (this.match("AS")) {
      expression = {
        type: "CastExpression",
        expression,
        targetType: this.typeNode(),
        location: expression.location
      };
    }

    return expression;
  }

  private term(): Expression {
    let expression = this.factor();

    while (this.match("PLUS", "MINUS")) {
      const operator = this.previous();
      expression = {
        type: "BinaryExpression",
        operator: operator.lexeme as "+" | "-",
        left: expression,
        right: this.factor(),
        location: expression.location
      };
    }

    return expression;
  }

  private factor(): Expression {
    let expression = this.unary();

    while (this.match("STAR", "SLASH")) {
      const operator = this.previous();
      expression = {
        type: "BinaryExpression",
        operator: operator.lexeme as "*" | "/",
        left: expression,
        right: this.unary(),
        location: expression.location
      };
    }

    return expression;
  }

  private unary(): Expression {
    if (this.match("COPY")) {
      const copyToken = this.previous();
      return {
        type: "CopyExpression",
        argument: this.unary(),
        location: copyToken.location
      };
    }

    return this.call();
  }

  private call(): Expression {
    let expression = this.primary();

    while (true) {
      if (this.match("LEFT_PAREN")) {
        expression = {
          type: "CallExpression",
          callee: expression,
          arguments: this.arguments(),
          location: expression.location
        };
        this.consume("RIGHT_PAREN", "DLM2036", "Expected ')' after arguments.");
      } else if (this.match("DOT")) {
        const property = this.consume("IDENTIFIER", "DLM2037", "Expected property name.");
        expression = {
          type: "MemberExpression",
          object: expression,
          property: property.lexeme,
          location: expression.location
        };
      } else if (this.match("LEFT_BRACKET")) {
        const index = this.expression();
        this.consume("RIGHT_BRACKET", "DLM2045", "Expected ']' after index expression.");
        expression = {
          type: "IndexExpression",
          object: expression,
          index,
          location: expression.location
        };
      } else {
        return expression;
      }
    }
  }

  private arguments(): Expression[] {
    const args: Expression[] = [];

    if (this.check("RIGHT_PAREN")) {
      return args;
    }

    do {
      args.push(this.expression());
    } while (this.match("COMMA"));

    return args;
  }

  private primary(): Expression {
    if (this.match("IDENTIFIER")) {
      const id = this.previous();
      return {
        type: "Identifier",
        name: id.lexeme,
        location: id.location
      };
    }

    if (this.match("NUMBER_LITERAL")) {
      const literal = this.previous();
      return {
        type: "Literal",
        value: Number(literal.lexeme),
        raw: literal.lexeme,
        literalKind: "number",
        location: literal.location
      };
    }

    if (this.match("STRING_LITERAL")) {
      const literal = this.previous();
      return {
        type: "Literal",
        value: unquote(literal.lexeme),
        raw: literal.lexeme,
        literalKind: "string",
        location: literal.location
      };
    }

    if (this.match("TRUE", "FALSE")) {
      const literal = this.previous();
      return {
        type: "Literal",
        value: literal.kind === "TRUE",
        raw: literal.lexeme,
        literalKind: "bool",
        location: literal.location
      };
    }

    if (this.match("LEFT_PAREN")) {
      const expression = this.expression();
      this.consume("RIGHT_PAREN", "DLM2038", "Expected ')' after expression.");
      return expression;
    }

    if (this.match("LEFT_BRACKET")) {
      const arrayToken = this.previous();
      const elements: Expression[] = [];

      if (!this.check("RIGHT_BRACKET")) {
        do {
          elements.push(this.expression());
        } while (this.match("COMMA"));
      }

      this.consume("RIGHT_BRACKET", "DLM2046", "Expected ']' after array literal.");
      return {
        type: "ArrayLiteral",
        elements,
        location: arrayToken.location
      };
    }

    throw this.error(this.peek(), "DLM2039", `Expected expression but found ${this.peek().kind}.`);
  }

  private typeNode(): TypeNode {
    if (this.match("LEFT_BRACKET")) {
      const tupleToken = this.previous();
      const elements: TypeNode[] = [];

      if (!this.check("RIGHT_BRACKET")) {
        do {
          elements.push(this.typeNode());
        } while (this.match("COMMA"));
      }

      this.consume("RIGHT_BRACKET", "DLM2040", "Expected ']' after tuple type.");
      return {
        type: "TupleType",
        elements,
        location: tupleToken.location
      };
    }

    const id = this.consume("IDENTIFIER", "DLM2041", "Expected type name.");
    let typeNode: TypeNode = {
      type: "NamedType",
      name: id.lexeme,
      location: id.location
    };

    while (this.match("LEFT_BRACKET")) {
      this.consume("RIGHT_BRACKET", "DLM2047", "Expected ']' after array type.");
      typeNode = {
        type: "ArrayType",
        elementType: typeNode,
        location: id.location
      };
    }

    return typeNode;
  }

  private identifierList(context: string): string[] {
    const identifiers: string[] = [];

    do {
      identifiers.push(
        this.consume("IDENTIFIER", "DLM2042", `Expected ${context}.`).lexeme
      );
    } while (this.match("COMMA"));

    return identifiers;
  }

  private match(...kinds: TokenKind[]): boolean {
    for (const kind of kinds) {
      if (this.check(kind)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  private consume(kind: TokenKind, code: string, message: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }

    throw this.error(this.peek(), code, message);
  }

  private check(kind: TokenKind): boolean {
    if (this.isAtEnd()) {
      return kind === "EOF";
    }

    return this.peek().kind === kind;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }

    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().kind === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.peek();
  }

  private error(token: Token, code: string, message: string): DoublemintDiagnostic {
    return new DoublemintDiagnostic({
      code,
      severity: "error",
      message,
      location: token.location
    });
  }
}

function unquote(raw: string): string {
  return raw.slice(1, -1);
}
