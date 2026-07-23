import {
  format,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  getYear,
  parseISO,
  subMonths,
  subWeeks,
  subQuarters,
  startOfISOWeek,
  startOfMonth,
  startOfQuarter,
  addWeeks,
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

export function periodKeyFor(
  periodType: "week" | "month" | "quarter",
  d = new Date()
): string {
  if (periodType === "week") return weekKey(d);
  if (periodType === "month") return monthKey(d);
  return quarterKey(d);
}

export function periodStart(
  periodType: "week" | "month" | "quarter",
  d = new Date()
): Date {
  if (periodType === "week") return startOfISOWeek(d);
  if (periodType === "month") return startOfMonth(d);
  return startOfQuarter(d);
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
      const year = Number(match[1]);
      const week = Number(match[2]);
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const week1Start = startOfISOWeek(jan4);
      const d = addWeeks(week1Start, week - 1);
      return weekKey(subWeeks(d, 1));
    }
  } catch {
    return null;
  }
  return null;
}

/** Build N prior period keys ending at current (inclusive), oldest → newest */
export function recentPeriodKeys(
  periodType: "week" | "month" | "quarter",
  count: number,
  end = new Date()
): string[] {
  const keys: string[] = [];
  let d = end;
  for (let i = 0; i < count; i++) {
    keys.unshift(periodKeyFor(periodType, d));
    if (periodType === "week") d = subWeeks(d, 1);
    else if (periodType === "month") d = subMonths(d, 1);
    else d = subQuarters(d, 1);
  }
  return keys;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export function parseMaybeDate(s: string): Date {
  try {
    return parseISO(s);
  } catch {
    return new Date(s);
  }
}
