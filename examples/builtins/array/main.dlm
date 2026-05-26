import { Array } from "mint:array";
import { println } from "mint:io";

export function main(): void {
  let xs: int[] = [1, 2, 3, 4, 5];

  let doubled: int[] = xs.map(fn(x: int): int => x * 2);
  println("doubled[0]=", doubled[0], " doubled[4]=", doubled[4]);

  let evens: int[] = xs.filter(fn(x: int): bool => x == 2 || x == 4);
  println("evens.length=", evens.length());

  let sum: int = xs.reduce(0, fn(acc: int, x: int): int => acc + x);
  println("sum=", sum);

  let firstBig: int = xs.findIndex(fn(x: int): bool => x > 3);
  println("firstBig=", firstBig);

  println("any>10=", xs.any(fn(x: int): bool => x > 10));
  println("all>0=", xs.all(fn(x: int): bool => x > 0));

  println("reversed[0]=", xs.reverse()[0]);

  let nums: int[] = [3, 1, 4, 1, 5, 9, 2, 6];
  let sorted: int[] = nums.sort();
  println("sorted[0]=", sorted[0], " sorted[7]=", sorted[7]);

  println("contains3=", xs.contains(3));
  println("indexOf4=", xs.indexOf(4));

  let combined: int[] = xs.concat([10, 20]);
  println("combined.length=", combined.length(), " combined[6]=", combined[6]);
}
