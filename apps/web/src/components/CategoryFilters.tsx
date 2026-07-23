"use client";

import { formatLabel } from "@/lib/classify";

export function ChipFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
      {options.map((s) => {
        const explicit = selected.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`rounded-md border px-2.5 py-1 text-sm transition ${
              explicit || selected.length === 0
                ? "border-[var(--accent-dim)] bg-[var(--accent-dim)]/30 text-[var(--text)]"
                : "border-[var(--border)] text-[var(--muted)] opacity-40"
            }`}
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

export function CategoryFilters({
  roles,
  domains,
  onRolesChange,
  onDomainsChange,
}: {
  roles: string[];
  domains: string[];
  onRolesChange: (next: string[]) => void;
  onDomainsChange: (next: string[]) => void;
}) {
  const roleOptions = [
    "software_engineering",
    "machine_learning",
    "data_science",
    "data_engineering",
    "product_management",
    "program_management",
    "design",
    "devops_sre",
    "security",
    "qa_test",
    "sales",
    "marketing",
    "customer_success",
    "support",
    "finance",
    "people_hr",
    "operations",
    "legal",
    "research",
    "technical_writing",
    "executive",
    "other",
  ].map((id) => ({ id, label: formatLabel(id) }));

  const domainOptions = [
    "ai_ml",
    "fintech",
    "healthcare",
    "infrastructure",
    "observability",
    "enterprise",
    "consumer",
    "marketplace",
    "media",
    "defense",
    "retail",
    "productivity",
    "design_tools",
    "creative_tools",
    "climate",
    "other",
  ].map((id) => ({ id, label: formatLabel(id) }));

  return (
    <div className="space-y-3">
      <ChipFilter label="Roles" options={roleOptions} selected={roles} onChange={onRolesChange} />
      <ChipFilter
        label="Domains"
        options={domainOptions}
        selected={domains}
        onChange={onDomainsChange}
      />
    </div>
  );
}
