# Getting started

Doublemint compiles `.dlm` source files to C++20 and then to a native binary.
This page walks you from zero to a working "hello, mint" program in under a minute.

## Prerequisites

- Node.js **20.11+**
- `pnpm`
- A C++20-capable compiler on `PATH` — `g++`, `clang++`, or `c++`

::: tip Windows note
On MinGW UCRT64 the linker `collect2` occasionally exits with code 5 because of a
stale `COMPILER_PATH` / `LIBRARY_PATH`. Doublemint detects that and automatically
falls back to a direct `collect2` invocation with those env vars stripped — no
configuration needed.
:::

## Install

```bash
git clone https://github.com/mysbryce/doublemint
cd doublemint
pnpm install
pnpm build
```

The `doublemint` binary is now at `dist/cli.js`. Either alias it or call it via
`node dist/cli.js`.

## Scaffold a project

```bash
doublemint init hello
cd hello
```

That creates a `main.dlm` with a hello-world template using the project
directory name.

## Build and run

```bash
doublemint build main.dlm --out hello
./hello
```

```text
hello from hello
```

## Iterate

```bash
doublemint check main.dlm   # parse + resolve + semantic
doublemint fmt main.dlm     # opinionated formatter, prints to stdout
doublemint repl             # per-line compile + run, persists imports/decls
doublemint info             # list every mint:* stdlib module
```

See the [CLI reference](/cli/commands) for the full surface.
