import { NextRequest, NextResponse } from "next/server";
import { migrate } from "@/lib/migrate";
import { client } from "@/lib/db";
import { runIngest } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  await migrate(client);
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
    return NextResponse.json(
      {
        error:
          "Ingest on Vercel needs a persistent DB. Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or run ingest locally.",
      },
      { status: 400 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const sources = body.sources as string[] | undefined;
  const includeJsearch = Boolean(process.env.JSEARCH_API_KEY) && body.includeJsearch !== false;
  const result = await runIngest({ sources, includeJsearch });
  return NextResponse.json(result);
}
