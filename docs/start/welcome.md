# Welcome

Doublemint is a `.dlm` → C++20 transpiler. It pairs TypeScript-style
ergonomics on the source side with plain, warning-clean C++ on the output
side. The generated binary links against a curated stdlib of vendored
C/C++ libraries (uWebSockets + libuv, SQLite, crypto helpers, JSON /
schema, etc.) so a Mint program can build a HTTP server, talk to a
database, or drive a native subprocess without writing FFI glue.

## What you'll find here

This site is organised into six top-level sections — pick the one that
matches what you're trying to do.

| Section | When to read it |
| --- | --- |
| [1. Get Started](./welcome) | First-time setup, install, hello world, project layout, editor. |
| [2. Core & Transpiler](/core/pipeline) | How the compiler actually works — lexer, parser, checker, emitter, native compile. |
| [3. Language](/language/overview) | Syntax, types, operators, pattern matching, async, native interop. |
| [4. CLI](/cli/commands) | Every `doublemint` command and flag. |
| [5. Standard Library](/stdlib/overview) | The `mint:*` modules grouped by domain — HTTP, networking, JSON, crypto, SQL, async, etc. |
| [6. Releases](/releases/) | Patch notes and roadmap. |

## A 60-second tour

```mint
import { println } from "mint:io";
import { String } from "mint:string";

enum Day { Mon, Tue, Wed }

async function fetchLevel(id: int): int {
  return id * 10;
}

export function main(): void {
  let day: Day = Day.Tue;
  let label: string = match (day) {
    Day.Mon => "monday",
    Day.Tue => "tuesday",
    _ => "wednesday"
  };

  let level: int = await fetchLevel(7);

  println("hello " + "mint".upper() + " — " + label);
  println("level = " + level.toString());
}
```

```bash
$ doublemint build hello.dlm --out hello
OK built ./hello with g++.
$ ./hello
hello MINT — tuesday
level = 70
```

## Conventions you'll see across the docs

- **Mint code** uses `mint`-tagged fences (highlighted as TypeScript).
- **Shell commands** are real, copy-pasteable invocations.
- **`DLM####`** is a stable error code — every diagnostic carries one,
  and every code is documented in
  [Core → Diagnostics](/core/diagnostics).
- **`mint:foo`** is a built-in module. `doublemint info` lists every
  one on demand.

Ready? Head to [Install](./install).
