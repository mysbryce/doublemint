export type TokenKind =
  | "LET"
  | "CONST"
  | "CONSTEXPR"
  | "EXTERN"
  | "IMPORT"
  | "FROM"
  | "TYPE"
  | "EXPORT"
  | "COPY"
  | "STRUCT"
  | "ENUM"
  | "FUNCTION"
  | "FN"
  | "RETURN"
  | "NEW"
  | "AS"
  | "IF"
  | "ELSE"
  | "WHILE"
  | "FOR"
  | "SWITCH"
  | "CASE"
  | "DEFAULT"
  | "DEFER"
  | "TRUE"
  | "FALSE"
  | "NULL"
  | "IDENTIFIER"
  | "STRING_LITERAL"
  | "NUMBER_LITERAL"
  | "ARROW"
  | "COLON"
  | "SEMICOLON"
  | "COMMA"
  | "DOT"
  | "QUESTION"
  | "LEFT_PAREN"
  | "RIGHT_PAREN"
  | "LEFT_BRACE"
  | "RIGHT_BRACE"
  | "LEFT_BRACKET"
  | "RIGHT_BRACKET"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "AMPERSAND"
  | "PIPE"
  | "AMP_AMP"
  | "PIPE_PIPE"
  | "TEMPLATE_LITERAL"
  | "EQUAL"
  | "EQUAL_EQUAL"
  | "BANG_EQUAL"
  | "LESS"
  | "LESS_EQUAL"
  | "GREATER"
  | "GREATER_EQUAL"
  | "EOF";

export interface SourceLocation {
  filepath: string;
  line: number;
  column: number;
  offset: number;
  sourceLine?: string;
}

export interface Token {
  kind: TokenKind;
  lexeme: string;
  location: SourceLocation;
}
