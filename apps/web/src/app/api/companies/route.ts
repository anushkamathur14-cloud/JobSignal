import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { companies } from "@job-signal/db";
import { db, client } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { isoNow } from "@/lib/periods";

export const runtime = "nodejs";

export async function GET() {
  await migrate(client);
  const rows = await db.select().from(companies);
  return NextResponse.json({ companies: rows });
}

export async function POST(req: NextRequest) {
  await migrate(client);
  const body = await req.json();
  const now = isoNow();
  const result = await db
    .insert(companies)
    .values({
      name: body.name,
      atsType: body.atsType,
      boardSlug: body.boardSlug ?? null,
      boardUrl: body.boardUrl ?? null,
      domainHint: body.domainHint ?? null,
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companies.id });
  return NextResponse.json({ id: result[0].id });
}

export async function PATCH(req: NextRequest) {
  await migrate(client);
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db
    .update(companies)
    .set({
      name: body.name,
      atsType: body.atsType,
      boardSlug: body.boardSlug,
      boardUrl: body.boardUrl,
      domainHint: body.domainHint,
      enabled: body.enabled,
      updatedAt: isoNow(),
    })
    .where(eq(companies.id, body.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await migrate(client);
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(companies).where(eq(companies.id, id));
  return NextResponse.json({ ok: true });
}
