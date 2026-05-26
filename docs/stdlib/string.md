# `mint:string`

String helpers exposed as a namespace that also works method-style on
any `string` value.

## Imports

```mint
import { String } from "mint:string";
```

## Common operations

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `String.upper` | `(s: string): string` | Uppercase. |
| `String.lower` | `(s: string): string` | Lowercase. |
| `String.trim` | `(s: string): string` | Trim leading + trailing whitespace. |
| `String.trimStart` | `(s: string): string` | Trim leading whitespace. |
| `String.trimEnd` | `(s: string): string` | Trim trailing whitespace. |
| `String.length` | `(s: string): int` | UTF-8 byte length. |
| `String.contains` | `(s: string, needle: string): bool` | Substring test. |
| `String.startsWith` | `(s: string, prefix: string): bool` | Prefix test. |
| `String.endsWith` | `(s: string, suffix: string): bool` | Suffix test. |
| `String.indexOf` | `(s: string, needle: string): int` | First match, `-1` if absent. |
| `String.replace` | `(s: string, find: string, with: string): string` | First-match replace. |
| `String.replaceAll` | `(s: string, find: string, with: string): string` | All matches. |
| `String.split` | `(s: string, separator: string): string[]` | Split into pieces. |
| `String.repeat` | `(s: string, count: int): string` | Repeat. |
| `String.substring` | `(s: string, start: int, end: int): string` | Substring `[start, end)`. |
| `String.slice` | `(s: string, start: int): string` | From `start` to end. |
| `String.charCodeAt` | `(s: string, index: int): int` | Byte code at index. |
| `String.fromCharCode` | `(code: int): string` | Single-char string from a code. |
| `String.padStart` | `(s: string, length: int, with: string): string` | Pad on the left. |
| `String.padEnd` | `(s: string, length: int, with: string): string` | Pad on the right. |

## Method-style

Every `String.xxx(s, ...)` works as `s.xxx(...)`:

```mint
import { String } from "mint:string";
import { println } from "mint:io";

export function main(): void {
  let name: string = "  mint  ";
  println(name.trim().upper());  // == String.upper(String.trim(name))
}
```

## Example

```mint
import { String } from "mint:string";
import { println } from "mint:io";

export function main(): void {
  let line: string = "alpha,beta,gamma";
  for (let part of String.split(line, ",")) {
    println(part.upper());
  }
}
```

(`for (let x of arr)` is a `for` with index sugar — see
[Language → Syntax](/language/syntax).)
