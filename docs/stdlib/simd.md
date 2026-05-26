# `mint:simd`

SIMD-style arithmetic over `int[]` and `float[]`. Each operation walks
both arrays element-wise and returns a fresh array; the runtime uses
the platform's vector intrinsics where possible.

## Imports

```mint
import { Simd } from "mint:simd";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Simd.addInt` | `(a: int[], b: int[]): int[]` | `a[i] + b[i]` |
| `Simd.subInt` | `(a: int[], b: int[]): int[]` | `a[i] - b[i]` |
| `Simd.mulInt` | `(a: int[], b: int[]): int[]` | `a[i] * b[i]` |
| `Simd.addFloat` | `(a: float[], b: float[]): float[]` | `a[i] + b[i]` |
| `Simd.subFloat` | `(a: float[], b: float[]): float[]` | `a[i] - b[i]` |
| `Simd.mulFloat` | `(a: float[], b: float[]): float[]` | `a[i] * b[i]` |
| `Simd.sumInt` | `(a: int[]): int` | Sum across the array. |
| `Simd.sumFloat` | `(a: float[]): float` | Sum across the array. |
| `Simd.dotFloat` | `(a: float[], b: float[]): float` | Dot product. |

## Example

```mint
import { Simd } from "mint:simd";
import { println } from "mint:io";

export function main(): void {
  let a: int[] = [1, 2, 3, 4];
  let b: int[] = [10, 20, 30, 40];

  let sum: int[] = Simd.addInt(a, b);
  let total: int = Simd.sumInt(sum);

  println("total = " + total.toString());
}
```

Arrays must have the same length — otherwise the underlying helper
clamps to the shorter and warns at runtime.
