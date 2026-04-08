import type { ZodType } from "zod";
import { getConfig } from "./config.js";
import { parseWithSchema } from "./schemas.js";

// --- Types ---

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

export interface GraphQLClientOptions {
  apiUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

async function runQuery<T = unknown>(
  document: string,
  variables: Record<string, unknown> | undefined,
  options: Required<GraphQLClientOptions>,
): Promise<T> {
  const response = await options.fetchFn(options.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ query: document, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Fireflies API HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Fireflies API GraphQL error: ${messages}`);
  }

  if (!json.data) {
    throw new Error("Fireflies API returned no data");
  }

  return json.data;
}

// --- Client ---

export function createGraphQLClient(options: GraphQLClientOptions = {}) {
  return {
    async query<T = unknown>(
      document: string,
      variables?: Record<string, unknown>,
    ): Promise<T> {
      const config = getConfig();

      return runQuery(document, variables, {
        apiUrl: options.apiUrl ?? config.apiUrl,
        apiKey: options.apiKey ?? config.apiKey,
        fetchFn: options.fetchFn ?? fetch,
      });
    },
  };
}

export async function queryWithSchema<T>(
  document: string,
  schema: ZodType<T>,
  variables?: Record<string, unknown>,
  options: GraphQLClientOptions = {},
): Promise<T> {
  const client = createGraphQLClient(options);
  const data = await client.query(document, variables);
  return parseWithSchema(schema, data, "Fireflies API response");
}

/**
 * Sends a GraphQL query to the Fireflies API using native fetch.
 * Throws on network errors or GraphQL errors.
 */
export async function query<T = unknown>(
  document: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const client = createGraphQLClient();
  return client.query(document, variables);
}
