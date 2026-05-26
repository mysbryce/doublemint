# Stdlib overview

Every `mint:*` module ships with the compiler. Run `doublemint info`
for the live list — this page is the curated catalogue grouped by
domain.

## Catalogue

| Domain | Modules |
| --- | --- |
| **I/O & Console** | [`mint:io`](./io) |
| **Files & Modules** | [`mint:fs`](./fs) |
| **Strings & Collections** | [`mint:string`](./string), [`mint:array`](./array), [`mint:collections`](./collections) |
| **Math & Numerics** | [`mint:math`](./math), [`mint:simd`](./simd), [`mint:fmt`](./fmt) |
| **Time & OS** | [`mint:time`](./time), [`mint:os`](./os), [`mint:process`](./process) |
| **HTTP Server** | [`mint:http`](./http) |
| **Networking & Sockets** | [`mint:net`](./net) |
| **JSON & Schema** | [`mint:json`](./json), [`mint:schema`](./schema) |
| **Crypto & Hashing** | [`mint:crypto`](./crypto), [`mint:base64`](./base64) |
| **Regex & Logging** | [`mint:regex`](./regex), [`mint:log`](./log) |
| **Database** | [`mint:sql`](./sql), [`mint:db`](./db) |
| **Async & Memory** | [`mint:async`](./async), [`mint:memory`](./memory) |
| **Terminal & Testing** | [`mint:term`](./term), [`mint:test`](./test) |

## Method-style on primitives

Any namespace function whose first parameter unifies with the receiver
becomes a method:

```mint
import { String } from "mint:string";

let name: string = "mint";
println(name.upper());        // == String.upper(name)
```

Numeric and bool primitives also get a built-in `.toString()` without
needing an import:

```mint
let n: int = 42;
let b: bool = true;
println(n.toString()); // "42"
println(b.toString()); // "true"
```

## Vendor footprint

Several modules pull in vendored C/C++ sources at link time. The
emitter automatically threads the right `-I`, `-L`, `-l` flags and
include the right `.c` / `.cpp` files in the build.

| Module | Vendored |
| --- | --- |
| `mint:http` | uWebSockets + uSockets + libuv |
| `mint:sql` | SQLite amalgamation |
| `mint:crypto` | SHA-256 / MD5 / HMAC (in-tree) |
| `mint:regex` | std::regex (no external dep) |
| `mint:process` | Win32 / POSIX process + memory APIs |

The rest are headers + small C++ helpers in
`src/runtime/sources/<module>.cpp`.
