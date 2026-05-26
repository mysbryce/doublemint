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

## Progress update (session 2)

- Two-pass compile is **landed** in `src/core/nativeCompiler.ts`. gcc
  compiles every `.c` to its own `.o`, g++ compiles every `.cpp` to
  its own `.o`, and a final g++ invocation links the lot. Object
  files live in `<outDir>/.doublemint-obj/<basename>.<hash>.o`. The
  final link reads the object list from a response file
  (`link.rsp`) to dodge the Windows command-line length cap.
- `selectCCompiler(cxxCompiler)` maps `g++` -> `gcc`, `clang++` ->
  `clang`, `c++` -> `cc`, with the same `commandExists` fallback
  ladder we use for C++.
- Compile half now succeeds on Windows: libuv .c files build via
  gcc cleanly, uSockets .c files (including
  `src/eventing/libuv.c` under the LIBUS_USE_LIBUV define) build
  cleanly, and `main.cpp` (with the uWS::App wrapper) compiles via
  g++. All 44 objects land in the obj cache for a clean http example
  attempt.

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
`.c`, g++ for `.cpp`, link with g++). That landed this session.

## New blocker (session 2) — linker silent exit 5

With 44 .o files compiled cleanly, `g++` link reports nothing on
stderr except `collect2.exe: error: ld returned 5 exit status`.
Running `ld` directly emits the real diagnostics (1,800+ lines of
undefined references like `__imp__assert`, `strlen`, `memcpy`,
`std::cout`, `vtable for __cxxabiv1::__si_class_type_info`),
so the wrapper layer is hiding the symbol issues somehow.

The undefined refs themselves suggest the CRT + libstdc++ links
aren't being satisfied:

- libuv's `assert()` macro expands to `__imp__assert`, which UCRT
  exposes as `_assert` / `_wassert`. Either lib mismatch or missing
  `-DNDEBUG` (tried -DNDEBUG; didn't help).
- C++ standard library symbols missing — should be auto-pulled by
  g++ but apparently aren't reaching the response-file path.

### Root cause — narrowed in session 3

The linker isn't the bug; the `g++` frontend on MSYS2 UCRT64
(GCC 15.2.0) is. Reproducer:

```bash
# Works: collect2 directly, with the EXACT args g++ -### prints,
# exits with code 1 and prints the real 50-line undefined-reference list.
"$LIBEXEC/collect2.exe" -plugin … -m i386pep … main.cpp.o libuv.o -lstdc++ … -o t.exe

# Fails: g++ wrapping that same collect2 call.
g++ main.cpp.o libuv.o -o t.exe
# -> stderr is just: collect2.exe: error: ld returned 5 exit status
```

Same env, same args, same collect2 binary; only the parent process
differs. `ld` direct also works (exit 1, full diagnostics). The
bug is between `g++.exe` and `collect2.exe` on this specific
MinGW UCRT64 build — most likely a stderr pipe handling issue
(collect2's child output never reaches g++'s reporting layer, and
some other failure path converts the underlying ld error into the
opaque "5" code).

### Workaround paths to try next

1. **Bypass g++ for the link step.** From nativeCompiler, query
   GCC for `collect2.exe` (`g++ --print-prog-name=collect2`) plus
   the implicit args via `g++ -###`, then invoke collect2 directly.
   collect2 in shell already proved it surfaces real errors.
2. **Try a different MinGW.** This is reproducible on MSYS2 UCRT64
   GCC 15.2.0. Compile + link with MSYS2 MINGW64 (GCC 14) or
   LLVM-MinGW to see whether it's just this one toolchain.
3. **Static-link libuv into a `.a` first.** `ar rcs libuv.a *.o`
   gave the same exit 5 in shell (already tried), so probably not
   the way.

The compile half of the pipeline is solid — once a working link
path exists, the rest of the swap (uWebSockets http.cpp + the
builtinNative bundle on mint:http) is a copy-paste from the
already-drafted code below.

## Reverted (again) so the suite stays green

After hitting the linker exit-5, the mint:http rewrite + builtinNative
block + embed-runtime.mjs cpp-httplib prepend were reverted in the
working tree. The same drafts as session 1 still apply; the only
difference now is that the two-pass compile is already in place.

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
