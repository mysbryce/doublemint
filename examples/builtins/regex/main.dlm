import { Regex } from "mint:regex";
import { println } from "mint:io";

export function main(): void {
  let hexColor: Regex = new Regex("^#?[a-fA-F0-9]{6}$");
  println("ff5733=", hexColor.test("#FF5733"));
  println("xyz=", hexColor.test("xyz"));

  let normalize: Regex = new Regex("\\s+");
  println("squeeze=[", normalize.replace("mint    is    fast", " "), "]");
}
