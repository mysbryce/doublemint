import { Schema, ValidationResult } from "mint:schema";
import { println } from "mint:io";

export function main(): void {
  let address: Schema = new Schema();
  address.required("city", "string");
  address.required("zip", "string");
  address.pattern("zip", "[0-9]{5}");

  let user: Schema = new Schema();
  user.required("name", "string");
  user.min("name", 2);
  user.max("name", 32);

  user.required("age", "int");
  user.min("age", 0);
  user.max("age", 150);

  user.required("role", "string");
  user.oneOf("role", ["admin", "user", "guest"]);

  user.optional("nickname", "string");

  user.requiredArray("tags", "string");
  user.minItems("tags", 1);
  user.maxItems("tags", 4);

  user.required("email", "string");
  user.pattern("email", "[^@]+@[^@]+\\.[^@]+");

  user.requiredObject("address", address);

  let good: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"admin\",\"tags\":[\"vip\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("good -> ok=", good.ok, " name=", good.getString("name"));

  let nameShort: ValidationResult = user.validate("{\"name\":\"a\",\"age\":30,\"role\":\"admin\",\"tags\":[\"x\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("nameShort -> ", nameShort.error);

  let ageHigh: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":500,\"role\":\"admin\",\"tags\":[\"x\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("ageHigh -> ", ageHigh.error);

  let badRole: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"superadmin\",\"tags\":[\"x\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("badRole -> ", badRole.error);

  let tooManyTags: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"admin\",\"tags\":[\"a\",\"b\",\"c\",\"d\",\"e\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("tooManyTags -> ", tooManyTags.error);

  let emptyTags: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"admin\",\"tags\":[],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("emptyTags -> ", emptyTags.error);

  let badEmail: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"admin\",\"tags\":[\"x\"],\"email\":\"not-an-email\",\"address\":{\"city\":\"BKK\",\"zip\":\"10110\"}}");
  println("badEmail -> ", badEmail.error);

  let badZip: ValidationResult = user.validate("{\"name\":\"alice\",\"age\":30,\"role\":\"admin\",\"tags\":[\"x\"],\"email\":\"a@b.co\",\"address\":{\"city\":\"BKK\",\"zip\":\"ABCDE\"}}");
  println("badZip -> ", badZip.error);
}
