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

describe("collectList", () => {
  let dataDir: string | undefined;

  afterEach(async () => {
    queryMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    await cleanupDir(dataDir);
    dataDir = undefined;
  });

  it("adds new meetings and stops when the next page is already known", async () => {
    dataDir = await createTempDataDir();
    vi.stubEnv("FIREFLIES_API_KEY", "test-api-key");

    await writeJson(getConfig().manifestPath, {
      last_full_sync: "2026-04-01T00:00:00.000Z",
      entries: [
        {
          id: "known-1",
          title: "Known meeting",
          date: 100,
          duration: 30,
          host_email: "host@example.com",
          organizer_email: "organizer@example.com",
          participants: ["known@example.com"],
          transcript_url: "https://example.com/known-1",
          collected: true,
          collected_at: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    queryMock
      .mockResolvedValueOnce({
        transcripts: [
          {
            id: "new-1",
            title: "New meeting",
            date: 200,
            duration: 45,
            host_email: "host@example.com",
            organizer_email: "organizer@example.com",
            participants: ["new@example.com"],
            transcript_url: "https://example.com/new-1",
            meeting_attendees: [],
          },
          {
            id: "known-1",
            title: "Known meeting",
            date: 100,
            duration: 30,
            host_email: "host@example.com",
            organizer_email: "organizer@example.com",
            participants: ["known@example.com"],
            transcript_url: "https://example.com/known-1",
            meeting_attendees: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        transcripts: [
          {
            id: "known-1",
            title: "Known meeting",
            date: 100,
            duration: 30,
            host_email: "host@example.com",
            organizer_email: "organizer@example.com",
            participants: ["known@example.com"],
            transcript_url: "https://example.com/known-1",
            meeting_attendees: [],
          },
        ],
      });

    vi.spyOn(console, "log").mockImplementation(() => {});

    const { collectList } = await import("../src/collect-list.js");
    await collectList();

    const manifest = await readJson<{
      entries: Array<{ id: string; collected: boolean }>;
    }>(getConfig().manifestPath);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(manifest.entries.map((entry) => entry.id)).toEqual([
      "new-1",
      "known-1",
    ]);
    expect(manifest.entries[0]?.collected).toBe(false);
  });

  it("stores server retryAfter when the list endpoint is rate-limited", async () => {
    dataDir = await createTempDataDir();
    vi.stubEnv("FIREFLIES_API_KEY", "test-api-key");

    const retryAfter = Date.parse("2026-04-09T00:00:00.000Z");

    queryMock.mockRejectedValueOnce({
      name: "FirefliesApiError",
      message: "Fireflies API GraphQL error: Too many requests",
      code: "too_many_requests",
      status: 429,
      retryAfter,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { collectList } = await import("../src/collect-list.js");
    await collectList();

    const counter = await readJson<{
      blocked_until: number | null;
      count: number;
    }>(getConfig().counterPath);

    expect(counter).toMatchObject({
      blocked_until: retryAfter,
      count: 1,
    });
  });
});
