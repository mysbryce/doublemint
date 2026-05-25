import { Http } from "mint:http";
import { println } from "mint:io";

export function main(): void {
  let app: int = Http.create();

  Http.get(app, "/", fn(ctx: int64): void => Http.text(ctx, "Hello from Doublemint"));

  Http.get(app, "/user/:id", fn(ctx: int64): void =>
    Http.json(ctx, Http.param(ctx, "id"))
  );

  Http.post(app, "/echo", fn(ctx: int64): void =>
    Http.send(ctx, 200, "text/plain; charset=utf-8", Http.body(ctx))
  );

  Http.get(app, "/headers/agent", fn(ctx: int64): void =>
    Http.text(ctx, Http.header(ctx, "User-Agent"))
  );

  Http.get(app, "/search", fn(ctx: int64): void =>
    Http.text(ctx, Http.query(ctx, "q"))
  );

  println("listening on http://127.0.0.1:3001");
  Http.listen(app, "127.0.0.1", 3001);
}
