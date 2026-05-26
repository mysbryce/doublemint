# `mint:async`

Lower-level concurrency primitives — threads, mutexes, atomics,
channels, parallel iteration. For declarative async work see the
language-level [`async / await`](/language/async).

## Imports

```mint
import { Async } from "mint:async";
```

## Threads

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Async.spawn` | `(fn: function(): void): int` | Spawn a worker thread. Returns a handle. |
| `Async.join` | `(handle: int): void` | Wait for a worker. |
| `Async.detach` | `(handle: int): void` | Forget about a worker (it keeps running). |
| `Async.sleepMs` | `(ms: int): void` | Sleep the current thread. |
| `Async.hardwareThreads` | `(): int` | `std::thread::hardware_concurrency`. |

## Parallel iteration

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Async.parallelFor` | `(n: int, fn: function(int): void): void` | Run `fn(0..n-1)` across worker threads. |
| `Async.parallelSum` | `(xs: int[]): int` | Reduce-style sum over a worker pool. |
| `Async.parallelMin` | `(xs: int[]): int` | Parallel min. |
| `Async.parallelMax` | `(xs: int[]): int` | Parallel max. |

## Mutex

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Async.createMutex` | `(): int` | Allocate a mutex. |
| `Async.lock` | `(handle: int): void` | Acquire. |
| `Async.unlock` | `(handle: int): void` | Release. |
| `Async.tryLock` | `(handle: int): bool` | Non-blocking acquire. |
| `Async.destroyMutex` | `(handle: int): void` | Free. |

## Atomic

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Async.createAtomic` | `(initial: int64): int` | Allocate an atomic int64. |
| `Async.atomicLoad` | `(handle: int): int64` | Load. |
| `Async.atomicStore` | `(handle: int, value: int64): void` | Store. |
| `Async.atomicAdd` | `(handle: int, delta: int64): int64` | Fetch-add. |
| `Async.atomicCas` | `(handle: int, expected: int64, desired: int64): bool` | Compare-and-swap. |
| `Async.destroyAtomic` | `(handle: int): void` | Free. |

## Channel

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Async.createChannel` | `(): int` | Allocate a string channel. |
| `Async.channelSend` | `(handle: int, value: string): void` | Push. |
| `Async.channelReceive` | `(handle: int): string` | Pop (blocking). |
| `Async.channelTryReceive` | `(handle: int): string` | Pop (non-blocking; empty if no message). |
| `Async.channelClose` | `(handle: int): void` | Close the channel. |
| `Async.destroyChannel` | `(handle: int): void` | Free. |

## Example: parallel sum

```mint
import { Async } from "mint:async";
import { println } from "mint:io";

export function main(): void {
  let xs: int[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let total: int = Async.parallelSum(xs);
  println("sum = " + total.toString());
}
```

## Example: channel ping-pong

```mint
import { Async } from "mint:async";
import { println } from "mint:io";

export function main(): void {
  let chan: int = Async.createChannel();

  let id: int = Async.spawn(fn(): void => {
    Async.channelSend(chan, "ping");
  });

  let msg: string = Async.channelReceive(chan);
  println("received " + msg);

  Async.join(id);
  Async.destroyChannel(chan);
}
```

## When to use which

- **`async function` / `await`** when you want one-shot wrapped Futures
  for sequential code.
- **`Async.spawn` / `Async.join`** when you want explicit thread
  lifecycle (Go-style goroutines).
- **`Async.parallelFor` / `Async.parallelSum`** for data-parallel
  iteration.
- **Mutex / atomic / channel** when threads need to share state safely.
