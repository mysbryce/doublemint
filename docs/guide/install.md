# Install

## From source

```bash
git clone https://github.com/mysbryce/doublemint
cd doublemint
pnpm install
pnpm build
```

After build the CLI lives at `dist/cli.js`. You can invoke it directly:

```bash
node dist/cli.js version
```

Or add an alias:

```bash
# bash / zsh
alias doublemint="node $(pwd)/dist/cli.js"
```

## VS Code extension

Build and pack the extension:

```bash
pnpm pack:vsix
```

That produces `build/doublemint-vscode-<version>.vsix`. Install it from VS Code's
*Extensions → … → Install from VSIX…* menu.

The extension provides:

- syntax highlighting for `.dlm`
- realtime diagnostics piped through `doublemint check --stdin-filepath`
- hover, autocomplete, and go-to-definition driven by the builtin manifest

## System requirements

| Tool | Minimum |
| --- | --- |
| Node.js | 20.11 |
| pnpm | 10 (any 10.x or 11.x) |
| g++ / clang++ | C++20 (g++ 12+, clang++ 14+) |

## Updating

```bash
git pull
pnpm install
pnpm build
```

Every release bumps `0.0.1-dev-N` and adds a note in
[`patch-notes/`](https://github.com/mysbryce/doublemint/tree/main/patch-notes).
