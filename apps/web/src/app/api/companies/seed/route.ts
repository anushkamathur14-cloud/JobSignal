import { NextResponse } from "next/server";
import { client } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { seedCompaniesFromYaml } from "@/lib/seed-companies";

export const runtime = "nodejs";

/** Sync curated enterprise / growth / startup pack from companies.yaml */
export async function POST() {
  await migrate(client);
  try {
    const result = await seedCompaniesFromYaml({ disableMissing: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
