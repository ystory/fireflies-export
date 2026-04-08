import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  createGraphQLClient,
  FirefliesApiError,
  isRateLimitError,
} from "./client.js";
import { getDataRoot, validateConfig } from "./config.js";
import { GET_CURRENT_USER } from "./queries.js";
import { currentUserResponseSchema, parseWithSchema } from "./schemas.js";

const ACCOUNTS_DIR_NAME = "accounts";
const ACCOUNT_INDEX_FILE_NAME = ".account-index.json";
const ACCOUNT_METADATA_FILE_NAME = ".account.json";

const accountIndexEntrySchema = z.object({
  account_id: z.string(),
  verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const accountIndexSchema = z.object({
  tokens: z.record(z.string(), accountIndexEntrySchema).default({}),
});

interface AccountMetadata {
  account_id: string;
  status: "verified";
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  last_verified_at: string | null;
}
type AccountIndex = z.infer<typeof accountIndexSchema>;
type AccountIndexEntry = z.infer<typeof accountIndexEntrySchema>;

export interface PrepareAccountDataDirResult {
  accountId: string;
  dataDir: string;
  dataRoot: string;
  status: "verified" | "explicit";
  source: "explicit" | "cached_verified" | "owner_lookup";
}

export interface PrepareAccountDataDirOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  client?: Pick<ReturnType<typeof createGraphQLClient>, "query">;
}

export class AccountIdentityError extends Error {
  retryAfter: number | null;

  constructor(message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "AccountIdentityError";
    this.retryAfter = retryAfter;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function accountIndexPath(dataRoot: string): string {
  return join(dataRoot, ACCOUNT_INDEX_FILE_NAME);
}

function accountDir(dataRoot: string, accountId: string): string {
  return join(dataRoot, ACCOUNTS_DIR_NAME, accountId);
}

function accountMetadataPath(dataRoot: string, accountId: string): string {
  return join(accountDir(dataRoot, accountId), ACCOUNT_METADATA_FILE_NAME);
}

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

async function loadJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf-8");

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`${filePath} is not valid JSON: ${errMsg}`);
  }
}

async function loadAccountIndex(dataRoot: string): Promise<AccountIndex> {
  const filePath = accountIndexPath(dataRoot);

  if (!existsSync(filePath)) {
    return { tokens: {} };
  }

  return parseWithSchema(
    accountIndexSchema,
    await loadJsonFile(filePath),
    filePath,
  );
}

async function saveAccountIndex(
  dataRoot: string,
  accountIndex: AccountIndex,
): Promise<void> {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    accountIndexPath(dataRoot),
    JSON.stringify(accountIndex, null, 2),
    "utf-8",
  );
}

async function saveAccountMetadata(
  dataRoot: string,
  metadata: AccountMetadata,
): Promise<void> {
  const filePath = accountMetadataPath(dataRoot, metadata.account_id);
  await mkdir(accountDir(dataRoot, metadata.account_id), { recursive: true });
  await writeFile(filePath, JSON.stringify(metadata, null, 2), "utf-8");
}

function buildIdentityLookupError(error: unknown): AccountIdentityError {
  if (isRateLimitError(error)) {
    const retryAfter =
      error instanceof FirefliesApiError ? error.retryAfter : null;
    const waitMessage =
      retryAfter !== null
        ? ` Fireflies asked us to wait until ${new Date(retryAfter).toISOString()}.`
        : "";

    return new AccountIdentityError(
      "Could not determine the Fireflies account for the current API key." +
        waitMessage +
        " To avoid mixing data across accounts, no files were written.",
      retryAfter,
    );
  }

  if (error instanceof FirefliesApiError) {
    const detail = error.code
      ? `${error.code}${error.status ? ` (${error.status})` : ""}`
      : error.message;

    return new AccountIdentityError(
      "Could not determine the Fireflies account for the current API key: " +
        `${detail}. To avoid mixing data across accounts, no files were written.`,
      error.retryAfter,
    );
  }

  const errMsg = error instanceof Error ? error.message : String(error);
  return new AccountIdentityError(
    "Could not determine the Fireflies account for the current API key: " +
      `${errMsg}. To avoid mixing data across accounts, no files were written.`,
  );
}

async function lookupCurrentUser(
  client: Pick<ReturnType<typeof createGraphQLClient>, "query">,
): Promise<{
  user_id: string;
  email: string | null;
  name: string | null;
}> {
  const response = await client.query(GET_CURRENT_USER);
  return parseWithSchema(
    currentUserResponseSchema,
    response,
    "Fireflies current user response",
  ).user;
}

function withUpdatedIndexEntry(
  previous: AccountIndexEntry | undefined,
  accountId: string,
  verified: boolean,
): AccountIndexEntry {
  const currentTime = nowIso();

  return {
    account_id: accountId,
    verified,
    created_at: previous?.created_at ?? currentTime,
    updated_at: currentTime,
  };
}

async function upsertVerifiedAccount(
  dataRoot: string,
  tokenHash: string,
  user: {
    user_id: string;
    email: string | null;
    name: string | null;
  },
): Promise<void> {
  const index = await loadAccountIndex(dataRoot);
  const previous = index.tokens[tokenHash];

  index.tokens[tokenHash] = withUpdatedIndexEntry(previous, user.user_id, true);
  await saveAccountIndex(dataRoot, index);

  await saveAccountMetadata(dataRoot, {
    account_id: user.user_id,
    status: "verified",
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    created_at: previous?.created_at ?? nowIso(),
    last_verified_at: nowIso(),
  });
}

function buildUnsupportedLocalMappingError(
  dataRoot: string,
  accountId: string,
): Error {
  return new Error(
    `Found an unsupported unverified local account mapping for "${accountId}" in ${accountIndexPath(dataRoot)}. ` +
      "Provisional account layouts are no longer supported. Remove the stale local account-scoping files and retry once the current API key can resolve its owner.",
  );
}

export async function prepareAccountDataDir({
  cwd = process.cwd(),
  env = process.env,
  client = createGraphQLClient({
    apiKey: env.FIREFLIES_API_KEY ?? "",
  }),
}: PrepareAccountDataDirOptions = {}): Promise<PrepareAccountDataDirResult> {
  if (env.FIREFLIES_DATA_DIR) {
    return {
      accountId: "explicit",
      dataDir: env.FIREFLIES_DATA_DIR,
      dataRoot: getDataRoot(env, cwd),
      status: "explicit",
      source: "explicit",
    };
  }

  validateConfig({ apiKey: env.FIREFLIES_API_KEY ?? "" });

  const dataRoot = getDataRoot(env, cwd);
  const tokenHash = hashApiKey(env.FIREFLIES_API_KEY ?? "");
  const index = await loadAccountIndex(dataRoot);
  const indexedAccount = index.tokens[tokenHash];

  if (indexedAccount?.verified) {
    const dataDir = accountDir(dataRoot, indexedAccount.account_id);
    env.FIREFLIES_DATA_DIR = dataDir;
    return {
      accountId: indexedAccount.account_id,
      dataDir,
      dataRoot,
      status: "verified",
      source: "cached_verified",
    };
  }

  if (indexedAccount && !indexedAccount.verified) {
    throw buildUnsupportedLocalMappingError(
      dataRoot,
      indexedAccount.account_id,
    );
  }

  try {
    const user = await lookupCurrentUser(client);
    await upsertVerifiedAccount(dataRoot, tokenHash, user);
    const dataDir = accountDir(dataRoot, user.user_id);
    env.FIREFLIES_DATA_DIR = dataDir;
    return {
      accountId: user.user_id,
      dataDir,
      dataRoot,
      status: "verified",
      source: "owner_lookup",
    };
  } catch (error) {
    throw buildIdentityLookupError(error);
  }
}
