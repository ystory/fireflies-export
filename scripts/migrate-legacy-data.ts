import chalk from "chalk";
import { migrateLegacyDataToProvisionalAccount } from "../src/account-storage.js";
import { loadDotenv } from "../src/config.js";
import { isDirectRun } from "../src/is-direct-run.js";

export async function runMigrateLegacyDataScript(): Promise<void> {
  loadDotenv();

  const result = await migrateLegacyDataToProvisionalAccount();

  console.log(chalk.bold("\n=== fireflies-export legacy data migration ===\n"));
  console.log(chalk.cyan(`  dataRoot: ${result.dataRoot}`));
  console.log(chalk.cyan(`  accountId: ${result.accountId}`));
  console.log(chalk.cyan(`  dataDir: ${result.dataDir}`));

  if (result.migrated) {
    console.log(
      chalk.green(
        `  Moved legacy data into provisional account "${result.accountId}".`,
      ),
    );
  } else {
    console.log(
      chalk.yellow(
        `  No legacy unscoped data found. Registered provisional account "${result.accountId}" for the current API key.`,
      ),
    );
  }

  console.log(
    chalk.gray(
      "  This provisional account can be promoted to the real Fireflies user_id once owner lookup succeeds.",
    ),
  );
  console.log(chalk.bold("\n=== Migration done ===\n"));
}

if (isDirectRun(import.meta.url)) {
  runMigrateLegacyDataScript().catch((error) => {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\nLegacy migration failed: ${errMsg}\n`));
    process.exit(1);
  });
}
