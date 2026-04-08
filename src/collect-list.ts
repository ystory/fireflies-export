/**
 * Collect the full list of meeting metadata into manifest.json.
 *
 * Incrementally fetches from newest to oldest, stopping when it hits
 * meetings already present in the manifest.
 *
 * Usage: pnpm run collect:list
 */

import chalk from "chalk";
import ora from "ora";
import { isRateLimitError, queryWithSchema } from "./client.js";
import { getConfig, validateConfig } from "./config.js";
import { LIST_TRANSCRIPTS } from "./queries.js";
import {
  listTranscriptsResponseSchema,
  type TranscriptListItem,
} from "./schemas.js";
import {
  getLocalQuotaEstimate,
  getRateLimitBlockUntil,
  incrementRequestCount,
  loadManifest,
  type ManifestEntry,
  recordRateLimit,
  saveManifest,
} from "./utils.js";

// --- Main ---

export async function collectList(): Promise<void> {
  const { pageSize } = getConfig();

  validateConfig();

  const manifest = await loadManifest();
  const knownIds = new Set(manifest.entries.map((e) => e.id));
  const spinner = ora();

  let skip = 0;
  let newCount = 0;
  let totalApiCalls = 0;
  const rateLimitBlockUntil = await getRateLimitBlockUntil();
  const quotaEstimate = await getLocalQuotaEstimate();

  console.log(
    chalk.cyan(
      `  Local API usage estimate (${quotaEstimate.date} UTC): ${quotaEstimate.used}/${quotaEstimate.limit}`,
    ),
  );

  if (rateLimitBlockUntil !== null) {
    console.log(
      chalk.yellow(
        `  Fireflies API asked us to wait until ${new Date(rateLimitBlockUntil).toISOString()}.`,
      ),
    );
    return;
  }

  while (true) {
    spinner.start(
      `Fetching page ${Math.floor(skip / pageSize) + 1} (skip=${skip})...`,
    );

    let items: TranscriptListItem[];
    try {
      const data = await queryWithSchema(
        LIST_TRANSCRIPTS,
        listTranscriptsResponseSchema,
        {
          limit: pageSize,
          skip,
        },
      );
      items = data.transcripts;
    } catch (err) {
      if (isRateLimitError(err)) {
        const blockedUntil = await recordRateLimit(err.retryAfter);
        const waitMessage =
          blockedUntil !== null
            ? ` Wait until ${new Date(blockedUntil).toISOString()}.`
            : " Run again later.";
        spinner.warn(chalk.yellow(`API rate limit hit.${waitMessage}`));
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(chalk.red(`API error: ${errMsg}`));
      }
      break;
    } finally {
      // Keep a local estimate of outbound attempts for visibility, but
      // let the server's explicit rate-limit response decide when to stop.
      await incrementRequestCount();
      totalApiCalls++;
    }

    // Empty response = no more data
    if (!items || items.length === 0) {
      spinner.succeed("Reached end of meeting list.");
      manifest.last_full_sync = new Date().toISOString();
      break;
    }

    // Check how many are new
    const newItems = items.filter((item) => !knownIds.has(item.id));

    if (newItems.length === 0) {
      if (manifest.last_full_sync !== null) {
        // Incremental mode: all items on this page are already known — stop
        spinner.succeed("All meetings on this page already known. Stopping.");
        break;
      }
      // Initial backfill: keep paginating to reach the end of history
      spinner.info("Page already known, continuing backfill...");
      skip += pageSize;
      continue;
    }

    // Add new items to manifest
    for (const item of newItems) {
      const entry: ManifestEntry = {
        id: item.id,
        title: item.title,
        date: item.date,
        duration: item.duration,
        host_email: item.host_email ?? "",
        organizer_email: item.organizer_email ?? "",
        participants: item.participants ?? [],
        transcript_url: item.transcript_url ?? "",
        collected: false,
        collected_at: null,
      };
      manifest.entries.push(entry);
      knownIds.add(item.id);
    }

    newCount += newItems.length;
    spinner.succeed(
      `${chalk.green(`${newItems.length} new`)} meetings found (page ${Math.floor(skip / pageSize) + 1})`,
    );

    skip += pageSize;
  }

  // Sort manifest entries by date descending (newest first)
  manifest.entries.sort((a, b) => b.date - a.date);

  await saveManifest(manifest);

  const uncollected = manifest.entries.filter((e) => !e.collected).length;
  console.log(
    chalk.cyan(
      `\n  Manifest updated: ${chalk.bold(String(manifest.entries.length))} total meetings, ` +
        `${chalk.green(`${newCount} new`)}, ` +
        `${chalk.yellow(`${uncollected} uncollected`)} ` +
        `(${totalApiCalls} API attempts this run)`,
    ),
  );
}

// Run only when executed directly (not when imported)
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("collect-list.ts");

if (isDirectRun) {
  collectList().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\nFatal error: ${errMsg}\n`));
    process.exit(1);
  });
}
