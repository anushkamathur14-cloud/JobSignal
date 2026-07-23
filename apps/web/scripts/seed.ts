import { migrate } from "../src/lib/migrate";
import { client, dbPath } from "../src/lib/db";
import { seedCompaniesFromYaml } from "../src/lib/seed-companies";

async function main() {
  await migrate(client);
  console.log(`DB: ${dbPath}`);
  const { upserted, disabled } = await seedCompaniesFromYaml();
  console.log(`Seeded ${upserted} companies (disabled ${disabled} stale)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
