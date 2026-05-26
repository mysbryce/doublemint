import { Fetch, HttpResponse } from "mint:http";
import { String } from "mint:string";
import { println } from "mint:io";

export function main(): void {
  println("fetching http://example.com/ ...");

  let r: HttpResponse = Fetch.get("http://example.com/");
  println("status=", r.status);
  println("ok=", r.ok);
  println("content-type=", r.header("content-type"));

  let body: string = r.body;
  println("body length=", String.length(body));

  if (r.ok) {
    println("first 200 chars:");
    println(String.substring(body, 0, 200));
  } else {
    println("error=", r.error);
  }
}
