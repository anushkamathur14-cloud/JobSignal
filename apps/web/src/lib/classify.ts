export const ROLE_FAMILIES = [
  "software_engineering",
  "data_engineering",
  "data_science",
  "machine_learning",
  "product_management",
  "program_management",
  "design",
  "devops_sre",
  "security",
  "qa_test",
  "sales",
  "marketing",
  "customer_success",
  "support",
  "finance",
  "people_hr",
  "operations",
  "legal",
  "research",
  "technical_writing",
  "executive",
  "other",
] as const;

export type RoleFamily = (typeof ROLE_FAMILIES)[number];

export const DOMAINS = [
  "ai_ml",
  "fintech",
  "healthcare",
  "infrastructure",
  "observability",
  "consumer",
  "enterprise",
  "marketplace",
  "media",
  "defense",
  "retail",
  "productivity",
  "design_tools",
  "creative_tools",
  "climate",
  "other",
] as const;

export type Domain = (typeof DOMAINS)[number];

/** Human-readable note for the unclassified bucket */
export const OTHER_ROLE_NOTE =
  "Other = job titles that didn’t match a known role family (e.g. niche specialist titles, facilities, admin). Filter it out or pick specific roles below.";

const ROLE_RULES: { family: RoleFamily; patterns: RegExp[] }[] = [
  {
    family: "machine_learning",
    patterns: [
      /\b(machine learning|ml engineer|mlops|llm|genai|generative ai|deep learning|ai engineer|ai researcher|applied scientist)\b/i,
    ],
  },
  {
    family: "data_engineering",
    patterns: [/\b(data engineer|analytics engineer|etl|data platform|warehouse engineer)\b/i],
  },
  {
    family: "data_science",
    patterns: [/\b(data scientist|data science|data analyst|bi engineer|business intelligence|analytics)\b/i],
  },
  {
    family: "devops_sre",
    patterns: [
      /\b(devops|sre|site reliability|platform engineer|infrastructure engineer|cloud engineer|reliability engineer|systems engineer)\b/i,
    ],
  },
  {
    family: "security",
    patterns: [/\b(security engineer|appsec|infosec|cybersecurity|security analyst|security architect|red team|blue team)\b/i],
  },
  {
    family: "qa_test",
    patterns: [/\b(qa engineer|quality assurance|test engineer|sdet|automation engineer|quality engineer)\b/i],
  },
  {
    family: "product_management",
    patterns: [/\b(product manager|product owner|group product|principal product|\bpm\b|product lead)\b/i],
  },
  {
    family: "program_management",
    patterns: [/\b(program manager|technical program|tpm\b|project manager|scrum master)\b/i],
  },
  {
    family: "design",
    patterns: [
      /\b(product designer|ux designer|ui designer|design systems|brand designer|visual designer|graphic designer|ux researcher)\b/i,
    ],
  },
  {
    family: "software_engineering",
    patterns: [
      /\b(software engineer|software developer|backend|frontend|full[\s-]?stack|mobile engineer|ios|android|web engineer|engineering manager|staff engineer|principal engineer|swe|developer|engineer ii|engineer iii|member of technical)\b/i,
    ],
  },
  {
    family: "sales",
    patterns: [
      /\b(account executive|sales|ae\b|sdr|bdr|revenue|account manager|sales manager|business development|enterprise sales)\b/i,
    ],
  },
  {
    family: "marketing",
    patterns: [
      /\b(marketing|growth|demand gen|content marketing|brand manager|product marketing|pmm\b|seo|lifecycle marketing)\b/i,
    ],
  },
  {
    family: "customer_success",
    patterns: [/\b(customer success|solutions engineer|technical account|implementation|customer engineer)\b/i],
  },
  {
    family: "support",
    patterns: [/\b(support engineer|technical support|customer support|help desk|support specialist)\b/i],
  },
  {
    family: "finance",
    patterns: [/\b(finance|accountant|controller|fp&a|treasury|financial analyst|auditor)\b/i],
  },
  {
    family: "people_hr",
    patterns: [/\b(recruiter|people ops|human resources|hrbp|talent|people partner|sourcer)\b/i],
  },
  {
    family: "operations",
    patterns: [/\b(operations|bizops|business operations|chief of staff|strategy & operations|revops)\b/i],
  },
  {
    family: "legal",
    patterns: [/\b(counsel|attorney|legal|compliance|paralegal)\b/i],
  },
  {
    family: "research",
    patterns: [/\b(research scientist|research engineer|research associate|\bphd\b)\b/i],
  },
  {
    family: "technical_writing",
    patterns: [/\b(technical writer|documentation|docs engineer|content designer)\b/i],
  },
  {
    family: "executive",
    patterns: [/\b(chief |vp |vice president|director of|head of|c-level|ceo|cto|cfo|coo|cmo)\b/i],
  },
];

const DOMAIN_RULES: { domain: Domain; patterns: RegExp[] }[] = [
  { domain: "ai_ml", patterns: [/\b(ai|ml|llm|machine learning|openai|anthropic|gpu|neural)\b/i] },
  { domain: "fintech", patterns: [/\b(fintech|payments|banking|crypto|trading|stripe|ramp)\b/i] },
  { domain: "healthcare", patterns: [/\b(health|medical|biotech|pharma|clinical)\b/i] },
  { domain: "infrastructure", patterns: [/\b(cloud|infra|kubernetes|cdn|networking|devops)\b/i] },
  { domain: "observability", patterns: [/\b(observability|monitoring|datadog|logging)\b/i] },
  { domain: "defense", patterns: [/\b(defense|aerospace|autonomy|anduril)\b/i] },
  { domain: "media", patterns: [/\b(streaming|media|entertainment|gaming|netflix|spotify)\b/i] },
  { domain: "marketplace", patterns: [/\b(marketplace|two-sided|airbnb)\b/i] },
  { domain: "retail", patterns: [/\b(retail|ecommerce|e-commerce|walmart)\b/i] },
  { domain: "productivity", patterns: [/\b(productivity|collaboration|notion|linear)\b/i] },
  { domain: "design_tools", patterns: [/\b(figma|design tool)\b/i] },
  { domain: "creative_tools", patterns: [/\b(adobe|creative cloud|photoshop)\b/i] },
  { domain: "climate", patterns: [/\b(climate|energy|carbon|sustainability)\b/i] },
  { domain: "enterprise", patterns: [/\b(enterprise|b2b|saas|salesforce)\b/i] },
  { domain: "consumer", patterns: [/\b(consumer|social|discord)\b/i] },
];

export function classifyRoleFamily(title: string): RoleFamily {
  for (const rule of ROLE_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.family;
  }
  return "other";
}

export function classifyDomain(
  title: string,
  companyHint?: string | null,
  description?: string
): Domain {
  if (companyHint && DOMAINS.includes(companyHint as Domain)) {
    return companyHint as Domain;
  }
  const blob = `${title} ${description ?? ""} ${companyHint ?? ""}`;
  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((p) => p.test(blob))) return rule.domain;
  }
  return "other";
}

export function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const ROLE_FILTER_OPTIONS = ROLE_FAMILIES.map((id) => ({
  id,
  label: formatLabel(id),
}));

export const DOMAIN_FILTER_OPTIONS = DOMAINS.map((id) => ({
  id,
  label: formatLabel(id),
}));

export const SKILL_LEXICON = [
  "python",
  "typescript",
  "javascript",
  "react",
  "node",
  "java",
  "go",
  "golang",
  "rust",
  "kotlin",
  "swift",
  "sql",
  "postgres",
  "aws",
  "gcp",
  "azure",
  "kubernetes",
  "docker",
  "terraform",
  "spark",
  "pytorch",
  "tensorflow",
  "llm",
  "rag",
  "machine learning",
  "data science",
  "product management",
  "figma",
  "next.js",
  "graphql",
  "redis",
  "kafka",
  "ci/cd",
  "system design",
];
