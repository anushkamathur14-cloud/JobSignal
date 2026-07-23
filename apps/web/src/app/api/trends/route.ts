import { NextRequest, NextResponse } from "next/server";
import { migrate } from "@/lib/migrate";
import { client } from "@/lib/db";
import { getTrends } from "@/lib/trends";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await migrate(client);
  const sp = req.nextUrl.searchParams;
  const periodType = (sp.get("period") as "week" | "month" | "quarter") || "month";
  const sources = sp.get("sources")?.split(",").filter(Boolean);
  const roles = sp.get("roles")?.split(",").filter(Boolean);
  const domains = sp.get("domains")?.split(",").filter(Boolean);
  const data = await getTrends({ periodType, sources, roles, domains });
  return NextResponse.json(data);
}
