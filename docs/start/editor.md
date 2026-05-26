# Editor (VS Code)

The first-party extension lives in
[`ext/doublemint-vscode`](https://github.com/mysbryce/doublemint/tree/main/ext/doublemint-vscode).

## What it does

- **Syntax highlighting** for `.dlm` files (TextMate grammar).
- **Hover** — type signatures for variables, parameters, functions,
  and stdlib symbols.
- **Autocomplete** driven by the live builtin manifest
  (`ext/doublemint-vscode/builtin-manifest.json`, refreshed on
  every `pnpm build`).
- **Go-to-definition** for builtin namespaces and user-defined symbols.
- **Realtime diagnostics** — the extension pipes the unsaved buffer to
  `doublemint check --stdin-filepath` and surfaces parser, resolver, and
  semantic errors inline.
- **Import-brace completion** — typing `import {` after `from "mint:fs"`
  suggests every exported name from that module.

## Install

Pack a VSIX with the latest compiler CLI bundled:

```bash
pnpm pack:vsix
```

Output: `build/doublemint-vscode-<version>.vsix`. Install from
*Extensions → … → Install from VSIX…*.

## Develop locally

```bash
cd ext/doublemint-vscode
code .
```

Press **F5** to launch an *Extension Development Host* with the local
build loaded. Open any `.dlm` file in that window to exercise the
extension.

## Other editors

Doublemint does not ship a Language Server Protocol implementation yet,
but `doublemint check --stdin-filepath` is the same interface the VS
Code extension uses. Wire it into your editor's "external linter" hook
and you'll get diagnostics with file / line / column / hint.

JSON diagnostics for richer LSP-style integration are a planned addition
— track it on the [Releases](/releases/) page.
