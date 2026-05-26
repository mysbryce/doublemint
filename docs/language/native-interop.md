# Native interop

Doublemint can call existing C / C++ libraries via `extern "header" { … }`
blocks and compile your own native sources alongside the generated C++.

## `extern` blocks

```mint
extern "cmath" {
  function sqrt(num: double): double;
}

export function distance(x: double, y: double): double {
  return sqrt(x * x + y * y);
}
```

The emitter inserts `#include <cmath>` and calls `sqrt(...)` from the
generated C++. The header path can be:

| Form | Meaning |
| --- | --- |
| `"cmath"` | system header — `#include <cmath>` |
| `"<stdio.h>"` | system header (explicit) |
| `"./native.hpp"` | local header — `#include "./native.hpp"` |

## Opaque types

```mint
extern "stdio.h" {
  type FILE;
  function fopen(path: const char*, mode: const char*): FILE*;
  function fclose(file: FILE*): int;
}
```

`type FILE` declares an opaque native type — you can hold pointers to it
and pass it around, but you can't inspect its fields from Mint.

## Native symbol aliases

```mint
extern "./native.hpp" {
  function puts_alias(text: const char*): int as "std::puts";
}
```

`as "real_name"` lets the Mint identifier differ from the underlying
native symbol — handy for namespaced C++ symbols (`std::puts`) or for
exposing C functions with friendlier names.

## Pointer / reference syntax

| Mint | C++ |
| --- | --- |
| `T*` | `T*` |
| `T&` | `T&` |
| `const T*` | `const T*` |

`null` lowers to `nullptr`:

```mint
let file: FILE* = null;
if (file == null) {
  println("missing");
}
```

## `defer`

Use `defer` for native cleanup that should run at scope exit:

```mint
let file: FILE* = fopen("data.txt", "r");
defer fclose(file);
// ... read from file ...
```

The deferred expression runs in **reverse declaration order** when the
enclosing scope exits — same semantics as Go.

## Native sources

Drop `.c` / `.cpp` files into the project and list them in
`doublemint.config.json`:

```json
{
  "includeDirs": ["native"],
  "nativeSources": ["native/native_math.cpp"]
}
```

`build` compiles C files with `gcc` and C++ files with `g++`, then
links everything into the final binary.

## Linker controls

```json
{
  "libraryDirs": ["/usr/lib"],
  "linkLibraries": ["pthread", "dl"],
  "linkerFlags": ["-Wl,-Bstatic"]
}
```

The build pipeline forwards these to the link step (or to the collect2
fallback on Windows MinGW).

## What's *not* supported (yet)

- C++ classes with methods / virtual dispatch
- C++ templates / overload sets
- Calling-convention annotations (`__stdcall`, `__cdecl`)
- Multi-arity C++ overloads (use distinct Mint-side names via `as`)

Most of these will land alongside the planned Mint-side class system.
