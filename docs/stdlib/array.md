# `mint:array`

Higher-order helpers for `T[]` arrays. Also works method-style.

## Imports

```mint
import { Array } from "mint:array";
```

## Common operations

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Array.length` | `(xs: T[]): int` | Element count. |
| `Array.first` | `(xs: T[]): T` | First element. |
| `Array.last` | `(xs: T[]): T` | Last element. |
| `Array.push` | `(xs: T[], value: T): void` | Append. |
| `Array.pop` | `(xs: T[]): T` | Remove + return the last. |
| `Array.contains` | `(xs: T[], value: T): bool` | Membership test. |
| `Array.indexOf` | `(xs: T[], value: T): int` | First match, `-1` if absent. |
| `Array.reverse` | `(xs: T[]): T[]` | Reversed copy. |
| `Array.sort` | `(xs: T[]): T[]` | Ascending sort copy. |
| `Array.map` | `(xs: T[], fn: function(T): U): U[]` | Map. |
| `Array.filter` | `(xs: T[], fn: function(T): bool): T[]` | Filter. |
| `Array.reduce` | `(xs: T[], init: U, fn: function(U, T): U): U` | Fold. |
| `Array.join` | `(xs: string[], sep: string): string` | Concatenate string elements. |
| `Array.slice` | `(xs: T[], start: int, end: int): T[]` | Sub-array `[start, end)`. |
| `Array.concat` | `(a: T[], b: T[]): T[]` | Concatenate two arrays. |

## Example

```mint
import { Array } from "mint:array";
import { println } from "mint:io";

export function main(): void {
  let xs: int[] = [3, 1, 4, 1, 5, 9, 2, 6];

  let sorted: int[] = xs.sort();
  let doubled: int[] = xs.map(fn(n: int): int => n * 2);
  let evens: int[] = xs.filter(fn(n: int): bool => n % 2 == 0);
  let sum: int = xs.reduce(0, fn(acc: int, n: int): int => acc + n);

  println("sum = " + sum.toString());
  println("count = " + xs.length().toString());
}
```
