# Module resolver

`src/resolver/moduleGraph.ts` walks every `import` in your project and
builds a strict dependency graph.

## What gets resolved

| Source | Treated as |
| --- | --- |
| `"./util/math"` | sibling `.dlm` file (extension implied) |
| `"../shared"` | parent-relative `.dlm` file |
| `"mint:io"` | builtin module from `src/builtins/mintModules.ts` |
| `"<system.h>"` or `"cmath"` | native include (only valid inside `extern "..." { ... }`) |

## Resolution rules

- Imports are **relative-only**. No package registry.
- Each module is parsed **once**, regardless of how many other modules
  import it.
- Circular imports raise a diagnostic — graph cycles are not allowed.
- Missing exports, duplicate exports, and unknown modules all raise
  `DLM3xxx` resolver diagnostics.

## What the resolver returns

```ts
interface ResolvedModule {
  filepath: string;
  builtin?: boolean;
  builtinIncludes?: string[];
  builtinLinkLibraries?: Partial<Record<NodeJS.Platform, string[]>>;
  builtinNative?: BuiltinNativeBundle;
  program: Program;            // the parsed AST
  imports: ResolvedImport[];   // one per source-level import
  exports: Map<string, ModuleExport>;
}
```

`builtinNative` is the per-module bundle of vendored C/C++ sources,
include dirs, link libraries, and platform flags. `mint:sql` brings in
the SQLite amalgamation, `mint:http` brings in uWebSockets + libuv +
uSockets, and so on. The emitter copies these into the build tree and
the native compiler picks them up alongside the generated `.cpp`.

## `import type`

```mint
import type { Profile } from "./types";
```

`import type` imports survive into the type-checker but not into the
value-side. The emitter does not generate an `#include` for them. Use it
for cross-module struct types that are only referenced in signatures.
