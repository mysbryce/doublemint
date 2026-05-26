# `mint:base64`

Standard Base64 encode / decode.

## Imports

```mint
import { Base64 } from "mint:base64";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Base64.encode` | `(data: int[]): string` | Encode bytes into Base64. |
| `Base64.encodeText` | `(text: string): string` | Encode the UTF-8 bytes of a string. |
| `Base64.decode` | `(text: string): int[]` | Decode Base64 into bytes. |
| `Base64.decodeText` | `(text: string): string` | Decode and return as a UTF-8 string. |

## Example

```mint
import { Base64 } from "mint:base64";
import { println } from "mint:io";

export function main(): void {
  let encoded: string = Base64.encodeText("hello");
  println(encoded);  // aGVsbG8=

  let back: string = Base64.decodeText(encoded);
  println(back);     // hello
}
```
