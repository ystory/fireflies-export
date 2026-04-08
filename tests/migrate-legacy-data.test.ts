import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMigrateLegacyDataScript } from "../scripts/migrate-legacy-data.js";
import { PROVISIONAL_LEGACY_ACCOUNT_ID } from "../src/account-storage.js";
import {
  cleanupDir,
  createTempDataRoot,
  readJson,
  writeJson,
} from "./helpers.js";

function tokenHash(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

describe("legacy migration script", () => {
  let dataRoot: string | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    await cleanupDir(dataRoot);
    dataRoot = undefined;
  });

  it("moves unscoped legacy data into the provisional account directory", async () => {
    dataRoot = await createTempDataRoot();
    vi.stubEnv("FIREFLIES_API_KEY", "legacy-key");

    await writeJson(join(dataRoot, "manifest.json"), {
      last_full_sync: null,
      entries: [],
    });
    await writeJson(join(dataRoot, ".request-counter.json"), {
      date: "2026-04-09",
      count: 3,
      blocked_until: null,
    });
    await writeJson(join(dataRoot, "transcripts", "meeting-1.json"), {
      id: "meeting-1",
      title: "Legacy transcript",
    });

    await runMigrateLegacyDataScript();

    expect(existsSync(join(dataRoot, "manifest.json"))).toBe(false);
    expect(existsSync(join(dataRoot, ".request-counter.json"))).toBe(false);
    expect(existsSync(join(dataRoot, "transcripts"))).toBe(false);

    expect(
      existsSync(
        join(
          dataRoot,
          "accounts",
          PROVISIONAL_LEGACY_ACCOUNT_ID,
          "manifest.json",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          dataRoot,
          "accounts",
          PROVISIONAL_LEGACY_ACCOUNT_ID,
          "transcripts",
          "meeting-1.json",
        ),
      ),
    ).toBe(true);

    const index = await readJson<{
      tokens: Record<string, { account_id: string; verified: boolean }>;
    }>(join(dataRoot, ".account-index.json"));
    expect(index.tokens[tokenHash("legacy-key")]).toMatchObject({
      account_id: PROVISIONAL_LEGACY_ACCOUNT_ID,
      verified: false,
    });
  });
});
