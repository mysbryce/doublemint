import { describe, expect, it } from "vitest";
import { DoublemintDiagnostic, scanTokens } from "../../src/index.js";

describe("scanTokens", () => {
  it("scans production foundation keywords and punctuation", () => {
    const tokens = scanTokens(
      'export function main(): void { let name: string = "mint"; }',
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

