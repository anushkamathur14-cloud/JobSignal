import { eq, and } from "drizzle-orm";
import { companies, jobPostings } from "@job-signal/db";
import { db } from "../db";
import { classifyDomain, classifyRoleFamily } from "../classify";
import { isoNow } from "../periods";
import { writeSnapshots } from "../trends";

export type NormalizedJob = {
  source: string;
  externalId: string;
  companyId: number | null;
  companyName: string;
  title: string;
  location?: string | null;
  remote?: boolean;
  url?: string | null;
  domainHint?: string | null;
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "job-signal/1.0 (personal research)",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function fetchGreenhouse(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
  );
  const jobs = data.jobs ?? [];
  return jobs.map((j: { id: number; title: string; absolute_url?: string; location?: { name?: string } }) => ({
    source: "greenhouse",
    externalId: String(j.id),
    companyId: null,
    companyName: slug,
    title: j.title,
    location: j.location?.name ?? null,
    remote: /remote/i.test(j.location?.name ?? "") || /remote/i.test(j.title),
    url: j.absolute_url ?? null,
  }));
}

export async function fetchLever(slug: string): Promise<NormalizedJob[]> {
  const jobs = await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(jobs)) return [];
  return jobs.map(
    (j: {
      id: string;
      text: string;
      hostedUrl?: string;
      categories?: { location?: string };
      workplaceType?: string;
    }) => ({
      source: "lever",
      externalId: j.id,
      companyId: null,
      companyName: slug,
      title: j.text,
      location: j.categories?.location ?? null,
      remote: /remote/i.test(j.workplaceType ?? "") || /remote/i.test(j.categories?.location ?? ""),
      url: j.hostedUrl ?? null,
    })
  );
}

export async function fetchAshby(slug: string): Promise<NormalizedJob[]> {
  // Ashby public job board API
  const data = await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`
  );
  const jobs = data.jobs ?? [];
  return jobs.map(
    (j: {
      id: string;
      title: string;
      jobUrl?: string;
      location?: string;
      isRemote?: boolean;
    }) => ({
      source: "ashby",
      externalId: j.id,
      companyId: null,
      companyName: slug,
      title: j.title,
      location: j.location ?? null,
      remote: Boolean(j.isRemote) || /remote/i.test(j.location ?? ""),
      url: j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${j.id}`,
    })
  );
}

export async function fetchWorkday(boardUrl: string, companyName: string): Promise<NormalizedJob[]> {
  // Workday CXS jobs endpoint — POST with pagination
  const jobs: NormalizedJob[] = [];
  let offset = 0;
  const limit = 20;
  for (let page = 0; page < 10; page++) {
    const body = {
      appliedFacets: {},
      limit,
      offset,
      searchText: "",
    };
    const data = await fetchJson(boardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const postings = data.jobPostings ?? [];
    if (!postings.length) break;
    for (const p of postings) {
      const ext =
        p.bulletFields?.[0] ??
        p.externalPath ??
        `${p.title}-${p.locationsText ?? ""}`;
      const base = boardUrl.replace(/\/wday\/cxs\/.*$/, "");
      const path = p.externalPath ?? "";
      jobs.push({
        source: "workday",
        externalId: String(ext),
        companyId: null,
        companyName,
        title: p.title ?? "Untitled",
        location: p.locationsText ?? null,
        remote: /remote/i.test(p.locationsText ?? "") || /remote/i.test(p.title ?? ""),
        url: path ? `${base}${path}` : null,
      });
    }
    offset += limit;
    if (postings.length < limit) break;
  }
  return jobs;
}

export async function fetchJSearch(query: string, apiKey: string): Promise<NormalizedJob[]> {
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`;
  const data = await fetchJson(url, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
  });
  const results = data.data ?? [];
  return results.map(
    (j: {
      job_id: string;
      job_title: string;
      employer_name?: string;
      job_city?: string;
      job_country?: string;
      job_is_remote?: boolean;
      job_apply_link?: string;
    }) => ({
      source: "jsearch",
      externalId: j.job_id,
      companyId: null,
      companyName: j.employer_name ?? "Unknown",
      title: j.job_title,
      location: [j.job_city, j.job_country].filter(Boolean).join(", ") || null,
      remote: Boolean(j.job_is_remote),
      url: j.job_apply_link ?? null,
    })
  );
}

async function upsertJob(job: NormalizedJob, domainHint?: string | null): Promise<number> {
  const now = isoNow();
  const roleFamily = classifyRoleFamily(job.title);
  const domain = classifyDomain(job.title, domainHint ?? job.domainHint);

  const existingRows = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.source, job.source), eq(jobPostings.externalId, job.externalId)))
    .limit(1);
  const existing = existingRows[0];

  if (existing) {
    await db
      .update(jobPostings)
      .set({
        title: job.title,
        companyId: job.companyId,
        companyName: job.companyName,
        roleFamily,
        domain,
        location: job.location ?? null,
        remote: job.remote ?? false,
        url: job.url ?? null,
        lastSeen: now,
        isActive: true,
      })
      .where(eq(jobPostings.id, existing.id));
    return existing.id;
  }

  const result = await db
    .insert(jobPostings)
    .values({
      source: job.source,
      externalId: job.externalId,
      companyId: job.companyId,
      companyName: job.companyName,
      title: job.title,
      roleFamily,
      domain,
      location: job.location ?? null,
      remote: job.remote ?? false,
      url: job.url ?? null,
      firstSeen: now,
      lastSeen: now,
      isActive: true,
    })
    .returning({ id: jobPostings.id });
  return result[0].id;
}

export async function runIngest(opts?: { includeJsearch?: boolean; sources?: string[] }) {
  const enabled = await db.select().from(companies).where(eq(companies.enabled, true));
  const allow = opts?.sources?.length ? new Set(opts.sources) : null;
  const seenIds = new Set<number>();
  const errors: string[] = [];
  let upserted = 0;

  for (const company of enabled) {
    if (allow && !allow.has(company.atsType)) continue;
    try {
      let jobs: NormalizedJob[] = [];
      if (company.atsType === "greenhouse" && company.boardSlug) {
        jobs = await fetchGreenhouse(company.boardSlug);
      } else if (company.atsType === "lever" && company.boardSlug) {
        jobs = await fetchLever(company.boardSlug);
      } else if (company.atsType === "ashby" && company.boardSlug) {
        jobs = await fetchAshby(company.boardSlug);
      } else if (company.atsType === "workday" && company.boardUrl) {
        jobs = await fetchWorkday(company.boardUrl, company.name);
      } else {
        continue;
      }

      for (const j of jobs) {
        j.companyId = company.id;
        j.companyName = company.name;
        j.domainHint = company.domainHint;
        const id = await upsertJob(j, company.domainHint);
        seenIds.add(id);
        upserted++;
      }
    } catch (e) {
      errors.push(`${company.name} (${company.atsType}): ${(e as Error).message}`);
    }
  }

  const touchedSources = [
    ...new Set(
      enabled
        .filter((c) => !allow || allow.has(c.atsType))
        .map((c) => c.atsType)
        .filter((t) => t !== "jsearch")
    ),
  ];
  if (touchedSources.length && seenIds.size) {
    const active = await db.select().from(jobPostings).where(eq(jobPostings.isActive, true));
    for (const job of active) {
      if (!touchedSources.includes(job.source)) continue;
      if (job.source === "jsearch") continue;
      if (!seenIds.has(job.id)) {
        await db.update(jobPostings).set({ isActive: false }).where(eq(jobPostings.id, job.id));
      }
    }
  }

  const apiKey = process.env.JSEARCH_API_KEY;
  if (opts?.includeJsearch !== false && apiKey && (!allow || allow.has("jsearch"))) {
    const queries = [
      "software engineer remote",
      "machine learning engineer",
      "product manager",
      "data scientist",
    ];
    try {
      for (const q of queries) {
        const jobs = await fetchJSearch(q, apiKey);
        for (const j of jobs) {
          const id = await upsertJob(j);
          seenIds.add(id);
          upserted++;
        }
      }
    } catch (e) {
      errors.push(`jsearch: ${(e as Error).message}`);
    }
  }

  await writeSnapshots();

  return { upserted, seen: seenIds.size, errors, companies: enabled.length };
}

