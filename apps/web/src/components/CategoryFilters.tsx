"use client";

import {
  formatLabel,
  MY_INTEREST_ROLES,
} from "@/lib/classify";

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

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
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
  const interestActive =
    sameSet(roles, [...MY_INTEREST_ROLES]) && domains.length === 0;

  const applyInterests = () => {
    onRolesChange([...MY_INTEREST_ROLES]);
    onDomainsChange([]);
  };

  const clearInterests = () => {
    onRolesChange([]);
    onDomainsChange([]);
  };

  const roleOptions = [
    "business_strategy",
    "sales",
    "customer_success",
    "product_management",
    "product_marketing",
    "marketing",
    "machine_learning",
    "software_engineering",
    "data_science",
    "data_engineering",
    "program_management",
    "design",
    "devops_sre",
    "security",
    "qa_test",
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

  const interestOptions = MY_INTEREST_ROLES.map((id) => ({
    id,
    label: formatLabel(id),
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Job filters
        </span>
        <button
          type="button"
          onClick={() => (interestActive ? clearInterests() : applyInterests())}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
            interestActive
              ? "border-[var(--accent)] bg-[var(--accent)] text-[#04140f]"
              : "border-[var(--accent-dim)] bg-[var(--accent)]/15 text-[var(--text)] hover:bg-[var(--accent)]/25"
          }`}
        >
          {interestActive ? "My interests · on" : "My interests"}
        </button>
        <span className="text-xs text-[var(--muted)]">
          Strategy · Sales · CS · PM · PMM · Marketing · ML/AI
        </span>
      </div>
      <ChipFilter
        label="Roles"
        options={interestOptions}
        selected={roles.filter((r) => MY_INTEREST_ROLES.includes(r as (typeof MY_INTEREST_ROLES)[number]))}
        onChange={(next) => {
          const extras = roles.filter(
            (r) => !MY_INTEREST_ROLES.includes(r as (typeof MY_INTEREST_ROLES)[number])
          );
          onRolesChange([...next, ...extras]);
        }}
      />
      <details className="group">
        <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--text)]">
          More roles & domains
        </summary>
        <div className="mt-3 space-y-3">
          <ChipFilter
            label="All roles"
            options={roleOptions}
            selected={roles}
            onChange={onRolesChange}
          />
          <ChipFilter
            label="Domains"
            options={domainOptions}
            selected={domains}
            onChange={onDomainsChange}
          />
        </div>
      </details>
    </div>
  );
}
