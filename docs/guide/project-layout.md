# Project layout

A minimal Doublemint project looks like this:

```text
my-app/
├── main.dlm
└── doublemint.config.json   (optional)
```

That's enough to run `doublemint build main.dlm --out my-app`.

## A larger project

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

- **`src/`** — your `.dlm` source tree. Imports between modules are *relative*:
  `import { Math } from "./util/math";` (no extension needed).
- **`native/`** — optional native C/C++ files compiled into the final binary
  via the `nativeSources` config key.
- **`build/doublemint/`** — emitted C++. Doublemint keeps these on disk so you
  can debug what the compiler produced.

## Module resolution

`import { Thing } from "..."`:

| Source | Resolves to |
| --- | --- |
| `"./util/math"` | a sibling `util/math.dlm` |
| `"../shared/strings"` | a parent-relative `shared/strings.dlm` |
| `"mint:io"` | a builtin module (see `doublemint info`) |

There is no package registry yet — every dependency is either a sibling
`.dlm` file or a builtin `mint:*` module.

## Config

`doublemint.config.json` lives next to your project root. All fields are
optional.

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

See the [config reference](/cli/config) for what each key does.
