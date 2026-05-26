# `mint:os`

OS / environment helpers.

## Imports

```mint
import { OS, Env } from "mint:os";
```

## `OS` namespace

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `OS.platform` | `(): string` | `"win32"`, `"linux"`, `"darwin"`. |
| `OS.arch` | `(): string` | `"x64"`, `"arm64"`, etc. |
| `OS.cwd` | `(): string` | Current working directory. |
| `OS.chdir` | `(dir: string): void` | Change working directory. |
| `OS.homeDir` | `(): string` | Current user's home directory. |
| `OS.tempDir` | `(): string` | Temp directory path. |
| `OS.hostname` | `(): string` | Machine hostname. |
| `OS.exit` | `(code: int): void` | Terminate the process. |

## `Env` namespace

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Env.get` | `(name: string): string` | Read an environment variable; empty if missing. |
| `Env.set` | `(name: string, value: string): void` | Set / overwrite. |
| `Env.unset` | `(name: string): void` | Remove. |
| `Env.has` | `(name: string): bool` | Membership test. |
| `Env.keys` | `(): string[]` | Snapshot of every variable name. |

## Example

```mint
import { OS, Env } from "mint:os";
import { println } from "mint:io";

export function main(): void {
  println("running on " + OS.platform() + " (" + OS.arch() + ")");
  println("cwd: " + OS.cwd());

  if (!Env.has("HOME")) {
    Env.set("HOME", OS.homeDir());
  }
  println("home: " + Env.get("HOME"));
}
```
