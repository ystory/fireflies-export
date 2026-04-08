import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { vi } from "vitest";

export async function createTempDataDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fireflies-export-"));
  vi.stubEnv("FIREFLIES_DATA_DIR", dir);
  return dir;
}

export async function cleanupDir(dir?: string): Promise<void> {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}
