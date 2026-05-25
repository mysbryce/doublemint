import { Async } from "mint:async";
import { println } from "mint:io";

export function main(): void {
  let workload: int[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  println("threads=", Async.hardwareThreads());
  println("sum=", Async.parallelSum(workload));
  println("max=", Async.parallelMax(workload));
  println("min=", Async.parallelMin(workload));

  let counter: int = Async.createAtomic(0);
  Async.parallelFor(100, fn(i: int): void => Async.atomicAdd(counter, 1));
  println("parallelFor counter=", Async.atomicLoad(counter));
  Async.destroyAtomic(counter);

  let mutexId: int = Async.createMutex();
  Async.lock(mutexId);
  Async.unlock(mutexId);
  Async.destroyMutex(mutexId);

  let channelId: int = Async.createChannel();
  let workerId: int = Async.spawn(fn(): void => Async.channelSend(channelId, "from worker"));
  let msg: string = Async.channelReceive(channelId);
  Async.join(workerId);
  println("msg=", msg);
  Async.channelClose(channelId);
  Async.destroyChannel(channelId);

  Async.sleepMs(10);
  println("napped 10ms");
}
