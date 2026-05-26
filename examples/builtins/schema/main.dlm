import { Schema, ValidationResult } from "mint:schema";
import { println } from "mint:io";

export function main(): void {
  let address: Schema = new Schema();
  address.required("city", "string");
  address.required("zip", "string");

  let user: Schema = new Schema();
  user.required("name", "string");
  user.required("age", "int");
  user.optional("nickname", "string");
  user.requiredArray("tags", "string");
  user.requiredObject("address", address);

  let good: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"tags\":[\"admin\",\"vip\"],\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  if (good.ok) {
    println("OK name=", good.getString("name"), " age=", good.getInt("age"));
  } else {
    println("unexpected fail: ", good.error);
  }

  let missingField: ValidationResult = user.validate("{\"name\":\"bob\",\"tags\":[\"x\"],\"address\":{\"city\":\"X\",\"zip\":\"1\"}}");
  println("missing age -> ok=", missingField.ok, " error=", missingField.error);

  let wrongType: ValidationResult = user.validate("{\"name\":42,\"age\":30,\"tags\":[\"x\"],\"address\":{\"city\":\"X\",\"zip\":\"1\"}}");
  println("name as int -> ok=", wrongType.ok, " error=", wrongType.error);

  let badArray: ValidationResult = user.validate("{\"name\":\"c\",\"age\":30,\"tags\":[1,2],\"address\":{\"city\":\"X\",\"zip\":\"1\"}}");
  println("bad tag types -> ok=", badArray.ok, " error=", badArray.error);

  let nestedBad: ValidationResult = user.validate("{\"name\":\"c\",\"age\":30,\"tags\":[],\"address\":{\"city\":\"X\"}}");
  println("nested missing -> ok=", nestedBad.ok, " error=", nestedBad.error);
}
