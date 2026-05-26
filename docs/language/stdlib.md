# Stdlib

The `mint:*` modules ship with the compiler. Run `doublemint info` for the
full live list — this page is a curated overview.

## Tour

| Module | Highlights |
| --- | --- |
| `mint:io` | `print`, `println`, `IO.eprint`. |
| `mint:fs` | File reads / writes, path helpers, mkdir / rm. |
| `mint:os` | `OS.platform()`, `OS.cwd()`, env vars. |
| `mint:process` | Run shell commands, read / write process memory, AOB scan, pointer chains. |
| `mint:time` | Wall clock, monotonic clock, sleep. |
| `mint:string` | Case conversion, trim, split, format. |
| `mint:array` | Map / filter / reduce, sort, length, append. |
| `mint:collections` | `Stack<T>`, `Queue<T>`, `Set<T>` classes. |
| `mint:math` | Trig, sqrt, abs, min/max, PI constant. |
| `mint:json` | Encode / decode, pretty-print. |
| `mint:regex` | PCRE-style `Regex` class with `match`, `replace`, `split`. |
| `mint:log` | Severity-tagged logger. |
| `mint:crypto` | SHA-256, MD5, HMAC, hex helpers. |
| `mint:base64` | encode / decode. |
| `mint:net` | URL parsing, low-level HTTP request. |
| `mint:http` | uWebSockets-backed Elysia-style server, outbound `Fetch`, WebSockets. |
| `mint:async` | `spawn`, `join`, mutex, atomic, channel, parallelFor. |
| `mint:memory` | Byte counters, raw alloc / free for native interop. |
| `mint:simd` | SIMD-style ops over int / float arrays. |
| `mint:db` | In-memory KV store. |
| `mint:sql` | Vendored SQLite — `Database` class, `SqlResult` rows. |
| `mint:term` | ANSI styling, cursor moves, color helpers. |
| `mint:schema` | Validation DSL with min/max/length/items/oneOf/pattern. |
| `mint:test` | `Test.run`, `Test.expect*`, exit-code-driven runner. |

## HTTP example

```mint
import { Http, Context } from "mint:http";
import { println } from "mint:io";

export function main(): void {
  let app: Http = new Http();

  app.get("/hello", fn(ctx: Context): void => {
    ctx.send("hello, world");
  });

  app.get("/ping/:name", fn(ctx: Context): void => {
    let name: string = ctx.params["name"];
    ctx.json({ pong: name });
  });

  println("listening on :3000");
  app.listen(3000);
}
```

## SQLite example

```mint
import { Database, SqlResult } from "mint:sql";
import { println } from "mint:io";

export function main(): void {
  let db: Database = new Database(":memory:");
  db.exec("create table users (id integer primary key, name text)");
  db.execParams("insert into users (name) values (?)", ["mint"]);

  let result: SqlResult = db.query("select id, name from users");
  for (let i: int = 0; i < result.rowCount(); i++) {
    println(result.getString(i, "name"));
  }
}
```

## Crypto example

```mint
import { Crypto } from "mint:crypto";
import { println } from "mint:io";

export function main(): void {
  println(Crypto.sha256Hex("mint"));
  println(Crypto.hmacSha256Hex("key", "msg"));
}
```

See `doublemint info` for the rest, and the integration test suite for
copy-pasteable usage examples per module
(`tests/integration/mint*Build.test.ts`).
