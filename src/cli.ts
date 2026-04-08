#!/usr/bin/env node

/**
 * fireflies-export CLI entry point.
 *
 * Runs the full collection pipeline:
 *   1. Collect meeting list into manifest.json
 *   2. Download individual transcripts
 *
 * Usage:
 *   npx fireflies-export
 *   fireflies-export          (if installed globally)
 */

import chalk from "chalk";
import { collectList } from "./collect-list.js";
import { collectTranscripts } from "./collect-transcripts.js";
import { loadDotenv } from "./config.js";
import { isDirectRun } from "./is-direct-run.js";
import { getRateLimitBlockUntil } from "./utils.js";

interface CliDeps {
  collectList?: typeof collectList;
  collectTranscripts?: typeof collectTranscripts;
  getRateLimitBlockUntil?: typeof getRateLimitBlockUntil;
  logger?: Pick<typeof console, "log">;
}

export async function runCli({
  collectList: collectListImpl = collectList,
  collectTranscripts: collectTranscriptsImpl = collectTranscripts,
  getRateLimitBlockUntil: getRateLimitBlockUntilImpl = getRateLimitBlockUntil,
  logger = console,
}: CliDeps = {}): Promise<void> {
  loadDotenv();

  logger.log(chalk.bold("\n=== fireflies-export ===\n"));

  const rateLimitBlockUntil = await getRateLimitBlockUntilImpl();
  if (rateLimitBlockUntil !== null) {
    logger.log(
      chalk.yellow(
        `Fireflies API asked us to wait until ${new Date(rateLimitBlockUntil).toISOString()}.\n`,
      ),
    );
    return;
  }

  logger.log(chalk.cyan("[1/2] Collecting meeting list..."));
  await collectListImpl();

  logger.log(chalk.cyan("\n[2/2] Collecting transcripts..."));
  await collectTranscriptsImpl();

  logger.log(chalk.bold("\n=== Done ===\n"));
}

if (isDirectRun(import.meta.url)) {
  runCli().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\nFatal error: ${errMsg}\n`));
    process.exit(1);
  });
}
