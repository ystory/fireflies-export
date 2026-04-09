import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function canonicalizePath(filePath: string): string {
  const resolvedPath = resolve(filePath);

  try {
    return realpathSync(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

export function isDirectRun(
  importMetaUrl: string,
  argv1: string | undefined = process.argv[1],
): boolean {
  if (!argv1) {
    return false;
  }

  return (
    canonicalizePath(fileURLToPath(importMetaUrl)) === canonicalizePath(argv1)
  );
}
