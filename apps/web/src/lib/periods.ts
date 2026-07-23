import {
  startOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  getYear,
  parseISO,
  subMonths,
  subWeeks,
  subQuarters,
} from "date-fns";

export function isoNow(): string {
  return new Date().toISOString();
}

export function dayKey(d = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function weekKey(d = new Date()): string {
  const week = getISOWeek(d);
  const year = getISOWeekYear(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(d = new Date()): string {
  return format(d, "yyyy-MM");
}

export function quarterKey(d = new Date()): string {
  return `${getYear(d)}-Q${getQuarter(d)}`;
}

export function previousPeriodKey(
  periodType: "week" | "month" | "quarter",
  periodKey: string
): string | null {
  try {
    if (periodType === "month") {
      const [y, m] = periodKey.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return monthKey(subMonths(d, 1));
    }
    if (periodType === "quarter") {
      const match = periodKey.match(/^(\d{4})-Q(\d)$/);
      if (!match) return null;
      const y = Number(match[1]);
      const q = Number(match[2]);
      const month = (q - 1) * 3;
      const d = new Date(y, month, 1);
      return quarterKey(subQuarters(d, 1));
    }
    if (periodType === "week") {
      const match = periodKey.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return null;
      // approximate: take Thursday of that ISO week
      const year = Number(match[1]);
      const week = Number(match[2]);
      const jan4 = new Date(year, 0, 4);
      const start = startOfWeek(jan4, { weekStartsOn: 1 });
      const d = new Date(start);
      d.setDate(start.getDate() + (week - 1) * 7);
      return weekKey(subWeeks(d, 1));
    }
  } catch {
    return null;
  }
  return null;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function parseMaybeDate(s: string): Date {
  try {
    return parseISO(s);
  } catch {
    return new Date(s);
  }
}
