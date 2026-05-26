# `mint:memory`

Byte counters and raw allocation helpers — primarily for native interop.

## Imports

```mint
import { Memory } from "mint:memory";
```

## Counters

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Memory.allocCount` | `(): int` | Total allocations since process start. |
| `Memory.allocBytes` | `(): int64` | Total bytes ever allocated. |
| `Memory.liveBytes` | `(): int64` | Currently outstanding bytes. |
| `Memory.resetCounters` | `(): void` | Zero the counters. |

## Raw allocations (interop)

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Memory.alloc` | `(bytes: int64): int64` | `malloc`; returns an address. |
| `Memory.free` | `(address: int64): void` | `free`. |
| `Memory.copy` | `(dst: int64, src: int64, bytes: int64): void` | `memcpy`. |
| `Memory.zero` | `(address: int64, bytes: int64): void` | `memset(_, 0, _)`. |

Use these only when you need to pass raw pointers to an `extern`-bound
C function. Mint-level data structures (`int[]`, `Map<K,V>`, etc.) own
their own storage.

## Example

```mint
import { Memory } from "mint:memory";
import { println } from "mint:io";

export function main(): void {
  let before: int64 = Memory.liveBytes();

  // ... allocate some data ...

  let after: int64 = Memory.liveBytes();
  println("delta = " + (after - before).toString() + " bytes");
}
```
