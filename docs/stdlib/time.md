# `mint:time`

Wall-clock, monotonic clock, and sleep helpers.

## Imports

```mint
import { Time } from "mint:time";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Time.nowMs` | `(): int64` | Wall-clock milliseconds since the Unix epoch. |
| `Time.nowSeconds` | `(): int64` | Wall-clock seconds since the epoch. |
| `Time.monotonicMs` | `(): int64` | Monotonic clock in milliseconds — safe for measuring elapsed time even when the wall clock jumps. |
| `Time.sleepMs` | `(ms: int): void` | Block the current thread for `ms` milliseconds. |
| `Time.format` | `(epochSeconds: int64, pattern: string): string` | Format a timestamp using `strftime`-style pattern. |

## Example

```mint
import { Time } from "mint:time";
import { println } from "mint:io";

export function main(): void {
  let start: int64 = Time.monotonicMs();
  Time.sleepMs(50);
  let elapsed: int64 = Time.monotonicMs() - start;

  println("slept ~" + elapsed.toString() + "ms");

  let now: int64 = Time.nowSeconds();
  println(Time.format(now, "%Y-%m-%d %H:%M:%S"));
}
```
