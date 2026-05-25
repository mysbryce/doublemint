import { IO, print, println } from "mint:io";

export function main(): void {
  print("hello from mint:io ");
  println("println adds newline");
  let name: string = IO.readLine("name? ");
  println("hi, ", name);
}
