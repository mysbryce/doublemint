# `doublemint build`

Full pipeline: emit C++, compile every `.c` / `.cpp`, link a native
binary.

```bash
doublemint build src/main.dlm --out build/app
```

## Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `--out <path>` | `build/<entry-stem>` | Path to the final executable. |
| `--compiler <name>` | `config.compiler` | Override the configured compiler (`g++`, `clang++`, `c++`). |
| `--cpp-out <dir>` | `config.outDir` | Write generated `.hpp` / `.cpp` somewhere other than `outDir` for the duration of the build. |

## What runs

1. Resolve the module graph from `<entry.dlm>`.
2. Semantic check.
3. Emit `.hpp` / `.cpp` for every module + vendor sources for every
   imported `mint:*` runtime bundle.
4. `gcc -std=c11 -c` for every `.c` (vendored libuv / uSockets / SQLite
   amalgamation).
5. `g++ -std=c++20 -c` for every `.cpp` (Mint-generated + vendored
   C++ runtime + user `nativeSources`).
6. `g++` to link everything into the final executable.

If the configured C++ compiler is missing, the build falls back to the
next available among `g++`, `clang++`, `c++`. The C compiler is derived
to match (`gcc` for `g++`, `clang` for `clang++`, `cc` for `c++`).

## Windows MinGW fallback

If `g++ … -o app.exe` silently exits with code 5 (the well-known
`collect2` `COMPILER_PATH` / `LIBRARY_PATH` bug), Doublemint re-runs
`g++ -###` to capture the planned linker command, then spawns
`collect2.exe` directly with both env vars stripped. The fallback is
automatic — you don't need to opt in.

## Output

```text
OK built /path/to/app.exe with g++. C++ files kept in build/doublemint.
```

The emitted `.hpp` / `.cpp` files stay on disk so you can read what the
compiler produced. Use `--cpp-out <dir>` to keep a per-build raw C++
tree next to a chosen binary.

## Example: multi-file project

```bash
doublemint build examples/player/main.dlm --out build/player/app.exe
```

## Example: choose the compiler

```bash
doublemint build src/main.dlm \
  --out build/app \
  --compiler clang++ \
  --cpp-out build/raw
```
