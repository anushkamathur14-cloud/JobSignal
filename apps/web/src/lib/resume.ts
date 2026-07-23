import { SKILL_LEXICON, classifyRoleFamily, formatLabel, type RoleFamily } from "./classify";

export type ParsedResume = {
  rawText: string;
  skills: string[];
  titles: string[];
  domains: string[];
  seniority: string | null;
  yearsExperience: number | null;
};

const TITLE_HINTS = [
  /(?:title|role|position)\s*[:\-]\s*(.+)/gi,
  /\b((?:senior|staff|principal|lead|junior)?\s*(?:software|product|data|ml|machine learning|design|devops|security|frontend|backend|full[\s-]?stack)\s+(?:engineer|manager|scientist|designer|analyst))\b/gi,
];

export function parseResumeText(rawText: string): ParsedResume {
  const lower = rawText.toLowerCase();
  const skills = SKILL_LEXICON.filter((s) => lower.includes(s.toLowerCase()));

  const titles = new Set<string>();
  for (const re of TITLE_HINTS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText))) {
      const t = (m[1] || m[0]).trim().slice(0, 80);
      if (t.length > 3) titles.add(t);
    }
  }

  let seniority: string | null = null;
  if (/\b(principal|staff)\b/i.test(rawText)) seniority = "staff_plus";
  else if (/\b(senior|sr\.)\b/i.test(rawText)) seniority = "senior";
  else if (/\b(lead)\b/i.test(rawText)) seniority = "lead";
  else if (/\b(junior|entry)\b/i.test(rawText)) seniority = "junior";
  else seniority = "mid";

  let yearsExperience: number | null = null;
  const yearsMatch = rawText.match(/(\d+)\+?\s*\+?\s*years?/i);
  if (yearsMatch) yearsExperience = Number(yearsMatch[1]);

  const roleHints = [...titles].map((t) => classifyRoleFamily(t));
  const domains: string[] = [];
  if (/\b(ai|ml|llm|machine learning)\b/i.test(rawText)) domains.push("ai_ml");
  if (/\b(fintech|payments|banking)\b/i.test(rawText)) domains.push("fintech");
  if (/\b(health|medical)\b/i.test(rawText)) domains.push("healthcare");
  if (/\b(infra|platform|cloud|devops)\b/i.test(rawText)) domains.push("infrastructure");
  if (roleHints.includes("machine_learning")) domains.push("ai_ml");

  return {
    rawText,
    skills,
    titles: [...titles].slice(0, 12),
    domains: [...new Set(domains)],
    seniority,
    yearsExperience,
  };
}

const ROLE_SKILL_AFFINITY: Record<string, string[]> = {
  software_engineering: ["typescript", "javascript", "react", "node", "python", "java", "go", "system design", "sql"],
  data_engineering: ["python", "sql", "spark", "aws", "kafka"],
  machine_learning: ["python", "pytorch", "tensorflow", "machine learning", "llm", "rag", "spark"],
  data_science: ["python", "sql", "spark", "data science", "machine learning"],
  product_management: ["product management", "sql", "figma"],
  program_management: ["product management", "system design"],
  design: ["figma"],
  devops_sre: ["kubernetes", "docker", "terraform", "aws", "gcp", "ci/cd"],
  security: ["aws", "python"],
  qa_test: ["typescript", "javascript", "python", "ci/cd"],
};

export function fitScoreForRole(
  resume: ParsedResume,
  roleFamily: string
): { score: number; why: string[] } {
  const affinity = ROLE_SKILL_AFFINITY[roleFamily] ?? [];
  const overlap = affinity.filter((s) =>
    resume.skills.some((rs) => rs.toLowerCase() === s.toLowerCase())
  );
  const titleBoost = resume.titles.some((t) => classifyRoleFamily(t) === roleFamily) ? 0.25 : 0;
  const skillScore = affinity.length ? overlap.length / affinity.length : 0;
  const score = Math.min(1, skillScore * 0.75 + titleBoost);

  const why: string[] = [];
  if (overlap.length) {
    why.push(`Overlapping skills: ${overlap.slice(0, 5).join(", ")}`);
  }
  const matchingTitles = resume.titles.filter((t) => classifyRoleFamily(t) === roleFamily);
  if (matchingTitles.length) {
    why.push(`Resume titles align with ${formatLabel(roleFamily)} (${matchingTitles[0]})`);
  }
  if (resume.seniority) {
    why.push(`Seniority signal: ${formatLabel(resume.seniority)}`);
  }
  if (!why.length) {
    why.push(`Limited direct overlap — consider as adjacent to your ${resume.titles[0] ?? "background"}`);
  }
  return { score, why };
}

export function roleFamiliesFromResume(resume: ParsedResume): RoleFamily[] {
  const fromTitles = resume.titles.map((t) => classifyRoleFamily(t));
  const fromSkills: RoleFamily[] = [];
  if (resume.skills.some((s) => ["pytorch", "tensorflow", "llm", "machine learning"].includes(s))) {
    fromSkills.push("machine_learning");
  }
  if (resume.skills.some((s) => ["react", "typescript", "node", "java", "go"].includes(s))) {
    fromSkills.push("software_engineering");
  }
  if (resume.skills.includes("product management")) fromSkills.push("product_management");
  return [...new Set([...fromTitles, ...fromSkills, "software_engineering" as RoleFamily])];
}
