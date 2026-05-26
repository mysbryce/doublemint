# `mint:fs`

Filesystem helpers and path manipulation.

## Imports

```mint
import { File, Path } from "mint:fs";
```

## `File` namespace

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `File.readText` | `(path: string): string` | Read a whole UTF-8 file. |
| `File.writeText` | `(path: string, text: string): void` | Overwrite a file with `text`. |
| `File.appendText` | `(path: string, text: string): void` | Append to a file. |
| `File.exists` | `(path: string): bool` | True if the path exists. |
| `File.remove` | `(path: string): void` | Delete a file. |
| `File.size` | `(path: string): int64` | Byte size of a file. |
| `File.readBytes` | `(path: string): int[]` | Read file as a byte array. |
| `File.writeBytes` | `(path: string, data: int[]): void` | Write bytes to a file. |

## `Path` namespace

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Path.join` | `(a: string, b: string): string` | Join two path components. |
| `Path.dirname` | `(path: string): string` | Directory portion. |
| `Path.basename` | `(path: string): string` | File portion. |
| `Path.extension` | `(path: string): string` | Extension including the leading dot. |
| `Path.normalize` | `(path: string): string` | Collapse `..` and `.` segments. |
| `Path.isAbsolute` | `(path: string): bool` | True if the path is absolute. |
| `Path.mkdir` | `(path: string): void` | Create a directory (recursive). |
| `Path.rmdir` | `(path: string): void` | Remove a directory (recursive). |

## Example

```mint
import { File, Path } from "mint:fs";
import { println } from "mint:io";

export function main(): void {
  let configPath: string = Path.join("config", "settings.json");
  if (File.exists(configPath)) {
    let text: string = File.readText(configPath);
    println("config: " + text);
  } else {
    File.writeText(configPath, "{}");
    println("initialised " + configPath);
  }
}
```
