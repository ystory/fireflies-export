import { describe, expect, it, vi } from "vitest";
import { runCollectListScript } from "../scripts/collect-list.js";
import { runCollectTranscriptsScript } from "../scripts/collect-transcripts.js";

describe("script entrypoints", () => {
  it("loads .env before running collect:list", async () => {
    const loadDotenv = vi.fn();
    const prepareAccountDataDir = vi.fn().mockResolvedValue(undefined);
    const collectList = vi.fn().mockResolvedValue(undefined);

    await runCollectListScript({
      loadDotenv,
      prepareAccountDataDir,
      collectList,
    });

    expect(loadDotenv).toHaveBeenCalledTimes(1);
    expect(prepareAccountDataDir).toHaveBeenCalledTimes(1);
    expect(collectList).toHaveBeenCalledTimes(1);
    expect(loadDotenv.mock.invocationCallOrder[0]).toBeLessThan(
      prepareAccountDataDir.mock.invocationCallOrder[0],
    );
    expect(prepareAccountDataDir.mock.invocationCallOrder[0]).toBeLessThan(
      collectList.mock.invocationCallOrder[0],
    );
  });

  it("loads .env before running collect:transcripts", async () => {
    const loadDotenv = vi.fn();
    const prepareAccountDataDir = vi.fn().mockResolvedValue(undefined);
    const collectTranscripts = vi.fn().mockResolvedValue(undefined);

    await runCollectTranscriptsScript({
      loadDotenv,
      prepareAccountDataDir,
      collectTranscripts,
    });

    expect(loadDotenv).toHaveBeenCalledTimes(1);
    expect(prepareAccountDataDir).toHaveBeenCalledTimes(1);
    expect(collectTranscripts).toHaveBeenCalledTimes(1);
    expect(loadDotenv.mock.invocationCallOrder[0]).toBeLessThan(
      prepareAccountDataDir.mock.invocationCallOrder[0],
    );
    expect(prepareAccountDataDir.mock.invocationCallOrder[0]).toBeLessThan(
      collectTranscripts.mock.invocationCallOrder[0],
    );
  });
});
