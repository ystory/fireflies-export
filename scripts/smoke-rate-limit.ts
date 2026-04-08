import chalk from "chalk";
import {
  createGraphQLClient,
  type FirefliesApiError,
  isRateLimitError,
} from "../src/client.js";
import { loadDotenv, validateConfig } from "../src/config.js";
import { LIST_TRANSCRIPTS } from "../src/queries.js";

async function main(): Promise<void> {
  loadDotenv();
  validateConfig();

  console.log(chalk.bold("\n=== fireflies-export rate-limit smoke ===\n"));
  console.log(
    chalk.gray(
      "This smoke test expects the current API key to already be rate-limited.",
    ),
  );

  const client = createGraphQLClient();

  try {
    await client.query(LIST_TRANSCRIPTS, {
      limit: 1,
      skip: 0,
    });

    console.log(
      chalk.yellow(
        "The request succeeded, so the current API key is not rate-limited.\n",
      ),
    );
    process.exit(1);
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }

    const rateLimitError = error as FirefliesApiError;
    const retryAfterText =
      rateLimitError.retryAfter !== null
        ? new Date(rateLimitError.retryAfter).toISOString()
        : "missing";

    console.log(chalk.green("Observed Fireflies rate-limit response."));
    console.log(chalk.cyan(`  code: ${rateLimitError.code ?? "missing"}`));
    console.log(
      chalk.cyan(`  status: ${String(rateLimitError.status ?? "missing")}`),
    );
    console.log(chalk.cyan(`  retryAfter: ${retryAfterText}`));

    if (rateLimitError.helpUrls.length > 0) {
      console.log(chalk.cyan(`  helpUrl: ${rateLimitError.helpUrls[0]}`));
    }

    console.log(chalk.bold("\n=== Rate-limit smoke passed ===\n"));
  }
}

main().catch((error) => {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`\nRate-limit smoke failed: ${errMsg}\n`));
  process.exit(1);
});
