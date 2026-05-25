import { Process } from "mint:process";
import { print, println } from "mint:io";

export function main(): void {
  let handle: int64 = Process.openByName("explorer.exe");
  if (handle == 0) {
    println("explorer.exe not found, skipping memory ops.");
    return;
  }

  println("opened explorer.exe handle=", handle);

  let base: int64 = Process.findModule(handle, "explorer.exe");
  let size: int = Process.moduleSize(handle, "explorer.exe");
  println("module base=", base, " size=", size);

  let header: int = Process.readInt(handle, base);
  println("first 4 bytes (MZ): ", header);

  let hit: int64 = Process.aobScanModule(handle, "explorer.exe", "4D 5A");
  println("MZ scan hit=", hit, " expected=", base);

  Process.close(handle);
  println("closed.");
}
