# Doublemint

Doublemint is a production-oriented `.dlm` to C++20 transpiler. It aims for TypeScript-like ergonomics while emitting small, direct, warning-clean C++.

This repository is early, but the current pipeline is real:

1. Scan `.dlm` source into tokens.
2. Parse a typed AST with a hand-written recursive descent parser.
3. Resolve strict multi-file imports.
4. Run semantic checks.
5. Emit `.hpp` and `.cpp`.
6. Optionally compile a native binary with `clang++`, `g++`, or `c++`.

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

Check source, imports, and semantics:

```bash
node dist/cli.js check examples/main.dlm
```

Emit C++ files:

```bash
node dist/cli.js emit examples/main.dlm
```

Build a native executable:

```bash
node dist/cli.js build examples/main.dlm --out build/doublemint/app.exe
```

Build the multi-file example:

```bash
node dist/cli.js build examples/player/main.dlm --out build/player/app.exe
```

Build the language tour example:

```bash
node dist/cli.js build examples/language_tour/main.dlm --out build/language-tour/app.exe
```

Override compiler:

```bash
node dist/cli.js build examples/main.dlm --out build/doublemint/app.exe --compiler g++
```

If the configured compiler is missing, Doublemint falls back to `clang++`, `g++`, then `c++` when available.

## Config

`doublemint.config.json`:

```json
{
  "rootDir": "src",
  "outDir": "build/doublemint",
  "cppStandard": "c++20",
  "compiler": "clang++",
  "includeDirs": [],
  "warningsAsErrors": true,
  "optimization": "O3"
}
```

## Current Language Subset

Supported now:

- `import { value } from "./module";`
- `import type { TypeName } from "./module";`
- `export type`
- `export struct`
- `extern "header" { function ... }`
- `function`
- `let` and `const`
- explicit type annotations
- `copy`
- field access and assignment
- direct function calls
- builtin `print(...)`
- numeric, string, and bool literals
- numeric binary expressions and comparisons
- `if` / `else`
- `while` and C-style `for`
- `switch` with `case` and `default`
- vector-backed arrays
- tuple values and tuple indexing
- struct object literals
- lambda expressions with `function(...)` types
- `as` casts

Example:

```typescript
struct Profile {
  id: int;
  name: string;
  level: int;
}

function scoreLabel(): [int, string] {
  return (7, "mint");
}

export function main(): void {
  let profile: Profile = Profile { id: 1, name: "mint", level: 3 };
  let label: [int, string] = scoreLabel();
  let inc: function(int): int = fn (value: int): int => value + 1;
  let values: int[] = [1, 2, 3];

  for (let i: int = 0; i < 3; i = i + 1) {
    values[0] = values[0] + values[i];
  }

  switch (profile.name) {
    case "mint": {
      print(label[1]);
    }
    default: {
      print("unknown");
    }
  }

  if (values[0] > 1) {
    print(inc(profile.level));
  }
}
```

## Diagnostics

Diagnostics include error code, file path, line, column, source snippet, and caret:

```text
ERROR DLM2032: Expected ':' after let variable name.
 --> main.dlm:2:9
  |   let x = 1;
  |         ^
```

## Verification

Run all checks:

```bash
pnpm check
pnpm test
pnpm build
```

Current automated coverage includes lexer, parser, resolver, semantic checker, emitter, native compiler integration, diagnostics, and multi-file native build integration.

## Current Limits

Not supported yet:

- classes
- generics
- packages
- destructuring assignment
- object methods
- CMake generation
- editor tooling
- rich type inference
- `std::string_view` lifetime optimization

See `PRODUCT_SPEC.md` and `docs/adr/ADR-0001-production-foundation.md` for product direction and architecture decisions.
