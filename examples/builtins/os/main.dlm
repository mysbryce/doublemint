import { OS, Env } from "mint:os";
import { println } from "mint:io";

export function main(): void {
  println("is_linux=", OS.isLinux());
  println("is_windows=", OS.isWindows());
  println("home=", Env.get("HOME", "(unset)"));
  println("user=", Env.get("USERNAME", Env.get("USER", "anon")));
}
