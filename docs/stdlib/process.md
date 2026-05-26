# `mint:process`

Shell out, plus low-level process memory inspection — open a target
process by name or pid, read / write memory, scan AOB patterns, follow
pointer chains, and read window text.

## Imports

```mint
import { Process } from "mint:process";
```

## Shell commands

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.run` | `(cmd: string): int` | Run a command, return the exit code. |
| `Process.runOutput` | `(cmd: string): string` | Run and capture stdout. |
| `Process.runExitCode` | `(cmd: string): int` | Alias for `Process.run`. |

## Streaming pipes

Open a pipe to a child process and read its stdout line by line (or
write to its stdin). Backed by `popen` / `_popen` — works on POSIX
and Windows.

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.streamOpen` | `(command: string, mode: string): int` | `"r"` reads stdout, `"w"` writes stdin. Returns a handle or `-1`. |
| `Process.streamReadLine` | `(handle: int): string` | Read until newline; empty string at EOF. |
| `Process.streamEof` | `(handle: int): bool` | True once the child closes its pipe. |
| `Process.streamWriteLine` | `(handle: int, text: string): bool` | Auto-appends `\n` + flushes. |
| `Process.streamClose` | `(handle: int): int` | Returns the child's exit status (via `pclose` / `_pclose`). |

```mint
import { Process } from "mint:process";
import { String } from "mint:string";
import { println } from "mint:io";

export function main(): void {
  let h: int = Process.streamOpen("ls -1", "r");
  while (!Process.streamEof(h)) {
    let line: string = Process.streamReadLine(h);
    if (String.length(line) > 0) {
      println(line);
    }
  }
  Process.streamClose(h);
}
```

## Open a target process

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.openByName` | `(name: string): int` | Open a process by image name. Returns a handle (`-1` on failure). |
| `Process.openByPid` | `(pid: int): int` | Open by process id. |
| `Process.close` | `(handle: int): void` | Release a handle. |

## Read / write memory

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.readBytes` | `(handle: int, address: int64, length: int): int[]` | Read `length` bytes. |
| `Process.readInt` | `(handle: int, address: int64): int` | Read a 4-byte int. |
| `Process.readInt64` | `(handle: int, address: int64): int64` | Read an 8-byte int. |
| `Process.readFloat` | `(handle: int, address: int64): float` | Read a 4-byte float. |
| `Process.readDouble` | `(handle: int, address: int64): double` | Read an 8-byte double. |
| `Process.readString` | `(handle: int, address: int64, length: int): string` | Read a null-terminated or fixed-length string. |
| `Process.writeBytes` | `(handle: int, address: int64, data: int[]): bool` | Write bytes. |
| `Process.writeInt` | `(handle: int, address: int64, value: int): bool` | Write a 4-byte int. |
| `Process.writeFloat` | `(handle: int, address: int64, value: float): bool` | Write a 4-byte float. |

## AOB scan + pointer chains

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.aobScan` | `(handle: int, pattern: string): int64` | Scan every module for the AOB pattern; returns the first hit. `??` is a wildcard byte. |
| `Process.aobScanModule` | `(handle: int, moduleName: string, pattern: string): int64` | Restrict the scan to one module. |
| `Process.pointerChain` | `(handle: int, base: int64, offsets: int[]): int64` | Walk `*((base + offsets[0])) + offsets[1] + …`. |
| `Process.moduleBase` | `(handle: int, moduleName: string): int64` | Base address of a loaded module. |

## Window text (Windows-only)

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Process.findWindow` | `(title: string): int64` | Window handle from title. |
| `Process.windowText` | `(hwnd: int64): string` | Read the window title text. |

## Example: notepad reader

```mint
import { Process } from "mint:process";
import { println } from "mint:io";

export function main(): void {
  let handle: int = Process.openByName("notepad.exe");
  if (handle == -1) {
    println("notepad not running");
    return;
  }

  let address: int64 = Process.aobScanModule(handle, "notepad.exe", "48 8B 05 ?? ?? ?? ?? 48 8B 88");
  if (address == 0) {
    println("pattern not found");
    Process.close(handle);
    return;
  }

  let cursor: int = Process.readInt(handle, address);
  println("cursor index: " + cursor.toString());

  Process.close(handle);
}
```

Most of the surface relies on platform APIs (`OpenProcess`,
`ReadProcessMemory`, `EnumProcessModules` on Windows; `/proc` on
Linux). Doublemint vendors the platform code inside the
`mint:process` runtime bundle.
