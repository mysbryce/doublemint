# Pipeline

How a `.dlm` file becomes a native binary.

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
 Emitter (src/emitter)    — .hpp + .cpp per module, plus vendored runtime sources
   │
   ▼
 Native compiler (src/core/nativeCompiler.ts)
                          — gcc for .c → .o, g++ for .cpp → .o, g++ for link.
                            Windows MinGW collect2 fallback strips
                            COMPILER_PATH/LIBRARY_PATH and re-invokes the linker.
```

Each layer in detail:

- [Type system](./types) — the type vocabulary and how it lowers to C++.
- [Module resolver](./modules) — relative imports, builtin imports,
  circular-import detection.
- [Semantic checker](./checker) — symbols, scopes, generics, mutation,
  exhaustiveness.
- [Emitter](./emitter) — the C++ generation strategy.
- [Native compiler](./native-compiler) — two-pass compile + link
  pipeline.
- [Diagnostics](./diagnostics) — error-code ranges and what each layer
  raises.
- [Configuration](./config) — every `doublemint.config.json` field.

## Why TypeScript on Node?

Two reasons:

1. The compiler is small enough to live in one repo and ship as an
   npm package with a single `doublemint` binary.
2. The author / contributor pool that knows TypeScript heavily overlaps
   with the pool that wants TS-style ergonomics over C++.

The compiler itself is hand-written — no compiler generator, no
external parser library. The lexer and parser are recursive-descent
TypeScript modules under `src/lexer/` and `src/parser/`.

## What the compiler is **not**

- Not a JIT — `doublemint repl` compiles every line into a real binary.
- Not interpreted — there is no interpreter, only the native pipeline.
- Not a runtime — Doublemint generates code that links against the
  vendored C/C++ stdlib, but it doesn't ship its own garbage collector
  or VM.
