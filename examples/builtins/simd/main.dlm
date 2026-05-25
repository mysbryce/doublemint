import { Simd } from "mint:simd";
import { println } from "mint:io";

export function main(): void {
  let left: int[] = [1, 2, 3, 4];
  let right: int[] = [10, 20, 30, 40];

  let sum_vec: int[] = Simd.addArrays(left, right);
  let scaled: int[] = Simd.scaleArray(left, 5);

  println("sum0=", sum_vec[0]);
  println("sum3=", sum_vec[3]);
  println("scaled3=", scaled[3]);
  println("dot=", Simd.dotProduct(left, right));
  println("total_left=", Simd.sum(left));
}
