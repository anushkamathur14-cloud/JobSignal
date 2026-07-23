import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "pdf-parse"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/vercel-seed.json", "../../data/vercel-seed.json"],
  },
};

export default nextConfig;
