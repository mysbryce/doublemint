# `mint:term`

ANSI styling, cursor moves, color helpers for terminal output.

## Imports

```mint
import { Terminal } from "mint:term";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Terminal.red` | `(text: string): string` | Wrap with red ANSI codes. |
| `Terminal.green` | `(text: string): string` | Green. |
| `Terminal.yellow` | `(text: string): string` | Yellow. |
| `Terminal.blue` | `(text: string): string` | Blue. |
| `Terminal.magenta` | `(text: string): string` | Magenta. |
| `Terminal.cyan` | `(text: string): string` | Cyan. |
| `Terminal.bold` | `(text: string): string` | Bold. |
| `Terminal.underline` | `(text: string): string` | Underlined. |
| `Terminal.dim` | `(text: string): string` | Dimmed. |
| `Terminal.reset` | `(): string` | Reset escape. |
| `Terminal.clearScreen` | `(): void` | Clear the terminal. |
| `Terminal.moveTo` | `(row: int, col: int): void` | Position the cursor (1-indexed). |
| `Terminal.hideCursor` | `(): void` | Hide the cursor. |
| `Terminal.showCursor` | `(): void` | Show the cursor. |

## Example

```mint
import { Terminal } from "mint:term";
import { println } from "mint:io";

export function main(): void {
  println(Terminal.green("OK") + " — build complete");
  println(Terminal.bold(Terminal.red("ERROR")) + " — link failed");
}
```

When stdout is not a TTY (piped, redirected) the styling still emits
the escape sequences; pipe through `sed 's/\x1b\[[0-9;]*m//g'` to strip
them if needed.
