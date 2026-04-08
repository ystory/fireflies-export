import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createGraphQLClient,
  FirefliesApiError,
  isRateLimitError,
  queryWithSchema,
} from "../src/client.js";
import { readFixtureJson } from "./helpers.js";

describe("createGraphQLClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns data from a successful GraphQL response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { transcripts: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createGraphQLClient({
      apiUrl: "https://example.com/graphql",
      apiKey: "secret-key",
      fetchFn,
    });

    await expect(client.query("query Test {}", { limit: 1 })).resolves.toEqual({
      transcripts: [],
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.com/graphql",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key",
        }),
      }),
    );
  });

  it("throws a helpful error for HTTP failures", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("boom", {
        status: 500,
        statusText: "Server Error",
      }),
    );

    const client = createGraphQLClient({
      apiUrl: "https://example.com/graphql",
      apiKey: "secret-key",
      fetchFn,
    });

    await expect(client.query("query Test {}")).rejects.toThrowError(
      "Fireflies API HTTP error: 500 Server Error",
    );
  });

  it("throws combined GraphQL errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: "first" }, { message: "second" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = createGraphQLClient({
      apiUrl: "https://example.com/graphql",
      apiKey: "secret-key",
      fetchFn,
    });

    await expect(client.query("query Test {}")).rejects.toThrowError(
      "Fireflies API GraphQL error: first; second",
    );
  });

  it("preserves structured rate-limit details from GraphQL errors", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));

    const body = await readFixtureJson<{
      errors: Array<{
        extensions?: {
          metadata?: {
            retryAfter?: number;
          };
          helpUrls?: string[];
        };
      }>;
    }>("fireflies-too-many-requests.json");
    const retryAfter = body.errors[0]?.extensions?.metadata?.retryAfter;
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );

    const client = createGraphQLClient({
      apiUrl: "https://example.com/graphql",
      apiKey: "secret-key",
      fetchFn,
    });

    const error = await client
      .query("query Test {}")
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(FirefliesApiError);
    expect(error).toMatchObject({
      name: "FirefliesApiError",
      code: "too_many_requests",
      status: 429,
      retryAfter,
      helpUrls: [
        "https://docs.fireflies.ai/miscellaneous/error-codes#too_many_requests",
      ],
    });
    expect(isRateLimitError(error)).toBe(true);
  });

  it("falls back to the Retry-After header when metadata retryAfter is not a future timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: "Too many requests",
              extensions: {
                code: "too_many_requests",
                status: 429,
                metadata: {
                  retryAfter: 120,
                },
              },
            },
          ],
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "120",
          },
        },
      ),
    );

    const client = createGraphQLClient({
      apiUrl: "https://example.com/graphql",
      apiKey: "secret-key",
      fetchFn,
    });

    const error = await client
      .query("query Test {}")
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(FirefliesApiError);
    expect(error).toMatchObject({
      code: "too_many_requests",
      status: 429,
      retryAfter: Date.now() + 120_000,
    });
  });

  it("throws a schema validation error when the response shape is invalid", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { transcripts: "not-an-array" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      queryWithSchema(
        "query Test {}",
        z.object({ transcripts: z.array(z.object({ id: z.string() })) }),
        undefined,
        {
          apiUrl: "https://example.com/graphql",
          apiKey: "secret-key",
          fetchFn,
        },
      ),
    ).rejects.toThrowError("Fireflies API response failed schema validation");
  });
});
