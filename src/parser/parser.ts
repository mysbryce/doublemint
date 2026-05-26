import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { Token, TokenKind } from "../lexer/token.js";
import type {
  Declaration,
  EnumDeclaration,
  MatchArm,
  MatchExpression,
  MatchExpressionArm,
  MatchPattern,
  ExternTypeDeclaration,
  ExternBlockDeclaration,
  Expression,
  FunctionDeclaration,
  ImportDeclaration,
  Parameter,
  Program,
  Statement,
  StructDeclaration,
  StructField,
  StructLiteralField,
  SwitchCase,
  TemplatePart,
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

    if (this.match("ENUM")) {
      return this.enumDeclaration(exported);
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

  private enumDeclaration(exported: boolean): EnumDeclaration {
    const enumToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2080", "Expected enum name.");
    this.consume("LEFT_BRACE", "DLM2081", "Expected '{' before enum variants.");
    const variants: string[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      const variant = this.consume("IDENTIFIER", "DLM2082", "Expected enum variant name.");
      if (variants.includes(variant.lexeme)) {
        throw this.error(variant, "DLM2083", `Duplicate enum variant "${variant.lexeme}".`);
      }
      variants.push(variant.lexeme);
      if (!this.check("RIGHT_BRACE")) {
        this.consume("COMMA", "DLM2084", "Expected ',' between enum variants.");
      }
    }

    this.consume("RIGHT_BRACE", "DLM2085", "Expected '}' after enum variants.");

    if (variants.length === 0) {
      throw this.error(enumToken, "DLM2086", "Enum must have at least one variant.");
    }

    return {
      type: "EnumDeclaration",
      exported,
      id: id.lexeme,
      variants,
      location: enumToken.location
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
    const declarations: (ExternTypeDeclaration | FunctionDeclaration)[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      if (this.match("TYPE")) {
        declarations.push(this.externTypeDeclaration());
        continue;
      }

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

  private externTypeDeclaration(): ExternTypeDeclaration {
    const typeToken = this.previous();
    const id = this.consume("IDENTIFIER", "DLM2077", "Expected extern type name.");
    this.consume("SEMICOLON", "DLM2078", "Expected ';' after extern type.");

    return {
      type: "ExternTypeDeclaration",
      id: id.lexeme,
      location: typeToken.location
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
      const nativeName = this.match("AS")
        ? unquote(this.consume("STRING_LITERAL", "DLM2079", "Expected native function name after as.").lexeme)
        : undefined;
      this.consume("SEMICOLON", "DLM2026", "Expected ';' after extern function.");
      return {
        type: "FunctionDeclaration",
        exported,
        id: id.lexeme,
        params,
        returnType,
        body: [],
        extern,
        nativeName,
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
      return this.variableOrDestructuringDeclaration("let");
    }

    if (this.match("CONST")) {
      return this.variableOrDestructuringDeclaration("const");
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

    if (this.match("SWITCH")) {
      return this.switchStatement();
    }

    if (this.match("MATCH")) {
      return this.matchStatement();
    }

    if (this.match("DEFER")) {
      return this.deferStatement();
    }

    return this.expressionStatement();
  }

  private variableOrDestructuringDeclaration(kind: "let" | "const"): Statement {
    if (this.check("LEFT_BRACKET")) {
      return this.destructuringDeclaration(kind);
    }

    return this.variableDeclaration(kind);
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

  private destructuringDeclaration(kind: "let" | "const"): Statement {
    const declarationToken = this.previous();
    this.consume("LEFT_BRACKET", "DLM2073", `Expected '[' after ${kind}.`);
    const ids = this.identifierList("destructuring binding");
    this.consume("RIGHT_BRACKET", "DLM2074", "Expected ']' after destructuring bindings.");
    this.consume("EQUAL", "DLM2075", "Expected '=' after destructuring bindings.");
    const init = this.expression();
    this.consume("SEMICOLON", "DLM2076", `Expected ';' after ${kind} destructuring declaration.`);

    return {
      type: "DestructuringDeclaration",
      kind,
      ids,
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

  private switchStatement(): Statement {
    const switchToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2058", "Expected '(' after switch.");
    const discriminant = this.expression();
    this.consume("RIGHT_PAREN", "DLM2059", "Expected ')' after switch value.");
    this.consume("LEFT_BRACE", "DLM2060", "Expected '{' before switch cases.");
    const cases: SwitchCase[] = [];
    let defaultBranch: Statement[] | null = null;

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      if (this.match("CASE")) {
        const caseToken = this.previous();
        const test = this.expression();
        this.consume("COLON", "DLM2061", "Expected ':' after switch case.");
        cases.push({
          type: "SwitchCase" as const,
          test,
          body: this.block(),
          location: caseToken.location
        });
        continue;
      }

      if (this.match("DEFAULT")) {
        if (defaultBranch) {
          throw this.error(this.previous(), "DLM2062", "Switch can only have one default case.");
        }

        this.consume("COLON", "DLM2063", "Expected ':' after switch default.");
        defaultBranch = this.block();
        continue;
      }

      throw this.error(this.peek(), "DLM2064", "Expected switch case or default.");
    }

    this.consume("RIGHT_BRACE", "DLM2065", "Expected '}' after switch.");
    return {
      type: "SwitchStatement",
      discriminant,
      cases,
      defaultBranch: defaultBranch ?? [],
      location: switchToken.location
    };
  }

  private matchStatement(): Statement {
    const matchToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2090", "Expected '(' after match.");
    const discriminant = this.expression();
    this.consume("RIGHT_PAREN", "DLM2091", "Expected ')' after match value.");
    this.consume("LEFT_BRACE", "DLM2092", "Expected '{' before match arms.");
    const arms: MatchArm[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      const armToken = this.peek();
      const pattern = this.matchPattern();
      this.consume("ARROW", "DLM2093", "Expected '=>' after match pattern.");

      let body: Statement[];
      let isBlock = false;
      if (this.check("LEFT_BRACE")) {
        body = this.block();
        isBlock = true;
      } else {
        const expression = this.expression();
        body = [{
          type: "ExpressionStatement",
          expression,
          location: expression.location
        }];
      }

      arms.push({
        type: "MatchArm",
        pattern,
        body,
        location: armToken.location
      });

      if (!this.check("RIGHT_BRACE")) {
        if (isBlock) {
          this.match("COMMA");
        } else {
          this.consume("COMMA", "DLM2094", "Expected ',' between match arms.");
        }
      }
    }

    this.consume("RIGHT_BRACE", "DLM2095", "Expected '}' after match arms.");

    if (arms.length === 0) {
      throw this.error(matchToken, "DLM2096", "Match must have at least one arm.");
    }

    return {
      type: "MatchStatement",
      discriminant,
      arms,
      location: matchToken.location
    };
  }

  private matchExpression(): MatchExpression {
    const matchToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2097", "Expected '(' after match.");
    const discriminant = this.expression();
    this.consume("RIGHT_PAREN", "DLM2098", "Expected ')' after match value.");
    this.consume("LEFT_BRACE", "DLM2099", "Expected '{' before match arms.");
    const arms: MatchExpressionArm[] = [];

    while (!this.check("RIGHT_BRACE") && !this.isAtEnd()) {
      const armToken = this.peek();
      const pattern = this.matchPattern();
      this.consume("ARROW", "DLM2100", "Expected '=>' after match pattern.");
      const expression = this.expression();

      arms.push({
        type: "MatchExpressionArm",
        pattern,
        expression,
        location: armToken.location
      });

      if (!this.check("RIGHT_BRACE")) {
        this.consume("COMMA", "DLM2101", "Expected ',' between match arms.");
      }
    }

    this.consume("RIGHT_BRACE", "DLM2102", "Expected '}' after match arms.");

    if (arms.length === 0) {
      throw this.error(matchToken, "DLM2103", "Match expression must have at least one arm.");
    }

    return {
      type: "MatchExpression",
      discriminant,
      arms,
      location: matchToken.location
    };
  }

  private matchPattern(): MatchPattern {
    if (this.check("IDENTIFIER") && this.peek().lexeme === "_") {
      const token = this.advance();
      return { kind: "wildcard", location: token.location };
    }
    const expr = this.expression();
    return { kind: "expression", expression: expr, location: expr.location };
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

  private deferStatement(): Statement {
    const deferToken = this.previous();
    const expression = this.expression();
    this.consume("SEMICOLON", "DLM2080", "Expected ';' after defer statement.");

    return {
      type: "DeferStatement",
      expression,
      location: deferToken.location
    };
  }

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    const expression = this.ternary();

    if (this.match("EQUAL")) {
      return {
        type: "AssignmentExpression",
        operator: "=",
        left: expression,
        right: this.assignment(),
        location: expression.location
      };
    }

    if (this.match("PLUS_EQUAL", "MINUS_EQUAL", "STAR_EQUAL", "SLASH_EQUAL")) {
      const opToken = this.previous();
      const operator = opToken.lexeme as "+=" | "-=" | "*=" | "/=";
      return {
        type: "AssignmentExpression",
        operator,
        left: expression,
        right: this.assignment(),
        location: expression.location
      };
    }

    return expression;
  }

  private ternary(): Expression {
    const condition = this.logicalOr();
    if (this.match("QUESTION")) {
      const thenExpr = this.expression();
      this.consume("COLON", "DLM2076", "Expected ':' in ternary expression.");
      const elseExpr = this.assignment();
      return {
        type: "ConditionalExpression",
        condition,
        thenBranch: thenExpr,
        elseBranch: elseExpr,
        location: condition.location
      };
    }
    return condition;
  }

  private logicalOr(): Expression {
    let expression = this.logicalAnd();
    while (this.match("PIPE_PIPE")) {
      expression = {
        type: "BinaryExpression",
        operator: "||",
        left: expression,
        right: this.logicalAnd(),
        location: expression.location
      };
    }
    return expression;
  }

  private logicalAnd(): Expression {
    let expression = this.equality();
    while (this.match("AMP_AMP")) {
      expression = {
        type: "BinaryExpression",
        operator: "&&",
        left: expression,
        right: this.equality(),
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

    if (this.match("MINUS", "BANG")) {
      const opToken = this.previous();
      const operator = opToken.lexeme === "!" ? "!" : "-";
      return {
        type: "UnaryExpression",
        operator,
        argument: this.unary(),
        location: opToken.location
      };
    }

    return this.call();
  }

  private call(): Expression {
    let expression = this.primary();
    let pendingTypeArgs: TypeNode[] | undefined;

    while (true) {
      if (this.check("LESS") && this.looksLikeTypeArgumentCall()) {
        this.advance();
        pendingTypeArgs = this.typeList("GREATER");
        this.consume("GREATER", "DLM2073", "Expected '>' after type arguments.");
      } else if (this.match("LEFT_PAREN")) {
        expression = {
          type: "CallExpression",
          callee: expression,
          arguments: this.arguments(),
          typeArgs: pendingTypeArgs,
          location: expression.location
        };
        pendingTypeArgs = undefined;
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
      } else if (this.match("PLUS_PLUS", "MINUS_MINUS")) {
        const opToken = this.previous();
        const operator = opToken.lexeme as "++" | "--";
        expression = {
          type: "UnaryExpression",
          operator,
          argument: expression,
          postfix: true,
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
    if (this.match("FN")) {
      return this.lambdaExpression();
    }

    if (this.match("MATCH")) {
      return this.matchExpression();
    }

    if (this.match("NEW")) {
      const newToken = this.previous();
      const targetType = this.typeNode();
      this.consume("LEFT_PAREN", "DLM2074", "Expected '(' after new type.");
      const args = this.arguments();
      this.consume("RIGHT_PAREN", "DLM2075", "Expected ')' after constructor arguments.");
      return {
        type: "NewExpression",
        targetType,
        arguments: args,
        location: newToken.location
      };
    }

    if (this.match("IDENTIFIER")) {
      const id = this.previous();
      if (this.match("LEFT_BRACE")) {
        return this.structLiteral(id);
      }

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
      const raw = unquote(literal.lexeme);
      if (raw.includes("${")) {
        const parts = splitTemplate(raw);
        return {
          type: "TemplateLiteral",
          parts,
          location: literal.location
        };
      }
      return {
        type: "Literal",
        value: raw,
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

    if (this.match("NULL")) {
      const literal = this.previous();
      return {
        type: "Literal",
        value: null,
        raw: "null",
        literalKind: "null",
        location: literal.location
      };
    }

    if (this.match("LEFT_PAREN")) {
      const tupleToken = this.previous();
      const expression = this.expression();
      if (this.match("COMMA")) {
        const elements = [expression];
        do {
          elements.push(this.expression());
        } while (this.match("COMMA"));
        this.consume("RIGHT_PAREN", "DLM2057", "Expected ')' after tuple literal.");
        return {
          type: "TupleLiteral",
          elements,
          location: tupleToken.location
        };
      }

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

  private lambdaExpression(): Expression {
    const lambdaToken = this.previous();
    this.consume("LEFT_PAREN", "DLM2066", "Expected '(' after fn.");
    const params = this.parameters();
    this.consume("RIGHT_PAREN", "DLM2067", "Expected ')' after lambda parameters.");
    this.consume("COLON", "DLM2068", "Expected ':' before lambda return type.");
    const returnType = this.typeNode();
    this.consume("ARROW", "DLM2069", "Expected '=>' before lambda body.");

    if (this.check("LEFT_BRACE")) {
      const blockBody = this.block();
      return {
        type: "LambdaExpression",
        params,
        returnType,
        body: {
          type: "Literal",
          value: null,
          raw: "null",
          literalKind: "null",
          location: lambdaToken.location
        },
        blockBody,
        location: lambdaToken.location
      };
    }

    const body = this.expression();

    return {
      type: "LambdaExpression",
      params,
      returnType,
      body,
      location: lambdaToken.location
    };
  }

  private structLiteral(typeToken: Token): Expression {
    const fields: StructLiteralField[] = [];

    if (!this.check("RIGHT_BRACE")) {
      do {
        const id = this.consume("IDENTIFIER", "DLM2054", "Expected struct literal field name.");
        this.consume("COLON", "DLM2055", "Expected ':' after struct literal field name.");
        fields.push({
          type: "StructLiteralField" as const,
          id: id.lexeme,
          value: this.expression(),
          location: id.location
        });
      } while (this.match("COMMA"));
    }

    this.consume("RIGHT_BRACE", "DLM2056", "Expected '}' after struct literal.");
    return {
      type: "StructLiteral",
      typeName: typeToken.lexeme,
      fields,
      location: typeToken.location
    };
  }

  private typeNode(): TypeNode {
    const first = this.primaryTypeNode();
    const options = [first];

    while (this.match("PIPE")) {
      options.push(this.primaryTypeNode());
    }

    if (options.length === 1) {
      return first;
    }

    return {
      type: "UnionType",
      options,
      location: first.location
    };
  }

  private primaryTypeNode(): TypeNode {
    if (this.match("CONST")) {
      const constToken = this.previous();
      return {
        type: "ConstType",
        valueType: this.primaryTypeNode(),
        location: constToken.location
      };
    }

    if (this.match("FUNCTION")) {
      const functionToken = this.previous();
      this.consume("LEFT_PAREN", "DLM2070", "Expected '(' after function type.");
      const params = this.typeList("RIGHT_PAREN");
      this.consume("RIGHT_PAREN", "DLM2071", "Expected ')' after function type parameters.");
      this.consume("COLON", "DLM2072", "Expected ':' before function return type.");
      return this.finishPostfixType({
        type: "FunctionType",
        params,
        returnType: this.typeNode(),
        location: functionToken.location
      });
    }

    if (this.match("LEFT_BRACKET")) {
      const tupleToken = this.previous();
      const elements: TypeNode[] = [];

      if (!this.check("RIGHT_BRACKET")) {
        do {
          elements.push(this.typeNode());
        } while (this.match("COMMA"));
      }

      this.consume("RIGHT_BRACKET", "DLM2040", "Expected ']' after tuple type.");
      return this.finishPostfixType({
        type: "TupleType",
        elements,
        location: tupleToken.location
      });
    }

    const id = this.consume("IDENTIFIER", "DLM2041", "Expected type name.");
    let typeNode: TypeNode = {
      type: "NamedType",
      name: id.lexeme,
      location: id.location
    };

    if (this.match("LESS")) {
      typeNode = {
        type: "GenericType",
        name: id.lexeme,
        typeArgs: this.typeList("GREATER"),
        location: id.location
      };
      this.consume("GREATER", "DLM2076", "Expected '>' after generic type arguments.");
    }

    while (this.match("LEFT_BRACKET")) {
      this.consume("RIGHT_BRACKET", "DLM2047", "Expected ']' after array type.");
      typeNode = {
        type: "ArrayType",
        elementType: typeNode,
        location: id.location
      };
    }

    return this.finishPostfixType(typeNode);
  }

  private finishPostfixType(typeNode: TypeNode): TypeNode {
    let current = typeNode;

    while (this.match("STAR", "AMPERSAND", "QUESTION")) {
      const token = this.previous();
      if (token.kind === "STAR") {
        current = {
          type: "PointerType",
          pointee: current,
          location: token.location
        };
      } else if (token.kind === "AMPERSAND") {
        current = {
          type: "ReferenceType",
          referent: current,
          location: token.location
        };
      } else {
        current = {
          type: "OptionalType",
          valueType: current,
          location: token.location
        };
      }
    }

    return current;
  }

  private typeList(endKind: TokenKind): TypeNode[] {
    const types: TypeNode[] = [];

    if (this.check(endKind)) {
      return types;
    }

    do {
      types.push(this.typeNode());
    } while (this.match("COMMA"));

    return types;
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

  private tokenAt(offset: number): Token {
    return this.tokens[this.current + offset] ?? this.tokens[this.tokens.length - 1]!;
  }

  private looksLikeTypeArgumentCall(): boolean {
    let depth = 0;
    for (let offset = 0; ; offset += 1) {
      const token = this.tokenAt(offset);
      if (token.kind === "EOF" || token.kind === "SEMICOLON") {
        return false;
      }

      if (token.kind === "LESS") {
        depth += 1;
      } else if (token.kind === "GREATER") {
        depth -= 1;
        if (depth === 0) {
          return this.tokenAt(offset + 1).kind === "LEFT_PAREN";
        }
      }
    }
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

function splitTemplate(text: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let buffer = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] === "$" && text[index + 1] === "{") {
      const end = text.indexOf("}", index + 2);
      if (end < 0) { break; }
      const name = text.slice(index + 2, end).trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
        if (buffer.length > 0) { parts.push({ kind: "string", value: buffer }); buffer = ""; }
        parts.push({ kind: "identifier", name });
        index = end + 1;
        continue;
      }
    }
    buffer += text[index];
    index += 1;
  }
  if (buffer.length > 0) { parts.push({ kind: "string", value: buffer }); }
  return parts;
}
