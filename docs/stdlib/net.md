# `mint:net`

Lower-level networking — URL parsing and a minimal HTTP client. For a
full HTTP server use [`mint:http`](./http) instead.

## Imports

```mint
import { Url, Http } from "mint:net";
```

## `Url` namespace

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Url.parse` | `(url: string): UrlParts` | Decompose into scheme / host / port / path / query. |
| `Url.encode` | `(text: string): string` | Percent-encode. |
| `Url.decode` | `(text: string): string` | Percent-decode. |
| `Url.queryString` | `(params: Map<string,string>): string` | Build a query string from a map. |

`UrlParts` is a struct:

```mint
struct UrlParts {
  scheme: string;
  host: string;
  port: int;
  path: string;
  query: string;
  fragment: string;
}
```

## `Http` (request-style)

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `Http.get` | `(url: string): string` | GET a URL, return the body. |
| `Http.post` | `(url: string, body: string): string` | POST and return the body. |
| `Http.requestStatus` | `(url: string): int` | HEAD-style request returning just the status. |

For richer client behaviour (custom methods, headers, streaming) use
the `Fetch` namespace in [`mint:http`](./http).

## Example

```mint
import { Url, Http } from "mint:net";
import { println } from "mint:io";

export function main(): void {
  let parts: UrlParts = Url.parse("https://example.com:8443/api?key=abc");
  println(parts.host);  // example.com
  println(parts.port.toString()); // 8443

  let body: string = Http.get("https://example.com");
  println("downloaded " + body.length().toString() + " bytes");
}
```
