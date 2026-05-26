# `mint:http`

uWebSockets-backed HTTP server, outbound `Fetch` client, and a
WebSocket primitive. Designed to feel like Elysia / Hono on the source
side.

## Imports

```mint
import { Http, Context, HttpResponse, HeaderMap, Fetch, WebSocket } from "mint:http";
```

## `Http` server

| Method | Signature |
| --- | --- |
| `new Http()` | Construct. |
| `get(path: string, handler: function(Context): void): void` | Route. |
| `post(path: string, handler: function(Context): void): void` | Route. |
| `put(path: string, handler: function(Context): void): void` | Route. |
| `delete(path: string, handler: function(Context): void): void` | Route. |
| `any(path: string, handler: function(Context): void): void` | Match every method. |
| `listen(port: int): void` | Block and serve forever. |

Routes can include named parameters: `/users/:id`. Inside the handler
read them off `ctx.params`.

## `Context`

| Member | Type | Purpose |
| --- | --- | --- |
| `ctx.method` | `string` | `"GET"`, `"POST"`, … |
| `ctx.url` | `string` | Path + query. |
| `ctx.path` | `string` | Path only. |
| `ctx.params` | `Map<string, string>` | Named route params. |
| `ctx.query` | `Map<string, string>` | Query string params. |
| `ctx.headers` | `HeaderMap` | Request headers (case-insensitive index). |
| `ctx.body` | `string` | Request body. |
| `ctx.send(text: string): void` | | Reply with `text/plain`. |
| `ctx.json(value): void` | | Reply with JSON-encoded value. |
| `ctx.status(code: int): Context` | | Set the response status (chainable). |
| `ctx.header(name: string, value: string): Context` | | Set a response header (chainable). |

## `HeaderMap`

```mint
let auth: string = ctx.headers["Authorization"];
let agent: string = ctx.headers["user-agent"];
```

Indexing is case-insensitive — uWS lowercases on the wire but
`HeaderMap` exposes the natural casing.

## `Fetch` (outbound)

```mint
import { Fetch, HttpResponse } from "mint:http";

let resp: HttpResponse = Fetch.get("https://example.com");
println(resp.status.toString());
println(resp.body);
```

| Symbol | Signature |
| --- | --- |
| `Fetch.get` | `(url: string): HttpResponse` |
| `Fetch.post` | `(url: string, body: string): HttpResponse` |
| `Fetch.request` | `(method: string, url: string, headers: Map<string,string>, body: string): HttpResponse` |

## WebSocket

```mint
let ws: WebSocket = new WebSocket();
ws.onOpen(fn(): void => { println("opened"); });
ws.onMessage(fn(msg: string): void => { println("got: " + msg); });
ws.onClose(fn(): void => { println("closed"); });
ws.connect("ws://localhost:3000/echo");
```

## Full server example

```mint
import { Http, Context } from "mint:http";
import { println } from "mint:io";

export function main(): void {
  let app: Http = new Http();

  app.get("/", fn(ctx: Context): void => {
    ctx.send("hello world");
  });

  app.get("/users/:id", fn(ctx: Context): void => {
    let id: string = ctx.params["id"];
    ctx.json({ id: id, role: "admin" });
  });

  app.post("/echo", fn(ctx: Context): void => {
    ctx.status(201).header("X-Custom", "hello").send(ctx.body);
  });

  println("listening on :3000");
  app.listen(3000);
}
```

The runtime vendors uWebSockets, uSockets, and libuv. The emitter links
them into the final binary automatically when the program imports
`mint:http`.
