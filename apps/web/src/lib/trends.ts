import { and, eq, sql, desc, inArray, isNotNull, ne } from "drizzle-orm";
import { jobPostings, jobSnapshots, companies } from "@job-signal/db";
import { db } from "./db";
import {
  dayKey,
  weekKey,
  monthKey,
  quarterKey,
  previousPeriodKey,
  periodKeyFor,
  periodStart,
  recentPeriodKeys,
  pctChange,
  isoNow,
} from "./periods";
import { formatLabel } from "./classify";

export type SourceFilter = string[];

export async function writeSnapshots() {
  const now = isoNow();
  const periods: { type: "day" | "week" | "month" | "quarter"; key: string }[] = [
    { type: "day", key: dayKey() },
    { type: "week", key: weekKey() },
    { type: "month", key: monthKey() },
    { type: "quarter", key: quarterKey() },
  ];

  const active = await db.select().from(jobPostings).where(eq(jobPostings.isActive, true));

  type AggKey = string;
  const buckets = new Map<
    AggKey,
    {
      source: string;
      companyId: number | null;
      companyName: string;
      roleFamily: string;
      domain: string;
      activeCount: number;
      newCount: number;
    }
  >();

  for (const job of active) {
    const key = [job.source, job.companyId ?? "null", job.roleFamily, job.domain].join("|");
    const bucket = buckets.get(key) ?? {
      source: job.source,
      companyId: job.companyId,
      companyName: job.companyName,
      roleFamily: job.roleFamily,
      domain: job.domain,
      activeCount: 0,
      newCount: 0,
    };
    bucket.activeCount += 1;
    if (job.firstSeen.slice(0, 10) === dayKey()) {
      bucket.newCount += 1;
    }
    buckets.set(key, bucket);
  }

  for (const period of periods) {
    await db
      .delete(jobSnapshots)
      .where(and(eq(jobSnapshots.periodType, period.type), eq(jobSnapshots.periodKey, period.key)));

    for (const b of buckets.values()) {
      await db.insert(jobSnapshots).values({
        periodType: period.type,
        periodKey: period.key,
        source: b.source,
        companyId: b.companyId,
        companyName: b.companyName,
        roleFamily: b.roleFamily,
        domain: b.domain,
        activeCount: b.activeCount,
        newCount: b.newCount,
        capturedAt: now,
      });
    }
  }
}

function sourceClause(sources?: SourceFilter) {
  if (!sources || sources.length === 0) return undefined;
  return inArray(jobSnapshots.source, sources);
}

function categoryClauses(opts?: { roles?: string[]; domains?: string[] }) {
  const out = [];
  if (opts?.roles?.length) out.push(inArray(jobSnapshots.roleFamily, opts.roles));
  if (opts?.domains?.length) out.push(inArray(jobSnapshots.domain, opts.domains));
  return out;
}

export type TrendRow = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  newCount: number;
};

export type SeriesPoint = { period: string; key: string; count: number };

type JobRow = {
  source: string;
  companyName: string;
  roleFamily: string;
  domain: string;
  firstSeen: string;
  postedAt: string | null;
  isActive: boolean;
};

function ageDate(job: JobRow): Date {
  // Prefer employer publish date so QoQ/MoM aren't stuck at scrape-day baseline
  const raw = job.postedAt || job.firstSeen;
  return new Date(raw);
}

function dimValue(
  job: JobRow,
  dimension: "roleFamily" | "domain" | "companyName"
): string {
  return (job[dimension] as string) || "unknown";
}

/** Compare current vs prior period using posted_at (fallback first_seen) */
function compareFromJobs(
  jobs: JobRow[],
  periodType: "week" | "month" | "quarter",
  dimension: "roleFamily" | "domain" | "companyName"
): { periodKey: string; previousKey: string; rows: TrendRow[]; usedFallback: true } {
  const now = new Date();
  const periodKey = periodKeyFor(periodType, now);
  const previousKey = previousPeriodKey(periodType, periodKey)!;
  const start = periodStart(periodType, now).getTime();

  const currentMap = new Map<string, { active: number; neu: number }>();
  const previousMap = new Map<string, { active: number; neu: number }>();

  for (const job of jobs) {
    if (!job.isActive) continue;
    const k = dimValue(job, dimension);
    const first = ageDate(job).getTime();
    const cur = currentMap.get(k) ?? { active: 0, neu: 0 };
    cur.active += 1;
    if (first >= start) cur.neu += 1;
    currentMap.set(k, cur);

    // Still-open roles published before this period ≈ prior stock
    if (first < start) {
      const prev = previousMap.get(k) ?? { active: 0, neu: 0 };
      prev.active += 1;
      previousMap.set(k, prev);
    }
  }

  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);
  const rows: TrendRow[] = [...keys]
    .map((key) => {
      const current = currentMap.get(key)?.active ?? 0;
      const previous = previousMap.get(key)?.active ?? 0;
      return {
        key,
        label: formatLabel(key),
        current,
        previous,
        delta: current - previous,
        pct: pctChange(current, previous),
        newCount: currentMap.get(key)?.neu ?? 0,
      };
    })
    .sort((a, b) => b.delta - a.delta || b.current - a.current);

  return { periodKey, previousKey, rows, usedFallback: true };
}

function seriesFromJobs(
  jobs: JobRow[],
  periodType: "week" | "month" | "quarter",
  dimension: "roleFamily" | "domain" | "companyName",
  topKeys: string[]
): SeriesPoint[] {
  const keys = recentPeriodKeys(periodType, periodType === "week" ? 8 : periodType === "month" ? 6 : 4);
  const series: SeriesPoint[] = [];

  for (const pk of keys) {
    for (const key of topKeys) {
      let count = 0;
      for (const job of jobs) {
        if (!job.isActive) continue;
        if (dimValue(job, dimension) !== key) continue;
        const jobPeriod = periodKeyFor(periodType, ageDate(job));
        if (keys.indexOf(jobPeriod) !== -1 && keys.indexOf(jobPeriod) <= keys.indexOf(pk)) {
          count += 1;
        } else if (keys.indexOf(jobPeriod) === -1) {
          count += 1;
        }
      }
      series.push({ period: pk, key, count });
    }
  }
  return series;
}

async function loadFilteredJobs(opts: {
  sources?: string[];
  roles?: string[];
  domains?: string[];
}): Promise<JobRow[]> {
  const clauses = [eq(jobPostings.isActive, true)];
  if (opts.sources?.length) clauses.push(inArray(jobPostings.source, opts.sources));
  if (opts.roles?.length) clauses.push(inArray(jobPostings.roleFamily, opts.roles));
  if (opts.domains?.length) clauses.push(inArray(jobPostings.domain, opts.domains));

  return db
    .select({
      source: jobPostings.source,
      companyName: jobPostings.companyName,
      roleFamily: jobPostings.roleFamily,
      domain: jobPostings.domain,
      firstSeen: jobPostings.firstSeen,
      postedAt: jobPostings.postedAt,
      isActive: jobPostings.isActive,
    })
    .from(jobPostings)
    .where(and(...clauses));
}

async function aggregateFromSnapshots(
  periodType: "week" | "month" | "quarter",
  dimension: "roleFamily" | "domain" | "companyName",
  sources?: SourceFilter,
  categories?: { roles?: string[]; domains?: string[] }
): Promise<{
  periodKey: string;
  previousKey: string | null;
  rows: TrendRow[];
  series: SeriesPoint[];
  hasPreviousSnapshot: boolean;
} | null> {
  const currentKey = periodKeyFor(periodType);
  const prevKey = previousPeriodKey(periodType, currentKey);

  const clauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, currentKey)];
  const src = sourceClause(sources);
  if (src) clauses.push(src);
  clauses.push(...categoryClauses(categories));

  const currentRows = await db.select().from(jobSnapshots).where(and(...clauses));
  if (!currentRows.length) return null;

  let previousRows: typeof currentRows = [];
  let hasPreviousSnapshot = false;
  if (prevKey) {
    const pClauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, prevKey)];
    if (src) pClauses.push(src);
    pClauses.push(...categoryClauses(categories));
    previousRows = await db.select().from(jobSnapshots).where(and(...pClauses));
    hasPreviousSnapshot = previousRows.length > 0;
  }

  if (!hasPreviousSnapshot) return null;

  const sumBy = (rows: typeof currentRows) => {
    const map = new Map<string, { active: number; neu: number }>();
    for (const r of rows) {
      const k = (r[dimension] as string) || "unknown";
      const cur = map.get(k) ?? { active: 0, neu: 0 };
      cur.active += r.activeCount;
      cur.neu += r.newCount;
      map.set(k, cur);
    }
    return map;
  };

  const curMap = sumBy(currentRows);
  const prevMap = sumBy(previousRows);
  const keys = new Set([...curMap.keys(), ...prevMap.keys()]);

  const rows: TrendRow[] = [...keys]
    .map((key) => {
      const current = curMap.get(key)?.active ?? 0;
      const previous = prevMap.get(key)?.active ?? 0;
      return {
        key,
        label: formatLabel(key),
        current,
        previous,
        delta: current - previous,
        pct: pctChange(current, previous),
        newCount: curMap.get(key)?.neu ?? 0,
      };
    })
    .sort((a, b) => b.delta - a.delta || b.current - a.current);

  const allPeriodRows = await db
    .select({ periodKey: jobSnapshots.periodKey })
    .from(jobSnapshots)
    .where(eq(jobSnapshots.periodType, periodType))
    .groupBy(jobSnapshots.periodKey)
    .orderBy(jobSnapshots.periodKey);

  const allPeriods = allPeriodRows.map((r) => r.periodKey).slice(-8);
  const series: SeriesPoint[] = [];
  for (const pk of allPeriods) {
    const sClauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, pk)];
    if (src) sClauses.push(src);
    sClauses.push(...categoryClauses(categories));
    const sRows = await db.select().from(jobSnapshots).where(and(...sClauses));
    const m = sumBy(sRows);
    for (const [key, v] of m) {
      series.push({ period: pk, key, count: v.active });
    }
  }

  return {
    periodKey: currentKey,
    previousKey: prevKey,
    rows,
    series,
    hasPreviousSnapshot: true,
  };
}

async function aggregateDimension(
  periodType: "week" | "month" | "quarter",
  dimension: "roleFamily" | "domain" | "companyName",
  jobs: JobRow[],
  sources?: SourceFilter,
  categories?: { roles?: string[]; domains?: string[] }
) {
  const fromSnaps = await aggregateFromSnapshots(periodType, dimension, sources, categories);
  if (fromSnaps) {
    return {
      periodKey: fromSnaps.periodKey,
      previousKey: fromSnaps.previousKey,
      rows: fromSnaps.rows,
      series: fromSnaps.series,
      comparisonMode: "snapshot" as const,
    };
  }

  const fallback = compareFromJobs(jobs, periodType, dimension);
  const topKeys = fallback.rows.filter((r) => r.key !== "other").slice(0, 6).map((r) => r.key);
  const series = seriesFromJobs(jobs, periodType, dimension, topKeys);

  return {
    periodKey: fallback.periodKey,
    previousKey: fallback.previousKey,
    rows: fallback.rows,
    series,
    comparisonMode: "first_seen" as const,
  };
}

export async function getTrends(opts: {
  periodType?: "week" | "month" | "quarter";
  sources?: SourceFilter;
  roles?: string[];
  domains?: string[];
}) {
  const periodType = opts.periodType ?? "month";
  const sources = opts.sources;
  const categories = { roles: opts.roles, domains: opts.domains };

  const jobs = await loadFilteredJobs({
    sources,
    roles: opts.roles,
    domains: opts.domains,
  });

  const roles = await aggregateDimension(periodType, "roleFamily", jobs, sources, categories);
  const domains = await aggregateDimension(periodType, "domain", jobs, sources, categories);
  const companiesAgg = await aggregateDimension(
    periodType,
    "companyName",
    jobs,
    sources,
    categories
  );

  const companiesRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(companies)
    .where(eq(companies.enabled, true));

  const sourceRows = await db
    .select({ source: jobPostings.source })
    .from(jobPostings)
    .where(eq(jobPostings.isActive, true))
    .groupBy(jobPostings.source);

  const mode = roles.comparisonMode;
  const interimNote =
    mode === "first_seen"
      ? `${periodType === "week" ? "WoW" : periodType === "month" ? "MoM" : "QoQ"} compares live open roles using each posting’s publish date (not a full historical archive). Prior = still-open jobs posted before this ${periodType}.`
      : null;

  return {
    requestedPeriodType: periodType,
    effectivePeriodType: periodType,
    comparisonMode: mode,
    interimNote,
    roles,
    domains,
    companies: companiesAgg,
    totals: {
      activeJobs: jobs.length,
      companies: Number(companiesRow[0]?.c ?? 0),
      sources: sourceRows.map((r) => r.source),
    },
  };
}

export async function listActiveJobs(opts: {
  sources?: string[];
  roleFamily?: string;
  domain?: string;
  limit?: number;
  requireUrl?: boolean;
}) {
  const clauses = [eq(jobPostings.isActive, true)];
  if (opts.sources?.length) clauses.push(inArray(jobPostings.source, opts.sources));
  if (opts.roleFamily) clauses.push(eq(jobPostings.roleFamily, opts.roleFamily));
  if (opts.domain) clauses.push(eq(jobPostings.domain, opts.domain));
  if (opts.requireUrl) {
    clauses.push(isNotNull(jobPostings.url));
    clauses.push(ne(jobPostings.url, ""));
  }

  return db
    .select()
    .from(jobPostings)
    .where(and(...clauses))
    .orderBy(desc(jobPostings.lastSeen))
    .limit(opts.limit ?? 20);
}
