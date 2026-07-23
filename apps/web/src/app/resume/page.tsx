"use client";

import { useEffect, useState } from "react";

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

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/resume");
    const json = await res.json();
    setResumes(json.resumes);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadFile = async (file: File) => {
    setBusy(true);
    setStatus("Parsing…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setStatus(`Saved profile #${json.id} · ${json.parsed.skills.length} skills detected`);
      await load();
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
      setStatus(`Saved profile #${json.id}`);
      setText("");
      await load();
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
          Resume profile
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Upload a PDF or paste text. We extract skills and titles for Aim recommendations.
        </p>
      </div>

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

        <form onSubmit={submitText} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4">
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
            Save text
          </button>
        </form>
      </div>

      {status && <p className="text-sm text-[var(--muted)]">{status}</p>}

      {latest && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-5">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
          >
            Latest profile #{latest.id}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {latest.fileName || "untitled"} · {new Date(latest.createdAt).toLocaleString()}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Skills</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {latest.skills.map((s) => (
                  <span key={s} className="rounded bg-[var(--bg-soft)] px-2 py-0.5 text-xs">
                    {s}
                  </span>
                ))}
                {!latest.skills.length && <span className="text-sm text-[var(--muted)]">None detected</span>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Titles / domains</div>
              <p className="mt-2 text-sm">{latest.titles.join(" · ") || "—"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {[latest.seniority, latest.domains.join(", "), latest.yearsExperience != null ? `${latest.yearsExperience}y` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          </div>
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
            {latest.preview}
          </pre>
        </section>
      )}
    </div>
  );
}
