import type { Client } from "@libsql/client";
import fs from "fs";
import path from "path";
import { client as defaultClient } from "./db";

const DDL = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ats_type TEXT NOT NULL,
  board_slug TEXT,
  board_url TEXT,
  domain_hint TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_ats_slug ON companies(ats_type, board_slug);

CREATE TABLE IF NOT EXISTS job_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  role_family TEXT NOT NULL,
  domain TEXT NOT NULL,
  location TEXT,
  remote INTEGER DEFAULT 0,
  url TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_external ON job_postings(source, external_id);
CREATE INDEX IF NOT EXISTS jobs_role_family ON job_postings(role_family);
CREATE INDEX IF NOT EXISTS jobs_domain ON job_postings(domain);
CREATE INDEX IF NOT EXISTS jobs_active ON job_postings(is_active);

CREATE TABLE IF NOT EXISTS job_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  source TEXT NOT NULL,
  company_id INTEGER,
  company_name TEXT,
  role_family TEXT NOT NULL,
  domain TEXT NOT NULL,
  active_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS snapshots_unique ON job_snapshots(
  period_type, period_key, source, company_id, role_family, domain
);
CREATE INDEX IF NOT EXISTS snapshots_period ON job_snapshots(period_type, period_key);

CREATE TABLE IF NOT EXISTS resume_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT,
  raw_text TEXT NOT NULL,
  skills_json TEXT NOT NULL DEFAULT '[]',
  titles_json TEXT NOT NULL DEFAULT '[]',
  domains_json TEXT NOT NULL DEFAULT '[]',
  seniority TEXT,
  years_experience REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER REFERENCES resume_profiles(id),
  role_family TEXT NOT NULL,
  domain TEXT,
  fit_score REAL NOT NULL,
  trend_score REAL NOT NULL,
  combined_score REAL NOT NULL,
  why_fit_json TEXT NOT NULL DEFAULT '[]',
  why_hot_json TEXT NOT NULL DEFAULT '[]',
  example_jobs_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
`;

let migrated = false;

function findSeedJson(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data/vercel-seed.json"),
    path.resolve(process.cwd(), "../../data/vercel-seed.json"),
    path.resolve(process.cwd(), "../../../data/vercel-seed.json"),
    path.join(__dirname, "../../data/vercel-seed.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function hydrateFromSeed(client: Client) {
  const count = await client.execute("SELECT COUNT(*) AS c FROM job_postings");
  const n = Number(count.rows[0]?.c ?? 0);
  if (n > 0) return;

  const seedPath = findSeedJson();
  if (!seedPath) return;

  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8")) as {
    companies: Record<string, unknown>[];
    job_postings: Record<string, unknown>[];
    job_snapshots: Record<string, unknown>[];
  };

  await client.execute("DELETE FROM job_snapshots");
  await client.execute("DELETE FROM job_postings");
  await client.execute("DELETE FROM companies");

  for (const c of raw.companies ?? []) {
    await client.execute({
      sql: `INSERT INTO companies (id, name, ats_type, board_slug, board_url, domain_hint, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        c.id as number,
        c.name as string,
        c.ats_type as string,
        (c.board_slug as string) ?? null,
        (c.board_url as string) ?? null,
        (c.domain_hint as string) ?? null,
        c.enabled ? 1 : 0,
        c.created_at as string,
        c.updated_at as string,
      ],
    });
  }

  for (const j of raw.job_postings ?? []) {
    await client.execute({
      sql: `INSERT INTO job_postings
        (id, source, external_id, company_id, company_name, title, role_family, domain, location, remote, url, first_seen, last_seen, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        j.id as number,
        j.source as string,
        j.external_id as string,
        (j.company_id as number) ?? null,
        j.company_name as string,
        j.title as string,
        j.role_family as string,
        j.domain as string,
        (j.location as string) ?? null,
        j.remote ? 1 : 0,
        (j.url as string) ?? null,
        j.first_seen as string,
        j.last_seen as string,
        j.is_active ? 1 : 0,
      ],
    });
  }

  for (const s of raw.job_snapshots ?? []) {
    await client.execute({
      sql: `INSERT INTO job_snapshots
        (id, period_type, period_key, source, company_id, company_name, role_family, domain, active_count, new_count, captured_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        s.id as number,
        s.period_type as string,
        s.period_key as string,
        s.source as string,
        (s.company_id as number) ?? null,
        (s.company_name as string) ?? null,
        s.role_family as string,
        s.domain as string,
        s.active_count as number,
        s.new_count as number,
        s.captured_at as string,
      ],
    });
  }
}

export async function migrate(client: Client = defaultClient) {
  if (migrated && !process.env.VERCEL) return;
  await client.executeMultiple(DDL);
  if (process.env.VERCEL || process.env.HYDRATE_SEED === "1") {
    await hydrateFromSeed(client);
  }
  migrated = true;
}
