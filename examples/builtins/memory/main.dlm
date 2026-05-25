import { Memory } from "mint:memory";
import { println } from "mint:io";

export function main(): void {
  Memory.reset();
  Memory.recordAlloc(1024);
  Memory.recordAlloc(2048);
  Memory.recordFree(512);

  println("bytes_used=", Memory.bytesUsed());
  println("peak_bytes=", Memory.peakBytes());

  Memory.reset();
  println("after_reset=", Memory.bytesUsed());
}
