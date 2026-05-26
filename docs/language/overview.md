# Language overview

Doublemint is a statically-typed source-to-source compiler from `.dlm` files
to C++20. Programs look TypeScript-shaped on the source side and compile to
plain, warning-clean C++ on the output side.

## Hello

```mint
import { println } from "mint:io";

export function main(): void {
  println("hello");
}
```

```bash
$ doublemint build hello.dlm --out hello
OK built ./hello with g++.
$ ./hello
hello
```

## What you get

- **Explicit, static types** for every public surface; limited inference for
  obvious literals inside expressions.
- **Strict module graph** — relative `import`s, builtin `mint:*` imports,
  missing-export errors, circular-import errors all surface during `check`.
- **Pattern matching** with `match`, in both statement and expression form.
- **First-class native interop** — `extern "header" { … }` blocks bind
  existing C/C++ functions; `nativeSources` compiles your own.
- **Async / await** wired to C++ `std::future` + `std::async`.
- **Curated stdlib** — 24 `mint:*` modules cover IO, FS, HTTP server,
  WebSockets, SQLite, JSON, crypto, regex, process memory, schema
  validation, etc.

## Source / build / run

- [Syntax](./syntax) — declarations, statements, expressions, literals.
- [Operators](./operators) — arithmetic, comparison, logical, bitwise,
  shift, assignment, ternary.
- [Pattern matching](./match) — `match` as a statement and as an
  expression.
- [Async / Await](./async) — declaring async functions and awaiting
  them.
- [Lambdas & Generics](./lambdas-generics) — `fn` and free-function
  generics.
- [Structs & Enums](./structs-enums) — user-defined types.
- [Native interop](./native-interop) — `extern` blocks, pointers,
  `defer`.

For the type system itself, see [Core → Types](/core/types). For the
`mint:*` modules, see [Stdlib overview](/stdlib/overview).
