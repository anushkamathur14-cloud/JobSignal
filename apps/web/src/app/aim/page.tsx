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
      await afterSave(`Saved profile #${json.id} · ${json.parsed.skills.length} skills detected`);
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
      await afterSave(`Saved profile #${json.id}`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const latest = resumes[0];

  return (
    <div className="space-y-10">
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          Aim
        </h1>
        <p className="mt-1 max-w-2xl text-[var(--muted)]">
          Upload your resume, then see ranked targets scored by fit × hiring trend — with why each
          profile works.
        </p>
      </div>

      <section className="space-y-4">
        <h2
          className="text-xl"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          Your resume
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/60 px-6 py-10 text-center transition hover:border-[var(--accent-dim)]">
            <span className="text-sm text-[var(--muted)]">Drop PDF / .txt or click to browse</span>
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

          <form
            onSubmit={submitText}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4"
          >
            <textarea
              className="min-h-40 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              placeholder="Or paste resume text…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="mt-3 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04140f] disabled:opacity-50"
            >
              Save & score
            </button>
          </form>
        </div>
        {status && <p className="text-sm text-[var(--muted)]">{status}</p>}

        {latest && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-5">
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)]">
              Profile #{latest.id}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {latest.fileName || "untitled"} · {new Date(latest.createdAt).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {latest.skills.map((s) => (
                <span key={s} className="rounded bg-[var(--bg-soft)] px-2 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {[latest.seniority, latest.domains.join(", "), latest.titles.slice(0, 3).join(" · ")]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2
            className="text-xl"
            style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
          >
            What to aim for
          </h2>
          <SourceFilter selected={sources} onChange={setSources} />
        </div>
        {meta.interimNote && <p className="text-sm text-[var(--warn)]">{meta.interimNote}</p>}
        {loadingRecs && <p className="text-[var(--muted)]">Scoring…</p>}
        {error && (
          <div className="rounded-xl border border-[var(--down)]/40 bg-[var(--down)]/10 p-4 text-sm">
            {error}
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
                  <h3
                    className="text-xl"
                    style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
                  >
                    {r.label}
                  </h3>
                  {r.domain && (
                    <p className="text-sm text-[var(--muted)]">
                      Domain lean: {r.domain.replace(/_/g, " ")}
                    </p>
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
                  <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">Why you fit</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    {r.whyFit.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    Why it&apos;s hot ({meta.periodType ?? "period"})
                  </h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    {r.whyHot.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {r.examples.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    Example openings
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    {r.examples.map((ex) => (
                      <li key={`${ex.company}-${ex.title}`}>
                        {ex.url ? (
                          <a
                            href={ex.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--chart-2)] underline-offset-2 hover:underline"
                          >
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
      </section>
    </div>
  );
}
