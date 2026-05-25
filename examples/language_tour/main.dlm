function firstValue(): int {
  let values: int[] = [1, 2, 3];
  values[0] = values[1];
  return values[0];
}

function loopTotal(): int {
  let total: int = 0;

  while (total < 2) {
    total = total + 1;
  }

  for (let i: int = 0; i < 3; i = i + 1) {
    total = total + i;
  }

  return total;
}

function showBranch(enabled: bool): void {
  if (enabled) {
    print("branch: enabled");
  } else {
    print("branch: disabled");
  }
}

export function main(): void {
  print("doublemint language tour");
  print(firstValue());
  print(loopTotal());
  showBranch(true);
  showBranch(false);
}
