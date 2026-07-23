import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { jobPostings } from "@job-signal/db";
import { db, client } from "@/lib/db";
import { migrate } from "@/lib/migrate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await migrate(client);
  const sp = req.nextUrl.searchParams;
  const sources = sp.get("sources")?.split(",").filter(Boolean);
  const roleFamily = sp.get("roleFamily") || undefined;
  const limit = Number(sp.get("limit") || 50);

  const clauses = [eq(jobPostings.isActive, true)];
  if (sources?.length) clauses.push(inArray(jobPostings.source, sources));
  if (roleFamily) clauses.push(eq(jobPostings.roleFamily, roleFamily));

  const jobs = await db
    .select()
    .from(jobPostings)
    .where(and(...clauses))
    .orderBy(desc(jobPostings.lastSeen))
    .limit(limit);

  return NextResponse.json({ jobs });
}
