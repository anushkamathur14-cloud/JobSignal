import { NextResponse } from "next/server";
import { migrate } from "@/lib/migrate";
import { client } from "@/lib/db";
import { reclassifyActiveJobs } from "@/lib/ingest/run";

export const runtime = "nodejs";

export async function POST() {
  await migrate(client);
  const result = await reclassifyActiveJobs();
  return NextResponse.json(result);
}
