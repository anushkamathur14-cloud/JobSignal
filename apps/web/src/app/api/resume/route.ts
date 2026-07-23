import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { resumeProfiles } from "@job-signal/db";
import { db, client } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { saveResumeFromText } from "@/lib/recommend";

export const runtime = "nodejs";

export async function GET() {
  await migrate(client);
  const rows = await db.select().from(resumeProfiles).orderBy(desc(resumeProfiles.createdAt));
  return NextResponse.json({
    resumes: rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      skills: JSON.parse(r.skillsJson),
      titles: JSON.parse(r.titlesJson),
      domains: JSON.parse(r.domainsJson),
      seniority: r.seniority,
      yearsExperience: r.yearsExperience,
      createdAt: r.createdAt,
      preview: r.rawText.slice(0, 400),
    })),
  });
}

export async function POST(req: NextRequest) {
  await migrate(client);
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const textField = form.get("text") as string | null;
    let raw = textField ?? "";
    let fileName: string | undefined;

    if (file) {
      fileName = file.name;
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: new Uint8Array(buf) });
          const parsed = await parser.getText();
          raw = parsed.text ?? "";
          await parser.destroy();
        } catch {
          raw = buf.toString("utf8");
        }
      } else {
        raw = buf.toString("utf8");
      }
    }

    if (!raw.trim()) {
      return NextResponse.json({ error: "No resume text found" }, { status: 400 });
    }
    const saved = await saveResumeFromText(raw, fileName);
    return NextResponse.json(saved);
  }

  const body = await req.json();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const saved = await saveResumeFromText(body.text, body.fileName);
  return NextResponse.json(saved);
}
