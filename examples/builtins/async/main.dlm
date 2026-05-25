import { Async } from "mint:async";
import { println } from "mint:io";

export function main(): void {
  let workload: int[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  println("threads=", Async.hardwareThreads());
  println("sum=", Async.parallelSum(workload));

  Async.sleepMs(10);
  println("napped 10ms");
}
