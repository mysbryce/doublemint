import { Url, Http } from "mint:net";
import { println } from "mint:io";

export function main(): void {
  let target: string = "https://example.com/api/v1/items?id=7";

  println("scheme=", Url.scheme(target));
  println("host=", Url.host(target));
  println("path=", Url.path(target));
  println("encoded=", Url.encodeComponent("hello world/&"));

  let request: string = Http.buildGet("/api/v1/items", "example.com");
  println("request=\n", request);
}
