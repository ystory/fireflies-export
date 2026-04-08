/**
 * Download individual transcript content for meetings in the manifest.
 *
 * Iterates through manifest entries where collected=false, fetches the full
 * transcript, and saves as individual JSON files. Stops on explicit
 * server-side rate-limit responses and resumes safely afterward.
 *
 * Usage: pnpm run collect:transcripts
 */

import chalk from "chalk";
import ora from "ora";
import { isRateLimitError, queryWithSchema } from "./client.js";
import { validateConfig } from "./config.js";
import { GET_TRANSCRIPT } from "./queries.js";
import { transcriptDetailResponseSchema } from "./schemas.js";
import {
  getLocalQuotaEstimate,
  getRateLimitBlockUntil,
  hasValidTranscriptFile,
  incrementRequestCount,
  loadManifest,
  recordRateLimit,
  saveManifest,
  saveTranscript,
} from "./utils.js";

// --- Main ---

export async function collectTranscripts(): Promise<void> {
  validateConfig();

  const manifest = await loadManifest();

  // Recover from previous crashes: if a transcript file exists on disk
  // but manifest still says collected=false, sync the manifest state.
  let recovered = 0;
  for (const entry of manifest.entries) {
    if (!entry.collected && (await hasValidTranscriptFile(entry.id))) {
      entry.collected = true;
      entry.collected_at = "recovered";
      recovered++;
    }
  }
  if (recovered > 0) {
    await saveManifest(manifest);
    console.log(
      chalk.gray(`  Recovered ${recovered} transcript(s) from disk.`),
    );
  }

  const uncollected = manifest.entries.filter((e) => !e.collected);

  if (uncollected.length === 0) {
    console.log(chalk.green("  All transcripts already collected!"));
    return;
  }

  const rateLimitBlockUntil = await getRateLimitBlockUntil();
  const quotaEstimate = await getLocalQuotaEstimate();
  console.log(
    chalk.cyan(
      `  Local API usage estimate (${quotaEstimate.date} UTC): ${quotaEstimate.used}/${quotaEstimate.limit}`,
    ),
  );
  console.log(chalk.cyan(`  Uncollected transcripts: ${uncollected.length}`));

  if (rateLimitBlockUntil !== null) {
    console.log(
      chalk.yellow(
        `  Fireflies API asked us to wait until ${new Date(rateLimitBlockUntil).toISOString()}.`,
      ),
    );
    return;
  }

  const spinner = ora();
  let collected = 0;
  let failed = 0;

  for (const entry of uncollected) {
    const label = `[${collected + failed + 1}/${uncollected.length}]`;
    spinner.start(`${label} "${entry.title}"...`);

    try {
      const data = await queryWithSchema(
        GET_TRANSCRIPT,
        transcriptDetailResponseSchema,
        {
          transcriptId: entry.id,
        },
      );

      // Save the raw transcript data as-is
      await saveTranscript(entry.id, data.transcript);

      // Update manifest entry
      entry.collected = true;
      entry.collected_at = new Date().toISOString();

      // Save manifest after each successful collection (crash recovery)
      await saveManifest(manifest);
      collected++;
      spinner.succeed(`${label} ${chalk.green("saved")} — "${entry.title}"`);
    } catch (err) {
      // Detect rate limit errors and stop immediately
      if (isRateLimitError(err)) {
        const blockedUntil = await recordRateLimit(err.retryAfter);
        const waitMessage =
          blockedUntil !== null
            ? ` Wait until ${new Date(blockedUntil).toISOString()}.`
            : " Run again later.";
        spinner.warn(
          chalk.yellow(
            `API rate limit hit. ${uncollected.length - collected - failed} transcripts remaining.${waitMessage}`,
          ),
        );
        break;
      }

      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      spinner.fail(
        `${label} ${chalk.red("failed")} — "${entry.title}": ${errMsg}`,
      );
      // Continue with next transcript instead of aborting
    } finally {
      await incrementRequestCount();
    }
  }

  console.log(
    chalk.cyan(
      `\n  Results: ${chalk.green(`${collected} collected`)}, ` +
        `${chalk.red(`${failed} failed`)}, ` +
        `${chalk.yellow(`${uncollected.length - collected - failed} remaining`)}`,
    ),
  );
}

// Run only when executed directly (not when imported)
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("collect-transcripts.ts");

if (isDirectRun) {
  collectTranscripts().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\nFatal error: ${errMsg}\n`));
    process.exit(1);
  });
}
