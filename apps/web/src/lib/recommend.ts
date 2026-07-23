import { desc, eq } from "drizzle-orm";
import { recommendations, resumeProfiles } from "@job-signal/db";
import { db } from "./db";
import { getTrends, listActiveJobs } from "./trends";
import { fitScoreForRole, parseResumeText, type ParsedResume } from "./resume";
import { formatLabel, ROLE_FAMILIES } from "./classify";
import { isoNow } from "./periods";

export async function buildRecommendations(resumeId: number, sources?: string[]) {
  const resumeRows = await db
    .select()
    .from(resumeProfiles)
    .where(eq(resumeProfiles.id, resumeId))
    .limit(1);
  const resumeRow = resumeRows[0];
  if (!resumeRow) throw new Error("Resume not found");

  const resume: ParsedResume = {
    rawText: resumeRow.rawText,
    skills: JSON.parse(resumeRow.skillsJson),
    titles: JSON.parse(resumeRow.titlesJson),
    domains: JSON.parse(resumeRow.domainsJson),
    seniority: resumeRow.seniority,
    yearsExperience: resumeRow.yearsExperience,
  };

  const trends = await getTrends({ periodType: "month", sources });
  const roleTrends = trends.roles.rows;
  const trendByRole = new Map(roleTrends.map((r) => [r.key, r]));

  const scored = await Promise.all(
    ROLE_FAMILIES.filter((rf) => rf !== "other").map(async (roleFamily) => {
      const { score: fitScore, why: whyFit } = fitScoreForRole(resume, roleFamily);
      const trend = trendByRole.get(roleFamily);
      const trendStrength =
        trend == null
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((trend.pct ?? 0) / 100) * 0.5 +
                  (trend.delta > 0 ? 0.3 : 0) +
                  Math.min(trend.current, 50) / 100
              )
            );
      const combined = fitScore * 0.55 + trendStrength * 0.45;

      const hiringCompanies = trends.companies.rows
        .filter((c) => c.delta > 0 || c.current > 0)
        .slice(0, 8)
        .map((c) => c.label);

      const whyHot: string[] = [];
      if (trend) {
        whyHot.push(
          `${trends.effectivePeriodType === "week" ? "WoW" : trends.effectivePeriodType === "quarter" ? "QoQ" : "MoM"}: ${
            trend.pct == null ? "n/a" : `${trend.pct >= 0 ? "+" : ""}${trend.pct.toFixed(1)}%`
          } (${trend.previous} → ${trend.current} openings)`
        );
        if (trend.newCount > 0) whyHot.push(`${trend.newCount} new postings in current period`);
      } else {
        whyHot.push("Not enough snapshot history for this role family yet");
      }
      if (hiringCompanies.length) {
        whyHot.push(`Active hiring at: ${hiringCompanies.slice(0, 4).join(", ")}`);
      }

      const examples = (await listActiveJobs({ sources, roleFamily, limit: 5 })).map((j) => ({
        title: j.title,
        company: j.companyName,
        source: j.source,
        url: j.url,
        domain: j.domain,
        location: j.location,
      }));

      let domain: string | null = resume.domains[0] ?? null;
      const domainTrend = trends.domains.rows.find((d) => resume.domains.includes(d.key));
      if (domainTrend) domain = domainTrend.key;

      return {
        roleFamily,
        domain,
        fitScore,
        trendScore: trendStrength,
        combinedScore: combined,
        whyFit,
        whyHot,
        examples,
        label: formatLabel(roleFamily),
      };
    })
  );

  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  const top = scored.slice(0, 8);

  await db.delete(recommendations).where(eq(recommendations.resumeId, resumeId));
  const now = isoNow();
  for (const r of top) {
    await db.insert(recommendations).values({
      resumeId,
      roleFamily: r.roleFamily,
      domain: r.domain,
      fitScore: r.fitScore,
      trendScore: r.trendScore,
      combinedScore: r.combinedScore,
      whyFitJson: JSON.stringify(r.whyFit),
      whyHotJson: JSON.stringify(r.whyHot),
      exampleJobsJson: JSON.stringify(r.examples),
      createdAt: now,
    });
  }

  return {
    resumeId,
    interimNote: trends.interimNote,
    periodType: trends.effectivePeriodType,
    recommendations: top,
  };
}

export async function latestResume() {
  const rows = await db
    .select()
    .from(resumeProfiles)
    .orderBy(desc(resumeProfiles.createdAt))
    .limit(1);
  return rows[0];
}

export async function saveResumeFromText(rawText: string, fileName?: string) {
  const parsed = parseResumeText(rawText);
  const now = isoNow();
  const result = await db
    .insert(resumeProfiles)
    .values({
      fileName: fileName ?? null,
      rawText: parsed.rawText,
      skillsJson: JSON.stringify(parsed.skills),
      titlesJson: JSON.stringify(parsed.titles),
      domainsJson: JSON.stringify(parsed.domains),
      seniority: parsed.seniority,
      yearsExperience: parsed.yearsExperience,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: resumeProfiles.id });
  return { id: result[0].id, parsed };
}
