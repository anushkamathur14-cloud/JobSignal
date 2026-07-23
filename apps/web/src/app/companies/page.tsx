"use client";

import { useEffect, useState } from "react";

type Company = {
  id: number;
  name: string;
  atsType: string;
  boardSlug: string | null;
  boardUrl: string | null;
  domainHint: string | null;
  enabled: boolean;
};

const ATS = ["greenhouse", "lever", "ashby", "workday", "other"];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    name: "",
    atsType: "greenhouse",
    boardSlug: "",
    boardUrl: "",
    domainHint: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/companies");
    const json = await res.json();
    setCompanies(json.companies);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        atsType: form.atsType,
        boardSlug: form.boardSlug || null,
        boardUrl: form.boardUrl || null,
        domainHint: form.domainHint || null,
      }),
    });
    if (!res.ok) {
      setMsg(await res.text());
      return;
    }
    setForm({ name: "", atsType: "greenhouse", boardSlug: "", boardUrl: "", domainHint: "" });
    setMsg("Added to watchlist");
    await load();
  };

  const toggle = async (c: Company) => {
    await fetch("/api/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id,
        name: c.name,
        atsType: c.atsType,
        boardSlug: c.boardSlug,
        boardUrl: c.boardUrl,
        domainHint: c.domainHint,
        enabled: !c.enabled,
      }),
    });
    await load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/companies?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          Company watchlist
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          ATS boards you track. Disable or add boards as you like — ingest respects this list.
        </p>
      </div>

      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4 sm:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Name</span>
          <input
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">ATS</span>
          <select
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={form.atsType}
            onChange={(e) => setForm({ ...form, atsType: e.target.value })}
          >
            {ATS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Board slug</span>
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            placeholder="e.g. stripe"
            value={form.boardSlug}
            onChange={(e) => setForm({ ...form, boardSlug: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Board URL (Workday CXS)</span>
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={form.boardUrl}
            onChange={(e) => setForm({ ...form, boardUrl: e.target.value })}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Domain hint</span>
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            placeholder="ai_ml, fintech, …"
            value={form.domainHint}
            onChange={(e) => setForm({ ...form, domainHint: e.target.value })}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04140f]"
          >
            Add company
          </button>
          {msg && <span className="ml-3 text-sm text-[var(--muted)]">{msg}</span>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">ATS</th>
              <th className="px-4 py-3">Slug / URL</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-[var(--muted)]">{c.atsType}</td>
                <td className="max-w-xs truncate px-4 py-2 text-[var(--muted)]">
                  {c.boardSlug || c.boardUrl || "—"}
                </td>
                <td className="px-4 py-2 text-[var(--muted)]">{c.domainHint || "—"}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      c.enabled ? "bg-[var(--accent-dim)]/40 text-[var(--up)]" : "bg-[var(--bg)] text-[var(--muted)]"
                    }`}
                  >
                    {c.enabled ? "on" : "off"}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-xs text-[var(--down)]"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
