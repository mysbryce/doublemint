# Diagnostics

Every error is a `DoublemintDiagnostic`:

```text
ERROR DLM2032: Expected ':' after let variable name.
 --> main.dlm:2:9
  |   let x = 1;
  |         ^
```

Each diagnostic carries:

- A stable **error code** (`DLM` + 4 digits).
- A **severity** (`error` or `warning`).
- A human **message**.
- An absolute or project-relative **file path**.
- **Line** and **column**.
- A **source excerpt** with a caret pointing at the problem.
- An optional **fix hint**.

The compiler never crashes on invalid source — bad input always
produces a diagnostic and a non-zero exit code.

## Error-code ranges

| Range | Layer |
| --- | --- |
| `DLM0xxx` | CLI usage |
| `DLM1xxx` | Lexer |
| `DLM2xxx` | Parser |
| `DLM3xxx` | Resolver |
| `DLM4xxx` | Semantic checker |
| `DLM5xxx` | Emitter |
| `DLM6xxx` | Native compiler / linker |

## Common codes

| Code | Meaning |
| --- | --- |
| `DLM0001` | Unknown CLI command. |
| `DLM0002` | Command requires an entry `.dlm`. |
| `DLM0007` | `--write` and `--check` are mutually exclusive. |
| `DLM1001` | Unexpected character in source. |
| `DLM2030` | Expected `}` after function body. |
| `DLM2080`-`DLM2086` | Enum declaration shape (variants, braces, commas). |
| `DLM2087` | Expected `function` after `async`. |
| `DLM2090`-`DLM2103` | Match statement / expression syntax. |
| `DLM3xxx` | Import resolution (missing file, missing export, circular import). |
| `DLM4001` | Unsupported builtin import symbol. |
| `DLM4005` | Operator requires numeric operands. |
| `DLM4007` | `"name"` is not a function. |
| `DLM4009` | Type has no fields. |
| `DLM4070` | Enum has no variant `"X"`. |
| `DLM4071` | Match has more than one unguarded wildcard arm (statement form). |
| `DLM4072` | Same for match expression form. |
| `DLM4073` | Match expression arms must have the same type. |
| `DLM4074` | Match expression must include a wildcard arm. |
| `DLM4075` | Unary `-` requires a numeric operand. |
| `DLM4076` | Unary `!` requires a bool operand. |
| `DLM4077` | Compound assignment requires numeric operands. |
| `DLM4078` | `++` / `--` requires a numeric operand. |
| `DLM4079` | `await` requires a `Future<T>` operand. |
| `DLM4080` | `%` / `&` / `\|` / `^` / `<<` / `>>` requires integer operands. |
| `DLM4081` | Unary `~` requires an integer operand. |
| `DLM4082` | Integer compound assignment requires integer operands. |
| `DLM4083` | Match arm guard must be a bool. |
| `DLM5001` | Emitter cannot find a resolved import. |
| `DLM6002` | Native compiler exited with a non-zero status. |

The full set is in `src/` — search for the code in question to find the
exact site that raises it.

## JSON output

Plain text is the only format today. JSON diagnostics for editor / LSP
integration are on the roadmap.
