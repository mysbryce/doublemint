# Doublemint Product Spec

## Purpose

Doublemint is a production-grade `.dlm` to C++20 transpiler. It gives developers TypeScript-like ergonomics while emitting clean, warning-free, high-performance C++.

This is not a disposable MVP. The first release is a production foundation: small enough to finish, strict enough to trust, and shaped so later language features do not require rewrites.

## Product Goals

- Compile real multi-file `.dlm` projects into `.hpp` and `.cpp` modules.
- Preserve human-friendly syntax without hiding unsafe or expensive behavior.
- Emit C++20 that passes `-Wall -Wextra -Werror -std=c++20 -O3`.
- Provide rich diagnostics with file, line, column, source snippet, caret, and stable error codes.
- Support a Node-based CLI installable as an npm package with a `doublemint` binary.
- Use layered automated tests, golden output snapshots, native C++ compilation, and binary execution tests.

## Non-Goals For Production Foundation

- Full TypeScript-style inference.
- C++ pointer/reference syntax exposed directly in `.dlm`.
- Aggressive interprocedural `std::string_view` optimization in the first implementation.
- Always-generated CMake projects.
- Full language surface such as classes, async, generics, macros, templates, or package registry support.

These are not rejected forever. They are deferred until the compiler core is stable.

## First Production Scope

The first production foundation must support:

- `let` and `const`.
- Explicit type annotations with limited safe inference for obvious internal literals.
- Functions with typed parameters and return types.
- Struct declarations and exported structs.
- Relative `import`, `import type`, and `export`.
- `extern` declarations for native C++ library bindings.
- Opaque extern types and native pointer/reference signatures for C/C++ interop.
- Prefix `copy` expressions.
- Tuple destructuring declarations for tuple-return values.
- Basic expressions, function calls, field access, assignment, and returns.
- Strict module graph resolution.
- `.hpp` and `.cpp` emission per module.
- Optional native compiler invocation from the CLI.
- Project configuration through `doublemint.config.json`.
- Native linker configuration through `libraryDirs`, `linkLibraries`, and `linkerFlags`.

## Language Decisions

### Type System

Public declarations, variables, function parameters, and function returns require explicit types.

Limited inference is allowed only where the compiler can prove the type locally and trivially, such as numeric and string literals inside internal expressions. Rich TypeScript-style inference is deferred.

### Mutation

`let` is mutable. `const` is immutable.

Struct field mutation is allowed only when the owning variable is mutable.

### Ownership And Passing

Doublemint uses value semantics as the source-level default.

The compiler may optimize large immutable struct parameters into `const T&` in emitted C++ when semantic analysis proves the parameter is not mutated and no explicit `copy` is requested.

Explicit copying uses the `copy` keyword.

### Strings

For the production foundation, mutable or escaping `string` values emit as `std::string`.
Safe local string literals may emit as `std::string_view`.

Broader interprocedural `std::string_view` mapping is deferred until the semantic analyzer can prove read-only lifetime safety across module boundaries.

## Compiler Architecture

The compiler is implemented in TypeScript on Node.js.

Core pipeline:

1. Lexer scans source into tokens with source locations.
2. Parser builds an AST with hand-written recursive descent.
3. Module resolver builds a strict dependency graph.
4. Semantic checker validates symbols, types, imports, exports, mutation, and copy behavior.
5. Emitter generates `.hpp` and `.cpp` outputs.
6. CLI optionally invokes GCC or Clang.

## CLI

Package form:

```bash
npm install -g doublemint
doublemint build src/main.dlm --out dist/app
```

Expected commands:

```bash
doublemint build <entry.dlm>
doublemint check <entry.dlm>
doublemint emit <entry.dlm>
```

`build` emits C++ and optionally invokes the configured native compiler.

`check` runs parse, graph, and semantic validation without emission.

`emit` writes `.hpp` and `.cpp` files without native compilation.

## Config

Project config lives in `doublemint.config.json`.

Minimum useful fields:

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

## Diagnostics

Diagnostics must be human-readable by default.

Each diagnostic includes:

- Error code.
- Severity.
- Message.
- Absolute or project-relative file path.
- Line and column.
- Source excerpt.
- Caret marker.
- Optional fix hint.

JSON diagnostics can be added later for editor tooling.

## Testing Standard

Required test layers:

- Lexer unit tests.
- Parser unit tests.
- Semantic checker unit tests.
- Module resolver tests.
- Golden emitted C++ snapshots.
- Integration tests that compile emitted C++ with GCC or Clang.
- Runtime tests that execute compiled binaries.
- Corrupt input tests for graceful diagnostics.

No phase is complete until its automated tests pass.

## Production Acceptance Criteria

The production foundation is acceptable when:

- A multi-file `.dlm` sample compiles to `.hpp` and `.cpp`.
- The emitted C++ compiles warning-free with C++20.
- The generated binary runs and produces expected output.
- Invalid source produces rich diagnostics without crashing.
- Circular imports, missing imports, and duplicate exports are rejected.
- `copy`, mutation, and const rules behave predictably.
- CLI works through the npm package binary.
