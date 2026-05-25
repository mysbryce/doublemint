import { Queue, Set, Stack } from "mint:collections";
import { println } from "mint:io";

export function main(): void {
  let queue: Queue<string> = new Queue<string>();
  queue.push("alpha");
  queue.push("beta");

  let stack: Stack<int> = new Stack<int>();
  stack.push(10);
  stack.push(20);

  let ids: Set<int> = new Set<int>();
  ids.add(7);
  ids.add(7);
  ids.add(9);

  println("queue_size=", queue.size());
  println("queue_pop=", queue.pop());
  println("stack_pop=", stack.pop());
  println("set_has_7=", ids.has(7));
  println("set_size=", ids.size());
}
