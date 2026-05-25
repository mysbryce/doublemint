import { Math } from "mint:math";
import { println } from "mint:io";

export function main(): void {
  let hypotenuse: int = Math.roundToInt(Math.sqrt(Math.pow(3.0, 2.0) + Math.pow(4.0, 2.0)));
  let sineQuarter: double = Math.sin(Math.PI / 2.0);

  println("pi=", Math.PI);
  println("3-4-5 hypotenuse=", hypotenuse);
  println("sin(pi/2)=", sineQuarter);
}
