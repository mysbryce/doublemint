import type { PlayerProfile } from "./types";
import { calculateDistance } from "./math_utils";

function processPlayer(profile: PlayerProfile): int {
  let saved_profile: PlayerProfile = copy profile;
  saved_profile.level = saved_profile.level + 1;
  return saved_profile.level;
}

export function main(): void {
  calculateDistance(0.0, 0.0, 3.0, 4.0);
}

