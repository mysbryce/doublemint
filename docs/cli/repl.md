# `doublemint repl`

A per-line compile-and-run loop. Each input is wrapped in a fresh
`main`, compiled to a real binary, and executed. Imports and `let` /
`const` declarations persist across lines.

```bash
doublemint repl
```

```text
doublemint repl. type :help for commands, :exit to quit.
>> import { println } from "mint:io";
+ import (1 total)
>> import { String } from "mint:string";
+ import (2 total)
>> let name: string = "world";
+ decl (1 total)
>> println("hello " + name);
hello world
>> println(name.upper());
WORLD
>> :exit
```

## Meta commands

| Command | Effect |
| --- | --- |
| `:help` | Print the command reference. |
| `:show` | Dump accumulated imports + decls. |
| `:reset` | Clear repl state. |
| `:exit` / `:quit` | Leave the repl. |

## Input rules

- Lines starting with `import ` → remembered as imports and emitted at
  the top of every compile.
- Lines starting with `let ` / `const ` → remembered as persistent
  declarations inside `main()`, so later expressions can reference
  them.
- Anything else → appended as a statement in `main()`. Auto-`;` is
  added when missing; lines ending with `}` are left alone for
  block-style input.

## Under the hood

Every evaluation:

1. Writes a fresh `.dlm` into a per-line temp dir wrapping the input.
2. Runs the full resolver / semantic / emitter / native pipeline.
3. Executes the resulting `.exe`.
4. Pipes its stdout / stderr to the terminal.

`warningsAsErrors` is forced off inside the REPL so unused-but-not-yet-
referenced bindings don't trip the build.

## Tips

- Use `:show` to inspect the accumulated state if something stops
  compiling.
- Use `:reset` to start a fresh session without quitting.
- The REPL is slow on first launch (full toolchain spin-up); after that
  each iteration runs at native build speed.
