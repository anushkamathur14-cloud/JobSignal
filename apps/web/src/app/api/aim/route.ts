import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { buildRecommendations, latestResume } from "@/lib/recommend";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await migrate(client);
  const sources = req.nextUrl.searchParams.get("sources")?.split(",").filter(Boolean);
  const resumeIdParam = req.nextUrl.searchParams.get("resumeId");
  const resume = resumeIdParam ? { id: Number(resumeIdParam) } : await latestResume();
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 404 });
  }
  const result = await buildRecommendations(resume.id, sources);
  return NextResponse.json(result);
}
