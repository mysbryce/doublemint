import type { SourceLocation } from "../lexer/token.js";

export type DiagnosticSeverity = "error" | "warning";

interface DiagnosticInput {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  location?: SourceLocation;
  sourceLine?: string;
  hint?: string;
}

export class DoublemintDiagnostic extends Error {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly location?: SourceLocation;
  readonly sourceLine?: string;
  readonly hint?: string;

  constructor(input: DiagnosticInput) {
    super(input.message);
    this.name = "DoublemintDiagnostic";
    this.code = input.code;
    this.severity = input.severity;
    this.location = input.location;
    this.sourceLine = input.sourceLine;
    this.hint = input.hint;
  }

  format(): string {
    const header = `${this.severity.toUpperCase()} ${this.code}: ${this.message}`;

    if (!this.location) {
      return this.hint ? `${header}\nHint: ${this.hint}` : header;
    }

    const pointer = `${" ".repeat(Math.max(0, this.location.column - 1))}^`;
    const lines = [
      header,
      ` --> ${this.location.filepath}:${this.location.line}:${this.location.column}`
    ];

    const sourceLine = this.sourceLine ?? this.location.sourceLine;

    if (sourceLine) {
      lines.push(`  | ${sourceLine}`);
      lines.push(`  | ${pointer}`);
    }

    if (this.hint) {
      lines.push(`Hint: ${this.hint}`);
    }

    return lines.join("\n");
  }
}
