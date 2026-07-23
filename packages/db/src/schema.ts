import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    atsType: text("ats_type").notNull(), // greenhouse | lever | ashby | workday | jsearch | other
    boardSlug: text("board_slug"),
    boardUrl: text("board_url"),
    domainHint: text("domain_hint"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("companies_ats_slug").on(t.atsType, t.boardSlug)]
);

export const jobPostings = sqliteTable(
  "job_postings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    companyId: integer("company_id").references(() => companies.id),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    roleFamily: text("role_family").notNull(),
    domain: text("domain").notNull(),
    location: text("location"),
    remote: integer("remote", { mode: "boolean" }).default(false),
    url: text("url"),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("jobs_source_external").on(t.source, t.externalId),
    index("jobs_role_family").on(t.roleFamily),
    index("jobs_domain").on(t.domain),
    index("jobs_active").on(t.isActive),
  ]
);

export const jobSnapshots = sqliteTable(
  "job_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    periodType: text("period_type").notNull(), // day | week | month | quarter
    periodKey: text("period_key").notNull(), // 2026-07-23 | 2026-W30 | 2026-07 | 2026-Q3
    source: text("source").notNull(),
    companyId: integer("company_id"),
    companyName: text("company_name"),
    roleFamily: text("role_family").notNull(),
    domain: text("domain").notNull(),
    activeCount: integer("active_count").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    capturedAt: text("captured_at").notNull(),
  },
  (t) => [
    uniqueIndex("snapshots_unique").on(
      t.periodType,
      t.periodKey,
      t.source,
      t.companyId,
      t.roleFamily,
      t.domain
    ),
    index("snapshots_period").on(t.periodType, t.periodKey),
  ]
);

export const resumeProfiles = sqliteTable("resume_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name"),
  rawText: text("raw_text").notNull(),
  skillsJson: text("skills_json").notNull().default("[]"),
  titlesJson: text("titles_json").notNull().default("[]"),
  domainsJson: text("domains_json").notNull().default("[]"),
  seniority: text("seniority"),
  yearsExperience: real("years_experience"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const recommendations = sqliteTable("recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resumeId: integer("resume_id").references(() => resumeProfiles.id),
  roleFamily: text("role_family").notNull(),
  domain: text("domain"),
  fitScore: real("fit_score").notNull(),
  trendScore: real("trend_score").notNull(),
  combinedScore: real("combined_score").notNull(),
  whyFitJson: text("why_fit_json").notNull().default("[]"),
  whyHotJson: text("why_hot_json").notNull().default("[]"),
  exampleJobsJson: text("example_jobs_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export type Company = typeof companies.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;
export type JobSnapshot = typeof jobSnapshots.$inferSelect;
export type ResumeProfile = typeof resumeProfiles.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
