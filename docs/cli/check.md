# `doublemint check`

Run the lexer, parser, resolver, and semantic checker. No files are
written. Exit code is `0` on success, `1` on any diagnostic.

```bash
doublemint check src/main.dlm
```

```text
OK 3 modules checked using c++20.
```

## Flags

| Flag | Purpose |
| --- | --- |
| `--stdin-filepath <path>` | Read source from stdin but report diagnostics relative to `<path>`. |

## `--stdin-filepath`

The VS Code extension uses this to lint unsaved buffers:

```bash
cat unsaved.dlm | doublemint check --stdin-filepath /abs/path/to/unsaved.dlm
```

The filepath argument is informational — it controls how diagnostics
are labeled, but the source itself comes from stdin.

## Errors

Errors look like this:

```text
ERROR DLM4070: Enum "Color" has no variant "Yellow".
 --> main.dlm:7:18
  |   let c: Color = Color.Yellow;
  |                        ^
```

Every error carries a `DLM####` code — see
[Core → Diagnostics](/core/diagnostics) for the catalogue.
