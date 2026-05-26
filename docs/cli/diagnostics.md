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

The compiler never crashes on invalid source — bad input always produces a
diagnostic and a non-zero exit code.

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

- **DLM2001** — Imports cannot be exported.
- **DLM2030** — Expected `}` after function body.
- **DLM4001** — Unsupported builtin import symbol.
- **DLM4007** — `"name"` is not a function.
- **DLM4070** — Enum has no variant `"X"`.
- **DLM4075** — Unary `-` requires a numeric operand.
- **DLM4079** — `await` requires a `Future<T>` operand.
- **DLM4080** — Operator `%` / `&` / `|` / `^` / `<<` / `>>` requires
  integer operands.
- **DLM6002** — Native compiler exited with a non-zero status.

The full list lives in [`src/`](https://github.com/mysbryce/doublemint/tree/main/src) —
search for the code in question to find the exact site that raises it.

## JSON output

Plain text is the only format today. JSON diagnostics for editor / LSP
integration are on the roadmap.
