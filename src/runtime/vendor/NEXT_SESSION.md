# Next session: wire mint:http to uWebSockets

This document hands off the in-flight switch from cpp-httplib to uWebSockets.
Vendor sources, native-build plumbing, and language interleaving for
`-x c` / `-x c++` are already landed. The actual swap still needs to be
finished and the surface needs to clear MinGW.

## Status snapshot (handed off green)

- Vendor sources committed: libuv 1.48.0, uSockets 0.8.8, uWebSockets 20.74.0.
- `ResolvedModule.builtinNative` carries vendor dirs / source globs /
  defines / link libs / compile flags per platform.
- `emitCpp` collects them into `EmitResult.nativeSources`,
  `includeDirs`, `defines`, `compileFlags` (with a small glob resolver
  that walks `src/runtime/vendor/`).
- `nativeCompiler` now interleaves `-x c` / `-x c++` / `-x none` so the
  same g++ invocation can compile both languages.
- `mint:http` is still on cpp-httplib so 136/136 tests stay green.

## What blocked the swap mid-session

When I attached uWebSockets to mint:http and tried to build the
`examples/builtins/http/main.dlm` example on Windows MinGW, three
classes of failure showed up in the same g++ invocation:

1. **Pointer-type errors in `.c` files when compiled by g++.**
   Even with the `-x c` switch I added, MinGW g++ still surfaced
   `error: invalid conversion from 'void*' to 'T*' [-fpermissive]` on
   libuv internals (idna.c, inet.c) and on
   `uSockets/src/eventing/libuv.c`. -fpermissive demoted some but not
   all of them.

2. **C11 atomics not recognised under C++.**
   `uv-common.h`'s `(_Atomic int*)(p)` cast does not parse in g++
   C++ mode. This needs the file to truly be compiled as C, which
   means an actual `gcc` invocation, not `g++ -x c`.

3. **Win32 API signature differences seen from C++.**
   `SHGetKnownFolderPath` in MinGW's `<shlobj.h>` declares its first
   parameter as `REFKNOWNFOLDERID` (a C++ reference). libuv's
   `src/win/process.c` passes `&FOLDERID_LocalAppData_libuv`, which
   matches the C calling convention but not the C++ one. Same root
   cause as (2): the .c files have to compile via gcc.

The honest fix is to **split the compile into two passes** (gcc for
`.c`, g++ for `.cpp`, link with g++). That is the next session's first
job, because once it lands the same compile arguments we already pass
should flow through cleanly.

## Plan for next session

### 1. Two-pass compile pipeline (the real fix)

- Refactor `src/core/nativeCompiler.ts` so it:
  - Compiles every `.c` from `emitResult.nativeSources` to a `.o` via
    `gcc` (with the existing `-I` / `-D` flags, minus `-std=c++20`,
    plus `-std=c11`).
  - Compiles every `.cpp` (artifacts + user `nativeSources`) to a `.o`
    via `g++` with `-std=${config.cppStandard}`.
  - Links all `.o` plus libraries via `g++`.
  - Reuses a temp directory under `outDir/.cache/` for object files so
    repeated builds are warm.
- Delete the `-x c` / `-x c++` interleave (will become dead code).
- Update `selectCompiler` to also resolve a matching `gcc` (or
  `${preferred}c` style sibling); document the fallback order.
- Tests: keep `tests/core/nativeCompiler.test.ts` passing — the
  EmitResult shape doesn't change. Add one case asserting that a
  source list mixing `.c` and `.cpp` produces both `gcc` and `g++`
  invocations.

### 2. Re-attach uWebSockets to mint:http

The patch lives at `src/runtime/sources/http.cpp` /
`src/runtime/headers/http.hpp` in the local working tree — both reverted
to cpp-httplib for now. Diff that was in flight:

- New `http.hpp`: `HeaderMap` stays as before; `Context` holds a
  `std::shared_ptr<ContextState>` instead of raw cpp-httplib pointers;
  `Http` holds a `std::shared_ptr<ServerHolder>` whose member is a
  `std::unique_ptr<uWS::App>`.
- New `http.cpp` (the structure to recreate):
  - Wraps `#include "App.h"` in GCC diagnostic pragmas.
  - `ContextState` carries method/path/body/headers/pathParams/
    queryParams plus a pending status and pending headers list and an
    `ended` flag.
  - `ServerHolder` keeps the `uWS::App` and the `us_listen_socket_t*`
    so `Http::stop()` can call `us_listen_socket_close(0, ...)`.
  - `extractPathParamNames(pattern)` scans `":name"` segments — uWS
    exposes the values by ordinal index via `req->getParameter(i)`,
    not by name.
  - `parseQueryString(req->getQuery())` populates the query bag
    because `getQuery()` returns the raw query without the leading
    `?`.
  - **IMPORTANT FIX**: header iteration. The earlier draft used
    `req->forEach(...)`, which is not a member of uWS::HttpRequest.
    Replace with the range-based `for (auto h : *req) { ... }` /
    iterator API exposed in `HttpRequest.h`.
  - For request body, register `res->onData` and only invoke the Mint
    handler once `last` is true. For methods without bodies
    (GET/HEAD/OPTIONS) invoke the handler immediately after building
    the context.
  - `Http::listen` calls `app->listen(host, port, [&](auto* token) { ... })`
    and then `app->run()` (blocking, like cpp-httplib's `listen`).
  - On `text/json/html/send`, flush pending status + headers in order
    and call `res->end(body)`. Track `state->ended` so the bridge
    doesn't double-end after the handler returns.

### 3. mint:http `builtinNative` config to restore

The previous draft (also reverted) attached this to the mint:http
entry in `src/builtins/mintModules.ts`:

```ts
builtinNative: {
  vendorDirs: ["libuv/include", "libuv/src", "uSockets/src", "uWebSockets/src"],
  sources: [
    { vendorDir: "libuv/src", patterns: [
      "fs-poll.c", "idna.c", "inet.c", "random.c", "strscpy.c", "strtok.c",
      "thread-common.c", "threadpool.c", "timer.c", "uv-common.c",
      "uv-data-getter-setters.c", "version.c"
    ]},
    { vendorDir: "libuv/src/win", patterns: ["*.c"], platforms: ["win32"] },
    { vendorDir: "libuv/src/unix", patterns: [...common unix .c...], platforms: ["linux", "darwin"] },
    { vendorDir: "libuv/src/unix", patterns: [...linux-only...], platforms: ["linux"] },
    { vendorDir: "libuv/src/unix", patterns: [...darwin-only...], platforms: ["darwin"] },
    { vendorDir: "uSockets/src", patterns: ["bsd.c", "context.c", "loop.c", "socket.c", "udp.c"] },
    { vendorDir: "uSockets/src/eventing", patterns: ["libuv.c"] }
  ],
  defines: {
    win32: ["LIBUS_USE_LIBUV=1", "WIN32_LEAN_AND_MEAN", "_WIN32_WINNT=0x0602", "_CRT_SECURE_NO_WARNINGS"],
    linux: ["LIBUS_USE_LIBUV=1", "_FILE_OFFSET_BITS=64", "_LARGEFILE_SOURCE", "_GNU_SOURCE"],
    darwin: ["LIBUS_USE_LIBUV=1", "_DARWIN_UNLIMITED_SELECT=1"]
  },
  linkLibraries: {
    linux: ["pthread", "dl", "rt"],
    darwin: ["pthread"]
  }
}
```

And the existing `builtinLinkLibraries.win32` should expand to:
`["ws2_32", "iphlpapi", "psapi", "userenv", "advapi32", "dbghelp", "ole32", "uuid", "shell32"]`.

After the two-pass compiler lands, the `compileFlags` field becomes
unnecessary — gcc compiles the .c files with C semantics so
`-fpermissive` / `-Wno-error` aren't needed.

### 4. embed-runtime.mjs cleanup

When `http.cpp` switches to `#include "App.h"`, drop the cpp-httplib
prepend in `scripts/embed-runtime.mjs`. The vendored
`cpp-httplib.hpp` can stay on disk for now, but the embed step should
stop concatenating it into the http source snippet.

### 5. Benchmark vs Bun

Once the build clears, ship `examples/builtins/http_bench/main.dlm`
that mirrors a Bun hello-world server, then run wrk or autocannon
against both. Record numbers in `BENCHMARKS.md` so the comparison is
auditable rather than hand-wave.

## Files to expect in the failing draft (already reverted)

These existed in the working tree mid-session and were reverted so the
suite stays green. The next session needs to recreate them on top of
the two-pass compiler.

- `src/runtime/headers/http.hpp` (uWS-shaped Context/Http surfaces)
- `src/runtime/sources/http.cpp` (uWS::App wrapper)
- mint:http `builtinNative` block in `src/builtins/mintModules.ts`
- embed-runtime.mjs cpp-httplib prepend deletion

Good luck — most of the work this session was scaffolding; the next
session is mostly compiler plumbing and uWS API mapping.
