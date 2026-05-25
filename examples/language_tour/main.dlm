function firstValue(): int {
  let values: int[] = [1, 2, 3];
  values[0] = values[1];
  return values[0];
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
  showBranch(true);
  showBranch(false);
}

