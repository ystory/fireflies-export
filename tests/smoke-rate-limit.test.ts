import { describe, expect, it, vi } from "vitest";
import { runRateLimitSmoke } from "../scripts/smoke-rate-limit.js";
import { FirefliesApiError } from "../src/client.js";

describe("runRateLimitSmoke", () => {
  it("persists the authoritative retryAfter timestamp when the API is blocked", async () => {
    const retryAfter = Date.parse("2026-04-09T00:00:00.113Z");
    const client = {
      query: vi.fn().mockRejectedValue(
        new FirefliesApiError("blocked", {
          code: "too_many_requests",
          status: 429,
          retryAfter,
          helpUrls: ["https://docs.fireflies.ai/miscellaneous/error-codes"],
        }),
      ),
    };
    const logger = { log: vi.fn() };
    const recordRateLimit = vi.fn().mockResolvedValue(retryAfter);

    await expect(
      runRateLimitSmoke({
        client,
        logger,
        recordRateLimit,
      }),
    ).resolves.toBe(retryAfter);

    expect(recordRateLimit).toHaveBeenCalledWith(retryAfter);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(new Date(retryAfter).toISOString()),
    );
  });

  it("fails when the current API key is not rate-limited", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ transcripts: [] }),
    };

    await expect(
      runRateLimitSmoke({
        client,
        logger: { log: vi.fn() },
        recordRateLimit: vi.fn(),
      }),
    ).rejects.toThrowError("The request succeeded");
  });
});
