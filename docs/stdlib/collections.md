# `mint:collections`

Classic containers: `Stack`, `Queue`, `Set`.

## Imports

```mint
import { Stack, Queue, Set } from "mint:collections";
```

## `Stack<T>`

| Method | Purpose |
| --- | --- |
| `new Stack<T>()` | Construct. |
| `push(value: T): void` | Push onto the top. |
| `pop(): T` | Pop the top element. |
| `peek(): T` | Top element without removing it. |
| `size(): int` | Number of elements. |
| `isEmpty(): bool` | True if empty. |

## `Queue<T>`

| Method | Purpose |
| --- | --- |
| `new Queue<T>()` | Construct. |
| `enqueue(value: T): void` | Push to the back. |
| `dequeue(): T` | Pop from the front. |
| `peek(): T` | Front element without removing it. |
| `size(): int` | Number of elements. |
| `isEmpty(): bool` | True if empty. |

## `Set<T>`

| Method | Purpose |
| --- | --- |
| `new Set<T>()` | Construct. |
| `add(value: T): void` | Insert. |
| `remove(value: T): void` | Erase. |
| `contains(value: T): bool` | Membership test. |
| `size(): int` | Number of elements. |
| `isEmpty(): bool` | True if empty. |
| `values(): T[]` | Snapshot of every element. |

## Example

```mint
import { Stack, Queue, Set } from "mint:collections";
import { println } from "mint:io";

export function main(): void {
  let stack: Stack<int> = new Stack<int>();
  stack.push(1);
  stack.push(2);
  println(stack.pop().toString()); // 2

  let queue: Queue<string> = new Queue<string>();
  queue.enqueue("a");
  queue.enqueue("b");
  println(queue.dequeue()); // a

  let seen: Set<int> = new Set<int>();
  seen.add(7);
  seen.add(7);
  println(seen.size().toString()); // 1
}
```
