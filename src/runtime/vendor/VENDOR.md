# Vendored runtime libraries

These trees are copied verbatim from upstream and live in-tree so that
Mint's native build pipeline can compile against them without an
external dependency.

| Library | Version | Source | License |
| --- | --- | --- | --- |
| libuv | 1.48.0 | https://github.com/libuv/libuv | MIT-like (see libuv/LICENSE) |
| uSockets | 0.8.8 | https://github.com/uNetworking/uSockets | Apache 2.0 |
| uWebSockets | 20.74.0 | https://github.com/uNetworking/uWebSockets | Apache 2.0 |

## Layout

- `libuv/` — full source + headers + LICENSE. uSockets uses this as
  its event-loop backend on every platform (libuv handles IOCP on
  Windows and epoll/kqueue elsewhere), so we share the same
  foundation Bun does.
- `uSockets/` — uSockets sources + LICENSE. `bsd.c`, `context.c`,
  `loop.c`, `socket.c`, `udp.c`, and `eventing/libuv.c` are compiled
  alongside the generated translation unit.
- `uWebSockets/` — header-only modern C++ HTTP/WebSocket server built
  on top of uSockets. The HTTP wrapper consumes `uWebSockets/src/App.h`.

## Compile defines

For the build to behave, `mint:http` adds these `-D` flags on every
platform:

- `LIBUS_USE_LIBUV=1` — switch uSockets to its libuv event-loop
  backend.
- `LIBUS_NO_SSL=1` — uSockets has SSL hooks scattered across
  `socket.c` / `context.c`. We aren't vendoring OpenSSL, so the
  flag stubs those branches out.
- `UWS_NO_ZLIB=1` — uWebSockets pulls in zlib for
  permessage-deflate. We aren't vendoring zlib either, so this
  flag swaps the deflate paths for no-ops.

Per-platform extras:

- **Windows**: `WIN32_LEAN_AND_MEAN`, `_WIN32_WINNT=0x0602`, `NDEBUG`,
  and the link libraries `ws2_32 iphlpapi psapi userenv advapi32
  dbghelp ole32 uuid shell32`.
- **Linux**: `_FILE_OFFSET_BITS=64`, `_LARGEFILE_SOURCE`, `_GNU_SOURCE`,
  link `pthread dl rt`.
- **macOS**: `_DARWIN_UNLIMITED_SELECT=1`, link `pthread`.
