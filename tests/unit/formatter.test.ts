import { describe, expect, it } from "vitest";
import { formatSource } from "../../src/format/formatter.js";

describe("formatSource", () => {
  it("normalizes CRLF to LF", () => {
    const result = formatSource("a\r\nb\r\n");
    expect(result.output).toBe("a\nb\n");
    expect(result.changed).toBe(true);
  });

  it("strips trailing whitespace", () => {
    const result = formatSource("foo   \nbar\t\n");
    expect(result.output).toBe("foo\nbar\n");
    expect(result.changed).toBe(true);
  });

  it("collapses 3+ blank lines into a single blank", () => {
    const result = formatSource("a\n\n\n\nb\n");
    expect(result.output).toBe("a\n\nb\n");
    expect(result.changed).toBe(true);
  });

  it("preserves a single blank line", () => {
    const result = formatSource("a\n\nb\n");
    expect(result.output).toBe("a\n\nb\n");
    expect(result.changed).toBe(false);
  });

  it("ensures a trailing newline", () => {
    const result = formatSource("a");
    expect(result.output).toBe("a\n");
    expect(result.changed).toBe(true);
  });

  it("drops leading blank lines", () => {
    const result = formatSource("\n\nfoo\n");
    expect(result.output).toBe("foo\n");
    expect(result.changed).toBe(true);
  });

  it("returns unchanged for already-formatted source", () => {
    const source = "import { println } from \"mint:io\";\n\nexport function main(): void {\n  println(\"hi\");\n}\n";
    const result = formatSource(source);
    expect(result.output).toBe(source);
    expect(result.changed).toBe(false);
  });
});
