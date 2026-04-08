import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";
import {
  getRateLimitBlockUntil,
  getRemainingRequests,
  hasValidTranscriptFile,
  incrementRequestCount,
  loadManifest,
  recordRateLimit,
} from "../src/utils.js";
import {
  cleanupDir,
  createTempDataDir,
  readJson,
  writeJson,
} from "./helpers.js";

describe("utils", () => {
  let dataDir: string | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await cleanupDir(dataDir);
    dataDir = undefined;
  });

  it("returns an empty manifest when none exists yet", async () => {
    dataDir = await createTempDataDir();

    await expect(loadManifest()).resolves.toEqual({
      last_full_sync: null,
      entries: [],
    });
  });

  it("resets the request counter on a new UTC day", async () => {
    dataDir = await createTempDataDir();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));

    await incrementRequestCount();
    await incrementRequestCount();

    expect(await getRemainingRequests()).toBe(48);

    vi.setSystemTime(new Date("2026-04-09T00:05:00.000Z"));

    expect(await getRemainingRequests()).toBe(50);

    await incrementRequestCount();

    const counter = await readJson<{ date: string; count: number }>(
      getConfig().counterPath,
    );

    expect(counter).toEqual({
      date: "2026-04-09",
      count: 1,
      blocked_until: null,
    });
  });

  it("preserves an explicit server retryAfter block across a UTC day change", async () => {
    dataDir = await createTempDataDir();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));

    const retryAfter = Date.parse("2026-04-09T12:00:00.000Z");
    await recordRateLimit(retryAfter);
    await incrementRequestCount();

    vi.setSystemTime(new Date("2026-04-09T00:05:00.000Z"));

    expect(await getRemainingRequests()).toBe(50);
    expect(await getRateLimitBlockUntil()).toBe(retryAfter);
  });

  it("throws a helpful error when manifest.json is invalid", async () => {
    dataDir = await createTempDataDir();

    await writeJson(getConfig().manifestPath, {
      last_full_sync: null,
      entries: [{ id: 123 }],
    });

    await expect(loadManifest()).rejects.toThrowError(
      "manifest.json failed schema validation",
    );
  });

  it("treats malformed transcript files as invalid recovery candidates", async () => {
    dataDir = await createTempDataDir();

    await writeJson(`${getConfig().transcriptsDir}/broken.json`, {
      title: "Missing required id",
    });

    await expect(hasValidTranscriptFile("broken")).resolves.toBe(false);
  });
});
