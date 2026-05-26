# `mint:fmt`

Compact formatting helpers — padding, repeat, radix
conversion (hex / oct / bin), fixed-precision floats,
thousands-separated integers.

## Imports

```mint
import { Fmt } from "mint:fmt";
```

## API

| Symbol | Signature | Example |
| --- | --- | --- |
| `Fmt.padLeft` | `(text: string, width: int, pad: string): string` | `padLeft("42", 6, "0")` → `"000042"` |
| `Fmt.padRight` | `(text: string, width: int, pad: string): string` | `padRight("mint", 8, ".")` → `"mint...."` |
| `Fmt.repeat` | `(text: string, count: int): string` | `repeat("=", 10)` → `"=========="` |
| `Fmt.hex` | `(value: int64): string` | `hex(255)` → `"ff"` |
| `Fmt.hexUpper` | `(value: int64): string` | `hexUpper(255)` → `"FF"` |
| `Fmt.octal` | `(value: int64): string` | `octal(8)` → `"10"` |
| `Fmt.binary` | `(value: int64): string` | `binary(10)` → `"1010"` |
| `Fmt.precision` | `(value: double, places: int): string` | `precision(3.14159, 2)` → `"3.14"` |
| `Fmt.withThousands` | `(value: int64, separator: string): string` | `withThousands(1234567, ",")` → `"1,234,567"` |

## Example

```mint
import { println } from "mint:io";
import { Fmt } from "mint:fmt";

export function main(): void {
  let id: int64 = 42;
  println("user #" + Fmt.padLeft(id.toString(), 6, "0"));
  println("ratio = " + Fmt.precision(3.14159, 4));
  println("bytes: " + Fmt.withThousands(1234567, "_"));
  println("ansi: \\x" + Fmt.hex(27));
}
```
