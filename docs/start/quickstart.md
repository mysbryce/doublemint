# Quickstart

Zero to "hello, mint" in under a minute.

## 1. Scaffold

```bash
doublemint init hello
cd hello
```

That creates `hello/main.dlm` with a hello-world template that uses the
project directory name as the embedded greeting.

```mint
// hello/main.dlm
import { println } from "mint:io";

export function main(): void {
  let name: string = "hello";
  println("hello from ${name}");
}
```

## 2. Build

```bash
doublemint build main.dlm --out hello
```

The build pipeline:

1. Emits `.hpp` / `.cpp` into `build/doublemint/`.
2. Compiles every `.c` with `gcc` and every `.cpp` with `g++`.
3. Links into `./hello`.

## 3. Run

```bash
./hello
```

```text
hello from hello
```

## What's next?

- **Tweak the source** and rerun `doublemint build` — the loop is fast
  enough to keep edit-compile-run as your inner cycle.
- **Try the REPL**: `doublemint repl` lets you type expressions and have
  them compiled + executed line by line. Imports and `let` declarations
  carry between lines.
- **Add a stdlib module**: `import { Http, Context } from "mint:http";`
  and you have an Elysia-style HTTP server.
- **Explore the docs**:
  - [Language overview](/language/overview)
  - [Stdlib catalogue](/stdlib/overview)
  - [CLI reference](/cli/commands)

## A bigger taste

```mint
import { println } from "mint:io";
import { String } from "mint:string";
import { Http, Context } from "mint:http";

export function main(): void {
  let app: Http = new Http();

  app.get("/", fn(ctx: Context): void => {
    ctx.send("hello from " + "mint".upper());
  });

  app.get("/sum/:n", fn(ctx: Context): void => {
    let n: int = ctx.params["n"] as int;
    let acc: int = 0;
    for (let i: int = 1; i <= n; i++) {
      acc += i;
    }
    ctx.json({ sum: acc });
  });

  println("listening on :3000");
  app.listen(3000);
}
```

```bash
doublemint build server.dlm --out server
./server
```

Hit `http://localhost:3000/sum/100` and you'll get
`{"sum":5050}` — backed by uWebSockets.
