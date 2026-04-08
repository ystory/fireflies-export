import { collectList } from "../src/collect-list.js";
import { loadDotenv } from "../src/config.js";
import { isDirectRun } from "../src/is-direct-run.js";

interface CollectListScriptDeps {
  collectList?: typeof collectList;
  loadDotenv?: typeof loadDotenv;
}

export async function runCollectListScript({
  collectList: collectListImpl = collectList,
  loadDotenv: loadDotenvImpl = loadDotenv,
}: CollectListScriptDeps = {}): Promise<void> {
  loadDotenvImpl();
  await collectListImpl();
}

if (isDirectRun(import.meta.url)) {
  runCollectListScript().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\nFatal error: ${errMsg}\n`);
    process.exit(1);
  });
}
