"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendRow = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  newCount: number;
};

export function TrendTable({
  title,
  rows,
  periodLabel,
}: {
  title: string;
  rows: TrendRow[];
  periodLabel: string;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2
          className="text-lg text-[var(--text)]"
          style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
        >
          {title}
        </h2>
        <span className="text-xs text-[var(--muted)]">{periodLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="pb-2 pr-2 font-medium">Name</th>
              <th className="pb-2 pr-2 font-medium">Now</th>
              <th className="pb-2 pr-2 font-medium">Prev</th>
              <th className="pb-2 pr-2 font-medium">Δ</th>
              <th className="pb-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r) => (
              <tr key={r.key} className="border-t border-[var(--border)]/70">
                <td className="py-2 pr-2">{r.label}</td>
                <td className="py-2 pr-2 tabular-nums">{r.current}</td>
                <td className="py-2 pr-2 tabular-nums text-[var(--muted)]">{r.previous}</td>
                <td
                  className={`py-2 pr-2 tabular-nums ${
                    r.delta > 0 ? "text-[var(--up)]" : r.delta < 0 ? "text-[var(--down)]" : ""
                  }`}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </td>
                <td
                  className={`py-2 tabular-nums ${
                    (r.pct ?? 0) > 0 ? "text-[var(--up)]" : (r.pct ?? 0) < 0 ? "text-[var(--down)]" : ""
                  }`}
                >
                  {r.pct == null ? "—" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(0)}%`}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--muted)]">
                  No data yet — run an ingest.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RisingChart({ rows }: { rows: TrendRow[] }) {
  const data = rows
    .filter((r) => r.delta !== 0 || r.current > 0)
    .slice(0, 8)
    .map((r) => ({
      name: r.label.length > 16 ? r.label.slice(0, 14) + "…" : r.label,
      delta: r.delta,
      current: r.current,
    }));

  if (!data.length) return null;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4">
      <h2
        className="mb-4 text-lg"
        style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
      >
        Rising / falling
      </h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "var(--bg-soft)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="delta" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
