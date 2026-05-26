import { DoublemintDiagnostic } from "../diagnostics/diagnostic.js";
import type { SourceLocation, Token, TokenKind } from "./token.js";

const keywords = new Map<string, TokenKind>([
  ["let", "LET"],
  ["const", "CONST"],
  ["constexpr", "CONSTEXPR"],
  ["extern", "EXTERN"],
  ["import", "IMPORT"],
  ["from", "FROM"],
  ["type", "TYPE"],
  ["export", "EXPORT"],
  ["copy", "COPY"],
  ["struct", "STRUCT"],
  ["enum", "ENUM"],
  ["match", "MATCH"],
  ["function", "FUNCTION"],
  ["fn", "FN"],
  ["return", "RETURN"],
  ["new", "NEW"],
  ["as", "AS"],
  ["if", "IF"],
  ["else", "ELSE"],
  ["while", "WHILE"],
  ["for", "FOR"],
  ["switch", "SWITCH"],
  ["case", "CASE"],
  ["default", "DEFAULT"],
  ["defer", "DEFER"],
  ["true", "TRUE"],
  ["false", "FALSE"],
  ["null", "NULL"]
]);

export function scanTokens(source: string, filepath: string): Token[] {
  const scanner = new Scanner(source, filepath);
  return scanner.scan();
}

class Scanner {
  private readonly tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private tokenLine = 1;
  private tokenColumn = 1;
  private readonly sourceLines: string[];

  constructor(
    private readonly source: string,
    private readonly filepath: string
  ) {
    this.sourceLines = source.split(/\r?\n/u);
  }

  scan(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.tokenLine = this.line;
      this.tokenColumn = this.column;
      this.scanToken();
    }

    this.tokens.push({
      kind: "EOF",
      lexeme: "",
      location: this.location()
    });

    return this.tokens;
  }

  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      case "(":
        this.addToken("LEFT_PAREN");
        break;
      case ")":
        this.addToken("RIGHT_PAREN");
        break;
      case "{":
        this.addToken("LEFT_BRACE");
        break;
      case "}":
        this.addToken("RIGHT_BRACE");
        break;
      case "[":
        this.addToken("LEFT_BRACKET");
        break;
      case "]":
        this.addToken("RIGHT_BRACKET");
        break;
      case ":":
        this.addToken("COLON");
        break;
      case ";":
        this.addToken("SEMICOLON");
        break;
      case ",":
        this.addToken("COMMA");
        break;
      case ".":
        this.addToken("DOT");
        break;
      case "?":
        this.addToken("QUESTION");
        break;
      case "+":
        this.addToken("PLUS");
        break;
      case "*":
        this.addToken("STAR");
        break;
      case "&":
        this.addToken(this.match("&") ? "AMP_AMP" : "AMPERSAND");
        break;
      case "|":
        this.addToken(this.match("|") ? "PIPE_PIPE" : "PIPE");
        break;
      case "=":
        this.addToken(
          this.match(">") ? "ARROW" : this.match("=") ? "EQUAL_EQUAL" : "EQUAL"
        );
        break;
      case "!":
        this.addToken(this.match("=") ? "BANG_EQUAL" : "BANG");
        break;
      case "<":
        this.addToken(this.match("=") ? "LESS_EQUAL" : "LESS");
        break;
      case ">":
        this.addToken(this.match("=") ? "GREATER_EQUAL" : "GREATER");
        break;
      case "-":
        this.addToken(this.match(">") ? "ARROW" : "MINUS");
        break;
      case "/":
        if (this.match("/")) {
          this.skipLineComment();
        } else {
          this.addToken("SLASH");
        }
        break;
      case "\"":
        this.string();
        break;
      case " ":
      case "\r":
      case "\t":
        break;
      case "\n":
        break;
      default:
        if (isDigit(char)) {
          this.number();
        } else if (isIdentifierStart(char)) {
          this.identifier();
        } else {
          throw this.error("DLM1001", `Unexpected character "${char}".`);
        }
    }
  }

  private identifier(): void {
    while (isIdentifierPart(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(this.start, this.current);
    this.addToken(keywords.get(lexeme) ?? "IDENTIFIER");
  }

  private number(): void {
    while (isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }

    this.addToken("NUMBER_LITERAL");
  }

  private string(): void {
    while (this.peek() !== "\"" && !this.isAtEnd()) {
      if (this.peek() === "\\") {
        this.advance();
        if (!this.isAtEnd()) {
          this.advance();
        }
        continue;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw this.error("DLM1002", "Unterminated string literal.");
    }

    this.advance();
    this.addToken("STRING_LITERAL");
  }

  private skipLineComment(): void {
    while (this.peek() !== "\n" && !this.isAtEnd()) {
      this.advance();
    }
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.current] !== expected) {
      return false;
    }

    this.advance();
    return true;
  }

  private advance(): string {
    const char = this.source[this.current] ?? "";
    this.current += 1;

    if (char === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }

    return char;
  }

  private peek(): string {
    return this.source[this.current] ?? "";
  }

  private peekNext(): string {
    return this.source[this.current + 1] ?? "";
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private addToken(kind: TokenKind): void {
    this.tokens.push({
      kind,
      lexeme: this.source.slice(this.start, this.current),
      location: this.location()
    });
  }

  private location(): SourceLocation {
    return {
      filepath: this.filepath,
      line: this.tokenLine,
      column: this.tokenColumn,
      offset: this.start,
      sourceLine: this.sourceLines[this.tokenLine - 1] ?? ""
    };
  }

  private error(code: string, message: string): DoublemintDiagnostic {
    return new DoublemintDiagnostic({
      code,
      severity: "error",
      message,
      location: this.location()
    });
  }
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/u.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/u.test(char);
}
