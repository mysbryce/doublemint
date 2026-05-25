import { Terminal } from "mint:ui";
import { print, println } from "mint:io";

export function main(): void {
  Terminal.clear();
  Terminal.moveCursor(1, 1);

  print(Terminal.bold("Doublemint UI Demo"));
  println("");

  Terminal.setColor(32);
  println("green status: ok");
  Terminal.resetColor();

  println(Terminal.colorize("colorize() wraps strings", 33));
  println(Terminal.colorize("red error message", 31));
}
