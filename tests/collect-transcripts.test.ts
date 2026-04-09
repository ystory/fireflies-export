import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";
import {
  cleanupDir,
  createTempDataDir,
  readJson,
  writeJson,
} from "./helpers.js";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("../src/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/client.js")>();
  return {
    ...actual,
    queryWithSchema: queryMock,
  };
});

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn(),
    succeed: vi.fn(),
    warn: vi.fn(),
    fail: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("collectTranscripts", () => {
  let dataDir: string | undefined;

  afterEach(async () => {
    queryMock.mockReset();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    await cleanupDir(dataDir);
    dataDir = undefined;
  });

  it("recovers manifest state from an already downloaded transcript file", async () => {
    dataDir = await createTempDataDir();
    vi.stubEnv("FIREFLIES_API_KEY", "test-api-key");

    const config = getConfig();
    const transcriptPath = join(config.transcriptsDir, "meeting-1.json");

    await writeJson(config.manifestPath, {
      last_full_sync: "2026-04-01T00:00:00.000Z",
      entries: [
        {
          id: "meeting-1",
          title: "Recovered meeting",
          date: 100,
          duration: 30,
          host_email: "host@example.com",
          organizer_email: "organizer@example.com",
          participants: ["known@example.com"],
          transcript_url: "https://example.com/meeting-1",
          collected: false,
          collected_at: null,
        },
      ],
    });

    await writeJson(transcriptPath, {
      id: "meeting-1",
      title: "Recovered meeting",
      date: 100,
      dateString: "2026-04-01",
      duration: 30,
      host_email: "host@example.com",
      organizer_email: "organizer@example.com",
      participants: ["known@example.com"],
      transcript_url: "https://example.com/meeting-1",
      speakers: [],
      sentences: [],
      meeting_attendees: [],
      meeting_attendance: [],
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { collectTranscripts } = await import(
      "../src/collect-transcripts.js"
    );
    await collectTranscripts();

    const manifest = await readJson<{
      entries: Array<{ collected: boolean; collected_at: string | null }>;
    }>(config.manifestPath);

    expect(manifest.entries[0]).toMatchObject({
      collected: true,
      collected_at: "recovered",
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("stops on rate-limit errors without marking the transcript as collected", async () => {
    dataDir = await createTempDataDir();
    vi.stubEnv("FIREFLIES_API_KEY", "test-api-key");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));

    const config = getConfig();
    const retryAfter = Date.parse("2026-04-09T00:00:00.000Z");

    await writeJson(config.manifestPath, {
      last_full_sync: "2026-04-01T00:00:00.000Z",
      entries: [
        {
          id: "meeting-2",
          title: "Rate limited meeting",
          date: 200,
          duration: 30,
          host_email: "host@example.com",
          organizer_email: "organizer@example.com",
          participants: ["known@example.com"],
          transcript_url: "https://example.com/meeting-2",
          collected: false,
          collected_at: null,
        },
      ],
    });

    queryMock.mockRejectedValueOnce({
      name: "FirefliesApiError",
      message: "Fireflies API GraphQL error: Too many requests",
      code: "too_many_requests",
      status: 429,
      retryAfter,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { collectTranscripts } = await import(
      "../src/collect-transcripts.js"
    );
    await collectTranscripts();

    const manifest = await readJson<{
      entries: Array<{ collected: boolean; collected_at: string | null }>;
    }>(config.manifestPath);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(manifest.entries[0]).toMatchObject({
      collected: false,
      collected_at: null,
    });
    const counter = await readJson<{
      blocked_until: number | null;
      count: number;
    }>(config.counterPath);
    expect(counter).toMatchObject({
      blocked_until: retryAfter,
      count: 1,
    });
    expect(existsSync(join(config.transcriptsDir, "meeting-2.json"))).toBe(
      false,
    );
  });
});
