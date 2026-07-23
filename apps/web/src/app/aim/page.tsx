"use client";

import { useCallback, useEffect, useState } from "react";
import { SourceFilter } from "@/components/SourceFilter";

type Resume = {
  id: number;
  fileName: string | null;
  skills: string[];
  titles: string[];
  domains: string[];
  seniority: string | null;
  yearsExperience: number | null;
  createdAt: string;
  preview: string;
};

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

function RecCard({
  rec,
  rank,
  expanded,
  onToggle,
}: {
  rec: Rec;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`flex flex-col rounded-xl border bg-[var(--bg-elevated)]/80 transition ${
        expanded
          ? "border-[var(--accent-dim)] sm:col-span-2 lg:col-span-3"
          : "border-[var(--border)] hover:border-[var(--accent-dim)]/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col items-start gap-3 p-4 text-left"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <span className="text-xs text-[var(--muted)]">#{rank}</span>
          <span className="text-xs text-[var(--muted)]">{expanded ? "Collapse" : "Expand"}</span>
        </div>
        <h3
          className="text-lg leading-snug"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          {rec.label}
        </h3>
        {rec.domain && (
          <p className="text-xs text-[var(--muted)]">{rec.domain.replace(/_/g, " ")}</p>
        )}
        <div className="mt-auto grid w-full grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-[var(--bg-soft)] px-2 py-2">
            <div className="text-[var(--muted)]">Fit</div>
            <div className="text-base tabular-nums text-[var(--chart-2)]">
              {(rec.fitScore * 100).toFixed(0)}
            </div>
          </div>
          <div className="rounded-md bg-[var(--bg-soft)] px-2 py-2">
            <div className="text-[var(--muted)]">Trend</div>
            <div className="text-base tabular-nums text-[var(--chart-1)]">
              {(rec.trendScore * 100).toFixed(0)}
            </div>
          </div>
          <div className="rounded-md bg-[var(--bg-soft)] px-2 py-2">
            <div className="text-[var(--muted)]">Score</div>
            <div className="text-base font-semibold tabular-nums">
              {(rec.combinedScore * 100).toFixed(0)}
            </div>
          </div>
        </div>
        {!expanded && (
          <p className="text-xs text-[var(--muted)]">
            {rec.examples.length
              ? `${rec.examples.length} open role${rec.examples.length === 1 ? "" : "s"}`
              : "No linked openings"}{" "}
            · click for details
          </p>
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[var(--border)] px-4 pb-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">Why you fit</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {rec.whyFit.map((w) => (
                  <li key={w} className="text-[var(--text)]">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">Why it’s hot</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {rec.whyHot.map((w) => (
                  <li key={w} className="text-[var(--text)]">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {rec.examples.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">Open roles</h4>
                <button
                  type="button"
                  className="text-xs text-[var(--chart-2)] underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    const links = rec.examples
                      .filter((ex) => ex.url)
                      .map((ex) => `${ex.title} @ ${ex.company}\n${ex.url}`)
                      .join("\n\n");
                    void navigator.clipboard.writeText(links);
                  }}
                >
                  Copy links
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {rec.examples.map((ex) => (
                  <li
                    key={`${ex.company}-${ex.title}-${ex.url}`}
                    className="rounded-lg border border-[var(--border)]/70 bg-[var(--bg)]/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {ex.url ? (
                          <a
                            href={ex.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-[var(--chart-2)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ex.title}
                          </a>
                        ) : (
                          <span className="text-sm font-medium">{ex.title}</span>
                        )}
                        <div className="mt-0.5 text-xs text-[var(--muted)]">
                          {ex.company}
                          {ex.location ? ` · ${ex.location}` : ""}
                        </div>
                      </div>
                      {ex.url && (
                        <a
                          href={ex.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function AimPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [meta, setMeta] = useState<{ periodType?: string; interimNote?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadResumes = async () => {
    const res = await fetch("/api/resume");
    const json = await res.json();
    setResumes(json.resumes);
    return json.resumes as Resume[];
  };

  const loadRecs = useCallback(async () => {
    setLoadingRecs(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (sources.length) qs.set("sources", sources.join(","));
      const res = await fetch(`/api/aim?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setRecs(json.recommendations);
      setMeta({ periodType: json.periodType, interimNote: json.interimNote });
      setExpandedId(null);
    } catch (e) {
      setError((e as Error).message);
      setRecs([]);
    } finally {
      setLoadingRecs(false);
    }
  }, [sources]);

  useEffect(() => {
    loadResumes().then((list) => {
      if (list?.length) loadRecs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resumes.length) loadRecs();
  }, [sources, loadRecs, resumes.length]);

  const afterSave = async (msg: string) => {
    setStatus(msg);
    await loadResumes();
    await loadRecs();
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setStatus("Parsing…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await afterSave(`Saved · ${json.parsed.skills.length} skills found`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitText = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileName: "pasted.txt" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setText("");
      await afterSave("Saved · scoring recommendations");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const latest = resumes[0];

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          Aim
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Drop your resume → pick a target card to expand fit reasons and live job links.
        </p>
      </div>

      {!latest ? (
        <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center hover:border-[var(--accent-dim)]">
            <span className="text-sm text-[var(--muted)]">Upload PDF or .txt</span>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </label>
          <form onSubmit={submitText}>
            <textarea
              className="min-h-28 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              placeholder="Or paste resume text…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="mt-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04140f] disabled:opacity-50"
            >
              Score resume
            </button>
          </form>
          {status && <p className="text-sm text-[var(--muted)]">{status}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Resume loaded</div>
            <div className="text-xs text-[var(--muted)]">
              {latest.skills.slice(0, 6).join(" · ") || "No skills detected"}
              {latest.skills.length > 6 ? "…" : ""}
            </div>
          </div>
          <label className="cursor-pointer text-sm text-[var(--chart-2)] underline">
            Replace
            <input
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </label>
        </div>
      )}

      {latest && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
            >
              Recommended targets
            </h2>
            <SourceFilter selected={sources} onChange={setSources} />
          </div>
          {meta.interimNote && <p className="text-xs text-[var(--muted)]">{meta.interimNote}</p>}
          {loadingRecs && <p className="text-[var(--muted)]">Scoring…</p>}
          {error && (
            <div className="rounded-xl border border-[var(--down)]/40 bg-[var(--down)]/10 p-4 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recs.map((r, i) => (
              <RecCard
                key={r.roleFamily}
                rec={r}
                rank={i + 1}
                expanded={expandedId === r.roleFamily}
                onToggle={() =>
                  setExpandedId((cur) => (cur === r.roleFamily ? null : r.roleFamily))
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
