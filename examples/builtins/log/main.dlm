import { Log } from "mint:log";

export function main(): void {
  Log.info("server starting on port 9090");
  Log.debug("config loaded from /etc/mint.toml");
  Log.warn("cache size approaching limit");
  Log.error("failed to bind upstream socket");
}
