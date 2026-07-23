import { runIngest } from "../src/lib/ingest/run";
import { migrate } from "../src/lib/migrate";
import { client } from "../src/lib/db";

async function main() {
  await migrate(client);
  const result = await runIngest({ includeJsearch: Boolean(process.env.JSEARCH_API_KEY) });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
