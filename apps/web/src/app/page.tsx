"use client";

import { useCallback, useEffect, useState } from "react";
import { SourceFilter } from "@/components/SourceFilter";
import { RisingChart, TrendTable, type TrendRow } from "@/components/TrendViews";

type TrendsResponse = {
  requestedPeriodType: string;
  effectivePeriodType: string;
  interimNote: string | null;
  roles: { periodKey: string; previousKey: string | null; rows: TrendRow[] };
  domains: { periodKey: string; previousKey: string | null; rows: TrendRow[] };
  companies: { periodKey: string; previousKey: string | null; rows: TrendRow[] };
  totals: { activeJobs: number; companies: number; sources: string[] };
};

export default function TrendsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [sources, setSources] = useState<string[]>([]);
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
      const res = await fetch(`/api/trends?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, sources]);

  useEffect(() => {
    load();
  }, [load]);

  const runIngest = async () => {
    setIngestState("Polling ATS boards…");
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
      setIngestState(
        `Upserted ${json.upserted} jobs` +
          (json.errors?.length ? ` · ${json.errors.length} source error(s)` : "")
      );
      await load();
    } catch (e) {
      setIngestState(`Ingest failed: ${(e as Error).message}`);
    }
  };

  const periodLabel = data
    ? `${data.effectivePeriodType} ${data.roles.periodKey}` +
      (data.roles.previousKey ? ` vs ${data.roles.previousKey}` : " (first snapshot)")
    : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
          >
            Hiring trends
          </h1>
          <p className="mt-1 max-w-xl text-[var(--muted)]">
            MoM / QoQ (or WoW until history builds) across your watchlist — filter by ATS board anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={runIngest}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04140f] transition hover:brightness-110"
        >
          Run ingest now
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-4">
        <SourceFilter selected={sources} onChange={setSources} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Period</span>
          {(["week", "month", "quarter"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md border px-2.5 py-1 text-sm capitalize ${
                period === p
                  ? "border-[var(--accent-dim)] bg-[var(--accent-dim)]/30"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {p === "week" ? "WoW" : p === "month" ? "MoM" : "QoQ"}
            </button>
          ))}
        </div>
        {ingestState && <p className="text-sm text-[var(--muted)]">{ingestState}</p>}
        {data?.interimNote && (
          <p className="text-sm text-[var(--warn)]">{data.interimNote}</p>
        )}
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active jobs", value: data.totals.activeJobs },
            { label: "Watchlist cos.", value: data.totals.companies },
            { label: "Live sources", value: data.totals.sources.join(", ") || "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3"
            >
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{s.label}</div>
              <div className="mt-1 text-xl tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[var(--down)]">{error}</p>}
      {loading && !data && <p className="text-[var(--muted)]">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <RisingChart rows={data.roles.rows} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendTable title="Role families" rows={data.roles.rows} periodLabel={periodLabel} />
            <TrendTable title="Domains" rows={data.domains.rows} periodLabel={periodLabel} />
          </div>
          <TrendTable title="Companies hiring" rows={data.companies.rows} periodLabel={periodLabel} />
        </div>
      )}
    </div>
  );
}
