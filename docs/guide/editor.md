# Editor

## VS Code

The first-party extension lives at
[`ext/doublemint-vscode`](https://github.com/mysbryce/doublemint/tree/main/ext/doublemint-vscode).

Features:

- Syntax highlighting for `.dlm`
- Hover with type / signature information
- Autocomplete driven by the live builtin manifest
- Go-to-definition for builtin namespaces and user-defined symbols
- Realtime diagnostics — the extension pipes the unsaved buffer to
  `doublemint check --stdin-filepath` and surfaces parser, resolver, and
  semantic errors inline

## Local development

```bash
cd ext/doublemint-vscode
code .
```

Press **F5** to launch an *Extension Development Host* with the local build
loaded. Open any `.dlm` file in that window to exercise the extension.

## Pack a VSIX

```bash
pnpm pack:vsix
```

Output: `build/doublemint-vscode-<version>.vsix`. The pack script bundles the
latest `dist/cli.js` so the extension talks to the compiler it was built with.

## Tooling for other editors

Doublemint does not ship a Language Server Protocol implementation yet, but
`doublemint check --stdin-filepath` is the same interface the VS Code extension
uses. Wire it into your editor's "external linter" hook and you'll get
diagnostics with file / line / column / hint.

JSON diagnostics for richer LSP-style integration are a planned addition — see
[Releases](/releases/) for status.
