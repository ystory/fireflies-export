import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

describe("runCli", () => {
  it("stops before collection when a prior retryAfter block exists", async () => {
    const log = vi.fn();
    const collectList = vi.fn();
    const collectTranscripts = vi.fn();
    const prepareAccountDataDir = vi.fn().mockResolvedValue(undefined);
    const blockedUntil = Date.parse("2026-04-09T00:00:00.000Z");

    await runCli({
      logger: { log },
      prepareAccountDataDir,
      getRateLimitBlockUntil: vi.fn().mockResolvedValue(blockedUntil),
      collectList,
      collectTranscripts,
    });

    expect(collectList).not.toHaveBeenCalled();
    expect(collectTranscripts).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(new Date(blockedUntil).toISOString()),
    );
  });

  it("continues when there is no active server-side retryAfter block", async () => {
    const log = vi.fn();
    const collectList = vi.fn();
    const collectTranscripts = vi.fn();
    const prepareAccountDataDir = vi.fn().mockResolvedValue(undefined);

    await runCli({
      logger: { log },
      prepareAccountDataDir,
      getRateLimitBlockUntil: vi.fn().mockResolvedValue(null),
      collectList,
      collectTranscripts,
    });

    expect(collectList).toHaveBeenCalledTimes(1);
    expect(collectTranscripts).toHaveBeenCalledTimes(1);
    expect(prepareAccountDataDir).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("fireflies-export"),
    );
  });
});
