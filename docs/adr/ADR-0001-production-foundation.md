# ADR-0001: Production Foundation For Doublemint

## Status

Accepted

## Context

Doublemint needs to become a real production tool, not a throwaway MVP. The project plan defines a TypeScript-like language that transpiles to high-performance C++20.

The first implementation must be narrow enough to build correctly, but strong enough that future phases can extend it without replacing the compiler core.

## Decision

Doublemint will use:

- TypeScript and Node.js for the compiler implementation.
- A hand-written recursive descent parser.
- A strict module graph resolver.
- Explicit types with limited safe inference.
- Value semantics at the source level.
- Compiler-managed `const T&` optimization for provably immutable heavy struct parameters.
- `let` for mutable variables and `const` for immutable variables.
- `std::string` as the first emitted representation for `string`.
- Rich human diagnostics as a first-class requirement.
- Layered tests, golden snapshots, native C++ compilation, and runtime binary tests.
- npm packaging with a `doublemint` executable.
- `doublemint.config.json` for project configuration.
- Per-module `.hpp` and `.cpp` emission.
- Optional native compiler invocation from the CLI.

## Rationale

TypeScript/Node gives fast iteration, strong ecosystem tooling, and straightforward npm distribution.

Hand-written recursive descent gives precise control over syntax, recovery, and diagnostics, which matters because Doublemint is explicitly designed around developer experience.

Strict module resolution is required early because import/export semantics affect parser output, semantic validation, and emitted file structure.

Explicit types prevent the first compiler version from becoming a type inference project. Limited inference preserves some ergonomic value without destabilizing the core.

Value semantics keep source code simple. Compiler-managed references preserve performance without exposing C++ complexity directly to users.

`std::string` first keeps string semantics correct. `std::string_view` requires lifetime analysis and should arrive only after the semantic system can prove safety.

Per-module `.hpp` and `.cpp` output matches real C++ project structure better than a single generated file.

## Consequences

Good:

- The compiler can be built incrementally without sacrificing production architecture.
- Error quality remains central from the beginning.
- Generated C++ can scale beyond toy examples.
- Future optimization passes have a clear semantic foundation.

Costs:

- More up-front work than a single-file transpiler.
- Module graph and diagnostics must be designed early.
- Some advanced language features are deferred.
- Native compiler integration adds platform variability.

## Deferred Decisions

- Generics.
- Arrays and collection standard library design.
- Classes or interfaces.
- Async model.
- Package manager or external dependency format.
- CMake generation.
- JSON diagnostics protocol.
- `std::string_view` optimization pass.
- Editor tooling and language server.

