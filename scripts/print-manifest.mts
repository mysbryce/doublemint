import { buildBuiltinManifest } from "../src/builtins/mintModules.js";

process.stdout.write(JSON.stringify(buildBuiltinManifest(), null, 2));
