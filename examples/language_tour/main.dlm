struct Profile {
  id: int;
  name: string;
  level: int;
}

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

function identityPair(): [int, string] {
  return (7, "mint");
}

function showBranch(enabled: bool): void {
  if (enabled) {
    print("branch: enabled");
  } else {
    print("branch: disabled");
  }
}

function describeName(name: string): void {
  switch (name) {
    case "mint": {
      print("switch: mint");
    }
    default: {
      print("switch: other");
    }
  }
}

export function main(): void {
  let profile: Profile = Profile { id: 7, name: "mint", level: 3 };
  let pair: [int, string] = identityPair();
  profile.level = profile.level + 1;

  print("doublemint language tour");
  print(profile.name);
  print(profile.level);
  print(pair[0]);
  print(pair[1]);
  print(firstValue());
  print(loopTotal());
  describeName(profile.name);
  showBranch(true);
  showBranch(false);
}
