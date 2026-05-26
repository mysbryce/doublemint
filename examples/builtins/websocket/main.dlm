import { Http, Context, WebSocket } from "mint:http";
import { println } from "mint:io";

export function main(): void {
  let app: Http = new Http();

  app.get("/", fn(ctx: Context): void =>
    ctx.html("<h1>WebSocket demo</h1><p>Connect to <code>ws://localhost:3002/ws</code></p>")
  );

  app.ws("/ws",
    fn(ws: WebSocket): void => {
      println("client connected from ${ws.remoteAddress()}");
      ws.send("welcome");
    },
    fn(ws: WebSocket, msg: string): void => {
      println("received: " + msg);
      ws.send("echo: " + msg);
    },
    fn(ws: WebSocket): void => println("client disconnected")
  );

  println("listening on http://127.0.0.1:3002 (ws://127.0.0.1:3002/ws)");
  app.listen("127.0.0.1", 3002);
}
