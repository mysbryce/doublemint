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
| `--json` | Emit a JSON object on stdout instead of the text format. |

## `--json`

```bash
$ doublemint check ok.dlm --json
{"ok":true,"modulesChecked":2,"cppStandard":"c++20","diagnostics":[]}

$ doublemint check bad.dlm --json
{"ok":false,"diagnostics":[{"code":"DLM2003","severity":"error","message":"Expected declaration but found LET.","filepath":"bad.dlm","line":1,"column":1,"offset":0,"sourceLine":"let x: int = \"hi\";"}]}
```

Schema:

```ts
type CheckOutput = {
  ok: boolean;
  modulesChecked?: number;
  cppStandard?: string;
  diagnostics: Array<{
    code: string;                          // "DLM####"
    severity: "error" | "warning";
    message: string;
    filepath?: string;
    line?: number;
    column?: number;
    offset?: number;
    sourceLine?: string;
    hint?: string;
  }>;
};
```

Exit code matches the text mode: `0` on success, `1` on any
diagnostic. Errors caught outside the diagnostic system come through
as `DLM9999`.

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
