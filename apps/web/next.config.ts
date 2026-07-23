import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "pdf-parse"],
  // Only set tracing root for local monorepo; on Vercel the app root is apps/web
  ...(process.env.VERCEL
    ? {}
    : {
        outputFileTracingRoot: path.join(__dirname, "../../"),
      }),
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/vercel-seed.json", "./data/companies.yaml"],
  },
};

export default nextConfig;
