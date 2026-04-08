import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AccountIdentityError,
  PROVISIONAL_LEGACY_ACCOUNT_ID,
  prepareAccountDataDir,
} from "../src/account-storage.js";
import { FirefliesApiError } from "../src/client.js";
import {
  cleanupDir,
  createTempDataRoot,
  readJson,
  writeJson,
} from "./helpers.js";

function tokenHash(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

describe("account storage", () => {
  let dataRoot: string | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    await cleanupDir(dataRoot);
    dataRoot = undefined;
  });

  it("creates a verified account-scoped directory from owner lookup", async () => {
    dataRoot = await createTempDataRoot();
    const env = {
      FIREFLIES_API_KEY: "verified-key",
      FIREFLIES_DATA_ROOT: dataRoot,
    } as NodeJS.ProcessEnv;
    const client = {
      query: vi.fn().mockResolvedValue({
        user: {
          user_id: "user-1",
          email: "user-1@example.com",
          name: "User One",
        },
      }),
    };

    const result = await prepareAccountDataDir({
      env,
      cwd: dataRoot,
      client,
    });

    expect(result).toMatchObject({
      accountId: "user-1",
      dataDir: join(dataRoot, "accounts", "user-1"),
      status: "verified",
      source: "owner_lookup",
    });
    expect(env.FIREFLIES_DATA_DIR).toBe(join(dataRoot, "accounts", "user-1"));

    const index = await readJson<{
      tokens: Record<string, { account_id: string; verified: boolean }>;
    }>(join(dataRoot, ".account-index.json"));
    expect(index.tokens[tokenHash("verified-key")]).toMatchObject({
      account_id: "user-1",
      verified: true,
    });

    const metadata = await readJson<{
      status: string;
      user_id: string | null;
      email: string | null;
    }>(join(dataRoot, "accounts", "user-1", ".account.json"));
    expect(metadata).toMatchObject({
      status: "verified",
      user_id: "user-1",
      email: "user-1@example.com",
    });
  });

  it("reuses a cached verified mapping without another owner lookup", async () => {
    dataRoot = await createTempDataRoot();
    const env = {
      FIREFLIES_API_KEY: "cached-key",
      FIREFLIES_DATA_ROOT: dataRoot,
    } as NodeJS.ProcessEnv;

    await writeJson(join(dataRoot, ".account-index.json"), {
      tokens: {
        [tokenHash("cached-key")]: {
          account_id: "user-2",
          verified: true,
          created_at: "2026-04-09T00:00:00.000Z",
          updated_at: "2026-04-09T00:00:00.000Z",
        },
      },
    });
    await writeJson(join(dataRoot, "accounts", "user-2", ".account.json"), {
      account_id: "user-2",
      status: "verified",
      user_id: "user-2",
      email: "user-2@example.com",
      name: "User Two",
      created_at: "2026-04-09T00:00:00.000Z",
      last_verified_at: "2026-04-09T00:00:00.000Z",
    });

    const client = { query: vi.fn() };
    const result = await prepareAccountDataDir({
      env,
      cwd: dataRoot,
      client,
    });

    expect(result).toMatchObject({
      accountId: "user-2",
      status: "verified",
      source: "cached_verified",
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("uses a provisional mapping when the same token is still blocked", async () => {
    dataRoot = await createTempDataRoot();
    const env = {
      FIREFLIES_API_KEY: "blocked-provisional-key",
      FIREFLIES_DATA_ROOT: dataRoot,
    } as NodeJS.ProcessEnv;

    await writeJson(join(dataRoot, ".account-index.json"), {
      tokens: {
        [tokenHash("blocked-provisional-key")]: {
          account_id: PROVISIONAL_LEGACY_ACCOUNT_ID,
          verified: false,
          created_at: "2026-04-09T00:00:00.000Z",
          updated_at: "2026-04-09T00:00:00.000Z",
        },
      },
    });
    await writeJson(
      join(
        dataRoot,
        "accounts",
        PROVISIONAL_LEGACY_ACCOUNT_ID,
        ".account.json",
      ),
      {
        account_id: PROVISIONAL_LEGACY_ACCOUNT_ID,
        status: "provisional",
        user_id: null,
        email: null,
        name: null,
        created_at: "2026-04-09T00:00:00.000Z",
        last_verified_at: null,
      },
    );

    const client = {
      query: vi.fn().mockRejectedValue(
        new FirefliesApiError("rate limited", {
          code: "too_many_requests",
          status: 429,
          retryAfter: Date.parse("2026-04-10T00:00:00.000Z"),
        }),
      ),
    };

    const result = await prepareAccountDataDir({
      env,
      cwd: dataRoot,
      client,
    });

    expect(result).toMatchObject({
      accountId: PROVISIONAL_LEGACY_ACCOUNT_ID,
      status: "provisional",
      source: "cached_provisional",
    });
  });

  it("promotes a provisional account to a verified user_id once owner lookup succeeds", async () => {
    dataRoot = await createTempDataRoot();
    const env = {
      FIREFLIES_API_KEY: "promote-key",
      FIREFLIES_DATA_ROOT: dataRoot,
    } as NodeJS.ProcessEnv;

    await writeJson(join(dataRoot, ".account-index.json"), {
      tokens: {
        [tokenHash("promote-key")]: {
          account_id: PROVISIONAL_LEGACY_ACCOUNT_ID,
          verified: false,
          created_at: "2026-04-09T00:00:00.000Z",
          updated_at: "2026-04-09T00:00:00.000Z",
        },
      },
    });
    await writeJson(
      join(
        dataRoot,
        "accounts",
        PROVISIONAL_LEGACY_ACCOUNT_ID,
        "manifest.json",
      ),
      {
        last_full_sync: null,
        entries: [],
      },
    );

    const client = {
      query: vi.fn().mockResolvedValue({
        user: {
          user_id: "user-3",
          email: "user-3@example.com",
          name: "User Three",
        },
      }),
    };

    const result = await prepareAccountDataDir({
      env,
      cwd: dataRoot,
      client,
    });

    expect(result).toMatchObject({
      accountId: "user-3",
      status: "verified",
    });
    expect(
      existsSync(join(dataRoot, "accounts", PROVISIONAL_LEGACY_ACCOUNT_ID)),
    ).toBe(false);
    expect(
      existsSync(join(dataRoot, "accounts", "user-3", "manifest.json")),
    ).toBe(true);
  });

  it("fails closed for a new token when owner lookup cannot be determined", async () => {
    dataRoot = await createTempDataRoot();
    const env = {
      FIREFLIES_API_KEY: "unknown-blocked-key",
      FIREFLIES_DATA_ROOT: dataRoot,
    } as NodeJS.ProcessEnv;
    const retryAfter = Date.parse("2026-04-10T00:00:00.000Z");
    const client = {
      query: vi.fn().mockRejectedValue(
        new FirefliesApiError("rate limited", {
          code: "too_many_requests",
          status: 429,
          retryAfter,
        }),
      ),
    };

    await expect(
      prepareAccountDataDir({
        env,
        cwd: dataRoot,
        client,
      }),
    ).rejects.toMatchObject({
      name: "AccountIdentityError",
      retryAfter,
    } satisfies Partial<AccountIdentityError>);
    await expect(
      prepareAccountDataDir({
        env,
        cwd: dataRoot,
        client,
      }),
    ).rejects.toThrowError("no files were written");
    expect(existsSync(join(dataRoot, ".account-index.json"))).toBe(false);
  });
});
