import type { ZodType } from "zod";
import { getConfig } from "./config.js";
import { parseWithSchema } from "./schemas.js";

// --- Types ---

interface GraphQLErrorExtensions {
  code?: string;
  status?: number;
  friendly?: boolean;
  helpUrls?: string[];
  metadata?: {
    retryAfter?: number;
  };
}

interface GraphQLErrorResponse {
  message: string;
  path?: string[];
  code?: string;
  status?: number;
  friendly?: boolean;
  helpUrls?: string[];
  metadata?: {
    retryAfter?: number;
  };
  extensions?: GraphQLErrorExtensions;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLErrorResponse[];
}

export interface GraphQLClientOptions {
  apiUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

interface FirefliesApiErrorOptions {
  code?: string;
  status?: number;
  retryAfter?: number | null;
  helpUrls?: string[];
}

export class FirefliesApiError extends Error {
  code?: string;
  status?: number;
  retryAfter: number | null;
  helpUrls: string[];

  constructor(message: string, options: FirefliesApiErrorOptions = {}) {
    super(message);
    this.name = "FirefliesApiError";
    this.code = options.code;
    this.status = options.status;
    this.retryAfter = options.retryAfter ?? null;
    this.helpUrls = options.helpUrls ?? [];
  }
}

function parseRetryAfterHeader(value: string | null): number | null {
  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value.trim())) {
    return Date.now() + Number(value) * 1000;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildGraphQLApiError<T = unknown>(
  response: Response,
  json: GraphQLResponse<T>,
): FirefliesApiError {
  const firstError = json.errors?.[0];
  const messages = json.errors?.map((error) => error.message).join("; ") ?? "";
  const code = firstError?.extensions?.code ?? firstError?.code;
  const status =
    firstError?.extensions?.status ??
    firstError?.status ??
    (response.status >= 400 ? response.status : undefined);
  const retryAfter =
    firstError?.extensions?.metadata?.retryAfter ??
    firstError?.metadata?.retryAfter ??
    parseRetryAfterHeader(response.headers.get("retry-after"));
  const helpUrls =
    firstError?.extensions?.helpUrls ?? firstError?.helpUrls ?? [];

  return new FirefliesApiError(`Fireflies API GraphQL error: ${messages}`, {
    code,
    status,
    retryAfter,
    helpUrls,
  });
}

export function isRateLimitError(error: unknown): error is FirefliesApiError {
  if (error instanceof FirefliesApiError) {
    return error.code === "too_many_requests" || error.status === 429;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = Reflect.get(error, "code");
  const status = Reflect.get(error, "status");
  return code === "too_many_requests" || status === 429;
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

  const rawBody = await response.text();

  let json: GraphQLResponse<T> | null = null;
  if (rawBody.length > 0) {
    try {
      json = JSON.parse(rawBody) as GraphQLResponse<T>;
    } catch {
      if (response.ok) {
        throw new Error("Fireflies API returned invalid JSON");
      }
    }
  }

  if (json?.errors?.length) {
    throw buildGraphQLApiError(response, json);
  }

  if (!response.ok) {
    throw new FirefliesApiError(
      `Fireflies API HTTP error: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        code: response.status === 429 ? "too_many_requests" : undefined,
        retryAfter: parseRetryAfterHeader(response.headers.get("retry-after")),
      },
    );
  }

  if (!json?.data) {
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
