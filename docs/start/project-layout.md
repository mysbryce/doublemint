# Project layout

## Minimal

```text
my-app/
├── main.dlm
└── doublemint.config.json   (optional)
```

Enough to run `doublemint build main.dlm --out my-app`.

## A real-shaped project

```text
my-app/
├── doublemint.config.json
├── src/
│   ├── main.dlm
│   ├── types.dlm
│   └── util/
│       ├── math.dlm
│       └── strings.dlm
├── native/
│   └── native_math.cpp
└── build/
    └── doublemint/         # generated .hpp / .cpp / object files
```

- **`src/`** — your `.dlm` source tree. Imports between modules are
  *relative*: `import { Math } from "./util/math";` (no extension).
- **`native/`** — optional native C/C++ files compiled into the final
  binary via the `nativeSources` config key.
- **`build/doublemint/`** — emitted C++. Doublemint keeps these on disk
  so you can debug what the compiler produced.

## Module resolution

`import { Thing } from "..."`:

| Source | Resolves to |
| --- | --- |
| `"./util/math"` | sibling `util/math.dlm` |
| `"../shared/strings"` | parent-relative `shared/strings.dlm` |
| `"mint:io"` | a builtin module (see `doublemint info`) |

No package registry yet — every dependency is either a sibling `.dlm`
file or a builtin `mint:*` module.

## Config

`doublemint.config.json` is optional. See
[Core → Configuration](/core/config) for the full field reference.

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
