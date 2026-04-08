/**
 * Development convenience wrapper.
 * Delegates to the canonical CLI entry point in src/cli.ts.
 *
 * Usage: pnpm run collect
 */

import { runCli } from "../src/cli.js";
import { isDirectRun } from "../src/is-direct-run.js";

if (isDirectRun(import.meta.url)) {
  runCli().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\nFatal error: ${errMsg}\n`);
    process.exit(1);
  });
}
