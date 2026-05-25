import { describe, expect, it } from "vitest";
import { DoublemintDiagnostic, scanTokens } from "../../src/index.js";

describe("scanTokens", () => {
  it("scans production foundation keywords and punctuation", () => {
    const tokens = scanTokens(
      'export function main(): void { let name: string = "mint"; let inc: function(int): int = fn (x: int): int => x + 1; extern "cstdio" { type FILE; function close(file: FILE&): int; } while (1 <= 2) {} for (; name != ""; ) {} if (null == null) {} switch (name) { case "mint": {} default: {} } }',
      "main.dlm"
    );

    expect(tokens.map((token) => token.kind)).toEqual([
      "EXPORT",
      "FUNCTION",
      "IDENTIFIER",
      "LEFT_PAREN",
      "RIGHT_PAREN",
      "COLON",
      "IDENTIFIER",
      "LEFT_BRACE",
      "LET",
      "IDENTIFIER",
      "COLON",
      "IDENTIFIER",
      "EQUAL",
      "STRING_LITERAL",
      "SEMICOLON",
      "LET",
      "IDENTIFIER",
      "COLON",
      "FUNCTION",
      "LEFT_PAREN",
      "IDENTIFIER",
      "RIGHT_PAREN",
      "COLON",
      "IDENTIFIER",
      "EQUAL",
      "FN",
      "LEFT_PAREN",
      "IDENTIFIER",
      "COLON",
      "IDENTIFIER",
      "RIGHT_PAREN",
      "COLON",
      "IDENTIFIER",
      "ARROW",
      "IDENTIFIER",
      "PLUS",
      "NUMBER_LITERAL",
      "SEMICOLON",
      "EXTERN",
      "STRING_LITERAL",
      "LEFT_BRACE",
      "TYPE",
      "IDENTIFIER",
      "SEMICOLON",
      "FUNCTION",
      "IDENTIFIER",
      "LEFT_PAREN",
      "IDENTIFIER",
      "COLON",
      "IDENTIFIER",
      "AMPERSAND",
      "RIGHT_PAREN",
      "COLON",
      "IDENTIFIER",
      "SEMICOLON",
      "RIGHT_BRACE",
      "WHILE",
      "LEFT_PAREN",
      "NUMBER_LITERAL",
      "LESS_EQUAL",
      "NUMBER_LITERAL",
      "RIGHT_PAREN",
      "LEFT_BRACE",
      "RIGHT_BRACE",
      "FOR",
      "LEFT_PAREN",
      "SEMICOLON",
      "IDENTIFIER",
      "BANG_EQUAL",
      "STRING_LITERAL",
      "SEMICOLON",
      "RIGHT_PAREN",
      "LEFT_BRACE",
      "RIGHT_BRACE",
      "IF",
      "LEFT_PAREN",
      "NULL",
      "EQUAL_EQUAL",
      "NULL",
      "RIGHT_PAREN",
      "LEFT_BRACE",
      "RIGHT_BRACE",
      "SWITCH",
      "LEFT_PAREN",
      "IDENTIFIER",
      "RIGHT_PAREN",
      "LEFT_BRACE",
      "CASE",
      "STRING_LITERAL",
      "COLON",
      "LEFT_BRACE",
      "RIGHT_BRACE",
      "DEFAULT",
      "COLON",
      "LEFT_BRACE",
      "RIGHT_BRACE",
      "RIGHT_BRACE",
      "RIGHT_BRACE",
      "EOF"
    ]);
  });

  it("tracks line and column", () => {
    const tokens = scanTokens("let x: int;\ncopy x;", "main.dlm");
    const copy = tokens.find((token) => token.kind === "COPY");

    expect(copy?.location).toMatchObject({
      filepath: "main.dlm",
      line: 2,
      column: 1
    });
  });

  it("throws rich diagnostics for bad glyphs", () => {
    expect(() => scanTokens("let x: int = @;", "bad.dlm")).toThrow(
      DoublemintDiagnostic
    );
  });

  it("throws rich diagnostics for unterminated strings", () => {
    expect(() => scanTokens('let x: string = "oops;', "bad.dlm")).toThrow(
      DoublemintDiagnostic
    );
  });
});
