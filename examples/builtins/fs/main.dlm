import { File, Path } from "mint:fs";
import { println } from "mint:io";

export function main(): void {
  let target: string = Path.join("/tmp", "doublemint_fs_demo.txt");
  File.writeString(target, "mint");
  File.appendString(target, "y");

  let body: string = File.readToString(target);
  let bytes: int[] = File.readToBytes(target);

  println("path=", target);
  println("basename=", Path.basename(target));
  println("body=", body);
  println("first_byte=", bytes[0]);
  println("exists=", File.exists(target));
}
