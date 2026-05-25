import { Time, Profiler } from "mint:time";
import { println } from "mint:io";

export function main(): void {
  let now: int = Time.nowInMs();
  Profiler.start("loop");

  let total: int = 0;
  for (let i: int = 0; i < 1000; i = i + 1) {
    total = total + i;
  }

  let elapsed: int = Profiler.stop("loop");
  println("now_ms=", now);
  println("loop_total=", total);
  println("elapsed_us=", elapsed);
}
