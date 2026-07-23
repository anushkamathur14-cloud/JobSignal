"use client";

import { useCallback, useEffect, useState } from "react";
import { SourceFilter } from "@/components/SourceFilter";

type Rec = {
  roleFamily: string;
  label: string;
  domain: string | null;
  fitScore: number;
  trendScore: number;
  combinedScore: number;
  whyFit: string[];
  whyHot: string[];
  examples: {
    title: string;
    company: string;
    source: string;
    url: string | null;
    domain: string;
    location: string | null;
  }[];
};

export default function AimPage() {
  const [sources, setSources] = useState<string[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [meta, setMeta] = useState<{ periodType?: string; interimNote?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (sources.length) qs.set("sources", sources.join(","));
      const res = await fetch(`/api/aim?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setRecs(json.recommendations);
      setMeta({ periodType: json.periodType, interimNote: json.interimNote });
    } catch (e) {
      setError((e as Error).message);
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, [sources]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          What to aim for
        </h1>
        <p className="mt-1 max-w-2xl text-[var(--muted)]">
          Ranked by fit × trend strength — why the profile works, and why the market is heating up.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-4">
        <SourceFilter selected={sources} onChange={setSources} />
        {meta.interimNote && <p className="mt-3 text-sm text-[var(--warn)]">{meta.interimNote}</p>}
      </div>

      {loading && <p className="text-[var(--muted)]">Scoring…</p>}
      {error && (
        <div className="rounded-xl border border-[var(--down)]/40 bg-[var(--down)]/10 p-4 text-sm">
          {error}{" "}
          <a href="/resume" className="underline">
            Upload a resume
          </a>
        </div>
      )}

      <div className="space-y-4">
        {recs.map((r, i) => (
          <article
            key={r.roleFamily}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--muted)]">#{i + 1}</div>
                <h2
                  className="text-xl"
                  style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
                >
                  {r.label}
                </h2>
                {r.domain && (
                  <p className="text-sm text-[var(--muted)]">Domain lean: {r.domain.replace(/_/g, " ")}</p>
                )}
              </div>
              <div className="flex gap-3 text-center text-xs">
                <div>
                  <div className="text-[var(--muted)]">Fit</div>
                  <div className="text-lg tabular-nums text-[var(--chart-2)]">
                    {(r.fitScore * 100).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Trend</div>
                  <div className="text-lg tabular-nums text-[var(--chart-1)]">
                    {(r.trendScore * 100).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Score</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {(r.combinedScore * 100).toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[var(--muted)]">Why you fit</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {r.whyFit.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Why it&apos;s hot ({meta.periodType ?? "period"})
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {r.whyHot.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {r.examples.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs uppercase tracking-wider text-[var(--muted)]">Example openings</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {r.examples.map((ex) => (
                    <li key={`${ex.company}-${ex.title}`}>
                      {ex.url ? (
                        <a href={ex.url} target="_blank" rel="noreferrer" className="text-[var(--chart-2)] underline-offset-2 hover:underline">
                          {ex.title}
                        </a>
                      ) : (
                        ex.title
                      )}
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {ex.company} · {ex.source}
                        {ex.location ? ` · ${ex.location}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
