# `mint:math`

Numeric helpers and constants.

## Imports

```mint
import { Math } from "mint:math";
```

## Functions

| Symbol | Signature | Lowering |
| --- | --- | --- |
| `Math.abs` | `(n: double): double` | `std::abs` |
| `Math.sqrt` | `(n: double): double` | `std::sqrt` |
| `Math.pow` | `(b: double, e: double): double` | `std::pow` |
| `Math.exp` | `(n: double): double` | `std::exp` |
| `Math.log` | `(n: double): double` | `std::log` |
| `Math.log10` | `(n: double): double` | `std::log10` |
| `Math.sin` | `(n: double): double` | `std::sin` |
| `Math.cos` | `(n: double): double` | `std::cos` |
| `Math.tan` | `(n: double): double` | `std::tan` |
| `Math.atan` | `(n: double): double` | `std::atan` |
| `Math.atan2` | `(y: double, x: double): double` | `std::atan2` |
| `Math.floor` | `(n: double): double` | `std::floor` |
| `Math.ceil` | `(n: double): double` | `std::ceil` |
| `Math.round` | `(n: double): double` | `std::round` |
| `Math.trunc` | `(n: double): double` | `std::trunc` |
| `Math.truncToInt` | `(n: double): int` | helper |
| `Math.min` | `(a: double, b: double): double` | `std::min` |
| `Math.max` | `(a: double, b: double): double` | `std::max` |
| `Math.clamp` | `(n: double, lo: double, hi: double): double` | `std::clamp` |
| `Math.random` | `(): double` | `[0, 1)` uniform |
| `Math.randomInt` | `(lo: int, hi: int): int` | `[lo, hi]` uniform |

## Constants

| Symbol | Value |
| --- | --- |
| `Math.PI` | `std::numbers::pi` |
| `Math.E` | `std::numbers::e` |

## Example

```mint
import { Math } from "mint:math";
import { println } from "mint:io";

export function main(): void {
  let radians: double = 45.0 * Math.PI / 180.0;
  println(Math.sin(radians).toString());

  let dice: int = Math.randomInt(1, 6);
  println("rolled " + dice.toString());
}
```
