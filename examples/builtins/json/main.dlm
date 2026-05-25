import { Json } from "mint:json";
import { println } from "mint:io";

export function main(): void {
  let encoded_name: string = Json.stringify("minty");
  let encoded_count: string = Json.stringifyInt(42);
  let encoded_active: string = Json.stringifyBool(true);

  let parsed_int: int = Json.parseInt("99");
  let parsed_str: string = Json.parseString("hello");

  println("name_json=", encoded_name);
  println("count_json=", encoded_count);
  println("active_json=", encoded_active);
  println("parsed_int=", parsed_int);
  println("parsed_str=", parsed_str);
}
