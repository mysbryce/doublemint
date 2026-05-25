import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DoublemintConfig {
  rootDir: string;
  outDir: string;
  cppStandard: "c++20" | "c++23";
  compiler: "clang++" | "g++" | string;
  includeDirs: string[];
  nativeSources?: string[];
  libraryDirs?: string[];
  linkLibraries?: string[];
  linkerFlags?: string[];
  warningsAsErrors: boolean;
  optimization: "O0" | "O1" | "O2" | "O3" | "Os";
}

const defaultConfig: DoublemintConfig = {
  rootDir: "src",
  outDir: "build/doublemint",
  cppStandard: "c++20",
  compiler: "clang++",
  includeDirs: [],
  nativeSources: [],
  libraryDirs: [],
  linkLibraries: [],
  linkerFlags: [],
  warningsAsErrors: true,
  optimization: "O3"
};

export async function loadConfig(cwd: string): Promise<DoublemintConfig> {
  const configPath = join(cwd, "doublemint.config.json");

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DoublemintConfig>;
    return {
      ...defaultConfig,
      ...parsed,
      includeDirs: parsed.includeDirs ?? defaultConfig.includeDirs,
      nativeSources: parsed.nativeSources ?? defaultConfig.nativeSources,
      libraryDirs: parsed.libraryDirs ?? defaultConfig.libraryDirs,
      linkLibraries: parsed.linkLibraries ?? defaultConfig.linkLibraries,
      linkerFlags: parsed.linkerFlags ?? defaultConfig.linkerFlags
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultConfig;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
