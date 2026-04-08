import { collectTranscripts } from "../src/collect-transcripts.js";
import { loadDotenv } from "../src/config.js";
import { isDirectRun } from "../src/is-direct-run.js";

interface CollectTranscriptsScriptDeps {
  collectTranscripts?: typeof collectTranscripts;
  loadDotenv?: typeof loadDotenv;
}

export async function runCollectTranscriptsScript({
  collectTranscripts: collectTranscriptsImpl = collectTranscripts,
  loadDotenv: loadDotenvImpl = loadDotenv,
}: CollectTranscriptsScriptDeps = {}): Promise<void> {
  loadDotenvImpl();
  await collectTranscriptsImpl();
}

if (isDirectRun(import.meta.url)) {
  runCollectTranscriptsScript().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\nFatal error: ${errMsg}\n`);
    process.exit(1);
  });
}
