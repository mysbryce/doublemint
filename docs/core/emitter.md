# Emitter

`src/emitter/cppEmitter.ts` lowers the checked AST into `.hpp` / `.cpp`
files plus a manifest of vendored runtime sources, include dirs, link
libraries, and platform compile flags.

## Output shape

Per module:

```
build/doublemint/
├── main.hpp        # struct / enum / type / function decls
├── main.cpp        # function bodies + module-level includes
├── other_mod.hpp
├── other_mod.cpp
└── ...
```

For programs that import `mint:*` modules, the emitter also writes the
vendored sources next to the generated files (or references them
in-place — see [Native compiler](./native-compiler)).

## Header preamble

Every `.hpp` starts with a fixed include block:

```cpp
#include <cstdint>
#include <future>
#include <functional>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <variant>
#include <vector>
```

Plus two inline helpers used by template literals and `bool.toString()`:

- `__doublemint_template_to_string<T>(value)` — turns any streamable
  value into `std::string`.
- `__doublemint_bool_to_string(value)` — `true` / `false`.

## Notable lowerings

| Mint | C++ |
| --- | --- |
| `enum Color { Red, … }` | `enum class Color { Red, … };` |
| `Color.Red` | `Color::Red` (only when receiver is a known enum) |
| `name.upper()` (primitive extension) | `String_upper(name)` |
| `n.toString()` | `std::to_string(n)` |
| `b.toString()` (bool) | `__doublemint_bool_to_string(b)` |
| `match (n) { ... }` | hoisted `__dlm_match_N` + if/else-if ladder |
| `match` expression | IIFE with chained ternaries |
| `await expr` | `(expr).get()` |
| `async function foo(): T` | `std::future<T> foo() { return std::async(std::launch::async, [=]() -> T { … }); }` |
| `defer expr;` | RAII guard via `__dlm_make_defer` |
| `` `hello ${x}` `` | string concat via `__doublemint_template_to_string` |
| `xs[i]` on a tuple | `std::get<I>(xs)` |
| `xs[i]` on a vector | `xs[i]` |
| `a + b` on strings | `(std::string(a) + std::string(b))` |
| bitwise / shift binaries | parenthesised so `-Wparentheses` stays quiet |

## Context

Most emit helpers take an `EmitContext`:

```ts
interface EmitContext {
  switchCounter: number;
  deferCounter: number;
  stringViewVariables: Set<string>;
  nativeFunctions: Map<string, string>;
  nativeMembers: Map<string, string>;
  enumNames: Set<string>;
  usesTemplateLiteral?: boolean;
}
```

- `switchCounter` / `deferCounter` generate unique temp names for
  `match` / `defer` lowerings.
- `stringViewVariables` is the set of `let` strings that the analyzer
  proved safe to emit as `std::string_view`.
- `nativeFunctions` / `nativeMembers` come from imported `mint:*`
  namespaces — they translate `String.upper` to the underlying
  `String_upper` native symbol.
- `enumNames` lets the emitter switch `.` to `::` for enum variant
  access.

## When you add an AST node

Every walker that recurses over `Statement` or `Expression` needs the
new case:

- `collectStringViewDeclarations`
- `collectAssignedRoots`
- `collectAssignedRootsFromExpression`
- `statementUsesPrint`
- `expressionUsesPrint`
- `statementUsesDefer`

TypeScript's `assertNever` catches missing ones at compile time. The
integration suite catches the runtime fallout.
