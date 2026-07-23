import { client, dbPath } from "../src/lib/db";
import { migrate } from "../src/lib/migrate";

async function main() {
  await migrate(client);
  console.log(`Migrated schema at ${dbPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
