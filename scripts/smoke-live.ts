import chalk from "chalk";
import { queryWithSchema } from "../src/client.js";
import { loadDotenv, validateConfig } from "../src/config.js";
import { GET_TRANSCRIPT, LIST_TRANSCRIPTS } from "../src/queries.js";
import {
  listTranscriptsResponseSchema,
  transcriptDetailResponseSchema,
} from "../src/schemas.js";

async function main(): Promise<void> {
  loadDotenv();
  validateConfig();

  console.log(chalk.bold("\n=== fireflies-export live smoke ===\n"));

  const listResponse = await queryWithSchema(
    LIST_TRANSCRIPTS,
    listTranscriptsResponseSchema,
    {
      limit: 1,
      skip: 0,
    },
  );

  console.log(
    chalk.green(
      `List query OK: received ${listResponse.transcripts.length} transcript item(s).`,
    ),
  );

  const firstTranscript = listResponse.transcripts[0];
  if (!firstTranscript) {
    console.log(
      chalk.yellow(
        "No transcripts available for detail smoke. Stopping here.\n",
      ),
    );
    return;
  }

  const detailResponse = await queryWithSchema(
    GET_TRANSCRIPT,
    transcriptDetailResponseSchema,
    {
      transcriptId: firstTranscript.id,
    },
  );

  console.log(
    chalk.green(
      `Transcript query OK: ${detailResponse.transcript.id} (${detailResponse.transcript.title}).`,
    ),
  );
  console.log(chalk.bold("\n=== Live smoke passed ===\n"));
}

main().catch((error) => {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`\nLive smoke failed: ${errMsg}\n`));
  process.exit(1);
});
