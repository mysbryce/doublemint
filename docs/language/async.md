# Async / Await

Doublemint's `async function` returns `Future<T>` — a thin wrapper over C++
`std::future<T>`. `await expr` blocks on the future and unwraps to `T`.

## Declaring an async function

```mint
async function fetchValue(): int {
  return 42;
}
```

The declared return type is the **inner** type. The compiler synthesises the
outer `Future<int>` so callers see the wrapped type.

Lowered C++:

```cpp
std::future<int> fetchValue() {
  return std::async(std::launch::async, [=]() -> int {
    return 42;
  });
}
```

## Awaiting

```mint
import { println } from "mint:io";

async function fetchValue(): int { return 42; }

export function main(): void {
  let value: int = await fetchValue();
  println(value.toString());
}
```

`await expr`:

- Requires `expr` to be a `Future<T>` — otherwise `DLM4079`.
- Returns the inner `T`.
- Lowered to `(expr).get()`.

## Wrapping a closure with `Async.run`

When the unit of work doesn't deserve a named function,
`Async.run(fn)` converts a zero-arg closure into a
`Future<T>` — `T` is inferred from the closure's return.

```mint
import { Async } from "mint:async";

export function main(): void {
  let f: Future<int> = Async.run(fn(): int => 21 * 2);
  let v: int = await f;  // 42

  let chunks: Future<int>[] = [
    Async.run(fn(): int => compute(0, 1000)),
    Async.run(fn(): int => compute(1000, 2000))
  ];
  let total: int = 0;
  for (let chunk of chunks) {
    total += await chunk;
  }
}
```

Lowers to `std::async(std::launch::async, fn)`, same as
the async-function form.

## Storing without awaiting

```mint
let f: Future<int> = fetchValue();
// ... do other work ...
let v: int = await f;
```

A non-awaited call is a regular value you can pass around, store in a
struct, etc.

## Combining with `mint:async`

The `mint:async` module exposes the lower-level primitives (`spawn`,
`join`, `parallelFor`, mutexes, atomics, channels). They use integer
handles, not `Future<T>` — so they're complementary to `async function`,
not redundant.

```mint
import { Async } from "mint:async";

export function main(): void {
  let id: int = Async.spawn(fn(): void => {
    Async.sleepMs(50);
  });
  Async.join(id);
}
```

## Limitations

- Every `async function` call launches a worker thread (`std::launch::async`).
  A pluggable executor / lazy `deferred` policy is on the roadmap.
- No `await` outside of regular function bodies yet (no top-level await).
- No `Promise.all` / `Future.all` helper yet — call `.get()` on each
  manually for now.
