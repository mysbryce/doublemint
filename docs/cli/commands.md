# Commands

```bash
doublemint check <entry.dlm>             # lex / parse / resolve / semantic only
doublemint check --stdin-filepath <p>    # check unsaved source piped on stdin
doublemint emit <entry.dlm>              # write .hpp / .cpp into outDir
doublemint build <entry.dlm> --out <bin> # emit + invoke the native compiler
doublemint fmt <entry.dlm> [--write | --check]
doublemint repl                          # interactive evaluator
doublemint init [dir]                    # scaffold a hello-world project
doublemint info                          # list every mint:* builtin module
doublemint version                       # print the current version
```

## `check`

Runs the lexer, parser, resolver, and semantic checker. No files are
written. Exit code is `0` on success, `1` on any diagnostic.

```bash
doublemint check src/main.dlm
```

`--stdin-filepath <path>` reads the source from stdin but reports
diagnostics relative to `<path>`. The VS Code extension uses this to lint
unsaved buffers.

## `emit`

Writes `.hpp` and `.cpp` files into `outDir` (default
`build/doublemint`). Does *not* invoke the native compiler.

```bash
doublemint emit src/main.dlm
```

## `build`

Full pipeline: emit, compile every `.c` / `.cpp` (Mint-generated, vendored
runtime, user `nativeSources`), link.

```bash
doublemint build src/main.dlm --out build/app
```

Flags:

| Flag | Purpose |
| --- | --- |
| `--out <path>` | Path for the final executable. |
| `--compiler <g++ \| clang++ \| c++>` | Override the configured compiler. Falls back to whichever of the three is on `PATH`. |
| `--cpp-out <dir>` | Write generated `.hpp` / `.cpp` somewhere other than `outDir` for the duration of the build. |

The compile pipeline is:

1. `gcc -std=c11 -c file.c -o file.o`
2. `g++ -std=c++20 -c file.cpp -o file.o`
3. `g++ … *.o -o build/app`

On Windows MinGW, if `g++` link fails with the silent collect2 exit-5,
Doublemint re-runs `g++ -###` to capture the planned linker command, then
spawns `collect2` directly with `COMPILER_PATH` / `LIBRARY_PATH` stripped
from the environment.

## `fmt`

```bash
doublemint fmt main.dlm           # prints formatted source to stdout
doublemint fmt main.dlm --write   # rewrites the file in place
doublemint fmt main.dlm --check   # exit 1 if changes are needed
```

The formatter normalises line endings, strips trailing whitespace,
collapses 2+ blank lines into one, and ensures a single trailing newline.

`--write` and `--check` are mutually exclusive.

## `repl`

```bash
doublemint repl
```

A per-line compile-and-run loop. Each input is wrapped in a fresh `main`,
compiled to a real binary, and executed. State (imports, persistent
declarations) carries between lines.

Meta commands:

| Command | Effect |
| --- | --- |
| `:help` | Print the command reference. |
| `:show` | Dump accumulated imports + decls. |
| `:reset` | Clear repl state. |
| `:exit` / `:quit` | Leave the repl. |

Lines starting with `import ` are remembered as imports; lines starting
with `let ` / `const ` become persistent decls; everything else is
appended as a statement in `main()` and executed.

## `init`

```bash
doublemint init my-app
```

Creates the target directory (if missing) and drops a `main.dlm`
hello-world template using the directory name as the embedded greeting.
Refuses to overwrite an existing `main.dlm`.

`doublemint init` (no argument) scaffolds into the current directory.

## `info`

```bash
doublemint info
```

Walks the live builtin manifest and prints every `mint:*` module with the
kind of each thing it exports. Safe to run outside any project.

## `version`

All three are equivalent:

```bash
doublemint version
doublemint --version
doublemint -v
```
