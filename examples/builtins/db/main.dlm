import { KV } from "mint:db";
import { println } from "mint:io";

export function main(): void {
  KV.clear();
  KV.set("name", "doublemint");
  KV.set("version", "0.1");
  KV.set("draft", "yes");
  KV.remove("draft");

  println("name=", KV.get("name", "(missing)"));
  println("has_version=", KV.has("version"));
  println("has_draft=", KV.has("draft"));
  println("missing=", KV.get("missing", "(default)"));
  println("size=", KV.size());
}
