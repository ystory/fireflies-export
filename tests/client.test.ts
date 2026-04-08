import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGraphQLClient, queryWithSchema } from "../src/client.js";

describe("createGraphQLClient", () => {
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
