# Doublemint

Doublemint is a production-oriented `.dlm` → C++20 transpiler. It pairs TypeScript-style ergonomics with a curated runtime (vendored uWebSockets / libuv, SQLite, crypto helpers, JSON / schema, etc.) so a Mint program can build a HTTP server, talk to a database, or drive a native subprocess without writing FFI glue.

The version line is `0.0.1-dev-N` — each `N` corresponds to one shipped feature plus its patch note in [`patch-notes/`](patch-notes).

## Pipeline

1. Scan `.dlm` source into tokens.
2. Parse a typed AST with a hand-written recursive-descent parser.
3. Resolve the strict multi-file module graph, including builtin `mint:*` imports.
4. Run semantic checks (types, generics, mutation, exhaustiveness).
5. Emit `.hpp` + `.cpp` per module, including any vendored runtime sources the program uses.
6. Compile a native binary (gcc for `.c` → `.o`, g++ for `.cpp` → `.o`, g++ for the link). On Windows MinGW the linker auto-falls-back to a direct collect2 invocation with `COMPILER_PATH` / `LIBRARY_PATH` stripped, which dodges the silent exit-5 bug.

## Install

```bash
pnpm install
pnpm build
```

The package exposes a `doublemint` binary from `dist/cli.js`.

During local development:

```bash
pnpm dev check examples/main.dlm
```

After build:

```bash
node dist/cli.js check examples/main.dlm
```

## Commands

```bash
doublemint check <entry.dlm>             # lex / parse / resolve / semantic only
doublemint check --stdin-filepath <p>    # check unsaved source from stdin
doublemint emit <entry.dlm>              # write .hpp / .cpp into outDir
doublemint build <entry.dlm> --out <bin> # emit + invoke the native compiler
doublemint fmt <entry.dlm> [--write | --check]
doublemint repl                          # interactive evaluator (per-line compile)
doublemint init [dir]                    # scaffold a hello-world project
doublemint info                          # list every mint:* builtin module
doublemint version                       # print the current version
```

`build` flags: `--compiler g++|clang++`, `--cpp-out <dir>`, `--out <binary>`. The configured compiler is tried first; missing → falls back to `clang++`, `g++`, then `c++`.

Build the bundled multi-file sample:

```bash
node dist/cli.js build examples/player/main.dlm --out build/player/app.exe
```

Build the language-tour sample (covers every supported syntax piece in one file):

```bash
node dist/cli.js build examples/language_tour/main.dlm --out build/language-tour/app.exe
```

## Config

`doublemint.config.json` (optional):

```json
{
  "rootDir": "src",
  "outDir": "build/doublemint",
  "cppStandard": "c++20",
  "compiler": "g++",
  "includeDirs": [],
  "nativeSources": [],
  "libraryDirs": [],
  "linkLibraries": [],
  "linkerFlags": [],
  "warningsAsErrors": true,
  "optimization": "O3"
}
```

## Language Surface

Supported (through `0.0.1-dev-25`):

- **Bindings**: `let` (mutable), `const` (immutable), `constexpr`.
- **Types**: `int`, `int64`, `float`, `double`, `string`, `bool`, `char`, `Array<T>`, tuples, `Optional<T>`, `T1 | T2 | …` unions, `Future<T>`, plus user-defined `struct`, `enum`, `type` aliases.
- **Functions**: named functions with typed params + return, `async function` (returns `Future<T>`), generic free functions with inference, `extern` blocks for C/C++ interop, lambdas (single-expression and block bodies).
- **Statements**: `if`/`else`, `while`, `for`, `switch`/`case`/`default`, `match`/`_`, `defer`, `return`, tuple destructuring (`let [a, b] = expr;`).
- **Expressions**: arithmetic `+ - * /`, comparisons `== != < <= > >=`, logical `&& ||`, unary `- !`, prefix and postfix `++ --`, compound assignment `+= -= *= /=`, ternary `a ? b : c`, match expressions (`match (x) { … _ => fallback }`), template literals (`` `hello ${name}` ``), string concat with `+`, member access, indexing, `as` casts, `copy`, `new T(…)`, `await expr`.
- **Method-style on primitives**: any `mint:*` namespace function whose first parameter unifies with the receiver becomes a method (`name.upper()` ≡ `String.upper(name)`); numeric `n.toString()` always works without an import.

Run `doublemint info` to enumerate the active stdlib modules at any time. The current set:

```
mint:array      mint:async       mint:base64      mint:collections
mint:crypto     mint:db          mint:fs          mint:http
mint:io         mint:json        mint:log         mint:math
mint:memory     mint:net         mint:os          mint:process
mint:regex      mint:schema      mint:simd        mint:sql
mint:string     mint:term        mint:test        mint:time
```

## A Tour

```mint
import { println } from "mint:io";
import { String } from "mint:string";

enum Day { Mon, Tue, Wed }

struct Profile {
  id: int;
  name: string;
  level: int;
}

async function fetchLevel(id: int): int {
  return id * 10;
}

function label(d: Day): string {
  return match (d) {
    Day.Mon => "monday",
    Day.Tue => "tuesday",
    _ => "wednesday"
  };
}

export function main(): void {
  let profile: Profile = Profile { id: 1, name: "mint", level: 0 };
  profile.level = await fetchLevel(profile.id);

  println("hello " + profile.name.upper());
  println("day = " + label(Day.Tue));
  println("level = " + profile.level.toString());

  let acc: int = 0;
  for (let i: int = 1; i <= profile.level; i++) {
    acc += i;
  }
  println("acc = " + acc.toString());
}
```

## VS Code

Syntax highlighting, autocomplete, hover, go-to-definition, and realtime diagnostics live in [`ext/doublemint-vscode`](ext/doublemint-vscode). Diagnostics call `doublemint check --stdin-filepath` with the current editor buffer.

For development:

```bash
code ext/doublemint-vscode
```

Press `F5`, then open a `.dlm` file in the Extension Development Host.

Pack a VSIX with the latest compiler CLI bundled:

```bash
pnpm pack:vsix
```

## Native C/C++ Interop

Call simple C/C++ free functions through `extern "header"`:

```mint
extern "cmath" {
  function sqrt(num: double): double;
}
```

Opaque types, pointer / reference signatures, local includes, and explicit native symbol aliases all work:

```mint
extern "./native.hpp" {
  type FILE;
  function puts_alias(text: const char*): int as "std::puts";
  function close_ref(file: FILE&): int as "native_close";
}
```

`null` emits to `nullptr` for native pointer handles, and `defer` runs cleanup at scope exit:

```mint
let file: FILE* = fopen("data.txt", "r");
defer fclose(file);
```

Local native `.c` / `.cpp` files can be linked into the final binary via `nativeSources`:

```json
{
  "includeDirs": ["native"],
  "nativeSources": ["native/native_math.cpp"]
}
```

## Diagnostics

Every error implements `DoublemintDiagnostic` — code, severity, file, line, column, source excerpt, caret, and an optional fix hint:

```text
ERROR DLM2032: Expected ':' after let variable name.
 --> main.dlm:2:9
  |   let x = 1;
  |         ^
```

## Verification

Run the full bar before every release:

```bash
pnpm check            # type-check the TS toolchain
pnpm test             # unit + integration suite (vitest)
pnpm build            # bundle CLI + extension assets
pnpm build:examples   # build every example end-to-end
```

A bump is not shipped until tests are green and every example builds.

## Release Discipline

1. `pnpm version:bump "<title>"` bumps `dev-N` and stubs `patch-notes/0.0.1-dev-N.md`.
2. Implement the feature with at least one integration test.
3. `pnpm test` + `pnpm build:examples` must pass.
4. Fill in the patch note (Highlights / Files touched / Tests / examples / Up next).
5. Commit as `chore(release): 0.0.1-dev-N — <title>`.

## Current Limits

Deferred (will land when the surface stabilises):

- classes with methods, traits, or virtual dispatch
- generic structs / classes (only generic free functions today)
- HTTPS via vendored OpenSSL
- package registry + version pinning
- CMake project generation
- richer numeric formatting (`mint:fmt`)

See [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md) for product direction and [`docs/adr/ADR-0001-production-foundation.md`](docs/adr/ADR-0001-production-foundation.md) for architecture decisions.
