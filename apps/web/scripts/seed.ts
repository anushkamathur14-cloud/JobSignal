import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { eq } from "drizzle-orm";
import { companies } from "@job-signal/db";
import { db, client, dbPath } from "../src/lib/db";
import { migrate } from "../src/lib/migrate";
import { isoNow } from "../src/lib/periods";

function findYaml(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../data/companies.yaml"),
    path.resolve(process.cwd(), "data/companies.yaml"),
    path.resolve(__dirname, "../../../data/companies.yaml"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("companies.yaml not found");
}

async function main() {
  await migrate(client);
  console.log(`DB: ${dbPath}`);

  const raw = fs.readFileSync(findYaml(), "utf8");
  const doc = parseYaml(raw) as {
    companies: Array<{
      name: string;
      ats_type: string;
      board_slug?: string;
      board_url?: string;
      domain_hint?: string;
    }>;
  };

  const now = isoNow();
  const keep = new Set<string>();
  let upserted = 0;

  const existingRows = await db.select().from(companies);

  for (const c of doc.companies ?? []) {
    const slug = c.board_slug ?? null;
    keep.add(`${c.ats_type}::${slug}`);

    const existing = existingRows.find(
      (row) => row.atsType === c.ats_type && row.boardSlug === slug
    );

    if (existing) {
      await db
        .update(companies)
        .set({
          name: c.name,
          boardUrl: c.board_url ?? existing.boardUrl,
          domainHint: c.domain_hint ?? existing.domainHint,
          enabled: true,
          updatedAt: now,
        })
        .where(eq(companies.id, existing.id));
    } else {
      await db.insert(companies).values({
        name: c.name,
        atsType: c.ats_type,
        boardSlug: slug,
        boardUrl: c.board_url ?? null,
        domainHint: c.domain_hint ?? null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    upserted++;
  }

  let disabled = 0;
  const all = await db.select().from(companies);
  for (const row of all) {
    const key = `${row.atsType}::${row.boardSlug}`;
    if (!keep.has(key) && row.enabled) {
      await db
        .update(companies)
        .set({ enabled: false, updatedAt: now })
        .where(eq(companies.id, row.id));
      disabled++;
    }
  }

  console.log(`Seeded ${upserted} companies (disabled ${disabled} stale)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
