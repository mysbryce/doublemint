# Native compiler

`src/core/nativeCompiler.ts` invokes the C/C++ toolchain after the
emitter writes generated sources to disk.

## Pipeline

```
gcc -std=c11   -c file.c   -o build/.doublemint-obj/file.<hash>.o
g++ -std=c++20 -c file.cpp -o build/.doublemint-obj/file.<hash>.o
g++ <flags> *.o -o build/app[.exe]
```

Steps:

1. **Per-file compile**. Each `.c` and `.cpp` source — Mint-generated,
   vendored from a `mint:*` module, or listed in
   `config.nativeSources` — compiles into a hash-named object file in
   `<outDir>/.doublemint-obj/`. The hash keeps incremental builds
   deterministic and avoids stale `.o` files when sources change.
2. **Link**. All objects are passed to `g++` (or `clang++`, depending
   on the configured compiler) along with `-L`, `-l`, and any raw
   linker flags from the config.

## Compiler selection

`config.compiler` picks the C++ driver. `selectCCompiler(cxx)` derives
the matching C driver:

| C++ | C |
| --- | --- |
| `g++` | `gcc` |
| `clang++` | `clang` |
| `c++` | `cc` |

If the configured driver is missing, the build falls back to the next
available among `g++`, `clang++`, `c++` (and the matching C compiler).

## MinGW collect2 fallback

On Windows MinGW UCRT64 the link step occasionally fails with a silent
`collect2: error: ld returned 5 exit status` because of stale
`COMPILER_PATH` / `LIBRARY_PATH` env vars.

`linkWithFrontendOrCollect2`:

1. Tries `g++ … *.o -o app.exe`.
2. On silent exit-5, re-runs `g++ -###` to capture the planned linker
   command.
3. Parses the `collect2.exe` invocation out of the printed shell
   tokens.
4. Spawns `collect2.exe` directly with `COMPILER_PATH` /
   `LIBRARY_PATH` stripped from the environment.

You don't need to do anything — the fallback runs transparently.

## Argument list size

Windows has a ~32KB process argument limit. With 44+ object files at
~70 chars each, the link command is roughly ~3KB — comfortably under
the limit. The build pipeline passes object files directly on `argv`
rather than via `@response` files because `g++` would otherwise
rewrite the response file into a new temp file that gets deleted
before `collect2` reads it.

## What gets compiled

| Source | Compiler |
| --- | --- |
| Emitted `.cpp` | `g++` |
| Vendored runtime `.cpp` (e.g. SQL, HTTP) | `g++` |
| Vendored runtime `.c` (e.g. SQLite amalgamation, libuv, uSockets) | `gcc` |
| `config.nativeSources` `.cpp` | `g++` |
| `config.nativeSources` `.c` | `gcc` |

The two-pass split exists because the vendored libuv / uSockets sources
are C — they don't compile cleanly under `g++` because of strict-prototype
warnings that turn into errors under `-Werror`.
