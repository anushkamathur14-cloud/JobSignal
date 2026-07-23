import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { eq } from "drizzle-orm";
import { companies } from "@job-signal/db";
import { db } from "./db";
import { isoNow } from "./periods";

export type SeedCompany = {
  name: string;
  ats_type: string;
  board_slug?: string;
  board_url?: string;
  domain_hint?: string;
  stage?: string;
};

export function findCompaniesYaml(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data/companies.yaml"),
    path.resolve(process.cwd(), "../../data/companies.yaml"),
    path.resolve(process.cwd(), "../../../data/companies.yaml"),
    path.join(__dirname, "../../data/companies.yaml"),
    path.join(__dirname, "../../../../data/companies.yaml"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function loadCompaniesFromYaml(yamlPath?: string): SeedCompany[] {
  const p = yamlPath ?? findCompaniesYaml();
  if (!p) throw new Error("companies.yaml not found");
  const doc = parseYaml(fs.readFileSync(p, "utf8")) as {
    companies?: SeedCompany[];
  };
  return doc.companies ?? [];
}

/** Upsert curated pack. Does not disable manually added companies. */
export async function seedCompaniesFromYaml(_opts?: {
  disableMissing?: boolean;
}): Promise<{ upserted: number; disabled: number }> {
  const list = loadCompaniesFromYaml();
  const now = isoNow();
  let upserted = 0;

  const existingRows = await db.select().from(companies);

  for (const c of list) {
    const slug = c.board_slug ?? null;

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
          stage: c.stage ?? existing.stage,
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
        stage: c.stage ?? null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    upserted++;
  }

  return { upserted, disabled: 0 };
}

