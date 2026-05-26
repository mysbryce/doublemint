# Types

## Built-in scalars

| Mint | C++ |
| --- | --- |
| `int` | `int` |
| `int64` | `std::int64_t` |
| `float` | `float` |
| `double` | `double` |
| `string` | `std::string` (or `std::string_view` for safe locals) |
| `bool` | `bool` |
| `char` | `char` |
| `void` | `void` |

`int` and `int64` count as integer for the integer-only operators
(`%`, bitwise, shift).

## Collections

```mint
let xs: int[] = [1, 2, 3];          // std::vector<int>
let pair: [int, string] = (1, "x"); // std::tuple<int, std::string>
```

## Optional and union

```mint
let maybe: int? = 5;                // std::optional<int>
let mixed: int | string = "hello";  // std::variant<int, std::string>
```

## User-defined

```mint
struct Profile { id: int; name: string; level: int; }
enum Day { Mon, Tue, Wed }
type Score = int;
```

- `struct` lowers to a plain C++ struct.
- `enum` lowers to `enum class Name { … }`; access variants with the `::`-style
  `Day.Mon`, which the emitter rewrites to `Day::Mon`.
- `type` is a transparent alias.

## Generics

```mint
function first<T>(xs: T[]): T {
  return xs[0];
}

let n: int = first([1, 2, 3]);
```

Generics are only on **free functions** today. Generic structs / classes
are deferred until the surface stabilises.

## Async return type

```mint
async function fetchLevel(id: int): int {
  return id * 10;
}

// Caller sees Future<int>:
let f: Future<int> = fetchLevel(7);
let v: int = await f;
```

The declared return type is the inner `T`. The compiler synthesises the
outer `Future<T>` so callers can hand off, store, or `await` it.

## Casts

```mint
let n: int = 1;
let d: double = n as double;
```

Lowers to `static_cast<double>(n)`. Casting between unrelated types raises
a semantic diagnostic.

## Pointer / reference (interop only)

Pointer and reference types are reserved for `extern` declarations:

```mint
extern "stdio.h" {
  type FILE;
  function fopen(path: const char*, mode: const char*): FILE*;
  function fclose(file: FILE*): int;
}
```

You can't currently create or dereference Mint-level pointers — they exist
purely so foreign signatures bind cleanly.
