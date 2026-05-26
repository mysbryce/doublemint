# Type system

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

## Compound

| Mint | C++ |
| --- | --- |
| `T[]` | `std::vector<T>` |
| `[T1, T2]` | `std::tuple<T1, T2>` |
| `T?` | `std::optional<T>` |
| `T1 \| T2` | `std::variant<T1, T2>` |
| `Future<T>` | `std::future<T>` |
| `function(P): R` | `std::function<R(P)>` |

## User-defined

```mint
struct Profile { id: int; name: string; level: int; }
enum Day { Mon, Tue, Wed }
type Score = int;
```

- `struct` lowers to a plain C++ struct.
- `enum` lowers to `enum class Name { … }`; the emitter rewrites
  `Day.Mon` → `Day::Mon`.
- `type` is a transparent alias.

## Generics

```mint
function first<T>(xs: T[]): T {
  return xs[0];
}

let n: int = first([1, 2, 3]);
```

Generics only live on free functions today. The checker infers type
arguments from the call site via
`collectGenericSubstitutions` / `applyGenericSubstitution`. Generic
structs / classes are deferred.

## Async return type

The declared return type of an `async function` is the **inner** type.
The compiler synthesises the outer `Future<T>` so callers see the
wrapped type.

```mint
async function fetchLevel(id: int): int {
  return id * 10;
}

let f: Future<int> = fetchLevel(7);
let v: int = await f;
```

## Casts

```mint
let n: int = 1;
let d: double = n as double;
```

Lowers to `static_cast<double>(n)`. Casting between unrelated types
raises a semantic diagnostic.

## Pointer / reference (interop only)

```mint
extern "stdio.h" {
  type FILE;
  function fopen(path: const char*, mode: const char*): FILE*;
  function fclose(file: FILE*): int;
}
```

You can't currently create or dereference Mint-level pointers — they
exist purely so foreign signatures bind cleanly.

## Why explicit types?

- Errors at the source-level boundary (parameters, returns, struct
  fields) catch most semantic mistakes before C++ ever sees the code.
- The emitter can lower deterministically — `let xs: int[]` always
  becomes `std::vector<int>`, never something inferred at a distance.
- Editor tooling (hover, autocomplete) is straightforward because there
  is always a written-down type to surface.
