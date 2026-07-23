"use client";

import { useCallback, useEffect, useState } from "react";
import { MY_INTEREST_ROLES } from "@/lib/classify";
import { SourceFilter } from "@/components/SourceFilter";
import { CategoryFilters } from "@/components/CategoryFilters";
import {
  RoleBarChart,
  TrendLineChart,
  TrendTable,
  type SeriesPoint,
  type TrendRow,
} from "@/components/TrendViews";

type DimBlock = {
  periodKey: string;
  previousKey: string | null;
  rows: TrendRow[];
  series: SeriesPoint[];
  comparisonMode?: string;
};

type TrendsResponse = {
  requestedPeriodType: string;
  effectivePeriodType: string;
  comparisonMode?: string;
  interimNote: string | null;
  roles: DimBlock;
  domains: DimBlock;
  companies: DimBlock;
  totals: { activeJobs: number; companies: number; sources: string[] };
};

const PERIODS = [
  { id: "week" as const, label: "Week", hint: "vs last week" },
  { id: "month" as const, label: "Month", hint: "vs last month" },
  { id: "quarter" as const, label: "Quarter", hint: "vs last quarter" },
];

export default function TrendsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [sources, setSources] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingestState, setIngestState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ period });
      if (sources.length) qs.set("sources", sources.join(","));
      if (roles.length) qs.set("roles", roles.join(","));
      if (domains.length) qs.set("domains", domains.join(","));
      const res = await fetch(`/api/trends?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, sources, roles, domains]);

  useEffect(() => {
    load();
  }, [load]);

  const runIngest = async () => {
    setIngestState("Refreshing live boards…");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: sources.length ? sources : undefined,
          includeJsearch: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIngestState(json.error || "Refresh failed");
        return;
      }
      setIngestState(
        `Updated ${json.upserted} openings` +
          (json.errors?.length ? ` · ${json.errors.length} board(s) skipped` : "")
      );
      await load();
    } catch (e) {
      setIngestState(`Refresh failed: ${(e as Error).message}`);
    }
  };

  const filterRows = (rows: TrendRow[]) => rows.filter((r) => r.key !== "other");

  const periodLabel = data
    ? `${data.roles.periodKey}` +
      (data.roles.previousKey ? ` vs ${data.roles.previousKey}` : "")
    : "";

  const roleRows = data ? filterRows(data.roles.rows) : [];
  const domainRows = data ? filterRows(data.domains.rows) : [];
  const companyRows = data?.companies.rows.filter((r) => r.key !== "other") ?? [];
  const series = data?.roles.series ?? [];
  const activeFilters = sources.length + roles.length + domains.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
          >
            Trends
          </h1>
          <p className="mt-1 max-w-lg text-[var(--muted)]">
            What’s open right now on company career boards — and how that shifted vs the prior
            period.
          </p>
        </div>
        <button
          type="button"
          onClick={runIngest}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04140f] transition hover:brightness-110"
        >
          Refresh jobs
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-wider text-[var(--muted)]">Compare</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                period === p.id
                  ? "border-[var(--accent-dim)] bg-[var(--accent-dim)]/35 text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="ml-auto rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Filters{activeFilters ? ` · ${activeFilters}` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              const on =
                roles.length === MY_INTEREST_ROLES.length &&
                MY_INTEREST_ROLES.every((r) => roles.includes(r)) &&
                domains.length === 0;
              if (on) {
                setRoles([]);
                setDomains([]);
              } else {
                setRoles([...MY_INTEREST_ROLES]);
                setDomains([]);
                setShowFilters(true);
              }
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              roles.length === MY_INTEREST_ROLES.length &&
              MY_INTEREST_ROLES.every((r) => roles.includes(r)) &&
              domains.length === 0
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            My interests
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
            <SourceFilter selected={sources} onChange={setSources} />
            <CategoryFilters
              roles={roles}
              domains={domains}
              onRolesChange={setRoles}
              onDomainsChange={setDomains}
            />
          </div>
        )}

        {data && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            {data.totals.activeJobs.toLocaleString()} live openings · comparing {periodLabel}
            {data.interimNote ? ` · ${data.interimNote}` : ""}
          </p>
        )}
        {ingestState && <p className="mt-2 text-sm text-[var(--muted)]">{ingestState}</p>}
      </div>

      {error && <p className="text-[var(--down)]">{error}</p>}
      {loading && !data && <p className="text-[var(--muted)]">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <TrendLineChart series={series} rows={roleRows} periodLabel={periodLabel} />
          <RoleBarChart rows={roleRows} />

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-sm text-[var(--muted)] underline hover:text-[var(--text)]"
          >
            {showDetails ? "Hide tables" : "Show role / domain / company tables"}
          </button>

          {showDetails && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <TrendTable title="Roles" rows={roleRows} periodLabel={periodLabel} />
                <TrendTable title="Domains" rows={domainRows} periodLabel={periodLabel} />
              </div>
              <TrendTable title="Companies" rows={companyRows} periodLabel={periodLabel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
