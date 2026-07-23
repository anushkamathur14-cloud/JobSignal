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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          Aim
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Drop your resume → get roles that fit you and are hiring, with real job links.
        </p>
      </div>

      {!latest ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-5">
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

          <div className="space-y-3">
            {recs.slice(0, 5).map((r, i) => (
              <article
                key={r.roleFamily}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[var(--muted)]">#{i + 1}</div>
                    <h3
                      className="text-lg"
                      style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
                    >
                      {r.label}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">
                      Fit {(r.fitScore * 100).toFixed(0)} · Trend {(r.trendScore * 100).toFixed(0)} ·
                      Score {(r.combinedScore * 100).toFixed(0)}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                  {r.whyFit.slice(0, 2).map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                  {r.whyHot.slice(0, 1).map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
                {r.examples.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-[var(--border)]/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                        Open roles
                      </span>
                      <button
                        type="button"
                        className="text-xs text-[var(--chart-2)] underline"
                        onClick={() => {
                          const links = r.examples
                            .filter((ex) => ex.url)
                            .map((ex) => `${ex.title} @ ${ex.company}\n${ex.url}`)
                            .join("\n\n");
                          void navigator.clipboard.writeText(links);
                        }}
                      >
                        Copy links
                      </button>
                    </div>
                    {r.examples.slice(0, 5).map((ex) => (
                      <div
                        key={`${ex.company}-${ex.title}-${ex.url}`}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div>
                          {ex.url ? (
                            <a
                              href={ex.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--chart-2)] hover:underline"
                            >
                              {ex.title}
                            </a>
                          ) : (
                            ex.title
                          )}
                          <div className="text-xs text-[var(--muted)]">
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
                          >
                            Open ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
