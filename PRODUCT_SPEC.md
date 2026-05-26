# Doublemint Product Spec

_Last updated: 2026-05-27 (0.0.1-dev-40)_

## Purpose

Doublemint is a production-grade `.dlm` → C++20 transpiler.
It gives developers TypeScript-style ergonomics while
emitting clean, warning-free, high-performance C++. The
generated binary links against a curated stdlib of vendored
C/C++ libraries (uWebSockets + libuv, SQLite, …) so a Mint
program can build a HTTP server, talk to a database, do
cryptography, or drive native subprocesses without manual
FFI glue.

This is not a disposable MVP — every release tightens the
production foundation. The version line is `0.0.1-dev-N`,
where each `N` corresponds to one shipped feature plus its
patch note in `patch-notes/0.0.1-dev-N.md`.

## Product Goals

- Compile real multi-file `.dlm` projects into `.hpp` /
  `.cpp` modules plus a single native binary.
- Preserve human-friendly syntax without hiding unsafe or
  expensive behavior.
- Emit C++20 that passes
  `-Wall -Wextra -Werror -std=c++20 -O3`.
- Rich diagnostics with file, line, column, source excerpt,
  caret, and stable `DLMxxxx` error codes (with a
  machine-readable `--json` variant for editor tooling).
- Ship as a Node-based CLI with a `doublemint` binary, plus
  a first-party VS Code extension (hover, autocomplete,
  goto-def, realtime diagnostics, builtin manifest).
- Layered tests: lexer / parser / checker unit tests,
  golden C++ snapshots, integration tests that *actually
  compile* the emitted C++ with g++/clang++, and runtime
  tests that exec the binary.

## Implemented Language Surface (through dev-40)

- **Bindings**: `let` (mutable), `const` (immutable),
  `constexpr` (compile-time constant).
- **Types**: `int`, `int64`, `float`, `double`, `string`,
  `bool`, `char`, plus user-defined `struct`, `enum`, `type`
  aliases, `Array<T>`, tuples, `Optional<T>`,
  `T1 | T2 | …` unions, `Future<T>`.
- **Functions**: named functions with typed params + return,
  `async function` (returns `Future<T>`), generic free
  functions with inference, `extern` blocks for C/C++
  interop, lambdas with single-expression and block bodies.
- **Statements**: `if`/`else`, `while`, C-style `for`,
  `for (let x of arr)` and `for (let [a, b] of pairs)`
  range loops, `switch`/`case`/`default`, `match` (with
  guard clauses) / `_`, `try`/`catch`/`throw`, `defer`,
  `return`, tuple destructuring (`let [a, b] = expr;`).
- **Expressions**: arithmetic (`+ - * / %`), comparisons
  (`== != < <= > >=`), logical (`&& ||`), unary
  (`- ! ~`), prefix + postfix (`++ --`), bitwise
  (`& | ^ << >>`), compound assignment
  (`+= -= *= /= %= &= |= ^= <<= >>=`), ternary
  (`a ? b : c`), match expressions, template literals
  (`` `hello ${name}` ``), string concatenation, member
  access, indexing, casts (`as T`), `copy`, `new T(…)`,
  `await expr`.
- **Numeric literals**: `1_000_000`, `0xFF`, `0o755`,
  `0b1010` plus the standard decimal / float forms.
- **Method-style on primitives**: any `mint:*` namespace
  function whose first parameter unifies with the receiver
  becomes a method (`name.upper()` ≡ `String.upper(name)`),
  plus built-in numeric and bool `.toString()`.

## Built-in `mint:*` Modules (25 total)

`mint:array`, `mint:async` (spawn / join / mutex / atomic /
channel / parallelFor + `Async.run`), `mint:base64`,
`mint:collections` (Queue / Set / Stack),
`mint:crypto`, `mint:db` (in-memory KV),
`mint:fmt` (padding / hex / octal / binary / precision /
thousands separators), `mint:fs`,
`mint:http` (uWebSockets-backed, Elysia-style routing +
WebSockets + outbound `Fetch`), `mint:io`,
`mint:json`, `mint:log`, `mint:math`, `mint:memory`,
`mint:net`, `mint:os`, `mint:process` (shell run +
streaming pipes via popen + memory read/write + AOB scan
+ pointer chains), `mint:regex`, `mint:schema`,
`mint:simd`, `mint:sql` (vendored SQLite amalgamation),
`mint:string`, `mint:term` (ANSI styling), `mint:test`
(assertions + runner), `mint:time` (clock + profiler).

Run `doublemint info` to enumerate them at any point.

## CLI Surface

```bash
doublemint check <entry.dlm>            # lex/parse/semantic only
doublemint check --stdin-filepath <p>   # check unsaved source from stdin
doublemint check --json                 # machine-readable diagnostics
doublemint emit <entry.dlm>             # write .hpp / .cpp into outDir
doublemint build <entry.dlm> --out <bin>
                                        # emit + invoke native compiler
doublemint fmt <entry.dlm> [--write | --check]
doublemint repl                         # interactive evaluator (per-line compile)
doublemint init [dir]                   # scaffold a hello-world project
doublemint info                         # list builtin modules
doublemint version                      # print version
```

`build` flags: `--compiler clang++|g++`, `--cpp-out <dir>`,
`--out <binary>`.

## Compiler Architecture

```
.dlm source
   │
   ▼
 Lexer (src/lexer)        — chars → tokens with SourceLocation
   │
   ▼
 Parser (src/parser)      — hand-written recursive descent → AST
   │
   ▼
 Resolver (src/resolver)  — strict module graph + builtin manifest
   │
   ▼
 Checker (src/semantic)   — symbols, types, imports, generics, mutation
   │
   ▼
 Emitter (src/emitter)    — .hpp + .cpp per module, includes vendor sources
   │
   ▼
 Native compiler (src/core/nativeCompiler.ts)
                          — gcc for .c → .o, g++ for .cpp → .o, g++ for link;
                            Windows MinGW collect2 fallback handles the silent
                            exit-5 bug by stripping COMPILER_PATH/LIBRARY_PATH.
```

The TypeScript build pipeline (`pnpm build`) embeds the
runtime headers / sources, refreshes the builtin manifest
for the VS Code extension, then bundles the CLI + library
through `tsup`.

## Configuration

Project config lives in `doublemint.config.json` (optional).

```json
{
  "rootDir": "src",
  "outDir": "build/doublemint",
  "cppStandard": "c++20",
  "compiler": "g++",
  "includeDirs": [],
  "warningsAsErrors": true,
  "optimization": "O3",
  "nativeSources": [],
  "libraryDirs": [],
  "linkLibraries": [],
  "linkerFlags": []
}
```

## Documentation

Public-facing docs live in `docs/` as a VitePress site with
six audience-driven sections:

1. **Get Started** — install, quickstart, project layout, editor.
2. **Core & Transpiler** — pipeline, type system, module resolver,
   checker, emitter, native compiler, diagnostics, config.
3. **Language** — syntax, operators, pattern matching, async,
   lambdas / generics, structs / enums, native interop.
4. **CLI** — every `doublemint` command and flag.
5. **Standard Library** — every `mint:*` module, grouped by
   domain (System & Files, Strings & Data, Math & Time, Network,
   Security, Pattern & Search, Persistence, Concurrency, …).
6. **Releases** — patch notes and roadmap.

`pnpm docs:dev` boots the site at `http://localhost:5173`.
`pnpm docs:build` produces the static site.

## Diagnostics

Every error implements `DoublemintDiagnostic`. Each one
carries an error code (e.g. `DLM4070`), severity, message,
absolute path, line/column, source excerpt with caret, and
an optional fix hint. `doublemint check --json` emits the
same payload as a JSON array for editor / LSP consumption.
The compiler never crashes on invalid source — bad input
always surfaces a diagnostic.

## Testing Standard

- Vitest unit tests for the lexer, parser, semantic
  checker, formatter, and emitter.
- Integration tests that build a real `.dlm` program, run
  the full resolver / checker / emitter / native-compile
  pipeline, then execute the resulting binary and assert on
  its stdout.
- Builtin coverage: dedicated build-and-run tests per
  `mint:*` module (`tests/integration/mintXxxBuild.test.ts`).
- `pnpm build:examples` builds all `examples/**/*.dlm`
  end-to-end as a smoke test before any release.
- Docs styling guard via `pnpm docs:check-style` — boots a
  VitePress preview and walks the home / quickstart /
  operators / stdlib pages through Playwright to verify
  layout, fonts, and sidebar icons.

A bump is not shipped until `pnpm test` is green and
`pnpm build:examples` builds every example.

Current state at dev-40: **203 / 203 tests pass**,
**25 / 25 examples build**.

## Release Discipline

1. `pnpm version:bump "<title>"` increments the `dev-N`
   counter in `package.json` and in
   `ext/doublemint-vscode/package.json`, and stubs a fresh
   `patch-notes/0.0.1-dev-N.md`.
2. Implement the feature with at least one integration
   test.
3. `pnpm test` + `pnpm build:examples` must pass.
4. Update `docs/`, `README.md`, and any related surface as
   part of the same commit (see `CLAUDE.md`).
5. Fill in the patch note (Highlights / Files touched /
   Tests / examples / Up next).
6. Commit with
   `chore(release): 0.0.1-dev-N — <title>`.

## Roadmap (post-dev-40)

The next batch is queued in `NEXT_PLAN.md`. High-level
buckets:

- **Sum types** — enum payload variants, pattern bindings
  (`Some(x) => x`), `Result<T, E>` with `?` propagation.
- **OOP** — `class` declarations with methods, fields,
  visibility, virtual dispatch.
- **Generic data types** — generic structs and classes
  (only generic free functions exist today).
- **HTTPS** — vendor OpenSSL into the `mint:http` /
  `mint:net` pipelines.
- **LSP** — promote the existing `--json` diagnostics
  surface into a full Language Server Protocol
  implementation (hover, completion, goto-def, rename).
- **Tooling** — package registry + version pinning, CMake
  project generation, optional arena / GC allocator
  strategy.
