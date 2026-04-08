import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { getConfig } from "./config.js";
import {
  type Manifest,
  manifestSchema,
  parseWithSchema,
  type RequestCounter,
  requestCounterSchema,
  transcriptSchema,
} from "./schemas.js";

export type { Manifest, ManifestEntry } from "./schemas.js";

// --- Directory Setup ---

export async function ensureDataDirs(): Promise<void> {
  const { dataDir, transcriptsDir } = getConfig();
  await mkdir(dataDir, { recursive: true });
  await mkdir(transcriptsDir, { recursive: true });
}

// --- Manifest ---

export async function loadManifest(): Promise<Manifest> {
  const { manifestPath } = getConfig();

  if (!existsSync(manifestPath)) {
    return { last_full_sync: null, entries: [] };
  }
  const raw = await readFile(manifestPath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`${manifestPath} is not valid JSON: ${errMsg}`);
  }

  return parseWithSchema(manifestSchema, parsed, manifestPath);
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  const { manifestPath } = getConfig();
  await ensureDataDirs();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

// --- Transcript Files ---

export async function saveTranscript(id: string, data: unknown): Promise<void> {
  const { transcriptsDir } = getConfig();
  await ensureDataDirs();
  const filePath = `${transcriptsDir}/${id}.json`;
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function isTranscriptCollected(id: string): boolean {
  const { transcriptsDir } = getConfig();
  return existsSync(`${transcriptsDir}/${id}.json`);
}

export async function hasValidTranscriptFile(id: string): Promise<boolean> {
  const { transcriptsDir } = getConfig();
  const filePath = `${transcriptsDir}/${id}.json`;

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    parseWithSchema(transcriptSchema, parsed, filePath);
    return true;
  } catch {
    return false;
  }
}

// --- Daily Request Counter ---

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadCounter(): Promise<RequestCounter> {
  const { counterPath } = getConfig();

  if (!existsSync(counterPath)) {
    return { date: todayString(), count: 0 };
  }
  const raw = await readFile(counterPath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`${counterPath} is not valid JSON: ${errMsg}`);
  }

  const counter = parseWithSchema(requestCounterSchema, parsed, counterPath);

  // Reset counter if it's a new day
  if (counter.date !== todayString()) {
    return { date: todayString(), count: 0 };
  }
  return counter;
}

async function saveCounter(counter: RequestCounter): Promise<void> {
  const { counterPath } = getConfig();
  await ensureDataDirs();
  await writeFile(counterPath, JSON.stringify(counter, null, 2), "utf-8");
}

export async function incrementRequestCount(): Promise<number> {
  const counter = await loadCounter();
  counter.count += 1;
  await saveCounter(counter);
  return counter.count;
}

export async function getRemainingRequests(): Promise<number> {
  const { dailyRequestLimit } = getConfig();
  const counter = await loadCounter();
  return Math.max(0, dailyRequestLimit - counter.count);
}

export async function canMakeRequest(): Promise<boolean> {
  return (await getRemainingRequests()) > 0;
}
