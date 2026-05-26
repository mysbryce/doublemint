import { String } from "mint:string";
import { println } from "mint:io";

export function main(): void {
  let raw: string = "  Hello, World!  ";
  println("upper=", String.upper(raw));
  println("lower=", String.lower(raw));
  let trimmed: string = String.trim(raw);
  println("trim=[" + trimmed + "]");

  let csv: string = "alpha,beta,gamma,delta";
  let parts: string[] = String.split(csv, ",");
  println("first=", parts[0]);
  println("joined=", String.join(parts, " | "));

  println("replace=", String.replace("the quick brown fox", "quick", "slow"));
  println("contains=", String.contains("doublemint", "mint"));
  println("starts=", String.startsWith("doublemint", "double"));
  println("ends=", String.endsWith("doublemint", "mint"));
  println("indexOf=", String.indexOf("doublemint", "mint"));
  println("lastIndexOf=", String.lastIndexOf("ababab", "ab"));
  println("substring=", String.substring("doublemint", 6, 10));
  println("length=", String.length("doublemint"));
  println("repeat=", String.repeat("ab", 4));
  let padded: string = String.padLeft("42", 6, "0");
  println("padLeft=[" + padded + "]");
  let rightPad: string = String.padRight("42", 6, ".");
  println("padRight=[" + rightPad + "]");
  println("reverse=", String.reverse("doublemint"));
  println("fromInt=", String.fromInt(12345));
  println("toInt=", String.toInt("9876"));
}
