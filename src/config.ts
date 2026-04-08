import { join } from "node:path";
import { config as loadDotenvConfig } from "dotenv";

const DEFAULT_API_URL = "https://api.fireflies.ai/graphql";
const DEFAULT_DAILY_REQUEST_LIMIT = 50;
const DEFAULT_PAGE_SIZE = 20;

export const MISSING_API_KEY_MESSAGE =
  "FIREFLIES_API_KEY is not set.\n" +
  "Copy .env.example to .env and fill in your API key.\n" +
  "  cp .env.example .env";

export interface AppConfig {
  apiUrl: string;
  apiKey: string;
  dailyRequestLimit: number;
  pageSize: number;
  dataDir: string;
  transcriptsDir: string;
  manifestPath: string;
  counterPath: string;
}

export function loadDotenv(cwd: string = process.cwd()): void {
  loadDotenvConfig({ path: join(cwd, ".env") });
}

export function getConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AppConfig {
  const dataDir = env.FIREFLIES_DATA_DIR ?? join(cwd, "data");

  return {
    apiUrl: DEFAULT_API_URL,
    apiKey: env.FIREFLIES_API_KEY ?? "",
    dailyRequestLimit: DEFAULT_DAILY_REQUEST_LIMIT,
    pageSize: DEFAULT_PAGE_SIZE,
    dataDir,
    transcriptsDir: join(dataDir, "transcripts"),
    manifestPath: join(dataDir, "manifest.json"),
    counterPath: join(dataDir, ".request-counter.json"),
  };
}

export function validateConfig(
  appConfig: Pick<AppConfig, "apiKey"> = getConfig(),
): void {
  if (!appConfig.apiKey) {
    throw new Error(MISSING_API_KEY_MESSAGE);
  }
}
