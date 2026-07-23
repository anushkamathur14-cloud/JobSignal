"use client";

const ALL_SOURCES = [
  { id: "greenhouse", label: "Greenhouse" },
  { id: "lever", label: "Lever" },
  { id: "ashby", label: "Ashby" },
  { id: "workday", label: "Workday" },
  { id: "jsearch", label: "JSearch" },
];

export function SourceFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Sources</span>
      {ALL_SOURCES.map((s) => {
        const on = selected.length === 0 || selected.includes(s.id);
        const explicit = selected.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`rounded-md border px-2.5 py-1 text-sm transition ${
              explicit || selected.length === 0
                ? "border-[var(--accent-dim)] bg-[var(--accent-dim)]/30 text-[var(--text)]"
                : "border-[var(--border)] text-[var(--muted)] opacity-50"
            }`}
            title={on ? "Included" : "Excluded"}
          >
            {s.label}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          className="text-xs text-[var(--muted)] underline"
          onClick={() => onChange([])}
        >
          Clear (all)
        </button>
      )}
    </div>
  );
}

export { ALL_SOURCES };
