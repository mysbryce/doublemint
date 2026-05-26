# Syntax

## Bindings

```mint
let mutable: int = 1;
const fixed: int = 2;
constexpr COUNT: int = 8;
```

- `let` — mutable binding.
- `const` — immutable binding.
- `constexpr` — compile-time constant.

## Imports

```mint
import { println } from "mint:io";
import { String } from "mint:string";
import { Profile } from "./types";
import type { Player } from "./types";
```

`import type { … }` brings in symbols that are only used in type position —
they don't survive into the emitted C++ value-side.

## Functions

```mint
function add(a: int, b: int): int {
  return a + b;
}

export function greet(name: string): void {
  println("hi " + name);
}

async function fetchLevel(id: int): int {
  return id * 10;
}

function pair<T>(a: T, b: T): [T, T] {
  return (a, b);
}
```

- Parameters and return type are always explicit.
- `export` makes the symbol visible from other modules.
- `async function` returns `Future<T>`; the body returns the inner `T`.
- Generic free functions accept type parameters in angle brackets and are
  inferred from the call site.

## Structs and enums

```mint
struct Profile {
  id: int;
  name: string;
  level: int;
}

enum Day { Mon, Tue, Wed }

export function example(): void {
  let p: Profile = Profile { id: 1, name: "mint", level: 3 };
  let d: Day = Day.Tue;
}
```

## Statements

```mint
if (n > 0) {
  println("positive");
} else if (n == 0) {
  println("zero");
} else {
  println("negative");
}

for (let i: int = 0; i < 5; i++) {
  println(i.toString());
}

while (running) {
  step();
}

switch (label) {
  case "ok": { handleOk(); }
  case "err": { handleErr(); }
  default: { fallback(); }
}

defer fclose(file);
```

## Pattern matching

`match` works both as a statement and as an expression. See the
[Pattern matching](./match) page for the deep dive.

```mint
let label: string = match (n) {
  0 => "zero",
  1 => "one",
  _ => "many"
};
```

## Lambdas

```mint
let inc: function(int): int = fn(value: int): int => value + 1;

let block: function(int): int = fn(value: int): int => {
  let doubled: int = value * 2;
  return doubled + 1;
};
```

## Template literals

```mint
let name: string = "mint";
println(`hello ${name}`);
```

## Tuples and destructuring

```mint
function scoreLabel(): [int, string] {
  return (7, "mint");
}

const [score, name] = scoreLabel();
```

## Arrays

```mint
let xs: int[] = [1, 2, 3];
let grid: int[][] = [[1, 2], [3, 4]];
```

Use the `mint:array` namespace for higher-order helpers
(`xs.map(fn)`, `xs.filter(fn)`, etc.).

## Optional and union

```mint
let maybe: int? = 5;
let mixed: int | string = "hello";
```

## Cast and copy

```mint
let n: int = 1;
let d: double = n as double;

let owned: Profile = copy borrowed;
```

## Native interop

See [Native interop](./native-interop) for the full surface.

```mint
extern "cmath" {
  function sqrt(num: double): double;
}
```
