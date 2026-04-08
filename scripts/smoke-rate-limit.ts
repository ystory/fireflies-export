import chalk from "chalk";
import { prepareAccountDataDir } from "../src/account-storage.js";
import {
  createGraphQLClient,
  type FirefliesApiError,
  isRateLimitError,
} from "../src/client.js";
import { loadDotenv, validateConfig } from "../src/config.js";
import { isDirectRun } from "../src/is-direct-run.js";
import { LIST_TRANSCRIPTS } from "../src/queries.js";
import { recordRateLimit } from "../src/utils.js";

interface RateLimitSmokeDeps {
  client?: Pick<ReturnType<typeof createGraphQLClient>, "query">;
  logger?: Pick<typeof console, "log">;
  recordRateLimit?: typeof recordRateLimit;
}

export async function runRateLimitSmoke({
  client = createGraphQLClient(),
  logger = console,
  recordRateLimit: recordRateLimitImpl = recordRateLimit,
}: RateLimitSmokeDeps = {}): Promise<number | null> {
  logger.log(chalk.bold("\n=== fireflies-export rate-limit smoke ===\n"));
  logger.log(
    chalk.gray(
      "This smoke test expects the current API key to already be rate-limited.",
    ),
  );

  try {
    await client.query(LIST_TRANSCRIPTS, {
      limit: 1,
      skip: 0,
    });

    throw new Error(
      "The request succeeded, so the current API key is not rate-limited.",
    );
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }

    const rateLimitError = error as FirefliesApiError;
    const blockedUntil = await recordRateLimitImpl(rateLimitError.retryAfter);
    const retryAfterText =
      rateLimitError.retryAfter !== null
        ? new Date(rateLimitError.retryAfter).toISOString()
        : "missing";

    logger.log(chalk.green("Observed Fireflies rate-limit response."));
    logger.log(chalk.cyan(`  code: ${rateLimitError.code ?? "missing"}`));
    logger.log(
      chalk.cyan(`  status: ${String(rateLimitError.status ?? "missing")}`),
    );
    logger.log(chalk.cyan(`  retryAfter: ${retryAfterText}`));

    if (blockedUntil !== null) {
      logger.log(
        chalk.cyan(
          `  syncedBlockUntil: ${new Date(blockedUntil).toISOString()}`,
        ),
      );
    }

    if (rateLimitError.helpUrls.length > 0) {
      logger.log(chalk.cyan(`  helpUrl: ${rateLimitError.helpUrls[0]}`));
    }

    logger.log(chalk.bold("\n=== Rate-limit smoke passed ===\n"));
    return blockedUntil;
  }
}

async function main(): Promise<void> {
  loadDotenv();
  validateConfig();
  await prepareAccountDataDir();
  await runRateLimitSmoke();
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\nRate-limit smoke failed: ${errMsg}\n`));
    process.exit(1);
  });
}
