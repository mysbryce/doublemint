# Vendored runtime libraries

These trees are copied verbatim from upstream and live in-tree so that
Mint's native build pipeline can compile against them without an
external dependency.

| Library | Version | Source | License |
| --- | --- | --- | --- |
| cpp-httplib | 0.18.5 | https://github.com/yhirose/cpp-httplib | MIT |
| libuv | 1.48.0 | https://github.com/libuv/libuv | MIT-like (see libuv/LICENSE) |
| uSockets | 0.8.8 | https://github.com/uNetworking/uSockets | Apache 2.0 |
| uWebSockets | 20.74.0 | https://github.com/uNetworking/uWebSockets | Apache 2.0 |

## Layout

- `cpp-httplib.hpp` — current backend for `mint:http`, prepended to the
  generated translation unit by `scripts/embed-runtime.mjs`.
- `libuv/` — full source + headers + LICENSE. uSockets uses this as its
  event-loop backend on every platform we support so we get the same
  Windows IOCP path Bun gets.
- `uSockets/` — uSockets sources + LICENSE. We compile its `src/` files
  alongside the generated main translation unit.
- `uWebSockets/` — header-only modern C++ HTTP/WebSocket server built on
  top of uSockets. The HTTP server wrapper consumes `uWebSockets/src/App.h`.

## Wiring plan (session boundary)

Vendoring is landed. Pipeline plumbing that ties these into the native
compile (multi-source compile + include paths + link libs +
platform-specific defines) is also landed in the same set of commits.
The `mint:http` runtime swap from cpp-httplib to uWebSockets happens in
a follow-up commit so that this commit stays mechanically inert.
