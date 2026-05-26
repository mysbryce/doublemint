# Install

## Prerequisites

- Node.js **20.11+**
- `pnpm` (10.x or 11.x)
- A C++20-capable compiler on `PATH` — `g++` 12+, `clang++` 14+, or `c++`

::: tip Windows note
On MinGW UCRT64 the linker `collect2` occasionally exits with code 5
because of a stale `COMPILER_PATH` / `LIBRARY_PATH`. Doublemint detects
that and automatically falls back to a direct `collect2` invocation with
those env vars stripped — no configuration needed.
:::

## From source

```bash
git clone https://github.com/mysbryce/doublemint
cd doublemint
pnpm install
pnpm build
```

After build the CLI lives at `dist/cli.js`. Invoke it directly:

```bash
node dist/cli.js version
```

Or add an alias to your shell rc:

```bash
# bash / zsh
alias doublemint="node $(pwd)/dist/cli.js"
```

## Verify

```bash
doublemint version
doublemint info
```

You should see the current `0.0.1-dev-N` version line and a list of every
`mint:*` builtin module.

## VS Code extension

```bash
pnpm pack:vsix
```

That produces `build/doublemint-vscode-<version>.vsix`. Install it from
VS Code's *Extensions → … → Install from VSIX…* menu. See
[Editor (VS Code)](./editor) for what the extension does.

## Updating

```bash
git pull
pnpm install
pnpm build
```

Every release bumps `0.0.1-dev-N` and ships a patch note in
[`patch-notes/`](https://github.com/mysbryce/doublemint/tree/main/patch-notes).
The [Releases](/releases/) page summarises each bump.
