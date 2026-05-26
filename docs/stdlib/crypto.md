# `mint:crypto`

Hashing and HMAC helpers — SHA-256, MD5, HMAC-SHA256 — implemented
from scratch and verified against RFC test vectors.

## Imports

```mint
import { Crypto } from "mint:crypto";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Crypto.sha256` | `(data: int[]): int[]` | Raw SHA-256. |
| `Crypto.sha256Hex` | `(text: string): string` | Hex-encoded SHA-256 of a string. |
| `Crypto.md5` | `(data: int[]): int[]` | Raw MD5. |
| `Crypto.md5Hex` | `(text: string): string` | Hex-encoded MD5. |
| `Crypto.hmacSha256` | `(key: int[], data: int[]): int[]` | HMAC-SHA256. |
| `Crypto.hmacSha256Hex` | `(key: string, message: string): string` | Hex-encoded HMAC. |
| `Crypto.toHex` | `(data: int[]): string` | Hex-encode a byte array. |
| `Crypto.fromHex` | `(text: string): int[]` | Decode a hex string into bytes. |
| `Crypto.randomBytes` | `(n: int): int[]` | Cryptographically secure random bytes. |

## Example

```mint
import { Crypto } from "mint:crypto";
import { println } from "mint:io";

export function main(): void {
  let hash: string = Crypto.sha256Hex("hello");
  println(hash); // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

  let signature: string = Crypto.hmacSha256Hex("secret", "payload");
  println(signature);
}
```

For Base64 encoding, see [`mint:base64`](./base64). For asymmetric
crypto / TLS, OpenSSL bindings are on the roadmap.
