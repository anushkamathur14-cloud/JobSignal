"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Trends" },
  { href: "/companies", label: "Companies" },
  { href: "/aim", label: "Aim" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_80%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span
            className="text-2xl tracking-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-display-loaded), var(--font-display)" }}
          >
            Job Signal
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">personal</span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-[var(--bg-soft)] text-[var(--text)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
