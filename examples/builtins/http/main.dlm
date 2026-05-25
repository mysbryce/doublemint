import { Http, Context } from "mint:http";
import { println } from "mint:io";

export function main(): void {
  let app: Http = new Http();

  app.get("/", fn(ctx: Context): void => ctx.text("Hello from Doublemint"));

  app.get("/user/:id", fn(ctx: Context): void => ctx.json(ctx.param("id")));

  app.post("/echo", fn(ctx: Context): void => ctx.text(ctx.body()));

  app.get("/headers/agent", fn(ctx: Context): void => ctx.text(ctx.header("User-Agent")));

  app.get("/search", fn(ctx: Context): void => ctx.text(ctx.query("q")));

  println("listening on http://127.0.0.1:3001");
  app.listen("127.0.0.1", 3001);
}
