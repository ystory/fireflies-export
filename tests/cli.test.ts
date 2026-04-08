import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

describe("runCli", () => {
  it("stops before collection when the daily quota is exhausted", async () => {
    const log = vi.fn();
    const collectList = vi.fn();
    const collectTranscripts = vi.fn();

    await runCli({
      logger: { log },
      getRemainingRequests: vi.fn().mockResolvedValue(0),
      collectList,
      collectTranscripts,
    });

    expect(collectList).not.toHaveBeenCalled();
    expect(collectTranscripts).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Daily API limit already reached"),
    );
  });
});
