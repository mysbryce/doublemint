# Configuration

`doublemint.config.json` lives next to the entry `.dlm` file. All fields
are optional — defaults are listed below.

```json
{
  "rootDir": "src",
  "outDir": "build/doublemint",
  "cppStandard": "c++20",
  "compiler": "g++",
  "includeDirs": [],
  "nativeSources": [],
  "libraryDirs": [],
  "linkLibraries": [],
  "linkerFlags": [],
  "warningsAsErrors": true,
  "optimization": "O3"
}
```

## Field reference

### `rootDir`

The directory the compiler considers the source root. Relative imports
are resolved against this directory.

### `outDir`

Where the generated `.hpp` / `.cpp` files land. `build` re-uses this
directory unless you pass `--cpp-out`.

### `cppStandard`

Currently `"c++20"`. Reserved for future C++23 / 26 work.

### `compiler`

Preferred compiler: `"g++"`, `"clang++"`, or `"c++"`. If the configured
compiler is missing the build pipeline falls back to whichever of the
three is on `PATH`.

### `includeDirs`

Extra `-I<dir>` flags forwarded to every translation unit.

### `nativeSources`

`.c` / `.cpp` files that should be compiled into the final binary.
`gcc` is used for `.c`, `g++` for `.cpp`.

### `libraryDirs`

Extra `-L<dir>` flags for the link step.

### `linkLibraries`

`-l<name>` libraries linked into the final binary, on top of the
vendored stdlib libs.

### `linkerFlags`

Raw flags appended verbatim to the link command.

### `warningsAsErrors`

When `true`, the build adds `-Wall -Wextra -Werror` to every compile
step. Disabling this is generally a regression; the REPL temporarily
turns it off so partial drafts compile cleanly.

### `optimization`

One of `"O0"`, `"O1"`, `"O2"`, `"O3"`. Forwarded as `-O<level>`.

## Minimal config

```json
{
  "rootDir": "src",
  "outDir": "build/doublemint",
  "warningsAsErrors": true
}
```

## Native interop config

```json
{
  "includeDirs": ["native"],
  "nativeSources": ["native/native_math.cpp"],
  "libraryDirs": ["/opt/lib"],
  "linkLibraries": ["pthread"],
  "linkerFlags": ["-Wl,-rpath,/opt/lib"]
}
```
