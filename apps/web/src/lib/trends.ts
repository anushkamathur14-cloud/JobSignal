import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { jobPostings, jobSnapshots, companies } from "@job-signal/db";
import { db } from "./db";
import {
  dayKey,
  weekKey,
  monthKey,
  quarterKey,
  previousPeriodKey,
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

export type TrendRow = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  newCount: number;
};

async function aggregateDimension(
  periodType: "week" | "month" | "quarter",
  dimension: "roleFamily" | "domain" | "companyName",
  sources?: SourceFilter
): Promise<{
  periodKey: string;
  previousKey: string | null;
  rows: TrendRow[];
  series: { period: string; key: string; count: number }[];
}> {
  const currentKey =
    periodType === "week" ? weekKey() : periodType === "month" ? monthKey() : quarterKey();
  const prevKey = previousPeriodKey(periodType, currentKey);

  const clauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, currentKey)];
  const src = sourceClause(sources);
  if (src) clauses.push(src);

  const currentRows = await db
    .select()
    .from(jobSnapshots)
    .where(and(...clauses));

  let previousRows: typeof currentRows = [];
  if (prevKey) {
    const pClauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, prevKey)];
    if (src) pClauses.push(src);
    previousRows = await db
      .select()
      .from(jobSnapshots)
      .where(and(...pClauses));
  }

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

  const series: { period: string; key: string; count: number }[] = [];
  for (const pk of allPeriods) {
    const sClauses = [eq(jobSnapshots.periodType, periodType), eq(jobSnapshots.periodKey, pk)];
    if (src) sClauses.push(src);
    const sRows = await db
      .select()
      .from(jobSnapshots)
      .where(and(...sClauses));
    const m = sumBy(sRows);
    for (const [key, v] of m) {
      series.push({ period: pk, key, count: v.active });
    }
  }

  return { periodKey: currentKey, previousKey: prevKey, rows, series };
}

export async function getTrends(opts: {
  periodType?: "week" | "month" | "quarter";
  sources?: SourceFilter;
}) {
  const periodType = opts.periodType ?? "month";
  const sources = opts.sources;

  const monthCountRow = await db
    .select({ c: sql<number>`count(distinct ${jobSnapshots.periodKey})` })
    .from(jobSnapshots)
    .where(eq(jobSnapshots.periodType, "month"));
  const monthCount = Number(monthCountRow[0]?.c ?? 0);

  let effectiveType: "week" | "month" | "quarter" = periodType;
  if (periodType === "month" && monthCount < 2) {
    const weekCountRow = await db
      .select({ c: sql<number>`count(distinct ${jobSnapshots.periodKey})` })
      .from(jobSnapshots)
      .where(eq(jobSnapshots.periodType, "week"));
    if (Number(weekCountRow[0]?.c ?? 0) >= 1) effectiveType = "week";
  }

  const jobClauses = [eq(jobPostings.isActive, true)];
  if (sources?.length) jobClauses.push(inArray(jobPostings.source, sources));

  const activeJobsRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(jobPostings)
    .where(and(...jobClauses));

  const companiesRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(companies)
    .where(eq(companies.enabled, true));

  const sourceRows = await db
    .select({ source: jobPostings.source })
    .from(jobPostings)
    .where(eq(jobPostings.isActive, true))
    .groupBy(jobPostings.source);

  return {
    requestedPeriodType: periodType,
    effectivePeriodType: effectiveType,
    interimNote:
      periodType === "month" && effectiveType === "week"
        ? "Showing week-over-week until two months of snapshots exist."
        : null,
    roles: await aggregateDimension(effectiveType, "roleFamily", sources),
    domains: await aggregateDimension(effectiveType, "domain", sources),
    companies: await aggregateDimension(effectiveType, "companyName", sources),
    totals: {
      activeJobs: Number(activeJobsRow[0]?.c ?? 0),
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
}) {
  const clauses = [eq(jobPostings.isActive, true)];
  if (opts.sources?.length) clauses.push(inArray(jobPostings.source, opts.sources));
  if (opts.roleFamily) clauses.push(eq(jobPostings.roleFamily, opts.roleFamily));
  if (opts.domain) clauses.push(eq(jobPostings.domain, opts.domain));

  return db
    .select()
    .from(jobPostings)
    .where(and(...clauses))
    .orderBy(desc(jobPostings.lastSeen))
    .limit(opts.limit ?? 20);
}
