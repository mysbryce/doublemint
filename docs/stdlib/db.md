# `mint:db`

Simple in-memory key-value store. Good for caches, short-lived state,
test fixtures.

## Imports

```mint
import { KV } from "mint:db";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `KV.set` | `(key: string, value: string): void` | Insert / overwrite. |
| `KV.get` | `(key: string): string` | Read; empty string if missing. |
| `KV.has` | `(key: string): bool` | Membership test. |
| `KV.remove` | `(key: string): void` | Delete. |
| `KV.size` | `(): int` | Number of entries. |
| `KV.keys` | `(): string[]` | Snapshot of every key. |
| `KV.clear` | `(): void` | Drop everything. |

## Example

```mint
import { KV } from "mint:db";
import { println } from "mint:io";

export function main(): void {
  KV.set("user:1", "mint");
  KV.set("user:2", "bun");

  if (KV.has("user:1")) {
    println(KV.get("user:1")); // mint
  }

  println("size = " + KV.size().toString()); // 2

  for (let key of KV.keys()) {
    println(key + " -> " + KV.get(key));
  }
}
```

Storage is process-local — values disappear when the binary exits. For
persistence use [`mint:sql`](./sql).
