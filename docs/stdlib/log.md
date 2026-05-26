# `mint:log`

Severity-tagged logger.

## Imports

```mint
import { Log } from "mint:log";
```

## Functions

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Log.debug` | `(message: string): void` | DEBUG-level log line. |
| `Log.info` | `(message: string): void` | INFO. |
| `Log.warn` | `(message: string): void` | WARN. |
| `Log.error` | `(message: string): void` | ERROR. |
| `Log.setLevel` | `(level: string): void` | `"debug"`, `"info"`, `"warn"`, `"error"`. |

Output format:

```text
[2026-05-27 12:34:56] INFO  hello world
```

## Example

```mint
import { Log } from "mint:log";

export function main(): void {
  Log.setLevel("debug");

  Log.debug("starting up");
  Log.info("listening on :3000");
  Log.warn("slow response");
  Log.error("database unreachable");
}
```

For structured logging (JSON output, fields, contexts), wrap your own
helpers around `Log.info` plus `mint:json`.
